import { Router } from 'express';
import { auth } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { asyncHandler } from '../lib/asyncHandler';
import { updateEcheq, deleteEcheq, cobrarEcheq, rechazarEcheq } from '../controllers/echeqs.controller';

const router = Router();

router.use(auth);
router.put('/:id',           requireRole('OPERADOR'), asyncHandler(updateEcheq));
router.delete('/:id',        requireRole('OPERADOR'), asyncHandler(deleteEcheq));
router.patch('/:id/cobrar',  requireRole('OPERADOR'), asyncHandler(cobrarEcheq));
router.patch('/:id/rechazar', requireRole('OPERADOR'), asyncHandler(rechazarEcheq));

export default router;
