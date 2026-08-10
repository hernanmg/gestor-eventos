import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight, Filter, Download, ArrowUp, ArrowDown, Eye } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useMacroMovimientos, useUpdateMovimientoMacro, useExportarMacro } from '@/hooks/useMacro';
import { useEventos } from '@/hooks/useEvento';
import { useRubros } from '@/hooks/useRubros';
import { useUsuarios } from '@/hooks/useUsuarios';
import { useProveedores } from '@/hooks/useProveedores';
import { Button } from '@/components/ui/button';
import { Badge, MovimientoEstadoBadge, MOVIMIENTO_LABEL } from '@/components/ui/badge';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { getApiErrorMessage, cn } from '@/lib/utils';
import type { EstadoMovimiento, MacroFiltros, MovimientoMacro, Tipo } from '@/types';

const ESTADOS: EstadoMovimiento[] = ['PENDIENTE', 'COTIZANDO', 'CONFIRMADO', 'PAGADO', 'CANCELADO'];

type Sort  = NonNullable<MacroFiltros['sort']>;
type Order = NonNullable<MacroFiltros['order']>;

interface DraftFiltros {
  evento_id?:         number;
  rubro_id?:          number;
  tipo?:              Tipo;
  estado?:            EstadoMovimiento;
  responsable_id?:    number;
  proveedor_id?:      number;
  desde?:             string;
  hasta?:             string;
  con_presupuesto?:   boolean;
  avisado_proveedor?: boolean;
}

const selectCls = 'border border-input rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring bg-white';

function TipoBadge({ tipo }: { tipo: Tipo }) {
  return <Badge variant={tipo === 'EGRESO' ? 'destructive' : 'success'}>{tipo === 'EGRESO' ? 'Egreso' : 'Ingreso'}</Badge>;
}

function countActive(f: DraftFiltros): number {
  return Object.values(f).filter(v => v !== undefined && v !== '').length;
}

// ── Header ────────────────────────────────────────────────────────────────────

function MovimientosHeader({
  puedeCambiarEmpresa, empresasDisponibles, empresaId, onEmpresaChange, onExportar, isExporting,
}: {
  puedeCambiarEmpresa:  boolean;
  empresasDisponibles:  { id: number; nombre: string; nombre_corto: string | null }[];
  empresaId:            number | undefined;
  onEmpresaChange:      (id: number | undefined) => void;
  onExportar:           () => void;
  isExporting:          boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground">Movimientos de todos los eventos</p>
      <div className="flex items-center gap-2">
        {puedeCambiarEmpresa && (
          <select
            value={empresaId ?? ''}
            onChange={e => onEmpresaChange(e.target.value === '' ? undefined : Number(e.target.value))}
            className={selectCls}
          >
            <option value="">Ambas empresas</option>
            {empresasDisponibles.map(e => (
              <option key={e.id} value={e.id}>{e.nombre_corto ?? e.nombre}</option>
            ))}
          </select>
        )}
        <Button size="sm" variant="outline" onClick={onExportar} disabled={isExporting}>
          <Download size={14} className="mr-1.5" /> {isExporting ? 'Exportando…' : 'Exportar Excel'}
        </Button>
      </div>
    </div>
  );
}

// ── Filtros ───────────────────────────────────────────────────────────────────

function FiltrosPanel({
  open, onToggle, draft, setDraft, onAplicar, onLimpiar, activeCount,
}: {
  open:        boolean;
  onToggle:    () => void;
  draft:       DraftFiltros;
  setDraft:    (updater: (d: DraftFiltros) => DraftFiltros) => void;
  onAplicar:   () => void;
  onLimpiar:   () => void;
  activeCount: number;
}) {
  const { data: eventos = [] }    = useEventos();
  const { data: rubros = [] }     = useRubros();
  const { data: usuarios = [] }   = useUsuarios();
  const { data: proveedores = [] } = useProveedores();

  return (
    <div className="bg-card border border-border rounded-lg">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium"
      >
        <span className="flex items-center gap-2 text-muted-foreground">
          <Filter size={14} /> Filtros
          {!open && activeCount > 0 && (
            <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground">
              {activeCount}
            </span>
          )}
        </span>
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>

      {open && (
        <div className="border-t border-border p-4 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Evento</label>
              <select
                className={cn(selectCls, 'w-full')}
                value={draft.evento_id ?? ''}
                onChange={e => setDraft(d => ({ ...d, evento_id: e.target.value ? Number(e.target.value) : undefined }))}
              >
                <option value="">Todos</option>
                {eventos.map(ev => <option key={ev.id} value={ev.id}>{ev.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Rubro</label>
              <select
                className={cn(selectCls, 'w-full')}
                value={draft.rubro_id ?? ''}
                onChange={e => setDraft(d => ({ ...d, rubro_id: e.target.value ? Number(e.target.value) : undefined }))}
              >
                <option value="">Todos</option>
                {rubros.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Tipo</label>
              <select
                className={cn(selectCls, 'w-full')}
                value={draft.tipo ?? ''}
                onChange={e => setDraft(d => ({ ...d, tipo: (e.target.value || undefined) as Tipo | undefined }))}
              >
                <option value="">Todos</option>
                <option value="EGRESO">Egreso</option>
                <option value="INGRESO">Ingreso</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Estado</label>
              <select
                className={cn(selectCls, 'w-full')}
                value={draft.estado ?? ''}
                onChange={e => setDraft(d => ({ ...d, estado: (e.target.value || undefined) as EstadoMovimiento | undefined }))}
              >
                <option value="">Todos</option>
                {ESTADOS.map(s => <option key={s} value={s}>{MOVIMIENTO_LABEL[s]}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Responsable</label>
              <select
                className={cn(selectCls, 'w-full')}
                value={draft.responsable_id ?? ''}
                onChange={e => setDraft(d => ({ ...d, responsable_id: e.target.value ? Number(e.target.value) : undefined }))}
              >
                <option value="">Todos</option>
                {usuarios.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Proveedor</label>
              <select
                className={cn(selectCls, 'w-full')}
                value={draft.proveedor_id ?? ''}
                onChange={e => setDraft(d => ({ ...d, proveedor_id: e.target.value ? Number(e.target.value) : undefined }))}
              >
                <option value="">Todos</option>
                {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Fecha desde</label>
              <input
                type="date"
                className={cn(selectCls, 'w-full')}
                value={draft.desde ?? ''}
                onChange={e => setDraft(d => ({ ...d, desde: e.target.value || undefined }))}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Fecha hasta</label>
              <input
                type="date"
                className={cn(selectCls, 'w-full')}
                value={draft.hasta ?? ''}
                onChange={e => setDraft(d => ({ ...d, hasta: e.target.value || undefined }))}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={draft.con_presupuesto ?? false}
                onChange={e => setDraft(d => ({ ...d, con_presupuesto: e.target.checked || undefined }))}
              />
              Solo con presupuesto
            </label>
            <label className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={draft.avisado_proveedor ?? false}
                onChange={e => setDraft(d => ({ ...d, avisado_proveedor: e.target.checked || undefined }))}
              />
              Solo avisado proveedor
            </label>
          </div>

          <div className="flex gap-2 border-t border-border pt-3">
            <Button size="sm" onClick={onAplicar}>Aplicar filtros</Button>
            <Button size="sm" variant="outline" onClick={onLimpiar}>Limpiar</Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Totales ───────────────────────────────────────────────────────────────────

function TotalesRow({ label, egresos, ingresos, presupuesto }: {
  label:       string;
  egresos:     number;
  ingresos:    number;
  presupuesto: number;
}) {
  const saldo  = ingresos - egresos;
  const desvio = presupuesto - egresos;
  return (
    <div className="space-y-2">
      {label && <p className="text-xs font-medium text-muted-foreground">{label}</p>}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="border border-border bg-card rounded-lg p-3">
          <p className="text-xs text-muted-foreground">Total Egresos</p>
          <p className="text-lg font-semibold text-red-600">{formatCurrency(egresos)}</p>
        </div>
        <div className="border border-border bg-card rounded-lg p-3">
          <p className="text-xs text-muted-foreground">Total Ingresos</p>
          <p className="text-lg font-semibold text-green-600">{formatCurrency(ingresos)}</p>
        </div>
        <div className="border border-border bg-card rounded-lg p-3">
          <p className="text-xs text-muted-foreground">Saldo</p>
          <p className={cn('text-lg font-semibold', saldo >= 0 ? 'text-green-700' : 'text-red-700')}>{formatCurrency(saldo)}</p>
        </div>
        <div className="border border-border bg-card rounded-lg p-3">
          <p className="text-xs text-muted-foreground">Total Presupuestado</p>
          <p className="text-lg font-semibold">{formatCurrency(presupuesto)}</p>
        </div>
        <div className="border border-border bg-card rounded-lg p-3">
          <p className="text-xs text-muted-foreground">Desvío</p>
          <p className={cn('text-lg font-semibold', desvio >= 0 ? 'text-green-700' : 'text-red-700')}>{formatCurrency(desvio)}</p>
        </div>
      </div>
    </div>
  );
}

// ── Fila / Card de movimiento ────────────────────────────────────────────────

function FilaMovimiento({ m, showEmpresa, onUpdate }: {
  m:           MovimientoMacro;
  showEmpresa: boolean;
  onUpdate:    (id: number, data: { estado_movimiento?: EstadoMovimiento; avisado_proveedor?: boolean }) => void;
}) {
  return (
    <tr className="border-b border-border last:border-0 hover:bg-muted/30 text-sm transition-colors">
      {showEmpresa && <td className="py-2.5 px-3 text-xs text-muted-foreground">{m.empresa_nombre ?? '—'}</td>}
      <td className="py-2.5 px-3">
        <Link to={`/eventos/${m.evento_id}`} className="hover:underline text-primary font-medium">{m.evento_nombre ?? '—'}</Link>
      </td>
      <td className="py-2.5 px-3 text-muted-foreground">{m.rubro_nombre ?? '—'}</td>
      <td className="py-2.5 px-3"><TipoBadge tipo={m.tipo} /></td>
      <td className="py-2.5 px-3 whitespace-nowrap">{formatDate(m.fecha)}</td>
      <td className="py-2.5 px-3 max-w-[220px] truncate" title={m.concepto ?? undefined}>{m.concepto ?? '—'}</td>
      <td className="py-2.5 px-3 whitespace-nowrap">{m.debe   ? formatCurrency(m.debe,  m.moneda) : '—'}</td>
      <td className="py-2.5 px-3 whitespace-nowrap">{m.haber  ? formatCurrency(m.haber, m.moneda) : '—'}</td>
      <td className="py-2.5 px-3 whitespace-nowrap">{m.presupuesto != null ? formatCurrency(m.presupuesto, m.moneda) : '—'}</td>
      <td className="py-2.5 px-3">
        <select
          className="border border-input rounded px-1.5 py-1 text-xs bg-white"
          value={m.estado_movimiento}
          onChange={e => onUpdate(m.id, { estado_movimiento: e.target.value as EstadoMovimiento })}
        >
          {ESTADOS.map(s => <option key={s} value={s}>{MOVIMIENTO_LABEL[s]}</option>)}
        </select>
      </td>
      <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap">{m.responsable_nombre ?? '—'}</td>
      <td className="py-2.5 px-3 text-center">
        <input
          type="checkbox"
          checked={m.avisado_proveedor}
          onChange={e => onUpdate(m.id, { avisado_proveedor: e.target.checked })}
        />
      </td>
      <td className="py-2.5 px-3 whitespace-nowrap">{formatDate(m.fecha_pago)}</td>
      <td className="py-2.5 px-3">
        <Link to={`/eventos/${m.evento_id}`} className="text-primary hover:underline inline-flex items-center gap-1 text-xs">
          <Eye size={12} /> Ver
        </Link>
      </td>
    </tr>
  );
}

function CardMovimiento({ m, onUpdate }: {
  m:        MovimientoMacro;
  onUpdate: (id: number, data: { estado_movimiento?: EstadoMovimiento; avisado_proveedor?: boolean }) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const monto = m.debe || m.haber;
  return (
    <div className="border border-border rounded-lg bg-card p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link to={`/eventos/${m.evento_id}`} className="font-medium text-primary hover:underline text-sm block truncate">
            {m.evento_nombre ?? '—'}
          </Link>
          <p className="text-xs text-muted-foreground truncate">{m.rubro_nombre ?? '—'}</p>
        </div>
        <MovimientoEstadoBadge estado={m.estado_movimiento} />
      </div>
      <div className="flex items-center justify-between">
        <TipoBadge tipo={m.tipo} />
        <span className={cn('font-semibold', m.tipo === 'EGRESO' ? 'text-red-600' : 'text-green-600')}>
          {formatCurrency(monto, m.moneda)}
        </span>
      </div>
      <button onClick={() => setExpanded(v => !v)} className="text-xs text-primary flex items-center gap-1">
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />} Ver detalle
      </button>
      {expanded && (
        <div className="text-xs space-y-1.5 border-t border-border pt-2">
          <p><span className="text-muted-foreground">Empresa:</span> {m.empresa_nombre ?? '—'}</p>
          <p><span className="text-muted-foreground">Concepto:</span> {m.concepto ?? '—'}</p>
          <p><span className="text-muted-foreground">Fecha:</span> {formatDate(m.fecha)}</p>
          <p><span className="text-muted-foreground">Presupuesto:</span> {m.presupuesto != null ? formatCurrency(m.presupuesto, m.moneda) : '—'}</p>
          <p><span className="text-muted-foreground">Responsable:</span> {m.responsable_nombre ?? '—'}</p>
          <p><span className="text-muted-foreground">Proveedor:</span> {m.proveedor_nombre ?? '—'}</p>
          <p><span className="text-muted-foreground">Fecha pago:</span> {formatDate(m.fecha_pago)}</p>
          <div className="flex items-center gap-3 pt-1">
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={m.avisado_proveedor} onChange={e => onUpdate(m.id, { avisado_proveedor: e.target.checked })} />
              Avisado proveedor
            </label>
          </div>
          <select
            className="border border-input rounded px-1.5 py-1 text-xs bg-white w-full"
            value={m.estado_movimiento}
            onChange={e => onUpdate(m.id, { estado_movimiento: e.target.value as EstadoMovimiento })}
          >
            {ESTADOS.map(s => <option key={s} value={s}>{MOVIMIENTO_LABEL[s]}</option>)}
          </select>
        </div>
      )}
    </div>
  );
}

// ── Header de columna ordenable ──────────────────────────────────────────────

function SortHeader({ label, field, sort, order, onSort }: {
  label: string; field: Sort; sort: Sort; order: Order; onSort: (f: Sort) => void;
}) {
  const active = sort === field;
  return (
    <th
      className="text-left py-2.5 px-3 font-medium cursor-pointer select-none hover:text-foreground"
      onClick={() => onSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active && (order === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
      </span>
    </th>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────

export default function MovimientosSection() {
  const { user } = useAuth();
  const [empresaId, setEmpresaId] = useState<number | undefined>(undefined);
  const [draft, setDraft]     = useState<DraftFiltros>({});
  const [applied, setApplied] = useState<DraftFiltros>({});
  const [page, setPage]       = useState(1);
  const [sort, setSort]       = useState<Sort>('fecha');
  const [order, setOrder]     = useState<Order>('desc');
  const [filtersOpen, setFiltersOpen] = useState(true);

  const filtros: MacroFiltros = { empresa_id: empresaId, ...applied, page, limit: 50, sort, order };
  const { data, isLoading } = useMacroMovimientos(filtros);
  const updateMutation      = useUpdateMovimientoMacro();
  const { exportar, isExporting } = useExportarMacro();

  if (!user) return null;

  const puedeCambiarEmpresa  = user.puedeCambiarEmpresa;
  const empresasDisponibles  = user.empresasDisponibles ?? [];
  const showEmpresaColumn    = puedeCambiarEmpresa && empresaId === undefined && (data?.totales.por_empresa.length ?? 0) > 1;

  function handleSort(field: Sort) {
    if (sort === field) {
      setOrder(o => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      setSort(field);
      setOrder('desc');
    }
    setPage(1);
  }

  function handleUpdate(id: number, upd: { estado_movimiento?: EstadoMovimiento; avisado_proveedor?: boolean }) {
    updateMutation.mutate({ id, data: upd }, {
      onError: err => alert(getApiErrorMessage(err)),
    });
  }

  const pagination = data?.pagination;
  const totales    = data?.totales;

  return (
    <div className="space-y-4">
      <MovimientosHeader
        puedeCambiarEmpresa={puedeCambiarEmpresa}
        empresasDisponibles={empresasDisponibles}
        empresaId={empresaId}
        onEmpresaChange={id => { setEmpresaId(id); setPage(1); }}
        onExportar={() => exportar(filtros)}
        isExporting={isExporting}
      />

      <FiltrosPanel
        open={filtersOpen}
        onToggle={() => setFiltersOpen(v => !v)}
        draft={draft}
        setDraft={setDraft}
        onAplicar={() => { setApplied(draft); setPage(1); }}
        onLimpiar={() => { setDraft({}); setApplied({}); setPage(1); }}
        activeCount={countActive(applied)}
      />

      {totales && (
        <div className="space-y-3">
          <TotalesRow
            label={empresaId === undefined && totales.por_empresa.length > 1 ? 'Consolidado' : ''}
            egresos={totales.total_egresos}
            ingresos={totales.total_ingresos}
            presupuesto={totales.total_presupuesto}
          />
          {empresaId === undefined && totales.por_empresa.length > 1 && totales.por_empresa.map(e => (
            <TotalesRow
              key={e.empresa_id}
              label={e.empresa_nombre}
              egresos={e.total_egresos}
              ingresos={e.total_ingresos}
              presupuesto={e.total_presupuesto}
            />
          ))}
        </div>
      )}

      {/* Tabla — desktop */}
      <div className="hidden md:block bg-card border border-border rounded-lg overflow-x-auto">
        {isLoading ? (
          <p className="text-sm text-muted-foreground p-6">Cargando…</p>
        ) : !data?.data.length ? (
          <p className="text-sm text-muted-foreground p-6">Sin movimientos para los filtros seleccionados.</p>
        ) : (
          <table className="w-full min-w-[1100px]">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground bg-muted/30">
                {showEmpresaColumn && <th className="text-left py-2.5 px-3 font-medium">Empresa</th>}
                <th className="text-left py-2.5 px-3 font-medium">Evento</th>
                <SortHeader label="Rubro" field="rubro" sort={sort} order={order} onSort={handleSort} />
                <th className="text-left py-2.5 px-3 font-medium">Tipo</th>
                <SortHeader label="Fecha" field="fecha" sort={sort} order={order} onSort={handleSort} />
                <th className="text-left py-2.5 px-3 font-medium">Concepto</th>
                <SortHeader label="Debe" field="monto" sort={sort} order={order} onSort={handleSort} />
                <th className="text-left py-2.5 px-3 font-medium">Haber</th>
                <th className="text-left py-2.5 px-3 font-medium">Presupuesto</th>
                <th className="text-left py-2.5 px-3 font-medium">Estado</th>
                <th className="text-left py-2.5 px-3 font-medium">Responsable</th>
                <th className="text-left py-2.5 px-3 font-medium">¿Avisado?</th>
                <th className="text-left py-2.5 px-3 font-medium">Fecha pago</th>
                <th className="py-2.5 px-3" />
              </tr>
            </thead>
            <tbody>
              {data.data.map(m => (
                <FilaMovimiento key={m.id} m={m} showEmpresa={showEmpresaColumn} onUpdate={handleUpdate} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Cards — mobile */}
      <div className="md:hidden space-y-2">
        {isLoading ? (
          <p className="text-sm text-muted-foreground p-4 text-center">Cargando…</p>
        ) : !data?.data.length ? (
          <p className="text-sm text-muted-foreground p-4 text-center">Sin movimientos para los filtros seleccionados.</p>
        ) : (
          data.data.map(m => <CardMovimiento key={m.id} m={m} onUpdate={handleUpdate} />)
        )}
      </div>

      {/* Paginación */}
      {pagination && pagination.total > 0 && (
        <div className="flex items-center justify-between px-1 text-sm">
          <span className="text-muted-foreground">
            {pagination.total} movimientos — página {pagination.page} de {pagination.totalPages}
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Anterior</Button>
            <Button size="sm" variant="outline" disabled={page >= pagination.totalPages} onClick={() => setPage(p => p + 1)}>Siguiente</Button>
          </div>
        </div>
      )}
    </div>
  );
}
