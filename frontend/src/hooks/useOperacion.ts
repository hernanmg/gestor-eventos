import { useCallback, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { produccionKey } from './useProduccion';
import type { EstadoTarea, FaseEvento, Operacion, PlantillaTareas, TareaEvento } from '@/types';

// Pestaña Operación (DOS57): cuadrilla por fase y tareas por rubro. Ver backend
// controllers/operacion.controller.ts.

export const operacionKey = (eventoId: number) => ['operacion', eventoId] as const;

export function useOperacion(eventoId: number) {
  return useQuery<Operacion>({
    queryKey: operacionKey(eventoId),
    queryFn:  () => api.get(`/eventos/${eventoId}/operacion`).then(r => r.data),
  });
}

export interface TareaPayload {
  rubro_evento_id?: number | null;
  actividad?:       string;
  fecha?:           string;
  hora?:            string | null;
  responsable?:     string | null;
  observaciones?:   string | null;
  fase?:            FaseEvento | null;
  estado?:          EstadoTarea;
}

// Las tareas son filas del cronograma: también refrescan la pestaña Producción
function invalidar(qc: ReturnType<typeof useQueryClient>, eventoId: number) {
  qc.invalidateQueries({ queryKey: operacionKey(eventoId) });
  qc.invalidateQueries({ queryKey: produccionKey(eventoId) });
}

export function useCreateTarea(eventoId: number) {
  const qc = useQueryClient();
  return useMutation<TareaEvento, Error, TareaPayload & { actividad: string }>({
    mutationFn: data => api.post(`/eventos/${eventoId}/operacion/tareas`, data).then(r => r.data),
    onSuccess:  () => invalidar(qc, eventoId),
  });
}

export function useUpdateTarea(eventoId: number) {
  const qc = useQueryClient();
  return useMutation<TareaEvento, Error, { id: number; data: TareaPayload }>({
    mutationFn: ({ id, data }) => api.put(`/operacion/tareas/${id}`, data).then(r => r.data),
    onSuccess:  () => invalidar(qc, eventoId),
  });
}

export function useDeleteTarea(eventoId: number) {
  const qc = useQueryClient();
  return useMutation<unknown, Error, number>({
    mutationFn: id => api.delete(`/operacion/tareas/${id}`).then(r => r.data),
    onSuccess:  () => invalidar(qc, eventoId),
  });
}

export function useCargarTareasTipo(eventoId: number) {
  const qc = useQueryClient();
  return useMutation<{ creadas: number; ya_estaban: number }, Error, number>({
    mutationFn: rubroEventoId => api.post(`/operacion/rubros-evento/${rubroEventoId}/cargar-tareas`).then(r => r.data),
    onSuccess:  () => invalidar(qc, eventoId),
  });
}

export function usePlantillaTareas(rubroId: number | null) {
  return useQuery<PlantillaTareas>({
    queryKey: ['plantilla-tareas', rubroId],
    queryFn:  () => api.get(`/operacion/rubros/${rubroId}/plantilla-tareas`).then(r => r.data),
    enabled:  rubroId !== null,
  });
}

export function useGuardarPlantillaTareas() {
  const qc = useQueryClient();
  return useMutation<PlantillaTareas, Error, { rubroId: number; tareas: { actividad: string; fase: FaseEvento }[] }>({
    mutationFn: ({ rubroId, tareas }) => api.put(`/operacion/rubros/${rubroId}/plantilla-tareas`, { tareas }).then(r => r.data),
    onSuccess:  (_r, v) => qc.invalidateQueries({ queryKey: ['plantilla-tareas', v.rubroId] }),
  });
}

export function useExportarCuadrilla() {
  const [exportando, setExportando] = useState(false);
  const exportar = useCallback(async (eventoId: number) => {
    setExportando(true);
    try {
      const response = await api.get(`/eventos/${eventoId}/operacion/cuadrilla-excel`, { responseType: 'blob' });
      const cd       = (response.headers['content-disposition'] as string | undefined) ?? '';
      const filename = decodeURIComponent(cd.match(/filename="([^"]+)"/)?.[1] ?? `cuadrilla-evento-${eventoId}.xlsx`);
      const href     = URL.createObjectURL(new Blob([response.data as BlobPart]));
      const a        = document.createElement('a');
      a.href = href;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(href);
    } finally {
      setExportando(false);
    }
  }, []);
  return { exportar, exportando };
}
