import { Router } from 'express';
import { login, logout, me } from '../controllers/auth.controller';
import { auth } from '../middleware/auth';
import { asyncHandler } from '../lib/asyncHandler';

const router = Router();

router.post('/login',  asyncHandler(login));
router.post('/logout', asyncHandler(logout));
router.get('/me',      auth, asyncHandler(me));

export default router;
