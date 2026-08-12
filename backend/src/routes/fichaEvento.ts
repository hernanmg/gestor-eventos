import { Router } from 'express';
import { auth } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';
import { requireAnyRole, ROLES } from '../middleware/requireRole';
import { asyncHandler } from '../lib/asyncHandler';
import {
  getFicha, resumenFicha, inicializarFicha, exportarFicha,
  updateRubroEvento, addPedidoItem, updatePedidoItem, deletePedidoItem,
  asignarStock, desasignarStock,
} from '../controllers/fichaEvento.controller';

// ── Nested bajo /api/eventos/:id/ficha ────────────────────────────────────────
// Lectura: TODOS_MENOS_RESTRINGIDOS. Escritura: ADMIN_OPERADOR, por rol global
// (sin el ACL puntual de EventoAcceso — ver eventos.ts).
export const fichaEventoRouter = Router({ mergeParams: true });
fichaEventoRouter.use(auth);
fichaEventoRouter.use(tenantMiddleware);
fichaEventoRouter.get('/resumen',      requireAnyRole(ROLES.TODOS_MENOS_RESTRINGIDOS), asyncHandler(resumenFicha));
fichaEventoRouter.get('/exportar',     requireAnyRole(ROLES.TODOS_MENOS_RESTRINGIDOS), asyncHandler(exportarFicha));
fichaEventoRouter.post('/inicializar', requireAnyRole(ROLES.ADMIN_OPERADOR), asyncHandler(inicializarFicha));
fichaEventoRouter.get('/',             requireAnyRole(ROLES.TODOS_MENOS_RESTRINGIDOS), asyncHandler(getFicha));

// ── /api/rubros-evento ─────────────────────────────────────────────────────────
export const rubrosEventoRouter = Router();
rubrosEventoRouter.use(auth);
rubrosEventoRouter.use(tenantMiddleware);
rubrosEventoRouter.put('/:id',        requireAnyRole(ROLES.ADMIN_OPERADOR), asyncHandler(updateRubroEvento));
rubrosEventoRouter.post('/:id/items', requireAnyRole(ROLES.ADMIN_OPERADOR), asyncHandler(addPedidoItem));
rubrosEventoRouter.post('/:id/asignar-stock',                requireAnyRole(ROLES.ADMIN_OPERADOR), asyncHandler(asignarStock));
rubrosEventoRouter.delete('/:id/asignaciones/:asignacionId', requireAnyRole(ROLES.ADMIN_OPERADOR), asyncHandler(desasignarStock));

// ── /api/pedido-items ──────────────────────────────────────────────────────────
export const pedidoItemsRouter = Router();
pedidoItemsRouter.use(auth);
pedidoItemsRouter.use(tenantMiddleware);
pedidoItemsRouter.put('/:id',    requireAnyRole(ROLES.ADMIN_OPERADOR), asyncHandler(updatePedidoItem));
pedidoItemsRouter.delete('/:id', requireAnyRole(ROLES.ADMIN_OPERADOR), asyncHandler(deletePedidoItem));
