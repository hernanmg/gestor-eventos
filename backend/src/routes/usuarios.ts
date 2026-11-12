import { Router } from 'express';
import { auth } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';
import { requireRole } from '../middleware/requireRole';
import { asyncHandler } from '../lib/asyncHandler';
import {
  list, create, update, remove, listAccesos, createAcceso, updateAcceso, deleteAcceso,
  listEmpresaAccesos, createEmpresaAcceso, deleteEmpresaAcceso,
} from '../controllers/usuarios.controller';

const router = Router();

router.use(auth, tenantMiddleware, requireRole('ADMIN'));
router.get('/',    asyncHandler(list));
router.post('/',   asyncHandler(create));
router.put('/:id', asyncHandler(update));
router.delete('/:id', asyncHandler(remove));

// EventoAcceso CRUD
router.get('/:id/accesos',                asyncHandler(listAccesos));
router.post('/:id/accesos/:eventoId',     asyncHandler(createAcceso));
router.put('/:id/accesos/:eventoId',      asyncHandler(updateAcceso));
router.delete('/:id/accesos/:eventoId',   asyncHandler(deleteAcceso));

// UsuarioEmpresaAcceso CRUD (acceso multi-empresa — solo admin global, ver controller)
router.get('/:id/empresas',               asyncHandler(listEmpresaAccesos));
router.post('/:id/empresas/:empresaId',   asyncHandler(createEmpresaAcceso));
router.delete('/:id/empresas/:empresaId', asyncHandler(deleteEmpresaAcceso));

export default router;
