import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { Activo } from '@/types';

export const ACTIVOS_KEY = ['activos'] as const;

export function useActivos(params: { categoria?: string; estado?: string } = {}) {
  return useQuery({
    queryKey: [...ACTIVOS_KEY, params],
    queryFn:  async () => {
      const p = new URLSearchParams();
      if (params.categoria) p.set('categoria', params.categoria);
      if (params.estado)    p.set('estado',    params.estado);
      const { data } = await api.get<Activo[]>(`/activos?${p}`);
      return data;
    },
  });
}

export function useCreateActivo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Activo>) => api.post<Activo>('/activos', data).then(r => r.data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ACTIVOS_KEY }),
  });
}

export function useUpdateActivo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Activo> }) =>
      api.put<Activo>(`/activos/${id}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ACTIVOS_KEY }),
  });
}

export function useDeleteActivo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/activos/${id}`),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ACTIVOS_KEY }),
  });
}
