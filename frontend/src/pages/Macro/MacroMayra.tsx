import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { Loader2, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useResumenFinancieroMacro, type ResumenFinancieroEmpresa } from '@/hooks/useMacro';
import { formatCurrency } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { AreaMacro } from '@/types';

// ── Config de tabs ────────────────────────────────────────────────────────────

const TAB_ORDEN: AreaMacro[] = ['FINANZAS', 'ADMIN', 'RRHH', 'STOCK'];
const TAB_LABEL: Record<AreaMacro, string> = {
  FINANZAS: '💰 Finanzas',
  ADMIN:    '📋 Admin',
  RRHH:     '👷 RRHH',
  STOCK:    '📦 Stock',
};

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function Card({ title, className, children }: { title?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('rounded-xl border border-border bg-white p-4 shadow-sm', className)}>
      {title && <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">{title}</p>}
      {children}
    </div>
  );
}

// ── Tab Finanzas ──────────────────────────────────────────────────────────────

function FinanzasTab({ data, mes, anio, onMesChange }: {
  data: ResumenFinancieroEmpresa;
  mes: number; anio: number;
  onMesChange: (mes: number, anio: number) => void;
}) {
  const pm = data.movimientos_por_moneda;
  const monedas = (['ARS', 'USD', 'EUR'] as const).filter(m => pm[m].ingresos !== 0 || pm[m].egresos !== 0);

  const chartData = [{
    nombre:   `${MESES[mes - 1]} ${anio}`,
    Ingresos: pm.total_en_ars.ingresos,
    Egresos:  pm.total_en_ars.egresos,
  }];

  const prev = () => mes === 1 ? onMesChange(12, anio - 1) : onMesChange(mes - 1, anio);
  const next = () => mes === 12 ? onMesChange(1, anio + 1) : onMesChange(mes + 1, anio);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center gap-2">
        <button onClick={prev} className="p-1 rounded hover:bg-accent text-muted-foreground"><ChevronLeft size={16} /></button>
        <span className="text-sm font-medium w-40 text-center">{MESES[mes - 1]} {anio}</span>
        <button onClick={next} className="p-1 rounded hover:bg-accent text-muted-foreground"><ChevronRight size={16} /></button>
      </div>

      {/* Cards por moneda — sólo las que tuvieron actividad este mes */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {monedas.map(m => (
          <Card key={m} title={`Saldo ${m}`}>
            <span className={cn('text-2xl font-bold tabular-nums', pm[m].saldo >= 0 ? 'text-green-600' : 'text-destructive')}>
              {formatCurrency(pm[m].saldo, m)}
            </span>
            <div className="mt-1 flex flex-col gap-0.5 text-xs text-muted-foreground">
              <span>Ingresos: {formatCurrency(pm[m].ingresos, m)}</span>
              <span>Egresos: {formatCurrency(pm[m].egresos, m)}</span>
            </div>
          </Card>
        ))}
        <Card title="Total en ARS">
          <span className={cn('text-2xl font-bold tabular-nums', pm.total_en_ars.saldo >= 0 ? 'text-green-600' : 'text-destructive')}>
            {formatCurrency(pm.total_en_ars.saldo, 'ARS')}
          </span>
          <div className="mt-1 flex flex-col gap-0.5 text-xs text-muted-foreground">
            <span>Ingresos: {formatCurrency(pm.total_en_ars.ingresos, 'ARS')}</span>
            <span>Egresos: {formatCurrency(pm.total_en_ars.egresos, 'ARS')}</span>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card title="Facturas pendientes">
          <span className="text-2xl font-bold tabular-nums">{data.facturas_pendientes}</span>
          {data.facturas_vencidas > 0 && (
            <p className="text-xs text-destructive mt-1 flex items-center gap-1">
              <AlertTriangle size={12} /> {data.facturas_vencidas} vencida{data.facturas_vencidas !== 1 ? 's' : ''}
            </p>
          )}
        </Card>
        <Card title="Echeqs pendientes">
          <span className="text-2xl font-bold tabular-nums">{formatCurrency(data.echeqs_pendientes, 'ARS')}</span>
        </Card>
      </div>

      <div className="rounded-xl border border-border bg-white shadow-sm p-4">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Ingresos vs Egresos — Total en ARS</p>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="nombre" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 10 }} width={70} tickFormatter={(v: number) => formatCurrency(v, 'ARS')} />
            <Tooltip formatter={(v: any) => formatCurrency(v, 'ARS')} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="Ingresos" fill="#22c55e" radius={[2, 2, 0, 0]} />
            <Bar dataKey="Egresos"  fill="#ef4444" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── Tab Admin ─────────────────────────────────────────────────────────────────

function AdminTab({ data }: { data: ResumenFinancieroEmpresa }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-gray-50">
          <span className="text-sm font-semibold">Cuentas corrientes activas ({data.cuentas_corrientes.length})</span>
        </div>
        {data.cuentas_corrientes.length === 0 ? (
          <p className="text-sm text-muted-foreground p-4">Sin cuentas corrientes activas.</p>
        ) : (
          <ul className="divide-y divide-border">
            {data.cuentas_corrientes.map((c, i) => (
              <li key={i} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="font-medium">{c.nombre}</span>
                <span className="flex items-center gap-2">
                  <span className="text-xs px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground">{c.moneda}</span>
                  <span className={cn('font-semibold tabular-nums', c.saldo >= 0 ? 'text-green-700' : 'text-red-600')}>
                    {formatCurrency(c.saldo, c.moneda as any)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Card title="Planes AFIP">
        <p className="text-sm text-muted-foreground">Módulo no implementado todavía — ver análisis de planillas de Mayra.</p>
      </Card>
      <Card title="Préstamos bancarios">
        <p className="text-sm text-muted-foreground">Módulo no implementado todavía — ver análisis de planillas de Mayra.</p>
      </Card>
    </div>
  );
}

// ── Tab RRHH ──────────────────────────────────────────────────────────────────

function RRHHTab({ data, empresaId }: { data: ResumenFinancieroEmpresa; empresaId: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <Card title="Liquidaciones pendientes de aprobación">
        <span className="text-2xl font-bold tabular-nums">{data.liquidaciones_pendientes}</span>
        {data.liquidaciones_pendientes > 0 && (
          <Link to="/rrhh?tab=liquidaciones" className="block text-xs text-primary hover:underline mt-2">
            Ver en RRHH →
          </Link>
        )}
      </Card>
      <Card title="Anticipos pendientes de descuento">
        <span className="text-2xl font-bold tabular-nums">{formatCurrency(data.anticipos_pendientes, 'ARS')}</span>
      </Card>
      <p className="sm:col-span-2 text-xs text-muted-foreground">
        Empresa #{empresaId} — próximas liquidaciones del mes y nómina estimada quedan para una siguiente iteración.
      </p>
    </div>
  );
}

// ── Tab Stock ─────────────────────────────────────────────────────────────────

function StockTab({ data }: { data: ResumenFinancieroEmpresa }) {
  return (
    <div className="space-y-4">
      <Card title="Alertas de stock mínimo" className={data.alertas_stock > 0 ? 'border-destructive/40' : ''}>
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold tabular-nums">{data.alertas_stock}</span>
          {data.alertas_stock > 0 && (
            <span className="text-xs font-medium text-destructive bg-destructive/10 rounded-full px-2 py-0.5">
              productos bajo el mínimo
            </span>
          )}
        </div>
        <Link to="/stock" className="block text-xs text-primary hover:underline mt-2">Ver en Stock →</Link>
      </Card>
      <p className="text-xs text-muted-foreground">
        Asignaciones activas fuera del depósito y material en tránsito con retorno próximo quedan para una siguiente iteración.
      </p>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MacroMayra() {
  const { user } = useAuth();
  const hoy = new Date();
  const [mes, setMes]   = useState(hoy.getMonth() + 1);
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [empresaId, setEmpresaId] = useState<number | null>(user?.empresa?.id ?? null);

  const empresas = user?.empresasDisponibles ?? [];
  const areasDisponibles = TAB_ORDEN.filter(a => (user?.areasMacro ?? []).includes(a));
  const [tab, setTab] = useState<AreaMacro | null>(areasDisponibles[0] ?? null);

  // `user` puede llegar (o refrescarse en segundo plano, ver React Query
  // staleTime) después del mount de este componente — si el tab u empresa
  // seleccionados quedaron desactualizados (o nunca se inicializaron porque
  // areasDisponibles/empresas todavía estaba vacío), los resincroniza sin
  // esperar una interacción del usuario.
  useEffect(() => {
    if ((tab === null || !areasDisponibles.includes(tab)) && areasDisponibles.length > 0) {
      setTab(areasDisponibles[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [areasDisponibles.join(',')]);

  useEffect(() => {
    if (empresaId !== null && !empresas.some(e => e.id === empresaId)) {
      setEmpresaId(empresas[0]?.id ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresas.map(e => e.id).join(',')]);

  const { data: resumen = [], isLoading } = useResumenFinancieroMacro(mes, anio);

  const empresaActiva = empresaId ?? empresas[0]?.id ?? null;
  const entry = useMemo(
    () => resumen.find(r => r.empresa_id === empresaActiva),
    [resumen, empresaActiva],
  );

  if (!user) return null;

  return (
    <div className="space-y-4">
      {/* Selector de empresa */}
      {empresas.length > 1 && (
        <div className="flex gap-2">
          {empresas.map(e => (
            <button
              key={e.id}
              onClick={() => setEmpresaId(e.id)}
              className={cn(
                'px-3 py-1.5 text-sm rounded-md border transition-colors',
                empresaActiva === e.id
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border hover:bg-accent',
              )}
            >
              {e.nombre_corto ?? e.nombre}
            </button>
          ))}
        </div>
      )}

      {/* Tabs de área */}
      <div className="flex gap-1 border-b border-border">
        {areasDisponibles.map(a => (
          <button
            key={a}
            onClick={() => setTab(a)}
            className={cn(
              'px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              tab === a ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {TAB_LABEL[a]}
          </button>
        ))}
      </div>

      {areasDisponibles.length === 0 && (
        <p className="text-sm text-muted-foreground py-8 text-center">No tenés áreas habilitadas en la Macro. Pedile a un admin que te las configure.</p>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-16 text-sm text-muted-foreground gap-2">
          <Loader2 size={16} className="animate-spin" /> Cargando resumen…
        </div>
      )}

      {!isLoading && entry && tab === 'FINANZAS' && <FinanzasTab data={entry} mes={mes} anio={anio} onMesChange={(m, a) => { setMes(m); setAnio(a); }} />}
      {!isLoading && entry && tab === 'ADMIN'    && <AdminTab data={entry} />}
      {!isLoading && entry && tab === 'RRHH'     && <RRHHTab data={entry} empresaId={entry.empresa_id} />}
      {!isLoading && entry && tab === 'STOCK'    && <StockTab data={entry} />}

      {!isLoading && !entry && empresaActiva !== null && (
        <p className="text-sm text-muted-foreground py-8 text-center">Sin datos para esta empresa.</p>
      )}
    </div>
  );
}
