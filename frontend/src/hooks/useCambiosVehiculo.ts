import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { CambiosVehiculoRespuesta, CambioVehiculoInput, ImportCambiosResultado } from '@/types';

// Neumáticos y baterías por vehículo (Flota → Neumáticos y baterías)
const KEY = ['flota', 'cambios'] as const;

export function useCambiosVehiculo() {
  return useQuery({ queryKey: KEY, queryFn: () => api.get<CambiosVehiculoRespuesta>('/flota/cambios').then(r => r.data) });
}

function useInvalidar() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: KEY });
    qc.invalidateQueries({ queryKey: ['flota', 'alertas'] });
    qc.invalidateQueries({ queryKey: ['notificaciones'] });
  };
}

export function useGuardarCambio() {
  const inv = useInvalidar();
  return useMutation({
    mutationFn: ({ id, data }: { id?: number; data: CambioVehiculoInput }) =>
      (id ? api.put(`/flota/cambios/${id}`, data) : api.post('/flota/cambios', data)).then(r => r.data),
    onSuccess: inv,
  });
}

export function useEliminarCambio() {
  const inv = useInvalidar();
  return useMutation({ mutationFn: (id: number) => api.delete(`/flota/cambios/${id}`).then(r => r.data), onSuccess: inv });
}

export function useImportarCambios() {
  const inv = useInvalidar();
  return useMutation({
    mutationFn: ({ file, aplicar }: { file: File; aplicar: boolean }) => {
      const fd = new FormData(); fd.append('file', file);
      return api.post<ImportCambiosResultado>(`/flota/cambios/importar${aplicar ? '?aplicar=1' : ''}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data);
    },
    onSuccess: (r) => { if (r.aplicado) inv(); },
  });
}
