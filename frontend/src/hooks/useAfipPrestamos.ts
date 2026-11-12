import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type {
  PlanAFIP, CuotaPlanAFIP, DocumentoPlanAFIP,
  PrestamoBancario, CuotaPrestamo, DocumentoPrestamo, Moneda,
} from '@/types';

const KEY_AFIP      = ['afip', 'planes'] as const;
const KEY_PRESTAMOS = ['prestamos'] as const;

// El Calendario y la campanita de notificaciones agregan las cuotas de AFIP y
// préstamos (ver calendario.controller.ts CUOTA_AFIP/CUOTA_PRESTAMO y
// notificaciones.controller.ts) — cualquier mutación que cambie una cuota
// debe invalidar esas queries para reflejarse sin recargar.
function invalidateGlobales(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['calendario'] });
  qc.invalidateQueries({ queryKey: ['notificaciones'] });
}

// ══════════════════════════════════════════════════════════════════════════════
// ── AFIP ──────────────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

export interface PlanAfipFiltros {
  estado?:       string;
  titular_cuit?: string;
}

export function usePlanesAFIP(filtros: PlanAfipFiltros = {}) {
  return useQuery({
    queryKey: [...KEY_AFIP, filtros],
    queryFn:  () => api.get<PlanAFIP[]>('/afip/planes', { params: filtros }).then(r => r.data),
  });
}

export function usePlanAFIP(id: number | null) {
  return useQuery({
    queryKey: [...KEY_AFIP, id],
    queryFn:  () => api.get<PlanAFIP>(`/afip/planes/${id}`).then(r => r.data),
    enabled:  id != null,
  });
}

export interface PlanAfipPayload {
  empresa_id?:          number | null;
  descripcion:          string;
  numero_plan?:         string | null;
  fecha_inicio:         string;
  capital_original:     number;
  cantidad_cuotas:      number;
  valor_cuota_aprox?:   number | null;
  interes_financiero?:  number | null;
  interes_resarcitorio?: number | null;
  titular_nombre?:      string | null;
  titular_cuit?:        string | null;
  notas?:               string | null;
}

export function useCreatePlanAFIP() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: PlanAfipPayload) => api.post<PlanAFIP>('/afip/planes', data).then(r => r.data),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: KEY_AFIP }); invalidateGlobales(qc); },
  });
}

export function useUpdatePlanAFIP(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<PlanAfipPayload> & { estado?: string }) => api.put<PlanAFIP>(`/afip/planes/${id}`, data).then(r => r.data),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: KEY_AFIP }); invalidateGlobales(qc); },
  });
}

export function usePagarCuotaAFIP() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, fecha_pago_real }: { id: number; fecha_pago_real: string }) =>
      api.patch<CuotaPlanAFIP>(`/afip/cuotas/${id}/pagar`, { fecha_pago_real }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: KEY_AFIP }); invalidateGlobales(qc); },
  });
}

export function useSubirDocumentoPlanAFIP(planId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ archivo, nombre, descripcion }: { archivo: File; nombre?: string; descripcion?: string }) => {
      const fd = new FormData();
      fd.append('archivo', archivo);
      if (nombre)      fd.append('nombre', nombre);
      if (descripcion) fd.append('descripcion', descripcion);
      return api.post<DocumentoPlanAFIP>(`/afip/planes/${planId}/documentos`, fd).then(r => r.data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [...KEY_AFIP, planId] }),
  });
}

export function useEliminarDocumentoPlanAFIP(planId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (docId: number) => api.delete(`/afip/planes/${planId}/documentos/${docId}`),
    onSuccess:  () => qc.invalidateQueries({ queryKey: [...KEY_AFIP, planId] }),
  });
}

export function documentoPlanAfipUrl(planId: number, docId: number): string {
  const base = (api.defaults.baseURL ?? '').replace(/\/$/, '');
  return `${base}/afip/planes/${planId}/documentos/${docId}`;
}

// ══════════════════════════════════════════════════════════════════════════════
// ── PRÉSTAMOS BANCARIOS ───────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

export interface PrestamoFiltros {
  estado?:  string;
  entidad?: string;
}

export function usePrestamos(filtros: PrestamoFiltros = {}) {
  return useQuery({
    queryKey: [...KEY_PRESTAMOS, filtros],
    queryFn:  () => api.get<PrestamoBancario[]>('/prestamos', { params: filtros }).then(r => r.data),
  });
}

export function usePrestamo(id: number | null) {
  return useQuery({
    queryKey: [...KEY_PRESTAMOS, id],
    queryFn:  () => api.get<PrestamoBancario>(`/prestamos/${id}`).then(r => r.data),
    enabled:  id != null,
  });
}

export interface CuotaPrestamoInput {
  numero_cuota:      number;
  fecha_vencimiento: string;
  capital?:          number | null;
  interes?:          number | null;
  iva_interes?:      number | null;
  seguro?:           number | null;
  otros_impuestos?:  number | null;
  total_cuota:       number;
}

export interface PrestamoPayload {
  empresa_id?:          number | null;
  entidad:              string;
  numero_operacion?:    string | null;
  tipo?:                string | null;
  fecha_otorgamiento:   string;
  capital_original:     number;
  moneda:               Moneda;
  tasa_nominal_anual?:  number | null;
  tasa_efectiva_anual?: number | null;
  cantidad_cuotas:      number;
  dia_debito?:          number | null;
  notas?:               string | null;
  cuotas?:              CuotaPrestamoInput[];
}

export function useCreatePrestamo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: PrestamoPayload) => api.post<PrestamoBancario>('/prestamos', data).then(r => r.data),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: KEY_PRESTAMOS }); invalidateGlobales(qc); },
  });
}

export function useUpdatePrestamo(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Omit<PrestamoPayload, 'cuotas'>> & { estado?: string }) =>
      api.put<PrestamoBancario>(`/prestamos/${id}`, data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: KEY_PRESTAMOS }); invalidateGlobales(qc); },
  });
}

export function usePagarCuotaPrestamo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, fecha_pago_real }: { id: number; fecha_pago_real: string }) =>
      api.patch<CuotaPrestamo>(`/prestamos/cuotas/${id}/pagar`, { fecha_pago_real }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: KEY_PRESTAMOS }); invalidateGlobales(qc); },
  });
}

export interface CuotaPrestamoUpdatePayload {
  fecha_vencimiento?: string;
  capital?:           number | null;
  interes?:           number | null;
  iva_interes?:       number | null;
  seguro?:            number | null;
  otros_impuestos?:   number | null;
  total_cuota?:       number;
  notas?:             string | null;
}

export function useUpdateCuotaPrestamo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: CuotaPrestamoUpdatePayload }) =>
      api.put<CuotaPrestamo>(`/prestamos/cuotas/${id}`, data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: KEY_PRESTAMOS }); invalidateGlobales(qc); },
  });
}

export function useSubirDocumentoPrestamo(prestamoId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ archivo, nombre, descripcion }: { archivo: File; nombre?: string; descripcion?: string }) => {
      const fd = new FormData();
      fd.append('archivo', archivo);
      if (nombre)      fd.append('nombre', nombre);
      if (descripcion) fd.append('descripcion', descripcion);
      return api.post<DocumentoPrestamo>(`/prestamos/${prestamoId}/documentos`, fd).then(r => r.data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [...KEY_PRESTAMOS, prestamoId] }),
  });
}

export function useEliminarDocumentoPrestamo(prestamoId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (docId: number) => api.delete(`/prestamos/${prestamoId}/documentos/${docId}`),
    onSuccess:  () => qc.invalidateQueries({ queryKey: [...KEY_PRESTAMOS, prestamoId] }),
  });
}

export function documentoPrestamoUrl(prestamoId: number, docId: number): string {
  const base = (api.defaults.baseURL ?? '').replace(/\/$/, '');
  return `${base}/prestamos/${prestamoId}/documentos/${docId}`;
}
