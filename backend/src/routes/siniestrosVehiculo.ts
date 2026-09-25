import { Router } from 'express';
import { auth } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';
import { requireAnyRole, ROLES } from '../middleware/requireRole';
import { asyncHandler } from '../lib/asyncHandler';
import { uploadPlanillaSiniestros } from '../controllers/siniestros.controller';
import {
  listSiniestrosVehiculo, getSiniestroVehiculo, createSiniestroVehiculo, updateSiniestroVehiculo,
  resolverSiniestroVehiculo, importarSiniestrosVehiculo,
} from '../controllers/siniestrosVehiculo.controller';

function excelMiddleware(req: any, res: any, next: any) {
  uploadPlanillaSiniestros.single('archivo')(req, res, (err: any) => {
    if (err) { res.status(400).json({ error: err.message ?? 'Error al subir el archivo' }); return; }
    next();
  });
}

// Siniestros de vehículos (flota) — Lorena, DOS57. Misma matriz que
// /api/siniestros: lectura TODOS_MENOS_RESTRINGIDOS, escritura ADMIN_OPERADOR.
const router = Router();
router.use(auth);
router.use(tenantMiddleware);

router.post('/importar',     requireAnyRole(ROLES.ADMIN_OPERADOR), excelMiddleware, asyncHandler(importarSiniestrosVehiculo));
router.get('/',              requireAnyRole(ROLES.TODOS_MENOS_RESTRINGIDOS), asyncHandler(listSiniestrosVehiculo));
router.get('/:id',           requireAnyRole(ROLES.TODOS_MENOS_RESTRINGIDOS), asyncHandler(getSiniestroVehiculo));
router.post('/',             requireAnyRole(ROLES.ADMIN_OPERADOR), asyncHandler(createSiniestroVehiculo));
router.put('/:id',           requireAnyRole(ROLES.ADMIN_OPERADOR), asyncHandler(updateSiniestroVehiculo));
router.patch('/:id/resolver', requireAnyRole(ROLES.ADMIN_OPERADOR), asyncHandler(resolverSiniestroVehiculo));

export default router;
