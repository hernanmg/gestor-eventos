import type { Request, Response } from 'express';
import { z } from 'zod';
import * as XLSX from 'xlsx';
import { Prisma, EstadoSiniestroVehiculo } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { withTenant } from '../lib/tenant';
import { registrarAuditoria } from '../lib/auditoria';
import { importarPlanillaSiniestrosVehiculo } from '../lib/siniestrosVehiculoImporter';

// Siniestros de vehículos (flota) — Lorena, DOS57. Análogo a
// siniestros.controller.ts (empleados/ART) pero con vehículo y tercero.

const INCLUDE = {
  camion:   { select: { id: true, codigo: true, patente: true, descripcion: true } },
  empleado: { select: { id: true, nombre: true, apellido: true } },
} as const;

const baseSchema = z.object({
  camion_id:              z.number().int().positive().nullable().optional(),
  patente_texto:          z.string().nullable().optional(),
  empleado_id:            z.number().int().positive().nullable().optional(),
  empleado_nombre_manual: z.string().nullable().optional(),
  aseguradora:            z.string().nullable().optional(),
  numero_siniestro:       z.string().nullable().optional(),
  fecha_denuncia:         z.string().nullable().optional(),
  fecha_ocurrencia:       z.string().min(1),
  lugar:                  z.string().nullable().optional(),
  descripcion:            z.string().nullable().optional(),
  danios:                 z.string().nullable().optional(),
  tercero_nombre:         z.string().nullable().optional(),
  tercero_vehiculo:       z.string().nullable().optional(),
  tercero_seguro:         z.string().nullable().optional(),
  estado:                 z.nativeEnum(EstadoSiniestroVehiculo).optional(),
  observaciones:          z.string().nullable().optional(),
});

const createSchema = baseSchema.refine(d => d.camion_id || d.patente_texto, {
  message: 'Indicá el vehículo (del sistema o patente libre)', path: ['camion_id'],
});
const updateSchema = baseSchema.partial();

const emptyToNull = (v: string | null | undefined) => (v === undefined ? undefined : (v?.trim() ? v.trim() : null));
const toDate = (v: string | null | undefined) => (v === undefined ? undefined : (v ? new Date(v) : null));

async function validarRefs(req: Request, camionId?: number | null, empleadoId?: number | null): Promise<string | null> {
  if (camionId) {
    const c = await prisma.camion.findFirst({ where: { id: camionId, deleted_at: null, ...withTenant(req.empresaId!) } });
    if (!c) return 'Vehículo no encontrado';
  }
  if (empleadoId) {
    const e = await prisma.empleado.findFirst({ where: { id: empleadoId, deleted_at: null, ...withTenant(req.empresaId!) } });
    if (!e) return 'Empleado no encontrado';
  }
  return null;
}

function dataFrom(d: z.infer<typeof updateSchema>) {
  return {
    ...(d.camion_id              !== undefined && { camion_id: d.camion_id }),
    ...(d.patente_texto          !== undefined && { patente_texto: emptyToNull(d.patente_texto) }),
    ...(d.empleado_id            !== undefined && { empleado_id: d.empleado_id }),
    ...(d.empleado_nombre_manual !== undefined && { empleado_nombre_manual: emptyToNull(d.empleado_nombre_manual) }),
    ...(d.aseguradora            !== undefined && { aseguradora: emptyToNull(d.aseguradora) }),
    ...(d.numero_siniestro       !== undefined && { numero_siniestro: emptyToNull(d.numero_siniestro) }),
    ...(d.fecha_denuncia         !== undefined && { fecha_denuncia: toDate(d.fecha_denuncia) }),
    ...(d.fecha_ocurrencia       !== undefined && { fecha_ocurrencia: new Date(d.fecha_ocurrencia) }),
    ...(d.lugar                  !== undefined && { lugar: emptyToNull(d.lugar) }),
    ...(d.descripcion            !== undefined && { descripcion: emptyToNull(d.descripcion) }),
    ...(d.danios                 !== undefined && { danios: emptyToNull(d.danios) }),
    ...(d.tercero_nombre         !== undefined && { tercero_nombre: emptyToNull(d.tercero_nombre) }),
    ...(d.tercero_vehiculo       !== undefined && { tercero_vehiculo: emptyToNull(d.tercero_vehiculo) }),
    ...(d.tercero_seguro         !== undefined && { tercero_seguro: emptyToNull(d.tercero_seguro) }),
    ...(d.estado                 !== undefined && { estado: d.estado }),
    ...(d.observaciones          !== undefined && { observaciones: emptyToNull(d.observaciones) }),
  };
}

export async function listSiniestrosVehiculo(req: Request, res: Response) {
  const { estado, camion_id, desde, hasta } = req.query;
  const where: Prisma.SiniestroVehiculoWhereInput = { deleted_at: null, ...withTenant(req.empresaId!) };

  if (typeof estado === 'string' && estado in EstadoSiniestroVehiculo) where.estado = estado as EstadoSiniestroVehiculo;
  if (typeof camion_id === 'string' && camion_id !== '') where.camion_id = Number(camion_id);
  const rango: Prisma.DateTimeFilter = {};
  if (typeof desde === 'string' && desde !== '') rango.gte = new Date(`${desde}T00:00:00.000Z`);
  if (typeof hasta === 'string' && hasta !== '') rango.lte = new Date(`${hasta}T23:59:59.999Z`);
  if (rango.gte || rango.lte) where.fecha_ocurrencia = rango;

  const siniestros = await prisma.siniestroVehiculo.findMany({
    where,
    orderBy: { fecha_ocurrencia: 'desc' },
    include: INCLUDE,
  });
  res.json(siniestros);
}

export async function getSiniestroVehiculo(req: Request, res: Response) {
  const id = Number(req.params.id);
  const s = await prisma.siniestroVehiculo.findFirst({
    where: { id, deleted_at: null, ...withTenant(req.empresaId!) },
    include: INCLUDE,
  });
  if (!s) { res.status(404).json({ error: 'Siniestro no encontrado' }); return; }
  res.json(s);
}

export async function createSiniestroVehiculo(req: Request, res: Response) {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return; }
  const d = parsed.data;

  const errRef = await validarRefs(req, d.camion_id, d.empleado_id);
  if (errRef) { res.status(404).json({ error: errRef }); return; }

  try {
    const creado = await prisma.siniestroVehiculo.create({
      data: {
        ...dataFrom(d),
        fecha_ocurrencia: new Date(d.fecha_ocurrencia),
        empresa_id:       req.empresaId!,
        created_by:       req.user!.id,
      },
      include: INCLUDE,
    });
    res.status(201).json(creado);
  } catch (err: any) {
    if (err.code === 'P2002') { res.status(400).json({ error: 'Ya existe un siniestro con ese N°' }); return; }
    throw err;
  }
}

export async function updateSiniestroVehiculo(req: Request, res: Response) {
  const id = Number(req.params.id);
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return; }

  const existing = await prisma.siniestroVehiculo.findFirst({ where: { id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!existing) { res.status(404).json({ error: 'Siniestro no encontrado' }); return; }

  const errRef = await validarRefs(req, parsed.data.camion_id, parsed.data.empleado_id);
  if (errRef) { res.status(404).json({ error: errRef }); return; }

  try {
    const updated = await prisma.siniestroVehiculo.update({ where: { id }, data: dataFrom(parsed.data), include: INCLUDE });
    res.json(updated);
  } catch (err: any) {
    if (err.code === 'P2002') { res.status(400).json({ error: 'Ya existe un siniestro con ese N°' }); return; }
    throw err;
  }
}

const resolverSchema = z.object({ observaciones: z.string().nullable().optional() });

export async function resolverSiniestroVehiculo(req: Request, res: Response) {
  const id = Number(req.params.id);
  const parsed = resolverSchema.safeParse(req.body ?? {});
  if (!parsed.success) { res.status(400).json({ error: 'Datos inválidos' }); return; }

  const existing = await prisma.siniestroVehiculo.findFirst({ where: { id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!existing) { res.status(404).json({ error: 'Siniestro no encontrado' }); return; }
  if (existing.estado === 'RESUELTO') { res.status(400).json({ error: 'Este siniestro ya está resuelto' }); return; }

  const updated = await prisma.siniestroVehiculo.update({
    where: { id },
    data: {
      estado: 'RESUELTO',
      ...(parsed.data.observaciones?.trim() && {
        observaciones: [existing.observaciones, parsed.data.observaciones.trim()].filter(Boolean).join(' — '),
      }),
    },
    include: INCLUDE,
  });
  res.json(updated);
}

export async function importarSiniestrosVehiculo(req: Request, res: Response) {
  if (!req.file) { res.status(400).json({ error: 'Se requiere un archivo .xlsx' }); return; }

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
  } catch (err: any) {
    res.status(400).json({ error: 'Error al procesar el archivo', detail: err.message }); return;
  }

  const resultado = await importarPlanillaSiniestrosVehiculo(workbook, req.empresaId!, req.user!.id);

  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'IMPORT', entidad: 'SiniestroVehiculo',
    descripcion: `Importó planilla de siniestros de vehículos — ${resultado.creados} creados, ${resultado.actualizados} actualizados`,
    datosDespues: resultado, ip: req.ip, tx: prisma,
  });

  res.json(resultado);
}
