import { Router } from 'express';
import { auth } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';
import { requireAnyRole, ROLES } from '../middleware/requireRole';
import { asyncHandler } from '../lib/asyncHandler';
import {
  getCentroCostos, exportarCentroCostos, createExtra, updateExtra, deleteExtra,
  subirComprobanteExtra, quitarComprobanteExtra, descargarComprobanteExtra, uploadComprobanteExtra,
} from '../controllers/centroCostos.controller';

function comprobanteMiddleware(req: any, res: any, next: any) {
  uploadComprobanteExtra.single('comprobante')(req, res, (err: any) => {
    if (err) { res.status(400).json({ error: err.message ?? 'Error al subir el comprobante' }); return; }
    next();
  });
}

// ── Nested bajo /api/eventos/:id/centro-costos ────────────────────────────────
export const centroCostosEventoRouter = Router({ mergeParams: true });
centroCostosEventoRouter.use(auth);
centroCostosEventoRouter.use(tenantMiddleware);
centroCostosEventoRouter.get('/',         requireAnyRole(ROLES.TODOS_MENOS_RESTRINGIDOS), asyncHandler(getCentroCostos));
centroCostosEventoRouter.get('/exportar', requireAnyRole(ROLES.TODOS_MENOS_RESTRINGIDOS), asyncHandler(exportarCentroCostos));
centroCostosEventoRouter.post('/extras',  requireAnyRole(ROLES.ADMIN_OPERADOR), asyncHandler(createExtra));

// ── /api/extras-evento/:id ────────────────────────────────────────────────────
export const extrasEventoRouter = Router();
extrasEventoRouter.use(auth);
extrasEventoRouter.use(tenantMiddleware);
extrasEventoRouter.put('/:id',                requireAnyRole(ROLES.ADMIN_OPERADOR), asyncHandler(updateExtra));
extrasEventoRouter.delete('/:id',             requireAnyRole(ROLES.ADMIN_OPERADOR), asyncHandler(deleteExtra));
extrasEventoRouter.get('/:id/comprobante',    requireAnyRole(ROLES.TODOS_MENOS_RESTRINGIDOS), asyncHandler(descargarComprobanteExtra));
extrasEventoRouter.post('/:id/comprobante',   requireAnyRole(ROLES.ADMIN_OPERADOR), comprobanteMiddleware, asyncHandler(subirComprobanteExtra));
extrasEventoRouter.delete('/:id/comprobante', requireAnyRole(ROLES.ADMIN_OPERADOR), asyncHandler(quitarComprobanteExtra));
