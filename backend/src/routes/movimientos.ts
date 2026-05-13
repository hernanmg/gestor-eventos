import { Router } from 'express';
import { auth } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { requireEventoAcceso, requireEventoRole, byMovimientoId } from '../middleware/requireEventoAcceso';
import { asyncHandler } from '../lib/asyncHandler';
import { update, remove, reordenar } from '../controllers/movimientos.controller';

const router = Router();

router.use(auth);

router.put('/:id',         requireEventoAcceso(byMovimientoId), requireEventoRole('OPERADOR'), asyncHandler(update));
router.delete('/:id',      requireEventoAcceso(byMovimientoId), requireEventoRole('OPERADOR'), asyncHandler(remove));
router.patch('/:id/orden', requireEventoAcceso(byMovimientoId), requireEventoRole('OPERADOR'), asyncHandler(reordenar));

export default router;
