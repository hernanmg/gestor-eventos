import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type {
  CargaCombustible, ResumenMensualCombustibleItem, ResumenSemanalCombustible, AnalisisAnualCombustible,
  TipoCombustible,
} from '@/types';

const KEY = ['combustible'] as const;

// ── Cargas ────────────────────────────────────────────────────────────────────

export interface CombustibleFiltros {
  camion_id?: number;
  desde?:     string;
  hasta?:     string;
  evento_id?: number;
  estado?:    string;
  mes?:       number;
  anio?:      number;
}

export function useCombustible(filtros: CombustibleFiltros = {}) {
  return useQuery({
    queryKey: [...KEY, 'cargas', filtros],
    queryFn:  () => api.get<CargaCombustible[]>('/combustible', { params: filtros }).then(r => r.data),
  });
}

export interface CombustiblePayload {
  camion_id:            number;
  fecha:                string;
  tipo_combustible?:    TipoCombustible;
  litros:               number;
  precio_por_litro?:    number | null;
  monto_total:          number;
  estacion_nombre?:     string | null;
  estacion_ciudad?:     string | null;
  km_actual?:           number | null;
  evento_id?:           number | null;
  cuenta_corriente_id?: number | null;
  responsable_nombre?:  string | null;
  numero_comprobante?:  string | null;
  tipo_movimiento?:     string | null;
  pagos?:               number | null;
  saldo?:               number | null;
  notas?:               string | null;
  archivo?:             File | null;
}

function cargaFormData(data: Partial<CombustiblePayload>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(data)) {
    if (key === 'archivo') { if (value) fd.append('comprobante', value as File); continue; }
    if (value !== undefined && value !== null) fd.append(key, String(value));
  }
  return fd;
}

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: KEY });
}

export function useCreateCombustible() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CombustiblePayload) => api.post<CargaCombustible>('/combustible', cargaFormData(data)).then(r => r.data),
    onSuccess:  () => invalidateAll(qc),
  });
}

export function useUpdateCombustible() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CombustiblePayload> }) =>
      api.put<CargaCombustible>(`/combustible/${id}`, cargaFormData(data)).then(r => r.data),
    onSuccess:  () => invalidateAll(qc),
  });
}

export function useDeleteCombustible() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/combustible/${id}`),
    onSuccess:  () => invalidateAll(qc),
  });
}

export function useAutorizarCombustible() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.patch<CargaCombustible>(`/combustible/${id}/autorizar`).then(r => r.data),
    onSuccess:  () => invalidateAll(qc),
  });
}

export function useRechazarCombustible() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.patch<CargaCombustible>(`/combustible/${id}/rechazar`).then(r => r.data),
    onSuccess:  () => invalidateAll(qc),
  });
}

export function usePendientesAutorizacionCombustible() {
  return useQuery({
    queryKey: [...KEY, 'pendientes'],
    queryFn:  () => api.get<CargaCombustible[]>('/combustible/pendientes-autorizacion').then(r => r.data),
  });
}

// ── Resúmenes ─────────────────────────────────────────────────────────────────

export function useResumenMensualCombustible(mes: number, anio: number) {
  return useQuery({
    queryKey: [...KEY, 'resumen-mensual', mes, anio],
    queryFn:  () => api.get<ResumenMensualCombustibleItem[]>('/combustible/resumen-mensual', { params: { mes, anio } }).then(r => r.data),
  });
}

export function useResumenSemanalCombustible(mes: number, anio: number) {
  return useQuery({
    queryKey: [...KEY, 'resumen-semanal', mes, anio],
    queryFn:  () => api.get<{ semanas: ResumenSemanalCombustible[] }>('/combustible/resumen-semanal', { params: { mes, anio } }).then(r => r.data.semanas),
  });
}

export function useAnalisisAnualCombustible(anio: number) {
  return useQuery({
    queryKey: [...KEY, 'analisis-anual', anio],
    queryFn:  () => api.get<AnalisisAnualCombustible>('/combustible/analisis-anual', { params: { anio } }).then(r => r.data),
  });
}

// ── Importar / Exportar ───────────────────────────────────────────────────────

export interface ImportarCombustibleResultado {
  hojas_procesadas:     number;
  creados:              number;
  omitidos:             number;
  actualizados:         number;
  errores:              string[];
  vehiculos_creados:    { codigo: string; patente: string }[];
  vehiculos_vinculados: number;
}

export function useImportarCombustible() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (archivo: File) => {
      const fd = new FormData();
      fd.append('archivo', archivo);
      return api.post<ImportarCombustibleResultado>('/combustible/importar', fd).then(r => r.data);
    },
    onSuccess: () => invalidateAll(qc),
  });
}

export function exportarCombustibleUrl(anio: number): string {
  const base = (api.defaults.baseURL ?? '').replace(/\/$/, '');
  return `${base}/combustible/exportar?anio=${anio}`;
}
