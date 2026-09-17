import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { SiniestroEmpleado, GastoSiniestro, DocumentoSiniestro, TipoSiniestro, EstadoSiniestro } from '@/types';

const SINIESTROS_KEY = ['siniestros'];

export interface SiniestroFiltros {
  estado?:      EstadoSiniestro;
  empleado_id?: number;
  desde?:       string;
  hasta?:       string;
}

export function useSiniestros(filtros: SiniestroFiltros = {}) {
  return useQuery<SiniestroEmpleado[]>({
    queryKey: [...SINIESTROS_KEY, filtros],
    queryFn:  () => api.get('/siniestros', { params: filtros }).then(r => r.data),
  });
}

export function useSiniestro(id: number | null) {
  return useQuery<SiniestroEmpleado>({
    queryKey: [...SINIESTROS_KEY, id],
    queryFn:  () => api.get(`/siniestros/${id}`).then(r => r.data),
    enabled:  id !== null,
  });
}

export interface SiniestroPayload {
  empleado_id:          number;
  tipo:                 TipoSiniestro;
  fecha_ocurrencia:     string;
  descripcion:          string;
  lugar?:               string | null;
  evento_id?:           number | null;
  art_nombre?:          string | null;
  art_numero_siniestro?: string | null;
  fecha_denuncia_art?:  string | null;
}

export function useCreateSiniestro() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: SiniestroPayload) => api.post('/siniestros', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: SINIESTROS_KEY }),
  });
}

export function useUpdateSiniestro(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<SiniestroPayload> & { estado?: EstadoSiniestro; dias_baja?: number | null; fecha_alta_medica?: string | null }) =>
      api.put(`/siniestros/${id}`, data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SINIESTROS_KEY });
      qc.invalidateQueries({ queryKey: [...SINIESTROS_KEY, id] });
    },
  });
}

export function useCerrarSiniestro() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.patch(`/siniestros/${id}/cerrar`).then(r => r.data),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: SINIESTROS_KEY });
      qc.invalidateQueries({ queryKey: [...SINIESTROS_KEY, id] });
    },
  });
}

export interface GastoSiniestroPayload {
  fecha:          string;
  descripcion:    string;
  monto:          number;
  cubierto_art:   boolean;
  monto_cubierto?: number | null;
  monto_empresa?:  number | null;
}

export function useAddGastoSiniestro(siniestroId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: GastoSiniestroPayload) => api.post<GastoSiniestro>(`/siniestros/${siniestroId}/gastos`, data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SINIESTROS_KEY });
      qc.invalidateQueries({ queryKey: [...SINIESTROS_KEY, siniestroId] });
    },
  });
}

export function useDeleteGastoSiniestro(siniestroId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (gastoId: number) => api.delete(`/siniestros/${siniestroId}/gastos/${gastoId}`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SINIESTROS_KEY });
      qc.invalidateQueries({ queryKey: [...SINIESTROS_KEY, siniestroId] });
    },
  });
}

export function useSubirDocumentoSiniestro(siniestroId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ file, nombre, descripcion }: { file: File; nombre?: string; descripcion?: string }) => {
      const formData = new FormData();
      formData.append('archivo', file);
      if (nombre)      formData.append('nombre', nombre);
      if (descripcion) formData.append('descripcion', descripcion);
      return api.post<DocumentoSiniestro>(`/siniestros/${siniestroId}/documentos`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }).then(r => r.data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [...SINIESTROS_KEY, siniestroId] }),
  });
}

export function documentoSiniestroUrl(siniestroId: number, docId: number): string {
  const base = (api.defaults.baseURL ?? '').replace(/\/$/, '');
  return `${base}/siniestros/${siniestroId}/documentos/${docId}`;
}
