import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { PanolItem, MovimientoPanol, AlertaPanol } from '@/types';

export const PANOL_ITEMS_KEY       = ['panol', 'items']       as const;
export const PANOL_MOVIMIENTOS_KEY = ['panol', 'movimientos'] as const;
export const PANOL_ALERTAS_KEY     = ['panol', 'alertas']     as const;

export function usePanolItems(params: { tipo?: string; estado?: string } = {}) {
  return useQuery({
    queryKey: [...PANOL_ITEMS_KEY, params],
    queryFn:  async () => {
      const p = new URLSearchParams();
      if (params.tipo)   p.set('tipo',   params.tipo);
      if (params.estado) p.set('estado', params.estado);
      const { data } = await api.get<PanolItem[]>(`/panol/items?${p}`);
      return data;
    },
  });
}

export function usePanolItem(id: number | null) {
  return useQuery({
    queryKey: [...PANOL_ITEMS_KEY, id],
    queryFn:  () => api.get<PanolItem>(`/panol/items/${id}`).then(r => r.data),
    enabled:  !!id,
  });
}

export function useCreatePanolItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<PanolItem>) => api.post<PanolItem>('/panol/items', data).then(r => r.data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: PANOL_ITEMS_KEY }),
  });
}

export function useUpdatePanolItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<PanolItem> }) =>
      api.put<PanolItem>(`/panol/items/${id}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: PANOL_ITEMS_KEY }),
  });
}

export function useDeletePanolItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/panol/items/${id}`),
    onSuccess:  () => qc.invalidateQueries({ queryKey: PANOL_ITEMS_KEY }),
  });
}

export function useMovimientosPanol(params: { evento_id?: number; tipo?: string; desde?: string; hasta?: string } = {}) {
  return useQuery({
    queryKey: [...PANOL_MOVIMIENTOS_KEY, params],
    queryFn:  async () => {
      const p = new URLSearchParams();
      if (params.evento_id) p.set('evento_id', String(params.evento_id));
      if (params.tipo)      p.set('tipo',      params.tipo);
      if (params.desde)     p.set('desde',     params.desde);
      if (params.hasta)     p.set('hasta',     params.hasta);
      const { data } = await api.get<MovimientoPanol[]>(`/panol/movimientos?${p}`);
      return data;
    },
  });
}

export function useCreateMovimientoPanol() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      panol_item_id: number;
      tipo:          'SALIDA' | 'USO_INTERNO';
      cantidad:      number;
      evento_id?:    number | null;
      responsable_id?: number | null;
      responsable_nombre?: string | null;
      fecha:         string;
      descripcion?:  string | null;
    }) => api.post<MovimientoPanol>('/panol/movimientos', data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PANOL_ITEMS_KEY });
      qc.invalidateQueries({ queryKey: PANOL_MOVIMIENTOS_KEY });
      qc.invalidateQueries({ queryKey: PANOL_ALERTAS_KEY });
    },
  });
}

export function useDevolverMovimientoPanol() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, cantidad_devuelta, motivo_faltante }: { id: number; cantidad_devuelta: number; motivo_faltante?: string | null }) =>
      api.patch<MovimientoPanol>(`/panol/movimientos/${id}/devolver`, { cantidad_devuelta, motivo_faltante }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PANOL_ITEMS_KEY });
      qc.invalidateQueries({ queryKey: PANOL_MOVIMIENTOS_KEY });
      qc.invalidateQueries({ queryKey: PANOL_ALERTAS_KEY });
    },
  });
}

export function useAlertasPanol(enabled: boolean = true) {
  return useQuery({
    queryKey: PANOL_ALERTAS_KEY,
    queryFn:  () => api.get<{ alertas: AlertaPanol[] }>('/panol/alertas').then(r => r.data),
    staleTime: 5 * 60 * 1000,
    enabled,
  });
}
