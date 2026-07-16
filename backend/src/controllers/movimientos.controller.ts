import type { Request, Response } from 'express';
import { z } from 'zod';
import { Tipo, Moneda } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { recalcularSaldos, recalcularSaldosCaja } from '../lib/recalcularSaldos';
import { registrarAuditoria } from '../lib/auditoria';
import { withTenant } from '../lib/tenant';

const SUBCATEGORIAS_IMP = [
  'PAYWAY', 'REBA', 'AUTOENTRADA', 'IVA', 'IIBB', 'MUNICIPALIDAD', 'GANANCIAS',
] as const;

function toDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  return new Date(s);
}

function mapMov(m: any) {
  return {
    ...m,
    debe:  Number(m.debe),
    haber: Number(m.haber),
    saldo: Number(m.saldo),
  };
}

const createSchema = z.object({
  tipo:                  z.enum(['EGRESO', 'INGRESO']),
  tab_numero:            z.number().int().min(1),
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
});

export async function listSinConciliar(req: Request, res: Response) {
  const eventoId = Number(req.params.id);
  const evento = await prisma.evento.findFirst({ where: { id: eventoId, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!evento) { res.status(404).json({ error: 'Evento no encontrado' }); return; }

  const [movs, tabs] = await Promise.all([
    prisma.movimiento.findMany({
      where:   { evento_id: eventoId, movimiento_caja_id: null, deleted_at: null },
      orderBy: [{ tipo: 'asc' }, { tab_numero: 'asc' }, { orden: 'asc' }],
    }),
    prisma.tabConfig.findMany({ where: withTenant(req.empresaId!) }),
  ]);
  const tabMap = new Map(tabs.map(t => [`${t.tipo}-${t.numero}`, t.codigo]));
  res.json(movs.map(m => ({
    ...mapMov(m),
    tab_codigo: tabMap.get(`${m.tipo}-${m.tab_numero}`) ?? null,
  })));
}

export async function list(req: Request, res: Response) {
  const eventoId = Number(req.params.id);
  const tipo     = req.query.tipo as string | undefined;
  const tab      = req.query.tab  ? Number(req.query.tab) : undefined;

  if (!tipo || !tab || !['EGRESO', 'INGRESO'].includes(tipo)) {
    res.status(400).json({ error: 'Se requieren tipo (EGRESO|INGRESO) y tab (1-5)' });
    return;
  }

  const evento = await prisma.evento.findFirst({ where: { id: eventoId, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!evento) { res.status(404).json({ error: 'Evento no encontrado' }); return; }

  const movs = await prisma.movimiento.findMany({
    where:   { evento_id: eventoId, tipo: tipo as Tipo, tab_numero: tab, deleted_at: null },
    orderBy: { orden: 'asc' },
    include: { proveedor: { select: { id: true, nombre: true, alias: true } } },
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
    tipo, tab_numero, fecha, concepto, descripcion,
    debe, haber, moneda, impuesto_subcategoria,
    impacta_caja, cuenta_id, proveedor_id,
  } = parsed.data;

  const tabCfg = await prisma.tabConfig.findFirst({
    where: { tipo: tipo as Tipo, numero: tab_numero, activo: true, ...withTenant(req.empresaId!) },
  });
  if (!tabCfg) {
    res.status(400).json({ error: `La pestaña ${tipo} nº${tab_numero} no existe o está inactiva` });
    return;
  }

  const isEgImp = tabCfg.codigo === 'EG-IMP';
  if (isEgImp) {
    if (!impuesto_subcategoria) {
      res.status(400).json({ error: 'impuesto_subcategoria es requerido para EG-IMP' });
      return;
    }
    if (!SUBCATEGORIAS_IMP.includes(impuesto_subcategoria as any)) {
      res.status(400).json({
        error: `Subcategoría inválida. Valores válidos: ${SUBCATEGORIAS_IMP.join(', ')}`,
      });
      return;
    }
  }

  const evento = await prisma.evento.findFirst({ where: { id: eventoId, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!evento) { res.status(404).json({ error: 'Evento no encontrado' }); return; }

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

  const movId = await prisma.$transaction(async tx => {
    let orden = parsed.data.orden;
    if (orden === undefined) {
      const last = await tx.movimiento.findFirst({
        where:   { evento_id: eventoId, tipo: tipo as Tipo, tab_numero, deleted_at: null },
        orderBy: { orden: 'desc' },
        select:  { orden: true },
      });
      orden = (last?.orden ?? 0) + 1;
    }

    const mov = await tx.movimiento.create({
      data: {
        evento_id:             eventoId,
        tipo:                  tipo as Tipo,
        tab_numero,
        fecha:                 toDate(fecha),
        concepto:              concepto ?? null,
        descripcion:           descripcion ?? null,
        debe:                  debe ?? 0,
        haber:                 haber ?? 0,
        moneda:                (moneda ?? 'ARS') as Moneda,
        orden,
        impuesto_subcategoria: impuesto_subcategoria ?? null,
        proveedor_id:          proveedor_id          ?? null,
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

    await recalcularSaldos(eventoId, tipo as Tipo, tab_numero, tx);

    await registrarAuditoria({
      usuarioId:    req.user!.id,
      empresaId:    req.empresaId,
      accion:       'CREATE',
      entidad:      'Movimiento',
      entidadId:    mov.id,
      eventoId,
      descripcion:  `Creó movimiento en ${tabCfg.codigo} del evento #${eventoId}`,
      datosDespues: { tipo, tab_numero, concepto, debe, haber, moneda },
      ip:           req.ip,
      tx:           tx as any,
    });

    return mov.id;
  });

  const updated = await prisma.movimiento.findUnique({
    where:   { id: movId },
    include: { proveedor: { select: { id: true, nombre: true, alias: true } } },
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

  const existing = await prisma.movimiento.findFirst({ where: { id, deleted_at: null, evento: withTenant(req.empresaId!) } });
  if (!existing) { res.status(404).json({ error: 'Movimiento no encontrado' }); return; }

  const { fecha, concepto, descripcion, debe, haber, moneda, impuesto_subcategoria, proveedor_id } = parsed.data;

  if (proveedor_id !== undefined && proveedor_id !== null) {
    const prov = await prisma.proveedor.findFirst({ where: { id: proveedor_id, activo: true, deleted_at: null, ...withTenant(req.empresaId!) } });
    if (!prov) { res.status(400).json({ error: 'Proveedor no encontrado o inactivo' }); return; }
  }

  if (
    existing.tipo === Tipo.EGRESO &&
    existing.tab_numero === 4 &&
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
        updated_by: req.user!.id,
      },
    });

    await recalcularSaldos(existing.evento_id, existing.tipo, existing.tab_numero, tx);

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
        haber: Number(existing.haber), moneda: existing.moneda,
      },
      datosDespues: parsed.data,
      ip:           req.ip,
      tx:           tx as any,
    });

    return id;
  });

  const updated = await prisma.movimiento.findUnique({
    where:   { id: movId },
    include: { proveedor: { select: { id: true, nombre: true, alias: true } } },
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
    await recalcularSaldos(existing.evento_id, existing.tipo, existing.tab_numero, tx);
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

  const [movs, tabs, totalMovimientos] = await Promise.all([
    prisma.movimiento.findMany({
      where:  { evento_id: eventoId, proveedor_id: null, deleted_at: null },
      select: { id: true, concepto: true, tipo: true, tab_numero: true, debe: true, moneda: true },
    }),
    prisma.tabConfig.findMany({ where: withTenant(req.empresaId!), select: { tipo: true, numero: true, codigo: true } }),
    prisma.movimiento.count({ where: { evento_id: eventoId, deleted_at: null } }),
  ]);

  const totalSinProveedor = movs.length;
  const tabMap = new Map(tabs.map(t => [`${t.tipo}-${t.numero}`, t.codigo]));

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
    const cod = tabMap.get(`${m.tipo}-${m.tab_numero}`);
    if (cod) g.tabs.add(cod);
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
        tab_numero: moving.tab_numero,
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

    await recalcularSaldos(moving.evento_id, moving.tipo, moving.tab_numero, tx);

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
