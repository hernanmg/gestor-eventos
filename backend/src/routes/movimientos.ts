import { Router } from 'express';
import { auth } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { asyncHandler } from '../lib/asyncHandler';
import { update, remove, reordenar } from '../controllers/movimientos.controller';

const router = Router();

router.use(auth);

router.put('/:id',         requireRole('OPERADOR'), asyncHandler(update));
router.delete('/:id',      requireRole('OPERADOR'), asyncHandler(remove));
router.patch('/:id/orden', requireRole('OPERADOR'), asyncHandler(reordenar));

export default router;
