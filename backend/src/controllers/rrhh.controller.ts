import type { Request, Response } from 'express';
import { z } from 'zod';
import { Tipo, EstadoJornada, EstadoLiquidacion } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { withTenant } from '../lib/tenant';
import { recalcularSaldos } from '../lib/recalcularSaldos';
import { registrarAuditoria } from '../lib/auditoria';
import { renderPDF } from '../lib/pdfExporter';
import { templateLiquidacion } from '../lib/pdfTemplates/liquidacion';

// ── Helpers numéricos ─────────────────────────────────────────────────────────

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function calcularHoras(horaIngreso: Date | null, horaEgreso: Date | null) {
  if (!horaIngreso || !horaEgreso) {
    return { horas_normales: 0, horas_extras: 0 };
  }
  const minutosTotales = (horaEgreso.getTime() - horaIngreso.getTime()) / 60000;
  if (minutosTotales <= 0) return { horas_normales: 0, horas_extras: 0 };
  if (minutosTotales <= 480) {
    return { horas_normales: round2(minutosTotales / 60), horas_extras: 0 };
  }
  return { horas_normales: 8, horas_extras: round2((minutosTotales - 480) / 60) };
}

// Tab de egresos usada para las liquidaciones de RRHH — se crea la primera vez
// que se aprueba una liquidación en una empresa. Reutiliza el mismo mecanismo
// de TabConfig (código estable 'RRHH') para que quede configurable/renombrable
// desde Configuración > Pestañas, igual que cualquier otra pestaña de egresos.
async function getOrCreateTabRRHH(empresaId: number, tx: any): Promise<number> {
  const existente = await tx.tabConfig.findFirst({
    where: { empresa_id: empresaId, tipo: Tipo.EGRESO, codigo: 'RRHH' },
  });
  if (existente) return existente.numero;

  const [lastNum, lastOrd] = await Promise.all([
    tx.tabConfig.findFirst({ where: { empresa_id: empresaId, tipo: Tipo.EGRESO }, orderBy: { numero: 'desc' }, select: { numero: true } }),
    tx.tabConfig.findFirst({ where: { empresa_id: empresaId, tipo: Tipo.EGRESO }, orderBy: { orden: 'desc' }, select: { orden: true } }),
  ]);
  const tab = await tx.tabConfig.create({
    data: {
      empresa_id: empresaId,
      tipo:       Tipo.EGRESO,
      numero:     (lastNum?.numero ?? 0) + 1,
      nombre:     'RRHH',
      codigo:     'RRHH',
      orden:      (lastOrd?.orden ?? 0) + 1,
      activo:     true,
      es_sistema: true,
    },
  });
  return tab.numero;
}

// Empleado vinculado a la sesión actual (usuario con empleado_id asociado).
// Usado para acotar la vista de autoservicio (rol VIEWER + empleado vinculado).
async function getEmpleadoPropio(usuarioId: number, empresaId: number) {
  return prisma.empleado.findFirst({ where: { usuario_id: usuarioId, empresa_id: empresaId, deleted_at: null } });
}

function mapDecimalsEmpleado(e: any) {
  return { ...e, valor_hora: Number(e.valor_hora), valor_hora_extra: Number(e.valor_hora_extra) };
}

function mapDecimalsJornada(j: any) {
  return { ...j, horas_normales: Number(j.horas_normales), horas_extras: Number(j.horas_extras) };
}

function mapDecimalsAnticipo(a: any) {
  return { ...a, monto: Number(a.monto) };
}

function mapDecimalsLiquidacion(l: any) {
  return {
    ...l,
    horas_normales:   Number(l.horas_normales),
    horas_extras:     Number(l.horas_extras),
    valor_hora:       Number(l.valor_hora),
    valor_hora_extra: Number(l.valor_hora_extra),
    subtotal_horas:   Number(l.subtotal_horas),
    total_anticipos:  Number(l.total_anticipos),
    total_descuentos: Number(l.total_descuentos),
    total_a_cobrar:   Number(l.total_a_cobrar),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// EMPLEADOS
// ═══════════════════════════════════════════════════════════════════════════

const empleadoSchema = z.object({
  nombre:           z.string().min(1),
  apellido:         z.string().min(1),
  dni:              z.string().min(1),
  cuit:             z.string().nullable().optional(),
  email:            z.union([z.string().email('Email inválido'), z.literal('')]).nullable().optional(),
  telefono:         z.string().nullable().optional(),
  domicilio:        z.string().nullable().optional(),
  cbu:              z.string().nullable().optional(),
  alias:            z.string().nullable().optional(),
  banco:            z.string().nullable().optional(),
  categoria:        z.enum(['CAPITAN', 'ARMADOR', 'CHOFER', 'ADMINISTRATIVO', 'TECNICO', 'OTRO']).default('OTRO'),
  valor_hora:       z.number().min(0).default(0),
  valor_hora_extra: z.number().min(0).default(0),
  estado:           z.enum(['ACTIVO', 'INACTIVO', 'SUSPENDIDO']).default('ACTIVO'),
  notas:            z.string().nullable().optional(),
  usuario_id:       z.number().int().positive().nullable().optional(),
});

export async function listEmpleados(req: Request, res: Response) {
  const { categoria, estado, q } = req.query;
  const where: any = { deleted_at: null, ...withTenant(req.empresaId!) };
  if (categoria) where.categoria = categoria;
  if (estado)    where.estado    = estado;
  if (q) {
    const term = String(q);
    where.OR = [
      { nombre:   { contains: term, mode: 'insensitive' } },
      { apellido: { contains: term, mode: 'insensitive' } },
      { dni:      { contains: term, mode: 'insensitive' } },
    ];
  }
  const empleados = await prisma.empleado.findMany({ where, orderBy: [{ apellido: 'asc' }, { nombre: 'asc' }] });
  res.json(empleados.map(mapDecimalsEmpleado));
}

export async function getEmpleado(req: Request, res: Response) {
  const id = Number(req.params.id);
  const empleado = await prisma.empleado.findFirst({ where: { id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!empleado) { res.status(404).json({ error: 'Empleado no encontrado' }); return; }

  const [horasAgg, anticiposPendientes, ultimaJornada] = await Promise.all([
    prisma.jornada.aggregate({
      where: { empleado_id: id, estado: EstadoJornada.APROBADA, deleted_at: null },
      _sum:  { horas_normales: true, horas_extras: true },
    }),
    prisma.anticipo.aggregate({
      where: { empleado_id: id, descontado: false },
      _sum:  { monto: true },
      _count: true,
    }),
    prisma.jornada.findFirst({
      where:   { empleado_id: id, deleted_at: null },
      orderBy: { fecha: 'desc' },
    }),
  ]);

  res.json({
    ...mapDecimalsEmpleado(empleado),
    stats: {
      horas_normales_totales: Number(horasAgg._sum.horas_normales ?? 0),
      horas_extras_totales:   Number(horasAgg._sum.horas_extras ?? 0),
      anticipos_pendientes:   Number(anticiposPendientes._sum.monto ?? 0),
      anticipos_pendientes_count: anticiposPendientes._count,
      ultima_jornada:         ultimaJornada ? mapDecimalsJornada(ultimaJornada) : null,
    },
  });
}

export async function createEmpleado(req: Request, res: Response) {
  const parsed = empleadoSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return;
  }
  const d = parsed.data;

  const empleado = await prisma.empleado.create({
    data: {
      ...withTenant(req.empresaId!),
      nombre:           d.nombre,
      apellido:         d.apellido,
      dni:              d.dni,
      cuit:             d.cuit ?? null,
      email:            d.email || null,
      telefono:         d.telefono ?? null,
      domicilio:        d.domicilio ?? null,
      cbu:              d.cbu ?? null,
      alias:            d.alias ?? null,
      banco:            d.banco ?? null,
      categoria:        d.categoria,
      valor_hora:       d.valor_hora,
      valor_hora_extra: d.valor_hora_extra,
      estado:           d.estado,
      notas:            d.notas ?? null,
      usuario_id:       d.usuario_id ?? null,
      created_by:       req.user!.id,
    },
  });
  res.status(201).json(mapDecimalsEmpleado(empleado));
}

export async function updateEmpleado(req: Request, res: Response) {
  const id = Number(req.params.id);
  const empleado = await prisma.empleado.findFirst({ where: { id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!empleado) { res.status(404).json({ error: 'Empleado no encontrado' }); return; }

  const parsed = empleadoSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return;
  }
  const d = parsed.data;

  const updated = await prisma.empleado.update({
    where: { id },
    data: {
      ...(d.nombre           !== undefined && { nombre:           d.nombre }),
      ...(d.apellido         !== undefined && { apellido:         d.apellido }),
      ...(d.dni              !== undefined && { dni:              d.dni }),
      ...(d.cuit             !== undefined && { cuit:             d.cuit }),
      ...(d.email            !== undefined && { email:            d.email || null }),
      ...(d.telefono         !== undefined && { telefono:         d.telefono }),
      ...(d.domicilio        !== undefined && { domicilio:        d.domicilio }),
      ...(d.cbu              !== undefined && { cbu:              d.cbu }),
      ...(d.alias            !== undefined && { alias:            d.alias }),
      ...(d.banco            !== undefined && { banco:            d.banco }),
      ...(d.categoria        !== undefined && { categoria:        d.categoria }),
      ...(d.valor_hora       !== undefined && { valor_hora:       d.valor_hora }),
      ...(d.valor_hora_extra !== undefined && { valor_hora_extra: d.valor_hora_extra }),
      ...(d.estado           !== undefined && { estado:           d.estado }),
      ...(d.notas            !== undefined && { notas:            d.notas }),
      ...(d.usuario_id       !== undefined && { usuario_id:       d.usuario_id }),
    },
  });
  res.json(mapDecimalsEmpleado(updated));
}

export async function deleteEmpleado(req: Request, res: Response) {
  const id = Number(req.params.id);
  const empleado = await prisma.empleado.findFirst({ where: { id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!empleado) { res.status(404).json({ error: 'Empleado no encontrado' }); return; }

  await prisma.empleado.update({ where: { id }, data: { deleted_at: new Date() } });
  res.json({ message: 'Empleado eliminado correctamente' });
}

// ═══════════════════════════════════════════════════════════════════════════
// JORNADAS
// ═══════════════════════════════════════════════════════════════════════════

const jornadaSchema = z.object({
  empleado_id:       z.number().int().positive(),
  evento_id:         z.number().int().positive().nullable().optional(),
  fecha:             z.string().min(1),
  hora_convocatoria: z.string().nullable().optional(),
  hora_ingreso:      z.string().nullable().optional(),
  hora_egreso:       z.string().nullable().optional(),
  descripcion:       z.string().nullable().optional(),
});

// Si el usuario es VIEWER con empleado vinculado, sólo puede ver/cargar sus
// propias jornadas — devuelve el empleado_id forzado o null si no aplica
// autoservicio (ADMIN/OPERADOR sin restricción).
async function resolveEmpleadoScope(req: Request): Promise<{ forced: number | null; ok: boolean }> {
  if (req.user!.rol !== 'VIEWER') return { forced: null, ok: true };
  const propio = await getEmpleadoPropio(req.user!.id, req.empresaId!);
  if (!propio) return { forced: null, ok: false };
  return { forced: propio.id, ok: true };
}

export async function listJornadas(req: Request, res: Response) {
  const scope = await resolveEmpleadoScope(req);
  if (!scope.ok) { res.status(403).json({ error: 'Sin acceso al módulo de RRHH' }); return; }

  const { empleado_id, evento_id, estado, desde, hasta } = req.query;
  const where: any = { deleted_at: null, ...withTenant(req.empresaId!) };

  if (scope.forced !== null) {
    where.empleado_id = scope.forced;
  } else if (empleado_id) {
    where.empleado_id = Number(empleado_id);
  }
  if (evento_id) where.evento_id = Number(evento_id);
  if (estado)    where.estado    = estado;
  if (desde || hasta) {
    where.fecha = {};
    if (desde) where.fecha.gte = new Date(String(desde));
    if (hasta) where.fecha.lte = new Date(String(hasta));
  }

  const jornadas = await prisma.jornada.findMany({
    where,
    include: {
      empleado: { select: { id: true, nombre: true, apellido: true } },
      evento:   { select: { id: true, nombre: true } },
    },
    orderBy: { fecha: 'desc' },
  });
  res.json(jornadas.map(mapDecimalsJornada));
}

export async function listJornadasEmpleado(req: Request, res: Response) {
  const empleadoId = Number(req.params.id);
  const empleado = await prisma.empleado.findFirst({ where: { id: empleadoId, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!empleado) { res.status(404).json({ error: 'Empleado no encontrado' }); return; }

  const jornadas = await prisma.jornada.findMany({
    where:   { empleado_id: empleadoId, deleted_at: null },
    include: { evento: { select: { id: true, nombre: true } } },
    orderBy: { fecha: 'desc' },
  });
  res.json(jornadas.map(mapDecimalsJornada));
}

export async function createJornada(req: Request, res: Response) {
  const scope = await resolveEmpleadoScope(req);
  if (!scope.ok) { res.status(403).json({ error: 'Sin acceso al módulo de RRHH' }); return; }

  const parsed = jornadaSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return;
  }
  const d = parsed.data;
  const empleadoId = scope.forced ?? d.empleado_id;

  const empleado = await prisma.empleado.findFirst({ where: { id: empleadoId, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!empleado) { res.status(404).json({ error: 'Empleado no encontrado' }); return; }

  const horaIngreso = d.hora_ingreso ? new Date(d.hora_ingreso) : null;
  const horaEgreso  = d.hora_egreso  ? new Date(d.hora_egreso)  : null;
  const { horas_normales, horas_extras } = calcularHoras(horaIngreso, horaEgreso);

  try {
    const jornada = await prisma.jornada.create({
      data: {
        empleado_id:       empleadoId,
        evento_id:         d.evento_id ?? null,
        ...withTenant(req.empresaId!),
        fecha:             new Date(d.fecha),
        hora_convocatoria: d.hora_convocatoria ? new Date(d.hora_convocatoria) : null,
        hora_ingreso:      horaIngreso,
        hora_egreso:       horaEgreso,
        horas_normales,
        horas_extras,
        descripcion:       d.descripcion ?? null,
        estado:            EstadoJornada.PENDIENTE,
        created_by:        req.user!.id,
      },
    });
    res.status(201).json(mapDecimalsJornada(jornada));
  } catch (err: any) {
    if (err?.code === 'P2002') {
      res.status(400).json({ error: 'Ese empleado ya tiene una jornada cargada en esa fecha' }); return;
    }
    throw err;
  }
}

export async function updateJornada(req: Request, res: Response) {
  const id = Number(req.params.id);
  const scope = await resolveEmpleadoScope(req);
  if (!scope.ok) { res.status(403).json({ error: 'Sin acceso al módulo de RRHH' }); return; }

  const jornada = await prisma.jornada.findFirst({ where: { id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!jornada) { res.status(404).json({ error: 'Jornada no encontrada' }); return; }
  if (scope.forced !== null && jornada.empleado_id !== scope.forced) {
    res.status(403).json({ error: 'No podés editar jornadas de otro empleado' }); return;
  }
  if (jornada.estado !== EstadoJornada.PENDIENTE) {
    res.status(400).json({ error: 'Sólo se pueden editar jornadas en estado PENDIENTE' }); return;
  }

  const parsed = jornadaSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return;
  }
  const d = parsed.data;

  const horaIngreso = d.hora_ingreso !== undefined ? (d.hora_ingreso ? new Date(d.hora_ingreso) : null) : jornada.hora_ingreso;
  const horaEgreso  = d.hora_egreso  !== undefined ? (d.hora_egreso  ? new Date(d.hora_egreso)  : null) : jornada.hora_egreso;
  const { horas_normales, horas_extras } = calcularHoras(horaIngreso, horaEgreso);

  const updated = await prisma.jornada.update({
    where: { id },
    data: {
      ...(d.evento_id         !== undefined && { evento_id:         d.evento_id }),
      ...(d.fecha             !== undefined && { fecha:             new Date(d.fecha) }),
      ...(d.hora_convocatoria !== undefined && { hora_convocatoria: d.hora_convocatoria ? new Date(d.hora_convocatoria) : null }),
      hora_ingreso: horaIngreso,
      hora_egreso:  horaEgreso,
      horas_normales,
      horas_extras,
      ...(d.descripcion       !== undefined && { descripcion:       d.descripcion }),
    },
  });
  res.json(mapDecimalsJornada(updated));
}

export async function aprobarJornada(req: Request, res: Response) {
  const id = Number(req.params.id);
  const jornada = await prisma.jornada.findFirst({ where: { id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!jornada) { res.status(404).json({ error: 'Jornada no encontrada' }); return; }
  if (jornada.estado !== EstadoJornada.PENDIENTE) {
    res.status(400).json({ error: `No se puede aprobar una jornada en estado ${jornada.estado}` }); return;
  }

  const updated = await prisma.jornada.update({
    where: { id },
    data: { estado: EstadoJornada.APROBADA, aprobado_por: req.user!.id, aprobado_at: new Date() },
  });
  res.json(mapDecimalsJornada(updated));
}

const rechazarSchema = z.object({ motivo: z.string().min(1, 'El motivo es requerido') });

export async function rechazarJornada(req: Request, res: Response) {
  const id = Number(req.params.id);
  const parsed = rechazarSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'El motivo es requerido' }); return; }

  const jornada = await prisma.jornada.findFirst({ where: { id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!jornada) { res.status(404).json({ error: 'Jornada no encontrada' }); return; }
  if (jornada.estado !== EstadoJornada.PENDIENTE) {
    res.status(400).json({ error: `No se puede rechazar una jornada en estado ${jornada.estado}` }); return;
  }

  const updated = await prisma.jornada.update({
    where: { id },
    data: {
      estado:         EstadoJornada.RECHAZADA,
      motivo_rechazo: parsed.data.motivo,
      aprobado_por:   req.user!.id,
      aprobado_at:    new Date(),
    },
  });
  res.json(mapDecimalsJornada(updated));
}

export async function deleteJornada(req: Request, res: Response) {
  const id = Number(req.params.id);
  const scope = await resolveEmpleadoScope(req);
  if (!scope.ok) { res.status(403).json({ error: 'Sin acceso al módulo de RRHH' }); return; }

  const jornada = await prisma.jornada.findFirst({ where: { id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!jornada) { res.status(404).json({ error: 'Jornada no encontrada' }); return; }
  if (scope.forced !== null && jornada.empleado_id !== scope.forced) {
    res.status(403).json({ error: 'No podés eliminar jornadas de otro empleado' }); return;
  }
  if (jornada.estado !== EstadoJornada.PENDIENTE) {
    res.status(400).json({ error: 'Sólo se pueden eliminar jornadas en estado PENDIENTE' }); return;
  }

  await prisma.jornada.update({ where: { id }, data: { deleted_at: new Date() } });
  res.json({ message: 'Jornada eliminada correctamente' });
}

// ═══════════════════════════════════════════════════════════════════════════
// ANTICIPOS
// ═══════════════════════════════════════════════════════════════════════════

const anticipoSchema = z.object({
  empleado_id: z.number().int().positive(),
  tipo:        z.enum(['ADELANTO', 'VALE', 'DESCUENTO']).default('ADELANTO'),
  monto:       z.number().positive(),
  fecha:       z.string().min(1),
  motivo:      z.string().nullable().optional(),
});

export async function listAnticiposEmpleado(req: Request, res: Response) {
  const empleadoId = Number(req.params.id);
  const empleado = await prisma.empleado.findFirst({ where: { id: empleadoId, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!empleado) { res.status(404).json({ error: 'Empleado no encontrado' }); return; }

  const anticipos = await prisma.anticipo.findMany({
    where:   { empleado_id: empleadoId },
    orderBy: { fecha: 'desc' },
  });
  res.json(anticipos.map(mapDecimalsAnticipo));
}

export async function createAnticipo(req: Request, res: Response) {
  const parsed = anticipoSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return;
  }
  const d = parsed.data;

  const empleado = await prisma.empleado.findFirst({ where: { id: d.empleado_id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!empleado) { res.status(404).json({ error: 'Empleado no encontrado' }); return; }

  const anticipo = await prisma.anticipo.create({
    data: {
      empleado_id: d.empleado_id,
      ...withTenant(req.empresaId!),
      tipo:        d.tipo,
      monto:       d.monto,
      fecha:       new Date(d.fecha),
      motivo:      d.motivo ?? null,
      created_by:  req.user!.id,
    },
  });
  res.status(201).json(mapDecimalsAnticipo(anticipo));
}

export async function deleteAnticipo(req: Request, res: Response) {
  const id = Number(req.params.id);
  const anticipo = await prisma.anticipo.findFirst({ where: { id, ...withTenant(req.empresaId!) } });
  if (!anticipo) { res.status(404).json({ error: 'Anticipo no encontrado' }); return; }
  if (anticipo.descontado) {
    res.status(400).json({ error: 'No se puede eliminar un anticipo ya descontado en una liquidación' }); return;
  }

  await prisma.anticipo.delete({ where: { id } });
  res.json({ message: 'Anticipo eliminado correctamente' });
}

// ═══════════════════════════════════════════════════════════════════════════
// LIQUIDACIONES
// ═══════════════════════════════════════════════════════════════════════════

export async function listLiquidaciones(req: Request, res: Response) {
  const { empleado_id, evento_id, estado, desde, hasta } = req.query;
  const where: any = { ...withTenant(req.empresaId!) };
  if (empleado_id) where.empleado_id = Number(empleado_id);
  if (evento_id)   where.evento_id   = Number(evento_id);
  if (estado)      where.estado      = estado;
  if (desde || hasta) {
    where.fecha_desde = {};
    if (desde) where.fecha_desde.gte = new Date(String(desde));
    if (hasta) where.fecha_desde.lte = new Date(String(hasta));
  }

  const liquidaciones = await prisma.liquidacion.findMany({
    where,
    include: {
      empleado: { select: { id: true, nombre: true, apellido: true } },
      evento:   { select: { id: true, nombre: true } },
    },
    orderBy: { created_at: 'desc' },
  });
  res.json(liquidaciones.map(mapDecimalsLiquidacion));
}

export async function getLiquidacion(req: Request, res: Response) {
  const id = Number(req.params.id);
  const liquidacion = await prisma.liquidacion.findFirst({
    where:   { id, ...withTenant(req.empresaId!) },
    include: {
      empleado:    true,
      evento:      { select: { id: true, nombre: true } },
      movimiento:  { select: { id: true, tipo: true, tab_numero: true, evento_id: true } },
      anticipos:   true,
    },
  });
  if (!liquidacion) { res.status(404).json({ error: 'Liquidación no encontrada' }); return; }

  const jornadasPeriodo = await prisma.jornada.findMany({
    where: {
      empleado_id: liquidacion.empleado_id,
      estado:      EstadoJornada.APROBADA,
      fecha:       { gte: liquidacion.fecha_desde, lte: liquidacion.fecha_hasta },
      deleted_at:  null,
    },
    orderBy: { fecha: 'asc' },
  });

  res.json({
    ...mapDecimalsLiquidacion(liquidacion),
    empleado:  mapDecimalsEmpleado(liquidacion.empleado),
    anticipos: liquidacion.anticipos.map(mapDecimalsAnticipo),
    jornadas:  jornadasPeriodo.map(mapDecimalsJornada),
  });
}

const generarSchema = z.object({
  empleado_id: z.number().int().positive(),
  fecha_desde: z.string().min(1),
  fecha_hasta: z.string().min(1),
  evento_id:   z.number().int().positive().nullable().optional(),
});

export async function generarLiquidacion(req: Request, res: Response) {
  const parsed = generarSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return;
  }
  const d = parsed.data;

  const empleado = await prisma.empleado.findFirst({ where: { id: d.empleado_id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!empleado) { res.status(404).json({ error: 'Empleado no encontrado' }); return; }

  const fechaDesde = new Date(d.fecha_desde);
  const fechaHasta = new Date(d.fecha_hasta);

  // 1 & 2. Jornadas APROBADAS del período — las PENDIENTES/RECHAZADAS no cuentan
  const jornadas = await prisma.jornada.aggregate({
    where: {
      empleado_id: d.empleado_id,
      estado:      EstadoJornada.APROBADA,
      fecha:       { gte: fechaDesde, lte: fechaHasta },
      deleted_at:  null,
    },
    _sum: { horas_normales: true, horas_extras: true },
  });
  const horasNormales = Number(jornadas._sum.horas_normales ?? 0);
  const horasExtras   = Number(jornadas._sum.horas_extras ?? 0);

  // 3. Anticipos no descontados
  const anticipos = await prisma.anticipo.findMany({
    where: { empleado_id: d.empleado_id, descontado: false },
  });
  const totalAnticipos = anticipos.reduce((s, a) => s + Number(a.monto), 0);

  // 4. Cálculo
  const valorHora      = Number(empleado.valor_hora);
  const valorHoraExtra = Number(empleado.valor_hora_extra);
  const subtotalHoras  = round2(horasNormales * valorHora + horasExtras * valorHoraExtra);
  const totalDescuentos = 0;
  const totalACobrar   = round2(subtotalHoras - totalAnticipos - totalDescuentos);

  // 5. Crear en BORRADOR — los anticipos NO se marcan descontados todavía
  const liquidacion = await prisma.liquidacion.create({
    data: {
      empleado_id:      d.empleado_id,
      ...withTenant(req.empresaId!),
      evento_id:        d.evento_id ?? null,
      fecha_desde:      fechaDesde,
      fecha_hasta:      fechaHasta,
      horas_normales:   horasNormales,
      horas_extras:     horasExtras,
      valor_hora:       valorHora,
      valor_hora_extra: valorHoraExtra,
      subtotal_horas:   subtotalHoras,
      total_anticipos:  totalAnticipos,
      total_descuentos: totalDescuentos,
      total_a_cobrar:   totalACobrar,
      estado:           EstadoLiquidacion.BORRADOR,
    },
  });
  res.status(201).json(mapDecimalsLiquidacion(liquidacion));
}

export async function aprobarLiquidacion(req: Request, res: Response) {
  const id = Number(req.params.id);
  const liquidacion = await prisma.liquidacion.findFirst({
    where:   { id, ...withTenant(req.empresaId!) },
    include: { empleado: true },
  });
  if (!liquidacion) { res.status(404).json({ error: 'Liquidación no encontrada' }); return; }
  if (liquidacion.estado !== EstadoLiquidacion.BORRADOR) {
    res.status(400).json({ error: `No se puede aprobar una liquidación en estado ${liquidacion.estado}` }); return;
  }

  const result = await prisma.$transaction(async tx => {
    let movimientoId: number | null = null;

    if (liquidacion.evento_id) {
      const tabNumero = await getOrCreateTabRRHH(req.empresaId!, tx);
      const lastOrder = await tx.movimiento.findFirst({
        where:   { evento_id: liquidacion.evento_id, tipo: Tipo.EGRESO, tab_numero: tabNumero, deleted_at: null },
        orderBy: { orden: 'desc' },
        select:  { orden: true },
      });
      const mov = await tx.movimiento.create({
        data: {
          evento_id:   liquidacion.evento_id,
          tipo:        Tipo.EGRESO,
          tab_numero:  tabNumero,
          fecha:       new Date(),
          concepto:    `Liquidación ${liquidacion.empleado.apellido}, ${liquidacion.empleado.nombre}`,
          descripcion: `Período ${liquidacion.fecha_desde.toISOString().slice(0, 10)} a ${liquidacion.fecha_hasta.toISOString().slice(0, 10)}`,
          haber:       liquidacion.total_a_cobrar,
          orden:       (lastOrder?.orden ?? 0) + 1,
          saldo:       0,
          created_by:  req.user!.id,
          updated_by:  req.user!.id,
        },
      });
      movimientoId = mov.id;
      await recalcularSaldos(liquidacion.evento_id, Tipo.EGRESO, tabNumero, tx as any);
    }

    // 3. Marcar anticipos no descontados de este empleado como aplicados a esta liquidación
    const anticiposAplicados = await tx.anticipo.findMany({
      where: { empleado_id: liquidacion.empleado_id, descontado: false },
    });
    await tx.anticipo.updateMany({
      where: { id: { in: anticiposAplicados.map((a: any) => a.id) } },
      data:  { descontado: true, liquidacion_id: id },
    });

    // 4. Actualizar liquidación
    const updated = await tx.liquidacion.update({
      where: { id },
      data: {
        estado:       EstadoLiquidacion.APROBADA,
        movimiento_id: movimientoId,
        aprobado_por:  req.user!.id,
        aprobado_at:   new Date(),
      },
    });

    // 5. Auditoría
    await registrarAuditoria({
      usuarioId:    req.user!.id,
      empresaId:    req.empresaId,
      accion:       'APROBAR',
      entidad:      'Liquidacion',
      entidadId:    id,
      eventoId:     liquidacion.evento_id ?? undefined,
      descripcion:  `Aprobó liquidación de ${liquidacion.empleado.apellido}, ${liquidacion.empleado.nombre} por $${Number(liquidacion.total_a_cobrar)}`,
      datosDespues: { movimientoId, total_a_cobrar: Number(liquidacion.total_a_cobrar) },
      ip:           req.ip,
      tx:           tx as any,
    });

    return updated;
  });

  res.json(mapDecimalsLiquidacion(result));
}

export async function cancelarLiquidacion(req: Request, res: Response) {
  const id = Number(req.params.id);
  const liquidacion = await prisma.liquidacion.findFirst({ where: { id, ...withTenant(req.empresaId!) } });
  if (!liquidacion) { res.status(404).json({ error: 'Liquidación no encontrada' }); return; }
  if (liquidacion.estado === EstadoLiquidacion.PAGADA) {
    res.status(400).json({ error: 'No se puede cancelar una liquidación ya PAGADA' }); return;
  }
  if (liquidacion.estado === EstadoLiquidacion.CANCELADA) {
    res.status(400).json({ error: 'La liquidación ya está cancelada' }); return;
  }

  const updated = await prisma.liquidacion.update({
    where: { id },
    data:  { estado: EstadoLiquidacion.CANCELADA },
  });
  res.json(mapDecimalsLiquidacion(updated));
}

// ── Exportación PDF ────────────────────────────────────────────────────────────

export async function exportarLiquidacionPDF(req: Request, res: Response) {
  const id = Number(req.params.id);
  const liquidacion = await prisma.liquidacion.findFirst({
    where:   { id, ...withTenant(req.empresaId!) },
    include: { empleado: true, evento: { select: { nombre: true } }, anticipos: true },
  });
  if (!liquidacion) { res.status(404).json({ error: 'Liquidación no encontrada' }); return; }

  const jornadas = await prisma.jornada.findMany({
    where: {
      empleado_id: liquidacion.empleado_id,
      estado:      EstadoJornada.APROBADA,
      fecha:       { gte: liquidacion.fecha_desde, lte: liquidacion.fecha_hasta },
      deleted_at:  null,
    },
    orderBy: { fecha: 'asc' },
  });

  const html = templateLiquidacion({
    empleado: {
      nombre:    liquidacion.empleado.nombre,
      apellido:  liquidacion.empleado.apellido,
      dni:       liquidacion.empleado.dni,
      categoria: liquidacion.empleado.categoria,
    },
    evento_nombre:    liquidacion.evento?.nombre ?? null,
    fecha_desde:      liquidacion.fecha_desde,
    fecha_hasta:      liquidacion.fecha_hasta,
    jornadas:         jornadas.map(j => ({
      fecha: j.fecha, horas_normales: Number(j.horas_normales), horas_extras: Number(j.horas_extras), descripcion: j.descripcion,
    })),
    anticipos:        liquidacion.anticipos.map(a => ({ tipo: a.tipo, monto: Number(a.monto), fecha: a.fecha, motivo: a.motivo })),
    valor_hora:       Number(liquidacion.valor_hora),
    valor_hora_extra: Number(liquidacion.valor_hora_extra),
    horas_normales:   Number(liquidacion.horas_normales),
    horas_extras:     Number(liquidacion.horas_extras),
    subtotal_horas:   Number(liquidacion.subtotal_horas),
    total_anticipos:  Number(liquidacion.total_anticipos),
    total_descuentos: Number(liquidacion.total_descuentos),
    total_a_cobrar:   Number(liquidacion.total_a_cobrar),
    estado:           liquidacion.estado,
    fecha_generacion: new Date(),
  });

  const buffer   = await renderPDF(html, `${liquidacion.empleado.apellido}, ${liquidacion.empleado.nombre}`, 'Liquidación');
  const filename = `Liquidacion-${liquidacion.empleado.apellido}-${id}.pdf`;

  res.set({
    'Content-Type':        'application/pdf',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Content-Length':      String(buffer.length),
  });
  res.end(buffer);
}
