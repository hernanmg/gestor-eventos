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
import {
  listEmpresasSueldos, listCuentasPorEmpresa,
  listAcuerdos, getAcuerdoEmpleado, createAcuerdo, updateAcuerdo, deleteAcuerdo, restaurarAcuerdo,
  upsertSplits, deleteSplits,
  listLiquidacionesAdmin, getLiquidacionAdmin, generarLiquidacionAdmin, updateLiquidacionAdmin,
  aprobarLiquidacionAdmin, cancelarLiquidacionAdmin, exportarLiquidacionAdminPDF,
  getResumenMensual, getHorasPeriodo,
  listPrestamosEmpleado, createPrestamo, deletePrestamo,
} from '../controllers/sueldosAdmin.controller';
import {
  listEscalafones, getValoresEscalafon, createEscalafon, updateEscalafon, deleteEscalafon,
} from '../controllers/escalafones.controller';

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
router.get('/empleados',                requireRole('ADMIN'), asyncHandler(listEmpleados));
router.get('/empleados/:id',             requireRole('ADMIN'), asyncHandler(getEmpleado));
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

// ── Sueldos administrativos (régimen mensual fijo, distinto de Jornada/Liquidacion) ──
router.get('/empresas',                     requireRole('ADMIN'), asyncHandler(listEmpresasSueldos));
router.get('/cuentas-empresa/:empresaId',   requireRole('ADMIN'), asyncHandler(listCuentasPorEmpresa));

router.get('/acuerdos',                     requireRole('ADMIN'), asyncHandler(listAcuerdos));
router.get('/acuerdos/:empleadoId',         requireRole('ADMIN'), asyncHandler(getAcuerdoEmpleado));
router.post('/acuerdos',                    requireRole('ADMIN'), asyncHandler(createAcuerdo));
router.put('/acuerdos/:id',                 requireRole('ADMIN'), asyncHandler(updateAcuerdo));
router.delete('/acuerdos/:id',              requireRole('ADMIN'), asyncHandler(deleteAcuerdo));
router.patch('/acuerdos/:id/restaurar',     requireRole('ADMIN'), asyncHandler(restaurarAcuerdo));

router.post('/empleados/:id/splits',        requireRole('ADMIN'), asyncHandler(upsertSplits));
router.delete('/empleados/:id/splits',      requireRole('ADMIN'), asyncHandler(deleteSplits));
router.get('/empleados/:id/horas-periodo',  requireRole('ADMIN'), asyncHandler(getHorasPeriodo));

// resumen-mensual va ANTES de /:id — si no, Express matchea "resumen-mensual"
// como si fuera un id.
router.get('/liquidaciones-admin/resumen-mensual',  requireRole('ADMIN'), asyncHandler(getResumenMensual));
router.get('/liquidaciones-admin',                  requireRole('ADMIN'), asyncHandler(listLiquidacionesAdmin));
router.get('/liquidaciones-admin/:id',              requireRole('ADMIN'), asyncHandler(getLiquidacionAdmin));
router.get('/liquidaciones-admin/:id/exportar',     requireRole('ADMIN'), asyncHandler(exportarLiquidacionAdminPDF));
router.post('/liquidaciones-admin/generar',         requireRole('ADMIN'), asyncHandler(generarLiquidacionAdmin));
router.put('/liquidaciones-admin/:id',              requireRole('ADMIN'), asyncHandler(updateLiquidacionAdmin));
router.patch('/liquidaciones-admin/:id/aprobar',    requireRole('ADMIN'), asyncHandler(aprobarLiquidacionAdmin));
router.patch('/liquidaciones-admin/:id/cancelar',   requireRole('ADMIN'), asyncHandler(cancelarLiquidacionAdmin));

// ── Escalafones administrativos (valores por categoría, configurables) ───────
router.get('/escalafones',                  requireRole('ADMIN'), asyncHandler(listEscalafones));
router.get('/escalafones/:nombre/valores',  requireRole('ADMIN'), asyncHandler(getValoresEscalafon));
router.post('/escalafones',                 requireRole('ADMIN'), asyncHandler(createEscalafon));
router.put('/escalafones/:id',              requireRole('ADMIN'), asyncHandler(updateEscalafon));
router.delete('/escalafones/:id',           requireRole('ADMIN'), asyncHandler(deleteEscalafon));

// ── Préstamos a empleados (distinto de Anticipo — se paga en cuotas) ─────────
router.get('/empleados/:id/prestamos',      requireRole('ADMIN'), asyncHandler(listPrestamosEmpleado));
router.post('/empleados/:id/prestamos',     requireRole('ADMIN'), asyncHandler(createPrestamo));
router.delete('/prestamos/:id',             requireRole('ADMIN'), asyncHandler(deletePrestamo));

export default router;
