import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';

export async function listTabs(_req: Request, res: Response) {
  const tabs = await prisma.tabConfig.findMany({
    orderBy: [{ tipo: 'asc' }, { numero: 'asc' }],
  });
  res.json(tabs);
}

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
