import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import { applyEmpresaTheme } from '@/lib/empresaTheme';
import { useEmpresaActual } from '@/hooks/useEmpresas';
import type { MeResponse, Rol } from '@/types';

export const ME_QUERY_KEY = ['auth', 'me'] as const;

async function fetchMe(): Promise<MeResponse> {
  const { data } = await api.get<MeResponse>('/auth/me');
  return data;
}

export function useAuth() {
  const queryClient = useQueryClient();
  const navigate    = useNavigate();

  // ── Sesión activa ─────────────────────────────────────────────────────────
  const { data: user, isLoading } = useQuery({
    queryKey:  ME_QUERY_KEY,
    queryFn:   fetchMe,
    retry:     false,          // no reintentar ante 401
    staleTime: 5 * 60 * 1000, // 5 minutos en caché
  });

  // ── Tema visual de la empresa activa ─────────────────────────────────────
  // Se pide por separado (no viene en /auth/me) porque incluye color_secundario
  // y el resto de la config de Módulo A que no hace falta en cada request.
  const { data: empresaActual } = useEmpresaActual(user?.empresaId != null);

  useEffect(() => {
    if (empresaActual) applyEmpresaTheme(empresaActual.color_primario, empresaActual.color_secundario);
    else if (user && user.empresaId == null) applyEmpresaTheme(null, null);
  }, [empresaActual, user]);

  // ── Login ─────────────────────────────────────────────────────────────────
  const loginMutation = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      api.post<MeResponse>('/auth/login', { email, password }).then(r => r.data),
    onSuccess: (data) => {
      queryClient.setQueryData(ME_QUERY_KEY, data);
      navigate(data.empresaId === null ? '/seleccionar-empresa' : '/eventos', { replace: true });
    },
  });

  // ── Logout ────────────────────────────────────────────────────────────────
  const logoutMutation = useMutation({
    mutationFn: () => api.post('/auth/logout'),
    onSettled:  () => {
      // Limpia el caché y redirige independientemente del resultado del server
      queryClient.clear();
      navigate('/login', { replace: true });
    },
  });

  // ── Cambio de empresa activa ──────────────────────────────────────────────
  const switchEmpresaMutation = useMutation({
    mutationFn: (empresaId: number) =>
      api.post<MeResponse>('/auth/switch-empresa', { empresaId }).then(r => r.data),
    onSuccess: (data) => {
      queryClient.setQueryData(ME_QUERY_KEY, data);
      // Todos los datos cacheados pertenecen a la empresa anterior — se
      // invalidan para que se vuelvan a pedir con la empresa nueva.
      queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] !== 'auth' });
      navigate('/eventos', { replace: true });
    },
  });

  // ── Helpers de acceso por evento ──────────────────────────────────────────

  function hasEventoAcceso(eventoId: number): boolean {
    if (!user) return false;
    if (user.rol === 'ADMIN') return true;
    return (user.accesos ?? []).some(a => a.evento_id === eventoId);
  }

  function getEventoRol(eventoId: number): Rol | null {
    if (!user) return null;
    if (user.rol === 'ADMIN') return 'ADMIN';
    return (user.accesos ?? []).find(a => a.evento_id === eventoId)?.rol ?? null;
  }

  return {
    user,
    isLoading,
    login:            loginMutation.mutateAsync,
    logout:           logoutMutation.mutate,
    loginError:       loginMutation.error,
    isLoginLoading:   loginMutation.isPending,
    switchEmpresa:    switchEmpresaMutation.mutateAsync,
    isSwitchingEmpresa: switchEmpresaMutation.isPending,
    switchEmpresaError: switchEmpresaMutation.error,
    hasEventoAcceso,
    getEventoRol,
  };
}
