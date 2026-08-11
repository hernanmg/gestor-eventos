import { Router } from 'express';
import { auth } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';
import { requireRole } from '../middleware/requireRole';
import { requireEventoAcceso } from '../middleware/requireEventoAcceso';
import { asyncHandler } from '../lib/asyncHandler';
import {
  uploadPDF,
  list,
  listGlobal,
  alertas,
  detail,
  getPDF,
  create,
  update,
  updatePDF,
  remove,
  aprobar,
  anular,
  pagarFactura,
  anularPago,
} from '../controllers/facturas.controller';

// ── Multer wrapper ────────────────────────────────────────────────────────────

function pdfMiddleware(req: any, res: any, next: any) {
  uploadPDF.single('pdf')(req, res, (err: any) => {
    if (err) { res.status(400).json({ error: err.message ?? 'Error al subir el PDF' }); return; }
    next();
  });
}

// ── Router /api/facturas ──────────────────────────────────────────────────────

export const facturasRouter = Router();
facturasRouter.use(auth);
facturasRouter.use(tenantMiddleware);
facturasRouter.use(requireRole('ADMIN')); // Facturas es exclusivo de ADMIN (matriz de permisos)

facturasRouter.get('/alertas',          asyncHandler(alertas));
facturasRouter.get('/',                 asyncHandler(listGlobal));
facturasRouter.get('/:id',              asyncHandler(detail));
facturasRouter.get('/:id/pdf',          asyncHandler(getPDF));
facturasRouter.put('/:id',              asyncHandler(update));
facturasRouter.put('/:id/pdf',          pdfMiddleware, asyncHandler(updatePDF));
facturasRouter.delete('/:id',           asyncHandler(remove));
facturasRouter.patch('/:id/aprobar',    asyncHandler(aprobar));
facturasRouter.patch('/:id/anular',     asyncHandler(anular));
facturasRouter.post('/:id/pagos',       asyncHandler(pagarFactura));

// ── Router /api/pagos ─────────────────────────────────────────────────────────

export const pagosRouter = Router();
pagosRouter.use(auth);
pagosRouter.use(tenantMiddleware);
pagosRouter.delete('/:id', requireRole('ADMIN'), asyncHandler(anularPago));

// ── Router /api/eventos (sub-rutas facturas) ──────────────────────────────────

export const facturasEventoRouter = Router();
facturasEventoRouter.use(auth);
facturasEventoRouter.use(tenantMiddleware);
facturasEventoRouter.get('/:id/facturas',  requireEventoAcceso(), requireRole('ADMIN'), asyncHandler(list));
facturasEventoRouter.post('/:id/facturas', requireEventoAcceso(), requireRole('ADMIN'), pdfMiddleware, asyncHandler(create));
