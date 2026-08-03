import { useState, useEffect } from 'react';
import { Plus, Wrench, AlertTriangle, Pencil, Trash2 } from 'lucide-react';
import {
  usePanolItems, useCreatePanolItem, useUpdatePanolItem, useDeletePanolItem,
  useMovimientosPanol, useCreateMovimientoPanol, useDevolverMovimientoPanol,
  useAlertasPanol,
} from '@/hooks/usePanol';
import { useEventos } from '@/hooks/useEvento';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn, getApiErrorMessage } from '@/lib/utils';
import { formatDate } from '@/lib/formatters';
import type { PanolItem, MovimientoPanol } from '@/types';

const inputCls = 'w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring';
const labelCls = 'block text-xs font-medium text-muted-foreground mb-0.5';

// ── Nuevo ítem dialog ──────────────────────────────────────────────────────────

interface ItemFormData {
  nombre: string; descripcion: string; tipo: 'HERRAMIENTA' | 'CONSUMIBLE'; stock_total: number; valor: string; notas: string;
}
const EMPTY_ITEM: ItemFormData = { nombre: '', descripcion: '', tipo: 'HERRAMIENTA', stock_total: 0, valor: '', notas: '' };

function itemToForm(item: PanolItem): ItemFormData {
  return {
    nombre:      item.nombre,
    descripcion: item.descripcion ?? '',
    tipo:        item.tipo,
    stock_total: item.stock_total,
    valor:       item.valor ?? '',
    notas:       item.notas ?? '',
  };
}

function PanolItemDialog({ open, item, onClose }: { open: boolean; item: PanolItem | null; onClose: () => void }) {
  const isEdit      = !!item;
  const createItem  = useCreatePanolItem();
  const updateItem  = useUpdatePanolItem();
  const [form, setForm]   = useState<ItemFormData>(EMPTY_ITEM);
  const [error, setError] = useState<string | null>(null);

  // Se re-ejecuta al abrir el dialog o cambiar el ítem a editar — el dialog
  // queda montado entre aperturas, así que el useState inicial no alcanza.
  useEffect(() => {
    if (!open) return;
    setForm(item ? itemToForm(item) : EMPTY_ITEM);
    setError(null);
  }, [open, item]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const payload = {
      nombre: form.nombre, descripcion: form.descripcion || null, tipo: form.tipo,
      stock_total: form.stock_total, valor: form.valor ? Number(form.valor) : null, notas: form.notas || null,
    } as Partial<PanolItem>;
    try {
      if (isEdit) await updateItem.mutateAsync({ id: item!.id, data: payload });
      else        await createItem.mutateAsync(payload);
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  const isPending = createItem.isPending || updateItem.isPending;

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{isEdit ? 'Editar ítem de pañol' : 'Nuevo ítem de pañol'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 mt-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className={labelCls}>Nombre *</label>
              <input value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} className={inputCls} required />
            </div>
            <div>
              <label className={labelCls}>Tipo *</label>
              <select value={form.tipo} onChange={e => setForm(p => ({ ...p, tipo: e.target.value as ItemFormData['tipo'] }))} className={inputCls}>
                <option value="HERRAMIENTA">Herramienta</option>
                <option value="CONSUMIBLE">Consumible</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Stock total *</label>
              <input type="number" min={0} value={form.stock_total} onChange={e => setForm(p => ({ ...p, stock_total: Number(e.target.value) }))} className={inputCls} required />
            </div>
            <div>
              <label className={labelCls}>Valor</label>
              <input type="number" min={0} value={form.valor} onChange={e => setForm(p => ({ ...p, valor: e.target.value }))} className={inputCls} />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Descripción</label>
              <input value={form.descripcion} onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))} className={inputCls} />
            </div>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={isPending}>{isPending ? 'Guardando…' : 'Guardar'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Registrar salida dialog ─────────────────────────────────────────────────────

function RegistrarSalidaDialog({ item, onClose }: { item: PanolItem | null; onClose: () => void }) {
  const createMov = useCreateMovimientoPanol();
  const { data: eventos = [] } = useEventos();
  const [eventoId, setEventoId]         = useState('');
  const [cantidad, setCantidad]         = useState(1);
  const [responsable, setResponsable]   = useState('');
  const [descripcion, setDescripcion]   = useState('');
  const [error, setError]               = useState<string | null>(null);

  useEffect(() => {
    setEventoId(''); setCantidad(1); setResponsable(''); setDescripcion(''); setError(null);
  }, [item]);

  if (!item) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await createMov.mutateAsync({
        panol_item_id: item.id,
        tipo:          eventoId ? 'SALIDA' : 'USO_INTERNO',
        cantidad,
        evento_id:     eventoId ? Number(eventoId) : null,
        responsable_nombre: responsable || null,
        fecha:         new Date().toISOString(),
        descripcion:   descripcion || null,
      });
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Error al registrar salida');
    }
  };

  return (
    <Dialog open={!!item} onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Registrar salida — {item.nombre}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 mt-1">
          <div>
            <label className={labelCls}>Evento destino (opcional — vacío = uso interno)</label>
            <select value={eventoId} onChange={e => setEventoId(e.target.value)} className={inputCls}>
              <option value="">Uso interno (sin evento)</option>
              {eventos.map(ev => <option key={ev.id} value={ev.id}>{ev.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Cantidad * (disponible: {item.stock_disponible})</label>
            <input type="number" min={1} max={item.stock_disponible} value={cantidad} onChange={e => setCantidad(Number(e.target.value))} className={inputCls} required />
          </div>
          <div>
            <label className={labelCls}>Responsable</label>
            <input value={responsable} onChange={e => setResponsable(e.target.value)} className={inputCls} placeholder="Nombre de quien se lo lleva" />
          </div>
          <div>
            <label className={labelCls}>Descripción</label>
            <input value={descripcion} onChange={e => setDescripcion(e.target.value)} className={inputCls} />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={createMov.isPending}>{createMov.isPending ? 'Guardando…' : 'Registrar salida'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Inventario sub-tab ───────────────────────────────────────────────────────

function InventarioSubTab() {
  const { data: items = [], isLoading } = usePanolItems();
  const deleteItem = useDeletePanolItem();
  const [formOpen, setFormOpen]       = useState(false);
  const [editing, setEditing]         = useState<PanolItem | null>(null);
  const [salidaItem, setSalidaItem]   = useState<PanolItem | null>(null);

  const handleDelete = (it: PanolItem) => {
    if (!window.confirm(`¿Eliminar el ítem "${it.nombre}"?`)) return;
    deleteItem.mutate(it.id, { onError: err => alert(getApiErrorMessage(err)) });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true); }}><Plus size={14} className="mr-1.5" /> Nuevo ítem</Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Wrench size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No hay ítems de pañol registrados.</p>
        </div>
      ) : (
        <div className="rounded-lg border bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Nombre</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Tipo</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Stock total</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Disponible</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Valor</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Estado</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map(it => (
                <tr key={it.id} className="hover:bg-muted/20">
                  <td className="px-3 py-2.5 font-medium">{it.nombre}</td>
                  <td className="px-3 py-2.5">
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-secondary">{it.tipo === 'HERRAMIENTA' ? 'Herramienta' : 'Consumible'}</span>
                  </td>
                  <td className="px-3 py-2.5 text-right">{it.stock_total}</td>
                  <td className={cn('px-3 py-2.5 text-right font-semibold', it.stock_disponible === 0 ? 'text-red-600' : 'text-green-700')}>
                    {it.stock_disponible}
                  </td>
                  <td className="px-3 py-2.5 text-right text-muted-foreground">{it.valor ?? '-'}</td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">{it.estado}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="outline" size="sm" disabled={it.stock_disponible === 0} onClick={() => setSalidaItem(it)}>
                        Registrar salida
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => { setEditing(it); setFormOpen(true); }} title="Editar"><Pencil size={14} /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(it)} className="text-destructive hover:text-destructive" title="Eliminar"><Trash2 size={14} /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <PanolItemDialog open={formOpen} item={editing} onClose={() => { setFormOpen(false); setEditing(null); }} />
      <RegistrarSalidaDialog item={salidaItem} onClose={() => setSalidaItem(null)} />
    </div>
  );
}

// ── Devolución dialog ────────────────────────────────────────────────────────

function DevolucionDialog({ movimiento, onClose }: { movimiento: MovimientoPanol | null; onClose: () => void }) {
  const devolver = useDevolverMovimientoPanol();
  const [cantidadDevuelta, setCantidadDevuelta] = useState(0);
  const [motivo, setMotivo]                     = useState('');
  const [error, setError]                       = useState<string | null>(null);

  useEffect(() => {
    if (movimiento) { setCantidadDevuelta(movimiento.cantidad); setMotivo(''); setError(null); }
  }, [movimiento]);

  if (!movimiento) return null;
  const faltante = movimiento.cantidad - cantidadDevuelta;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (faltante > 0 && !motivo) { setError('Se requiere el motivo del faltante'); return; }
    try {
      await devolver.mutateAsync({ id: movimiento.id, cantidad_devuelta: cantidadDevuelta, motivo_faltante: motivo || null });
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Error al registrar devolución');
    }
  };

  return (
    <Dialog open={!!movimiento} onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Registrar devolución — {movimiento.panol_item?.nombre}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 mt-1">
          <div>
            <label className={labelCls}>Cantidad devuelta * (salida: {movimiento.cantidad})</label>
            <input type="number" min={0} max={movimiento.cantidad} value={cantidadDevuelta} onChange={e => setCantidadDevuelta(Number(e.target.value))} className={inputCls} required />
          </div>
          <div>
            <label className={labelCls}>Cantidad faltante (calculada)</label>
            <input value={faltante} disabled className={cn(inputCls, 'bg-muted/30')} />
          </div>
          {faltante > 0 && (
            <div>
              <label className={labelCls}>Motivo del faltante *</label>
              <input value={motivo} onChange={e => setMotivo(e.target.value)} className={inputCls} required />
            </div>
          )}
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={devolver.isPending}>{devolver.isPending ? 'Guardando…' : 'Registrar devolución'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Movimientos sub-tab ──────────────────────────────────────────────────────

function MovimientosSubTab() {
  const [itemFiltro, setItemFiltro]     = useState('');
  const [tipoFiltro, setTipoFiltro]     = useState('');
  const [desde, setDesde]               = useState('');
  const [hasta, setHasta]               = useState('');
  const { data: items = [] } = usePanolItems();
  const { data: movimientos = [], isLoading } = useMovimientosPanol({
    tipo: tipoFiltro || undefined, desde: desde || undefined, hasta: hasta || undefined,
  });
  const [devolviendo, setDevolviendo] = useState<MovimientoPanol | null>(null);

  const filtrados = itemFiltro ? movimientos.filter(m => m.panol_item_id === Number(itemFiltro)) : movimientos;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <select value={itemFiltro} onChange={e => setItemFiltro(e.target.value)} className="border rounded px-2 py-1.5 text-sm">
          <option value="">Todos los ítems</option>
          {items.map(it => <option key={it.id} value={it.id}>{it.nombre}</option>)}
        </select>
        <select value={tipoFiltro} onChange={e => setTipoFiltro(e.target.value)} className="border rounded px-2 py-1.5 text-sm">
          <option value="">Todos los tipos</option>
          <option value="SALIDA">Salida</option>
          <option value="USO_INTERNO">Uso interno</option>
          <option value="DEVOLUCION">Devolución</option>
        </select>
        <input type="date" value={desde} onChange={e => setDesde(e.target.value)} className="border rounded px-2 py-1.5 text-sm" />
        <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className="border rounded px-2 py-1.5 text-sm" />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : filtrados.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay movimientos.</p>
      ) : (
        <div className="rounded-lg border bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Ítem</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Tipo</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Cantidad</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Evento</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Responsable</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Fecha</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Devolución</th>
                <th className="px-3 py-2 w-32" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtrados.map(m => {
                const tieneFaltante = (m.cantidad_faltante ?? 0) > 0;
                const pendiente = (m.tipo === 'SALIDA' || m.tipo === 'USO_INTERNO') && !m.devolucion_at;
                return (
                  <tr key={m.id} className={cn('hover:bg-muted/20', tieneFaltante && 'bg-yellow-50')}>
                    <td className="px-3 py-2.5 font-medium">{m.panol_item?.nombre ?? `#${m.panol_item_id}`}</td>
                    <td className="px-3 py-2.5 text-xs">{m.tipo}</td>
                    <td className="px-3 py-2.5 text-right">{m.cantidad}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{m.evento?.nombre ?? '-'}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{m.responsable_nombre ?? '-'}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{formatDate(m.fecha)}</td>
                    <td className="px-3 py-2.5 text-xs">
                      {m.devolucion_at
                        ? <span>{m.cantidad_devuelta}/{m.cantidad}{tieneFaltante ? ` (faltan ${m.cantidad_faltante})` : ''}</span>
                        : <span className="text-muted-foreground">-</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {pendiente && (
                        <Button variant="outline" size="sm" onClick={() => setDevolviendo(m)}>Registrar devolución</Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <DevolucionDialog movimiento={devolviendo} onClose={() => setDevolviendo(null)} />
    </div>
  );
}

// ── Alertas sub-tab ──────────────────────────────────────────────────────────

function AlertasSubTab() {
  const { data, isLoading } = useAlertasPanol();
  const alertas = data?.alertas ?? [];

  if (isLoading) return <p className="text-sm text-muted-foreground">Cargando alertas...</p>;
  if (alertas.length === 0) return (
    <div className="text-center py-12 text-muted-foreground">
      <AlertTriangle size={40} className="mx-auto mb-3 opacity-30" />
      <p className="text-sm">No hay ítems pendientes de devolución.</p>
    </div>
  );

  return (
    <div className="rounded-lg border bg-white overflow-hidden">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/30">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Ítem</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Evento</th>
            <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Días finalizado</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Responsable</th>
            <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Cantidad pendiente</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {alertas.map(a => (
            <tr key={a.movimiento_id} className="bg-red-50/50">
              <td className="px-3 py-2.5 font-medium">{a.panol_item_nombre}</td>
              <td className="px-3 py-2.5">{a.evento_nombre ?? '-'}</td>
              <td className="px-3 py-2.5 text-right text-red-700 font-semibold">{a.dias_finalizado ?? '-'}</td>
              <td className="px-3 py-2.5 text-muted-foreground">{a.responsable_nombre ?? '-'}</td>
              <td className="px-3 py-2.5 text-right">{a.cantidad_pendiente}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

type PanolSubTab = 'inventario' | 'movimientos' | 'alertas';

export default function PanolTab() {
  const [subTab, setSubTab] = useState<PanolSubTab>('inventario');
  const { data: alertasData } = useAlertasPanol();
  const alertasCount = (alertasData?.alertas ?? []).length;

  return (
    <div className="space-y-4">
      <div className="flex gap-1">
        {([
          { key: 'inventario',  label: 'Inventario' },
          { key: 'movimientos', label: 'Movimientos' },
          { key: 'alertas',     label: `Alertas${alertasCount > 0 ? ` (${alertasCount})` : ''}` },
        ] as { key: PanolSubTab; label: string }[]).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setSubTab(key)}
            className={cn(
              'px-3 py-1.5 text-xs font-medium rounded-full transition-colors',
              subTab === key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/70',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {subTab === 'inventario'  && <InventarioSubTab />}
      {subTab === 'movimientos' && <MovimientosSubTab />}
      {subTab === 'alertas'     && <AlertasSubTab />}
    </div>
  );
}
