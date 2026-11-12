import { Home } from 'lucide-react';
import { useLogoBlobUrl } from '@/hooks/useEmpresas';
import { cn } from '@/lib/utils';
import type { MeResponse } from '@/types';
import type { BadgeTone } from './navConfig';

// Piezas compartidas por Sidebar (desktop), MobileTabBar y NavSheet.

export const ROL_LABEL: Record<MeResponse['rol'], string> = {
  ADMIN:     'Administrador',
  OPERADOR:  'Operador',
  VIEWER:    'Visualizador',
  JORNALERO: 'Jornalero',
  PANOLERO:  'Pañolero',
};

// Logo si existe, si no un punto con color_primario.
export function EmpresaBrand({ empresaId, hasLogo, nombre, colorPrimario, size = 'header' }: {
  empresaId:     number | undefined;
  hasLogo:       boolean;
  nombre:        string;
  colorPrimario: string | null | undefined;
  size?: 'header' | 'sm';
}) {
  const logoUrl = useLogoBlobUrl(empresaId ?? null, hasLogo);
  if (logoUrl) {
    return <img src={logoUrl} alt={nombre} className={cn('object-contain shrink-0', size === 'header' ? 'h-6 w-6' : 'h-4 w-4')} />;
  }
  return (
    <span
      className="h-2 w-2 shrink-0 rounded-full"
      style={{ backgroundColor: colorPrimario ?? '#94a3b8' }}
    />
  );
}

const TONE_BG: Record<BadgeTone, string> = {
  red:    'bg-red-500',
  orange: 'bg-orange-500',
  amber:  'bg-amber-500',
};

// Contador de alertas de un ítem/grupo. `dot` = sólo el punto (sidebar colapsado).
export function NavBadge({ count, tone = 'red', dot = false, className }: {
  count: number | undefined; tone?: BadgeTone; dot?: boolean; className?: string;
}) {
  if (!count) return null;
  if (dot) return <span className={cn('absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full', TONE_BG[tone], className)} />;
  return (
    <span className={cn('flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-[10px] font-bold text-white tabular-nums', TONE_BG[tone], className)}>
      {count > 99 ? '99+' : count}
    </span>
  );
}

// Ícono de "casa" junto al ítem que coincide con el home_route del usuario.
export function HomeMark({ show }: { show: boolean | undefined }) {
  if (!show) return null;
  return <Home size={11} className="shrink-0 text-muted-foreground/40" aria-label="Tu pantalla de inicio" />;
}

// El tono del grupo es el más urgente de sus ítems con alerta.
export function groupTone(items: { badge?: number; tone?: BadgeTone }[]): BadgeTone {
  const conAlerta = items.filter(i => i.badge);
  if (conAlerta.some(i => i.tone === 'red')) return 'red';
  if (conAlerta.some(i => i.tone === 'orange')) return 'orange';
  return 'amber';
}
