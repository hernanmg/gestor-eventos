import { Router } from 'express';
import { auth } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { asyncHandler } from '../lib/asyncHandler';
import {
  listTabs, updateTab, createTab, deleteTab, reorderTabs, toggleTab,
} from '../controllers/configuracion.controller';

const router = Router();

router.use(auth);
router.get('/tabs',                  asyncHandler(listTabs));
router.put('/tabs/:id',              requireRole('ADMIN'), asyncHandler(updateTab));
router.post('/tabs',                 requireRole('ADMIN'), asyncHandler(createTab));
router.delete('/tabs/:id',           requireRole('ADMIN'), asyncHandler(deleteTab));
router.patch('/tabs/reordenar',      requireRole('ADMIN'), asyncHandler(reorderTabs));
router.patch('/tabs/:id',            requireRole('ADMIN'), asyncHandler(toggleTab));

export default router;
