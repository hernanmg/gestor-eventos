import { Router } from 'express';
import { auth } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';
import { requireRole } from '../middleware/requireRole';
import { asyncHandler } from '../lib/asyncHandler';
import { uploadPlanillaCheques } from '../controllers/cheques.controller';
import {
  listChequesRecibidos, createChequeRecibido, updateChequeRecibido, deleteChequeRecibido, postEstadoCheque, importarChequesRecibidos,
} from '../controllers/chequesRecibidos.controller';

function excelMiddleware(req: any, res: any, next: any) {
  uploadPlanillaCheques.single('archivo')(req, res, (err: any) => {
    if (err) { res.status(400).json({ error: err.message ?? 'Error al subir el archivo' }); return; }
    next();
  });
}

// ── Router /api/cheques-recibidos — cartera de cheques de clientes ───────────
// Exclusivo de ADMIN, igual que los cheques emitidos y Facturas a Cobrar.
const router = Router();
router.use(auth);
router.use(tenantMiddleware);
router.use(requireRole('ADMIN'));

router.get('/',             asyncHandler(listChequesRecibidos));
router.post('/',            asyncHandler(createChequeRecibido));
router.post('/importar',    excelMiddleware, asyncHandler(importarChequesRecibidos));
router.put('/:id',          asyncHandler(updateChequeRecibido));
router.delete('/:id',       asyncHandler(deleteChequeRecibido));
router.post('/:id/estado',  asyncHandler(postEstadoCheque));

export default router;
