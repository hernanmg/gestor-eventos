// Códigos estables de los rubros técnicos del sistema (Rubro.codigo).
// Independientes del `nombre` (que el admin puede renombrar libremente) y de
// TabConfig.codigo (dominio distinto, ligado a las hojas fijas del Excel).
export const RUBROS_SISTEMA = {
  RRHH:         'RRHH',
  IMPUESTOS:    'EG-IMP',
  GASTOS_EXTRA: 'EG-EXTRA',
} as const;
