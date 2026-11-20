import { Router } from 'express';
import { auth } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';
import { requireRole } from '../middleware/requireRole';
import { asyncHandler } from '../lib/asyncHandler';
import { listCheques, resumenCheques, createCheque, updateCheque, debitarCheque, reabrirCheque, importarCheques, uploadPlanillaCheques } from '../controllers/cheques.controller';

function excelMiddleware(req: any, res: any, next: any) {
  uploadPlanillaCheques.single('archivo')(req, res, (err: any) => {
    if (err) { res.status(400).json({ error: err.message ?? 'Error al subir el archivo' }); return; }
    next();
  });
}

// ── Router /api/cheques — cheques emitidos de la empresa, por banco ──────────
// Exclusivo de ADMIN, mismo criterio que AFIP/Créditos/SGR. Borrar y rechazar
// usan /api/echeqs/:id (mismo modelo).

export const chequesRouter = Router();
chequesRouter.use(auth);
chequesRouter.use(tenantMiddleware);
chequesRouter.use(requireRole('ADMIN'));

chequesRouter.get('/',              asyncHandler(listCheques));
chequesRouter.get('/resumen',       asyncHandler(resumenCheques));
chequesRouter.post('/',             asyncHandler(createCheque));
chequesRouter.post('/importar',     excelMiddleware, asyncHandler(importarCheques));
chequesRouter.put('/:id',           asyncHandler(updateCheque));
chequesRouter.patch('/:id/debitar', asyncHandler(debitarCheque));
chequesRouter.patch('/:id/reabrir', asyncHandler(reabrirCheque));

export default chequesRouter;
