export type AuthUser = {
  id:        number;
  rol:       'ADMIN' | 'OPERADOR' | 'VIEWER';
  // Empresa activa de la sesión. null = autenticado pero con selección de
  // empresa pendiente (usuario multi-empresa que todavía no eligió, o admin
  // global recién logueado antes de resolver una empresa por defecto).
  empresaId: number | null;
};

declare global {
  namespace Express {
    interface Request {
      user?:      AuthUser;
      eventoRol?: 'ADMIN' | 'OPERADOR' | 'VIEWER';
      // Seteado por tenantMiddleware a partir de req.user.empresaId — siempre
      // presente (no null) en cualquier ruta que aplique tenantMiddleware.
      empresaId?: number;
    }
  }
}
