import { Request, Response, NextFunction } from 'express';
import type { AuthUser } from '../types/express';
import { prisma } from '../lib/prisma';
import type { Permiso } from '../lib/permisos';

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

// `permiso`: además del rol mínimo, deja pasar a quien tenga ese permiso de
// carga (Usuario.permisos, ver lib/permisos.ts). Se lee de la DB y no del JWT
// para que dar o quitar un permiso rija sin volver a iniciar sesión — la
// consulta sólo corre cuando el rol no alcanza.
export function requireRole(minRol: Rol, opts?: { allow?: Rol[]; permiso?: Permiso }) {
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

    if (userLevel >= requiredLevel) {
      next();
      return;
    }

    if (opts?.permiso) {
      tienePermiso(user.id, opts.permiso)
        .then(ok => (ok ? next() : res.status(403).json({ error: 'Sin permisos suficientes' })))
        .catch(next);
      return;
    }

    res.status(403).json({ error: 'Sin permisos suficientes' });
  };
}

export async function tienePermiso(usuarioId: number, permiso: Permiso): Promise<boolean> {
  const u = await prisma.usuario.findFirst({
    where:  { id: usuarioId, deleted_at: null, activo: true },
    select: { permisos: true },
  });
  return !!u?.permisos.includes(permiso);
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
