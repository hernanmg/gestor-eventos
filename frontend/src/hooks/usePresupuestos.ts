import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type {
  MaterialRental, ImportarMaterialesResultado, Presupuesto, PresupuestoResumen,
  EstadoPresupuesto, PorcentajeAlquiler, OrigenMaterialRental,
} from '@/types';

// Costo Real / Presupuestador (DOS57) — catálogo de materiales de rental y presupuestos

const KEY_MAT  = ['materiales-rental'] as const;
const KEY_PRES = ['presupuestos'] as const;

export interface MaterialesFiltros {
  origen?: OrigenMaterialRental;
  buscar?: string;
  activo?: boolean;
}

// El catálogo completo son ~300 ítems: se trae entero y se filtra en pantalla
export function useMaterialesRental(filtros: MaterialesFiltros = {}) {
  return useQuery({
    queryKey: [...KEY_MAT, filtros],
    queryFn:  () => api.get<{ items: MaterialRental[]; total: number }>('/materiales-rental', { params: { limit: 1000, ...filtros } }).then(r => r.data.items),
  });
}

export function useImportarMaterialesRental() {
  const qc = useQueryClient();
  return useMutation({
    // preview: no escribe (sirve para leer el TC de la planilla).
    // tipoCambio: pesificar los importados con este TC en vez del de la planilla.
    mutationFn: ({ file, preview, tipoCambio }: { file: File; preview: boolean; tipoCambio?: number }) => {
      const fd = new FormData();
      fd.append('file', file);
      if (tipoCambio) fd.append('tipo_cambio', String(tipoCambio));
      return api.post<ImportarMaterialesResultado>(`/materiales-rental/importar?preview=${preview}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data);
    },
    onSuccess: (r) => { if (!r.preview) qc.invalidateQueries({ queryKey: KEY_MAT }); },
  });
}

export function useUpdateMaterialRental() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Pick<MaterialRental, 'costo_unitario_ars' | 'costo_unitario_usd' | 'tipo_cambio' | 'activo'>> }) =>
      api.patch<MaterialRental>(`/materiales-rental/${id}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY_MAT }),
  });
}

export function usePresupuestos(filtros: { evento_id?: number; estado?: EstadoPresupuesto } = {}) {
  return useQuery({
    queryKey: [...KEY_PRES, 'lista', filtros],
    queryFn:  () => api.get<PresupuestoResumen[]>('/presupuestos', { params: filtros }).then(r => r.data),
  });
}

export function usePresupuesto(id: number | null) {
  return useQuery({
    queryKey: [...KEY_PRES, id],
    queryFn:  () => api.get<Presupuesto>(`/presupuestos/${id}`).then(r => r.data),
    enabled:  id !== null && id > 0,
  });
}

export interface PresupuestoPayload {
  evento_id:           number | null;
  nombre:              string | null;
  porcentaje_alquiler: PorcentajeAlquiler;
  tipo_cambio_usd:     number;
  notas:               string | null;
  lineas:              { material_id: number; cantidad: number; valor_rental_full: number | null }[];
}

function usePresupuestoMutation<V>(fn: (v: V) => Promise<Presupuesto>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess:  (p) => {
      qc.invalidateQueries({ queryKey: [...KEY_PRES, 'lista'] });
      qc.setQueryData([...KEY_PRES, p.id], p);
    },
  });
}

export const useGuardarPresupuesto = () => usePresupuestoMutation(({ id, data }: { id?: number; data: PresupuestoPayload }) =>
  (id ? api.put<Presupuesto>(`/presupuestos/${id}`, data) : api.post<Presupuesto>('/presupuestos', data)).then(r => r.data));

export const useCambiarEstadoPresupuesto = () => usePresupuestoMutation(({ id, estado }: { id: number; estado: EstadoPresupuesto }) =>
  api.patch<Presupuesto>(`/presupuestos/${id}/estado`, { estado }).then(r => r.data));

export const useCambiarTipoCambioPresupuesto = () => usePresupuestoMutation(({ id, tipo_cambio_usd }: { id: number; tipo_cambio_usd: number }) =>
  api.patch<Presupuesto>(`/presupuestos/${id}/tipo-cambio`, { tipo_cambio_usd }).then(r => r.data));

export const useNuevaVersionPresupuesto = () => usePresupuestoMutation((id: number) =>
  api.post<Presupuesto>(`/presupuestos/${id}/nueva-version`).then(r => r.data));

// ── Cálculo (espejo de calcularLinea en backend/src/lib/materialesRentalImporter.ts) ──

export const PORCENTAJES_ALQUILER: PorcentajeAlquiler[] = ['2', '4', '6', '8', '10', 'FULL'];

const round2 = (n: number) => Math.round(n * 100) / 100;

// IMP siempre 4%; NAC el del presupuesto (FULL = 100%)
export function porcentajeLinea(origen: OrigenMaterialRental, p: PorcentajeAlquiler): number {
  if (origen === 'IMP') return 4;
  return p === 'FULL' ? 100 : Number(p);
}

// IMP: USD × TC del presupuesto; NAC: costo en ARS. Sin precio → null.
export function costoUnitarioLinea(m: Pick<MaterialRental, 'origen' | 'costo_unitario_ars' | 'costo_unitario_usd'>, tc: number): number | null {
  if (m.origen === 'IMP' && m.costo_unitario_usd !== null) return round2(m.costo_unitario_usd * tc);
  return m.costo_unitario_ars;
}

export function calcularLinea(m: Pick<MaterialRental, 'origen' | 'costo_unitario_ars' | 'costo_unitario_usd'>, cantidad: number, p: PorcentajeAlquiler, tc: number) {
  const unitario = costoUnitarioLinea(m, tc);
  const pct = porcentajeLinea(m.origen, p);
  const total = round2(cantidad * (unitario ?? 0));
  return { unitario, pct, total, rental: round2(total * pct / 100) };
}

// ¿El ítem tiene ese % habilitado en la planilla? (IMP: sólo 4%, que es el único que se le aplica)
export function porcentajeHabilitado(m: Pick<MaterialRental, 'origen' | 'porc_2' | 'porc_4' | 'porc_6' | 'porc_8' | 'porc_10' | 'porc_full'>, p: PorcentajeAlquiler): boolean {
  if (m.origen === 'IMP') return true;
  return { '2': m.porc_2, '4': m.porc_4, '6': m.porc_6, '8': m.porc_8, '10': m.porc_10, FULL: m.porc_full }[p];
}
