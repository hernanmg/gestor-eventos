import { Router } from 'express';
import multer from 'multer';
import { auth } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';
import { requireRole, requireAnyRole, ROLES } from '../middleware/requireRole';
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

// RRHH es exclusivo de ADMIN — la única excepción es JORNALERO cargando/viendo
// sus propias jornadas (GET/POST /jornadas), ya scopeado por
// resolveEmpleadoScope() en el controller (matriz de permisos).

// ── Empleados ─────────────────────────────────────────────────────────────────
router.get('/empleados',                asyncHandler(listEmpleados));
router.get('/empleados/:id',             asyncHandler(getEmpleado));
router.post('/empleados',                requireRole('ADMIN'), asyncHandler(createEmpleado));
router.put('/empleados/:id',             requireRole('ADMIN'), asyncHandler(updateEmpleado));
router.delete('/empleados/:id',          requireRole('ADMIN'), asyncHandler(deleteEmpleado));

// ── Jornadas ──────────────────────────────────────────────────────────────────
router.get('/jornadas',                  requireAnyRole(ROLES.JORNALERO_PROPIO), asyncHandler(listJornadas));
router.get('/empleados/:id/jornadas',    requireRole('ADMIN'), asyncHandler(listJornadasEmpleado));
router.post('/jornadas',                 requireAnyRole(ROLES.JORNALERO_PROPIO), asyncHandler(createJornada));
router.put('/jornadas/:id',              requireRole('ADMIN'), asyncHandler(updateJornada));
router.patch('/jornadas/:id/aprobar',    requireRole('ADMIN'), asyncHandler(aprobarJornada));
router.patch('/jornadas/:id/rechazar',   requireRole('ADMIN'), asyncHandler(rechazarJornada));
router.delete('/jornadas/:id',           requireRole('ADMIN'), asyncHandler(deleteJornada));

// ── Anticipos ─────────────────────────────────────────────────────────────────
router.get('/empleados/:id/anticipos',   requireRole('ADMIN'), asyncHandler(listAnticiposEmpleado));
router.post('/anticipos',                requireRole('ADMIN'), asyncHandler(createAnticipo));
router.delete('/anticipos/:id',          requireRole('ADMIN'), asyncHandler(deleteAnticipo));

// ── Liquidaciones ─────────────────────────────────────────────────────────────
router.get('/liquidaciones',             requireRole('ADMIN'), asyncHandler(listLiquidaciones));
router.get('/liquidaciones/preview',     requireRole('ADMIN'), asyncHandler(previewLiquidacion));
router.get('/liquidaciones/:id',         requireRole('ADMIN'), asyncHandler(getLiquidacion));
router.get('/liquidaciones/:id/pdf',     requireRole('ADMIN'), asyncHandler(exportarLiquidacionPDF));
router.post('/liquidaciones/generar',    requireRole('ADMIN'), asyncHandler(generarLiquidacion));
router.patch('/liquidaciones/:id/aprobar',  requireRole('ADMIN'), asyncHandler(aprobarLiquidacion));
router.patch('/liquidaciones/:id/cancelar', requireRole('ADMIN'), asyncHandler(cancelarLiquidacion));

// ── Importadores ──────────────────────────────────────────────────────────────
router.post('/importar/empleados',       requireRole('ADMIN'), uploadExcel.single('file'), asyncHandler(importarEmpleados));
router.post('/importar/jornadas',        requireRole('ADMIN'), uploadExcel.single('file'), asyncHandler(importarJornadas));

export default router;
