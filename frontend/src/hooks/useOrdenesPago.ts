import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { OrdenPagoResumen, OrdenPagoDetalle, EstadoOrdenPago, FacturaParaOrdenPago, MedioPago } from '@/types';

// Órdenes de pago — /api/ordenes-pago
const KEY = ['ordenes-pago'] as const;

export interface OrdenPagoFiltros { estado?: EstadoOrdenPago; proveedor_id?: number; q?: string }

export function useOrdenesPago(filtros: OrdenPagoFiltros = {}) {
  return useQuery({
    queryKey: [...KEY, 'lista', filtros],
    queryFn:  () => api.get<OrdenPagoResumen[]>('/ordenes-pago', { params: filtros }).then(r => r.data),
  });
}

export function useOrdenPago(id: number | null) {
  return useQuery({
    queryKey: [...KEY, 'detalle', id],
    queryFn:  () => api.get<OrdenPagoDetalle>(`/ordenes-pago/${id}`).then(r => r.data),
    enabled:  id != null,
  });
}

// Facturas del proveedor con saldo que no están en otra orden abierta
export function useFacturasParaOrdenPago(proveedorId: number | null, ordenId: number | null) {
  return useQuery({
    queryKey: [...KEY, 'facturas-pendientes', proveedorId, ordenId],
    queryFn:  () => api.get<FacturaParaOrdenPago[]>('/ordenes-pago/facturas-pendientes', {
      params: { proveedor_id: proveedorId, ...(ordenId ? { orden_id: ordenId } : {}) },
    }).then(r => r.data),
    enabled:  proveedorId != null,
  });
}

export interface OrdenPagoPayload {
  fecha: string; proveedor_id: number; concepto?: string | null; notas?: string | null;
  facturas: { factura_id: number; importe: number }[];
  medios: { medio_pago: MedioPago; numero?: string | null; banco?: string | null; fecha_pago: string; importe: number }[];
}

function useInvalidar() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: KEY });
    qc.invalidateQueries({ queryKey: ['facturas'] });
    qc.invalidateQueries({ queryKey: ['cheques'] });
    qc.invalidateQueries({ queryKey: ['calendario'] });
    qc.invalidateQueries({ queryKey: ['notificaciones'] });
  };
}

export function useGuardarOrdenPago() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: ({ id, data }: { id?: number; data: OrdenPagoPayload }) =>
      (id ? api.put(`/ordenes-pago/${id}`, data) : api.post('/ordenes-pago', data)).then(r => r.data as OrdenPagoDetalle),
    onSuccess: invalidar,
  });
}

export type AccionOrdenPago = 'revisar' | 'autorizar' | 'volver-borrador' | 'anular' | 'pagar';

export function useAccionOrdenPago() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: ({ id, accion }: { id: number; accion: AccionOrdenPago }) => api.post(`/ordenes-pago/${id}/${accion}`).then(r => r.data),
    onSuccess: invalidar,
  });
}

export function useEliminarOrdenPago() {
  const invalidar = useInvalidar();
  return useMutation({ mutationFn: (id: number) => api.delete(`/ordenes-pago/${id}`), onSuccess: invalidar });
}

export function pdfOrdenPagoUrl(id: number) {
  const base = (api.defaults.baseURL ?? '').replace(/\/$/, '');
  return `${base}/ordenes-pago/${id}/pdf`;
}
