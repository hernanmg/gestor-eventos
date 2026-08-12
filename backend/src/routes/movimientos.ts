import { Router } from 'express';
import { auth } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';
import { requireAnyRole, ROLES } from '../middleware/requireRole';
import { asyncHandler } from '../lib/asyncHandler';
import { update, remove, reordenar, vincularProveedor, listMacro, exportarMacro } from '../controllers/movimientos.controller';

const router = Router();

router.use(auth);

// Vista Macro — cross-evento y, para el admin global, cross-empresa. No lleva
// tenantMiddleware: resolveMacroWhere() en el controller resuelve el alcance
// de empresa por su cuenta (admin global puede no tener empresa activa de
// sesión todavía y aun así necesita ver "todas las empresas").
router.get('/exportar', asyncHandler(exportarMacro));
router.get('/',         asyncHandler(listMacro));

router.post('/vincular-proveedor', tenantMiddleware, requireAnyRole(ROLES.ADMIN_OPERADOR), asyncHandler(vincularProveedor));

// Escritura por rol global — cada controller ya valida tenant/existencia con
// withTenant(), así que no hace falta el ACL puntual de EventoAcceso acá.
router.put('/:id',         tenantMiddleware, requireAnyRole(ROLES.ADMIN_OPERADOR), asyncHandler(update));
router.delete('/:id',      tenantMiddleware, requireAnyRole(ROLES.ADMIN_OPERADOR), asyncHandler(remove));
router.patch('/:id/orden', tenantMiddleware, requireAnyRole(ROLES.ADMIN_OPERADOR), asyncHandler(reordenar));

export default router;
