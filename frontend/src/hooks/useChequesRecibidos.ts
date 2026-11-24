import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { ChequeRecibido, ChequesRecibidosRespuesta, EstadoChequeRecibido, FormatoCheque, Moneda } from '@/types';

// Cartera de cheques de clientes — /api/cheques-recibidos
const KEY = ['cheques-recibidos'] as const;

export function useChequesRecibidos(filtros: { vista?: 'cartera' | 'todos'; q?: string } = {}) {
  return useQuery({
    queryKey: [...KEY, filtros],
    queryFn:  () => api.get<ChequesRecibidosRespuesta>('/cheques-recibidos', { params: filtros }).then(r => r.data),
  });
}

export interface ChequeRecibidoPayload {
  formato: FormatoCheque; numero: string; banco?: string | null; librador: string; librador_cuit?: string | null;
  importe: number; moneda?: Moneda; fecha_pago: string; fecha_emision?: string | null; notas?: string | null;
}

export interface EstadoChequePayload {
  estado: EstadoChequeRecibido; fecha?: string | null; cuenta_id?: number | null; asentar_en_caja?: boolean;
  banco_descuento?: string | null; tasa_descuento?: number | null; monto_neto?: number | null;
  endosado_a?: string | null; proveedor_id?: number | null; motivo_rechazo?: string | null;
}

function useInvalidar() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: KEY });
    qc.invalidateQueries({ queryKey: ['facturas-emitidas'] });
    qc.invalidateQueries({ queryKey: ['calendario'] });
    qc.invalidateQueries({ queryKey: ['notificaciones'] });
    qc.invalidateQueries({ queryKey: ['cuentas-empresa'] });
  };
}

export function useGuardarChequeRecibido() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: ({ id, data }: { id?: number; data: ChequeRecibidoPayload }) =>
      (id ? api.put(`/cheques-recibidos/${id}`, data) : api.post('/cheques-recibidos', data)).then(r => r.data as ChequeRecibido),
    onSuccess: invalidar,
  });
}

export function useEliminarChequeRecibido() {
  const invalidar = useInvalidar();
  return useMutation({ mutationFn: (id: number) => api.delete(`/cheques-recibidos/${id}`), onSuccess: invalidar });
}

export function useEstadoChequeRecibido() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: EstadoChequePayload }) =>
      api.post(`/cheques-recibidos/${id}/estado`, data).then(r => r.data as { cheque: ChequeRecibido; aviso: string | null }),
    onSuccess: invalidar,
  });
}

export interface ImportRecibidosResultado {
  hojas: string[]; total: number; nuevos: number; ya_estaban: number; por_estado: Record<string, number>;
  muestra: { numero: string; librador: string; fecha_pago: string; importe: number; estado: EstadoChequeRecibido }[];
  aplicado: boolean;
}

export function useImportarChequesRecibidos() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: ({ archivo, preview }: { archivo: File; preview: boolean }) => {
      const fd = new FormData();
      fd.append('archivo', archivo);
      return api.post<ImportRecibidosResultado>(`/cheques-recibidos/importar?preview=${preview}`, fd).then(r => r.data);
    },
    onSuccess: r => { if (r.aplicado) invalidar(); },
  });
}
