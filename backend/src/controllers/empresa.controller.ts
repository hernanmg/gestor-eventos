import type { Request, Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { prisma } from '../lib/prisma';

// ── Multer logo ───────────────────────────────────────────────────────────────

export const uploadLogo = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 2 * 1024 * 1024 }, // 2 MB
  fileFilter: (_req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) cb(null, true);
    else cb(new Error('Solo se aceptan imágenes JPEG, PNG o WEBP'));
  },
});

// ── Validation ────────────────────────────────────────────────────────────────

const empresaUpdateSchema = z.object({
  nombre:           z.string().min(1).optional(),
  nombre_corto:     z.string().nullable().optional(),
  razon_social:     z.string().nullable().optional(),
  cuit:             z.string().regex(/^\d{2}-\d{8}-\d{1}$/, 'Formato inválido. Debe ser XX-XXXXXXXX-X').nullable().optional(),
  domicilio:        z.string().nullable().optional(),
  telefono:         z.string().nullable().optional(),
  email:            z.union([z.string().email('Email inválido'), z.literal('')]).nullable().optional(),
  web:              z.string().nullable().optional(),
  color_primario:   z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Formato hex inválido (#RRGGBB)').nullable().optional(),
  color_secundario: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Formato hex inválido (#RRGGBB)').nullable().optional(),
  moneda_default:   z.enum(['ARS', 'USD']).optional(),
  timezone:         z.string().optional(),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function mapEmpresaDetalle(e: any) {
  return { ...e, logo_data: undefined }; // nunca enviar los bytes en list/detail
}

// ── GET /api/empresas ─────────────────────────────────────────────────────────

export async function listEmpresas(_req: Request, res: Response) {
  const empresas = await prisma.empresa.findMany({ orderBy: { id: 'asc' } });
  res.json(empresas.map(mapEmpresaDetalle));
}

// ── GET /api/empresas/:id ─────────────────────────────────────────────────────

export async function getEmpresa(req: Request, res: Response) {
  const id = Number(req.params.id);
  const empresa = await prisma.empresa.findUnique({ where: { id } });
  if (!empresa) { res.status(404).json({ error: 'Empresa no encontrada' }); return; }
  res.json(mapEmpresaDetalle(empresa));
}

// ── PUT /api/empresas/:id ─────────────────────────────────────────────────────

export async function updateEmpresa(req: Request, res: Response) {
  const id = Number(req.params.id);
  const empresa = await prisma.empresa.findUnique({ where: { id } });
  if (!empresa) { res.status(404).json({ error: 'Empresa no encontrada' }); return; }

  const parsed = empresaUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return;
  }
  const d = parsed.data;

  if (d.cuit) {
    const existente = await prisma.empresa.findFirst({ where: { cuit: d.cuit, id: { not: id } } });
    if (existente) { res.status(400).json({ error: 'Ya existe otra empresa con ese CUIT' }); return; }
  }

  const updated = await prisma.empresa.update({
    where: { id },
    data: {
      ...(d.nombre           !== undefined && { nombre:           d.nombre }),
      ...(d.nombre_corto     !== undefined && { nombre_corto:     d.nombre_corto }),
      ...(d.razon_social     !== undefined && { razon_social:     d.razon_social }),
      ...(d.cuit             !== undefined && { cuit:             d.cuit }),
      ...(d.domicilio        !== undefined && { domicilio:        d.domicilio }),
      ...(d.telefono         !== undefined && { telefono:         d.telefono }),
      ...(d.email            !== undefined && { email:            d.email || null }),
      ...(d.web              !== undefined && { web:              d.web }),
      ...(d.color_primario   !== undefined && { color_primario:   d.color_primario }),
      ...(d.color_secundario !== undefined && { color_secundario: d.color_secundario }),
      ...(d.moneda_default   !== undefined && { moneda_default:   d.moneda_default }),
      ...(d.timezone         !== undefined && { timezone:         d.timezone }),
      updated_by: req.user!.id,
    },
  });
  res.json(mapEmpresaDetalle(updated));
}

// ── PUT /api/empresas/:id/logo ────────────────────────────────────────────────

export async function updateLogo(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (!req.file) { res.status(400).json({ error: 'Se requiere una imagen' }); return; }

  const empresa = await prisma.empresa.findUnique({ where: { id } });
  if (!empresa) { res.status(404).json({ error: 'Empresa no encontrada' }); return; }

  await prisma.empresa.update({
    where: { id },
    data: {
      logo_data:   req.file.buffer,
      logo_nombre: req.file.originalname,
      logo_mime:   req.file.mimetype,
      updated_by:  req.user!.id,
    },
  });
  res.json({ message: 'Logo actualizado correctamente' });
}

// ── GET /api/empresas/:id/logo ────────────────────────────────────────────────

export async function getLogo(req: Request, res: Response) {
  const id = Number(req.params.id);
  const empresa = await prisma.empresa.findUnique({
    where:  { id },
    select: { logo_data: true, logo_mime: true, logo_nombre: true },
  });
  if (!empresa)          { res.status(404).json({ error: 'Empresa no encontrada' }); return; }
  if (!empresa.logo_data) { res.status(404).json({ error: 'Esta empresa no tiene logo' }); return; }

  const buffer   = Buffer.from(empresa.logo_data);
  const filename = encodeURIComponent(empresa.logo_nombre ?? 'logo');

  res.setHeader('Content-Type',        empresa.logo_mime ?? 'application/octet-stream');
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  res.setHeader('Content-Length',      buffer.length);
  res.end(buffer);
}

// ── GET /api/empresa/actual ───────────────────────────────────────────────────

export async function getEmpresaActual(req: Request, res: Response) {
  const empresaId = req.empresaId!;

  const [empresa, usuariosActivos, eventosCount] = await Promise.all([
    prisma.empresa.findUnique({ where: { id: empresaId } }),
    prisma.usuario.count({ where: { empresa_id: empresaId, activo: true, deleted_at: null } }),
    prisma.evento.count({ where: { empresa_id: empresaId, deleted_at: null } }),
  ]);
  if (!empresa) { res.status(404).json({ error: 'Empresa no encontrada' }); return; }

  res.json({
    ...mapEmpresaDetalle(empresa),
    usuarios_activos_count: usuariosActivos,
    eventos_count:          eventosCount,
  });
}
