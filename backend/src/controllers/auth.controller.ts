import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';

const loginSchema = z.object({
  email:    z.string().email('Email inválido'),
  password: z.string().min(1, 'La contraseña es requerida'),
});

const COOKIE_NAME = 'token';

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'strict' as const,
    maxAge:   8 * 60 * 60 * 1000, // 8 horas en ms
    secure:   process.env.NODE_ENV === 'production',
    path:     '/',
  };
}

export async function login(req: Request, res: Response, _next: NextFunction): Promise<void> {
  // ZodError se propaga al asyncHandler → errorHandler (devuelve 400)
  const body = loginSchema.parse(req.body);

  const usuario = await prisma.usuario.findFirst({
    where: { email: body.email, deleted_at: null },
  });

  // Mismo mensaje para usuario no encontrado y password incorrecta — evita enumerar usuarios
  if (!usuario) {
    throw new AppError(401, 'Credenciales incorrectas');
  }

  if (!usuario.activo) {
    throw new AppError(403, 'Usuario inactivo. Contactá al administrador');
  }

  const coincide = await bcrypt.compare(body.password, usuario.password_hash);
  if (!coincide) {
    throw new AppError(401, 'Credenciales incorrectas');
  }

  const token = jwt.sign(
    { id: usuario.id, rol: usuario.rol },
    process.env.JWT_SECRET!,
    { expiresIn: '8h' },
  );

  res.cookie(COOKIE_NAME, token, cookieOptions());
  res.json({ id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol });
}

export async function logout(_req: Request, res: Response, _next: NextFunction): Promise<void> {
  res.clearCookie(COOKIE_NAME, { httpOnly: true, sameSite: 'strict', path: '/' });
  res.json({ message: 'Sesión cerrada' });
}

export async function me(req: Request, res: Response, _next: NextFunction): Promise<void> {
  const usuario = await prisma.usuario.findFirst({
    where:  { id: req.user!.id, deleted_at: null },
    select: { id: true, nombre: true, email: true, rol: true, activo: true },
  });

  if (!usuario || !usuario.activo) {
    throw new AppError(401, 'Sesión inválida');
  }

  res.json(usuario);
}
