import { Router } from 'express';
import { auth } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';
import { requireRole } from '../middleware/requireRole';
import { asyncHandler } from '../lib/asyncHandler';
import { upload as uploadXlsx } from '../controllers/importer.controller';
import {
  getAgenda, listConceptos, createConcepto, updateConcepto, deleteConcepto, putMes, importarPlanilla,
} from '../controllers/pagosFijos.controller';

// Agenda de pagos fijos — exclusivo de ADMIN, igual que AFIP / Créditos y Cheques.
const router = Router();
router.use(auth);
router.use(tenantMiddleware);
router.use(requireRole('ADMIN'));

function xlsxMiddleware(req: any, res: any, next: any) {
  uploadXlsx.single('archivo')(req, res, (err: any) => {
    if (err) { res.status(400).json({ error: err.message ?? 'Error al subir el archivo' }); return; }
    next();
  });
}

router.get('/',                   asyncHandler(getAgenda));
router.get('/conceptos',          asyncHandler(listConceptos));
router.post('/conceptos',         asyncHandler(createConcepto));
router.put('/conceptos/:id',      asyncHandler(updateConcepto));
router.delete('/conceptos/:id',   asyncHandler(deleteConcepto));
router.put('/:id/mes/:periodo',   asyncHandler(putMes));
router.post('/importar',          xlsxMiddleware, asyncHandler(importarPlanilla));

export default router;
