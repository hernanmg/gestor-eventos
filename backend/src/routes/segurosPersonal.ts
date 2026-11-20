import { Router } from 'express';
import { auth } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';
import { requireAnyRole, ROLES } from '../middleware/requireRole';
import { asyncHandler } from '../lib/asyncHandler';
import {
  uploadPolizaPersonal,
  listPolizasPersonal, createPolizaPersonal, updatePolizaPersonal, deletePolizaPersonal, getDocumentoPolizaPersonal,
  listPersonalSeguro, altaCobertura, altaCoberturaLote, bajaCobertura, updateCobertura, deleteCobertura,
  pedidoProductor, marcarPedidoInformado, sugerenciasLegajo,
} from '../controllers/segurosPersonal.controller';

function docMiddleware(req: any, res: any, next: any) {
  uploadPolizaPersonal.single('archivo')(req, res, (err: any) => {
    if (err) { res.status(400).json({ error: err.message ?? 'Error al subir el archivo' }); return; }
    next();
  });
}

// Seguro del personal (ART/AP) — ambas empresas. Lo llevan Andrea (ADMIN) y
// Lorena (OPERADOR). Lectura: TODOS_MENOS_RESTRINGIDOS; escritura: ADMIN_OPERADOR.
const router = Router();
router.use(auth);
router.use(tenantMiddleware);

const lectura   = requireAnyRole(ROLES.TODOS_MENOS_RESTRINGIDOS);
const escritura = requireAnyRole(ROLES.ADMIN_OPERADOR);

router.get('/polizas',                lectura,   asyncHandler(listPolizasPersonal));
router.post('/polizas',               escritura, docMiddleware, asyncHandler(createPolizaPersonal));
router.put('/polizas/:id',            escritura, docMiddleware, asyncHandler(updatePolizaPersonal));
router.delete('/polizas/:id',         escritura, asyncHandler(deletePolizaPersonal));
router.get('/polizas/:id/documento',  lectura,   asyncHandler(getDocumentoPolizaPersonal));

router.get('/personal',               lectura,   asyncHandler(listPersonalSeguro));
router.get('/sugerencias-legajo',     escritura, asyncHandler(sugerenciasLegajo));
router.post('/coberturas',            escritura, asyncHandler(altaCobertura));
router.post('/coberturas/lote',       escritura, asyncHandler(altaCoberturaLote));
router.patch('/coberturas/:id/baja',  escritura, asyncHandler(bajaCobertura));
router.put('/coberturas/:id',         escritura, asyncHandler(updateCobertura));
router.delete('/coberturas/:id',      escritura, asyncHandler(deleteCobertura));

router.get('/pedido-productor',       escritura, asyncHandler(pedidoProductor));
router.post('/pedido-productor/marcar', escritura, asyncHandler(marcarPedidoInformado));

export default router;
