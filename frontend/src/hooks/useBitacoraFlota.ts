import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { ViajeFlota, OpcionesBitacoraFlota, ImportarBitacoraFlotaResultado, LogisticaEvento } from '@/types';

const KEY = ['bitacora-flota'] as const;

export interface BitacoraFlotaFiltros {
  evento_id?: number; // Evento real vinculado
  evento?: string;    // texto libre de la planilla (sólo viajes sin evento real)
  camion?: string; // patente o alias (C1…)
  chofer?: string; // id de empleado o nombre de la planilla
  desde?:  string;
  hasta?:  string;
}

export function useBitacoraFlota(filtros: BitacoraFlotaFiltros = {}) {
  return useQuery({
    queryKey: [...KEY, 'viajes', filtros],
    queryFn:  () => api.get<ViajeFlota[]>('/flota/bitacora-viajes', { params: filtros }).then(r => r.data),
  });
}

export function useOpcionesBitacoraFlota() {
  return useQuery({
    queryKey: [...KEY, 'opciones'],
    queryFn:  () => api.get<OpcionesBitacoraFlota>('/flota/bitacora-viajes/opciones').then(r => r.data),
  });
}

// Alta/edición manual (ADMIN). Todos los campos opcionales salvo el tramo;
// null borra el valor en una edición.
export interface ViajeFlotaPayload {
  fecha?:                string | null; // YYYY-MM-DD
  convocatoria?:         string | null;
  evento_id?:            number | null;
  recorrido:             string;
  camion_id?:            number | null;
  patente_camion?:       string | null;
  alias_camion?:         string | null;
  empleado_id?:          number | null;
  chofer_nombre?:        string | null;
  km_iniciales?:         number | null;
  km_finales?:           number | null;
  km_recorridos?:        number | null;
  litros_cargados_ruta?: number | null;
  litros_consumidos?:    number | null;
  km_por_litro?:         number | null;
  litros_iniciales_tanque?: number | null;
  monto_combustible?:    number | null;
  monto_caja_entregada?: number | null;
  horario_salida?:       string | null; // ISO con offset
  horario_llegada?:      string | null;
  observaciones?:        string | null;
}

export function useGuardarViajeFlota() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id?: number; data: ViajeFlotaPayload }) =>
      (id
        ? api.put<ViajeFlota>(`/flota/bitacora-viajes/${id}`, data)
        : api.post<ViajeFlota>('/flota/bitacora-viajes', data)
      ).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ['evento-logistica'] });
    },
  });
}

export function useEliminarViajeFlota() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/flota/bitacora-viajes/${id}`).then(r => r.data),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ['evento-logistica'] });
    },
  });
}

export function useImportarBitacoraFlota() {
  const qc = useQueryClient();
  return useMutation({
    // vinculos: {"nombre del evento en la planilla": evento_id} — sólo los
    // grupos cuya sugerencia de vinculación confirmó el usuario
    mutationFn: ({ file, preview, vinculos }: { file: File; preview: boolean; vinculos?: Record<string, number> }) => {
      const fd = new FormData();
      fd.append('archivo', file);
      if (vinculos && Object.keys(vinculos).length) fd.append('vinculos', JSON.stringify(vinculos));
      return api.post<ImportarBitacoraFlotaResultado>(
        `/importar/bitacora-viajes?preview=${preview}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } },
      ).then(r => r.data);
    },
    onSuccess: (data) => {
      if (data.preview) return;
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ['evento-logistica'] });
    },
  });
}

// Tab Logística del evento: viajes de la bitácora + cargas de combustible vinculadas
export function useLogisticaEvento(eventoId: number) {
  return useQuery({
    queryKey: ['evento-logistica', eventoId],
    queryFn:  () => api.get<LogisticaEvento>(`/eventos/${eventoId}/logistica`).then(r => r.data),
    enabled:  eventoId > 0,
  });
}
