import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type {
  EspacioCompartido, ParteEspacio, GastoTipoEspacio,
  GastoMesEspacioResumen, GastoMesEspacio, LineaGastoEspacio,
} from '@/types';

const KEY = ['espacios-compartidos'] as const;

// El Calendario y la campanita de notificaciones agregan los vencimientos de
// líneas de gasto (ver calendario.controller.ts GASTO_ESPACIO_VENCE y
// notificaciones.controller.ts) — cualquier mutación que cambie una línea debe
// invalidar esas queries para reflejarse sin recargar.
function invalidateGlobales(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['calendario'] });
  qc.invalidateQueries({ queryKey: ['notificaciones'] });
}

// ── Espacios ──────────────────────────────────────────────────────────────────

export function useEspaciosCompartidos() {
  return useQuery({
    queryKey: KEY,
    queryFn:  () => api.get<EspacioCompartido[]>('/espacios-compartidos').then(r => r.data),
  });
}

export function useEspacioCompartido(id: number | null) {
  return useQuery({
    queryKey: [...KEY, id],
    queryFn:  () => api.get<EspacioCompartido>(`/espacios-compartidos/${id}`).then(r => r.data),
    enabled:  id != null,
  });
}

export interface ParteInput {
  nombre:              string;
  porcentaje:          number;
  empresa_id?:         number | null;
  cuenta_corriente_id?: number | null;
}

export interface EspacioPayload {
  nombre:         string;
  descripcion?:   string | null;
  direccion?:     string | null;
  dia_generacion: number;
  partes:         ParteInput[];
}

export function useCreateEspacio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: EspacioPayload) => api.post<EspacioCompartido>('/espacios-compartidos', data).then(r => r.data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateEspacio(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Omit<EspacioPayload, 'partes'>> & { activo?: boolean }) =>
      api.put<EspacioCompartido>(`/espacios-compartidos/${id}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useGenerarMesActual() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ generados: string[]; mes: number; anio: number }>('/espacios-compartidos/generar-mes-actual').then(r => r.data),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: KEY }); invalidateGlobales(qc); },
  });
}

export function useGenerarMes(espacioId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { mes: number; anio: number }) => api.post<GastoMesEspacio>(`/espacios-compartidos/${espacioId}/generar-mes`, data).then(r => r.data),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: KEY }); invalidateGlobales(qc); },
  });
}

// ── Partes ────────────────────────────────────────────────────────────────────

export function useCreateParte(espacioId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ParteInput) => api.post<ParteEspacio>(`/espacios-compartidos/${espacioId}/partes`, data).then(r => r.data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateParte() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<ParteInput> }) => api.put<ParteEspacio>(`/espacios-compartidos/partes/${id}`, data).then(r => r.data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useRemoveParte() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/espacios-compartidos/partes/${id}`),
    onSuccess:  () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

// ── Tipos de gasto fijo ───────────────────────────────────────────────────────

export interface GastoTipoInput {
  nombre:          string;
  monto_estimado:  number;
  dia_vencimiento?: number | null;
  es_fijo?:        boolean;
}

export function useCreateGastoTipo(espacioId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: GastoTipoInput) => api.post<GastoTipoEspacio>(`/espacios-compartidos/${espacioId}/gastos-tipo`, data).then(r => r.data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateGastoTipo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<GastoTipoInput> & { activo?: boolean } }) =>
      api.put<GastoTipoEspacio>(`/espacios-compartidos/gastos-tipo/${id}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useRemoveGastoTipo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/espacios-compartidos/gastos-tipo/${id}`),
    onSuccess:  () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

// ── Meses ─────────────────────────────────────────────────────────────────────

export function useMesesEspacio(espacioId: number | null, anio?: number) {
  return useQuery({
    queryKey: [...KEY, espacioId, 'meses', anio],
    queryFn:  () => api.get<GastoMesEspacioResumen[]>(`/espacios-compartidos/${espacioId}/meses`, { params: anio ? { anio } : {} }).then(r => r.data),
    enabled:  espacioId != null,
  });
}

export function useMesDetalle(espacioId: number | null, mes: number, anio: number) {
  return useQuery({
    queryKey: [...KEY, espacioId, 'mes', mes, anio],
    queryFn:  () => api.get<GastoMesEspacio | null>(`/espacios-compartidos/${espacioId}/meses/${mes}/${anio}`).then(r => r.data),
    enabled:  espacioId != null,
  });
}

export function useCerrarMes(espacioId: number, mes: number, anio: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<GastoMesEspacio>(`/espacios-compartidos/${espacioId}/meses/${mes}/${anio}/cerrar`).then(r => r.data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: [...KEY, espacioId] }),
  });
}

// ── Líneas ────────────────────────────────────────────────────────────────────

export interface LineaManualInput {
  nombre:            string;
  monto_real:        number;
  fecha_vencimiento?: string | null;
}

export function useAgregarLineaManual(espacioId: number, mes: number, anio: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: LineaManualInput) => api.post<LineaGastoEspacio>(`/espacios-compartidos/${espacioId}/meses/${mes}/${anio}/lineas`, data).then(r => r.data),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: [...KEY, espacioId] }); invalidateGlobales(qc); },
  });
}

export function useUpdateLinea(espacioId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<LineaManualInput> & { notas?: string | null } }) =>
      api.put<LineaGastoEspacio>(`/espacios-compartidos/lineas/${id}`, data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [...KEY, espacioId] }); invalidateGlobales(qc); },
  });
}

export function usePagarLinea(espacioId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, fecha_pago, comprobante }: { id: number; fecha_pago: string; comprobante?: File }) => {
      const fd = new FormData();
      fd.append('fecha_pago', fecha_pago);
      if (comprobante) fd.append('comprobante', comprobante);
      return api.patch<LineaGastoEspacio>(`/espacios-compartidos/lineas/${id}/pagar`, fd).then(r => r.data);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: [...KEY, espacioId] }); qc.invalidateQueries({ queryKey: KEY }); invalidateGlobales(qc); },
  });
}

export function useRemoveLinea(espacioId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/espacios-compartidos/lineas/${id}`),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: [...KEY, espacioId] }); invalidateGlobales(qc); },
  });
}

export function comprobanteLineaUrl(lineaId: number): string {
  const base = (api.defaults.baseURL ?? '').replace(/\/$/, '');
  return `${base}/espacios-compartidos/lineas/${lineaId}/comprobante`;
}
