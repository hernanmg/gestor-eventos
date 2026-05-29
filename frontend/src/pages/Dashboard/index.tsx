import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell,
} from 'recharts';
import {
  AlertTriangle, AlertCircle, Info, CheckCircle2, ChevronDown, ChevronRight, Loader2,
} from 'lucide-react';
import {
  useResumenDashboard, useKPIsEvento, useAlertasDashboard,
  type ResumenDashboard, type KPIsEvento, type Alerta, type PorMonedaKPI,
} from '@/hooks/useDashboard';
import { useEventos } from '@/hooks/useEvento';
import { EstadoBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { Moneda } from '@/types';

// ── Palette ───────────────────────────────────────────────────────────────────

const PIE_COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6'];

// ── Small helpers ─────────────────────────────────────────────────────────────

function Card({ title, className, children }: { title?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('rounded-xl border border-border bg-white p-4 shadow-sm', className)}>
      {title && <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">{title}</p>}
      {children}
    </div>
  );
}

function BigNumber({ value, colored = false, moneda }: { value: number; colored?: boolean; moneda?: Moneda }) {
  const cls = colored
    ? value < 0 ? 'text-destructive' : value > 0 ? 'text-green-600' : 'text-foreground'
    : 'text-foreground';
  return (
    <span className={cn('text-2xl font-bold tabular-nums', cls)}>
      {moneda ? formatCurrency(value, moneda) : value.toLocaleString('es-AR')}
    </span>
  );
}

// ── Row 1: Metric Cards ───────────────────────────────────────────────────────

function MetricsRow({ data }: { data: ResumenDashboard }) {
  const arsData = data.por_moneda.find(p => p.moneda === 'ARS');
  const usdData = data.por_moneda.find(p => p.moneda === 'USD');
  const hasUSD  = usdData !== undefined;

  return (
    <div className={cn('grid gap-4 grid-cols-2', hasUSD ? 'md:grid-cols-4' : 'md:grid-cols-3')}>
      {/* Eventos activos */}
      <Card title="Eventos">
        <BigNumber value={data.eventos.activos} />
        <p className="text-xs text-muted-foreground mt-1">activos</p>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          <span>{data.eventos.cerrados} cerrados</span>
          <span>{data.eventos.importados} importados</span>
          <span>{data.eventos.total} total</span>
        </div>
      </Card>

      {/* Saldo neto ARS */}
      <Card title="Saldo neto ARS">
        <BigNumber value={arsData?.saldo_neto ?? 0} colored moneda="ARS" />
        {arsData && (
          <div className="mt-1 flex flex-col gap-0.5 text-xs text-muted-foreground">
            <span>Ingresos: {formatCurrency(arsData.total_ingresos, 'ARS')}</span>
            <span>Egresos: {formatCurrency(arsData.total_egresos, 'ARS')}</span>
          </div>
        )}
      </Card>

      {/* Saldo neto USD (only when present) */}
      {hasUSD && (
        <Card title="Saldo neto USD">
          <BigNumber value={usdData!.saldo_neto} colored moneda="USD" />
          <div className="mt-1 flex flex-col gap-0.5 text-xs text-muted-foreground">
            <span>Ingresos: {formatCurrency(usdData!.total_ingresos, 'USD')}</span>
            <span>Egresos: {formatCurrency(usdData!.total_egresos, 'USD')}</span>
          </div>
        </Card>
      )}

      {/* Echeqs expuestos */}
      <Card title="Echeqs expuestos" className={data.echeqs.vencidos > 0 ? 'border-destructive/40' : ''}>
        <div className="flex items-center gap-2">
          <BigNumber value={data.echeqs.pendientes} />
          {data.echeqs.vencidos > 0 && (
            <span className="text-xs font-medium text-destructive bg-destructive/10 rounded-full px-1.5 py-0.5">
              {data.echeqs.vencidos} vencido{data.echeqs.vencidos !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1">pendientes</p>
        <div className="mt-1 flex flex-col gap-0.5 text-xs text-muted-foreground">
          {data.echeqs.total_expuesto_ars > 0 && <span>ARS {formatCurrency(data.echeqs.total_expuesto_ars, 'ARS')}</span>}
          {data.echeqs.total_expuesto_usd > 0 && <span>USD {formatCurrency(data.echeqs.total_expuesto_usd, 'USD')}</span>}
          {data.echeqs.proximos_a_vencer > 0 && (
            <span className="text-amber-600">{data.echeqs.proximos_a_vencer} vence{data.echeqs.proximos_a_vencer === 1 ? '' : 'n'} en 7 días</span>
          )}
        </div>
      </Card>
    </div>
  );
}

// ── Row 2: Alerts Panel ───────────────────────────────────────────────────────

const SEV_CONFIG = {
  ERROR:   { icon: AlertCircle,   bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-800',    label: 'Error' },
  WARNING: { icon: AlertTriangle, bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-800',  label: 'Advertencia' },
  INFO:    { icon: Info,          bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-800',   label: 'Info' },
};

function AlertsPanel({ alertas }: { alertas: Alerta[] }) {
  const [showAll, setShowAll] = useState(false);
  const navigate = useNavigate();

  if (alertas.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
        <CheckCircle2 size={16} className="shrink-0" />
        <span className="font-medium">Sin alertas activas</span>
      </div>
    );
  }

  const visible = showAll ? alertas : alertas.slice(0, 5);

  return (
    <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-gray-50 flex items-center justify-between">
        <span className="text-sm font-semibold">Alertas ({alertas.length})</span>
      </div>
      <ul className="divide-y divide-border">
        {visible.map((a, i) => {
          const cfg  = SEV_CONFIG[a.severidad];
          const Icon = cfg.icon;
          return (
            <li key={i} className={cn('flex items-start gap-3 px-4 py-3', cfg.bg)}>
              <Icon size={15} className={cn('shrink-0 mt-0.5', cfg.text)} />
              <div className="flex-1 min-w-0">
                <p className={cn('text-xs font-semibold uppercase', cfg.text)}>{cfg.label}</p>
                <p className="text-sm text-foreground mt-0.5">{a.mensaje}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{a.evento_nombre}</p>
              </div>
              {(a.tipo === 'ECHEQ_VENCIDO' || a.tipo === 'ECHEQ_POR_VENCER') && (
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 h-7 text-xs"
                  onClick={() => navigate(`/eventos/${a.evento_id}`)}
                >
                  Ver echeq
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      {alertas.length > 5 && (
        <button
          onClick={() => setShowAll(v => !v)}
          className="w-full py-2 text-xs text-muted-foreground hover:bg-gray-50 transition-colors flex items-center justify-center gap-1"
        >
          {showAll ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          {showAll ? 'Ver menos' : `Ver todas (${alertas.length - 5} más)`}
        </button>
      )}
    </div>
  );
}

// ── Row 3: Recent Events ──────────────────────────────────────────────────────

function RecentEventsTable({ data }: { data: ResumenDashboard }) {
  const navigate = useNavigate();
  return (
    <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-gray-50 flex items-center justify-between">
        <span className="text-sm font-semibold">Actividad reciente</span>
        <Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate('/eventos')}>
          Ver todos los eventos
        </Button>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Nombre</th>
            <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground hidden sm:table-cell">Estado</th>
            <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground hidden sm:table-cell">Moneda</th>
            <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Última actividad</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {data.eventos_recientes.map(e => (
            <tr
              key={e.id}
              onClick={() => navigate(`/eventos/${e.id}`)}
              className="hover:bg-gray-50 cursor-pointer transition-colors"
            >
              <td className="px-4 py-2.5 font-medium">{e.nombre}</td>
              <td className="px-4 py-2.5 hidden sm:table-cell">
                <EstadoBadge estado={e.estado as any} />
              </td>
              <td className="px-4 py-2.5 text-muted-foreground hidden sm:table-cell">{e.moneda_base}</td>
              <td className="px-4 py-2.5 text-muted-foreground">{formatDate(e.updated_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Row 4: Event KPI Charts ───────────────────────────────────────────────────

const numFmt = (v: number) =>
  new Intl.NumberFormat('es-AR', { notation: 'compact', maximumFractionDigits: 1 }).format(v);

function TabsBarChart({ pm }: { pm: PorMonedaKPI }) {
  const moneda = pm.moneda as Moneda;
  const data = [
    ...pm.ingresos_por_tab.map(t => ({ nombre: t.nombre, Ingresos: t.saldo, Egresos: 0 })),
    ...pm.egresos_por_tab.map(t => ({ nombre: t.nombre, Ingresos: 0, Egresos: t.saldo })),
  ];
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 60 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="nombre" angle={-40} textAnchor="end" tick={{ fontSize: 10 }} interval={0} />
        <YAxis tickFormatter={numFmt} tick={{ fontSize: 10 }} width={55} />
        <Tooltip formatter={(v: any) => formatCurrency(v, moneda)} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="Ingresos" fill="#22c55e" radius={[2, 2, 0, 0]} />
        <Bar dataKey="Egresos"  fill="#ef4444" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function EvolucionLineChart({ porMoneda }: { porMoneda: PorMonedaKPI[] }) {
  const allDates = new Set<string>();
  porMoneda.forEach(pm => pm.evolucion_saldo.forEach(p => allDates.add(p.fecha)));

  if (allDates.size === 0) {
    return (
      <div className="flex items-center justify-center h-[260px] text-sm text-muted-foreground">
        Sin datos de evolución temporal
      </div>
    );
  }

  const lineData = [...allDates].sort().map(fecha => {
    const point: Record<string, string | number | null> = { fecha };
    for (const pm of porMoneda) {
      const entry = pm.evolucion_saldo.find(p => p.fecha === fecha);
      point[pm.moneda] = entry?.saldo_acumulado ?? null;
    }
    return point;
  });

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={lineData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="fecha" tick={{ fontSize: 10 }} />
        <YAxis tickFormatter={numFmt} tick={{ fontSize: 10 }} width={55} />
        <Tooltip
          formatter={(v: any, name: any) =>
            [formatCurrency(v, name as Moneda), name]
          }
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {porMoneda.map(pm => (
          <Line
            key={pm.moneda}
            type="monotone"
            dataKey={pm.moneda}
            stroke={pm.moneda === 'ARS' ? '#22c55e' : '#3b82f6'}
            dot={false}
            connectNulls
            strokeWidth={2}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

function SociosPieChart({ kpis }: { kpis: KPIsEvento }) {
  const monedaBase = kpis.evento.moneda_base as Moneda;
  const pm = kpis.por_moneda.find(p => p.moneda === monedaBase) ?? kpis.por_moneda[0];
  const socios = kpis.evento.socios;

  if (!pm || socios.length === 0) return null;

  const pieData = socios.map(s => ({
    nombre:     s.nombre,
    porcentaje: s.porcentaje,
    monto:      parseFloat((pm.saldo_final * s.porcentaje / 100).toFixed(2)),
  }));

  return (
    <div className="rounded-xl border border-border bg-white shadow-sm p-4">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
        Distribución de socios — {monedaBase}
      </p>
      <div className="h-48 md:h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={pieData}
              dataKey="porcentaje"
              nameKey="nombre"
              cx="50%"
              cy="50%"
              outerRadius="70%"
              label={({ nombre, porcentaje }: any) => `${nombre} ${porcentaje}%`}
              labelLine={false}
            >
              {pieData.map((_, i) => (
                <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(v: any, _: any, props: any) => [
                `${v}% — ${formatCurrency(props.payload.monto, monedaBase)}`,
                props.payload.nombre,
              ]}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function EventKPIDetail({ kpis }: { kpis: KPIsEvento }) {
  const [selectedMoneda, setSelectedMoneda] = useState(kpis.por_moneda[0]?.moneda ?? '');
  const pm = kpis.por_moneda.find(p => p.moneda === selectedMoneda) ?? kpis.por_moneda[0];

  return (
    <div className="space-y-4">
      {/* Moneda selector (if multiple) */}
      {kpis.por_moneda.length > 1 && (
        <div className="flex gap-2">
          {kpis.por_moneda.map(p => (
            <button
              key={p.moneda}
              onClick={() => setSelectedMoneda(p.moneda)}
              className={cn(
                'px-3 py-1.5 text-sm rounded-md border transition-colors',
                selectedMoneda === p.moneda
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border hover:bg-accent',
              )}
            >
              {p.moneda}
            </button>
          ))}
        </div>
      )}

      {pm && (
        <>
          {/* Sub-fila A: KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card title={`Saldo final ${pm.moneda}`}>
              <BigNumber value={pm.saldo_final} colored moneda={pm.moneda as Moneda} />
            </Card>
            <Card title="Ingresos">
              <BigNumber value={pm.total_ingresos} moneda={pm.moneda as Moneda} />
              <p className="text-xs text-muted-foreground mt-1">{pm.ingresos_por_tab.filter(t => t.saldo > 0).length} tabs con saldo</p>
            </Card>
            <Card title="Egresos">
              <BigNumber value={pm.total_egresos} moneda={pm.moneda as Moneda} />
              <p className="text-xs text-muted-foreground mt-1">{pm.egresos_por_tab.filter(t => t.saldo > 0).length} tabs con saldo</p>
            </Card>
            <Card title="Echeqs pendientes">
              <BigNumber value={kpis.echeqs.pendientes} />
              <div className="mt-1 text-xs text-muted-foreground">
                {kpis.echeqs.total_expuesto_ars > 0 && <div>ARS {formatCurrency(kpis.echeqs.total_expuesto_ars, 'ARS')}</div>}
                {kpis.echeqs.total_expuesto_usd > 0 && <div>USD {formatCurrency(kpis.echeqs.total_expuesto_usd, 'USD')}</div>}
              </div>
            </Card>
          </div>

          {/* Sub-fila B: Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-border bg-white shadow-sm p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                Ingresos vs Egresos por pestaña — {pm.moneda}
              </p>
              <TabsBarChart pm={pm} />
            </div>
            <div className="rounded-xl border border-border bg-white shadow-sm p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                Evolución del saldo
              </p>
              <EvolucionLineChart porMoneda={kpis.por_moneda} />
            </div>
          </div>
        </>
      )}

      {/* Sub-fila C: Socios */}
      <SociosPieChart kpis={kpis} />
    </div>
  );
}

function EventKPISection({ eventosActivos }: { eventosActivos: { id: number; nombre: string }[] }) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const { data: kpis, isLoading }   = useKPIsEvento(selectedId);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-white shadow-sm p-4">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
          KPIs por evento
        </p>
        {eventosActivos.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay eventos activos.</p>
        ) : (
          <select
            value={selectedId ?? ''}
            onChange={e => setSelectedId(e.target.value ? Number(e.target.value) : null)}
            className="w-full max-w-sm border border-input rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">— Seleccionar evento —</option>
            {eventosActivos.map(e => (
              <option key={e.id} value={e.id}>{e.nombre}</option>
            ))}
          </select>
        )}
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12 text-sm text-muted-foreground gap-2">
          <Loader2 size={16} className="animate-spin" />
          Cargando KPIs...
        </div>
      )}

      {kpis && !isLoading && <EventKPIDetail kpis={kpis} />}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { data: resumen,  isLoading: loadingResumen }  = useResumenDashboard();
  const { data: alertas,  isLoading: loadingAlertas }  = useAlertasDashboard();
  const { data: eventos = [] }                         = useEventos();

  const eventosActivos = eventos.filter(e => e.estado === 'ACTIVO');

  if (loadingResumen || loadingAlertas) {
    return (
      <div className="flex items-center justify-center min-h-screen text-sm text-muted-foreground gap-2">
        <Loader2 size={16} className="animate-spin" />
        Cargando dashboard...
      </div>
    );
  }

  if (!resumen || !alertas) return null;

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-7xl mx-auto">
      <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>

      <MetricsRow data={resumen} />
      <AlertsPanel alertas={alertas.alertas} />
      <RecentEventsTable data={resumen} />
      <EventKPISection eventosActivos={eventosActivos} />
    </div>
  );
}
