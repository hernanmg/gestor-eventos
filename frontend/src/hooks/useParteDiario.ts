import { useCallback, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type {
  ParteDiario, ParteDiarioResumen, AsignacionDiaria, EstadoAsignacionDiaria, CerrarParteResultado,
} from '@/types';

const PARTES_KEY = ['parte-diario'] as const;
export const parteKey = (fecha: string) => [...PARTES_KEY, fecha];

// ── Parte ──────────────────────────────────────────────────────────────────────

export interface ListaPartesFiltros {
  desde?:   string;
  hasta?:   string;
  cerrado?: boolean;
}

export function useListaPartes(filtros: ListaPartesFiltros = {}) {
  return useQuery<ParteDiarioResumen[]>({
    queryKey: [...PARTES_KEY, 'lista', filtros],
    queryFn:  () => api.get('/parte-diario', { params: filtros }).then(r => r.data),
  });
}

// GET /parte-diario/:fecha — 404 si no existe (no crea automáticamente)
export function useParteDiario(fecha: string) {
  return useQuery<ParteDiario | null>({
    queryKey: parteKey(fecha),
    queryFn:  () => api.get(`/parte-diario/${fecha}`).then(r => r.data).catch(err => {
      if (err?.response?.status === 404) return null;
      throw err;
    }),
    enabled: !!fecha,
  });
}

export function useCrearParte() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { fecha: string; titulo?: string | null; notas?: string | null }) =>
      api.post<ParteDiario>('/parte-diario', data).then(r => r.data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: parteKey(data.fecha.slice(0, 10)) });
      qc.invalidateQueries({ queryKey: [...PARTES_KEY, 'lista'] });
    },
  });
}

export function useUpdateParte(fecha: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: { titulo?: string | null; notas?: string | null } }) =>
      api.put<ParteDiario>(`/parte-diario/${id}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: parteKey(fecha) }),
  });
}

export function useCerrarParte(fecha: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.patch<CerrarParteResultado>(`/parte-diario/${id}/cerrar`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: parteKey(fecha) });
      qc.invalidateQueries({ queryKey: [...PARTES_KEY, 'lista'] });
    },
  });
}

export function useExportarParte() {
  const [isExporting, setIsExporting] = useState(false);

  const exportar = useCallback(async (parteId: number) => {
    setIsExporting(true);
    try {
      const response = await api.get(`/parte-diario/${parteId}/exportar`, { responseType: 'blob' });
      const cd       = (response.headers['content-disposition'] as string | undefined) ?? '';
      const filename = decodeURIComponent(cd.match(/filename="([^"]+)"/)?.[1] ?? `parte-diario-${parteId}.xlsx`);
      const url      = URL.createObjectURL(new Blob([response.data as BlobPart]));
      const a        = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  }, []);

  return { exportar, isExporting };
}

// ── Asignaciones ───────────────────────────────────────────────────────────────

export interface AsignacionDiariaPayload {
  empleado_id?:      number;
  estado?:           EstadoAsignacionDiaria;
  hora_ingreso?:     string | null;
  lugar?:            string | null;
  tarea?:            string | null;
  seccion?:          string | null;
  camion_id?:        number | null;
  vehiculo_texto?:   string | null;
  evento_id?:        number | null;
  hora_salida?:      string | null;
  hora_salida_fija?: boolean;
  orden?:            number;
}

export function useAddAsignacion(fecha: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ parteId, data }: { parteId: number; data: AsignacionDiariaPayload }) =>
      api.post<AsignacionDiaria>(`/parte-diario/${parteId}/asignaciones`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: parteKey(fecha) }),
  });
}

export function useUpdateAsignacion(fecha: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ parteId, id, data }: { parteId: number; id: number; data: Partial<AsignacionDiariaPayload> }) =>
      api.put<AsignacionDiaria>(`/parte-diario/${parteId}/asignaciones/${id}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: parteKey(fecha) }),
  });
}

export function useDeleteAsignacion(fecha: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ parteId, id }: { parteId: number; id: number }) =>
      api.delete(`/parte-diario/${parteId}/asignaciones/${id}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: parteKey(fecha) }),
  });
}
