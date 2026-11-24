import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { ComparativoResumen, ComparativoDetalle, EstadoComparativo, Moneda } from '@/types';

// Comparativo de presupuestos de proveedores — /api/comparativos
const KEY = ['comparativos'] as const;

export function useComparativos(filtros: { estado?: EstadoComparativo; q?: string } = {}) {
  return useQuery({
    queryKey: [...KEY, 'lista', filtros],
    queryFn:  () => api.get<ComparativoResumen[]>('/comparativos', { params: filtros }).then(r => r.data),
  });
}

export function useComparativo(id: number | null) {
  return useQuery({
    queryKey: [...KEY, 'detalle', id],
    queryFn:  () => api.get<ComparativoDetalle>(`/comparativos/${id}`).then(r => r.data),
    enabled:  id != null,
  });
}

export interface CotizacionPayload {
  proveedor_id: number; referencia?: string | null; fecha?: string | null; validez?: string | null;
  plazo_entrega?: string | null; plazo_pago?: string | null; forma_pago?: string | null;
  iva_porcentaje?: number; notas?: string | null; precios: (number | null)[];
}

export interface ComparativoPayload {
  fecha: string; titulo: string; evento_id?: number | null; moneda?: Moneda; notas?: string | null;
  items: { codigo?: string | null; descripcion: string; cantidad: number }[];
  cotizaciones: CotizacionPayload[];
}

function useInvalidar() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: KEY });
    qc.invalidateQueries({ queryKey: ['ordenes-compra'] });
  };
}

export function useGuardarComparativo() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: ({ id, data }: { id?: number; data: ComparativoPayload }) =>
      (id ? api.put(`/comparativos/${id}`, data) : api.post('/comparativos', data)).then(r => r.data as { id: number }),
    onSuccess: invalidar,
  });
}

export function useEliminarComparativo() {
  const invalidar = useInvalidar();
  return useMutation({ mutationFn: (id: number) => api.delete(`/comparativos/${id}`), onSuccess: invalidar });
}

export function useElegirCotizacion() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: ({ id, cotizacion_id, motivo }: { id: number; cotizacion_id: number; motivo?: string }) =>
      api.post(`/comparativos/${id}/elegir`, { cotizacion_id, motivo }).then(r => r.data),
    onSuccess: invalidar,
  });
}

export function useAccionComparativo() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: ({ id, accion }: { id: number; accion: 'reabrir' | 'anular' }) => api.post(`/comparativos/${id}/${accion}`).then(r => r.data),
    onSuccess: invalidar,
  });
}

export function useArmarOrdenCompra() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (id: number) =>
      api.post(`/comparativos/${id}/orden-compra`).then(r => r.data as { orden_compra_id: number; numero: string; articulos_sin_precio: number }),
    onSuccess: invalidar,
  });
}

export function pdfComparativoUrl(id: number) {
  const base = (api.defaults.baseURL ?? '').replace(/\/$/, '');
  return `${base}/comparativos/${id}/pdf`;
}
