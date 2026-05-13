import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import type { AuditoriaPage } from '@/types';

interface AuditoriaFilters {
  page?:       number;
  limit?:      number;
  evento_id?:  number;
  usuario_id?: number;
  accion?:     string;
  entidad?:    string;
  desde?:      string;
  hasta?:      string;
}

export function useAuditoria(filters: AuditoriaFilters = {}) {
  return useQuery({
    queryKey: ['auditoria', filters],
    queryFn:  async () => {
      const params = new URLSearchParams();
      if (filters.page)       params.set('page',       String(filters.page));
      if (filters.limit)      params.set('limit',      String(filters.limit));
      if (filters.evento_id)  params.set('evento_id',  String(filters.evento_id));
      if (filters.usuario_id) params.set('usuario_id', String(filters.usuario_id));
      if (filters.accion)     params.set('accion',     filters.accion);
      if (filters.entidad)    params.set('entidad',    filters.entidad);
      if (filters.desde)      params.set('desde',      filters.desde);
      if (filters.hasta)      params.set('hasta',      filters.hasta);
      const { data } = await api.get<AuditoriaPage>(`/auditoria?${params.toString()}`);
      return data;
    },
  });
}

export function useAuditoriaEvento(eventoId: number, filters: Omit<AuditoriaFilters, 'evento_id'> = {}) {
  return useQuery({
    queryKey: ['auditoria', 'evento', eventoId, filters],
    queryFn:  async () => {
      const params = new URLSearchParams();
      if (filters.page)  params.set('page',  String(filters.page));
      if (filters.limit) params.set('limit', String(filters.limit));
      const { data } = await api.get<AuditoriaPage>(`/auditoria/evento/${eventoId}?${params.toString()}`);
      return data;
    },
    enabled: !!eventoId,
  });
}
