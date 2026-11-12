import { Router } from 'express';
import { auth } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';
import { requireAnyRole, ROLES } from '../middleware/requireRole';
import { asyncHandler } from '../lib/asyncHandler';
import { upload } from '../controllers/importer.controller';
import {
  getProduccion, crearItemProduccion, actualizarItemProduccion, eliminarItemProduccion, importarProduccion,
} from '../controllers/produccionEvento.controller';

const uploadXlsx = (req: any, res: any, next: any) => {
  upload.single('archivo')(req, res, (err: any) => {
    if (err) { res.status(400).json({ error: err.message ?? 'Error al subir el archivo' }); return; }
    next();
  });
};

// ── Nested bajo /api/eventos/:id/produccion ───────────────────────────────────
// Mismo criterio que la Ficha: lectura TODOS_MENOS_RESTRINGIDOS, escritura ADMIN_OPERADOR.
export const produccionEventoRouter = Router({ mergeParams: true });
produccionEventoRouter.use(auth);
produccionEventoRouter.use(tenantMiddleware);
produccionEventoRouter.get('/',          requireAnyRole(ROLES.TODOS_MENOS_RESTRINGIDOS), asyncHandler(getProduccion));
produccionEventoRouter.post('/importar', requireAnyRole(ROLES.ADMIN_OPERADOR), uploadXlsx, asyncHandler(importarProduccion));
produccionEventoRouter.post('/:tipo',    requireAnyRole(ROLES.ADMIN_OPERADOR), asyncHandler(crearItemProduccion));

// ── /api/produccion/:tipo/:itemId ─────────────────────────────────────────────
export const produccionRouter = Router();
produccionRouter.use(auth);
produccionRouter.use(tenantMiddleware);
produccionRouter.put('/:tipo/:itemId',    requireAnyRole(ROLES.ADMIN_OPERADOR), asyncHandler(actualizarItemProduccion));
produccionRouter.delete('/:tipo/:itemId', requireAnyRole(ROLES.ADMIN_OPERADOR), asyncHandler(eliminarItemProduccion));
