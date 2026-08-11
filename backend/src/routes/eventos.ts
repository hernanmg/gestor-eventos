import { Router } from 'express';
import { auth } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';
import { requireRole } from '../middleware/requireRole';
import { requireEventoAcceso, requireEventoRole } from '../middleware/requireEventoAcceso';
import { asyncHandler } from '../lib/asyncHandler';
import { list, detail, create, update, remove, conciliatoria } from '../controllers/eventos.controller';
import {
  list as listMovimientos,
  listSinConciliar,
  create as createMovimiento,
  movimientosSinProveedor,
  resumen as resumenMovimientos,
} from '../controllers/movimientos.controller';
import { listCuentas, createCuenta, transferencia, posicionConsolidada } from '../controllers/caja.controller';
import { listEcheqs, createEcheq, alertasEcheqs } from '../controllers/echeqs.controller';

const router = Router();

router.use(auth);
router.use(tenantMiddleware);

router.get('/',       asyncHandler(list));
router.get('/:id',    requireEventoAcceso(), asyncHandler(detail));
// Crear/editar/eliminar eventos es exclusivo de ADMIN — ya no alcanza con
// tener EventoAcceso OPERADOR en ese evento puntual (matriz de permisos).
router.post('/',      requireRole('ADMIN'), asyncHandler(create));
router.put('/:id',    requireEventoAcceso(), requireRole('ADMIN'), asyncHandler(update));
router.delete('/:id', requireEventoAcceso(), requireRole('ADMIN'), asyncHandler(remove));

// Movimientos anidados bajo un evento
router.get('/:id/movimientos',  requireEventoAcceso(), asyncHandler(listMovimientos));
router.post('/:id/movimientos', requireEventoAcceso(), requireEventoRole('OPERADOR'), asyncHandler(createMovimiento));

// Cuentas bancarias del evento
router.get('/:id/cuentas',  requireEventoAcceso(), asyncHandler(listCuentas));
router.post('/:id/cuentas', requireEventoAcceso(), requireEventoRole('OPERADOR'), asyncHandler(createCuenta));

// Echeqs del evento
router.get('/:id/echeqs/alertas', requireEventoAcceso(), asyncHandler(alertasEcheqs));
router.get('/:id/echeqs',         requireEventoAcceso(), asyncHandler(listEcheqs));
router.post('/:id/echeqs',        requireEventoAcceso(), requireEventoRole('OPERADOR'), asyncHandler(createEcheq));

// Conciliatoria — calculada al momento
router.get('/:id/conciliatoria', requireEventoAcceso(), asyncHandler(conciliatoria));

// Caja — transferencia y posición consolidada
router.post('/:id/cuentas/transferencia', requireEventoAcceso(), requireEventoRole('OPERADOR'), asyncHandler(transferencia));
router.get('/:id/posicion-consolidada',   requireEventoAcceso(), asyncHandler(posicionConsolidada));

// Movimientos sin conciliar (para dialog de conciliación retroactiva)
router.get('/:id/movimientos-sin-conciliar', requireEventoAcceso(), asyncHandler(listSinConciliar));

// Movimientos sin proveedor vinculado (agrupados por concepto)
router.get('/:id/movimientos/sin-proveedor', requireEventoAcceso(), asyncHandler(movimientosSinProveedor));

// Resumen presupuesto vs real por rubro
router.get('/:id/movimientos/resumen', requireEventoAcceso(), asyncHandler(resumenMovimientos));

export default router;
