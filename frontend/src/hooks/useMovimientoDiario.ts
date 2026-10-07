import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import type { MovimientoDiario } from '@/types';

// Movimiento Diario (DOS57, Flor) — viajes del día, camiones y camionetas
export function useMovimientoDiario(fecha: string) {
  return useQuery({
    queryKey: ['movimiento-diario', fecha],
    queryFn:  () => api.get<MovimientoDiario>('/movimiento-diario', { params: { fecha } }).then(r => r.data),
    enabled:  /^\d{4}-\d{2}-\d{2}$/.test(fecha),
  });
}
