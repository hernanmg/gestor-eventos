import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Calculator, Copy, RefreshCw, Search, X, AlertTriangle } from 'lucide-react';
import {
  usePresupuesto, useMaterialesRental, useGuardarPresupuesto, useCambiarEstadoPresupuesto,
  useCambiarTipoCambioPresupuesto, useNuevaVersionPresupuesto,
  calcularLinea, porcentajeHabilitado, PORCENTAJES_ALQUILER, type PresupuestoPayload,
} from '@/hooks/usePresupuestos';
import { useEventos } from '@/hooks/useEvento';
import { useIndicadores } from '@/hooks/useIndicadores';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { PresupuestoEstadoBadge } from '@/components/ui/badge';
import BaseTable from '@/components/ui/BaseTable';
import MoneyInput from '@/components/ui/MoneyInput';
import { cn, getApiErrorMessage } from '@/lib/utils';
import { formatCurrency } from '@/lib/formatters';
import type { MaterialRental, PorcentajeAlquiler, Presupuesto, PresupuestoLinea } from '@/types';

// Presupuesto de rental (DOS57). En BORRADOR los importes se calculan en
// pantalla con los precios actuales del catálogo (el backend hace el mismo
// cálculo al guardar y congela el snapshot). En cualquier otro estado se
// muestra el snapshot guardado, en sólo lectura.

const inputCls = 'w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring bg-white disabled:bg-muted/40';
const labelCls = 'block text-xs font-medium text-muted-foreground mb-0.5';
const thCls    = 'px-2 py-2 text-left text-xs font-medium text-muted-foreground';
const tdNum    = 'px-2 py-2 text-right tabular-nums';
const DASH     = <span className="text-muted-foreground">–</span>;

type MaterialLinea = Omit<MaterialRental, 'peso_por_unidad'>;
// full: ALQUILER FULL negociado a mano ('' = sin cargar). No hay regla fija.
type LineaForm = { key: string; material: MaterialLinea; cantidad: string; full: string; snap?: PresupuestoLinea };

// Sólo los NAC con FULL habilitado en la planilla admiten el valor FULL
const admiteFull = (m: MaterialLinea) => m.origen === 'NAC' && m.porc_full;

type Form = {
  evento_id: string; nombre: string; porcentaje: PorcentajeAlquiler; tc: string; notas: string;
  lineas: LineaForm[];
};

let seq = 0;
const nuevaKey = () => `l${++seq}`;

function formDesde(p: Presupuesto | undefined): Form {
  if (!p) return { evento_id: '', nombre: '', porcentaje: '4', tc: '1700', notas: '', lineas: [] };
  return {
    evento_id:  p.evento_id ? String(p.evento_id) : '',
    nombre:     p.nombre,
    porcentaje: p.porcentaje_alquiler,
    tc:         String(p.tipo_cambio_usd),
    notas:      p.notas ?? '',
    lineas:     p.lineas.map(l => ({
      key: nuevaKey(), material: l.material, cantidad: String(l.cantidad),
      full: l.valor_rental_full !== null ? String(l.valor_rental_full) : '', snap: l,
    })),
  };
}

function payloadDesde(f: Form): PresupuestoPayload {
  return {
    evento_id:           f.evento_id ? Number(f.evento_id) : null,
    nombre:              f.nombre.trim() || null,
    porcentaje_alquiler: f.porcentaje,
    tipo_cambio_usd:     Number(f.tc) || 1700,
    notas:               f.notas.trim() || null,
    lineas:              f.lineas.map(l => ({
      material_id:       l.material.id,
      cantidad:          Number(l.cantidad),
      valor_rental_full: admiteFull(l.material) && l.full.trim() !== '' ? Number(l.full) : null,
    })),
  };
}

const pctLabel = (p: number) => (p === 100 ? 'FULL' : `${p}%`);

// ── Buscador inline del catálogo ──────────────────────────────────────────────

function BuscadorMateriales({ catalogo, onElegir }: { catalogo: MaterialRental[]; onElegir: (m: MaterialRental) => void }) {
  const [q, setQ] = useState('');
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cerrar = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false); };
    document.addEventListener('mousedown', cerrar);
    return () => document.removeEventListener('mousedown', cerrar);
  }, []);

  const resultados = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    return catalogo.filter(m =>
      m.detalle.toLowerCase().includes(t) || (m.codigo_oficial ?? '').includes(t) || String(m.nro_item) === t,
    ).slice(0, 15);
  }, [catalogo, q]);

  const elegir = (m: MaterialRental) => { onElegir(m); setQ(''); setAbierto(false); };

  return (
    <div ref={ref} className="relative w-full max-w-xl">
      <Search size={14} className="absolute left-2 top-2.5 text-muted-foreground" />
      <input
        value={q}
        onChange={e => { setQ(e.target.value); setAbierto(true); }}
        onFocus={() => setAbierto(true)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (resultados[0]) elegir(resultados[0]); } if (e.key === 'Escape') setAbierto(false); }}
        placeholder="Agregar ítem: buscar por detalle, código o N°…"
        className={cn(inputCls, 'pl-7')}
      />
      {abierto && q.trim() && (
        <div role="listbox" className="absolute z-20 mt-1 w-full max-h-80 overflow-y-auto rounded-xl border border-border bg-popover text-popover-foreground shadow-[0_8px_24px_rgba(0,0,0,0.15)]">
          {resultados.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">Sin resultados en el catálogo activo.</p>
          ) : resultados.map(m => (
            <button key={m.id} type="button" role="option" aria-selected={false} onClick={() => elegir(m)} className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted/50 flex items-center gap-2">
              <span className={cn('text-[10px] font-semibold rounded px-1', m.origen === 'IMP' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-700')}>{m.origen}</span>
              <span className="text-xs text-muted-foreground tabular-nums w-8">{m.nro_item}</span>
              {m.codigo_oficial && <span className="font-mono text-xs text-muted-foreground">{m.codigo_oficial}</span>}
              <span className="flex-1 truncate">{m.detalle}{m.medida && <span className="text-muted-foreground"> — {m.medida}</span>}</span>
              <span className="text-xs tabular-nums text-muted-foreground">{m.costo_unitario_ars !== null ? formatCurrency(m.costo_unitario_ars) : 'sin precio'}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function PresupuestoEditorPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id: idParam } = useParams<{ id: string }>();
  const id = idParam && idParam !== 'nuevo' ? Number(idParam) : null;

  const { data: presupuesto, isLoading, isError } = usePresupuesto(id);
  const { data: catalogo = [] } = useMaterialesRental({ activo: true });
  const { data: eventos = [] } = useEventos();
  const { data: indicadores } = useIndicadores();
  const guardar      = useGuardarPresupuesto();
  const cambiarEstado = useCambiarEstadoPresupuesto();
  const cambiarTc    = useCambiarTipoCambioPresupuesto();
  const nuevaVersion = useNuevaVersionPresupuesto();

  const [form, setForm] = useState<Form>(() => formDesde(undefined));
  const [inicial, setInicial] = useState(() => JSON.stringify(payloadDesde(formDesde(undefined))));
  const [error, setError] = useState<string | null>(null);

  // Al cargar (o al volver del servidor tras guardar) se resetea el form
  useEffect(() => {
    if (!presupuesto) return;
    const f = formDesde(presupuesto);
    setForm(f);
    setInicial(JSON.stringify(payloadDesde(f)));
  }, [presupuesto]);

  // Presupuesto nuevo: el TC arranca con el dólar oficial (venta) del sistema,
  // salvo que el usuario ya lo haya escrito. Los guardados conservan el suyo.
  const [tcTocado, setTcTocado] = useState(false);
  const oficialVenta = indicadores?.dolar_oficial?.venta;
  useEffect(() => {
    if (!id && !tcTocado && oficialVenta) setForm(f => ({ ...f, tc: String(oficialVenta) }));
  }, [id, tcTocado, oficialVenta]);

  const editable = !presupuesto || presupuesto.estado === 'BORRADOR';
  const tc = Number(form.tc) || 0;
  const sucio = JSON.stringify(payloadDesde(form)) !== inicial;
  const ocupado = guardar.isPending || cambiarEstado.isPending || cambiarTc.isPending || nuevaVersion.isPending;

  // Importes por línea: en vivo (editable) o el snapshot guardado (sólo lectura)
  const filas = useMemo(() => form.lineas.map(l => {
    if (!editable && l.snap) {
      return { l, unitario: l.snap.costo_unitario_snap as number | null, pct: l.snap.porcentaje_snap, total: l.snap.costo_total_material, rental: l.snap.valor_rental, full: l.snap.valor_rental_full };
    }
    const full = admiteFull(l.material) && l.full.trim() !== '' ? Number(l.full) || 0 : null;
    return { l, ...calcularLinea(l.material, Number(l.cantidad) || 0, form.porcentaje, tc), full };
  }), [form.lineas, form.porcentaje, tc, editable]);

  const totales = useMemo(() => {
    const t = { NAC: { material: 0, rental: 0 }, IMP: { material: 0, rental: 0 }, full: null as number | null };
    for (const f of filas) {
      t[f.l.material.origen].material += f.total;
      t[f.l.material.origen].rental += f.rental;
      if (f.full !== null) t.full = (t.full ?? 0) + f.full;
    }
    return t;
  }, [filas]);

  if (user?.rol !== 'ADMIN') return <Navigate to="/" replace />;
  if (id && isLoading) return <p className="p-6 text-sm text-muted-foreground">Cargando…</p>;
  if (id && (isError || !presupuesto)) return <p className="p-6 text-sm text-destructive">Presupuesto no encontrado.</p>;

  const set = (patch: Partial<Form>) => setForm(f => ({ ...f, ...patch }));
  const setLinea = (key: string, patch: Partial<Pick<LineaForm, 'cantidad' | 'full'>>) => set({ lineas: form.lineas.map(l => (l.key === key ? { ...l, ...patch } : l)) });
  const quitarLinea = (key: string) => set({ lineas: form.lineas.filter(l => l.key !== key) });
  const agregar = (m: MaterialRental) => set({ lineas: [...form.lineas, { key: nuevaKey(), material: m, cantidad: '1', full: '' }] });

  const elegirEvento = (v: string) => {
    const ev = eventos.find(e => String(e.id) === v);
    // El nombre se completa con el del evento si estaba vacío o era el del evento anterior
    const anterior = eventos.find(e => String(e.id) === form.evento_id);
    const pisarNombre = ev && (!form.nombre.trim() || form.nombre === anterior?.nombre);
    set({ evento_id: v, ...(pisarNombre && { nombre: ev.nombre }) });
  };

  const validar = (): string | null => {
    if (!form.evento_id && !form.nombre.trim()) return 'Elegí un evento o escribí un nombre';
    if (!(Number(form.tc) > 0)) return 'El tipo de cambio tiene que ser mayor a 0';
    const mal = form.lineas.find(l => !(Number(l.cantidad) > 0));
    if (mal) return `Cantidad inválida en "${mal.material.detalle}"`;
    const fullMal = form.lineas.find(l => admiteFull(l.material) && l.full.trim() !== '' && !(Number(l.full) >= 0));
    if (fullMal) return `Valor FULL inválido en "${fullMal.material.detalle}"`;
    return null;
  };

  const ejecutar = async (accion: () => Promise<void>) => {
    setError(null);
    try { await accion(); } catch (err) { setError(getApiErrorMessage(err)); }
  };

  const handleGuardar = (aprobar: boolean) => ejecutar(async () => {
    const v = validar();
    if (v) { setError(v); return; }
    let p = await guardar.mutateAsync({ id: id ?? undefined, data: payloadDesde(form) });
    if (aprobar) p = await cambiarEstado.mutateAsync({ id: p.id, estado: 'APROBADO' });
    if (!id) navigate(`/presupuestos/${p.id}`, { replace: true });
  });

  // Con cambios sin guardar, se guarda todo (el PUT recalcula con el TC nuevo);
  // si no, sólo se recalculan las líneas IMP con el TC nuevo.
  const handleRecalcularTc = () => ejecutar(async () => {
    if (!id) return;
    if (!(Number(form.tc) > 0)) { setError('El tipo de cambio tiene que ser mayor a 0'); return; }
    if (sucio) await guardar.mutateAsync({ id, data: payloadDesde(form) });
    else await cambiarTc.mutateAsync({ id, tipo_cambio_usd: Number(form.tc) });
  });

  const handleNuevaVersion = () => ejecutar(async () => {
    if (!id) return;
    const p = await nuevaVersion.mutateAsync(id);
    navigate(`/presupuestos/${p.id}`);
  });

  const hayImp = form.lineas.some(l => l.material.origen === 'IMP');

  return (
    <div className="p-6 space-y-5 max-w-[1500px] mx-auto">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-3">
          <Link to="/presupuestos" className="text-muted-foreground hover:text-foreground"><ArrowLeft size={18} /></Link>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Calculator size={22} />
            {presupuesto ? presupuesto.nombre : 'Nuevo presupuesto'}
            {presupuesto && presupuesto.version > 1 && <span className="text-sm font-normal text-muted-foreground">v{presupuesto.version}</span>}
          </h1>
          {presupuesto && <PresupuestoEstadoBadge estado={presupuesto.estado} />}
        </div>
        <div className="flex gap-2">
          {editable ? (
            <>
              <Button size="sm" variant="outline" disabled={ocupado} onClick={() => handleGuardar(false)}>Guardar borrador</Button>
              <Button size="sm" disabled={ocupado || form.lineas.length === 0} onClick={() => handleGuardar(true)}>Guardar y aprobar</Button>
            </>
          ) : (
            <Button size="sm" disabled={ocupado} onClick={handleNuevaVersion}><Copy size={14} className="mr-1.5" /> Nueva versión</Button>
          )}
        </div>
      </div>
      {!editable && (
        <p className="text-xs text-muted-foreground -mt-2">
          Presupuesto {presupuesto!.estado.toLowerCase()}: se muestran los precios congelados al guardarlo. Para modificarlo, creá una nueva versión.
        </p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* ── Cabecera ── */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-3 rounded-lg border bg-white p-4">
        <div>
          <label className={labelCls}>Evento (opcional)</label>
          <select value={form.evento_id} onChange={e => elegirEvento(e.target.value)} disabled={!editable} className={inputCls}>
            <option value="">— Sin evento —</option>
            {eventos.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Nombre {!form.evento_id && '*'}</label>
          <input value={form.nombre} onChange={e => set({ nombre: e.target.value })} disabled={!editable} placeholder="Ej. La Renga Jujuy 2026" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>% Alquiler (nacionales)</label>
          <div className="flex flex-wrap gap-1">
            {PORCENTAJES_ALQUILER.map(p => (
              <button key={p} type="button" disabled={!editable} onClick={() => set({ porcentaje: p })}
                className={cn('rounded border px-2.5 py-1 text-sm disabled:opacity-60', form.porcentaje === p ? 'bg-primary text-primary-foreground border-primary' : 'bg-white hover:bg-muted/50')}>
                {p === 'FULL' ? 'FULL' : `${p}%`}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">Importados Layher: siempre 4%. FULL = 100% del costo.</p>
        </div>
        <div>
          <label className={labelCls}>Tipo de cambio USD</label>
          <div className="flex gap-1">
            <input type="number" min={0} step="0.01" value={form.tc} onChange={e => { setTcTocado(true); set({ tc: e.target.value }); }} disabled={!editable} className={inputCls} />
            {id && editable && (
              <Button type="button" size="sm" variant="outline" disabled={ocupado || !hayImp || Number(form.tc) === presupuesto?.tipo_cambio_usd}
                onClick={handleRecalcularTc} title="Recalcula las líneas importadas con este tipo de cambio y lo guarda">
                <RefreshCw size={13} className="mr-1" /> Recalcular
              </Button>
            )}
          </div>
          {(indicadores?.dolar_oficial || indicadores?.dolar_blue) && (
            <p className="text-[11px] text-muted-foreground mt-1 tabular-nums">
              {indicadores.dolar_oficial && <>Oficial: {formatCurrency(indicadores.dolar_oficial.venta)}</>}
              {indicadores.dolar_oficial && indicadores.dolar_blue && ' · '}
              {indicadores.dolar_blue && <>Blue: {formatCurrency(indicadores.dolar_blue.venta)}</>}
            </p>
          )}
        </div>
        <div className="md:col-span-4">
          <label className={labelCls}>Notas</label>
          <textarea rows={2} value={form.notas} onChange={e => set({ notas: e.target.value })} disabled={!editable} className={inputCls} />
        </div>
      </section>

      {/* ── Ítems ── */}
      <section className="space-y-2">
        {editable && <BuscadorMateriales catalogo={catalogo} onElegir={agregar} />}
        {form.lineas.length === 0 ? (
          <div className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
            {editable ? 'Buscá ítems del catálogo para agregarlos al presupuesto.' : 'Este presupuesto no tiene ítems.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <BaseTable className="w-full text-sm min-w-[1300px]">
              <thead className="border-b bg-muted/10">
                <tr>
                  <th className={thCls}>Origen</th>
                  <th className={thCls}>Nro</th>
                  <th className={thCls}>Código</th>
                  <th className={thCls}>Detalle</th>
                  <th className={thCls}>Medida</th>
                  <th className={`${thCls} text-right w-28`}>Cantidad</th>
                  <th className={`${thCls} text-right`}>Costo unit.</th>
                  <th className={`${thCls} text-right`}>Costo total</th>
                  <th className={`${thCls} text-right`}>% Rental</th>
                  <th className={`${thCls} text-right`}>Valor rental</th>
                  <th className={`${thCls} text-right w-36`} title="Alquiler FULL negociado por evento/cliente — se carga a mano, no se calcula">FULL</th>
                  {editable && <th className="w-8" />}
                </tr>
              </thead>
              <tbody className="divide-y">
                {filas.map(({ l, unitario, pct, total, rental, full }) => {
                  const m = l.material;
                  const pctNoHabilitado = editable && !porcentajeHabilitado(m, form.porcentaje);
                  return (
                    <tr key={l.key} className="hover:bg-muted/20">
                      <td className="px-2 py-2"><span className={cn('text-[10px] font-semibold rounded px-1', m.origen === 'IMP' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-700')}>{m.origen}</span></td>
                      <td className="px-2 py-2 tabular-nums">{m.nro_item}</td>
                      <td className="px-2 py-2 font-mono text-xs">{m.codigo_oficial ?? DASH}</td>
                      <td className="px-2 py-2">{m.detalle}{!m.activo && <span className="ml-1 text-xs text-muted-foreground">(inactivo)</span>}</td>
                      <td className="px-2 py-2 text-muted-foreground">{m.medida ?? DASH}</td>
                      <td className="px-2 py-1 text-right">
                        {editable
                          ? <input type="number" min={0} step="any" value={l.cantidad} onChange={e => setLinea(l.key, { cantidad: e.target.value })} className={cn(inputCls, 'text-right w-24 ml-auto')} />
                          : <span className="tabular-nums">{Number(l.cantidad).toLocaleString('es-AR')}</span>}
                      </td>
                      <td className={tdNum}>
                        {unitario !== null && unitario > 0 ? formatCurrency(unitario) : <span className="text-amber-700" title="El ítem no tiene precio en el catálogo — cargalo en Ítems de rental">–</span>}
                      </td>
                      <td className={tdNum}>{formatCurrency(total)}</td>
                      <td className={tdNum}>
                        <span className={cn(pctNoHabilitado && 'text-amber-700')} title={pctNoHabilitado ? 'Este % no está habilitado para el ítem en la planilla — se calcula igual' : undefined}>
                          {pctNoHabilitado && <AlertTriangle size={11} className="inline mr-0.5 -mt-0.5" />}{pctLabel(pct)}
                        </span>
                      </td>
                      <td className={cn(tdNum, 'font-medium')}>{formatCurrency(rental)}</td>
                      <td className={cn(tdNum, 'py-1')}>
                        {!admiteFull(m) ? DASH
                          : editable
                            ? <MoneyInput value={l.full} onChange={v => setLinea(l.key, { full: v })} placeholder="—" className={cn(inputCls, 'text-right w-32 ml-auto')} />
                            : full !== null ? formatCurrency(full) : DASH}
                      </td>
                      {editable && (
                        <td className="px-1 py-2 text-center">
                          <button type="button" onClick={() => quitarLinea(l.key)} className="text-muted-foreground hover:text-destructive" title="Quitar"><X size={14} /></button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t-2 text-sm">
                {(['NAC', 'IMP'] as const).map(o => (
                  <tr key={o} className="text-muted-foreground">
                    <td className="px-2 py-1.5" colSpan={7}>Subtotal {o === 'NAC' ? 'nacionales' : 'importados'}</td>
                    <td className={cn(tdNum, 'py-1.5')}>{formatCurrency(totales[o].material)}</td>
                    <td />
                    <td className={cn(tdNum, 'py-1.5')}>{formatCurrency(totales[o].rental)}</td>
                    <td />
                    {editable && <td />}
                  </tr>
                ))}
                <tr className="font-semibold">
                  <td className="px-2 py-2" colSpan={7}>Total general</td>
                  <td className={tdNum}>{formatCurrency(totales.NAC.material + totales.IMP.material)}</td>
                  <td />
                  <td className={tdNum}>{formatCurrency(totales.NAC.rental + totales.IMP.rental)}</td>
                  <td className={tdNum}>{totales.full !== null ? formatCurrency(totales.full) : DASH}</td>
                  {editable && <td />}
                </tr>
              </tfoot>
            </BaseTable>
          </div>
        )}
        {editable && sucio && id && <p className="text-xs text-amber-700">Hay cambios sin guardar.</p>}
      </section>
    </div>
  );
}
