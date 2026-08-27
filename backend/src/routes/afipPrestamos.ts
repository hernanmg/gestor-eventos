import { Router } from 'express';
import { auth } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';
import { requireRole } from '../middleware/requireRole';
import { asyncHandler } from '../lib/asyncHandler';
import {
  uploadDocumento,
  listPlanesAFIP, detallePlanAFIP, createPlanAFIP, updatePlanAFIP, pagarCuotaAFIP,
  subirDocumentoPlanAFIP, descargarDocumentoPlanAFIP, eliminarDocumentoPlanAFIP,
  listPrestamos, detallePrestamo, createPrestamo, updatePrestamo, pagarCuotaPrestamo, updateCuotaPrestamo,
  subirDocumentoPrestamo, descargarDocumentoPrestamo, eliminarDocumentoPrestamo,
} from '../controllers/afipPrestamos.controller';

function docMiddleware(req: any, res: any, next: any) {
  uploadDocumento.single('archivo')(req, res, (err: any) => {
    if (err) { res.status(400).json({ error: err.message ?? 'Error al subir el archivo' }); return; }
    next();
  });
}

// ── Router /api/afip ──────────────────────────────────────────────────────────
// Exclusivo de ADMIN (matriz de permisos) — mismo criterio que Facturas.

export const afipRouter = Router();
afipRouter.use(auth);
afipRouter.use(tenantMiddleware);
afipRouter.use(requireRole('ADMIN'));

afipRouter.get('/planes',                          asyncHandler(listPlanesAFIP));
afipRouter.get('/planes/:id',                      asyncHandler(detallePlanAFIP));
afipRouter.post('/planes',                         asyncHandler(createPlanAFIP));
afipRouter.put('/planes/:id',                      asyncHandler(updatePlanAFIP));
afipRouter.post('/planes/:id/documentos',          docMiddleware, asyncHandler(subirDocumentoPlanAFIP));
afipRouter.get('/planes/:id/documentos/:docId',    asyncHandler(descargarDocumentoPlanAFIP));
afipRouter.delete('/planes/:id/documentos/:docId', asyncHandler(eliminarDocumentoPlanAFIP));
afipRouter.patch('/cuotas/:id/pagar',              asyncHandler(pagarCuotaAFIP));

// ── Router /api/prestamos ─────────────────────────────────────────────────────

export const prestamosRouter = Router();
prestamosRouter.use(auth);
prestamosRouter.use(tenantMiddleware);
prestamosRouter.use(requireRole('ADMIN'));

prestamosRouter.get('/',                              asyncHandler(listPrestamos));
prestamosRouter.get('/:id',                           asyncHandler(detallePrestamo));
prestamosRouter.post('/',                             asyncHandler(createPrestamo));
prestamosRouter.put('/:id',                           asyncHandler(updatePrestamo));
prestamosRouter.patch('/cuotas/:id/pagar',            asyncHandler(pagarCuotaPrestamo));
prestamosRouter.put('/cuotas/:id',                    asyncHandler(updateCuotaPrestamo));
prestamosRouter.post('/:id/documentos',               docMiddleware, asyncHandler(subirDocumentoPrestamo));
prestamosRouter.get('/:id/documentos/:docId',         asyncHandler(descargarDocumentoPrestamo));
prestamosRouter.delete('/:id/documentos/:docId',      asyncHandler(eliminarDocumentoPrestamo));
