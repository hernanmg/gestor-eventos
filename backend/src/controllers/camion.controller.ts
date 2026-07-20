import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { registrarAuditoria } from '../lib/auditoria';
import { withTenant } from '../lib/tenant';

const camionSchema = z.object({
  codigo:      z.string().min(1),
  descripcion: z.string().nullable().optional(),
  patente:     z.string().nullable().optional(),
  tipo:        z.string().nullable().optional(),
  activo:      z.boolean().optional(),
});

export async function listCamiones(req: Request, res: Response) {
  const camiones = await prisma.camion.findMany({
    where:   { deleted_at: null, ...withTenant(req.empresaId!) },
    orderBy: { codigo: 'asc' },
  });
  res.json(camiones);
}

export async function createCamion(req: Request, res: Response) {
  const parsed = camionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return;
  }
  const { codigo, descripcion, patente, tipo } = parsed.data;

  const dupe = await prisma.camion.findFirst({ where: { codigo, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (dupe) { res.status(400).json({ error: 'Ya existe un camión con ese código' }); return; }

  const camion = await prisma.camion.create({
    data: { ...withTenant(req.empresaId!), codigo, descripcion: descripcion ?? null, patente: patente ?? null, tipo: tipo ?? null },
  });

  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'CREATE', entidad: 'Camion', entidadId: camion.id,
    descripcion: `Creó camión "${codigo}"`, datosDespues: { codigo, patente, tipo }, ip: req.ip, tx: prisma,
  });

  res.status(201).json(camion);
}

export async function updateCamion(req: Request, res: Response) {
  const id     = Number(req.params.id);
  const parsed = camionSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return;
  }

  const existing = await prisma.camion.findFirst({ where: { id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!existing) { res.status(404).json({ error: 'Camión no encontrado' }); return; }

  const { codigo, descripcion, patente, tipo, activo } = parsed.data;

  if (codigo && codigo !== existing.codigo) {
    const dupe = await prisma.camion.findFirst({ where: { codigo, deleted_at: null, ...withTenant(req.empresaId!) } });
    if (dupe) { res.status(400).json({ error: 'Ya existe un camión con ese código' }); return; }
  }

  const camion = await prisma.camion.update({
    where: { id },
    data: {
      ...(codigo      !== undefined && { codigo }),
      ...(descripcion !== undefined && { descripcion }),
      ...(patente     !== undefined && { patente }),
      ...(tipo        !== undefined && { tipo }),
      ...(activo      !== undefined && { activo }),
    },
  });

  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'UPDATE', entidad: 'Camion', entidadId: id,
    descripcion: `Actualizó camión "${existing.codigo}"`, datosAntes: { codigo: existing.codigo }, datosDespues: parsed.data,
    ip: req.ip, tx: prisma,
  });

  res.json(camion);
}

export async function deleteCamion(req: Request, res: Response) {
  const id = Number(req.params.id);

  const existing = await prisma.camion.findFirst({ where: { id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!existing) { res.status(404).json({ error: 'Camión no encontrado' }); return; }

  const activas = await prisma.asignacionStock.count({ where: { camion_id: id, estado: 'ACTIVA', deleted_at: null } });
  if (activas > 0) { res.status(400).json({ error: 'No se puede eliminar un camión con asignaciones activas' }); return; }

  await prisma.camion.update({ where: { id }, data: { deleted_at: new Date(), activo: false } });

  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'DELETE', entidad: 'Camion', entidadId: id,
    descripcion: `Eliminó camión "${existing.codigo}"`, datosAntes: { codigo: existing.codigo }, ip: req.ip, tx: prisma,
  });

  res.json({ message: 'Camión eliminado correctamente' });
}
