import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { Multa, ResumenMultas, TipoMulta, EstadoMulta } from '@/types';

// Multas de tránsito e internas (Lorena, DOS57). "Descontar al empleado" crea
// un vale tipo MULTA que entra solo en la próxima liquidación.

const KEY = ['multas'] as const;

export interface MultaFiltros {
  desde?:       string;
  hasta?:       string;
  tipo?:        TipoMulta;
  estado?:      EstadoMulta;
  camion_id?:   number;
  empleado_id?: number;
}

export function useMultas(filtros: MultaFiltros) {
  return useQuery({
    queryKey: [...KEY, 'lista', filtros],
    queryFn:  () => api.get<Multa[]>('/multas', { params: filtros }).then(r => r.data),
  });
}

export function useResumenMultas(filtros: MultaFiltros) {
  return useQuery({
    queryKey: [...KEY, 'resumen', filtros],
    queryFn:  () => api.get<ResumenMultas>('/multas/resumen', { params: filtros }).then(r => r.data),
  });
}

export interface OpcionesMultas {
  vehiculos: { id: number; codigo: string; patente: string | null; descripcion: string | null }[];
  empleados: { id: number; nombre: string; apellido: string; apodo: string | null }[];
}

export function useOpcionesMultas(enabled = true) {
  return useQuery({
    queryKey: [...KEY, 'opciones'],
    queryFn:  () => api.get<OpcionesMultas>('/multas/opciones').then(r => r.data),
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

export interface MultaPayload {
  tipo?:                   TipoMulta;
  fecha?:                  string;
  camion_id?:              number | null;
  patente_texto?:          string | null;
  empleado_id?:            number | null;
  empleado_nombre_manual?: string | null;
  lugar?:                  string | null;
  motivo?:                 string;
  numero_acta?:            string | null;
  fecha_vencimiento?:      string | null;
  monto?:                  number;
  estado?:                 EstadoMulta;
  fecha_pago?:             string | null;
  medio_pago?:             string | null;
  descontar_empleado?:     boolean;
  observaciones?:          string | null;
}

function invalidar(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: KEY });
  qc.invalidateQueries({ queryKey: ['flota', 'alertas'] });
  qc.invalidateQueries({ queryKey: ['notificaciones'] });
  qc.invalidateQueries({ queryKey: ['calendario'] });
}

export function useCreateMulta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: MultaPayload) => api.post<Multa>('/multas', data).then(r => r.data),
    onSuccess:  () => invalidar(qc),
  });
}

export function useUpdateMulta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: MultaPayload & { id: number }) => api.put<Multa>(`/multas/${id}`, data).then(r => r.data),
    onSuccess:  () => invalidar(qc),
  });
}

export function useDeleteMulta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/multas/${id}`).then(r => r.data),
    onSuccess:  () => invalidar(qc),
  });
}
