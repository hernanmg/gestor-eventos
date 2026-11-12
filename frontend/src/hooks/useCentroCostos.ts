import { useCallback, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { CentroCostos, ExtraEvento, Moneda } from '@/types';
import { fichaKey } from './useFichaEvento';

// Bajo ['movimientos', eventoId] para que cualquier mutación de movimientos
// (useMovimientos.invalidate) lo refresque.
export const centroCostosKey = (eventoId: number) => ['movimientos', eventoId, 'centro-costos'] as const;

export function useCentroCostos(eventoId: number) {
  return useQuery<CentroCostos>({
    queryKey: centroCostosKey(eventoId),
    queryFn:  () => api.get(`/eventos/${eventoId}/centro-costos`).then(r => r.data),
  });
}

export interface ExtraPayload {
  descripcion?:     string;
  responsable?:     string | null;
  moneda?:          Moneda;
  neto?:            number;
  iva?:             number;
  pagado?:          boolean;
  plazo_pago?:      string | null;
  datos_cuenta?:    string | null;
  factura?:         string | null;
  notas?:           string | null;
  a_cargo_cliente?: boolean;
}

// Un extra a cargo de la empresa genera/actualiza una línea de Gastos Extra →
// se invalida todo lo de movimientos del evento, no sólo el centro de costos.
function invalidar(qc: ReturnType<typeof useQueryClient>, eventoId: number) {
  qc.invalidateQueries({ queryKey: ['movimientos', eventoId] });
  qc.invalidateQueries({ queryKey: fichaKey(eventoId) });
}

export function useCreateExtra(eventoId: number) {
  const qc = useQueryClient();
  return useMutation<ExtraEvento, Error, ExtraPayload & { descripcion: string }>({
    mutationFn: data => api.post(`/eventos/${eventoId}/centro-costos/extras`, data).then(r => r.data),
    onSuccess:  () => invalidar(qc, eventoId),
  });
}

export function useUpdateExtra(eventoId: number) {
  const qc = useQueryClient();
  return useMutation<ExtraEvento, Error, { id: number; data: ExtraPayload }>({
    mutationFn: ({ id, data }) => api.put(`/extras-evento/${id}`, data).then(r => r.data),
    onSuccess:  () => invalidar(qc, eventoId),
  });
}

export function useDeleteExtra(eventoId: number) {
  const qc = useQueryClient();
  return useMutation<unknown, Error, number>({
    mutationFn: id => api.delete(`/extras-evento/${id}`).then(r => r.data),
    onSuccess:  () => invalidar(qc, eventoId),
  });
}

export function useSubirComprobanteExtra(eventoId: number) {
  const qc = useQueryClient();
  return useMutation<ExtraEvento, Error, { id: number; file: File }>({
    mutationFn: ({ id, file }) => {
      const fd = new FormData();
      fd.append('comprobante', file);
      return api.post(`/extras-evento/${id}/comprobante`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: centroCostosKey(eventoId) }),
  });
}

export function useQuitarComprobanteExtra(eventoId: number) {
  const qc = useQueryClient();
  return useMutation<ExtraEvento, Error, number>({
    mutationFn: id => api.delete(`/extras-evento/${id}/comprobante`).then(r => r.data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: centroCostosKey(eventoId) }),
  });
}

async function descargar(url: string, fallback: string) {
  const response = await api.get(url, { responseType: 'blob' });
  const cd       = (response.headers['content-disposition'] as string | undefined) ?? '';
  const filename = decodeURIComponent(cd.match(/filename="([^"]+)"/)?.[1] ?? fallback);
  const href     = URL.createObjectURL(new Blob([response.data as BlobPart]));
  const a        = document.createElement('a');
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(href);
}

export function descargarComprobanteExtra(extra: ExtraEvento) {
  return descargar(`/extras-evento/${extra.id}/comprobante`, extra.comprobante_nombre ?? 'comprobante');
}

/** hoja 'extras' = sólo la hoja Extras (para mandarle al cliente) */
export function useExportarCentroCostos() {
  const [isExporting, setIsExporting] = useState(false);
  const exportar = useCallback(async (eventoId: number, hoja?: 'extras') => {
    setIsExporting(true);
    try {
      await descargar(
        `/eventos/${eventoId}/centro-costos/exportar${hoja ? `?hoja=${hoja}` : ''}`,
        `centro-costos-evento-${eventoId}.xlsx`,
      );
    } finally {
      setIsExporting(false);
    }
  }, []);
  return { exportar, isExporting };
}
