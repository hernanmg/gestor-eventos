import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { EventoAcceso, Rol } from '@/types';
import { ME_QUERY_KEY } from './useAuth';

export function useEventoAccesos(usuarioId: number) {
  return useQuery({
    queryKey: ['usuarios', usuarioId, 'accesos'],
    queryFn:  async () => {
      const { data } = await api.get<EventoAcceso[]>(`/usuarios/${usuarioId}/accesos`);
      return data;
    },
    enabled: !!usuarioId,
  });
}

export function useCreateAcceso(usuarioId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ eventoId, rol }: { eventoId: number; rol: Rol }) =>
      api.post<EventoAcceso>(`/usuarios/${usuarioId}/accesos/${eventoId}`, { rol }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['usuarios', usuarioId, 'accesos'] });
      qc.invalidateQueries({ queryKey: ME_QUERY_KEY });
    },
  });
}

export function useUpdateAcceso(usuarioId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ eventoId, rol }: { eventoId: number; rol: Rol }) =>
      api.put<EventoAcceso>(`/usuarios/${usuarioId}/accesos/${eventoId}`, { rol }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['usuarios', usuarioId, 'accesos'] });
      qc.invalidateQueries({ queryKey: ME_QUERY_KEY });
    },
  });
}

export function useDeleteAcceso(usuarioId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (eventoId: number) =>
      api.delete(`/usuarios/${usuarioId}/accesos/${eventoId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['usuarios', usuarioId, 'accesos'] });
      qc.invalidateQueries({ queryKey: ME_QUERY_KEY });
    },
  });
}
