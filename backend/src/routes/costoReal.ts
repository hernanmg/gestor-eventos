import { Router } from 'express';
import { auth } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';
import { requireRole } from '../middleware/requireRole';
import { asyncHandler } from '../lib/asyncHandler';
import { uploadExcel } from '../controllers/combustible.controller';
import {
  getCostoReal, listCostoReal, createLinea, updateLinea, deleteLinea,
  sincronizarBloque, importarMatriz, exportarCostoReal,
} from '../controllers/costoReal.controller';

// Costo real del evento (matriz de Flor, DOS57). ADMIN o permiso COSTO_REAL.
const acceso = requireRole('ADMIN', { permiso: 'COSTO_REAL' });

function excelMiddleware(req: any, res: any, next: any) {
  uploadExcel.single('archivo')(req, res, (err: any) => {
    if (err) { res.status(400).json({ error: err.message ?? 'Error al subir el archivo' }); return; }
    next();
  });
}

// ── Nested bajo /api/eventos/:id/costo-real ───────────────────────────────────
export const costoRealEventoRouter = Router({ mergeParams: true });
costoRealEventoRouter.use(auth, tenantMiddleware, acceso);
costoRealEventoRouter.get('/',             asyncHandler(getCostoReal));
costoRealEventoRouter.get('/exportar',     asyncHandler(exportarCostoReal));
costoRealEventoRouter.post('/lineas',      asyncHandler(createLinea));
costoRealEventoRouter.post('/sincronizar', asyncHandler(sincronizarBloque));
costoRealEventoRouter.post('/importar',    excelMiddleware, asyncHandler(importarMatriz));

// ── /api/costo-real ───────────────────────────────────────────────────────────
export const costoRealRouter = Router();
costoRealRouter.use(auth, tenantMiddleware, acceso);
costoRealRouter.get('/',              asyncHandler(listCostoReal));
costoRealRouter.put('/lineas/:id',    asyncHandler(updateLinea));
costoRealRouter.delete('/lineas/:id', asyncHandler(deleteLinea));
