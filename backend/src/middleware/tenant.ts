import { Request, Response, NextFunction } from 'express';

// Se ejecuta después de auth. auth ya decodificó el JWT y seteó req.user
// (incluyendo empresaId). Este middleware exige que haya una empresa activa
// resuelta y la expone como req.empresaId para que los controllers filtren
// sus queries sin tener que leer req.user directamente.
export function tenantMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (req.user?.empresaId == null) {
    res.status(401).json({ error: 'Sin empresa activa. Seleccioná una empresa.' });
    return;
  }
  req.empresaId = req.user.empresaId;
  next();
}
