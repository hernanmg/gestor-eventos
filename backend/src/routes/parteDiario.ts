import { Router } from 'express';
import { auth } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';
import { requireRole } from '../middleware/requireRole';
import { asyncHandler } from '../lib/asyncHandler';
import {
  listPartes, getParteDiario, crearParte, updateParte,
  addAsignacion, updateAsignacion, deleteAsignacion,
  cerrarParte, exportarParte,
} from '../controllers/parteDiario.controller';

const router = Router();
router.use(auth);
router.use(tenantMiddleware);

router.get('/',      asyncHandler(listPartes));
router.post('/',     requireRole('OPERADOR'), asyncHandler(crearParte));

router.get('/:fecha', asyncHandler(getParteDiario));

router.put('/:id',                    requireRole('OPERADOR'), asyncHandler(updateParte));
router.post('/:id/asignaciones',      requireRole('OPERADOR'), asyncHandler(addAsignacion));
router.put('/:id/asignaciones/:asignacionId',    requireRole('OPERADOR'), asyncHandler(updateAsignacion));
router.delete('/:id/asignaciones/:asignacionId', requireRole('OPERADOR'), asyncHandler(deleteAsignacion));
router.patch('/:id/cerrar',  requireRole('OPERADOR'), asyncHandler(cerrarParte));
router.get('/:id/exportar',  asyncHandler(exportarParte));

export default router;
