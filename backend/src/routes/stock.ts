import { Router } from 'express';
import { auth } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { requireEventoAcceso, requireEventoRole } from '../middleware/requireEventoAcceso';
import { asyncHandler } from '../lib/asyncHandler';
import {
  listProductos, getProducto, createProducto, updateProducto, deleteProducto,
  getDisponibilidad, getAlertas,
  getEventoStock, asignarProducto,
  updateAsignacion, cancelarAsignacion,
  transferencia, getSugerencias,
  listCategorias, createCategoria, updateCategoria, deleteCategoria,
} from '../controllers/stock.controller';

const router = Router();
router.use(auth);

// ── Productos ─────────────────────────────────────────────────────────────────
router.get('/productos',                   asyncHandler(listProductos));
router.get('/productos/:id',               asyncHandler(getProducto));
router.post('/productos',    requireRole('OPERADOR'), asyncHandler(createProducto));
router.put('/productos/:id', requireRole('OPERADOR'), asyncHandler(updateProducto));
router.delete('/productos/:id', requireRole('ADMIN'), asyncHandler(deleteProducto));

// ── Categorías ────────────────────────────────────────────────────────────────
router.get('/categorias',           asyncHandler(listCategorias));
router.post('/categorias',          requireRole('ADMIN'), asyncHandler(createCategoria));
router.put('/categorias/:id',       requireRole('ADMIN'), asyncHandler(updateCategoria));
router.delete('/categorias/:id',    requireRole('ADMIN'), asyncHandler(deleteCategoria));

// ── Disponibilidad, alertas, sugerencias ──────────────────────────────────────
router.get('/disponibilidad',  asyncHandler(getDisponibilidad));
router.get('/alertas',         asyncHandler(getAlertas));
router.get('/sugerencias',     asyncHandler(getSugerencias));

// ── Asignaciones ─────────────────────────────────────────────────────────────
router.put('/asignaciones/:id',    requireRole('OPERADOR'), asyncHandler(updateAsignacion));
router.delete('/asignaciones/:id', requireRole('OPERADOR'), asyncHandler(cancelarAsignacion));

// ── Transferencia ─────────────────────────────────────────────────────────────
router.post('/transferencia', requireRole('OPERADOR'), asyncHandler(transferencia));

export default router;

// ── Nested under /api/eventos/:id ─────────────────────────────────────────────
export const eventoStockRouter = Router({ mergeParams: true });
eventoStockRouter.use(auth);
eventoStockRouter.get('/',  requireEventoAcceso(), asyncHandler(getEventoStock));
eventoStockRouter.post('/', requireEventoAcceso(), requireEventoRole('OPERADOR'), asyncHandler(asignarProducto));
