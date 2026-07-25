import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { Rubro, Tipo } from '@/types';

const RUBROS_KEY     = ['rubros'];
const ALL_RUBROS_KEY = ['rubros', 'all'];

const invalidateBoth = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: RUBROS_KEY });
  qc.invalidateQueries({ queryKey: ALL_RUBROS_KEY });
};

export function useRubros(tipo?: Tipo) {
  return useQuery<Rubro[]>({
    queryKey:  [...RUBROS_KEY, tipo ?? 'ALL'],
    queryFn:   () => api.get('/rubros', { params: tipo ? { tipo } : undefined }).then(r => r.data),
    staleTime: 10 * 60 * 1000,
  });
}

export function useAllRubros() {
  return useQuery<Rubro[]>({
    queryKey:  ALL_RUBROS_KEY,
    queryFn:   () => api.get('/rubros', { params: { incluir_inactivos: true } }).then(r => r.data),
    staleTime: 0,
  });
}

export function useCreateRubro() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { tipo: Tipo; nombre: string; descripcion?: string | null }) =>
      api.post('/rubros', data).then(r => r.data),
    onSuccess: () => invalidateBoth(qc),
  });
}

export function useUpdateRubro() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: { nombre?: string; descripcion?: string | null; orden?: number } }) =>
      api.put(`/rubros/${id}`, data).then(r => r.data),
    onSuccess: () => invalidateBoth(qc),
  });
}

export function useDeleteRubro() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/rubros/${id}`).then(r => r.data),
    onSuccess:  () => invalidateBoth(qc),
  });
}

export function useReorderRubros() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tipo, orden }: { tipo: Tipo; orden: Array<{ id: number; orden: number }> }) =>
      api.patch('/rubros/reordenar', { tipo, orden }).then(r => r.data),
    onSuccess: () => invalidateBoth(qc),
  });
}

export function useToggleRubro() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.patch(`/rubros/${id}`).then(r => r.data),
    onSuccess: () => invalidateBoth(qc),
  });
}
