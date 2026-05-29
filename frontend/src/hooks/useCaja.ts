import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { CuentaBancaria, MovimientoCaja, PosicionConsolidada } from '@/types';

// ── Query keys ─────────────────────────────────��──────────────────────────────

export const cuentasKey         = (eventoId: number) => ['eventos', eventoId, 'cuentas'];
export const movCajaKey         = (cuentaId: number) => ['cuentas', cuentaId, 'movimientos'];
export const posicionKey        = (eventoId: number) => ['eventos', eventoId, 'posicion-consolidada'];
export const sinConciliarKey    = (eventoId: number) => ['eventos', eventoId, 'movimientos-sin-conciliar'];

// ── Cuentas ────────────────────────────────���─────────────────────────��────────

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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: cuentasKey(eventoId) });
      qc.invalidateQueries({ queryKey: posicionKey(eventoId) });
    },
  });
}

export function useUpdateCuenta(eventoId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CuentaBancaria> }) =>
      api.put(`/cuentas/${id}`, data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: cuentasKey(eventoId) });
      qc.invalidateQueries({ queryKey: posicionKey(eventoId) });
    },
  });
}

export function useDeleteCuenta(eventoId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/cuentas/${id}`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: cuentasKey(eventoId) });
      qc.invalidateQueries({ queryKey: posicionKey(eventoId) });
    },
  });
}

// ── Movimientos de Caja ────────────────────────────────────────────���──────────

export function useMovimientosCaja(cuentaId: number) {
  return useQuery<MovimientoCaja[]>({
    queryKey: movCajaKey(cuentaId),
    queryFn:  () => api.get(`/cuentas/${cuentaId}/movimientos`).then(r => r.data),
    enabled:  cuentaId > 0,
  });
}

export function useCreateMovimientoCaja(cuentaId: number, eventoId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { fecha?: string | null; descripcion?: string | null; debe: number; haber: number }) =>
      api.post(`/cuentas/${cuentaId}/movimientos`, data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: movCajaKey(cuentaId) });
      qc.invalidateQueries({ queryKey: posicionKey(eventoId) });
    },
  });
}

export function useUpdateMovimientoCaja(cuentaId: number, eventoId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<MovimientoCaja> }) =>
      api.put(`/movimientos-caja/${id}`, data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: movCajaKey(cuentaId) });
      qc.invalidateQueries({ queryKey: posicionKey(eventoId) });
    },
  });
}

export function useDeleteMovimientoCaja(cuentaId: number, eventoId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/movimientos-caja/${id}`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: movCajaKey(cuentaId) });
      qc.invalidateQueries({ queryKey: posicionKey(eventoId) });
    },
  });
}

// ── Transferencia ─────────────────────────��──────────────────────────��────────

interface TransferenciaPayload {
  cuenta_origen_id:  number;
  cuenta_destino_id: number;
  importe:           number;
  moneda:            string;
  fecha?:            string | null;
  descripcion?:      string | null;
}

export function useTransferencia(eventoId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: TransferenciaPayload) =>
      api.post(`/eventos/${eventoId}/cuentas/transferencia`, data).then(r => r.data),
    onSuccess: (data) => {
      const origenId  = data.movimiento_origen?.cuenta_id;
      const destinoId = data.movimiento_destino?.cuenta_id;
      if (origenId)  qc.invalidateQueries({ queryKey: movCajaKey(origenId) });
      if (destinoId) qc.invalidateQueries({ queryKey: movCajaKey(destinoId) });
      qc.invalidateQueries({ queryKey: posicionKey(eventoId) });
    },
  });
}

// ── Conciliar ─────────────────────────────────────────────────────────────────

export function useConciliar(eventoId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ movCajaId, movimientoId }: { movCajaId: number; movimientoId: number }) =>
      api.post(`/movimientos-caja/${movCajaId}/conciliar`, { movimiento_id: movimientoId }).then(r => r.data),
    onSuccess: () => {
      // We don't know the cuentaId from here — invalidate all cuentas' movs for this event
      qc.invalidateQueries({ queryKey: ['cuentas'] });
      qc.invalidateQueries({ queryKey: sinConciliarKey(eventoId) });
    },
  });
}

// ── Posición Consolidada ──────────────────────────────────────────────────────

export function usePosicionConsolidada(eventoId: number) {
  return useQuery<PosicionConsolidada>({
    queryKey: posicionKey(eventoId),
    queryFn:  () => api.get(`/eventos/${eventoId}/posicion-consolidada`).then(r => r.data),
  });
}

// ── Movimientos sin conciliar ─────────────────────────────────────────────────

export function useMovimientosSinConciliar(eventoId: number, enabled: boolean) {
  return useQuery({
    queryKey: sinConciliarKey(eventoId),
    queryFn:  () => api.get(`/eventos/${eventoId}/movimientos-sin-conciliar`).then(r => r.data),
    enabled,
    staleTime: 0,
  });
}
