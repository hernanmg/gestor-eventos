import { Router } from 'express';
import { auth } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';
import { requireRole } from '../middleware/requireRole';
import { asyncHandler } from '../lib/asyncHandler';
import { listSGR, createSGR, updateSGR, deleteSGR } from '../controllers/sgr.controller';

// ── Router /api/sgr — exclusivo de ADMIN, mismo criterio que AFIP/Créditos ───

export const sgrRouter = Router();
sgrRouter.use(auth);
sgrRouter.use(tenantMiddleware);
sgrRouter.use(requireRole('ADMIN'));

sgrRouter.get('/',      asyncHandler(listSGR));
sgrRouter.post('/',     asyncHandler(createSGR));
sgrRouter.put('/:id',   asyncHandler(updateSGR));
sgrRouter.delete('/:id', asyncHandler(deleteSGR));

export default sgrRouter;
