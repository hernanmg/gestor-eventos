import type { Request, Response } from 'express';
import { z } from 'zod';
import { Tipo, TipoRubro, EstadoJornada, EstadoLiquidacion } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { withTenant } from '../lib/tenant';
import { recalcularSaldosRubro, recalcularSaldosCaja } from '../lib/recalcularSaldos';
import { registrarAuditoria } from '../lib/auditoria';
import { renderPDF } from '../lib/pdfExporter';
import { templateLiquidacion } from '../lib/pdfTemplates/liquidacion';
import { RUBROS_SISTEMA } from '../lib/rubrosConstants';
import { calcularMontoJornada, HORAS_BASE_LINEAL } from '../lib/calcularLiquidacion';

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
  return partirHorasLineal(round2(minutosTotales / 60));
}

// Parte un total de horas según la base del valor hora (HORAS_BASE_LINEAL).
export function partirHorasLineal(horas: number) {
  if (horas <= 0) return { horas_normales: 0, horas_extras: 0 };
  if (horas <= HORAS_BASE_LINEAL) return { horas_normales: round2(horas), horas_extras: 0 };
  return { horas_normales: HORAS_BASE_LINEAL, horas_extras: round2(horas - HORAS_BASE_LINEAL) };
}

// Igual que calcularHoras, pero parte las horas según el umbral de jornada del
// empleado en vez de la regla fija de 8hs — así horas_normales/horas_extras
// reflejan visualmente el modelo real (LINEAL u JORNADA) en la tabla de Jornadas.
// No afecta a calcularMontoJornada, que ya recompone el total sumando ambas.
export function calcularHorasSegunEmpleado(
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
export async function getEmpleadoPropio(usuarioId: number, empresaId: number) {
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
  fecha_ingreso:              z.string().nullable().optional(),
  grupo_sanguineo:            z.string().nullable().optional(),
  contacto_emergencia_nombre: z.string().nullable().optional(),
  contacto_emergencia_tel:    z.string().nullable().optional(),
  contacto_emergencia_tel2:   z.string().nullable().optional(),
  escalafon:                  z.number().int().nullable().optional(),
  art:                        z.string().nullable().optional(),
  tipo_contratacion:          z.string().nullable().optional(),
  licencia_conducir:          z.boolean().default(false),
  licencia_categoria:         z.string().nullable().optional(),
  licencia_numero:            z.string().nullable().optional(),
  licencia_vencimiento:       z.string().nullable().optional(),
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
      fecha_ingreso:              d.fecha_ingreso ? new Date(d.fecha_ingreso) : null,
      grupo_sanguineo:            d.grupo_sanguineo ?? null,
      contacto_emergencia_nombre: d.contacto_emergencia_nombre ?? null,
      contacto_emergencia_tel:    d.contacto_emergencia_tel ?? null,
      contacto_emergencia_tel2:   d.contacto_emergencia_tel2 ?? null,
      escalafon:                  d.escalafon ?? null,
      art:                        d.art ?? null,
      tipo_contratacion:          d.tipo_contratacion ?? null,
      licencia_conducir:          d.licencia_conducir,
      licencia_categoria:         d.licencia_categoria || null,
      licencia_numero:            d.licencia_numero || null,
      licencia_vencimiento:       d.licencia_vencimiento ? new Date(d.licencia_vencimiento) : null,
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
      ...(d.fecha_ingreso              !== undefined && { fecha_ingreso:              d.fecha_ingreso ? new Date(d.fecha_ingreso) : null }),
      ...(d.grupo_sanguineo            !== undefined && { grupo_sanguineo:            d.grupo_sanguineo }),
      ...(d.contacto_emergencia_nombre !== undefined && { contacto_emergencia_nombre: d.contacto_emergencia_nombre }),
      ...(d.contacto_emergencia_tel    !== undefined && { contacto_emergencia_tel:    d.contacto_emergencia_tel }),
      ...(d.contacto_emergencia_tel2   !== undefined && { contacto_emergencia_tel2:   d.contacto_emergencia_tel2 }),
      ...(d.escalafon                  !== undefined && { escalafon:                  d.escalafon }),
      ...(d.art                        !== undefined && { art:                        d.art }),
      ...(d.tipo_contratacion          !== undefined && { tipo_contratacion:          d.tipo_contratacion }),
      ...(d.licencia_conducir          !== undefined && { licencia_conducir:          d.licencia_conducir }),
      ...(d.licencia_categoria         !== undefined && { licencia_categoria:         d.licencia_categoria || null }),
      ...(d.licencia_numero            !== undefined && { licencia_numero:            d.licencia_numero || null }),
      ...(d.licencia_vencimiento       !== undefined && { licencia_vencimiento:       d.licencia_vencimiento ? new Date(d.licencia_vencimiento) : null }),
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
  // Sólo ADMIN llega acá sin restricción — la ruta ya bloquea todo lo demás
  // excepto JORNALERO (ver rrhh.ts, ROLES.JORNALERO_PROPIO), que queda forzado
  // a su propio empleado_id vinculado. VIEWER ya no tiene acceso a RRHH.
  if (req.user!.rol !== 'JORNALERO') return { forced: null, ok: true };
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

// Una jornada aprobada que ya entró en una liquidación (no cancelada) del mismo
// empleado no se puede desaprobar ni borrar: cambiaría lo que se pagó. Hay que
// cancelar la liquidación primero. Las liquidaciones toman las jornadas por
// rango de fechas (no hay FK), así que se busca por período.
async function liquidacionQueIncluye(j: { empleado_id: number; fecha: Date; empresa_id: number }) {
  return prisma.liquidacion.findFirst({
    where: {
      empleado_id: j.empleado_id,
      empresa_id:  j.empresa_id,
      estado:      { not: EstadoLiquidacion.CANCELADA },
      fecha_desde: { lte: j.fecha },
      fecha_hasta: { gte: j.fecha },
    },
    select: { id: true, estado: true },
  });
}

const ESTADO_LIQ_TXT: Record<string, string> = { BORRADOR: 'en borrador', PRE_APROBADA: 'pre-aprobada', APROBADA: 'aprobada', PAGADA: 'pagada' };

// PATCH /rrhh/jornadas/:id/desaprobar — vuelve una jornada APROBADA o
// RECHAZADA a PENDIENTE (se aprobó o rechazó por error).
export async function desaprobarJornada(req: Request, res: Response) {
  const id = Number(req.params.id);
  const jornada = await prisma.jornada.findFirst({
    where: { id, deleted_at: null, ...withTenant(req.empresaId!) },
    include: { empleado: { select: { nombre: true, apellido: true } } },
  });
  if (!jornada) { res.status(404).json({ error: 'Jornada no encontrada' }); return; }
  if (jornada.estado === EstadoJornada.PENDIENTE) {
    res.status(400).json({ error: 'La jornada ya está pendiente' }); return;
  }
  if (jornada.estado === EstadoJornada.APROBADA) {
    const liq = await liquidacionQueIncluye(jornada);
    if (liq) {
      res.status(400).json({ error: `La jornada ya está en una liquidación ${ESTADO_LIQ_TXT[liq.estado] ?? ''}. Cancelá la liquidación antes de desaprobarla.` }); return;
    }
  }

  const updated = await prisma.jornada.update({
    where: { id },
    data:  { estado: EstadoJornada.PENDIENTE, aprobado_por: null, aprobado_at: null, motivo_rechazo: null },
  });
  await registrarAuditoria({
    usuarioId:     req.user!.id,
    empresaId:     req.empresaId!,
    accion:        'UPDATE',
    entidad:       'Jornada',
    entidadId:     id,
    descripcion:   `Volvió a pendiente la jornada ${jornada.estado === EstadoJornada.APROBADA ? 'aprobada' : 'rechazada'} de ${jornada.empleado.apellido}, ${jornada.empleado.nombre} del ${jornada.fecha.toISOString().slice(0, 10)}`,
    datosAntes:    { estado: jornada.estado, aprobado_por: jornada.aprobado_por, motivo_rechazo: jornada.motivo_rechazo },
    datosDespues:  { estado: EstadoJornada.PENDIENTE },
    ip:            req.ip,
    tx:            prisma as any,
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
  // El empleado (scope forzado) sólo borra las suyas pendientes; el admin
  // puede borrar aprobadas o rechazadas mientras no estén liquidadas.
  if (scope.forced !== null && jornada.estado !== EstadoJornada.PENDIENTE) {
    res.status(400).json({ error: 'Sólo se pueden eliminar jornadas en estado PENDIENTE' }); return;
  }
  if (jornada.estado === EstadoJornada.APROBADA) {
    const liq = await liquidacionQueIncluye(jornada);
    if (liq) {
      res.status(400).json({ error: `La jornada ya está en una liquidación ${ESTADO_LIQ_TXT[liq.estado] ?? ''}. Cancelá la liquidación antes de eliminarla.` }); return;
    }
  }

  await prisma.jornada.update({ where: { id }, data: { deleted_at: new Date() } });
  await registrarAuditoria({
    usuarioId:    req.user!.id,
    empresaId:    req.empresaId!,
    accion:       'DELETE',
    entidad:      'Jornada',
    entidadId:    id,
    descripcion:  `Eliminó una jornada ${jornada.estado.toLowerCase()} del ${jornada.fecha.toISOString().slice(0, 10)}`,
    datosAntes:   { estado: jornada.estado, empleado_id: jornada.empleado_id, fecha: jornada.fecha },
    ip:           req.ip,
    tx:           prisma as any,
  });
  res.json({ message: 'Jornada eliminada correctamente' });
}

// ═══════════════════════════════════════════════════════════════════════════
// ANTICIPOS
// ═══════════════════════════════════════════════════════════════════════════

const anticipoSchema = z.object({
  empleado_id: z.number().int().positive(),
  tipo:        z.enum(['ADELANTO', 'VALE', 'DESCUENTO', 'MULTA']).default('ADELANTO'),
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
  const { empleado_id, evento_id, estado, desde, hasta, fecha_pago, fecha_pago_desde, fecha_pago_hasta, pendientes } = req.query;
  const where: any = { ...withTenant(req.empresaId!) };
  if (empleado_id) where.empleado_id = Number(empleado_id);
  if (evento_id)   where.evento_id   = Number(evento_id);
  if (estado)      where.estado      = estado;
  // "Pendientes de pago": todo lo que todavía no se pagó ni se canceló.
  if (pendientes === 'true' && !estado) where.estado = { in: [EstadoLiquidacion.BORRADOR, EstadoLiquidacion.PRE_APROBADA, EstadoLiquidacion.APROBADA] };
  if (desde || hasta) {
    where.fecha_desde = {};
    if (desde) where.fecha_desde.gte = new Date(String(desde));
    if (hasta) where.fecha_desde.lte = new Date(String(hasta));
  }
  if (fecha_pago) {
    where.fecha_pago = new Date(String(fecha_pago));
  } else if (fecha_pago_desde || fecha_pago_hasta) {
    where.fecha_pago = {};
    if (fecha_pago_desde) where.fecha_pago.gte = new Date(String(fecha_pago_desde));
    if (fecha_pago_hasta) where.fecha_pago.lte = new Date(String(fecha_pago_hasta));
  }

  const liquidaciones = await prisma.liquidacion.findMany({
    where,
    include: {
      empleado: { select: { id: true, nombre: true, apellido: true, dni: true, cuit: true, cbu: true, alias: true, banco: true } },
      evento:   { select: { id: true, nombre: true } },
      movimientos_caja: { where: { deleted_at: null }, select: { id: true, cuenta_id: true, comprobante_nombre: true, cuenta: { select: { nombre: true } } } },
    },
    orderBy: [{ fecha_pago: { sort: 'desc', nulls: 'last' } }, { created_at: 'desc' }],
  });
  res.json(liquidaciones.map(l => {
    const pago = l.movimientos_caja[0];
    const { movimientos_caja, ...resto } = l;
    return {
      ...mapDecimalsLiquidacion(resto),
      pago: pago ? { movimiento_caja_id: pago.id, cuenta_id: pago.cuenta_id, cuenta_nombre: pago.cuenta.nombre, tiene_comprobante: !!pago.comprobante_nombre } : null,
    };
  }));
}

// Próximo viernes (hoy si es viernes) como fecha de calendario — Enjoy paga
// los viernes (Male, nov 2026). Se usa como fecha de pago por defecto.
export function proximoViernes(desde: Date = new Date()): Date {
  const hoy = new Date(Date.UTC(desde.getFullYear(), desde.getMonth(), desde.getDate()));
  const dias = (5 - hoy.getUTCDay() + 7) % 7;
  hoy.setUTCDate(hoy.getUTCDate() + dias);
  return hoy;
}

const fechaCalendario = (s: string) => new Date(`${s.slice(0, 10)}T00:00:00.000Z`);

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
  fecha_pago:  z.string().min(1).nullable().optional(),
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
      fecha_pago:       d.fecha_pago ? fechaCalendario(d.fecha_pago) : proximoViernes(),
    },
  });
  res.status(201).json(mapDecimalsLiquidacion(liquidacion));
}

// ── Aprobación, pre-aprobación y pago ─────────────────────────────────────────
// Circuito de Enjoy (Male, nov 2026): BORRADOR → PRE_APROBADA (Male arma el
// pedido de transferencias y se lo manda a Matías) → APROBADA (Matías aprueba;
// se genera el egreso del evento) → PAGADA (May sube el comprobante; sale de
// la cuenta elegida como gasto en Caja). DOS57 puede aprobar directo desde
// BORRADOR, como hasta ahora.

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

class ErrorLiquidacion extends Error {
  constructor(public status: number, message: string) { super(message); }
}

function responderError(res: Response, err: unknown): boolean {
  if (err instanceof ErrorLiquidacion) { res.status(err.status).json({ error: err.message }); return true; }
  return false;
}

async function aprobarEnTx(tx: Tx, id: number, empresaId: number, userId: number, ip?: string) {
  const liquidacion = await tx.liquidacion.findFirst({
    where:   { id, ...withTenant(empresaId) },
    include: { empleado: true },
  });
  if (!liquidacion) throw new ErrorLiquidacion(404, 'Liquidación no encontrada');
  if (liquidacion.estado !== EstadoLiquidacion.BORRADOR && liquidacion.estado !== EstadoLiquidacion.PRE_APROBADA) {
    throw new ErrorLiquidacion(400, `La liquidación de ${liquidacion.empleado.apellido} está ${liquidacion.estado.toLowerCase()}: no se puede aprobar`);
  }

  let movimientoId: number | null = null;
  if (liquidacion.evento_id) {
    const tabNumero = await getOrCreateTabRRHH(empresaId, tx);
    const rubroId   = await getOrCreateRubroRRHH(empresaId, tx);
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
        // Aprobada todavía no es pagada: pasa a PAGADO al registrar el pago.
        estado_movimiento: 'CONFIRMADO',
        fecha:       liquidacion.fecha_pago ?? new Date(),
        concepto:    `Liquidación ${liquidacion.empleado.apellido}, ${liquidacion.empleado.nombre}`,
        descripcion: `Período ${liquidacion.fecha_desde.toISOString().slice(0, 10)} a ${liquidacion.fecha_hasta.toISOString().slice(0, 10)}`,
        // Convención de Movimiento: EGRESO → DEBE (haber = 0). Ver comentario en facturas.controller.
        debe:        liquidacion.total_a_cobrar,
        orden:       (lastOrder?.orden ?? 0) + 1,
        saldo:       0,
        created_by:  userId,
        updated_by:  userId,
      },
    });
    movimientoId = mov.id;
    await recalcularSaldosRubro(liquidacion.evento_id, Tipo.EGRESO, rubroId, tx as any);
  }

  // Anticipos no descontados de este empleado → aplicados a esta liquidación
  await tx.anticipo.updateMany({
    where: { empleado_id: liquidacion.empleado_id, descontado: false },
    data:  { descontado: true, liquidacion_id: id },
  });

  const updated = await tx.liquidacion.update({
    where: { id },
    data: {
      estado:        EstadoLiquidacion.APROBADA,
      movimiento_id: movimientoId,
      aprobado_por:  userId,
      aprobado_at:   new Date(),
    },
  });

  await registrarAuditoria({
    usuarioId:    userId,
    empresaId,
    accion:       'APROBAR',
    entidad:      'Liquidacion',
    entidadId:    id,
    eventoId:     liquidacion.evento_id ?? undefined,
    descripcion:  `Aprobó liquidación de ${liquidacion.empleado.apellido}, ${liquidacion.empleado.nombre} por $${Number(liquidacion.total_a_cobrar)}`,
    datosDespues: { movimientoId, total_a_cobrar: Number(liquidacion.total_a_cobrar) },
    ip,
    tx:           tx as any,
  });
  return updated;
}

export async function aprobarLiquidacion(req: Request, res: Response) {
  const id = Number(req.params.id);
  try {
    const result = await prisma.$transaction(tx => aprobarEnTx(tx, id, req.empresaId!, req.user!.id, req.ip));
    res.json(mapDecimalsLiquidacion(result));
  } catch (err) {
    if (!responderError(res, err)) throw err;
  }
}

const idsSchema = z.object({ ids: z.array(z.number().int().positive()).min(1) });

// PATCH /rrhh/liquidaciones/aprobar-lote — todo o nada.
export async function aprobarLiquidacionesLote(req: Request, res: Response) {
  const parsed = idsSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Elegí al menos una liquidación' }); return; }
  try {
    const result = await prisma.$transaction(async tx => {
      const out = [];
      for (const id of parsed.data.ids) out.push(await aprobarEnTx(tx, id, req.empresaId!, req.user!.id, req.ip));
      return out;
    }, { timeout: 60_000 });
    res.json({ aprobadas: result.length });
  } catch (err) {
    if (!responderError(res, err)) throw err;
  }
}

// PATCH /rrhh/liquidaciones/pre-aprobar — Male mandó el pedido a Matías.
export async function preAprobarLiquidaciones(req: Request, res: Response) {
  const parsed = idsSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Elegí al menos una liquidación' }); return; }
  const r = await prisma.liquidacion.updateMany({
    where: { id: { in: parsed.data.ids }, ...withTenant(req.empresaId!), estado: EstadoLiquidacion.BORRADOR },
    data:  { estado: EstadoLiquidacion.PRE_APROBADA, pre_aprobado_por: req.user!.id, pre_aprobado_at: new Date() },
  });
  await registrarAuditoria({
    usuarioId:    req.user!.id,
    empresaId:    req.empresaId,
    accion:       'UPDATE',
    entidad:      'Liquidacion',
    descripcion:  `Pre-aprobó ${r.count} liquidación(es) (pedido de transferencias enviado)`,
    datosDespues: { ids: parsed.data.ids },
    ip:           req.ip,
    tx:           prisma as any,
  });
  res.json({ pre_aprobadas: r.count });
}

// PATCH /rrhh/liquidaciones/:id/volver-borrador — Matías pidió un cambio.
export async function volverBorradorLiquidacion(req: Request, res: Response) {
  const id = Number(req.params.id);
  const liq = await prisma.liquidacion.findFirst({ where: { id, ...withTenant(req.empresaId!) } });
  if (!liq) { res.status(404).json({ error: 'Liquidación no encontrada' }); return; }
  if (liq.estado !== EstadoLiquidacion.PRE_APROBADA) {
    res.status(400).json({ error: 'Solo una liquidación pre-aprobada puede volver a borrador' }); return;
  }
  const updated = await prisma.liquidacion.update({
    where: { id },
    data:  { estado: EstadoLiquidacion.BORRADOR, pre_aprobado_por: null, pre_aprobado_at: null },
  });
  res.json(mapDecimalsLiquidacion(updated));
}

const fechaPagoSchema = z.object({
  ids:        z.array(z.number().int().positive()).min(1),
  fecha_pago: z.string().min(10),
});

// PATCH /rrhh/liquidaciones/fecha-pago — cambiar el día de pago (una o varias).
export async function cambiarFechaPagoLiquidaciones(req: Request, res: Response) {
  const parsed = fechaPagoSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Datos inválidos' }); return; }
  const r = await prisma.liquidacion.updateMany({
    where: { id: { in: parsed.data.ids }, ...withTenant(req.empresaId!), estado: { notIn: [EstadoLiquidacion.PAGADA, EstadoLiquidacion.CANCELADA] } },
    data:  { fecha_pago: fechaCalendario(parsed.data.fecha_pago) },
  });
  res.json({ actualizadas: r.count });
}

const pagoSchema = z.object({
  ids:       z.array(z.coerce.number().int().positive()).min(1),
  cuenta_id: z.coerce.number().int().positive(),
  fecha:     z.string().min(10),
});

// POST /rrhh/liquidaciones/pagar — registra el pago: una salida (gasto) por
// liquidación en la cuenta elegida, con el comprobante si se subió uno (solo
// cuando se paga una sola). Las BORRADOR/PRE_APROBADA se aprueban en el mismo
// paso: el comprobante de May es la confirmación de que Matías aprobó.
export async function pagarLiquidaciones(req: Request, res: Response) {
  const body = { ...req.body, ids: typeof req.body.ids === 'string' ? JSON.parse(req.body.ids) : req.body.ids };
  const parsed = pagoSchema.safeParse(body);
  if (!parsed.success) { res.status(400).json({ error: 'Elegí la cuenta, la fecha y al menos una liquidación' }); return; }
  const { ids, cuenta_id, fecha } = parsed.data;
  if (req.file && ids.length > 1) { res.status(400).json({ error: 'El comprobante se sube de a una liquidación' }); return; }

  const cuenta = await prisma.cuentaBancaria.findFirst({ where: { id: cuenta_id, deleted_at: null, empresa_id: req.empresaId! } });
  if (!cuenta) { res.status(400).json({ error: 'La cuenta no es de esta empresa' }); return; }

  try {
    const pagadas = await prisma.$transaction(async tx => {
      let n = 0;
      for (const id of ids) {
        let liq = await tx.liquidacion.findFirst({ where: { id, ...withTenant(req.empresaId!) }, include: { empleado: true } });
        if (!liq) throw new ErrorLiquidacion(404, 'Liquidación no encontrada');
        if (liq.estado === EstadoLiquidacion.PAGADA || liq.estado === EstadoLiquidacion.CANCELADA) {
          throw new ErrorLiquidacion(400, `La liquidación de ${liq.empleado.apellido} ya está ${liq.estado.toLowerCase()}`);
        }
        if (liq.estado !== EstadoLiquidacion.APROBADA) {
          await aprobarEnTx(tx, id, req.empresaId!, req.user!.id, req.ip);
          liq = (await tx.liquidacion.findFirst({ where: { id }, include: { empleado: true } }))!;
        }

        const last = await tx.movimientoCaja.findFirst({ where: { cuenta_id, deleted_at: null }, orderBy: { orden: 'desc' }, select: { orden: true } });
        await tx.movimientoCaja.create({
          data: {
            cuenta_id,
            evento_id:      liq.evento_id,
            fecha:          fechaCalendario(fecha),
            descripcion:    `Liquidación ${liq.empleado.apellido}, ${liq.empleado.nombre} (${liq.fecha_desde.toISOString().slice(0, 10)} a ${liq.fecha_hasta.toISOString().slice(0, 10)})`,
            // Cajas: el gasto va al HABER.
            debe:           0,
            haber:          liq.total_a_cobrar,
            orden:          (last?.orden ?? 0) + 1,
            liquidacion_id: id,
            ...(req.file && { comprobante_data: req.file.buffer, comprobante_nombre: req.file.originalname, comprobante_mime: req.file.mimetype }),
            created_by:     req.user!.id,
            updated_by:     req.user!.id,
          },
        });
        if (liq.movimiento_id) {
          await tx.movimiento.update({ where: { id: liq.movimiento_id }, data: { estado_movimiento: 'PAGADO', updated_by: req.user!.id } });
        }
        await tx.liquidacion.update({
          where: { id },
          data:  { estado: EstadoLiquidacion.PAGADA, pagado_por: req.user!.id, pagado_at: new Date() },
        });
        await registrarAuditoria({
          usuarioId:   req.user!.id,
          empresaId:   req.empresaId,
          accion:      'UPDATE',
          entidad:     'Liquidacion',
          entidadId:   id,
          descripcion: `Registró el pago de la liquidación de ${liq.empleado.apellido}, ${liq.empleado.nombre} desde ${cuenta.nombre}${req.file ? ' con comprobante' : ''}`,
          ip:          req.ip,
          tx:          tx as any,
        });
        n++;
      }
      await recalcularSaldosCaja(cuenta_id, tx as any);
      return n;
    }, { timeout: 60_000 });
    res.json({ pagadas });
  } catch (err) {
    if (!responderError(res, err)) throw err;
  }
}

// POST /rrhh/liquidaciones/:id/comprobante — subir el comprobante después de pagar.
export async function subirComprobanteLiquidacion(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (!req.file) { res.status(400).json({ error: 'Falta el archivo' }); return; }
  const mov = await prisma.movimientoCaja.findFirst({ where: { liquidacion_id: id, deleted_at: null, liquidacion: withTenant(req.empresaId!) } });
  if (!mov) { res.status(404).json({ error: 'La liquidación todavía no tiene un pago registrado' }); return; }
  await prisma.movimientoCaja.update({
    where: { id: mov.id },
    data:  { comprobante_data: req.file.buffer, comprobante_nombre: req.file.originalname, comprobante_mime: req.file.mimetype, updated_by: req.user!.id },
  });
  res.json({ ok: true });
}

// GET /rrhh/liquidaciones/:id/comprobante
export async function descargarComprobanteLiquidacion(req: Request, res: Response) {
  const id = Number(req.params.id);
  const mov = await prisma.movimientoCaja.findFirst({ where: { liquidacion_id: id, deleted_at: null, liquidacion: withTenant(req.empresaId!) } });
  if (!mov?.comprobante_data) { res.status(404).json({ error: 'Comprobante no encontrado' }); return; }
  const buffer = Buffer.from(mov.comprobante_data);
  res.setHeader('Content-Type',        mov.comprobante_mime ?? 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(mov.comprobante_nombre ?? 'comprobante')}"`);
  res.setHeader('Content-Length',      buffer.length);
  res.end(buffer);
}

const pendientesSchema = z.object({
  hasta:      z.string().min(10),
  fecha_pago: z.string().min(10).optional(),
  dry_run:    z.boolean().optional(),
});

// POST /rrhh/liquidaciones/generar-pendientes — una liquidación por persona
// con las jornadas aprobadas que todavía no se liquidaron, hasta `hasta`. Cada
// una arranca el día siguiente a la última liquidación no cancelada de esa
// persona (o en su primera jornada aprobada), así nunca se paga dos veces.
export async function generarLiquidacionesPendientes(req: Request, res: Response) {
  const parsed = pendientesSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Falta la fecha hasta' }); return; }
  const hasta = fechaCalendario(parsed.data.hasta);
  const fechaPago = parsed.data.fecha_pago ? fechaCalendario(parsed.data.fecha_pago) : proximoViernes();

  const empleados = await prisma.empleado.findMany({
    where:   { deleted_at: null, ...withTenant(req.empresaId!), jornadas: { some: { estado: EstadoJornada.APROBADA, deleted_at: null, fecha: { lte: hasta } } } },
    orderBy: { apellido: 'asc' },
  });

  const propuestas = [];
  for (const e of empleados) {
    const ultima = await prisma.liquidacion.findFirst({
      where:   { empleado_id: e.id, estado: { not: EstadoLiquidacion.CANCELADA } },
      orderBy: { fecha_hasta: 'desc' },
      select:  { fecha_hasta: true },
    });
    let desde: Date;
    if (ultima) {
      desde = new Date(ultima.fecha_hasta);
      desde.setUTCDate(desde.getUTCDate() + 1);
    } else {
      const primera = await prisma.jornada.findFirst({
        where: { empleado_id: e.id, estado: EstadoJornada.APROBADA, deleted_at: null }, orderBy: { fecha: 'asc' }, select: { fecha: true },
      });
      if (!primera) continue;
      desde = primera.fecha;
    }
    if (desde > hasta) continue;

    const calc = await calcularDesglosePeriodo(e.id, desde, hasta, req.empresaId!);
    if (!calc || calc.desglose.length === 0) continue;
    const anticipos = await prisma.anticipo.findMany({ where: { empleado_id: e.id, descontado: false } });
    const totalAnticipos = round2(anticipos.reduce((s, a) => s + Number(a.monto), 0));
    propuestas.push({
      empleado_id:     e.id,
      empleado_nombre: `${e.apellido}, ${e.nombre}`,
      fecha_desde:     desde,
      fecha_hasta:     hasta,
      jornadas:        calc.desglose.length,
      horas_normales:  calc.horasNormales,
      horas_extras:    calc.horasExtras,
      subtotal_horas:  calc.subtotal,
      total_anticipos: totalAnticipos,
      total_a_cobrar:  round2(calc.subtotal - totalAnticipos),
      sin_valor_hora:  e.tipo_liquidacion === 'LINEAL' && Number(e.valor_hora) === 0,
      empleado:        e,
    });
  }

  const salida = propuestas.map(({ empleado: _e, ...p }) => ({
    ...p, fecha_desde: p.fecha_desde.toISOString().slice(0, 10), fecha_hasta: p.fecha_hasta.toISOString().slice(0, 10),
  }));
  if (parsed.data.dry_run) {
    res.json({ preview: true, fecha_pago: fechaPago.toISOString().slice(0, 10), liquidaciones: salida });
    return;
  }

  let creadas = 0;
  for (const p of propuestas) {
    await prisma.liquidacion.create({
      data: {
        empleado_id:      p.empleado_id,
        ...withTenant(req.empresaId!),
        fecha_desde:      p.fecha_desde,
        fecha_hasta:      p.fecha_hasta,
        fecha_pago:       fechaPago,
        tipo_liquidacion: p.empleado.tipo_liquidacion,
        horas_normales:   p.horas_normales,
        horas_extras:     p.horas_extras,
        valor_hora:       Number(p.empleado.valor_hora),
        valor_hora_extra: Number(p.empleado.valor_hora_extra),
        subtotal_horas:   p.subtotal_horas,
        total_anticipos:  p.total_anticipos,
        total_descuentos: 0,
        total_a_cobrar:   p.total_a_cobrar,
        estado:           EstadoLiquidacion.BORRADOR,
      },
    });
    creadas++;
  }
  await registrarAuditoria({
    usuarioId:   req.user!.id,
    empresaId:   req.empresaId,
    accion:      'CREATE',
    entidad:     'Liquidacion',
    descripcion: `Generó ${creadas} liquidación(es) pendientes hasta ${parsed.data.hasta}, a pagar el ${fechaPago.toISOString().slice(0, 10)}`,
    ip:          req.ip,
    tx:          prisma as any,
  });
  res.json({ preview: false, creadas, fecha_pago: fechaPago.toISOString().slice(0, 10), liquidaciones: salida });
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

  const updated = await prisma.$transaction(async tx => {
    // Aprobada: se da de baja el egreso del evento y los anticipos vuelven a
    // quedar pendientes, para que entren en la próxima liquidación.
    if (liquidacion.estado === EstadoLiquidacion.APROBADA) {
      if (liquidacion.movimiento_id) {
        const mov = await tx.movimiento.update({ where: { id: liquidacion.movimiento_id }, data: { deleted_at: new Date(), updated_by: req.user!.id } });
        if (mov.rubro_id) await recalcularSaldosRubro(mov.evento_id, Tipo.EGRESO, mov.rubro_id, tx as any);
      }
      await tx.anticipo.updateMany({ where: { liquidacion_id: id }, data: { descontado: false, liquidacion_id: null } });
    }
    const u = await tx.liquidacion.update({ where: { id }, data: { estado: EstadoLiquidacion.CANCELADA } });
    await registrarAuditoria({
      usuarioId:   req.user!.id,
      empresaId:   req.empresaId,
      accion:      'UPDATE',
      entidad:     'Liquidacion',
      entidadId:   id,
      descripcion: `Canceló la liquidación #${id} (estaba ${liquidacion.estado.toLowerCase()})`,
      ip:          req.ip,
      tx:          tx as any,
    });
    return u;
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
