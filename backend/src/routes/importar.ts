import { Router } from 'express';
import { auth } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';
import { requireRole } from '../middleware/requireRole';
import { asyncHandler } from '../lib/asyncHandler';
import { upload as uploadXlsx } from '../controllers/importer.controller';
import { importarProveedoresFormulario } from '../controllers/proveedoresFormulario.controller';

const router = Router();

router.use(auth);
router.use(tenantMiddleware);

const xlsxMiddleware = (req: any, res: any, next: any) => {
  uploadXlsx.single('archivo')(req, res, (err: any) => {
    if (err) { res.status(400).json({ error: err.message ?? 'Error al subir el archivo' }); return; }
    next();
  });
};

router.post('/proveedores-formulario', requireRole('ADMIN'), xlsxMiddleware, asyncHandler(importarProveedoresFormulario));

export default router;
