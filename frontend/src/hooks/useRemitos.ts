import { useCallback, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { Remito, RemitoPayload, SugerenciasRemito, TipoRemito, TipoRemitoInfo } from '@/types';

// Remitos digitales (DOS57) — los 5 remitos de cada viaje al evento

const KEY = ['remitos'] as const;

// El catálogo es fijo (hardcodeado en el backend): se pide una vez por sesión
export function useCatalogoRemitos() {
  return useQuery({
    queryKey:  [...KEY, 'catalogo'],
    queryFn:   () => api.get<TipoRemitoInfo[]>('/remitos/catalogo').then(r => r.data),
    staleTime: Infinity,
  });
}

export function useRemitosEvento(eventoId: number) {
  return useQuery({
    queryKey: [...KEY, 'evento', eventoId],
    queryFn:  () => api.get<Remito[]>('/remitos', { params: { evento_id: eventoId } }).then(r => r.data),
    enabled:  eventoId > 0,
  });
}

export function useSugerenciasRemito(eventoId: number, enabled: boolean) {
  return useQuery({
    queryKey: [...KEY, 'sugerencias', eventoId],
    queryFn:  () => api.get<SugerenciasRemito>('/remitos/sugerencias', { params: { evento_id: eventoId } }).then(r => r.data),
    enabled:  enabled && eventoId > 0,
    staleTime: 0,
  });
}

export function useGuardarRemito() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, eventoId, tipo, data }: { id?: number; eventoId: number; tipo: TipoRemito; data: RemitoPayload }) =>
      (id
        ? api.put<Remito>(`/remitos/${id}`, data)
        : api.post<Remito>('/remitos', { ...data, evento_id: eventoId, tipo })
      ).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useEmitirRemito() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.patch<Remito>(`/remitos/${id}/emitir`).then(r => r.data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useClonarRemito() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.post<Remito>(`/remitos/${id}/clonar`).then(r => r.data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useEliminarRemito() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/remitos/${id}`),
    onSuccess:  () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

// Abre el PDF en una pestaña nueva (para imprimir). La pestaña tiene que
// abrirse dentro del click — después de un await el bloqueador de pop-ups la
// frena —, así que quien encadena requests antes (Emitir y descargar) la abre
// él con abrirPestanaPdf() y la pasa. Si no hay pestaña, se descarga el archivo.
export const abrirPestanaPdf = () => window.open('', '_blank');

export function useVerPdfRemito() {
  const [cargandoId, setCargandoId] = useState<number | null>(null);
  const ver = useCallback(async (id: number, pestana: Window | null = abrirPestanaPdf()) => {
    setCargandoId(id);
    try {
      const response = await api.get(`/remitos/${id}/pdf`, { responseType: 'blob' });
      const cd       = (response.headers['content-disposition'] as string | undefined) ?? '';
      const filename = decodeURIComponent(cd.match(/filename="([^"]+)"/)?.[1] ?? `Remito-${id}.pdf`);
      const url      = URL.createObjectURL(new Blob([response.data as BlobPart], { type: 'application/pdf' }));
      if (pestana && !pestana.closed) {
        pestana.location.href = url;
      } else {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      pestana?.close();
      throw err;
    } finally {
      setCargandoId(null);
    }
  }, []);
  return { ver, cargandoId };
}
