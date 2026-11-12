import type { EstadoAsistencia, SemaforoPresentismo } from '@prisma/client';

// ── Reglas del Control de Presentismo (Lorena, DOS57) ────────────────────────
// Compartidas por el controller, el exportador y el importador de la planilla
// mensual ("SEPTIEMBRE_Registro de Faltas.xlsx").

// Clasificación de la llegada contra la hora de citación del día. En la
// planilla real: hasta 6 min es SI (9:03, 8:06), de 7 a 15 es DEMORA (8:07,
// 9:12, 9:15) y desde 16 es LLEGADA TARDE (9:19) — Lorena: "hasta 15 minutos
// es demora, 16-18 ya llega tarde".
export const TOLERANCIA_PRESENTE_MIN = 6;
export const LIMITE_DEMORA_MIN       = 15;

// Semáforo del informe mensual (bloque REFERENCIAS de la hoja "Informe"):
//              Demoras   Llegadas tarde   Faltas
// Excelente    0 a 2     0 a 1            0
// Seguimiento  3 a 4     2 a 3            1
// Atención     5 o más   4 o más          2 o más
// El nivel del empleado es el peor de los tres.
const UMBRALES_SEMAFORO = {
  demoras: { seguimiento: 3, atencion: 5 },
  tardes:  { seguimiento: 2, atencion: 4 },
  faltas:  { seguimiento: 1, atencion: 2 },
} as const;

// Criterio de corte para perder el premio presentismo — placeholder simple
// (0 ausencias en el mes). Queda pendiente confirmar el umbral real con
// Lorena/Mayra.
export const UMBRAL_AUSENCIAS_PRESENTISMO = 0;

export const ESTADOS_ASISTENCIA = [
  'PRESENTE', 'DEMORA', 'TARDE', 'MEDIA_JORNADA', 'AUSENTE', 'JUSTIFICADO', 'LIBRE', 'VACACIONES', 'LICENCIA', 'FRANCO',
] as const satisfies readonly EstadoAsistencia[];

// Estados que, por defecto (si no se manda descuenta_presentismo explícito),
// impactan el premio del mes. AUSENTE siempre lo pierde; TARDE queda pendiente
// de la decisión de Matías (ver flujo de aprobación) y arranca contando en
// contra hasta que se apruebe. DEMORA no descuenta: va al semáforo.
export const DESCUENTA_POR_DEFECTO: Record<EstadoAsistencia, boolean> = {
  PRESENTE: false, DEMORA: false, MEDIA_JORNADA: false, JUSTIFICADO: false, LIBRE: false,
  VACACIONES: false, LICENCIA: false, FRANCO: false,
  AUSENTE: true, TARDE: true,
};

// Estados en los que la persona vino a trabajar — un domingo con alguno de
// estos genera un franco compensatorio.
const ESTADOS_TRABAJADO: EstadoAsistencia[] = ['PRESENTE', 'DEMORA', 'TARDE', 'MEDIA_JORNADA'];

export function minutosDesdeMedianoche(hhmm: string): number | null {
  const match = hhmm.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

export function calcularHorasTrabajadas(ingreso?: string | null, egreso?: string | null): number | null {
  if (!ingreso || !egreso) return null;
  const mIn  = minutosDesdeMedianoche(ingreso);
  const mOut = minutosDesdeMedianoche(egreso);
  if (mIn === null || mOut === null || mOut <= mIn) return null;
  return Math.round(((mOut - mIn) / 60) * 100) / 100;
}

export function calcularMinutosTardanza(convocatoria?: string | null, ingreso?: string | null): number | null {
  if (!convocatoria || !ingreso) return null;
  const mConv = minutosDesdeMedianoche(convocatoria);
  const mIn   = minutosDesdeMedianoche(ingreso);
  if (mConv === null || mIn === null) return null;
  return Math.max(0, mIn - mConv);
}

// PRESENTE / DEMORA / TARDE según los minutos de diferencia con la citación.
// null si no hay datos para calcularlo.
export function clasificarLlegada(convocatoria?: string | null, ingreso?: string | null): 'PRESENTE' | 'DEMORA' | 'TARDE' | null {
  const min = calcularMinutosTardanza(convocatoria, ingreso);
  if (min === null) return null;
  if (min <= TOLERANCIA_PRESENTE_MIN) return 'PRESENTE';
  if (min <= LIMITE_DEMORA_MIN) return 'DEMORA';
  return 'TARDE';
}

export function calcularSemaforo(demoras: number, tardes: number, faltas: number): SemaforoPresentismo {
  const nivel = (valor: number, u: { seguimiento: number; atencion: number }) =>
    valor >= u.atencion ? 2 : valor >= u.seguimiento ? 1 : 0;
  const peor = Math.max(
    nivel(demoras, UMBRALES_SEMAFORO.demoras),
    nivel(tardes,  UMBRALES_SEMAFORO.tardes),
    nivel(faltas,  UMBRALES_SEMAFORO.faltas),
  );
  return peor === 2 ? 'ATENCION' : peor === 1 ? 'SEGUIMIENTO' : 'EXCELENTE';
}

export function esDomingo(fecha: Date): boolean {
  return fecha.getUTCDay() === 0;
}

export function esDomingoTrabajado(r: { estado: string; fecha: Date }): boolean {
  return esDomingo(r.fecha) && ESTADOS_TRABAJADO.includes(r.estado as EstadoAsistencia);
}

export interface ConteoResumen {
  dias_presente: number; dias_demora: number; dias_tarde: number; dias_media_jornada: number; dias_ausente: number;
  dias_justificado: number; dias_libre: number; dias_vacaciones: number; dias_franco: number; francos_ganados: number;
  total_horas: number; total_tardanzas_min: number;
  semaforo: SemaforoPresentismo;
  cobra_presentismo: boolean; motivo_sin_presentismo: string | null;
}

export function calcularConteo(registros: { estado: string; horas_trabajadas: any; minutos_tardanza: number | null; descuenta_presentismo: boolean; fecha: Date }[]): ConteoResumen {
  const c: ConteoResumen = {
    dias_presente: 0, dias_demora: 0, dias_tarde: 0, dias_media_jornada: 0, dias_ausente: 0,
    dias_justificado: 0, dias_libre: 0, dias_vacaciones: 0, dias_franco: 0, francos_ganados: 0,
    total_horas: 0, total_tardanzas_min: 0, semaforo: 'EXCELENTE', cobra_presentismo: true, motivo_sin_presentismo: null,
  };
  const descuentos: string[] = [];
  for (const r of registros) {
    if (r.estado === 'PRESENTE')       c.dias_presente++;
    if (r.estado === 'DEMORA')         c.dias_demora++;
    if (r.estado === 'TARDE')          c.dias_tarde++;
    if (r.estado === 'MEDIA_JORNADA')  c.dias_media_jornada++;
    if (r.estado === 'AUSENTE')        c.dias_ausente++;
    if (r.estado === 'JUSTIFICADO')    c.dias_justificado++;
    if (r.estado === 'LIBRE')          c.dias_libre++;
    if (r.estado === 'VACACIONES' || r.estado === 'LICENCIA') c.dias_vacaciones++;
    if (r.estado === 'FRANCO')         c.dias_franco++;
    if (esDomingoTrabajado(r))         c.francos_ganados++;
    if (r.horas_trabajadas != null)    c.total_horas += Number(r.horas_trabajadas);
    if (r.minutos_tardanza != null)    c.total_tardanzas_min += r.minutos_tardanza;
    if (r.descuenta_presentismo) descuentos.push(`${r.estado} el ${r.fecha.toISOString().slice(0, 10)}`);
  }
  c.total_horas = Math.round(c.total_horas * 100) / 100;
  c.semaforo = calcularSemaforo(c.dias_demora, c.dias_tarde, c.dias_ausente);

  if (c.dias_ausente > UMBRAL_AUSENCIAS_PRESENTISMO) {
    c.cobra_presentismo = false;
    c.motivo_sin_presentismo = `${c.dias_ausente} día${c.dias_ausente !== 1 ? 's' : ''} ausente`;
  } else if (descuentos.length > 0) {
    c.cobra_presentismo = false;
    c.motivo_sin_presentismo = descuentos.join(', ');
  }
  return c;
}
