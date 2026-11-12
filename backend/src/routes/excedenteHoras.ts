import { Router } from 'express';
import { auth } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';
import { requireAnyRole, ROLES } from '../middleware/requireRole';
import { asyncHandler } from '../lib/asyncHandler';
import { listExcedenteHoras, createExcedenteHoras, pagarExcedenteHoras } from '../controllers/excedenteHoras.controller';

// Excedente de horas de Fofi/Nestoras pendiente de pago — DOS57, pantalla de
// Andrea. Lectura: TODOS_MENOS_RESTRINGIDOS. Escritura: ADMIN_OPERADOR.
const router = Router();
router.use(auth);
router.use(tenantMiddleware);

router.get('/',             requireAnyRole(ROLES.TODOS_MENOS_RESTRINGIDOS), asyncHandler(listExcedenteHoras));
router.post('/',            requireAnyRole(ROLES.ADMIN_OPERADOR), asyncHandler(createExcedenteHoras));
router.patch('/:id/pagar',  requireAnyRole(ROLES.ADMIN_OPERADOR), asyncHandler(pagarExcedenteHoras));

export default router;
