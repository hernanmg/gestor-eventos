import { Router } from 'express';
import { auth } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { requireEventoAcceso, requireEventoRole, byEcheqId } from '../middleware/requireEventoAcceso';
import { asyncHandler } from '../lib/asyncHandler';
import { updateEcheq, deleteEcheq, cobrarEcheq, rechazarEcheq } from '../controllers/echeqs.controller';

const router = Router();

router.use(auth);
router.put('/:id',            requireEventoAcceso(byEcheqId), requireEventoRole('OPERADOR'), asyncHandler(updateEcheq));
router.delete('/:id',         requireEventoAcceso(byEcheqId), requireEventoRole('OPERADOR'), asyncHandler(deleteEcheq));
router.patch('/:id/cobrar',   requireEventoAcceso(byEcheqId), requireEventoRole('OPERADOR'), asyncHandler(cobrarEcheq));
router.patch('/:id/rechazar', requireEventoAcceso(byEcheqId), requireEventoRole('OPERADOR'), asyncHandler(rechazarEcheq));

export default router;
