import { Router } from 'express';
import { auth } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';
import { requireRole } from '../middleware/requireRole';
import { requireEventoAcceso, requireEventoRole, byCuentaId, byMovCajaId } from '../middleware/requireEventoAcceso';
import { asyncHandler } from '../lib/asyncHandler';
import {
  listCuentasEmpresa, createCuentaEmpresa,
  updateCuenta, deleteCuenta,
  listMovimientosCaja, createMovimientoCaja,
  updateMovimientoCaja, deleteMovimientoCaja,
  conciliar,
} from '../controllers/caja.controller';

export const cuentasRouter = Router();
cuentasRouter.use(auth);
cuentasRouter.use(tenantMiddleware);
// ── Cuentas de empresa (sin evento) ───────────────────────────────────────────
cuentasRouter.get('/',                 asyncHandler(listCuentasEmpresa));
cuentasRouter.post('/',                requireRole('OPERADOR'), asyncHandler(createCuentaEmpresa));
cuentasRouter.put('/:id',              requireEventoAcceso(byCuentaId), requireEventoRole('OPERADOR'), asyncHandler(updateCuenta));
cuentasRouter.delete('/:id',           requireEventoAcceso(byCuentaId), requireEventoRole('OPERADOR'), asyncHandler(deleteCuenta));
cuentasRouter.get('/:id/movimientos',  requireEventoAcceso(byCuentaId), asyncHandler(listMovimientosCaja));
cuentasRouter.post('/:id/movimientos', requireEventoAcceso(byCuentaId), requireEventoRole('OPERADOR'), asyncHandler(createMovimientoCaja));

export const movCajaRouter = Router();
movCajaRouter.use(auth);
movCajaRouter.use(tenantMiddleware);
movCajaRouter.put('/:id',           requireEventoAcceso(byMovCajaId), requireEventoRole('OPERADOR'), asyncHandler(updateMovimientoCaja));
movCajaRouter.delete('/:id',        requireEventoAcceso(byMovCajaId), requireEventoRole('OPERADOR'), asyncHandler(deleteMovimientoCaja));
movCajaRouter.post('/:id/conciliar', requireEventoAcceso(byMovCajaId), requireEventoRole('OPERADOR'), asyncHandler(conciliar));
