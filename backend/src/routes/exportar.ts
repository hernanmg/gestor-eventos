import { Router } from 'express';
import { auth } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';
import { requireAnyRole, ROLES } from '../middleware/requireRole';
import { asyncHandler } from '../lib/asyncHandler';
import { exportarExcel, exportarPDF } from '../controllers/exportar.controller';

const router = Router();
router.use(auth);
router.use(tenantMiddleware);
router.get('/:id/exportar/excel', requireAnyRole(ROLES.TODOS_MENOS_RESTRINGIDOS), asyncHandler(exportarExcel));
router.get('/:id/exportar/pdf',   requireAnyRole(ROLES.TODOS_MENOS_RESTRINGIDOS), asyncHandler(exportarPDF));

export default router;
