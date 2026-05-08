import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { CuentaBancaria, MovimientoCaja } from '@/types';

// ── Query keys ────────────────────────────────────────────────────────────────

export const cuentasKey  = (eventoId: number)  => ['eventos', eventoId, 'cuentas'];
export const movCajaKey  = (cuentaId: number)  => ['cuentas', cuentaId, 'movimientos'];

// ── Cuentas ───────────────────────────────────────────────────────────────────

export function useCuentas(eventoId: number) {
  return useQuery<CuentaBancaria[]>({
    queryKey: cuentasKey(eventoId),
    queryFn:  () => api.get(`/eventos/${eventoId}/cuentas`).then(r => r.data),
  });
}

export function useCreateCuenta(eventoId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { nombre: string; tipo: string; moneda: string; saldo_inicial: number }) =>
      api.post(`/eventos/${eventoId}/cuentas`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: cuentasKey(eventoId) }),
  });
}

export function useUpdateCuenta(eventoId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CuentaBancaria> }) =>
      api.put(`/cuentas/${id}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: cuentasKey(eventoId) }),
  });
}

export function useDeleteCuenta(eventoId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/cuentas/${id}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: cuentasKey(eventoId) }),
  });
}

// ── Movimientos de Caja ───────────────────────────────────────────────────────

export function useMovimientosCaja(cuentaId: number) {
  return useQuery<MovimientoCaja[]>({
    queryKey: movCajaKey(cuentaId),
    queryFn:  () => api.get(`/cuentas/${cuentaId}/movimientos`).then(r => r.data),
    enabled:  cuentaId > 0,
  });
}

export function useCreateMovimientoCaja(cuentaId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { fecha?: string | null; descripcion?: string | null; debe: number; haber: number }) =>
      api.post(`/cuentas/${cuentaId}/movimientos`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: movCajaKey(cuentaId) }),
  });
}

export function useUpdateMovimientoCaja(cuentaId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<MovimientoCaja> }) =>
      api.put(`/movimientos-caja/${id}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: movCajaKey(cuentaId) }),
  });
}

export function useDeleteMovimientoCaja(cuentaId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/movimientos-caja/${id}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: movCajaKey(cuentaId) }),
  });
}
