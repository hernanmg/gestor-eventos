import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { EventoPayload, EventoWithCount } from '@/types';

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

export function useDeleteEvento() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, number>({
    mutationFn: id => api.delete(`/eventos/${id}`).then(r => r.data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: EVENTOS_KEY }),
  });
}
