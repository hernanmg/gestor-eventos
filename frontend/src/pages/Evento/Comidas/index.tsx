import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Trash2, FileSpreadsheet, Loader2, Sparkles, ClipboardList } from 'lucide-react';
import {
  usePedidoComida, useResumenComidas,
  useCreatePedido, useUpdatePedido, useDeletePedido,
  useAddLinea, useUpdateLinea, useDeleteLinea, useExportarComidas,
  type LineaComidaPayload,
} from '@/hooks/useComidas';
import { useParteDiario } from '@/hooks/useParteDiario';
import { useAuth } from '@/hooks/useAuth';
import ProveedorCombobox from '@/components/domain/ProveedorCombobox';
import { Button } from '@/components/ui/button';
import MoneyInput from '@/components/ui/MoneyInput';
import { cn, getApiErrorMessage } from '@/lib/utils';
import { EMPRESAS } from '@/lib/empresasConstants';
import type { LineaComida, TipoComida, ProveedorBusqueda } from '@/types';

// ── Constantes ────────────────────────────────────────────────────────────────

const TIPO_LABEL: Record<TipoComida, string> = {
  ALMUERZO: 'Almuerzo',
  CENA:     'Cena',
  DESAYUNO: 'Desayuno',
  MERIENDA: 'Merienda',
};
const TIPOS: TipoComida[] = ['ALMUERZO', 'CENA', 'DESAYUNO', 'MERIENDA'];
const AREAS_SUGERIDAS = ['Administración', 'Depósito', 'Eventos', 'Staff'];
const FORMAS_PAGO = ['Cuenta corriente', 'Efectivo', 'Transferencia'];

const inputCls = 'w-full border border-input rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring';
const cellInputCls = 'w-full text-xs border border-transparent rounded px-1 py-0.5 focus:border-ring/50 focus:outline-none bg-transparent hover:bg-accent/30 focus:bg-white transition';
const labelCls = 'block text-xs font-medium text-muted-foreground mb-0.5';

// Navegación de días en el calendario LOCAL — no usar toISOString() (corre un
// día para atrás/adelante cerca de la medianoche local). Mismo criterio que
// ParteDiario/index.tsx.
function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function todayStr(): string {
  return toDateStr(new Date());
}
function addDays(fecha: string, days: number): string {
  const d = new Date(fecha + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return toDateStr(d);
}

// ── Fila de línea (edición inline) ────────────────────────────────────────────

function lineaToLocal(l: LineaComida) {
  return {
    cantidad:       String(l.cantidad),
    valor_unitario: l.valor_unitario !== null ? String(l.valor_unitario) : '',
    detalle:        l.detalle ?? '',
  };
}

function LineaRow({ linea, canEdit, onSave, onDelete }: {
  linea: LineaComida; canEdit: boolean;
  onSave:   (id: number, data: Partial<Omit<LineaComidaPayload, 'tipo' | 'area'>>) => void;
  onDelete: (linea: LineaComida) => void;
}) {
  const [local, setLocal] = useState(lineaToLocal(linea));
  useEffect(() => { setLocal(lineaToLocal(linea)); }, [linea]);

  const field = (key: keyof typeof local) => ({
    value: local[key],
    disabled: !canEdit,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setLocal(p => ({ ...p, [key]: e.target.value })),
    onBlur: () => {
      const orig = lineaToLocal(linea);
      if (local[key] === orig[key]) return;
      if (key === 'cantidad') {
        const n = parseInt(local.cantidad, 10);
        if (isNaN(n) || n < 0) { setLocal(orig); return; }
        onSave(linea.id, { cantidad: n });
      } else if (key === 'valor_unitario') {
        onSave(linea.id, { valor_unitario: local.valor_unitario !== '' ? parseFloat(local.valor_unitario) : null });
      } else {
        onSave(linea.id, { detalle: local.detalle || null });
      }
    },
  });

  const subtotal = linea.cantidad * (linea.valor_unitario ?? 0);
  const cell = 'px-2 py-1.5';

  return (
    <tr className="group border-b border-border/60">
      <td className={cell}>{TIPO_LABEL[linea.tipo]}</td>
      <td className={cell}>{linea.area}</td>
      <td className={cn(cell, 'w-24')}><input type="number" min="0" step="1" {...field('cantidad')} className={cn(cellInputCls, 'text-right')} /></td>
      <td className={cn(cell, 'w-28')}>
        <MoneyInput
          value={local.valor_unitario}
          disabled={!canEdit}
          onChange={v => {
            setLocal(p => ({ ...p, valor_unitario: v }));
            if (v !== lineaToLocal(linea).valor_unitario) {
              onSave(linea.id, { valor_unitario: v !== '' ? Number(v) : null });
            }
          }}
          className={cn(cellInputCls, 'text-right')}
        />
      </td>
      <td className={cn(cell, 'text-right text-sm text-muted-foreground')}>{linea.valor_unitario !== null ? subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 }) : '—'}</td>
      <td className={cell}><input {...field('detalle')} placeholder="—" className={cellInputCls} /></td>
      <td className="w-8 px-1">
        {canEdit && (
          <button
            onClick={() => onDelete(linea)}
            className="p-1 rounded text-destructive opacity-0 group-hover:opacity-100 hover:bg-destructive/10 transition"
            title="Eliminar línea"
          >
            <Trash2 size={13} />
          </button>
        )}
      </td>
    </tr>
  );
}

// ── Formulario de alta de línea ────────────────────────────────────────────────

function AddLineaForm({ onAdd, isPending }: { onAdd: (data: LineaComidaPayload) => void; isPending: boolean }) {
  const [tipo, setTipo]     = useState<TipoComida>('ALMUERZO');
  const [area, setArea]     = useState('');
  const [cantidad, setCantidad] = useState('');
  const [valorUnitario, setValorUnitario] = useState('');
  const [detalle, setDetalle] = useState('');

  const handleSubmit = () => {
    const cant = parseInt(cantidad, 10);
    if (!area.trim() || isNaN(cant) || cant < 0) return;
    onAdd({
      tipo, area: area.trim(), cantidad: cant,
      valor_unitario: valorUnitario !== '' ? parseFloat(valorUnitario) : null,
      detalle: detalle || null,
    });
    setArea(''); setCantidad(''); setValorUnitario(''); setDetalle('');
  };

  return (
    <tr className="border-b border-border/60 bg-muted/20">
      <td className="px-2 py-1.5">
        <select value={tipo} onChange={e => setTipo(e.target.value as TipoComida)} className={cellInputCls}>
          {TIPOS.map(t => <option key={t} value={t}>{TIPO_LABEL[t]}</option>)}
        </select>
      </td>
      <td className="px-2 py-1.5">
        <input value={area} onChange={e => setArea(e.target.value)} list="areas-sugeridas" placeholder="Área" className={cellInputCls} />
        <datalist id="areas-sugeridas">{AREAS_SUGERIDAS.map(a => <option key={a} value={a} />)}</datalist>
      </td>
      <td className="px-2 py-1.5 w-24"><input type="number" min="0" step="1" value={cantidad} onChange={e => setCantidad(e.target.value)} placeholder="0" className={cn(cellInputCls, 'text-right')} /></td>
      <td className="px-2 py-1.5 w-28"><MoneyInput value={valorUnitario} onChange={setValorUnitario} className={cn(cellInputCls, 'text-right')} /></td>
      <td className="px-2 py-1.5" />
      <td className="px-2 py-1.5"><input value={detalle} onChange={e => setDetalle(e.target.value)} placeholder="Detalle" className={cellInputCls} /></td>
      <td className="w-8 px-1">
        <button onClick={handleSubmit} disabled={isPending} title="Agregar línea" className="p-1 rounded text-primary hover:bg-accent transition disabled:opacity-50">
          <Plus size={15} />
        </button>
      </td>
    </tr>
  );
}

// ── Vista de un día ────────────────────────────────────────────────────────────

function DiaComidas({ eventoId, fecha, canEdit, esDos57 }: { eventoId: number; fecha: string; canEdit: boolean; esDos57: boolean }) {
  const { data: pedido, isLoading } = usePedidoComida(eventoId, fecha);
  const { data: parte } = useParteDiario(esDos57 ? fecha : '');

  const crearMut  = useCreatePedido(eventoId);
  const updateMut = useUpdatePedido(eventoId);
  const deleteMut = useDeletePedido(eventoId);
  const addLineaMut    = useAddLinea(eventoId);
  const updateLineaMut = useUpdateLinea(eventoId);
  const deleteLineaMut = useDeleteLinea(eventoId);

  const [proveedorTexto, setProveedorTexto] = useState(pedido?.proveedor_texto ?? '');
  const [notas, setNotas] = useState(pedido?.notas ?? '');
  useEffect(() => {
    setProveedorTexto(pedido?.proveedor_texto ?? '');
    setNotas(pedido?.notas ?? '');
  }, [pedido?.id, pedido?.proveedor_texto, pedido?.notas]);

  const sugerido = parte?.pedido_comida_sugerido?.por_seccion ?? [];
  const totalSugerido = sugerido.reduce((s, x) => s + x.cantidad, 0);

  const handleCrear = () => {
    crearMut.mutate({ fecha }, { onError: err => alert(getApiErrorMessage(err)) });
  };

  const handleUsarComoBase = async () => {
    try {
      let pedidoId = pedido?.id;
      if (!pedidoId) {
        const creado = await crearMut.mutateAsync({ fecha });
        pedidoId = creado.id;
      }
      for (const s of sugerido) {
        await addLineaMut.mutateAsync({ pedidoId, data: { tipo: 'ALMUERZO', area: s.seccion, cantidad: s.cantidad } });
      }
    } catch (err) {
      alert(getApiErrorMessage(err));
    }
  };

  const handleDeletePedido = () => {
    if (!pedido || !window.confirm('¿Eliminar el registro de comidas de este día?')) return;
    deleteMut.mutate(pedido.id, { onError: err => alert(getApiErrorMessage(err)) });
  };

  const handleDeleteLinea = (linea: LineaComida) => {
    if (!window.confirm(`¿Eliminar ${TIPO_LABEL[linea.tipo]} — ${linea.area}?`)) return;
    deleteLineaMut.mutate(linea.id, { onError: err => alert(getApiErrorMessage(err)) });
  };

  if (isLoading) return <p className="text-sm text-muted-foreground py-8 text-center">Cargando...</p>;

  return (
    <div className="space-y-4">
      {esDos57 && totalSugerido > 0 && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-blue-50 border border-blue-200">
          <Sparkles size={16} className="text-blue-600 shrink-0 mt-0.5" />
          <div className="flex-1 text-sm text-blue-900">
            <p>
              Según el Parte Diario de hoy hay <strong>{totalSugerido}</strong> persona{totalSugerido !== 1 ? 's' : ''} asignada{totalSugerido !== 1 ? 's' : ''} —{' '}
              {sugerido.map((s, i) => (
                <span key={s.seccion}>{i > 0 && ', '}{s.seccion}: {s.cantidad}</span>
              ))}
            </p>
          </div>
          {canEdit && (
            <Button size="sm" variant="outline" className="shrink-0 h-7 text-xs bg-white" onClick={handleUsarComoBase} disabled={crearMut.isPending || addLineaMut.isPending}>
              Usar como base
            </Button>
          )}
        </div>
      )}

      {!pedido ? (
        <div className="text-center py-16 border border-dashed rounded-lg">
          <p className="text-sm text-muted-foreground mb-3">Todavía no hay comidas registradas para el {fecha}.</p>
          {canEdit && (
            <Button size="sm" onClick={handleCrear} disabled={crearMut.isPending}>
              {crearMut.isPending ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : <Plus size={14} className="mr-1.5" />}
              Registrar comidas de este día
            </Button>
          )}
        </div>
      ) : (
        <>
          {/* Cabecera editable */}
          <div className="rounded-lg border border-border bg-white p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Proveedor</label>
                <ProveedorCombobox
                  value={pedido.proveedor as ProveedorBusqueda | null}
                  onChange={v => updateMut.mutate({ id: pedido.id, data: { proveedor_id: v ? v.id : null } })}
                  className="w-full"
                />
                {!pedido.proveedor_id && (
                  <input
                    value={proveedorTexto}
                    onChange={e => setProveedorTexto(e.target.value)}
                    onBlur={() => proveedorTexto !== (pedido.proveedor_texto ?? '') && updateMut.mutate({ id: pedido.id, data: { proveedor_texto: proveedorTexto || null } })}
                    disabled={!canEdit}
                    placeholder="o nombre libre…"
                    className={cn(inputCls, 'mt-1')}
                  />
                )}
              </div>
              <div>
                <label className={labelCls}>Forma de pago</label>
                <input
                  defaultValue={pedido.forma_pago ?? ''}
                  list="formas-pago"
                  disabled={!canEdit}
                  onBlur={e => e.target.value !== (pedido.forma_pago ?? '') && updateMut.mutate({ id: pedido.id, data: { forma_pago: e.target.value || null } })}
                  className={inputCls}
                />
                <datalist id="formas-pago">{FORMAS_PAGO.map(f => <option key={f} value={f} />)}</datalist>
              </div>
              <div>
                <label className={labelCls}>Notas del día</label>
                <input
                  value={notas}
                  onChange={e => setNotas(e.target.value)}
                  onBlur={() => notas !== (pedido.notas ?? '') && updateMut.mutate({ id: pedido.id, data: { notas: notas || null } })}
                  disabled={!canEdit}
                  className={inputCls}
                />
              </div>
            </div>
            {canEdit && (
              <div className="flex justify-end">
                <button onClick={handleDeletePedido} className="text-xs text-destructive hover:underline flex items-center gap-1">
                  <Trash2 size={12} /> Eliminar registro del día
                </button>
              </div>
            )}
          </div>

          {/* Tabla de líneas */}
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-muted-foreground text-xs font-medium">
                    <th className="px-2 py-2 text-left">Tipo</th>
                    <th className="px-2 py-2 text-left">Área</th>
                    <th className="px-2 py-2 text-right">Cantidad</th>
                    <th className="px-2 py-2 text-right">Valor unitario</th>
                    <th className="px-2 py-2 text-right">Subtotal</th>
                    <th className="px-2 py-2 text-left">Detalle</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {pedido.lineas.map(l => (
                    <LineaRow
                      key={l.id} linea={l} canEdit={canEdit}
                      onSave={(id, data) => updateLineaMut.mutate({ id, data }, { onError: err => alert(getApiErrorMessage(err)) })}
                      onDelete={handleDeleteLinea}
                    />
                  ))}
                  {canEdit && (
                    <AddLineaForm
                      isPending={addLineaMut.isPending}
                      onAdd={data => addLineaMut.mutate({ pedidoId: pedido.id, data }, { onError: err => alert(getApiErrorMessage(err)) })}
                    />
                  )}
                </tbody>
                {pedido.lineas.length > 0 && (
                  <tfoot>
                    <tr className="border-t border-border bg-muted/20 font-semibold text-sm">
                      <td colSpan={4} className="px-2 py-2 text-right">Total del día</td>
                      <td className="px-2 py-2 text-right">
                        {pedido.lineas.reduce((s, l) => s + l.cantidad * (l.valor_unitario ?? 0), 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Resumen mensual ────────────────────────────────────────────────────────────

function ResumenMensual({ eventoId }: { eventoId: number }) {
  const { data: resumen = [], isLoading } = useResumenComidas(eventoId);

  if (isLoading) return <p className="text-sm text-muted-foreground py-8 text-center">Cargando...</p>;
  if (resumen.length === 0) return <p className="text-sm text-muted-foreground py-8 text-center">Sin comidas registradas todavía.</p>;

  const areas = [...new Set(resumen.flatMap(r => r.por_area.map(a => a.area)))].sort();

  const cantArea = (area: string, fecha: string) => {
    const r = resumen.find(x => x.fecha === fecha);
    const a = r?.por_area.find(x => x.area === area);
    return a ? a.almuerzo + a.cena : 0;
  };
  const totalArea = (area: string) => resumen.reduce((s, r) => s + cantArea(area, r.fecha), 0);
  const totalFecha = (fecha: string) => resumen.find(r => r.fecha === fecha)?.total_personas ?? 0;
  const granTotal = resumen.reduce((s, r) => s + r.total_personas, 0);

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-border bg-muted/30 text-muted-foreground text-xs font-medium">
              <th className="px-3 py-2 text-left sticky left-0 bg-muted/30">Área</th>
              {resumen.map(r => (
                <th key={r.fecha} className="px-2 py-2 text-right whitespace-nowrap">
                  {new Date(r.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' })}
                </th>
              ))}
              <th className="px-3 py-2 text-right font-semibold">Total</th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {areas.map(area => (
              <tr key={area} className="border-b border-border/60">
                <td className="px-3 py-1.5 font-medium sticky left-0 bg-white">{area}</td>
                {resumen.map(r => (
                  <td key={r.fecha} className="px-2 py-1.5 text-right">{cantArea(area, r.fecha) || '—'}</td>
                ))}
                <td className="px-3 py-1.5 text-right font-semibold">{totalArea(area)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-border bg-muted/20 font-semibold">
              <td className="px-3 py-2 sticky left-0 bg-muted/20">TOTAL</td>
              {resumen.map(r => (
                <td key={r.fecha} className="px-2 py-2 text-right">{totalFecha(r.fecha)}</td>
              ))}
              <td className="px-3 py-2 text-right">{granTotal}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function ComidasPage({ eventoId, canEdit }: { eventoId: number; canEdit: boolean }) {
  const { user } = useAuth();
  const esDos57 = user?.empresaId === EMPRESAS.DOS57;

  const [fecha, setFecha] = useState(todayStr());
  const [vista, setVista] = useState<'DIA' | 'RESUMEN'>('DIA');
  const { exportar, isExporting } = useExportarComidas();

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-xl font-bold">Control de Comidas</h1>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border overflow-hidden text-sm">
            <button
              onClick={() => setVista('DIA')}
              className={cn('px-3 py-1.5 flex items-center gap-1.5', vista === 'DIA' ? 'bg-primary text-primary-foreground' : 'bg-white hover:bg-accent')}
            >
              Día
            </button>
            <button
              onClick={() => setVista('RESUMEN')}
              className={cn('px-3 py-1.5 flex items-center gap-1.5 border-l border-border', vista === 'RESUMEN' ? 'bg-primary text-primary-foreground' : 'bg-white hover:bg-accent')}
            >
              <ClipboardList size={13} /> Resumen mensual
            </button>
          </div>
          <Button variant="outline" size="sm" onClick={() => exportar(eventoId)} disabled={isExporting}>
            {isExporting ? <Loader2 size={13} className="mr-1.5 animate-spin" /> : <FileSpreadsheet size={13} className="mr-1.5" />}
            Exportar Excel
          </Button>
        </div>
      </div>

      {vista === 'DIA' ? (
        <>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setFecha(f => addDays(f, -1))}><ChevronLeft size={16} /></Button>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className="border rounded px-2 py-1.5 text-sm" />
            <Button variant="outline" size="icon" onClick={() => setFecha(f => addDays(f, 1))}><ChevronRight size={16} /></Button>
          </div>
          <DiaComidas eventoId={eventoId} fecha={fecha} canEdit={canEdit} esDos57={esDos57} />
        </>
      ) : (
        <ResumenMensual eventoId={eventoId} />
      )}
    </div>
  );
}
