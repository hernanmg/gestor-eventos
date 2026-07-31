import { Router } from 'express';
import multer from 'multer';
import { auth } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';
import { requireRole } from '../middleware/requireRole';
import { asyncHandler } from '../lib/asyncHandler';
import {
  listEmpleados, getEmpleado, createEmpleado, updateEmpleado, deleteEmpleado,
  listJornadas, listJornadasEmpleado, createJornada, updateJornada, aprobarJornada, rechazarJornada, deleteJornada,
  listAnticiposEmpleado, createAnticipo, deleteAnticipo,
  listLiquidaciones, getLiquidacion, previewLiquidacion, generarLiquidacion, aprobarLiquidacion, cancelarLiquidacion,
  exportarLiquidacionPDF,
} from '../controllers/rrhh.controller';
import { importarEmpleados, importarJornadas } from '../controllers/rrhhImporter.controller';

const uploadExcel = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 },
});

const router = Router();
router.use(auth);
router.use(tenantMiddleware);

// ── Empleados ─────────────────────────────────────────────────────────────────
router.get('/empleados',                asyncHandler(listEmpleados));
router.get('/empleados/:id',             asyncHandler(getEmpleado));
router.post('/empleados',                requireRole('OPERADOR'), asyncHandler(createEmpleado));
router.put('/empleados/:id',             requireRole('OPERADOR'), asyncHandler(updateEmpleado));
router.delete('/empleados/:id',          requireRole('ADMIN'),    asyncHandler(deleteEmpleado));

// ── Jornadas ──────────────────────────────────────────────────────────────────
router.get('/jornadas',                  asyncHandler(listJornadas));
router.get('/empleados/:id/jornadas',    asyncHandler(listJornadasEmpleado));
router.post('/jornadas',                 asyncHandler(createJornada));
router.put('/jornadas/:id',              asyncHandler(updateJornada));
router.patch('/jornadas/:id/aprobar',    requireRole('OPERADOR'), asyncHandler(aprobarJornada));
router.patch('/jornadas/:id/rechazar',   requireRole('OPERADOR'), asyncHandler(rechazarJornada));
router.delete('/jornadas/:id',           asyncHandler(deleteJornada));

// ── Anticipos ─────────────────────────────────────────────────────────────────
router.get('/empleados/:id/anticipos',   asyncHandler(listAnticiposEmpleado));
router.post('/anticipos',                requireRole('OPERADOR'), asyncHandler(createAnticipo));
router.delete('/anticipos/:id',          requireRole('OPERADOR'), asyncHandler(deleteAnticipo));

// ── Liquidaciones ─────────────────────────────────────────────────────────────
router.get('/liquidaciones',             asyncHandler(listLiquidaciones));
router.get('/liquidaciones/preview',     asyncHandler(previewLiquidacion));
router.get('/liquidaciones/:id',         asyncHandler(getLiquidacion));
router.get('/liquidaciones/:id/pdf',     asyncHandler(exportarLiquidacionPDF));
router.post('/liquidaciones/generar',    requireRole('OPERADOR'), asyncHandler(generarLiquidacion));
router.patch('/liquidaciones/:id/aprobar',  requireRole('OPERADOR'), asyncHandler(aprobarLiquidacion));
router.patch('/liquidaciones/:id/cancelar', requireRole('OPERADOR'), asyncHandler(cancelarLiquidacion));

// ── Importadores ──────────────────────────────────────────────────────────────
router.post('/importar/empleados',       requireRole('OPERADOR'), uploadExcel.single('file'), asyncHandler(importarEmpleados));
router.post('/importar/jornadas',        requireRole('OPERADOR'), uploadExcel.single('file'), asyncHandler(importarJornadas));

export default router;
