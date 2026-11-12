import { Router } from 'express';
import { auth } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';
import { requireRole } from '../middleware/requireRole';
import { asyncHandler } from '../lib/asyncHandler';
import { create, borrador, getOne, update, updateRubros, confirmar, discard } from '../controllers/preMacro.controller';

const router = Router();
router.use(auth);
router.use(tenantMiddleware);

// Antes de '/:id' — si no, Express intenta resolver "borrador" como :id
// Crear eventos es exclusivo de ADMIN — pre-macro es el wizard que termina
// creando el Evento, así que sólo ADMIN puede iniciarlo/editarlo/confirmarlo.
// GET es la única excepción a ADMIN_OPERADOR (matriz de permisos).
router.get('/borrador', requireRole('OPERADOR'), asyncHandler(borrador));

router.post('/',              requireRole('ADMIN'), asyncHandler(create));
router.get('/:id',            requireRole('OPERADOR'), asyncHandler(getOne));
router.put('/:id',            requireRole('ADMIN'), asyncHandler(update));
router.put('/:id/rubros',     requireRole('ADMIN'), asyncHandler(updateRubros));
router.post('/:id/confirmar', requireRole('ADMIN'), asyncHandler(confirmar));
router.delete('/:id',         requireRole('ADMIN'), asyncHandler(discard));

export default router;
