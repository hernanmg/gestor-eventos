import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, CalendarDays, List } from 'lucide-react';
import { useCalendario, usePrefetchCalendario, TODOS_LOS_TIPOS } from '@/hooks/useCalendario';
import { useAuth } from '@/hooks/useAuth';
import { EMPRESAS } from '@/lib/empresasConstants';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { CalendarioItem, TipoCalendario } from '@/types';

// ── Constantes ────────────────────────────────────────────────────────────────
// Espejo de COLORES/TIPO_QUERY_MAP en backend/src/controllers/calendario.controller.ts

const TIPO_LABEL: Record<TipoCalendario, string> = {
  EVENTO:               'Eventos',
  FACTURA_VENCE:        'Facturas',
  ECHEQ_COBRO:          'Echeqs',
  JORNADA:              'Jornadas',
  PARTE_DIARIO:         'Partes',
  STOCK_RETORNO:        'Stock',
  LIQUIDACION:          'Liquidaciones',
  RENDICION_PENDIENTE:  'Rendiciones',
  SALDO_MINIMO:         'Saldo bajo',
  CTA_CORRIENTE_INACTIVA: 'Cuentas corrientes',
  SEGURO_VENCE:         'Seguros',
  PATENTE_VENCE:        'Patentes',
  TALLER_RETIRO:        'Taller',
};

const COLORES: Record<TipoCalendario, string> = {
  EVENTO:               '#1E3A5F',
  FACTURA_VENCE:        '#DC2626',
  ECHEQ_COBRO:          '#F59E0B',
  JORNADA:              '#065F46',
  PARTE_DIARIO:         '#4C1D95',
  STOCK_RETORNO:        '#92400E',
  LIQUIDACION:          '#374151',
  RENDICION_PENDIENTE:  '#7C3AED',
  SALDO_MINIMO:         '#DC2626',
  CTA_CORRIENTE_INACTIVA: '#F59E0B',
  SEGURO_VENCE:         '#F59E0B',
  PATENTE_VENCE:        '#F59E0B',
  TALLER_RETIRO:        '#4C1D95',
};

const DIAS_SEMANA = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'];
const MAX_DIAS_AGENDA = 89; // debajo del límite de 3 meses del backend

// ── Helpers de fecha ──────────────────────────────────────────────────────────

function pad(n: number): string { return String(n).padStart(2, '0'); }
function toDateStr(d: Date): string { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function startOfDay(d: Date): Date { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function firstOfMonth(d: Date): Date { return new Date(d.getFullYear(), d.getMonth(), 1); }
function lastOfMonth(d: Date): Date { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }
function addMonths(d: Date, n: number): Date { return new Date(d.getFullYear(), d.getMonth() + n, 1); }
function addDays(d: Date, n: number): Date { const r = new Date(d); r.setDate(r.getDate() + n); return r; }

// Las fechas que devuelve el backend son calendario puro en UTC medianoche —
// leerlas en componentes locales las corre un día para atrás en UTC-3. Mismo
// criterio que fmtDate() en excelExporter.ts / [[fecha_offset_utc_fix]].
function fechaKeyUTC(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function buildGrid(mesActual: Date): Date[] {
  const first  = firstOfMonth(mesActual);
  const offset = (first.getDay() + 6) % 7; // días desde el lunes anterior (semana Lu-Do)
  const start  = addDays(first, -offset);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

// ── Links de navegación por tipo ──────────────────────────────────────────────

function getDetailLink(item: CalendarioItem): string {
  const m = item.metadata as Record<string, unknown>;
  switch (item.tipo) {
    case 'EVENTO':        return `/eventos/${item.id.replace('evento-', '')}`;
    case 'FACTURA_VENCE':  return `/facturas/${item.id.replace('factura-', '')}`;
    case 'ECHEQ_COBRO':    return m.evento_id ? `/eventos/${m.evento_id}?tab=echeqs` : '/eventos';
    // Los items JORNADA del calendario son siempre pendientes de aprobación
    // (ver resolveJornadas() en calendario.controller.ts) — se filtra directo.
    case 'JORNADA':        return `/rrhh?tab=jornadas&fecha=${item.fecha.slice(0, 10)}&estado=PENDIENTE`;
    case 'PARTE_DIARIO':   return `/parte-diario?fecha=${item.fecha.slice(0, 10)}`;
    case 'STOCK_RETORNO':  return m.evento_id ? `/eventos/${m.evento_id}?tab=stock` : '/eventos';
    case 'LIQUIDACION':    return '/rrhh?tab=liquidaciones';
    case 'RENDICION_PENDIENTE': return `/caja/${m.cuenta_id}`;
    case 'SALDO_MINIMO':        return `/caja/${m.cuenta_id}`;
    case 'CTA_CORRIENTE_INACTIVA': return `/cuentas-corrientes/${m.cuenta_id}`;
    case 'SEGURO_VENCE':   return `/flota?tab=vehiculos&vehiculo=${m.camion_id}`;
    case 'PATENTE_VENCE':  return `/flota?tab=patentes&vehiculo=${m.camion_id}`;
    case 'TALLER_RETIRO':  return '/flota?tab=taller';
    default:               return '/calendario';
  }
}

function metadataResumen(item: CalendarioItem): string[] {
  const m = item.metadata as Record<string, any>;
  switch (item.tipo) {
    case 'FACTURA_VENCE':  return [`Pendiente: $${Number(m.importe_pendiente).toLocaleString('es-AR')}`];
    case 'ECHEQ_COBRO':    return [`Importe: ${m.moneda} ${Number(m.importe).toLocaleString('es-AR')}`];
    case 'JORNADA':        return m.cantidad ? [`${m.cantidad} jornada${m.cantidad !== 1 ? 's' : ''}`] : (m.convocatoria ? [`Convocatoria: ${m.convocatoria}`] : []);
    case 'STOCK_RETORNO':  return [`Evento: ${m.evento_nombre}`, `Ubicación: ${m.ubicacion}`];
    case 'LIQUIDACION':    return [`Total a cobrar: $${Number(m.total_a_cobrar).toLocaleString('es-AR')}`];
    case 'EVENTO':         return [`Estado: ${m.estado}`];
    case 'RENDICION_PENDIENTE': return [`Responsable: ${m.responsable ?? '—'}`, `${m.dias_transcurridos} día${m.dias_transcurridos !== 1 ? 's' : ''} pendiente`];
    case 'SALDO_MINIMO':        return [`Saldo actual: $${Number(m.saldo_actual).toLocaleString('es-AR')}`, `Mínimo: $${Number(m.saldo_minimo).toLocaleString('es-AR')}`];
    case 'CTA_CORRIENTE_INACTIVA': return [`Saldo: ${m.moneda} ${Number(m.saldo_actual).toLocaleString('es-AR')}`, `${m.dias_sin_actividad} días sin actividad`];
    case 'SEGURO_VENCE':   return [`Estado: ${m.estado}`];
    case 'PATENTE_VENCE':  return [];
    case 'TALLER_RETIRO':  return m.taller_nombre ? [`Taller: ${m.taller_nombre}`] : [];
    default:               return [];
  }
}

// ── Detalle compartido (chip popover, "+N más" y tarjeta de agenda) ───────────

function ItemDetalle({ item, isAdmin }: { item: CalendarioItem; isAdmin: boolean }) {
  const info = metadataResumen(item);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold text-white" style={{ backgroundColor: item.color }}>
          {TIPO_LABEL[item.tipo]}
        </span>
        {isAdmin && <span className="text-[10px] text-muted-foreground">{item.empresa_nombre}</span>}
      </div>
      <p className="text-sm font-medium">{item.titulo}</p>
      {info.length > 0 && (
        <div className="text-xs text-muted-foreground space-y-0.5">
          {info.map((l, i) => <p key={i}>{l}</p>)}
        </div>
      )}
      <Link to={getDetailLink(item)} className="inline-block text-xs font-semibold text-primary hover:underline">
        Ver detalle →
      </Link>
    </div>
  );
}

// ── Vista mensual ──────────────────────────────────────────────────────────────

function ItemChip({ item, isAdmin }: { item: CalendarioItem; isAdmin: boolean }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="w-full truncate rounded px-1 py-0.5 text-[10px] font-medium text-white text-left leading-tight"
          style={{ backgroundColor: item.color }}
          title={item.titulo}
        >
          {item.titulo}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3">
        <ItemDetalle item={item} isAdmin={isAdmin} />
      </PopoverContent>
    </Popover>
  );
}

function DiaCell({ dia, items, esMesActual, esHoy, isAdmin }: {
  dia: Date; items: CalendarioItem[]; esMesActual: boolean; esHoy: boolean; isAdmin: boolean;
}) {
  const visibles   = items.slice(0, 2);
  const restantes  = items.length - visibles.length;
  const hayCritico = items.some(i => i.urgencia === 'critical');

  return (
    <div className={cn(
      'min-h-[92px] bg-white p-1 flex flex-col gap-0.5',
      !esMesActual && 'bg-muted/30',
      esHoy && 'bg-blue-50',
    )}>
      <span className={cn(
        'text-xs font-medium self-end px-1',
        !esMesActual && 'text-muted-foreground/40',
        hayCritico && 'text-red-600 font-bold',
      )}>
        {dia.getDate()}
      </span>
      <div className="flex-1 space-y-0.5 overflow-hidden">
        {visibles.map(item => <ItemChip key={item.id} item={item} isAdmin={isAdmin} />)}
        {restantes > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <button className="w-full text-left text-[10px] text-muted-foreground hover:underline px-1">
                +{restantes} más
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-2 max-h-72 overflow-y-auto space-y-2">
              <p className="text-xs font-semibold px-1 pb-1 border-b border-border">{toDateStr(dia)}</p>
              {items.map(item => (
                <div key={item.id} className="px-1 pb-2 border-b border-border/60 last:border-0 last:pb-0">
                  <ItemDetalle item={item} isAdmin={isAdmin} />
                </div>
              ))}
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );
}

function VistaMensual({ mesActual, setMesActual, itemsByDate, isAdmin }: {
  mesActual: Date; setMesActual: (d: Date) => void;
  itemsByDate: Map<string, CalendarioItem[]>; isAdmin: boolean;
}) {
  const dias = useMemo(() => buildGrid(mesActual), [mesActual]);
  const hoy  = toDateStr(new Date());

  return (
    <div>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setMesActual(addMonths(mesActual, -1))}><ChevronLeft size={16} /></Button>
          <h2 className="text-lg font-semibold w-44 text-center capitalize">
            {mesActual.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}
          </h2>
          <Button variant="outline" size="icon" onClick={() => setMesActual(addMonths(mesActual, 1))}><ChevronRight size={16} /></Button>
        </div>
        <Button variant="outline" size="sm" onClick={() => setMesActual(firstOfMonth(new Date()))}>Hoy</Button>
      </div>
      <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden border border-border">
        {DIAS_SEMANA.map(d => (
          <div key={d} className="bg-muted/50 text-center text-xs font-medium py-1.5 text-muted-foreground">{d}</div>
        ))}
        {dias.map(dia => {
          const key   = toDateStr(dia);
          const items = itemsByDate.get(key) ?? [];
          return (
            <DiaCell
              key={key} dia={dia} items={items}
              esMesActual={dia.getMonth() === mesActual.getMonth()}
              esHoy={key === hoy} isAdmin={isAdmin}
            />
          );
        })}
      </div>
    </div>
  );
}

// ── Vista agenda ───────────────────────────────────────────────────────────────

function AgendaCard({ item, isAdmin }: { item: CalendarioItem; isAdmin: boolean }) {
  const info = metadataResumen(item);
  return (
    <div className={cn(
      'rounded-lg border p-3 flex items-start justify-between gap-3',
      item.urgencia === 'critical' ? 'bg-red-50 border-red-200'
        : item.urgencia === 'warning' ? 'bg-amber-50 border-amber-200'
        : 'bg-white border-border',
    )}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold text-white" style={{ backgroundColor: item.color }}>
            {TIPO_LABEL[item.tipo]}
          </span>
          {isAdmin && <span className="text-[10px] text-muted-foreground">{item.empresa_nombre}</span>}
        </div>
        <p className="text-sm font-medium truncate">{item.titulo}</p>
        {info.length > 0 && <p className="text-xs text-muted-foreground mt-0.5">{info.join(' · ')}</p>}
      </div>
      <Link to={getDetailLink(item)} className="shrink-0 text-xs font-semibold text-primary hover:underline whitespace-nowrap">
        Ver detalle →
      </Link>
    </div>
  );
}

function VistaAgenda({ items, isAdmin, onCargarMas, puedeCargarMas }: {
  items: CalendarioItem[]; isAdmin: boolean; onCargarMas: () => void; puedeCargarMas: boolean;
}) {
  const grupos = useMemo(() => {
    const map = new Map<string, CalendarioItem[]>();
    for (const item of items) {
      const key = fechaKeyUTC(item.fecha);
      const arr = map.get(key) ?? [];
      arr.push(item);
      map.set(key, arr);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [items]);

  if (grupos.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-16">Sin eventos en el rango seleccionado.</p>;
  }

  return (
    <div className="space-y-5">
      {grupos.map(([fecha, itemsDia]) => (
        <div key={fecha}>
          <h3 className="text-sm font-semibold text-muted-foreground mb-2 capitalize">
            {new Date(`${fecha}T00:00:00Z`).toLocaleDateString('es-AR', { weekday: 'long', day: '2-digit', month: 'long', timeZone: 'UTC' })}
          </h3>
          <div className="space-y-2">
            {itemsDia.map(item => <AgendaCard key={item.id} item={item} isAdmin={isAdmin} />)}
          </div>
        </div>
      ))}
      {puedeCargarMas && (
        <div className="text-center pt-2">
          <Button variant="outline" size="sm" onClick={onCargarMas}>Cargar más</Button>
        </div>
      )}
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function CalendarioPage() {
  const { user } = useAuth();
  const isAdminGlobal = !!user?.puedeCambiarEmpresa;

  const [vista, setVista]             = useState<'mensual' | 'agenda'>('mensual');
  const [mesActual, setMesActual]     = useState(() => firstOfMonth(new Date()));
  const [filtrosTipos, setFiltrosTipos] = useState<Set<TipoCalendario>>(() => new Set(TODOS_LOS_TIPOS));
  const [filtroEmpresa, setFiltroEmpresa] = useState<'ambas' | number>('ambas');
  const [diasAgenda, setDiasAgenda]   = useState(30);

  const empresaIdParam = isAdminGlobal && filtroEmpresa !== 'ambas' ? filtroEmpresa : undefined;

  const desde = vista === 'mensual' ? toDateStr(firstOfMonth(mesActual)) : toDateStr(startOfDay(new Date()));
  const hasta = vista === 'mensual' ? toDateStr(lastOfMonth(mesActual))  : toDateStr(addDays(startOfDay(new Date()), Math.min(diasAgenda, MAX_DIAS_AGENDA)));

  const { data, isLoading } = useCalendario(desde, hasta, filtrosTipos, empresaIdParam);
  const prefetch = usePrefetchCalendario();

  // Pre-fetch del mes siguiente para que el cambio de mes se sienta instantáneo.
  useEffect(() => {
    if (vista !== 'mensual') return;
    const siguiente = addMonths(mesActual, 1);
    prefetch(toDateStr(firstOfMonth(siguiente)), toDateStr(lastOfMonth(siguiente)), filtrosTipos, empresaIdParam);
  }, [vista, mesActual, filtrosTipos, empresaIdParam, prefetch]);

  const toggleTipo = (tipo: TipoCalendario) => {
    setFiltrosTipos(prev => {
      const next = new Set(prev);
      if (next.has(tipo)) next.delete(tipo); else next.add(tipo);
      return next;
    });
  };

  const itemsByDate = useMemo(() => {
    const map = new Map<string, CalendarioItem[]>();
    for (const item of data?.items ?? []) {
      const key = fechaKeyUTC(item.fecha);
      const arr = map.get(key) ?? [];
      arr.push(item);
      map.set(key, arr);
    }
    return map;
  }, [data]);

  return (
    <div className="p-6 space-y-4 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-bold">Calendario</h1>
        {isAdminGlobal && (
          <select
            value={filtroEmpresa === 'ambas' ? 'ambas' : String(filtroEmpresa)}
            onChange={e => setFiltroEmpresa(e.target.value === 'ambas' ? 'ambas' : Number(e.target.value))}
            className="border rounded px-2 py-1.5 text-sm"
          >
            <option value="ambas">Ambas empresas</option>
            <option value={EMPRESAS.ENJOY}>Enjoy</option>
            <option value={EMPRESAS.DOS57}>DOS57</option>
          </select>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex rounded-lg border border-border overflow-hidden text-sm shrink-0">
          <button
            onClick={() => setVista('mensual')}
            className={cn('px-3 py-1.5 flex items-center gap-1.5', vista === 'mensual' ? 'bg-primary text-primary-foreground' : 'bg-white hover:bg-accent')}
          >
            <CalendarDays size={13} /> Mensual
          </button>
          <button
            onClick={() => setVista('agenda')}
            className={cn('px-3 py-1.5 flex items-center gap-1.5 border-l border-border', vista === 'agenda' ? 'bg-primary text-primary-foreground' : 'bg-white hover:bg-accent')}
          >
            <List size={13} /> Agenda
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {TODOS_LOS_TIPOS.map(tipo => {
            const activo = filtrosTipos.has(tipo);
            return (
              <button
                key={tipo}
                onClick={() => toggleTipo(tipo)}
                className="text-xs font-medium px-2.5 py-1 rounded-full border transition"
                style={activo
                  ? { backgroundColor: COLORES[tipo], borderColor: COLORES[tipo], color: 'white' }
                  : { backgroundColor: '#F3F4F6', borderColor: '#E5E7EB', color: '#6B7280' }}
              >
                {TIPO_LABEL[tipo]}
              </button>
            );
          })}
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground text-center py-16">Cargando...</p>
      ) : vista === 'mensual' ? (
        <VistaMensual mesActual={mesActual} setMesActual={setMesActual} itemsByDate={itemsByDate} isAdmin={isAdminGlobal} />
      ) : (
        <VistaAgenda
          items={data?.items ?? []} isAdmin={isAdminGlobal}
          onCargarMas={() => setDiasAgenda(d => Math.min(d + 30, MAX_DIAS_AGENDA))}
          puedeCargarMas={diasAgenda < MAX_DIAS_AGENDA}
        />
      )}
    </div>
  );
}
