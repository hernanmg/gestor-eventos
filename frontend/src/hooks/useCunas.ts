import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { Cuna, CunaProducto } from '@/types';

export const CUNAS_KEY = ['stock', 'cunas'] as const;

export function useCunas() {
  return useQuery({
    queryKey: CUNAS_KEY,
    queryFn:  () => api.get<Cuna[]>('/stock/cunas').then(r => r.data),
  });
}

export function useCuna(id: number | null) {
  return useQuery({
    queryKey: [...CUNAS_KEY, id],
    queryFn:  () => api.get<Cuna>(`/stock/cunas/${id}`).then(r => r.data),
    enabled:  !!id,
  });
}

export function useCreateCuna() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { codigo: string; descripcion?: string | null }) =>
      api.post<Cuna>('/stock/cunas', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: CUNAS_KEY }),
  });
}

export function useUpdateCuna() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Cuna> }) =>
      api.put<Cuna>(`/stock/cunas/${id}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: CUNAS_KEY }),
  });
}

export function useDeleteCuna() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/stock/cunas/${id}`),
    onSuccess:  () => qc.invalidateQueries({ queryKey: CUNAS_KEY }),
  });
}

export function useAddProductoCuna() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ cunaId, producto_id, cantidad }: { cunaId: number; producto_id: number; cantidad: number }) =>
      api.post<CunaProducto>(`/stock/cunas/${cunaId}/productos`, { producto_id, cantidad }).then(r => r.data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: CUNAS_KEY });
      qc.invalidateQueries({ queryKey: [...CUNAS_KEY, vars.cunaId] });
    },
  });
}

export function useRemoveProductoCuna() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ cunaId, productoId }: { cunaId: number; productoId: number }) =>
      api.delete(`/stock/cunas/${cunaId}/productos/${productoId}`),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: CUNAS_KEY });
      qc.invalidateQueries({ queryKey: [...CUNAS_KEY, vars.cunaId] });
    },
  });
}
