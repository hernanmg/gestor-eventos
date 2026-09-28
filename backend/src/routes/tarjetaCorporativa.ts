import { Router } from 'express';
import { auth } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';
import { requireRole } from '../middleware/requireRole';
import { asyncHandler } from '../lib/asyncHandler';
import {
  uploadPlanillaTC, listTarjetas, createTarjeta, listConsumos, resumenMensual, periodosConDatos,
  createConsumo, updateConsumo, deleteConsumo, importarTC, exportarPdfMes,
} from '../controllers/tarjetaCorporativa.controller';

function excelMiddleware(req: any, res: any, next: any) {
  uploadPlanillaTC.single('archivo')(req, res, (err: any) => {
    if (err) { res.status(400).json({ error: err.message ?? 'Error al subir el archivo' }); return; }
    next();
  });
}

// Tarjeta Corporativa Galicia (DOS57 / Enjoy) — exclusivo ADMIN.
const router = Router();
router.use(auth);
router.use(tenantMiddleware);
router.use(requireRole('ADMIN'));

router.get('/',                        asyncHandler(listTarjetas));
router.post('/',                       asyncHandler(createTarjeta));
router.post('/importar',               excelMiddleware, asyncHandler(importarTC));
router.put('/consumos/:id',            asyncHandler(updateConsumo));
router.delete('/consumos/:id',         asyncHandler(deleteConsumo));
router.get('/:id/consumos',            asyncHandler(listConsumos));
router.post('/:id/consumos',           asyncHandler(createConsumo));
router.get('/:id/resumen-mensual',     asyncHandler(resumenMensual));
router.get('/:id/periodos',            asyncHandler(periodosConDatos));
router.get('/:id/pdf',                 asyncHandler(exportarPdfMes));

export default router;
