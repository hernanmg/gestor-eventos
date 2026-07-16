import { Router } from 'express';
import { auth } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';
import { requireEventoAcceso } from '../middleware/requireEventoAcceso';
import { asyncHandler } from '../lib/asyncHandler';
import { exportarExcel, exportarPDF } from '../controllers/exportar.controller';

const router = Router();
router.use(auth);
router.use(tenantMiddleware);
router.get('/:id/exportar/excel', requireEventoAcceso(), asyncHandler(exportarExcel));
router.get('/:id/exportar/pdf',   requireEventoAcceso(), asyncHandler(exportarPDF));

export default router;
