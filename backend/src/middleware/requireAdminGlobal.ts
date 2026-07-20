import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';

// Admin global = rol ADMIN sin empresa fija en su fila de Usuario (mismo
// criterio que esAdminGlobal() en auth.controller.ts). Un ADMIN de tenant
// (con empresa_id seteado) no pasa este check.
export async function requireAdminGlobal(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.user) { res.status(401).json({ error: 'No autenticado' }); return; }
  if (req.user.rol !== 'ADMIN') { res.status(403).json({ error: 'Sin permisos suficientes' }); return; }

  const usuario = await prisma.usuario.findFirst({
    where:  { id: req.user.id, deleted_at: null },
    select: { empresa_id: true },
  });
  if (!usuario || usuario.empresa_id !== null) {
    res.status(403).json({ error: 'Esta acción requiere un administrador global' });
    return;
  }
  next();
}
