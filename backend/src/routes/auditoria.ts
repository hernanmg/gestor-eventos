import { Router } from 'express';
import { auth }         from '../middleware/auth';
import { requireRole }  from '../middleware/requireRole';
import { prisma }       from '../lib/prisma';
import type { Request, Response } from 'express';

const router = Router();
router.use(auth);
router.use(requireRole('ADMIN'));

async function list(req: Request, res: Response) {
  const page     = Math.max(1, Number(req.query.page)  || 1);
  const limit    = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
  const skip     = (page - 1) * limit;

  const eventoId  = req.query.evento_id  ? Number(req.query.evento_id)  : undefined;
  const usuarioId = req.query.usuario_id ? Number(req.query.usuario_id) : undefined;
  const accion    = typeof req.query.accion  === 'string' ? req.query.accion  : undefined;
  const entidad   = typeof req.query.entidad === 'string' ? req.query.entidad : undefined;
  const desde     = typeof req.query.desde   === 'string' ? new Date(req.query.desde)   : undefined;
  const hasta     = typeof req.query.hasta   === 'string' ? new Date(req.query.hasta)   : undefined;

  const where: Record<string, unknown> = {};
  if (eventoId  !== undefined) where.evento_id  = eventoId;
  if (usuarioId !== undefined) where.usuario_id = usuarioId;
  if (accion)    where.accion  = accion;
  if (entidad)   where.entidad = entidad;
  if (desde || hasta) {
    where.created_at = {
      ...(desde && { gte: desde }),
      ...(hasta && { lte: hasta }),
    };
  }

  const [total, logs] = await Promise.all([
    (prisma as any).auditoriaLog.count({ where }),
    (prisma as any).auditoriaLog.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip,
      take:    limit,
      include: { usuario: { select: { id: true, nombre: true, email: true } } },
    }),
  ]);

  res.json({ total, page, limit, pages: Math.ceil(total / limit), data: logs });
}

async function listByEvento(req: Request, res: Response) {
  const eventoId = Number(req.params.id);
  const page     = Math.max(1, Number(req.query.page)  || 1);
  const limit    = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
  const skip     = (page - 1) * limit;

  const where = { evento_id: eventoId };

  const [total, logs] = await Promise.all([
    (prisma as any).auditoriaLog.count({ where }),
    (prisma as any).auditoriaLog.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip,
      take:    limit,
      include: { usuario: { select: { id: true, nombre: true, email: true } } },
    }),
  ]);

  res.json({ total, page, limit, pages: Math.ceil(total / limit), data: logs });
}

router.get('/',            list);
router.get('/evento/:id',  listByEvento);

export default router;
