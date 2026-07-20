import { Router } from 'express';
import { auth } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';
import { requireRole } from '../middleware/requireRole';
import { asyncHandler } from '../lib/asyncHandler';
import {
  listPanolItems, getPanolItem, createPanolItem, updatePanolItem, deletePanolItem,
  listMovimientosPanol, createMovimientoPanol, devolverMovimientoPanol,
  getAlertasPanol,
} from '../controllers/panol.controller';

const router = Router();
router.use(auth);
router.use(tenantMiddleware);

// ── Items ─────────────────────────────────────────────────────────────────────
router.get('/items',        asyncHandler(listPanolItems));
router.get('/items/:id',    asyncHandler(getPanolItem));
router.post('/items',       requireRole('ADMIN'),    asyncHandler(createPanolItem));
router.put('/items/:id',    requireRole('OPERADOR'), asyncHandler(updatePanolItem));
router.delete('/items/:id', requireRole('ADMIN'),    asyncHandler(deletePanolItem));

// ── Movimientos ───────────────────────────────────────────────────────────────
router.get('/movimientos',              asyncHandler(listMovimientosPanol));
router.post('/movimientos',             requireRole('OPERADOR'), asyncHandler(createMovimientoPanol));
router.patch('/movimientos/:id/devolver', requireRole('OPERADOR'), asyncHandler(devolverMovimientoPanol));

// ── Alertas ───────────────────────────────────────────────────────────────────
router.get('/alertas', asyncHandler(getAlertasPanol));

export default router;
