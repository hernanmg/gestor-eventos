// ── Permisos de carga por responsable ────────────────────────────────────────
// El rol (ADMIN > OPERADOR > VIEWER) define el alcance general; estos permisos
// habilitan a una persona puntual un módulo o importador que su rol no tiene,
// para que el responsable de un archivo lo cargue sin esperar a un admin
// (ej. Santi, OPERADOR, importa la tarjeta corporativa). Se asignan desde
// Configuración → Usuarios y se guardan en Usuario.permisos.

export const PERMISOS = {
  TARJETA_CORPORATIVA: 'Tarjeta corporativa (ver e importar)',
  FACTURAS:            'Facturas a pagar (incluye importar el libro de compras)',
  PADRON_EMPLEADOS:    'Padrón de empleados (importar la planilla de datos personales)',
  UNIFORMES:           'Uniformes (entregas y stock del depósito)',
} as const;

export type Permiso = keyof typeof PERMISOS;

export const PERMISO_KEYS = Object.keys(PERMISOS) as [Permiso, ...Permiso[]];
