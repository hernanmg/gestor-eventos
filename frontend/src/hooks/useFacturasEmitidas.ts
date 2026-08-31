import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type {
  FacturaEmitida, FacturasEmitidasResponse, ResumenFacturasEmitidas, ClienteFacturacionBusqueda,
  CobroFacturaEmitida, TipoComprobanteEmitido, CondicionCliente, EstadoFacturaEmitida, Moneda,
} from '@/types';

const KEY = ['facturas-emitidas'] as const;

// El Calendario y la campanita de notificaciones agregan los vencimientos de
// facturas emitidas (ver calendario.controller.ts FACTURA_EMITIDA_VENCE y
// notificaciones.controller.ts) — cualquier mutación que cambie el saldo o el
// estado debe invalidar esas queries para reflejarse sin recargar.
function invalidateGlobales(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['calendario'] });
  qc.invalidateQueries({ queryKey: ['notificaciones'] });
}

export interface FacturasEmitidasFiltros {
  estado?:           EstadoFacturaEmitida;
  cliente_nombre?:   string;
  desde?:            string;
  hasta?:            string;
  evento_id?:        number;
  tipo_comprobante?: TipoComprobanteEmitido;
  moneda?:           Moneda;
  page?:             number;
  limit?:            number;
}

export function useFacturasEmitidas(filtros: FacturasEmitidasFiltros = {}) {
  return useQuery({
    queryKey: [...KEY, filtros],
    queryFn:  () => api.get<FacturasEmitidasResponse>('/facturas-emitidas', { params: filtros }).then(r => r.data),
  });
}

export function useFacturaEmitida(id: number | null) {
  return useQuery({
    queryKey: [...KEY, id],
    queryFn:  () => api.get<FacturaEmitida>(`/facturas-emitidas/${id}`).then(r => r.data),
    enabled:  id != null,
  });
}

export function useResumenFacturasEmitidas() {
  return useQuery({
    queryKey: [...KEY, 'resumen'],
    queryFn:  () => api.get<ResumenFacturasEmitidas>('/facturas-emitidas/resumen').then(r => r.data),
  });
}

// Función de búsqueda (no react-query) — mismo patrón que useBuscarProveedores,
// el debounce lo maneja el combobox que la consume (ver ClienteCombobox.tsx).
export function useBuscarClientesFacturacion() {
  return async (q: string): Promise<ClienteFacturacionBusqueda[]> => {
    if (!q || q.length < 2) return [];
    const r = await api.get<ClienteFacturacionBusqueda[]>('/facturas-emitidas/clientes', { params: { q } });
    return r.data;
  };
}

export interface RepartoPayload {
  razon_social: string;
  cuit?:        string | null;
  porcentaje:   number;
  monto:        number;
  empresa_id?:  number | null;
}

export interface FacturaEmitidaPayload {
  tipo_comprobante:   TipoComprobanteEmitido;
  punto_venta?:       number;
  numero?:            string | null;
  fecha_emision:      string;
  cliente_nombre:     string;
  cliente_cuit?:      string | null;
  condicion_cliente?: CondicionCliente | null;
  neto_gravado?:      number | null;
  iva?:               number | null;
  otros_impuestos?:   number | null;
  total:              number;
  moneda:             Moneda;
  tasa_cambio?:       number | null;
  forma_pago?:        string | null;
  fecha_vencimiento?: string | null;
  evento_id?:         number | null;
  concepto?:          string | null;
  observaciones?:     string | null;
  repartos?:          RepartoPayload[];
}

export function useCreateFacturaEmitida() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: FacturaEmitidaPayload) => api.post<FacturaEmitida>('/facturas-emitidas', data).then(r => r.data),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: KEY }); invalidateGlobales(qc); },
  });
}

export function useUpdateFacturaEmitida(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<FacturaEmitidaPayload>) => api.put<FacturaEmitida>(`/facturas-emitidas/${id}`, data).then(r => r.data),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: KEY }); invalidateGlobales(qc); },
  });
}

export function useDeleteFacturaEmitida() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/facturas-emitidas/${id}`),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: KEY }); invalidateGlobales(qc); },
  });
}

export function useAnularFacturaEmitida() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.patch<FacturaEmitida>(`/facturas-emitidas/${id}/anular`).then(r => r.data),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: KEY }); invalidateGlobales(qc); },
  });
}

export function useMarcarIncobrable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.patch<FacturaEmitida>(`/facturas-emitidas/${id}/incobrable`).then(r => r.data),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: KEY }); invalidateGlobales(qc); },
  });
}

export interface CobroPayload {
  fecha:              string;
  monto:              number;
  forma_cobro?:       string | null;
  cuenta_destino_id?: number | null;
  referencia?:        string | null;
  notas?:             string | null;
}

export function useRegistrarCobro(facturaId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CobroPayload) => api.post<CobroFacturaEmitida>(`/facturas-emitidas/${facturaId}/cobros`, data).then(r => r.data),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: KEY }); invalidateGlobales(qc); },
  });
}

export function useEliminarCobro() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (cobroId: number) => api.delete(`/facturas-emitidas/cobros/${cobroId}`),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: KEY }); invalidateGlobales(qc); },
  });
}

export function useUploadPdfFacturaEmitida(facturaId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (archivo: File) => {
      const fd = new FormData();
      fd.append('pdf', archivo);
      return api.post(`/facturas-emitidas/${facturaId}/pdf`, fd);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [...KEY, facturaId] }),
  });
}

export function facturaEmitidaPdfUrl(facturaId: number): string {
  const base = (api.defaults.baseURL ?? '').replace(/\/$/, '');
  return `${base}/facturas-emitidas/${facturaId}/pdf`;
}
