import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { OrdenCompraResumen, OrdenCompraDetalle, EstadoOrdenCompra, Moneda } from '@/types';

// Órdenes de compra — /api/ordenes-compra
const KEY = ['ordenes-compra'] as const;

export interface OrdenCompraFiltros { estado?: EstadoOrdenCompra; proveedor_id?: number; q?: string }

export function useOrdenesCompra(filtros: OrdenCompraFiltros = {}, enabled = true) {
  return useQuery({
    queryKey: [...KEY, 'lista', filtros],
    queryFn:  () => api.get<OrdenCompraResumen[]>('/ordenes-compra', { params: filtros }).then(r => r.data),
    enabled,
  });
}

export function useOrdenCompra(id: number | null) {
  return useQuery({
    queryKey: [...KEY, 'detalle', id],
    queryFn:  () => api.get<OrdenCompraDetalle>(`/ordenes-compra/${id}`).then(r => r.data),
    enabled:  id != null,
  });
}

export interface OrdenCompraPayload {
  fecha: string; proveedor_id: number; evento_id?: number | null;
  contacto?: string | null; telefono?: string | null; domicilio?: string | null; ciudad?: string | null;
  entrega?: string | null; direccion_entrega?: string | null; plazo_pago?: string | null; forma_pago?: string | null;
  referencia_proveedor?: string | null; moneda?: Moneda; iva_porcentaje?: number; notas?: string | null;
  items: { codigo?: string | null; descripcion: string; cantidad: number; precio_unitario: number }[];
}

export type SugerenciaProveedorOC = Partial<Pick<OrdenCompraPayload, 'contacto' | 'telefono' | 'domicilio' | 'ciudad' | 'entrega' | 'direccion_entrega' | 'plazo_pago' | 'forma_pago'>>;

export const sugerenciaProveedorOC = (proveedorId: number) =>
  api.get<SugerenciaProveedorOC>('/ordenes-compra/sugerencia', { params: { proveedor_id: proveedorId } }).then(r => r.data);

function useInvalidar() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: KEY });
    qc.invalidateQueries({ queryKey: ['facturas'] });
    qc.invalidateQueries({ queryKey: ['stock'] }); // la recepción suma al stock
  };
}

export function useGuardarOrdenCompra() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: ({ id, data }: { id?: number; data: OrdenCompraPayload }) =>
      (id ? api.put(`/ordenes-compra/${id}`, data) : api.post('/ordenes-compra', data)).then(r => r.data as { id: number }),
    onSuccess: invalidar,
  });
}

export type AccionOrden = 'emitir' | 'volver-borrador' | 'anular' | 'reabrir';

export function useAccionOrden() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: ({ id, accion }: { id: number; accion: AccionOrden }) => api.post(`/ordenes-compra/${id}/${accion}`).then(r => r.data),
    onSuccess: invalidar,
  });
}

export function useEliminarOrden() {
  const invalidar = useInvalidar();
  return useMutation({ mutationFn: (id: number) => api.delete(`/ordenes-compra/${id}`), onSuccess: invalidar });
}

export function useRecibirOrden() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: ({ id, items, fecha }: { id: number; fecha?: string; items: { id: number; cantidad_recibida: number; producto_id?: number | null }[] }) =>
      api.post(`/ordenes-compra/${id}/recibir`, { items, fecha }).then(r => r.data),
    onSuccess: invalidar,
  });
}

export function useCerrarOrden() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: ({ id, notas_cotejo }: { id: number; notas_cotejo?: string | null }) => api.post(`/ordenes-compra/${id}/cerrar`, { notas_cotejo }).then(r => r.data),
    onSuccess: invalidar,
  });
}

export function useFacturasDisponiblesOC(id: number | null) {
  return useQuery({
    queryKey: [...KEY, 'facturas-disponibles', id],
    queryFn:  () => api.get<{ id: number; numero_factura: string; tipo_factura: string; fecha_emision: string; importe_total: number | string; estado: string }[]>(`/ordenes-compra/${id}/facturas-disponibles`).then(r => r.data),
    enabled:  id != null,
  });
}

export function useVincularFacturaOC() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: ({ id, factura_id }: { id: number; factura_id: number }) => api.post(`/ordenes-compra/${id}/facturas`, { factura_id }).then(r => r.data),
    onSuccess: invalidar,
  });
}

export function useDesvincularFacturaOC() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: ({ id, factura_id }: { id: number; factura_id: number }) => api.delete(`/ordenes-compra/${id}/facturas/${factura_id}`).then(r => r.data),
    onSuccess: invalidar,
  });
}

export function pdfOrdenCompraUrl(id: number) {
  const base = (api.defaults.baseURL ?? '').replace(/\/$/, '');
  return `${base}/ordenes-compra/${id}/pdf`;
}
