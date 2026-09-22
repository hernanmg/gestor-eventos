// Esquema de personal por turno (seguridad, limpieza…) — espejo de
// backend/src/lib/esquemaTurnos.ts. El backend es la fuente de verdad de los
// valores guardados; acá se calcula lo mismo sólo para mostrar el resultado en
// vivo mientras el usuario edita, antes de guardar.

const HORA_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;

function aMinutos(hhmm: string): number | null {
  const m = HORA_RE.exec(hhmm.trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** Horas de un turno; si el fin es menor o igual al inicio cruza la medianoche (20:00→08:00 = 12). */
export function calcHorasPorAgente(inicio: string, fin: string): number | null {
  const i = aMinutos(inicio);
  const f = aMinutos(fin);
  if (i === null || f === null) return null;
  return Math.round((((f - i + 1440) % 1440) / 60) * 100) / 100;
}

/** Rubros donde tiene sentido un esquema de dotación. */
export function esRubroPersonal(nombre: string): boolean {
  return /seguridad|limpieza|personal|staff|vigilancia|sereno/i.test(nombre.normalize('NFD').replace(/[̀-ͯ]/g, ''));
}

/** "2026-04-28T00:00:00.000Z" → "2026-04-28" (calendario puro: sin pasar por Date/zona horaria). */
export const soloFecha = (iso: string | null | undefined): string => (iso ? iso.slice(0, 10) : '');

/** "2026-04-28" → "28/04/26" */
export function fmtFechaCorta(ymd: string): string {
  const [y, m, d] = ymd.split('-');
  return y && m && d ? `${d}/${m}/${y.slice(2)}` : ymd;
}

/** Hasta 2 decimales sin ceros de relleno: 12 → "12", 11.5 → "11,5". */
export const fmtHoras = (n: number | null | undefined): string =>
  n === null || n === undefined ? '—' : String(Math.round(n * 100) / 100).replace('.', ',');
