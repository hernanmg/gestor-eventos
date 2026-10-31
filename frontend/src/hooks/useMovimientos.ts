import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { Movimiento, ResumenMovimientos, EstadoMovimiento } from '@/types';
import { fichaKey } from './useFichaEvento';

export interface MovimientoCreatePayload {
  rubro_id:              number;
  fecha?:                string | null;
  concepto?:             string | null;
  descripcion?:          string | null;
  debe?:                 number;
  haber?:                number;
  moneda?:               'ARS' | 'USD' | 'EUR';
  tasa_cambio?:          number | null;
  impuesto_subcategoria?: string | null;
  impacta_caja?:         boolean;
  cuenta_id?:            number;
  proveedor_id?:         number;
  estado_movimiento?:    EstadoMovimiento;
  presupuesto?:          number | null;
  responsable_id?:       number | null;
  fecha_pago?:           string | null;
  avisado_proveedor?:    boolean;
  iva?:                  number | null;
  plazo_pago?:           string | null;
}

export interface MovimientoUpdatePayload {
  fecha?:                string | null;
  concepto?:             string | null;
  descripcion?:          string | null;
  debe?:                 number;
  haber?:                number;
  moneda?:               'ARS' | 'USD' | 'EUR';
  tasa_cambio?:          number | null;
  impuesto_subcategoria?: string | null;
  proveedor_id?:         number | null;
  estado_movimiento?:    EstadoMovimiento;
  presupuesto?:          number | null;
  responsable_id?:       number | null;
  fecha_pago?:           string | null;
  avisado_proveedor?:    boolean;
  iva?:                  number | null;
  plazo_pago?:           string | null;
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

// Todo lo de movimientos del evento (rubro, resumen, centro de costos — ver
// useCentroCostos): una línea editada desde el centro de costos también cambia
// la tabla de su rubro. rubroId queda en la firma de los hooks por compatibilidad.
function invalidate(qc: ReturnType<typeof useQueryClient>, eventoId: number, _rubroId: number) {
  qc.invalidateQueries({ queryKey: ['movimientos', eventoId] });
  // La Ficha muestra el real / falta pagar de cada rubro
  qc.invalidateQueries({ queryKey: fichaKey(eventoId) });
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

// ── Pagos parciales (señas) — "Falta pagar" del centro de costos ─────────────

export function useAddPagoParcial(eventoId: number, rubroId: number) {
  const qc = useQueryClient();
  return useMutation<Movimiento, Error, { id: number; fecha: string; monto: number; nota?: string | null }>({
    mutationFn: ({ id, ...data }) => api.post(`/movimientos/${id}/pagos`, data).then(r => r.data),
    onSuccess:  () => invalidate(qc, eventoId, rubroId),
  });
}

export function useRemovePagoParcial(eventoId: number, rubroId: number) {
  const qc = useQueryClient();
  return useMutation<Movimiento, Error, { id: number; pagoId: number }>({
    mutationFn: ({ id, pagoId }) => api.delete(`/movimientos/${id}/pagos/${pagoId}`).then(r => r.data),
    onSuccess:  () => invalidate(qc, eventoId, rubroId),
  });
}
