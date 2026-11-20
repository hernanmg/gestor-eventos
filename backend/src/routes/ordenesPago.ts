import { Router } from 'express';
import { auth } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';
import { requireRole } from '../middleware/requireRole';
import { asyncHandler } from '../lib/asyncHandler';
import {
  listOrdenesPago, getOrdenPago, facturasPendientesProveedor, createOrdenPago, updateOrdenPago, deleteOrdenPago,
  cambiarEstadoOrdenPago, pagarOrdenPago, pdfOrdenPago,
} from '../controllers/ordenesPago.controller';

// Órdenes de pago a proveedores — mismo acceso que Facturas a Pagar (ADMIN o
// permiso FACTURAS). Autorizar exige además ser el administrador general o
// tener el permiso APROBAR_PAGOS (se valida en el controller).
const router = Router();
router.use(auth);
router.use(tenantMiddleware);
router.use(requireRole('ADMIN', { permiso: 'FACTURAS' }));

router.get('/',                     asyncHandler(listOrdenesPago));
router.get('/facturas-pendientes',  asyncHandler(facturasPendientesProveedor));
router.post('/',                    asyncHandler(createOrdenPago));
router.get('/:id',                  asyncHandler(getOrdenPago));
router.get('/:id/pdf',              asyncHandler(pdfOrdenPago));
router.put('/:id',                  asyncHandler(updateOrdenPago));
router.delete('/:id',               asyncHandler(deleteOrdenPago));
router.post('/:id/pagar',           asyncHandler(pagarOrdenPago));
// revisar | autorizar | volver-borrador | anular
router.post('/:id/:accion',         asyncHandler(cambiarEstadoOrdenPago));

export default router;
