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

// ── Importar desde Excel (rubro por evento.xlsx) ─────────────────────────────

export interface FichaImportFila {
  fila_excel:             number;
  grupo:                  string | null;
  servicio:               string;
  corresponde:            boolean;
  proveedor_nombre_excel: string | null;
  responsable:            string | null;
  comentario:             string | null;
  rubro_id:               number | null;
  rubro_nombre:           string | null;
  proveedor_id:           number | null;
  accion:                 'CREAR' | 'ACTUALIZAR' | 'SIN_RUBRO';
}

export interface FichaImportResultado {
  preview:                boolean;
  confirmados:            number;
  no_van:                 number;
  creados:                number;
  actualizados:           number;
  rubros_no_encontrados:  string[];
  filas:                  FichaImportFila[];
}

export function useListarHojasFichaImport() {
  return useMutation({
    mutationFn: ({ eventoId, file }: { eventoId: number; file: File }) => {
      const fd = new FormData();
      fd.append('archivo', file);
      return api.post<{ hojas: { nombre_hoja: string; evento_nombre_excel: string | null }[] }>(
        `/eventos/${eventoId}/ficha/importar/hojas`, fd, { headers: { 'Content-Type': 'multipart/form-data' } },
      ).then(r => r.data.hojas);
    },
  });
}

export function useImportarFicha(eventoId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ file, hoja, preview }: { file: File; hoja: string; preview: boolean }) => {
      const fd = new FormData();
      fd.append('archivo', file);
      fd.append('hoja', hoja);
      return api.post<FichaImportResultado>(
        `/eventos/${eventoId}/ficha/importar?preview=${preview}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } },
      ).then(r => r.data);
    },
    onSuccess: (data) => { if (!data.preview) qc.invalidateQueries({ queryKey: fichaKey(eventoId) }); },
  });
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
  // Esquema de personal por turno (horas_por_agente/total los deriva el backend)
  fecha_turno?:       string | null; // YYYY-MM-DD
  hora_inicio_turno?: string | null;
  hora_fin_turno?:    string | null;
  ubicacion_turno?:   string | null;
  tipo_turno?:        string | null;
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

// ── Importar esquema de personal (SEGURIDAD_FESTIVAL_KM.xlsx) ─────────────────

export interface EsquemaImportFila {
  fila_excel:       number;
  dia_numero:       number | null;
  fecha:            string; // YYYY-MM-DD
  tipo_turno:       string | null;
  cantidad:         number;
  ubicacion_turno:  string | null;
  hora_inicio:      string | null;
  hora_fin:         string | null;
  horas_por_agente: number | null;
  total_horas:      number | null;
  advertencias:     string[];
  accion:           'CREAR' | 'ACTUALIZAR';
}

export interface EsquemaImportResultado {
  preview:      boolean;
  hoja:         string;
  creados:      number;
  actualizados: number;
  total_horas:  number;
  omitidas:     { fila_excel: number; motivo: string }[];
  filas:        EsquemaImportFila[];
}

export function useImportarEsquemaTurnos(eventoId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ rubroEventoId, file, preview }: { rubroEventoId: number; file: File; preview: boolean }) => {
      const fd = new FormData();
      fd.append('archivo', file);
      return api.post<EsquemaImportResultado>(
        `/rubros-evento/${rubroEventoId}/importar-seguridad?preview=${preview}`, fd,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      ).then(r => r.data);
    },
    onSuccess: (data) => { if (!data.preview) qc.invalidateQueries({ queryKey: fichaKey(eventoId) }); },
  });
}
