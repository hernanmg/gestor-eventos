import { useCallback, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { PedidoComida, LineaComida, TipoComida, ResumenComidaFecha } from '@/types';

export const comidasKey = (eventoId: number) => ['eventos', eventoId, 'comidas'];

// ── Pedido de comida ──────────────────────────────────────────────────────────

export function useComidas(eventoId: number) {
  return useQuery<PedidoComida[]>({
    queryKey: comidasKey(eventoId),
    queryFn:  () => api.get(`/eventos/${eventoId}/comidas`).then(r => r.data),
    enabled:  !!eventoId,
  });
}

// GET /eventos/:id/comidas/:fecha — 404 si no existe (no crea automáticamente)
export function usePedidoComida(eventoId: number, fecha: string) {
  return useQuery<PedidoComida | null>({
    queryKey: [...comidasKey(eventoId), fecha],
    queryFn:  () => api.get(`/eventos/${eventoId}/comidas/${fecha}`).then(r => r.data).catch(err => {
      if (err?.response?.status === 404) return null;
      throw err;
    }),
    enabled: !!eventoId && !!fecha,
  });
}

export function useResumenComidas(eventoId: number) {
  return useQuery<ResumenComidaFecha[]>({
    queryKey: [...comidasKey(eventoId), 'resumen'],
    queryFn:  () => api.get(`/eventos/${eventoId}/comidas/resumen`).then(r => r.data),
    enabled:  !!eventoId,
  });
}

export interface PedidoComidaPayload {
  proveedor_id?:    number | null;
  proveedor_texto?: string | null;
  forma_pago?:      string | null;
  notas?:           string | null;
}

export function useCreatePedido(eventoId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ fecha, data }: { fecha: string; data?: PedidoComidaPayload }) =>
      api.post<PedidoComida>(`/eventos/${eventoId}/comidas`, { fecha, ...data }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: comidasKey(eventoId) }),
  });
}

export function useUpdatePedido(eventoId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: PedidoComidaPayload }) =>
      api.put<PedidoComida>(`/comidas/${id}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: comidasKey(eventoId) }),
  });
}

export function useDeletePedido(eventoId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/comidas/${id}`).then(r => r.data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: comidasKey(eventoId) }),
  });
}

export function useExportarComidas() {
  const [isExporting, setIsExporting] = useState(false);

  const exportar = useCallback(async (eventoId: number) => {
    setIsExporting(true);
    try {
      const response = await api.get(`/eventos/${eventoId}/comidas/exportar`, { responseType: 'blob' });
      const cd       = (response.headers['content-disposition'] as string | undefined) ?? '';
      const filename = decodeURIComponent(cd.match(/filename="([^"]+)"/)?.[1] ?? `comidas-evento-${eventoId}.xlsx`);
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

// ── Línea de comida ────────────────────────────────────────────────────────────

export interface LineaComidaPayload {
  tipo:             TipoComida;
  area:             string;
  cantidad:         number;
  valor_unitario?:  number | null;
  detalle?:         string | null;
}

export function useAddLinea(eventoId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ pedidoId, data }: { pedidoId: number; data: LineaComidaPayload }) =>
      api.post<LineaComida>(`/comidas/${pedidoId}/lineas`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: comidasKey(eventoId) }),
  });
}

export function useUpdateLinea(eventoId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Omit<LineaComidaPayload, 'tipo' | 'area'>> }) =>
      api.put<LineaComida>(`/comidas/lineas/${id}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: comidasKey(eventoId) }),
  });
}

export function useDeleteLinea(eventoId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/comidas/lineas/${id}`).then(r => r.data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: comidasKey(eventoId) }),
  });
}
