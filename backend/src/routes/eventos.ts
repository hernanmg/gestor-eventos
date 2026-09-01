import { Router } from 'express';
import { auth } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';
import { requireRole, requireAnyRole, ROLES } from '../middleware/requireRole';
import { asyncHandler } from '../lib/asyncHandler';
import { list, detail, create, update, remove, conciliatoria, marcarFacturar } from '../controllers/eventos.controller';
import {
  list as listMovimientos,
  listSinConciliar,
  create as createMovimiento,
  movimientosSinProveedor,
  resumen as resumenMovimientos,
} from '../controllers/movimientos.controller';
import {
  listCuentas, createCuenta, transferencia, posicionConsolidada, vincularCuenta, desvincularCuenta,
  listMovimientosCajaEvento, createMovimientoCajaEvento,
} from '../controllers/caja.controller';
import { listEcheqs, createEcheq, alertasEcheqs } from '../controllers/echeqs.controller';

const router = Router();

router.use(auth);
router.use(tenantMiddleware);

// El control granular vive en botones/acciones, no en el acceso a la página:
// GET siempre es TODOS_MENOS_RESTRINGIDOS (ADMIN/OPERADOR/VIEWER pueden ver
// cualquier evento de su empresa), y la escritura se gatea por rol global —
// ya no por el ACL puntual de EventoAcceso (cada controller sigue haciendo su
// propio chequeo de tenant/existencia con withTenant(), así que sacar
// requireEventoAcceso() no abre nada entre empresas).
router.get('/',       requireAnyRole(ROLES.TODOS_MENOS_RESTRINGIDOS), asyncHandler(list));
router.get('/:id',    requireAnyRole(ROLES.TODOS_MENOS_RESTRINGIDOS), asyncHandler(detail));
router.post('/',      requireRole('ADMIN'), asyncHandler(create));
router.put('/:id',    requireRole('ADMIN'), asyncHandler(update));
router.delete('/:id', requireRole('ADMIN'), asyncHandler(remove));
router.patch('/:id/marcar-facturar', requireAnyRole(ROLES.ADMIN_OPERADOR), asyncHandler(marcarFacturar));

// Movimientos anidados bajo un evento
router.get('/:id/movimientos',  requireAnyRole(ROLES.TODOS_MENOS_RESTRINGIDOS), asyncHandler(listMovimientos));
router.post('/:id/movimientos', requireAnyRole(ROLES.ADMIN_OPERADOR), asyncHandler(createMovimiento));

// Cuentas bancarias del evento
router.get('/:id/cuentas',  requireAnyRole(ROLES.TODOS_MENOS_RESTRINGIDOS), asyncHandler(listCuentas));
router.post('/:id/cuentas', requireAnyRole(ROLES.ADMIN_OPERADOR), asyncHandler(createCuenta));
// Vincular/desvincular una cuenta de empresa ya existente (no crea/borra la cuenta)
router.post('/:id/cuentas/vincular',                 requireAnyRole(ROLES.ADMIN_OPERADOR), asyncHandler(vincularCuenta));
router.delete('/:id/cuentas/:cuentaId/desvincular',  requireAnyRole(ROLES.ADMIN_OPERADOR), asyncHandler(desvincularCuenta));

// Movimientos de una cuenta, en contexto de este evento — filtra/etiqueta por
// evento_id (una cuenta puede estar vinculada a más de un evento).
router.get('/:id/cuentas/:cuentaId/movimientos',  requireAnyRole(ROLES.TODOS_MENOS_RESTRINGIDOS), asyncHandler(listMovimientosCajaEvento));
router.post('/:id/cuentas/:cuentaId/movimientos', requireAnyRole(ROLES.ADMIN_OPERADOR), asyncHandler(createMovimientoCajaEvento));

// Echeqs del evento
router.get('/:id/echeqs/alertas', requireAnyRole(ROLES.TODOS_MENOS_RESTRINGIDOS), asyncHandler(alertasEcheqs));
router.get('/:id/echeqs',         requireAnyRole(ROLES.TODOS_MENOS_RESTRINGIDOS), asyncHandler(listEcheqs));
router.post('/:id/echeqs',        requireAnyRole(ROLES.ADMIN_OPERADOR), asyncHandler(createEcheq));

// Conciliatoria — calculada al momento
router.get('/:id/conciliatoria', requireAnyRole(ROLES.TODOS_MENOS_RESTRINGIDOS), asyncHandler(conciliatoria));

// Caja — transferencia y posición consolidada
router.post('/:id/cuentas/transferencia', requireAnyRole(ROLES.ADMIN_OPERADOR), asyncHandler(transferencia));
router.get('/:id/posicion-consolidada',   requireAnyRole(ROLES.TODOS_MENOS_RESTRINGIDOS), asyncHandler(posicionConsolidada));

// Movimientos sin conciliar (para dialog de conciliación retroactiva)
router.get('/:id/movimientos-sin-conciliar', requireAnyRole(ROLES.TODOS_MENOS_RESTRINGIDOS), asyncHandler(listSinConciliar));

// Movimientos sin proveedor vinculado (agrupados por concepto)
router.get('/:id/movimientos/sin-proveedor', requireAnyRole(ROLES.TODOS_MENOS_RESTRINGIDOS), asyncHandler(movimientosSinProveedor));

// Resumen presupuesto vs real por rubro
router.get('/:id/movimientos/resumen', requireAnyRole(ROLES.TODOS_MENOS_RESTRINGIDOS), asyncHandler(resumenMovimientos));

export default router;
