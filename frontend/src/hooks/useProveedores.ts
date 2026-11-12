import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { Proveedor, ProveedorBusqueda } from '@/types';

const KEY      = ['proveedores'];
const detailKey = (id: number) => ['proveedores', id];

export interface ProveedorFilters {
  q?:        string;
  categoria?: string;
  activo?:   'true' | 'false' | 'all';
  es_comisionista?: boolean;
}

export function useProveedores(filters: ProveedorFilters = {}) {
  const params = new URLSearchParams();
  if (filters.q)         params.set('q',         filters.q);
  if (filters.categoria) params.set('categoria',  filters.categoria);
  if (filters.activo)    params.set('activo',     filters.activo);
  if (filters.es_comisionista) params.set('es_comisionista', 'true');

  return useQuery<Proveedor[]>({
    queryKey:  [...KEY, filters],
    queryFn:   () => api.get(`/proveedores?${params}`).then(r => r.data),
    staleTime: 60 * 1000,
  });
}

export function useProveedorDetalle(id: number) {
  return useQuery<{
    proveedor: Proveedor;
    historial: {
      movimientos: any[];
      echeqs:      any[];
      stats:       any;
    };
  }>({
    queryKey:  detailKey(id),
    queryFn:   () => api.get(`/proveedores/${id}`).then(r => r.data),
    staleTime: 30 * 1000,
  });
}

export function useBuscarProveedores() {
  return async (q: string): Promise<ProveedorBusqueda[]> => {
    if (!q || q.length < 2) return [];
    const r = await api.get(`/proveedores/buscar?q=${encodeURIComponent(q)}`);
    return r.data;
  };
}

export function useCreateProveedor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Proveedor>) => api.post('/proveedores', data).then(r => r.data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateProveedor(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Proveedor>) => api.put(`/proveedores/${id}`, data).then(r => r.data),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: detailKey(id) });
    },
  });
}

export function useDeleteProveedor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/proveedores/${id}`).then(r => r.data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

// ── Importar desde el formulario de Google ─────────────────────────────────────
// Un solo endpoint crea Proveedores y Empleados (jornaleros); se usa desde
// Proveedores y desde RRHH → Empleados.

export interface ImportarFormularioResultado {
  preview:                  boolean;
  total_filas:              number;
  proveedores_creados:      number;
  proveedores_actualizados: number;
  empleados_creados:        number;
  empleados_actualizados:   number;
  omitidos:                 number;
  duplicados_en_archivo:    number;
  errores:                  { fila: number; motivo: string }[];
}

export function useImportarProveedoresFormulario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ file, preview }: { file: File; preview: boolean }) => {
      const fd = new FormData();
      fd.append('archivo', file);
      return api.post<ImportarFormularioResultado>(
        `/importar/proveedores-formulario?preview=${preview}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } },
      ).then(r => r.data);
    },
    onSuccess: (data) => {
      if (data.preview) return;
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ['rrhh', 'empleados'] });
    },
  });
}

export function useToggleProveedor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.patch(`/proveedores/${id}`).then(r => r.data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
