import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { CierreContable, EstadoCierreContable } from '@/types';

const KEY = ['cierre-contable'];

export function useCierresContables() {
  return useQuery<CierreContable[]>({
    queryKey: KEY,
    queryFn:  () => api.get('/cierre-contable').then(r => r.data),
  });
}

export function useCierreContable(id: number | null) {
  return useQuery<CierreContable>({
    queryKey: [...KEY, id],
    queryFn:  () => api.get(`/cierre-contable/${id}`).then(r => r.data),
    enabled:  id !== null,
  });
}

export function useGenerarCierreContable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { empresa_id: number; fecha_corte: string }) =>
      api.post<CierreContable>('/cierre-contable/generar', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateEstadoCierreContable(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (estado: EstadoCierreContable) =>
      api.patch<CierreContable>(`/cierre-contable/${id}/estado`, { estado }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateNotaSeccionCierreContable(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ seccion, texto }: { seccion: string; texto: string | null }) =>
      api.patch<CierreContable>(`/cierre-contable/${id}/notas`, { seccion, texto }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export async function descargarCierreContable(id: number, nombreArchivo: string): Promise<void> {
  const res  = await api.get(`/cierre-contable/${id}/exportar`, { responseType: 'blob' });
  const url  = URL.createObjectURL(new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const a    = document.createElement('a');
  a.href     = url;
  a.download = nombreArchivo;
  a.click();
  URL.revokeObjectURL(url);
}
