import { RefreshCw, AlertTriangle } from 'lucide-react';
import { useConciliatoria } from '@/hooks/useConciliatoria';
import type { PorMoneda, CajaCuenta, TabResumen } from '@/hooks/useConciliatoria';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { Moneda } from '@/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function SaldoAmount({ value, moneda }: { value: number; moneda: Moneda }) {
  return (
    <span className={cn('font-medium tabular-nums', value < 0 ? 'text-destructive' : value > 0 ? 'text-green-600' : '')}>
      {formatCurrency(value, moneda)}
    </span>
  );
}

// ── TabsTable ─────────────────────────────────────────────────────────────────

function TabsTable({ title, rows, moneda }: { title: string; rows: TabResumen[]; moneda: Moneda }) {
  const totalDebe  = rows.reduce((a, r) => a + r.total_debe,  0);
  const totalHaber = rows.reduce((a, r) => a + r.total_haber, 0);
  const totalSaldo = rows.reduce((a, r) => a + r.saldo,       0);

  const th = 'px-3 py-2 text-xs font-medium text-muted-foreground text-left';
  const td = 'px-3 py-2 text-sm';

  return (
    <div>
      <h4 className="text-sm font-semibold mb-2">{title}</h4>
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-border">
            <tr>
              <th className={th}>Pestaña</th>
              <th className={cn(th, 'text-right')}>Debe</th>
              <th className={cn(th, 'text-right')}>Haber</th>
              <th className={cn(th, 'text-right')}>Saldo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map(r => (
              <tr key={r.tab_numero}>
                <td className={td}>{r.nombre}</td>
                <td className={cn(td, 'text-right tabular-nums text-muted-foreground')}>
                  {formatCurrency(r.total_debe, moneda)}
                </td>
                <td className={cn(td, 'text-right tabular-nums text-muted-foreground')}>
                  {formatCurrency(r.total_haber, moneda)}
                </td>
                <td className={cn(td, 'text-right')}>
                  <SaldoAmount value={r.saldo} moneda={moneda} />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-50 border-t border-border font-medium">
            <tr>
              <td className={cn(td, 'text-muted-foreground')}>Total</td>
              <td className={cn(td, 'text-right tabular-nums')}>{formatCurrency(totalDebe,  moneda)}</td>
              <td className={cn(td, 'text-right tabular-nums')}>{formatCurrency(totalHaber, moneda)}</td>
              <td className={cn(td, 'text-right')}><SaldoAmount value={totalSaldo} moneda={moneda} /></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ── ResumenMoneda ─────────────────────────────────────────────────────────────

function ResumenMoneda({ pm }: { pm: PorMoneda }) {
  const moneda = pm.moneda as Moneda;
  const th = 'px-3 py-2 text-xs font-medium text-muted-foreground text-left';
  const td = 'px-3 py-2 text-sm';

  return (
    <section className="rounded-xl border border-border overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b border-border">
        <h3 className="font-semibold">Resumen {pm.moneda}</h3>
      </div>

      <div className="p-4 space-y-5">
        <TabsTable title="Ingresos" rows={pm.ingresos} moneda={moneda} />
        <TabsTable title="Egresos"  rows={pm.egresos}  moneda={moneda} />

        {/* Saldo final */}
        <div className={cn(
          'flex items-center justify-between rounded-lg px-4 py-3 font-semibold',
          pm.saldo_final >= 0 ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200',
        )}>
          <div className="space-y-0.5">
            <div className="text-xs text-muted-foreground">Total ingresos</div>
            <span className="text-sm">{formatCurrency(pm.total_ingresos, moneda)}</span>
          </div>
          <div className="space-y-0.5 text-right">
            <div className="text-xs text-muted-foreground">Total egresos</div>
            <span className="text-sm">{formatCurrency(pm.total_egresos, moneda)}</span>
          </div>
          <div className="space-y-0.5 text-right">
            <div className="text-xs text-muted-foreground">Saldo final</div>
            <span className={cn('text-lg', pm.saldo_final >= 0 ? 'text-green-700' : 'text-red-700')}>
              {formatCurrency(pm.saldo_final, moneda)}
            </span>
          </div>
        </div>

        {/* Distribución de socios */}
        {pm.distribucion_socios.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-2">Distribución de socios</h4>
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-border">
                  <tr>
                    <th className={th}>Socio</th>
                    <th className={cn(th, 'text-right')}>%</th>
                    <th className={cn(th, 'text-right')}>Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pm.distribucion_socios.map(s => (
                    <tr key={s.nombre}>
                      <td className={td}>{s.nombre}</td>
                      <td className={cn(td, 'text-right tabular-nums text-muted-foreground')}>
                        {s.porcentaje}%
                      </td>
                      <td className={cn(td, 'text-right')}>
                        <SaldoAmount value={s.monto} moneda={moneda} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

// ── CajaResumen ───────────────────────────────────────────────────────────────

function CajaResumen({ cuentas }: { cuentas: CajaCuenta[] }) {
  const th = 'px-3 py-2 text-xs font-medium text-muted-foreground text-left';
  const td = 'px-3 py-2 text-sm';

  return (
    <section className="rounded-xl border border-border overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b border-border">
        <h3 className="font-semibold">Caja</h3>
      </div>
      <table className="w-full">
        <thead className="border-b border-border">
          <tr>
            <th className={th}>Cuenta</th>
            <th className={th}>Tipo</th>
            <th className={th}>Moneda</th>
            <th className={cn(th, 'text-right')}>Saldo inicial</th>
            <th className={cn(th, 'text-right')}>Saldo actual</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {cuentas.map(c => (
            <tr key={c.cuenta_id}>
              <td className={td}>{c.nombre}</td>
              <td className={cn(td, 'text-muted-foreground')}>{c.tipo}</td>
              <td className={cn(td, 'text-muted-foreground')}>{c.moneda}</td>
              <td className={cn(td, 'text-right tabular-nums text-muted-foreground')}>
                {formatCurrency(c.saldo_inicial, c.moneda as Moneda)}
              </td>
              <td className={cn(td, 'text-right')}>
                <SaldoAmount value={c.saldo_actual} moneda={c.moneda as Moneda} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

// ── ConciliatoriaPage ─────────────────────────────────────────────────────────

interface Props {
  eventoId: number;
}

export default function ConciliatoriaPage({ eventoId }: Props) {
  const { data, isLoading, refetch, isFetching } = useConciliatoria(eventoId);

  if (isLoading) return <p className="p-4 text-sm text-muted-foreground">Cargando...</p>;
  if (!data)    return null;

  const { por_moneda, caja_por_cuenta, echeqs_pendientes } = data;

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="gap-1.5"
        >
          <RefreshCw size={13} className={isFetching ? 'animate-spin' : ''} />
          Actualizar
        </Button>
      </div>

      {/* Echeqs pendientes warning */}
      {echeqs_pendientes.cantidad > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <div>
            <span className="font-medium">{echeqs_pendientes.cantidad} echeq{echeqs_pendientes.cantidad !== 1 ? 's' : ''} pendiente{echeqs_pendientes.cantidad !== 1 ? 's' : ''}</span>
            {' — estos importes aún no impactaron en caja: '}
            {echeqs_pendientes.total_por_moneda.map(t => (
              <span key={t.moneda} className="font-medium">
                {formatCurrency(t.total, t.moneda as Moneda)}{' '}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Por moneda */}
      {por_moneda.map(pm => (
        <ResumenMoneda key={pm.moneda} pm={pm} />
      ))}

      {/* Caja */}
      {caja_por_cuenta.length > 0 && (
        <CajaResumen cuentas={caja_por_cuenta} />
      )}
    </div>
  );
}
