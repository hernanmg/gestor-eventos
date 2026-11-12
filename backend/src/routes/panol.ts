import { Router } from 'express';
import { auth } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';
import { requireAnyRole, ROLES } from '../middleware/requireRole';
import { asyncHandler } from '../lib/asyncHandler';
import {
  listPanolItems, getPanolItem, createPanolItem, updatePanolItem, deletePanolItem,
  listMovimientosPanol, createMovimientoPanol, devolverMovimientoPanol,
  getAlertasPanol,
} from '../controllers/panol.controller';

const router = Router();
router.use(auth);
router.use(tenantMiddleware);
// Módulo exclusivo de ADMIN y PAÑOLERO — ni OPERADOR ni VIEWER tienen acceso
// (matriz de permisos), a diferencia del resto de Stock.
router.use(requireAnyRole(ROLES.PAÑOL));

// ── Items ─────────────────────────────────────────────────────────────────────
router.get('/items',        asyncHandler(listPanolItems));
router.get('/items/:id',    asyncHandler(getPanolItem));
router.post('/items',       asyncHandler(createPanolItem));
router.put('/items/:id',    asyncHandler(updatePanolItem));
router.delete('/items/:id', asyncHandler(deletePanolItem));

// ── Movimientos ───────────────────────────────────────────────────────────────
router.get('/movimientos',                asyncHandler(listMovimientosPanol));
router.post('/movimientos',               asyncHandler(createMovimientoPanol));
router.patch('/movimientos/:id/devolver', asyncHandler(devolverMovimientoPanol));

// ── Alertas ───────────────────────────────────────────────────────────────────
router.get('/alertas', asyncHandler(getAlertasPanol));

export default router;
