import { Router } from 'express';
import { auth } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';
import { requireAnyRole, ROLES } from '../middleware/requireRole';
import { asyncHandler } from '../lib/asyncHandler';
import { uploadExcelAndrea, resumenAndrea, importarAndrea } from '../controllers/cajaAndrea.controller';

function importMiddleware(req: any, res: any, next: any) {
  uploadExcelAndrea.single('archivo')(req, res, (err: any) => {
    if (err) { res.status(400).json({ error: err.message ?? 'Error al subir el archivo' }); return; }
    next();
  });
}

// ── Router /api/caja — pantalla "Caja del mes" de Andrea ──────────────────────
// Distinto de /api/cuentas (Caja Global genérica) — expone la vista Excel
// (resumen-andrea) y el importador del libro histórico sobre las mismas
// CuentaBancaria/MovimientoCaja.
export const cajaAndreaRouter = Router();
cajaAndreaRouter.use(auth);
cajaAndreaRouter.use(tenantMiddleware);

cajaAndreaRouter.get('/resumen-andrea',   requireAnyRole(ROLES.TODOS_MENOS_RESTRINGIDOS), asyncHandler(resumenAndrea));
cajaAndreaRouter.post('/importar-andrea', requireAnyRole(ROLES.ADMIN_OPERADOR), importMiddleware, asyncHandler(importarAndrea));
