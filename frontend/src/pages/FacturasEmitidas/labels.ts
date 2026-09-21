import type { TipoComprobanteEmitido, CondicionCliente } from '@/types';

export const TIPO_COMPROBANTE_LABEL: Record<TipoComprobanteEmitido, string> = {
  FACTURA_A:             'Factura A',
  FACTURA_B:             'Factura B',
  FACTURA_C:             'Factura C',
  FACTURA_MIPYMES_FCE_A: 'Factura MiPyMEs (FCE) A',
  FACTURA_MIPYMES_FCE_B: 'Factura MiPyMEs (FCE) B',
  NOTA_CREDITO_A:        'Nota de Crédito A',
  NOTA_CREDITO_B:        'Nota de Crédito B',
  NOTA_CREDITO_C:        'Nota de Crédito C',
  NOTA_DEBITO_A:         'Nota de Débito A',
  NOTA_DEBITO_B:         'Nota de Débito B',
  NOTA_DEBITO_C:         'Nota de Débito C',
  RECIBO:                'Recibo',
  RECIBO_B:              'Recibo B',
  // Sólo aparecen en compras (libro AFIP) — no se emiten a clientes.
  LIQUIDACION_A:         'Liquidación A',
  TIQUE_FACTURA_A:       'Tique Factura A',
};

// Opciones del selector al EMITIR una factura (excluye los tipos exclusivos de compras).
export const TIPOS_COMPROBANTE_EMITIBLES = (Object.keys(TIPO_COMPROBANTE_LABEL) as TipoComprobanteEmitido[])
  .filter(t => t !== 'LIQUIDACION_A' && t !== 'TIQUE_FACTURA_A');

export const CONDICION_CLIENTE_LABEL: Record<CondicionCliente, string> = {
  RESPONSABLE_INSCRIPTO: 'Responsable Inscripto',
  MONOTRIBUTISTA:        'Monotributista',
  EXENTO:                'Exento',
  CONSUMIDOR_FINAL:      'Consumidor Final',
  EXTERIOR:              'Exterior',
};

export const FORMAS_PAGO = [
  'Transferencia bancaria',
  'Echeq',
  'Cheque físico',
  'Efectivo',
  'Tarjeta',
  'Cuenta corriente',
  'Otro',
];
