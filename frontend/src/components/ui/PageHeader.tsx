import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

// Encabezado de página común: título, subtítulo opcional y acciones a la
// derecha. En pantallas angostas las acciones bajan debajo del título en vez
// de apretarlo (el título nunca se parte por falta de lugar).
// - `back`: link/botón de volver, arriba del título (páginas de detalle).
// - `meta`: badges/estado junto al título.
export default function PageHeader({ title, subtitle, actions, back, meta, className }: {
  title:     ReactNode;
  subtitle?: ReactNode;
  actions?:  ReactNode;
  back?:     ReactNode;
  meta?:     ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-start gap-x-4 gap-y-3', className)}>
      <div className="min-w-0 flex-1 basis-60">
        {back && <div className="mb-1.5">{back}</div>}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="page-title">{title}</h1>
          {meta}
        </div>
        {subtitle && <div className="mt-1 max-w-3xl text-sm text-muted-foreground">{subtitle}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
