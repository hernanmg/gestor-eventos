import { Router } from 'express';
import { auth } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';
import {
  requireEventoAcceso, requireEventoRole, byRubroEventoId, byPedidoItemId,
} from '../middleware/requireEventoAcceso';
import { asyncHandler } from '../lib/asyncHandler';
import {
  getFicha, resumenFicha, inicializarFicha, exportarFicha,
  updateRubroEvento, addPedidoItem, updatePedidoItem, deletePedidoItem,
  asignarStock, desasignarStock,
} from '../controllers/fichaEvento.controller';

// ── Nested bajo /api/eventos/:id/ficha ────────────────────────────────────────
export const fichaEventoRouter = Router({ mergeParams: true });
fichaEventoRouter.use(auth);
fichaEventoRouter.use(tenantMiddleware);
fichaEventoRouter.get('/resumen',      requireEventoAcceso(), asyncHandler(resumenFicha));
fichaEventoRouter.get('/exportar',     requireEventoAcceso(), asyncHandler(exportarFicha));
fichaEventoRouter.post('/inicializar', requireEventoAcceso(), requireEventoRole('OPERADOR'), asyncHandler(inicializarFicha));
fichaEventoRouter.get('/',             requireEventoAcceso(), asyncHandler(getFicha));

// ── /api/rubros-evento ─────────────────────────────────────────────────────────
export const rubrosEventoRouter = Router();
rubrosEventoRouter.use(auth);
rubrosEventoRouter.use(tenantMiddleware);
rubrosEventoRouter.put('/:id',        requireEventoAcceso(byRubroEventoId), requireEventoRole('OPERADOR'), asyncHandler(updateRubroEvento));
rubrosEventoRouter.post('/:id/items', requireEventoAcceso(byRubroEventoId), requireEventoRole('OPERADOR'), asyncHandler(addPedidoItem));
rubrosEventoRouter.post('/:id/asignar-stock',                requireEventoAcceso(byRubroEventoId), requireEventoRole('OPERADOR'), asyncHandler(asignarStock));
rubrosEventoRouter.delete('/:id/asignaciones/:asignacionId', requireEventoAcceso(byRubroEventoId), requireEventoRole('OPERADOR'), asyncHandler(desasignarStock));

// ── /api/pedido-items ──────────────────────────────────────────────────────────
export const pedidoItemsRouter = Router();
pedidoItemsRouter.use(auth);
pedidoItemsRouter.use(tenantMiddleware);
pedidoItemsRouter.put('/:id',    requireEventoAcceso(byPedidoItemId), requireEventoRole('OPERADOR'), asyncHandler(updatePedidoItem));
pedidoItemsRouter.delete('/:id', requireEventoAcceso(byPedidoItemId), requireEventoRole('OPERADOR'), asyncHandler(deletePedidoItem));
