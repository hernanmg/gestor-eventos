import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Scale, Pencil, Trash2, FileText, Ban, RotateCcw, X, CheckCircle2, ShoppingCart } from 'lucide-react';
import {
  useComparativos, useComparativo, useGuardarComparativo, useEliminarComparativo, useElegirCotizacion,
  useAccionComparativo, useArmarOrdenCompra, pdfComparativoUrl, type ComparativoPayload,
} from '@/hooks/useComparativos';
import { useProveedores } from '@/hooks/useProveedores';
import { useEventos } from '@/hooks/useEvento';
import { useAuth } from '@/hooks/useAuth';
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
import type { ComparativoDetalle, EstadoComparativo, Moneda } from '@/types';

// Comparativo de presupuestos de proveedores: los mismos artículos cotizados
// por varios proveedores, el cuadro para decidir, y la orden de compra con la
// cotización elegida.

const inputCls  = 'w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring';
const cellCls   = 'w-full border rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring';
const labelCls  = 'block text-xs font-medium text-muted-foreground mb-0.5';
const selectCls = 'w-full border border-input rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring bg-white';

function hoyISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const num = (v: number | string | null | undefined) => (v == null || v === '' ? 0 : Number(v));
const fmtCant = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 2 });
const r2 = (n: number) => Math.round(n * 100) / 100;

const ESTADO: Record<EstadoComparativo, { label: string; variant: 'info' | 'success' | 'destructive' }> = {
  ABIERTO:  { label: 'Abierto',  variant: 'info' },
  DECIDIDO: { label: 'Decidido', variant: 'success' },
  ANULADO:  { label: 'Anulado',  variant: 'destructive' },
};
const EstadoBadge = ({ estado }: { estado: EstadoComparativo }) => <Badge variant={ESTADO[estado].variant}>{ESTADO[estado].label}</Badge>;

// ── Editor: artículos en filas, un proveedor por columna ─────────────────────

interface FilaArt { codigo: string; descripcion: string; cantidad: string }
interface ColCot {
  proveedor_id: string; referencia: string; plazo_entrega: string; plazo_pago: string; forma_pago: string; validez: string; iva: string;
  precios: string[];
}
const ART_VACIO: FilaArt = { codigo: '', descripcion: '', cantidad: '' };
const colVacia = (n: number): ColCot => ({ proveedor_id: '', referencia: '', plazo_entrega: '', plazo_pago: '', forma_pago: '', validez: '', iva: '21', precios: Array(n).fill('') });

function ComparativoEditor({ open, comp, onClose, onGuardado }: {
  open: boolean; comp: ComparativoDetalle | null; onClose: () => void; onGuardado: (id: number) => void;
}) {
  const guardar = useGuardarComparativo();
  const { data: proveedores = [] } = useProveedores({ activo: 'true' });
  const { data: eventos = [] } = useEventos();
  const [titulo, setTitulo] = useState('');
  const [fecha, setFecha] = useState(hoyISO());
  const [eventoId, setEventoId] = useState('');
  const [moneda, setMoneda] = useState<Moneda>('ARS');
  const [notas, setNotas] = useState('');
  const [arts, setArts] = useState<FilaArt[]>([{ ...ART_VACIO }]);
  const [cols, setCols] = useState<ColCot[]>([colVacia(1), colVacia(1)]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (comp) {
      setTitulo(comp.titulo); setFecha(comp.fecha.slice(0, 10)); setEventoId(comp.evento_id ? String(comp.evento_id) : '');
      setMoneda(comp.moneda); setNotas(comp.notas ?? '');
      setArts(comp.items.map(i => ({ codigo: i.codigo ?? '', descripcion: i.descripcion, cantidad: String(i.cantidad) })));
      setCols(comp.cotizaciones.length ? comp.cotizaciones.map(q => ({
        proveedor_id: String(q.proveedor_id), referencia: q.referencia ?? '', plazo_entrega: q.plazo_entrega ?? '', plazo_pago: q.plazo_pago ?? '',
        forma_pago: q.forma_pago ?? '', validez: q.validez ?? '', iva: String(q.iva_porcentaje),
        precios: comp.items.map((_, i) => (q.precios[i] != null ? String(q.precios[i]) : '')),
      })) : [colVacia(comp.items.length)]);
    } else {
      setTitulo(''); setFecha(hoyISO()); setEventoId(''); setMoneda('ARS'); setNotas('');
      setArts([{ ...ART_VACIO }]); setCols([colVacia(1), colVacia(1)]);
    }
  }, [open, comp]);

  const agregarArt = () => { setArts(p => [...p, { ...ART_VACIO }]); setCols(p => p.map(c => ({ ...c, precios: [...c.precios, ''] }))); };
  const quitarArt = (i: number) => {
    if (arts.length === 1) { setArts([{ ...ART_VACIO }]); setCols(p => p.map(c => ({ ...c, precios: [''] }))); return; }
    setArts(p => p.filter((_, j) => j !== i)); setCols(p => p.map(c => ({ ...c, precios: c.precios.filter((_, j) => j !== i) })));
  };
  const setArt = (i: number, k: keyof FilaArt, v: string) => setArts(p => p.map((a, j) => (j === i ? { ...a, [k]: v } : a)));
  const setCol = (k: number, campo: keyof Omit<ColCot, 'precios'>, v: string) => setCols(p => p.map((c, j) => (j === k ? { ...c, [campo]: v } : c)));
  const setPrecio = (k: number, i: number, v: string) => setCols(p => p.map((c, j) => (j === k ? { ...c, precios: c.precios.map((x, n) => (n === i ? v : x)) } : c)));

  const totales = useMemo(() => cols.map(c => {
    const sub = r2(arts.reduce((n, a, i) => n + (c.precios[i] !== '' ? num(a.cantidad) * num(c.precios[i]) : 0), 0));
    return { sub, total: r2(sub + r2(sub * num(c.iva) / 100)) };
  }), [cols, arts]);

  const usados = new Set(cols.map(c => c.proveedor_id).filter(Boolean));

  const submit = async () => {
    setError(null);
    if (!titulo.trim()) { setError('Poné qué se compra'); return; }
    const filas = arts.map((a, i) => ({ a, i })).filter(({ a }) => a.descripcion.trim() || a.cantidad);
    if (!filas.length) { setError('Cargá al menos un artículo'); return; }
    if (filas.some(({ a }) => !a.descripcion.trim() || num(a.cantidad) <= 0)) { setError('Cada artículo necesita descripción y cantidad'); return; }
    // Columnas vacías (sin proveedor ni precios) se ignoran
    const columnas = cols.filter(c => c.proveedor_id || c.precios.some(p => p !== ''));
    if (columnas.some(c => !c.proveedor_id)) { setError('Hay una columna con precios y sin proveedor'); return; }
    if (columnas.some(c => filas.every(({ i }) => c.precios[i] === ''))) { setError('Hay un proveedor sin ningún precio'); return; }
    const data: ComparativoPayload = {
      fecha, titulo: titulo.trim(), evento_id: eventoId ? Number(eventoId) : null, moneda, notas: notas || null,
      items: filas.map(({ a }) => ({ codigo: a.codigo || null, descripcion: a.descripcion.trim(), cantidad: num(a.cantidad) })),
      cotizaciones: columnas.map(c => ({
        proveedor_id: Number(c.proveedor_id), referencia: c.referencia || null, plazo_entrega: c.plazo_entrega || null,
        plazo_pago: c.plazo_pago || null, forma_pago: c.forma_pago || null, validez: c.validez || null, iva_porcentaje: num(c.iva),
        precios: filas.map(({ i }) => (c.precios[i] === '' ? null : num(c.precios[i]))),
      })),
    };
    try {
      const r = await guardar.mutateAsync({ id: comp?.id, data });
      onGuardado(comp?.id ?? r.id);
    } catch (err) { setError(getApiErrorMessage(err)); }
  };

  const condicion = (label: string, campo: keyof Omit<ColCot, 'precios'>, ph?: string) => (
    <tr>
      <td colSpan={3} className="px-2 py-1 text-right text-xs text-muted-foreground">{label}</td>
      {cols.map((c, k) => <td key={k} className="px-1 py-1"><input value={c[campo]} onChange={e => setCol(k, campo, e.target.value)} className={cellCls} placeholder={ph} /></td>)}
      <td />
    </tr>
  );

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-6xl max-h-[92vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{comp ? `Editar ${comp.numero_formateado}` : 'Nuevo comparativo'}</DialogTitle></DialogHeader>
        <div className="space-y-4 mt-1">
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="sm:col-span-2"><label className={labelCls}>Qué se compra *</label><input value={titulo} onChange={e => setTitulo(e.target.value)} className={inputCls} placeholder="Caños para la estructura del escenario" /></div>
            <div><label className={labelCls}>Fecha *</label><input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className={inputCls} /></div>
            <div>
              <label className={labelCls}>Moneda</label>
              <select value={moneda} onChange={e => setMoneda(e.target.value as Moneda)} className={selectCls}>
                <option value="ARS">ARS</option><option value="USD">USD</option><option value="EUR">EUR</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Evento (opcional)</label>
              <Combobox options={[{ value: '', label: 'Sin evento' }, ...eventos.map(e => ({ value: String(e.id), label: e.nombre }))]} value={eventoId} onChange={setEventoId} placeholder="Sin evento" />
            </div>
            <div className="sm:col-span-2"><label className={labelCls}>Notas</label><input value={notas} onChange={e => setNotas(e.target.value)} className={inputCls} placeholder="Precios con flete incluido…" /></div>
          </div>

          <div className="border-t pt-3 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">Artículos y precios unitarios</h3>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="outline" onClick={agregarArt}><Plus size={14} className="mr-1" /> Artículo</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setCols(p => [...p, colVacia(arts.length)])}><Plus size={14} className="mr-1" /> Proveedor</Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Dejá vacío el precio de lo que un proveedor no cotizó. El IVA y las condiciones de cada uno van abajo.</p>
            <div className="overflow-x-auto">
              <table className="text-sm border-collapse" style={{ minWidth: 420 + cols.length * 170 }}>
                <thead>
                  <tr className="border-b bg-muted/30 align-bottom">
                    <th className="px-2 py-1.5 text-left text-xs font-medium text-muted-foreground w-24">Código</th>
                    <th className="px-2 py-1.5 text-left text-xs font-medium text-muted-foreground min-w-[220px]">Artículo *</th>
                    <th className="px-2 py-1.5 text-right text-xs font-medium text-muted-foreground w-20">Cant.</th>
                    {cols.map((c, k) => (
                      <th key={k} className="px-1 py-1.5 w-[170px]">
                        <div className="flex items-center gap-1">
                          <div className="flex-1 min-w-0">
                            <Combobox
                              options={proveedores.filter(p => !usados.has(String(p.id)) || String(p.id) === c.proveedor_id).map(p => ({ value: String(p.id), label: p.nombre }))}
                              value={c.proveedor_id || null} onChange={v => setCol(k, 'proveedor_id', v)} placeholder="Proveedor…" className="h-8 text-xs w-full"
                            />
                          </div>
                          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" title="Quitar proveedor"
                            onClick={() => setCols(p => (p.length === 1 ? [colVacia(arts.length)] : p.filter((_, j) => j !== k)))}><X size={13} /></Button>
                        </div>
                      </th>
                    ))}
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {arts.map((a, i) => (
                    <tr key={i}>
                      <td className="px-1 py-1"><input value={a.codigo} onChange={e => setArt(i, 'codigo', e.target.value)} className={cellCls} /></td>
                      <td className="px-1 py-1"><input value={a.descripcion} onChange={e => setArt(i, 'descripcion', e.target.value)} className={cellCls} /></td>
                      <td className="px-1 py-1"><input type="number" step="any" min="0" value={a.cantidad} onChange={e => setArt(i, 'cantidad', e.target.value)} className={cn(cellCls, 'text-right')} /></td>
                      {cols.map((c, k) => (
                        <td key={k} className="px-1 py-1"><MoneyInput value={c.precios[i] ?? ''} onChange={v => setPrecio(k, i, v)} className={cn(cellCls, 'text-right')} placeholder="no cotizó" /></td>
                      ))}
                      <td className="px-1"><Button type="button" variant="ghost" size="icon" className="h-7 w-7" title="Quitar artículo" onClick={() => quitarArt(i)}><X size={13} /></Button></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2">
                  <tr>
                    <td colSpan={3} className="px-2 py-1.5 text-right text-xs font-semibold">Total con IVA</td>
                    {totales.map((t, k) => <td key={k} className="px-2 py-1.5 text-right text-sm font-semibold tabular-nums">{formatCurrency(t.total, moneda)}</td>)}
                    <td />
                  </tr>
                  <tr>
                    <td colSpan={3} className="px-2 py-1 text-right text-xs text-muted-foreground">IVA %</td>
                    {cols.map((c, k) => <td key={k} className="px-1 py-1"><input type="number" step="0.5" min="0" value={c.iva} onChange={e => setCol(k, 'iva', e.target.value)} className={cn(cellCls, 'text-right')} /></td>)}
                    <td />
                  </tr>
                  {condicion('N° de presupuesto', 'referencia')}
                  {condicion('Entrega', 'plazo_entrega', '48 hs')}
                  {condicion('Plazo de pago', 'plazo_pago', '30 días')}
                  {condicion('Forma de pago', 'forma_pago', 'Echeq')}
                  {condicion('Validez', 'validez', '15 días')}
                </tfoot>
              </table>
            </div>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button type="button" size="sm" onClick={submit} disabled={guardar.isPending}>{guardar.isPending ? 'Guardando…' : 'Guardar'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Detalle: el cuadro, la elección y la orden de compra ─────────────────────

function ComparativoVista({ id, onClose, onEditar }: { id: number; onClose: () => void; onEditar: (c: ComparativoDetalle) => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.rol === 'ADMIN';
  const canCargar = isAdmin || user?.rol === 'OPERADOR';
  const { data: c, isLoading } = useComparativo(id);
  const elegir = useElegirCotizacion();
  const accion = useAccionComparativo();
  const eliminar = useEliminarComparativo();
  const armar = useArmarOrdenCompra();
  const [eligiendo, setEligiendo] = useState<number | null>(null);
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => { setEligiendo(null); setMotivo(''); setError(null); }, [id, c?.estado]);

  if (isLoading || !c) {
    return <Dialog open onOpenChange={x => !x && onClose()}><DialogContent><DialogTitle className="sr-only">Cargando</DialogTitle><p className="text-sm text-muted-foreground">Cargando…</p></DialogContent></Dialog>;
  }

  const m = c.moneda;
  const a = c.analisis;
  const info = (qid: number) => a.cotizaciones.find(x => x.id === qid)!;
  const run = async (p: Promise<unknown>) => { setError(null); try { await p; } catch (err) { setError(getApiErrorMessage(err)); } };
  const pedirEleccion = (qid: number) => {
    const necesitaMotivo = !a.mas_baratas.includes(qid) || !info(qid).completa;
    if (!necesitaMotivo) {
      const q = c.cotizaciones.find(x => x.id === qid)!;
      if (window.confirm(`¿Elegir a ${q.proveedor.nombre} por ${formatCurrency(q.total, m)}?`)) run(elegir.mutateAsync({ id, cotizacion_id: qid }));
      return;
    }
    setEligiendo(qid); setMotivo('');
  };
  const armarOC = () => run(armar.mutateAsync(id).then(r => {
    setAviso(`Se armó la ${r.numero} en borrador${r.articulos_sin_precio ? ` (sin ${r.articulos_sin_precio} artículo${r.articulos_sin_precio === 1 ? '' : 's'} que ese proveedor no cotizó)` : ''}. Revisala y emitila desde Órdenes de compra.`);
  }));
  const elegida = c.cotizaciones.find(q => q.id === c.cotizacion_elegida_id);
  const multi = c.cotizaciones.length > 1;

  return (
    <Dialog open onOpenChange={x => !x && onClose()}>
      <DialogContent className="max-w-6xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">{c.numero_formateado} — {c.titulo} <EstadoBadge estado={c.estado} /></DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap gap-2 mt-1">
          <Button size="sm" variant="outline" onClick={() => window.open(pdfComparativoUrl(c.id), '_blank')}><FileText size={14} className="mr-1.5" /> PDF</Button>
          {c.estado === 'ABIERTO' && canCargar && <Button size="sm" variant="outline" onClick={() => onEditar(c)}><Pencil size={14} className="mr-1.5" /> Editar</Button>}
          {c.estado === 'DECIDIDO' && isAdmin && !c.orden_compra && <Button size="sm" onClick={armarOC} disabled={armar.isPending}><ShoppingCart size={14} className="mr-1.5" /> Armar orden de compra</Button>}
          {c.orden_compra && <Button size="sm" variant="outline" onClick={() => navigate(`/ordenes-compra?abrir=${c.orden_compra!.id}`)}><ShoppingCart size={14} className="mr-1.5" /> Ver {c.orden_compra.numero}</Button>}
          {(c.estado === 'DECIDIDO' || c.estado === 'ANULADO') && isAdmin && !c.orden_compra && <Button size="sm" variant="outline" onClick={() => run(accion.mutateAsync({ id, accion: 'reabrir' }))}><RotateCcw size={14} className="mr-1.5" /> Reabrir</Button>}
          {c.estado !== 'ANULADO' && isAdmin && !c.orden_compra && (
            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => { if (window.confirm('¿Anular el comparativo?')) run(accion.mutateAsync({ id, accion: 'anular' })); }}><Ban size={14} className="mr-1.5" /> Anular</Button>
          )}
          {c.estado === 'ABIERTO' && canCargar && (
            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => { if (window.confirm('¿Eliminar el comparativo?')) run(eliminar.mutateAsync(c.id).then(onClose)); }}><Trash2 size={14} className="mr-1.5" /> Eliminar</Button>
          )}
        </div>
        {error && <p className="text-xs text-destructive mt-2">{error}</p>}
        {aviso && <p className="text-xs text-green-700 mt-2">{aviso}</p>}

        <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2 text-sm mt-3">
          <p><span className="text-muted-foreground">Fecha:</span> {formatDate(c.fecha)}</p>
          <p><span className="text-muted-foreground">Evento:</span> {c.evento ? <Link className="underline" to={`/eventos/${c.evento.id}`}>{c.evento.nombre}</Link> : '—'}</p>
          {c.notas && <p className="sm:col-span-2"><span className="text-muted-foreground">Notas:</span> {c.notas}</p>}
        </div>

        {c.cotizaciones.length === 0 ? (
          <p className="text-sm text-muted-foreground mt-3">Todavía no hay cotizaciones: "Editar" para cargar los precios de cada proveedor.</p>
        ) : (
          <div className="overflow-x-auto mt-3">
            <BaseTable className="w-full text-sm" style={{ minWidth: 380 + c.cotizaciones.length * 160 }}>
              <thead className="border-b bg-muted/30">
                <tr className="align-bottom">
                  <th className="px-2 py-1.5 text-left text-xs font-medium text-muted-foreground">Nº</th>
                  <th className="px-2 py-1.5 text-left text-xs font-medium text-muted-foreground">Artículo</th>
                  <th className="px-2 py-1.5 text-right text-xs font-medium text-muted-foreground">Cant.</th>
                  {c.cotizaciones.map(q => (
                    <th key={q.id} className={cn('px-2 py-1.5 text-right text-xs font-medium', q.id === c.cotizacion_elegida_id ? 'text-green-800 bg-green-50' : 'text-muted-foreground')}>
                      <Link className="underline text-foreground" to={`/proveedores/${q.proveedor.id}`}>{q.proveedor.nombre}</Link>
                      {q.referencia && <span className="block font-normal">Ref. {q.referencia}</span>}
                      {q.id === c.cotizacion_elegida_id && <span className="block font-semibold">Elegido</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {c.items.map((it, i) => (
                  <tr key={it.id}>
                    <td className="px-2 py-1.5" data-label="Nº">{it.orden_item}</td>
                    <td className="px-2 py-1.5" data-label="Artículo">{it.codigo && <span className="font-mono text-xs text-muted-foreground mr-1">{it.codigo}</span>}{it.descripcion}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums" data-label="Cant.">{fmtCant(it.cantidad)}</td>
                    {c.cotizaciones.map(q => {
                      const p = q.precios[i];
                      const esMin = multi && p != null && a.minimos[i] != null && Math.abs(p - a.minimos[i]!) < 0.005;
                      return (
                        <td key={q.id} className={cn('px-2 py-1.5 text-right tabular-nums', esMin && 'bg-green-50 font-semibold text-green-800')} data-label={q.proveedor.nombre}>
                          {p == null ? <span className="text-xs text-muted-foreground">no cotizó</span> : (
                            <>{formatCurrency(p, m)}<span className="block text-xs font-normal text-muted-foreground">{formatCurrency(p * it.cantidad, m)}</span></>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2">
                <tr>
                  <td colSpan={3} className="px-2 py-1 text-right text-xs text-muted-foreground">Subtotal</td>
                  {c.cotizaciones.map(q => <td key={q.id} className="px-2 py-1 text-right tabular-nums">{formatCurrency(q.subtotal, m)}</td>)}
                </tr>
                <tr>
                  <td colSpan={3} className="px-2 py-1 text-right text-xs text-muted-foreground">IVA</td>
                  {c.cotizaciones.map(q => <td key={q.id} className="px-2 py-1 text-right tabular-nums text-muted-foreground">{fmtCant(q.iva_porcentaje)}% · {formatCurrency(q.total - q.subtotal, m)}</td>)}
                </tr>
                <tr>
                  <td colSpan={3} className="px-2 py-1.5 text-right text-sm font-semibold">Total</td>
                  {c.cotizaciones.map(q => {
                    const barata = multi && a.mas_baratas.includes(q.id);
                    const inf = info(q.id);
                    return (
                      <td key={q.id} className={cn('px-2 py-1.5 text-right font-semibold tabular-nums', barata && 'bg-green-100 text-green-900')}>
                        {formatCurrency(q.total, m)}
                        {barata && <span className="block text-[11px] font-semibold">Más barato</span>}
                        {!inf.completa && <span className="block text-[11px] font-normal text-amber-700">Cotizó {inf.cotizados} de {c.items.length}</span>}
                      </td>
                    );
                  })}
                </tr>
                {(['plazo_entrega', 'plazo_pago', 'forma_pago', 'validez'] as const).filter(k => c.cotizaciones.some(q => q[k])).map(k => (
                  <tr key={k}>
                    <td colSpan={3} className="px-2 py-1 text-right text-xs text-muted-foreground">{{ plazo_entrega: 'Entrega', plazo_pago: 'Plazo de pago', forma_pago: 'Forma de pago', validez: 'Validez' }[k]}</td>
                    {c.cotizaciones.map(q => <td key={q.id} className="px-2 py-1 text-right text-xs">{q[k] ?? '—'}</td>)}
                  </tr>
                ))}
                {c.estado === 'ABIERTO' && isAdmin && (
                  <tr>
                    <td colSpan={3} />
                    {c.cotizaciones.map(q => (
                      <td key={q.id} className="px-2 py-2 text-right">
                        <Button size="sm" variant={a.mas_baratas.includes(q.id) && info(q.id).completa ? 'default' : 'outline'} onClick={() => pedirEleccion(q.id)}>
                          <CheckCircle2 size={14} className="mr-1" /> Elegir
                        </Button>
                      </td>
                    ))}
                  </tr>
                )}
              </tfoot>
            </BaseTable>
          </div>
        )}
        {multi && a.cotizaciones.filter(x => x.cotizados > 0).length > 1 && (
          <p className="text-xs text-muted-foreground">
            En verde, el precio más bajo de cada artículo. Comprando cada artículo al que lo cotizó más barato, el subtotal sería {formatCurrency(a.subtotal_optimo, m)} (sin IVA).
          </p>
        )}

        {eligiendo != null && (() => {
          const q = c.cotizaciones.find(x => x.id === eligiendo)!;
          return (
            <section className="border rounded-lg p-3 space-y-2">
              <p className="text-sm">
                Elegir a <b>{q.proveedor.nombre}</b> por {formatCurrency(q.total, m)}.{' '}
                {info(q.id).completa ? 'No es la más barata' : `Cotizó ${info(q.id).cotizados} de ${c.items.length} artículos`}: anotá por qué (sale en el PDF y en la orden de compra).
              </p>
              <textarea value={motivo} onChange={e => setMotivo(e.target.value)} rows={2} className={inputCls} placeholder="Entrega inmediata, mejor plazo de pago, calidad…" />
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="outline" onClick={() => setEligiendo(null)}>Cancelar</Button>
                <Button size="sm" disabled={!motivo.trim() || elegir.isPending} onClick={() => run(elegir.mutateAsync({ id, cotizacion_id: q.id, motivo: motivo.trim() }))}>Elegir</Button>
              </div>
            </section>
          );
        })()}

        {elegida && (
          <section className="border border-green-300 bg-green-50/50 rounded-lg p-3 text-sm">
            <p><b>Elegido:</b> {elegida.proveedor.nombre} por {formatCurrency(elegida.total, m)}{c.decidido_at && <span className="text-muted-foreground"> · {formatDate(c.decidido_at)}</span>}</p>
            {c.motivo_eleccion && <p className="text-muted-foreground mt-0.5">{c.motivo_eleccion}</p>}
            {c.orden_compra && <p className="mt-1">Orden de compra: <Link className="underline" to={`/ordenes-compra?abrir=${c.orden_compra.id}`}>{c.orden_compra.numero}</Link></p>}
          </section>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Página ───────────────────────────────────────────────────────────────────

type Filtro = 'TODOS' | EstadoComparativo;

export default function ComparativosPage() {
  const { user } = useAuth();
  const canCargar = user?.rol === 'ADMIN' || user?.rol === 'OPERADOR';
  const [searchParams, setSearchParams] = useSearchParams();
  const [estado, setEstado] = useState<Filtro>('TODOS');
  const [q, setQ] = useState('');
  const { data: lista = [], isLoading } = useComparativos({ ...(estado !== 'TODOS' && { estado }), ...(q.trim() && { q: q.trim() }) });
  const abrirParam = searchParams.get('abrir');
  const [detalleId, setDetalleId] = useState<number | null>(abrirParam ? Number(abrirParam) : null);
  const [editor, setEditor] = useState<{ comp: ComparativoDetalle | null } | null>(null);

  const cerrarDetalle = () => {
    setDetalleId(null);
    if (searchParams.get('abrir')) { searchParams.delete('abrir'); setSearchParams(searchParams, { replace: true }); }
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <PageHeader
        title="Comparativos de compra"
        subtitle="Los presupuestos de varios proveedores para una misma compra, en un cuadro para decidir. La cotización elegida se convierte en la orden de compra."
        actions={canCargar && <Button size="sm" onClick={() => setEditor({ comp: null })}><Plus size={14} className="mr-1.5" /> Nuevo comparativo</Button>}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <TabStrip<Filtro>
          variant="pill" value={estado} onChange={setEstado}
          items={[{ key: 'TODOS', label: 'Todos' }, { key: 'ABIERTO', label: 'Abiertos' }, { key: 'DECIDIDO', label: 'Decididos' }, { key: 'ANULADO', label: 'Anulados' }]}
        />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar compra, artículo, proveedor o número" className={cn(inputCls, 'w-full sm:w-80')} />
      </div>

      {isLoading ? <p className="text-sm text-muted-foreground">Cargando…</p> : lista.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Scale size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No hay comparativos{estado !== 'TODOS' || q ? ' con este filtro' : ''}.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <BaseTable className="w-full text-sm min-w-[820px]">
            <thead className="border-b bg-muted/30">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Nº</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Fecha</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Compra</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Cotizaciones</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Elegido</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {lista.map(cp => (
                <tr key={cp.id} className="hover:bg-muted/20 cursor-pointer" onClick={() => setDetalleId(cp.id)}>
                  <td className="px-3 py-2.5 font-mono font-medium" data-label="Nº">{cp.numero_formateado}</td>
                  <td className="px-3 py-2.5 text-muted-foreground" data-label="Fecha">{formatDate(cp.fecha)}</td>
                  <td className="px-3 py-2.5" data-label="Compra">{cp.titulo}<span className="block text-xs text-muted-foreground">{cp.cant_items} artículo{cp.cant_items === 1 ? '' : 's'}{cp.evento ? ` · ${cp.evento.nombre}` : ''}</span></td>
                  <td className="px-3 py-2.5 text-xs" data-label="Cotizaciones">
                    {cp.cotizaciones.length === 0 ? <span className="text-muted-foreground">Sin cotizaciones</span> : cp.cotizaciones.map(x => (
                      <span key={x.id} className={cn('block', x.mas_barata && cp.cotizaciones.length > 1 && 'text-green-800 font-medium')}>{x.proveedor}: {formatCurrency(x.total, cp.moneda)}</span>
                    ))}
                  </td>
                  <td className="px-3 py-2.5" data-label="Elegido">
                    {cp.elegida ? <>{cp.elegida.proveedor}<span className="block text-xs text-muted-foreground">{cp.orden_compra ? cp.orden_compra.numero : 'Sin orden de compra'}</span></> : '—'}
                  </td>
                  <td className="px-3 py-2.5" data-label="Estado"><EstadoBadge estado={cp.estado} /></td>
                </tr>
              ))}
            </tbody>
          </BaseTable>
        </div>
      )}

      <ComparativoEditor
        open={!!editor} comp={editor?.comp ?? null} onClose={() => setEditor(null)}
        onGuardado={id => { setEditor(null); setDetalleId(id); }}
      />
      {detalleId != null && !editor && <ComparativoVista id={detalleId} onClose={cerrarDetalle} onEditar={comp => setEditor({ comp })} />}
    </div>
  );
}
