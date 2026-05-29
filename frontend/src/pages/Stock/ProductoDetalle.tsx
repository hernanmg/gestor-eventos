import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Package } from 'lucide-react';
import { useProducto } from '@/hooks/useStock';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { EstadoAsignacion } from '@/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const ESTADO_CLASS: Record<EstadoAsignacion, string> = {
  ACTIVA:      'bg-green-100 text-green-800',
  TRANSFERIDA: 'bg-blue-100 text-blue-800',
  DEVUELTA:    'bg-gray-100 text-gray-700',
  CANCELADA:   'bg-red-100 text-red-700',
};

function Stat({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="rounded-lg border bg-white p-4 text-center">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={cn('text-2xl font-bold', color ?? 'text-foreground')}>{value}</p>
    </div>
  );
}

export default function ProductoDetallePage() {
  const { id }     = useParams<{ id: string }>();
  const navigate   = useNavigate();
  const productoId = Number(id);

  const { data: producto, isLoading } = useProducto(productoId);

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Cargando...</div>;
  }
  if (!producto) {
    return (
      <div className="p-6">
        <p className="text-sm text-destructive">Producto no encontrado.</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate('/stock')}>
          Volver
        </Button>
      </div>
    );
  }

  const disp = producto.disponibilidad_hoy;
  const disponible_hoy    = disp?.disponible            ?? producto.stock_total;
  const comprometido_hoy  = disp?.cantidad_comprometida ?? 0;
  const asignacionesActivas = (producto.asignaciones ?? []).filter(a => a.estado === 'ACTIVA');

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button onClick={() => navigate('/stock')} className="text-muted-foreground hover:text-foreground mt-0.5">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <Package size={20} className="text-muted-foreground" />
            <h1 className="text-2xl font-bold">{producto.nombre}</h1>
            {producto.codigo && (
              <span className="text-xs font-mono bg-secondary px-2 py-0.5 rounded">{producto.codigo}</span>
            )}
            {producto.categoria && (
              <span className="text-xs text-muted-foreground">{producto.categoria.nombre}</span>
            )}
          </div>
          {producto.descripcion && (
            <p className="text-sm text-muted-foreground mt-1">{producto.descripcion}</p>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Stock total"   value={`${producto.stock_total} ${producto.unidad}`} />
        <Stat
          label="Disponible hoy"
          value={disponible_hoy}
          color={disponible_hoy < producto.stock_minimo ? 'text-red-600' : disponible_hoy <= producto.stock_minimo * 1.2 ? 'text-yellow-600' : 'text-green-700'}
        />
        <Stat label="Comprometido"  value={comprometido_hoy} color="text-blue-600" />
        <Stat label="Stock mínimo"  value={producto.stock_minimo} />
      </div>

      {/* Asignaciones activas */}
      <div>
        <h2 className="text-sm font-semibold mb-2">Asignaciones activas</h2>
        {asignacionesActivas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin asignaciones activas.</p>
        ) : (
          <div className="rounded-lg border bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/30">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Evento</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Cantidad</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Salida</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Retorno</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Origen</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {asignacionesActivas.map(a => (
                  <tr key={a.id}>
                    <td className="px-3 py-2.5 font-medium">
                      {a.evento?.nombre ?? `Evento #${a.evento_id}`}
                    </td>
                    <td className="px-3 py-2.5 text-right">{a.cantidad}</td>
                    <td className="px-3 py-2.5 text-xs">
                      {format(new Date(a.fecha_salida), 'dd/MM/yy', { locale: es })}
                    </td>
                    <td className="px-3 py-2.5 text-xs">
                      {a.fecha_retorno ? format(new Date(a.fecha_retorno), 'dd/MM/yy', { locale: es }) : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-xs">
                      {a.origen === 'EVENTO' && a.evento_origen ? (
                        <span className="text-blue-700">Prestado de: {a.evento_origen.nombre}</span>
                      ) : 'Depósito'}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', ESTADO_CLASS[a.estado])}>
                        {a.estado}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Historial de movimientos (línea de tiempo) */}
      <div>
        <h2 className="text-sm font-semibold mb-2">Historial de movimientos</h2>
        {!producto.movimientos?.length ? (
          <p className="text-sm text-muted-foreground">Sin movimientos registrados.</p>
        ) : (
          <div className="rounded-lg border bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/30">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Fecha</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Tipo</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Cantidad</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Descripción</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {producto.movimientos.map(m => (
                  <tr key={m.id}>
                    <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(m.fecha), 'dd/MM/yy HH:mm', { locale: es })}
                    </td>
                    <td className="px-3 py-2">
                      <span className="text-xs font-mono bg-secondary px-1.5 py-0.5 rounded">
                        {m.tipo}
                      </span>
                    </td>
                    <td className={cn('px-3 py-2 text-right font-semibold text-sm', m.cantidad > 0 ? 'text-green-700' : m.cantidad < 0 ? 'text-red-600' : 'text-muted-foreground')}>
                      {m.cantidad > 0 ? `+${m.cantidad}` : m.cantidad}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{m.descripcion ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Todas las asignaciones (historial) */}
      {(producto.asignaciones ?? []).filter(a => a.estado !== 'ACTIVA').length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-2">Historial de asignaciones</h2>
          <div className="rounded-lg border bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/30">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Evento</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Cantidad</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Salida</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {(producto.asignaciones ?? []).filter(a => a.estado !== 'ACTIVA').map(a => (
                  <tr key={a.id} className="opacity-70">
                    <td className="px-3 py-2 font-medium">{a.evento?.nombre ?? `Evento #${a.evento_id}`}</td>
                    <td className="px-3 py-2 text-right">{a.cantidad}</td>
                    <td className="px-3 py-2 text-xs">{format(new Date(a.fecha_salida), 'dd/MM/yy', { locale: es })}</td>
                    <td className="px-3 py-2">
                      <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', ESTADO_CLASS[a.estado])}>
                        {a.estado}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
