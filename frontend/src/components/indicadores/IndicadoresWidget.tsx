import { useEffect, useState } from 'react';
import { DollarSign, TrendingUp, RefreshCw } from 'lucide-react';
import { useIndicadores } from '@/hooks/useIndicadores';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { cn, getApiErrorMessage } from '@/lib/utils';
import { formatCurrency } from '@/lib/formatters';
import type { CotizacionDolar, TipoIndicador } from '@/types';

// Dólar oficial / blue e IPC mensual — 3 tarjetas compactas + "Actualizar" (ADMIN)

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

// fechaActualizacion es un timestamp real → hora local
const fmtFechaHora = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso)) : '';

// "2026-08" → "Agosto 2026"
const fmtPeriodo = (p: string | null) => {
  const m = p?.match(/^(\d{4})-(\d{2})$/);
  return m ? `${MESES[Number(m[2]) - 1]} ${m[1]}` : '';
};

export function haceCuanto(iso: string, ahora = Date.now()): string {
  const min = Math.max(0, Math.round((ahora - new Date(iso).getTime()) / 60_000));
  if (min < 1) return 'recién';
  if (min < 60) return `hace ${min} min`;
  const hs = Math.round(min / 60);
  if (hs < 24) return `hace ${hs} h`;
  const dias = Math.round(hs / 24);
  return `hace ${dias} día${dias > 1 ? 's' : ''}`;
}

function Tarjeta({ icono, titulo, disponible, fallo, children }: {
  icono: React.ReactNode; titulo: string; disponible: boolean; fallo: boolean; children: React.ReactNode;
}) {
  return (
    <div className={cn('rounded-lg border bg-white p-3 min-w-[200px] flex-1', (!disponible || fallo) && 'opacity-60')}>
      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">{icono}{titulo}</p>
      {disponible ? children : <p className="mt-2 text-sm text-muted-foreground">No disponible</p>}
      {disponible && fallo && <p className="text-[11px] text-amber-700 mt-0.5">No se pudo actualizar — último dato guardado</p>}
    </div>
  );
}

function Dolar({ d }: { d: CotizacionDolar }) {
  return (
    <div className="mt-1 text-sm tabular-nums">
      <p><span className="text-muted-foreground">Compra:</span> {formatCurrency(d.compra)}</p>
      <p className="font-semibold"><span className="font-normal text-muted-foreground">Venta:</span> {formatCurrency(d.venta)}</p>
      <p className="text-[11px] text-muted-foreground">{fmtFechaHora(d.fecha ?? d.guardado_en)}</p>
    </div>
  );
}

export default function IndicadoresWidget({ className }: { className?: string }) {
  const { user } = useAuth();
  const { data, loading, refresh, refreshing, fallidas } = useIndicadores();
  const [error, setError] = useState<string | null>(null);
  // Re-render cada minuto para que el "hace X" no quede congelado
  const [ahora, setAhora] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setAhora(Date.now()), 60_000); return () => clearInterval(t); }, []);

  const fallo = (t: TipoIndicador) => fallidas.includes(t);
  const actualizar = async () => {
    setError(null);
    try { await refresh(); } catch (err) { setError(getApiErrorMessage(err)); }
  };

  if (loading) return <p className={cn('text-xs text-muted-foreground', className)}>Cargando indicadores…</p>;

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex flex-wrap gap-3">
        <Tarjeta icono={<DollarSign size={13} />} titulo="Dólar Oficial" disponible={!!data?.dolar_oficial} fallo={fallo('DOLAR_OFICIAL')}>
          {data?.dolar_oficial && <Dolar d={data.dolar_oficial} />}
        </Tarjeta>
        <Tarjeta icono={<DollarSign size={13} />} titulo="Dólar Blue" disponible={!!data?.dolar_blue} fallo={fallo('DOLAR_BLUE')}>
          {data?.dolar_blue && <Dolar d={data.dolar_blue} />}
        </Tarjeta>
        <Tarjeta icono={<TrendingUp size={13} />} titulo="IPC Mensual" disponible={!!data?.ipc} fallo={fallo('IPC')}>
          {data?.ipc && (
            <div className="mt-1 text-sm">
              <p className="text-muted-foreground">{fmtPeriodo(data.ipc.periodo)}</p>
              <p className="text-lg font-semibold tabular-nums">{data.ipc.valor.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</p>
              <p className="text-[11px] text-muted-foreground">fuente: INDEC</p>
            </div>
          )}
        </Tarjeta>
      </div>
      <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
        {error && <span className="text-destructive">{error}</span>}
        {data?.actualizado_en && <span title={new Date(data.actualizado_en).toLocaleString('es-AR')}>Última act.: {haceCuanto(data.actualizado_en, ahora)}</span>}
        {user?.rol === 'ADMIN' && (
          <Button size="sm" variant="outline" className="h-7" disabled={refreshing} onClick={actualizar}>
            <RefreshCw size={12} className={cn('mr-1', refreshing && 'animate-spin')} /> Actualizar
          </Button>
        )}
      </div>
    </div>
  );
}
