import type { FaseEvento } from '@prisma/client';

// Fases operativas de un evento, como las columnas de la hoja STAFF COSTS de la
// matriz de DOS57 (VIAJE · MONTAJE · GUARDIA · DESMONTAJE · ENTREGA Y VIAJE).
// Se calculan con las fechas del evento: montaje = los dias_montaje previos a
// fecha_inicio, evento = fecha_inicio..fecha_fin, desmontaje = los
// dias_desmontaje posteriores; lo que queda antes o después es viaje.
// Todas las fechas son calendario (medianoche UTC, ver fecha_offset_utc_fix).

export const FASES: { fase: FaseEvento; label: string }[] = [
  { fase: 'VIAJE_IDA',    label: 'Viaje' },
  { fase: 'MONTAJE',      label: 'Montaje' },
  { fase: 'EVENTO',       label: 'Evento / guardia' },
  { fase: 'DESMONTAJE',   label: 'Desmontaje' },
  { fase: 'VIAJE_VUELTA', label: 'Entrega y regreso' },
];

const DIA = 86_400_000;
const dia = (d: Date) => Math.floor(d.getTime() / DIA);
const fecha = (n: number) => new Date(n * DIA);

export interface EventoFechas {
  fecha_inicio:    Date | null;
  fecha_fin:       Date | null;
  dias_montaje:    number;
  dias_desmontaje: number;
}

export interface RangoFase { fase: FaseEvento; label: string; desde: Date | null; hasta: Date | null; dias: number | null }

// null si el evento no tiene fecha de inicio (no hay fases)
export function limitesEvento(e: EventoFechas) {
  if (!e.fecha_inicio) return null;
  const inicio = dia(e.fecha_inicio);
  const fin = Math.max(inicio, e.fecha_fin ? dia(e.fecha_fin) : inicio);
  return { montaje: inicio - e.dias_montaje, inicio, fin, desmontaje: fin + e.dias_desmontaje };
}

export function faseDeFecha(e: EventoFechas, f: Date): FaseEvento | null {
  const l = limitesEvento(e);
  if (!l) return null;
  const d = dia(f);
  if (d < l.montaje) return 'VIAJE_IDA';
  if (d < l.inicio) return 'MONTAJE';
  if (d <= l.fin) return 'EVENTO';
  if (d <= l.desmontaje) return 'DESMONTAJE';
  return 'VIAJE_VUELTA';
}

// Rangos de las tres fases fijas; los viajes quedan abiertos (desde/hasta null
// del lado de afuera) y su "primer día" es el anterior al montaje / posterior al desmontaje.
export function rangosFases(e: EventoFechas): RangoFase[] {
  const l = limitesEvento(e);
  return FASES.map(({ fase, label }) => {
    if (!l) return { fase, label, desde: null, hasta: null, dias: null };
    switch (fase) {
      case 'VIAJE_IDA':    return { fase, label, desde: null, hasta: fecha(l.montaje - 1), dias: null };
      case 'MONTAJE':      return { fase, label, desde: e.dias_montaje ? fecha(l.montaje) : null, hasta: e.dias_montaje ? fecha(l.inicio - 1) : null, dias: e.dias_montaje };
      case 'EVENTO':       return { fase, label, desde: fecha(l.inicio), hasta: fecha(l.fin), dias: l.fin - l.inicio + 1 };
      case 'DESMONTAJE':   return { fase, label, desde: e.dias_desmontaje ? fecha(l.fin + 1) : null, hasta: e.dias_desmontaje ? fecha(l.desmontaje) : null, dias: e.dias_desmontaje };
      case 'VIAJE_VUELTA': return { fase, label, desde: fecha(l.desmontaje + 1), hasta: null, dias: null };
    }
  });
}

// Fecha sugerida para una tarea de cierta fase: el primer día de la fase (los
// viajes, el día pegado al montaje / al desmontaje).
export function fechaDeFase(e: EventoFechas, fase: FaseEvento): Date | null {
  const l = limitesEvento(e);
  if (!l) return null;
  switch (fase) {
    case 'VIAJE_IDA':    return fecha(l.montaje - 1);
    case 'MONTAJE':      return fecha(l.montaje);
    case 'EVENTO':       return fecha(l.inicio);
    case 'DESMONTAJE':   return fecha(l.fin + 1);
    case 'VIAJE_VUELTA': return fecha(l.desmontaje + 1);
  }
}

// Tareas tipo cuando el rubro no tiene plantilla propia. Pendiente de confirmar
// con DOS57 (Jazmín): se editan por rubro desde la pestaña Operación.
export const PLANTILLA_DEFAULT: { actividad: string; fase: FaseEvento }[] = [
  { actividad: 'Carga de camiones en depósito',          fase: 'VIAJE_IDA' },
  { actividad: 'Traslado al predio',                     fase: 'VIAJE_IDA' },
  { actividad: 'Descarga y montaje',                     fase: 'MONTAJE' },
  { actividad: 'Guardia técnica',                        fase: 'EVENTO' },
  { actividad: 'Desmontaje y carga',                     fase: 'DESMONTAJE' },
  { actividad: 'Retorno al depósito y control de material', fase: 'VIAJE_VUELTA' },
];

// Nombre de cada categoría de empleado en plural, para agrupar la cuadrilla
export const NOMBRE_CATEGORIA: Record<string, string> = {
  CAPITAN: 'Capitanes', ARMADOR: 'Armadores', CHOFER: 'Choferes', ADMINISTRATIVO: 'Administrativos',
  TECNICO: 'Técnicos', JORNALERO: 'Jornaleros', FOFI: 'Fofis', NESTORAS: 'Nestoras',
  EXTRANJERO: 'Extranjeros', SERENO: 'Serenos', OTRO: 'Otros',
};
