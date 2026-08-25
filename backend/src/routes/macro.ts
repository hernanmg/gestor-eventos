import { Router } from 'express';
import { auth } from '../middleware/auth';
import { asyncHandler } from '../lib/asyncHandler';
import { resumenFinanciero } from '../controllers/macro.controller';

// Router /api/macro — sin tenantMiddleware: esta vista es cross-empresa por
// diseño (admin global o puede_ver_macro), no depende de la empresa activa
// de la sesión. El control de acceso vive en el controller (resolveUsuarioMacro).
export const macroRouter = Router();
macroRouter.use(auth);
macroRouter.get('/resumen-financiero', asyncHandler(resumenFinanciero));
