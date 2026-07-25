import { useResumenMovimientos } from '@/hooks/useMovimientos';
import { MovimientoEstadoBadge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { ResumenRubro, EstadoMovimiento, Moneda } from '@/types';

function estadoGeneral(estados: ResumenRubro['estados']): EstadoMovimiento {
  const activos = estados.PENDIENTE + estados.COTIZANDO + estados.CONFIRMADO + estados.PAGADO;
  if (activos === 0) return 'CANCELADO';
  if (estados.PAGADO === activos) return 'PAGADO';
  if (estados.PENDIENTE > 0) return 'PENDIENTE';
  if (estados.COTIZANDO > 0) return 'COTIZANDO';
  return 'CONFIRMADO';
}

function RubrosTable({ title, rows, moneda }: { title: string; rows: ResumenRubro[]; moneda: Moneda }) {
  const totalPresupuesto = rows.reduce((a, r) => a + r.presupuesto_total, 0);
  const totalReal        = rows.reduce((a, r) => a + r.costo_real_total, 0);
  const totalDif          = parseFloat((totalPresupuesto - totalReal).toFixed(2));
  const totalDifPct       = totalPresupuesto !== 0 ? parseFloat((totalDif / totalPresupuesto * 100).toFixed(2)) : 0;

  const th = 'px-3 py-2 text-xs font-medium text-muted-foreground text-left';
  const td = 'px-3 py-2 text-sm';

  if (rows.length === 0) return null;

  return (
    <div>
      <h4 className="text-sm font-semibold mb-2">{title}</h4>
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-border">
            <tr>
              <th className={th}>Rubro</th>
              <th className={cn(th, 'text-right')}>Presupuesto</th>
              <th className={cn(th, 'text-right')}>Real</th>
              <th className={cn(th, 'text-right')}>Diferencia ($)</th>
              <th className={cn(th, 'text-right')}>Diferencia (%)</th>
              <th className={th}>Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map(r => (
              <tr key={r.rubro_id}>
                <td className={td}>{r.rubro_nombre}</td>
                <td className={cn(td, 'text-right tabular-nums text-muted-foreground')}>
                  {formatCurrency(r.presupuesto_total, moneda)}
                </td>
                <td className={cn(td, 'text-right tabular-nums text-muted-foreground')}>
                  {formatCurrency(r.costo_real_total, moneda)}
                </td>
                <td className={cn(td, 'text-right tabular-nums font-medium', r.diferencia < 0 ? 'text-destructive' : r.diferencia > 0 ? 'text-green-600' : '')}>
                  {formatCurrency(r.diferencia, moneda)}
                </td>
                <td className={cn(td, 'text-right tabular-nums', r.diferencia < 0 ? 'text-destructive' : r.diferencia > 0 ? 'text-green-600' : 'text-muted-foreground')}>
                  {r.presupuesto_total !== 0 ? `${r.diferencia_pct}%` : <span className="text-muted-foreground/40">—</span>}
                </td>
                <td className={td}>
                  <MovimientoEstadoBadge estado={estadoGeneral(r.estados)} />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-50 border-t border-border font-medium">
            <tr>
              <td className={cn(td, 'text-muted-foreground')}>Total</td>
              <td className={cn(td, 'text-right tabular-nums')}>{formatCurrency(totalPresupuesto, moneda)}</td>
              <td className={cn(td, 'text-right tabular-nums')}>{formatCurrency(totalReal, moneda)}</td>
              <td className={cn(td, 'text-right tabular-nums', totalDif < 0 ? 'text-destructive' : 'text-green-600')}>
                {formatCurrency(totalDif, moneda)}
              </td>
              <td className={cn(td, 'text-right tabular-nums', totalDif < 0 ? 'text-destructive' : 'text-green-600')}>
                {totalDifPct}%
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

interface Props {
  eventoId: number;
  moneda:   Moneda;
}

export default function ResumenRubros({ eventoId, moneda }: Props) {
  const { data, isLoading } = useResumenMovimientos(eventoId);

  if (isLoading) return <p className="p-4 text-sm text-muted-foreground">Cargando...</p>;
  if (!data)      return null;

  const egresos  = data.por_rubro.filter(r => r.tipo === 'EGRESO');
  const ingresos = data.por_rubro.filter(r => r.tipo === 'INGRESO');

  return (
    <div className="space-y-5">
      <div className={cn(
        'flex items-center justify-between rounded-lg px-4 py-3 font-semibold',
        data.saldo >= 0 ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200',
      )}>
        <div className="space-y-0.5">
          <div className="text-xs text-muted-foreground">Total ingresos</div>
          <span className="text-sm">{formatCurrency(data.total_ingresos, moneda)}</span>
        </div>
        <div className="space-y-0.5 text-right">
          <div className="text-xs text-muted-foreground">Total egresos</div>
          <span className="text-sm">{formatCurrency(data.total_egresos, moneda)}</span>
        </div>
        <div className="space-y-0.5 text-right">
          <div className="text-xs text-muted-foreground">Saldo</div>
          <span className={cn('text-lg', data.saldo >= 0 ? 'text-green-700' : 'text-red-700')}>
            {formatCurrency(data.saldo, moneda)}
          </span>
        </div>
      </div>

      <RubrosTable title="Ingresos" rows={ingresos} moneda={moneda} />
      <RubrosTable title="Egresos"  rows={egresos}  moneda={moneda} />

      {data.por_rubro.length === 0 && (
        <p className="text-sm text-muted-foreground py-6 text-center">Todavía no hay movimientos cargados en este evento.</p>
      )}
    </div>
  );
}
