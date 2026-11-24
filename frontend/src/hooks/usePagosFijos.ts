import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { AgendaPagosFijos, EstadoPagoFijo, ImportPagosFijosResultado, Moneda, PagoFijoConcepto } from '@/types';

// Agenda de pagos fijos — /api/pagos-fijos
const KEY = ['pagos-fijos'] as const;

export function useAgendaPagosFijos(periodo: string) {
  return useQuery({
    queryKey: [...KEY, 'agenda', periodo],
    queryFn:  () => api.get<AgendaPagosFijos>('/pagos-fijos', { params: { periodo } }).then(r => r.data),
  });
}

export function useConceptosPagoFijo() {
  return useQuery({
    queryKey: [...KEY, 'conceptos'],
    queryFn:  () => api.get<PagoFijoConcepto[]>('/pagos-fijos/conceptos').then(r => r.data),
  });
}

export interface ConceptoPayload {
  grupo: string; nombre: string; referencia?: string | null; medio_pago?: string | null; cuenta_id?: number | null;
  dia_vencimiento?: number | null; monto_estimado?: number | null; moneda?: Moneda; activo?: boolean; notas?: string | null;
}

export interface MesPayload {
  estado: EstadoPagoFijo; monto?: number | null; vencimiento?: string | null; fecha_pago?: string | null;
  medio_pago?: string | null; notas?: string | null; cuenta_id?: number | null;
}

function useInvalidar() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: KEY });
    qc.invalidateQueries({ queryKey: ['calendario'] });
    qc.invalidateQueries({ queryKey: ['cuentas-empresa'] });
    qc.invalidateQueries({ queryKey: ['movimientos-caja'] });
  };
}

export function useGuardarConcepto() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: ({ id, data }: { id?: number; data: ConceptoPayload }) =>
      (id ? api.put(`/pagos-fijos/conceptos/${id}`, data) : api.post('/pagos-fijos/conceptos', data)).then(r => r.data),
    onSuccess: invalidar,
  });
}

export function useEliminarConcepto() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/pagos-fijos/conceptos/${id}`).then(r => r.data as { eliminado?: boolean; desactivado?: boolean }),
    onSuccess: invalidar,
  });
}

export function useRegistrarMes() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: ({ id, periodo, data }: { id: number; periodo: string; data: MesPayload }) =>
      api.put(`/pagos-fijos/${id}/mes/${periodo}`, data).then(r => r.data),
    onSuccess: invalidar,
  });
}

export function useImportarPagosFijos() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: ({ archivo, preview, secciones }: { archivo: File; preview: boolean; secciones?: string[] }) => {
      const fd = new FormData();
      fd.append('archivo', archivo);
      if (secciones) fd.append('secciones', JSON.stringify(secciones));
      return api.post<ImportPagosFijosResultado>(`/pagos-fijos/importar?preview=${preview}`, fd).then(r => r.data);
    },
    onSuccess: (r) => { if (r.aplicado) invalidar(); },
  });
}
