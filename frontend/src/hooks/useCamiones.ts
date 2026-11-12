import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { Camion } from '@/types';

export const CAMIONES_KEY = ['stock', 'camiones'] as const;

export function useCamiones() {
  return useQuery({
    queryKey: CAMIONES_KEY,
    queryFn:  () => api.get<Camion[]>('/stock/camiones').then(r => r.data),
  });
}

export function useCreateCamion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { codigo: string; descripcion?: string | null; patente?: string | null; tipo?: string | null }) =>
      api.post<Camion>('/stock/camiones', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: CAMIONES_KEY }),
  });
}

export function useUpdateCamion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Camion> }) =>
      api.put<Camion>(`/stock/camiones/${id}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: CAMIONES_KEY }),
  });
}

export function useDeleteCamion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/stock/camiones/${id}`),
    onSuccess:  () => qc.invalidateQueries({ queryKey: CAMIONES_KEY }),
  });
}
