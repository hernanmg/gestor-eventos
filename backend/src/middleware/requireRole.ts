import { Request, Response, NextFunction } from 'express';
import type { AuthUser } from '../types/express';

type Rol = AuthUser['rol'];

// JORNALERO y PAÑOLERO no son parte de la jerarquía ADMIN > OPERADOR > VIEWER
// — son roles de acceso acotado a un puñado de endpoints (ver
// restrictedRoleGate.ts), así que quedan por debajo de VIEWER acá. Cuando una
// ruta puntual debe habilitarlos pese a exigir un nivel mayor (ej. PAÑOLERO
// creando ítems de pañol, que normalmente requiere ADMIN), se usa el segundo
// parámetro `allow`.
const ROL_LEVEL: Record<Rol, number> = {
  JORNALERO: 0,
  PANOLERO:  0,
  VIEWER:    1,
  OPERADOR:  2,
  ADMIN:     3,
};

export function requireRole(minRol: Rol, opts?: { allow?: Rol[] }) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.user;

    if (!user) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    if (opts?.allow?.includes(user.rol)) {
      next();
      return;
    }

    const userLevel     = ROL_LEVEL[user.rol] ?? 0;
    const requiredLevel = ROL_LEVEL[minRol];

    if (userLevel < requiredLevel) {
      res.status(403).json({ error: 'Sin permisos suficientes' });
      return;
    }

    next();
  };
}

// ── Grupos de roles (matriz de permisos por módulo) ───────────────────────────
// A diferencia de requireRole(minRol), estos grupos no son necesariamente un
// tramo contiguo de la jerarquía (PAÑOL y JORNALERO_PROPIO saltean OPERADOR/
// VIEWER) — por eso se resuelven por pertenencia directa al array, no por nivel.
export const ROLES: Record<string, Rol[]> = {
  SOLO_ADMIN:               ['ADMIN'],
  ADMIN_OPERADOR:           ['ADMIN', 'OPERADOR'],
  TODOS_MENOS_RESTRINGIDOS: ['ADMIN', 'OPERADOR', 'VIEWER'],
  PAÑOL:                    ['ADMIN', 'PANOLERO'],
  JORNALERO_PROPIO:         ['ADMIN', 'JORNALERO'],
};

export function requireAnyRole(roles: Rol[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.user;

    if (!user) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    if (!roles.includes(user.rol)) {
      res.status(403).json({ error: 'Sin permisos suficientes' });
      return;
    }

    next();
  };
}
