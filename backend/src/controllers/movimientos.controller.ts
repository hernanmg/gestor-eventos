import type { Request, Response } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { Tipo, Moneda, EstadoMovimiento } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { recalcularSaldos, recalcularSaldosRubro, recalcularSaldosCaja } from '../lib/recalcularSaldos';
import { registrarAuditoria } from '../lib/auditoria';
import { withTenant } from '../lib/tenant';
import { generateMacroExcel } from '../lib/excelExporter';
import { RUBROS_SISTEMA } from '../lib/rubrosConstants';
import { convertirARS } from '../lib/convertirARS';

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
  moneda:                z.enum(['ARS', 'USD', 'EUR']).default('ARS'),
  tasa_cambio:           z.number().positive().nullable().optional(),
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
  moneda:                z.enum(['ARS', 'USD', 'EUR']).optional(),
  tasa_cambio:           z.number().positive().nullable().optional(),
  impuesto_subcategoria: z.string().nullable().optional(),
  proveedor_id:          z.number().int().positive().nullable().optional(),
  estado_movimiento:     z.enum(['PENDIENTE', 'COTIZANDO', 'CONFIRMADO', 'PAGADO', 'CANCELADO']).optional(),
  presupuesto:           z.number().min(0).nullable().optional(),
  responsable_id:        z.number().int().positive().nullable().optional(),
  fecha_pago:            z.string().nullable().optional(),
  avisado_proveedor:     z.boolean().optional(),
});

// ── Vista Macro (cross-evento, cross-empresa para admin global) ───────────────
// GET /api/movimientos — a diferencia del resto del archivo (scoped a un
// evento vía :id), esta vista lista movimientos de todos los eventos. Un
// admin global (Usuario.empresa_id === null) puede ver todas las empresas o
// filtrar por una puntual; el resto de los usuarios queda fijo a su empresa
// activa de sesión (req.user.empresaId) sin importar qué manden en el query.

const ESTADOS_MOVIMIENTO = ['PENDIENTE', 'COTIZANDO', 'CONFIRMADO', 'PAGADO', 'CANCELADO'] as const;

const macroQuerySchema = z.object({
  empresa_id:        z.coerce.number().int().positive().optional(),
  evento_id:         z.coerce.number().int().positive().optional(),
  rubro_id:          z.coerce.number().int().positive().optional(),
  tipo:              z.enum(['EGRESO', 'INGRESO']).optional(),
  estado:            z.enum(ESTADOS_MOVIMIENTO).optional(),
  responsable_id:    z.coerce.number().int().positive().optional(),
  proveedor_id:      z.coerce.number().int().positive().optional(),
  desde:             z.string().optional(),
  hasta:             z.string().optional(),
  con_presupuesto:   z.enum(['true', 'false']).optional(),
  avisado_proveedor: z.enum(['true', 'false']).optional(),
  page:              z.coerce.number().int().positive().default(1),
  limit:             z.coerce.number().int().positive().max(200).default(50),
  sort:              z.enum(['fecha', 'monto', 'rubro']).default('fecha'),
  order:             z.enum(['asc', 'desc']).default('desc'),
});

type MacroQuery = z.infer<typeof macroQuerySchema>;

const EVENTO_SELECT_MACRO = {
  select: {
    id: true, nombre: true, estado: true, empresa_id: true,
    empresa: { select: { id: true, nombre: true } },
  },
} as const;

type MacroWhereResult =
  | { ok: true; where: Prisma.MovimientoWhereInput; q: MacroQuery }
  | { ok: false };

// Resuelve el where compartido por listMacro y exportarMacro: valida el
// query, decide el alcance de empresa según el usuario, y — para roles no
// ADMIN — restringe a los eventos con EventoAcceso (mismo criterio que
// eventos.controller.list).
async function resolveMacroWhere(req: Request, res: Response): Promise<MacroWhereResult> {
  const parsed = macroQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'Filtros inválidos', detail: parsed.error.flatten().fieldErrors });
    return { ok: false };
  }
  const q = parsed.data;

  const usuario = await prisma.usuario.findFirst({
    where:  { id: req.user!.id, deleted_at: null },
    select: { empresa_id: true, puede_ver_macro: true, areas_macro: true },
  });
  if (!usuario) { res.status(401).json({ error: 'Sesión inválida' }); return { ok: false }; }

  const esAdminGlobal = req.user!.rol === 'ADMIN' && usuario.empresa_id === null;
  // Usuario ADMIN multi-empresa con Macro restringida (ej. Mayra) — no es
  // admin global, pero puede ver movimientos de todas sus empresas
  // (UsuarioEmpresaAcceso), acotado a que "FINANZAS" esté en sus áreas.
  const esMacroRestringida = !esAdminGlobal && usuario.puede_ver_macro === true;

  // undefined ⇒ sin restricción de empresa (solo admin global sin filtro).
  let empresaIds: number[] | undefined;

  if (esAdminGlobal) {
    empresaIds = q.empresa_id !== undefined ? [q.empresa_id] : undefined;
  } else if (esMacroRestringida) {
    if (!usuario.areas_macro.includes('FINANZAS')) {
      // Sin el área Finanzas, esta vista (inherentemente financiera) queda
      // vacía en vez de 403 — evita que la UI rompa si le sacan el área.
      return { ok: true, where: { id: -1 }, q };
    }
    const accesos = await prisma.usuarioEmpresaAcceso.findMany({
      where:  { usuario_id: req.user!.id },
      select: { empresa_id: true },
    });
    const permitidas = accesos.map(a => a.empresa_id);
    empresaIds = q.empresa_id !== undefined
      ? (permitidas.includes(q.empresa_id) ? [q.empresa_id] : [-1])
      : permitidas;
  } else {
    if (req.user!.empresaId == null) {
      res.status(401).json({ error: 'Sin empresa activa. Seleccioná una empresa.' });
      return { ok: false };
    }
    empresaIds = [req.user!.empresaId]; // empresa_id del query se ignora
  }

  const where: Prisma.MovimientoWhereInput = {
    deleted_at: null,
    evento:     { deleted_at: null, ...(empresaIds !== undefined ? { empresa_id: { in: empresaIds } } : {}) },
  };
  if (q.evento_id       !== undefined) where.evento_id      = q.evento_id;
  if (q.rubro_id         !== undefined) where.rubro_id       = q.rubro_id;
  if (q.tipo)                           where.tipo           = q.tipo;
  if (q.estado)                         where.estado_movimiento = q.estado;
  if (q.responsable_id  !== undefined) where.responsable_id = q.responsable_id;
  if (q.proveedor_id     !== undefined) where.proveedor_id   = q.proveedor_id;
  if (q.avisado_proveedor !== undefined) where.avisado_proveedor = q.avisado_proveedor === 'true';
  if (q.con_presupuesto === 'true')     where.presupuesto    = { not: null };
  if (q.desde || q.hasta) {
    where.fecha = {
      ...(q.desde ? { gte: new Date(q.desde) } : {}),
      ...(q.hasta ? { lte: new Date(q.hasta) } : {}),
    };
  }

  if (req.user!.rol !== 'ADMIN') {
    const accesos = await (prisma as any).eventoAcceso.findMany({
      where:  { usuario_id: req.user!.id },
      select: { evento_id: true },
    });
    const idsAccesibles: number[] = accesos.map((a: any) => a.evento_id);
    if (q.evento_id !== undefined) {
      if (!idsAccesibles.includes(q.evento_id)) where.evento_id = -1; // sin acceso ⇒ vacío
    } else {
      where.evento_id = { in: idsAccesibles };
    }
  }

  return { ok: true, where, q };
}

function mapMacroRow(m: any) {
  return {
    id:                 m.id,
    evento_id:          m.evento_id,
    evento_nombre:      m.evento?.nombre ?? null,
    evento_estado:      m.evento?.estado ?? null,
    empresa_id:         m.evento?.empresa_id ?? null,
    empresa_nombre:     m.evento?.empresa?.nombre ?? null,
    tipo:               m.tipo,
    rubro_id:           m.rubro_id,
    rubro_nombre:       m.rubro?.nombre ?? null,
    fecha:              m.fecha,
    concepto:           m.concepto,
    descripcion:        m.descripcion,
    debe:               Number(m.debe),
    haber:              Number(m.haber),
    saldo:              Number(m.saldo),
    presupuesto:        m.presupuesto !== null && m.presupuesto !== undefined ? Number(m.presupuesto) : null,
    costo_real:         m.costo_real  !== null && m.costo_real  !== undefined ? Number(m.costo_real)  : null,
    estado_movimiento:  m.estado_movimiento,
    responsable_id:     m.responsable_id,
    responsable_nombre: m.responsable?.nombre ?? null,
    proveedor_id:       m.proveedor_id,
    proveedor_nombre:   m.proveedor?.nombre ?? null,
    avisado_proveedor:  m.avisado_proveedor,
    fecha_pago:         m.fecha_pago,
    moneda:             m.moneda,
    created_at:         m.created_at,
  };
}

function macroOrderBy(sort: MacroQuery['sort'], order: MacroQuery['order']): Prisma.MovimientoOrderByWithRelationInput[] {
  if (sort === 'monto') return [{ debe: order }, { haber: order }];
  if (sort === 'rubro') return [{ rubro: { nombre: order } }];
  return [{ fecha: order }];
}

export async function listMacro(req: Request, res: Response) {
  const resolved = await resolveMacroWhere(req, res);
  if (!resolved.ok) return;
  const { where, q } = resolved;
  const skip = (q.page - 1) * q.limit;

  const [total, movs, agg] = await Promise.all([
    prisma.movimiento.count({ where }),
    prisma.movimiento.findMany({
      where,
      orderBy: macroOrderBy(q.sort, q.order),
      skip, take: q.limit,
      include: {
        evento:      EVENTO_SELECT_MACRO,
        rubro:       { select: RUBRO_SELECT },
        responsable: { select: RESPONSABLE_SELECT },
        proveedor:   { select: PROVEEDOR_SELECT },
      },
    }),
    // Set completo (sin paginar) sólo con los campos necesarios para agregar
    // los totales — misma estrategia que resumen()/conciliatoria() para un
    // evento, aplicada acá al alcance cross-evento del filtro activo.
    prisma.movimiento.findMany({
      where,
      select: {
        tipo: true, debe: true, haber: true, presupuesto: true, costo_real: true, estado_movimiento: true,
        rubro_id: true, rubro: { select: { nombre: true } },
        evento: { select: { empresa_id: true, empresa: { select: { nombre: true } } } },
      },
    }),
  ]);

  let totalDebe = 0, totalHaber = 0, totalEgresos = 0, totalIngresos = 0, totalPresupuesto = 0, totalCostoReal = 0;
  const porEmpresaMap = new Map<number, {
    empresa_id: number; empresa_nombre: string;
    total_debe: number; total_haber: number; total_egresos: number; total_ingresos: number; total_presupuesto: number;
  }>();
  const porRubroMap = new Map<number, { rubro_id: number; rubro_nombre: string; total_debe: number; total_haber: number }>();
  const porEstado: Record<string, number> = Object.fromEntries(ESTADOS_MOVIMIENTO.map(e => [e, 0]));

  for (const m of agg) {
    const debe        = Number(m.debe);
    const haber       = Number(m.haber);
    const presupuesto = Number(m.presupuesto ?? 0);
    // El monto real de un movimiento depende de cómo se cargó la fila (ver
    // comentario en resumen()) — sumar debe+haber es lo robusto acá también.
    const monto = debe + haber;

    totalDebe        += debe;
    totalHaber       += haber;
    totalPresupuesto += presupuesto;
    totalCostoReal   += m.costo_real !== null ? Number(m.costo_real) : monto;
    if (m.tipo === 'EGRESO')  totalEgresos  += monto;
    if (m.tipo === 'INGRESO') totalIngresos += monto;
    porEstado[m.estado_movimiento] = (porEstado[m.estado_movimiento] ?? 0) + 1;

    const empId = m.evento?.empresa_id;
    if (empId != null) {
      const cur = porEmpresaMap.get(empId) ?? {
        empresa_id: empId, empresa_nombre: m.evento?.empresa?.nombre ?? '',
        total_debe: 0, total_haber: 0, total_egresos: 0, total_ingresos: 0, total_presupuesto: 0,
      };
      cur.total_debe  += debe;
      cur.total_haber += haber;
      cur.total_presupuesto += presupuesto;
      if (m.tipo === 'EGRESO')  cur.total_egresos  += monto;
      if (m.tipo === 'INGRESO') cur.total_ingresos += monto;
      porEmpresaMap.set(empId, cur);
    }

    if (m.rubro_id !== null) {
      const cur = porRubroMap.get(m.rubro_id) ?? { rubro_id: m.rubro_id, rubro_nombre: m.rubro?.nombre ?? '', total_debe: 0, total_haber: 0 };
      cur.total_debe  += debe;
      cur.total_haber += haber;
      porRubroMap.set(m.rubro_id, cur);
    }
  }

  res.json({
    data: movs.map(mapMacroRow),
    pagination: {
      total, page: q.page, limit: q.limit,
      totalPages: Math.max(1, Math.ceil(total / q.limit)),
    },
    totales: {
      total_debe:        parseFloat(totalDebe.toFixed(2)),
      total_haber:       parseFloat(totalHaber.toFixed(2)),
      total_egresos:     parseFloat(totalEgresos.toFixed(2)),
      total_ingresos:    parseFloat(totalIngresos.toFixed(2)),
      saldo:             parseFloat((totalIngresos - totalEgresos).toFixed(2)),
      total_presupuesto: parseFloat(totalPresupuesto.toFixed(2)),
      total_costo_real:  parseFloat(totalCostoReal.toFixed(2)),
      por_empresa: [...porEmpresaMap.values()].map(e => ({
        ...e,
        total_debe:        parseFloat(e.total_debe.toFixed(2)),
        total_haber:       parseFloat(e.total_haber.toFixed(2)),
        total_egresos:     parseFloat(e.total_egresos.toFixed(2)),
        total_ingresos:    parseFloat(e.total_ingresos.toFixed(2)),
        total_presupuesto: parseFloat(e.total_presupuesto.toFixed(2)),
        saldo:             parseFloat((e.total_ingresos - e.total_egresos).toFixed(2)),
      })),
      por_rubro:  [...porRubroMap.values()],
      por_estado: porEstado,
    },
  });
}

const MACRO_EXPORT_MAX_ROWS = 20000;

export async function exportarMacro(req: Request, res: Response) {
  const resolved = await resolveMacroWhere(req, res);
  if (!resolved.ok) return;
  const { where, q } = resolved;

  const total = await prisma.movimiento.count({ where });
  if (total > MACRO_EXPORT_MAX_ROWS) {
    res.status(400).json({ error: `Demasiados movimientos (${total}) para exportar. Acotá los filtros (máximo ${MACRO_EXPORT_MAX_ROWS}).` });
    return;
  }

  const movs = await prisma.movimiento.findMany({
    where,
    orderBy: macroOrderBy(q.sort, q.order),
    include: {
      evento:      EVENTO_SELECT_MACRO,
      rubro:       { select: RUBRO_SELECT },
      responsable: { select: RESPONSABLE_SELECT },
      proveedor:   { select: PROVEEDOR_SELECT },
    },
  });

  const { buffer, filename } = await generateMacroExcel(movs.map(mapMacroRow));

  await registrarAuditoria({
    usuarioId:    req.user!.id,
    empresaId:    req.empresaId ?? null,
    accion:       'EXPORT',
    entidad:      'Movimiento',
    descripcion:  `Exportó Excel de la vista macro (${movs.length} movimientos)`,
    datosDespues: { formato: 'excel', filtros: req.query },
    ip:           req.ip,
    tx:           prisma as any,
  });

  res.set({
    'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Content-Length':      String(buffer.length),
  });
  res.end(buffer);
}

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
    debe, haber, moneda, tasa_cambio, impuesto_subcategoria,
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

  const isEgImp = rubro.codigo === RUBROS_SISTEMA.IMPUESTOS;
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

    const montoBase = (debe ?? 0) > 0 ? (debe ?? 0) : (haber ?? 0);
    const montoArs  = convertirARS(montoBase, (moneda ?? 'ARS') as Moneda, tasa_cambio ?? null);

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
        tasa_cambio:           tasa_cambio ?? null,
        monto_ars:             montoArs,
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
    fecha, concepto, descripcion, debe, haber, moneda, tasa_cambio, impuesto_subcategoria, proveedor_id,
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
    existing.rubro?.codigo === RUBROS_SISTEMA.IMPUESTOS &&
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

  // Recalcular monto_ars si cambió cualquier dato que lo afecta — usa los
  // valores nuevos cuando vienen en el payload, si no los existentes.
  const debeFinal      = debe  !== undefined ? debe  : Number(existing.debe);
  const haberFinal     = haber !== undefined ? haber : Number(existing.haber);
  const monedaFinal    = (moneda ?? existing.moneda) as Moneda;
  const tasaFinal       = tasa_cambio !== undefined ? tasa_cambio : (existing.tasa_cambio !== null ? Number(existing.tasa_cambio) : null);
  const recomputarArs   = debe !== undefined || haber !== undefined || moneda !== undefined || tasa_cambio !== undefined;
  const montoArsFinal   = recomputarArs
    ? convertirARS(debeFinal > 0 ? debeFinal : haberFinal, monedaFinal, tasaFinal)
    : undefined;

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
        ...(tasa_cambio        !== undefined && { tasa_cambio }),
        ...(montoArsFinal      !== undefined && { monto_ars: montoArsFinal }),
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

    if (debe !== undefined || haber !== undefined || montoArsFinal !== undefined) {
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
