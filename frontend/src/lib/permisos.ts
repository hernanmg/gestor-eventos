import type { MeResponse, Permiso } from '@/types';

// Permisos de carga por responsable — espejo de backend/src/lib/permisos.ts.
// Habilitan a una persona puntual un módulo o importador que su rol no tiene
// (ej. Santi, OPERADOR, con la tarjeta corporativa). Se asignan desde
// Configuración → Usuarios.
export const PERMISOS: { key: Permiso; label: string; detalle: string }[] = [
  { key: 'TARJETA_CORPORATIVA', label: 'Tarjeta corporativa', detalle: 'Ver los consumos e importar los resúmenes.' },
  { key: 'FACTURAS',            label: 'Facturas a pagar',    detalle: 'Incluye importar el libro de compras de AFIP.' },
  { key: 'PADRON_EMPLEADOS',    label: 'Padrón de empleados', detalle: 'Importar la planilla de datos personales (sin acceso a sueldos).' },
  { key: 'UNIFORMES',           label: 'Uniformes',           detalle: 'Entregas y stock del depósito.' },
];

export function tienePermiso(user: Pick<MeResponse, 'rol' | 'permisos'> | null | undefined, permiso: Permiso): boolean {
  return !!user && (user.rol === 'ADMIN' || (user.permisos ?? []).includes(permiso));
}
