import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeftRight, Plus, Upload, Pencil, Undo2, Ban, Trash2 } from 'lucide-react';
import { useCrucesMaterial, useGuardarCruce, useDevolverCruce, useAnularCruce, useLeerPlanillaCruce } from '@/hooks/useCrucesMaterial';
import { useProductos } from '@/hooks/useStock';
import { useEventos } from '@/hooks/useEvento';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import BaseTable from '@/components/ui/BaseTable';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { cn, getApiErrorMessage } from '@/lib/utils';
import type { CruceMaterial, CruceMaterialInput, HojaPlanillaCruce, Producto, TipoCruceMaterial } from '@/types';

// ── Cruce de material con terceros (Depósito 5) ──────────────────────────────
// Alquileres y préstamos de material con otras empresas (Zamora, Agesta,
// Airasca, Jofre…) y lo que se compra o vende entre ellas.

const inputCls  = 'w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring bg-white';
const labelCls  = 'block text-xs font-medium text-muted-foreground mb-0.5';

const TIPO: Record<TipoCruceMaterial, { label: string; corto: string; variant: 'info' | 'orange' | 'success' | 'warning' | 'muted' | 'destructive'; ayuda: string }> = {
  ALQUILER_DADO:   { label: 'Le alquilamos', corto: 'Alquiler a', variant: 'orange', ayuda: 'Sale del stock mientras dura: no está disponible para los eventos hasta que vuelve.' },
  PRESTAMO_DADO:   { label: 'Le prestamos',  corto: 'Préstamo a', variant: 'warning', ayuda: 'Sale del stock mientras dura, sin cobrar alquiler.' },
  ALQUILER_TOMADO: { label: 'Nos alquila',   corto: 'Alquiler de', variant: 'info', ayuda: 'Se suma a lo disponible mientras dura y hay que devolverlo.' },
  PRESTAMO_TOMADO: { label: 'Nos presta',    corto: 'Préstamo de', variant: 'info', ayuda: 'Se suma a lo disponible mientras dura y hay que devolverlo.' },
  VENTA:           { label: 'Le vendemos',   corto: 'Venta a', variant: 'destructive', ayuda: 'Se resta del stock del producto.' },
  COMPRA:          { label: 'Le compramos',  corto: 'Compra a', variant: 'success', ayuda: 'Se suma al stock del producto. Si la compra entra por una orden de compra, se suma desde ahí: no la cargues dos veces.' },
};
const TIPOS = Object.keys(TIPO) as TipoCruceMaterial[];
const esTemporal = (t: TipoCruceMaterial) => !['VENTA', 'COMPRA'].includes(t);

function hoyISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const num = (s: string) => { const t = s.trim().replace(/\./g, '').replace(',', '.'); if (!t) return null; const n = Number(t); return isFinite(n) ? n : NaN; };
const txt = (n: number | null | undefined) => n == null ? '' : String(n).replace('.', ',');
const etiquetaProducto = (p: Pick<Producto, 'nombre' | 'codigo_externo'>) => `${p.codigo_externo ? `${p.codigo_externo} · ` : ''}${p.nombre}`;

// ── Alta / edición ───────────────────────────────────────────────────────────

type FilaForm = { id?: number; producto: string; descripcion: string; cantidad: string; valor: string; devuelta: number };
export type InicialCruce = Partial<CruceMaterialInput> & { items?: CruceMaterialInput['items'] };

function CruceDialog({ cruce, inicial, terceros, onClose }: { cruce: CruceMaterial | null; inicial: InicialCruce | null; terceros: string[]; onClose: () => void }) {
  const guardar = useGuardarCruce();
  const { data: productos = [] } = useProductos();
  const { data: eventos = [] } = useEventos();
  const porEtiqueta = useMemo(() => new Map(productos.map(p => [etiquetaProducto(p), p])), [productos]);
  const porId = useMemo(() => new Map(productos.map(p => [p.id, p])), [productos]);
  const base = cruce ?? inicial;
  const [tercero, setTercero] = useState(base?.tercero ?? '');
  const [tipo, setTipo] = useState<TipoCruceMaterial>(base?.tipo ?? 'ALQUILER_DADO');
  const [desde, setDesde] = useState(base?.fecha_desde?.slice(0, 10) ?? hoyISO());
  const [hasta, setHasta] = useState(base?.fecha_hasta?.slice(0, 10) ?? '');
  const [eventoId, setEventoId] = useState(base?.evento_id ? String(base.evento_id) : '');
  const [referencia, setReferencia] = useState(base?.referencia ?? '');
  const [tasa, setTasa] = useState(txt(base?.tasa_euro));
  const [pct, setPct] = useState(txt(base?.porcentaje_alquiler));
  const [notas, setNotas] = useState(base?.notas ?? '');
  const [filas, setFilas] = useState<FilaForm[]>([]);
  const [error, setError] = useState('');

  // Las filas se arman cuando llegan los productos (para mostrar su etiqueta).
  const armado = useRef(false);
  useEffect(() => {
    if (armado.current) return;
    const its = cruce?.items ?? inicial?.items ?? [];
    if (its.some(i => i.producto_id) && !productos.length) return;
    armado.current = true;
    setFilas(its.length ? its.map(i => {
      const p = i.producto_id ? porId.get(i.producto_id) : undefined;
      return { id: 'id' in i ? i.id : undefined, producto: p ? etiquetaProducto(p) : '', descripcion: i.descripcion, cantidad: String(i.cantidad), valor: txt(i.valor_unitario_eur), devuelta: 'cantidad_devuelta' in i ? (i as { cantidad_devuelta: number }).cantidad_devuelta : 0 };
    }) : [{ producto: '', descripcion: '', cantidad: '', valor: '', devuelta: 0 }]);
  }, [cruce, inicial, productos, porId]);

  const setFila = (k: number, cambio: Partial<FilaForm>) => setFilas(fs => fs.map((f, i) => {
    if (i !== k) return f;
    const n = { ...f, ...cambio };
    // Al elegir un producto del catálogo se completan la descripción y el valor si estaban vacíos
    if (cambio.producto !== undefined) {
      const p = porEtiqueta.get(cambio.producto);
      if (p) { if (!f.descripcion) n.descripcion = p.nombre; if (!f.valor && p.valor_unitario != null) n.valor = txt(Number(p.valor_unitario)); }
    }
    return n;
  }));

  const temporal = esTemporal(tipo);
  const totalEur = filas.reduce((a, f) => a + (num(f.cantidad) || 0) * (num(f.valor) || 0), 0);
  const tasaN = num(tasa); const pctN = num(pct);
  const alquiler = tasaN && pctN != null && !isNaN(pctN) ? totalEur * tasaN * pctN / 100 : null;

  const enviar = async () => {
    setError('');
    const items: CruceMaterialInput['items'] = [];
    for (const f of filas) {
      if (!f.producto && !f.descripcion && !f.cantidad) continue;
      const p = f.producto ? porEtiqueta.get(f.producto) : undefined;
      if (f.producto && !p) { setError(`"${f.producto}" no está en el catálogo: elegilo de la lista o dejalo vacío (queda anotado sin mover el stock)`); return; }
      const cant = num(f.cantidad);
      if (!cant || cant <= 0 || !Number.isInteger(cant)) { setError(`Revisá la cantidad de "${f.descripcion || f.producto}"`); return; }
      const v = num(f.valor);
      if (v != null && (isNaN(v) || v < 0)) { setError(`Revisá el valor de "${f.descripcion || f.producto}"`); return; }
      items.push({ id: f.id, producto_id: p?.id ?? null, descripcion: (f.descripcion || p?.nombre || '').trim(), cantidad: cant, valor_unitario_eur: v });
    }
    if (tasaN != null && (isNaN(tasaN) || tasaN <= 0)) { setError('Revisá la cotización del euro'); return; }
    if (pctN != null && (isNaN(pctN) || pctN < 0)) { setError('Revisá el porcentaje de alquiler'); return; }
    const data: CruceMaterialInput = {
      tercero: tercero.trim(), tipo, fecha_desde: desde, fecha_hasta: temporal && hasta ? hasta : null,
      evento_id: eventoId ? Number(eventoId) : null, referencia: referencia || null,
      tasa_euro: tasaN, porcentaje_alquiler: pctN, notas: notas || null,
      import_key: cruce ? undefined : inicial?.import_key ?? null, items,
    };
    try { await guardar.mutateAsync({ id: cruce?.id, data }); onClose(); }
    catch (e) { setError(getApiErrorMessage(e)); }
  };

  const eventosOrd = [...eventos].sort((a, b) => (b.fecha_inicio ?? '').localeCompare(a.fecha_inicio ?? ''));

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{cruce ? 'Editar operación' : 'Material con un tercero'}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="col-span-2">
            <label className={labelCls}>Con quién *</label>
            <input value={tercero} onChange={e => setTercero(e.target.value)} list="cruce-terceros" className={inputCls} placeholder="Zamora, Agesta, Airasca…" autoFocus />
            <datalist id="cruce-terceros">{terceros.map(t => <option key={t} value={t} />)}</datalist>
          </div>
          <div className="col-span-2">
            <label className={labelCls}>Qué es *</label>
            <select value={tipo} onChange={e => setTipo(e.target.value as TipoCruceMaterial)} className={inputCls} disabled={!!cruce}>
              {TIPOS.map(t => <option key={t} value={t}>{TIPO[t].label}</option>)}
            </select>
          </div>
          <p className="col-span-2 md:col-span-4 -mt-1 text-xs text-muted-foreground">{TIPO[tipo].ayuda}</p>
          <div>
            <label className={labelCls}>{temporal ? 'Sale / llega el' : 'Fecha'} *</label>
            <input type="date" value={desde} onChange={e => setDesde(e.target.value)} className={inputCls} />
          </div>
          {temporal && (
            <div>
              <label className={labelCls}>Vuelve el (previsto)</label>
              <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className={inputCls} />
            </div>
          )}
          <div className={temporal ? '' : 'col-span-2 md:col-span-1'}>
            <label className={labelCls}>Remito / comprobante</label>
            <input value={referencia} onChange={e => setReferencia(e.target.value)} className={inputCls} />
          </div>
          <div className={temporal ? '' : 'col-span-2'}>
            <label className={labelCls}>Evento (opcional)</label>
            <select value={eventoId} onChange={e => setEventoId(e.target.value)} className={inputCls}>
              <option value="">Sin evento</option>
              {eventosOrd.map(ev => <option key={ev.id} value={ev.id}>{ev.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Euro (pesos por €)</label>
            <input value={tasa} onChange={e => setTasa(e.target.value)} inputMode="decimal" className={inputCls} placeholder="1750" />
          </div>
          {tipo === 'ALQUILER_DADO' || tipo === 'ALQUILER_TOMADO' ? (
            <div>
              <label className={labelCls}>Alquiler mensual (% del valor)</label>
              <input value={pct} onChange={e => setPct(e.target.value)} inputMode="decimal" className={inputCls} placeholder="4" />
            </div>
          ) : <div />}
          <div className="col-span-2">
            <label className={labelCls}>Notas</label>
            <input value={notas} onChange={e => setNotas(e.target.value)} className={inputCls} />
          </div>
        </div>

        <div className="mt-2">
          <p className="text-sm font-medium mb-1">Piezas</p>
          <p className="text-xs text-muted-foreground mb-2">Elegí cada pieza del catálogo para que mueva el stock. Si no está en el catálogo, dejá el producto vacío: queda anotada pero no cambia lo disponible.</p>
          <datalist id="cruce-productos">{productos.map(p => <option key={p.id} value={etiquetaProducto(p)} />)}</datalist>
          <div className="space-y-2">
            {filas.map((f, k) => (
              <div key={k} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-12 md:col-span-4">
                  {k === 0 && <label className={labelCls}>Producto del catálogo</label>}
                  <input value={f.producto} onChange={e => setFila(k, { producto: e.target.value })} list="cruce-productos" className={cn(inputCls, f.producto && !porEtiqueta.get(f.producto) && 'border-amber-500')} placeholder="Buscar por código o nombre" aria-label="Producto" />
                </div>
                <div className="col-span-12 md:col-span-4">
                  {k === 0 && <label className={labelCls}>Descripción</label>}
                  <input value={f.descripcion} onChange={e => setFila(k, { descripcion: e.target.value })} className={inputCls} aria-label="Descripción" />
                </div>
                <div className="col-span-4 md:col-span-1">
                  {k === 0 && <label className={labelCls}>Cantidad</label>}
                  <input value={f.cantidad} onChange={e => setFila(k, { cantidad: e.target.value })} inputMode="numeric" className={inputCls} aria-label="Cantidad" />
                </div>
                <div className="col-span-5 md:col-span-2">
                  {k === 0 && <label className={labelCls}>Valor unitario €</label>}
                  <input value={f.valor} onChange={e => setFila(k, { valor: e.target.value })} inputMode="decimal" className={inputCls} aria-label="Valor €" />
                </div>
                <div className="col-span-3 md:col-span-1 flex items-center gap-1 pb-0.5">
                  {f.devuelta > 0
                    ? <span className="text-[11px] text-muted-foreground" title="Piezas ya devueltas">{f.devuelta} volv.</span>
                    : <Button variant="ghost" size="icon" title="Sacar" onClick={() => setFilas(fs => fs.filter((_, i) => i !== k))} disabled={!!cruce && !temporal}><Trash2 size={14} /></Button>}
                </div>
              </div>
            ))}
          </div>
          {(!cruce || temporal) && <Button variant="outline" size="sm" className="mt-2" onClick={() => setFilas(fs => [...fs, { producto: '', descripcion: '', cantidad: '', valor: '', devuelta: 0 }])}><Plus size={13} className="mr-1" />Agregar pieza</Button>}
          {cruce && !temporal && <p className="text-xs text-muted-foreground mt-2">En una compra o venta las piezas no se cambian: si está mal, anulala y cargala de nuevo.</p>}
        </div>

        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm bg-muted/40 rounded p-2">
          <span>Valor: <b>{formatCurrency(totalEur, 'EUR')}</b></span>
          {tasaN ? <span>En pesos: <b>{formatCurrency(totalEur * tasaN)}</b></span> : null}
          {alquiler != null && <span>Alquiler mensual: <b>{formatCurrency(alquiler)}</b></span>}
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={enviar} disabled={guardar.isPending}>{guardar.isPending ? 'Guardando…' : 'Guardar'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Devolución ───────────────────────────────────────────────────────────────

function DevolucionDialog({ cruce, onClose }: { cruce: CruceMaterial; onClose: () => void }) {
  const devolver = useDevolverCruce();
  const pendientes = cruce.items.filter(i => i.cantidad > i.cantidad_devuelta);
  const [fecha, setFecha] = useState(hoyISO());
  const [cant, setCant] = useState<Record<number, string>>(() => Object.fromEntries(pendientes.map(i => [i.id, String(i.cantidad - i.cantidad_devuelta)])));
  const [error, setError] = useState('');
  const dado = cruce.tipo === 'ALQUILER_DADO' || cruce.tipo === 'PRESTAMO_DADO';

  const enviar = async () => {
    setError('');
    const items: { item_id: number; cantidad: number }[] = [];
    for (const i of pendientes) {
      const n = num(cant[i.id] ?? '');
      if (n == null || n === 0) continue;
      if (isNaN(n) || n < 0 || !Number.isInteger(n) || n > i.cantidad - i.cantidad_devuelta) { setError(`Revisá "${i.descripcion}": faltan ${i.cantidad - i.cantidad_devuelta}`); return; }
      items.push({ item_id: i.id, cantidad: n });
    }
    if (!items.length) { setError('Indicá qué volvió'); return; }
    try { await devolver.mutateAsync({ id: cruce.id, fecha, items }); onClose(); }
    catch (e) { setError(getApiErrorMessage(e)); }
  };

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader><DialogTitle>{dado ? `Lo que volvió de ${cruce.tercero}` : `Lo que le devolvimos a ${cruce.tercero}`}</DialogTitle></DialogHeader>
        <div className="w-48">
          <label className={labelCls}>Fecha</label>
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className={inputCls} />
        </div>
        <BaseTable className="w-full text-sm">
          <thead className="border-b bg-muted/30"><tr>
            <th className="px-2 py-1.5 text-left text-xs font-medium text-muted-foreground">Pieza</th>
            <th className="px-2 py-1.5 text-right text-xs font-medium text-muted-foreground">Falta</th>
            <th className="px-2 py-1.5 text-right text-xs font-medium text-muted-foreground w-28">Vuelve</th>
          </tr></thead>
          <tbody className="divide-y">
            {pendientes.map(i => (
              <tr key={i.id}>
                <td className="px-2 py-1.5" data-label="Pieza">{i.descripcion}</td>
                <td className="px-2 py-1.5 text-right tabular-nums" data-label="Falta">{i.cantidad - i.cantidad_devuelta}</td>
                <td className="px-2 py-1.5" data-label="Vuelve"><input value={cant[i.id] ?? ''} onChange={e => setCant(c => ({ ...c, [i.id]: e.target.value }))} inputMode="numeric" className={cn(inputCls, 'text-right')} aria-label={`Vuelve ${i.descripcion}`} /></td>
              </tr>
            ))}
          </tbody>
        </BaseTable>
        <p className="text-xs text-muted-foreground">Si vuelve todo, la operación se cierra. Si falta algo, queda abierta con lo pendiente.</p>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={enviar} disabled={devolver.isPending}>Registrar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Desde una planilla ───────────────────────────────────────────────────────

function PlanillaDialog({ onElegir, onClose }: { onElegir: (inicial: InicialCruce) => void; onClose: () => void }) {
  const leer = useLeerPlanillaCruce();
  const ref = useRef<HTMLInputElement>(null);
  const [hojas, setHojas] = useState<HojaPlanillaCruce[] | null>(null);
  const [hoja, setHoja] = useState('');
  const [error, setError] = useState('');
  const h = hojas?.find(x => x.hoja === hoja) ?? null;

  const elegirArchivo = async (f: File) => {
    setError(''); setHojas(null);
    try { const r = await leer.mutateAsync(f); setHojas(r.hojas); setHoja(r.hojas.find(x => !x.ya_cargada)?.hoja ?? r.hojas[0]?.hoja ?? ''); if (!r.hojas.length) setError('No encontré hojas con una tabla de material (columna "Descripcion" y una de cantidad).'); }
    catch (e) { setError(getApiErrorMessage(e)); }
  };

  const seguir = () => {
    if (!h) return;
    const nombre = h.hoja.toUpperCase();
    const tipo: TipoCruceMaterial = /COMPRA/.test(nombre) ? 'COMPRA' : /VENTA/.test(nombre) ? 'VENTA' : 'ALQUILER_DADO';
    const tercero = (h.hoja.split(' - ')[1] ?? '').replace(/\b(3%|3,5|ZAM)\b.*$/i, '').trim();
    onElegir({
      tipo, tercero: tercero ? tercero.charAt(0) + tercero.slice(1).toLowerCase() : '',
      fecha_desde: h.fecha ?? hoyISO(), tasa_euro: h.tasa_euro, porcentaje_alquiler: h.porcentaje_alquiler,
      notas: `Planilla: hoja "${h.hoja}"`, import_key: h.import_key,
      items: h.items.map(i => ({ producto_id: i.producto_id, descripcion: i.descripcion, cantidad: i.cantidad, valor_unitario_eur: i.valor_unitario_eur })),
    });
  };

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Cargar desde una planilla</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground -mt-1">Un cuadro de cruce de material (por ejemplo, el de BB o el de Airasca): cada hoja es una operación. Elegí la hoja, revisá las piezas y completá con quién y qué es antes de guardar.</p>
        <input ref={ref} type="file" accept=".xlsx,.xls" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) void elegirArchivo(f); }} />
        <Button variant="outline" onClick={() => ref.current?.click()} disabled={leer.isPending} className="self-start"><Upload size={14} className="mr-1.5" />{leer.isPending ? 'Leyendo…' : 'Elegir archivo'}</Button>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {hojas && hojas.length > 0 && (
          <div className="space-y-3">
            <div>
              <label className={labelCls}>Hoja</label>
              <select value={hoja} onChange={e => setHoja(e.target.value)} className={inputCls} aria-label="Hoja">
                {hojas.map(x => <option key={x.hoja} value={x.hoja}>{x.hoja} — {x.items.length} piezas{x.ya_cargada ? ' (ya cargada)' : ''}</option>)}
              </select>
            </div>
            {h && (
              <>
                <p className="text-xs text-muted-foreground">
                  Cantidad de la columna "{h.columna_cantidad}"{h.tasa_euro ? ` · euro a $${h.tasa_euro.toLocaleString('es-AR')}` : ''}{h.fecha ? ` (${formatDate(h.fecha)})` : ''}{h.porcentaje_alquiler != null ? ` · alquiler ${h.porcentaje_alquiler}%` : ''}
                  {h.sin_producto > 0 && <span className="text-amber-700"> · {h.sin_producto} pieza{h.sin_producto === 1 ? '' : 's'} sin producto en el catálogo</span>}
                </p>
                {h.ya_cargada && <p className="text-sm text-amber-700 bg-amber-50 rounded p-2">Esta hoja ya se cargó.</p>}
                <BaseTable className="w-full text-sm">
                  <thead className="border-b bg-muted/30"><tr>
                    <th className="px-2 py-1.5 text-left text-xs font-medium text-muted-foreground">En la planilla</th>
                    <th className="px-2 py-1.5 text-right text-xs font-medium text-muted-foreground">Cant.</th>
                    <th className="px-2 py-1.5 text-right text-xs font-medium text-muted-foreground">€ unit.</th>
                    <th className="px-2 py-1.5 text-left text-xs font-medium text-muted-foreground">Producto</th>
                  </tr></thead>
                  <tbody className="divide-y">
                    {h.items.map((i, k) => (
                      <tr key={k}>
                        <td className="px-2 py-1.5" data-label="En la planilla">{i.descripcion}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums" data-label="Cant.">{i.cantidad}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums" data-label="€">{i.valor_unitario_eur != null ? i.valor_unitario_eur.toLocaleString('es-AR', { minimumFractionDigits: 2 }) : '—'}</td>
                        <td className="px-2 py-1.5" data-label="Producto">{i.producto_nombre
                          ? <span>{i.producto_nombre} <span className="text-[11px] text-muted-foreground">({i.como === 'precio' ? 'por el precio' : i.como === 'codigo' ? 'por el código' : 'por el nombre'})</span></span>
                          : <span className="text-amber-700">Sin producto</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </BaseTable>
              </>
            )}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={seguir} disabled={!h || h.ya_cargada}>Seguir</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Pestaña ──────────────────────────────────────────────────────────────────

export default function CrucesTab() {
  const { user } = useAuth();
  const canEdit = user?.rol === 'ADMIN' || user?.rol === 'OPERADOR';
  const { data, isLoading } = useCrucesMaterial();
  const anular = useAnularCruce();
  const [searchParams, setSearchParams] = useSearchParams();
  const [soloAbiertos, setSoloAbiertos] = useState(true);
  const [editor, setEditor] = useState<{ cruce: CruceMaterial | null; inicial: InicialCruce | null } | null>(null);
  const [devolucion, setDevolucion] = useState<CruceMaterial | null>(null);
  const [planilla, setPlanilla] = useState(false);
  const cruces = data?.cruces ?? [];
  const hoy = hoyISO();

  // ?cruce=N (desde el calendario) abre esa operación
  const cruceParam = Number(searchParams.get('cruce'));
  useEffect(() => {
    if (!cruceParam || !cruces.length) return;
    const c = cruces.find(x => x.id === cruceParam);
    if (c) { setSoloAbiertos(false); if (canEdit && c.estado !== 'ANULADO') setEditor({ cruce: c, inicial: null }); }
    searchParams.delete('cruce'); setSearchParams(searchParams, { replace: true });
  }, [cruceParam, cruces, canEdit, searchParams, setSearchParams]);

  const filas = cruces.filter(c => !soloAbiertos || c.estado === 'ABIERTO');
  const abiertos = cruces.filter(c => c.estado === 'ABIERTO');
  const afuera = abiertos.filter(c => c.tipo === 'ALQUILER_DADO' || c.tipo === 'PRESTAMO_DADO').reduce((a, c) => a + c.pendientes, 0);
  const ajeno = abiertos.filter(c => c.tipo === 'ALQUILER_TOMADO' || c.tipo === 'PRESTAMO_TOMADO').reduce((a, c) => a + c.pendientes, 0);
  const alquilerMes = abiertos.filter(c => c.tipo === 'ALQUILER_DADO').reduce((a, c) => a + (c.alquiler_mensual ?? 0), 0);

  const anularCruce = (c: CruceMaterial) => {
    const extra = c.tipo === 'COMPRA' ? ' Se resta del stock lo que se había sumado.' : c.tipo === 'VENTA' ? ' Se vuelve a sumar al stock lo que se había restado.' : '';
    if (!window.confirm(`¿Anular ${TIPO[c.tipo].corto.toLowerCase()} ${c.tercero}?${extra}`)) return;
    anular.mutate(c.id, { onError: e => alert(getApiErrorMessage(e)) });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-sm text-muted-foreground max-w-3xl">
          Material que se le alquila o presta a otra empresa (sale del stock hasta que vuelve), el que otra nos alquila o presta (se suma mientras dura) y lo que se compra o vende entre ellas.
        </p>
        {canEdit && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setPlanilla(true)}><Upload size={14} className="mr-1.5" />Desde una planilla</Button>
            <Button size="sm" onClick={() => setEditor({ cruce: null, inicial: null })}><Plus size={14} className="mr-1.5" />Nueva operación</Button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded-full border px-3 py-0.5">{afuera} piezas afuera</span>
        <span className="rounded-full border px-3 py-0.5">{ajeno} piezas de terceros</span>
        {alquilerMes > 0 && <span className="rounded-full border px-3 py-0.5">Alquiler a cobrar: {formatCurrency(alquilerMes)} por mes</span>}
        <label className="flex items-center gap-2 ml-2"><input type="checkbox" checked={soloAbiertos} onChange={e => setSoloAbiertos(e.target.checked)} />Sólo lo que está en curso</label>
      </div>

      {isLoading ? <p className="text-sm text-muted-foreground">Cargando…</p> : filas.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border rounded-lg">
          <ArrowLeftRight size={36} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">{soloAbiertos ? 'No hay material cruzado en curso.' : 'Todavía no se cargó ninguna operación.'}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <BaseTable className="w-full text-sm min-w-[900px]">
            <thead className="border-b bg-muted/30">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Con quién</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Qué</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Desde</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Vuelve</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Piezas</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Valor</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Alquiler / mes</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {filas.map(c => {
                const vencido = c.estado === 'ABIERTO' && c.fecha_hasta && c.fecha_hasta.slice(0, 10) < hoy;
                return (
                  <tr key={c.id} className={cn('hover:bg-muted/20', c.estado === 'ANULADO' && 'opacity-50', vencido && 'bg-red-50/60')}>
                    <td className="px-3 py-2.5" data-label="Con quién">
                      <div className="font-medium">{c.tercero}</div>
                      <div className="text-xs text-muted-foreground">{[c.evento?.nombre, c.referencia].filter(Boolean).join(' · ')}</div>
                    </td>
                    <td className="px-3 py-2.5" data-label="Qué"><Badge variant={TIPO[c.tipo].variant}>{TIPO[c.tipo].label}</Badge>{c.estado === 'ANULADO' && <Badge variant="muted" className="ml-1">Anulada</Badge>}</td>
                    <td className="px-3 py-2.5 tabular-nums" data-label="Desde">{formatDate(c.fecha_desde)}</td>
                    <td className="px-3 py-2.5" data-label="Vuelve">
                      {!c.temporal ? '—' : c.estado === 'CERRADO' ? <span className="text-green-700">Volvió {formatDate(c.fecha_cierre)}</span>
                        : c.fecha_hasta ? <span className={cn(vencido && 'text-red-700 font-medium')}>{vencido ? 'Tenía que volver ' : ''}{formatDate(c.fecha_hasta)}</span>
                        : <span className="text-muted-foreground">Sin fecha</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums" data-label="Piezas">{c.temporal && c.estado === 'ABIERTO' && c.pendientes !== c.piezas ? `${c.pendientes} de ${c.piezas}` : c.piezas}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums" data-label="Valor">
                      {c.total_eur ? formatCurrency(c.total_eur, 'EUR') : '—'}
                      {c.total_pesos ? <div className="text-xs text-muted-foreground">{formatCurrency(c.total_pesos)}</div> : null}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums" data-label="Alquiler / mes">{c.alquiler_mensual != null ? `${formatCurrency(c.alquiler_mensual)} (${c.porcentaje_alquiler}%)` : '—'}</td>
                    <td className="px-3 py-2.5">
                      {canEdit && c.estado !== 'ANULADO' && (
                        <div className="flex justify-end gap-1">
                          {c.temporal && c.estado === 'ABIERTO' && <Button variant="ghost" size="sm" onClick={() => setDevolucion(c)}><Undo2 size={14} className="mr-1" />Devolución</Button>}
                          <Button variant="ghost" size="icon" title="Editar" onClick={() => setEditor({ cruce: c, inicial: null })}><Pencil size={14} /></Button>
                          <Button variant="ghost" size="icon" title="Anular" className="text-destructive hover:text-destructive" onClick={() => anularCruce(c)}><Ban size={14} /></Button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </BaseTable>
        </div>
      )}

      {editor && <CruceDialog cruce={editor.cruce} inicial={editor.inicial} terceros={data?.terceros ?? []} onClose={() => setEditor(null)} />}
      {devolucion && <DevolucionDialog cruce={devolucion} onClose={() => setDevolucion(null)} />}
      {planilla && <PlanillaDialog onClose={() => setPlanilla(false)} onElegir={inicial => { setPlanilla(false); setEditor({ cruce: null, inicial }); }} />}
    </div>
  );
}
