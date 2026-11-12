import type { MeResponse } from '@/types';

// Pantalla principal por usuario. Compartido entre App.tsx (HomeRedirect,
// para "/", "/dashboard" y rutas no encontradas) y Login/SeleccionarEmpresa
// (que antes navegaban siempre a /eventos "a mano" sin pasar por esta lógica
// — bug real por el que Andrea no terminaba en /gastos-operativos al
// loguearse).
//
// Prioridad: 1) Usuario.home_route configurado en Configuración → Usuarios
// (reemplaza el viejo criterio por regex de nombre — Lorena/Andrea/Santi-Nico
// ya no se detectan por texto, sino por este campo persistido). 2) default
// por rol si no tiene home_route seteado.
export function resolveHomeRoute(user: MeResponse): string {
  if (user.empresaId === null) return '/seleccionar-empresa';

  if (user.homeRoute) return user.homeRoute;

  const esAdminGlobal = user.rol === 'ADMIN' && user.puedeCambiarEmpresa;
  if (esAdminGlobal || user.puedeVerMacro) return '/macro';

  return '/eventos';
}
