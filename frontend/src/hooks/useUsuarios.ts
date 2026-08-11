import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { Usuario, UsuarioEmpresaAcceso, Rol } from '@/types';

const KEY          = ['usuarios'];
const EMPRESAS_KEY = ['usuarios', 'empresas'];

export function useUsuarios() {
  return useQuery<Usuario[]>({
    queryKey: KEY,
    queryFn:  () => api.get('/usuarios').then(r => r.data),
  });
}

export function useCreateUsuario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { nombre: string; apodo?: string | null; telefono?: string | null; email: string; password: string; rol: Rol }) =>
      api.post('/usuarios', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateUsuario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: {
      id:   number;
      data: { nombre?: string; apodo?: string | null; telefono?: string | null; email?: string; password?: string; rol?: Rol; activo?: boolean };
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

// ── Acceso multi-empresa (UsuarioEmpresaAcceso) — sólo admin global ──────────

export function useUsuarioEmpresaAccesos(usuarioId: number | null) {
  return useQuery<UsuarioEmpresaAcceso[]>({
    queryKey: [...EMPRESAS_KEY, usuarioId],
    queryFn:  () => api.get(`/usuarios/${usuarioId}/empresas`).then(r => r.data),
    enabled:  usuarioId !== null,
  });
}

export function useCreateUsuarioEmpresaAcceso(usuarioId: number) {
  const qc = useQueryClient();
  return useMutation({
    // El rol que aplica en la empresa adicional es el Usuario.rol global —
    // el schema no guarda un rol distinto por empresa (ver Configuracion/index.tsx).
    mutationFn: ({ empresaId }: { empresaId: number }) =>
      api.post(`/usuarios/${usuarioId}/empresas/${empresaId}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...EMPRESAS_KEY, usuarioId] }),
  });
}

export function useDeleteUsuarioEmpresaAcceso(usuarioId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (empresaId: number) =>
      api.delete(`/usuarios/${usuarioId}/empresas/${empresaId}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...EMPRESAS_KEY, usuarioId] }),
  });
}
