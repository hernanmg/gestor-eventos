import { Router } from 'express';
import { auth } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';
import { requireRole } from '../middleware/requireRole';
import { asyncHandler } from '../lib/asyncHandler';
import {
  listMultas, resumenMultas, opcionesMultas, createMulta, updateMulta, deleteMulta,
} from '../controllers/multas.controller';

const router = Router();
router.use(auth);
router.use(tenantMiddleware);
router.use(requireRole('OPERADOR')); // Lorena (OPERADOR) carga las multas — mismo alcance que Flota

router.get('/resumen',  asyncHandler(resumenMultas));
router.get('/opciones', asyncHandler(opcionesMultas));
router.get('/',         asyncHandler(listMultas));
router.post('/',        asyncHandler(createMulta));
router.put('/:id',      asyncHandler(updateMulta));
router.delete('/:id',   asyncHandler(deleteMulta));

export default router;
