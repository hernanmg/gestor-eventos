import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Plus, ShoppingCart, Pencil, Trash2, FileText, Send, Undo2, Ban, PackageCheck, Link2, Unlink, CheckCircle2, RotateCcw, X,
} from 'lucide-react';
import {
  useOrdenesCompra, useOrdenCompra, useGuardarOrdenCompra, useAccionOrden, useEliminarOrden, useRecibirOrden, useCerrarOrden,
  useFacturasDisponiblesOC, useVincularFacturaOC, useDesvincularFacturaOC, pdfOrdenCompraUrl, sugerenciaProveedorOC,
  type OrdenCompraPayload, type AccionOrden,
} from '@/hooks/useOrdenesCompra';
import { useProveedores } from '@/hooks/useProveedores';
import { useEventos } from '@/hooks/useEvento';
import { useAuth } from '@/hooks/useAuth';
import { useProductos } from '@/hooks/useStock';
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
import type { EstadoOrdenCompra, OrdenCompraDetalle, OrdenCompraItem, Moneda } from '@/types';

const inputCls  = 'w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring';
const labelCls  = 'block text-xs font-medium text-muted-foreground mb-0.5';
const selectCls = 'w-full border border-input rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring bg-white';

function hoyISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const num = (v: number | string | null | undefined) => (v == null || v === '' ? 0 : Number(v));
const fmtCant = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 2 });

const ESTADO: Record<EstadoOrdenCompra, { label: string; variant: 'muted' | 'info' | 'warning' | 'success' | 'destructive' }> = {
  BORRADOR: { label: 'Borrador', variant: 'muted' },
  EMITIDA:  { label: 'Emitida',  variant: 'info' },
  RECIBIDA: { label: 'Recibida', variant: 'warning' },
  CERRADA:  { label: 'Cerrada',  variant: 'success' },
  ANULADA:  { label: 'Anulada',  variant: 'destructive' },
};

function EstadoBadge({ estado }: { estado: EstadoOrdenCompra }) {
  return <Badge variant={ESTADO[estado].variant}>{ESTADO[estado].label}</Badge>;
}

// ── Editor (alta / edición de borrador) ──────────────────────────────────────

interface FilaItem { codigo: string; descripcion: string; cantidad: string; precio: string }
const FILA_VACIA: FilaItem = { codigo: '', descripcion: '', cantidad: '', precio: '' };

interface FormOC {
  fecha: string; proveedor_id: string; evento_id: string;
  contacto: string; telefono: string; domicilio: string; ciudad: string;
  entrega: string; direccion_entrega: string; plazo_pago: string; forma_pago: string;
  referencia_proveedor: string; moneda: Moneda; iva_porcentaje: string; notas: string;
}
const FORM_VACIO: FormOC = {
  fecha: hoyISO(), proveedor_id: '', evento_id: '', contacto: '', telefono: '', domicilio: '', ciudad: '',
  entrega: 'Envío a domicilio', direccion_entrega: '', plazo_pago: '', forma_pago: 'Echeqs',
  referencia_proveedor: '', moneda: 'ARS', iva_porcentaje: '21', notas: '',
};

function OrdenEditor({ open, orden, onClose, onGuardada }: {
  open: boolean; orden: OrdenCompraDetalle | null; onClose: () => void; onGuardada: (id: number) => void;
}) {
  const guardar = useGuardarOrdenCompra();
  const { data: proveedores = [] } = useProveedores({ activo: 'true' });
  const { data: eventos = [] } = useEventos();
  const [form, setForm] = useState<FormOC>(FORM_VACIO);
  const [items, setItems] = useState<FilaItem[]>([{ ...FILA_VACIA }]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (orden) {
      setForm({
        fecha: orden.fecha.slice(0, 10), proveedor_id: String(orden.proveedor_id), evento_id: orden.evento_id ? String(orden.evento_id) : '',
        contacto: orden.contacto ?? '', telefono: orden.telefono ?? '', domicilio: orden.domicilio ?? '', ciudad: orden.ciudad ?? '',
        entrega: orden.entrega ?? '', direccion_entrega: orden.direccion_entrega ?? '', plazo_pago: orden.plazo_pago ?? '', forma_pago: orden.forma_pago ?? '',
        referencia_proveedor: orden.referencia_proveedor ?? '', moneda: orden.moneda, iva_porcentaje: String(num(orden.iva_porcentaje)), notas: orden.notas ?? '',
      });
      setItems(orden.items.map(i => ({ codigo: i.codigo ?? '', descripcion: i.descripcion, cantidad: String(num(i.cantidad)), precio: String(num(i.precio_unitario)) })));
    } else {
      setForm({ ...FORM_VACIO, fecha: hoyISO() });
      setItems([{ ...FILA_VACIA }]);
    }
  }, [open, orden]);

  const set = (k: keyof FormOC) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  // Al elegir proveedor se completan los datos de su última orden (sin pisar lo ya escrito)
  const elegirProveedor = async (v: string) => {
    setForm(p => ({ ...p, proveedor_id: v }));
    if (!v || orden) return;
    try {
      const s = await sugerenciaProveedorOC(Number(v));
      setForm(p => ({
        ...p,
        contacto: p.contacto || s.contacto || '', telefono: p.telefono || s.telefono || '',
        domicilio: p.domicilio || s.domicilio || '', ciudad: p.ciudad || s.ciudad || '',
        direccion_entrega: p.direccion_entrega || s.direccion_entrega || '',
        plazo_pago: p.plazo_pago || s.plazo_pago || '',
        ...(s.entrega ? { entrega: s.entrega } : {}), ...(s.forma_pago ? { forma_pago: s.forma_pago } : {}),
      }));
    } catch { /* la sugerencia es opcional */ }
  };

  const setItem = (i: number, k: keyof FilaItem, v: string) => setItems(prev => prev.map((it, j) => (j === i ? { ...it, [k]: v } : it)));
  const totales = useMemo(() => {
    const subtotal = items.reduce((n, it) => n + Math.round(num(it.cantidad) * num(it.precio) * 100) / 100, 0);
    const iva = Math.round(subtotal * num(form.iva_porcentaje)) / 100;
    return { subtotal, iva, total: subtotal + iva };
  }, [items, form.iva_porcentaje]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null);
    if (!form.proveedor_id) { setError('Elegí el proveedor'); return; }
    const filas = items.filter(it => it.descripcion.trim() || it.cantidad || it.precio);
    if (filas.length === 0) { setError('Cargá al menos un artículo'); return; }
    if (filas.some(it => !it.descripcion.trim() || num(it.cantidad) <= 0)) { setError('Cada artículo necesita descripción y cantidad'); return; }
    const data: OrdenCompraPayload = {
      fecha: form.fecha, proveedor_id: Number(form.proveedor_id), evento_id: form.evento_id ? Number(form.evento_id) : null,
      contacto: form.contacto || null, telefono: form.telefono || null, domicilio: form.domicilio || null, ciudad: form.ciudad || null,
      entrega: form.entrega || null, direccion_entrega: form.direccion_entrega || null, plazo_pago: form.plazo_pago || null, forma_pago: form.forma_pago || null,
      referencia_proveedor: form.referencia_proveedor || null, moneda: form.moneda, iva_porcentaje: num(form.iva_porcentaje), notas: form.notas || null,
      items: filas.map(it => ({ codigo: it.codigo || null, descripcion: it.descripcion.trim(), cantidad: num(it.cantidad), precio_unitario: num(it.precio) })),
    };
    try {
      const r = await guardar.mutateAsync({ id: orden?.id, data });
      onGuardada(orden?.id ?? r.id);
    } catch (err) { setError(getApiErrorMessage(err)); }
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{orden ? `Editar ${orden.numero_formateado}` : 'Nueva orden de compra'}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4 mt-1">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className={labelCls}>Proveedor *</label>
              <Combobox
                options={proveedores.map(p => ({ value: String(p.id), label: p.cuit ? `${p.nombre} (${p.cuit})` : p.nombre }))}
                value={form.proveedor_id || null} onChange={elegirProveedor} placeholder="Elegir proveedor…"
              />
            </div>
            <div>
              <label className={labelCls}>Fecha *</label>
              <input type="date" value={form.fecha} onChange={set('fecha')} className={inputCls} required />
            </div>
            <div><label className={labelCls}>Contacto</label><input value={form.contacto} onChange={set('contacto')} className={inputCls} /></div>
            <div><label className={labelCls}>Teléfono</label><input value={form.telefono} onChange={set('telefono')} className={inputCls} /></div>
            <div><label className={labelCls}>Referencia del proveedor</label><input value={form.referencia_proveedor} onChange={set('referencia_proveedor')} className={inputCls} placeholder="N° de presupuesto…" /></div>
            <div><label className={labelCls}>Domicilio</label><input value={form.domicilio} onChange={set('domicilio')} className={inputCls} /></div>
            <div><label className={labelCls}>Ciudad</label><input value={form.ciudad} onChange={set('ciudad')} className={inputCls} /></div>
            <div>
              <label className={labelCls}>Evento (opcional)</label>
              <Combobox
                options={[{ value: '', label: 'Sin evento' }, ...eventos.map(e => ({ value: String(e.id), label: e.nombre }))]}
                value={form.evento_id} onChange={v => setForm(p => ({ ...p, evento_id: v }))} placeholder="Sin evento"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-4 border-t pt-3">
            <div>
              <label className={labelCls}>Entrega</label>
              <select value={form.entrega} onChange={set('entrega')} className={selectCls}>
                <option value="">—</option>
                <option value="Envío a domicilio">Envío a domicilio</option>
                <option value="Retiro en local">Retiro en local</option>
              </select>
            </div>
            <div className="sm:col-span-3"><label className={labelCls}>Dirección de entrega</label><input value={form.direccion_entrega} onChange={set('direccion_entrega')} className={inputCls} /></div>
            <div><label className={labelCls}>Plazo de pago</label><input value={form.plazo_pago} onChange={set('plazo_pago')} className={inputCls} placeholder="30-45-60 días" /></div>
            <div><label className={labelCls}>Forma de pago</label><input value={form.forma_pago} onChange={set('forma_pago')} className={inputCls} placeholder="Echeqs" /></div>
            <div>
              <label className={labelCls}>Moneda</label>
              <select value={form.moneda} onChange={e => setForm(p => ({ ...p, moneda: e.target.value as Moneda }))} className={selectCls}>
                <option value="ARS">ARS</option><option value="USD">USD</option><option value="EUR">EUR</option>
              </select>
            </div>
            <div><label className={labelCls}>IVA %</label><input type="number" step="0.5" min="0" value={form.iva_porcentaje} onChange={set('iva_porcentaje')} className={inputCls} /></div>
          </div>

          <div className="border-t pt-3 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Artículos</h3>
              <Button type="button" size="sm" variant="outline" onClick={() => setItems(p => [...p, { ...FILA_VACIA }])}><Plus size={14} className="mr-1" /> Agregar</Button>
            </div>
            <div className="space-y-2">
              {items.map((it, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-12 sm:col-span-2">{i === 0 && <label className={labelCls}>Código</label>}<input value={it.codigo} onChange={e => setItem(i, 'codigo', e.target.value)} className={inputCls} /></div>
                  <div className="col-span-12 sm:col-span-4">{i === 0 && <label className={labelCls}>Artículo *</label>}<input value={it.descripcion} onChange={e => setItem(i, 'descripcion', e.target.value)} className={inputCls} placeholder="CAÑO EST 60X60X2MM 6MT" /></div>
                  <div className="col-span-4 sm:col-span-1">{i === 0 && <label className={labelCls}>Cant.</label>}<input type="number" step="any" min="0" value={it.cantidad} onChange={e => setItem(i, 'cantidad', e.target.value)} className={inputCls} /></div>
                  <div className="col-span-4 sm:col-span-2">{i === 0 && <label className={labelCls}>Precio unit.</label>}<MoneyInput value={it.precio} onChange={v => setItem(i, 'precio', v)} className={inputCls} /></div>
                  <div className="col-span-3 sm:col-span-2 text-right text-sm tabular-nums py-1.5">{formatCurrency(num(it.cantidad) * num(it.precio), form.moneda)}</div>
                  <div className="col-span-1 flex justify-end">
                    <Button type="button" variant="ghost" size="icon" title="Quitar" onClick={() => setItems(p => (p.length === 1 ? [{ ...FILA_VACIA }] : p.filter((_, j) => j !== i)))}><X size={14} /></Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="ml-auto w-full sm:w-72 text-sm space-y-1 border rounded p-2">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="tabular-nums">{formatCurrency(totales.subtotal, form.moneda)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">IVA {form.iva_porcentaje}%</span><span className="tabular-nums">{formatCurrency(totales.iva, form.moneda)}</span></div>
              <div className="flex justify-between font-semibold border-t pt-1"><span>Total</span><span className="tabular-nums">{formatCurrency(totales.total, form.moneda)}</span></div>
            </div>
          </div>

          <div><label className={labelCls}>Notas (salen en el PDF)</label><textarea value={form.notas} onChange={set('notas')} className={inputCls} rows={2} /></div>
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

// ── Producto del stock al que se suma lo recibido ────────────────────────────

const normalizar = (t: string | null | undefined) => (t ?? '').normalize('NFD').replace(new RegExp('[\u0300-\u036f]', 'g'), '').trim().toLowerCase();

function ProductoStockPicker({ item, value, onChange }: { item: OrdenCompraItem; value: string; onChange: (v: string) => void }) {
  const { data: productos = [] } = useProductos();
  // Sugerencia: mismo código interno o del fabricante, o mismo nombre
  useEffect(() => {
    if (value || item.producto_id != null || !productos.length) return;
    const cod = normalizar(item.codigo);
    const desc = normalizar(item.descripcion);
    const p = productos.find(p => (cod && (normalizar(p.codigo_interno) === cod || normalizar(p.codigo_externo) === cod)))
      ?? productos.find(p => desc && (normalizar(p.nombre) === desc || normalizar(p.nombre_interno) === desc));
    if (p) onChange(String(p.id));
  }, [productos.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const options = useMemo(() => [
    { value: 'none', label: '— No va al stock —' },
    ...productos.map(p => ({ value: String(p.id), label: `${p.codigo_interno ? `${p.codigo_interno} · ` : ''}${p.nombre} (hay ${p.stock_total})` })),
  ], [productos]);
  return (
    <Combobox options={options} value={value || 'none'} onChange={v => onChange(v === 'none' ? '' : v)}
      placeholder="No va al stock" searchPlaceholder="Buscar producto…" emptyMessage="No está en el stock" className="w-full min-w-[200px] h-8 text-xs" />
  );
}

// ── Detalle: estados, recepción y cotejo con la factura ──────────────────────

function OrdenDetalle({ id, onClose, onEditar }: { id: number; onClose: () => void; onEditar: (o: OrdenCompraDetalle) => void }) {
  const { user } = useAuth();
  const isAdmin = user?.rol === 'ADMIN';
  const canCargar = isAdmin || user?.rol === 'OPERADOR';
  const { data: o, isLoading } = useOrdenCompra(id);
  const accion = useAccionOrden();
  const eliminar = useEliminarOrden();
  const recibir = useRecibirOrden();
  const cerrar = useCerrarOrden();
  const vincular = useVincularFacturaOC();
  const desvincular = useDesvincularFacturaOC();
  const puedeFacturas = !!o && isAdmin && (o.estado === 'EMITIDA' || o.estado === 'RECIBIDA');
  const { data: disponibles = [] } = useFacturasDisponiblesOC(puedeFacturas ? id : null);

  const [recibiendo, setRecibiendo] = useState(false);
  const [recibido, setRecibido] = useState<Record<number, string>>({});
  const [productoSel, setProductoSel] = useState<Record<number, string>>({});
  const [notasCotejo, setNotasCotejo] = useState('');
  const [facturaSel, setFacturaSel] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setRecibiendo(false); setError(null); setFacturaSel(''); setNotasCotejo(o?.notas_cotejo ?? ''); }, [id, o?.estado, o?.notas_cotejo]);

  if (isLoading || !o) {
    return <Dialog open onOpenChange={x => !x && onClose()}><DialogContent><DialogTitle className="sr-only">Cargando</DialogTitle><p className="text-sm text-muted-foreground">Cargando…</p></DialogContent></Dialog>;
  }

  const run = async (p: Promise<unknown>) => { setError(null); try { await p; } catch (err) { setError(getApiErrorMessage(err)); } };
  const hacer = (a: AccionOrden, confirmar?: string) => { if (confirmar && !window.confirm(confirmar)) return; run(accion.mutateAsync({ id, accion: a })); };
  const empezarRecepcion = () => {
    setRecibido(Object.fromEntries(o.items.map(i => [i.id, String(i.cantidad_recibida != null ? num(i.cantidad_recibida) : num(i.cantidad))])));
    setProductoSel(Object.fromEntries(o.items.map(i => [i.id, i.producto_id != null ? String(i.producto_id) : ''])));
    setRecibiendo(true);
  };
  const guardarRecepcion = () => run(recibir.mutateAsync({ id, items: o.items.map(i => ({ id: i.id, cantidad_recibida: num(recibido[i.id]), producto_id: productoSel[i.id] ? Number(productoSel[i.id]) : null })) }).then(() => setRecibiendo(false)));
  const c = o.cotejo;
  const m = o.moneda;
  const hayStock = o.items.some(i => i.producto_id != null);

  return (
    <Dialog open onOpenChange={x => !x && onClose()}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">{o.numero_formateado} — {o.proveedor.nombre} <EstadoBadge estado={o.estado} /></DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap gap-2 mt-1">
          <Button size="sm" variant="outline" onClick={() => window.open(pdfOrdenCompraUrl(o.id), '_blank')}><FileText size={14} className="mr-1.5" /> PDF</Button>
          {o.estado === 'BORRADOR' && canCargar && <Button size="sm" variant="outline" onClick={() => onEditar(o)}><Pencil size={14} className="mr-1.5" /> Editar</Button>}
          {o.estado === 'BORRADOR' && isAdmin && <Button size="sm" onClick={() => hacer('emitir', 'Al emitirla ya no se puede editar (salvo que la vuelvas a borrador). ¿Emitir?')}><Send size={14} className="mr-1.5" /> Emitir</Button>}
          {o.estado === 'EMITIDA' && isAdmin && <Button size="sm" variant="outline" onClick={() => hacer('volver-borrador')}><Undo2 size={14} className="mr-1.5" /> Volver a borrador</Button>}
          {(o.estado === 'EMITIDA' || o.estado === 'RECIBIDA') && canCargar && !recibiendo && <Button size="sm" variant="outline" onClick={empezarRecepcion}><PackageCheck size={14} className="mr-1.5" /> Registrar recepción</Button>}
          {o.estado === 'CERRADA' && isAdmin && <Button size="sm" variant="outline" onClick={() => hacer('reabrir')}><RotateCcw size={14} className="mr-1.5" /> Reabrir</Button>}
          {['BORRADOR', 'EMITIDA', 'RECIBIDA'].includes(o.estado) && isAdmin && (
            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => hacer('anular', '¿Anular la orden de compra?')}><Ban size={14} className="mr-1.5" /> Anular</Button>
          )}
          {o.estado === 'BORRADOR' && canCargar && (
            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => { if (window.confirm('¿Eliminar el borrador?')) run(eliminar.mutateAsync(o.id).then(onClose)); }}><Trash2 size={14} className="mr-1.5" /> Eliminar</Button>
          )}
        </div>
        {error && <p className="text-xs text-destructive mt-2">{error}</p>}

        <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2 text-sm mt-3">
          <p><span className="text-muted-foreground">Fecha:</span> {formatDate(o.fecha)}</p>
          <p><span className="text-muted-foreground">Evento:</span> {o.evento ? <Link className="underline" to={`/eventos/${o.evento.id}`}>{o.evento.nombre}</Link> : '—'}</p>
          <p><span className="text-muted-foreground">Contacto:</span> {[o.contacto, o.telefono].filter(Boolean).join(' · ') || '—'}</p>
          <p><span className="text-muted-foreground">Entrega:</span> {[o.entrega, o.direccion_entrega].filter(Boolean).join(' — ') || '—'}</p>
          <p><span className="text-muted-foreground">Plazo y pago:</span> {[o.plazo_pago, o.forma_pago].filter(Boolean).join(' · ') || '—'}</p>
          <p><span className="text-muted-foreground">Referencia:</span> {o.referencia_proveedor ?? '—'}</p>
          {o.notas && <p className="sm:col-span-2"><span className="text-muted-foreground">Notas:</span> {o.notas}</p>}
        </div>

        <div className="overflow-x-auto mt-3">
          <BaseTable className="w-full text-sm min-w-[640px]">
            <thead className="border-b bg-muted/30">
              <tr>
                <th className="px-2 py-1.5 text-left text-xs font-medium text-muted-foreground">Nº</th>
                <th className="px-2 py-1.5 text-left text-xs font-medium text-muted-foreground">Artículo</th>
                <th className="px-2 py-1.5 text-right text-xs font-medium text-muted-foreground">Cantidad</th>
                <th className="px-2 py-1.5 text-right text-xs font-medium text-muted-foreground">Precio unit.</th>
                <th className="px-2 py-1.5 text-right text-xs font-medium text-muted-foreground">Total</th>
                <th className="px-2 py-1.5 text-right text-xs font-medium text-muted-foreground">Recibido</th>
                {(recibiendo || hayStock) && <th className="px-2 py-1.5 text-left text-xs font-medium text-muted-foreground">Suma al stock</th>}
              </tr>
            </thead>
            <tbody className="divide-y">
              {o.items.map(i => {
                const rec = i.cantidad_recibida != null ? num(i.cantidad_recibida) : null;
                const falta = rec != null && rec < num(i.cantidad);
                return (
                  <tr key={i.id}>
                    <td className="px-2 py-1.5" data-label="Nº">{i.orden_item}</td>
                    <td className="px-2 py-1.5" data-label="Artículo">{i.codigo && <span className="font-mono text-xs text-muted-foreground mr-1">{i.codigo}</span>}{i.descripcion}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums" data-label="Cantidad">{fmtCant(num(i.cantidad))}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums" data-label="Precio unit.">{formatCurrency(num(i.precio_unitario), m)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums" data-label="Total">{formatCurrency(num(i.total), m)}</td>
                    <td className={cn('px-2 py-1.5 text-right tabular-nums', falta && 'text-amber-700 font-medium')} data-label="Recibido">
                      {recibiendo
                        ? <input type="number" step="any" min="0" value={recibido[i.id] ?? ''} onChange={e => setRecibido(p => ({ ...p, [i.id]: e.target.value }))} className={cn(inputCls, 'w-24 text-right ml-auto')} />
                        : rec == null ? '—' : fmtCant(rec)}
                    </td>
                    {recibiendo ? (
                      <td className="px-2 py-1.5" data-label="Suma al stock">
                        <ProductoStockPicker item={i} value={productoSel[i.id] ?? ''} onChange={v => setProductoSel(p => ({ ...p, [i.id]: v }))} />
                      </td>
                    ) : hayStock && (
                      <td className="px-2 py-1.5 text-xs" data-label="Suma al stock">
                        {i.producto
                          ? <Link className="underline" to={`/stock/productos/${i.producto.id}`}>{i.producto.nombre}</Link>
                          : <span className="text-muted-foreground">—</span>}
                        {i.producto && !!i.cantidad_ingresada && <span className="text-green-700 ml-1">+{i.cantidad_ingresada}</span>}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr><td colSpan={4} className="px-2 py-1 text-right text-muted-foreground">Subtotal</td><td className="px-2 py-1 text-right tabular-nums">{formatCurrency(num(o.subtotal), m)}</td><td />{(recibiendo || hayStock) && <td />}</tr>
              <tr><td colSpan={4} className="px-2 py-1 text-right text-muted-foreground">IVA {num(o.iva_porcentaje)}%</td><td className="px-2 py-1 text-right tabular-nums">{formatCurrency(num(o.iva), m)}</td><td />{(recibiendo || hayStock) && <td />}</tr>
              <tr><td colSpan={4} className="px-2 py-1 text-right font-semibold">Total</td><td className="px-2 py-1 text-right font-semibold tabular-nums">{formatCurrency(num(o.total), m)}</td><td />{(recibiendo || hayStock) && <td />}</tr>
            </tfoot>
          </BaseTable>
        </div>
        {recibiendo && (
          <p className="text-xs text-muted-foreground">Lo recibido de cada ítem con producto se suma al stock de ese producto. Si después corregís la recepción, se ajusta sólo la diferencia.</p>
        )}
        {recibiendo && (
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => setRecibiendo(false)}>Cancelar</Button>
            <Button size="sm" onClick={guardarRecepcion} disabled={recibir.isPending}>Guardar recepción</Button>
          </div>
        )}

        {o.estado !== 'BORRADOR' && o.estado !== 'ANULADA' && (
          <section className="border rounded-lg p-3 space-y-3 mt-2">
            <h3 className="text-sm font-semibold">Cotejo con la factura</h3>
            <div className="grid gap-2 sm:grid-cols-3 text-sm">
              <div className="rounded bg-muted/40 p-2"><p className="text-xs text-muted-foreground">Pedido (total)</p><p className="font-semibold tabular-nums">{formatCurrency(num(o.total), m)}</p></div>
              <div className="rounded bg-muted/40 p-2"><p className="text-xs text-muted-foreground">Facturado ({o.facturas.filter(f => f.estado !== 'ANULADA').length})</p><p className="font-semibold tabular-nums">{formatCurrency(c.facturado_total, m)}</p></div>
              <div className={cn('rounded p-2', c.facturado_total === 0 ? 'bg-muted/40' : c.coincide ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-800')}>
                <p className="text-xs">Diferencia</p>
                <p className="font-semibold tabular-nums">{c.facturado_total === 0 ? '—' : c.coincide ? 'Coincide' : formatCurrency(c.diferencia_total, m)}</p>
              </div>
            </div>
            {c.faltantes.length > 0 && (
              <p className="text-xs text-amber-700">Llegó menos de lo pedido: {c.faltantes.map(f => `${f.descripcion} (${fmtCant(f.recibido)} de ${fmtCant(f.pedido)})`).join(' · ')}</p>
            )}
            {o.estado !== 'CERRADA' && c.items_sin_controlar > 0 && o.recibida_at == null && (
              <p className="text-xs text-muted-foreground">Todavía no se registró la recepción.</p>
            )}

            {o.facturas.length > 0 && (
              <ul className="text-sm divide-y border rounded">
                {o.facturas.map(f => (
                  <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 px-2 py-1.5">
                    <Link to={`/facturas/${f.id}`} className="underline">Factura {f.tipo_factura} {f.numero_factura}</Link>
                    <span className="text-muted-foreground text-xs">{formatDate(f.fecha_emision)} · {f.estado.toLowerCase()}</span>
                    <span className="tabular-nums">{formatCurrency(num(f.importe_total), f.moneda)}</span>
                    {isAdmin && o.estado !== 'CERRADA' && (
                      <Button size="sm" variant="ghost" title="Desvincular" onClick={() => run(desvincular.mutateAsync({ id, factura_id: f.id }))}><Unlink size={14} /></Button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {puedeFacturas && (
              <div className="flex flex-wrap items-end gap-2">
                <div className="flex-1 min-w-[220px]">
                  <label className={labelCls}>Vincular factura del proveedor</label>
                  <select value={facturaSel} onChange={e => setFacturaSel(e.target.value)} className={selectCls}>
                    <option value="">{disponibles.length ? 'Elegir factura…' : 'No hay facturas de este proveedor sin orden'}</option>
                    {disponibles.map(f => <option key={f.id} value={f.id}>{f.tipo_factura} {f.numero_factura} — {formatDate(f.fecha_emision)} — {formatCurrency(num(f.importe_total), m)}</option>)}
                  </select>
                </div>
                <Button size="sm" variant="outline" disabled={!facturaSel || vincular.isPending} onClick={() => run(vincular.mutateAsync({ id, factura_id: Number(facturaSel) }).then(() => setFacturaSel('')))}>
                  <Link2 size={14} className="mr-1.5" /> Vincular
                </Button>
              </div>
            )}

            {isAdmin && (o.estado === 'EMITIDA' || o.estado === 'RECIBIDA') && c.facturado_total > 0 && (
              <div className="space-y-2 border-t pt-2">
                {!c.coincide && (
                  <div>
                    <label className={labelCls}>Motivo de la diferencia (obligatorio para cerrar)</label>
                    <input value={notasCotejo} onChange={e => setNotasCotejo(e.target.value)} className={inputCls} placeholder="Ej.: aumento de precio aceptado, flete facturado aparte…" />
                  </div>
                )}
                <div className="flex justify-end">
                  <Button size="sm" onClick={() => run(cerrar.mutateAsync({ id, notas_cotejo: notasCotejo || null }))} disabled={cerrar.isPending}>
                    <CheckCircle2 size={14} className="mr-1.5" /> Cotejada: cerrar la orden
                  </Button>
                </div>
              </div>
            )}
            {o.estado === 'CERRADA' && o.notas_cotejo && <p className="text-xs text-muted-foreground">Nota del cotejo: {o.notas_cotejo}</p>}
          </section>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Página ───────────────────────────────────────────────────────────────────

type FiltroEstado = 'TODAS' | EstadoOrdenCompra;

export default function OrdenesCompraPage() {
  const { user } = useAuth();
  const canCargar = user?.rol === 'ADMIN' || user?.rol === 'OPERADOR';
  const [searchParams, setSearchParams] = useSearchParams();
  const [estado, setEstado] = useState<FiltroEstado>('TODAS');
  const [q, setQ] = useState('');
  const { data: ordenes = [], isLoading } = useOrdenesCompra({ ...(estado !== 'TODAS' && { estado }), ...(q.trim() && { q: q.trim() }) });

  const abrirParam = searchParams.get('abrir');
  const [detalleId, setDetalleId] = useState<number | null>(abrirParam ? Number(abrirParam) : null);
  const [editor, setEditor] = useState<{ orden: OrdenCompraDetalle | null } | null>(null);

  const cerrarDetalle = () => {
    setDetalleId(null);
    if (searchParams.get('abrir')) { searchParams.delete('abrir'); setSearchParams(searchParams, { replace: true }); }
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <PageHeader
        title="Órdenes de compra"
        subtitle="Lo que se le pide a cada proveedor, en PDF para mandarle. Cuando llega la factura se vincula a la orden para cotejar lo pedido con lo facturado antes de pagar."
        actions={canCargar && <Button size="sm" onClick={() => setEditor({ orden: null })}><Plus size={14} className="mr-1.5" /> Nueva orden</Button>}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <TabStrip<FiltroEstado>
          variant="pill" value={estado} onChange={setEstado}
          items={[
            { key: 'TODAS', label: 'Todas' }, { key: 'BORRADOR', label: 'Borradores' }, { key: 'EMITIDA', label: 'Emitidas' },
            { key: 'RECIBIDA', label: 'Recibidas' }, { key: 'CERRADA', label: 'Cerradas' }, { key: 'ANULADA', label: 'Anuladas' },
          ]}
        />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar proveedor, artículo o número" className={cn(inputCls, 'w-full sm:w-72')} />
      </div>

      {isLoading ? <p className="text-sm text-muted-foreground">Cargando…</p> : ordenes.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <ShoppingCart size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No hay órdenes de compra{estado !== 'TODAS' || q ? ' con este filtro' : ''}.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <BaseTable className="w-full text-sm min-w-[820px]">
            <thead className="border-b bg-muted/30">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Nº</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Fecha</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Proveedor</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Evento</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Total</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Facturado</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {ordenes.map(o => {
                const dif = o.facturado - num(o.total);
                return (
                  <tr key={o.id} className="hover:bg-muted/20 cursor-pointer" onClick={() => setDetalleId(o.id)}>
                    <td className="px-3 py-2.5 font-mono font-medium" data-label="Nº">{o.numero_formateado}</td>
                    <td className="px-3 py-2.5 text-muted-foreground" data-label="Fecha">{formatDate(o.fecha)}</td>
                    <td className="px-3 py-2.5" data-label="Proveedor">{o.proveedor.nombre}<span className="block text-xs text-muted-foreground">{o._count.items} artículo{o._count.items === 1 ? '' : 's'}{o.referencia_proveedor ? ` · Ref. ${o.referencia_proveedor}` : ''}</span></td>
                    <td className="px-3 py-2.5 text-muted-foreground" data-label="Evento">{o.evento?.nombre ?? '—'}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums" data-label="Total">{formatCurrency(num(o.total), o.moneda)}</td>
                    <td className={cn('px-3 py-2.5 text-right tabular-nums', o.cant_facturas > 0 && Math.abs(dif) > 1 && 'text-amber-700')} data-label="Facturado">
                      {o.cant_facturas === 0 ? '—' : formatCurrency(o.facturado, o.moneda)}
                    </td>
                    <td className="px-3 py-2.5" data-label="Estado"><EstadoBadge estado={o.estado} /></td>
                  </tr>
                );
              })}
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
