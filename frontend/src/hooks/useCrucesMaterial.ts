import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { CruceMaterial, CruceMaterialInput, HojaPlanillaCruce } from '@/types';

// Cruce de material con terceros — /api/stock/cruces
const KEY = ['stock', 'cruces'] as const;

function useInvalidar() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['stock'] });
    qc.invalidateQueries({ queryKey: ['calendario'] });
  };
}

export function useCrucesMaterial() {
  return useQuery({
    queryKey: KEY,
    queryFn:  () => api.get<{ cruces: CruceMaterial[]; terceros: string[] }>('/stock/cruces').then(r => r.data),
  });
}

export function useGuardarCruce() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: ({ id, data }: { id?: number; data: CruceMaterialInput }) =>
      (id ? api.put<CruceMaterial>(`/stock/cruces/${id}`, data) : api.post<CruceMaterial>('/stock/cruces', data)).then(r => r.data),
    onSuccess: invalidar,
  });
}

export function useDevolverCruce() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: ({ id, fecha, items }: { id: number; fecha: string; items: { item_id: number; cantidad: number }[] }) =>
      api.post<CruceMaterial>(`/stock/cruces/${id}/devolucion`, { fecha, items }).then(r => r.data),
    onSuccess: invalidar,
  });
}

export function useAnularCruce() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (id: number) => api.post(`/stock/cruces/${id}/anular`).then(r => r.data),
    onSuccess: invalidar,
  });
}

export function useLeerPlanillaCruce() {
  return useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      return api.post<{ archivo: string; hojas: HojaPlanillaCruce[] }>('/stock/cruces/leer-planilla', fd).then(r => r.data);
    },
  });
}
