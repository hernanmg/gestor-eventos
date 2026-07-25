import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { Movimiento, ResumenMovimientos, EstadoMovimiento } from '@/types';

export interface MovimientoCreatePayload {
  rubro_id:              number;
  fecha?:                string | null;
  concepto?:             string | null;
  descripcion?:          string | null;
  debe?:                 number;
  haber?:                number;
  moneda?:               'ARS' | 'USD';
  impuesto_subcategoria?: string | null;
  impacta_caja?:         boolean;
  cuenta_id?:            number;
  proveedor_id?:         number;
  estado_movimiento?:    EstadoMovimiento;
  presupuesto?:          number | null;
  responsable_id?:       number | null;
  fecha_pago?:           string | null;
  avisado_proveedor?:    boolean;
}

export interface MovimientoUpdatePayload {
  fecha?:                string | null;
  concepto?:             string | null;
  descripcion?:          string | null;
  debe?:                 number;
  haber?:                number;
  moneda?:               'ARS' | 'USD';
  impuesto_subcategoria?: string | null;
  proveedor_id?:         number | null;
  estado_movimiento?:    EstadoMovimiento;
  presupuesto?:          number | null;
  responsable_id?:       number | null;
  fecha_pago?:           string | null;
  avisado_proveedor?:    boolean;
}

function movKey(eventoId: number, rubroId: number) {
  return ['movimientos', eventoId, rubroId] as const;
}

function resumenKey(eventoId: number) {
  return ['movimientos', eventoId, 'resumen'] as const;
}

export function useMovimientos(eventoId: number, rubroId: number) {
  return useQuery<Movimiento[]>({
    queryKey: movKey(eventoId, rubroId),
    queryFn:  () =>
      api.get(`/eventos/${eventoId}/movimientos`, {
        params: { rubro_id: rubroId },
      }).then(r => r.data),
    enabled: !!rubroId,
  });
}

export function useResumenMovimientos(eventoId: number) {
  return useQuery<ResumenMovimientos>({
    queryKey: resumenKey(eventoId),
    queryFn:  () => api.get(`/eventos/${eventoId}/movimientos/resumen`).then(r => r.data),
  });
}

function invalidate(qc: ReturnType<typeof useQueryClient>, eventoId: number, rubroId: number) {
  qc.invalidateQueries({ queryKey: movKey(eventoId, rubroId) });
  qc.invalidateQueries({ queryKey: resumenKey(eventoId) });
}

export function useCreateMovimiento(eventoId: number, rubroId: number) {
  const qc = useQueryClient();
  return useMutation<Movimiento, Error, MovimientoCreatePayload>({
    mutationFn: data => api.post(`/eventos/${eventoId}/movimientos`, data).then(r => r.data),
    onSuccess:  () => invalidate(qc, eventoId, rubroId),
  });
}

export function useUpdateMovimiento(eventoId: number, rubroId: number) {
  const qc = useQueryClient();
  return useMutation<Movimiento, Error, { id: number; data: MovimientoUpdatePayload }>({
    mutationFn: ({ id, data }) => api.put(`/movimientos/${id}`, data).then(r => r.data),
    onSuccess:  () => invalidate(qc, eventoId, rubroId),
  });
}

export function useDeleteMovimiento(eventoId: number, rubroId: number) {
  const qc = useQueryClient();
  return useMutation<unknown, Error, number>({
    mutationFn: id => api.delete(`/movimientos/${id}`).then(r => r.data),
    onSuccess:  () => invalidate(qc, eventoId, rubroId),
  });
}

export function useReordenarMovimiento(eventoId: number, rubroId: number) {
  const qc = useQueryClient();
  return useMutation<Movimiento, Error, { id: number; orden: number }>({
    mutationFn: ({ id, orden }) =>
      api.patch(`/movimientos/${id}/orden`, { orden }).then(r => r.data),
    onSuccess: () => invalidate(qc, eventoId, rubroId),
  });
}
