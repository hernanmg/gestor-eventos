import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { EscalafonAdmin } from '@/types';

const KEY = ['rrhh', 'escalafones'];

export function useEscalafones() {
  return useQuery<EscalafonAdmin[]>({
    queryKey: KEY,
    queryFn:  () => api.get('/rrhh/escalafones').then(r => r.data),
  });
}

export function useValoresEscalafon(nombre: string | null) {
  return useQuery<EscalafonAdmin>({
    queryKey: [...KEY, 'valores', nombre],
    queryFn:  () => api.get(`/rrhh/escalafones/${encodeURIComponent(nombre!)}/valores`).then(r => r.data),
    enabled:  !!nombre,
    retry:    false,
  });
}

export interface EscalafonPayload {
  nombre:              string;
  orden?:              number;
  viatico?:            number | null;
  premio_presentismo?: number | null;
  telefono?:           number | null;
  premio_incentivo?:   number | null;
}

export function useCreateEscalafon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: EscalafonPayload) => api.post('/rrhh/escalafones', data).then(r => r.data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateEscalafon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<EscalafonPayload> }) =>
      api.put(`/rrhh/escalafones/${id}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteEscalafon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/rrhh/escalafones/${id}`).then(r => r.data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
