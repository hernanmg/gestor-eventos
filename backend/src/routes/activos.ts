import { Router } from 'express';
import { auth } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';
import { requireRole } from '../middleware/requireRole';
import { asyncHandler } from '../lib/asyncHandler';
import { listActivos, createActivo, updateActivo, deleteActivo } from '../controllers/activo.controller';

const router = Router();
router.use(auth);
router.use(tenantMiddleware);

router.get('/',        asyncHandler(listActivos));
router.post('/',       requireRole('ADMIN'), asyncHandler(createActivo));
router.put('/:id',     requireRole('ADMIN'), asyncHandler(updateActivo));
router.delete('/:id',  requireRole('ADMIN'), asyncHandler(deleteActivo));

export default router;
