import { Router } from 'express';
import { auth } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';
import { requireAnyRole, ROLES } from '../middleware/requireRole';
import { asyncHandler } from '../lib/asyncHandler';
import {
  listCuentasEmpresa, getCuenta, createCuentaEmpresa,
  updateCuenta, deleteCuenta, updateEstadoCuenta,
  listMovimientosCaja, createMovimientoCaja,
  updateMovimientoCaja, deleteMovimientoCaja,
  conciliar,
} from '../controllers/caja.controller';

export const cuentasRouter = Router();
cuentasRouter.use(auth);
cuentasRouter.use(tenantMiddleware);
// ── Cuentas de empresa (sin evento) ───────────────────────────────────────────
// Lectura: TODOS_MENOS_RESTRINGIDOS. Escritura: ADMIN_OPERADOR, por rol global
// (sin el ACL puntual de EventoAcceso — ver eventos.ts).
cuentasRouter.get('/',                 requireAnyRole(ROLES.TODOS_MENOS_RESTRINGIDOS), asyncHandler(listCuentasEmpresa));
cuentasRouter.get('/:id',              requireAnyRole(ROLES.TODOS_MENOS_RESTRINGIDOS), asyncHandler(getCuenta));
cuentasRouter.post('/',                requireAnyRole(ROLES.ADMIN_OPERADOR), asyncHandler(createCuentaEmpresa));
cuentasRouter.put('/:id',              requireAnyRole(ROLES.ADMIN_OPERADOR), asyncHandler(updateCuenta));
cuentasRouter.delete('/:id',           requireAnyRole(ROLES.ADMIN_OPERADOR), asyncHandler(deleteCuenta));
// ABIERTA→PENDIENTE_RENDICION: cualquier usuario con acceso. PENDIENTE_RENDICION→CERRADA:
// sólo ADMIN — validado dentro del controller (una sola ruta, dos niveles de permiso).
cuentasRouter.patch('/:id/estado',     requireAnyRole(ROLES.TODOS_MENOS_RESTRINGIDOS), asyncHandler(updateEstadoCuenta));
cuentasRouter.get('/:id/movimientos',  requireAnyRole(ROLES.TODOS_MENOS_RESTRINGIDOS), asyncHandler(listMovimientosCaja));
cuentasRouter.post('/:id/movimientos', requireAnyRole(ROLES.ADMIN_OPERADOR), asyncHandler(createMovimientoCaja));

export const movCajaRouter = Router();
movCajaRouter.use(auth);
movCajaRouter.use(tenantMiddleware);
movCajaRouter.put('/:id',            requireAnyRole(ROLES.ADMIN_OPERADOR), asyncHandler(updateMovimientoCaja));
movCajaRouter.delete('/:id',         requireAnyRole(ROLES.ADMIN_OPERADOR), asyncHandler(deleteMovimientoCaja));
movCajaRouter.post('/:id/conciliar', requireAnyRole(ROLES.ADMIN_OPERADOR), asyncHandler(conciliar));
