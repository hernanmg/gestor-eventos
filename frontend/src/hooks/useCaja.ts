import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { CuentaBancaria, MovimientoCaja, PosicionConsolidada, ResumenAndrea, ImportAndreaResultado } from '@/types';

// ── Query keys ─────────────────────────────────��──────────────────────────────

export const cuentasKey         = (eventoId: number) => ['eventos', eventoId, 'cuentas'];
// Scoped al evento — una cuenta puede estar vinculada a más de un evento, así
// que la key no puede depender sólo de cuentaId (mezclaría el caché de dos
// eventos distintos para la misma cuenta compartida).
export const movCajaKey         = (cuentaId: number, eventoId: number) => ['eventos', eventoId, 'cuentas', cuentaId, 'movimientos'];
export const posicionKey        = (eventoId: number) => ['eventos', eventoId, 'posicion-consolidada'];
export const sinConciliarKey    = (eventoId: number) => ['eventos', eventoId, 'movimientos-sin-conciliar'];

// ── Cuentas ────────────────────────────────���─────────────────────────��────────

// ── Cuentas de empresa (Caja Global — con o sin evento) ───────────────────────

export const cuentasEmpresaKey = (params?: { evento_id?: number | null; tipo?: string; moneda?: string; para_evento?: number; estado?: string }) =>
  ['cuentas-empresa', params ?? {}];

export function useCuentasEmpresa(params?: { evento_id?: number | null; tipo?: string; moneda?: string; para_evento?: number; estado?: string }) {
  return useQuery<CuentaBancaria[]>({
    queryKey: cuentasEmpresaKey(params),
    queryFn:  () => {
      const p = new URLSearchParams();
      if (params?.evento_id)   p.set('evento_id',   String(params.evento_id));
      if (params?.tipo)        p.set('tipo',        params.tipo);
      if (params?.moneda)      p.set('moneda',      params.moneda);
      if (params?.para_evento) p.set('para_evento', String(params.para_evento));
      if (params?.estado)      p.set('estado',      params.estado);
      return api.get(`/cuentas?${p}`).then(r => r.data);
    },
  });
}

// Cuentas de la empresa candidatas para vincular a `eventoId` — cualquier
// cuenta (tenga o no evento_id propio), salvo las que ya están vinculadas a
// ESE evento vía EventoCuenta. "Asignar cuenta existente" en la tab Caja.
export function useCuentasParaEvento(eventoId: number) {
  return useCuentasEmpresa({ para_evento: eventoId });
}

export function useCreateCuentaEmpresa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { nombre: string; tipo: string; moneda: string; saldo_inicial: number; saldo_minimo?: number | null }) =>
      api.post('/cuentas', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cuentas-empresa'] }),
  });
}

// Cambia el estado de rendición de una cuenta (ver PATCH /api/cuentas/:id/estado).
export function useUpdateEstadoCuenta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, estado, notas_rendicion }: { id: number; estado: string; notas_rendicion?: string | null }) =>
      api.patch(`/cuentas/${id}/estado`, { estado, notas_rendicion }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cuentas-empresa'] });
      qc.invalidateQueries({ queryKey: ['cuentas'] });
      qc.invalidateQueries({ queryKey: ['calendario'] });
    },
  });
}

export function useCuentas(eventoId: number) {
  return useQuery<CuentaBancaria[]>({
    queryKey: cuentasKey(eventoId),
    queryFn:  () => api.get(`/eventos/${eventoId}/cuentas`).then(r => r.data),
  });
}

export function useCreateCuenta(eventoId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { nombre: string; tipo: string; moneda: string; saldo_inicial: number; saldo_minimo?: number | null }) =>
      api.post(`/eventos/${eventoId}/cuentas`, data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: cuentasKey(eventoId) });
      qc.invalidateQueries({ queryKey: posicionKey(eventoId) });
    },
  });
}

// Vincula una cuenta de empresa ya existente al evento (no crea una cuenta
// nueva) — ver EventoCuenta en schema.prisma.
export function useVincularCuenta(eventoId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (cuentaId: number) =>
      api.post(`/eventos/${eventoId}/cuentas/vincular`, { cuenta_id: cuentaId }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: cuentasKey(eventoId) });
      qc.invalidateQueries({ queryKey: posicionKey(eventoId) });
      qc.invalidateQueries({ queryKey: ['cuentas-empresa'] });
    },
  });
}

// Sólo elimina el vínculo — la cuenta sigue existiendo en Caja Global.
export function useDesvincularCuenta(eventoId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (cuentaId: number) =>
      api.delete(`/eventos/${eventoId}/cuentas/${cuentaId}/desvincular`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: cuentasKey(eventoId) });
      qc.invalidateQueries({ queryKey: posicionKey(eventoId) });
      qc.invalidateQueries({ queryKey: ['cuentas-empresa'] });
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

// ── Detalle de cuenta (Caja Global) ───────────────────────────────────────────
// Sin contexto de evento — usado por la pantalla /caja/:cuentaId. Los
// movimientos acá son TODOS los de la cuenta (de cualquier evento, o
// ninguno), a diferencia de useMovimientosCaja() que filtra por evento.

export const cuentaDetalleKey  = (id: number) => ['cuentas', id, 'detalle'];
export const movCuentaKey      = (cuentaId: number) => ['cuentas', cuentaId, 'movimientos-todos'];

export function useCuentaDetalle(id: number) {
  return useQuery<CuentaBancaria>({
    queryKey: cuentaDetalleKey(id),
    queryFn:  () => api.get(`/cuentas/${id}`).then(r => r.data),
    enabled:  id > 0,
  });
}

// Edita datos generales de la cuenta (saldo_minimo, etc.) desde el detalle en
// Caja Global, sin depender de un eventoId (a diferencia de useUpdateCuenta).
export function useUpdateCuentaDetalle(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<CuentaBancaria>) =>
      api.put(`/cuentas/${id}`, data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: cuentaDetalleKey(id) });
      qc.invalidateQueries({ queryKey: ['cuentas-empresa'] });
    },
  });
}

export function useMovimientosCuenta(cuentaId: number) {
  return useQuery<MovimientoCaja[]>({
    queryKey: movCuentaKey(cuentaId),
    queryFn:  () => api.get(`/cuentas/${cuentaId}/movimientos`).then(r => r.data),
    enabled:  cuentaId > 0,
  });
}

export interface CreateMovimientoCuentaPayload {
  fecha?:              string | null;
  descripcion?:        string | null;
  debe:                number;
  haber:               number;
  categoria_andrea?:   string | null;
  responsable_nombre?: string | null;
  referencia?:         string | null;
  comprobante?:        File | null;
}

// Sin evento_id — para movimientos de empresa no vinculados a ningún evento.
// Si viene `comprobante`, se manda como multipart/form-data; si no, JSON plano
// (el backend acepta ambos — ver comprobanteMiddleware en routes/caja.ts).
export function useCreateMovimientoCuenta(cuentaId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateMovimientoCuentaPayload) => {
      if (data.comprobante) {
        const fd = new FormData();
        fd.append('debe', String(data.debe));
        fd.append('haber', String(data.haber));
        if (data.fecha)              fd.append('fecha', data.fecha);
        if (data.descripcion)        fd.append('descripcion', data.descripcion);
        if (data.categoria_andrea)   fd.append('categoria_andrea', data.categoria_andrea);
        if (data.responsable_nombre) fd.append('responsable_nombre', data.responsable_nombre);
        if (data.referencia)         fd.append('referencia', data.referencia);
        fd.append('comprobante', data.comprobante);
        return api.post(`/cuentas/${cuentaId}/movimientos`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data);
      }
      const { comprobante: _comprobante, ...rest } = data;
      return api.post(`/cuentas/${cuentaId}/movimientos`, rest).then(r => r.data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: movCuentaKey(cuentaId) });
      qc.invalidateQueries({ queryKey: cuentaDetalleKey(cuentaId) });
      qc.invalidateQueries({ queryKey: ['cuentas-empresa'] });
      qc.invalidateQueries({ queryKey: ['caja', 'resumen-andrea'] });
    },
  });
}

export function useUpdateMovimientoCuenta(cuentaId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<MovimientoCaja> }) =>
      api.put(`/movimientos-caja/${id}`, data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: movCuentaKey(cuentaId) });
      qc.invalidateQueries({ queryKey: cuentaDetalleKey(cuentaId) });
      qc.invalidateQueries({ queryKey: ['cuentas-empresa'] });
      qc.invalidateQueries({ queryKey: ['caja', 'resumen-andrea'] });
    },
  });
}

export function useDeleteMovimientoCuenta(cuentaId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/movimientos-caja/${id}`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: movCuentaKey(cuentaId) });
      qc.invalidateQueries({ queryKey: cuentaDetalleKey(cuentaId) });
      qc.invalidateQueries({ queryKey: ['cuentas-empresa'] });
      qc.invalidateQueries({ queryKey: ['caja', 'resumen-andrea'] });
    },
  });
}

// ── Vista de Andrea (Caja del mes, DOS57) ─────────────────────────────────────

export const resumenAndreaKey = (cuentaId: number, mes: number, anio: number) => ['caja', 'resumen-andrea', cuentaId, mes, anio];

export function useResumenAndrea(cuentaId: number, mes: number, anio: number) {
  return useQuery<ResumenAndrea>({
    queryKey: resumenAndreaKey(cuentaId, mes, anio),
    queryFn:  () => api.get('/caja/resumen-andrea', { params: { cuenta_id: cuentaId, mes, anio } }).then(r => r.data),
    enabled:  cuentaId > 0,
  });
}

export function comprobanteMovCajaUrl(movId: number): string {
  const base = (api.defaults.baseURL ?? '').replace(/\/$/, '');
  return `${base}/movimientos-caja/${movId}/comprobante`;
}

export function useImportarCajaAndrea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append('archivo', file);
      return api.post<ImportAndreaResultado>('/caja/importar-andrea', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }).then(r => r.data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['caja', 'resumen-andrea'] });
      qc.invalidateQueries({ queryKey: ['cuentas-empresa'] });
    },
  });
}

// ── Movimientos de Caja ────────────────────────────────────────────���──────────

// Scoped al evento: una cuenta puede estar vinculada a más de un evento
// (EventoCuenta) — la tab Caja de un evento sólo debe ver/crear los
// movimientos cargados en SU contexto, no los de otro evento que comparte
// la misma cuenta. Caja Global sigue usando el endpoint flat (sin evento).
export function useMovimientosCaja(cuentaId: number, eventoId: number) {
  return useQuery<MovimientoCaja[]>({
    queryKey: movCajaKey(cuentaId, eventoId),
    queryFn:  () => api.get(`/eventos/${eventoId}/cuentas/${cuentaId}/movimientos`).then(r => r.data),
    enabled:  cuentaId > 0 && eventoId > 0,
  });
}

export function useCreateMovimientoCaja(cuentaId: number, eventoId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { fecha?: string | null; descripcion?: string | null; debe: number; haber: number }) =>
      api.post(`/eventos/${eventoId}/cuentas/${cuentaId}/movimientos`, data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: movCajaKey(cuentaId, eventoId) });
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
      qc.invalidateQueries({ queryKey: movCajaKey(cuentaId, eventoId) });
      qc.invalidateQueries({ queryKey: posicionKey(eventoId) });
    },
  });
}

export function useDeleteMovimientoCaja(cuentaId: number, eventoId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/movimientos-caja/${id}`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: movCajaKey(cuentaId, eventoId) });
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
      if (origenId)  qc.invalidateQueries({ queryKey: movCajaKey(origenId, eventoId) });
      if (destinoId) qc.invalidateQueries({ queryKey: movCajaKey(destinoId, eventoId) });
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
