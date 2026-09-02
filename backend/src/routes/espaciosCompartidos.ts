import { Router } from 'express';
import { auth } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';
import { requireRole } from '../middleware/requireRole';
import { asyncHandler } from '../lib/asyncHandler';
import {
  uploadComprobante,
  listEspacios, detalleEspacio, createEspacio, updateEspacio, removeEspacio,
  createParte, updateParte, removeParte,
  createGastoTipo, updateGastoTipo, removeGastoTipo,
  listMeses, detalleMes, generarMes, generarMesActual,
  agregarLineaManual, updateLinea, pagarLinea, removeLinea, descargarComprobante,
  cerrarMes,
} from '../controllers/espaciosCompartidos.controller';

// ── Multer wrapper (comprobante de pago) ─────────────────────────────────────

function comprobanteMiddleware(req: any, res: any, next: any) {
  uploadComprobante.single('comprobante')(req, res, (err: any) => {
    if (err) { res.status(400).json({ error: err.message ?? 'Error al subir el comprobante' }); return; }
    next();
  });
}

// ── Router /api/espacios-compartidos ──────────────────────────────────────────
// Módulo financiero sensible (reparto de gastos + movimientos en CCC) —
// exclusivo de ADMIN, mismo criterio que CuentasCorrientes/AFIP/Préstamos.

export const espaciosCompartidosRouter = Router();
espaciosCompartidosRouter.use(auth);
espaciosCompartidosRouter.use(tenantMiddleware);
espaciosCompartidosRouter.use(requireRole('ADMIN'));

espaciosCompartidosRouter.get('/',                                   asyncHandler(listEspacios));
espaciosCompartidosRouter.post('/',                                  asyncHandler(createEspacio));
espaciosCompartidosRouter.post('/generar-mes-actual',                asyncHandler(generarMesActual));
espaciosCompartidosRouter.get('/:id',                                asyncHandler(detalleEspacio));
espaciosCompartidosRouter.put('/:id',                                asyncHandler(updateEspacio));
espaciosCompartidosRouter.delete('/:id',                             asyncHandler(removeEspacio));

espaciosCompartidosRouter.post('/:id/partes',                        asyncHandler(createParte));
espaciosCompartidosRouter.put('/partes/:id',                         asyncHandler(updateParte));
espaciosCompartidosRouter.delete('/partes/:id',                      asyncHandler(removeParte));

espaciosCompartidosRouter.post('/:id/gastos-tipo',                   asyncHandler(createGastoTipo));
espaciosCompartidosRouter.put('/gastos-tipo/:id',                    asyncHandler(updateGastoTipo));
espaciosCompartidosRouter.delete('/gastos-tipo/:id',                 asyncHandler(removeGastoTipo));

espaciosCompartidosRouter.get('/:id/meses',                          asyncHandler(listMeses));
espaciosCompartidosRouter.get('/:id/meses/:mes/:anio',               asyncHandler(detalleMes));
espaciosCompartidosRouter.post('/:id/generar-mes',                   asyncHandler(generarMes));
espaciosCompartidosRouter.post('/:id/meses/:mes/:anio/lineas',       asyncHandler(agregarLineaManual));
espaciosCompartidosRouter.post('/:id/meses/:mes/:anio/cerrar',       asyncHandler(cerrarMes));

espaciosCompartidosRouter.put('/lineas/:id',                         asyncHandler(updateLinea));
espaciosCompartidosRouter.patch('/lineas/:id/pagar',                 comprobanteMiddleware, asyncHandler(pagarLinea));
espaciosCompartidosRouter.delete('/lineas/:id',                      asyncHandler(removeLinea));
espaciosCompartidosRouter.get('/lineas/:id/comprobante',             asyncHandler(descargarComprobante));

export default espaciosCompartidosRouter;
