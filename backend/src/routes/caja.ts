import { Router } from 'express';
import { auth } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { requireEventoAcceso, requireEventoRole, byCuentaId, byMovCajaId } from '../middleware/requireEventoAcceso';
import { asyncHandler } from '../lib/asyncHandler';
import {
  updateCuenta, deleteCuenta,
  listMovimientosCaja, createMovimientoCaja,
  updateMovimientoCaja, deleteMovimientoCaja,
  conciliar,
} from '../controllers/caja.controller';

export const cuentasRouter = Router();
cuentasRouter.use(auth);
cuentasRouter.put('/:id',              requireEventoAcceso(byCuentaId), requireEventoRole('OPERADOR'), asyncHandler(updateCuenta));
cuentasRouter.delete('/:id',           requireEventoAcceso(byCuentaId), requireEventoRole('OPERADOR'), asyncHandler(deleteCuenta));
cuentasRouter.get('/:id/movimientos',  requireEventoAcceso(byCuentaId), asyncHandler(listMovimientosCaja));
cuentasRouter.post('/:id/movimientos', requireEventoAcceso(byCuentaId), requireEventoRole('OPERADOR'), asyncHandler(createMovimientoCaja));

export const movCajaRouter = Router();
movCajaRouter.use(auth);
movCajaRouter.put('/:id',           requireEventoAcceso(byMovCajaId), requireEventoRole('OPERADOR'), asyncHandler(updateMovimientoCaja));
movCajaRouter.delete('/:id',        requireEventoAcceso(byMovCajaId), requireEventoRole('OPERADOR'), asyncHandler(deleteMovimientoCaja));
movCajaRouter.post('/:id/conciliar', requireEventoAcceso(byMovCajaId), requireEventoRole('OPERADOR'), asyncHandler(conciliar));
