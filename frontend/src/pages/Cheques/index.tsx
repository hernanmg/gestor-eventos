import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Pencil, Trash2, Check, RotateCcw, Ban, AlertTriangle, CalendarClock, Upload } from 'lucide-react';
import ImportarChequesDialog from './ImportarChequesDialog';
import PageHeader from '@/components/ui/PageHeader';
import BaseTable from '@/components/ui/BaseTable';
import MoneyInput from '@/components/ui/MoneyInput';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ProveedorCombobox from '@/components/domain/ProveedorCombobox';
import { useCheques, useResumenCheques, useGuardarCheque, useAccionCheque, type ChequesFiltros, type ChequePayload } from '@/hooks/useCheques';
import { useSGRList } from '@/hooks/useSGR';
import { useEventos } from '@/hooks/useEvento';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { cn, getApiErrorMessage } from '@/lib/utils';
import type { ChequeEmpresa, EstadoEcheq, TipoCheque, FormatoCheque, Moneda, ProveedorBusqueda } from '@/types';

// Finanzas → Cheques (Mayra): los cheques que emite la empresa, por banco,
// tengan o no evento. Reemplaza las planillas "Cheques Pendientes - <BANCO>".

const inputCls  = 'w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring';
const labelCls  = 'block text-xs font-medium text-muted-foreground mb-0.5';
const selectCls = 'border border-input rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring bg-white';

const SIN_BANCO = 'SIN BANCO';
const BANCO_LABEL: Record<string, string> = { GALICIA: 'Galicia', NACION: 'Nación', BBVA: 'BBVA (Francés)', BANCOR: 'Bancor', [SIN_BANCO]: 'Sin banco' };
const bancoLabel = (b: string | null) => BANCO_LABEL[b ?? SIN_BANCO] ?? (b ?? 'Sin banco');

const ESTADO_LABEL: Record<EstadoEcheq, string> = { PENDIENTE: 'Pendiente', COBRADO: 'Debitado', RECHAZADO: 'Rechazado', VENDIDO: 'Vendido' };
const ESTADO_VARIANT: Record<EstadoEcheq, 'warning' | 'success' | 'destructive' | 'info'> = { PENDIENTE: 'warning', COBRADO: 'success', RECHAZADO: 'destructive', VENDIDO: 'info' };
const TIPO_LABEL: Record<TipoCheque, string> = { PAGO: 'Pago', FINANCIAMIENTO_PROPIO: 'Financiamiento (propio)', FINANCIAMIENTO_AVALADO: 'Financiamiento (avalado)' };

const ars = (n: number) => formatCurrency(n, 'ARS');
const addDias = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const diaSemana = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('es-AR', { timeZone: 'UTC', weekday: 'short', day: '2-digit', month: '2-digit' });

function TipoBadge({ tipo }: { tipo: TipoCheque }) {
  if (tipo === 'PAGO') return null;
  return (
    <Badge variant={tipo === 'FINANCIAMIENTO_AVALADO' ? 'orange' : 'success'} className="ml-1.5" title={tipo === 'FINANCIAMIENTO_AVALADO' ? 'Entra al banco sí o sí: hay que cubrirlo' : 'Se puede cubrir con la misma SGR'}>
      {tipo === 'FINANCIAMIENTO_AVALADO' ? 'Avalado' : 'Propio'}
    </Badge>
  );
}

// ── Alta / edición ───────────────────────────────────────────────────────────

interface Form {
  numero: string; banco: string; formato: FormatoCheque; tipo: TipoCheque;
  proveedor: ProveedorBusqueda | null; razon_social: string; sgr_id: string;
  importe: string; moneda: Moneda; fecha_emision: string; fecha_cobro_estimada: string;
  evento_id: string; detalle: string;
}

const formDe = (c: ChequeEmpresa | null, bancoDefault: string): Form => c ? {
  numero: c.numero, banco: c.banco ?? '', formato: c.formato, tipo: c.tipo,
  proveedor: c.proveedor ? { id: c.proveedor.id, nombre: c.proveedor.nombre, alias: null, cuit: null, categoria: null } : null,
  razon_social: c.proveedor ? '' : (c.razon_social ?? ''), sgr_id: c.sgr_id ? String(c.sgr_id) : '',
  importe: String(c.importe), moneda: c.moneda, fecha_emision: c.fecha_emision?.slice(0, 10) ?? '',
  fecha_cobro_estimada: c.fecha_cobro_estimada?.slice(0, 10) ?? '', evento_id: c.evento_id ? String(c.evento_id) : '', detalle: c.detalle ?? '',
} : {
  numero: '', banco: bancoDefault, formato: 'ECHEQ', tipo: 'PAGO', proveedor: null, razon_social: '', sgr_id: '',
  importe: '', moneda: 'ARS', fecha_emision: new Date().toISOString().slice(0, 10), fecha_cobro_estimada: '', evento_id: '', detalle: '',
};

function ChequeDialog({ open, cheque, bancos, bancoDefault, onClose }: {
  open: boolean; cheque: ChequeEmpresa | null; bancos: string[]; bancoDefault: string; onClose: () => void;
}) {
  const [form, setForm] = useState<Form>(() => formDe(cheque, bancoDefault));
  const [error, setError] = useState<string | null>(null);
  const guardar = useGuardarCheque(cheque?.id ?? null);
  const { data: sgrs = [] } = useSGRList();
  const { data: eventos = [] } = useEventos();
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm(p => ({ ...p, [k]: v }));
  const financiamiento = form.tipo !== 'PAGO';
  const atadoAEgreso = !!cheque?.movimiento_id;

  useEffect(() => { if (open) { setForm(formDe(cheque, bancoDefault)); setError(null); } }, [open, cheque, bancoDefault]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const payload: ChequePayload = {
      numero: form.numero.trim(), banco: form.banco || null, formato: form.formato, tipo: form.tipo,
      proveedor_id: financiamiento ? null : (form.proveedor?.id ?? null),
      razon_social: form.razon_social.trim() || null,
      sgr_id: financiamiento && form.sgr_id ? Number(form.sgr_id) : null,
      importe: Number(form.importe), moneda: form.moneda,
      fecha_emision: form.fecha_emision || null, fecha_cobro_estimada: form.fecha_cobro_estimada || null,
      ...(atadoAEgreso ? {} : { evento_id: form.evento_id ? Number(form.evento_id) : null }),
      detalle: form.detalle.trim() || null,
    };
    if (!payload.importe) { setError('Cargá el monto'); return; }
    try { await guardar.mutateAsync(payload); onClose(); }
    catch (err) { setError(getApiErrorMessage(err)); }
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>{cheque ? `Editar cheque ${cheque.numero}` : 'Nuevo cheque'}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3 mt-1">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Banco</label>
              <input list="cheques-bancos" value={form.banco} onChange={e => set('banco', e.target.value.toUpperCase())} className={inputCls} placeholder="GALICIA" />
              <datalist id="cheques-bancos">{bancos.map(b => <option key={b} value={b}>{bancoLabel(b)}</option>)}</datalist>
            </div>
            <div>
              <label className={labelCls}>N° de cheque *</label>
              <input value={form.numero} onChange={e => set('numero', e.target.value)} className={inputCls} placeholder="ECHEQ 1393" required />
            </div>
            <div>
              <label className={labelCls}>Tipo</label>
              <select value={form.tipo} onChange={e => set('tipo', e.target.value as TipoCheque)} className={selectCls + ' w-full'}>
                {(Object.keys(TIPO_LABEL) as TipoCheque[]).map(t => <option key={t} value={t}>{TIPO_LABEL[t]}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Formato</label>
              <select value={form.formato} onChange={e => set('formato', e.target.value as FormatoCheque)} className={selectCls + ' w-full'}>
                <option value="ECHEQ">Echeq</option>
                <option value="FISICO">Cheque físico</option>
              </select>
            </div>
            {financiamiento ? (
              <div className="col-span-2">
                <label className={labelCls}>SGR</label>
                <select value={form.sgr_id} onChange={e => set('sgr_id', e.target.value)} className={selectCls + ' w-full'}>
                  <option value="">— Sin SGR cargada —</option>
                  {sgrs.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {form.tipo === 'FINANCIAMIENTO_AVALADO' ? 'Avalado: entra al banco sí o sí y hay que cubrirlo.' : 'Propio sin aval: se puede cubrir con la misma SGR.'}
                </p>
              </div>
            ) : (
              <div className="col-span-2">
                <label className={labelCls}>Proveedor</label>
                <ProveedorCombobox value={form.proveedor} onChange={v => set('proveedor', v)} />
              </div>
            )}
            <div className="col-span-2">
              <label className={labelCls}>Concepto {form.proveedor || form.sgr_id ? '(opcional, si no se usa el nombre)' : '*'}</label>
              <input value={form.razon_social} onChange={e => set('razon_social', e.target.value)} className={inputCls} placeholder={financiamiento ? 'Financiera (cheque propio) con aval…' : 'A quién va el cheque'} />
            </div>
            <div>
              <label className={labelCls}>Monto *</label>
              <MoneyInput value={form.importe} onChange={v => set('importe', v)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Moneda</label>
              <select value={form.moneda} onChange={e => set('moneda', e.target.value as Moneda)} className={selectCls + ' w-full'}>
                <option value="ARS">ARS</option>
                <option value="USD">USD</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Fecha de emisión</label>
              <input type="date" value={form.fecha_emision} onChange={e => set('fecha_emision', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Fecha de pago *</label>
              <input type="date" value={form.fecha_cobro_estimada} onChange={e => set('fecha_cobro_estimada', e.target.value)} className={inputCls} required />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Evento (opcional)</label>
              <select value={form.evento_id} onChange={e => set('evento_id', e.target.value)} className={selectCls + ' w-full'} disabled={atadoAEgreso}>
                <option value="">— Sin evento (de la empresa) —</option>
                {eventos.map(ev => <option key={ev.id} value={ev.id}>{ev.nombre}</option>)}
              </select>
              {atadoAEgreso && <p className="text-[11px] text-muted-foreground mt-0.5">Salió de un egreso del evento: el evento no se cambia desde acá.</p>}
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Notas</label>
              <input value={form.detalle} onChange={e => set('detalle', e.target.value)} className={inputCls} placeholder="Renovar a 30 días, cubre con cheques…" />
            </div>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={guardar.isPending}>{guardar.isPending ? 'Guardando…' : 'Guardar'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Marcar debitado (fecha de entrada) ───────────────────────────────────────

function DebitarDialog({ cheque, onClose }: { cheque: ChequeEmpresa; onClose: () => void }) {
  const [fecha, setFecha] = useState(cheque.fecha_cobro_estimada?.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null);
  const accion = useAccionCheque();
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await accion.mutateAsync({ id: cheque.id, accion: 'debitar', fecha }); onClose(); }
    catch (err) { setError(getApiErrorMessage(err)); }
  };
  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>Debitado — {cheque.numero}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3 mt-1">
          <p className="text-sm">{cheque.razon_social} · {formatCurrency(cheque.importe, cheque.moneda)}</p>
          <div>
            <label className={labelCls}>Fecha en que entró al banco</label>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className={inputCls} required />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={accion.isPending}>Marcar debitado</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Página ────────────────────────────────────────────────────────────────────

type FiltroEstado = EstadoEcheq | 'TODOS';

export default function ChequesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const viernesParam = searchParams.get('viernes');

  const [banco, setBanco]   = useState<string>('');
  const [estado, setEstado] = useState<FiltroEstado>('PENDIENTE');
  const [tipo, setTipo]     = useState<ChequesFiltros['tipo'] | ''>('');
  const [desde, setDesde]   = useState(viernesParam ?? '');
  const [hasta, setHasta]   = useState(viernesParam ? addDias(viernesParam, 2) : '');
  const [buscar, setBuscar] = useState('');

  const [dialog, setDialog]   = useState<{ open: boolean; cheque: ChequeEmpresa | null }>({ open: false, cheque: null });
  const [debitar, setDebitar] = useState<ChequeEmpresa | null>(null);
  const [importando, setImportando] = useState(false);
  const accion = useAccionCheque();

  const { data: resumen } = useResumenCheques();
  const { data: cheques = [], isLoading } = useCheques({
    banco: banco || undefined, estado: estado === 'TODOS' ? undefined : estado, tipo: tipo || undefined,
    desde: desde || undefined, hasta: hasta || undefined, buscar: buscar.trim() || undefined,
  });

  const bancos = resumen?.bancos_usados ?? ['GALICIA', 'NACION', 'BBVA', 'BANCOR'];
  const bancosConPendientes = resumen?.bancos ?? [];
  const chips = useMemo(() => [...new Set([...bancosConPendientes.map(b => b.banco), ...bancos])], [bancosConPendientes, bancos]);

  // Agrupado por fecha de pago, con el total del día (lo que hay que cubrir).
  const grupos = useMemo(() => {
    const m = new Map<string, ChequeEmpresa[]>();
    for (const c of cheques) {
      const k = c.fecha_cobro_estimada?.slice(0, 10) ?? 'sin-fecha';
      m.set(k, [...(m.get(k) ?? []), c]);
    }
    return [...m.entries()];
  }, [cheques]);
  const totalListado = cheques.reduce((a, c) => a + (c.monto_ars ?? c.importe), 0);
  const hoy = resumen?.hoy ?? new Date().toISOString().slice(0, 10);

  const verViernes = () => {
    if (!resumen) return;
    setDesde(resumen.viernes); setHasta(resumen.hasta); setEstado('PENDIENTE'); setBanco('');
  };
  const limpiarFechas = () => {
    setDesde(''); setHasta('');
    if (viernesParam) { searchParams.delete('viernes'); setSearchParams(searchParams, { replace: true }); }
  };

  const correr = async (fn: () => Promise<unknown>) => {
    try { await fn(); } catch (err) { window.alert(getApiErrorMessage(err)); }
  };

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto">
      <PageHeader
        title="Cheques"
        subtitle="Los cheques que emite la empresa, por banco, sean de un evento o no. Los de financiamiento con SGR se marcan aparte: los avalados entran al banco sí o sí."
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setImportando(true)}><Upload size={14} className="mr-1.5" /> Importar planilla</Button>
            <Button size="sm" onClick={() => setDialog({ open: true, cheque: null })}><Plus size={14} className="mr-1.5" /> Nuevo cheque</Button>
          </div>
        }
      />

      {/* Bloque del viernes + bancos */}
      {resumen && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <button onClick={verViernes} className="card p-3 text-left hover:ring-1 hover:ring-ring transition sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><CalendarClock size={13} /> A cubrir el viernes {formatDate(resumen.viernes)}</div>
            <div className="text-xl font-semibold tabular-nums mt-1">{ars(resumen.total_bloque_viernes)}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              {resumen.total_bloque_viernes > 0
                ? resumen.bancos.filter(b => b.bloque_viernes > 0).map(b => `${bancoLabel(b.banco)} ${ars(b.total_bloque_viernes)}`).join(' · ')
                : 'Sin cheques pendientes para ese viernes ni el fin de semana'}
            </div>
          </button>
          {resumen.bancos.map(b => (
            <button key={b.banco} onClick={() => { setBanco(b.banco); setEstado('PENDIENTE'); }}
              className={cn('card p-3 text-left hover:ring-1 hover:ring-ring transition', banco === b.banco && 'ring-1 ring-primary')}>
              <div className="text-xs font-medium text-muted-foreground">{bancoLabel(b.banco)} · pendientes</div>
              <div className="text-lg font-semibold tabular-nums mt-1">{ars(b.total)}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {b.cantidad} cheque{b.cantidad !== 1 ? 's' : ''}{b.financiamiento > 0 && ` · ${ars(b.financiamiento)} de financiamiento`}
              </div>
              {b.vencidos > 0 && (
                <div className="text-[11px] text-red-700 mt-1 flex items-center gap-1">
                  <AlertTriangle size={11} /> {b.vencidos} con fecha pasada sin marcar ({ars(b.total_vencidos)})
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-wrap gap-1.5">
          {['', ...chips].map(b => (
            <button key={b || 'todos'} onClick={() => setBanco(b)}
              className={cn('text-xs font-medium px-2.5 py-1 rounded-full border transition',
                banco === b ? 'bg-primary text-primary-foreground border-primary' : 'bg-white text-muted-foreground hover:bg-accent')}>
              {b ? bancoLabel(b) : 'Todos los bancos'}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-2 ml-auto">
          <select value={estado} onChange={e => setEstado(e.target.value as FiltroEstado)} className={selectCls}>
            <option value="PENDIENTE">Pendientes</option>
            <option value="COBRADO">Debitados</option>
            <option value="RECHAZADO">Rechazados</option>
            <option value="VENDIDO">Vendidos</option>
            <option value="TODOS">Todos</option>
          </select>
          <select value={tipo} onChange={e => setTipo(e.target.value as ChequesFiltros['tipo'] | '')} className={selectCls}>
            <option value="">Pagos y financiamiento</option>
            <option value="PAGO">Sólo pagos</option>
            <option value="FINANCIAMIENTO">Sólo financiamiento</option>
          </select>
          <input type="date" value={desde} onChange={e => setDesde(e.target.value)} className={selectCls} title="Fecha de pago desde" />
          <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className={selectCls} title="Fecha de pago hasta" />
          {(desde || hasta) && <button onClick={limpiarFechas} className="text-xs text-link hover:underline">Quitar fechas</button>}
          <input value={buscar} onChange={e => setBuscar(e.target.value)} placeholder="Buscar n° o concepto" className={selectCls + ' w-44'} />
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground text-center py-10">Cargando…</p>
      ) : cheques.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10">No hay cheques con estos filtros.</p>
      ) : (
        <div className="overflow-x-auto">
          <BaseTable className="w-full text-sm min-w-[900px]">
            <thead className="border-b bg-muted/30">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Fecha de pago</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">N° cheque</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Concepto</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Banco</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Monto</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Estado</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Entró</th>
                <th className="px-3 py-2 w-28" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {grupos.map(([fecha, items]) => {
                const totalDia = items.reduce((a, c) => a + (c.monto_ars ?? c.importe), 0);
                const vencido = fecha !== 'sin-fecha' && fecha < hoy;
                return [
                  <tr key={`g-${fecha}`} className="bg-muted/20">
                    <td colSpan={4} className={cn('px-3 py-1.5 text-xs font-semibold', vencido && items.some(c => c.estado === 'PENDIENTE') && 'text-red-700')}>
                      {fecha === 'sin-fecha' ? 'Sin fecha de pago' : diaSemana(fecha)}
                      <span className="font-normal text-muted-foreground ml-2">{items.length} cheque{items.length !== 1 ? 's' : ''}</span>
                    </td>
                    <td className="px-3 py-1.5 text-right text-xs font-semibold tabular-nums">{ars(totalDia)}</td>
                    <td colSpan={3} />
                  </tr>,
                  ...items.map(c => (
                    <tr key={c.id} className={cn('hover:bg-muted/10', c.tipo !== 'PAGO' && 'bg-green-50/60')}>
                      <td className="px-3 py-2 text-muted-foreground" data-label="Fecha de pago">{c.fecha_cobro_estimada ? formatDate(c.fecha_cobro_estimada) : '—'}</td>
                      <td className="px-3 py-2 font-mono text-xs" data-label="N°">{c.numero}{c.formato === 'FISICO' && <span className="ml-1 text-[10px] text-muted-foreground">(físico)</span>}</td>
                      <td className="px-3 py-2" data-label="Concepto">
                        <span className="font-medium">{c.razon_social ?? c.proveedor?.nombre ?? '—'}</span>
                        <TipoBadge tipo={c.tipo} />
                        <div className="text-[11px] text-muted-foreground">
                          {[c.sgr && `SGR ${c.sgr.nombre}`, c.detalle].filter(Boolean).join(' · ')}
                          {c.evento && <> {(c.sgr || c.detalle) && '· '}<Link to={`/eventos/${c.evento.id}?tab=echeqs`} className="text-link hover:underline">{c.evento.nombre}</Link></>}
                        </div>
                      </td>
                      <td className="px-3 py-2" data-label="Banco">{bancoLabel(c.banco)}</td>
                      <td className="px-3 py-2 text-right tabular-nums" data-label="Monto">{formatCurrency(c.importe, c.moneda)}</td>
                      <td className="px-3 py-2" data-label="Estado">
                        <Badge variant={ESTADO_VARIANT[c.estado]}>{ESTADO_LABEL[c.estado]}</Badge>
                        {c.motivo_rechazo && <div className="text-[11px] text-muted-foreground">{c.motivo_rechazo}</div>}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground" data-label="Entró">{c.fecha_cobro_real ? formatDate(c.fecha_cobro_real) : '—'}</td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {c.estado === 'PENDIENTE' && (
                            <Button variant="outline" size="sm" className="h-6 text-xs" onClick={() => setDebitar(c)} title="Marcar que entró al banco"><Check size={12} className="mr-1" />Debitado</Button>
                          )}
                          {(c.estado === 'COBRADO' || c.estado === 'RECHAZADO') && !c.movimiento_caja_id && (
                            <button title="Volver a pendiente" onClick={() => correr(() => accion.mutateAsync({ id: c.id, accion: 'reabrir' }))} className="p-1 rounded hover:bg-accent text-muted-foreground"><RotateCcw size={13} /></button>
                          )}
                          {c.estado === 'PENDIENTE' && (
                            <>
                              <button title="Editar" onClick={() => setDialog({ open: true, cheque: c })} className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"><Pencil size={13} /></button>
                              <button title="Rechazado / anulado" onClick={() => {
                                const motivo = window.prompt(`Motivo del rechazo o anulación del cheque ${c.numero}:`);
                                if (motivo !== null) correr(() => accion.mutateAsync({ id: c.id, accion: 'rechazar', motivo: motivo || null }));
                              }} className="p-1 rounded hover:bg-accent text-muted-foreground"><Ban size={13} /></button>
                              <button title="Eliminar (cargado por error)" onClick={() => {
                                if (window.confirm(`¿Eliminar el cheque ${c.numero}? Usalo sólo si se cargó por error.`)) correr(() => accion.mutateAsync({ id: c.id, accion: 'borrar' }));
                              }} className="p-1 rounded hover:bg-destructive/10 text-destructive"><Trash2 size={13} /></button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )),
                ];
              })}
            </tbody>
            <tfoot className="border-t">
              <tr>
                <td colSpan={4} className="px-3 py-2 text-xs font-semibold">Total ({cheques.length})</td>
                <td className="px-3 py-2 text-right text-xs font-semibold tabular-nums">{ars(totalListado)}</td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          </BaseTable>
        </div>
      )}

      <ChequeDialog open={dialog.open} cheque={dialog.cheque} bancos={bancos} bancoDefault={banco && banco !== SIN_BANCO ? banco : ''} onClose={() => setDialog({ open: false, cheque: null })} />
      {debitar && <DebitarDialog cheque={debitar} onClose={() => setDebitar(null)} />}
      {importando && <ImportarChequesDialog onClose={() => setImportando(false)} />}
    </div>
  );
}
