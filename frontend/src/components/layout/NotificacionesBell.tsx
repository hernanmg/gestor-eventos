import { useState } from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { Bell } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useNotificaciones, type NotificacionItem, type UrgenciaNotificacion } from '@/hooks/useNotificaciones';
import { formatDate } from '@/lib/formatters';
import { cn } from '@/lib/utils';

const URGENCIA_DOT: Record<UrgenciaNotificacion, string> = {
  critical: 'bg-red-500',
  warning:  'bg-yellow-500',
  info:     'bg-blue-500',
};

const URGENCIA_TEXT: Record<UrgenciaNotificacion, string> = {
  critical: 'text-red-700',
  warning:  'text-yellow-800',
  info:     'text-blue-700',
};

function NotificacionRow({ item, onNavigate }: { item: NotificacionItem; onNavigate: () => void }) {
  return (
    <Link
      to={item.link}
      onClick={onNavigate}
      className="flex items-start gap-2.5 px-3 py-2 hover:bg-accent transition-colors"
    >
      <span className={cn('mt-1.5 h-2 w-2 rounded-full shrink-0', URGENCIA_DOT[item.urgencia])} />
      <div className="min-w-0 flex-1">
        <p className={cn('text-sm font-medium truncate', URGENCIA_TEXT[item.urgencia])}>{item.titulo}</p>
        <p className="text-xs text-muted-foreground truncate">{item.descripcion}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">{formatDate(item.fecha)}</p>
      </div>
    </Link>
  );
}

export default function NotificacionesBell() {
  const [open, setOpen] = useState(false);
  const { data } = useNotificaciones();
  const criticas = data?.criticas ?? 0;
  const items = (data?.items ?? [])
    .slice()
    .sort((a, b) => (a.urgencia === b.urgencia ? 0 : a.urgencia === 'critical' ? -1 : b.urgencia === 'critical' ? 1 : 0))
    .slice(0, 10);

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <button
          className="relative rounded p-1.5 hover:bg-accent transition-colors"
          aria-label="Notificaciones"
        >
          <Bell size={18} />
          {criticas > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
              {criticas > 99 ? '99+' : criticas}
            </span>
          )}
        </button>
      </PopoverPrimitive.Trigger>

      {/* Portal a document.body — el header de la campana vive dentro del
          <aside> del Sidebar, que tiene overflow-hidden (necesario para la
          transición de ancho al colapsar). Sin portal, este dropdown quedaría
          recortado por ese overflow-hidden sin importar left-0/right-0. */}
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="end"
          sideOffset={6}
          collisionPadding={12}
          className="z-50 w-80 rounded-md border border-border bg-white shadow-lg overflow-hidden"
        >
          <div className="px-3 py-2 border-b border-border flex items-center justify-between">
            <span className="text-sm font-semibold">Notificaciones</span>
            {data && <span className="text-xs text-muted-foreground">{data.total} activa{data.total !== 1 ? 's' : ''}</span>}
          </div>
          <div className="max-h-96 overflow-y-auto divide-y divide-border">
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground px-3 py-6 text-center">Sin notificaciones.</p>
            ) : (
              items.map(item => <NotificacionRow key={item.id} item={item} onNavigate={() => setOpen(false)} />)
            )}
          </div>
          <Link
            to="/calendario"
            onClick={() => setOpen(false)}
            className="block text-center text-xs font-medium text-primary py-2 border-t border-border hover:bg-accent transition-colors"
          >
            Ver todas
          </Link>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
