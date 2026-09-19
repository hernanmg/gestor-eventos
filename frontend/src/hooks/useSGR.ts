import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { SGR, EstadoVinculacionSGR, Moneda } from '@/types';

const KEY = ['sgr'];

export function useSGRList() {
  return useQuery<SGR[]>({
    queryKey: KEY,
    queryFn:  () => api.get('/sgr').then(r => r.data),
  });
}

export interface SGRPayload {
  empresa_id?:         number;
  nombre:              string;
  estado_vinculacion?: EstadoVinculacionSGR;
  fecha_vinculacion?:  string | null;
  fecha_vencimiento?:  string | null;
  cupo_total?:         number | null;
  cupo_utilizado?:     number | null;
  moneda?:             Moneda;
  contacto_nombre?:    string | null;
  contacto_tel?:       string | null;
  notas?:              string | null;
}

export function useCreateSGR() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: SGRPayload) => api.post<SGR>('/sgr', data).then(r => r.data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateSGR(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Omit<SGRPayload, 'empresa_id'>>) => api.put<SGR>(`/sgr/${id}`, data).then(r => r.data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteSGR() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/sgr/${id}`).then(r => r.data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
