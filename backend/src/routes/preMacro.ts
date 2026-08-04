import { Router } from 'express';
import { auth } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';
import { requireRole } from '../middleware/requireRole';
import { asyncHandler } from '../lib/asyncHandler';
import { create, borrador, getOne, update, updateRubros, confirmar, discard } from '../controllers/preMacro.controller';

const router = Router();
router.use(auth);
router.use(tenantMiddleware);

// Antes de '/:id' — si no, Express intenta resolver "borrador" como :id
router.get('/borrador', asyncHandler(borrador));

router.post('/',              requireRole('OPERADOR'), asyncHandler(create));
router.get('/:id',            asyncHandler(getOne));
router.put('/:id',            requireRole('OPERADOR'), asyncHandler(update));
router.put('/:id/rubros',     requireRole('OPERADOR'), asyncHandler(updateRubros));
router.post('/:id/confirmar', requireRole('OPERADOR'), asyncHandler(confirmar));
router.delete('/:id',         requireRole('OPERADOR'), asyncHandler(discard));

export default router;
