import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { prisma } from '../lib/prisma';

type GetEventoIdFn = (req: Request) => Promise<number | null>;

export function requireEventoAcceso(getEventoId?: GetEventoIdFn): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Global ADMIN always has access
    if (req.user!.rol === 'ADMIN') {
      next(); return;
    }

    const eventoId = getEventoId
      ? await getEventoId(req)
      : Number(req.params.id) || null;

    if (!eventoId) {
      res.status(400).json({ error: 'Evento no identificado' });
      return;
    }

    const acceso = await (prisma as any).eventoAcceso.findUnique({
      where: { usuario_id_evento_id: { usuario_id: req.user!.id, evento_id: eventoId } },
    });

    if (!acceso) {
      res.status(403).json({ error: 'Sin acceso a este evento' });
      return;
    }

    req.eventoRol = acceso.rol;
    next();
  };
}

// Call after requireEventoAcceso — blocks VIEWER event roles from write operations
export function requireEventoRole(minRol: 'OPERADOR' | 'ADMIN'): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.user!.rol === 'ADMIN') { next(); return; }
    if (minRol === 'OPERADOR' && req.eventoRol === 'VIEWER') {
      res.status(403).json({ error: 'Sin permisos de escritura en este evento' });
      return;
    }
    next();
  };
}

// ── Lookup helpers for resource-based routes ──────────────────────────────────

export const byMovimientoId: GetEventoIdFn = async (req) => {
  const m = await (prisma as any).movimiento.findFirst({
    where:  { id: Number(req.params.id) },
    select: { evento_id: true },
  });
  return m?.evento_id ?? null;
};

export const byCuentaId: GetEventoIdFn = async (req) => {
  const c = await (prisma as any).cuentaBancaria.findFirst({
    where:  { id: Number(req.params.id) },
    select: { evento_id: true },
  });
  return c?.evento_id ?? null;
};

export const byMovCajaId: GetEventoIdFn = async (req) => {
  const mc = await (prisma as any).movimientoCaja.findFirst({
    where:   { id: Number(req.params.id) },
    include: { cuenta: { select: { evento_id: true } } },
  });
  return mc?.cuenta?.evento_id ?? null;
};

export const byEcheqId: GetEventoIdFn = async (req) => {
  const e = await (prisma as any).echeq.findFirst({
    where:  { id: Number(req.params.id) },
    select: { evento_id: true },
  });
  return e?.evento_id ?? null;
};
