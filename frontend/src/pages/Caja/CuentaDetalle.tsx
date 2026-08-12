import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Check, X as XIcon, Pencil, Trash2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import {
  useCuentaDetalle, useMovimientosCuenta,
  useCreateMovimientoCuenta, useUpdateMovimientoCuenta, useDeleteMovimientoCuenta,
} from '@/hooks/useCaja';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { cn, getApiErrorMessage } from '@/lib/utils';
import type { MovimientoCaja } from '@/types';

const inputCls = 'w-full border border-input rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring';
const labelCls = 'block text-xs font-medium text-muted-foreground mb-0.5';

// ── Editar movimiento (dialog) ────────────────────────────────────────────────

function EditarMovimientoDialog({
  cuentaId, movimiento, onClose,
}: {
  cuentaId:    number;
  movimiento:  MovimientoCaja | null;
  onClose:     () => void;
}) {
  const updateMov = useUpdateMovimientoCuenta(cuentaId);
  const [form, setForm] = useState({ fecha: '', descripcion: '', debe: '', haber: '' });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!movimiento) return;
    setForm({
      fecha:       movimiento.fecha ? movimiento.fecha.slice(0, 10) : '',
      descripcion: movimiento.descripcion ?? '',
      debe:        String(Number(movimiento.debe)),
      haber:       String(Number(movimiento.haber)),
    });
    setError(null);
  }, [movimiento]);

  if (!movimiento) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await updateMov.mutateAsync({
        id:   movimiento.id,
        data: {
          fecha:       form.fecha || null,
          descripcion: form.descripcion || null,
          debe:        parseFloat(form.debe) || 0,
          haber:       parseFloat(form.haber) || 0,
        },
      });
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err) ?? 'Error al guardar');
    }
  };

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Editar movimiento</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 mt-1">
          {movimiento.evento && (
            <p className="text-xs text-muted-foreground -mt-1">
              Cargado en el contexto del evento <strong>{movimiento.evento.nombre}</strong>.
            </p>
          )}
          <div>
            <label className={labelCls}>Fecha</label>
            <input type="date" value={form.fecha} onChange={e => setForm(p => ({ ...p, fecha: e.target.value }))} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Descripción</label>
            <input value={form.descripcion} onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))} className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Debe</label>
              <input type="number" min="0" step="0.01" value={form.debe} onChange={e => setForm(p => ({ ...p, debe: e.target.value }))} className={cn(inputCls, 'text-right')} />
            </div>
            <div>
              <label className={labelCls}>Haber</label>
              <input type="number" min="0" step="0.01" value={form.haber} onChange={e => setForm(p => ({ ...p, haber: e.target.value }))} className={cn(inputCls, 'text-right')} />
            </div>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={updateMov.isPending}>{updateMov.isPending ? 'Guardando…' : 'Guardar'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Página ────────────────────────────────────────────────────────────────────

interface ResumenEventoRow {
  key:      string;
  nombre:   string;
  debe:     number;
  haber:    number;
  saldo:    number;
  cantidad: number;
}

export default function CuentaDetallePage() {
  const { cuentaId: cuentaIdParam } = useParams<{ cuentaId: string }>();
  const cuentaId = Number(cuentaIdParam);
  const navigate = useNavigate();
  const { user } = useAuth();
  const canEdit = user?.rol === 'ADMIN' || user?.rol === 'OPERADOR';

  const { data: cuenta, isLoading: loadingCuenta } = useCuentaDetalle(cuentaId);
  const { data: movimientos = [], isLoading: loadingMovs } = useMovimientosCuenta(cuentaId);
  const createMov = useCreateMovimientoCuenta(cuentaId);
  const deleteMov = useDeleteMovimientoCuenta(cuentaId);

  const [filtroEvento, setFiltroEvento] = useState('todos'); // 'todos' | 'sin-evento' | '<id>'
  const [filtroDesde,  setFiltroDesde]  = useState('');
  const [filtroHasta,  setFiltroHasta]  = useState('');

  const [newRow,      setNewRow]      = useState(false);
  const [newRowData,  setNewRowData]  = useState({ fecha: '', descripcion: '', debe: '', haber: '' });
  const [newRowError, setNewRowError] = useState<string | null>(null);
  const [editing,     setEditing]     = useState<MovimientoCaja | null>(null);

  const eventosEnMovimientos = useMemo(() => {
    const map = new Map<number, string>();
    for (const m of movimientos) if (m.evento) map.set(m.evento.id, m.evento.nombre);
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [movimientos]);

  // "Saldo" = debe - haber (misma convención que saldo_corriente en el backend:
  // Debe suma al saldo de la cuenta, Haber resta).
  const resumenPorEvento = useMemo(() => {
    const map = new Map<string, ResumenEventoRow>();
    for (const m of movimientos) {
      const key    = m.evento ? String(m.evento.id) : 'sin-evento';
      const nombre = m.evento ? m.evento.nombre : 'Sin evento';
      const row = map.get(key) ?? { key, nombre, debe: 0, haber: 0, saldo: 0, cantidad: 0 };
      row.debe     += Number(m.debe);
      row.haber    += Number(m.haber);
      row.saldo     = parseFloat((row.debe - row.haber).toFixed(2));
      row.cantidad += 1;
      map.set(key, row);
    }
    return [...map.values()].sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [movimientos]);

  const totalGeneral = useMemo(() => ({
    debe:  resumenPorEvento.reduce((a, r) => a + r.debe, 0),
    haber: resumenPorEvento.reduce((a, r) => a + r.haber, 0),
    saldo: parseFloat(resumenPorEvento.reduce((a, r) => a + r.saldo, 0).toFixed(2)),
  }), [resumenPorEvento]);

  const movimientosFiltrados = useMemo(() => {
    return movimientos
      .filter(m => {
        if (filtroEvento === 'todos') return true;
        if (filtroEvento === 'sin-evento') return !m.evento;
        return m.evento?.id === Number(filtroEvento);
      })
      .filter(m => {
        const f = m.fecha ? m.fecha.slice(0, 10) : '';
        if (filtroDesde && (!f || f < filtroDesde)) return false;
        if (filtroHasta && (!f || f > filtroHasta)) return false;
        return true;
      })
      .slice()
      .sort((a, b) => (b.fecha ?? '').localeCompare(a.fecha ?? ''));
  }, [movimientos, filtroEvento, filtroDesde, filtroHasta]);

  const openNewRow = () => { setNewRow(true); setNewRowData({ fecha: '', descripcion: '', debe: '', haber: '' }); setNewRowError(null); };
  const cancelNewRow = () => { setNewRow(false); setNewRowError(null); };

  const handleNewRowSave = async () => {
    setNewRowError(null);
    const debe  = parseFloat(newRowData.debe)  || 0;
    const haber = parseFloat(newRowData.haber) || 0;
    if (debe === 0 && haber === 0) { setNewRowError('Cargá un importe en Debe o en Haber'); return; }
    try {
      await createMov.mutateAsync({
        fecha:       newRowData.fecha || null,
        descripcion: newRowData.descripcion || null,
        debe,
        haber,
      });
      setNewRow(false);
    } catch (err) {
      setNewRowError(getApiErrorMessage(err) ?? 'Error al guardar');
    }
  };

  const handleDelete = (m: MovimientoCaja) => {
    if (!window.confirm('¿Eliminar este movimiento?')) return;
    deleteMov.mutate(m.id, { onError: err => alert(getApiErrorMessage(err)) });
  };

  if (loadingCuenta) {
    return <p className="p-6 text-sm text-muted-foreground">Cargando...</p>;
  }
  if (!cuenta) {
    return (
      <div className="p-6">
        <p className="text-sm text-destructive">Cuenta no encontrada.</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate('/caja')}>Volver</Button>
      </div>
    );
  }

  const th = 'px-3 py-2 text-left text-xs font-medium text-muted-foreground';
  const thR = 'px-3 py-2 text-right text-xs font-medium text-muted-foreground';
  const td = 'px-3 py-2.5 text-sm';
  const tdR = 'px-3 py-2.5 text-sm text-right tabular-nums';

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button onClick={() => navigate('/caja')} className="mt-1 text-muted-foreground hover:text-foreground transition-colors" title="Volver a Caja Global">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{cuenta.nombre}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span>{cuenta.tipo}</span>
            <span>{cuenta.moneda}</span>
            {cuenta.evento && <span>Cuenta propia de <strong className="text-foreground">{cuenta.evento.nombre}</strong></span>}
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Saldo total</p>
          <p className="text-2xl font-bold tabular-nums">{formatCurrency(cuenta.saldo_actual ?? cuenta.saldo_inicial, cuenta.moneda)}</p>
        </div>
      </div>

      {/* Resumen por evento */}
      <div className="rounded-lg border bg-white overflow-hidden">
        <div className="px-3 py-2 bg-gray-50 border-b text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Resumen por evento
        </div>
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/30">
            <tr>
              <th className={th}>Evento</th>
              <th className={thR}>Debe</th>
              <th className={thR}>Haber</th>
              <th className={thR}>Saldo</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {resumenPorEvento.length === 0 ? (
              <tr><td colSpan={4} className="px-3 py-6 text-center text-sm text-muted-foreground">Sin movimientos todavía.</td></tr>
            ) : resumenPorEvento.map(r => (
              <tr key={r.key}>
                <td className={td}>{r.nombre} <span className="text-muted-foreground">({r.cantidad})</span></td>
                <td className={tdR}>{formatCurrency(r.debe, cuenta.moneda)}</td>
                <td className={tdR}>{formatCurrency(r.haber, cuenta.moneda)}</td>
                <td className={cn(tdR, 'font-medium')}>{formatCurrency(r.saldo, cuenta.moneda)}</td>
              </tr>
            ))}
          </tbody>
          {resumenPorEvento.length > 0 && (
            <tfoot className="border-t bg-muted/20">
              <tr>
                <td className={cn(td, 'font-semibold')}>Total general</td>
                <td className={cn(tdR, 'font-semibold')}>{formatCurrency(totalGeneral.debe, cuenta.moneda)}</td>
                <td className={cn(tdR, 'font-semibold')}>{formatCurrency(totalGeneral.haber, cuenta.moneda)}</td>
                <td className={cn(tdR, 'font-semibold')}>{formatCurrency(totalGeneral.saldo, cuenta.moneda)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <select value={filtroEvento} onChange={e => setFiltroEvento(e.target.value)} className={cn(inputCls, 'w-auto')}>
          <option value="todos">Todos los eventos</option>
          <option value="sin-evento">Sin evento</option>
          {eventosEnMovimientos.map(([id, nombre]) => <option key={id} value={id}>{nombre}</option>)}
        </select>
        <input type="date" value={filtroDesde} onChange={e => setFiltroDesde(e.target.value)} className={cn(inputCls, 'w-auto')} />
        <span className="text-xs text-muted-foreground">a</span>
        <input type="date" value={filtroHasta} onChange={e => setFiltroHasta(e.target.value)} className={cn(inputCls, 'w-auto')} />
      </div>

      {/* Movimientos */}
      {loadingMovs ? (
        <p className="text-sm text-muted-foreground">Cargando movimientos...</p>
      ) : (
        <div className="rounded-lg border bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30">
              <tr>
                <th className={th}>Fecha</th>
                <th className={th}>Descripción</th>
                <th className={th}>Evento</th>
                <th className={thR}>Debe</th>
                <th className={thR}>Haber</th>
                <th className={thR}>Saldo</th>
                {canEdit && <th className="px-3 py-2 w-16" />}
              </tr>
            </thead>
            <tbody className="divide-y">
              {movimientosFiltrados.length === 0 && !newRow ? (
                <tr><td colSpan={canEdit ? 7 : 6} className="px-3 py-6 text-center text-sm text-muted-foreground">Sin movimientos para este filtro.</td></tr>
              ) : movimientosFiltrados.map(m => (
                <tr key={m.id} className="group hover:bg-muted/10">
                  <td className={td}>{m.fecha ? formatDate(m.fecha) : '-'}</td>
                  <td className={td}>{m.descripcion ?? '-'}</td>
                  <td className={cn(td, 'text-muted-foreground')}>
                    {m.evento ? m.evento.nombre : <span className="italic">Sin evento</span>}
                  </td>
                  <td className={tdR}>{Number(m.debe)  > 0 ? formatCurrency(m.debe, cuenta.moneda)  : '-'}</td>
                  <td className={tdR}>{Number(m.haber) > 0 ? formatCurrency(m.haber, cuenta.moneda) : '-'}</td>
                  <td className={cn(tdR, 'font-medium')}>{formatCurrency(m.saldo_corriente, cuenta.moneda)}</td>
                  {canEdit && (
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition">
                        <button onClick={() => setEditing(m)} className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition" title="Editar">
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => handleDelete(m)} className="p-1 rounded text-destructive hover:bg-destructive/10 transition" title="Eliminar">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}

              {newRow && (
                <tr className="bg-primary/5">
                  <td className="px-2 py-1">
                    <input type="date" value={newRowData.fecha} onChange={e => setNewRowData(p => ({ ...p, fecha: e.target.value }))} className={inputCls} />
                  </td>
                  <td className="px-2 py-1">
                    <input value={newRowData.descripcion} onChange={e => setNewRowData(p => ({ ...p, descripcion: e.target.value }))} className={inputCls} placeholder="Descripción" />
                  </td>
                  <td className="px-2 py-1 text-xs text-muted-foreground italic">Sin evento</td>
                  <td className="px-2 py-1">
                    <input type="number" min="0" step="0.01" value={newRowData.debe} onChange={e => setNewRowData(p => ({ ...p, debe: e.target.value }))} className={cn(inputCls, 'text-right')} />
                  </td>
                  <td className="px-2 py-1">
                    <input type="number" min="0" step="0.01" value={newRowData.haber} onChange={e => setNewRowData(p => ({ ...p, haber: e.target.value }))} className={cn(inputCls, 'text-right')} />
                  </td>
                  <td />
                  <td className="px-1 py-1">
                    <div className="flex gap-0.5 justify-end">
                      <button onClick={handleNewRowSave} disabled={createMov.isPending} title="Guardar" className="p-1 rounded text-green-600 hover:bg-green-50 transition disabled:opacity-50">
                        <Check size={14} />
                      </button>
                      <button onClick={cancelNewRow} title="Cancelar" className="p-1 rounded text-muted-foreground hover:bg-accent transition">
                        <XIcon size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              )}

              {newRowError && (
                <tr>
                  <td colSpan={canEdit ? 7 : 6} className="px-3 py-1 text-xs text-destructive bg-destructive/5">{newRowError}</td>
                </tr>
              )}
            </tbody>
          </table>

          {canEdit && !newRow && (
            <div className="px-2 py-1.5 border-t bg-gray-50/50">
              <Button variant="ghost" size="sm" onClick={openNewRow} className="h-7 text-xs text-muted-foreground hover:text-foreground">
                <Plus size={13} className="mr-1" />
                Agregar movimiento
              </Button>
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Los movimientos que se agregan acá quedan sin evento asociado — para cargar un movimiento en el contexto de un evento puntual, hacelo desde la tab Caja de ese evento.
      </p>

      {editing && (
        <EditarMovimientoDialog cuentaId={cuentaId} movimiento={editing} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}
