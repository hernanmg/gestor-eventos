import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { CuentaCorriente, MovimientosCCCResponse, MonedaCCC, TipoTercero, TipoMovCCC } from '@/types';

const KEY        = ['cuentas-corrientes'];
const keyDetalle  = (id: number) => ['cuentas-corrientes', id];
const keyMovs     = (id: number, filtros: MovimientosFiltros) => ['cuentas-corrientes', id, 'movimientos', filtros];

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface CuentaCorrienteFiltros {
  activa?:       'true' | 'false';
  tipo_tercero?: TipoTercero;
  moneda?:       MonedaCCC;
}

export interface ParteInput {
  nombre:     string;
  porcentaje: number;
}

export interface CuentaCorrientePayload {
  nombre:         string;
  tipo_tercero:   TipoTercero;
  proveedor_id?:  number | null;
  tercero_nombre?: string | null;
  tercero_cuit?:  string | null;
  moneda:         MonedaCCC;
  descripcion?:   string | null;
  tiene_reparto:  boolean;
  partes?:        ParteInput[];
}

export interface MovimientosFiltros {
  desde?: string;
  hasta?: string;
  tipo?:  TipoMovCCC;
  limit?: number;
  offset?: number;
}

export interface MovimientoPayload {
  tipo:        TipoMovCCC;
  fecha:       string;
  concepto:    string;
  descripcion?: string | null;
  monto:       number;
  moneda:      MonedaCCC;
  tasa_cambio?: number | null;
  factura_id?: number | null;
  evento_id?:  number | null;
  documento?:  File | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function getDocumentoUrl(movimientoId: number): string {
  const base = (api.defaults.baseURL ?? '').replace(/\/$/, '');
  return `${base}/cuentas-corrientes/movimientos/${movimientoId}/documento`;
}

function movimientoToFormData(data: MovimientoPayload): FormData {
  const fd = new FormData();
  fd.append('tipo', data.tipo);
  fd.append('fecha', data.fecha);
  fd.append('concepto', data.concepto);
  if (data.descripcion)         fd.append('descripcion', data.descripcion);
  fd.append('monto', String(data.monto));
  fd.append('moneda', data.moneda);
  if (data.tasa_cambio != null)  fd.append('tasa_cambio', String(data.tasa_cambio));
  if (data.factura_id != null)   fd.append('factura_id', String(data.factura_id));
  if (data.evento_id != null)    fd.append('evento_id', String(data.evento_id));
  if (data.documento)            fd.append('documento', data.documento);
  return fd;
}

// ── Queries ───────────────────────────────────────────────────────────────────

export function useCuentasCorrientes(filtros: CuentaCorrienteFiltros = {}) {
  const params = new URLSearchParams();
  if (filtros.activa)       params.set('activa', filtros.activa);
  if (filtros.tipo_tercero) params.set('tipo_tercero', filtros.tipo_tercero);
  if (filtros.moneda)       params.set('moneda', filtros.moneda);

  return useQuery<CuentaCorriente[]>({
    queryKey:  [...KEY, filtros],
    queryFn:   () => api.get(`/cuentas-corrientes?${params}`).then(r => r.data),
    staleTime: 60 * 1000,
  });
}

export function useCuentaCorriente(id: number) {
  return useQuery<CuentaCorriente>({
    queryKey:  keyDetalle(id),
    queryFn:   () => api.get(`/cuentas-corrientes/${id}`).then(r => r.data),
    staleTime: 30 * 1000,
    enabled:   Number.isFinite(id) && id > 0,
  });
}

export function useMovimientosCCC(cuentaId: number, filtros: MovimientosFiltros = {}) {
  const params = new URLSearchParams();
  if (filtros.desde)  params.set('desde', filtros.desde);
  if (filtros.hasta)  params.set('hasta', filtros.hasta);
  if (filtros.tipo)   params.set('tipo', filtros.tipo);
  if (filtros.limit)  params.set('limit', String(filtros.limit));
  if (filtros.offset) params.set('offset', String(filtros.offset));

  return useQuery<MovimientosCCCResponse>({
    queryKey:  keyMovs(cuentaId, filtros),
    queryFn:   () => api.get(`/cuentas-corrientes/${cuentaId}/movimientos?${params}`).then(r => r.data),
    staleTime: 30 * 1000,
    enabled:   Number.isFinite(cuentaId) && cuentaId > 0,
  });
}

// ── Mutations — cuenta ────────────────────────────────────────────────────────

export function useCreateCuentaCorriente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CuentaCorrientePayload) => api.post('/cuentas-corrientes', data).then(r => r.data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateCuentaCorriente(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<CuentaCorrientePayload>) => api.put(`/cuentas-corrientes/${id}`, data).then(r => r.data),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: keyDetalle(id) });
    },
  });
}

export function useDeleteCuentaCorriente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/cuentas-corrientes/${id}`).then(r => r.data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

// ── Mutations — movimientos ───────────────────────────────────────────────────

export function useCreateMovimientoCCC(cuentaId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: MovimientoPayload) => api.post(`/cuentas-corrientes/${cuentaId}/movimientos`, movimientoToFormData(data)).then(r => r.data),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: keyDetalle(cuentaId) });
      qc.invalidateQueries({ queryKey: ['cuentas-corrientes', cuentaId, 'movimientos'] });
    },
  });
}

export function useUpdateMovimientoCCC(cuentaId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<MovimientoPayload> }) =>
      api.put(`/cuentas-corrientes/movimientos/${id}`, data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: keyDetalle(cuentaId) });
      qc.invalidateQueries({ queryKey: ['cuentas-corrientes', cuentaId, 'movimientos'] });
    },
  });
}

export function useDeleteMovimientoCCC(cuentaId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/cuentas-corrientes/movimientos/${id}`).then(r => r.data),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: keyDetalle(cuentaId) });
      qc.invalidateQueries({ queryKey: ['cuentas-corrientes', cuentaId, 'movimientos'] });
    },
  });
}
