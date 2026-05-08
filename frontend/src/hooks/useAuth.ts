import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import type { MeResponse } from '@/types';

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

  // ── Login ─────────────────────────────────────────────────────────────────
  const loginMutation = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      api.post<MeResponse>('/auth/login', { email, password }).then(r => r.data),
    onSuccess: (data) => {
      queryClient.setQueryData(ME_QUERY_KEY, data);
      navigate('/eventos', { replace: true });
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

  return {
    user,
    isLoading,
    login:          loginMutation.mutateAsync,
    logout:         logoutMutation.mutate,
    loginError:     loginMutation.error,
    isLoginLoading: loginMutation.isPending,
  };
}
