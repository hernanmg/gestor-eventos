// Códigos estables de los rubros técnicos del sistema (Rubro.codigo), en
// espejo con backend/src/lib/rubrosConstants.ts — front y back son apps
// separadas, así que el valor se duplica acá en vez de importarse.
export const RUBROS_SISTEMA = {
  RRHH:         'RRHH',
  IMPUESTOS:    'EG-IMP',
  GASTOS_EXTRA: 'EG-EXTRA',
} as const;
