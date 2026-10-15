import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell, Calendar, CheckCircle2, Landmark, Loader2, Package, Receipt, Truck, Users, Wallet,
  type LucideIcon,
} from 'lucide-react';
import {
  useNotificaciones, useResolverAccionNotificacion,
  type NotificacionItem, type UrgenciaNotificacion,
} from '@/hooks/useNotificaciones';
import { Button } from '@/components/ui/button';
import { cn, getApiErrorMessage } from '@/lib/utils';

// ── Bandeja "Para hoy" ───────────────────────────────────────────────────────
// Lo mismo que junta la campana de notificaciones (GET /notificaciones: flota,
// facturas, cuotas, rendiciones, jornadas…), pero a la vista y con la acción
// de cada ítem: "Abrir" lleva a la pantalla donde se resuelve, y los ítems
// que el backend permite resolver inline (aprobar/rechazar tardanza) traen
// sus propios botones. Críticos primero.

const ORDEN: Record<UrgenciaNotificacion, number> = { critical: 0, warning: 1, info: 2 };

const URGENCIA: Record<UrgenciaNotificacion, { label: string; tile: string; pill: string }> = {
  critical: { label: 'Urgente', tile: 'bg-red-50 text-red-700',     pill: 'bg-red-50 text-red-700' },
  warning:  { label: 'Pronto',  tile: 'bg-amber-50 text-amber-700', pill: 'bg-amber-50 text-amber-700' },
  info:     { label: 'Info',    tile: 'bg-blue-50 text-blue-700',   pill: 'bg-blue-50 text-blue-700' },
};

// Ícono por área, deducido del tipo de notificación del backend
// (notificaciones.controller.ts). Un tipo nuevo cae en la campana genérica.
function iconoPara(tipo: string): LucideIcon {
  if (/SEGURO|PATENTE|TALLER|SINIESTRO_VEHICULO|COMBUSTIBLE/.test(tipo)) return Truck;
  if (/FACTURA/.test(tipo)) return Receipt;
  if (/CUOTA|PRESTAMO|SGR/.test(tipo)) return Landmark;
  if (/SALDO|RENDICION|GASTO_ESPACIO/.test(tipo)) return Wallet;
  if (/JORNADA|TARDANZA|PRESENTISMO|LIQUIDACION|EXCEDENTE|SINIESTRO/.test(tipo)) return Users;
  if (/STOCK/.test(tipo)) return Package;
  if (/EVENTO/.test(tipo)) return Calendar;
  return Bell;
}

function Item({ item }: { item: NotificacionItem }) {
  const resolverMut = useResolverAccionNotificacion();
  const [error, setError] = useState<string | null>(null);
  const Icon = iconoPara(item.tipo);
  const u = URGENCIA[item.urgencia];
  const acciones = item.acciones ?? [];

  return (
    <li className="flex items-start gap-3 rounded-xl border border-border bg-card px-3 py-2.5 shadow-sm sm:items-center">
      <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-lg', u.tile)}>
        <Icon size={17} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-snug line-clamp-2 break-words">
          {item.titulo}
          <span className={cn('ml-2 inline-block rounded-full px-1.5 py-0.5 align-[1px] text-[10.5px] font-semibold leading-none', u.pill)}>{u.label}</span>
        </p>
        {/* La descripción del backend ya trae la fecha relevante ("vencido el …") */}
        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2 sm:line-clamp-1">{item.descripcion}</p>
        {error && <p className="mt-0.5 text-xs text-destructive">{error}</p>}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5 sm:flex-row sm:items-center">
        {acciones.map(accion => (
          <Button
            key={accion.endpoint}
            size="sm"
            variant={accion.variant === 'destructive' ? 'outline' : 'default'}
            className={cn('h-8', accion.variant === 'destructive' && 'text-destructive')}
            disabled={resolverMut.isPending}
            onClick={() => {
              setError(null);
              resolverMut.mutate(accion.endpoint, { onError: err => setError(getApiErrorMessage(err) ?? 'Error al procesar la acción') });
            }}
          >
            {accion.label}
          </Button>
        ))}
        <Button size="sm" variant="outline" className="h-8" asChild>
          <Link to={item.link}>Abrir</Link>
        </Button>
      </div>
    </li>
  );
}

const VISIBLES = 6;

export default function ParaHoy() {
  const { data, isLoading } = useNotificaciones();
  const [verTodo, setVerTodo] = useState(false);
  const items = [...(data?.items ?? [])].sort((a, b) => ORDEN[a.urgencia] - ORDEN[b.urgencia]);
  const urgentes = items.filter(i => i.urgencia === 'critical').length;
  const visibles = verTodo ? items : items.slice(0, VISIBLES);

  return (
    <section className="flex min-w-0 flex-col gap-2" aria-labelledby="para-hoy-titulo">
      <div className="flex items-center gap-2 px-0.5">
        <h2 id="para-hoy-titulo" className="text-[15px] font-semibold">Para hoy</h2>
        {items.length > 0 && (
          <span className={cn(
            'rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums',
            urgentes > 0 ? 'bg-red-50 text-red-700' : 'bg-secondary text-muted-foreground',
          )}>
            {items.length}
          </span>
        )}
        {items.length > VISIBLES && (
          <button onClick={() => setVerTodo(v => !v)} className="ml-auto text-xs font-medium text-link hover:underline">
            {verTodo ? 'Ver menos' : `Ver todo (${items.length})`}
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-6 text-sm text-muted-foreground">
          <Loader2 size={16} className="animate-spin" /> Cargando pendientes…
        </div>
      ) : items.length === 0 ? (
        <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-4 text-sm text-green-800">
          <CheckCircle2 size={18} className="shrink-0" />
          <span><span className="font-semibold">Nada pendiente.</span> Cuando venza un seguro, una factura o una cuota, aparece acá.</span>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {visibles.map(item => <Item key={item.id} item={item} />)}
        </ul>
      )}
    </section>
  );
}
