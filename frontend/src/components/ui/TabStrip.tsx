import { useEffect, useRef, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

// Tira de pestañas común. Scrollea de costado cuando no entra (mobile) y
// lleva la pestaña activa a la vista. El activo es neutro (texto + subrayado
// en el color de texto), no azul: funciona con cualquier color de empresa.
// - variant "underline": pestañas de página.
// - variant "pill": sub-pestañas dentro de una pestaña.
export interface TabItem<K extends string> {
  key:    K;
  label:  ReactNode;
  icon?:  LucideIcon;
  badge?: ReactNode;
}

// Contador junto al nombre de una pestaña (alertas, pendientes). Sin valor no
// se muestra.
export function TabCount({ count, tone = 'red' }: { count: number | undefined; tone?: 'red' | 'neutral' }) {
  if (!count) return null;
  return (
    <span className={cn(
      'inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold tabular-nums',
      tone === 'red' ? 'bg-red-500 text-white' : 'bg-secondary text-muted-foreground',
    )}>
      {count > 99 ? '99+' : count}
    </span>
  );
}

export default function TabStrip<K extends string>({ items, value, onChange, variant = 'underline', className }: {
  items:     TabItem<K>[];
  value:     K;
  onChange:  (key: K) => void;
  variant?:  'underline' | 'pill';
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Sólo scroll horizontal del contenedor (scrollIntoView movería la página).
  useEffect(() => {
    const el = ref.current;
    const active = el?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!el || !active) return;
    const left = active.offsetLeft - el.offsetLeft;
    if (left < el.scrollLeft || left + active.offsetWidth > el.scrollLeft + el.clientWidth) {
      el.scrollTo({ left: Math.max(0, left - 16), behavior: 'smooth' });
    }
  }, [value]);

  return (
    <div
      ref={ref}
      role="tablist"
      className={cn(
        'no-print flex overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        variant === 'underline' ? 'gap-1 border-b border-border' : 'gap-1.5',
        className,
      )}
    >
      {items.map(({ key, label, icon: Icon, badge }) => {
        const active = key === value;
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(key)}
            className={cn(
              'relative flex shrink-0 items-center gap-1.5 whitespace-nowrap text-sm transition-colors',
              variant === 'underline'
                ? cn(
                    'px-3 py-2.5 -mb-px border-b-2',
                    active ? 'border-foreground font-semibold text-foreground' : 'border-transparent font-medium text-muted-foreground hover:text-foreground',
                  )
                : cn(
                    'h-8 rounded-full px-3 font-medium',
                    active ? 'bg-foreground text-background' : 'bg-secondary text-muted-foreground hover:text-foreground',
                  ),
            )}
          >
            {Icon && <Icon size={15} className="shrink-0" />}
            {label}
            {badge}
          </button>
        );
      })}
    </div>
  );
}
