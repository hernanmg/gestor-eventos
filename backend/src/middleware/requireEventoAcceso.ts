import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { prisma } from '../lib/prisma';

// Único uso restante: facturas.ts (Facturas es SOLO_ADMIN de todos modos, así
// que esto sólo aplica cuando el usuario ya es ADMIN — bypass inmediato — o
// cuando hace falta el 403 explícito "Sin acceso a este evento" en vez de un
// 404 genérico). El resto de los módulos (eventos, movimientos, caja, ficha,
// comidas, echeqs, stock) dejaron de usar el ACL per-evento: la lectura es
// TODOS_MENOS_RESTRINGIDOS y la escritura se gatea por rol global
// (ver requireRole.ts) — el control granular vive en botones/tabs del
// frontend, no en el acceso a la página (matriz de permisos).
export function requireEventoAcceso(): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (req.user!.rol === 'ADMIN') {
      next(); return;
    }

    const eventoId = Number(req.params.id) || null;
    if (!eventoId) { next(); return; }

    const acceso = await (prisma as any).eventoAcceso.findUnique({
      where: { usuario_id_evento_id: { usuario_id: req.user!.id, evento_id: eventoId } },
    });

    if (!acceso) {
      res.status(403).json({ error: 'Sin acceso a este evento' });
      return;
    }

    next();
  };
}
