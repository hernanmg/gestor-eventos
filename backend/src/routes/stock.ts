// Stock module — activo en backend, oculto en UI (FEATURES.STOCK = false en frontend/src/lib/features.ts)
import { Router } from 'express';
import { auth } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';
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
  uploadFoto, importarFoto, getFoto,
  uploadCatalogo, importarCatalogo,
  getPendientesFirma, firmarSalida, firmarLlegada, firmarRetorno,
} from '../controllers/stock.controller';
import {
  listCamiones, createCamion, updateCamion, deleteCamion,
} from '../controllers/camion.controller';
import {
  listCunas, getCuna, createCuna, updateCuna, deleteCuna,
  addProductoCuna, removeProductoCuna,
} from '../controllers/cuna.controller';

const router = Router();
router.use(auth);
router.use(tenantMiddleware);

// ── Productos ─────────────────────────────────────────────────────────────────
router.get('/productos',                   asyncHandler(listProductos));
router.get('/productos/:id',               asyncHandler(getProducto));
router.get('/productos/:id/foto',          asyncHandler(getFoto));
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
router.get('/asignaciones/pendientes-firma', asyncHandler(getPendientesFirma));
router.put('/asignaciones/:id',    requireRole('OPERADOR'), asyncHandler(updateAsignacion));
router.delete('/asignaciones/:id', requireRole('OPERADOR'), asyncHandler(cancelarAsignacion));

// ── Firmas digitales ─────────────────────────────────────────────────────────
router.patch('/asignaciones/:id/firmar-salida',  requireRole('OPERADOR'), asyncHandler(firmarSalida));
router.patch('/asignaciones/:id/firmar-llegada', requireRole('OPERADOR'), asyncHandler(firmarLlegada));
router.patch('/asignaciones/:id/firmar-retorno', requireRole('OPERADOR'), asyncHandler(firmarRetorno));

// ── Transferencia ─────────────────────────────────────────────────────────────
router.post('/transferencia', requireRole('OPERADOR'), asyncHandler(transferencia));

// ── Importador catálogo Layher / foto de producto ─────────────────────────────
router.post('/importar/catalogo', requireRole('OPERADOR'), uploadCatalogo.single('archivo'), asyncHandler(importarCatalogo));
router.post('/importar/foto/:id', requireRole('OPERADOR'), uploadFoto.single('foto'),        asyncHandler(importarFoto));

// ── Camiones ──────────────────────────────────────────────────────────────────
router.get('/camiones',           asyncHandler(listCamiones));
router.post('/camiones',          requireRole('OPERADOR'), asyncHandler(createCamion));
router.put('/camiones/:id',       requireRole('OPERADOR'), asyncHandler(updateCamion));
router.delete('/camiones/:id',    requireRole('OPERADOR'), asyncHandler(deleteCamion));

// ── Cunas ─────────────────────────────────────────────────────────────────────
router.get('/cunas',                       asyncHandler(listCunas));
router.get('/cunas/:id',                   asyncHandler(getCuna));
router.post('/cunas',                      requireRole('OPERADOR'), asyncHandler(createCuna));
router.put('/cunas/:id',                   requireRole('OPERADOR'), asyncHandler(updateCuna));
router.post('/cunas/:id/productos',        requireRole('OPERADOR'), asyncHandler(addProductoCuna));
router.delete('/cunas/:id/productos/:productoId', requireRole('OPERADOR'), asyncHandler(removeProductoCuna));
router.delete('/cunas/:id',                requireRole('OPERADOR'), asyncHandler(deleteCuna));

export default router;

// ── Nested under /api/eventos/:id ─────────────────────────────────────────────
export const eventoStockRouter = Router({ mergeParams: true });
eventoStockRouter.use(auth);
eventoStockRouter.use(tenantMiddleware);
eventoStockRouter.get('/',  requireEventoAcceso(), asyncHandler(getEventoStock));
eventoStockRouter.post('/', requireEventoAcceso(), requireEventoRole('OPERADOR'), asyncHandler(asignarProducto));
