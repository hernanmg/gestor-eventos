import type { Request, Response } from 'express';
import { z } from 'zod';
import { Tipo, TipoRubro, EstadoJornada, EstadoLiquidacion } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { withTenant } from '../lib/tenant';
import { recalcularSaldosRubro } from '../lib/recalcularSaldos';
import { registrarAuditoria } from '../lib/auditoria';
import { renderPDF } from '../lib/pdfExporter';
import { templateLiquidacion } from '../lib/pdfTemplates/liquidacion';
import { RUBROS_SISTEMA } from '../lib/rubrosConstants';
import { calcularMontoJornada } from '../lib/calcularLiquidacion';

const CATEGORIAS_EMPLEADO = [
  'CAPITAN', 'ARMADOR', 'CHOFER', 'ADMINISTRATIVO', 'TECNICO',
  'JORNALERO', 'FOFI', 'NESTORAS', 'EXTRANJERO', 'SERENO', 'OTRO',
] as const;

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

// Igual que calcularHoras, pero parte las horas según el umbral de jornada del
// empleado en vez de la regla fija de 8hs — así horas_normales/horas_extras
// reflejan visualmente el modelo real (LINEAL u JORNADA) en la tabla de Jornadas.
// No afecta a calcularMontoJornada, que ya recompone el total sumando ambas.
function calcularHorasSegunEmpleado(
  empleado: { tipo_liquidacion: string; umbral_horas_jornada: unknown },
  horaIngreso: Date | null,
  horaEgreso: Date | null,
) {
  if (empleado.tipo_liquidacion !== 'JORNADA') {
    return calcularHoras(horaIngreso, horaEgreso);
  }

  if (!horaIngreso || !horaEgreso) return { horas_normales: 0, horas_extras: 0 };
  const minutosTotales = (horaEgreso.getTime() - horaIngreso.getTime()) / 60000;
  if (minutosTotales <= 0) return { horas_normales: 0, horas_extras: 0 };

  const horasTrabajadas = round2(minutosTotales / 60);
  const umbralJornada    = Number(empleado.umbral_horas_jornada ?? 0);

  if (horasTrabajadas >= umbralJornada) {
    return { horas_normales: umbralJornada, horas_extras: round2(horasTrabajadas - umbralJornada) };
  }
  return { horas_normales: horasTrabajadas, horas_extras: 0 };
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

// Rubro de egresos usado para las liquidaciones de RRHH — análogo a
// getOrCreateTabRRHH pero para el modelo de rubros configurables, que es el
// que ahora determinan los tabs de Egresos en el frontend. Se crea la primera
// vez que se aprueba una liquidación en una empresa que no tenga ya un rubro
// con codigo='RRHH' (normalmente ya sembrado por prisma/seed.ts).
async function getOrCreateRubroRRHH(empresaId: number, tx: any): Promise<number> {
  const existente = await tx.rubro.findFirst({
    where: { empresa_id: empresaId, tipo: TipoRubro.EGRESO, codigo: RUBROS_SISTEMA.RRHH, deleted_at: null },
  });
  if (existente) return existente.id;

  const lastOrd = await tx.rubro.findFirst({
    where: { empresa_id: empresaId, tipo: TipoRubro.EGRESO }, orderBy: { orden: 'desc' }, select: { orden: true },
  });
  const rubro = await tx.rubro.create({
    data: {
      empresa_id: empresaId,
      tipo:       TipoRubro.EGRESO,
      nombre:     'RRHH',
      codigo:     RUBROS_SISTEMA.RRHH,
      orden:      (lastOrd?.orden ?? 0) + 1,
      activo:     true,
      es_sistema: true,
    },
  });
  return rubro.id;
}

// Empleado vinculado a la sesión actual (usuario con empleado_id asociado).
// Usado para acotar la vista de autoservicio (rol VIEWER + empleado vinculado).
async function getEmpleadoPropio(usuarioId: number, empresaId: number) {
  return prisma.empleado.findFirst({ where: { usuario_id: usuarioId, empresa_id: empresaId, deleted_at: null } });
}

function mapDecimalsEmpleado(e: any) {
  return {
    ...e,
    valor_hora:               Number(e.valor_hora),
    valor_hora_extra:         Number(e.valor_hora_extra),
    valor_jornada_completa:   e.valor_jornada_completa   != null ? Number(e.valor_jornada_completa)   : null,
    valor_media_jornada:      e.valor_media_jornada      != null ? Number(e.valor_media_jornada)      : null,
    umbral_horas_jornada:     e.umbral_horas_jornada     != null ? Number(e.umbral_horas_jornada)     : null,
    umbral_horas_media:       e.umbral_horas_media       != null ? Number(e.umbral_horas_media)       : null,
    valor_hora_extra_jornada: e.valor_hora_extra_jornada != null ? Number(e.valor_hora_extra_jornada) : null,
    valor_viaje:              e.valor_viaje              != null ? Number(e.valor_viaje)              : null,
  };
}

function mapDecimalsJornada(j: any) {
  return {
    ...j,
    horas_normales: Number(j.horas_normales),
    horas_extras:   Number(j.horas_extras),
    ...(j.empleado && typeof j.empleado === 'object' ? {
      empleado: {
        ...j.empleado,
        ...(j.empleado.umbral_horas_jornada !== undefined && { umbral_horas_jornada: j.empleado.umbral_horas_jornada != null ? Number(j.empleado.umbral_horas_jornada) : null }),
        ...(j.empleado.umbral_horas_media   !== undefined && { umbral_horas_media:   j.empleado.umbral_horas_media   != null ? Number(j.empleado.umbral_horas_media)   : null }),
      },
    } : {}),
  };
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
  categoria:        z.enum(CATEGORIAS_EMPLEADO).default('OTRO'),
  valor_hora:       z.number().min(0).default(0),
  valor_hora_extra: z.number().min(0).default(0),
  estado:           z.enum(['ACTIVO', 'INACTIVO', 'SUSPENDIDO']).default('ACTIVO'),
  notas:            z.string().nullable().optional(),
  usuario_id:       z.number().int().positive().nullable().optional(),

  // ── Modelo de liquidación ────────────────────────────────────────────────────
  tipo_liquidacion:         z.enum(['LINEAL', 'JORNADA']).default('LINEAL'),
  valor_jornada_completa:   z.number().min(0).nullable().optional(),
  valor_media_jornada:      z.number().min(0).nullable().optional(),
  umbral_horas_jornada:     z.number().min(0).nullable().optional(),
  umbral_horas_media:       z.number().min(0).nullable().optional(),
  valor_hora_extra_jornada: z.number().min(0).nullable().optional(),
  valor_viaje:              z.number().min(0).nullable().optional(),

  // ── Legajo ────────────────────────────────────────────────────────────────────
  apodo:                      z.string().nullable().optional(),
  fecha_nacimiento:           z.string().nullable().optional(),
  grupo_sanguineo:            z.string().nullable().optional(),
  contacto_emergencia_nombre: z.string().nullable().optional(),
  contacto_emergencia_tel:    z.string().nullable().optional(),
  escalafon:                  z.number().int().nullable().optional(),
  art:                        z.string().nullable().optional(),
  licencia_conducir:          z.boolean().default(false),
  equipamiento_asignado:      z.string().nullable().optional(),
  talle_pantalon:             z.string().nullable().optional(),
  talle_remera:               z.string().nullable().optional(),
  talle_buzo:                 z.string().nullable().optional(),
  talle_calzado:              z.string().nullable().optional(),
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

      tipo_liquidacion:         d.tipo_liquidacion,
      valor_jornada_completa:   d.valor_jornada_completa ?? null,
      valor_media_jornada:      d.valor_media_jornada ?? null,
      umbral_horas_jornada:     d.umbral_horas_jornada ?? null,
      umbral_horas_media:       d.umbral_horas_media ?? null,
      valor_hora_extra_jornada: d.valor_hora_extra_jornada ?? null,
      valor_viaje:              d.valor_viaje ?? null,

      apodo:                      d.apodo ?? null,
      fecha_nacimiento:           d.fecha_nacimiento ? new Date(d.fecha_nacimiento) : null,
      grupo_sanguineo:            d.grupo_sanguineo ?? null,
      contacto_emergencia_nombre: d.contacto_emergencia_nombre ?? null,
      contacto_emergencia_tel:    d.contacto_emergencia_tel ?? null,
      escalafon:                  d.escalafon ?? null,
      art:                        d.art ?? null,
      licencia_conducir:          d.licencia_conducir,
      equipamiento_asignado:      d.equipamiento_asignado ?? null,
      talle_pantalon:             d.talle_pantalon ?? null,
      talle_remera:               d.talle_remera ?? null,
      talle_buzo:                 d.talle_buzo ?? null,
      talle_calzado:              d.talle_calzado ?? null,
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

      ...(d.tipo_liquidacion         !== undefined && { tipo_liquidacion:         d.tipo_liquidacion }),
      ...(d.valor_jornada_completa   !== undefined && { valor_jornada_completa:   d.valor_jornada_completa }),
      ...(d.valor_media_jornada      !== undefined && { valor_media_jornada:      d.valor_media_jornada }),
      ...(d.umbral_horas_jornada     !== undefined && { umbral_horas_jornada:     d.umbral_horas_jornada }),
      ...(d.umbral_horas_media       !== undefined && { umbral_horas_media:       d.umbral_horas_media }),
      ...(d.valor_hora_extra_jornada !== undefined && { valor_hora_extra_jornada: d.valor_hora_extra_jornada }),
      ...(d.valor_viaje              !== undefined && { valor_viaje:              d.valor_viaje }),

      ...(d.apodo                      !== undefined && { apodo:                      d.apodo }),
      ...(d.fecha_nacimiento           !== undefined && { fecha_nacimiento:           d.fecha_nacimiento ? new Date(d.fecha_nacimiento) : null }),
      ...(d.grupo_sanguineo            !== undefined && { grupo_sanguineo:            d.grupo_sanguineo }),
      ...(d.contacto_emergencia_nombre !== undefined && { contacto_emergencia_nombre: d.contacto_emergencia_nombre }),
      ...(d.contacto_emergencia_tel    !== undefined && { contacto_emergencia_tel:    d.contacto_emergencia_tel }),
      ...(d.escalafon                  !== undefined && { escalafon:                  d.escalafon }),
      ...(d.art                        !== undefined && { art:                        d.art }),
      ...(d.licencia_conducir          !== undefined && { licencia_conducir:          d.licencia_conducir }),
      ...(d.equipamiento_asignado      !== undefined && { equipamiento_asignado:      d.equipamiento_asignado }),
      ...(d.talle_pantalon             !== undefined && { talle_pantalon:             d.talle_pantalon }),
      ...(d.talle_remera               !== undefined && { talle_remera:               d.talle_remera }),
      ...(d.talle_buzo                 !== undefined && { talle_buzo:                 d.talle_buzo }),
      ...(d.talle_calzado              !== undefined && { talle_calzado:              d.talle_calzado }),
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
  cantidad_viajes:   z.number().int().min(0).nullable().optional(),
  convocatoria:      z.string().nullable().optional(),
  lugar_trabajo:     z.string().nullable().optional(),
  camion_id:         z.number().int().positive().nullable().optional(),
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
      empleado: { select: { id: true, nombre: true, apellido: true, tipo_liquidacion: true, umbral_horas_jornada: true, umbral_horas_media: true } },
      evento:   { select: { id: true, nombre: true } },
      camion:   { select: { id: true, codigo: true, descripcion: true } },
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
    include: {
      empleado: { select: { id: true, nombre: true, apellido: true, tipo_liquidacion: true, umbral_horas_jornada: true, umbral_horas_media: true } },
      evento:   { select: { id: true, nombre: true } },
      camion:   { select: { id: true, codigo: true, descripcion: true } },
    },
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

  if (d.camion_id) {
    const camion = await prisma.camion.findFirst({ where: { id: d.camion_id, deleted_at: null, ...withTenant(req.empresaId!) } });
    if (!camion) { res.status(400).json({ error: 'Camión no encontrado' }); return; }
  }

  const horaIngreso = d.hora_ingreso ? new Date(d.hora_ingreso) : null;
  const horaEgreso  = d.hora_egreso  ? new Date(d.hora_egreso)  : null;
  const { horas_normales, horas_extras } = calcularHorasSegunEmpleado(empleado, horaIngreso, horaEgreso);

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
        cantidad_viajes:   d.cantidad_viajes ?? null,
        convocatoria:      d.convocatoria ?? null,
        lugar_trabajo:     d.lugar_trabajo ?? null,
        camion_id:         d.camion_id ?? null,
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

  const jornada = await prisma.jornada.findFirst({
    where:   { id, deleted_at: null, ...withTenant(req.empresaId!) },
    include: { empleado: true },
  });
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

  if (d.camion_id) {
    const camion = await prisma.camion.findFirst({ where: { id: d.camion_id, deleted_at: null, ...withTenant(req.empresaId!) } });
    if (!camion) { res.status(400).json({ error: 'Camión no encontrado' }); return; }
  }

  const horaIngreso = d.hora_ingreso !== undefined ? (d.hora_ingreso ? new Date(d.hora_ingreso) : null) : jornada.hora_ingreso;
  const horaEgreso  = d.hora_egreso  !== undefined ? (d.hora_egreso  ? new Date(d.hora_egreso)  : null) : jornada.hora_egreso;
  const { horas_normales, horas_extras } = calcularHorasSegunEmpleado(jornada.empleado, horaIngreso, horaEgreso);

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
      ...(d.cantidad_viajes   !== undefined && { cantidad_viajes:   d.cantidad_viajes }),
      ...(d.convocatoria      !== undefined && { convocatoria:      d.convocatoria }),
      ...(d.lugar_trabajo     !== undefined && { lugar_trabajo:     d.lugar_trabajo }),
      ...(d.camion_id         !== undefined && { camion_id:         d.camion_id }),
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

// Desglose por jornada APROBADA del período — usa calcularMontoJornada, que
// aplica el modelo LINEAL u JORNADA según el empleado. Compartido entre el
// preview y la generación real de la liquidación para que nunca diverjan.
async function calcularDesglosePeriodo(
  empleadoId: number, fechaDesde: Date, fechaHasta: Date, empresaId: number,
) {
  const empleado = await prisma.empleado.findFirst({ where: { id: empleadoId, deleted_at: null, ...withTenant(empresaId) } });
  if (!empleado) return null;

  const jornadas = await prisma.jornada.findMany({
    where: {
      empleado_id: empleadoId,
      estado:      EstadoJornada.APROBADA,
      fecha:       { gte: fechaDesde, lte: fechaHasta },
      deleted_at:  null,
      ...withTenant(empresaId),
    },
    orderBy: { fecha: 'asc' },
  });

  const desglose = jornadas.map(j => ({
    jornada_id:   j.id,
    fecha:        j.fecha,
    convocatoria: j.convocatoria,
    ...calcularMontoJornada(empleado, j),
  }));

  const horasNormales = round2(desglose.reduce((s, x) => s + x.horas_normales, 0));
  const horasExtras   = round2(desglose.reduce((s, x) => s + x.horas_extras, 0));
  const subtotal      = round2(desglose.reduce((s, x) => s + x.total, 0));

  return { empleado, desglose, horasNormales, horasExtras, subtotal };
}

const previewSchema = z.object({
  empleado_id: z.coerce.number().int().positive(),
  fecha_desde: z.string().min(1),
  fecha_hasta: z.string().min(1),
});

// GET /rrhh/liquidaciones/preview — desglose por jornada sin crear la Liquidación.
export async function previewLiquidacion(req: Request, res: Response) {
  const parsed = previewSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'Se requieren empleado_id, fecha_desde, fecha_hasta' }); return;
  }
  const d = parsed.data;

  const resultado = await calcularDesglosePeriodo(d.empleado_id, new Date(d.fecha_desde), new Date(d.fecha_hasta), req.empresaId!);
  if (!resultado) { res.status(404).json({ error: 'Empleado no encontrado' }); return; }

  res.json({
    tipo_liquidacion: resultado.empleado.tipo_liquidacion,
    horas_normales:   resultado.horasNormales,
    horas_extras:     resultado.horasExtras,
    subtotal_horas:   resultado.subtotal,
    jornadas:         resultado.desglose,
  });
}

export async function generarLiquidacion(req: Request, res: Response) {
  const parsed = generarSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return;
  }
  const d = parsed.data;

  const fechaDesde = new Date(d.fecha_desde);
  const fechaHasta = new Date(d.fecha_hasta);

  // 1 & 2. Jornadas APROBADAS del período — las PENDIENTES/RECHAZADAS no cuentan
  const resultado = await calcularDesglosePeriodo(d.empleado_id, fechaDesde, fechaHasta, req.empresaId!);
  if (!resultado) { res.status(404).json({ error: 'Empleado no encontrado' }); return; }
  const { empleado, horasNormales, horasExtras, subtotal } = resultado;

  // 3. Anticipos no descontados
  const anticipos = await prisma.anticipo.findMany({
    where: { empleado_id: d.empleado_id, descontado: false },
  });
  const totalAnticipos = anticipos.reduce((s, a) => s + Number(a.monto), 0);

  // 4. Cálculo — subtotal_horas ya viene calculado por jornada (LINEAL u JORNADA)
  const valorHora       = Number(empleado.valor_hora);
  const valorHoraExtra  = Number(empleado.valor_hora_extra);
  const totalDescuentos = 0;
  const totalACobrar    = round2(subtotal - totalAnticipos - totalDescuentos);

  // 5. Crear en BORRADOR — los anticipos NO se marcan descontados todavía.
  // tipo_liquidacion queda como snapshot: si luego se edita el empleado, esta
  // liquidación ya aprobada no cambia de significado.
  const liquidacion = await prisma.liquidacion.create({
    data: {
      empleado_id:      d.empleado_id,
      ...withTenant(req.empresaId!),
      evento_id:        d.evento_id ?? null,
      fecha_desde:      fechaDesde,
      fecha_hasta:      fechaHasta,
      tipo_liquidacion: empleado.tipo_liquidacion,
      horas_normales:   horasNormales,
      horas_extras:     horasExtras,
      valor_hora:       valorHora,
      valor_hora_extra: valorHoraExtra,
      subtotal_horas:   subtotal,
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
      const rubroId   = await getOrCreateRubroRRHH(req.empresaId!, tx);
      const lastOrder = await tx.movimiento.findFirst({
        where:   { evento_id: liquidacion.evento_id, tipo: Tipo.EGRESO, rubro_id: rubroId, deleted_at: null },
        orderBy: { orden: 'desc' },
        select:  { orden: true },
      });
      const mov = await tx.movimiento.create({
        data: {
          evento_id:   liquidacion.evento_id,
          tipo:        Tipo.EGRESO,
          tab_numero:  tabNumero,
          rubro_id:    rubroId,
          estado_movimiento: 'PAGADO',
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
      await recalcularSaldosRubro(liquidacion.evento_id, Tipo.EGRESO, rubroId, tx as any);
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
