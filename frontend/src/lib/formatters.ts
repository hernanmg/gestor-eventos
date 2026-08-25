import type { Moneda, MonedaCCC } from '@/types';

// Acepta Moneda (ARS/USD, usado por Evento/Factura/Movimiento) y MonedaCCC
// (ARS/USD/EUR, usado por Cuenta Corriente Genérica) — unión de literales en
// vez de uno de los dos tipos, para no forzar EUR en los módulos que no lo usan.
type MonedaFormateable = Moneda | MonedaCCC;

const FORMATTERS: Record<MonedaFormateable, Intl.NumberFormat> = {
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
  EUR: new Intl.NumberFormat('es-AR', {
    style:                 'currency',
    currency:              'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }),
};

export function formatCurrency(amount: number, moneda: MonedaFormateable = 'ARS'): string {
  return FORMATTERS[moneda].format(amount);
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
