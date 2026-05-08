import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { Movimiento, Tipo } from '@/types';

export interface MovimientoCreatePayload {
  tipo:                  Tipo;
  tab_numero:            number;
  fecha?:                string | null;
  concepto?:             string | null;
  descripcion?:          string | null;
  debe?:                 number;
  haber?:                number;
  moneda?:               'ARS' | 'USD';
  impuesto_subcategoria?: string | null;
  impacta_caja?:         boolean;
  cuenta_id?:            number;
}

export interface MovimientoUpdatePayload {
  fecha?:                string | null;
  concepto?:             string | null;
  descripcion?:          string | null;
  debe?:                 number;
  haber?:                number;
  moneda?:               'ARS' | 'USD';
  impuesto_subcategoria?: string | null;
}

function movKey(eventoId: number, tipo: Tipo, tabNumero: number) {
  return ['movimientos', eventoId, tipo, tabNumero] as const;
}

export function useMovimientos(eventoId: number, tipo: Tipo, tabNumero: number) {
  return useQuery<Movimiento[]>({
    queryKey: movKey(eventoId, tipo, tabNumero),
    queryFn:  () =>
      api.get(`/eventos/${eventoId}/movimientos`, {
        params: { tipo, tab: tabNumero },
      }).then(r => r.data),
  });
}

export function useCreateMovimiento(eventoId: number, tipo: Tipo, tabNumero: number) {
  const qc = useQueryClient();
  return useMutation<Movimiento, Error, MovimientoCreatePayload>({
    mutationFn: data => api.post(`/eventos/${eventoId}/movimientos`, data).then(r => r.data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: movKey(eventoId, tipo, tabNumero) }),
  });
}

export function useUpdateMovimiento(eventoId: number, tipo: Tipo, tabNumero: number) {
  const qc = useQueryClient();
  return useMutation<Movimiento, Error, { id: number; data: MovimientoUpdatePayload }>({
    mutationFn: ({ id, data }) => api.put(`/movimientos/${id}`, data).then(r => r.data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: movKey(eventoId, tipo, tabNumero) }),
  });
}

export function useDeleteMovimiento(eventoId: number, tipo: Tipo, tabNumero: number) {
  const qc = useQueryClient();
  return useMutation<unknown, Error, number>({
    mutationFn: id => api.delete(`/movimientos/${id}`).then(r => r.data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: movKey(eventoId, tipo, tabNumero) }),
  });
}

export function useReordenarMovimiento(eventoId: number, tipo: Tipo, tabNumero: number) {
  const qc = useQueryClient();
  return useMutation<Movimiento, Error, { id: number; orden: number }>({
    mutationFn: ({ id, orden }) =>
      api.patch(`/movimientos/${id}/orden`, { orden }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: movKey(eventoId, tipo, tabNumero) }),
  });
}
