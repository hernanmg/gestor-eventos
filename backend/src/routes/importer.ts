import { Router } from 'express';
import { auth } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';
import { requireRole } from '../middleware/requireRole';
import { asyncHandler } from '../lib/asyncHandler';
import { upload, preview, confirmar } from '../controllers/importer.controller';

const router = Router();

router.use(auth);
router.use(tenantMiddleware);

const uploadMiddleware = (req: any, res: any, next: any) => {
  upload.single('file')(req, res, (err: any) => {
    if (err) {
      res.status(400).json({ error: err.message ?? 'Error al subir el archivo' });
      return;
    }
    next();
  });
};

router.post('/preview',   requireRole('ADMIN'), uploadMiddleware, asyncHandler(preview));
router.post('/confirmar', requireRole('ADMIN'), asyncHandler(confirmar));

export default router;
