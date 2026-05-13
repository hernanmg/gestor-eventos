import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { Echeq, AlertasEcheqs } from '@/types';
import { movCajaKey } from './useCaja';

export interface EcheqFilters {
  estado?:        string;
  moneda?:        string;
  razon_social?:  string;
  desde?:         string;
  hasta?:         string;
  vencen_en_dias?: number;
}

const echeqsPrefix = (eventoId: number) => ['eventos', eventoId, 'echeqs'] as const;
const echeqsKey    = (eventoId: number, filters: EcheqFilters = {}) => [...echeqsPrefix(eventoId), filters];
const alertasKey   = (eventoId: number) => ['eventos', eventoId, 'echeqs', 'alertas'];

export function useEcheqs(eventoId: number, filters: EcheqFilters = {}) {
  return useQuery<Echeq[]>({
    queryKey: echeqsKey(eventoId, filters),
    queryFn:  () => {
      const params = new URLSearchParams();
      if (filters.estado)                           params.set('estado',         filters.estado);
      if (filters.moneda)                           params.set('moneda',         filters.moneda);
      if (filters.razon_social)                     params.set('razon_social',   filters.razon_social);
      if (filters.desde)                            params.set('desde',          filters.desde);
      if (filters.hasta)                            params.set('hasta',          filters.hasta);
      if (filters.vencen_en_dias !== undefined)     params.set('vencen_en_dias', String(filters.vencen_en_dias));
      const qs = params.toString();
      return api.get(`/eventos/${eventoId}/echeqs${qs ? `?${qs}` : ''}`).then(r => r.data);
    },
  });
}

export function useAlertasEcheqs(eventoId: number) {
  return useQuery<AlertasEcheqs>({
    queryKey:  alertasKey(eventoId),
    queryFn:   () => api.get(`/eventos/${eventoId}/echeqs/alertas`).then(r => r.data),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateEcheq(eventoId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      movimiento_id?:        number;
      proveedor_id?:         number;
      numero:                string;
      razon_social?:         string;
      detalle?:              string | null;
      importe:               number;
      moneda:                string;
      fecha_emision?:        string | null;
      fecha_cobro_estimada?: string | null;
    }) => api.post(`/eventos/${eventoId}/echeqs`, data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: echeqsPrefix(eventoId) });
    },
  });
}

export function useUpdateEcheq(eventoId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Echeq> }) =>
      api.put(`/echeqs/${id}`, data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: echeqsPrefix(eventoId) });
    },
  });
}

export function useDeleteEcheq(eventoId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/echeqs/${id}`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: echeqsPrefix(eventoId) });
    },
  });
}

export function useCobrarEcheq(eventoId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, cuenta_id, fecha_cobro_real }: {
      id: number; cuenta_id: number; fecha_cobro_real?: string | null;
    }) => api.patch(`/echeqs/${id}/cobrar`, { cuenta_id, fecha_cobro_real }).then(r => r.data),
    onSuccess: (_data, { cuenta_id }) => {
      qc.invalidateQueries({ queryKey: echeqsPrefix(eventoId) });
      qc.invalidateQueries({ queryKey: movCajaKey(cuenta_id) });
    },
  });
}

export function useRechazarEcheq(eventoId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, motivo_rechazo }: { id: number; motivo_rechazo?: string | null }) =>
      api.patch(`/echeqs/${id}/rechazar`, { motivo_rechazo }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: echeqsPrefix(eventoId) });
    },
  });
}
