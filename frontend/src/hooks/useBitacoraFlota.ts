import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { ViajeFlota, OpcionesBitacoraFlota, ImportarBitacoraFlotaResultado } from '@/types';

const KEY = ['bitacora-flota'] as const;

export interface BitacoraFlotaFiltros {
  evento?: string;
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
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useEliminarViajeFlota() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/flota/bitacora-viajes/${id}`).then(r => r.data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useImportarBitacoraFlota() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ file, preview }: { file: File; preview: boolean }) => {
      const fd = new FormData();
      fd.append('archivo', file);
      return api.post<ImportarBitacoraFlotaResultado>(
        `/importar/bitacora-viajes?preview=${preview}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } },
      ).then(r => r.data);
    },
    onSuccess: (data) => {
      if (data.preview) return;
      qc.invalidateQueries({ queryKey: KEY });
    },
  });
}
