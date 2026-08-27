import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type {
  VehiculoFlota, VehiculoFlotaDetalle, SeguroVehiculo, PatenteVehiculo,
  GastoPeaje, ServicioTaller, AlertaFlotaItem, Moneda,
} from '@/types';

const KEY = ['flota'] as const;

// El Calendario agrega seguros/patentes/taller de Flota (ver calendario.controller.ts
// SEGURO_VENCE/PATENTE_VENCE/TALLER_RETIRO) — cualquier mutación que cambie esos
// datos debe invalidar también su query para que se refleje sin recargar la página.
function invalidateCalendario(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['calendario'] });
}

// ── Vehículos ─────────────────────────────────────────────────────────────────

export interface VehiculoFiltros {
  en_servicio?: 'true' | 'false';
  tipo?:        string;
}

export function useVehiculosFlota(filtros: VehiculoFiltros = {}) {
  return useQuery({
    queryKey: [...KEY, 'vehiculos', filtros],
    queryFn:  () => api.get<VehiculoFlota[]>('/flota/vehiculos', { params: filtros }).then(r => r.data),
  });
}

export function useVehiculoFlota(id: number | null) {
  return useQuery({
    queryKey: [...KEY, 'vehiculos', id],
    queryFn:  () => api.get<VehiculoFlotaDetalle>(`/flota/vehiculos/${id}`).then(r => r.data),
    enabled:  id != null,
  });
}

export interface VehiculoPayload {
  codigo:          string;
  descripcion?:    string | null;
  patente?:        string | null;
  tipo?:           string | null;
  marca?:          string | null;
  modelo?:         string | null;
  anio?:           number | null;
  color?:          string | null;
  titular?:        string | null;
  numero_telepase?: string | null;
}

export function useCreateVehiculoFlota() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: VehiculoPayload) => api.post<VehiculoFlota>('/flota/vehiculos', data).then(r => r.data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: [...KEY, 'vehiculos'] }),
  });
}

export function useUpdateVehiculoFlota(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<VehiculoPayload>) => api.put<VehiculoFlota>(`/flota/vehiculos/${id}`, data).then(r => r.data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: [...KEY, 'vehiculos'] }),
  });
}

export function useDarDeBajaVehiculo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, motivo_baja }: { id: number; motivo_baja: string }) =>
      api.delete(`/flota/vehiculos/${id}`, { data: { motivo_baja } }).then(r => r.data),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: [...KEY, 'vehiculos'] });
      qc.invalidateQueries({ queryKey: [...KEY, 'seguros'] });
      invalidateCalendario(qc);
    },
  });
}

// ── Seguros ───────────────────────────────────────────────────────────────────

export interface SeguroFiltros {
  vehiculo_id?: number;
  aseguradora?: string;
  estado?:      string;
}

export function useSegurosFlota(filtros: SeguroFiltros = {}) {
  return useQuery({
    queryKey: [...KEY, 'seguros', filtros],
    queryFn:  () => api.get<SeguroVehiculo[]>('/flota/seguros', { params: filtros }).then(r => r.data),
  });
}

export function useSegurosVehiculo(vehiculoId: number | null) {
  return useQuery({
    queryKey: [...KEY, 'vehiculos', vehiculoId, 'seguros'],
    queryFn:  () => api.get<SeguroVehiculo[]>(`/flota/vehiculos/${vehiculoId}/seguros`).then(r => r.data),
    enabled:  vehiculoId != null,
  });
}

export interface SeguroPayload {
  aseguradora:       string;
  numero_poliza?:    string | null;
  tipo_cobertura?:   string | null;
  fecha_inicio:      string;
  fecha_vencimiento: string;
  importe_anual?:    number | null;
  moneda?:           Moneda;
  notas?:            string | null;
  archivo?:          File | null;
}

function seguroFormData(data: Partial<SeguroPayload>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(data)) {
    if (key === 'archivo') { if (value) fd.append('poliza', value as File); continue; }
    if (value !== undefined && value !== null) fd.append(key, String(value));
  }
  return fd;
}

export function useCreateSeguroVehiculo(vehiculoId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: SeguroPayload) => api.post<SeguroVehiculo>(`/flota/vehiculos/${vehiculoId}/seguros`, seguroFormData(data)).then(r => r.data),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: [...KEY, 'seguros'] });
      qc.invalidateQueries({ queryKey: [...KEY, 'vehiculos'] });
      invalidateCalendario(qc);
    },
  });
}

export function useUpdateSeguroVehiculo(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<SeguroPayload>) => api.put<SeguroVehiculo>(`/flota/seguros/${id}`, seguroFormData(data)).then(r => r.data),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: [...KEY, 'seguros'] });
      qc.invalidateQueries({ queryKey: [...KEY, 'vehiculos'] });
      invalidateCalendario(qc);
    },
  });
}

export function useDeleteSeguroVehiculo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/flota/seguros/${id}`),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: [...KEY, 'seguros'] });
      qc.invalidateQueries({ queryKey: [...KEY, 'vehiculos'] });
      invalidateCalendario(qc);
    },
  });
}

export function polizaSeguroUrl(id: number): string {
  const base = (api.defaults.baseURL ?? '').replace(/\/$/, '');
  return `${base}/flota/seguros/${id}/poliza`;
}

// ── Patentes ──────────────────────────────────────────────────────────────────

export interface PatenteFiltros {
  vehiculo_id?: number;
  tipo?:        string;
  anio?:        number;
  estado?:      string;
}

export function usePatentesFlota(filtros: PatenteFiltros = {}) {
  return useQuery({
    queryKey: [...KEY, 'patentes', filtros],
    queryFn:  () => api.get<PatenteVehiculo[]>('/flota/patentes', { params: filtros }).then(r => r.data),
  });
}

export function usePatentesVehiculo(vehiculoId: number | null) {
  return useQuery({
    queryKey: [...KEY, 'vehiculos', vehiculoId, 'patentes'],
    queryFn:  () => api.get<PatenteVehiculo[]>(`/flota/vehiculos/${vehiculoId}/patentes`).then(r => r.data),
    enabled:  vehiculoId != null,
  });
}

export interface PatentePayload {
  tipo:              'MUNICIPAL' | 'PROVINCIAL' | 'NACIONAL';
  anio:              number;
  cuota?:            number | null;
  importe:           number;
  fecha_vencimiento: string;
  notas?:            string | null;
}

export function useCreatePatenteVehiculo(vehiculoId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: PatentePayload) => api.post<PatenteVehiculo>(`/flota/vehiculos/${vehiculoId}/patentes`, data).then(r => r.data),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: [...KEY, 'patentes'] });
      qc.invalidateQueries({ queryKey: [...KEY, 'vehiculos'] });
      invalidateCalendario(qc);
    },
  });
}

export function useRegistrarPagoPatente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, fecha_pago, archivo }: { id: number; fecha_pago: string; archivo?: File | null }) => {
      const fd = new FormData();
      fd.append('estado', 'PAGADA');
      fd.append('fecha_pago', fecha_pago);
      if (archivo) fd.append('comprobante', archivo);
      return api.put<PatenteVehiculo>(`/flota/patentes/${id}`, fd).then(r => r.data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...KEY, 'patentes'] });
      qc.invalidateQueries({ queryKey: [...KEY, 'vehiculos'] });
      invalidateCalendario(qc);
    },
  });
}

// ── Peajes / Telepase ─────────────────────────────────────────────────────────

export interface PeajeFiltros {
  camion_id?: number;
  desde?:     string;
  hasta?:     string;
  evento_id?: number;
}

export function usePeajesFlota(filtros: PeajeFiltros = {}) {
  return useQuery({
    queryKey: [...KEY, 'peajes', filtros],
    queryFn:  () => api.get<GastoPeaje[]>('/flota/peajes', { params: filtros }).then(r => r.data),
  });
}

export function usePeajesVehiculo(vehiculoId: number | null) {
  return useQuery({
    queryKey: [...KEY, 'vehiculos', vehiculoId, 'peajes'],
    queryFn:  () => api.get<GastoPeaje[]>(`/flota/vehiculos/${vehiculoId}/peajes`).then(r => r.data),
    enabled:  vehiculoId != null,
  });
}

export interface PeajePayload {
  camion_id:            number;
  fecha:                string;
  ruta?:                string | null;
  importe:              number;
  evento_id?:           number | null;
  es_carga_telepase?:   boolean;
  saldo_telepase_post?: number | null;
  notas?:               string | null;
}

export function useCreatePeaje() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: PeajePayload) => api.post<GastoPeaje>('/flota/peajes', data).then(r => r.data),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: [...KEY, 'peajes'] });
      qc.invalidateQueries({ queryKey: [...KEY, 'vehiculos'] });
    },
  });
}

export function useDeletePeaje() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/flota/peajes/${id}`),
    onSuccess:  () => qc.invalidateQueries({ queryKey: [...KEY, 'peajes'] }),
  });
}

// ── Taller mecánico ───────────────────────────────────────────────────────────

export interface TallerFiltros {
  estado?:    string;
  camion_id?: number;
  taller?:    string;
}

export function useTallerFlota(filtros: TallerFiltros = {}) {
  return useQuery({
    queryKey: [...KEY, 'taller', filtros],
    queryFn:  () => api.get<ServicioTaller[]>('/flota/taller', { params: filtros }).then(r => r.data),
  });
}

export function useTallerVehiculo(vehiculoId: number | null) {
  return useQuery({
    queryKey: [...KEY, 'vehiculos', vehiculoId, 'taller'],
    queryFn:  () => api.get<ServicioTaller[]>(`/flota/vehiculos/${vehiculoId}/taller`).then(r => r.data),
    enabled:  vehiculoId != null,
  });
}

export interface TallerPayload {
  camion_id:           number;
  taller_nombre?:      string | null;
  tipo:                'MANTENIMIENTO' | 'REPARACION' | 'NEUMATICOS' | 'CHAPERIA_PINTURA' | 'ELECTRICIDAD' | 'OTROS';
  descripcion:         string;
  fecha_ingreso:       string;
  fecha_estimada?:     string | null;
  presupuesto?:        number | null;
  cuenta_corriente_id?: number | null;
  notas?:              string | null;
}

export function useCreateServicioTaller() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: TallerPayload) => api.post<ServicioTaller>('/flota/taller', data).then(r => r.data),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: [...KEY, 'taller'] });
      qc.invalidateQueries({ queryKey: [...KEY, 'vehiculos'] });
      invalidateCalendario(qc);
    },
  });
}

export interface ActualizarTallerPayload extends Partial<TallerPayload> {
  estado?:        string;
  fecha_retiro?:  string | null;
  importe_final?: number | null;
}

export function useUpdateServicioTaller() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: ActualizarTallerPayload }) =>
      api.put<ServicioTaller>(`/flota/taller/${id}`, data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...KEY, 'taller'] });
      qc.invalidateQueries({ queryKey: [...KEY, 'vehiculos'] });
      invalidateCalendario(qc);
    },
  });
}

export function useDeleteServicioTaller() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/flota/taller/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...KEY, 'taller'] });
      qc.invalidateQueries({ queryKey: [...KEY, 'vehiculos'] });
      invalidateCalendario(qc);
    },
  });
}

// ── Alertas ───────────────────────────────────────────────────────────────────

export function useAlertasFlota() {
  return useQuery({
    queryKey: [...KEY, 'alertas'],
    queryFn:  () => api.get<{ items: AlertaFlotaItem[] }>('/flota/alertas').then(r => r.data),
    staleTime: 5 * 60 * 1000,
  });
}
