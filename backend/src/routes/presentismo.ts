import { Router } from 'express';
import { auth } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';
import { requireRole } from '../middleware/requireRole';
import { asyncHandler } from '../lib/asyncHandler';
import {
  listRegistros, getPresentismoHoy, upsertRegistro, updateRegistro, deleteRegistro, marcarTodosPresentes,
  getResumenMes, getResumenMesEmpleado, cerrarMes, aprobarTardanza, rechazarTardanza, importarReloj,
  exportarPresentismo,
} from '../controllers/presentismo.controller';

const router = Router();
router.use(auth);
router.use(tenantMiddleware);

router.get('/hoy',                asyncHandler(getPresentismoHoy));
router.get('/resumen-mes',        asyncHandler(getResumenMes));
router.get('/resumen-mes/:empleadoId', asyncHandler(getResumenMesEmpleado));
router.get('/exportar',           asyncHandler(exportarPresentismo));
router.post('/cerrar-mes',        requireRole('OPERADOR'), asyncHandler(cerrarMes));
router.post('/marcar-todos-presentes', requireRole('OPERADOR'), asyncHandler(marcarTodosPresentes));
router.post('/importar',          requireRole('OPERADOR'), asyncHandler(importarReloj));
router.post('/:id/aprobar-tardanza',  requireRole('ADMIN'), asyncHandler(aprobarTardanza));
router.post('/:id/rechazar-tardanza', requireRole('ADMIN'), asyncHandler(rechazarTardanza));

router.get('/',      asyncHandler(listRegistros));
router.post('/',     requireRole('OPERADOR'), asyncHandler(upsertRegistro));
router.put('/:id',   requireRole('OPERADOR'), asyncHandler(updateRegistro));
router.delete('/:id', requireRole('OPERADOR'), asyncHandler(deleteRegistro));

export default router;
