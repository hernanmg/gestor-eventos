import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { Proveedor, ProveedorBusqueda } from '@/types';

const KEY      = ['proveedores'];
const detailKey = (id: number) => ['proveedores', id];

export interface ProveedorFilters {
  q?:        string;
  categoria?: string;
  activo?:   'true' | 'false' | 'all';
}

export function useProveedores(filters: ProveedorFilters = {}) {
  const params = new URLSearchParams();
  if (filters.q)         params.set('q',         filters.q);
  if (filters.categoria) params.set('categoria',  filters.categoria);
  if (filters.activo)    params.set('activo',     filters.activo);

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

export function useToggleProveedor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.patch(`/proveedores/${id}`).then(r => r.data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
