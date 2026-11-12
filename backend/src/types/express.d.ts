export type AuthUser = {
  id:        number;
  // 'PANOLERO' (sin Ñ) — así es como Prisma Client representa el valor de
  // enum Rol.PAÑOLERO en JS/TS; el @map en schema.prisma sólo afecta el
  // nombre guardado en la columna de Postgres, no el identificador que
  // circula por el código de la app (JWT, comparaciones, zod, etc.).
  rol:       'ADMIN' | 'OPERADOR' | 'VIEWER' | 'JORNALERO' | 'PANOLERO';
  // Empresa activa de la sesión. null = autenticado pero con selección de
  // empresa pendiente (usuario multi-empresa que todavía no eligió, o admin
  // global recién logueado antes de resolver una empresa por defecto).
  empresaId: number | null;
};

declare global {
  namespace Express {
    interface Request {
      user?:      AuthUser;
      // Seteado por tenantMiddleware a partir de req.user.empresaId — siempre
      // presente (no null) en cualquier ruta que aplique tenantMiddleware.
      empresaId?: number;
    }
  }
}
