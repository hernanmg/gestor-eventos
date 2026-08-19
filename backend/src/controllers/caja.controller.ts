import type { Request, Response } from 'express';
import { z } from 'zod';
import { TipoCuenta, Moneda, EstadoCuenta, type Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { recalcularSaldosCaja } from '../lib/recalcularSaldos';
import { registrarAuditoria } from '../lib/auditoria';
import { withTenant } from '../lib/tenant';

// Cache por empresa — TabConfig ahora es per-tenant, así que una única Map
// global mezclaría tabs de distintas empresas entre requests.
const _tabCacheByEmpresa = new Map<number, Map<string, string>>();
async function getTabMap(empresaId: number): Promise<Map<string, string>> {
  if (!_tabCacheByEmpresa.has(empresaId)) {
    const tabs = await prisma.tabConfig.findMany({ where: withTenant(empresaId) });
    _tabCacheByEmpresa.set(empresaId, new Map(tabs.map(t => [`${t.tipo}-${t.numero}`, t.codigo])));
  }
  return _tabCacheByEmpresa.get(empresaId)!;
}

function mapCuenta(c: any) {
  return {
    ...c,
    saldo_inicial: Number(c.saldo_inicial),
    saldo_minimo:  c.saldo_minimo != null ? Number(c.saldo_minimo) : null,
  };
}

// Cuentas "del evento" = propias (CuentaBancaria.evento_id) + vinculadas
// (EventoCuenta) — una cuenta de empresa (ej. "Caja Pollo") puede operarse
// desde varios eventos sin dejar de ser una cuenta global de Caja General.
export async function resolveCuentaIdsEvento(eventoId: number): Promise<{ propiasIds: number[]; vinculadaIds: number[] }> {
  const [propias, vinculos] = await Promise.all([
    prisma.cuentaBancaria.findMany({ where: { evento_id: eventoId, deleted_at: null }, select: { id: true } }),
    prisma.eventoCuenta.findMany({ where: { evento_id: eventoId }, select: { cuenta_id: true } }),
  ]);
  return { propiasIds: propias.map(c => c.id), vinculadaIds: vinculos.map(v => v.cuenta_id) };
}

function mapMovCaja(m: any, tabMap?: Map<string, string>) {
  const raw = m.movimientos_origen?.[0] ?? null;
  const movOrigen = raw ? {
    id:                raw.id,
    tipo:              raw.tipo,
    tab_numero:        raw.tab_numero,
    tab_codigo:        tabMap ? (tabMap.get(`${raw.tipo}-${raw.tab_numero}`) ?? null) : null,
    concepto:          raw.concepto,
    rubro_id:          raw.rubro_id  ?? null,
    rubro_nombre:      raw.rubro?.nombre ?? null,
    estado_movimiento: raw.estado_movimiento ?? null,
  } : null;

  return {
    ...m,
    debe:              Number(m.debe),
    haber:             Number(m.haber),
    saldo_corriente:   Number(m.saldo_corriente),
    movimiento_origen: movOrigen,
    movimientos_origen: undefined,
  };
}

const createCuentaSchema = z.object({
  nombre:        z.string().min(1),
  tipo:          z.enum(['EFECTIVO', 'BANCO']),
  moneda:        z.enum(['ARS', 'USD']).default('ARS'),
  saldo_inicial: z.number().default(0),
  saldo_minimo:  z.number().min(0).nullable().optional(),
});

const updateCuentaSchema = z.object({
  nombre:        z.string().min(1).optional(),
  tipo:          z.enum(['EFECTIVO', 'BANCO']).optional(),
  moneda:        z.enum(['ARS', 'USD']).optional(),
  saldo_inicial: z.number().optional(),
  saldo_minimo:  z.number().min(0).nullable().optional(),
});

const estadoCuentaSchema = z.object({
  estado:          z.enum(['ABIERTA', 'PENDIENTE_RENDICION', 'CERRADA']),
  notas_rendicion: z.string().nullable().optional(),
});

const createMovCajaSchema = z.object({
  fecha:       z.string().nullable().optional(),
  descripcion: z.string().nullable().optional(),
  debe:        z.number().min(0).default(0),
  haber:       z.number().min(0).default(0),
});

const updateMovCajaSchema = z.object({
  fecha:       z.string().nullable().optional(),
  descripcion: z.string().nullable().optional(),
  debe:        z.number().min(0).optional(),
  haber:       z.number().min(0).optional(),
});

// ── Cuentas ───────────────────────────────────────────────────────────────────

// GET /api/cuentas — todas las cuentas de la empresa, con o sin evento.
// ?evento_id filtra a un evento puntual; sin filtro devuelve todo (incluye
// las cajas de empresa sin evento_id: caja chica por persona, reserva, etc.)
export async function listCuentasEmpresa(req: Request, res: Response) {
  const eventoIdRaw   = req.query.evento_id;
  const tipoRaw       = req.query.tipo;
  const monedaRaw     = req.query.moneda;
  const paraEventoRaw = req.query.para_evento;
  const estadoRaw     = req.query.estado;

  const where: Prisma.CuentaBancariaWhereInput = { deleted_at: null, ...withTenant(req.empresaId!) };

  if (typeof eventoIdRaw === 'string' && eventoIdRaw !== '') {
    const eventoId = Number(eventoIdRaw);
    if (isNaN(eventoId)) { res.status(400).json({ error: 'evento_id inválido' }); return; }
    where.evento_id = eventoId;
  }
  // ?para_evento=:eventoId — candidatas para vincular a ESE evento (ver
  // vincularCuenta()): CUALQUIER cuenta de la empresa, tenga o no evento_id
  // propio (con EventoCuenta una cuenta puede estar en varios eventos a la
  // vez), excepto las que ya están vinculadas a este evento puntual. Las que
  // ya son propias de este evento las filtra el frontend (ya vienen en su
  // lista de cuentas del evento).
  if (typeof paraEventoRaw === 'string' && paraEventoRaw !== '') {
    const eventoId = Number(paraEventoRaw);
    if (isNaN(eventoId)) { res.status(400).json({ error: 'para_evento inválido' }); return; }
    const vinculadas = await prisma.eventoCuenta.findMany({ where: { evento_id: eventoId }, select: { cuenta_id: true } });
    where.id = { notIn: vinculadas.map(v => v.cuenta_id) };
  }
  if (typeof tipoRaw === 'string' && (tipoRaw === 'EFECTIVO' || tipoRaw === 'BANCO')) {
    where.tipo = tipoRaw;
  }
  if (typeof monedaRaw === 'string' && (monedaRaw === 'ARS' || monedaRaw === 'USD')) {
    where.moneda = monedaRaw;
  }
  if (typeof estadoRaw === 'string' && ['ABIERTA', 'PENDIENTE_RENDICION', 'CERRADA'].includes(estadoRaw)) {
    where.estado = estadoRaw as EstadoCuenta;
  }

  const cuentas = await prisma.cuentaBancaria.findMany({
    where,
    orderBy: { id: 'asc' },
    include: {
      evento:      { select: { id: true, nombre: true } },
      responsable: { select: { id: true, nombre: true } },
      movimientos: {
        where:   { deleted_at: null },
        orderBy: { orden: 'asc' },
        select:  { saldo_corriente: true },
      },
    },
  });

  res.json(cuentas.map(c => {
    const movs        = c.movimientos;
    const last        = movs[movs.length - 1];
    const saldo_actual = last ? Number(last.saldo_corriente) : Number(c.saldo_inicial);
    const alerta_saldo_minimo = c.saldo_minimo != null && saldo_actual < Number(c.saldo_minimo);
    return { ...mapCuenta(c), saldo_actual, alerta_saldo_minimo, movimientos: undefined };
  }));
}

// GET /api/cuentas/:id — detalle de una cuenta puntual con su saldo actual.
// Usado por la pantalla de detalle de cuenta en Caja Global.
export async function getCuenta(req: Request, res: Response) {
  const id = Number(req.params.id);
  const cuenta = await prisma.cuentaBancaria.findFirst({
    where:   { id, deleted_at: null, ...withTenant(req.empresaId!) },
    include: {
      evento:      { select: { id: true, nombre: true } },
      responsable: { select: { id: true, nombre: true } },
      movimientos: {
        where:   { deleted_at: null },
        orderBy: { orden: 'asc' },
        select:  { saldo_corriente: true },
      },
    },
  });
  if (!cuenta) { res.status(404).json({ error: 'Cuenta no encontrada' }); return; }

  const movs        = cuenta.movimientos;
  const last         = movs[movs.length - 1];
  const saldo_actual = last ? Number(last.saldo_corriente) : Number(cuenta.saldo_inicial);
  const alerta_saldo_minimo = cuenta.saldo_minimo != null && saldo_actual < Number(cuenta.saldo_minimo);
  res.json({ ...mapCuenta(cuenta), saldo_actual, alerta_saldo_minimo, movimientos: undefined });
}

// POST /api/cuentas — crea una cuenta de empresa, sin evento asociado.
export async function createCuentaEmpresa(req: Request, res: Response) {
  const parsed = createCuentaSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors });
    return;
  }

  const cuenta = await prisma.$transaction(async tx => {
    const c = await tx.cuentaBancaria.create({
      data: {
        ...withTenant(req.empresaId!),
        evento_id:     null,
        nombre:        parsed.data.nombre,
        tipo:          parsed.data.tipo as TipoCuenta,
        moneda:        parsed.data.moneda as Moneda,
        saldo_inicial: parsed.data.saldo_inicial,
        saldo_minimo:  parsed.data.saldo_minimo ?? null,
        fecha_apertura: new Date(),
      },
    });
    await registrarAuditoria({
      usuarioId:    req.user!.id,
      empresaId:    req.empresaId,
      accion:       'CREATE',
      entidad:      'CuentaBancaria',
      entidadId:    c.id,
      descripcion:  `Creó cuenta de empresa "${parsed.data.nombre}"`,
      datosDespues: parsed.data,
      ip:           req.ip,
      tx:           tx as any,
    });
    return c;
  });

  res.status(201).json(mapCuenta(cuenta));
}

export async function listCuentas(req: Request, res: Response) {
  const eventoId = Number(req.params.id);
  const evento = await prisma.evento.findFirst({ where: { id: eventoId, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!evento) { res.status(404).json({ error: 'Evento no encontrado' }); return; }

  const { propiasIds, vinculadaIds } = await resolveCuentaIdsEvento(eventoId);
  const vinculadaSet = new Set(vinculadaIds);

  const cuentas = await prisma.cuentaBancaria.findMany({
    where:   { id: { in: [...propiasIds, ...vinculadaIds] }, deleted_at: null },
    orderBy: { id: 'asc' },
  });
  res.json(cuentas.map(c => ({ ...mapCuenta(c), vinculada: vinculadaSet.has(c.id) })));
}

// POST /api/eventos/:id/cuentas/vincular — asocia una cuenta de empresa
// existente (evento_id null) a este evento sin duplicarla ni sacarla de
// Caja Global (ver EventoCuenta en schema.prisma).
const vincularCuentaSchema = z.object({
  cuenta_id: z.number().int().positive(),
});

export async function vincularCuenta(req: Request, res: Response) {
  const eventoId = Number(req.params.id);
  const parsed   = vincularCuentaSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors });
    return;
  }

  const evento = await prisma.evento.findFirst({ where: { id: eventoId, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!evento) { res.status(404).json({ error: 'Evento no encontrado' }); return; }

  const cuenta = await prisma.cuentaBancaria.findFirst({ where: { id: parsed.data.cuenta_id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!cuenta) { res.status(404).json({ error: 'Cuenta no encontrada' }); return; }
  if (cuenta.evento_id === eventoId) { res.status(400).json({ error: 'Esa cuenta ya pertenece a este evento' }); return; }

  const existente = await prisma.eventoCuenta.findUnique({
    where: { evento_id_cuenta_id: { evento_id: eventoId, cuenta_id: cuenta.id } },
  });
  if (existente) { res.status(400).json({ error: 'Esa cuenta ya está vinculada a este evento' }); return; }

  const vinculo = await prisma.$transaction(async tx => {
    const v = await tx.eventoCuenta.create({
      data: { evento_id: eventoId, cuenta_id: cuenta.id, created_by: req.user!.id },
    });
    await registrarAuditoria({
      usuarioId:    req.user!.id,
      empresaId:    req.empresaId,
      accion:       'CREATE',
      entidad:      'EventoCuenta',
      entidadId:    v.id,
      eventoId,
      descripcion:  `Vinculó la cuenta "${cuenta.nombre}" al evento #${eventoId}`,
      datosDespues: { evento_id: eventoId, cuenta_id: cuenta.id },
      ip:           req.ip,
      tx:           tx as any,
    });
    return v;
  });

  res.status(201).json({ ...mapCuenta(cuenta), vinculada: true, evento_cuenta_id: vinculo.id });
}

// DELETE /api/eventos/:id/cuentas/:cuentaId/desvincular — sólo elimina el
// vínculo (EventoCuenta), nunca la cuenta en sí.
export async function desvincularCuenta(req: Request, res: Response) {
  const eventoId = Number(req.params.id);
  const cuentaId = Number(req.params.cuentaId);

  const evento = await prisma.evento.findFirst({ where: { id: eventoId, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!evento) { res.status(404).json({ error: 'Evento no encontrado' }); return; }

  const existente = await prisma.eventoCuenta.findUnique({
    where:   { evento_id_cuenta_id: { evento_id: eventoId, cuenta_id: cuentaId } },
    include: { cuenta: { select: { nombre: true } } },
  });
  if (!existente) { res.status(404).json({ error: 'Vínculo no encontrado' }); return; }

  await prisma.$transaction(async tx => {
    await tx.eventoCuenta.delete({ where: { id: existente.id } });
    await registrarAuditoria({
      usuarioId:   req.user!.id,
      empresaId:   req.empresaId,
      accion:      'DELETE',
      entidad:     'EventoCuenta',
      entidadId:   existente.id,
      eventoId,
      descripcion: `Desvinculó la cuenta "${existente.cuenta.nombre}" del evento #${eventoId}`,
      ip:          req.ip,
      tx:          tx as any,
    });
  });

  res.json({ message: 'Cuenta desvinculada correctamente' });
}

export async function createCuenta(req: Request, res: Response) {
  const eventoId = Number(req.params.id);
  const parsed   = createCuentaSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors });
    return;
  }

  const evento = await prisma.evento.findFirst({ where: { id: eventoId, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!evento) { res.status(404).json({ error: 'Evento no encontrado' }); return; }

  const cuenta = await prisma.$transaction(async tx => {
    const c = await tx.cuentaBancaria.create({
      data: {
        ...withTenant(req.empresaId!),
        evento_id:     eventoId,
        nombre:        parsed.data.nombre,
        tipo:          parsed.data.tipo as TipoCuenta,
        moneda:        parsed.data.moneda as Moneda,
        saldo_inicial: parsed.data.saldo_inicial,
        saldo_minimo:  parsed.data.saldo_minimo ?? null,
        fecha_apertura: new Date(),
      },
    });
    await registrarAuditoria({
      usuarioId:    req.user!.id,
      empresaId:    req.empresaId,
      accion:       'CREATE',
      entidad:      'CuentaBancaria',
      entidadId:    c.id,
      eventoId,
      descripcion:  `Creó cuenta bancaria "${parsed.data.nombre}" en evento #${eventoId}`,
      datosDespues: parsed.data,
      ip:           req.ip,
      tx:           tx as any,
    });
    return c;
  });

  res.status(201).json(mapCuenta(cuenta));
}

export async function updateCuenta(req: Request, res: Response) {
  const id     = Number(req.params.id);
  const parsed = updateCuentaSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors });
    return;
  }

  const existing = await prisma.cuentaBancaria.findFirst({ where: { id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!existing) { res.status(404).json({ error: 'Cuenta no encontrada' }); return; }

  const { nombre, tipo, moneda, saldo_inicial, saldo_minimo } = parsed.data;

  const updated = await prisma.$transaction(async tx => {
    const c = await tx.cuentaBancaria.update({
      where: { id },
      data: {
        ...(nombre        !== undefined && { nombre }),
        ...(tipo          !== undefined && { tipo: tipo as TipoCuenta }),
        ...(moneda        !== undefined && { moneda: moneda as Moneda }),
        ...(saldo_inicial !== undefined && { saldo_inicial }),
        ...(saldo_minimo  !== undefined && { saldo_minimo }),
      },
    });
    if (saldo_inicial !== undefined) {
      await recalcularSaldosCaja(id, tx);
    }
    await registrarAuditoria({
      usuarioId:    req.user!.id,
      empresaId:    req.empresaId,
      accion:       'UPDATE',
      entidad:      'CuentaBancaria',
      entidadId:    id,
      eventoId:     existing.evento_id ?? undefined,
      descripcion:  `Actualizó cuenta bancaria "${existing.nombre}"`,
      datosAntes:   { nombre: existing.nombre, tipo: existing.tipo, moneda: existing.moneda, saldo_inicial: Number(existing.saldo_inicial), saldo_minimo: existing.saldo_minimo != null ? Number(existing.saldo_minimo) : null },
      datosDespues: parsed.data,
      ip:           req.ip,
      tx:           tx as any,
    });
    return c;
  });

  res.json(mapCuenta(updated));
}

// PATCH /api/cuentas/:id/estado — ciclo de rendición de una cuenta (viaje/evento).
// ABIERTA → PENDIENTE_RENDICION: cualquier usuario con acceso a la ruta.
// PENDIENTE_RENDICION → CERRADA: solo ADMIN (confirma la rendición).
// CERRADA es terminal — no puede volver atrás.
export async function updateEstadoCuenta(req: Request, res: Response) {
  const id     = Number(req.params.id);
  const parsed = estadoCuentaSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors });
    return;
  }

  const existing = await prisma.cuentaBancaria.findFirst({ where: { id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!existing) { res.status(404).json({ error: 'Cuenta no encontrada' }); return; }

  const { estado: target, notas_rendicion } = parsed.data;

  if (existing.estado === 'CERRADA') {
    res.status(400).json({ error: 'Esta cuenta ya está cerrada y no puede modificarse' });
    return;
  }
  if (existing.estado === 'ABIERTA' && target !== 'PENDIENTE_RENDICION') {
    res.status(400).json({ error: 'Transición de estado inválida' });
    return;
  }
  if (existing.estado === 'PENDIENTE_RENDICION' && target !== 'CERRADA') {
    res.status(400).json({ error: 'Transición de estado inválida' });
    return;
  }
  if (target === 'CERRADA' && req.user!.rol !== 'ADMIN') {
    res.status(403).json({ error: 'Sólo un administrador puede confirmar la rendición' });
    return;
  }

  const updated = await prisma.$transaction(async tx => {
    const c = await tx.cuentaBancaria.update({
      where: { id },
      data: {
        estado: target as EstadoCuenta,
        ...(notas_rendicion !== undefined && { notas_rendicion }),
        ...(target === 'CERRADA' && { fecha_cierre: new Date() }),
      },
    });
    await registrarAuditoria({
      usuarioId:    req.user!.id,
      empresaId:    req.empresaId,
      accion:       'UPDATE',
      entidad:      'CuentaBancaria',
      entidadId:    id,
      eventoId:     existing.evento_id ?? undefined,
      descripcion:  `Cambió el estado de la cuenta "${existing.nombre}" de ${existing.estado} a ${target}`,
      datosAntes:   { estado: existing.estado },
      datosDespues: { estado: target, notas_rendicion },
      ip:           req.ip,
      tx:           tx as any,
    });
    return c;
  });

  res.json(mapCuenta(updated));
}

export async function deleteCuenta(req: Request, res: Response) {
  const id       = Number(req.params.id);
  const existing = await prisma.cuentaBancaria.findFirst({ where: { id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!existing) { res.status(404).json({ error: 'Cuenta no encontrada' }); return; }

  await prisma.$transaction(async tx => {
    await tx.cuentaBancaria.update({ where: { id }, data: { deleted_at: new Date() } });
    await registrarAuditoria({
      usuarioId:  req.user!.id,
      empresaId:  req.empresaId,
      accion:     'DELETE',
      entidad:    'CuentaBancaria',
      entidadId:  id,
      eventoId:   existing.evento_id ?? undefined,
      descripcion: `Eliminó cuenta bancaria "${existing.nombre}"`,
      datosAntes:  { nombre: existing.nombre, tipo: existing.tipo, moneda: existing.moneda },
      ip:          req.ip,
      tx:          tx as any,
    });
  });

  res.json({ message: 'Cuenta eliminada correctamente' });
}

// ── Movimientos de Caja ───────────────────────────────────────────────────────

export async function listMovimientosCaja(req: Request, res: Response) {
  const cuentaId = Number(req.params.id);
  const cuenta = await prisma.cuentaBancaria.findFirst({ where: { id: cuentaId, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!cuenta) { res.status(404).json({ error: 'Cuenta no encontrada' }); return; }

  const [movs, tabMap] = await Promise.all([
    prisma.movimientoCaja.findMany({
      where:   { cuenta_id: cuentaId, deleted_at: null },
      orderBy: { orden: 'asc' },
      include: {
        // Sólo se usa desde la pantalla de detalle de cuenta en Caja Global
        // (resumen agrupado por evento) — el endpoint scoped a evento no lo
        // necesita, ya sabe de antemano en qué evento está parado.
        evento: { select: { id: true, nombre: true } },
        movimientos_origen: {
          where:  { deleted_at: null },
          select: {
            id: true, tipo: true, tab_numero: true, concepto: true,
            rubro_id: true, estado_movimiento: true,
            rubro: { select: { nombre: true } },
          },
          take:   1,
        },
      },
    }),
    getTabMap(req.empresaId!),
  ]);
  res.json(movs.map(m => mapMovCaja(m, tabMap)));
}

export async function createMovimientoCaja(req: Request, res: Response) {
  const cuentaId = Number(req.params.id);
  const parsed   = createMovCajaSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors });
    return;
  }

  const cuenta = await prisma.cuentaBancaria.findFirst({ where: { id: cuentaId, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!cuenta) { res.status(404).json({ error: 'Cuenta no encontrada' }); return; }

  const movId = await prisma.$transaction(async tx => {
    const last = await tx.movimientoCaja.findFirst({
      where:   { cuenta_id: cuentaId, deleted_at: null },
      orderBy: { orden: 'desc' },
      select:  { orden: true },
    });
    const mov = await tx.movimientoCaja.create({
      data: {
        cuenta_id:   cuentaId,
        fecha:       parsed.data.fecha ? new Date(parsed.data.fecha) : null,
        descripcion: parsed.data.descripcion ?? null,
        debe:        parsed.data.debe,
        haber:       parsed.data.haber,
        orden:       (last?.orden ?? 0) + 1,
        created_by:  req.user!.id,
        updated_by:  req.user!.id,
      },
    });
    await recalcularSaldosCaja(cuentaId, tx);
    await registrarAuditoria({
      usuarioId:    req.user!.id,
      empresaId:    req.empresaId,
      accion:       'CREATE',
      entidad:      'MovimientoCaja',
      entidadId:    mov.id,
      eventoId:     cuenta.evento_id ?? undefined,
      descripcion:  `Creó movimiento de caja en cuenta "${cuenta.nombre}"`,
      datosDespues: { debe: parsed.data.debe, haber: parsed.data.haber, descripcion: parsed.data.descripcion },
      ip:           req.ip,
      tx:           tx as any,
    });
    return mov.id;
  });

  const updated = await prisma.movimientoCaja.findUnique({ where: { id: movId } });
  res.status(201).json(mapMovCaja(updated));
}

// ── Movimientos de Caja, en contexto de un evento ─────────────────────────────
// Una cuenta puede estar vinculada a varios eventos (EventoCuenta) — estos dos
// endpoints filtran/etiquetan por evento_id para que la tab Caja de un evento
// sólo vea (y sólo genere) los movimientos cargados en SU contexto, no los de
// otro evento que comparte la misma cuenta. El endpoint flat de arriba
// (sin evento) sigue sin filtrar — lo usa Caja Global, donde sí interesa ver
// todo el movimiento real de la cuenta.

async function verificarCuentaDelEvento(eventoId: number, cuentaId: number, empresaId: number) {
  const evento = await prisma.evento.findFirst({ where: { id: eventoId, deleted_at: null, ...withTenant(empresaId) } });
  if (!evento) return { ok: false as const, status: 404, error: 'Evento no encontrado' };

  const cuenta = await prisma.cuentaBancaria.findFirst({ where: { id: cuentaId, deleted_at: null, ...withTenant(empresaId) } });
  if (!cuenta) return { ok: false as const, status: 404, error: 'Cuenta no encontrada' };

  const { propiasIds, vinculadaIds } = await resolveCuentaIdsEvento(eventoId);
  if (![...propiasIds, ...vinculadaIds].includes(cuentaId)) {
    return { ok: false as const, status: 400, error: 'Esa cuenta no pertenece a este evento' };
  }
  return { ok: true as const, cuenta };
}

export async function listMovimientosCajaEvento(req: Request, res: Response) {
  const eventoId = Number(req.params.id);
  const cuentaId = Number(req.params.cuentaId);

  const check = await verificarCuentaDelEvento(eventoId, cuentaId, req.empresaId!);
  if (!check.ok) { res.status(check.status).json({ error: check.error }); return; }

  const [movs, tabMap] = await Promise.all([
    prisma.movimientoCaja.findMany({
      where:   { cuenta_id: cuentaId, evento_id: eventoId, deleted_at: null },
      orderBy: { orden: 'asc' },
      include: {
        movimientos_origen: {
          where:  { deleted_at: null },
          select: {
            id: true, tipo: true, tab_numero: true, concepto: true,
            rubro_id: true, estado_movimiento: true,
            rubro: { select: { nombre: true } },
          },
          take:   1,
        },
      },
    }),
    getTabMap(req.empresaId!),
  ]);
  res.json(movs.map(m => mapMovCaja(m, tabMap)));
}

export async function createMovimientoCajaEvento(req: Request, res: Response) {
  const eventoId = Number(req.params.id);
  const cuentaId = Number(req.params.cuentaId);
  const parsed   = createMovCajaSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors });
    return;
  }

  const check = await verificarCuentaDelEvento(eventoId, cuentaId, req.empresaId!);
  if (!check.ok) { res.status(check.status).json({ error: check.error }); return; }
  const { cuenta } = check;

  const movId = await prisma.$transaction(async tx => {
    // orden es por-cuenta (no por-evento): saldo_corriente es el saldo real
    // de la cuenta y tiene que ser una secuencia única sin importar desde
    // qué evento se cargó cada movimiento.
    const last = await tx.movimientoCaja.findFirst({
      where:   { cuenta_id: cuentaId, deleted_at: null },
      orderBy: { orden: 'desc' },
      select:  { orden: true },
    });
    const mov = await tx.movimientoCaja.create({
      data: {
        cuenta_id:   cuentaId,
        evento_id:   eventoId,
        fecha:       parsed.data.fecha ? new Date(parsed.data.fecha) : null,
        descripcion: parsed.data.descripcion ?? null,
        debe:        parsed.data.debe,
        haber:       parsed.data.haber,
        orden:       (last?.orden ?? 0) + 1,
        created_by:  req.user!.id,
        updated_by:  req.user!.id,
      },
    });
    await recalcularSaldosCaja(cuentaId, tx);
    await registrarAuditoria({
      usuarioId:    req.user!.id,
      empresaId:    req.empresaId,
      accion:       'CREATE',
      entidad:      'MovimientoCaja',
      entidadId:    mov.id,
      eventoId,
      descripcion:  `Creó movimiento de caja en cuenta "${cuenta.nombre}" (evento #${eventoId})`,
      datosDespues: { debe: parsed.data.debe, haber: parsed.data.haber, descripcion: parsed.data.descripcion },
      ip:           req.ip,
      tx:           tx as any,
    });
    return mov.id;
  });

  const updated = await prisma.movimientoCaja.findUnique({ where: { id: movId } });
  res.status(201).json(mapMovCaja(updated));
}

export async function updateMovimientoCaja(req: Request, res: Response) {
  const id     = Number(req.params.id);
  const parsed = updateMovCajaSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors });
    return;
  }

  const existing = await prisma.movimientoCaja.findFirst({
    where:   { id, deleted_at: null, cuenta: withTenant(req.empresaId!) },
    include: { cuenta: { select: { evento_id: true, nombre: true } } },
  });
  if (!existing) { res.status(404).json({ error: 'Movimiento de caja no encontrado' }); return; }

  const movId = await prisma.$transaction(async tx => {
    await tx.movimientoCaja.update({
      where: { id },
      data: {
        ...(parsed.data.fecha       !== undefined && { fecha: parsed.data.fecha ? new Date(parsed.data.fecha) : null }),
        ...(parsed.data.descripcion !== undefined && { descripcion: parsed.data.descripcion }),
        ...(parsed.data.debe        !== undefined && { debe: parsed.data.debe }),
        ...(parsed.data.haber       !== undefined && { haber: parsed.data.haber }),
        updated_by: req.user!.id,
      },
    });
    await recalcularSaldosCaja(existing.cuenta_id, tx);
    await registrarAuditoria({
      usuarioId:    req.user!.id,
      empresaId:    req.empresaId,
      accion:       'UPDATE',
      entidad:      'MovimientoCaja',
      entidadId:    id,
      eventoId:     (existing as any).cuenta.evento_id ?? undefined,
      descripcion:  `Actualizó movimiento de caja #${id}`,
      datosAntes:   { debe: Number(existing.debe), haber: Number(existing.haber), descripcion: existing.descripcion },
      datosDespues: parsed.data,
      ip:           req.ip,
      tx:           tx as any,
    });
    return id;
  });

  const updated = await prisma.movimientoCaja.findUnique({ where: { id: movId } });
  res.json(mapMovCaja(updated));
}

export async function deleteMovimientoCaja(req: Request, res: Response) {
  const id       = Number(req.params.id);
  const existing = await prisma.movimientoCaja.findFirst({
    where:   { id, deleted_at: null, cuenta: withTenant(req.empresaId!) },
    include: { cuenta: { select: { evento_id: true } } },
  });
  if (!existing) { res.status(404).json({ error: 'Movimiento de caja no encontrado' }); return; }

  await prisma.$transaction(async tx => {
    await tx.movimientoCaja.update({
      where: { id },
      data:  { deleted_at: new Date(), updated_by: req.user!.id },
    });
    await recalcularSaldosCaja(existing.cuenta_id, tx);
    await registrarAuditoria({
      usuarioId:  req.user!.id,
      empresaId:  req.empresaId,
      accion:     'DELETE',
      entidad:    'MovimientoCaja',
      entidadId:  id,
      eventoId:   (existing as any).cuenta.evento_id ?? undefined,
      descripcion: `Eliminó movimiento de caja #${id}`,
      datosAntes:  { debe: Number(existing.debe), haber: Number(existing.haber), descripcion: existing.descripcion },
      ip:          req.ip,
      tx:          tx as any,
    });
  });

  res.json({ message: 'Movimiento de caja eliminado correctamente' });
}

// ── Transferencia ─────────────────────────────────────────────────────────────

const transferenciaSchema = z.object({
  cuenta_origen_id:  z.number().int().positive(),
  cuenta_destino_id: z.number().int().positive(),
  importe:           z.number().positive(),
  moneda:            z.enum(['ARS', 'USD']),
  fecha:             z.string().nullable().optional(),
  descripcion:       z.string().nullable().optional(),
});

export async function transferencia(req: Request, res: Response) {
  const eventoId = Number(req.params.id);
  const parsed   = transferenciaSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return;
  }

  const { cuenta_origen_id, cuenta_destino_id, importe, moneda, fecha, descripcion } = parsed.data;

  if (cuenta_origen_id === cuenta_destino_id) {
    res.status(400).json({ error: 'La cuenta origen y destino no pueden ser la misma' }); return;
  }

  const evento = await prisma.evento.findFirst({ where: { id: eventoId, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!evento) { res.status(404).json({ error: 'Evento no encontrado' }); return; }

  const { propiasIds, vinculadaIds } = await resolveCuentaIdsEvento(eventoId);
  const idsDelEvento = new Set([...propiasIds, ...vinculadaIds]);

  const [cuentaOrigenRaw, cuentaDestinoRaw] = await Promise.all([
    prisma.cuentaBancaria.findFirst({ where: { id: cuenta_origen_id,  deleted_at: null } }),
    prisma.cuentaBancaria.findFirst({ where: { id: cuenta_destino_id, deleted_at: null } }),
  ]);
  const cuentaOrigen  = cuentaOrigenRaw  && idsDelEvento.has(cuentaOrigenRaw.id)  ? cuentaOrigenRaw  : null;
  const cuentaDestino = cuentaDestinoRaw && idsDelEvento.has(cuentaDestinoRaw.id) ? cuentaDestinoRaw : null;

  if (!cuentaOrigen)  { res.status(400).json({ error: 'Cuenta origen no encontrada en este evento' }); return; }
  if (!cuentaDestino) { res.status(400).json({ error: 'Cuenta destino no encontrada en este evento' }); return; }
  if (cuentaOrigen.moneda !== cuentaDestino.moneda) {
    res.status(400).json({ error: 'Las cuentas deben tener la misma moneda' }); return;
  }
  if (cuentaOrigen.moneda !== moneda) {
    res.status(400).json({ error: 'La moneda no coincide con la de las cuentas' }); return;
  }

  const fechaDate = fecha ? new Date(fecha) : new Date();
  const descOrigen  = `Transferencia a: ${cuentaDestino.nombre}${descripcion ? ` — ${descripcion}` : ''}`;
  const descDestino = `Transferencia desde: ${cuentaOrigen.nombre}${descripcion ? ` — ${descripcion}` : ''}`;

  const [movOrigen, movDestino] = await prisma.$transaction(async tx => {
    const [lastOrig, lastDest] = await Promise.all([
      tx.movimientoCaja.findFirst({ where: { cuenta_id: cuenta_origen_id,  deleted_at: null }, orderBy: { orden: 'desc' }, select: { orden: true } }),
      tx.movimientoCaja.findFirst({ where: { cuenta_id: cuenta_destino_id, deleted_at: null }, orderBy: { orden: 'desc' }, select: { orden: true } }),
    ]);

    const orig = await tx.movimientoCaja.create({
      data: {
        cuenta_id:   cuenta_origen_id,
        evento_id:   eventoId,
        haber:       importe,
        debe:        0,
        descripcion: descOrigen,
        fecha:       fechaDate,
        orden:       (lastOrig?.orden ?? 0) + 1,
        created_by:  req.user!.id,
        updated_by:  req.user!.id,
      },
    });

    const dest = await tx.movimientoCaja.create({
      data: {
        cuenta_id:            cuenta_destino_id,
        evento_id:            eventoId,
        debe:                 importe,
        haber:                0,
        descripcion:          descDestino,
        fecha:                fechaDate,
        orden:                (lastDest?.orden ?? 0) + 1,
        transferencia_par_id: orig.id,
        created_by:           req.user!.id,
        updated_by:           req.user!.id,
      },
    });

    await tx.movimientoCaja.update({ where: { id: orig.id }, data: { transferencia_par_id: dest.id } });
    await recalcularSaldosCaja(cuenta_origen_id,  tx);
    await recalcularSaldosCaja(cuenta_destino_id, tx);

    await registrarAuditoria({
      usuarioId:    req.user!.id,
      empresaId:    req.empresaId,
      accion:       'CREATE',
      entidad:      'Transferencia',
      eventoId,
      descripcion:  `Transferencia ${moneda} ${importe} de "${cuentaOrigen.nombre}" a "${cuentaDestino.nombre}"`,
      datosDespues: { importe, moneda, cuenta_origen: cuentaOrigen.nombre, cuenta_destino: cuentaDestino.nombre },
      ip:           req.ip,
      tx:           tx as any,
    });

    return [
      await tx.movimientoCaja.findUnique({ where: { id: orig.id } }),
      await tx.movimientoCaja.findUnique({ where: { id: dest.id } }),
    ];
  });

  res.status(201).json({
    movimiento_origen:  mapMovCaja(movOrigen),
    movimiento_destino: mapMovCaja(movDestino),
  });
}

// ── Conciliar ─────────────────────────────────────────────────────────────────

const conciliarSchema = z.object({
  movimiento_id: z.number().int().positive(),
});

export async function conciliar(req: Request, res: Response) {
  const movCajaId = Number(req.params.id);
  const parsed    = conciliarSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'movimiento_id es requerido' }); return;
  }

  const movCaja = await prisma.movimientoCaja.findFirst({ where: { id: movCajaId, deleted_at: null, cuenta: withTenant(req.empresaId!) } });
  if (!movCaja) { res.status(404).json({ error: 'Movimiento de caja no encontrado' }); return; }

  const movimiento = await prisma.movimiento.findFirst({ where: { id: parsed.data.movimiento_id, deleted_at: null, evento: withTenant(req.empresaId!) } });
  if (!movimiento) { res.status(404).json({ error: 'Movimiento no encontrado' }); return; }

  // Válido si la cuenta es propia del evento del movimiento, O está vinculada
  // a ese evento vía EventoCuenta (una cuenta compartida entre varios
  // eventos también puede conciliar movimientos de cualquiera de ellos).
  const cuenta = await prisma.cuentaBancaria.findUnique({ where: { id: movCaja.cuenta_id } });
  const { propiasIds, vinculadaIds } = await resolveCuentaIdsEvento(movimiento.evento_id);
  const cuentaValida = !!cuenta && [...propiasIds, ...vinculadaIds].includes(cuenta.id);
  if (!cuentaValida) {
    res.status(400).json({ error: 'El movimiento de caja y el movimiento no pertenecen al mismo evento' }); return;
  }

  if (movimiento.movimiento_caja_id !== null) {
    res.status(400).json({ error: 'Este movimiento ya está conciliado' }); return;
  }

  const yaVinculado = await prisma.movimiento.findFirst({
    where: { movimiento_caja_id: movCajaId, deleted_at: null },
  });
  if (yaVinculado) {
    res.status(400).json({ error: 'Este movimiento de caja ya está vinculado a otro movimiento' }); return;
  }

  const updatedMov = await prisma.$transaction(async tx => {
    return tx.movimiento.update({
      where: { id: parsed.data.movimiento_id },
      data:  { movimiento_caja_id: movCajaId, updated_by: req.user!.id },
    });
  });

  const [updatedCaja, tabs] = await Promise.all([
    prisma.movimientoCaja.findUnique({ where: { id: movCajaId } }),
    getTabMap(req.empresaId!),
  ]);

  res.json({
    movimiento_caja: mapMovCaja({ ...updatedCaja, movimientos_origen: [updatedMov] }, tabs),
    movimiento: { ...updatedMov, debe: Number(updatedMov.debe), haber: Number(updatedMov.haber), saldo: Number(updatedMov.saldo) },
  });
}

// ── Posición Consolidada ──────────────────────────────────────────────────────

export async function posicionConsolidada(req: Request, res: Response) {
  const eventoId = Number(req.params.id);

  const evento = await prisma.evento.findFirst({ where: { id: eventoId, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!evento) { res.status(404).json({ error: 'Evento no encontrado' }); return; }

  const { propiasIds, vinculadaIds } = await resolveCuentaIdsEvento(eventoId);

  const cuentas = await prisma.cuentaBancaria.findMany({
    where:   { id: { in: [...propiasIds, ...vinculadaIds] }, deleted_at: null },
    orderBy: { id: 'asc' },
    include: {
      movimientos: {
        where:   { deleted_at: null },
        orderBy: { orden: 'asc' },
        select:  { debe: true, haber: true, saldo_corriente: true, transferencia_par_id: true, evento_id: true },
      },
    },
  });

  const monedas = [...new Set(cuentas.map(c => c.moneda as string))];

  const por_moneda = monedas.map(moneda => {
    const cuentasMoneda = cuentas.filter(c => c.moneda === moneda);

    const cuentasDetalle = cuentasMoneda.map(c => {
      // saldo_actual es el saldo REAL de la cuenta (secuencia completa,
      // incluye movimientos de otros eventos si la cuenta está compartida) —
      // total_debe/total_haber/cantidad_movimientos, en cambio, son "la
      // actividad que cargó ESTE evento en la cuenta", así que se filtran.
      const movs      = c.movimientos;
      const movsEvento = movs.filter(m => m.evento_id === eventoId);
      const last       = movs[movs.length - 1];
      const saldo_actual = last ? Number(last.saldo_corriente) : Number(c.saldo_inicial);
      const total_debe  = movsEvento.reduce((a, m) => a + Number(m.debe),  0);
      const total_haber = movsEvento.reduce((a, m) => a + Number(m.haber), 0);
      return {
        cuenta_id:             c.id,
        nombre:                c.nombre,
        tipo:                  c.tipo,
        saldo_inicial:         Number(c.saldo_inicial),
        saldo_actual:          parseFloat(saldo_actual.toFixed(2)),
        total_debe:            parseFloat(total_debe.toFixed(2)),
        total_haber:           parseFloat(total_haber.toFixed(2)),
        cantidad_movimientos:  movsEvento.length,
      };
    });

    const saldo_total = parseFloat(cuentasDetalle.reduce((a, c) => a + c.saldo_actual, 0).toFixed(2));
    const total_transferencias = parseFloat(
      cuentasMoneda
        .flatMap(c => c.movimientos)
        .filter(m => m.transferencia_par_id !== null && Number(m.haber) > 0)
        .reduce((a, m) => a + Number(m.haber), 0)
        .toFixed(2),
    );

    return { moneda, cuentas: cuentasDetalle, saldo_total, total_transferencias };
  });

  res.json({ evento_id: eventoId, por_moneda });
}
