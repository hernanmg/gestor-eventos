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
  RECIBO:                'Recibo',
};

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
