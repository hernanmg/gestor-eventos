import type { Moneda, MonedaCCC } from '@/types';

// Acepta Moneda (ARS/USD/EUR, usado por Evento/Factura/Movimiento) y MonedaCCC
// (ARS/USD/EUR, usado por Cuenta Corriente Genérica) — union de literales,
// hoy equivalentes, para no acoplar formatters.ts a cuál de los dos tipos use
// cada módulo.
type MonedaFormateable = Moneda | MonedaCCC;

// Formatea un monto como moneda — cada divisa usa el locale que corresponde a
// su propia convención de escritura (es-AR: punto miles/coma decimal para
// ARS; en-US para USD; de-DE para EUR), no siempre es-AR para las tres.
export function fmtMoney(
  value: number | string | null | undefined,
  moneda: MonedaFormateable = 'ARS',
): string {
  if (value === null || value === undefined) return '';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '';

  if (moneda === 'USD') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency', currency: 'USD', minimumFractionDigits: 2,
    }).format(num);
  }
  if (moneda === 'EUR') {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency', currency: 'EUR', minimumFractionDigits: 2,
    }).format(num);
  }
  // ARS — formato argentino: punto para miles, coma para decimales.
  return new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'ARS', minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(num);
}

// Parsea un string con formato argentino ("2.979.079,87") a number — para
// inputs numéricos (ver MoneyInput). Sólo tiene sentido para entrada en
// convención ARS (punto miles / coma decimal); no usar sobre texto ya
// formateado en otra convención.
export function parseMoney(value: string): number {
  return parseFloat(value.replace(/\./g, '').replace(',', '.')) || 0;
}

export function formatCurrency(amount: number, moneda: MonedaFormateable = 'ARS'): string {
  return fmtMoney(amount, moneda);
}

export function currencySymbol(moneda: MonedaFormateable): string {
  if (moneda === 'USD') return 'US$';
  if (moneda === 'EUR') return '€';
  return '$';
}

// Las fechas de negocio (fecha_inicio, fecha_emision, etc.) llegan del backend
// como medianoche UTC. Sin `timeZone: 'UTC'` explícito, Intl.DateTimeFormat usa
// la timezone del navegador y corre la fecha un día para atrás en timezones
// negativas (ej. Argentina, UTC-3).
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  return new Intl.DateTimeFormat('es-AR', {
    day:      '2-digit',
    month:    '2-digit',
    year:     'numeric',
    timeZone: 'UTC',
  }).format(new Date(dateStr));
}
