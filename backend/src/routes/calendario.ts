import { Router } from 'express';
import { auth } from '../middleware/auth';
import { asyncHandler } from '../lib/asyncHandler';
import { getCalendario } from '../controllers/calendario.controller';

const router = Router();
router.use(auth);

// Sin tenantMiddleware — igual que /api/movimientos (vista Macro): el admin
// global puede no tener empresa activa de sesión y aun así necesita ver
// "todas las empresas". resolveEmpresaFiltro() en el controller resuelve el
// alcance por su cuenta.
router.get('/', asyncHandler(getCalendario));

export default router;
