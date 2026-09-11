import { useCallback, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type {
  RegistroAsistencia, EstadoAsistencia, PresentismoHoyResponse, ResumenMesResponse,
  ResumenMesEmpleadoResponse, CerrarMesPresentismoResultado,
} from '@/types';

const KEY = ['presentismo'] as const;

export interface RegistroAsistenciaPayload {
  empleado_id?:           number;
  fecha?:                 string;
  estado?:                EstadoAsistencia;
  hora_ingreso?:          string | null;
  hora_egreso?:           string | null;
  motivo?:                string | null;
  descuenta_presentismo?: boolean;
}

export interface ListaPresentismoFiltros {
  fecha?:       string;
  mes?:         number;
  anio?:        number;
  empleado_id?: number;
  estado?:      EstadoAsistencia;
}

// GET /presentismo — usado por la vista mensual (mes+anio) para traer todos
// los registros del período y cruzarlos con el roster de empleados activos.
export function usePresentismoLista(filtros: ListaPresentismoFiltros) {
  return useQuery<RegistroAsistencia[]>({
    queryKey: [...KEY, 'lista', filtros],
    queryFn:  () => api.get('/presentismo', { params: filtros }).then(r => r.data),
    enabled:  !!(filtros.fecha || (filtros.mes && filtros.anio)),
  });
}

// GET /presentismo/hoy — vista diaria: todos los empleados activos + su
// registro del día (o null si Lorena no lo cargó).
export function usePresentismoDia(fecha: string) {
  return useQuery<PresentismoHoyResponse>({
    queryKey: [...KEY, 'dia', fecha],
    queryFn:  () => api.get('/presentismo/hoy', { params: { fecha } }).then(r => r.data),
    enabled:  !!fecha,
  });
}

export function useResumenMes(mes: number, anio: number) {
  return useQuery<ResumenMesResponse>({
    queryKey: [...KEY, 'resumen-mes', mes, anio],
    queryFn:  () => api.get('/presentismo/resumen-mes', { params: { mes, anio } }).then(r => r.data),
    enabled:  !!mes && !!anio,
  });
}

export function useResumenMesEmpleado(empleadoId: number | null, mes: number, anio: number) {
  return useQuery<ResumenMesEmpleadoResponse>({
    queryKey: [...KEY, 'resumen-mes-empleado', empleadoId, mes, anio],
    queryFn:  () => api.get(`/presentismo/resumen-mes/${empleadoId}`, { params: { mes, anio } }).then(r => r.data),
    enabled:  empleadoId != null && !!mes && !!anio,
  });
}

function invalidarPresentismo(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: KEY });
  qc.invalidateQueries({ queryKey: ['notificaciones'] });
}

export function useUpsertRegistroAsistencia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Required<Pick<RegistroAsistenciaPayload, 'empleado_id' | 'fecha'>> & RegistroAsistenciaPayload) =>
      api.post<RegistroAsistencia>('/presentismo', data).then(r => r.data),
    onSuccess: () => invalidarPresentismo(qc),
  });
}

export function useUpdateRegistroAsistencia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: RegistroAsistenciaPayload }) =>
      api.put<RegistroAsistencia>(`/presentismo/${id}`, data).then(r => r.data),
    onSuccess: () => invalidarPresentismo(qc),
  });
}

export function useDeleteRegistroAsistencia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/presentismo/${id}`).then(r => r.data),
    onSuccess: () => invalidarPresentismo(qc),
  });
}

export function useMarcarTodosPresentes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (fecha: string) => api.post<{ creados: number }>('/presentismo/marcar-todos-presentes', { fecha }).then(r => r.data),
    onSuccess: () => invalidarPresentismo(qc),
  });
}

export function useCerrarMesPresentismo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { mes: number; anio: number }) =>
      api.post<CerrarMesPresentismoResultado>('/presentismo/cerrar-mes', data).then(r => r.data),
    onSuccess: () => invalidarPresentismo(qc),
  });
}

export function useAprobarTardanza() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, nota }: { id: number; nota?: string }) =>
      api.post<RegistroAsistencia>(`/presentismo/${id}/aprobar-tardanza`, { nota }).then(r => r.data),
    onSuccess: () => invalidarPresentismo(qc),
  });
}

export function useExportarPresentismo() {
  const [isExporting, setIsExporting] = useState(false);

  const exportar = useCallback(async (mes: number, anio: number) => {
    setIsExporting(true);
    try {
      const response = await api.get('/presentismo/exportar', { params: { mes, anio }, responseType: 'blob' });
      const cd       = (response.headers['content-disposition'] as string | undefined) ?? '';
      const filename = decodeURIComponent(cd.match(/filename="([^"]+)"/)?.[1] ?? `Presentismo_${mes}-${anio}.xlsx`);
      const url      = URL.createObjectURL(new Blob([response.data as BlobPart]));
      const a        = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  }, []);

  return { exportar, isExporting };
}

export function useRechazarTardanza() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, nota }: { id: number; nota?: string }) =>
      api.post<RegistroAsistencia>(`/presentismo/${id}/rechazar-tardanza`, { nota }).then(r => r.data),
    onSuccess: () => invalidarPresentismo(qc),
  });
}
