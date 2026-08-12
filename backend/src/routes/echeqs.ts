import { Router } from 'express';
import { auth } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';
import { requireAnyRole, ROLES } from '../middleware/requireRole';
import { asyncHandler } from '../lib/asyncHandler';
import { updateEcheq, deleteEcheq, cobrarEcheq, rechazarEcheq } from '../controllers/echeqs.controller';

const router = Router();

router.use(auth);
router.use(tenantMiddleware);
router.put('/:id',            requireAnyRole(ROLES.ADMIN_OPERADOR), asyncHandler(updateEcheq));
router.delete('/:id',         requireAnyRole(ROLES.ADMIN_OPERADOR), asyncHandler(deleteEcheq));
router.patch('/:id/cobrar',   requireAnyRole(ROLES.ADMIN_OPERADOR), asyncHandler(cobrarEcheq));
router.patch('/:id/rechazar', requireAnyRole(ROLES.ADMIN_OPERADOR), asyncHandler(rechazarEcheq));

export default router;
