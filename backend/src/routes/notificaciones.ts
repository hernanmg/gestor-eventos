import { Router } from 'express';
import { auth } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';
import { asyncHandler } from '../lib/asyncHandler';
import { getNotificaciones } from '../controllers/notificaciones.controller';

const router = Router();
router.use(auth);
router.use(tenantMiddleware);

router.get('/', asyncHandler(getNotificaciones));

export default router;
