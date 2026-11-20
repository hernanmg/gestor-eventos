import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { PolizaPersonal, PersonaSeguro, PedidoProductorGrupo, SugerenciasLegajo, TipoSeguroPersonal } from '@/types';

// Seguro del personal (ART/AP) — /api/seguros-personal
const KEY = ['seguros-personal'] as const;

function useInvalidar() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: KEY });
    qc.invalidateQueries({ queryKey: ['calendario'] });
    qc.invalidateQueries({ queryKey: ['notificaciones'] });
  };
}

export function usePolizasPersonal() {
  return useQuery({
    queryKey: [...KEY, 'polizas'],
    queryFn:  () => api.get<PolizaPersonal[]>('/seguros-personal/polizas').then(r => r.data),
  });
}

export function usePersonalSeguro() {
  return useQuery({
    queryKey: [...KEY, 'personal'],
    queryFn:  () => api.get<PersonaSeguro[]>('/seguros-personal/personal').then(r => r.data),
  });
}

export interface PolizaPersonalPayload {
  tipo:               TipoSeguroPersonal;
  aseguradora:        string;
  numero_poliza?:     string | null;
  productor?:         string | null;
  productor_contacto?: string | null;
  fecha_inicio?:      string | null;
  fecha_vencimiento?: string | null;
  notas?:             string | null;
  archivo?:           File | null;
}

function polizaFormData(d: Partial<PolizaPersonalPayload>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(d)) {
    if (k === 'archivo') { if (v) fd.append('archivo', v as File); continue; }
    if (v === undefined) continue;
    fd.append(k, v === null ? '' : String(v));
  }
  return fd;
}

export function useGuardarPolizaPersonal() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: ({ id, data }: { id?: number; data: Partial<PolizaPersonalPayload> }) =>
      (id ? api.put(`/seguros-personal/polizas/${id}`, polizaFormData(data)) : api.post('/seguros-personal/polizas', polizaFormData(data))).then(r => r.data),
    onSuccess: invalidar,
  });
}

export function useEliminarPolizaPersonal() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/seguros-personal/polizas/${id}`),
    onSuccess:  invalidar,
  });
}

export const documentoPolizaPersonalUrl = (id: number) => `${(api.defaults.baseURL ?? '').replace(/\/$/, '')}/seguros-personal/polizas/${id}/documento`;

export function useAltaCobertura() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (d: { empleado_id: number; poliza_id: number; fecha_alta: string; notas?: string | null }) =>
      api.post('/seguros-personal/coberturas', d).then(r => r.data),
    onSuccess: invalidar,
  });
}

export function useAltaCoberturaLote() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (d: { fecha_alta?: string | null; ya_informada?: boolean; items: { empleado_id: number; poliza_id: number }[] }) =>
      api.post<{ creadas: number; sin_cambios: number; errores: string[] }>('/seguros-personal/coberturas/lote', d).then(r => r.data),
    onSuccess: invalidar,
  });
}

export function useBajaCobertura() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: ({ id, fecha_baja }: { id: number; fecha_baja: string }) =>
      api.patch(`/seguros-personal/coberturas/${id}/baja`, { fecha_baja }).then(r => r.data),
    onSuccess: invalidar,
  });
}

export function useEditarCobertura() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: ({ id, ...d }: { id: number; fecha_alta?: string; fecha_baja?: string | null; notas?: string | null }) =>
      api.put(`/seguros-personal/coberturas/${id}`, d).then(r => r.data),
    onSuccess: invalidar,
  });
}

export function useEliminarCobertura() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/seguros-personal/coberturas/${id}`),
    onSuccess:  invalidar,
  });
}

export function usePedidoProductor(enabled: boolean) {
  return useQuery({
    queryKey: [...KEY, 'pedido'],
    queryFn:  () => api.get<PedidoProductorGrupo[]>('/seguros-personal/pedido-productor').then(r => r.data),
    enabled,
  });
}

export function useMarcarPedido() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (d: { altas: number[]; bajas: number[] }) => api.post('/seguros-personal/pedido-productor/marcar', d).then(r => r.data),
    onSuccess:  invalidar,
  });
}

export function useSugerenciasLegajo(enabled: boolean) {
  return useQuery({
    queryKey: [...KEY, 'sugerencias'],
    queryFn:  () => api.get<SugerenciasLegajo>('/seguros-personal/sugerencias-legajo').then(r => r.data),
    enabled,
  });
}
