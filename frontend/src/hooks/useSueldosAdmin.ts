import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type {
  AcuerdoSueldo, LiquidacionAdmin, EmpresaMini, CuentaMini, EstadoLiquidacionAdmin,
} from '@/types';

const ACUERDOS_KEY      = ['rrhh', 'acuerdos'];
const LIQ_ADMIN_KEY      = ['rrhh', 'liquidaciones-admin'];

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
    mutationFn: ({ id, cuentas_pago }: { id: number; cuentas_pago: { empresa_id: number; cuenta_id: number }[] }) =>
      api.patch(`/rrhh/liquidaciones-admin/${id}/aprobar`, { cuentas_pago }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: LIQ_ADMIN_KEY }),
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
