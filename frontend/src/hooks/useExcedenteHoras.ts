import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { ExcedenteHoras } from '@/types';

const KEY = ['excedente-horas'];

export interface ExcedenteFiltros {
  empleado_id?: number;
  pagado?:      boolean;
  mes?:         number;
  anio?:        number;
}

export function useExcedenteHoras(filtros: ExcedenteFiltros = {}) {
  return useQuery<{ items: ExcedenteHoras[]; total_pendiente: number }>({
    queryKey: [...KEY, filtros],
    queryFn:  () => api.get('/excedente-horas', { params: filtros }).then(r => r.data),
  });
}

export interface ExcedentePayload {
  empleado_id:     number;
  periodo_mes:     number;
  periodo_anio:    number;
  horas_excedente: number;
  valor_hora:      number;
}

export function useCreateExcedenteHoras() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ExcedentePayload) => api.post('/excedente-horas', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function usePagarExcedenteHoras() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, fecha_pago, liquidacion_admin_id }: { id: number; fecha_pago: string; liquidacion_admin_id?: number | null }) =>
      api.patch(`/excedente-horas/${id}/pagar`, { fecha_pago, liquidacion_admin_id }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
