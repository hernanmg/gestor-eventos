import { Router } from 'express';
import { auth } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';
import { requireRole } from '../middleware/requireRole';
import { asyncHandler } from '../lib/asyncHandler';
import {
  listRubros, createRubro, updateRubro, reordenarRubros, deleteRubro, toggleRubro,
} from '../controllers/rubros.controller';

const router = Router();

router.use(auth);
router.use(tenantMiddleware);

router.get('/',            asyncHandler(listRubros));
router.post('/',           requireRole('ADMIN'), asyncHandler(createRubro));
router.patch('/reordenar', requireRole('ADMIN'), asyncHandler(reordenarRubros));
router.put('/:id',         requireRole('ADMIN'), asyncHandler(updateRubro));
router.delete('/:id',      requireRole('ADMIN'), asyncHandler(deleteRubro));
router.patch('/:id',       requireRole('ADMIN'), asyncHandler(toggleRubro));

export default router;
