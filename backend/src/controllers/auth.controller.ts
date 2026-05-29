import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { registrarAuditoria } from '../lib/auditoria';

const loginSchema = z.object({
  email:    z.string().email('Email inválido'),
  password: z.string().min(1, 'La contraseña es requerida'),
});

const COOKIE_NAME = 'token';

function cookieOptions() {
  return {
    httpOnly: true,
    secure:   true,
    sameSite: 'none' as const,
    maxAge:   8 * 60 * 60 * 1000,
    path:     '/',
  };
}

async function fetchAccesos(usuarioId: number) {
  return (prisma as any).eventoAcceso.findMany({
    where:  { usuario_id: usuarioId },
    select: { evento_id: true, rol: true },
  });
}

export async function login(req: Request, res: Response, _next: NextFunction): Promise<void> {
  const body = loginSchema.parse(req.body);

  const usuario = await prisma.usuario.findFirst({
    where: { email: body.email, deleted_at: null },
  });

  if (!usuario) {
    await registrarAuditoria({
      usuarioId:   null,
      accion:      'LOGIN',
      entidad:     'Usuario',
      descripcion: `Intento de login fallido — email no encontrado: ${body.email}`,
      ip:          req.ip,
      tx:          prisma as any,
    });
    throw new AppError(401, 'Credenciales incorrectas');
  }

  if (!usuario.activo) {
    await registrarAuditoria({
      usuarioId:   usuario.id,
      accion:      'LOGIN',
      entidad:     'Usuario',
      entidadId:   usuario.id,
      descripcion: `Intento de login fallido — usuario inactivo: ${body.email}`,
      ip:          req.ip,
      tx:          prisma as any,
    });
    throw new AppError(403, 'Usuario inactivo. Contactá al administrador');
  }

  const coincide = await bcrypt.compare(body.password, usuario.password_hash);
  if (!coincide) {
    await registrarAuditoria({
      usuarioId:   usuario.id,
      accion:      'LOGIN',
      entidad:     'Usuario',
      entidadId:   usuario.id,
      descripcion: `Intento de login fallido — contraseña incorrecta: ${body.email}`,
      ip:          req.ip,
      tx:          prisma as any,
    });
    throw new AppError(401, 'Credenciales incorrectas');
  }

  const token = jwt.sign(
    { id: usuario.id, rol: usuario.rol },
    process.env.JWT_SECRET!,
    { expiresIn: '8h' },
  );

  const [accesos] = await Promise.all([
    fetchAccesos(usuario.id),
    registrarAuditoria({
      usuarioId:    usuario.id,
      accion:       'LOGIN',
      entidad:      'Usuario',
      entidadId:    usuario.id,
      descripcion:  `Login exitoso: ${body.email}`,
      datosDespues: { id: usuario.id, email: usuario.email, nombre: usuario.nombre, rol: usuario.rol },
      ip:           req.ip,
      tx:           prisma as any,
    }),
  ]);

  res.cookie(COOKIE_NAME, token, cookieOptions());
  res.json({ id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol, accesos });
}

export async function logout(req: Request, res: Response, _next: NextFunction): Promise<void> {
  await registrarAuditoria({
    usuarioId:   req.user?.id ?? null,
    accion:      'LOGOUT',
    entidad:     'Usuario',
    entidadId:   req.user?.id,
    descripcion: `Logout de usuario #${req.user?.id ?? 'desconocido'}`,
    ip:          req.ip,
    tx:          prisma as any,
  });
  res.clearCookie(COOKIE_NAME, { httpOnly: true, secure: true, sameSite: 'none', path: '/' });
  res.json({ message: 'Sesión cerrada' });
}

export async function me(req: Request, res: Response, _next: NextFunction): Promise<void> {
  const raw = await prisma.usuario.findFirst({
    where:  { id: req.user!.id, deleted_at: null },
    select: { id: true, nombre: true, email: true, rol: true, activo: true },
  });

  if (!raw || !raw.activo) {
    throw new AppError(401, 'Sesión inválida');
  }

  const accesos = await fetchAccesos(req.user!.id);
  res.json({ ...raw, accesos });
}
