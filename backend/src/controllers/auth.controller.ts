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

const switchEmpresaSchema = z.object({
  empresaId: z.number().int().positive(),
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

// Empleado vinculado a este usuario, si existe (habilita la vista de
// autoservicio de RRHH para roles VIEWER con carga propia de jornadas).
async function fetchEmpleadoId(usuarioId: number): Promise<number | null> {
  const empleado = await prisma.empleado.findFirst({ where: { usuario_id: usuarioId, deleted_at: null }, select: { id: true } });
  return empleado?.id ?? null;
}

type UsuarioBasico = { id: number; rol: string; empresa_id: number | null };

// Admin global: rol ADMIN sin empresa fija en su fila — puede ver/elegir cualquier empresa activa.
function esAdminGlobal(usuario: UsuarioBasico): boolean {
  return usuario.rol === 'ADMIN' && usuario.empresa_id === null;
}

// Empresas a las que el usuario puede acceder — todas (admin global) o las de su
// UsuarioEmpresaAcceso (usuarios normales, incluso si hoy solo tienen una fila).
async function resolveEmpresasAccesibles(usuario: UsuarioBasico) {
  if (esAdminGlobal(usuario)) {
    return prisma.empresa.findMany({ where: { activo: true }, orderBy: { id: 'asc' } });
  }
  const accesos = await prisma.usuarioEmpresaAcceso.findMany({
    where:   { usuario_id: usuario.id },
    include: { empresa: true },
    orderBy: { id: 'asc' },
  });
  return accesos.map(a => a.empresa).filter(e => e.activo);
}

function mapEmpresa(e: { id: number; nombre: string; nombre_corto: string | null; color_primario: string | null; logo_url: string | null; logo_data?: Buffer | Uint8Array | null }) {
  return {
    id: e.id, nombre: e.nombre, nombre_corto: e.nombre_corto, color_primario: e.color_primario, logo_url: e.logo_url,
    tiene_logo: !!e.logo_data,
  };
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

  const empresas = await resolveEmpresasAccesibles(usuario);
  if (empresas.length === 0) {
    await registrarAuditoria({
      usuarioId:   usuario.id,
      accion:      'LOGIN',
      entidad:     'Usuario',
      entidadId:   usuario.id,
      descripcion: `Intento de login fallido — usuario sin empresa asignada: ${body.email}`,
      ip:          req.ip,
      tx:          prisma as any,
    });
    throw new AppError(403, 'Tu usuario no tiene ninguna empresa asignada. Contactá al administrador');
  }

  // 1 sola empresa accesible → se resuelve automáticamente, sin pantalla de
  // selección. 2+ → empresaId queda null (selección pendiente) hasta que el
  // frontend llame a /auth/switch-empresa.
  const empresaId = empresas.length === 1 ? empresas[0].id : null;

  const token = jwt.sign(
    { id: usuario.id, rol: usuario.rol, empresaId },
    process.env.JWT_SECRET!,
    { expiresIn: '8h' },
  );

  const [accesos, empleadoId] = await Promise.all([
    fetchAccesos(usuario.id),
    fetchEmpleadoId(usuario.id),
    registrarAuditoria({
      usuarioId:    usuario.id,
      empresaId,
      accion:       'LOGIN',
      entidad:      'Usuario',
      entidadId:    usuario.id,
      descripcion:  `Login exitoso: ${body.email}`,
      datosDespues: { id: usuario.id, email: usuario.email, nombre: usuario.nombre, rol: usuario.rol },
      ip:           req.ip,
      tx:           prisma as any,
    }),
  ]);

  const global = esAdminGlobal(usuario);
  // Mayra (y quien se configure) necesita la lista de sus empresas para el
  // selector de la Macro restringida, aunque no sea admin global.
  const necesitaListaEmpresas = global || empresaId === null || usuario.puede_ver_macro;

  res.cookie(COOKIE_NAME, token, cookieOptions());
  res.json({
    id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol, accesos,
    empresaId,
    empresa:              empresaId !== null ? mapEmpresa(empresas.find(e => e.id === empresaId)!) : null,
    empresasDisponibles:  necesitaListaEmpresas ? empresas.map(mapEmpresa) : undefined,
    puedeCambiarEmpresa:  global,
    puedeVerMacro:        usuario.puede_ver_macro,
    areasMacro:           usuario.areas_macro,
    empleadoId,
  });
}

export async function logout(req: Request, res: Response, _next: NextFunction): Promise<void> {
  await registrarAuditoria({
    usuarioId:   req.user?.id ?? null,
    empresaId:   req.user?.empresaId ?? null,
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
    select: {
      id: true, nombre: true, email: true, rol: true, activo: true, empresa_id: true,
      puede_ver_macro: true, areas_macro: true,
    },
  });

  if (!raw || !raw.activo) {
    throw new AppError(401, 'Sesión inválida');
  }

  const [accesos, empleadoId] = await Promise.all([fetchAccesos(req.user!.id), fetchEmpleadoId(req.user!.id)]);
  const empresaId = req.user!.empresaId;
  const global     = esAdminGlobal(raw);

  let empresa: ReturnType<typeof mapEmpresa> | null = null;
  let empresasDisponibles: ReturnType<typeof mapEmpresa>[] | undefined;

  if (empresaId !== null) {
    const e = await prisma.empresa.findFirst({ where: { id: empresaId } });
    empresa = e ? mapEmpresa(e) : null;
  }
  // El admin global siempre necesita la lista completa (para el switcher del
  // sidebar); un usuario normal solo la necesita mientras tiene selección
  // pendiente (empresaId null) — o si tiene puede_ver_macro, para el selector
  // de empresa de la Macro restringida (ver MacroMayra.tsx).
  if (global || empresaId === null || raw.puede_ver_macro) {
    const empresas = await resolveEmpresasAccesibles(raw);
    empresasDisponibles = empresas.map(mapEmpresa);
  }

  res.json({
    id: raw.id, nombre: raw.nombre, email: raw.email, rol: raw.rol, activo: raw.activo,
    accesos,
    empresaId,
    empresa,
    empresasDisponibles,
    puedeCambiarEmpresa: global,
    puedeVerMacro:       raw.puede_ver_macro,
    areasMacro:          raw.areas_macro,
    empleadoId,
  });
}

// POST /auth/switch-empresa — cambia la empresa activa de la sesión.
// Permitido para: admin global (siempre) o usuarios sin empresa aún elegida
// (primera selección tras login con 2+ empresas accesibles). Un usuario
// normal que ya tiene empresa fijada en la sesión no puede volver a cambiar
// hasta cerrar sesión.
export async function switchEmpresa(req: Request, res: Response): Promise<void> {
  const parsed = switchEmpresaSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'empresaId es requerido' }); return;
  }

  const usuario = await prisma.usuario.findFirst({ where: { id: req.user!.id, deleted_at: null } });
  if (!usuario || !usuario.activo) { res.status(401).json({ error: 'Sesión inválida' }); return; }

  const global = esAdminGlobal(usuario);
  if (!global && req.user!.empresaId !== null) {
    res.status(403).json({ error: 'No podés cambiar de empresa en esta sesión' }); return;
  }

  let empresaDestino: { id: number; nombre: string; nombre_corto: string | null; color_primario: string | null; logo_url: string | null; activo: boolean } | null;

  if (global) {
    empresaDestino = await prisma.empresa.findFirst({ where: { id: parsed.data.empresaId, activo: true } });
  } else {
    const acceso = await prisma.usuarioEmpresaAcceso.findUnique({
      where:   { usuario_id_empresa_id: { usuario_id: usuario.id, empresa_id: parsed.data.empresaId } },
      include: { empresa: true },
    });
    empresaDestino = acceso && acceso.empresa.activo ? acceso.empresa : null;
  }

  if (!empresaDestino) { res.status(403).json({ error: 'No tenés acceso a esa empresa' }); return; }

  const token = jwt.sign(
    { id: usuario.id, rol: usuario.rol, empresaId: empresaDestino.id },
    process.env.JWT_SECRET!,
    { expiresIn: '8h' },
  );
  res.cookie(COOKIE_NAME, token, cookieOptions());

  const [accesos, empleadoId] = await Promise.all([fetchAccesos(usuario.id), fetchEmpleadoId(usuario.id)]);

  await registrarAuditoria({
    usuarioId:   usuario.id,
    empresaId:   empresaDestino.id,
    accion:      'SWITCH_EMPRESA',
    entidad:     'Usuario',
    entidadId:   usuario.id,
    descripcion: `Cambió a la empresa "${empresaDestino.nombre}"`,
    ip:          req.ip,
    tx:          prisma as any,
  });

  const empresasDisponibles = global
    ? (await resolveEmpresasAccesibles(usuario)).map(mapEmpresa)
    : undefined;

  res.json({
    id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol, accesos,
    empresaId:           empresaDestino.id,
    empresa:             mapEmpresa(empresaDestino),
    empresasDisponibles,
    puedeCambiarEmpresa: global,
    puedeVerMacro:       usuario.puede_ver_macro,
    areasMacro:          usuario.areas_macro,
    empleadoId,
  });
}
