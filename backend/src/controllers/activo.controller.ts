import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { registrarAuditoria } from '../lib/auditoria';
import { withTenant } from '../lib/tenant';
import type { Prisma, EstadoActivo } from '@prisma/client';

const activoSchema = z.object({
  nombre:        z.string().min(1),
  descripcion:   z.string().nullable().optional(),
  categoria:     z.string().nullable().optional(),
  numero_serie:  z.string().nullable().optional(),
  fecha_compra:  z.string().nullable().optional(),
  valor_compra:  z.number().nonnegative().nullable().optional(),
  estado:        z.enum(['BUENO', 'REGULAR', 'DETERIORADO', 'BAJA']).optional(),
  ubicacion:     z.string().nullable().optional(),
  observaciones: z.string().nullable().optional(),
});

function toDate(s: string | null | undefined): Date | null { return s ? new Date(s) : null; }

export async function listActivos(req: Request, res: Response) {
  const categoria = typeof req.query.categoria === 'string' ? req.query.categoria : undefined;
  const estado    = typeof req.query.estado    === 'string' ? req.query.estado as EstadoActivo : undefined;

  const where: Prisma.ActivoWhereInput = { deleted_at: null, ...withTenant(req.empresaId!) };
  if (categoria) where.categoria = categoria;
  if (estado)    where.estado    = estado;

  const activos = await prisma.activo.findMany({ where, orderBy: { nombre: 'asc' } });
  res.json(activos);
}

export async function createActivo(req: Request, res: Response) {
  const parsed = activoSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return;
  }
  const { nombre, descripcion, categoria, numero_serie, fecha_compra, valor_compra, estado, ubicacion, observaciones } = parsed.data;

  const activo = await prisma.activo.create({
    data: {
      ...withTenant(req.empresaId!),
      nombre, descripcion: descripcion ?? null, categoria: categoria ?? null,
      numero_serie: numero_serie ?? null, fecha_compra: toDate(fecha_compra),
      valor_compra: valor_compra ?? null, estado: estado ?? 'BUENO',
      ubicacion: ubicacion ?? null, observaciones: observaciones ?? null,
      created_by: req.user!.id,
    },
  });

  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'CREATE', entidad: 'Activo', entidadId: activo.id,
    descripcion: `Creó activo "${nombre}"`, datosDespues: { nombre, categoria }, ip: req.ip, tx: prisma,
  });

  res.status(201).json(activo);
}

export async function updateActivo(req: Request, res: Response) {
  const id     = Number(req.params.id);
  const parsed = activoSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return;
  }

  const existing = await prisma.activo.findFirst({ where: { id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!existing) { res.status(404).json({ error: 'Activo no encontrado' }); return; }

  const { nombre, descripcion, categoria, numero_serie, fecha_compra, valor_compra, estado, ubicacion, observaciones } = parsed.data;

  const activo = await prisma.activo.update({
    where: { id },
    data: {
      ...(nombre        !== undefined && { nombre }),
      ...(descripcion   !== undefined && { descripcion }),
      ...(categoria     !== undefined && { categoria }),
      ...(numero_serie  !== undefined && { numero_serie }),
      ...(fecha_compra  !== undefined && { fecha_compra: toDate(fecha_compra) }),
      ...(valor_compra  !== undefined && { valor_compra }),
      ...(estado        !== undefined && { estado }),
      ...(ubicacion     !== undefined && { ubicacion }),
      ...(observaciones !== undefined && { observaciones }),
    },
  });

  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'UPDATE', entidad: 'Activo', entidadId: id,
    descripcion: `Actualizó activo "${existing.nombre}"`, datosAntes: { nombre: existing.nombre, estado: existing.estado },
    datosDespues: parsed.data, ip: req.ip, tx: prisma,
  });

  res.json(activo);
}

export async function deleteActivo(req: Request, res: Response) {
  const id = Number(req.params.id);

  const existing = await prisma.activo.findFirst({ where: { id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!existing) { res.status(404).json({ error: 'Activo no encontrado' }); return; }

  await prisma.activo.update({ where: { id }, data: { deleted_at: new Date() } });

  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'DELETE', entidad: 'Activo', entidadId: id,
    descripcion: `Eliminó activo "${existing.nombre}"`, datosAntes: { nombre: existing.nombre }, ip: req.ip, tx: prisma,
  });

  res.json({ message: 'Activo eliminado correctamente' });
}
