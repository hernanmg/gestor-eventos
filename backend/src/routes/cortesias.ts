import { Router } from 'express';
import { auth } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';
import { requireAnyRole, ROLES } from '../middleware/requireRole';
import { asyncHandler } from '../lib/asyncHandler';
import { upload } from '../controllers/importer.controller';
import {
  listCortesias, createCortesia, updateCortesia, visarCortesia, entregarCortesia, deleteCortesia,
  importarCortesias, exportarCortesias,
} from '../controllers/cortesias.controller';

const uploadXlsx = (req: any, res: any, next: any) => {
  upload.single('archivo')(req, res, (err: any) => {
    if (err) { res.status(400).json({ error: err.message ?? 'Error al subir el archivo' }); return; }
    next();
  });
};

// ── Nested bajo /api/eventos/:id/cortesias ────────────────────────────────────
// Lectura: TODOS_MENOS_RESTRINGIDOS. Escritura: ADMIN_OPERADOR, por rol global
// (sin el ACL puntual de EventoAcceso — ver eventos.ts).
export const cortesiasEventoRouter = Router({ mergeParams: true });
cortesiasEventoRouter.use(auth);
cortesiasEventoRouter.use(tenantMiddleware);
cortesiasEventoRouter.get('/exportar',  requireAnyRole(ROLES.TODOS_MENOS_RESTRINGIDOS), asyncHandler(exportarCortesias));
cortesiasEventoRouter.post('/importar', requireAnyRole(ROLES.ADMIN_OPERADOR), uploadXlsx, asyncHandler(importarCortesias));
cortesiasEventoRouter.post('/',         requireAnyRole(ROLES.ADMIN_OPERADOR), asyncHandler(createCortesia));
cortesiasEventoRouter.get('/',          requireAnyRole(ROLES.TODOS_MENOS_RESTRINGIDOS), asyncHandler(listCortesias));

// ── /api/eventos/cortesias/:id ────────────────────────────────────────────────
export const cortesiasRouter = Router();
cortesiasRouter.use(auth);
cortesiasRouter.use(tenantMiddleware);
cortesiasRouter.put('/:id',              requireAnyRole(ROLES.ADMIN_OPERADOR), asyncHandler(updateCortesia));
cortesiasRouter.patch('/:id/visar',      requireAnyRole(ROLES.ADMIN_OPERADOR), asyncHandler(visarCortesia));
cortesiasRouter.patch('/:id/entregar',   requireAnyRole(ROLES.ADMIN_OPERADOR), asyncHandler(entregarCortesia));
cortesiasRouter.delete('/:id',           requireAnyRole(ROLES.ADMIN_OPERADOR), asyncHandler(deleteCortesia));
