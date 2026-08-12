import { Router } from 'express';
import { auth } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';
import { requireAnyRole, ROLES } from '../middleware/requireRole';
import { asyncHandler } from '../lib/asyncHandler';
import {
  listComidas, getPedidoComidaPorFecha, crearPedidoComida,
  resumenComidas, exportarComidas,
  updatePedidoComida, deletePedidoComida,
  addLineaComida, updateLineaComida, deleteLineaComida,
} from '../controllers/comidas.controller';

// ── Nested bajo /api/eventos/:id/comidas ──────────────────────────────────────
// Lectura: TODOS_MENOS_RESTRINGIDOS. Escritura: ADMIN_OPERADOR, por rol global
// (sin el ACL puntual de EventoAcceso — ver eventos.ts).
export const comidasEventoRouter = Router({ mergeParams: true });
comidasEventoRouter.use(auth);
comidasEventoRouter.use(tenantMiddleware);
comidasEventoRouter.get('/resumen',  requireAnyRole(ROLES.TODOS_MENOS_RESTRINGIDOS), asyncHandler(resumenComidas));
comidasEventoRouter.get('/exportar', requireAnyRole(ROLES.TODOS_MENOS_RESTRINGIDOS), asyncHandler(exportarComidas));
comidasEventoRouter.post('/',        requireAnyRole(ROLES.ADMIN_OPERADOR), asyncHandler(crearPedidoComida));
comidasEventoRouter.get('/:fecha',   requireAnyRole(ROLES.TODOS_MENOS_RESTRINGIDOS), asyncHandler(getPedidoComidaPorFecha));
comidasEventoRouter.get('/',         requireAnyRole(ROLES.TODOS_MENOS_RESTRINGIDOS), asyncHandler(listComidas));

// ── /api/comidas ───────────────────────────────────────────────────────────────
export const comidasRouter = Router();
comidasRouter.use(auth);
comidasRouter.use(tenantMiddleware);
comidasRouter.put('/lineas/:id',    requireAnyRole(ROLES.ADMIN_OPERADOR), asyncHandler(updateLineaComida));
comidasRouter.delete('/lineas/:id', requireAnyRole(ROLES.ADMIN_OPERADOR), asyncHandler(deleteLineaComida));
comidasRouter.put('/:id',           requireAnyRole(ROLES.ADMIN_OPERADOR), asyncHandler(updatePedidoComida));
comidasRouter.delete('/:id',        requireAnyRole(ROLES.ADMIN_OPERADOR), asyncHandler(deletePedidoComida));
comidasRouter.post('/:id/lineas',   requireAnyRole(ROLES.ADMIN_OPERADOR), asyncHandler(addLineaComida));
