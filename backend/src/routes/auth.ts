import { Router } from 'express';
import { login, logout, me, switchEmpresa } from '../controllers/auth.controller';
import { auth } from '../middleware/auth';
import { asyncHandler } from '../lib/asyncHandler';

const router = Router();

router.post('/login',           asyncHandler(login));
router.post('/logout',          asyncHandler(logout));
router.get('/me',               auth, asyncHandler(me));
router.post('/switch-empresa',  auth, asyncHandler(switchEmpresa));

export default router;
