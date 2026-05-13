import type { Request, Response } from 'express';
import { z } from 'zod';
import { Tipo } from '@prisma/client';
import { prisma } from '../lib/prisma';

// ── GET /configuracion/tabs ───────────────────────────────────────────────────

export async function listTabs(req: Request, res: Response) {
  const inclInactivas = req.query.incluir_inactivas === 'true' && req.user?.rol === 'ADMIN';

  const tabs = await prisma.tabConfig.findMany({
    where:   inclInactivas ? undefined : { activo: true },
    orderBy: [{ tipo: 'asc' }, { orden: 'asc' }],
  });
  res.json(tabs);
}

// ── PUT /configuracion/tabs/:id ───────────────────────────────────────────────

export async function updateTab(req: Request, res: Response) {
  const id     = Number(req.params.id);
  const parsed = z.object({ nombre: z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'nombre es requerido' }); return;
  }

  const tab = await prisma.tabConfig.findUnique({ where: { id } });
  if (!tab) { res.status(404).json({ error: 'Pestaña no encontrada' }); return; }

  const updated = await prisma.tabConfig.update({
    where: { id },
    data:  { nombre: parsed.data.nombre },
  });
  res.json(updated);
}

// ── POST /configuracion/tabs ──────────────────────────────────────────────────

export async function createTab(req: Request, res: Response) {
  const parsed = z.object({
    tipo:   z.enum(['EGRESO', 'INGRESO']),
    nombre: z.string().min(1),
  }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'tipo y nombre son requeridos' }); return;
  }

  const { tipo, nombre } = parsed.data;

  // Check max 10 tabs per tipo
  const count = await prisma.tabConfig.count({ where: { tipo: tipo as Tipo } });
  if (count >= 10) {
    res.status(400).json({ error: `Ya hay ${count} pestañas de tipo ${tipo}. Máximo permitido: 10` });
    return;
  }

  // Auto-assign numero and orden
  const [lastNum, lastOrd] = await Promise.all([
    prisma.tabConfig.findFirst({ where: { tipo: tipo as Tipo }, orderBy: { numero: 'desc' }, select: { numero: true } }),
    prisma.tabConfig.findFirst({ where: { tipo: tipo as Tipo }, orderBy: { orden: 'desc' },  select: { orden: true } }),
  ]);
  const numero = (lastNum?.numero ?? 0) + 1;
  const orden  = (lastOrd?.orden  ?? 0) + 1;

  const codigo = `CUSTOM-${tipo}-${Date.now()}`;

  const tab = await prisma.tabConfig.create({
    data: { tipo: tipo as Tipo, numero, nombre, codigo, orden, activo: true, es_sistema: false },
  });
  res.status(201).json(tab);
}

// ── DELETE /configuracion/tabs/:id ────────────────────────────────────────────

export async function deleteTab(req: Request, res: Response) {
  const id  = Number(req.params.id);
  const tab = await prisma.tabConfig.findUnique({ where: { id } });
  if (!tab) { res.status(404).json({ error: 'Pestaña no encontrada' }); return; }

  if (tab.es_sistema) {
    res.status(400).json({ error: 'Las tabs del sistema no se pueden eliminar' }); return;
  }

  // Check for associated movimientos
  const movCount = await prisma.movimiento.count({
    where: { tipo: tab.tipo, tab_numero: tab.numero, deleted_at: null },
  });

  if (movCount === 0) {
    await prisma.tabConfig.delete({ where: { id } });
    res.json({ message: 'Pestaña eliminada', deleted: true });
  } else {
    await prisma.tabConfig.update({ where: { id }, data: { activo: false } });
    res.json({ message: 'No se puede eliminar una tab con movimientos. Desactivala en su lugar.', deleted: false, disabled: true });
  }
}

// ── PATCH /configuracion/tabs/reordenar ──────────────────────────────────────

export async function reorderTabs(req: Request, res: Response) {
  const parsed = z.object({
    tipo:  z.enum(['EGRESO', 'INGRESO']),
    orden: z.array(z.object({ id: z.number().int(), orden: z.number().int().min(1) })).min(1),
  }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'tipo y lista de orden son requeridos' }); return;
  }

  const { tipo, orden: items } = parsed.data;

  // Validate all ids belong to this tipo
  const ids     = items.map(i => i.id);
  const tabsDB  = await prisma.tabConfig.findMany({ where: { id: { in: ids } }, select: { id: true, tipo: true } });
  const wrongType = tabsDB.some(t => t.tipo !== tipo);
  if (wrongType || tabsDB.length !== ids.length) {
    res.status(400).json({ error: 'Todos los ids deben pertenecer al mismo tipo' }); return;
  }

  // Validate orden numbers are unique and consecutive starting at 1
  const ordenes = items.map(i => i.orden).sort((a, b) => a - b);
  const isConsec = ordenes.every((v, i) => v === i + 1);
  if (!isConsec) {
    res.status(400).json({ error: 'Los números de orden deben ser únicos y consecutivos empezando en 1' }); return;
  }

  await prisma.$transaction(
    items.map(i => prisma.tabConfig.update({ where: { id: i.id }, data: { orden: i.orden } })),
  );

  const updated = await prisma.tabConfig.findMany({
    where:   { tipo: tipo as Tipo },
    orderBy: { orden: 'asc' },
  });
  res.json(updated);
}

// ── PATCH /configuracion/tabs/:id — toggle activo ────────────────────────────

export async function toggleTab(req: Request, res: Response) {
  const id  = Number(req.params.id);
  const tab = await prisma.tabConfig.findUnique({ where: { id } });
  if (!tab) { res.status(404).json({ error: 'Pestaña no encontrada' }); return; }

  if (tab.es_sistema) {
    res.status(400).json({ error: 'Las tabs del sistema no se pueden desactivar' }); return;
  }

  const updated = await prisma.tabConfig.update({
    where: { id },
    data:  { activo: !tab.activo },
  });
  res.json(updated);
}
