import type { Request, Response } from 'express';
import { z } from 'zod';
import { TipoRubro } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { withTenant } from '../lib/tenant';

// ── GET /rubros ────────────────────────────────────────────────────────────────

export async function listRubros(req: Request, res: Response) {
  const tipo   = req.query.tipo as string | undefined;
  const activo = req.query.activo as string | undefined;
  const inclInactivos = req.query.incluir_inactivos === 'true' && req.user?.rol === 'ADMIN';

  if (tipo && !['EGRESO', 'INGRESO'].includes(tipo)) {
    res.status(400).json({ error: 'tipo debe ser EGRESO o INGRESO' }); return;
  }

  const rubros = await prisma.rubro.findMany({
    where: {
      ...withTenant(req.empresaId!),
      deleted_at: null,
      ...(tipo ? { tipo: tipo as TipoRubro } : {}),
      ...(activo !== undefined ? { activo: activo === 'true' } : (inclInactivos ? {} : { activo: true })),
    },
    orderBy: [{ tipo: 'asc' }, { orden: 'asc' }],
  });
  res.json(rubros);
}

// ── POST /rubros ──────────────────────────────────────────────────────────────

const createSchema = z.object({
  tipo:        z.enum(['EGRESO', 'INGRESO']),
  nombre:      z.string().min(1),
  descripcion: z.string().nullable().optional(),
});

export async function createRubro(req: Request, res: Response) {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'tipo y nombre son requeridos' }); return;
  }
  const { tipo, nombre, descripcion } = parsed.data;
  const empresaId = req.empresaId!;

  const existente = await prisma.rubro.findFirst({
    where: { ...withTenant(empresaId), tipo: tipo as TipoRubro, nombre, deleted_at: null },
  });
  if (existente) {
    res.status(400).json({ error: `Ya existe un rubro "${nombre}" de tipo ${tipo}` }); return;
  }

  const lastOrd = await prisma.rubro.findFirst({
    where:   { ...withTenant(empresaId), tipo: tipo as TipoRubro },
    orderBy: { orden: 'desc' },
    select:  { orden: true },
  });

  const rubro = await prisma.rubro.create({
    data: {
      ...withTenant(empresaId),
      tipo:        tipo as TipoRubro,
      nombre,
      descripcion: descripcion ?? null,
      orden:       (lastOrd?.orden ?? 0) + 1,
      activo:      true,
      es_sistema:  false,
      created_by:  req.user!.id,
    },
  });
  res.status(201).json(rubro);
}

// ── PUT /rubros/:id ───────────────────────────────────────────────────────────

const updateSchema = z.object({
  nombre:      z.string().min(1).optional(),
  descripcion: z.string().nullable().optional(),
  orden:       z.number().int().min(1).optional(),
});

export async function updateRubro(req: Request, res: Response) {
  const id     = Number(req.params.id);
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return;
  }

  const rubro = await prisma.rubro.findFirst({ where: { id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!rubro) { res.status(404).json({ error: 'Rubro no encontrado' }); return; }

  const { nombre, descripcion, orden } = parsed.data;

  if (nombre && nombre !== rubro.nombre) {
    const dup = await prisma.rubro.findFirst({
      where: { ...withTenant(req.empresaId!), tipo: rubro.tipo, nombre, deleted_at: null, id: { not: id } },
    });
    if (dup) { res.status(400).json({ error: `Ya existe un rubro "${nombre}" de tipo ${rubro.tipo}` }); return; }
  }

  const updated = await prisma.rubro.update({
    where: { id },
    data: {
      ...(nombre      !== undefined && { nombre }),
      ...(descripcion !== undefined && { descripcion }),
      ...(orden       !== undefined && { orden }),
    },
  });
  res.json(updated);
}

// ── PATCH /rubros/reordenar ───────────────────────────────────────────────────

const reorderSchema = z.object({
  tipo:  z.enum(['EGRESO', 'INGRESO']),
  orden: z.array(z.object({ id: z.number().int(), orden: z.number().int().min(1) })).min(1),
});

export async function reordenarRubros(req: Request, res: Response) {
  const parsed = reorderSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'tipo y lista de orden son requeridos' }); return;
  }
  const { tipo, orden: items } = parsed.data;

  const ids     = items.map(i => i.id);
  const rubrosDB = await prisma.rubro.findMany({
    where:  { id: { in: ids }, ...withTenant(req.empresaId!), deleted_at: null },
    select: { id: true, tipo: true },
  });
  const wrongType = rubrosDB.some(r => r.tipo !== tipo);
  if (wrongType || rubrosDB.length !== ids.length) {
    res.status(400).json({ error: 'Todos los ids deben pertenecer al mismo tipo' }); return;
  }

  const ordenes  = items.map(i => i.orden).sort((a, b) => a - b);
  const isConsec = ordenes.every((v, i) => v === i + 1);
  if (!isConsec) {
    res.status(400).json({ error: 'Los números de orden deben ser únicos y consecutivos empezando en 1' }); return;
  }

  await prisma.$transaction(
    items.map(i => prisma.rubro.update({ where: { id: i.id }, data: { orden: i.orden } })),
  );

  const updated = await prisma.rubro.findMany({
    where:   { tipo: tipo as TipoRubro, ...withTenant(req.empresaId!), deleted_at: null },
    orderBy: { orden: 'asc' },
  });
  res.json(updated);
}

// ── DELETE /rubros/:id ─────────────────────────────────────────────────────────

export async function deleteRubro(req: Request, res: Response) {
  const id    = Number(req.params.id);
  const rubro = await prisma.rubro.findFirst({ where: { id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!rubro) { res.status(404).json({ error: 'Rubro no encontrado' }); return; }

  if (rubro.es_sistema) {
    res.status(400).json({ error: 'No se puede eliminar un rubro del sistema' }); return;
  }

  const movCount = await prisma.movimiento.count({
    where: { rubro_id: id, deleted_at: null },
  });
  if (movCount > 0) {
    res.status(400).json({ error: 'No se puede eliminar un rubro con movimientos. Desactivalo en su lugar.' }); return;
  }

  await prisma.rubro.update({ where: { id }, data: { deleted_at: new Date() } });
  res.json({ message: 'Rubro eliminado', deleted: true });
}

// ── PATCH /rubros/:id — toggle activo ─────────────────────────────────────────

export async function toggleRubro(req: Request, res: Response) {
  const id    = Number(req.params.id);
  const rubro = await prisma.rubro.findFirst({ where: { id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!rubro) { res.status(404).json({ error: 'Rubro no encontrado' }); return; }

  if (rubro.es_sistema) {
    res.status(400).json({ error: 'Los rubros del sistema no se pueden desactivar' }); return;
  }

  const updated = await prisma.rubro.update({ where: { id }, data: { activo: !rubro.activo } });
  res.json(updated);
}
