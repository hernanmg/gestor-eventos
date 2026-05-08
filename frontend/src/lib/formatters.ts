import type { Moneda } from '@/types';

const FORMATTERS: Record<Moneda, Intl.NumberFormat> = {
  ARS: new Intl.NumberFormat('es-AR', {
    style:                 'currency',
    currency:              'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }),
  USD: new Intl.NumberFormat('es-AR', {
    style:                 'currency',
    currency:              'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }),
};

export function formatCurrency(amount: number, moneda: Moneda = 'ARS'): string {
  return FORMATTERS[moneda].format(amount);
}

export function currencySymbol(moneda: Moneda): string {
  return moneda === 'USD' ? 'US$' : '$';
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  return new Intl.DateTimeFormat('es-AR', {
    day:   '2-digit',
    month: '2-digit',
    year:  'numeric',
  }).format(new Date(dateStr));
}
