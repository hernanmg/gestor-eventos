import { Router } from 'express';
import { auth } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';
import { requireAnyRole, ROLES } from '../middleware/requireRole';
import { asyncHandler } from '../lib/asyncHandler';
import {
  catalogoRemitos, sugerenciasRemito, listRemitos, getRemito, createRemito, updateRemito,
  emitirRemito, clonarRemito, deleteRemito, pdfRemito,
} from '../controllers/remitos.controller';

// Remitos digitales (DOS57) — mismo alcance que el tab Logística del evento
// (ADMIN y OPERADOR: Flor/Santi arman los remitos de cada viaje).
const router = Router();
router.use(auth);
router.use(tenantMiddleware);
router.use(requireAnyRole(ROLES.ADMIN_OPERADOR));

router.get('/catalogo',     asyncHandler(catalogoRemitos));
router.get('/sugerencias',  asyncHandler(sugerenciasRemito));
router.get('/',             asyncHandler(listRemitos));
router.post('/',            asyncHandler(createRemito));
router.get('/:id',          asyncHandler(getRemito));
router.put('/:id',          asyncHandler(updateRemito));
router.delete('/:id',       asyncHandler(deleteRemito));
router.patch('/:id/emitir', asyncHandler(emitirRemito));
router.post('/:id/clonar',  asyncHandler(clonarRemito));
router.get('/:id/pdf',      asyncHandler(pdfRemito));

export default router;
