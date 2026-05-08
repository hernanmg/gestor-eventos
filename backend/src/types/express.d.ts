export type AuthUser = {
  id:  number;
  rol: 'ADMIN' | 'OPERADOR' | 'VIEWER';
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
