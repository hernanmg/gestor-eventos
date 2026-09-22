import { useCallback, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

export const cortesiasKey = (eventoId: number) => ['eventos', eventoId, 'cortesias'];

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface CortesiaItem {
  id:                 number;
  cortesia_id:        number;
  tipo_ticket:        string; // "Ruta Larga - Kit Estándar"
  cantidad:           number;
  bib_number:         string | null;
  nombre_inscripto:   string | null;
  apellido_inscripto: string | null;
  dni:                string | null;
  email:              string | null;
  created_at:         string;
}

export interface CortesiaEvento {
  id:              number;
  evento_id:       number;
  cliente_nombre:  string;
  contacto_nombre: string | null;
  autorizado_por:  string | null;
  observacion:     string | null;
  visado:          boolean;
  entregado:       boolean;
  created_at:      string;
  updated_at:      string;
  items:           CortesiaItem[];
  total:           number;
}

export interface CortesiasTotales {
  por_tipo:      { tipo_ticket: string; cantidad: number }[];
  total:         number;
  asignaciones:  number;
  visadas:       number;
  entregadas:    number;
  con_inscripto: number;
}

export interface CortesiasResponse {
  cortesias: CortesiaEvento[];
  totales:   CortesiasTotales;
}

/** Ítem al crear/editar. Con `id` se actualiza el existente; sin `id` se crea. */
export interface CortesiaItemPayload {
  id?:                 number;
  tipo_ticket:         string;
  cantidad:            number;
  bib_number?:         string | null;
  nombre_inscripto?:   string | null;
  apellido_inscripto?: string | null;
  dni?:                string | null;
  email?:              string | null;
}

export interface CortesiaPayload {
  cliente_nombre:  string;
  contacto_nombre?: string | null;
  autorizado_por?:  string | null;
  observacion?:     string | null;
  items:            CortesiaItemPayload[];
}

export type EstadoVinculo = 'VINCULADO' | 'SIN_COINCIDENCIA' | 'TIPO_DISTINTO' | 'AMBIGUO' | 'CANTIDAD_MAYOR_A_1' | 'YA_ASIGNADO';

export interface CortesiaImportFila {
  fila_excel:   number;
  item:         number | null;
  cliente:      string;
  contacto:     string | null;
  observacion:  string | null;
  autoriza:     string | null;
  items:        { tipo_ticket: string; cantidad: number }[];
  total:        number;
  visado:       boolean;
  entregado:    boolean;
  accion:       'CREAR' | 'ACTUALIZAR';
  vinculo:      EstadoVinculo;
  inscripto?:   { bib: string | null; apellido: string | null; nombre: string | null; dni: string | null; email: string | null };
  advertencias: string[];
}

export interface CortesiaImportResultado {
  preview:      boolean;
  hoja:         string;
  evento_excel: { evento: string | null; lugar: string | null; fecha: string | null };
  creadas:      number;
  actualizadas: number;
  tickets:      number;
  por_tipo:     { tipo_ticket: string; cantidad: number }[];
  omitidas:     { fila_excel: number; motivo: string }[];
  inscriptos: {
    hoja:          string | null;
    leidos:        number;
    vinculados:    number;
    no_vinculados: Partial<Record<EstadoVinculo, number>>;
  };
  filas: CortesiaImportFila[];
}

// ── Queries / mutations ───────────────────────────────────────────────────────

export function useCortesias(eventoId: number) {
  return useQuery<CortesiasResponse>({
    queryKey: cortesiasKey(eventoId),
    queryFn:  () => api.get(`/eventos/${eventoId}/cortesias`).then(r => r.data),
    enabled:  !!eventoId,
  });
}

export function useCreateCortesia(eventoId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CortesiaPayload) => api.post<CortesiaEvento>(`/eventos/${eventoId}/cortesias`, data).then(r => r.data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: cortesiasKey(eventoId) }),
  });
}

export function useUpdateCortesia(eventoId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: CortesiaPayload }) =>
      api.put<CortesiaEvento>(`/eventos/cortesias/${id}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: cortesiasKey(eventoId) }),
  });
}

/** Marca (o desmarca con valor=false) una cortesía como visada o entregada. */
export function useMarcarCortesia(eventoId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, campo, valor }: { id: number; campo: 'visar' | 'entregar'; valor: boolean }) =>
      api.patch<CortesiaEvento>(`/eventos/cortesias/${id}/${campo}`, { valor }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: cortesiasKey(eventoId) }),
  });
}

export function useDeleteCortesia(eventoId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/eventos/cortesias/${id}`).then(r => r.data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: cortesiasKey(eventoId) }),
  });
}

export function useImportarCortesias(eventoId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ file, preview }: { file: File; preview: boolean }) => {
      const fd = new FormData();
      fd.append('archivo', file);
      return api.post<CortesiaImportResultado>(
        `/eventos/${eventoId}/cortesias/importar?preview=${preview}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } },
      ).then(r => r.data);
    },
    onSuccess: (data) => { if (!data.preview) qc.invalidateQueries({ queryKey: cortesiasKey(eventoId) }); },
  });
}

export function useExportarCortesias() {
  const [isExporting, setIsExporting] = useState(false);

  const exportar = useCallback(async (eventoId: number) => {
    setIsExporting(true);
    try {
      const response = await api.get(`/eventos/${eventoId}/cortesias/exportar`, { responseType: 'blob' });
      const cd       = (response.headers['content-disposition'] as string | undefined) ?? '';
      const filename = decodeURIComponent(cd.match(/filename="([^"]+)"/)?.[1] ?? `cortesias-evento-${eventoId}.xlsx`);
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
