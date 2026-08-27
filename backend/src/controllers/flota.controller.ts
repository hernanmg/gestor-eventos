import type { Request, Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { Prisma, EstadoSeguro, EstadoPatente, EstadoServicioTaller, TipoMovCCC } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { registrarAuditoria } from '../lib/auditoria';
import { withTenant } from '../lib/tenant';
import { recalcularSaldoCCC } from '../lib/recalcularSaldoCCC';

// ── Multer (póliza / comprobante) ────────────────────────────────────────────

export const uploadDoc = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Solo se aceptan archivos PDF o imágenes'));
  },
});

const MS_DIA = 86_400_000;

// ── Estado de seguros — recalculado en cada consulta ─────────────────────────
// Si fecha_vencimiento < hoy → VENCIDO; si < hoy + 30 días → POR_VENCER; si no → VIGENTE.
// CANCELADO nunca se toca acá (es un estado manual).
export async function updateEstadoSeguros(empresaId: number): Promise<void> {
  const hoy       = new Date();
  const en30Dias  = new Date(hoy.getTime() + 30 * MS_DIA);

  await prisma.seguroVehiculo.updateMany({
    where: { empresa_id: empresaId, deleted_at: null, estado: { not: EstadoSeguro.CANCELADO }, fecha_vencimiento: { lt: hoy } },
    data:  { estado: EstadoSeguro.VENCIDO },
  });
  await prisma.seguroVehiculo.updateMany({
    where: { empresa_id: empresaId, deleted_at: null, estado: { not: EstadoSeguro.CANCELADO }, fecha_vencimiento: { gte: hoy, lt: en30Dias } },
    data:  { estado: EstadoSeguro.POR_VENCER },
  });
  await prisma.seguroVehiculo.updateMany({
    where: { empresa_id: empresaId, deleted_at: null, estado: { not: EstadoSeguro.CANCELADO }, fecha_vencimiento: { gte: en30Dias } },
    data:  { estado: EstadoSeguro.VIGENTE },
  });
}

// ── Vehículos ─────────────────────────────────────────────────────────────────

const vehiculoSchema = z.object({
  codigo:          z.string().min(1),
  descripcion:     z.string().nullable().optional(),
  patente:         z.string().nullable().optional(),
  tipo:            z.string().nullable().optional(),
  marca:           z.string().nullable().optional(),
  modelo:          z.string().nullable().optional(),
  anio:            z.number().int().nullable().optional(),
  color:           z.string().nullable().optional(),
  titular:         z.string().nullable().optional(),
  numero_telepase: z.string().nullable().optional(),
});

export async function listVehiculos(req: Request, res: Response) {
  await updateEstadoSeguros(req.empresaId!);

  const { en_servicio, tipo } = req.query as { en_servicio?: string; tipo?: string };

  const vehiculos = await prisma.camion.findMany({
    where: {
      deleted_at: null,
      ...withTenant(req.empresaId!),
      ...(en_servicio !== undefined && { en_servicio: en_servicio === 'true' }),
      ...(tipo && { tipo }),
    },
    include: {
      seguros:          { where: { deleted_at: null, estado: { not: EstadoSeguro.CANCELADO } }, orderBy: { fecha_vencimiento: 'desc' }, take: 1 },
      patentes:         { where: { deleted_at: null, estado: { in: [EstadoPatente.PENDIENTE, EstadoPatente.VENCIDA] } }, orderBy: { fecha_vencimiento: 'asc' }, take: 1 },
      servicios_taller: { where: { deleted_at: null, estado: EstadoServicioTaller.EN_PROCESO }, take: 1 },
    },
    orderBy: { codigo: 'asc' },
  });

  res.json(vehiculos.map(v => ({
    ...v,
    seguro_vigente:        v.seguros[0] ?? null,
    proxima_patente:       v.patentes[0] ?? null,
    en_taller:             v.servicios_taller[0] ?? null,
    seguros: undefined, patentes: undefined, servicios_taller: undefined,
  })));
}

export async function detalleVehiculo(req: Request, res: Response) {
  await updateEstadoSeguros(req.empresaId!);
  const id = Number(req.params.id);

  const vehiculo = await prisma.camion.findFirst({
    where: { id, deleted_at: null, ...withTenant(req.empresaId!) },
    include: {
      seguros:          { where: { deleted_at: null }, orderBy: { fecha_vencimiento: 'desc' } },
      patentes:         { where: { deleted_at: null }, orderBy: { fecha_vencimiento: 'desc' } },
      gastos_peaje:      { where: { deleted_at: null }, orderBy: { fecha: 'desc' }, take: 10, include: { evento: { select: { id: true, nombre: true } } } },
      servicios_taller: { where: { deleted_at: null }, orderBy: { fecha_ingreso: 'desc' } },
    },
  });
  if (!vehiculo) { res.status(404).json({ error: 'Vehículo no encontrado' }); return; }
  res.json(vehiculo);
}

export async function createVehiculo(req: Request, res: Response) {
  const parsed = vehiculoSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return;
  }
  const d = parsed.data;

  const dupe = await prisma.camion.findFirst({ where: { codigo: d.codigo, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (dupe) { res.status(400).json({ error: 'Ya existe un vehículo con ese código' }); return; }

  const vehiculo = await prisma.camion.create({
    data: {
      ...withTenant(req.empresaId!),
      codigo:          d.codigo,
      descripcion:     d.descripcion     ?? null,
      patente:         d.patente         ?? null,
      tipo:            d.tipo            ?? null,
      marca:           d.marca           ?? null,
      modelo:          d.modelo          ?? null,
      anio:            d.anio            ?? null,
      color:           d.color           ?? null,
      titular:         d.titular         ?? null,
      numero_telepase: d.numero_telepase ?? null,
    },
  });

  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'CREATE', entidad: 'Camion', entidadId: vehiculo.id,
    descripcion: `Creó vehículo "${d.codigo}"`, datosDespues: d, ip: req.ip, tx: prisma,
  });

  res.status(201).json(vehiculo);
}

export async function updateVehiculo(req: Request, res: Response) {
  const id     = Number(req.params.id);
  const parsed = vehiculoSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return;
  }
  const existing = await prisma.camion.findFirst({ where: { id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!existing) { res.status(404).json({ error: 'Vehículo no encontrado' }); return; }

  const d = parsed.data;
  if (d.codigo && d.codigo !== existing.codigo) {
    const dupe = await prisma.camion.findFirst({ where: { codigo: d.codigo, deleted_at: null, ...withTenant(req.empresaId!) } });
    if (dupe) { res.status(400).json({ error: 'Ya existe un vehículo con ese código' }); return; }
  }

  const vehiculo = await prisma.camion.update({ where: { id }, data: { ...d } });

  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'UPDATE', entidad: 'Camion', entidadId: id,
    descripcion: `Actualizó vehículo "${existing.codigo}"`, datosDespues: d, ip: req.ip, tx: prisma,
  });

  res.json(vehiculo);
}

const bajaSchema = z.object({ motivo_baja: z.string().min(1) });

export async function darDeBajaVehiculo(req: Request, res: Response) {
  const id = Number(req.params.id);
  const parsed = bajaSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return;
  }

  const existing = await prisma.camion.findFirst({ where: { id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!existing) { res.status(404).json({ error: 'Vehículo no encontrado' }); return; }

  const activas = await prisma.asignacionStock.count({ where: { camion_id: id, estado: 'ACTIVA', deleted_at: null } });
  if (activas > 0) { res.status(400).json({ error: 'No se puede dar de baja un vehículo con asignaciones activas' }); return; }

  const tallerEnProceso = await prisma.servicioTaller.count({ where: { camion_id: id, estado: EstadoServicioTaller.EN_PROCESO, deleted_at: null } });
  if (tallerEnProceso > 0) {
    res.status(400).json({ error: 'No se puede dar de baja: el vehículo tiene un servicio de taller en proceso. Finalizá o cancelá el servicio primero.' });
    return;
  }

  const fechaBaja = new Date();
  const vehiculo = await prisma.$transaction(async tx => {
    // Seguros activos quedan cancelados — un vehículo dado de baja no sigue
    // pagando/renovando seguro (ver FIX 6 del módulo Flota).
    await tx.seguroVehiculo.updateMany({
      where: { camion_id: id, deleted_at: null, estado: { in: [EstadoSeguro.VIGENTE, EstadoSeguro.POR_VENCER] } },
      data:  { estado: EstadoSeguro.CANCELADO },
    });
    const segurosCancelados = await tx.seguroVehiculo.findMany({
      where:  { camion_id: id, deleted_at: null, estado: EstadoSeguro.CANCELADO },
      select: { id: true, notas: true },
    });
    const notaBaja = `Cancelado por baja del vehículo (${fechaBaja.toLocaleDateString('es-AR')})`;
    for (const s of segurosCancelados) {
      await tx.seguroVehiculo.update({
        where: { id: s.id },
        data:  { notas: s.notas ? `${s.notas}\n${notaBaja}` : notaBaja },
      });
    }

    return tx.camion.update({
      where: { id },
      data:  { en_servicio: false, activo: false, fecha_baja: fechaBaja, motivo_baja: parsed.data.motivo_baja },
    });
  });

  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'DELETE', entidad: 'Camion', entidadId: id,
    descripcion: `Dio de baja vehículo "${existing.codigo}" (${parsed.data.motivo_baja})`, ip: req.ip, tx: prisma,
  });

  res.json(vehiculo);
}

// ── Seguros ───────────────────────────────────────────────────────────────────

const seguroSchema = z.object({
  aseguradora:       z.string().min(1),
  numero_poliza:     z.string().nullable().optional(),
  tipo_cobertura:    z.string().nullable().optional(),
  fecha_inicio:      z.string().min(1),
  fecha_vencimiento: z.string().min(1),
  importe_anual:     z.number().nullable().optional(),
  moneda:            z.enum(['ARS', 'USD', 'EUR']).optional(),
  notas:             z.string().nullable().optional(),
});

function computeEstadoSeguro(fechaVencimiento: Date): EstadoSeguro {
  const hoy = new Date();
  if (fechaVencimiento < hoy) return EstadoSeguro.VENCIDO;
  if (fechaVencimiento.getTime() < hoy.getTime() + 30 * MS_DIA) return EstadoSeguro.POR_VENCER;
  return EstadoSeguro.VIGENTE;
}

export async function listSegurosVehiculo(req: Request, res: Response) {
  await updateEstadoSeguros(req.empresaId!);
  const camionId = Number(req.params.id);
  const seguros = await prisma.seguroVehiculo.findMany({
    where:   { camion_id: camionId, deleted_at: null, ...withTenant(req.empresaId!) },
    orderBy: { fecha_vencimiento: 'desc' },
    select:  { id: true, camion_id: true, aseguradora: true, numero_poliza: true, tipo_cobertura: true, fecha_inicio: true, fecha_vencimiento: true, importe_anual: true, moneda: true, estado: true, documento_nombre: true, notas: true, created_at: true },
  });
  res.json(seguros);
}

export async function listSegurosEmpresa(req: Request, res: Response) {
  await updateEstadoSeguros(req.empresaId!);
  const { vehiculo_id, aseguradora, estado } = req.query as { vehiculo_id?: string; aseguradora?: string; estado?: string };

  const seguros = await prisma.seguroVehiculo.findMany({
    where: {
      deleted_at: null,
      ...withTenant(req.empresaId!),
      ...(vehiculo_id && { camion_id: Number(vehiculo_id) }),
      ...(aseguradora && { aseguradora: { contains: aseguradora, mode: 'insensitive' } }),
      ...(estado && { estado: estado as EstadoSeguro }),
    },
    include: { camion: { select: { id: true, codigo: true, descripcion: true, patente: true } } },
    orderBy: { fecha_vencimiento: 'asc' },
  });

  res.json(seguros.map(s => ({ ...s, documento_data: undefined })));
}

export async function createSeguroVehiculo(req: Request, res: Response) {
  const camionId = Number(req.params.id);
  const camion   = await prisma.camion.findFirst({ where: { id: camionId, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!camion) { res.status(404).json({ error: 'Vehículo no encontrado' }); return; }

  const b = req.body;
  const parsed = seguroSchema.safeParse({
    ...b,
    importe_anual: b.importe_anual ? parseFloat(b.importe_anual) : undefined,
  });
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return;
  }
  const d = parsed.data;
  const fechaVencimiento = new Date(d.fecha_vencimiento);

  const seguro = await prisma.seguroVehiculo.create({
    data: {
      camion_id: camionId,
      ...withTenant(req.empresaId!),
      aseguradora:       d.aseguradora,
      numero_poliza:     d.numero_poliza  ?? null,
      tipo_cobertura:    d.tipo_cobertura ?? null,
      fecha_inicio:      new Date(d.fecha_inicio),
      fecha_vencimiento: fechaVencimiento,
      importe_anual:     d.importe_anual  ?? null,
      moneda:            d.moneda ?? 'ARS',
      estado:            computeEstadoSeguro(fechaVencimiento),
      documento_data:    req.file?.buffer       ?? null,
      documento_nombre:  req.file?.originalname ?? null,
      documento_mime:    req.file?.mimetype     ?? null,
      notas:             d.notas ?? null,
      created_by:        req.user!.id,
    },
  });

  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'CREATE', entidad: 'SeguroVehiculo', entidadId: seguro.id,
    descripcion: `Cargó seguro de "${camion.codigo}" — ${d.aseguradora}`, ip: req.ip, tx: prisma,
  });

  res.status(201).json({ ...seguro, documento_data: undefined });
}

export async function updateSeguroVehiculo(req: Request, res: Response) {
  const id = Number(req.params.id);
  const existing = await prisma.seguroVehiculo.findFirst({ where: { id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!existing) { res.status(404).json({ error: 'Seguro no encontrado' }); return; }

  const b = req.body;
  const parsed = seguroSchema.partial().safeParse({
    ...b,
    importe_anual: b.importe_anual !== undefined ? (b.importe_anual ? parseFloat(b.importe_anual) : null) : undefined,
  });
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return;
  }
  const d = parsed.data;
  const fechaVencimiento = d.fecha_vencimiento ? new Date(d.fecha_vencimiento) : existing.fecha_vencimiento;

  const seguro = await prisma.seguroVehiculo.update({
    where: { id },
    data: {
      ...(d.aseguradora       !== undefined && { aseguradora: d.aseguradora }),
      ...(d.numero_poliza     !== undefined && { numero_poliza: d.numero_poliza }),
      ...(d.tipo_cobertura    !== undefined && { tipo_cobertura: d.tipo_cobertura }),
      ...(d.fecha_inicio      !== undefined && { fecha_inicio: new Date(d.fecha_inicio) }),
      ...(d.fecha_vencimiento !== undefined && { fecha_vencimiento: fechaVencimiento, estado: computeEstadoSeguro(fechaVencimiento) }),
      ...(d.importe_anual     !== undefined && { importe_anual: d.importe_anual }),
      ...(d.moneda            !== undefined && { moneda: d.moneda }),
      ...(d.notas             !== undefined && { notas: d.notas }),
      ...(req.file && { documento_data: req.file.buffer, documento_nombre: req.file.originalname, documento_mime: req.file.mimetype }),
    },
  });

  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'UPDATE', entidad: 'SeguroVehiculo', entidadId: id,
    descripcion: `Actualizó seguro #${id}`, ip: req.ip, tx: prisma,
  });

  res.json({ ...seguro, documento_data: undefined });
}

export async function deleteSeguroVehiculo(req: Request, res: Response) {
  const id = Number(req.params.id);
  const existing = await prisma.seguroVehiculo.findFirst({ where: { id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!existing) { res.status(404).json({ error: 'Seguro no encontrado' }); return; }

  await prisma.seguroVehiculo.update({ where: { id }, data: { deleted_at: new Date() } });

  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'DELETE', entidad: 'SeguroVehiculo', entidadId: id,
    descripcion: `Eliminó seguro #${id}`, ip: req.ip, tx: prisma,
  });

  res.json({ message: 'Seguro eliminado correctamente' });
}

export async function getPolizaSeguro(req: Request, res: Response) {
  const id = Number(req.params.id);
  const s  = await prisma.seguroVehiculo.findFirst({
    where:  { id, deleted_at: null, ...withTenant(req.empresaId!) },
    select: { documento_data: true, documento_mime: true, documento_nombre: true },
  });
  if (!s)               { res.status(404).json({ error: 'Seguro no encontrado' }); return; }
  if (!s.documento_data) { res.status(404).json({ error: 'Este seguro no tiene póliza adjunta' }); return; }

  const buffer   = Buffer.from(s.documento_data);
  const filename = encodeURIComponent(s.documento_nombre ?? 'poliza.pdf');
  res.setHeader('Content-Type',        s.documento_mime ?? 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  res.setHeader('Content-Length',      buffer.length);
  res.end(buffer);
}

// ── Patentes ──────────────────────────────────────────────────────────────────

const patenteSchema = z.object({
  tipo:              z.enum(['MUNICIPAL', 'PROVINCIAL', 'NACIONAL']),
  anio:              z.number().int(),
  cuota:             z.number().int().nullable().optional(),
  importe:           z.number(),
  fecha_vencimiento: z.string().min(1),
  notas:             z.string().nullable().optional(),
});

export async function listPatentesVehiculo(req: Request, res: Response) {
  const camionId = Number(req.params.id);
  const patentes = await prisma.patenteVehiculo.findMany({
    where:   { camion_id: camionId, deleted_at: null, ...withTenant(req.empresaId!) },
    orderBy: { fecha_vencimiento: 'desc' },
    select:  { id: true, camion_id: true, tipo: true, anio: true, cuota: true, importe: true, fecha_vencimiento: true, fecha_pago: true, estado: true, comprobante_nombre: true, notas: true },
  });
  res.json(patentes);
}

export async function listPatentesEmpresa(req: Request, res: Response) {
  const { vehiculo_id, tipo, anio, estado } = req.query as { vehiculo_id?: string; tipo?: string; anio?: string; estado?: string };

  const patentes = await prisma.patenteVehiculo.findMany({
    where: {
      deleted_at: null,
      ...withTenant(req.empresaId!),
      ...(vehiculo_id && { camion_id: Number(vehiculo_id) }),
      ...(tipo && { tipo: tipo as any }),
      ...(anio && { anio: Number(anio) }),
      ...(estado && { estado: estado as EstadoPatente }),
    },
    include: { camion: { select: { id: true, codigo: true, descripcion: true, patente: true } } },
    orderBy: { fecha_vencimiento: 'asc' },
  });

  res.json(patentes.map(p => ({ ...p, comprobante_data: undefined })));
}

export async function createPatenteVehiculo(req: Request, res: Response) {
  const camionId = Number(req.params.id);
  const camion   = await prisma.camion.findFirst({ where: { id: camionId, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!camion) { res.status(404).json({ error: 'Vehículo no encontrado' }); return; }

  const b = req.body;
  const parsed = patenteSchema.safeParse({
    ...b,
    anio:    b.anio    !== undefined ? Number(b.anio)    : undefined,
    cuota:   b.cuota    ? Number(b.cuota)    : undefined,
    importe: b.importe !== undefined ? parseFloat(b.importe) : undefined,
  });
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return;
  }
  const d = parsed.data;

  const patente = await prisma.patenteVehiculo.create({
    data: {
      camion_id: camionId,
      ...withTenant(req.empresaId!),
      tipo:              d.tipo,
      anio:              d.anio,
      cuota:             d.cuota ?? null,
      importe:           d.importe,
      fecha_vencimiento: new Date(d.fecha_vencimiento),
      notas:             d.notas ?? null,
      created_by:        req.user!.id,
    },
  });

  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'CREATE', entidad: 'PatenteVehiculo', entidadId: patente.id,
    descripcion: `Cargó patente ${d.tipo} ${d.anio} de "${camion.codigo}"`, ip: req.ip, tx: prisma,
  });

  res.status(201).json(patente);
}

const pagoPatenteSchema = z.object({ fecha_pago: z.string().min(1) });

export async function updatePatenteVehiculo(req: Request, res: Response) {
  const id = Number(req.params.id);
  const existing = await prisma.patenteVehiculo.findFirst({ where: { id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!existing) { res.status(404).json({ error: 'Patente no encontrada' }); return; }

  // Registro de pago — endpoint dedicado dispara fecha_pago = hoy/valor recibido + estado PAGADA
  if (req.body.estado === 'PAGADA' || req.body.fecha_pago !== undefined) {
    const parsedPago = pagoPatenteSchema.safeParse({ fecha_pago: req.body.fecha_pago ?? new Date().toISOString() });
    if (!parsedPago.success) { res.status(400).json({ error: 'Fecha de pago inválida' }); return; }

    const patente = await prisma.patenteVehiculo.update({
      where: { id },
      data: {
        estado:              EstadoPatente.PAGADA,
        fecha_pago:          new Date(parsedPago.data.fecha_pago),
        comprobante_data:    req.file?.buffer       ?? undefined,
        comprobante_nombre:  req.file?.originalname ?? undefined,
        comprobante_mime:    req.file?.mimetype     ?? undefined,
      },
    });

    await registrarAuditoria({
      usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'UPDATE', entidad: 'PatenteVehiculo', entidadId: id,
      descripcion: `Registró pago de patente #${id}`, ip: req.ip, tx: prisma,
    });

    res.json({ ...patente, comprobante_data: undefined });
    return;
  }

  const parsed = patenteSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return;
  }
  const d = parsed.data;

  const patente = await prisma.patenteVehiculo.update({
    where: { id },
    data: {
      ...(d.tipo              !== undefined && { tipo: d.tipo }),
      ...(d.anio              !== undefined && { anio: d.anio }),
      ...(d.cuota             !== undefined && { cuota: d.cuota }),
      ...(d.importe           !== undefined && { importe: d.importe }),
      ...(d.fecha_vencimiento !== undefined && { fecha_vencimiento: new Date(d.fecha_vencimiento) }),
      ...(d.notas             !== undefined && { notas: d.notas }),
    },
  });

  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'UPDATE', entidad: 'PatenteVehiculo', entidadId: id,
    descripcion: `Actualizó patente #${id}`, ip: req.ip, tx: prisma,
  });

  res.json({ ...patente, comprobante_data: undefined });
}

// ── Peajes / Telepase ─────────────────────────────────────────────────────────

const peajeSchema = z.object({
  camion_id:            z.number().int().positive(),
  fecha:                z.string().min(1),
  ruta:                 z.string().nullable().optional(),
  importe:              z.number(),
  evento_id:            z.number().int().positive().nullable().optional(),
  es_carga_telepase:    z.boolean().optional(),
  saldo_telepase_post:  z.number().nullable().optional(),
  notas:                z.string().nullable().optional(),
});

export async function listPeajes(req: Request, res: Response) {
  const { camion_id, desde, hasta, evento_id } = req.query as { camion_id?: string; desde?: string; hasta?: string; evento_id?: string };

  const peajes = await prisma.gastoPeaje.findMany({
    where: {
      deleted_at: null,
      ...withTenant(req.empresaId!),
      ...(camion_id && { camion_id: Number(camion_id) }),
      ...(evento_id && { evento_id: Number(evento_id) }),
      ...((desde || hasta) && {
        fecha: {
          ...(desde && { gte: new Date(`${desde}T00:00:00.000Z`) }),
          ...(hasta && { lte: new Date(`${hasta}T23:59:59.999Z`) }),
        },
      }),
    },
    include: {
      camion: { select: { id: true, codigo: true, descripcion: true, patente: true } },
      evento: { select: { id: true, nombre: true } },
    },
    orderBy: { fecha: 'desc' },
  });

  res.json(peajes);
}

export async function listPeajesVehiculo(req: Request, res: Response) {
  const camionId = Number(req.params.id);
  const peajes = await prisma.gastoPeaje.findMany({
    where:   { camion_id: camionId, deleted_at: null, ...withTenant(req.empresaId!) },
    orderBy: { fecha: 'desc' },
    take:    10,
    include: { evento: { select: { id: true, nombre: true } } },
  });
  res.json(peajes);
}

export async function createPeaje(req: Request, res: Response) {
  const b = req.body;
  const parsed = peajeSchema.safeParse({
    ...b,
    camion_id:           b.camion_id           !== undefined ? Number(b.camion_id) : undefined,
    importe:             b.importe             !== undefined ? parseFloat(b.importe) : undefined,
    evento_id:           b.evento_id           ? Number(b.evento_id) : null,
    saldo_telepase_post: b.saldo_telepase_post !== undefined && b.saldo_telepase_post !== null ? parseFloat(b.saldo_telepase_post) : undefined,
  });
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return;
  }
  const d = parsed.data;

  const camion = await prisma.camion.findFirst({ where: { id: d.camion_id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!camion) { res.status(400).json({ error: 'Vehículo no encontrado' }); return; }

  if (d.evento_id) {
    const evento = await prisma.evento.findFirst({ where: { id: d.evento_id, deleted_at: null, ...withTenant(req.empresaId!) } });
    if (!evento) { res.status(400).json({ error: 'Evento no encontrado' }); return; }
  }

  const peaje = await prisma.gastoPeaje.create({
    data: {
      ...withTenant(req.empresaId!),
      camion_id:           d.camion_id,
      fecha:               new Date(d.fecha),
      ruta:                d.ruta ?? null,
      importe:             d.importe,
      evento_id:           d.evento_id ?? null,
      es_carga_telepase:   d.es_carga_telepase ?? false,
      saldo_telepase_post: d.saldo_telepase_post ?? null,
      notas:               d.notas ?? null,
      created_by:          req.user!.id,
    },
  });

  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'CREATE', entidad: 'GastoPeaje', entidadId: peaje.id,
    descripcion: `Registró ${d.es_carga_telepase ? 'carga telepase' : 'peaje'} de "${camion.codigo}" — $${d.importe}`, ip: req.ip, tx: prisma,
  });

  res.status(201).json(peaje);
}

export async function deletePeaje(req: Request, res: Response) {
  const id = Number(req.params.id);
  const existing = await prisma.gastoPeaje.findFirst({ where: { id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!existing) { res.status(404).json({ error: 'Gasto de peaje no encontrado' }); return; }

  await prisma.gastoPeaje.update({ where: { id }, data: { deleted_at: new Date() } });

  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'DELETE', entidad: 'GastoPeaje', entidadId: id,
    descripcion: `Eliminó gasto de peaje #${id}`, ip: req.ip, tx: prisma,
  });

  res.json({ message: 'Gasto eliminado correctamente' });
}

// ── Taller mecánico ───────────────────────────────────────────────────────────

const tallerSchema = z.object({
  camion_id:           z.number().int().positive(),
  taller_nombre:       z.string().nullable().optional(),
  tipo:                z.enum(['MANTENIMIENTO', 'REPARACION', 'NEUMATICOS', 'CHAPERIA_PINTURA', 'ELECTRICIDAD', 'OTROS']),
  descripcion:         z.string().min(1),
  fecha_ingreso:       z.string().min(1),
  fecha_estimada:      z.string().nullable().optional(),
  presupuesto:         z.number().nullable().optional(),
  cuenta_corriente_id: z.number().int().positive().nullable().optional(),
  notas:               z.string().nullable().optional(),
});

export async function listTaller(req: Request, res: Response) {
  const { estado, camion_id, taller } = req.query as { estado?: string; camion_id?: string; taller?: string };

  const servicios = await prisma.servicioTaller.findMany({
    where: {
      deleted_at: null,
      ...withTenant(req.empresaId!),
      ...(estado && { estado: estado as EstadoServicioTaller }),
      ...(camion_id && { camion_id: Number(camion_id) }),
      ...(taller && { taller_nombre: { contains: taller, mode: 'insensitive' } }),
    },
    include: { camion: { select: { id: true, codigo: true, descripcion: true, patente: true } } },
    orderBy: { fecha_ingreso: 'desc' },
  });

  res.json(servicios);
}

export async function listTallerVehiculo(req: Request, res: Response) {
  const camionId = Number(req.params.id);
  const servicios = await prisma.servicioTaller.findMany({
    where:   { camion_id: camionId, deleted_at: null, ...withTenant(req.empresaId!) },
    orderBy: { fecha_ingreso: 'desc' },
  });
  res.json(servicios);
}

export async function createServicioTaller(req: Request, res: Response) {
  const parsed = tallerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return;
  }
  const d = parsed.data;

  const camion = await prisma.camion.findFirst({ where: { id: d.camion_id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!camion) { res.status(400).json({ error: 'Vehículo no encontrado' }); return; }

  if (d.cuenta_corriente_id) {
    const cuenta = await prisma.cuentaCorriente.findFirst({ where: { id: d.cuenta_corriente_id, deleted_at: null, ...withTenant(req.empresaId!) } });
    if (!cuenta) { res.status(400).json({ error: 'Cuenta corriente no encontrada' }); return; }
  }

  const servicio = await prisma.servicioTaller.create({
    data: {
      ...withTenant(req.empresaId!),
      camion_id:           d.camion_id,
      taller_nombre:       d.taller_nombre ?? null,
      tipo:                d.tipo,
      descripcion:         d.descripcion,
      fecha_ingreso:       new Date(d.fecha_ingreso),
      fecha_estimada:      d.fecha_estimada ? new Date(d.fecha_estimada) : null,
      presupuesto:         d.presupuesto ?? null,
      cuenta_corriente_id: d.cuenta_corriente_id ?? null,
      notas:               d.notas ?? null,
      created_by:          req.user!.id,
    },
  });

  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'CREATE', entidad: 'ServicioTaller', entidadId: servicio.id,
    descripcion: `Ingresó "${camion.codigo}" a taller — ${d.tipo}`, ip: req.ip, tx: prisma,
  });

  res.status(201).json(servicio);
}

const tallerUpdateSchema = tallerSchema.partial().extend({
  estado:         z.enum(['PRESUPUESTADO', 'EN_PROCESO', 'FINALIZADO', 'CANCELADO']).optional(),
  fecha_retiro:   z.string().nullable().optional(),
  importe_final:  z.number().nullable().optional(),
});

export async function updateServicioTaller(req: Request, res: Response) {
  const id = Number(req.params.id);
  const existing = await prisma.servicioTaller.findFirst({ where: { id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!existing) { res.status(404).json({ error: 'Servicio no encontrado' }); return; }

  const parsed = tallerUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return;
  }
  const d = parsed.data;

  if (d.cuenta_corriente_id) {
    const cuenta = await prisma.cuentaCorriente.findFirst({ where: { id: d.cuenta_corriente_id, deleted_at: null, ...withTenant(req.empresaId!) } });
    if (!cuenta) { res.status(400).json({ error: 'Cuenta corriente no encontrada' }); return; }
  }

  const finalizando = d.estado === EstadoServicioTaller.FINALIZADO && existing.estado !== EstadoServicioTaller.FINALIZADO;
  const cuentaId = d.cuenta_corriente_id ?? existing.cuenta_corriente_id;

  if (finalizando && cuentaId && d.importe_final == null) {
    res.status(400).json({ error: 'Se requiere el importe final para finalizar con cuenta corriente vinculada' }); return;
  }

  const servicio = await prisma.$transaction(async tx => {
    const updated = await tx.servicioTaller.update({
      where: { id },
      data: {
        ...(d.taller_nombre       !== undefined && { taller_nombre: d.taller_nombre }),
        ...(d.tipo                !== undefined && { tipo: d.tipo }),
        ...(d.descripcion         !== undefined && { descripcion: d.descripcion }),
        ...(d.fecha_estimada      !== undefined && { fecha_estimada: d.fecha_estimada ? new Date(d.fecha_estimada) : null }),
        ...(d.fecha_retiro        !== undefined && { fecha_retiro: d.fecha_retiro ? new Date(d.fecha_retiro) : null }),
        ...(d.presupuesto         !== undefined && { presupuesto: d.presupuesto }),
        ...(d.importe_final       !== undefined && { importe_final: d.importe_final }),
        ...(d.cuenta_corriente_id !== undefined && { cuenta_corriente_id: d.cuenta_corriente_id }),
        ...(d.notas               !== undefined && { notas: d.notas }),
        ...(d.estado              !== undefined && { estado: d.estado }),
        ...(finalizando && !d.fecha_retiro && { fecha_retiro: new Date() }),
      },
    });

    // Al finalizar con cuenta corriente vinculada, cargar el importe final como
    // DEBE (cargo al taller) en la cuenta corriente — mismo patrón que
    // movimientoCCC.create + recalcularSaldoCCC en cuentasCorrientes.controller.ts.
    if (finalizando && cuentaId && d.importe_final != null) {
      await tx.movimientoCCC.create({
        data: {
          cuenta_ccc_id: cuentaId,
          empresa_id:    req.empresaId!,
          tipo:          TipoMovCCC.DEBE,
          fecha:         new Date(),
          concepto:      `Servicio de taller — ${updated.descripcion}`,
          descripcion:   `Vehículo ${existing.camion_id} · finalizado`,
          monto:         d.importe_final,
          moneda:        'ARS',
          monto_ars:     d.importe_final,
          created_by:    req.user!.id,
          updated_by:    req.user!.id,
        },
      });
      await recalcularSaldoCCC(cuentaId, tx as unknown as Prisma.TransactionClient);
    }

    return updated;
  });

  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'UPDATE', entidad: 'ServicioTaller', entidadId: id,
    descripcion: `Actualizó servicio de taller #${id}`, ip: req.ip, tx: prisma,
  });

  res.json(servicio);
}

export async function deleteServicioTaller(req: Request, res: Response) {
  const id = Number(req.params.id);
  const existing = await prisma.servicioTaller.findFirst({ where: { id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!existing) { res.status(404).json({ error: 'Servicio no encontrado' }); return; }

  if (existing.estado !== EstadoServicioTaller.PRESUPUESTADO) {
    res.status(400).json({ error: 'No se puede eliminar un servicio en proceso o finalizado' }); return;
  }

  await prisma.servicioTaller.update({ where: { id }, data: { deleted_at: new Date() } });

  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'DELETE', entidad: 'ServicioTaller', entidadId: id,
    descripcion: `Eliminó servicio de taller #${id}`, ip: req.ip, tx: prisma,
  });

  res.json({ message: 'Servicio eliminado correctamente' });
}

// ── Alertas de flota ──────────────────────────────────────────────────────────

export async function alertasFlota(req: Request, res: Response) {
  await updateEstadoSeguros(req.empresaId!);
  const hoy = new Date();
  const en30Dias = new Date(hoy.getTime() + 30 * MS_DIA);

  const [segurosCriticos, patentesPendientes, tallerLargo] = await Promise.all([
    prisma.seguroVehiculo.findMany({
      where: { deleted_at: null, ...withTenant(req.empresaId!), estado: { in: [EstadoSeguro.VENCIDO, EstadoSeguro.POR_VENCER] } },
      include: { camion: { select: { id: true, codigo: true } } },
      orderBy: { fecha_vencimiento: 'asc' },
    }),
    prisma.patenteVehiculo.findMany({
      where: { deleted_at: null, ...withTenant(req.empresaId!), estado: EstadoPatente.PENDIENTE, fecha_vencimiento: { lte: en30Dias } },
      include: { camion: { select: { id: true, codigo: true } } },
      orderBy: { fecha_vencimiento: 'asc' },
    }),
    prisma.servicioTaller.findMany({
      where: { deleted_at: null, ...withTenant(req.empresaId!), estado: EstadoServicioTaller.EN_PROCESO },
      include: { camion: { select: { id: true, codigo: true } } },
    }),
  ]);

  const items = [
    ...segurosCriticos.map(s => ({
      id:       `seguro-${s.id}`,
      tipo:     'SEGURO_VENCE' as const,
      titulo:   `Seguro de ${s.camion.codigo} — ${s.aseguradora}`,
      fecha:    s.fecha_vencimiento,
      color:    s.estado === EstadoSeguro.VENCIDO ? '#DC2626' : '#F59E0B',
      urgencia: s.estado === EstadoSeguro.VENCIDO ? 'critical' as const : 'warning' as const,
      metadata: { camion_id: s.camion_id, seguro_id: s.id, estado: s.estado },
    })),
    ...patentesPendientes.map(p => ({
      id:       `patente-${p.id}`,
      tipo:     'PATENTE_VENCE' as const,
      titulo:   `Patente ${p.tipo} ${p.anio} de ${p.camion.codigo}`,
      fecha:    p.fecha_vencimiento,
      color:    '#F59E0B',
      urgencia: 'warning' as const,
      metadata: { camion_id: p.camion_id, patente_id: p.id },
    })),
    ...tallerLargo
      .map(t => ({ ...t, dias: Math.floor((hoy.getTime() - t.fecha_ingreso.getTime()) / MS_DIA) }))
      .filter(t => t.dias > 7)
      .map(t => ({
        id:       `taller-${t.id}`,
        tipo:     'TALLER_DEMORADO' as const,
        titulo:   `${t.camion.codigo} en taller hace ${t.dias} días`,
        fecha:    t.fecha_ingreso,
        color:    '#F59E0B',
        urgencia: 'warning' as const,
        metadata: { camion_id: t.camion_id, servicio_id: t.id, dias: t.dias },
      })),
  ];

  res.json({ items });
}
