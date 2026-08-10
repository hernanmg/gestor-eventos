import { useCallback, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { RubroEvento, PedidoItem, EstadoRubroEvento, Moneda, AsignacionStock } from '@/types';

export const fichaKey = (eventoId: number) => ['eventos', eventoId, 'ficha'];

// ── Ficha ──────────────────────────────────────────────────────────────────────

export function useFichaEvento(eventoId: number) {
  return useQuery<RubroEvento[]>({
    queryKey: fichaKey(eventoId),
    queryFn:  () => api.get(`/eventos/${eventoId}/ficha`).then(r => r.data),
    enabled:  !!eventoId,
  });
}

export function useInicializarFicha(eventoId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post(`/eventos/${eventoId}/ficha/inicializar`).then(r => r.data as { creados: number; existentes: number }),
    onSuccess:  () => qc.invalidateQueries({ queryKey: fichaKey(eventoId) }),
  });
}

export function useExportarFicha() {
  const [isExporting, setIsExporting] = useState(false);

  const exportar = useCallback(async (eventoId: number) => {
    setIsExporting(true);
    try {
      const response = await api.get(`/eventos/${eventoId}/ficha/exportar`, { responseType: 'blob' });
      const cd       = (response.headers['content-disposition'] as string | undefined) ?? '';
      const filename = decodeURIComponent(cd.match(/filename="([^"]+)"/)?.[1] ?? `ficha-evento-${eventoId}.xlsx`);
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

// ── RubroEvento ────────────────────────────────────────────────────────────────

export interface RubroEventoPayload {
  proveedor_id?:      number | null;
  estado?:            EstadoRubroEvento;
  contacto_nombre?:   string | null;
  contacto_telefono?: string | null;
  contacto_cargo?:    string | null;
  coordina_nombre?:   string | null;
  fecha_ingreso?:     string | null;
  fecha_retiro?:      string | null;
  presupuesto?:       number | null;
  moneda?:            Moneda;
  notas?:             string | null;
  // Fuentes mixtas (stock propio + proveedor externo)
  usa_stock_propio?:   boolean;
  cantidad_stock?:     number | null;
  cantidad_proveedor?: number | null;
}

export function useUpdateRubroEvento(eventoId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: RubroEventoPayload }) =>
      api.put<RubroEvento>(`/rubros-evento/${id}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: fichaKey(eventoId) }),
  });
}

// ── Stock propio (fuentes mixtas) ────────────────────────────────────────────

export interface AsignarStockPayload {
  producto_id:    number;
  cantidad:       number;
  fecha_salida:   string;
  fecha_retorno?: string | null;
  notas?:         string | null;
}

export function useAsignarStock(eventoId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ rubroEventoId, data }: { rubroEventoId: number; data: AsignarStockPayload }) =>
      api.post<{ asignacion: AsignacionStock; disponibilidad_restante: number }>(
        `/rubros-evento/${rubroEventoId}/asignar-stock`, data,
      ).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: fichaKey(eventoId) });
      qc.invalidateQueries({ queryKey: ['stock'] });
    },
  });
}

export function useDesasignarStock(eventoId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ rubroEventoId, asignacionId }: { rubroEventoId: number; asignacionId: number }) =>
      api.delete(`/rubros-evento/${rubroEventoId}/asignaciones/${asignacionId}`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: fichaKey(eventoId) });
      qc.invalidateQueries({ queryKey: ['stock'] });
    },
  });
}

// ── PedidoItem ─────────────────────────────────────────────────────────────────

export interface PedidoItemPayload {
  cantidad?:        number | null;
  descripcion:      string;
  dias_uso?:        number | null;
  horario_llegada?: string | null;
  horario_retiro?:  string | null;
  observaciones?:   string | null;
  orden?:           number;
}

export function useAddPedidoItem(eventoId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ rubroEventoId, data }: { rubroEventoId: number; data: PedidoItemPayload }) =>
      api.post<PedidoItem>(`/rubros-evento/${rubroEventoId}/items`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: fichaKey(eventoId) }),
  });
}

export function useUpdatePedidoItem(eventoId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<PedidoItemPayload> & { orden?: number } }) =>
      api.put<PedidoItem>(`/pedido-items/${id}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: fichaKey(eventoId) }),
  });
}

export function useDeletePedidoItem(eventoId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/pedido-items/${id}`).then(r => r.data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: fichaKey(eventoId) }),
  });
}
