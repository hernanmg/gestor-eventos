import { Router } from 'express';
import { auth } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { asyncHandler } from '../lib/asyncHandler';
import {
  updateCuenta, deleteCuenta,
  listMovimientosCaja, createMovimientoCaja,
  updateMovimientoCaja, deleteMovimientoCaja,
  conciliar,
} from '../controllers/caja.controller';

export const cuentasRouter = Router();
cuentasRouter.use(auth);
cuentasRouter.put('/:id',              requireRole('OPERADOR'), asyncHandler(updateCuenta));
cuentasRouter.delete('/:id',           requireRole('OPERADOR'), asyncHandler(deleteCuenta));
cuentasRouter.get('/:id/movimientos',  asyncHandler(listMovimientosCaja));
cuentasRouter.post('/:id/movimientos', requireRole('OPERADOR'), asyncHandler(createMovimientoCaja));

export const movCajaRouter = Router();
movCajaRouter.use(auth);
movCajaRouter.put('/:id',      requireRole('OPERADOR'), asyncHandler(updateMovimientoCaja));
movCajaRouter.delete('/:id',   requireRole('OPERADOR'), asyncHandler(deleteMovimientoCaja));
movCajaRouter.post('/:id/conciliar', requireRole('OPERADOR'), asyncHandler(conciliar));
