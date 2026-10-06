import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { IndicadoresActuales, TipoIndicador } from '@/types';

// Indicadores económicos globales (dólar oficial/blue, IPC INDEC). Sin cache
// persistente: los valores cambian durante el día, se piden al montar.

const KEY = ['indicadores', 'actuales'] as const;

export function useIndicadores() {
  const qc = useQueryClient();
  // Fuentes que fallaron en el último "Actualizar" de esta pantalla
  const [fallidas, setFallidas] = useState<TipoIndicador[]>([]);

  const query = useQuery({
    queryKey: KEY,
    queryFn:  () => api.get<IndicadoresActuales>('/indicadores/actuales').then(r => r.data),
    staleTime: 0,
  });

  const actualizar = useMutation({
    mutationFn: () => api.post<IndicadoresActuales & { errores: { tipo: TipoIndicador; mensaje: string }[] }>('/indicadores/actualizar').then(r => r.data),
    onSuccess:  ({ errores, ...data }) => {
      setFallidas(errores.map(e => e.tipo));
      qc.setQueryData(KEY, data);
    },
  });

  return {
    data:       query.data,
    loading:    query.isLoading,
    error:      query.error ?? actualizar.error,
    refresh:    () => actualizar.mutateAsync(),
    refreshing: actualizar.isPending,
    fallidas,
  };
}
