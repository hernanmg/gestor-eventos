import { Router } from 'express';
import { auth } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
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
router.get('/:id',    asyncHandler(detail));
router.post('/',      requireRole('OPERADOR'), asyncHandler(create));
router.put('/:id',    requireRole('OPERADOR'), asyncHandler(update));
router.delete('/:id', requireRole('OPERADOR'), asyncHandler(remove));

// Movimientos anidados bajo un evento
router.get('/:id/movimientos',  asyncHandler(listMovimientos));
router.post('/:id/movimientos', requireRole('OPERADOR'), asyncHandler(createMovimiento));

// Cuentas bancarias del evento
router.get('/:id/cuentas',  asyncHandler(listCuentas));
router.post('/:id/cuentas', requireRole('OPERADOR'), asyncHandler(createCuenta));

// Echeqs del evento
router.get('/:id/echeqs/alertas', asyncHandler(alertasEcheqs));
router.get('/:id/echeqs',         asyncHandler(listEcheqs));
router.post('/:id/echeqs',        requireRole('OPERADOR'), asyncHandler(createEcheq));

// Conciliatoria — calculada al momento
router.get('/:id/conciliatoria', asyncHandler(conciliatoria));

// Caja — transferencia y posición consolidada
router.post('/:id/cuentas/transferencia', requireRole('OPERADOR'), asyncHandler(transferencia));
router.get('/:id/posicion-consolidada',   asyncHandler(posicionConsolidada));

// Movimientos sin conciliar (para dialog de conciliación retroactiva)
router.get('/:id/movimientos-sin-conciliar', asyncHandler(listSinConciliar));

export default router;
