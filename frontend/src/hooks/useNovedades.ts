import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { EstadoNovedad, GravedadNovedad, ListaNovedades, Novedad, OpcionesNovedad, TipoNovedad } from '@/types';

const KEY = ['novedades'];

export interface FiltrosNovedades {
  estado?:      'ABIERTAS' | 'RESUELTAS' | 'TODAS';
  tipo_id?:     number;
  gravedad?:    GravedadNovedad;
  evento_id?:   number;
  camion_id?:   number;
  empleado_id?: number;
  q?:           string;
  desde?:       string;
  hasta?:       string;
}

export function useNovedades(filtros: FiltrosNovedades) {
  const params = Object.fromEntries(Object.entries(filtros).filter(([, v]) => v !== undefined && v !== ''));
  return useQuery<ListaNovedades>({
    queryKey: [...KEY, 'lista', params],
    queryFn:  () => api.get('/novedades', { params }).then(r => r.data),
  });
}

export function useNovedad(id: number | null) {
  return useQuery<Novedad>({
    queryKey: [...KEY, 'detalle', id],
    queryFn:  () => api.get(`/novedades/${id}`).then(r => r.data),
    enabled:  !!id,
  });
}

export function useOpcionesNovedad(enabled = true) {
  return useQuery<OpcionesNovedad>({
    queryKey:  [...KEY, 'opciones'],
    queryFn:   () => api.get('/novedades/opciones').then(r => r.data),
    staleTime: 5 * 60 * 1000,
    enabled,
  });
}

export function useTiposNovedad() {
  return useQuery<TipoNovedad[]>({
    queryKey: [...KEY, 'tipos'],
    queryFn:  () => api.get('/novedades/tipos').then(r => r.data),
  });
}

function useInvalidar() {
  const qc = useQueryClient();
  return (n?: Novedad) => {
    if (n?.id) qc.setQueryData([...KEY, 'detalle', n.id], n);
    qc.invalidateQueries({ queryKey: [...KEY, 'lista'] });
    qc.invalidateQueries({ queryKey: ['notificaciones'] });
    qc.invalidateQueries({ queryKey: ['calendario'] });
  };
}

export interface NovedadPayload {
  tipo_id:        number;
  fecha:          string;
  hora?:          string | null;
  titulo:         string;
  descripcion?:   string | null;
  lugar?:         string | null;
  gravedad:       GravedadNovedad;
  estado?:        EstadoNovedad;
  reportado_por?: string | null;
  responsable_id?: number | null;
  evento_id?:     number | null;
  camion_id?:     number | null;
  empleado_id?:   number | null;
  proveedor_id?:  number | null;
  resolucion?:    string | null;
}

export function useCreateNovedad() {
  const inv = useInvalidar();
  return useMutation({
    mutationFn: (p: NovedadPayload) => api.post<Novedad>('/novedades', p).then(r => r.data),
    onSuccess:  n => inv(n),
  });
}

export function useUpdateNovedad() {
  const inv = useInvalidar();
  return useMutation({
    mutationFn: ({ id, ...p }: Partial<NovedadPayload> & { id: number }) => api.patch<Novedad>(`/novedades/${id}`, p).then(r => r.data),
    onSuccess:  n => inv(n),
  });
}

export function useDeleteNovedad() {
  const inv = useInvalidar();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/novedades/${id}`),
    onSuccess:  () => inv(),
  });
}

export function useSubirAdjuntosNovedad() {
  const inv = useInvalidar();
  return useMutation({
    mutationFn: ({ id, archivos }: { id: number; archivos: File[] }) => {
      const f = new FormData();
      archivos.forEach(a => f.append('archivos', a));
      return api.post<Novedad>(`/novedades/${id}/adjuntos`, f).then(r => r.data);
    },
    onSuccess: n => inv(n),
  });
}

export function useBorrarAdjuntoNovedad() {
  const inv = useInvalidar();
  return useMutation({
    mutationFn: (adjuntoId: number) => api.delete<Novedad>(`/novedades/adjuntos/${adjuntoId}`).then(r => r.data),
    onSuccess:  n => inv(n),
  });
}

export function useGuardarTipoNovedad() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...p }: Partial<TipoNovedad> & { id?: number }) =>
      (id ? api.patch<TipoNovedad>(`/novedades/tipos/${id}`, p) : api.post<TipoNovedad>('/novedades/tipos', p)).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...KEY, 'tipos'] });
      qc.invalidateQueries({ queryKey: [...KEY, 'opciones'] });
      qc.invalidateQueries({ queryKey: [...KEY, 'lista'] });
    },
  });
}

// URL de una foto/archivo (mismo origen que la API: la cookie viaja sola)
export function urlAdjunto(adjuntoId: number, descargar = false): string {
  const base = (api.defaults.baseURL ?? '/api').replace(/\/$/, '');
  return `${base}/novedades/adjuntos/${adjuntoId}${descargar ? '?descargar=1' : ''}`;
}

// Achica las fotos del celular antes de subirlas (lado mayor 1600 px, JPEG):
// una foto de 4–8 MB queda en ~300 KB. PDF y otros formatos pasan igual.
export async function prepararArchivo(f: File): Promise<File> {
  if (!f.type.startsWith('image/') || f.type === 'image/gif' || f.size < 400 * 1024) return f;
  try {
    const bmp = await createImageBitmap(f);
    const escala = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * escala);
    canvas.height = Math.round(bmp.height * escala);
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/jpeg', 0.82));
    if (!blob || blob.size >= f.size) return f;
    return new File([blob], f.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return f;
  }
}
