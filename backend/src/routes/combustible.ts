import { Router } from 'express';
import { auth } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';
import { requireRole } from '../middleware/requireRole';
import { asyncHandler } from '../lib/asyncHandler';
import {
  uploadComprobante,
  uploadExcel,
  listCombustible,
  createCombustible,
  updateCombustible,
  deleteCombustible,
  autorizarCombustible,
  rechazarCombustible,
  listPendientesAutorizacion,
  resumenMensual,
  resumenSemanal,
  analisisAnual,
  exportarCombustible,
  importarCombustible,
} from '../controllers/combustible.controller';

function comprobanteMiddleware(req: any, res: any, next: any) {
  uploadComprobante.single('comprobante')(req, res, (err: any) => {
    if (err) { res.status(400).json({ error: err.message ?? 'Error al subir el comprobante' }); return; }
    next();
  });
}

function excelMiddleware(req: any, res: any, next: any) {
  uploadExcel.single('archivo')(req, res, (err: any) => {
    if (err) { res.status(400).json({ error: err.message ?? 'Error al subir el archivo' }); return; }
    next();
  });
}

const router = Router();
router.use(auth);
router.use(tenantMiddleware);
router.use(requireRole('OPERADOR')); // Combustible visible para ADMIN y OPERADOR (Santi/Nico), como Flota

router.get('/resumen-mensual', asyncHandler(resumenMensual));
router.get('/resumen-semanal', asyncHandler(resumenSemanal));
router.get('/analisis-anual',  asyncHandler(analisisAnual));
router.get('/pendientes-autorizacion', asyncHandler(listPendientesAutorizacion));
router.get('/exportar',        asyncHandler(exportarCombustible));
router.post('/importar',       excelMiddleware, asyncHandler(importarCombustible)); // ADMIN_OPERADOR (nivel del router) — Santi/Nico importan la planilla

router.get('/',           asyncHandler(listCombustible));
router.post('/',          comprobanteMiddleware, asyncHandler(createCombustible));
router.put('/:id',        comprobanteMiddleware, asyncHandler(updateCombustible));
router.delete('/:id',     requireRole('ADMIN'), asyncHandler(deleteCombustible));
router.patch('/:id/autorizar', requireRole('ADMIN'), asyncHandler(autorizarCombustible));
router.patch('/:id/rechazar',  requireRole('ADMIN'), asyncHandler(rechazarCombustible));

export default router;
