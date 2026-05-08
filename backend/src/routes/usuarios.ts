import { Router } from 'express';
import { auth } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { asyncHandler } from '../lib/asyncHandler';
import { list, create, update, remove } from '../controllers/usuarios.controller';

const router = Router();

router.use(auth, requireRole('ADMIN'));
router.get('/',    asyncHandler(list));
router.post('/',   asyncHandler(create));
router.put('/:id', asyncHandler(update));
router.delete('/:id', asyncHandler(remove));

export default router;
