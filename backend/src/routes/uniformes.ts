import { Router } from 'express';
import { auth } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';
import { requireAnyRole, ROLES } from '../middleware/requireRole';
import { asyncHandler } from '../lib/asyncHandler';
import { uploadPlanillaSiniestros } from '../controllers/siniestros.controller';
import {
  importarUniformesExcel, historialUniformesEmpleado, historialUniformesPorNombre, resumenUniformes, exportarUniformes,
  listEmpleadosUniformes, crearEntregaUniforme, editarEntregaUniforme, eliminarEntregaUniforme,
} from '../controllers/uniformes.controller';

function excelMiddleware(req: any, res: any, next: any) {
  uploadPlanillaSiniestros.single('archivo')(req, res, (err: any) => {
    if (err) { res.status(400).json({ error: err.message ?? 'Error al subir el archivo' }); return; }
    next();
  });
}

// Entregas de uniformes (Lorena, DOS57). La sección la administra Lorena
// (OPERADOR), así que importar/exportar/lectura son ADMIN_OPERADOR — ojo que
// importar puede dar de baja empleados (pestaña roja), por eso el frontend
// obliga a pasar por la vista previa antes de confirmar.
const router = Router();
router.use(auth);
router.use(tenantMiddleware);

router.post('/importar',               requireAnyRole(ROLES.ADMIN_OPERADOR), excelMiddleware, asyncHandler(importarUniformesExcel));
router.get('/historial',               requireAnyRole(ROLES.ADMIN_OPERADOR), asyncHandler(historialUniformesPorNombre));
router.get('/historial/:empleadoId',   requireAnyRole(ROLES.ADMIN_OPERADOR), asyncHandler(historialUniformesEmpleado));
router.get('/exportar',                requireAnyRole(ROLES.ADMIN_OPERADOR), asyncHandler(exportarUniformes));
router.get('/resumen',                 requireAnyRole(ROLES.ADMIN_OPERADOR), asyncHandler(resumenUniformes));
router.get('/empleados',               requireAnyRole(ROLES.ADMIN_OPERADOR), asyncHandler(listEmpleadosUniformes));
router.post('/entregas',               requireAnyRole(ROLES.ADMIN_OPERADOR), asyncHandler(crearEntregaUniforme));
router.put('/entregas/:id',            requireAnyRole(ROLES.ADMIN_OPERADOR), asyncHandler(editarEntregaUniforme));
router.delete('/entregas/:id',         requireAnyRole(ROLES.ADMIN_OPERADOR), asyncHandler(eliminarEntregaUniforme));

export default router;
