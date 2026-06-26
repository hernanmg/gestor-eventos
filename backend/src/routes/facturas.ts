import { Router } from 'express';
import { auth } from '../middleware/auth';
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

facturasRouter.get('/alertas',          asyncHandler(alertas));
facturasRouter.get('/',                 asyncHandler(listGlobal));
facturasRouter.get('/:id',              asyncHandler(detail));
facturasRouter.get('/:id/pdf',          asyncHandler(getPDF));
facturasRouter.put('/:id',              requireRole('OPERADOR'), asyncHandler(update));
facturasRouter.put('/:id/pdf',          requireRole('OPERADOR'), pdfMiddleware, asyncHandler(updatePDF));
facturasRouter.delete('/:id',           requireRole('OPERADOR'), asyncHandler(remove));
facturasRouter.patch('/:id/aprobar',    requireRole('OPERADOR'), asyncHandler(aprobar));
facturasRouter.patch('/:id/anular',     requireRole('OPERADOR'), asyncHandler(anular));
facturasRouter.post('/:id/pagos',       requireRole('OPERADOR'), asyncHandler(pagarFactura));

// ── Router /api/pagos ─────────────────────────────────────────────────────────

export const pagosRouter = Router();
pagosRouter.use(auth);
pagosRouter.delete('/:id', requireRole('OPERADOR'), asyncHandler(anularPago));

// ── Router /api/eventos (sub-rutas facturas) ──────────────────────────────────

export const facturasEventoRouter = Router();
facturasEventoRouter.use(auth);
facturasEventoRouter.get('/:id/facturas',  requireEventoAcceso(), asyncHandler(list));
facturasEventoRouter.post('/:id/facturas', requireEventoAcceso(), requireRole('OPERADOR'), pdfMiddleware, asyncHandler(create));
