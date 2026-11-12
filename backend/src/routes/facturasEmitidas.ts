import { Router } from 'express';
import { auth } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';
import { requireRole } from '../middleware/requireRole';
import { asyncHandler } from '../lib/asyncHandler';
import {
  uploadPDF,
  list,
  buscarClientes,
  resumen,
  detail,
  getPDF,
  create,
  update,
  remove,
  anular,
  marcarIncobrable,
  registrarCobro,
  eliminarCobro,
  uploadPdfFactura,
} from '../controllers/facturasEmitidas.controller';

function pdfMiddleware(req: any, res: any, next: any) {
  uploadPDF.single('pdf')(req, res, (err: any) => {
    if (err) { res.status(400).json({ error: err.message ?? 'Error al subir el PDF' }); return; }
    next();
  });
}

// ── Router /api/facturas-emitidas ─────────────────────────────────────────────
// Exclusivo de ADMIN (matriz de permisos) — mismo criterio que Facturas/AFIP.

export const facturasEmitidasRouter = Router();
facturasEmitidasRouter.use(auth);
facturasEmitidasRouter.use(tenantMiddleware);
facturasEmitidasRouter.use(requireRole('ADMIN'));

// Rutas literales antes de "/:id" para que Express no las confunda con el id.
facturasEmitidasRouter.get('/clientes',           asyncHandler(buscarClientes));
facturasEmitidasRouter.get('/resumen',            asyncHandler(resumen));
facturasEmitidasRouter.delete('/cobros/:id',      asyncHandler(eliminarCobro));

facturasEmitidasRouter.get('/',                   asyncHandler(list));
facturasEmitidasRouter.post('/',                  asyncHandler(create));
facturasEmitidasRouter.get('/:id',                asyncHandler(detail));
facturasEmitidasRouter.put('/:id',                asyncHandler(update));
facturasEmitidasRouter.delete('/:id',             asyncHandler(remove));
facturasEmitidasRouter.patch('/:id/anular',       asyncHandler(anular));
facturasEmitidasRouter.patch('/:id/incobrable',   asyncHandler(marcarIncobrable));
facturasEmitidasRouter.post('/:id/cobros',        asyncHandler(registrarCobro));
facturasEmitidasRouter.post('/:id/pdf',           pdfMiddleware, asyncHandler(uploadPdfFactura));
facturasEmitidasRouter.get('/:id/pdf',            asyncHandler(getPDF));
