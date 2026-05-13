import type { Request, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { Rol } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { registrarAuditoria } from '../lib/auditoria';

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

const accesoSchema = z.object({
  rol: z.enum(['ADMIN', 'OPERADOR', 'VIEWER']),
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

export async function listWithAccesos(_req: Request, res: Response) {
  const usuarios = await prisma.usuario.findMany({
    where:   { deleted_at: null },
    orderBy: { created_at: 'asc' },
    select:  {
      ...SAFE_SELECT,
      eventoAccesos: { select: { evento_id: true, rol: true } },
    },
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

  const usuario = await prisma.$transaction(async tx => {
    const created = await tx.usuario.create({
      data:   { nombre, email, password_hash, rol: rol as Rol },
      select: SAFE_SELECT,
    });
    await registrarAuditoria({
      usuarioId:    req.user!.id,
      accion:       'CREATE',
      entidad:      'Usuario',
      entidadId:    created.id,
      descripcion:  `Creó el usuario "${nombre}" (${email}) con rol ${rol}`,
      datosDespues: { nombre, email, rol },
      ip:           req.ip,
      tx:           tx as any,
    });
    return created;
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

  if (parsed.data.rol && parsed.data.rol !== 'ADMIN' && req.user!.id === id) {
    res.status(400).json({ error: 'No podés quitarte el rol ADMIN a vos mismo' }); return;
  }

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

  const updated = await prisma.$transaction(async tx => {
    const result = await tx.usuario.update({ where: { id }, data, select: SAFE_SELECT });
    await registrarAuditoria({
      usuarioId:    req.user!.id,
      accion:       'UPDATE',
      entidad:      'Usuario',
      entidadId:    id,
      descripcion:  `Actualizó el usuario "${existing.nombre}"`,
      datosAntes:   { nombre: existing.nombre, email: existing.email, rol: existing.rol, activo: existing.activo },
      datosDespues: parsed.data,
      ip:           req.ip,
      tx:           tx as any,
    });
    return result;
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

  await prisma.$transaction(async tx => {
    await tx.usuario.update({ where: { id }, data: { deleted_at: new Date() } });
    await registrarAuditoria({
      usuarioId:   req.user!.id,
      accion:      'DELETE',
      entidad:     'Usuario',
      entidadId:   id,
      descripcion: `Eliminó el usuario "${existing.nombre}" (${existing.email})`,
      datosAntes:  { nombre: existing.nombre, email: existing.email, rol: existing.rol },
      ip:          req.ip,
      tx:          tx as any,
    });
  });

  res.json({ message: 'Usuario eliminado correctamente' });
}

// ── EventoAcceso CRUD ─────────────────────────────────────────────────────────

export async function listAccesos(req: Request, res: Response) {
  const usuarioId = Number(req.params.id);
  const usuario = await prisma.usuario.findFirst({ where: { id: usuarioId, deleted_at: null } });
  if (!usuario) { res.status(404).json({ error: 'Usuario no encontrado' }); return; }

  const accesos = await (prisma as any).eventoAcceso.findMany({
    where:   { usuario_id: usuarioId },
    include: { evento: { select: { id: true, nombre: true, estado: true } } },
    orderBy: { created_at: 'asc' },
  });
  res.json(accesos);
}

export async function createAcceso(req: Request, res: Response) {
  const usuarioId = Number(req.params.id);
  const eventoId  = Number(req.params.eventoId);

  const parsed = accesoSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors });
    return;
  }

  const usuario = await prisma.usuario.findFirst({ where: { id: usuarioId, deleted_at: null } });
  if (!usuario) { res.status(404).json({ error: 'Usuario no encontrado' }); return; }

  const evento = await prisma.evento.findFirst({ where: { id: eventoId, deleted_at: null } });
  if (!evento) { res.status(404).json({ error: 'Evento no encontrado' }); return; }

  const existing = await (prisma as any).eventoAcceso.findUnique({
    where: { usuario_id_evento_id: { usuario_id: usuarioId, evento_id: eventoId } },
  });
  if (existing) { res.status(400).json({ error: 'El usuario ya tiene acceso a este evento' }); return; }

  const acceso = await (prisma as any).eventoAcceso.create({
    data: {
      usuario_id: usuarioId,
      evento_id:  eventoId,
      rol:        parsed.data.rol as Rol,
      created_by: req.user!.id,
    },
    include: { evento: { select: { id: true, nombre: true, estado: true } } },
  });

  await registrarAuditoria({
    usuarioId:    req.user!.id,
    accion:       'CREATE',
    entidad:      'EventoAcceso',
    entidadId:    acceso.id,
    eventoId,
    descripcion:  `Otorgó acceso ${parsed.data.rol} al usuario "${usuario.nombre}" en evento "${evento.nombre}"`,
    datosDespues: { usuario_id: usuarioId, evento_id: eventoId, rol: parsed.data.rol },
    ip:           req.ip,
    tx:           prisma as any,
  });

  res.status(201).json(acceso);
}

export async function updateAcceso(req: Request, res: Response) {
  const usuarioId = Number(req.params.id);
  const eventoId  = Number(req.params.eventoId);

  const parsed = accesoSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors });
    return;
  }

  const existing = await (prisma as any).eventoAcceso.findUnique({
    where: { usuario_id_evento_id: { usuario_id: usuarioId, evento_id: eventoId } },
  });
  if (!existing) { res.status(404).json({ error: 'Acceso no encontrado' }); return; }

  const acceso = await (prisma as any).eventoAcceso.update({
    where: { usuario_id_evento_id: { usuario_id: usuarioId, evento_id: eventoId } },
    data:  { rol: parsed.data.rol as Rol },
    include: { evento: { select: { id: true, nombre: true, estado: true } } },
  });

  await registrarAuditoria({
    usuarioId:    req.user!.id,
    accion:       'UPDATE',
    entidad:      'EventoAcceso',
    entidadId:    acceso.id,
    eventoId,
    descripcion:  `Cambió rol de usuario #${usuarioId} en evento #${eventoId} de ${existing.rol} a ${parsed.data.rol}`,
    datosAntes:   { rol: existing.rol },
    datosDespues: { rol: parsed.data.rol },
    ip:           req.ip,
    tx:           prisma as any,
  });

  res.json(acceso);
}

export async function deleteAcceso(req: Request, res: Response) {
  const usuarioId = Number(req.params.id);
  const eventoId  = Number(req.params.eventoId);

  const existing = await (prisma as any).eventoAcceso.findUnique({
    where: { usuario_id_evento_id: { usuario_id: usuarioId, evento_id: eventoId } },
  });
  if (!existing) { res.status(404).json({ error: 'Acceso no encontrado' }); return; }

  await (prisma as any).eventoAcceso.delete({
    where: { usuario_id_evento_id: { usuario_id: usuarioId, evento_id: eventoId } },
  });

  await registrarAuditoria({
    usuarioId:   req.user!.id,
    accion:      'DELETE',
    entidad:     'EventoAcceso',
    eventoId,
    descripcion: `Revocó acceso de usuario #${usuarioId} en evento #${eventoId} (rol: ${existing.rol})`,
    datosAntes:  { usuario_id: usuarioId, evento_id: eventoId, rol: existing.rol },
    ip:          req.ip,
    tx:          prisma as any,
  });

  res.json({ message: 'Acceso revocado correctamente' });
}
