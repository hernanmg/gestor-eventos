import { Router } from 'express';
import { auth } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';
import { requireRole } from '../middleware/requireRole';
import { asyncHandler } from '../lib/asyncHandler';
import { upload as uploadXlsx } from '../controllers/importer.controller';
import {
  listRegistros, getPresentismoHoy, upsertRegistro, updateRegistro, deleteRegistro, marcarTodosPresentes,
  getResumenMes, getResumenMesEmpleado, cerrarMes, aprobarTardanza, rechazarTardanza, importarReloj,
  exportarPresentismo, getFrancos, updateSaldoInicialFrancos, importarPlanilla,
} from '../controllers/presentismo.controller';

const router = Router();
router.use(auth);
router.use(tenantMiddleware);

// Planilla mensual de Lorena (.xlsx, campo `archivo`)
const xlsxMiddleware = (req: any, res: any, next: any) => {
  uploadXlsx.single('archivo')(req, res, (err: any) => {
    if (err) { res.status(400).json({ error: err.message ?? 'Error al subir el archivo' }); return; }
    next();
  });
};

router.get('/hoy',                asyncHandler(getPresentismoHoy));
router.get('/resumen-mes',        asyncHandler(getResumenMes));
router.get('/resumen-mes/:empleadoId', asyncHandler(getResumenMesEmpleado));
router.get('/exportar',           asyncHandler(exportarPresentismo));
router.get('/francos',            asyncHandler(getFrancos));
router.put('/francos/:empleadoId', requireRole('OPERADOR'), asyncHandler(updateSaldoInicialFrancos));
router.post('/cerrar-mes',        requireRole('OPERADOR'), asyncHandler(cerrarMes));
router.post('/marcar-todos-presentes', requireRole('OPERADOR'), asyncHandler(marcarTodosPresentes));
router.post('/importar',          requireRole('OPERADOR'), asyncHandler(importarReloj));
router.post('/importar-planilla', requireRole('OPERADOR'), xlsxMiddleware, asyncHandler(importarPlanilla));
router.post('/:id/aprobar-tardanza',  requireRole('ADMIN'), asyncHandler(aprobarTardanza));
router.post('/:id/rechazar-tardanza', requireRole('ADMIN'), asyncHandler(rechazarTardanza));

router.get('/',      asyncHandler(listRegistros));
router.post('/',     requireRole('OPERADOR'), asyncHandler(upsertRegistro));
router.put('/:id',   requireRole('OPERADOR'), asyncHandler(updateRegistro));
router.delete('/:id', requireRole('OPERADOR'), asyncHandler(deleteRegistro));

export default router;
