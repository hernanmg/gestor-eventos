// ── Semáforo de vencimientos (Lorena: "verde, amarillo, rojo") ───────────────
// Mismo criterio que los seguros de Flota (updateEstadoSeguros): vencido si la
// fecha ya pasó, por vencer dentro de los próximos 30 días, vigente después.
// Las fechas son calendario (medianoche UTC), así que se compara contra el
// día de hoy en UTC, no contra el instante actual.

export const DIAS_AVISO_VENCIMIENTO = 30;
const MS_DIA = 86_400_000;

export type EstadoVencimiento = 'VIGENTE' | 'POR_VENCER' | 'VENCIDO';

export function hoyUTC(ahora = new Date()): Date {
  return new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate()));
}

export function estadoVencimiento(fecha: Date | null | undefined, referencia: Date = hoyUTC()): EstadoVencimiento | null {
  if (!fecha) return null;
  if (fecha.getTime() < referencia.getTime()) return 'VENCIDO';
  if (fecha.getTime() < referencia.getTime() + DIAS_AVISO_VENCIMIENTO * MS_DIA) return 'POR_VENCER';
  return 'VIGENTE';
}

export function diasHasta(fecha: Date, referencia: Date = hoyUTC()): number {
  return Math.round((fecha.getTime() - referencia.getTime()) / MS_DIA);
}

// "YYYY-MM-DD" → medianoche UTC; null/'' → null; inválida → undefined (error)
export function parseFechaCalendario(s: string | null | undefined): Date | null | undefined {
  if (s === null || s === undefined || s === '') return null;
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T00:00:00.000Z` : s);
  if (isNaN(d.getTime())) return undefined;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

// Vehículos que necesitan RTO/ITV para circular — trailers y autoelevadores no
// la llevan en la pizarra ("X").
export function requiereTecnica(v: { tipo_vehiculo: string | null; tipo: string | null; codigo: string }): boolean {
  const t = (v.tipo_vehiculo ?? v.tipo ?? '').toUpperCase();
  if (t.includes('TRAILER') || t.includes('ACOPLADO') || t.includes('AUTOELEV')) return false;
  if (/-ACOPLADO$/i.test(v.codigo)) return false;
  return true;
}
