import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Plus, HandCoins, Pencil, Trash2, FileText, Undo2, Ban, X, ClipboardCheck, ShieldCheck, Banknote,
} from 'lucide-react';
import {
  useOrdenesPago, useOrdenPago, useGuardarOrdenPago, useAccionOrdenPago, useEliminarOrdenPago, useFacturasParaOrdenPago,
  pdfOrdenPagoUrl, type OrdenPagoPayload, type AccionOrdenPago,
} from '@/hooks/useOrdenesPago';
import { useProveedores } from '@/hooks/useProveedores';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Combobox } from '@/components/ui/combobox';
import MoneyInput from '@/components/ui/MoneyInput';
import BaseTable from '@/components/ui/BaseTable';
import PageHeader from '@/components/ui/PageHeader';
import TabStrip from '@/components/ui/TabStrip';
import { formatDate, formatCurrency } from '@/lib/formatters';
import { cn, getApiErrorMessage } from '@/lib/utils';
import type { EstadoOrdenPago, OrdenPagoDetalle, MedioPago, Moneda } from '@/types';

const inputCls  = 'w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring';
const labelCls  = 'block text-xs font-medium text-muted-foreground mb-0.5';
const selectCls = 'w-full border border-input rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring bg-white';

function hoyISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const num = (v: number | string | null | undefined) => (v == null || v === '' ? 0 : Number(v));
const r2 = (n: number) => Math.round(n * 100) / 100;

const ESTADO: Record<EstadoOrdenPago, { label: string; variant: 'muted' | 'info' | 'warning' | 'success' | 'destructive' }> = {
  BORRADOR:   { label: 'Borrador',   variant: 'muted' },
  REVISADA:   { label: 'Revisada',   variant: 'info' },
  AUTORIZADA: { label: 'Autorizada', variant: 'warning' },
  PAGADA:     { label: 'Pagada',     variant: 'success' },
  ANULADA:    { label: 'Anulada',    variant: 'destructive' },
};
const MEDIOS: { value: MedioPago; label: string }[] = [
  { value: 'ECHEQ', label: 'Echeq' }, { value: 'TRANSFERENCIA', label: 'Transferencia' },
  { value: 'CHEQUE', label: 'Cheque' }, { value: 'EFECTIVO', label: 'Efectivo' },
];
const MEDIO_LABEL = Object.fromEntries(MEDIOS.map(m => [m.value, m.label])) as Record<MedioPago, string>;
const BANCOS = ['GALICIA', 'NACION', 'BBVA', 'BANCOR', 'SANTANDER', 'MACRO', 'PROVINCIA'];

function EstadoBadge({ estado }: { estado: EstadoOrdenPago }) {
  return <Badge variant={ESTADO[estado].variant}>{ESTADO[estado].label}</Badge>;
}

// ── Editor (alta / edición de borrador) ──────────────────────────────────────

interface FilaMedio { medio_pago: MedioPago; numero: string; banco: string; fecha_pago: string; importe: string }
const MEDIO_VACIO = (): FilaMedio => ({ medio_pago: 'ECHEQ', numero: '', banco: 'GALICIA', fecha_pago: hoyISO(), importe: '' });

function OrdenEditor({ open, orden, onClose, onGuardada }: {
  open: boolean; orden: OrdenPagoDetalle | null; onClose: () => void; onGuardada: (id: number) => void;
}) {
  const guardar = useGuardarOrdenPago();
  const { data: proveedores = [] } = useProveedores({ activo: 'true' });
  const [fecha, setFecha] = useState(hoyISO());
  const [proveedorId, setProveedorId] = useState('');
  const [concepto, setConcepto] = useState('');
  const [notas, setNotas] = useState('');
  // factura_id → importe a pagar (sólo las tildadas)
  const [sel, setSel] = useState<Record<number, string>>({});
  const [medios, setMedios] = useState<FilaMedio[]>([MEDIO_VACIO()]);
  const [error, setError] = useState<string | null>(null);
  const { data: disponibles = [], isFetching } = useFacturasParaOrdenPago(proveedorId ? Number(proveedorId) : null, orden?.id ?? null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (orden) {
      setFecha(orden.fecha.slice(0, 10)); setProveedorId(String(orden.proveedor_id));
      setConcepto(orden.concepto ?? ''); setNotas(orden.notas ?? '');
      setSel(Object.fromEntries(orden.facturas.map(f => [f.factura_id, String(f.importe)])));
      setMedios(orden.medios.length ? orden.medios.map(m => ({
        medio_pago: m.medio_pago, numero: m.numero ?? '', banco: m.banco ?? '', fecha_pago: m.fecha_pago.slice(0, 10), importe: String(m.importe),
      })) : [MEDIO_VACIO()]);
    } else {
      setFecha(hoyISO()); setProveedorId(''); setConcepto(''); setNotas(''); setSel({}); setMedios([MEDIO_VACIO()]);
    }
  }, [open, orden]);

  const moneda: Moneda = disponibles.find(f => sel[f.id] != null)?.moneda ?? 'ARS';
  const totalFacturas = useMemo(() => r2(Object.values(sel).reduce((s, v) => s + num(v), 0)), [sel]);
  const totalPagos = useMemo(() => r2(medios.reduce((s, m) => s + num(m.importe), 0)), [medios]);
  const diferencia = r2(totalFacturas - totalPagos);

  const toggle = (id: number, pendiente: number) => setSel(p => {
    const n = { ...p };
    if (n[id] != null) delete n[id]; else n[id] = String(pendiente);
    return n;
  });
  const setMedio = (i: number, k: keyof FilaMedio, v: string) => setMedios(p => p.map((m, j) => (j === i ? { ...m, [k]: v } : m)));
  const completar = () => {
    if (diferencia <= 0) return;
    const vacio = medios.findIndex(m => !num(m.importe));
    if (vacio >= 0) setMedio(vacio, 'importe', String(diferencia));
    else setMedios(p => [...p, { ...MEDIO_VACIO(), importe: String(diferencia) }]);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null);
    if (!proveedorId) { setError('Elegí el proveedor'); return; }
    const facturas = Object.entries(sel).map(([id, v]) => ({ factura_id: Number(id), importe: num(v) }));
    if (facturas.length === 0) { setError('Tildá al menos una factura'); return; }
    const filas = medios.filter(m => num(m.importe) > 0 || m.numero.trim());
    const data: OrdenPagoPayload = {
      fecha, proveedor_id: Number(proveedorId), concepto: concepto || null, notas: notas || null, facturas,
      medios: filas.map(m => ({ medio_pago: m.medio_pago, numero: m.numero || null, banco: m.banco || null, fecha_pago: m.fecha_pago, importe: num(m.importe) })),
    };
    try {
      const r = await guardar.mutateAsync({ id: orden?.id, data });
      onGuardada(r.id);
    } catch (err) { setError(getApiErrorMessage(err)); }
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{orden ? `Editar ${orden.numero_formateado}` : 'Nueva orden de pago'}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4 mt-1">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className={labelCls}>Proveedor *</label>
              <Combobox
                options={proveedores.map(p => ({ value: String(p.id), label: p.cuit ? `${p.nombre} (${p.cuit})` : p.nombre }))}
                value={proveedorId || null} onChange={v => { setProveedorId(v); setSel({}); }} placeholder="Elegir proveedor…"
              />
            </div>
            <div><label className={labelCls}>Fecha *</label><input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className={inputCls} required /></div>
            <div className="sm:col-span-3"><label className={labelCls}>Concepto</label><input value={concepto} onChange={e => setConcepto(e.target.value)} className={inputCls} placeholder="Ej.: material para Cosquín Rock" /></div>
          </div>

          <section className="border-t pt-3 space-y-2">
            <h3 className="text-sm font-semibold">Facturas que se pagan</h3>
            {!proveedorId ? <p className="text-xs text-muted-foreground">Elegí el proveedor para ver sus facturas pendientes.</p>
              : isFetching && disponibles.length === 0 ? <p className="text-xs text-muted-foreground">Cargando…</p>
              : disponibles.length === 0 ? <p className="text-xs text-muted-foreground">Este proveedor no tiene facturas pendientes que no estén ya en otra orden abierta.</p>
              : (
                <div className="border rounded divide-y">
                  {disponibles.map(f => {
                    const on = sel[f.id] != null;
                    return (
                      <div key={f.id} className={cn('grid grid-cols-12 gap-2 items-center px-2 py-1.5 text-sm', on && 'bg-muted/30')}>
                        <label className="col-span-12 sm:col-span-6 flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={on} onChange={() => toggle(f.id, f.importe_pendiente)} />
                          <span>{f.tipo_factura} {f.numero_factura}</span>
                          <span className="text-xs text-muted-foreground">{formatDate(f.fecha_emision)}{f.evento ? ` · ${f.evento.nombre}` : ''}</span>
                        </label>
                        <span className="col-span-6 sm:col-span-3 text-xs text-muted-foreground sm:text-right">
                          Pendiente {formatCurrency(f.importe_pendiente, f.moneda)}{f.importe_pendiente !== f.importe_total && ` de ${formatCurrency(f.importe_total, f.moneda)}`}
                        </span>
                        <div className="col-span-6 sm:col-span-3">
                          {on && <MoneyInput value={sel[f.id]} onChange={v => setSel(p => ({ ...p, [f.id]: v }))} className={cn(inputCls, 'text-right')} />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
          </section>

          <section className="border-t pt-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">Cómo se paga</h3>
              <div className="flex gap-2">
                {diferencia > 0 && <Button type="button" size="sm" variant="ghost" onClick={completar}>Completar lo que falta</Button>}
                <Button type="button" size="sm" variant="outline" onClick={() => setMedios(p => [...p, MEDIO_VACIO()])}><Plus size={14} className="mr-1" /> Agregar</Button>
              </div>
            </div>
            <datalist id="op-bancos">{BANCOS.map(b => <option key={b} value={b} />)}</datalist>
            {medios.map((m, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-6 sm:col-span-2">{i === 0 && <label className={labelCls}>Medio</label>}
                  <select value={m.medio_pago} onChange={e => setMedio(i, 'medio_pago', e.target.value)} className={selectCls}>
                    {MEDIOS.map(x => <option key={x.value} value={x.value}>{x.label}</option>)}
                  </select>
                </div>
                <div className="col-span-6 sm:col-span-2">{i === 0 && <label className={labelCls}>Número</label>}
                  <input value={m.numero} onChange={e => setMedio(i, 'numero', e.target.value)} className={inputCls} placeholder={m.medio_pago === 'ECHEQ' || m.medio_pago === 'CHEQUE' ? 'Obligatorio' : 'Opcional'} />
                </div>
                <div className="col-span-6 sm:col-span-2">{i === 0 && <label className={labelCls}>Banco</label>}
                  <input list="op-bancos" value={m.banco} onChange={e => setMedio(i, 'banco', e.target.value)} className={inputCls} />
                </div>
                <div className="col-span-6 sm:col-span-2">{i === 0 && <label className={labelCls}>Fecha de pago</label>}
                  <input type="date" value={m.fecha_pago} onChange={e => setMedio(i, 'fecha_pago', e.target.value)} className={inputCls} />
                </div>
                <div className="col-span-10 sm:col-span-3">{i === 0 && <label className={labelCls}>Importe</label>}
                  <MoneyInput value={m.importe} onChange={v => setMedio(i, 'importe', v)} className={cn(inputCls, 'text-right')} />
                </div>
                <div className="col-span-2 sm:col-span-1 flex justify-end">
                  <Button type="button" variant="ghost" size="icon" title="Quitar" onClick={() => setMedios(p => (p.length === 1 ? [MEDIO_VACIO()] : p.filter((_, j) => j !== i)))}><X size={14} /></Button>
                </div>
              </div>
            ))}
            <div className="ml-auto w-full sm:w-80 text-sm space-y-1 border rounded p-2">
              <div className="flex justify-between"><span className="text-muted-foreground">Total a pagar</span><span className="tabular-nums">{formatCurrency(totalFacturas, moneda)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Total pagado</span><span className="tabular-nums">{formatCurrency(totalPagos, moneda)}</span></div>
              <div className={cn('flex justify-between font-semibold border-t pt-1', Math.abs(diferencia) <= 1 ? 'text-green-700' : 'text-amber-700')}>
                <span>{Math.abs(diferencia) <= 1 ? 'Cierra' : diferencia > 0 ? 'Falta asignar' : 'Sobra'}</span>
                {Math.abs(diferencia) > 1 && <span className="tabular-nums">{formatCurrency(Math.abs(diferencia), moneda)}</span>}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Se puede guardar el borrador aunque no cierre; para revisarla, el total pagado tiene que coincidir con el total a pagar.</p>
          </section>

          <div><label className={labelCls}>Notas (salen en el PDF)</label><textarea value={notas} onChange={e => setNotas(e.target.value)} className={inputCls} rows={2} /></div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={guardar.isPending}>{guardar.isPending ? 'Guardando…' : 'Guardar borrador'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Detalle: firmas y pago ───────────────────────────────────────────────────

function OrdenDetalle({ id, onClose, onEditar }: { id: number; onClose: () => void; onEditar: (o: OrdenPagoDetalle) => void }) {
  const { data: o, isLoading } = useOrdenPago(id);
  const accion = useAccionOrdenPago();
  const eliminar = useEliminarOrdenPago();
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { setError(null); }, [id, o?.estado]);

  if (isLoading || !o) {
    return <Dialog open onOpenChange={x => !x && onClose()}><DialogContent><p className="text-sm text-muted-foreground">Cargando…</p></DialogContent></Dialog>;
  }
  const run = async (p: Promise<unknown>) => { setError(null); try { await p; } catch (err) { setError(getApiErrorMessage(err)); } };
  const hacer = (a: AccionOrdenPago, confirmar?: string) => { if (confirmar && !window.confirm(confirmar)) return; run(accion.mutateAsync({ id, accion: a })); };
  const m = o.moneda;
  const p = o.proveedor;
  const firma = (titulo: string, nombre: string | null, fecha?: string | null) => (
    <div className="rounded border p-2">
      <p className="text-xs text-muted-foreground">{titulo}</p>
      <p className="text-sm font-medium">{nombre ?? '—'}</p>
      {fecha && <p className="text-xs text-muted-foreground">{formatDate(fecha)}</p>}
    </div>
  );

  return (
    <Dialog open onOpenChange={x => !x && onClose()}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">{o.numero_formateado} — {p.nombre} <EstadoBadge estado={o.estado} /></DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap gap-2 mt-1">
          <Button size="sm" variant="outline" onClick={() => window.open(pdfOrdenPagoUrl(o.id), '_blank')}><FileText size={14} className="mr-1.5" /> PDF</Button>
          {o.estado === 'BORRADOR' && <Button size="sm" variant="outline" onClick={() => onEditar(o)}><Pencil size={14} className="mr-1.5" /> Editar</Button>}
          {o.estado === 'BORRADOR' && <Button size="sm" onClick={() => hacer('revisar')} disabled={!o.cierra}><ClipboardCheck size={14} className="mr-1.5" /> Marcar revisada</Button>}
          {o.estado === 'REVISADA' && o.puede_autorizar && <Button size="sm" onClick={() => hacer('autorizar')}><ShieldCheck size={14} className="mr-1.5" /> Autorizar</Button>}
          {o.estado === 'AUTORIZADA' && (
            <Button size="sm" onClick={() => hacer('pagar', `Se van a registrar los pagos en ${o.facturas.length} factura(s)${o.medios.some(x => x.medio_pago === 'ECHEQ') ? ' y los echeqs en Cheques' : ''}. ¿Confirmar?`)}>
              <Banknote size={14} className="mr-1.5" /> Registrar el pago
            </Button>
          )}
          {(o.estado === 'REVISADA' || o.estado === 'AUTORIZADA') && <Button size="sm" variant="outline" onClick={() => hacer('volver-borrador', 'Se borran las firmas de revisión y autorización. ¿Volver a borrador?')}><Undo2 size={14} className="mr-1.5" /> Volver a borrador</Button>}
          {['BORRADOR', 'REVISADA', 'AUTORIZADA'].includes(o.estado) && (
            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => hacer('anular', '¿Anular la orden de pago?')}><Ban size={14} className="mr-1.5" /> Anular</Button>
          )}
          {o.estado === 'BORRADOR' && (
            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => { if (window.confirm('¿Eliminar el borrador?')) run(eliminar.mutateAsync(o.id).then(onClose)); }}><Trash2 size={14} className="mr-1.5" /> Eliminar</Button>
          )}
        </div>
        {o.estado === 'BORRADOR' && !o.cierra && <p className="text-xs text-amber-700 mt-2">El total pagado no coincide con el total a pagar ({formatCurrency(o.diferencia, m)} de diferencia). Editala para poder revisarla.</p>}
        {o.estado === 'REVISADA' && !o.puede_autorizar && <p className="text-xs text-muted-foreground mt-2">La autoriza el administrador general o quien tenga el permiso de aprobar pagos.</p>}
        {error && <p className="text-xs text-destructive mt-2">{error}</p>}

        <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2 text-sm mt-3">
          <p><span className="text-muted-foreground">Fecha:</span> {formatDate(o.fecha)}</p>
          <p><span className="text-muted-foreground">CUIT:</span> {p.cuit ?? '—'}</p>
          <p className="sm:col-span-2"><span className="text-muted-foreground">Concepto:</span> {o.concepto ?? '—'}</p>
          {(p.cbu || p.alias_bancario) && (
            <p className="sm:col-span-2"><span className="text-muted-foreground">Datos bancarios:</span> {[p.banco, p.cbu && `CBU ${p.cbu}`, p.alias_bancario && `Alias ${p.alias_bancario}`].filter(Boolean).join(' · ')}</p>
          )}
          {o.notas && <p className="sm:col-span-2"><span className="text-muted-foreground">Notas:</span> {o.notas}</p>}
        </div>

        <div className="grid gap-3 md:grid-cols-2 mt-3">
          <section>
            <h3 className="text-sm font-semibold mb-1">Facturas</h3>
            <ul className="text-sm divide-y border rounded">
              {o.facturas.map(f => (
                <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 px-2 py-1.5">
                  <span>
                    <Link to={`/facturas/${f.factura_id}`} className="underline">{f.factura.tipo_factura} {f.factura.numero_factura}</Link>
                    <span className="block text-xs text-muted-foreground">{formatDate(f.factura.fecha_emision)}{f.importe !== f.factura.importe_total && ` · total ${formatCurrency(f.factura.importe_total, m)}`}</span>
                  </span>
                  <span className="tabular-nums">{formatCurrency(f.importe, m)}</span>
                </li>
              ))}
              <li className="flex justify-between px-2 py-1.5 font-semibold"><span>Total a pagar</span><span className="tabular-nums">{formatCurrency(o.total_facturas, m)}</span></li>
            </ul>
          </section>
          <section>
            <h3 className="text-sm font-semibold mb-1">Cómo se paga</h3>
            <ul className="text-sm divide-y border rounded">
              {o.medios.length === 0 && <li className="px-2 py-1.5 text-muted-foreground text-xs">Sin cargar todavía.</li>}
              {o.medios.map(x => (
                <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 px-2 py-1.5">
                  <span>{MEDIO_LABEL[x.medio_pago]}{x.numero && ` N° ${x.numero}`}{x.banco && <span className="text-muted-foreground"> · {x.banco}</span>}
                    <span className="block text-xs text-muted-foreground">{formatDate(x.fecha_pago)}</span>
                  </span>
                  <span className="tabular-nums">{formatCurrency(x.importe, m)}</span>
                </li>
              ))}
              <li className={cn('flex justify-between px-2 py-1.5 font-semibold', !o.cierra && 'text-amber-700')}><span>Total pagado</span><span className="tabular-nums">{formatCurrency(o.total_pagos, m)}</span></li>
            </ul>
          </section>
        </div>

        <div className="grid gap-2 sm:grid-cols-3 mt-3">
          {firma('Elaborado por', o.elaborado_nombre)}
          {firma('Revisado por', o.revisado_nombre, o.revisado_at)}
          {firma('Autorizado por', o.autorizado_nombre, o.autorizado_at)}
        </div>

        {o.estado === 'PAGADA' && (
          <section className="border rounded-lg p-3 mt-3 text-sm space-y-1">
            <h3 className="font-semibold">Pagos registrados {o.pagada_at && <span className="font-normal text-muted-foreground">el {formatDate(o.pagada_at)}</span>}</h3>
            {o.pagos.map(pg => {
              const f = o.facturas.find(x => x.factura_id === pg.factura_id)?.factura;
              return (
                <p key={pg.id} className="flex justify-between gap-2">
                  <span>{f ? `${f.tipo_factura} ${f.numero_factura}` : 'Factura'} — {MEDIO_LABEL[pg.medio_pago]}{pg.echeq_id ? ' (echeq en Cheques)' : ''}</span>
                  <span className="tabular-nums">{formatCurrency(pg.importe, m)}</span>
                </p>
              );
            })}
            <p className="text-xs text-muted-foreground pt-1">Cada pago quedó en su factura (Facturas a Pagar). Si hay que corregir uno, se anula desde la factura.</p>
          </section>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Página ───────────────────────────────────────────────────────────────────

type FiltroEstado = 'TODAS' | EstadoOrdenPago;

export default function OrdenesPagoPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [estado, setEstado] = useState<FiltroEstado>('TODAS');
  const [q, setQ] = useState('');
  const { data: ordenes = [], isLoading } = useOrdenesPago({ ...(estado !== 'TODAS' && { estado }), ...(q.trim() && { q: q.trim() }) });

  const abrirParam = searchParams.get('abrir');
  const [detalleId, setDetalleId] = useState<number | null>(abrirParam ? Number(abrirParam) : null);
  const [editor, setEditor] = useState<{ orden: OrdenPagoDetalle | null } | null>(null);

  const cerrarDetalle = () => {
    setDetalleId(null);
    if (searchParams.get('abrir')) { searchParams.delete('abrir'); setSearchParams(searchParams, { replace: true }); }
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <PageHeader
        title="Órdenes de pago"
        subtitle="Facturas de un proveedor que se pagan juntas, con el echeq o la transferencia de cada parte, y quién la elaboró, revisó y autorizó. Al registrar el pago, queda en cada factura."
        actions={<Button size="sm" onClick={() => setEditor({ orden: null })}><Plus size={14} className="mr-1.5" /> Nueva orden</Button>}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <TabStrip<FiltroEstado>
          variant="pill" value={estado} onChange={setEstado}
          items={[
            { key: 'TODAS', label: 'Todas' }, { key: 'BORRADOR', label: 'Borradores' }, { key: 'REVISADA', label: 'Revisadas' },
            { key: 'AUTORIZADA', label: 'Autorizadas' }, { key: 'PAGADA', label: 'Pagadas' }, { key: 'ANULADA', label: 'Anuladas' },
          ]}
        />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar proveedor, factura o n° de echeq" className={cn(inputCls, 'w-full sm:w-72')} />
      </div>

      {isLoading ? <p className="text-sm text-muted-foreground">Cargando…</p> : ordenes.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <HandCoins size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No hay órdenes de pago{estado !== 'TODAS' || q ? ' con este filtro' : ''}.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <BaseTable className="w-full text-sm min-w-[760px]">
            <thead className="border-b bg-muted/30">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Nº</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Fecha</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Proveedor</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Medios</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Total</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {ordenes.map(o => (
                <tr key={o.id} className="hover:bg-muted/20 cursor-pointer" onClick={() => setDetalleId(o.id)}>
                  <td className="px-3 py-2.5 font-mono font-medium" data-label="Nº">{o.numero_formateado}</td>
                  <td className="px-3 py-2.5 text-muted-foreground" data-label="Fecha">{formatDate(o.fecha)}</td>
                  <td className="px-3 py-2.5" data-label="Proveedor">{o.proveedor.nombre}
                    <span className="block text-xs text-muted-foreground">{o.cant_facturas} factura{o.cant_facturas === 1 ? '' : 's'}{o.concepto ? ` · ${o.concepto}` : ''}</span>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground" data-label="Medios">{o.medios.join(', ') || '—'}</td>
                  <td className={cn('px-3 py-2.5 text-right tabular-nums', Math.abs(o.total_facturas - o.total_pagos) > 1 && o.estado === 'BORRADOR' && 'text-amber-700')} data-label="Total">
                    {formatCurrency(o.total_facturas, o.moneda)}
                  </td>
                  <td className="px-3 py-2.5" data-label="Estado"><EstadoBadge estado={o.estado} /></td>
                </tr>
              ))}
            </tbody>
          </BaseTable>
        </div>
      )}

      {detalleId != null && !editor && <OrdenDetalle id={detalleId} onClose={cerrarDetalle} onEditar={orden => setEditor({ orden })} />}
      <OrdenEditor
        open={!!editor} orden={editor?.orden ?? null}
        onClose={() => setEditor(null)}
        onGuardada={id => { setEditor(null); setDetalleId(id); }}
      />
    </div>
  );
}
