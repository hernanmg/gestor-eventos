import { Router } from 'express';
import { auth } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';
import { requireRole } from '../middleware/requireRole';
import { asyncHandler } from '../lib/asyncHandler';
import {
  list, getById, create, update, remove, buscar, toggleActivo,
} from '../controllers/proveedores.controller';

const router = Router();

router.use(auth);
router.use(tenantMiddleware);
router.use(requireRole('ADMIN')); // Proveedores es exclusivo de ADMIN (matriz de permisos)

// buscar MUST be before /:id so Express doesn't match "buscar" as an id
router.get('/buscar',    asyncHandler(buscar));
router.get('/',          asyncHandler(list));
router.get('/:id',       asyncHandler(getById));
router.post('/',         asyncHandler(create));
router.put('/:id',       asyncHandler(update));
router.patch('/:id',     asyncHandler(toggleActivo));
router.delete('/:id',    asyncHandler(remove));

export default router;
