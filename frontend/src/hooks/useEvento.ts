import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { EventoPayload, EventoWithCount } from '@/types';

// Payload de PATCH /eventos/:id/marcar-facturar — separado de EventoPayload
// porque sólo toca facturar/facturar_notas, no el resto del evento.
interface MarcarFacturarPayload {
  facturar: boolean | null;
  notas?:   string | null;
}

export const EVENTOS_KEY = ['eventos'] as const;

export function useEventos() {
  return useQuery<EventoWithCount[]>({
    queryKey: EVENTOS_KEY,
    queryFn:  () => api.get('/eventos').then(r => r.data),
  });
}

export function useEvento(id: number) {
  return useQuery<EventoWithCount>({
    queryKey: [...EVENTOS_KEY, id],
    queryFn:  () => api.get(`/eventos/${id}`).then(r => r.data),
  });
}

export function useCreateEvento() {
  const qc = useQueryClient();
  return useMutation<EventoWithCount, Error, EventoPayload>({
    mutationFn: data => api.post('/eventos', data).then(r => r.data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: EVENTOS_KEY }),
  });
}

export function useUpdateEvento() {
  const qc = useQueryClient();
  return useMutation<EventoWithCount, Error, { id: number; data: EventoPayload }>({
    mutationFn: ({ id, data }) => api.put(`/eventos/${id}`, data).then(r => r.data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: EVENTOS_KEY }),
  });
}

export function useMarcarFacturar() {
  const qc = useQueryClient();
  return useMutation<EventoWithCount, Error, { id: number; data: MarcarFacturarPayload }>({
    mutationFn: ({ id, data }) => api.patch(`/eventos/${id}/marcar-facturar`, data).then(r => r.data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: EVENTOS_KEY }),
  });
}

export function useDeleteEvento() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, number>({
    mutationFn: id => api.delete(`/eventos/${id}`).then(r => r.data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: EVENTOS_KEY }),
  });
}

export function useExportarExcel() {
  const [isExporting, setIsExporting] = useState(false);

  const exportar = useCallback(async (eventoId: number, tab?: string) => {
    setIsExporting(true);
    try {
      const params   = tab ? `?tab=${encodeURIComponent(tab)}` : '';
      const response = await api.get(`/eventos/${eventoId}/exportar/excel${params}`, { responseType: 'blob' });
      const cd       = (response.headers['content-disposition'] as string | undefined) ?? '';
      const filename = cd.match(/filename="([^"]+)"/)?.[1] ?? `evento-${eventoId}.xlsx`;
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

export function useExportarPDF() {
  const [isExporting, setIsExporting] = useState(false);

  const exportar = useCallback(async (eventoId: number, seccion?: string) => {
    setIsExporting(true);
    try {
      const params   = seccion ? `?seccion=${encodeURIComponent(seccion)}` : '';
      const response = await api.get(`/eventos/${eventoId}/exportar/pdf${params}`, { responseType: 'blob' });
      const cd       = (response.headers['content-disposition'] as string | undefined) ?? '';
      const filename = cd.match(/filename="([^"]+)"/)?.[1] ?? `evento-${eventoId}.pdf`;
      const url      = URL.createObjectURL(new Blob([response.data as BlobPart], { type: 'application/pdf' }));
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
