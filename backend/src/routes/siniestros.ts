import { Router } from 'express';
import { auth } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';
import { requireAnyRole, ROLES } from '../middleware/requireRole';
import { asyncHandler } from '../lib/asyncHandler';
import {
  uploadDocumentoSiniestro, uploadPlanillaSiniestros,
  listSiniestros, getSiniestro, createSiniestro, updateSiniestro, cerrarSiniestro,
  addGastoSiniestro, deleteGastoSiniestro,
  subirDocumentoSiniestro, descargarDocumentoSiniestro,
  importarSiniestros, listEmpleadosSiniestros,
} from '../controllers/siniestros.controller';

function docMiddleware(req: any, res: any, next: any) {
  uploadDocumentoSiniestro.single('archivo')(req, res, (err: any) => {
    if (err) { res.status(400).json({ error: err.message ?? 'Error al subir el archivo' }); return; }
    next();
  });
}

function excelMiddleware(req: any, res: any, next: any) {
  uploadPlanillaSiniestros.single('archivo')(req, res, (err: any) => {
    if (err) { res.status(400).json({ error: err.message ?? 'Error al subir el archivo' }); return; }
    next();
  });
}

// Siniestros de empleados (ART, accidentes de trabajo) — DOS57, pantalla de
// Andrea. Lectura: TODOS_MENOS_RESTRINGIDOS. Escritura: ADMIN_OPERADOR.
const router = Router();
router.use(auth);
router.use(tenantMiddleware);

router.post('/importar',              requireAnyRole(ROLES.ADMIN_OPERADOR), excelMiddleware, asyncHandler(importarSiniestros));
// Antes de '/:id' — si no, 'empleados' se toma como un id.
router.get('/empleados',              requireAnyRole(ROLES.TODOS_MENOS_RESTRINGIDOS), asyncHandler(listEmpleadosSiniestros));
router.get('/',                       requireAnyRole(ROLES.TODOS_MENOS_RESTRINGIDOS), asyncHandler(listSiniestros));
router.get('/:id',                    requireAnyRole(ROLES.TODOS_MENOS_RESTRINGIDOS), asyncHandler(getSiniestro));
router.post('/',                      requireAnyRole(ROLES.ADMIN_OPERADOR), asyncHandler(createSiniestro));
router.put('/:id',                    requireAnyRole(ROLES.ADMIN_OPERADOR), asyncHandler(updateSiniestro));
router.patch('/:id/cerrar',           requireAnyRole(ROLES.ADMIN_OPERADOR), asyncHandler(cerrarSiniestro));
router.post('/:id/gastos',            requireAnyRole(ROLES.ADMIN_OPERADOR), asyncHandler(addGastoSiniestro));
router.delete('/:id/gastos/:gastoId', requireAnyRole(ROLES.ADMIN_OPERADOR), asyncHandler(deleteGastoSiniestro));
router.post('/:id/documentos',        requireAnyRole(ROLES.ADMIN_OPERADOR), docMiddleware, asyncHandler(subirDocumentoSiniestro));
router.get('/:id/documentos/:docId',  requireAnyRole(ROLES.TODOS_MENOS_RESTRINGIDOS), asyncHandler(descargarDocumentoSiniestro));

export default router;
