import { Router } from 'express';
import { auth } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { requireEventoAcceso, requireEventoRole } from '../middleware/requireEventoAcceso';
import { asyncHandler } from '../lib/asyncHandler';
import { list, detail, create, update, remove, conciliatoria } from '../controllers/eventos.controller';
import {
  list as listMovimientos,
  listSinConciliar,
  create as createMovimiento,
} from '../controllers/movimientos.controller';
import { listCuentas, createCuenta, transferencia, posicionConsolidada } from '../controllers/caja.controller';
import { listEcheqs, createEcheq, alertasEcheqs } from '../controllers/echeqs.controller';

const router = Router();

router.use(auth);

router.get('/',       asyncHandler(list));
router.get('/:id',    requireEventoAcceso(), asyncHandler(detail));
router.post('/',      requireRole('OPERADOR'), asyncHandler(create));
router.put('/:id',    requireEventoAcceso(), requireEventoRole('OPERADOR'), asyncHandler(update));
router.delete('/:id', requireEventoAcceso(), requireEventoRole('OPERADOR'), asyncHandler(remove));

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

export default router;
