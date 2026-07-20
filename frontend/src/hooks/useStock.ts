import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type {
  Producto, AsignacionStock, Disponibilidad, AlertaStock,
  SugerenciaStock, EventoStockResponse, CategoriaStock, MovimientoStock,
} from '@/types';

// ── Keys ──────────────────────────────────────────────────────────────────────

export const PRODUCTOS_KEY   = ['stock', 'productos']   as const;
export const ALERTAS_KEY     = ['stock', 'alertas']     as const;
export const CATEGORIAS_KEY  = ['stock', 'categorias']  as const;

// ── Productos ─────────────────────────────────────────────────────────────────

export function useProductos(params: { search?: string; categoria?: string; catalogo_origen?: string } = {}) {
  return useQuery({
    queryKey: [...PRODUCTOS_KEY, params],
    queryFn:  async () => {
      const p = new URLSearchParams();
      if (params.search)          p.set('search',          params.search);
      if (params.categoria)       p.set('categoria',        params.categoria);
      if (params.catalogo_origen) p.set('catalogo_origen',  params.catalogo_origen);
      const { data } = await api.get<Producto[]>(`/stock/productos?${p}`);
      return data;
    },
  });
}

export function useProducto(id: number) {
  return useQuery({
    queryKey: [...PRODUCTOS_KEY, id],
    queryFn:  () => api.get<Producto & { asignaciones: AsignacionStock[]; movimientos: MovimientoStock[]; disponibilidad_hoy: Disponibilidad | null }>(`/stock/productos/${id}`).then(r => r.data),
    enabled:  !!id,
  });
}

export function useCreateProducto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Producto>) => api.post<Producto>('/stock/productos', data).then(r => r.data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: PRODUCTOS_KEY }),
  });
}

export function useUpdateProducto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Producto> }) =>
      api.put<Producto>(`/stock/productos/${id}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: PRODUCTOS_KEY }),
  });
}

export function useDeleteProducto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/stock/productos/${id}`),
    onSuccess:  () => qc.invalidateQueries({ queryKey: PRODUCTOS_KEY }),
  });
}

// ── Foto de producto ──────────────────────────────────────────────────────────

export function useUploadFotoProducto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, file }: { id: number; file: File }) => {
      const formData = new FormData();
      formData.append('foto', file);
      return api.post(`/stock/importar/foto/${id}`, formData).then(r => r.data);
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: PRODUCTOS_KEY });
      qc.invalidateQueries({ queryKey: [...PRODUCTOS_KEY, vars.id] });
    },
  });
}

// Mismo patrón que useLogoBlobUrl — fetch con blob y object URL revocada al desmontar.
export function useFotoBlobUrl(productoId: number | null | undefined, tieneFoto: boolean): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!productoId || !tieneFoto) { setUrl(null); return; }
    let objectUrl: string | null = null;
    let cancelled = false;

    api.get(`/stock/productos/${productoId}/foto`, { responseType: 'blob' }).then(res => {
      if (cancelled) return;
      objectUrl = URL.createObjectURL(res.data);
      setUrl(objectUrl);
    }).catch(() => { if (!cancelled) setUrl(null); });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [productoId, tieneFoto]);

  return url;
}

// ── Importador catálogo Layher ────────────────────────────────────────────────

export function useImportarCatalogo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append('archivo', file);
      return api.post<{ creados: number; actualizados: number; errores: string[] }>('/stock/importar/catalogo', formData).then(r => r.data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: PRODUCTOS_KEY }),
  });
}

// ── Disponibilidad ────────────────────────────────────────────────────────────

export function useDisponibilidad(params: {
  producto_id?: number;
  fecha_desde?: string;
  fecha_hasta?: string;
}) {
  return useQuery({
    queryKey: ['stock', 'disponibilidad', params],
    queryFn:  async () => {
      const p = new URLSearchParams();
      p.set('producto_id', String(params.producto_id));
      p.set('fecha_desde', params.fecha_desde!);
      p.set('fecha_hasta', params.fecha_hasta!);
      const { data } = await api.get<Disponibilidad>(`/stock/disponibilidad?${p}`);
      return data;
    },
    enabled:  !!params.producto_id && !!params.fecha_desde && !!params.fecha_hasta,
  });
}

// ── Alertas ───────────────────────────────────────────────────────────────────

export function useAlertasStock() {
  return useQuery({
    queryKey:  ALERTAS_KEY,
    queryFn:   () => api.get<{ alertas: AlertaStock[] }>('/stock/alertas').then(r => r.data),
    staleTime: 10 * 60 * 1000, // 10 minutos
  });
}

// ── Sugerencias ───────────────────────────────────────────────────────────────

export function useSugerencias(params: {
  evento_id?:  number;
  producto_id?: number;
  fecha_desde?: string;
  fecha_hasta?: string;
}) {
  return useQuery({
    queryKey: ['stock', 'sugerencias', params],
    queryFn:  async () => {
      const p = new URLSearchParams();
      if (params.evento_id)   p.set('evento_id',   String(params.evento_id));
      if (params.producto_id) p.set('producto_id', String(params.producto_id));
      if (params.fecha_desde) p.set('fecha_desde', params.fecha_desde);
      if (params.fecha_hasta) p.set('fecha_hasta', params.fecha_hasta);
      const { data } = await api.get<{ sugerencias: SugerenciaStock[] }>(`/stock/sugerencias?${p}`);
      return data;
    },
    enabled: !!params.producto_id && !!params.fecha_desde && !!params.fecha_hasta,
  });
}

// ── Stock por evento ──────────────────────────────────────────────────────────

export function useEventoStock(eventoId: number) {
  return useQuery({
    queryKey: ['stock', 'evento', eventoId],
    queryFn:  () => api.get<EventoStockResponse>(`/eventos/${eventoId}/stock`).then(r => r.data),
    enabled:  !!eventoId,
  });
}

export function useAsignarProducto(eventoId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      producto_id:   number;
      cantidad:      number;
      fecha_salida:  string;
      fecha_retorno?: string | null;
      notas?:        string;
    }) => api.post<{ asignacion: AsignacionStock; advertencia?: object }>(`/eventos/${eventoId}/stock`, data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock', 'evento', eventoId] });
      qc.invalidateQueries({ queryKey: PRODUCTOS_KEY });
      qc.invalidateQueries({ queryKey: ALERTAS_KEY });
    },
  });
}

export function useUpdateAsignacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<AsignacionStock> }) =>
      api.put<AsignacionStock>(`/stock/asignaciones/${id}`, data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock'] });
    },
  });
}

export function useCancelarAsignacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/stock/asignaciones/${id}`),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['stock'] }),
  });
}

export function useTransferencia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      asignacion_origen_id: number;
      evento_destino_id:    number;
      cantidad:             number;
      fecha_transferencia:  string;
      notas?:               string;
    }) => api.post<AsignacionStock>('/stock/transferencia', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stock'] }),
  });
}

// ── Categorías de Stock ───────────────────────────────────────────────────────

export function useCategoriasStock() {
  return useQuery({
    queryKey: CATEGORIAS_KEY,
    queryFn:  () => api.get<CategoriaStock[]>('/stock/categorias').then(r => r.data),
  });
}

export function useCreateCategoria() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { nombre: string; descripcion?: string | null; color?: string | null }) =>
      api.post<CategoriaStock>('/stock/categorias', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: CATEGORIAS_KEY }),
  });
}

export function useUpdateCategoria() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CategoriaStock> }) =>
      api.put<CategoriaStock>(`/stock/categorias/${id}`, data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CATEGORIAS_KEY });
      qc.invalidateQueries({ queryKey: PRODUCTOS_KEY });
    },
  });
}

export function useDeleteCategoria() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/stock/categorias/${id}`),
    onSuccess:  () => qc.invalidateQueries({ queryKey: CATEGORIAS_KEY }),
  });
}

// ── Firmas digitales ─────────────────────────────────────────────────────────

export type PasoFirma = 'salida' | 'llegada' | 'retorno';

export function usePendientesFirma(paso: PasoFirma) {
  return useQuery({
    queryKey: ['stock', 'pendientes-firma', paso],
    queryFn:  () => api.get<{ asignaciones: AsignacionStock[] }>(`/stock/asignaciones/pendientes-firma?paso=${paso}`).then(r => r.data),
    refetchInterval: 60 * 1000,
  });
}

export function useFirmarSalida() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.patch<AsignacionStock>(`/stock/asignaciones/${id}/firmar-salida`).then(r => r.data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['stock'] }),
  });
}

export function useFirmarLlegada() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, cantidad_excedente }: { id: number; cantidad_excedente?: number }) =>
      api.patch<AsignacionStock>(`/stock/asignaciones/${id}/firmar-llegada`, { cantidad_excedente }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stock'] }),
  });
}

export function useFirmarRetorno() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.patch<AsignacionStock>(`/stock/asignaciones/${id}/firmar-retorno`).then(r => r.data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['stock'] }),
  });
}
