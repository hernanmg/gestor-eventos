import { Router } from 'express';
import { auth } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';
import { requireRole } from '../middleware/requireRole';
import { requireEventoAcceso, requireEventoRole, byMovimientoId } from '../middleware/requireEventoAcceso';
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

router.post('/vincular-proveedor', tenantMiddleware, requireRole('OPERADOR'), asyncHandler(vincularProveedor));

router.put('/:id',         tenantMiddleware, requireEventoAcceso(byMovimientoId), requireEventoRole('OPERADOR'), asyncHandler(update));
router.delete('/:id',      tenantMiddleware, requireEventoAcceso(byMovimientoId), requireEventoRole('OPERADOR'), asyncHandler(remove));
router.patch('/:id/orden', tenantMiddleware, requireEventoAcceso(byMovimientoId), requireEventoRole('OPERADOR'), asyncHandler(reordenar));

export default router;
