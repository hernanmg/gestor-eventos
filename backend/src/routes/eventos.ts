import { Router } from 'express';
import { auth } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { asyncHandler } from '../lib/asyncHandler';
import { list, detail, create, update, remove, conciliatoria } from '../controllers/eventos.controller';
import {
  list as listMovimientos,
  create as createMovimiento,
} from '../controllers/movimientos.controller';
import { listCuentas, createCuenta } from '../controllers/caja.controller';
import { listEcheqs, createEcheq } from '../controllers/echeqs.controller';

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
router.get('/:id/echeqs',  asyncHandler(listEcheqs));
router.post('/:id/echeqs', requireRole('OPERADOR'), asyncHandler(createEcheq));

// Conciliatoria — calculada al momento
router.get('/:id/conciliatoria', asyncHandler(conciliatoria));

export default router;
