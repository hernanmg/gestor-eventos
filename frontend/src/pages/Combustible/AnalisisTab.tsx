import { useEffect, useMemo, useState } from 'react';
import {
  ComposedChart, Bar, Line, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, BarChart,
} from 'recharts';
import { useAnalisisAnualCombustible } from '@/hooks/useCombustible';
import { formatCurrency, formatLitros } from '@/lib/formatters';
import { PrintButton, PrintHeader } from '@/components/ui/PrintSection';
import { cn } from '@/lib/utils';
import type { AnalisisAnualCombustible } from '@/types';

const selectCls = 'border border-input rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring bg-white';
const AZUL = '#2563eb';
const NARANJA = '#f59e0b';
const GRIS_FORECAST = '#cbd5e1';
const PALETA = ['#2563eb', '#f59e0b', '#16a34a', '#dc2626', '#7c3aed', '#0891b2', '#db2777', '#65a30d'];
const MESES_CORTO = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

type Metrica = 'litros' | 'monto';

function formatValor(n: number, metrica: Metrica): string {
  return metrica === 'litros' ? `${formatLitros(n)} L` : formatCurrency(n);
}

// Sólo para ticks del eje: formatLitros fuerza 3 decimales (pensado para
// tablas/tooltips), lo que en el eje hace ver "14.000,000" y puede leerse
// a simple vista como catorce millones. Acá alcanza con el entero redondeado.
function formatEjeLitros(n: number): string {
  return `${Math.round(n).toLocaleString('es-AR')} L`;
}

function valorMes(m: { litros: number; monto: number }, metrica: Metrica): number {
  return metrica === 'litros' ? m.litros : m.monto;
}

function valorVehiculoMes(v: AnalisisAnualCombustible['por_vehiculo'][number], i: number, metrica: Metrica): number {
  return metrica === 'litros' ? (v.por_mes[i] ?? 0) : (v.por_mes_monto[i] ?? 0);
}

function totalAnualVehiculo(v: AnalisisAnualCombustible['por_vehiculo'][number], metrica: Metrica): number {
  return metrica === 'litros' ? v.total_anual : v.total_anual_monto;
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <p className="text-sm font-semibold mb-3">{title}</p>
      {children}
    </div>
  );
}

// Banner de aviso local (mismo patrón que EspaciosCompartidos/index.tsx —
// no hay un sistema de toast global en la app).
function useAvisoTemporal(): [string | null, (msg: string) => void] {
  const [aviso, setAviso] = useState<string | null>(null);
  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 3000);
    return () => clearTimeout(t);
  }, [aviso]);
  return [aviso, setAviso];
}

function AvisoBanner({ mensaje }: { mensaje: string | null }) {
  if (!mensaje) return null;
  return (
    <div className="fixed top-4 right-4 z-50 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 shadow-md">
      {mensaje}
    </div>
  );
}

function CheckboxChip({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
      <input type="checkbox" checked={checked} onChange={onChange} className="accent-primary" />
      {label}
    </label>
  );
}

// ── Gráfico principal: litros/$ por mes (barras) + % variación (línea) ───────

function TooltipAnual({ active, payload, label, metrica }: any) {
  if (!active || !payload?.length) return null;
  const punto = payload[0]?.payload;
  return (
    <div className="rounded border bg-white px-3 py-2 text-xs shadow-md space-y-1">
      <p className="font-medium">{label}</p>
      {punto?.valor != null && <p>{metrica === 'litros' ? 'Litros' : 'Monto'}: {formatValor(punto.valor, metrica)}</p>}
      {punto?.valor_proyectado != null && <p>Proyectado: {formatValor(punto.valor_proyectado, metrica)}</p>}
      {/* Sin mes anterior válido → variacion_pct viene null del backend; se
          omite el campo en vez de mostrar un -100% falso (pedido explícito). */}
      {punto?.variacion_pct != null && <p>% variación: {punto.variacion_pct}%</p>}
    </div>
  );
}

function GraficoAnual({ anio, metrica }: { anio: number; metrica: Metrica }) {
  const { data, isLoading } = useAnalisisAnualCombustible(anio);
  if (isLoading || !data) return <p className="text-sm text-muted-foreground">Cargando...</p>;

  const chartData = data.por_mes.map(m => {
    const forecast = data.forecast.find(f => f.mes === m.mes);
    const valor = valorMes(m, metrica);
    const valorProyectado = forecast ? (metrica === 'litros' ? forecast.litros_proyectados : forecast.monto_proyectado) : null;
    return {
      label: m.label,
      valor: valor > 0 ? valor : null,
      valor_proyectado: valorProyectado,
      variacion_pct: m.variacion_pct,
      esForecast: valor === 0 && !!forecast,
    };
  });

  // Dominio dinámico del eje de variación, ignorando los meses sin dato
  // (variacion_pct null) — nunca debajo de 0 ni por encima de 25 salvo que
  // haya datos reales que lo justifiquen. Se redondea hacia afuera a
  // múltiplos de 25 y se generan las marcas explícitamente: si no, Recharts
  // reparte automáticamente el eje en 5 puntos entre el mínimo y el máximo
  // reales (p.ej. -56,35 y 74,37), y esos puntos intermedios (p.ej. -21,35)
  // son sólo escala — no el valor de ningún mes — pero a simple vista son
  // indistinguibles de un dato real y se prestan a confusión.
  const PASO_VARIACION = 25;
  const variacionesReales = chartData.map(d => d.variacion_pct).filter((v): v is number => v != null);
  const minVariacion = Math.floor(Math.min(0, ...variacionesReales) / PASO_VARIACION) * PASO_VARIACION;
  const maxVariacion = Math.ceil(Math.max(PASO_VARIACION, ...variacionesReales) / PASO_VARIACION) * PASO_VARIACION;
  const domainVariacion: [number, number] = [minVariacion, maxVariacion];
  const ticksVariacion: number[] = [];
  for (let t = minVariacion; t <= maxVariacion; t += PASO_VARIACION) ticksVariacion.push(t);

  const titulo = metrica === 'litros' ? `CONSUMO DE LITROS ANUAL ${anio}` : `GASTO EN PESOS ANUAL ${anio}`;

  return (
    <Card title={titulo}>
      <ResponsiveContainer width="100%" height={340}>
        <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis
            yAxisId="valor" tick={{ fontSize: 11 }}
            tickFormatter={v => metrica === 'litros' ? formatEjeLitros(v) : formatCurrency(v)}
            label={{ value: metrica === 'litros' ? 'Litros' : '$', angle: -90, position: 'insideLeft', fontSize: 11 }}
          />
          <YAxis yAxisId="variacion" orientation="right" domain={domainVariacion} ticks={ticksVariacion} tick={{ fontSize: 11 }} label={{ value: '% variación', angle: 90, position: 'insideRight', fontSize: 11 }} />
          <Tooltip content={<TooltipAnual metrica={metrica} />} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar yAxisId="valor" dataKey="valor" name={metrica === 'litros' ? 'Litros' : 'Monto'} fill={AZUL} radius={[3, 3, 0, 0]}>
            {chartData.map((d, i) => <Cell key={i} fill={d.esForecast ? GRIS_FORECAST : AZUL} />)}
          </Bar>
          <Bar yAxisId="valor" dataKey="valor_proyectado" name="Proyectado" fill={GRIS_FORECAST} radius={[3, 3, 0, 0]} fillOpacity={0.7} />
          <Line yAxisId="variacion" type="monotone" dataKey="variacion_pct" name="% variación" stroke={NARANJA} strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 text-sm">
        <p>Total litros: <span className="font-semibold">{formatLitros(data.total_litros_anual)} L</span></p>
        <p>Total monto: <span className="font-semibold">{formatCurrency(data.total_monto_anual)}</span></p>
      </div>
    </Card>
  );
}

// ── Comparativa entre años — checkboxes de años y vehículos ───────────────────

function ComparativaAnios({ anioBase, metrica }: { anioBase: number; metrica: Metrica }) {
  const aniosCandidatos = [anioBase - 3, anioBase - 2, anioBase - 1, anioBase];
  const queries = [
    useAnalisisAnualCombustible(aniosCandidatos[0]),
    useAnalisisAnualCombustible(aniosCandidatos[1]),
    useAnalisisAnualCombustible(aniosCandidatos[2]),
    useAnalisisAnualCombustible(aniosCandidatos[3]),
  ];

  // Por default, los últimos 3 de los 4 años candidatos marcados.
  const [aniosMarcados, setAniosMarcados] = useState<Set<number>>(new Set([aniosCandidatos[1], aniosCandidatos[2], aniosCandidatos[3]]));
  const [todosVehiculos, setTodosVehiculos] = useState(true);
  const [vehiculosMarcados, setVehiculosMarcados] = useState<Set<number>>(new Set());
  const [escalaLog, setEscalaLog] = useState(false);

  // Si cambia el año base (selector de arriba), reinicia la selección a los
  // últimos 3 de los nuevos candidatos — evita quedar con años marcados que
  // ya no aparecen en la lista.
  useEffect(() => {
    setAniosMarcados(new Set([aniosCandidatos[1], aniosCandidatos[2], aniosCandidatos[3]]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anioBase]);

  const datosPorAnio = queries.map(q => q.data);

  const vehiculosDisponibles = useMemo(() => {
    const map = new Map<number, string>();
    for (const d of datosPorAnio) d?.por_vehiculo.forEach(v => map.set(v.camion_id, v.codigo));
    return [...map.entries()];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, datosPorAnio);

  const toggleAnio = (anio: number) => {
    setAniosMarcados(prev => {
      const next = new Set(prev);
      next.has(anio) ? next.delete(anio) : next.add(anio);
      return next;
    });
  };

  const toggleVehiculo = (id: number) => {
    setVehiculosMarcados(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const chartData = useMemo(() => {
    return MESES_CORTO.map((label, i) => {
      const row: Record<string, string | number | null> = { label };
      aniosCandidatos.forEach((anio, idx) => {
        const q = datosPorAnio[idx];
        if (!aniosMarcados.has(anio) || !q) return;
        if (todosVehiculos) {
          row[String(anio)] = valorMes(q.por_mes[i] ?? { litros: 0, monto: 0 }, metrica);
        } else {
          for (const vid of vehiculosMarcados) {
            const v = q.por_vehiculo.find(v => v.camion_id === vid);
            row[`${anio}-${vid}`] = v ? valorVehiculoMes(v, i, metrica) : 0;
          }
        }
      });
      return row;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aniosMarcados, todosVehiculos, vehiculosMarcados, metrica, ...datosPorAnio]);

  const lineKeys = useMemo(() => {
    if (todosVehiculos) {
      return aniosCandidatos.filter(a => aniosMarcados.has(a)).map(a => ({ key: String(a), label: String(a) }));
    }
    const keys: { key: string; label: string }[] = [];
    for (const anio of aniosCandidatos) {
      if (!aniosMarcados.has(anio)) continue;
      for (const vid of vehiculosMarcados) {
        const codigo = vehiculosDisponibles.find(([id]) => id === vid)?.[1] ?? vid;
        keys.push({ key: `${anio}-${vid}`, label: `${anio} - ${codigo}` });
      }
    }
    return keys;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aniosMarcados, todosVehiculos, vehiculosMarcados, vehiculosDisponibles]);

  // Unidad del eje Y — sólo relevante para litros (L / kL); en pesos se usa
  // siempre formatCurrency, que ya abrevia con separador de miles.
  const valoresPlaneados = chartData
    .flatMap(row => lineKeys.map(lk => row[lk.key]))
    .filter((v): v is number => typeof v === 'number');
  const maxValor = valoresPlaneados.length ? Math.max(...valoresPlaneados) : 0;
  const usarKilo = metrica === 'litros' && maxValor > 1000;
  const tickFormatterEje = (v: number) => metrica === 'litros' ? (usarKilo ? `${(v / 1000).toFixed(1)}k` : `${v}`) : formatCurrency(v);
  const tooltipFormatter = (v: unknown) => metrica === 'litros' ? `${formatLitros(Number(v ?? 0))} L` : formatCurrency(Number(v ?? 0));

  return (
    <Card title="Comparativa entre años">
      <div className="space-y-3 mb-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1.5">Años a comparar:</p>
          <div className="flex flex-wrap gap-3">
            {aniosCandidatos.map(a => (
              <CheckboxChip key={a} checked={aniosMarcados.has(a)} onChange={() => toggleAnio(a)} label={String(a)} />
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1.5">Vehículos a comparar:</p>
          <div className="flex flex-wrap gap-3">
            <CheckboxChip checked={todosVehiculos} onChange={() => setTodosVehiculos(v => !v)} label="Todos" />
            {!todosVehiculos && vehiculosDisponibles.map(([id, codigo]) => (
              <CheckboxChip key={id} checked={vehiculosMarcados.has(id)} onChange={() => toggleVehiculo(id)} label={codigo} />
            ))}
          </div>
        </div>
        <CheckboxChip checked={escalaLog} onChange={() => setEscalaLog(v => !v)} label="Escala logarítmica" />
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis
            tick={{ fontSize: 11 }} tickFormatter={tickFormatterEje}
            scale={escalaLog ? 'log' : 'linear'} domain={escalaLog ? [1, 'auto'] : [0, 'auto']} allowDataOverflow
          />
          <Tooltip formatter={tooltipFormatter} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {lineKeys.map((lk, i) => (
            <Line key={lk.key} type="monotone" dataKey={lk.key} name={lk.label} stroke={PALETA[i % PALETA.length]} strokeWidth={2} dot={{ r: 2 }} connectNulls />
          ))}
        </LineChart>
      </ResponsiveContainer>
      {metrica === 'litros' && <p className="text-xs text-muted-foreground mt-2">Unidad: litros{usarKilo ? ' (eje en miles — kL)' : ''}</p>}
    </Card>
  );
}

// ── Comparativa entre vehículos — checkboxes, máximo 8 ────────────────────────

function ComparativaVehiculos({ anio, metrica }: { anio: number; metrica: Metrica }) {
  const { data, isLoading } = useAnalisisAnualCombustible(anio);
  const [seleccionados, setSeleccionados] = useState<Set<number>>(new Set());
  const [aviso, setAviso] = useAvisoTemporal();

  const ordenados = useMemo(
    () => data ? [...data.por_vehiculo].sort((a, b) => totalAnualVehiculo(b, metrica) - totalAnualVehiculo(a, metrica)) : [],
    [data, metrica],
  );

  // Al cambiar de año (o cargar por primera vez), reinicia la selección a
  // el top 6 de ese año — la lista de vehículos disponibles puede variar.
  useEffect(() => {
    if (ordenados.length === 0) return;
    setSeleccionados(new Set(ordenados.slice(0, 6).map(v => v.camion_id)));
  }, [anio, ordenados.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (id: number) => {
    setSeleccionados(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); return next; }
      if (next.size >= 8) { setAviso('Máximo 8 vehículos para comparar'); return prev; }
      next.add(id);
      return next;
    });
  };

  if (isLoading || !data) return <p className="text-sm text-muted-foreground">Cargando...</p>;

  const elegidos = ordenados.filter(v => seleccionados.has(v.camion_id));
  const chartData = MESES_CORTO.map((label, i) => {
    const row: Record<string, string | number> = { label };
    elegidos.forEach(v => { row[v.codigo] = valorVehiculoMes(v, i, metrica); });
    return row;
  });
  const tooltipFormatter = (v: unknown) => metrica === 'litros' ? `${formatLitros(Number(v ?? 0))} L` : formatCurrency(Number(v ?? 0));

  return (
    <Card title={`Comparativa entre vehículos — ${anio}`}>
      <AvisoBanner mensaje={aviso} />
      <div className="mb-2">
        <div className="flex flex-wrap gap-3 mb-2">
          {ordenados.map(v => (
            <CheckboxChip key={v.camion_id} checked={seleccionados.has(v.camion_id)} onChange={() => toggle(v.camion_id)} label={v.codigo} />
          ))}
        </div>
        <span className="inline-block rounded-full bg-blue-50 text-blue-700 text-xs px-2.5 py-1">
          Mostrando {elegidos.length} de {ordenados.length} vehículos — podés cambiar la selección arriba
        </span>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={v => metrica === 'litros' ? formatEjeLitros(v) : formatCurrency(v)} />
          <Tooltip formatter={tooltipFormatter} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {elegidos.map((v, i) => (
            <Bar key={v.camion_id} dataKey={v.codigo} name={v.codigo} fill={PALETA[i % PALETA.length]} radius={[3, 3, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}

// ── Tab principal ─────────────────────────────────────────────────────────────

export default function AnalisisTab() {
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [metrica, setMetrica] = useState<Metrica>('litros');
  const anioActual = new Date().getFullYear();
  const opciones = [anioActual + 1, anioActual, anioActual - 1, anioActual - 2, anioActual - 3];

  return (
    <div className="space-y-4">
      <PrintHeader titulo={`Combustible — Análisis anual (${metrica === 'litros' ? 'Litros' : 'Pesos'})`} periodo={String(anio)} />

      <div className="no-print flex items-center justify-between gap-2">
        <div className="flex border-b border-border">
          {([
            { key: 'litros', label: '📊 Litros' },
            { key: 'monto',  label: '💰 Pesos' },
          ] as { key: Metrica; label: string }[]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setMetrica(key)}
              className={cn(
                'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                metrica === key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <select value={anio} onChange={e => setAnio(Number(e.target.value))} className={selectCls}>
            {opciones.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <PrintButton />
        </div>
      </div>

      <GraficoAnual anio={anio} metrica={metrica} />
      <ComparativaAnios anioBase={anio} metrica={metrica} />
      <ComparativaVehiculos anio={anio} metrica={metrica} />
    </div>
  );
}
