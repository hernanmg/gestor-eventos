import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { AuthUser } from '../types/express';

// JORNALERO y PAÑOLERO tienen acceso a un puñado fijo de endpoints — a
// diferencia de ADMIN/OPERADOR/VIEWER, que se rigen por la jerarquía de
// requireRole.ts. Cada router de la app aplica su propio `auth` +
// `tenantMiddleware` (no hay un `auth` global en app.ts), así que este gate
// decodifica el JWT por su cuenta para poder cortar ANTES de entrar a
// cualquier router — así no hace falta tocar los ~20 archivos de rutas
// existentes para bloquear "todo lo demás" en estos dos roles.
// Si el token falta o es inválido, no hace nada: el `auth` del router
// correspondiente se encarga de devolver el 401.

type Rule = { method: string; pattern: RegExp };

const JORNALERO_ALLOW: Rule[] = [
  { method: 'GET',  pattern: /^\/api\/auth\/me$/ },
  { method: 'GET',  pattern: /^\/api\/rrhh\/jornadas$/ },
  { method: 'POST', pattern: /^\/api\/rrhh\/jornadas$/ },
  // Lista y detalle por fecha, no /:id/exportar (ver propio, no el Excel completo)
  { method: 'GET',  pattern: /^\/api\/parte-diario(\/[^/]+)?$/ },
];

const PANOLERO_ALLOW: Rule[] = [
  { method: 'GET',    pattern: /^\/api\/auth\/me$/ },
  { method: 'GET',    pattern: /^\/api\/panol\/items(\/\d+)?$/ },
  { method: 'POST',   pattern: /^\/api\/panol\/items$/ },
  { method: 'PUT',    pattern: /^\/api\/panol\/items\/\d+$/ },
  { method: 'DELETE', pattern: /^\/api\/panol\/items\/\d+$/ },
  { method: 'GET',    pattern: /^\/api\/panol\/movimientos$/ },
  { method: 'POST',   pattern: /^\/api\/panol\/movimientos$/ },
  { method: 'PATCH',  pattern: /^\/api\/panol\/movimientos\/\d+\/devolver$/ },
  { method: 'GET',    pattern: /^\/api\/panol\/alertas$/ },
  // Stock (ver) — PAÑOLERO puede consultar productos/cunas/camiones/alertas
  // de sólo lectura (matriz de permisos), aunque el frontend sólo le muestre
  // la tab Pañol.
  { method: 'GET',    pattern: /^\/api\/stock\/.*$/ },
];

const RESTRICTED_RULES: Partial<Record<AuthUser['rol'], Rule[]>> = {
  JORNALERO: JORNALERO_ALLOW,
  PANOLERO:  PANOLERO_ALLOW,
};

export function restrictedRoleGate(req: Request, res: Response, next: NextFunction): void {
  const token: string | undefined = req.cookies?.token;
  if (!token) { next(); return; }

  let decoded: AuthUser;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET!) as AuthUser;
  } catch {
    next(); return;
  }

  const rules = RESTRICTED_RULES[decoded.rol];
  if (!rules) { next(); return; } // ADMIN/OPERADOR/VIEWER — sin restricción acá

  const allowed = rules.some(r => r.method === req.method && r.pattern.test(req.path));
  if (!allowed) {
    res.status(403).json({ error: 'Sin permisos suficientes' });
    return;
  }
  next();
}
