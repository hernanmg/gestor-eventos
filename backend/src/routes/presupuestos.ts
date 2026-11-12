import { Router } from 'express';
import { auth } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';
import { requireRole } from '../middleware/requireRole';
import { asyncHandler } from '../lib/asyncHandler';
import { upload as uploadXlsx } from '../controllers/importer.controller';
import {
  importarMaterialesRental, listMaterialesRental, updateMaterialRental,
  listPresupuestos, getPresupuesto, createPresupuesto, updatePresupuesto,
  cambiarEstadoPresupuesto, cambiarTipoCambioPresupuesto, nuevaVersionPresupuesto,
} from '../controllers/presupuestos.controller';

// Costo Real / Presupuestador (DOS57) — Nivel 1: sólo ADMIN

const fileMiddleware = (req: any, res: any, next: any) => {
  uploadXlsx.single('file')(req, res, (err: any) => {
    if (err) { res.status(400).json({ error: err.message ?? 'Error al subir el archivo' }); return; }
    next();
  });
};

export const materialesRentalRouter = Router();
materialesRentalRouter.use(auth, tenantMiddleware, requireRole('ADMIN'));
materialesRentalRouter.post('/importar', fileMiddleware, asyncHandler(importarMaterialesRental));
materialesRentalRouter.get('/',          asyncHandler(listMaterialesRental));
materialesRentalRouter.patch('/:id',     asyncHandler(updateMaterialRental));

export const presupuestosRouter = Router();
presupuestosRouter.use(auth, tenantMiddleware, requireRole('ADMIN'));
presupuestosRouter.get('/',                    asyncHandler(listPresupuestos));
presupuestosRouter.post('/',                   asyncHandler(createPresupuesto));
presupuestosRouter.get('/:id',                 asyncHandler(getPresupuesto));
presupuestosRouter.put('/:id',                 asyncHandler(updatePresupuesto));
presupuestosRouter.patch('/:id/estado',        asyncHandler(cambiarEstadoPresupuesto));
presupuestosRouter.patch('/:id/tipo-cambio',   asyncHandler(cambiarTipoCambioPresupuesto));
presupuestosRouter.post('/:id/nueva-version',  asyncHandler(nuevaVersionPresupuesto));
