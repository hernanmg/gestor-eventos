import { useCallback, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type {
  HistorialUniformesResponse, ResumenUniformesResponse, ImportarUniformesResultado, ModoImportUniformes, PrendaUniforme,
  TotalesUniforme, EstadoEmpleado,
} from '@/types';

const KEY = ['uniformes'];

export const PRENDAS_UNIFORME: PrendaUniforme[] = [
  'borcegos', 'remeras', 'camperon', 'chombas', 'campera', 'mochila',
  'buzo', 'pantalon', 'bermuda', 'gorra', 'prot_lumbar', 'guantes',
];

export const PRENDA_LABEL: Record<PrendaUniforme, string> = {
  borcegos: 'Borcegos', remeras: 'Remeras', camperon: 'Camperón', chombas: 'Chombas', campera: 'Campera',
  mochila: 'Mochila', buzo: 'Buzo', pantalon: 'Pantalón', bermuda: 'Bermuda', gorra: 'Gorra',
  prot_lumbar: 'Protector', guantes: 'Guantes',
};

// Historial por legajo (empleadoId) o, para personas de la planilla que no
// están en RRHH, por el nombre tal cual quedó guardado.
export interface RefEmpleadoUniformes {
  empleadoId?:     number | null;
  empleadoNombre?: string | null;
  empresaId?:      number | null;
}

export function useHistorialUniformes(ref: RefEmpleadoUniformes) {
  const { empleadoId = null, empleadoNombre = null, empresaId = null } = ref;
  return useQuery<HistorialUniformesResponse>({
    queryKey: [...KEY, 'historial', empleadoId, empleadoNombre, empresaId],
    queryFn:  () => (empleadoId
      ? api.get(`/uniformes/historial/${empleadoId}`)
      : api.get('/uniformes/historial', { params: { empleado_nombre: empleadoNombre, ...(empresaId ? { empresa_id: empresaId } : {}) } })
    ).then(r => r.data),
    enabled:  !!empleadoId || !!empleadoNombre,
  });
}

export interface EmpleadoUniformes { id: number; nombre: string; apellido: string; estado: EstadoEmpleado }

// Lorena (OPERADOR) no puede usar /rrhh/empleados — endpoint propio del módulo.
export function useEmpleadosUniformes() {
  return useQuery<EmpleadoUniformes[]>({
    queryKey: [...KEY, 'empleados'],
    queryFn:  () => api.get('/uniformes/empleados').then(r => r.data),
  });
}

export type EntregaUniformePayload = Partial<TotalesUniforme> & {
  empleado_id?:     number | null;
  empleado_nombre?: string | null;
  fecha_entrega:    string; // YYYY-MM-DD
  otros?:           string | null;
};

export function useCrearEntregaUniforme() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: EntregaUniformePayload) => api.post('/uniformes/entregas', data).then(r => r.data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useEditarEntregaUniforme() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<EntregaUniformePayload> }) => api.put(`/uniformes/entregas/${id}`, data).then(r => r.data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useEliminarEntregaUniforme() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/uniformes/entregas/${id}`).then(r => r.data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useResumenUniformes(anio: number, empresaId?: number | null) {
  return useQuery<ResumenUniformesResponse>({
    queryKey: [...KEY, 'resumen', anio, empresaId ?? null],
    queryFn:  () => api.get('/uniformes/resumen', { params: { anio, ...(empresaId ? { empresa_id: empresaId } : {}) } }).then(r => r.data),
  });
}

// Excel con la tabla general del año ("Resumen AAAA") + cada entrega ("Detalle AAAA").
export function useExportarUniformes() {
  const [isExporting, setIsExporting] = useState(false);

  const exportar = useCallback(async (anio: number, empresaId?: number | null) => {
    setIsExporting(true);
    try {
      const response = await api.get('/uniformes/exportar', {
        params: { anio, ...(empresaId ? { empresa_id: empresaId } : {}) },
        responseType: 'blob',
      });
      const cd       = (response.headers['content-disposition'] as string | undefined) ?? '';
      const filename = decodeURIComponent(cd.match(/filename="([^"]+)"/)?.[1] ?? `Uniformes_${anio}.xlsx`);
      const url      = URL.createObjectURL(new Blob([response.data as BlobPart]));
      const a        = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  }, []);

  return { exportar, isExporting };
}

// dryRun=true → preview (no escribe nada, ni da de baja empleados).
export function useImportarUniformes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ file, modo, empresaId, dryRun }: { file: File; modo: ModoImportUniformes; empresaId?: number | null; dryRun: boolean }) => {
      const fd = new FormData();
      fd.append('archivo', file);
      return api.post<ImportarUniformesResultado>('/uniformes/importar', fd, {
        params: { modo, dry_run: String(dryRun), ...(empresaId ? { empresa_id: empresaId } : {}) },
      }).then(r => r.data);
    },
    onSuccess: (_data, vars) => {
      if (vars.dryRun) return;
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ['rrhh'] }); // estado de empleados dados de baja
    },
  });
}
