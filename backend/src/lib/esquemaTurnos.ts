// Esquema de personal por turno (seguridad, limpieza, etc.) — PedidoItem con
// fecha_turno. Cálculo de horas y normalización compartidos entre el controller,
// el importador y el exportador de la Ficha.

const HORA_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;

/** "8:00" → "08:00". null si el formato no es HH:mm válido. */
export function normalizarHora(s: string | null | undefined): string | null {
  if (!s) return null;
  const m = HORA_RE.exec(s.trim());
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : null;
}

export function horaAMinutos(s: string | null | undefined): number | null {
  const n = normalizarHora(s);
  if (!n) return null;
  return Number(n.slice(0, 2)) * 60 + Number(n.slice(3, 5));
}

/**
 * Horas de un turno. Si el fin es menor o igual al inicio, cruza la medianoche
 * (20:00→08:00 = 12 hs, 16:00→03:00 = 11 hs). null si falta alguna de las dos horas.
 */
export function calcHorasPorAgente(inicio: string | null | undefined, fin: string | null | undefined): number | null {
  const i = horaAMinutos(inicio);
  const f = horaAMinutos(fin);
  if (i === null || f === null) return null;
  const min = (f - i + 24 * 60) % (24 * 60);
  return Math.round((min / 60) * 100) / 100;
}

export interface TurnoDerivado {
  horas_por_agente:  number | null;
  total_horas_turno: number | null;
}

/**
 * Campos derivados del turno. Las horas salen de inicio/fin cuando están las dos;
 * si no, se respeta `horasManual` (turno cargado sólo con cantidad de horas).
 */
export function derivarTurno(p: {
  cantidad:     number | null;
  horaInicio:   string | null;
  horaFin:      string | null;
  horasManual?: number | null;
}): TurnoDerivado {
  const horas = calcHorasPorAgente(p.horaInicio, p.horaFin) ?? p.horasManual ?? null;
  const total = horas !== null && p.cantidad !== null ? Math.round(horas * p.cantidad * 100) / 100 : null;
  return { horas_por_agente: horas, total_horas_turno: total };
}

/** Texto de PedidoItem.descripcion (obligatorio) para un ítem de turno. */
export function descripcionTurno(tipo: string | null | undefined, ubicacion: string | null | undefined): string {
  return [tipo, ubicacion].map(s => s?.trim()).filter(Boolean).join(' — ') || 'Turno';
}

function sinAcentos(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** Rubros donde tiene sentido un esquema de dotación (seguridad, limpieza, etc.). */
export function esRubroPersonal(nombre: string): boolean {
  return /seguridad|limpieza|personal|staff|vigilancia|sereno/i.test(sinAcentos(nombre));
}

export function esRubroSeguridad(nombre: string): boolean {
  return /seguridad|vigilancia|sereno/i.test(sinAcentos(nombre));
}
