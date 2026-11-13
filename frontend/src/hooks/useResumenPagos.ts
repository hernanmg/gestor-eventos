import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type {
  ResumenPagoSemanal, ResumenPagoSemanalDetalle, SugerenciaLineaPago, PreviewResumenPagos,
  ResultadoImportResumenPagos, SeccionLineaPago, TipoLineaPago, EstadoLineaPago,
} from '@/types';

const KEY = ['resumen-pagos'];

export function useResumenesPagos(anio?: number) {
  return useQuery<ResumenPagoSemanal[]>({
    queryKey: [...KEY, 'lista', anio ?? 'todos'],
    queryFn:  () => api.get('/resumen-pagos', { params: anio ? { anio } : {} }).then(r => r.data),
  });
}

export function useResumenPagos(id: number | null) {
  return useQuery<ResumenPagoSemanalDetalle>({
    queryKey: [...KEY, 'detalle', id],
    queryFn:  () => api.get(`/resumen-pagos/${id}`).then(r => r.data),
    enabled:  !!id,
  });
}

export function useSugerenciasPagos(id: number | null, enabled: boolean) {
  return useQuery<SugerenciaLineaPago[]>({
    queryKey: [...KEY, 'sugerencias', id],
    queryFn:  () => api.get(`/resumen-pagos/${id}/sugerencias`).then(r => r.data),
    enabled:  !!id && enabled,
  });
}

// Todas las mutaciones devuelven el detalle actualizado: se escribe directo en
// la caché del detalle y se invalida la lista (totales por semana).
function useMutacionResumen<V>(fn: (v: V) => Promise<ResumenPagoSemanalDetalle>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: data => {
      // puede_revisar sólo viene en el GET: se conserva el que ya estaba
      if (data?.id) qc.setQueryData<ResumenPagoSemanalDetalle>([...KEY, 'detalle', data.id], prev => ({ ...data, puede_revisar: prev?.puede_revisar ?? data.puede_revisar }));
      qc.invalidateQueries({ queryKey: [...KEY, 'lista'] });
      qc.invalidateQueries({ queryKey: [...KEY, 'sugerencias'] });
      qc.invalidateQueries({ queryKey: ['notificaciones'] });
    },
  });
}

export interface ResumenPayload {
  semana_desde:   string;
  semana_hasta:   string;
  titulo?:        string | null;
  notas?:         string | null;
  copiar_ultima?: boolean;
}

export const useCreateResumenPagos = () =>
  useMutacionResumen((d: ResumenPayload) => api.post('/resumen-pagos', d).then(r => r.data));

export const useUpdateResumenPagos = () =>
  useMutacionResumen(({ id, ...d }: Partial<ResumenPayload> & { id: number }) => api.patch(`/resumen-pagos/${id}`, d).then(r => r.data));

export const useEnviarResumenPagos = () =>
  useMutacionResumen((id: number) => api.post(`/resumen-pagos/${id}/enviar`).then(r => r.data));

export const useAprobarPendientes = () =>
  useMutacionResumen((id: number) => api.post(`/resumen-pagos/${id}/aprobar-pendientes`).then(r => r.data));

export function useDeleteResumenPagos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/resumen-pagos/${id}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export interface LineaPayload {
  seccion?:     SeccionLineaPago;
  tipo?:        TipoLineaPago;
  detalle:      string;
  importe:      number;
  observacion?: string | null;
  origen_ref?:  string | null;
}

export const useAddLineasPago = () =>
  useMutacionResumen(({ resumenId, lineas }: { resumenId: number; lineas: LineaPayload[] }) =>
    api.post(`/resumen-pagos/${resumenId}/lineas`, lineas).then(r => r.data));

export const useUpdateLineaPago = () =>
  useMutacionResumen(({ id, ...d }: Partial<LineaPayload> & { id: number }) => api.patch(`/resumen-pagos/lineas/${id}`, d).then(r => r.data));

export const useDeleteLineaPago = () =>
  useMutacionResumen((id: number) => api.delete(`/resumen-pagos/lineas/${id}`).then(r => r.data));

export const useRevisarLineaPago = () =>
  useMutacionResumen(({ id, ...d }: { id: number; estado: EstadoLineaPago; comentario?: string | null; importe_aprobado?: number | null }) =>
    api.post(`/resumen-pagos/lineas/${id}/revisar`, d).then(r => r.data));

function subirArchivo<T>(url: string, file: File) {
  const fd = new FormData();
  fd.append('archivo', file);
  return api.post<T>(url, fd, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data);
}

export function usePreviewImportPagos() {
  return useMutation({ mutationFn: (file: File) => subirArchivo<PreviewResumenPagos>('/resumen-pagos/importar/preview', file) });
}

export function useImportarPagos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => subirArchivo<ResultadoImportResumenPagos>('/resumen-pagos/importar', file),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
