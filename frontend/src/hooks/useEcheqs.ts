import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { Echeq } from '@/types';
import { movCajaKey } from './useCaja';

const echeqsKey = (eventoId: number) => ['eventos', eventoId, 'echeqs'];

export function useEcheqs(eventoId: number) {
  return useQuery<Echeq[]>({
    queryKey: echeqsKey(eventoId),
    queryFn:  () => api.get(`/eventos/${eventoId}/echeqs`).then(r => r.data),
  });
}

export function useCreateEcheq(eventoId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      movimiento_id?:        number;
      numero:                string;
      razon_social:          string;
      detalle?:              string | null;
      importe:               number;
      moneda:                string;
      fecha_emision?:        string | null;
      fecha_cobro_estimada?: string | null;
    }) => api.post(`/eventos/${eventoId}/echeqs`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: echeqsKey(eventoId) }),
  });
}

export function useUpdateEcheq(eventoId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Echeq> }) =>
      api.put(`/echeqs/${id}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: echeqsKey(eventoId) }),
  });
}

export function useDeleteEcheq(eventoId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/echeqs/${id}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: echeqsKey(eventoId) }),
  });
}

export function useCobrarEcheq(eventoId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, cuenta_id, fecha_cobro_real }: {
      id: number; cuenta_id: number; fecha_cobro_real?: string | null;
    }) => api.patch(`/echeqs/${id}/cobrar`, { cuenta_id, fecha_cobro_real }).then(r => r.data),
    onSuccess: (_data, { cuenta_id }) => {
      qc.invalidateQueries({ queryKey: echeqsKey(eventoId) });
      qc.invalidateQueries({ queryKey: movCajaKey(cuenta_id) });
    },
  });
}
