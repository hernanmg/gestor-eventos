import { Router } from 'express';
import { auth } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';
import { requireRole } from '../middleware/requireRole';
import { asyncHandler } from '../lib/asyncHandler';
import {
  uploadDocumento,
  list,
  detail,
  create,
  update,
  remove,
  listMovimientos,
  createMovimiento,
  updateMovimiento,
  removeMovimiento,
  getDocumento,
  updateDocumento,
  exportar,
} from '../controllers/cuentasCorrientes.controller';

// ── Multer wrapper ────────────────────────────────────────────────────────────

function documentoMiddleware(req: any, res: any, next: any) {
  uploadDocumento.single('documento')(req, res, (err: any) => {
    if (err) { res.status(400).json({ error: err.message ?? 'Error al subir el documento' }); return; }
    next();
  });
}

// ── Router /api/cuentas-corrientes ────────────────────────────────────────────
// Módulo financiero sensible (saldos con terceros) — exclusivo de ADMIN, mismo
// criterio que Facturas.

export const cuentasCorrientesRouter = Router();
cuentasCorrientesRouter.use(auth);
cuentasCorrientesRouter.use(tenantMiddleware);
cuentasCorrientesRouter.use(requireRole('ADMIN'));

cuentasCorrientesRouter.get('/',                        asyncHandler(list));
cuentasCorrientesRouter.post('/',                        asyncHandler(create));
cuentasCorrientesRouter.get('/:id',                      asyncHandler(detail));
cuentasCorrientesRouter.put('/:id',                      asyncHandler(update));
cuentasCorrientesRouter.delete('/:id',                   asyncHandler(remove));
cuentasCorrientesRouter.get('/:id/exportar',             asyncHandler(exportar));
cuentasCorrientesRouter.get('/:id/movimientos',          asyncHandler(listMovimientos));
cuentasCorrientesRouter.post('/:id/movimientos',         documentoMiddleware, asyncHandler(createMovimiento));
cuentasCorrientesRouter.put('/movimientos/:id',          asyncHandler(updateMovimiento));
cuentasCorrientesRouter.delete('/movimientos/:id',       asyncHandler(removeMovimiento));
cuentasCorrientesRouter.get('/movimientos/:id/documento', asyncHandler(getDocumento));
cuentasCorrientesRouter.put('/movimientos/:id/documento', documentoMiddleware, asyncHandler(updateDocumento));
