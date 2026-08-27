import { Router } from 'express';
import { auth } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';
import { requireRole } from '../middleware/requireRole';
import { asyncHandler } from '../lib/asyncHandler';
import {
  uploadDoc,
  listVehiculos, detalleVehiculo, createVehiculo, updateVehiculo, darDeBajaVehiculo,
  listSegurosVehiculo, listSegurosEmpresa, createSeguroVehiculo, updateSeguroVehiculo, deleteSeguroVehiculo, getPolizaSeguro,
  listPatentesVehiculo, listPatentesEmpresa, createPatenteVehiculo, updatePatenteVehiculo,
  listPeajes, listPeajesVehiculo, createPeaje, deletePeaje,
  listTaller, listTallerVehiculo, createServicioTaller, updateServicioTaller, deleteServicioTaller,
  alertasFlota,
} from '../controllers/flota.controller';

function docMiddleware(field: string) {
  return (req: any, res: any, next: any) => {
    uploadDoc.single(field)(req, res, (err: any) => {
      if (err) { res.status(400).json({ error: err.message ?? 'Error al subir el archivo' }); return; }
      next();
    });
  };
}

const router = Router();
router.use(auth);
router.use(tenantMiddleware);
router.use(requireRole('OPERADOR')); // Flota visible para ADMIN y OPERADOR (matriz de permisos)

// ── Vehículos ─────────────────────────────────────────────────────────────────
router.get('/vehiculos',           asyncHandler(listVehiculos));
router.get('/vehiculos/:id',       asyncHandler(detalleVehiculo));
router.post('/vehiculos',          requireRole('ADMIN'), asyncHandler(createVehiculo));
router.put('/vehiculos/:id',       requireRole('ADMIN'), asyncHandler(updateVehiculo));
router.delete('/vehiculos/:id',    requireRole('ADMIN'), asyncHandler(darDeBajaVehiculo));

// ── Seguros ───────────────────────────────────────────────────────────────────
router.get('/seguros',                 asyncHandler(listSegurosEmpresa));
router.get('/seguros/:id/poliza',      asyncHandler(getPolizaSeguro));
router.get('/vehiculos/:id/seguros',   asyncHandler(listSegurosVehiculo));
router.post('/vehiculos/:id/seguros',  requireRole('ADMIN'), docMiddleware('poliza'), asyncHandler(createSeguroVehiculo));
router.put('/seguros/:id',             requireRole('ADMIN'), docMiddleware('poliza'), asyncHandler(updateSeguroVehiculo));
router.delete('/seguros/:id',          requireRole('ADMIN'), asyncHandler(deleteSeguroVehiculo));

// ── Patentes ──────────────────────────────────────────────────────────────────
router.get('/patentes',                 asyncHandler(listPatentesEmpresa));
router.get('/vehiculos/:id/patentes',   asyncHandler(listPatentesVehiculo));
router.post('/vehiculos/:id/patentes',  requireRole('ADMIN'), asyncHandler(createPatenteVehiculo));
router.put('/patentes/:id',             requireRole('ADMIN'), docMiddleware('comprobante'), asyncHandler(updatePatenteVehiculo));

// ── Peajes ────────────────────────────────────────────────────────────────────
router.get('/peajes',                  asyncHandler(listPeajes));
router.get('/vehiculos/:id/peajes',    asyncHandler(listPeajesVehiculo));
router.post('/peajes',                 asyncHandler(createPeaje));
router.delete('/peajes/:id',           requireRole('ADMIN'), asyncHandler(deletePeaje));

// ── Taller ────────────────────────────────────────────────────────────────────
router.get('/taller',                  asyncHandler(listTaller));
router.get('/vehiculos/:id/taller',    asyncHandler(listTallerVehiculo));
router.post('/taller',                 asyncHandler(createServicioTaller));
router.put('/taller/:id',              asyncHandler(updateServicioTaller));
router.delete('/taller/:id',           requireRole('ADMIN'), asyncHandler(deleteServicioTaller));

// ── Alertas ───────────────────────────────────────────────────────────────────
router.get('/alertas', asyncHandler(alertasFlota));

export default router;
