import { Router } from 'express';
import { auth } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { asyncHandler } from '../lib/asyncHandler';
import { fetchAndSaveIndicadores, getIndicadoresActuales } from '../lib/indicadoresService';

// Indicadores económicos globales: sin tenantMiddleware (no dependen de la
// empresa activa). Lectura para cualquier usuario logueado; actualizar, ADMIN.
const router = Router();
router.use(auth);

router.get('/actuales', asyncHandler(async (_req, res) => {
  res.json(await getIndicadoresActuales());
}));

// Una fuente caída no es un 500: vuelve en `errores` junto con los valores actuales
router.post('/actualizar', requireRole('ADMIN'), asyncHandler(async (_req, res) => {
  const { errores } = await fetchAndSaveIndicadores();
  res.json({ ...(await getIndicadoresActuales()), errores });
}));

export default router;
