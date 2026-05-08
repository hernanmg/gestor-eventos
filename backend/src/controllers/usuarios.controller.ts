import type { Request, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { Rol } from '@prisma/client';
import { prisma } from '../lib/prisma';

// ── Helpers ───────────────────────────────────────────────────────────────────

const SAFE_SELECT = {
  id: true, email: true, nombre: true, rol: true,
  activo: true, created_at: true, updated_at: true, deleted_at: true,
};

// ── Schemas ───────────────────────────────────────────────────────────────────

const createSchema = z.object({
  nombre:   z.string().min(1, 'Nombre requerido'),
  email:    z.string().email('Email inválido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  rol:      z.enum(['ADMIN', 'OPERADOR', 'VIEWER']).default('OPERADOR'),
});

const updateSchema = z.object({
  nombre:   z.string().min(1).optional(),
  email:    z.string().email().optional(),
  password: z.string().min(8).optional(),
  rol:      z.enum(['ADMIN', 'OPERADOR', 'VIEWER']).optional(),
  activo:   z.boolean().optional(),
});

// ── Controllers ───────────────────────────────────────────────────────────────

export async function list(_req: Request, res: Response) {
  const usuarios = await prisma.usuario.findMany({
    where:   { deleted_at: null },
    orderBy: { created_at: 'asc' },
    select:  SAFE_SELECT,
  });
  res.json(usuarios);
}

export async function create(req: Request, res: Response) {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors });
    return;
  }

  const { nombre, email, password, rol } = parsed.data;

  const exists = await prisma.usuario.findFirst({ where: { email, deleted_at: null } });
  if (exists) { res.status(400).json({ error: 'Ya existe un usuario con ese email' }); return; }

  const password_hash = await bcrypt.hash(password, 10);

  const usuario = await prisma.usuario.create({
    data:   { nombre, email, password_hash, rol: rol as Rol },
    select: SAFE_SELECT,
  });
  res.status(201).json(usuario);
}

export async function update(req: Request, res: Response) {
  const id     = Number(req.params.id);
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors });
    return;
  }

  const existing = await prisma.usuario.findFirst({ where: { id, deleted_at: null } });
  if (!existing) { res.status(404).json({ error: 'Usuario no encontrado' }); return; }

  // Prevent self-demotion from ADMIN
  if (parsed.data.rol && parsed.data.rol !== 'ADMIN' && req.user!.id === id) {
    res.status(400).json({ error: 'No podés quitarte el rol ADMIN a vos mismo' }); return;
  }

  // Unique email check
  if (parsed.data.email && parsed.data.email !== existing.email) {
    const dupe = await prisma.usuario.findFirst({ where: { email: parsed.data.email, deleted_at: null } });
    if (dupe) { res.status(400).json({ error: 'Ya existe un usuario con ese email' }); return; }
  }

  const { nombre, email, password, rol, activo } = parsed.data;

  const data: Record<string, unknown> = {
    ...(nombre  !== undefined && { nombre }),
    ...(email   !== undefined && { email }),
    ...(rol     !== undefined && { rol: rol as Rol }),
    ...(activo  !== undefined && { activo }),
  };
  if (password) data.password_hash = await bcrypt.hash(password, 10);

  const updated = await prisma.usuario.update({
    where:  { id },
    data,
    select: SAFE_SELECT,
  });
  res.json(updated);
}

export async function remove(req: Request, res: Response) {
  const id = Number(req.params.id);

  if (req.user!.id === id) {
    res.status(400).json({ error: 'No podés eliminar tu propio usuario' }); return;
  }

  const existing = await prisma.usuario.findFirst({ where: { id, deleted_at: null } });
  if (!existing) { res.status(404).json({ error: 'Usuario no encontrado' }); return; }

  await prisma.usuario.update({ where: { id }, data: { deleted_at: new Date() } });
  res.json({ message: 'Usuario eliminado correctamente' });
}
