import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type {
  AcuerdoSueldo, LiquidacionAdmin, EmpresaMini, CuentaMini, EstadoLiquidacionAdmin, PrestamoEmpleado,
  BitacoraViaje, ResumenBitacora, TipoRecorrido, CategoriaAcuerdo, TipoAumento,
} from '@/types';

const ACUERDOS_KEY  = ['rrhh', 'acuerdos'];
const LIQ_ADMIN_KEY = ['rrhh', 'liquidaciones-admin'];
const PRESTAMOS_KEY = ['rrhh', 'prestamos'];
const BITACORA_KEY  = ['rrhh', 'bitacora-viajes'];

// ═══════════════════════════════════════════════════════════════════════════
// Empresas / Cuentas — soporte para selectores de split y cuenta de pago
// ═══════════════════════════════════════════════════════════════════════════

export function useEmpresasSueldos() {
  return useQuery<EmpresaMini[]>({
    queryKey: ['rrhh', 'empresas'],
    queryFn:  () => api.get('/rrhh/empresas').then(r => r.data),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCuentasPorEmpresa(empresaId: number | null) {
  return useQuery<CuentaMini[]>({
    queryKey: ['rrhh', 'cuentas-empresa', empresaId],
    queryFn:  () => api.get(`/rrhh/cuentas-empresa/${empresaId}`).then(r => r.data),
    enabled:  empresaId !== null,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// HORAS DEL PERÍODO — panel informativo en "Generar liquidación"
// ═══════════════════════════════════════════════════════════════════════════

export interface HorasPeriodo {
  total_horas:       number;
  cantidad_jornadas: number;
  horas_acordadas:   number;
  horas_extras:      number;
}

export function useHorasPeriodo(empleadoId: number | null, mes: number | null, anio: number | null) {
  return useQuery<HorasPeriodo>({
    queryKey: ['rrhh', 'horas-periodo', empleadoId, mes, anio],
    queryFn:  () => api.get(`/rrhh/empleados/${empleadoId}/horas-periodo`, { params: { mes, anio } }).then(r => r.data),
    enabled:  empleadoId !== null && mes !== null && anio !== null,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// IPC DEL INDEC — botón "Traer IPC" en la sección de aumento del dialog de
// generar liquidación. Es una mutation (no query) porque se dispara sólo al
// clickear el botón, no automáticamente.
// ═══════════════════════════════════════════════════════════════════════════

export interface IpcIndec {
  mes:         string; // ej: "julio-2026" — mes real que devolvió el INDEC
  ipc_mensual: number;
  ipc_anual:   number | null;
  fuente:      string;
}

export function useIpcIndec() {
  return useMutation({
    mutationFn: ({ mes, anio }: { mes: number; anio: number }) =>
      api.get<IpcIndec>('/rrhh/ipc-indec', { params: { mes, anio } }).then(r => r.data),
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// RESUMEN MENSUAL — nómina consolidada del período
// ═══════════════════════════════════════════════════════════════════════════

export interface ResumenMensualEmpleado {
  empleado_id:     number;
  empleado_nombre: string;
  basico:     number;
  extras:     number;
  descuentos: number;
  prestamos:  number;
  total:      number;
  splits:     { empresa_nombre: string; monto: number }[];
}

export interface ResumenMensual {
  periodo:   string;
  empleados: ResumenMensualEmpleado[];
  totales: {
    basico: number; extras: number; descuentos: number; prestamos: number; total: number;
    por_empresa: { empresa_nombre: string; monto: number }[];
  };
}

export function useResumenMensual(mes: number | null, anio: number | null) {
  return useQuery<ResumenMensual>({
    queryKey: ['rrhh', 'liquidaciones-admin', 'resumen-mensual', mes, anio],
    queryFn:  () => api.get('/rrhh/liquidaciones-admin/resumen-mensual', { params: { mes, anio } }).then(r => r.data),
    enabled:  mes !== null && anio !== null,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// ACUERDOS
// ═══════════════════════════════════════════════════════════════════════════

export function useAcuerdos() {
  return useQuery<AcuerdoSueldo[]>({
    queryKey: ACUERDOS_KEY,
    queryFn:  () => api.get('/rrhh/acuerdos').then(r => r.data),
  });
}

export function useAcuerdoEmpleado(empleadoId: number | null) {
  return useQuery<AcuerdoSueldo>({
    queryKey: [...ACUERDOS_KEY, empleadoId],
    queryFn:  () => api.get(`/rrhh/acuerdos/${empleadoId}`).then(r => r.data),
    enabled:  empleadoId !== null,
    retry:    false,
  });
}

export interface AcuerdoPayload {
  empleado_id:         number;
  fecha_inicio:        string;
  vigencia_meses?:     number | null;
  escalafon?:          string | null;
  tipo_seguro?:        string | null;
  sueldo_basico:       number;
  horas_acordadas_mes: number;
  premio_incentivo?:   number | null;
  viatico?:            number | null;
  premio_presentismo?: number | null;
  valor_hora_extra?:   number | null;
  telefono?:           number | null;
  viatico_provincial?:    number | null;
  viatico_nacional?:      number | null;
  viatico_nacional_1000?: number | null;
  porcentaje_acuerdo?:    number | null;
  categoria_acuerdo?:     CategoriaAcuerdo;
  horas_pendientes_acum?: number | null;
  notas?:              string | null;
}

export function useCreateAcuerdo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: AcuerdoPayload) => api.post('/rrhh/acuerdos', data).then(r => r.data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ACUERDOS_KEY }),
  });
}

export function useUpdateAcuerdo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Omit<AcuerdoPayload, 'empleado_id'>> & { activo?: boolean } }) =>
      api.put(`/rrhh/acuerdos/${id}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ACUERDOS_KEY }),
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SPLITS
// ═══════════════════════════════════════════════════════════════════════════

export function useUpsertSplits() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ empleadoId, splits }: { empleadoId: number; splits: { empresa_id: number; porcentaje: number }[] }) =>
      api.post(`/rrhh/empleados/${empleadoId}/splits`, { splits }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ACUERDOS_KEY }),
  });
}

export function useDeleteSplits() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (empleadoId: number) => api.delete(`/rrhh/empleados/${empleadoId}/splits`).then(r => r.data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ACUERDOS_KEY }),
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// LIQUIDACIONES ADMIN
// ═══════════════════════════════════════════════════════════════════════════

export interface LiquidacionAdminFiltros {
  empleado_id?: number;
  mes?:         number;
  anio?:        number;
  estado?:      EstadoLiquidacionAdmin;
}

export function useLiquidacionesAdmin(filtros: LiquidacionAdminFiltros = {}) {
  return useQuery<LiquidacionAdmin[]>({
    queryKey: [...LIQ_ADMIN_KEY, filtros],
    queryFn:  () => api.get('/rrhh/liquidaciones-admin', { params: filtros }).then(r => r.data),
  });
}

export function useLiquidacionAdmin(id: number | null) {
  return useQuery<LiquidacionAdmin>({
    queryKey: [...LIQ_ADMIN_KEY, id],
    queryFn:  () => api.get(`/rrhh/liquidaciones-admin/${id}`).then(r => r.data),
    enabled:  id !== null,
  });
}

export interface GenerarLiquidacionAdminPayload {
  empleado_id:          number;
  periodo_mes:          number;
  periodo_anio:         number;
  horas_trabajadas:     number;
  vales_descuentos?:    number;
  vacaciones_aguinaldo?: number;
  // Se manda cuando el usuario clickeó "Usar viático calculado" sobre el
  // resumen de bitácora — reemplaza el viático fijo del acuerdo. Para
  // acuerdos categoria_acuerdo=CHOFER el backend lo aplica automático aunque
  // esto no se mande.
  viatico_override?:    number | null;
  // Aumento sobre el básico — manual o traído del INDEC.
  tipo_aumento?:         TipoAumento;
  porcentaje_aumento?:   number;
  ipc_mes_referencia?:   string;
  ipc_valor_aplicado?:   number;
}

export function useGenerarLiquidacionAdmin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: GenerarLiquidacionAdminPayload) => api.post('/rrhh/liquidaciones-admin/generar', data).then(r => r.data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: LIQ_ADMIN_KEY }),
  });
}

export function useUpdateLiquidacionAdmin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: { horas_trabajadas?: number; vales_descuentos?: number; vacaciones_aguinaldo?: number } }) =>
      api.put(`/rrhh/liquidaciones-admin/${id}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: LIQ_ADMIN_KEY }),
  });
}

export function useAprobarLiquidacionAdmin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, cuentas_pago, prestamos_a_descontar }: {
      id: number;
      cuentas_pago: { empresa_id: number; cuenta_id: number }[];
      prestamos_a_descontar?: { prestamo_id: number; monto: number }[];
    }) =>
      api.patch(`/rrhh/liquidaciones-admin/${id}/aprobar`, { cuentas_pago, prestamos_a_descontar }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: LIQ_ADMIN_KEY });
      qc.invalidateQueries({ queryKey: PRESTAMOS_KEY });
    },
  });
}

export function useCancelarLiquidacionAdmin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.patch(`/rrhh/liquidaciones-admin/${id}/cancelar`).then(r => r.data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: LIQ_ADMIN_KEY }),
  });
}

export async function descargarLiquidacionAdminPDF(id: number): Promise<void> {
  const res  = await api.get(`/rrhh/liquidaciones-admin/${id}/exportar`, { responseType: 'blob' });
  const url  = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `sueldo-${id}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

// ═══════════════════════════════════════════════════════════════════════════
// PRÉSTAMOS A EMPLEADOS
// ═══════════════════════════════════════════════════════════════════════════

export function usePrestamosEmpleado(empleadoId: number | null) {
  return useQuery<PrestamoEmpleado[]>({
    queryKey: [...PRESTAMOS_KEY, empleadoId],
    queryFn:  () => api.get(`/rrhh/empleados/${empleadoId}/prestamos`).then(r => r.data),
    enabled:  empleadoId !== null,
  });
}

export interface PrestamoPayload {
  fecha:           string;
  detalle:         string;
  monto_total:     number;
  cantidad_cuotas: number;
  monto_cuota?:    number;
}

export function useCreatePrestamo(empleadoId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: PrestamoPayload) => api.post(`/rrhh/empleados/${empleadoId}/prestamos`, data).then(r => r.data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: [...PRESTAMOS_KEY, empleadoId] }),
  });
}

export function useDeletePrestamo(empleadoId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/rrhh/prestamos/${id}`).then(r => r.data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: [...PRESTAMOS_KEY, empleadoId] }),
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// BITÁCORA DE VIAJES (choferes)
// ═══════════════════════════════════════════════════════════════════════════

export interface BitacoraFiltros {
  empleado_id?:    number;
  mes?:            number;
  anio?:           number;
  tipo_recorrido?: TipoRecorrido;
}

export function useBitacoraViajes(filtros: BitacoraFiltros = {}) {
  return useQuery<BitacoraViaje[]>({
    queryKey: [...BITACORA_KEY, filtros],
    queryFn:  () => api.get('/rrhh/bitacora-viajes', { params: filtros }).then(r => r.data),
  });
}

export function useBitacoraViajesEmpleado(empleadoId: number | null, mes: number | null, anio: number | null) {
  return useQuery<BitacoraViaje[]>({
    queryKey: [...BITACORA_KEY, 'empleado', empleadoId, mes, anio],
    queryFn:  () => api.get(`/rrhh/empleados/${empleadoId}/bitacora-viajes`, { params: { mes, anio } }).then(r => r.data),
    enabled:  empleadoId !== null,
  });
}

export function useResumenBitacora(empleadoId: number | null, mes: number | null, anio: number | null) {
  return useQuery<ResumenBitacora>({
    queryKey: [...BITACORA_KEY, 'resumen', empleadoId, mes, anio],
    queryFn:  () => api.get(`/rrhh/empleados/${empleadoId}/bitacora-viajes/resumen`, { params: { mes, anio } }).then(r => r.data),
    enabled:  empleadoId !== null && mes !== null && anio !== null,
  });
}

export interface BitacoraPayload {
  empleado_id?:      number; // no se manda en updates
  fecha:             string;
  convocatoria?:      string | null;
  hora_inicio?:       string | null;
  hora_fin?:          string | null;
  ejido?:             string | null;
  recorrido?:         string | null;
  tipo_recorrido:     TipoRecorrido;
  cantidad_vueltas:   number;
  observaciones?:     string | null;
}

function invalidateBitacora(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: BITACORA_KEY });
}

export function useCreateBitacoraViaje() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: BitacoraPayload) => api.post('/rrhh/bitacora-viajes', data).then(r => r.data),
    onSuccess:  () => invalidateBitacora(qc),
  });
}

export function useUpdateBitacoraViaje() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Omit<BitacoraPayload, 'empleado_id'>> }) =>
      api.put(`/rrhh/bitacora-viajes/${id}`, data).then(r => r.data),
    onSuccess: () => invalidateBitacora(qc),
  });
}

export function useDeleteBitacoraViaje() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/rrhh/bitacora-viajes/${id}`).then(r => r.data),
    onSuccess:  () => invalidateBitacora(qc),
  });
}

export interface ResultadoImportarViajes {
  preview: boolean;
  empleado_id: number;
  empleado_nombre: string;
  creados: number;
  actualizados: number;
  omitidos: number;
  sin_recorrido: number;
  errores: { fila: number; motivo: string }[];
  resumen: { provincial: number; nacional: number; nacional_1000: number; total_vueltas: number; viatico_estimado: number };
}

export function useImportarBitacoraViajes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ file, empleadoId, mes, anio, dryRun }: { file: File; empleadoId: number; mes: number; anio: number; dryRun: boolean }) => {
      const formData = new FormData();
      formData.append('file', file);
      return api.post<ResultadoImportarViajes>(
        `/rrhh/bitacora-viajes/importar?empleado_id=${empleadoId}&mes=${mes}&anio=${anio}&dry_run=${dryRun}`,
        formData,
      ).then(r => r.data);
    },
    onSuccess: (_data, vars) => { if (!vars.dryRun) invalidateBitacora(qc); },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// IMPORTADOR DE HISTORIAL DE CONVOCATORIAS (Jornadas) — desde la hoja del
// Excel de sueldos con el nombre del empleado (ej. "LUIS").
// ═══════════════════════════════════════════════════════════════════════════

export interface ResultadoImportarHistorial {
  preview: boolean;
  empleado_id: number;
  empleado_nombre: string;
  hoja: string;
  creados?: number;
  actualizados?: number;
  total_filas?: number;
  omitidos: number;
  errores: { fila: number; motivo: string }[];
  filas?: { fila_excel: number; fecha: string; convocatoria: string | null; hora_convocatoria: string | null; hora_ingreso: string | null; hora_egreso: string | null; horas: number }[];
}

export function useImportarHistorialConvocatorias() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ file, empleadoId, mes, anio, dryRun }: { file: File; empleadoId: number; mes: number; anio: number; dryRun: boolean }) => {
      const formData = new FormData();
      formData.append('file', file);
      return api.post<ResultadoImportarHistorial>(
        `/rrhh/jornadas/importar-historial?empleado_id=${empleadoId}&mes=${mes}&anio=${anio}&dry_run=${dryRun}`,
        formData,
      ).then(r => r.data);
    },
    onSuccess: (_data, vars) => {
      if (!vars.dryRun) qc.invalidateQueries({ queryKey: ['rrhh', 'empleados', vars.empleadoId, 'jornadas'] });
    },
  });
}
