import { Router } from 'express';
import { auth } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';
import { requireAnyRole, ROLES } from '../middleware/requireRole';
import { asyncHandler } from '../lib/asyncHandler';
import {
  uploadExcelPagos, listResumenes, getResumen, createResumen, updateResumen, deleteResumen, enviarResumen,
  addLineas, updateLinea, deleteLinea, revisarLinea, aprobarPendientes, sugerencias, previewImport, confirmarImport,
  requireRevisorPagos,
} from '../controllers/resumenPagos.controller';

function importMiddleware(req: any, res: any, next: any) {
  uploadExcelPagos.single('archivo')(req, res, (err: any) => {
    if (err) { res.status(400).json({ error: err.message ?? 'Error al subir el archivo' }); return; }
    next();
  });
}

// Resumen semanal de pagos (Gastos del mes → Pagos semanales). Andrea arma y
// envía (ADMIN_OPERADOR); la revisión línea por línea es del administrador
// general o de quien tenga el permiso APROBAR_PAGOS (ver requireRevisorPagos).
const router = Router();
router.use(auth);
router.use(tenantMiddleware);

const LEER   = requireAnyRole(ROLES.ADMIN_OPERADOR);
const CARGAR = requireAnyRole(ROLES.ADMIN_OPERADOR);
const REVISAR = [requireAnyRole(ROLES.TODOS_MENOS_RESTRINGIDOS), requireRevisorPagos];

router.get('/',                          LEER,   asyncHandler(listResumenes));
router.post('/',                         CARGAR, asyncHandler(createResumen));
router.post('/importar/preview',         CARGAR, importMiddleware, asyncHandler(previewImport));
router.post('/importar',                 CARGAR, importMiddleware, asyncHandler(confirmarImport));
router.patch('/lineas/:lineaId',         CARGAR, asyncHandler(updateLinea));
router.delete('/lineas/:lineaId',        CARGAR, asyncHandler(deleteLinea));
router.post('/lineas/:lineaId/revisar',  REVISAR, asyncHandler(revisarLinea));
router.get('/:id',                       LEER,   asyncHandler(getResumen));
router.patch('/:id',                     CARGAR, asyncHandler(updateResumen));
router.delete('/:id',                    CARGAR, asyncHandler(deleteResumen));
router.post('/:id/enviar',               CARGAR, asyncHandler(enviarResumen));
router.post('/:id/lineas',               CARGAR, asyncHandler(addLineas));
router.get('/:id/sugerencias',           CARGAR, asyncHandler(sugerencias));
router.post('/:id/aprobar-pendientes',   REVISAR, asyncHandler(aprobarPendientes));

export default router;
