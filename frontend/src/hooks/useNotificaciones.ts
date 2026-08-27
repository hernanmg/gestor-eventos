import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

export type UrgenciaNotificacion = 'critical' | 'warning' | 'info';

export interface NotificacionItem {
  id:          string;
  tipo:        string;
  titulo:      string;
  descripcion: string;
  urgencia:    UrgenciaNotificacion;
  link:        string;
  fecha:       string;
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
