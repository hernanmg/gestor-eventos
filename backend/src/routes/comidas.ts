import { Router } from 'express';
import { auth } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';
import {
  requireEventoAcceso, requireEventoRole, byPedidoComidaId, byLineaComidaId,
} from '../middleware/requireEventoAcceso';
import { asyncHandler } from '../lib/asyncHandler';
import {
  listComidas, getPedidoComidaPorFecha, crearPedidoComida,
  resumenComidas, exportarComidas,
  updatePedidoComida, deletePedidoComida,
  addLineaComida, updateLineaComida, deleteLineaComida,
} from '../controllers/comidas.controller';

// ── Nested bajo /api/eventos/:id/comidas ──────────────────────────────────────
export const comidasEventoRouter = Router({ mergeParams: true });
comidasEventoRouter.use(auth);
comidasEventoRouter.use(tenantMiddleware);
comidasEventoRouter.get('/resumen',  requireEventoAcceso(), asyncHandler(resumenComidas));
comidasEventoRouter.get('/exportar', requireEventoAcceso(), asyncHandler(exportarComidas));
comidasEventoRouter.post('/',        requireEventoAcceso(), requireEventoRole('OPERADOR'), asyncHandler(crearPedidoComida));
comidasEventoRouter.get('/:fecha',   requireEventoAcceso(), asyncHandler(getPedidoComidaPorFecha));
comidasEventoRouter.get('/',         requireEventoAcceso(), asyncHandler(listComidas));

// ── /api/comidas ───────────────────────────────────────────────────────────────
export const comidasRouter = Router();
comidasRouter.use(auth);
comidasRouter.use(tenantMiddleware);
comidasRouter.put('/lineas/:id',    requireEventoAcceso(byLineaComidaId),  requireEventoRole('OPERADOR'), asyncHandler(updateLineaComida));
comidasRouter.delete('/lineas/:id', requireEventoAcceso(byLineaComidaId),  requireEventoRole('OPERADOR'), asyncHandler(deleteLineaComida));
comidasRouter.put('/:id',           requireEventoAcceso(byPedidoComidaId), requireEventoRole('OPERADOR'), asyncHandler(updatePedidoComida));
comidasRouter.delete('/:id',        requireEventoAcceso(byPedidoComidaId), requireEventoRole('OPERADOR'), asyncHandler(deletePedidoComida));
comidasRouter.post('/:id/lineas',   requireEventoAcceso(byPedidoComidaId), requireEventoRole('OPERADOR'), asyncHandler(addLineaComida));
