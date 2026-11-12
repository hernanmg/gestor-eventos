import { useCallback, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { BloqueCostoReal, CostoReal, CostoRealEventoFila, ImportarCampoResultado, ImportarMatrizResultado, LineaCostoReal } from '@/types';

// Costo real del evento (DOS57) — la matriz de Flor. Ver backend lib/costoReal.ts.

export const costoRealKey = (eventoId: number) => ['costo-real', eventoId] as const;

export function useCostoReal(eventoId: number) {
  return useQuery<CostoReal>({
    queryKey: costoRealKey(eventoId),
    queryFn:  () => api.get(`/eventos/${eventoId}/costo-real`).then(r => r.data),
  });
}

export function useCostoRealEventos() {
  return useQuery<CostoRealEventoFila[]>({
    queryKey: ['costo-real', 'eventos'],
    queryFn:  () => api.get('/costo-real').then(r => r.data),
  });
}

export interface LineaCostoRealPayload {
  bloque?:         BloqueCostoReal;
  concepto?:       string;
  detalle?:        string | null;
  codigo?:         string | null;
  cantidad?:       number;
  valor_unitario?: number;
  porcentaje?:     number | null;
  fecha_desde?:    string | null;
  fecha_hasta?:    string | null;
  notas?:          string | null;
}

// Cualquier cambio en un evento también mueve el total del tablero
function invalidar(qc: ReturnType<typeof useQueryClient>, eventoId: number) {
  qc.invalidateQueries({ queryKey: costoRealKey(eventoId) });
  qc.invalidateQueries({ queryKey: ['costo-real', 'eventos'] });
}

export function useCreateLineaCostoReal(eventoId: number) {
  const qc = useQueryClient();
  return useMutation<LineaCostoReal, Error, LineaCostoRealPayload & { bloque: BloqueCostoReal; concepto: string }>({
    mutationFn: data => api.post(`/eventos/${eventoId}/costo-real/lineas`, data).then(r => r.data),
    onSuccess:  () => invalidar(qc, eventoId),
  });
}

export function useUpdateLineaCostoReal(eventoId: number) {
  const qc = useQueryClient();
  return useMutation<LineaCostoReal, Error, { id: number; data: LineaCostoRealPayload }>({
    mutationFn: ({ id, data }) => api.put(`/costo-real/lineas/${id}`, data).then(r => r.data),
    onSuccess:  () => invalidar(qc, eventoId),
  });
}

export function useDeleteLineaCostoReal(eventoId: number) {
  const qc = useQueryClient();
  return useMutation<unknown, Error, number>({
    mutationFn: id => api.delete(`/costo-real/lineas/${id}`).then(r => r.data),
    onSuccess:  () => invalidar(qc, eventoId),
  });
}

export interface SincronizarResultado { creadas: number; reemplazadas: number; avisos: string[]; bloques: BloqueCostoReal[] }

export function useSincronizarCostoReal(eventoId: number) {
  const qc = useQueryClient();
  return useMutation<SincronizarResultado, Error, BloqueCostoReal>({
    mutationFn: bloque => api.post(`/eventos/${eventoId}/costo-real/sincronizar`, { bloque }).then(r => r.data),
    onSuccess:  () => invalidar(qc, eventoId),
  });
}

/** preview=true sólo analiza el archivo; false lo importa */
export function useImportarMatriz(eventoId: number) {
  const qc = useQueryClient();
  return useMutation<ImportarMatrizResultado, Error, { file: File; preview: boolean }>({
    mutationFn: ({ file, preview }) => {
      const fd = new FormData();
      fd.append('archivo', file);
      return api.post(`/eventos/${eventoId}/costo-real/importar?preview=${preview}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }).then(r => r.data);
    },
    onSuccess: (r) => { if (!r.preview) invalidar(qc, eventoId); },
  });
}

/** Planillas de campo completas (horas, viandas, alojamiento, pañol, combustible) */
export function useImportarCampo(eventoId: number) {
  const qc = useQueryClient();
  return useMutation<ImportarCampoResultado, Error, { file: File; preview: boolean }>({
    mutationFn: ({ file, preview }) => {
      const fd = new FormData();
      fd.append('archivo', file);
      return api.post(`/eventos/${eventoId}/costo-real/importar-campo?preview=${preview}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }).then(r => r.data);
    },
    onSuccess: (r) => { if (!r.preview) invalidar(qc, eventoId); },
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

/** Excel imprimible con las planillas del evento precargadas */
export function descargarPlanillasCampo(eventoId: number) {
  return descargar(`/eventos/${eventoId}/costo-real/planillas-campo`, `planillas-campo-evento-${eventoId}.xlsx`);
}

export function useExportarCostoReal() {
  const [exportando, setExportando] = useState<number | null>(null);
  const exportar = useCallback(async (eventoId: number) => {
    setExportando(eventoId);
    try {
      await descargar(`/eventos/${eventoId}/costo-real/exportar`, `costo-real-evento-${eventoId}.xlsx`);
    } finally {
      setExportando(null);
    }
  }, []);
  return { exportar, exportando };
}
