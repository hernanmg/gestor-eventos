import type { Request, Response } from 'express';
import { z } from 'zod';
import multer from 'multer';
import * as XLSX from 'xlsx';
import { Prisma, EstadoSiniestro, TipoSiniestro } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { withTenant } from '../lib/tenant';
import { registrarAuditoria } from '../lib/auditoria';
import { importarPlanillaSiniestros } from '../lib/siniestrosImporter';

export const uploadDocumentoSiniestro = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Solo se aceptan archivos PDF o imágenes'));
  },
});

export const uploadPlanillaSiniestros = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const isXlsx =
      file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.originalname.toLowerCase().endsWith('.xlsx');
    if (isXlsx) cb(null, true);
    else cb(new Error('Solo se aceptan archivos .xlsx'));
  },
});

const EMPLEADO_SELECT = { id: true, nombre: true, apellido: true, categoria: true } as const;
const EVENTO_SELECT   = { id: true, nombre: true } as const;

function mapSiniestro(s: any) {
  const gastos = s.gastos ?? [];
  const total_gastos          = gastos.reduce((a: number, g: any) => a + Number(g.monto), 0);
  const total_cubierto_art    = gastos.reduce((a: number, g: any) => a + Number(g.monto_cubierto ?? 0), 0);
  const total_a_cargo_empresa = gastos.reduce((a: number, g: any) => a + Number(g.monto_empresa ?? 0), 0);
  return {
    ...s,
    gastos: gastos.map(mapGasto),
    documentos: (s.documentos ?? []).map(mapDocumento),
    total_gastos:          parseFloat(total_gastos.toFixed(2)),
    total_cubierto_art:    parseFloat(total_cubierto_art.toFixed(2)),
    total_a_cargo_empresa: parseFloat(total_a_cargo_empresa.toFixed(2)),
  };
}

function mapGasto(g: any) {
  return {
    ...g,
    monto:          Number(g.monto),
    monto_cubierto: g.monto_cubierto != null ? Number(g.monto_cubierto) : null,
    monto_empresa:  g.monto_empresa  != null ? Number(g.monto_empresa)  : null,
    comprobante_data: undefined,
    tiene_comprobante: g.comprobante_data != null,
  };
}

function mapDocumento(d: any) {
  return { ...d, archivo_data: undefined };
}

// ── Siniestros ────────────────────────────────────────────────────────────────

const createSiniestroSchema = z.object({
  empleado_id:          z.number().int().positive(),
  tipo:                 z.nativeEnum(TipoSiniestro),
  fecha_ocurrencia:     z.string(),
  descripcion:          z.string().min(1),
  lugar:                z.string().nullable().optional(),
  evento_id:            z.number().int().positive().nullable().optional(),
  art_nombre:           z.string().nullable().optional(),
  art_numero_siniestro: z.string().nullable().optional(),
  fecha_denuncia_art:   z.string().nullable().optional(),
});

const updateSiniestroSchema = createSiniestroSchema.partial().extend({
  estado:            z.nativeEnum(EstadoSiniestro).optional(),
  dias_baja:         z.number().int().min(0).nullable().optional(),
  fecha_alta_medica: z.string().nullable().optional(),
});

export async function listSiniestros(req: Request, res: Response) {
  const { estado, empleado_id, desde, hasta } = req.query;
  const where: Prisma.SiniestroEmpleadoWhereInput = { deleted_at: null, ...withTenant(req.empresaId!) };

  if (typeof estado === 'string' && estado in EstadoSiniestro) where.estado = estado as EstadoSiniestro;
  if (typeof empleado_id === 'string' && empleado_id !== '') where.empleado_id = Number(empleado_id);
  if (typeof desde === 'string' && desde !== '') where.fecha_ocurrencia = { ...(where.fecha_ocurrencia as object), gte: new Date(desde) };
  if (typeof hasta === 'string' && hasta !== '') where.fecha_ocurrencia = { ...(where.fecha_ocurrencia as object), lte: new Date(hasta) };

  const siniestros = await prisma.siniestroEmpleado.findMany({
    where,
    orderBy: { fecha_ocurrencia: 'desc' },
    include: {
      empleado: { select: EMPLEADO_SELECT },
      evento:   { select: EVENTO_SELECT },
      gastos:   { select: { monto: true, monto_cubierto: true, monto_empresa: true } },
    },
  });
  res.json(siniestros.map(mapSiniestro));
}

export async function getSiniestro(req: Request, res: Response) {
  const id = Number(req.params.id);
  const siniestro = await prisma.siniestroEmpleado.findFirst({
    where: { id, deleted_at: null, ...withTenant(req.empresaId!) },
    include: {
      empleado:   { select: EMPLEADO_SELECT },
      evento:     { select: EVENTO_SELECT },
      gastos:     { orderBy: { fecha: 'asc' } },
      documentos: { orderBy: { created_at: 'asc' }, select: { id: true, siniestro_id: true, nombre: true, descripcion: true, archivo_mime: true, created_at: true, created_by: true } },
    },
  });
  if (!siniestro) { res.status(404).json({ error: 'Siniestro no encontrado' }); return; }
  res.json(mapSiniestro(siniestro));
}

export async function createSiniestro(req: Request, res: Response) {
  const parsed = createSiniestroSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return; }

  const empleado = await prisma.empleado.findFirst({ where: { id: parsed.data.empleado_id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!empleado) { res.status(404).json({ error: 'Empleado no encontrado' }); return; }

  if (parsed.data.evento_id) {
    const evento = await prisma.evento.findFirst({ where: { id: parsed.data.evento_id, deleted_at: null, ...withTenant(req.empresaId!) } });
    if (!evento) { res.status(404).json({ error: 'Evento no encontrado' }); return; }
  }

  const siniestro = await prisma.siniestroEmpleado.create({
    data: {
      ...withTenant(req.empresaId!),
      empleado_id:          parsed.data.empleado_id,
      tipo:                 parsed.data.tipo,
      fecha_ocurrencia:     new Date(parsed.data.fecha_ocurrencia),
      descripcion:          parsed.data.descripcion,
      lugar:                parsed.data.lugar ?? null,
      evento_id:            parsed.data.evento_id ?? null,
      art_nombre:           parsed.data.art_nombre ?? null,
      art_numero_siniestro: parsed.data.art_numero_siniestro ?? null,
      fecha_denuncia_art:   parsed.data.fecha_denuncia_art ? new Date(parsed.data.fecha_denuncia_art) : null,
      created_by:           req.user!.id,
    },
    include: { empleado: { select: EMPLEADO_SELECT }, evento: { select: EVENTO_SELECT }, gastos: true },
  });
  res.status(201).json(mapSiniestro(siniestro));
}

export async function updateSiniestro(req: Request, res: Response) {
  const id     = Number(req.params.id);
  const parsed = updateSiniestroSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return; }

  const existing = await prisma.siniestroEmpleado.findFirst({ where: { id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!existing) { res.status(404).json({ error: 'Siniestro no encontrado' }); return; }

  const d = parsed.data;
  const siniestro = await prisma.siniestroEmpleado.update({
    where: { id },
    data: {
      ...(d.tipo                 !== undefined && { tipo: d.tipo }),
      ...(d.fecha_ocurrencia     !== undefined && { fecha_ocurrencia: new Date(d.fecha_ocurrencia) }),
      ...(d.descripcion          !== undefined && { descripcion: d.descripcion }),
      ...(d.lugar                !== undefined && { lugar: d.lugar }),
      ...(d.evento_id            !== undefined && { evento_id: d.evento_id }),
      ...(d.art_nombre           !== undefined && { art_nombre: d.art_nombre }),
      ...(d.art_numero_siniestro !== undefined && { art_numero_siniestro: d.art_numero_siniestro }),
      ...(d.fecha_denuncia_art   !== undefined && { fecha_denuncia_art: d.fecha_denuncia_art ? new Date(d.fecha_denuncia_art) : null }),
      ...(d.estado               !== undefined && { estado: d.estado }),
      ...(d.dias_baja            !== undefined && { dias_baja: d.dias_baja }),
      ...(d.fecha_alta_medica    !== undefined && { fecha_alta_medica: d.fecha_alta_medica ? new Date(d.fecha_alta_medica) : null }),
    },
    include: { empleado: { select: EMPLEADO_SELECT }, evento: { select: EVENTO_SELECT }, gastos: true },
  });
  res.json(mapSiniestro(siniestro));
}

export async function cerrarSiniestro(req: Request, res: Response) {
  const id = Number(req.params.id);
  const existing = await prisma.siniestroEmpleado.findFirst({ where: { id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!existing) { res.status(404).json({ error: 'Siniestro no encontrado' }); return; }
  if (existing.estado === 'CERRADO') { res.status(400).json({ error: 'Este siniestro ya está cerrado' }); return; }

  const siniestro = await prisma.siniestroEmpleado.update({
    where: { id },
    data:  { estado: 'CERRADO' },
    include: { empleado: { select: EMPLEADO_SELECT }, evento: { select: EVENTO_SELECT }, gastos: true },
  });
  res.json(mapSiniestro(siniestro));
}

// ── Gastos del siniestro ──────────────────────────────────────────────────────

const gastoSchema = z.object({
  fecha:          z.string(),
  descripcion:    z.string().min(1),
  monto:          z.number().positive(),
  cubierto_art:   z.boolean().default(false),
  monto_cubierto: z.number().min(0).nullable().optional(),
  monto_empresa:  z.number().min(0).nullable().optional(),
});

export async function addGastoSiniestro(req: Request, res: Response) {
  const siniestroId = Number(req.params.id);
  const parsed = gastoSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return; }

  const siniestro = await prisma.siniestroEmpleado.findFirst({ where: { id: siniestroId, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!siniestro) { res.status(404).json({ error: 'Siniestro no encontrado' }); return; }

  const gasto = await prisma.gastoSiniestro.create({
    data: {
      siniestro_id:   siniestroId,
      fecha:          new Date(parsed.data.fecha),
      descripcion:    parsed.data.descripcion,
      monto:          parsed.data.monto,
      cubierto_art:   parsed.data.cubierto_art,
      monto_cubierto: parsed.data.monto_cubierto ?? null,
      monto_empresa:  parsed.data.monto_empresa  ?? (parsed.data.cubierto_art ? parsed.data.monto - (parsed.data.monto_cubierto ?? 0) : parsed.data.monto),
      created_by:     req.user!.id,
    },
  });
  res.status(201).json(mapGasto(gasto));
}

export async function deleteGastoSiniestro(req: Request, res: Response) {
  const siniestroId = Number(req.params.id);
  const gastoId     = Number(req.params.gastoId);

  const gasto = await prisma.gastoSiniestro.findFirst({
    where: { id: gastoId, siniestro_id: siniestroId, siniestro: { deleted_at: null, ...withTenant(req.empresaId!) } },
  });
  if (!gasto) { res.status(404).json({ error: 'Gasto no encontrado' }); return; }

  await prisma.gastoSiniestro.delete({ where: { id: gastoId } });
  res.json({ message: 'Gasto eliminado correctamente' });
}

// ── Documentos del siniestro ──────────────────────────────────────────────────

export async function subirDocumentoSiniestro(req: Request, res: Response) {
  const siniestroId = Number(req.params.id);
  if (!req.file) { res.status(400).json({ error: 'Se requiere un archivo' }); return; }

  const siniestro = await prisma.siniestroEmpleado.findFirst({ where: { id: siniestroId, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!siniestro) { res.status(404).json({ error: 'Siniestro no encontrado' }); return; }

  const { nombre, descripcion } = req.body as { nombre?: string; descripcion?: string };
  const doc = await prisma.documentoSiniestro.create({
    data: {
      siniestro_id: siniestroId,
      nombre:       nombre?.trim() || req.file.originalname,
      descripcion:  descripcion || null,
      archivo_data: req.file.buffer,
      archivo_mime: req.file.mimetype,
      created_by:   req.user!.id,
    },
  });
  res.status(201).json(mapDocumento(doc));
}

export async function descargarDocumentoSiniestro(req: Request, res: Response) {
  const siniestroId = Number(req.params.id);
  const docId       = Number(req.params.docId);

  const doc = await prisma.documentoSiniestro.findFirst({
    where: { id: docId, siniestro_id: siniestroId, siniestro: { deleted_at: null, ...withTenant(req.empresaId!) } },
  });
  if (!doc) { res.status(404).json({ error: 'Documento no encontrado' }); return; }

  const buffer   = Buffer.from(doc.archivo_data);
  const filename = encodeURIComponent(doc.nombre);
  res.setHeader('Content-Type',        doc.archivo_mime);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length',      buffer.length);
  res.end(buffer);
}

// ── Importador de la planilla "Informe Siniestros Personal" (Lorena) ─────────

export async function importarSiniestros(req: Request, res: Response) {
  if (!req.file) { res.status(400).json({ error: 'Se requiere un archivo .xlsx' }); return; }

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
  } catch (err: any) {
    res.status(400).json({ error: 'Error al procesar el archivo', detail: err.message }); return;
  }

  const resultado = await importarPlanillaSiniestros(workbook, req.empresaId!, req.user!.id);

  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'IMPORT', entidad: 'SiniestroEmpleado',
    descripcion: `Importó planilla de siniestros — ${resultado.creados} creados, ${resultado.actualizados} actualizados`,
    datosDespues: resultado, ip: req.ip, tx: prisma,
  });

  res.json(resultado);
}
