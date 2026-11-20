import { Router } from 'express';
import { auth } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';
import { requireAnyRole, ROLES } from '../middleware/requireRole';
import { asyncHandler } from '../lib/asyncHandler';
import {
  listOrdenesCompra, getOrdenCompra, sugerenciaProveedor, createOrdenCompra, updateOrdenCompra, deleteOrdenCompra,
  cambiarEstadoOrden, recibirOrden, cerrarOrden, facturasDisponibles, vincularFactura, desvincularFactura, pdfOrdenCompra,
} from '../controllers/ordenesCompra.controller';

// Órdenes de compra a proveedores — ambas empresas. Arman borradores ADMIN y
// OPERADOR (Jazmín pide material); emitir, anular, vincular facturas y cerrar
// el cotejo es de ADMIN (Mayra/Andrea). Lectura: TODOS_MENOS_RESTRINGIDOS.
const router = Router();
router.use(auth);
router.use(tenantMiddleware);

const lectura = requireAnyRole(ROLES.TODOS_MENOS_RESTRINGIDOS);
const carga   = requireAnyRole(ROLES.ADMIN_OPERADOR);
const admin   = requireAnyRole(ROLES.SOLO_ADMIN);

router.get('/',                          lectura, asyncHandler(listOrdenesCompra));
router.get('/sugerencia',                carga,   asyncHandler(sugerenciaProveedor));
router.post('/',                         carga,   asyncHandler(createOrdenCompra));
router.get('/:id',                       lectura, asyncHandler(getOrdenCompra));
router.get('/:id/pdf',                   lectura, asyncHandler(pdfOrdenCompra));
router.put('/:id',                       carga,   asyncHandler(updateOrdenCompra));
router.delete('/:id',                    carga,   asyncHandler(deleteOrdenCompra));
// Recepción: la puede registrar quien recibe el material (OPERADOR)
router.post('/:id/recibir',              carga,   asyncHandler(recibirOrden));
router.post('/:id/cerrar',               admin,   asyncHandler(cerrarOrden));
router.get('/:id/facturas-disponibles',  admin,   asyncHandler(facturasDisponibles));
router.post('/:id/facturas',             admin,   asyncHandler(vincularFactura));
router.delete('/:id/facturas/:facturaId', admin,  asyncHandler(desvincularFactura));
// emitir | volver-borrador | anular | reabrir
router.post('/:id/:accion',              admin,   asyncHandler(cambiarEstadoOrden));

export default router;
