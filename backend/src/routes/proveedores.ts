import { Router } from 'express';
import { auth } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';
import { requireRole, requireAnyRole, ROLES } from '../middleware/requireRole';
import { asyncHandler } from '../lib/asyncHandler';
import {
  list, getById, create, update, remove, buscar, toggleActivo,
} from '../controllers/proveedores.controller';

const router = Router();

router.use(auth);
router.use(tenantMiddleware);

// Lectura abierta a TODOS_MENOS_RESTRINGIDOS — OPERADOR/VIEWER necesitan ver
// proveedores para los combobox de Ficha/Movimientos aunque no puedan
// crear/editar el ABM (matriz de permisos).
// buscar MUST be before /:id so Express doesn't match "buscar" as an id
router.get('/buscar',    requireAnyRole(ROLES.TODOS_MENOS_RESTRINGIDOS), asyncHandler(buscar));
router.get('/',          requireAnyRole(ROLES.TODOS_MENOS_RESTRINGIDOS), asyncHandler(list));
router.get('/:id',       requireAnyRole(ROLES.TODOS_MENOS_RESTRINGIDOS), asyncHandler(getById));
router.post('/',         requireRole('ADMIN'), asyncHandler(create));
router.put('/:id',       requireRole('ADMIN'), asyncHandler(update));
router.patch('/:id',     requireRole('ADMIN'), asyncHandler(toggleActivo));
router.delete('/:id',    requireRole('ADMIN'), asyncHandler(remove));

export default router;
