import { Router } from 'express';
import { auth } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';
import { requireRole } from '../middleware/requireRole';
import { asyncHandler } from '../lib/asyncHandler';
import {
  generarCierreContable, listCierresContables, detalleCierreContable,
  exportarCierreContable, updateEstadoCierreContable, updateNotaSeccionCierreContable,
} from '../controllers/cierreContable.controller';

// ── Router /api/cierre-contable — exclusivo de ADMIN ─────────────────────────

export const cierreContableRouter = Router();
cierreContableRouter.use(auth);
cierreContableRouter.use(tenantMiddleware);
cierreContableRouter.use(requireRole('ADMIN'));

cierreContableRouter.post('/generar',        asyncHandler(generarCierreContable));
cierreContableRouter.get('/',                asyncHandler(listCierresContables));
cierreContableRouter.get('/:id',             asyncHandler(detalleCierreContable));
cierreContableRouter.get('/:id/exportar',    asyncHandler(exportarCierreContable));
cierreContableRouter.patch('/:id/estado',    asyncHandler(updateEstadoCierreContable));
cierreContableRouter.patch('/:id/notas',     asyncHandler(updateNotaSeccionCierreContable));

export default cierreContableRouter;
