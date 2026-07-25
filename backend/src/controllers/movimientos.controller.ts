import type { Request, Response } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { Tipo, Moneda, EstadoMovimiento } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { recalcularSaldos, recalcularSaldosRubro, recalcularSaldosCaja } from '../lib/recalcularSaldos';
import { registrarAuditoria } from '../lib/auditoria';
import { withTenant } from '../lib/tenant';

const SUBCATEGORIAS_IMP = [
  'PAYWAY', 'REBA', 'AUTOENTRADA', 'IVA', 'IIBB', 'MUNICIPALIDAD', 'GANANCIAS',
] as const;

const PROVEEDOR_SELECT = { id: true, nombre: true, alias: true } as const;
const RESPONSABLE_SELECT = { id: true, nombre: true, email: true } as const;
const RUBRO_SELECT = { id: true, nombre: true, tipo: true, codigo: true } as const;

function toDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  return new Date(s);
}

function mapMov(m: any) {
  return {
    ...m,
    debe:        Number(m.debe),
    haber:       Number(m.haber),
    saldo:       Number(m.saldo),
    presupuesto: m.presupuesto !== null && m.presupuesto !== undefined ? Number(m.presupuesto) : null,
    costo_real:  m.costo_real  !== null && m.costo_real  !== undefined ? Number(m.costo_real)  : null,
  };
}

// Recalcula el saldo corrido del movimiento, ya sea por rubro (modelo nuevo)
// o por tab_numero (legado — Facturas, importes históricos sin rubro).
async function recalcularSaldoDeMovimiento(
  m:  { evento_id: number; tipo: Tipo; rubro_id: number | null; tab_numero: number | null },
  tx: Prisma.TransactionClient,
): Promise<void> {
  if (m.rubro_id !== null) {
    await recalcularSaldosRubro(m.evento_id, m.tipo, m.rubro_id, tx);
  } else if (m.tab_numero !== null) {
    await recalcularSaldos(m.evento_id, m.tipo, m.tab_numero, tx);
  }
}

// Transiciones de estado permitidas — ver PARTE 3 del refactor de rubros.
const ORDEN_ESTADOS: EstadoMovimiento[] = [
  EstadoMovimiento.PENDIENTE, EstadoMovimiento.COTIZANDO, EstadoMovimiento.CONFIRMADO, EstadoMovimiento.PAGADO,
];

function validarTransicionEstado(actual: EstadoMovimiento, nuevo: EstadoMovimiento): string | null {
  if (actual === nuevo) return null;
  if (nuevo === EstadoMovimiento.CANCELADO) return null; // siempre permitido
  if (actual === EstadoMovimiento.PAGADO) return 'El estado PAGADO es irreversible — no se puede modificar';
  if (actual === EstadoMovimiento.CANCELADO) return null; // reactivar un movimiento cancelado
  const from = ORDEN_ESTADOS.indexOf(actual);
  const to   = ORDEN_ESTADOS.indexOf(nuevo);
  if (from === -1 || to === -1) return null;
  if (to < from) return `No se puede retroceder de ${actual} a ${nuevo}`;
  return null;
}

const createSchema = z.object({
  rubro_id:              z.number().int().positive(),
  fecha:                 z.string().nullable().optional(),
  concepto:              z.string().nullable().optional(),
  descripcion:           z.string().nullable().optional(),
  debe:                  z.number().min(0).default(0),
  haber:                 z.number().min(0).default(0),
  moneda:                z.enum(['ARS', 'USD']).default('ARS'),
  orden:                 z.number().int().min(1).optional(),
  impuesto_subcategoria: z.string().nullable().optional(),
  impacta_caja:          z.boolean().optional(),
  cuenta_id:             z.number().int().positive().optional(),
  proveedor_id:          z.number().int().positive().optional(),
  estado_movimiento:     z.enum(['PENDIENTE', 'COTIZANDO', 'CONFIRMADO', 'PAGADO', 'CANCELADO']).optional(),
  presupuesto:           z.number().min(0).nullable().optional(),
  responsable_id:        z.number().int().positive().nullable().optional(),
  fecha_pago:            z.string().nullable().optional(),
  avisado_proveedor:     z.boolean().optional(),
}).refine(
  d => !(d.impacta_caja && !d.cuenta_id),
  { message: 'cuenta_id es requerido cuando impacta_caja es true', path: ['cuenta_id'] },
);

const updateSchema = z.object({
  fecha:                 z.string().nullable().optional(),
  concepto:              z.string().nullable().optional(),
  descripcion:           z.string().nullable().optional(),
  debe:                  z.number().min(0).optional(),
  haber:                 z.number().min(0).optional(),
  moneda:                z.enum(['ARS', 'USD']).optional(),
  impuesto_subcategoria: z.string().nullable().optional(),
  proveedor_id:          z.number().int().positive().nullable().optional(),
  estado_movimiento:     z.enum(['PENDIENTE', 'COTIZANDO', 'CONFIRMADO', 'PAGADO', 'CANCELADO']).optional(),
  presupuesto:           z.number().min(0).nullable().optional(),
  responsable_id:        z.number().int().positive().nullable().optional(),
  fecha_pago:            z.string().nullable().optional(),
  avisado_proveedor:     z.boolean().optional(),
});

export async function listSinConciliar(req: Request, res: Response) {
  const eventoId = Number(req.params.id);
  const evento = await prisma.evento.findFirst({ where: { id: eventoId, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!evento) { res.status(404).json({ error: 'Evento no encontrado' }); return; }

  const movs = await prisma.movimiento.findMany({
    where:   { evento_id: eventoId, movimiento_caja_id: null, deleted_at: null },
    orderBy: [{ tipo: 'asc' }, { orden: 'asc' }],
    include: { rubro: { select: RUBRO_SELECT } },
  });
  res.json(movs.map(m => ({
    ...mapMov(m),
    tab_codigo: m.rubro?.codigo ?? null,
  })));
}

export async function list(req: Request, res: Response) {
  const eventoId = Number(req.params.id);
  const rubroId  = req.query.rubro_id !== undefined ? Number(req.query.rubro_id) : undefined;
  const estado   = req.query.estado as string | undefined;

  const evento = await prisma.evento.findFirst({ where: { id: eventoId, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!evento) { res.status(404).json({ error: 'Evento no encontrado' }); return; }

  const movs = await prisma.movimiento.findMany({
    where: {
      evento_id:  eventoId,
      deleted_at: null,
      ...(rubroId !== undefined ? { rubro_id: rubroId } : {}),
      ...(estado ? { estado_movimiento: estado as EstadoMovimiento } : {}),
    },
    orderBy: { orden: 'asc' },
    include: {
      proveedor:   { select: PROVEEDOR_SELECT },
      rubro:       { select: RUBRO_SELECT },
      responsable: { select: RESPONSABLE_SELECT },
    },
  });
  res.json(movs.map(mapMov));
}

export async function create(req: Request, res: Response) {
  const eventoId = Number(req.params.id);
  const parsed   = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors });
    return;
  }

  const {
    rubro_id, fecha, concepto, descripcion,
    debe, haber, moneda, impuesto_subcategoria,
    impacta_caja, cuenta_id, proveedor_id,
    estado_movimiento, presupuesto, responsable_id, fecha_pago, avisado_proveedor,
  } = parsed.data;

  const evento = await prisma.evento.findFirst({ where: { id: eventoId, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!evento) { res.status(404).json({ error: 'Evento no encontrado' }); return; }

  const rubro = await prisma.rubro.findFirst({
    where: { id: rubro_id, ...withTenant(req.empresaId!), deleted_at: null },
  });
  if (!rubro) { res.status(400).json({ error: 'El rubro no existe o no pertenece a esta empresa' }); return; }
  if (!rubro.activo) { res.status(400).json({ error: 'El rubro está inactivo' }); return; }

  const tipo = rubro.tipo as unknown as Tipo;

  const isEgImp = rubro.codigo === 'EG-IMP';
  if (isEgImp) {
    if (!impuesto_subcategoria) {
      res.status(400).json({ error: 'impuesto_subcategoria es requerido para el rubro de Impuestos' });
      return;
    }
    if (!SUBCATEGORIAS_IMP.includes(impuesto_subcategoria as any)) {
      res.status(400).json({
        error: `Subcategoría inválida. Valores válidos: ${SUBCATEGORIAS_IMP.join(', ')}`,
      });
      return;
    }
  }

  if (cuenta_id) {
    const cuenta = await prisma.cuentaBancaria.findFirst({
      where: { id: cuenta_id, evento_id: eventoId, deleted_at: null },
    });
    if (!cuenta) { res.status(400).json({ error: 'Cuenta bancaria no encontrada en este evento' }); return; }
  }

  if (proveedor_id) {
    const prov = await prisma.proveedor.findFirst({ where: { id: proveedor_id, activo: true, deleted_at: null, ...withTenant(req.empresaId!) } });
    if (!prov) { res.status(400).json({ error: 'Proveedor no encontrado o inactivo' }); return; }
  }

  if (responsable_id) {
    const resp = await prisma.usuario.findFirst({ where: { id: responsable_id, deleted_at: null } });
    if (!resp) { res.status(400).json({ error: 'Responsable no encontrado' }); return; }
  }

  const movId = await prisma.$transaction(async tx => {
    let orden = parsed.data.orden;
    if (orden === undefined) {
      const last = await tx.movimiento.findFirst({
        where:   { evento_id: eventoId, tipo, rubro_id, deleted_at: null },
        orderBy: { orden: 'desc' },
        select:  { orden: true },
      });
      orden = (last?.orden ?? 0) + 1;
    }

    const mov = await tx.movimiento.create({
      data: {
        evento_id:             eventoId,
        tipo,
        rubro_id,
        fecha:                 toDate(fecha),
        concepto:              concepto ?? null,
        descripcion:           descripcion ?? null,
        debe:                  debe ?? 0,
        haber:                 haber ?? 0,
        moneda:                (moneda ?? 'ARS') as Moneda,
        orden,
        impuesto_subcategoria: impuesto_subcategoria ?? null,
        proveedor_id:          proveedor_id           ?? null,
        estado_movimiento:     (estado_movimiento as EstadoMovimiento) ?? EstadoMovimiento.PENDIENTE,
        presupuesto:           presupuesto            ?? null,
        responsable_id:        responsable_id         ?? null,
        fecha_pago:            toDate(fecha_pago),
        avisado_proveedor:     avisado_proveedor       ?? false,
        created_by:            req.user!.id,
        updated_by:            req.user!.id,
      },
    });

    if (impacta_caja && cuenta_id) {
      const lastCaja = await tx.movimientoCaja.findFirst({
        where:   { cuenta_id, deleted_at: null },
        orderBy: { orden: 'desc' },
        select:  { orden: true },
      });
      const cajaMov = await tx.movimientoCaja.create({
        data: {
          cuenta_id,
          fecha:       toDate(fecha),
          descripcion: descripcion ?? null,
          debe:        debe ?? 0,
          haber:       haber ?? 0,
          orden:       (lastCaja?.orden ?? 0) + 1,
          created_by:  req.user!.id,
          updated_by:  req.user!.id,
        },
      });
      await tx.movimiento.update({
        where: { id: mov.id },
        data:  { movimiento_caja_id: cajaMov.id },
      });
      await recalcularSaldosCaja(cuenta_id, tx);
    }

    await recalcularSaldosRubro(eventoId, tipo, rubro_id, tx);

    await registrarAuditoria({
      usuarioId:    req.user!.id,
      empresaId:    req.empresaId,
      accion:       'CREATE',
      entidad:      'Movimiento',
      entidadId:    mov.id,
      eventoId,
      descripcion:  `Creó movimiento en rubro "${rubro.nombre}" del evento #${eventoId}`,
      datosDespues: { rubro_id, concepto, debe, haber, moneda },
      ip:           req.ip,
      tx:           tx as any,
    });

    return mov.id;
  });

  const updated = await prisma.movimiento.findUnique({
    where:   { id: movId },
    include: { proveedor: { select: PROVEEDOR_SELECT }, rubro: { select: RUBRO_SELECT }, responsable: { select: RESPONSABLE_SELECT } },
  });
  res.status(201).json(mapMov(updated));
}

export async function update(req: Request, res: Response) {
  const id     = Number(req.params.id);
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors });
    return;
  }

  const existing = await prisma.movimiento.findFirst({
    where:   { id, deleted_at: null, evento: withTenant(req.empresaId!) },
    include: { rubro: true },
  });
  if (!existing) { res.status(404).json({ error: 'Movimiento no encontrado' }); return; }

  const {
    fecha, concepto, descripcion, debe, haber, moneda, impuesto_subcategoria, proveedor_id,
    estado_movimiento, presupuesto, responsable_id, fecha_pago, avisado_proveedor,
  } = parsed.data;

  if (proveedor_id !== undefined && proveedor_id !== null) {
    const prov = await prisma.proveedor.findFirst({ where: { id: proveedor_id, activo: true, deleted_at: null, ...withTenant(req.empresaId!) } });
    if (!prov) { res.status(400).json({ error: 'Proveedor no encontrado o inactivo' }); return; }
  }

  if (responsable_id !== undefined && responsable_id !== null) {
    const resp = await prisma.usuario.findFirst({ where: { id: responsable_id, deleted_at: null } });
    if (!resp) { res.status(400).json({ error: 'Responsable no encontrado' }); return; }
  }

  if (
    existing.rubro?.codigo === 'EG-IMP' &&
    impuesto_subcategoria !== undefined &&
    impuesto_subcategoria !== null
  ) {
    if (!SUBCATEGORIAS_IMP.includes(impuesto_subcategoria as any)) {
      res.status(400).json({
        error: `Subcategoría inválida. Valores válidos: ${SUBCATEGORIAS_IMP.join(', ')}`,
      });
      return;
    }
  }

  if (estado_movimiento !== undefined) {
    const error = validarTransicionEstado(existing.estado_movimiento, estado_movimiento as EstadoMovimiento);
    if (error) { res.status(400).json({ error }); return; }
  }

  const movId = await prisma.$transaction(async tx => {
    await tx.movimiento.update({
      where: { id },
      data: {
        ...(fecha              !== undefined && { fecha: toDate(fecha) }),
        ...(concepto           !== undefined && { concepto }),
        ...(descripcion        !== undefined && { descripcion }),
        ...(debe               !== undefined && { debe }),
        ...(haber              !== undefined && { haber }),
        ...(moneda             !== undefined && { moneda: moneda as Moneda }),
        ...(impuesto_subcategoria !== undefined && { impuesto_subcategoria }),
        ...(proveedor_id          !== undefined && { proveedor_id }),
        ...(estado_movimiento     !== undefined && { estado_movimiento: estado_movimiento as EstadoMovimiento }),
        ...(presupuesto           !== undefined && { presupuesto }),
        ...(responsable_id        !== undefined && { responsable_id }),
        ...(fecha_pago            !== undefined && { fecha_pago: toDate(fecha_pago) }),
        ...(avisado_proveedor     !== undefined && { avisado_proveedor }),
        updated_by: req.user!.id,
      },
    });

    if (debe !== undefined || haber !== undefined) {
      await recalcularSaldoDeMovimiento(existing, tx);
    }

    await registrarAuditoria({
      usuarioId:    req.user!.id,
      empresaId:    req.empresaId,
      accion:       'UPDATE',
      entidad:      'Movimiento',
      entidadId:    id,
      eventoId:     existing.evento_id,
      descripcion:  `Actualizó movimiento #${id} del evento #${existing.evento_id}`,
      datosAntes:   {
        concepto: existing.concepto, debe: Number(existing.debe),
        haber: Number(existing.haber), moneda: existing.moneda, estado_movimiento: existing.estado_movimiento,
      },
      datosDespues: parsed.data,
      ip:           req.ip,
      tx:           tx as any,
    });

    return id;
  });

  const updated = await prisma.movimiento.findUnique({
    where:   { id: movId },
    include: { proveedor: { select: PROVEEDOR_SELECT }, rubro: { select: RUBRO_SELECT }, responsable: { select: RESPONSABLE_SELECT } },
  });
  res.json(mapMov(updated));
}

export async function remove(req: Request, res: Response) {
  const id       = Number(req.params.id);
  const existing = await prisma.movimiento.findFirst({ where: { id, deleted_at: null, evento: withTenant(req.empresaId!) } });
  if (!existing) { res.status(404).json({ error: 'Movimiento no encontrado' }); return; }

  await prisma.$transaction(async tx => {
    await tx.movimiento.update({
      where: { id },
      data:  { deleted_at: new Date(), updated_by: req.user!.id },
    });
    await recalcularSaldoDeMovimiento(existing, tx);
    await registrarAuditoria({
      usuarioId:  req.user!.id,
      empresaId:  req.empresaId,
      accion:     'DELETE',
      entidad:    'Movimiento',
      entidadId:  id,
      eventoId:   existing.evento_id,
      descripcion: `Eliminó movimiento #${id} del evento #${existing.evento_id}`,
      datosAntes:  {
        concepto: existing.concepto, debe: Number(existing.debe),
        haber: Number(existing.haber), moneda: existing.moneda,
      },
      ip:  req.ip,
      tx:  tx as any,
    });
  });

  res.json({ message: 'Movimiento eliminado correctamente' });
}

// ── movimientosSinProveedor ───────────────────────────────────────────────────

export async function movimientosSinProveedor(req: Request, res: Response) {
  const eventoId = Number(req.params.id);

  const evento = await prisma.evento.findFirst({ where: { id: eventoId, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!evento) { res.status(404).json({ error: 'Evento no encontrado' }); return; }

  const [movs, totalMovimientos] = await Promise.all([
    prisma.movimiento.findMany({
      where:  { evento_id: eventoId, proveedor_id: null, deleted_at: null },
      select: { id: true, concepto: true, tipo: true, debe: true, moneda: true, rubro: { select: { codigo: true } } },
    }),
    prisma.movimiento.count({ where: { evento_id: eventoId, deleted_at: null } }),
  ]);

  const totalSinProveedor = movs.length;

  type GrupoAccum = {
    concepto:        string;
    movimientos_ids: number[];
    tipos:           Set<string>;
    tabs:            Set<string>;
    monto_total:     number;
    moneda:          string;
  };

  const grupos = new Map<string, GrupoAccum>();

  for (const m of movs) {
    const raw = (m.concepto ?? '').trim();
    if (!raw) continue;
    const key = raw.toLowerCase();

    if (!grupos.has(key)) {
      grupos.set(key, {
        concepto:        raw,
        movimientos_ids: [],
        tipos:           new Set(),
        tabs:            new Set(),
        monto_total:     0,
        moneda:          m.moneda,
      });
    }

    const g = grupos.get(key)!;
    g.movimientos_ids.push(m.id);
    g.tipos.add(m.tipo);
    if (m.rubro?.codigo) g.tabs.add(m.rubro.codigo);
    g.monto_total += Number(m.debe);
  }

  const result = Array.from(grupos.values())
    .map(g => ({
      concepto:             g.concepto,
      cantidad_movimientos: g.movimientos_ids.length,
      movimientos_ids:      g.movimientos_ids,
      tipos:                Array.from(g.tipos),
      tabs:                 Array.from(g.tabs),
      monto_total:          g.monto_total,
      moneda:               g.moneda,
    }))
    .sort((a, b) => b.cantidad_movimientos - a.cantidad_movimientos);

  res.json({
    grupos:              result,
    total_sin_proveedor: totalSinProveedor,
    total_movimientos:   totalMovimientos,
  });
}

// ── vincularProveedor ─────────────────────────────────────────────────────────

const vincularSchema = z.object({
  movimientos_ids: z.array(z.number().int().positive()).min(1),
  proveedor_id:    z.number().int().positive().nullable(),
  crear_proveedor: z.object({
    nombre: z.string().min(1),
    alias:  z.string().optional(),
  }).optional(),
}).refine(
  d => d.proveedor_id !== null || !!d.crear_proveedor?.nombre,
  { message: 'Se requiere crear_proveedor cuando proveedor_id es null', path: ['crear_proveedor'] },
);

export async function vincularProveedor(req: Request, res: Response) {
  const parsed = vincularSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten() }); return;
  }

  const { movimientos_ids, proveedor_id, crear_proveedor } = parsed.data;

  const movs = await prisma.movimiento.findMany({
    where:  { id: { in: movimientos_ids }, deleted_at: null, evento: withTenant(req.empresaId!) },
    select: { id: true, evento_id: true },
  });

  if (movs.length !== movimientos_ids.length) {
    res.status(404).json({ error: 'Uno o más movimientos no encontrados' }); return;
  }

  const eventoIds = new Set(movs.map(m => m.evento_id));
  if (eventoIds.size > 1) {
    res.status(400).json({ error: 'Todos los movimientos deben pertenecer al mismo evento' }); return;
  }
  const eventoId = movs[0].evento_id;

  if (proveedor_id !== null) {
    const prov = await prisma.proveedor.findFirst({ where: { id: proveedor_id, deleted_at: null, ...withTenant(req.empresaId!) } });
    if (!prov) { res.status(404).json({ error: 'Proveedor no encontrado' }); return; }
  }

  const result = await prisma.$transaction(async tx => {
    let finalProveedorId: number;
    let esNuevo = false;

    if (proveedor_id !== null) {
      finalProveedorId = proveedor_id;
    } else {
      const nombre    = crear_proveedor!.nombre.trim();
      const existente = await tx.proveedor.findFirst({
        where: { nombre: { equals: nombre, mode: 'insensitive' }, deleted_at: null, ...withTenant(req.empresaId!) },
      });
      if (existente) {
        finalProveedorId = existente.id;
      } else {
        const nuevo = await tx.proveedor.create({
          data: {
            ...withTenant(req.empresaId!),
            nombre,
            alias:      crear_proveedor!.alias?.trim() ?? null,
            created_by: req.user!.id,
            updated_by: req.user!.id,
          },
        });
        finalProveedorId = nuevo.id;
        esNuevo          = true;
      }
    }

    const proveedor = (await tx.proveedor.findUnique({ where: { id: finalProveedorId } }))!;

    await tx.movimiento.updateMany({
      where: { id: { in: movimientos_ids }, deleted_at: null },
      data:  { proveedor_id: finalProveedorId, updated_by: req.user!.id },
    });

    await registrarAuditoria({
      usuarioId:    req.user!.id,
      empresaId:    req.empresaId,
      accion:       'UPDATE',
      entidad:      'Movimiento',
      eventoId,
      descripcion:  `Vinculación masiva de proveedor "${proveedor.nombre}" a ${movimientos_ids.length} movimiento${movimientos_ids.length !== 1 ? 's' : ''}`,
      datosDespues: { proveedor_id: finalProveedorId, movimientos_ids },
      ip:           req.ip,
      tx:           tx as any,
    });

    return {
      proveedor: {
        id:       proveedor.id,
        nombre:   proveedor.nombre,
        alias:    proveedor.alias,
        es_nuevo: esNuevo,
      },
      movimientos_actualizados: movimientos_ids.length,
    };
  });

  res.json(result);
}

// ── reordenar ─────────────────────────────────────────────────────────────────

export async function reordenar(req: Request, res: Response) {
  const id     = Number(req.params.id);
  const parsed = z.object({ orden: z.number().int().min(1) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'orden inválido' });
    return;
  }

  const moving = await prisma.movimiento.findFirst({ where: { id, deleted_at: null, evento: withTenant(req.empresaId!) } });
  if (!moving) { res.status(404).json({ error: 'Movimiento no encontrado' }); return; }

  const { orden: newOrden } = parsed.data;

  await prisma.$transaction(async tx => {
    const others = await tx.movimiento.findMany({
      where:   {
        evento_id:  moving.evento_id,
        tipo:       moving.tipo,
        rubro_id:   moving.rubro_id,
        deleted_at: null,
        id:         { not: id },
      },
      orderBy: { orden: 'asc' },
    });

    const clamped   = Math.min(Math.max(newOrden, 1), others.length + 1);
    const reordered = [...others];
    reordered.splice(clamped - 1, 0, moving as any);

    for (let i = 0; i < reordered.length; i++) {
      await tx.movimiento.update({
        where: { id: reordered[i].id },
        data:  { orden: i + 1 },
      });
    }

    await recalcularSaldoDeMovimiento(moving, tx);

    await registrarAuditoria({
      usuarioId:   req.user!.id,
      empresaId:   req.empresaId,
      accion:      'UPDATE',
      entidad:     'Movimiento',
      entidadId:   id,
      eventoId:    moving.evento_id,
      descripcion: `Reordenó movimiento #${id} a posición ${newOrden}`,
      ip:          req.ip,
      tx:          tx as any,
    });
  });

  const updated = await prisma.movimiento.findUnique({ where: { id } });
  res.json(mapMov(updated));
}

// ── resumen (presupuesto vs real por rubro) ───────────────────────────────────

export async function resumen(req: Request, res: Response) {
  const eventoId = Number(req.params.id);

  const evento = await prisma.evento.findFirst({ where: { id: eventoId, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!evento) { res.status(404).json({ error: 'Evento no encontrado' }); return; }

  const [movs, rubros] = await Promise.all([
    prisma.movimiento.findMany({
      where:  { evento_id: eventoId, deleted_at: null },
      select: { rubro_id: true, tipo: true, debe: true, haber: true, presupuesto: true, estado_movimiento: true },
    }),
    prisma.rubro.findMany({
      where:  { ...withTenant(req.empresaId!), deleted_at: null },
      select: { id: true, nombre: true, tipo: true, orden: true },
    }),
  ]);

  const rubroMap = new Map(rubros.map(r => [r.id, r]));

  type Grupo = {
    rubro_id: number; rubro_nombre: string; tipo: Tipo; orden: number;
    presupuesto_total: number; costo_real_total: number; cantidad_movimientos: number;
    estados: Record<EstadoMovimiento, number>;
  };
  const grupos = new Map<number, Grupo>();

  for (const m of movs) {
    if (m.rubro_id === null) continue;
    const rubro = rubroMap.get(m.rubro_id);
    if (!rubro) continue;

    if (!grupos.has(m.rubro_id)) {
      grupos.set(m.rubro_id, {
        rubro_id: m.rubro_id, rubro_nombre: rubro.nombre, tipo: rubro.tipo as unknown as Tipo, orden: rubro.orden,
        presupuesto_total: 0, costo_real_total: 0, cantidad_movimientos: 0,
        estados: { PENDIENTE: 0, COTIZANDO: 0, CONFIRMADO: 0, PAGADO: 0, CANCELADO: 0 },
      });
    }
    const g = grupos.get(m.rubro_id)!;
    g.presupuesto_total += Number(m.presupuesto ?? 0);
    // debe/haber: qué campo lleva el monto real depende de cómo se creó la fila
    // (el importer/seed históricos y el alta manual usan convenciones opuestas
    // por tipo) — sumar ambos es robusto porque en la práctica solo uno de los
    // dos es distinto de cero por movimiento.
    g.costo_real_total  += Number(m.debe) + Number(m.haber);
    g.cantidad_movimientos++;
    g.estados[m.estado_movimiento]++;
  }

  const por_rubro = Array.from(grupos.values())
    .sort((a, b) => a.tipo.localeCompare(b.tipo) || a.orden - b.orden)
    .map(({ orden, ...g }) => {
      const presupuesto_total = parseFloat(g.presupuesto_total.toFixed(2));
      const costo_real_total  = parseFloat(g.costo_real_total.toFixed(2));
      const diferencia        = parseFloat((presupuesto_total - costo_real_total).toFixed(2));
      const diferencia_pct    = presupuesto_total !== 0 ? parseFloat((diferencia / presupuesto_total * 100).toFixed(2)) : 0;
      return { ...g, presupuesto_total, costo_real_total, diferencia, diferencia_pct };
    });

  const total_ingresos = movs.filter(m => m.tipo === 'INGRESO').reduce((a, m) => a + Number(m.debe) + Number(m.haber), 0);
  const total_egresos  = movs.filter(m => m.tipo === 'EGRESO').reduce((a, m) => a + Number(m.debe)  + Number(m.haber), 0);

  res.json({
    por_rubro,
    total_ingresos: parseFloat(total_ingresos.toFixed(2)),
    total_egresos:  parseFloat(total_egresos.toFixed(2)),
    saldo:          parseFloat((total_ingresos - total_egresos).toFixed(2)),
  });
}
