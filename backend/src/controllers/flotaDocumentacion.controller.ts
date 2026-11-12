import type { Request, Response } from 'express';
import { z } from 'zod';
import { Prisma, EstadoSeguro } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { withTenant } from '../lib/tenant';
import { registrarAuditoria } from '../lib/auditoria';
import { estadoVencimiento, hoyUTC, parseFechaCalendario, requiereTecnica, diasHasta } from '../lib/vencimientos';

// ── Documentación de flota (Lorena, DOS57) ───────────────────────────────────
// Carnets de conducir de los empleados y control de salida de vehículos. Todo
// OPERADOR: Lorena es OPERADOR y RRHH (/rrhh/empleados) es sólo ADMIN, así que
// los carnets se editan desde acá y no desde el legajo.

const fmt = (d: Date) => d.toLocaleDateString('es-AR', { timeZone: 'UTC' });

// ═══════════════════════════════════════════════════════════════════════════
// CARNETS DE CONDUCIR
// ═══════════════════════════════════════════════════════════════════════════

type EstadoCarnet = 'VIGENTE' | 'POR_VENCER' | 'VENCIDO' | 'SIN_VENCIMIENTO' | 'SIN_CARNET';

function estadoCarnet(e: { licencia_conducir: boolean; licencia_vencimiento: Date | null }, referencia = hoyUTC()): EstadoCarnet {
  if (!e.licencia_conducir && !e.licencia_vencimiento) return 'SIN_CARNET';
  return estadoVencimiento(e.licencia_vencimiento, referencia) ?? 'SIN_VENCIMIENTO';
}

const CARNET_SELECT = {
  id: true, nombre: true, apellido: true, apodo: true, categoria: true,
  licencia_conducir: true, licencia_categoria: true, licencia_numero: true, licencia_vencimiento: true,
} as const;

// GET /api/flota/carnets — empleados activos con su carnet
export async function listCarnets(req: Request, res: Response) {
  const empleados = await prisma.empleado.findMany({
    where:   { deleted_at: null, estado: 'ACTIVO', ...withTenant(req.empresaId!) },
    select:  CARNET_SELECT,
    orderBy: [{ licencia_conducir: 'desc' }, { apellido: 'asc' }],
  });
  res.json(empleados.map(e => ({ ...e, estado_carnet: estadoCarnet(e) })));
}

const carnetSchema = z.object({
  licencia_conducir:    z.boolean(),
  licencia_categoria:   z.string().nullable().optional(),
  licencia_numero:      z.string().nullable().optional(),
  licencia_vencimiento: z.string().nullable().optional(), // YYYY-MM-DD
});

// PUT /api/flota/carnets/:empleadoId
export async function updateCarnet(req: Request, res: Response) {
  const empleadoId = Number(req.params.empleadoId);
  const parsed = carnetSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return; }
  const d = parsed.data;
  const vto = parseFechaCalendario(d.licencia_vencimiento);
  if (vto === undefined) { res.status(400).json({ error: 'Vencimiento inválido' }); return; }

  const existing = await prisma.empleado.findFirst({ where: { id: empleadoId, deleted_at: null, ...withTenant(req.empresaId!) }, select: CARNET_SELECT });
  if (!existing) { res.status(404).json({ error: 'Empleado no encontrado' }); return; }

  const updated = await prisma.empleado.update({
    where:  { id: empleadoId },
    data:   {
      licencia_conducir:    d.licencia_conducir,
      licencia_categoria:   d.licencia_categoria?.trim() || null,
      licencia_numero:      d.licencia_numero?.trim() || null,
      licencia_vencimiento: vto,
    },
    select: CARNET_SELECT,
  });

  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'UPDATE', entidad: 'Empleado', entidadId: empleadoId,
    descripcion: `Actualizó el carnet de conducir de ${existing.apellido}, ${existing.nombre}`,
    datosAntes: existing, datosDespues: d, ip: req.ip, tx: prisma,
  });

  res.json({ ...updated, estado_carnet: estadoCarnet(updated) });
}

// ═══════════════════════════════════════════════════════════════════════════
// CONTROL DE SALIDA DE VEHÍCULOS
// ═══════════════════════════════════════════════════════════════════════════

export type NivelAlerta = 'rojo' | 'amarillo';
export interface AlertaDocumental { tipo: 'BAJA' | 'SEGURO' | 'TECNICA' | 'CARNET' | 'CHOFER'; nivel: NivelAlerta; mensaje: string }

type CamionDoc = Prisma.CamionGetPayload<{ include: { seguros: true } }>;
type ChoferDoc = { nombre: string; apellido: string; licencia_conducir: boolean; licencia_vencimiento: Date | null } | null;

// Estado documental del vehículo y del chofer para una fecha de salida. Rojo =
// no debería salir (de baja, sin seguro, RTO o carnet vencidos); amarillo =
// sale pero hay que mirarlo (vence dentro de 30 días, dato sin cargar).
export function evaluarDocumentacion(camion: CamionDoc, chofer: ChoferDoc, choferNombre: string | null, fecha: Date): AlertaDocumental[] {
  const alertas: AlertaDocumental[] = [];

  if (!camion.en_servicio) {
    alertas.push({ tipo: 'BAJA', nivel: 'rojo', mensaje: `Vehículo dado de baja${camion.motivo_baja ? ` (${camion.motivo_baja})` : ''}` });
  }

  const seguroVigente = camion.seguros
    .filter(s => !s.deleted_at && s.estado !== EstadoSeguro.CANCELADO && s.fecha_inicio <= fecha && s.fecha_vencimiento >= fecha)
    .sort((a, b) => b.fecha_vencimiento.getTime() - a.fecha_vencimiento.getTime())[0];
  if (!seguroVigente) {
    alertas.push({ tipo: 'SEGURO', nivel: 'rojo', mensaje: 'Sin seguro vigente para la fecha de salida' });
  } else if (estadoVencimiento(seguroVigente.fecha_vencimiento, fecha) === 'POR_VENCER') {
    alertas.push({ tipo: 'SEGURO', nivel: 'amarillo', mensaje: `Seguro ${seguroVigente.aseguradora} vence el ${fmt(seguroVigente.fecha_vencimiento)} (${diasHasta(seguroVigente.fecha_vencimiento, fecha)} días)` });
  }

  if (requiereTecnica(camion)) {
    const tipo = camion.tipo_tecnica ?? 'RTO';
    const est = estadoVencimiento(camion.vencimiento_tecnica, fecha);
    if (!est) alertas.push({ tipo: 'TECNICA', nivel: 'amarillo', mensaje: `${tipo} sin cargar` });
    else if (est === 'VENCIDO') alertas.push({ tipo: 'TECNICA', nivel: 'rojo', mensaje: `${tipo} vencida el ${fmt(camion.vencimiento_tecnica!)}` });
    else if (est === 'POR_VENCER') alertas.push({ tipo: 'TECNICA', nivel: 'amarillo', mensaje: `${tipo} vence el ${fmt(camion.vencimiento_tecnica!)} (${diasHasta(camion.vencimiento_tecnica!, fecha)} días)` });
  }

  if (!chofer) {
    alertas.push({
      tipo: 'CHOFER', nivel: 'amarillo',
      mensaje: choferNombre ? `Chofer "${choferNombre}" no está como empleado — revisá su carnet a mano` : 'Sin chofer asignado',
    });
  } else {
    const nombre = `${chofer.apellido}, ${chofer.nombre}`;
    const est = estadoVencimiento(chofer.licencia_vencimiento, fecha);
    if (!chofer.licencia_conducir && !chofer.licencia_vencimiento) alertas.push({ tipo: 'CARNET', nivel: 'rojo', mensaje: `${nombre} no tiene carnet de conducir cargado` });
    else if (!est) alertas.push({ tipo: 'CARNET', nivel: 'amarillo', mensaje: `Carnet de ${nombre} sin vencimiento cargado` });
    else if (est === 'VENCIDO') alertas.push({ tipo: 'CARNET', nivel: 'rojo', mensaje: `Carnet de ${nombre} vencido el ${fmt(chofer.licencia_vencimiento!)}` });
    else if (est === 'POR_VENCER') alertas.push({ tipo: 'CARNET', nivel: 'amarillo', mensaje: `Carnet de ${nombre} vence el ${fmt(chofer.licencia_vencimiento!)}` });
  }

  return alertas;
}

type Semaforo = 'verde' | 'amarillo' | 'rojo';

function semaforoControl(c: { estado: string; check_tarjeta_verde: boolean; check_seguro: boolean; check_tecnica: boolean; check_carnet: boolean }, alertas: AlertaDocumental[]): Semaforo {
  if (c.estado === 'OBSERVADO' || alertas.some(a => a.nivel === 'rojo')) return 'rojo';
  if (c.estado === 'REVISADO') return 'verde';
  return 'amarillo';
}

const CONTROL_INCLUDE = {
  camion: { include: { seguros: true } },
  chofer: { select: { id: true, nombre: true, apellido: true, apodo: true, licencia_conducir: true, licencia_vencimiento: true } },
  evento: { select: { id: true, nombre: true } },
} as const;

type ControlConRelaciones = Prisma.ControlSalidaVehiculoGetPayload<{ include: typeof CONTROL_INCLUDE }>;

// Pendientes: alertas en vivo (si se renueva un seguro, se ve al toque).
// Cerrados: la foto guardada al revisarlos.
function serializarControl(c: ControlConRelaciones) {
  const alertas = c.estado === 'PENDIENTE' || !c.alertas_al_cerrar
    ? evaluarDocumentacion(c.camion, c.chofer, c.chofer_nombre, c.fecha_salida)
    : (c.alertas_al_cerrar as unknown as AlertaDocumental[]);
  const { seguros: _seguros, ...camion } = c.camion;
  return {
    ...c,
    camion: { id: camion.id, codigo: camion.codigo, patente: camion.patente, descripcion: camion.descripcion, tipo_vehiculo: camion.tipo_vehiculo, en_servicio: camion.en_servicio },
    alertas,
    semaforo: semaforoControl(c, alertas),
  };
}

const listQuerySchema = z.object({
  desde:  z.string().optional(),
  hasta:  z.string().optional(),
  estado: z.enum(['PENDIENTE', 'REVISADO', 'OBSERVADO']).optional(),
  camion_id: z.coerce.number().int().positive().optional(),
});

// GET /api/flota/controles-salida
export async function listControlesSalida(req: Request, res: Response) {
  const q = listQuerySchema.safeParse(req.query);
  if (!q.success) { res.status(400).json({ error: 'Parámetros inválidos' }); return; }
  const desde = parseFechaCalendario(q.data.desde);
  const hasta = parseFechaCalendario(q.data.hasta);
  if (desde === undefined || hasta === undefined) { res.status(400).json({ error: 'Fechas inválidas' }); return; }

  const controles = await prisma.controlSalidaVehiculo.findMany({
    where: {
      deleted_at: null, ...withTenant(req.empresaId!),
      ...((desde || hasta) && { fecha_salida: { ...(desde && { gte: desde }), ...(hasta && { lte: hasta }) } }),
      ...(q.data.estado && { estado: q.data.estado }),
      ...(q.data.camion_id && { camion_id: q.data.camion_id }),
    },
    include: CONTROL_INCLUDE,
    orderBy: [{ fecha_salida: 'desc' }, { id: 'desc' }],
    take: 300,
  });
  res.json(controles.map(serializarControl));
}

// GET /api/flota/controles-salida/sugeridos?fecha=YYYY-MM-DD — vehículos que
// salen ese día según la bitácora de viajes y el parte diario, que todavía no
// tienen control cargado.
export async function sugeridosControlSalida(req: Request, res: Response) {
  const fecha = parseFechaCalendario(typeof req.query.fecha === 'string' ? req.query.fecha : null) ?? hoyUTC();
  const finDia = new Date(fecha.getTime() + 86_399_999);
  const empresaId = req.empresaId!;

  const [viajes, asignaciones, existentes] = await Promise.all([
    prisma.bitacoraViaje.findMany({
      where:   { empresa_id: empresaId, fecha: { gte: fecha, lte: finDia }, camion_id: { not: null } },
      include: { empleado: { select: { id: true, nombre: true, apellido: true } }, evento: { select: { id: true, nombre: true } } },
    }),
    prisma.asignacionDiaria.findMany({
      where:   { empresa_id: empresaId, camion_id: { not: null }, parte_diario: { fecha: { gte: fecha, lte: finDia }, deleted_at: null } },
      include: { empleado: { select: { id: true, nombre: true, apellido: true } }, evento: { select: { id: true, nombre: true } } },
    }),
    prisma.controlSalidaVehiculo.findMany({ where: { empresa_id: empresaId, deleted_at: null, fecha_salida: fecha }, select: { camion_id: true } }),
  ]);

  const yaControlados = new Set(existentes.map(e => e.camion_id));
  const porCamion = new Map<number, { camion_id: number; chofer_id: number | null; chofer_nombre: string | null; evento: { id: number; nombre: string } | null; destino: string | null; origen: string }>();

  for (const v of viajes) {
    if (yaControlados.has(v.camion_id!) || porCamion.has(v.camion_id!)) continue;
    porCamion.set(v.camion_id!, {
      camion_id: v.camion_id!, chofer_id: v.empleado?.id ?? null,
      chofer_nombre: v.empleado ? `${v.empleado.apellido}, ${v.empleado.nombre}` : v.chofer_nombre,
      evento: v.evento, destino: v.recorrido ?? v.convocatoria, origen: 'Bitácora de viajes',
    });
  }
  for (const a of asignaciones) {
    if (yaControlados.has(a.camion_id!) || porCamion.has(a.camion_id!)) continue;
    porCamion.set(a.camion_id!, {
      camion_id: a.camion_id!, chofer_id: a.empleado.id,
      chofer_nombre: `${a.empleado.apellido}, ${a.empleado.nombre}`,
      evento: a.evento, destino: a.lugar, origen: 'Parte diario',
    });
  }

  const camiones = await prisma.camion.findMany({
    where:  { id: { in: [...porCamion.keys()] } },
    select: { id: true, codigo: true, patente: true, descripcion: true },
  });
  const camionPorId = new Map(camiones.map(c => [c.id, c]));
  res.json({
    fecha: fecha.toISOString().slice(0, 10),
    items: [...porCamion.values()].map(s => ({ ...s, camion: camionPorId.get(s.camion_id) ?? null })),
  });
}

// GET /api/flota/controles-salida/opciones — selects del formulario
export async function opcionesControlSalida(req: Request, res: Response) {
  const [vehiculos, empleados, eventos] = await Promise.all([
    prisma.camion.findMany({
      where:   { deleted_at: null, ...withTenant(req.empresaId!) },
      select:  { id: true, codigo: true, patente: true, descripcion: true, en_servicio: true },
      orderBy: { codigo: 'asc' },
    }),
    prisma.empleado.findMany({
      where:   { deleted_at: null, estado: 'ACTIVO', ...withTenant(req.empresaId!) },
      select:  { id: true, nombre: true, apellido: true, apodo: true, licencia_conducir: true },
      orderBy: { apellido: 'asc' },
    }),
    prisma.evento.findMany({
      where:   { deleted_at: null, ...withTenant(req.empresaId!), estado: { not: 'CERRADO' } },
      select:  { id: true, nombre: true, fecha_inicio: true },
      orderBy: { fecha_inicio: 'desc' },
      take:    100,
    }),
  ]);
  res.json({ vehiculos, empleados, eventos });
}

const controlSchema = z.object({
  camion_id:           z.number().int().positive(),
  fecha_salida:        z.string().min(1),
  chofer_id:           z.number().int().positive().nullable().optional(),
  chofer_nombre:       z.string().nullable().optional(),
  evento_id:           z.number().int().positive().nullable().optional(),
  destino:             z.string().nullable().optional(),
  check_tarjeta_verde: z.boolean().optional(),
  check_seguro:        z.boolean().optional(),
  check_tecnica:       z.boolean().optional(),
  check_carnet:        z.boolean().optional(),
  estado:              z.enum(['PENDIENTE', 'REVISADO', 'OBSERVADO']).optional(),
  revisado_por:        z.string().nullable().optional(),
  observaciones:       z.string().nullable().optional(),
});

async function validarRelaciones(empresaId: number, d: { camion_id?: number; chofer_id?: number | null; evento_id?: number | null }): Promise<string | null> {
  if (d.camion_id) {
    const c = await prisma.camion.findFirst({ where: { id: d.camion_id, empresa_id: empresaId, deleted_at: null }, select: { id: true } });
    if (!c) return 'Vehículo no encontrado';
  }
  if (d.chofer_id) {
    const e = await prisma.empleado.findFirst({ where: { id: d.chofer_id, empresa_id: empresaId, deleted_at: null }, select: { id: true } });
    if (!e) return 'Chofer no encontrado';
  }
  if (d.evento_id) {
    const ev = await prisma.evento.findFirst({ where: { id: d.evento_id, empresa_id: empresaId, deleted_at: null }, select: { id: true } });
    if (!ev) return 'Evento no encontrado';
  }
  return null;
}

// Al cerrar el control (REVISADO u OBSERVADO) se guarda la foto de las
// alertas. REVISADO exige los 4 tildes y ninguna alerta roja: si algo está
// vencido o el vehículo está de baja, el control queda OBSERVADO.
function validarCierre(estado: string, c: { check_tarjeta_verde: boolean; check_seguro: boolean; check_tecnica: boolean; check_carnet: boolean; observaciones: string | null }, alertas: AlertaDocumental[]): string | null {
  if (estado === 'REVISADO') {
    const rojas = alertas.filter(a => a.nivel === 'rojo');
    if (rojas.length > 0) return `No se puede dar por revisado: ${rojas.map(a => a.mensaje).join('; ')}. Marcalo como observado.`;
    if (!(c.check_tarjeta_verde && c.check_seguro && c.check_tecnica && c.check_carnet)) return 'Para darlo por revisado tildá los 4 papeles (tarjeta verde, seguro, RTO/ITV y carnet).';
  }
  if (estado === 'OBSERVADO' && !c.observaciones?.trim()) return 'Contá qué se observó antes de marcarlo como observado.';
  return null;
}

// POST /api/flota/controles-salida
export async function createControlSalida(req: Request, res: Response) {
  const parsed = controlSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return; }
  const d = parsed.data;
  const fecha = parseFechaCalendario(d.fecha_salida);
  if (!fecha) { res.status(400).json({ error: 'Fecha de salida inválida' }); return; }

  const errRel = await validarRelaciones(req.empresaId!, d);
  if (errRel) { res.status(400).json({ error: errRel }); return; }

  const duplicado = await prisma.controlSalidaVehiculo.findFirst({
    where: { empresa_id: req.empresaId!, camion_id: d.camion_id, fecha_salida: fecha, deleted_at: null }, select: { id: true },
  });
  if (duplicado) { res.status(400).json({ error: 'Ese vehículo ya tiene un control de salida para esa fecha' }); return; }

  const base = {
    check_tarjeta_verde: d.check_tarjeta_verde ?? false,
    check_seguro:        d.check_seguro ?? false,
    check_tecnica:       d.check_tecnica ?? false,
    check_carnet:        d.check_carnet ?? false,
    observaciones:       d.observaciones ?? null,
  };
  const estado = d.estado ?? 'PENDIENTE';
  let alertasCierre: AlertaDocumental[] | null = null;
  if (estado !== 'PENDIENTE') {
    const camion = await prisma.camion.findUniqueOrThrow({ where: { id: d.camion_id }, include: { seguros: true } });
    const chofer = d.chofer_id ? await prisma.empleado.findUnique({ where: { id: d.chofer_id } }) : null;
    alertasCierre = evaluarDocumentacion(camion, chofer, d.chofer_nombre ?? null, fecha);
    const err = validarCierre(estado, base, alertasCierre);
    if (err) { res.status(400).json({ error: err }); return; }
  }

  const control = await prisma.controlSalidaVehiculo.create({
    data: {
      ...withTenant(req.empresaId!), ...base, estado,
      camion_id: d.camion_id, fecha_salida: fecha,
      chofer_id: d.chofer_id ?? null, chofer_nombre: d.chofer_id ? null : (d.chofer_nombre?.trim() || null),
      evento_id: d.evento_id ?? null, destino: d.destino ?? null,
      revisado_por: d.revisado_por ?? null,
      ...(alertasCierre && { revisado_at: new Date(), alertas_al_cerrar: alertasCierre as unknown as Prisma.InputJsonValue }),
      created_by: req.user!.id,
    },
    include: CONTROL_INCLUDE,
  });

  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'CREATE', entidad: 'ControlSalidaVehiculo', entidadId: control.id,
    descripcion: `Cargó control de salida de ${control.camion.codigo} para el ${fmt(fecha)}`, ip: req.ip, tx: prisma,
  });

  res.status(201).json(serializarControl(control));
}

// PUT /api/flota/controles-salida/:id
export async function updateControlSalida(req: Request, res: Response) {
  const id = Number(req.params.id);
  const parsed = controlSchema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return; }
  const d = parsed.data;

  const existing = await prisma.controlSalidaVehiculo.findFirst({ where: { id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!existing) { res.status(404).json({ error: 'Control no encontrado' }); return; }

  const errRel = await validarRelaciones(req.empresaId!, d);
  if (errRel) { res.status(400).json({ error: errRel }); return; }

  let fecha: Date | undefined;
  if (d.fecha_salida !== undefined) {
    const f = parseFechaCalendario(d.fecha_salida);
    if (!f) { res.status(400).json({ error: 'Fecha de salida inválida' }); return; }
    fecha = f;
  }

  const final = {
    camion_id:           d.camion_id ?? existing.camion_id,
    fecha_salida:        fecha ?? existing.fecha_salida,
    chofer_id:           d.chofer_id !== undefined ? d.chofer_id : existing.chofer_id,
    chofer_nombre:       d.chofer_nombre !== undefined ? (d.chofer_nombre?.trim() || null) : existing.chofer_nombre,
    check_tarjeta_verde: d.check_tarjeta_verde ?? existing.check_tarjeta_verde,
    check_seguro:        d.check_seguro ?? existing.check_seguro,
    check_tecnica:       d.check_tecnica ?? existing.check_tecnica,
    check_carnet:        d.check_carnet ?? existing.check_carnet,
    observaciones:       d.observaciones !== undefined ? d.observaciones : existing.observaciones,
    estado:              d.estado ?? existing.estado,
  };
  if (final.chofer_id) final.chofer_nombre = null;

  let cierre: { revisado_at: Date | null; alertas_al_cerrar: Prisma.InputJsonValue | typeof Prisma.DbNull } | null = null;
  if (final.estado === 'PENDIENTE') {
    cierre = { revisado_at: null, alertas_al_cerrar: Prisma.DbNull };
  } else {
    const camion = await prisma.camion.findUniqueOrThrow({ where: { id: final.camion_id }, include: { seguros: true } });
    const chofer = final.chofer_id ? await prisma.empleado.findUnique({ where: { id: final.chofer_id } }) : null;
    const alertas = evaluarDocumentacion(camion, chofer, final.chofer_nombre, final.fecha_salida);
    const err = validarCierre(final.estado, final, alertas);
    if (err) { res.status(400).json({ error: err }); return; }
    cierre = { revisado_at: new Date(), alertas_al_cerrar: alertas as unknown as Prisma.InputJsonValue };
  }

  const control = await prisma.controlSalidaVehiculo.update({
    where: { id },
    data: {
      ...final,
      ...(d.evento_id !== undefined && { evento_id: d.evento_id }),
      ...(d.destino !== undefined && { destino: d.destino }),
      ...(d.revisado_por !== undefined && { revisado_por: d.revisado_por }),
      ...cierre,
    },
    include: CONTROL_INCLUDE,
  });

  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'UPDATE', entidad: 'ControlSalidaVehiculo', entidadId: id,
    descripcion: `Actualizó control de salida de ${control.camion.codigo} del ${fmt(control.fecha_salida)} (${control.estado})`,
    datosDespues: d, ip: req.ip, tx: prisma,
  });

  res.json(serializarControl(control));
}

// DELETE /api/flota/controles-salida/:id
export async function deleteControlSalida(req: Request, res: Response) {
  const id = Number(req.params.id);
  const existing = await prisma.controlSalidaVehiculo.findFirst({ where: { id, deleted_at: null, ...withTenant(req.empresaId!) }, include: { camion: { select: { codigo: true } } } });
  if (!existing) { res.status(404).json({ error: 'Control no encontrado' }); return; }

  await prisma.controlSalidaVehiculo.update({ where: { id }, data: { deleted_at: new Date() } });
  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'DELETE', entidad: 'ControlSalidaVehiculo', entidadId: id,
    descripcion: `Eliminó el control de salida de ${existing.camion.codigo} del ${fmt(existing.fecha_salida)}`, ip: req.ip, tx: prisma,
  });
  res.json({ message: 'Control eliminado' });
}
