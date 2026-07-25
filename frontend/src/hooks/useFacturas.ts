import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { Factura, EstadoFactura, Moneda, MedioPago } from '@/types';

const KEY = ['facturas'];
const keyEvento  = (id: number) => ['facturas', 'evento', id];
const keyDetalle = (id: number) => ['facturas', id];

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface FacturaFiltros {
  evento_id?:    number;
  proveedor_id?: number;
  estado?:       EstadoFactura;
  moneda?:       Moneda;
  desde?:        string;
  hasta?:        string;
  vencen_en_dias?: number;
}

export interface CreateFacturaPayload {
  numero_factura:    string;
  tipo_factura:      string;
  fecha_emision:     string;
  fecha_vencimiento?: string | null;
  proveedor_id:      number;
  tab_numero?:       number | null;
  rubro_id?:         number | null;
  importe_total:     number;
  moneda?:           Moneda;
  condicion_pago?:   string;
  notas?:            string | null;
  pdf?:              File | null;
}

export interface PagoPayload {
  fecha_pago:                 string;
  importe:                    number;
  medio_pago:                 MedioPago;
  referencia?:                string;
  notas?:                     string;
  echeq_numero?:              string;
  echeq_fecha_cobro_estimada?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function getPdfUrl(facturaId: number): string {
  const base = (api.defaults.baseURL ?? '').replace(/\/$/, '');
  return `${base}/facturas/${facturaId}/pdf`;
}

// ── Queries ───────────────────────────────────────────────────────────────────

export function useFacturas(filtros: FacturaFiltros = {}) {
  const params = new URLSearchParams();
  if (filtros.evento_id)    params.set('evento_id',    String(filtros.evento_id));
  if (filtros.proveedor_id) params.set('proveedor_id', String(filtros.proveedor_id));
  if (filtros.estado)       params.set('estado',       filtros.estado);
  if (filtros.moneda)       params.set('moneda',       filtros.moneda);
  if (filtros.desde)        params.set('desde',        filtros.desde);
  if (filtros.hasta)        params.set('hasta',        filtros.hasta);
  if (filtros.vencen_en_dias !== undefined)
    params.set('vencen_en_dias', String(filtros.vencen_en_dias));

  return useQuery<Factura[]>({
    queryKey: [...KEY, filtros],
    queryFn:  () => api.get(`/facturas?${params}`).then(r => r.data),
    staleTime: 60 * 1000,
  });
}

export function useFacturasEvento(eventoId: number, filtros: Omit<FacturaFiltros, 'evento_id'> = {}) {
  const params = new URLSearchParams();
  if (filtros.estado) params.set('estado', filtros.estado);
  if (filtros.moneda) params.set('moneda', filtros.moneda);

  return useQuery<Factura[]>({
    queryKey: [...keyEvento(eventoId), filtros],
    queryFn:  () => api.get(`/eventos/${eventoId}/facturas?${params}`).then(r => r.data),
    staleTime: 60 * 1000,
  });
}

export function useFactura(id: number) {
  return useQuery<Factura>({
    queryKey: keyDetalle(id),
    queryFn:  () => api.get(`/facturas/${id}`).then(r => r.data),
    staleTime: 30 * 1000,
  });
}

export function useAlertasFacturas() {
  return useQuery<{ vencidas: number; vencen_pronto: number }>({
    queryKey:        [...KEY, 'alertas'],
    queryFn:         () => api.get('/facturas/alertas').then(r => r.data),
    staleTime:       10 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
    placeholderData: { vencidas: 0, vencen_pronto: 0 },
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export function useCreateFactura(eventoId: number) {
  const qc = useQueryClient();
  return useMutation({
    // Recibe FormData ya construido por el formulario
    mutationFn: (fd: FormData) =>
      api.post(`/eventos/${eventoId}/facturas`, fd).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: keyEvento(eventoId) });
      qc.invalidateQueries({ queryKey: [...KEY, 'alertas'] });
    },
  });
}

export function useUpdateFactura(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<CreateFacturaPayload>) =>
      api.put(`/facturas/${id}`, data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: keyDetalle(id) });
    },
  });
}

export function useUploadPDF(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append('pdf', file);
      return api.put(`/facturas/${id}/pdf`, fd).then(r => r.data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keyDetalle(id) }),
  });
}

export function useAprobarFactura() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.patch(`/facturas/${id}/aprobar`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: [...KEY, 'alertas'] });
    },
  });
}

export function useAnularFactura() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.patch(`/facturas/${id}/anular`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: [...KEY, 'alertas'] });
    },
  });
}

export function usePagarFactura(facturaId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: PagoPayload) =>
      api.post(`/facturas/${facturaId}/pagos`, data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: keyDetalle(facturaId) });
      qc.invalidateQueries({ queryKey: [...KEY, 'alertas'] });
    },
  });
}

export function useAnularPago() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (pagoId: number) => api.delete(`/pagos/${pagoId}`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
    },
  });
}
