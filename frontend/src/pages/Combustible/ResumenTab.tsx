import { useMemo, useState } from 'react';
import { Truck, ChevronLeft, ChevronRight } from 'lucide-react';
import { useResumenMensualCombustible, useResumenSemanalCombustible } from '@/hooks/useCombustible';
import { formatCurrency, formatLitros } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { PrintButton, PrintHeader } from '@/components/ui/PrintSection';
import BaseTable from '@/components/ui/BaseTable';

const selectCls = 'border border-input rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring bg-white';

type SubTab = 'semana' | 'mes' | 'vehiculo';

// Semanas reales de la planilla de Santi — corte en sábado, cantidad variable
// por mes (4 o 5). Mismo criterio que el backend (ver
// combustible.controller.ts::getSemanasCombustible), verificado contra
// JUNIO/JULIO/AGOSTO.2026 reales. Sólo hace falta la cantidad de semanas acá
// (para la navegación ← →); el rango de fechas de la semana actual se muestra
// con el label que ya devuelve /resumen-semanal.
function diasEnMes(anio: number, mesUno: number): number {
  return new Date(Date.UTC(anio, mesUno, 0)).getUTCDate();
}

function cantidadSemanas(anio: number, mesUno: number): number {
  const finMes = new Date(Date.UTC(anio, mesUno - 1, diasEnMes(anio, mesUno)));
  const cortes: { desde: Date; hasta: Date }[] = [];
  let inicio = new Date(Date.UTC(anio, mesUno - 1, 1));
  while (inicio.getTime() <= finMes.getTime()) {
    let fin = new Date(inicio.getTime() + 86_400_000);
    while (fin.getUTCDay() !== 6 && fin.getTime() < finMes.getTime()) {
      fin = new Date(fin.getTime() + 86_400_000);
    }
    if (fin.getTime() > finMes.getTime()) fin = finMes;
    cortes.push({ desde: inicio, hasta: fin });
    inicio = new Date(fin.getTime() + 86_400_000);
  }
  if (cortes.length > 1) {
    const ultimo = cortes[cortes.length - 1];
    const dias = Math.round((ultimo.hasta.getTime() - ultimo.desde.getTime()) / 86_400_000) + 1;
    if (dias < 4) cortes.pop();
  }
  return cortes.length;
}

// ── Tabla genérica RESUMEN | CONSUMO | LTS (igual a la planilla de Santi) ─────

function TablaResumenConsumo({ filas, totalLabel, total }: {
  filas: { key: string; nombre: string; litros: number }[];
  totalLabel: string;
  total: number;
}) {
  return (
    <div className="overflow-x-auto">
      <BaseTable className="w-full text-sm">
        <thead className="border-b bg-muted/30">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">RESUMEN</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">CONSUMO</th>
            <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">LTS</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {filas.map(f => (
            <tr key={f.key} className="hover:bg-muted/20">
              <td className="px-3 py-2 font-mono font-medium">{f.nombre}</td>
              <td className="px-3 py-2 text-muted-foreground">COMBUSTIBLE</td>
              <td className="px-3 py-2 text-right">{formatLitros(f.litros)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t bg-muted/40 font-bold">
            <td className="px-3 py-2" colSpan={2}>{totalLabel}</td>
            <td className="px-3 py-2 text-right">{formatLitros(total)}</td>
          </tr>
        </tfoot>
      </BaseTable>
    </div>
  );
}

// ── Por semana — navegable con flechas ← Semana 1/2/3/4 → ─────────────────────

interface PeriodoState { anio: number; mes: number; numero: number }

function periodoDeHoy(): PeriodoState {
  const hoy = new Date();
  const anio = hoy.getUTCFullYear();
  const mes  = hoy.getUTCMonth() + 1;
  const dia  = hoy.getUTCDate();
  // Recalcula localmente en qué semana real cae hoy (mismo algoritmo que el
  // backend) — sólo se necesita para el numero inicial al abrir la pantalla.
  const finMes = new Date(Date.UTC(anio, mes - 1, diasEnMes(anio, mes)));
  let numero = 1;
  let inicio = new Date(Date.UTC(anio, mes - 1, 1));
  while (inicio.getTime() <= finMes.getTime()) {
    let fin = new Date(inicio.getTime() + 86_400_000);
    while (fin.getUTCDay() !== 6 && fin.getTime() < finMes.getTime()) fin = new Date(fin.getTime() + 86_400_000);
    if (fin.getTime() > finMes.getTime()) fin = finMes;
    if (dia >= inicio.getUTCDate() && dia <= fin.getUTCDate()) break;
    inicio = new Date(fin.getTime() + 86_400_000);
    numero++;
  }
  // El último bloque corto (< 4 días) se funde con el anterior — mismo
  // ajuste que getSemanasCombustible; acá alcanza con no pasarnos del total.
  const total = cantidadSemanas(anio, mes);
  return { anio, mes, numero: Math.min(numero, total) };
}

function periodoSiguiente(p: PeriodoState): PeriodoState {
  if (p.numero < cantidadSemanas(p.anio, p.mes)) return { ...p, numero: p.numero + 1 };
  const mes = p.mes === 12 ? 1 : p.mes + 1;
  const anio = p.mes === 12 ? p.anio + 1 : p.anio;
  return { anio, mes, numero: 1 };
}

function periodoPrevioNav(p: PeriodoState): PeriodoState {
  if (p.numero > 1) return { ...p, numero: p.numero - 1 };
  const mes = p.mes === 1 ? 12 : p.mes - 1;
  const anio = p.mes === 1 ? p.anio - 1 : p.anio;
  return { anio, mes, numero: cantidadSemanas(anio, mes) };
}

function PorSemana() {
  const [periodo, setPeriodo] = useState<PeriodoState>(periodoDeHoy);
  const { data: semanas = [], isLoading } = useResumenSemanalCombustible(periodo.mes, periodo.anio);

  const semana = semanas.find(s => s.numero === periodo.numero);
  const esActual = JSON.stringify(periodo) === JSON.stringify(periodoDeHoy());

  const filas = (semana?.por_vehiculo ?? []).map(v => ({ key: String(v.camion_id), nombre: v.patente ?? v.codigo, litros: v.litros }));

  const periodoTexto = semana?.label ?? `Semana ${periodo.numero}`;

  return (
    <div className="space-y-3">
      <PrintHeader titulo="Combustible — Resumen semanal" periodo={periodoTexto} />

      <div className="no-print flex items-center justify-between gap-3">
        <div className="flex items-center justify-center gap-3 mx-auto">
          <button onClick={() => setPeriodo(periodoPrevioNav)} className="p-1.5 rounded hover:bg-muted" title="Semana anterior">
            <ChevronLeft size={16} />
          </button>
          <p className="text-sm font-medium min-w-[260px] text-center">
            {periodoTexto}{esActual && <span className="text-xs text-muted-foreground"> (actual)</span>}
          </p>
          <button onClick={() => setPeriodo(periodoSiguiente)} className="p-1.5 rounded hover:bg-muted" title="Semana siguiente">
            <ChevronRight size={16} />
          </button>
        </div>
        <PrintButton />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : filas.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Sin cargas en esta semana.</p>
      ) : (
        <TablaResumenConsumo filas={filas} totalLabel="LITROS SEMANAL" total={semana?.total_litros ?? 0} />
      )}
    </div>
  );
}

// ── Por mes — mismo formato, acumulado del mes ────────────────────────────────

function PorMes({ mes, anio }: { mes: number; anio: number }) {
  const { data: resumen = [], isLoading } = useResumenMensualCombustible(mes, anio);

  const filas = useMemo(
    () => resumen.map(r => ({ key: String(r.camion_id), nombre: r.camion_patente ?? r.camion_codigo, litros: r.total_litros })),
    [resumen],
  );
  const totalMes = filas.reduce((s, f) => s + f.litros, 0);

  const periodoTexto = `${String(mes).padStart(2, '0')}/${anio}`;

  return (
    <div className="space-y-3">
      <PrintHeader titulo="Combustible — Resumen mensual" periodo={periodoTexto} />
      <div className="no-print flex justify-end">
        <PrintButton />
      </div>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : filas.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Sin cargas en este período.</p>
      ) : (
        <TablaResumenConsumo filas={filas} totalLabel="LITROS MES" total={totalMes} />
      )}
    </div>
  );
}

// ── Por vehículo — cards con detalle (bonus, no reemplaza lo pedido) ──────────

function PorVehiculo({ mes, anio }: { mes: number; anio: number }) {
  const { data: resumen = [], isLoading } = useResumenMensualCombustible(mes, anio);

  if (isLoading) return <p className="text-sm text-muted-foreground">Cargando...</p>;
  if (resumen.length === 0) return <p className="text-sm text-muted-foreground py-8 text-center">Sin cargas en este período.</p>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {resumen.map(r => (
        <div key={r.camion_id} className="rounded-xl border bg-white p-4 shadow-sm space-y-1.5">
          <p className="font-semibold flex items-center gap-1.5"><Truck size={16} /> {r.camion_patente ?? r.camion_codigo}</p>
          <p className="text-sm text-muted-foreground">Litros: <span className="font-medium text-foreground">{formatLitros(r.total_litros)} L</span></p>
          <p className="text-sm text-muted-foreground">Monto: <span className="font-medium text-foreground">{formatCurrency(r.total_monto)}</span></p>
          {r.rendimiento_promedio != null && (
            <p className="text-sm text-muted-foreground">Rendimiento: <span className="font-medium text-foreground">{r.rendimiento_promedio} km/L</span></p>
          )}
          {r.por_evento.length > 0 && (
            <p className="text-xs text-muted-foreground pt-1">
              Eventos: {r.por_evento.map(e => `${e.evento_nombre} (${formatLitros(e.litros)}L)`).join(', ')}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

export default function ResumenTab() {
  const hoy = new Date();
  const [mes, setMes] = useState(hoy.getMonth() + 1);
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [subTab, setSubTab] = useState<SubTab>('semana');

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <div className="flex border-b border-border">
          {([
            { key: 'semana',   label: 'Por semana' },
            { key: 'mes',      label: 'Por mes' },
            { key: 'vehiculo', label: 'Por vehículo' },
          ] as { key: SubTab; label: string }[]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setSubTab(key)}
              className={cn(
                'px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                subTab === key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {subTab !== 'semana' && (
          <input
            type="month"
            value={`${anio}-${String(mes).padStart(2, '0')}`}
            onChange={e => {
              const [a, m] = e.target.value.split('-').map(Number);
              setAnio(a); setMes(m);
            }}
            className={selectCls}
          />
        )}
      </div>

      {subTab === 'semana'   && <PorSemana />}
      {subTab === 'mes'      && <PorMes mes={mes} anio={anio} />}
      {subTab === 'vehiculo' && <PorVehiculo mes={mes} anio={anio} />}
    </div>
  );
}
