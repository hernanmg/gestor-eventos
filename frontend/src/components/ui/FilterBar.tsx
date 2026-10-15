import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

// Barra de filtros común: filtros en fila a la izquierda (selects, búsqueda,
// fechas) y acciones a la derecha. Envuelve los controles que ya tiene cada
// página sin tocar su estado.
// - Los <select>/<input> hijos directos pierden el w-full que traían (en una
//   fila no tiene sentido) y en mobile crecen para ocupar el renglón.
// - `actions` se alinea a la derecha y baja de renglón si no entra.
export default function FilterBar({ children, actions, className }: {
  children?: ReactNode;
  actions?:  ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2',
        '[&>select]:w-auto [&>input]:w-auto [&>select]:min-w-[140px] [&>input]:min-w-[180px]',
        'max-md:[&>select]:flex-1 max-md:[&>input]:flex-1 max-md:[&>input]:basis-full',
        className,
      )}
    >
      {children}
      {actions && <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
