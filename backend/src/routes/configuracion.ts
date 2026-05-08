import { Router } from 'express';
import { auth } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { asyncHandler } from '../lib/asyncHandler';
import { listTabs, updateTab } from '../controllers/configuracion.controller';

const router = Router();

router.use(auth);
router.get('/tabs',     asyncHandler(listTabs));
router.put('/tabs/:id', requireRole('ADMIN'), asyncHandler(updateTab));

export default router;
