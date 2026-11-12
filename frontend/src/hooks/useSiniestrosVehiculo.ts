import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { SiniestroVehiculo, EstadoSiniestroVehiculo, ImportarSiniestrosVehiculoResultado } from '@/types';

const KEY = ['siniestros-vehiculos'];

export interface SiniestroVehiculoFiltros {
  estado?:    EstadoSiniestroVehiculo;
  camion_id?: number;
  desde?:     string;
  hasta?:     string;
}

export function useSiniestrosVehiculo(filtros: SiniestroVehiculoFiltros = {}) {
  return useQuery<SiniestroVehiculo[]>({
    queryKey: [...KEY, filtros],
    queryFn:  () => api.get('/siniestros-vehiculos', { params: filtros }).then(r => r.data),
  });
}

export function useSiniestroVehiculo(id: number | null) {
  return useQuery<SiniestroVehiculo>({
    queryKey: [...KEY, 'detalle', id],
    queryFn:  () => api.get(`/siniestros-vehiculos/${id}`).then(r => r.data),
    enabled:  id !== null,
  });
}

export interface SiniestroVehiculoPayload {
  camion_id?:              number | null;
  patente_texto?:          string | null;
  empleado_id?:            number | null;
  empleado_nombre_manual?: string | null;
  aseguradora?:            string | null;
  numero_siniestro?:       string | null;
  fecha_denuncia?:         string | null;
  fecha_ocurrencia:        string;
  lugar?:                  string | null;
  descripcion?:            string | null;
  danios?:                 string | null;
  tercero_nombre?:         string | null;
  tercero_vehiculo?:       string | null;
  tercero_seguro?:         string | null;
  estado?:                 EstadoSiniestroVehiculo;
  observaciones?:          string | null;
}

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: KEY });
  qc.invalidateQueries({ queryKey: ['notificaciones'] });
}

export function useCreateSiniestroVehiculo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: SiniestroVehiculoPayload) => api.post('/siniestros-vehiculos', data).then(r => r.data),
    onSuccess:  () => invalidate(qc),
  });
}

export function useUpdateSiniestroVehiculo(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<SiniestroVehiculoPayload>) => api.put(`/siniestros-vehiculos/${id}`, data).then(r => r.data),
    onSuccess:  () => invalidate(qc),
  });
}

export function useResolverSiniestroVehiculo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, observaciones }: { id: number; observaciones?: string | null }) =>
      api.patch(`/siniestros-vehiculos/${id}/resolver`, { observaciones }).then(r => r.data),
    onSuccess:  () => invalidate(qc),
  });
}

export function useImportarSiniestrosVehiculo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append('archivo', file);
      return api.post<ImportarSiniestrosVehiculoResultado>('/siniestros-vehiculos/importar', fd).then(r => r.data);
    },
    onSuccess: () => invalidate(qc),
  });
}
