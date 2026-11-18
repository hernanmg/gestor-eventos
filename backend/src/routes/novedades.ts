import { Router } from 'express';
import { auth } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';
import { requireAnyRole } from '../middleware/requireRole';
import { asyncHandler } from '../lib/asyncHandler';
import {
  uploadAdjuntosNovedad, listTipos, createTipo, updateTipo, opciones, listNovedades, getNovedad,
  createNovedad, updateNovedad, deleteNovedad, subirAdjuntos, descargarAdjunto, borrarAdjunto,
} from '../controllers/novedades.controller';

function adjuntosMiddleware(req: any, res: any, next: any) {
  uploadAdjuntosNovedad.array('archivos')(req, res, (err: any) => {
    if (err) {
      const msg = err.code === 'LIMIT_FILE_SIZE' ? 'Cada archivo puede pesar hasta 10 MB' : err.message ?? 'Error al subir el archivo';
      res.status(400).json({ error: msg }); return;
    }
    next();
  });
}

// Libro de novedades: todos cargan (ADMIN, OPERADOR, pañolero), VIEWER mira.
// Los tipos los administra ADMIN. El pañolero sólo modifica lo que cargó él
// (se controla en el controller).
const router = Router();
router.use(auth);
router.use(tenantMiddleware);

const LEER   = requireAnyRole(['ADMIN', 'OPERADOR', 'VIEWER', 'PANOLERO']);
const CARGAR = requireAnyRole(['ADMIN', 'OPERADOR', 'PANOLERO']);
const ADMIN  = requireAnyRole(['ADMIN']);

router.get('/tipos',                 LEER,   asyncHandler(listTipos));
router.post('/tipos',                ADMIN,  asyncHandler(createTipo));
router.patch('/tipos/:id',           ADMIN,  asyncHandler(updateTipo));
router.get('/opciones',              LEER,   asyncHandler(opciones));
router.get('/adjuntos/:adjuntoId',   LEER,   asyncHandler(descargarAdjunto));
router.delete('/adjuntos/:adjuntoId', CARGAR, asyncHandler(borrarAdjunto));
router.get('/',                      LEER,   asyncHandler(listNovedades));
router.post('/',                     CARGAR, asyncHandler(createNovedad));
router.get('/:id',                   LEER,   asyncHandler(getNovedad));
router.patch('/:id',                 CARGAR, asyncHandler(updateNovedad));
router.delete('/:id',                CARGAR, asyncHandler(deleteNovedad));
router.post('/:id/adjuntos',         CARGAR, adjuntosMiddleware, asyncHandler(subirAdjuntos));

export default router;
