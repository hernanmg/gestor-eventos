import { Router } from 'express';
import { auth } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';
import { requireRole } from '../middleware/requireRole';
import { asyncHandler } from '../lib/asyncHandler';
import { movimientoDiario } from '../controllers/movimientoDiario.controller';

// Movimiento Diario (DOS57, Flor) — solo lectura. Mismo alcance que
// /api/flota y /api/combustible: ADMIN y OPERADOR.
const router = Router();
router.use(auth);
router.use(tenantMiddleware);
router.use(requireRole('OPERADOR'));

router.get('/', asyncHandler(movimientoDiario));

export default router;
