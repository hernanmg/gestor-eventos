import { Router } from 'express';
import { auth } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { asyncHandler } from '../lib/asyncHandler';
import {
  list, getById, create, update, remove, buscar, toggleActivo,
} from '../controllers/proveedores.controller';

const router = Router();

router.use(auth);

// buscar MUST be before /:id so Express doesn't match "buscar" as an id
router.get('/buscar',    asyncHandler(buscar));
router.get('/',          asyncHandler(list));
router.get('/:id',       asyncHandler(getById));
router.post('/',         requireRole('OPERADOR'), asyncHandler(create));
router.put('/:id',       requireRole('OPERADOR'), asyncHandler(update));
router.patch('/:id',     requireRole('OPERADOR'), asyncHandler(toggleActivo));
router.delete('/:id',    requireRole('ADMIN'),    asyncHandler(remove));

export default router;
