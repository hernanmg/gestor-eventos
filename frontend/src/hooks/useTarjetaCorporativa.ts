import { useCallback, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type {
  TarjetasCorporativasResponse, ConsumosTCResponse, ResumenTC, ImportarTCResultado, ConsumoTCPayload,
} from '@/types';

const KEY = ['tarjeta-corporativa'];

export function useTarjetasCorporativas() {
  return useQuery<TarjetasCorporativasResponse>({
    queryKey: KEY,
    queryFn:  () => api.get('/tarjeta-corporativa').then(r => r.data),
  });
}

export function usePeriodosTC(tarjetaId: number | null) {
  return useQuery<{ anio: number; mes: number; consumos: number }[]>({
    queryKey: [...KEY, tarjetaId, 'periodos'],
    queryFn:  () => api.get(`/tarjeta-corporativa/${tarjetaId}/periodos`).then(r => r.data),
    enabled:  !!tarjetaId,
  });
}

export function useConsumosTC(tarjetaId: number | null, mes: number, anio: number) {
  return useQuery<ConsumosTCResponse>({
    queryKey: [...KEY, tarjetaId, 'consumos', mes, anio],
    queryFn:  () => api.get(`/tarjeta-corporativa/${tarjetaId}/consumos`, { params: { mes, anio } }).then(r => r.data),
    enabled:  !!tarjetaId,
  });
}

export function useResumenMensualTC(tarjetaId: number | null, mes: number, anio: number) {
  return useQuery<ResumenTC>({
    queryKey: [...KEY, tarjetaId, 'resumen', mes, anio],
    queryFn:  () => api.get(`/tarjeta-corporativa/${tarjetaId}/resumen-mensual`, { params: { mes, anio } }).then(r => r.data),
    enabled:  !!tarjetaId,
  });
}

export function useCrearTarjetaTC() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (empresaId: number) => api.post('/tarjeta-corporativa', { empresa_id: empresaId }).then(r => r.data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useCrearConsumoTC() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tarjetaId, data }: { tarjetaId: number; data: ConsumoTCPayload }) =>
      api.post(`/tarjeta-corporativa/${tarjetaId}/consumos`, data).then(r => r.data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useEditarConsumoTC() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<ConsumoTCPayload> }) =>
      api.put(`/tarjeta-corporativa/consumos/${id}`, data).then(r => r.data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useEliminarConsumoTC() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/tarjeta-corporativa/consumos/${id}`).then(r => r.data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

// preview=true → sólo parsea y cuenta creados/actualizados, no escribe nada.
export function useImportarTC() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ file, empresaId, preview }: { file: File; empresaId: number; preview: boolean }) => {
      const fd = new FormData();
      fd.append('archivo', file);
      return api.post<ImportarTCResultado>('/tarjeta-corporativa/importar', fd, {
        params: { empresa_id: empresaId, preview: String(preview) },
      }).then(r => r.data);
    },
    onSuccess: (_data, vars) => { if (!vars.preview) qc.invalidateQueries({ queryKey: KEY }); },
  });
}

export function useExportarPdfTC() {
  const [isExporting, setIsExporting] = useState(false);
  const exportar = useCallback(async (tarjetaId: number, mes: number, anio: number) => {
    setIsExporting(true);
    try {
      const response = await api.get(`/tarjeta-corporativa/${tarjetaId}/pdf`, { params: { mes, anio }, responseType: 'blob' });
      const cd       = (response.headers['content-disposition'] as string | undefined) ?? '';
      const filename = decodeURIComponent(cd.match(/filename="([^"]+)"/)?.[1] ?? `TarjetaCorporativa_${anio}-${mes}.pdf`);
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
