import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

// Producción del evento (planilla de producción de Dani): cronograma de
// montaje, espacios, puntos de internet, branding y compras.

export type TipoProduccion = 'cronograma' | 'espacios' | 'espacio-items' | 'internet' | 'branding' | 'compras';

export interface CronogramaItem { id: number; fecha: string; hora: string | null; actividad: string; proveedor: string | null; responsable: string | null; observaciones: string | null; orden: number }
export interface EspacioItem { id: number; espacio_id: number; elemento: string; estado: string | null; responsable: string | null; observaciones: string | null; orden: number }
export interface Espacio { id: number; numero: number | null; nombre: string; actividad: string | null; observaciones: string | null; orden: number; items: EspacioItem[] }
export interface PuntoInternet { id: number; numero: number | null; zona: string; uso: string | null; tipo_conexion: string | null; observaciones: string | null; orden: number }
export interface BrandingItem { id: number; tipo: string; marca: string | null; cantidad: number | null; ubicacion: string | null; estado: string | null; observaciones: string | null; orden: number }
export interface CompraItem {
  id: number; numero: number | null; fecha: string | null; pedido: string; cantidad: number | null; valor: number | null;
  proveedor: string | null; forma_pago: string | null; solicita: string | null; autoriza: string | null; observaciones: string | null; cancelada: boolean; orden: number;
}

export interface ProduccionEvento {
  cronograma: CronogramaItem[];
  espacios:   Espacio[];
  internet:   PuntoInternet[];
  branding:   BrandingItem[];
  compras:    CompraItem[];
}

interface ConteoImport { hoja: string; total: number; nuevos: number; actualizados: number }
export interface ProduccionImportResultado {
  preview: boolean;
  hojas_omitidas: string[];
  cronograma: ConteoImport | null;
  espacios:   (ConteoImport & { items: Omit<ConteoImport, 'hoja'> }) | null;
  internet:   ConteoImport | null;
  branding:   ConteoImport | null;
  compras:    (ConteoImport & { total_planilla: number | null; total_importado: number; total_sin_canceladas: number; pendientes_de_valor: number }) | null;
}

export const produccionKey = (eventoId: number) => ['eventos', eventoId, 'produccion'];

export function useProduccion(eventoId: number) {
  return useQuery<ProduccionEvento>({
    queryKey: produccionKey(eventoId),
    queryFn:  () => api.get(`/eventos/${eventoId}/produccion`).then(r => r.data),
    enabled:  !!eventoId,
  });
}

export function useProduccionMutations(eventoId: number) {
  const qc = useQueryClient();
  const invalidar = () => qc.invalidateQueries({ queryKey: produccionKey(eventoId) });
  const crear = useMutation({
    mutationFn: ({ tipo, data }: { tipo: TipoProduccion; data: Record<string, unknown> }) =>
      api.post(`/eventos/${eventoId}/produccion/${tipo}`, data).then(r => r.data),
    onSuccess: invalidar,
  });
  const actualizar = useMutation({
    mutationFn: ({ tipo, id, data }: { tipo: TipoProduccion; id: number; data: Record<string, unknown> }) =>
      api.put(`/produccion/${tipo}/${id}`, data).then(r => r.data),
    onSuccess: invalidar,
  });
  const eliminar = useMutation({
    mutationFn: ({ tipo, id }: { tipo: TipoProduccion; id: number }) => api.delete(`/produccion/${tipo}/${id}`).then(r => r.data),
    onSuccess: invalidar,
  });
  return { crear, actualizar, eliminar };
}

export function useImportarProduccion(eventoId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ file, preview }: { file: File; preview: boolean }) => {
      const fd = new FormData();
      fd.append('archivo', file);
      return api.post<ProduccionImportResultado>(`/eventos/${eventoId}/produccion/importar?preview=${preview}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }).then(r => r.data);
    },
    onSuccess: data => { if (!data.preview) qc.invalidateQueries({ queryKey: produccionKey(eventoId) }); },
  });
}
