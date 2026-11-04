import type { EstadoTarea, FaseEvento } from '@/types';

export const ESTADO_TAREA: Record<EstadoTarea, { label: string; cls: string }> = {
  PENDIENTE: { label: 'Pendiente', cls: 'bg-gray-100 text-gray-700' },
  EN_CURSO:  { label: 'En curso',  cls: 'bg-amber-100 text-amber-800' },
  HECHA:     { label: 'Hecha',     cls: 'bg-green-100 text-green-800' },
};

// Clic en el estado de una tarea: avanza al siguiente
export const SIGUIENTE_ESTADO: Record<EstadoTarea, EstadoTarea> = {
  PENDIENTE: 'EN_CURSO', EN_CURSO: 'HECHA', HECHA: 'PENDIENTE',
};

export const FASE_CORTA: Record<FaseEvento, string> = {
  VIAJE_IDA: 'Viaje', MONTAJE: 'Montaje', EVENTO: 'Evento', DESMONTAJE: 'Desmontaje', VIAJE_VUELTA: 'Regreso',
};
