import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { TabConfig } from '@/types';

const TABS_KEY = ['configuracion', 'tabs'];

export function useTabConfig() {
  return useQuery<TabConfig[]>({
    queryKey: TABS_KEY,
    queryFn:  () => api.get('/configuracion/tabs').then(r => r.data),
    staleTime: 10 * 60 * 1000,
  });
}

export function useUpdateTab() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, nombre }: { id: number; nombre: string }) =>
      api.put(`/configuracion/tabs/${id}`, { nombre }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: TABS_KEY }),
  });
}
