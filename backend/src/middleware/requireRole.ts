import { Request, Response, NextFunction } from 'express';
import type { AuthUser } from '../types/express';

type Rol = AuthUser['rol'];

const ROL_LEVEL: Record<Rol, number> = {
  VIEWER:   1,
  OPERADOR: 2,
  ADMIN:    3,
};

export function requireRole(minRol: Rol) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.user;

    if (!user) {
      res.status(401).json({ error: 'No autenticado' });
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
