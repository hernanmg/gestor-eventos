// Mirror liviano de backend/src/lib/calcularSueldoAdmin.ts — sólo para el
// preview en tiempo real del wizard de "Nuevo acuerdo" (antes de que el
// acuerdo exista en el servidor, no hay id para pedirle el preview real).
// El cálculo autoritativo siempre es el que devuelve el backend al guardar.

const TABLA_ANTIGUEDAD = [
  { anios: 1, monto: 14637.5 },
  { anios: 2, monto: 23420 },
  { anios: 3, monto: 32202.5 },
  { anios: 4, monto: 40985 },
  { anios: 5, monto: 49767.5 },
  { anios: 6, monto: 74651.25 },
  { anios: 7, monto: 149302.5 },
  { anios: 8, monto: 234200 },
] as const;

function diferenciaEnAnios(desde: Date, hasta: Date): number {
  let anios = hasta.getUTCFullYear() - desde.getUTCFullYear();
  const aunNoLlegoAlAniversario =
    hasta.getUTCMonth() < desde.getUTCMonth() ||
    (hasta.getUTCMonth() === desde.getUTCMonth() && hasta.getUTCDate() < desde.getUTCDate());
  if (aunNoLlegoAlAniversario) anios--;
  return Math.max(0, anios);
}

export function calcularAntiguedadPreview(fechaInicio: string | null): { anios: number; monto: number } {
  if (!fechaInicio) return { anios: 0, monto: 0 };
  const desde   = new Date(fechaInicio);
  if (isNaN(desde.getTime())) return { anios: 0, monto: 0 };
  const anios   = diferenciaEnAnios(desde, new Date());
  const entrada = [...TABLA_ANTIGUEDAD].reverse().find(t => t.anios <= anios);
  return { anios, monto: entrada?.monto ?? 0 };
}

export interface PreviewSueldoBasico {
  antiguedad_anios:   number;
  importe_antiguedad: number;
  subtotal_bruto:     number;
}

// Preview sin horas extras — a las horas acordadas exactas (mismo criterio
// que GET /rrhh/acuerdos/:empleadoId en el backend).
export function previewSueldoBasico(form: {
  fecha_inicio:       string;
  sueldo_basico:      string;
  premio_incentivo:   string;
  viatico:            string;
  premio_presentismo: string;
  telefono:           string;
}): PreviewSueldoBasico {
  const antiguedad = calcularAntiguedadPreview(form.fecha_inicio || null);
  const num = (v: string) => (v ? parseFloat(v) || 0 : 0);
  const subtotal =
    num(form.sueldo_basico)
    + num(form.premio_incentivo)
    + num(form.viatico)
    + num(form.premio_presentismo)
    + antiguedad.monto
    + num(form.telefono);

  return {
    antiguedad_anios:   antiguedad.anios,
    importe_antiguedad: antiguedad.monto,
    subtotal_bruto:     Math.round(subtotal * 100) / 100,
  };
}
