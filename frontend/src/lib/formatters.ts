import type { Moneda, MonedaCCC } from '@/types';

// Clave canónica de patente (sin espacios, mayúsculas) — es lo que se manda
// al backend y lo que persiste Camion.patente. Mismo criterio que
// backend/src/lib/normalizarPatente.ts (duplicado a propósito: frontend y
// backend no comparten código, y esta normalización es la que evita volver a
// crear vehículos duplicados por formato — ver fix de duplicados Camion).
export function normalizarPatente(patente: string): string {
  return patente.toUpperCase().replace(/\s+/g, '').trim();
}

// Sólo estética para mostrar en tablas/inputs — nunca es lo que se persiste.
// Mercosur (2 letras + 3 dígitos + 2 letras, ej. "AB123CD") o formato viejo
// (3 letras + 3 dígitos, ej. "HLW156"); cualquier otro formato se muestra tal
// cual viene (ya normalizado) sin inventarle espacios.
export function formatearPatente(patente: string | null | undefined): string {
  if (!patente) return '';
  const norm = normalizarPatente(patente);
  const mercosur = norm.match(/^([A-Z]{2})(\d{3})([A-Z]{2})$/);
  if (mercosur) return `${mercosur[1]} ${mercosur[2]} ${mercosur[3]}`;
  const vieja = norm.match(/^([A-Z]{3})(\d{3})$/);
  if (vieja) return `${vieja[1]} ${vieja[2]}`;
  return norm;
}

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

// Litros del módulo Combustible — siempre 3 decimales, igual que la planilla
// real de Santi (ej. "781,103 L"), nunca redondeado a menos decimales.
export function formatLitros(litros: number | string | null | undefined): string {
  if (litros === null || litros === undefined) return '—';
  const num = typeof litros === 'string' ? parseFloat(litros) : litros;
  if (isNaN(num)) return '—';
  return num.toLocaleString('es-AR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
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
