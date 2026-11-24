import { Router } from 'express';
import { auth } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';
import { requireAnyRole, ROLES } from '../middleware/requireRole';
import { asyncHandler } from '../lib/asyncHandler';
import {
  listComparativos, getComparativo, createComparativo, updateComparativo, deleteComparativo,
  elegirCotizacion, cambiarEstadoComparativo, armarOrdenCompra, pdfComparativo,
} from '../controllers/comparativos.controller';

// Comparativo de presupuestos de proveedores — mismo acceso que las órdenes de
// compra: cargan ADMIN y OPERADOR; elegir, anular, reabrir y armar la orden de
// compra es de ADMIN.
const router = Router();
router.use(auth);
router.use(tenantMiddleware);

const lectura = requireAnyRole(ROLES.TODOS_MENOS_RESTRINGIDOS);
const carga   = requireAnyRole(ROLES.ADMIN_OPERADOR);
const admin   = requireAnyRole(ROLES.SOLO_ADMIN);

router.get('/',                  lectura, asyncHandler(listComparativos));
router.post('/',                 carga,   asyncHandler(createComparativo));
router.get('/:id',               lectura, asyncHandler(getComparativo));
router.get('/:id/pdf',           lectura, asyncHandler(pdfComparativo));
router.put('/:id',               carga,   asyncHandler(updateComparativo));
router.delete('/:id',            carga,   asyncHandler(deleteComparativo));
router.post('/:id/elegir',       admin,   asyncHandler(elegirCotizacion));
router.post('/:id/orden-compra', admin,   asyncHandler(armarOrdenCompra));
// reabrir | anular
router.post('/:id/:accion',      admin,   asyncHandler(cambiarEstadoComparativo));

export default router;
