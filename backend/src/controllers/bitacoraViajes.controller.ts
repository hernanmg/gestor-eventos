import type { Request, Response } from 'express';
import { z } from 'zod';
import { TipoRecorrido, EstadoLiquidacionAdmin } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { withTenant } from '../lib/tenant';
import { registrarAuditoria } from '../lib/auditoria';

// ── Helpers ───────────────────────────────────────────────────────────────────

const EMPLEADO_SELECT = { id: true, nombre: true, apellido: true, categoria: true } as const;

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

// Fechas de negocio en UTC — mismo criterio que el resto del sistema
// (afipPrestamos.controller.ts, calendario.controller.ts): nunca componentes
// locales, para no correr un día por el offset de zona horaria.
export function parseFechaUTC(s: string): Date {
  const soloFecha = s.slice(0, 10);
  return new Date(`${soloFecha}T00:00:00.000Z`);
}

export function calcularDiaSemana(fecha: Date): string {
  return DIAS_SEMANA[fecha.getUTCDay()];
}

// "HH:MM" (string, no DateTime — a diferencia de Jornada.hora_ingreso/egreso)
// -> horas trabajadas en decimal. Si cruza medianoche (fin < inicio) asume
// que terminó al día siguiente.
export function calcularHorasTrabajadas(horaInicio: string | null | undefined, horaFin: string | null | undefined): number | null {
  if (!horaInicio || !horaFin) return null;
  const mIni = horaInicio.match(/^(\d{1,2}):(\d{2})/);
  const mFin = horaFin.match(/^(\d{1,2}):(\d{2})/);
  if (!mIni || !mFin) return null;
  const minutosIni = Number(mIni[1]) * 60 + Number(mIni[2]);
  const minutosFin = Number(mFin[1]) * 60 + Number(mFin[2]);
  let diff = minutosFin - minutosIni;
  if (diff < 0) diff += 24 * 60;
  return round2(diff / 60);
}

export type AcuerdoViaticos = { viatico_provincial: unknown; viatico_nacional: unknown; viatico_nacional_1000: unknown } | null;

export function resolverValorPorVuelta(acuerdo: AcuerdoViaticos, tipo: TipoRecorrido): number | null {
  if (!acuerdo) return null;
  const valor =
    tipo === TipoRecorrido.PROVINCIAL    ? acuerdo.viatico_provincial :
    tipo === TipoRecorrido.NACIONAL      ? acuerdo.viatico_nacional :
    /* NACIONAL_1000 */                    acuerdo.viatico_nacional_1000;
  return valor !== null && valor !== undefined ? Number(valor) : null;
}

function mapDecimalsBitacora(b: any) {
  return {
    ...b,
    horas_trabajadas:  b.horas_trabajadas  !== null ? Number(b.horas_trabajadas)  : null,
    valor_por_vuelta:  b.valor_por_vuelta  !== null ? Number(b.valor_por_vuelta)  : null,
    viatico_calculado: b.viatico_calculado !== null ? Number(b.viatico_calculado) : null,
  };
}

// Liquidaciones en estos estados ya movieron plata / se pagaron — los
// registros de bitácora vinculados a ellas quedan congelados (mismo criterio
// que updateAcuerdo/deleteAcuerdo con APROBADA/PAGADA).
export const ESTADOS_BLOQUEAN_EDICION: EstadoLiquidacionAdmin[] = [EstadoLiquidacionAdmin.APROBADA, EstadoLiquidacionAdmin.PAGADA];

function rangoPeriodo(mes: number | undefined, anio: number): { gte: Date; lt: Date } {
  if (mes) return { gte: new Date(Date.UTC(anio, mes - 1, 1)), lt: new Date(Date.UTC(anio, mes, 1)) };
  return { gte: new Date(Date.UTC(anio, 0, 1)), lt: new Date(Date.UTC(anio + 1, 0, 1)) };
}

// ── Listados ──────────────────────────────────────────────────────────────────

export async function listBitacoraViajes(req: Request, res: Response) {
  const { empleado_id, mes, anio, tipo_recorrido } = req.query;
  const where: any = { deleted_at: null, ...withTenant(req.empresaId!) };
  if (empleado_id)    where.empleado_id    = Number(empleado_id);
  if (tipo_recorrido) where.tipo_recorrido = tipo_recorrido;
  if (mes || anio)     where.fecha         = rangoPeriodo(mes ? Number(mes) : undefined, anio ? Number(anio) : new Date().getFullYear());

  const registros = await prisma.bitacoraViaje.findMany({
    where,
    include: { empleado: { select: EMPLEADO_SELECT } },
    orderBy: { fecha: 'asc' },
  });
  res.json(registros.map(mapDecimalsBitacora));
}

export async function listBitacoraViajesEmpleado(req: Request, res: Response) {
  const empleadoId = Number(req.params.id);
  const { mes, anio } = req.query;

  const empleado = await prisma.empleado.findFirst({ where: { id: empleadoId, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!empleado) { res.status(404).json({ error: 'Empleado no encontrado' }); return; }

  const where: any = { empleado_id: empleadoId, deleted_at: null };
  if (mes || anio) where.fecha = rangoPeriodo(mes ? Number(mes) : undefined, anio ? Number(anio) : new Date().getFullYear());

  const registros = await prisma.bitacoraViaje.findMany({ where, orderBy: { fecha: 'asc' } });
  res.json(registros.map(mapDecimalsBitacora));
}

// ── Crear / Editar / Eliminar ─────────────────────────────────────────────────

const bitacoraCreateSchema = z.object({
  empleado_id:      z.number().int().positive(),
  fecha:            z.string().min(1),
  convocatoria:     z.string().nullable().optional(),
  hora_inicio:      z.string().nullable().optional(),
  hora_fin:         z.string().nullable().optional(),
  ejido:            z.string().nullable().optional(),
  recorrido:        z.string().nullable().optional(),
  tipo_recorrido:   z.nativeEnum(TipoRecorrido),
  cantidad_vueltas: z.number().int().positive().default(1),
  observaciones:    z.string().nullable().optional(),
});

export async function createBitacoraViaje(req: Request, res: Response) {
  const parsed = bitacoraCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return;
  }
  const d = parsed.data;

  const empleado = await prisma.empleado.findFirst({ where: { id: d.empleado_id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!empleado) { res.status(404).json({ error: 'Empleado no encontrado' }); return; }

  const acuerdo = await prisma.acuerdoSueldo.findFirst({ where: { empleado_id: d.empleado_id, activo: true, deleted_at: null } });
  const valorPorVuelta   = resolverValorPorVuelta(acuerdo, d.tipo_recorrido);
  const viaticoCalculado = valorPorVuelta !== null ? round2(valorPorVuelta * d.cantidad_vueltas) : null;
  const fecha            = parseFechaUTC(d.fecha);

  const registro = await prisma.bitacoraViaje.create({
    data: {
      empleado_id:       d.empleado_id,
      empresa_id:        req.empresaId!,
      fecha,
      convocatoria:      d.convocatoria ?? null,
      dia_semana:        calcularDiaSemana(fecha),
      hora_inicio:       d.hora_inicio ?? null,
      hora_fin:          d.hora_fin ?? null,
      horas_trabajadas:  calcularHorasTrabajadas(d.hora_inicio, d.hora_fin),
      ejido:             d.ejido ?? null,
      recorrido:         d.recorrido ?? null,
      tipo_recorrido:    d.tipo_recorrido,
      cantidad_vueltas:  d.cantidad_vueltas,
      valor_por_vuelta:  valorPorVuelta,
      viatico_calculado: viaticoCalculado,
      observaciones:     d.observaciones ?? null,
      created_by:        req.user!.id,
    },
    include: { empleado: { select: EMPLEADO_SELECT } },
  });

  await registrarAuditoria({
    usuarioId:    req.user!.id,
    empresaId:    req.empresaId,
    accion:       'CREATE',
    entidad:      'BitacoraViaje',
    entidadId:    registro.id,
    descripcion:  `Registró viaje de ${empleado.apellido}, ${empleado.nombre} — ${d.tipo_recorrido} x${d.cantidad_vueltas}`,
    datosDespues: { tipo_recorrido: d.tipo_recorrido, cantidad_vueltas: d.cantidad_vueltas, viatico_calculado: viaticoCalculado },
    ip:           req.ip,
    tx:           prisma as any,
  });

  res.status(201).json(mapDecimalsBitacora(registro));
}

const bitacoraUpdateSchema = bitacoraCreateSchema.omit({ empleado_id: true }).partial();

export async function updateBitacoraViaje(req: Request, res: Response) {
  const id = Number(req.params.id);
  const parsed = bitacoraUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return;
  }
  const d = parsed.data;

  const existing = await prisma.bitacoraViaje.findFirst({
    where:   { id, deleted_at: null, ...withTenant(req.empresaId!) },
    include: { liquidacion_admin: { select: { estado: true } } },
  });
  if (!existing) { res.status(404).json({ error: 'Registro no encontrado' }); return; }
  if (existing.liquidacion_admin && ESTADOS_BLOQUEAN_EDICION.includes(existing.liquidacion_admin.estado)) {
    res.status(400).json({ error: 'No se puede editar: ya está incluido en una liquidación aprobada' }); return;
  }

  const tipoFinal    = d.tipo_recorrido   ?? existing.tipo_recorrido;
  const vueltasFinal = d.cantidad_vueltas ?? existing.cantidad_vueltas;
  const acuerdo = await prisma.acuerdoSueldo.findFirst({ where: { empleado_id: existing.empleado_id, activo: true, deleted_at: null } });
  const valorPorVuelta   = resolverValorPorVuelta(acuerdo, tipoFinal);
  const viaticoCalculado = valorPorVuelta !== null ? round2(valorPorVuelta * vueltasFinal) : null;

  const fecha           = d.fecha        !== undefined ? parseFechaUTC(d.fecha) : existing.fecha;
  const horaInicioFinal  = d.hora_inicio  !== undefined ? d.hora_inicio  : existing.hora_inicio;
  const horaFinFinal     = d.hora_fin     !== undefined ? d.hora_fin     : existing.hora_fin;

  const updated = await prisma.bitacoraViaje.update({
    where: { id },
    data: {
      fecha,
      dia_semana:        calcularDiaSemana(fecha),
      ...(d.convocatoria   !== undefined && { convocatoria: d.convocatoria }),
      ...(d.hora_inicio    !== undefined && { hora_inicio: d.hora_inicio }),
      ...(d.hora_fin       !== undefined && { hora_fin: d.hora_fin }),
      horas_trabajadas:  calcularHorasTrabajadas(horaInicioFinal, horaFinFinal),
      ...(d.ejido          !== undefined && { ejido: d.ejido }),
      ...(d.recorrido      !== undefined && { recorrido: d.recorrido }),
      tipo_recorrido:     tipoFinal,
      cantidad_vueltas:   vueltasFinal,
      valor_por_vuelta:   valorPorVuelta,
      viatico_calculado:  viaticoCalculado,
      ...(d.observaciones  !== undefined && { observaciones: d.observaciones }),
    },
    include: { empleado: { select: EMPLEADO_SELECT } },
  });

  await registrarAuditoria({
    usuarioId:    req.user!.id,
    empresaId:    req.empresaId,
    accion:       'UPDATE',
    entidad:      'BitacoraViaje',
    entidadId:    id,
    descripcion:  `Editó registro de bitácora #${id}`,
    datosDespues: d,
    ip:           req.ip,
    tx:           prisma as any,
  });

  res.json(mapDecimalsBitacora(updated));
}

export async function deleteBitacoraViaje(req: Request, res: Response) {
  const id = Number(req.params.id);
  const existing = await prisma.bitacoraViaje.findFirst({
    where:   { id, deleted_at: null, ...withTenant(req.empresaId!) },
    include: { liquidacion_admin: { select: { estado: true } } },
  });
  if (!existing) { res.status(404).json({ error: 'Registro no encontrado' }); return; }
  if (existing.liquidacion_admin && ESTADOS_BLOQUEAN_EDICION.includes(existing.liquidacion_admin.estado)) {
    res.status(400).json({ error: 'No se puede eliminar: ya está incluido en una liquidación aprobada' }); return;
  }

  await prisma.bitacoraViaje.update({ where: { id }, data: { deleted_at: new Date() } });

  await registrarAuditoria({
    usuarioId:   req.user!.id,
    empresaId:   req.empresaId,
    accion:      'DELETE',
    entidad:     'BitacoraViaje',
    entidadId:   id,
    descripcion: `Eliminó registro de bitácora #${id}`,
    ip:          req.ip,
    tx:          prisma as any,
  });

  res.json({ message: 'Registro eliminado correctamente' });
}

// ── Resumen mensual ───────────────────────────────────────────────────────────

export interface ResumenBitacora {
  mes:  number;
  anio: number;
  total_vueltas: { provincial: number; nacional: number; nacional_1000: number };
  total_horas:   number;
  total_viatico: number;
  registros:     ReturnType<typeof mapDecimalsBitacora>[];
}

const TIPO_KEY: Record<TipoRecorrido, 'provincial' | 'nacional' | 'nacional_1000'> = {
  PROVINCIAL:    'provincial',
  NACIONAL:      'nacional',
  NACIONAL_1000: 'nacional_1000',
};

// Reutilizado por getResumenBitacoraEmpleado (HTTP) y por
// generarLiquidacionAdmin (sueldosAdmin.controller.ts) para incluir
// bitacora_resumen en la respuesta de generar.
export async function calcularResumenBitacora(empleadoId: number, mes: number, anio: number): Promise<ResumenBitacora> {
  const registros = await prisma.bitacoraViaje.findMany({
    where:   { empleado_id: empleadoId, deleted_at: null, fecha: rangoPeriodo(mes, anio) },
    orderBy: { fecha: 'asc' },
  });

  const totalVueltas = { provincial: 0, nacional: 0, nacional_1000: 0 };
  let totalHoras   = 0;
  let totalViatico = 0;
  for (const r of registros) {
    totalVueltas[TIPO_KEY[r.tipo_recorrido]] += r.cantidad_vueltas;
    totalHoras   += r.horas_trabajadas  !== null ? Number(r.horas_trabajadas)  : 0;
    totalViatico += r.viatico_calculado !== null ? Number(r.viatico_calculado) : 0;
  }

  return {
    mes, anio,
    total_vueltas: totalVueltas,
    total_horas:   round2(totalHoras),
    total_viatico: round2(totalViatico),
    registros:     registros.map(mapDecimalsBitacora),
  };
}

const resumenQuerySchema = z.object({
  mes:  z.coerce.number().int().min(1).max(12),
  anio: z.coerce.number().int().min(2000).max(2100),
});

export async function getResumenBitacoraEmpleado(req: Request, res: Response) {
  const empleadoId = Number(req.params.id);
  const parsed = resumenQuerySchema.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: 'Se requieren mes y anio' }); return; }
  const { mes, anio } = parsed.data;

  const empleado = await prisma.empleado.findFirst({ where: { id: empleadoId, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!empleado) { res.status(404).json({ error: 'Empleado no encontrado' }); return; }

  res.json(await calcularResumenBitacora(empleadoId, mes, anio));
}
