import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText } from 'lucide-react';
import api from '@/lib/api';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { EstadoNovedad, GravedadNovedad } from '@/types';

// Piezas chicas compartidas por la pantalla de Novedades y la pestaña del evento.

export const GRAVEDAD: Record<GravedadNovedad, { label: string; color: string; suave: string; texto: string; ayuda: string }> = {
  CRITICA: { label: 'Crítica', color: '#B91C1C', suave: 'bg-red-50 dark:bg-red-950/40',       texto: 'text-red-700 dark:text-red-300',       ayuda: 'Frena el trabajo o pone en riesgo a alguien. Atender ya.' },
  ALTA:    { label: 'Alta',    color: '#EA580C', suave: 'bg-orange-50 dark:bg-orange-950/40', texto: 'text-orange-700 dark:text-orange-300', ayuda: 'Hay que resolverlo hoy o mañana.' },
  MEDIA:   { label: 'Media',   color: '#CA8A04', suave: 'bg-yellow-50 dark:bg-yellow-950/40', texto: 'text-yellow-700 dark:text-yellow-300', ayuda: 'Hay que resolverlo, pero puede esperar unos días.' },
  BAJA:    { label: 'Baja',    color: '#6B7280', suave: 'bg-gray-50 dark:bg-gray-900/40',     texto: 'text-gray-600 dark:text-gray-300',     ayuda: 'Para dejar asentado.' },
};
export const GRAVEDADES_ORDEN: GravedadNovedad[] = ['CRITICA', 'ALTA', 'MEDIA', 'BAJA'];

export const ESTADO: Record<EstadoNovedad, { label: string; variant: BadgeProps['variant'] }> = {
  ABIERTA:  { label: 'Abierta',   variant: 'destructive' },
  EN_CURSO: { label: 'En curso',  variant: 'warning' },
  RESUELTA: { label: 'Resuelta',  variant: 'success' },
};

export function GravedadBadge({ gravedad, className }: { gravedad: GravedadNovedad; className?: string }) {
  const g = GRAVEDAD[gravedad];
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold', g.suave, g.texto, className)}>
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: g.color }} />
      {g.label}
    </span>
  );
}

export function TipoChip({ nombre, color }: { nombre: string; color: string | null }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-xs font-medium text-foreground">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color ?? '#6B7280' }} />
      {nombre}
    </span>
  );
}

export function EstadoBadge({ estado }: { estado: EstadoNovedad }) {
  return <Badge variant={ESTADO[estado].variant}>{ESTADO[estado].label}</Badge>;
}

// Las fotos se piden con axios (cookie de sesión) y se muestran como blob: así
// funcionan aunque el navegador bloquee cookies de terceros en <img src>.
export function useBlobAdjunto(id: number, enabled = true) {
  const q = useQuery({
    queryKey:  ['novedades', 'adjunto', id],
    queryFn:   () => api.get(`/novedades/adjuntos/${id}`, { responseType: 'blob' }).then(r => r.data as Blob),
    staleTime: Infinity,
    enabled,
  });
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!q.data) return;
    const u = URL.createObjectURL(q.data);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [q.data]);
  return { url, blob: q.data ?? null, isLoading: q.isLoading };
}

export function Miniatura({ id, mime, nombre, className, onClick }: { id: number; mime: string; nombre: string; className?: string; onClick?: () => void }) {
  const esImagen = mime.startsWith('image/');
  const { url } = useBlobAdjunto(id, esImagen);
  const contenido = esImagen
    ? (url ? <img src={url} alt={nombre} className="h-full w-full object-cover" /> : <span className="block h-full w-full animate-pulse" />)
    : <span className="flex h-full w-full flex-col items-center justify-center gap-1 p-1 text-[10px] text-muted-foreground"><FileText size={18} />PDF</span>;
  const cls = cn('relative block overflow-hidden rounded-lg border border-border bg-[var(--bg-secondary)] shrink-0', className);
  // Sin onClick va dentro de otro botón (la tarjeta): un span, no un button
  if (!onClick) return <span title={nombre} className={cls}>{contenido}</span>;
  return <button type="button" onClick={onClick} title={nombre} className={cls}>{contenido}</button>;
}

export const hoyISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const horaAhora = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
