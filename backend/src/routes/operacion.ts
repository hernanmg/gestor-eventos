import { Router } from 'express';
import { auth } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';
import { requireAnyRole, ROLES } from '../middleware/requireRole';
import { asyncHandler } from '../lib/asyncHandler';
import {
  getOperacion, createTarea, updateTarea, deleteTarea, cargarTareasTipo,
  getPlantillaTareas, putPlantillaTareas, exportarCuadrilla,
} from '../controllers/operacion.controller';

// Pestaña Operación (DOS57): cuadrilla por fase y tareas por rubro.
const lectura = requireAnyRole(ROLES.TODOS_MENOS_RESTRINGIDOS);
const carga   = requireAnyRole(ROLES.ADMIN_OPERADOR);

// ── Nested bajo /api/eventos/:id/operacion ────────────────────────────────────
export const operacionEventoRouter = Router({ mergeParams: true });
operacionEventoRouter.use(auth, tenantMiddleware);
operacionEventoRouter.get('/',                lectura, asyncHandler(getOperacion));
operacionEventoRouter.get('/cuadrilla-excel', lectura, asyncHandler(exportarCuadrilla));
operacionEventoRouter.post('/tareas',         carga,   asyncHandler(createTarea));

// ── /api/operacion ────────────────────────────────────────────────────────────
export const operacionRouter = Router();
operacionRouter.use(auth, tenantMiddleware);
operacionRouter.put('/tareas/:id',                  carga,   asyncHandler(updateTarea));
operacionRouter.delete('/tareas/:id',               carga,   asyncHandler(deleteTarea));
operacionRouter.post('/rubros-evento/:id/cargar-tareas', carga, asyncHandler(cargarTareasTipo));
operacionRouter.get('/rubros/:id/plantilla-tareas', lectura, asyncHandler(getPlantillaTareas));
operacionRouter.put('/rubros/:id/plantilla-tareas', carga,   asyncHandler(putPlantillaTareas));
