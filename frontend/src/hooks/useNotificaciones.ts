import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

export type UrgenciaNotificacion = 'critical' | 'warning' | 'info';

export interface NotificacionAccion {
  label:   string;
  endpoint: string;
  variant: 'default' | 'destructive';
}

export interface NotificacionItem {
  id:          string;
  tipo:        string;
  titulo:      string;
  descripcion: string;
  urgencia:    UrgenciaNotificacion;
  link:        string;
  fecha:       string;
  // Resoluble inline sin navegar (ej. aprobar/rechazar tardanza de Presentismo).
  acciones?:   NotificacionAccion[];
}

export interface NotificacionesResponse {
  total:    number;
  criticas: number;
  items:    NotificacionItem[];
}

// Polling cada 5 minutos — el count de la campanita se actualiza solo, sin
// que el usuario tenga que recargar la página (ver FIX 7 del módulo Flota).
export function useNotificaciones() {
  return useQuery<NotificacionesResponse>({
    queryKey:        ['notificaciones'],
    queryFn:         () => api.get('/notificaciones').then(r => r.data),
    staleTime:       60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}

export function useResolverAccionNotificacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (endpoint: string) => api.post(endpoint).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notificaciones'] }),
  });
}
