import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type {
  Empleado, EmpleadoConStats, Jornada, Anticipo, Liquidacion, LiquidacionDetalle, LiquidacionPreview,
  CategoriaEmpleado, EstadoEmpleado, EstadoJornada, EstadoLiquidacion, TipoAnticipo, TipoLiquidacion,
} from '@/types';

const EMPLEADOS_KEY     = ['rrhh', 'empleados'];
const JORNADAS_KEY      = ['rrhh', 'jornadas'];
const LIQUIDACIONES_KEY = ['rrhh', 'liquidaciones'];

// ═══════════════════════════════════════════════════════════════════════════
// EMPLEADOS
// ═══════════════════════════════════════════════════════════════════════════

export interface EmpleadoFiltros {
  categoria?: CategoriaEmpleado;
  estado?:    EstadoEmpleado;
  q?:         string;
}

export function useEmpleados(filtros: EmpleadoFiltros = {}) {
  return useQuery<Empleado[]>({
    queryKey: [...EMPLEADOS_KEY, filtros],
    queryFn:  () => api.get('/rrhh/empleados', { params: filtros }).then(r => r.data),
  });
}

export function useEmpleado(id: number | null) {
  return useQuery<EmpleadoConStats>({
    queryKey: [...EMPLEADOS_KEY, id],
    queryFn:  () => api.get(`/rrhh/empleados/${id}`).then(r => r.data),
    enabled:  id !== null,
  });
}

export interface EmpleadoPayload {
  nombre:            string;
  apellido:          string;
  dni:                string;
  cuit?:              string | null;
  email?:             string | null;
  telefono?:          string | null;
  domicilio?:         string | null;
  cbu?:               string | null;
  alias?:             string | null;
  banco?:             string | null;
  categoria:          CategoriaEmpleado;
  valor_hora:         number;
  valor_hora_extra:   number;
  estado?:            EstadoEmpleado;
  notas?:             string | null;

  tipo_liquidacion?:         TipoLiquidacion;
  valor_jornada_completa?:   number | null;
  valor_media_jornada?:      number | null;
  umbral_horas_jornada?:     number | null;
  umbral_horas_media?:       number | null;
  valor_hora_extra_jornada?: number | null;
  valor_viaje?:              number | null;

  apodo?:                      string | null;
  fecha_nacimiento?:           string | null;
  grupo_sanguineo?:            string | null;
  contacto_emergencia_nombre?: string | null;
  contacto_emergencia_tel?:    string | null;
  escalafon?:                  number | null;
  art?:                        string | null;
  licencia_conducir?:          boolean;
  equipamiento_asignado?:      string | null;
  talle_pantalon?:             string | null;
  talle_remera?:               string | null;
  talle_buzo?:                 string | null;
  talle_calzado?:              string | null;
}

export function useCreateEmpleado() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: EmpleadoPayload) => api.post('/rrhh/empleados', data).then(r => r.data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: EMPLEADOS_KEY }),
  });
}

export function useUpdateEmpleado() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<EmpleadoPayload> }) =>
      api.put(`/rrhh/empleados/${id}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: EMPLEADOS_KEY }),
  });
}

export function useDeleteEmpleado() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/rrhh/empleados/${id}`).then(r => r.data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: EMPLEADOS_KEY }),
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// JORNADAS
// ═══════════════════════════════════════════════════════════════════════════

export interface JornadaFiltros {
  empleado_id?: number;
  evento_id?:   number;
  estado?:      EstadoJornada;
  desde?:       string;
  hasta?:       string;
}

export function useJornadas(filtros: JornadaFiltros = {}) {
  return useQuery<Jornada[]>({
    queryKey: [...JORNADAS_KEY, filtros],
    queryFn:  () => api.get('/rrhh/jornadas', { params: filtros }).then(r => r.data),
  });
}

export function useJornadasEmpleado(empleadoId: number | null) {
  return useQuery<Jornada[]>({
    queryKey: [...EMPLEADOS_KEY, empleadoId, 'jornadas'],
    queryFn:  () => api.get(`/rrhh/empleados/${empleadoId}/jornadas`).then(r => r.data),
    enabled:  empleadoId !== null,
  });
}

export interface JornadaPayload {
  empleado_id?:       number;
  evento_id?:         number | null;
  fecha:              string;
  hora_convocatoria?: string | null;
  hora_ingreso?:      string | null;
  hora_egreso?:       string | null;
  descripcion?:       string | null;
  cantidad_viajes?:   number | null;
  convocatoria?:      string | null;
  lugar_trabajo?:     string | null;
  camion_id?:         number | null;
}

function invalidateJornadas(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: JORNADAS_KEY });
  qc.invalidateQueries({ queryKey: EMPLEADOS_KEY });
}

export function useCreateJornada() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: JornadaPayload) => api.post('/rrhh/jornadas', data).then(r => r.data),
    onSuccess:  () => invalidateJornadas(qc),
  });
}

export function useUpdateJornada() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<JornadaPayload> }) =>
      api.put(`/rrhh/jornadas/${id}`, data).then(r => r.data),
    onSuccess: () => invalidateJornadas(qc),
  });
}

export function useAprobarJornada() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.patch(`/rrhh/jornadas/${id}/aprobar`).then(r => r.data),
    onSuccess:  () => invalidateJornadas(qc),
  });
}

export function useRechazarJornada() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, motivo }: { id: number; motivo: string }) =>
      api.patch(`/rrhh/jornadas/${id}/rechazar`, { motivo }).then(r => r.data),
    onSuccess: () => invalidateJornadas(qc),
  });
}

export function useDeleteJornada() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/rrhh/jornadas/${id}`).then(r => r.data),
    onSuccess:  () => invalidateJornadas(qc),
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// ANTICIPOS
// ═══════════════════════════════════════════════════════════════════════════

export function useAnticiposEmpleado(empleadoId: number | null) {
  return useQuery<Anticipo[]>({
    queryKey: [...EMPLEADOS_KEY, empleadoId, 'anticipos'],
    queryFn:  () => api.get(`/rrhh/empleados/${empleadoId}/anticipos`).then(r => r.data),
    enabled:  empleadoId !== null,
  });
}

export interface AnticipoPayload {
  empleado_id: number;
  tipo:        TipoAnticipo;
  monto:       number;
  fecha:       string;
  motivo?:     string | null;
}

export function useCreateAnticipo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: AnticipoPayload) => api.post('/rrhh/anticipos', data).then(r => r.data),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: EMPLEADOS_KEY });
    },
  });
}

export function useDeleteAnticipo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/rrhh/anticipos/${id}`).then(r => r.data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: EMPLEADOS_KEY }),
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// LIQUIDACIONES
// ═══════════════════════════════════════════════════════════════════════════

export interface LiquidacionFiltros {
  empleado_id?: number;
  evento_id?:   number;
  estado?:      EstadoLiquidacion;
  desde?:       string;
  hasta?:       string;
}

export function useLiquidaciones(filtros: LiquidacionFiltros = {}) {
  return useQuery<Liquidacion[]>({
    queryKey: [...LIQUIDACIONES_KEY, filtros],
    queryFn:  () => api.get('/rrhh/liquidaciones', { params: filtros }).then(r => r.data),
  });
}

export function useLiquidacion(id: number | null) {
  return useQuery<LiquidacionDetalle>({
    queryKey: [...LIQUIDACIONES_KEY, id],
    queryFn:  () => api.get(`/rrhh/liquidaciones/${id}`).then(r => r.data),
    enabled:  id !== null,
  });
}

export interface GenerarLiquidacionPayload {
  empleado_id: number;
  fecha_desde: string;
  fecha_hasta: string;
  evento_id?:  number | null;
}

export function usePreviewLiquidacion(params: { empleado_id?: number; fecha_desde?: string; fecha_hasta?: string }) {
  const { empleado_id, fecha_desde, fecha_hasta } = params;
  return useQuery<LiquidacionPreview>({
    queryKey: [...LIQUIDACIONES_KEY, 'preview', params],
    queryFn:  () => api.get('/rrhh/liquidaciones/preview', { params: { empleado_id, fecha_desde, fecha_hasta } }).then(r => r.data),
    enabled:  !!empleado_id && !!fecha_desde && !!fecha_hasta,
  });
}

export function useGenerarLiquidacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: GenerarLiquidacionPayload) => api.post('/rrhh/liquidaciones/generar', data).then(r => r.data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: LIQUIDACIONES_KEY }),
  });
}

export function useAprobarLiquidacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.patch(`/rrhh/liquidaciones/${id}/aprobar`).then(r => r.data),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: LIQUIDACIONES_KEY });
      qc.invalidateQueries({ queryKey: EMPLEADOS_KEY });
    },
  });
}

export function useCancelarLiquidacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.patch(`/rrhh/liquidaciones/${id}/cancelar`).then(r => r.data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: LIQUIDACIONES_KEY }),
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// IMPORTADORES
// ═══════════════════════════════════════════════════════════════════════════

export function useImportarEmpleados() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ file, dryRun }: { file: File; dryRun: boolean }) => {
      const formData = new FormData();
      formData.append('file', file);
      return api.post(`/rrhh/importar/empleados?dry_run=${dryRun}`, formData).then(r => r.data);
    },
    onSuccess: (_data, vars) => { if (!vars.dryRun) qc.invalidateQueries({ queryKey: EMPLEADOS_KEY }); },
  });
}

export async function descargarLiquidacionPDF(id: number): Promise<void> {
  const res  = await api.get(`/rrhh/liquidaciones/${id}/pdf`, { responseType: 'blob' });
  const url  = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `liquidacion-${id}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

export function useImportarJornadas() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ file, dryRun }: { file: File; dryRun: boolean }) => {
      const formData = new FormData();
      formData.append('file', file);
      return api.post(`/rrhh/importar/jornadas?dry_run=${dryRun}`, formData).then(r => r.data);
    },
    onSuccess: (_data, vars) => { if (!vars.dryRun) invalidateJornadas(qc); },
  });
}
