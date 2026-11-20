import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { ChequeEmpresa, ResumenCheques, TipoCheque, FormatoCheque, EstadoEcheq, Moneda } from '@/types';

// Finanzas → Cheques: cheques emitidos de la empresa, por banco.
const KEY = ['cheques'];

export interface ChequesFiltros {
  banco?:  string;
  estado?: EstadoEcheq;
  tipo?:   TipoCheque | 'FINANCIAMIENTO';
  desde?:  string;
  hasta?:  string;
  buscar?: string;
}

export function useCheques(filtros: ChequesFiltros) {
  const params = Object.fromEntries(Object.entries(filtros).filter(([, v]) => v !== undefined && v !== ''));
  return useQuery<ChequeEmpresa[]>({
    queryKey: [...KEY, 'list', params],
    queryFn:  () => api.get('/cheques', { params }).then(r => r.data),
  });
}

export function useResumenCheques() {
  return useQuery<ResumenCheques>({
    queryKey: [...KEY, 'resumen'],
    queryFn:  () => api.get('/cheques/resumen').then(r => r.data),
  });
}

export interface ChequePayload {
  evento_id?:            number | null;
  proveedor_id?:         number | null;
  sgr_id?:               number | null;
  numero:                string;
  razon_social?:         string | null;
  detalle?:              string | null;
  importe:               number;
  moneda?:               Moneda;
  banco?:                string | null;
  formato?:              FormatoCheque;
  tipo?:                 TipoCheque;
  fecha_emision?:        string | null;
  fecha_cobro_estimada?: string | null;
}

function useInvalidar() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: KEY });
    // La pestaña Echeqs del evento, el calendario y la campanita leen lo mismo.
    qc.invalidateQueries({ queryKey: ['calendario'] });
    qc.invalidateQueries({ queryKey: ['notificaciones'] });
    qc.invalidateQueries({ queryKey: ['eventos'] });
  };
}

export function useGuardarCheque(id: number | null) {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (data: ChequePayload) => (id ? api.put(`/cheques/${id}`, data) : api.post('/cheques', data)).then(r => r.data),
    onSuccess:  invalidar,
  });
}

export function useAccionCheque() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: ({ id, accion, fecha, motivo }: { id: number; accion: 'debitar' | 'reabrir' | 'rechazar' | 'borrar'; fecha?: string | null; motivo?: string | null }) => {
      if (accion === 'debitar')  return api.patch(`/cheques/${id}/debitar`, { fecha: fecha ?? null }).then(r => r.data);
      if (accion === 'reabrir')  return api.patch(`/cheques/${id}/reabrir`).then(r => r.data);
      if (accion === 'rechazar') return api.patch(`/echeqs/${id}/rechazar`, { motivo_rechazo: motivo ?? null }).then(r => r.data);
      return api.delete(`/echeqs/${id}`).then(r => r.data);
    },
    onSuccess: invalidar,
  });
}
