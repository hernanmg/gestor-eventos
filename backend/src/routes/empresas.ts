import { Router } from 'express';
import { auth } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';
import { requireAdminGlobal } from '../middleware/requireAdminGlobal';
import { asyncHandler } from '../lib/asyncHandler';
import {
  listEmpresas, getEmpresa, updateEmpresa, updateLogo, getLogo, getEmpresaActual, uploadLogo,
} from '../controllers/empresa.controller';

// Mounted at /api/empresas — administración cross-tenant, solo admin global.
const empresasRouter = Router();
empresasRouter.use(auth);
empresasRouter.get('/',            requireAdminGlobal, asyncHandler(listEmpresas));
empresasRouter.get('/:id',         requireAdminGlobal, asyncHandler(getEmpresa));
empresasRouter.put('/:id',         requireAdminGlobal, asyncHandler(updateEmpresa));
empresasRouter.put('/:id/logo',    requireAdminGlobal, uploadLogo.single('logo'), asyncHandler(updateLogo));
// La descarga del logo la puede pedir cualquier usuario autenticado (ej. para
// mostrarlo en el sidebar de su propia empresa).
empresasRouter.get('/:id/logo',    asyncHandler(getLogo));

// Mounted at /api/empresa — datos de la empresa del tenant activo.
const empresaActualRouter = Router();
empresaActualRouter.use(auth);
empresaActualRouter.use(tenantMiddleware);
empresaActualRouter.get('/actual', asyncHandler(getEmpresaActual));

export { empresasRouter, empresaActualRouter };
