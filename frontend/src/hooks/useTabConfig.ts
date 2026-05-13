import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { TabConfig, Tipo } from '@/types';

const TABS_KEY     = ['configuracion', 'tabs'];
const ALL_TABS_KEY = ['configuracion', 'tabs', 'all'];

const invalidateBoth = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: TABS_KEY });
  qc.invalidateQueries({ queryKey: ALL_TABS_KEY });
};

export function useTabConfig() {
  return useQuery<TabConfig[]>({
    queryKey:  TABS_KEY,
    queryFn:   () => api.get('/configuracion/tabs').then(r => r.data),
    staleTime: 10 * 60 * 1000,
  });
}

export function useAllTabs() {
  return useQuery<TabConfig[]>({
    queryKey:  ALL_TABS_KEY,
    queryFn:   () => api.get('/configuracion/tabs?incluir_inactivas=true').then(r => r.data),
    staleTime: 0,
  });
}

export function useUpdateTab() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, nombre }: { id: number; nombre: string }) =>
      api.put(`/configuracion/tabs/${id}`, { nombre }).then(r => r.data),
    onSuccess: () => invalidateBoth(qc),
  });
}

export function useCreateTab() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tipo, nombre }: { tipo: Tipo; nombre: string }) =>
      api.post('/configuracion/tabs', { tipo, nombre }).then(r => r.data),
    onSuccess: () => invalidateBoth(qc),
  });
}

export function useDeleteTab() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/configuracion/tabs/${id}`).then(r => r.data),
    onSuccess: () => invalidateBoth(qc),
  });
}

export function useReorderTabs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tipo, orden }: { tipo: Tipo; orden: Array<{ id: number; orden: number }> }) =>
      api.patch('/configuracion/tabs/reordenar', { tipo, orden }).then(r => r.data),
    onSuccess: () => invalidateBoth(qc),
  });
}

export function useToggleTab() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.patch(`/configuracion/tabs/${id}`).then(r => r.data),
    onSuccess: () => invalidateBoth(qc),
  });
}
