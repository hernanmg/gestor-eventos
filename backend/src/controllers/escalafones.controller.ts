import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { withTenant } from '../lib/tenant';
import { registrarAuditoria } from '../lib/auditoria';

function mapDecimals(e: any) {
  return {
    ...e,
    viatico:            e.viatico            !== null ? Number(e.viatico)            : null,
    premio_presentismo: e.premio_presentismo !== null ? Number(e.premio_presentismo) : null,
    telefono:           e.telefono           !== null ? Number(e.telefono)           : null,
    premio_incentivo:   e.premio_incentivo   !== null ? Number(e.premio_incentivo)   : null,
  };
}

export async function listEscalafones(req: Request, res: Response) {
  const escalafones = await prisma.escalafonAdmin.findMany({
    where:   { ...withTenant(req.empresaId!), deleted_at: null },
    orderBy: { orden: 'asc' },
  });
  res.json(escalafones.map(mapDecimals));
}

// GET /rrhh/escalafones/:nombre/valores — usado para pre-cargar el paso 3 del
// wizard de AcuerdoSueldo. :nombre puede tener espacios ("ADM 1") — el
// frontend lo manda con encodeURIComponent.
export async function getValoresEscalafon(req: Request, res: Response) {
  const nombre = req.params.nombre;
  const escalafon = await prisma.escalafonAdmin.findFirst({
    where: { nombre, deleted_at: null, ...withTenant(req.empresaId!) },
  });
  if (!escalafon) { res.status(404).json({ error: 'Escalafón no encontrado' }); return; }
  res.json(mapDecimals(escalafon));
}

const escalafonSchema = z.object({
  nombre:             z.string().min(1),
  orden:              z.number().int().optional(),
  viatico:            z.number().min(0).nullable().optional(),
  premio_presentismo: z.number().min(0).nullable().optional(),
  telefono:           z.number().min(0).nullable().optional(),
  premio_incentivo:   z.number().min(0).nullable().optional(),
});

export async function createEscalafon(req: Request, res: Response) {
  const parsed = escalafonSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return;
  }
  const d = parsed.data;

  let orden = d.orden;
  if (orden === undefined) {
    const last = await prisma.escalafonAdmin.findFirst({
      where: { ...withTenant(req.empresaId!) }, orderBy: { orden: 'desc' }, select: { orden: true },
    });
    orden = (last?.orden ?? 0) + 1;
  }

  try {
    const escalafon = await prisma.escalafonAdmin.create({
      data: {
        empresa_id:         req.empresaId!,
        nombre:             d.nombre,
        orden,
        viatico:            d.viatico            ?? null,
        premio_presentismo: d.premio_presentismo ?? null,
        telefono:           d.telefono           ?? null,
        premio_incentivo:   d.premio_incentivo   ?? null,
        created_by:         req.user!.id,
      },
    });

    await registrarAuditoria({
      usuarioId:    req.user!.id,
      empresaId:    req.empresaId,
      accion:       'CREATE',
      entidad:      'EscalafonAdmin',
      entidadId:    escalafon.id,
      descripcion:  `Creó el escalafón "${d.nombre}"`,
      datosDespues: d,
      ip:           req.ip,
      tx:           prisma as any,
    });

    res.status(201).json(mapDecimals(escalafon));
  } catch (err: any) {
    if (err.code === 'P2002') {
      res.status(400).json({ error: `Ya existe un escalafón "${d.nombre}" en esta empresa` }); return;
    }
    throw err;
  }
}

const updateEscalafonSchema = escalafonSchema.partial();

export async function updateEscalafon(req: Request, res: Response) {
  const id = Number(req.params.id);
  const parsed = updateEscalafonSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return;
  }
  const d = parsed.data;

  const existing = await prisma.escalafonAdmin.findFirst({ where: { id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!existing) { res.status(404).json({ error: 'Escalafón no encontrado' }); return; }

  const updated = await prisma.escalafonAdmin.update({
    where: { id },
    data: {
      ...(d.nombre             !== undefined && { nombre: d.nombre }),
      ...(d.orden              !== undefined && { orden: d.orden }),
      ...(d.viatico            !== undefined && { viatico: d.viatico }),
      ...(d.premio_presentismo !== undefined && { premio_presentismo: d.premio_presentismo }),
      ...(d.telefono           !== undefined && { telefono: d.telefono }),
      ...(d.premio_incentivo   !== undefined && { premio_incentivo: d.premio_incentivo }),
    },
  });

  await registrarAuditoria({
    usuarioId:    req.user!.id,
    empresaId:    req.empresaId,
    accion:       'UPDATE',
    entidad:      'EscalafonAdmin',
    entidadId:    id,
    descripcion:  `Actualizó valores del escalafón "${existing.nombre}"`,
    datosAntes:   mapDecimals(existing),
    datosDespues: d,
    ip:           req.ip,
    tx:           prisma as any,
  });

  res.json(mapDecimals(updated));
}

export async function deleteEscalafon(req: Request, res: Response) {
  const id = Number(req.params.id);
  const existing = await prisma.escalafonAdmin.findFirst({ where: { id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!existing) { res.status(404).json({ error: 'Escalafón no encontrado' }); return; }

  const acuerdoActivo = await prisma.acuerdoSueldo.findFirst({
    where: { escalafon: existing.nombre, activo: true, ...withTenant(req.empresaId!) },
  });
  if (acuerdoActivo) {
    res.status(400).json({ error: `No se puede eliminar: hay acuerdos activos con el escalafón "${existing.nombre}"` }); return;
  }

  await prisma.escalafonAdmin.update({ where: { id }, data: { deleted_at: new Date() } });

  await registrarAuditoria({
    usuarioId:   req.user!.id,
    empresaId:   req.empresaId,
    accion:      'DELETE',
    entidad:     'EscalafonAdmin',
    entidadId:   id,
    descripcion: `Eliminó el escalafón "${existing.nombre}"`,
    ip:          req.ip,
    tx:          prisma as any,
  });

  res.json({ message: 'Escalafón eliminado correctamente' });
}
