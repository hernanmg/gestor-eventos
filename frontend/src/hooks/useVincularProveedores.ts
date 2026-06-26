import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

export interface GrupoSinProveedor {
  concepto:             string;
  cantidad_movimientos: number;
  movimientos_ids:      number[];
  tipos:                string[];
  tabs:                 string[];
  monto_total:          number;
  moneda:               string;
}

export interface SinProveedorResponse {
  grupos:              GrupoSinProveedor[];
  total_sin_proveedor: number;
  total_movimientos:   number;
}

export interface VincularProveedorPayload {
  movimientos_ids: number[];
  proveedor_id:    number | null;
  crear_proveedor?: {
    nombre: string;
    alias?:  string;
  };
}

export interface VincularProveedorResult {
  proveedor: {
    id:       number;
    nombre:   string;
    alias:    string | null;
    es_nuevo: boolean;
  };
  movimientos_actualizados: number;
}

export const sinProveedorKey = (eventoId: number) =>
  ['movimientos', 'sin-proveedor', eventoId] as const;

export function useSinProveedor(eventoId: number) {
  return useQuery<SinProveedorResponse>({
    queryKey: sinProveedorKey(eventoId),
    queryFn:  () =>
      api.get(`/eventos/${eventoId}/movimientos/sin-proveedor`).then(r => r.data),
    staleTime: 5 * 60 * 1000,
  });
}

export function useVincularProveedor(eventoId: number) {
  const qc = useQueryClient();
  return useMutation<VincularProveedorResult, Error, VincularProveedorPayload>({
    mutationFn: data =>
      api.post('/movimientos/vincular-proveedor', data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: sinProveedorKey(eventoId) });
      qc.invalidateQueries({ queryKey: ['movimientos', eventoId] });
    },
  });
}
