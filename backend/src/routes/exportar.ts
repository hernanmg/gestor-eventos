import { Router } from 'express';
import { auth } from '../middleware/auth';
import { asyncHandler } from '../lib/asyncHandler';
import { exportarExcel, exportarPDF } from '../controllers/exportar.controller';

const router = Router();
router.use(auth);
router.get('/:id/exportar/excel', asyncHandler(exportarExcel));
router.get('/:id/exportar/pdf',   asyncHandler(exportarPDF));

export default router;
