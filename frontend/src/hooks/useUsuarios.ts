import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { Usuario, Rol } from '@/types';

const KEY = ['usuarios'];

export function useUsuarios() {
  return useQuery<Usuario[]>({
    queryKey: KEY,
    queryFn:  () => api.get('/usuarios').then(r => r.data),
  });
}

export function useCreateUsuario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { nombre: string; email: string; password: string; rol: Rol }) =>
      api.post('/usuarios', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateUsuario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: {
      id:   number;
      data: { nombre?: string; email?: string; password?: string; rol?: Rol; activo?: boolean };
    }) => api.put(`/usuarios/${id}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteUsuario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/usuarios/${id}`).then(r => r.data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
