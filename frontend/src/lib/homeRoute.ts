import { EMPRESAS } from '@/lib/empresasConstants';
import type { MeResponse } from '@/types';

// Pantalla principal por usuario — placeholder por nombre hasta que exista un
// rol/flag dedicado (mismo criterio para Lorena/Santi-Nico/Andrea, todos
// DOS57). Compartido entre App.tsx (HomeRedirect, para /dashboard y rutas no
// encontradas) y Login/SeleccionarEmpresa (que antes navegaban siempre a
// /eventos "a mano" sin pasar por esta lógica — bug real por el que Andrea no
// terminaba en /gastos-operativos al loguearse).
export function resolveHomeRoute(user: MeResponse): string {
  if (user.empresaId === null) return '/seleccionar-empresa';

  const esAdminGlobal = user.rol === 'ADMIN' && user.puedeCambiarEmpresa;
  if (esAdminGlobal) return '/macro';

  const esDos57 = user.empresaId === EMPRESAS.DOS57;
  const esAdminUOperador = user.rol === 'ADMIN' || user.rol === 'OPERADOR';

  if (esDos57 && esAdminUOperador && /andrea/i.test(user.nombre)) return '/gastos-operativos';
  if (esDos57 && user.rol === 'OPERADOR' && /loren/i.test(user.nombre)) return '/presentismo';
  if (esDos57 && user.rol === 'OPERADOR' && /santi|nico/i.test(user.nombre)) return '/combustible';

  return '/eventos';
}
