import { Router } from 'express';
import { auth } from '../middleware/auth';
import { asyncHandler } from '../lib/asyncHandler';
import { getResumen, getKPIsEvento, getAlertas } from '../controllers/dashboard.controller';

const router = Router();
router.use(auth);
router.get('/resumen',         asyncHandler(getResumen));
router.get('/evento/:id/kpis', asyncHandler(getKPIsEvento));
router.get('/alertas',         asyncHandler(getAlertas));

export default router;
