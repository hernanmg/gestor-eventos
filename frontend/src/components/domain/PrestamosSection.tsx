import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  usePrestamosEmpleado, useCreatePrestamo, useDeletePrestamo, type PrestamoPayload,
} from '@/hooks/useSueldosAdmin';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import MoneyInput from '@/components/ui/MoneyInput';
import { formatCurrency } from '@/lib/formatters';
import { getApiErrorMessage } from '@/lib/utils';

const inputCls = 'w-full border border-input rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring';
const labelCls = 'block text-xs font-medium text-muted-foreground mb-0.5';

// ── Dialog: Nuevo préstamo ─────────────────────────────────────────────────────

function NuevoPrestamoDialog({ empleadoId, open, onClose }: { empleadoId: number; open: boolean; onClose: () => void }) {
  const createMut = useCreatePrestamo(empleadoId);
  const [form, setForm] = useState({ fecha: '', detalle: '', monto_total: '', cantidad_cuotas: '1', monto_cuota: '' });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) { setForm({ fecha: '', detalle: '', monto_total: '', cantidad_cuotas: '1', monto_cuota: '' }); setError(null); }
  }, [open]);

  const set = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }));

  const cuotaEstimada = form.monto_total && form.cantidad_cuotas
    ? Math.round((Number(form.monto_total) / Number(form.cantidad_cuotas)) * 100) / 100
    : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.fecha || !form.detalle || !form.monto_total) { setError('Completá fecha, detalle y monto total'); return; }
    const payload: PrestamoPayload = {
      fecha:           form.fecha,
      detalle:         form.detalle,
      monto_total:     Number(form.monto_total),
      cantidad_cuotas: Number(form.cantidad_cuotas) || 1,
      ...(form.monto_cuota && { monto_cuota: Number(form.monto_cuota) }),
    };
    try {
      await createMut.mutateAsync(payload);
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err) ?? 'Error al registrar el préstamo');
    }
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nuevo préstamo</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 mt-1">
          <div>
            <label className={labelCls}>Detalle *</label>
            <input value={form.detalle} onChange={e => set('detalle', e.target.value)} placeholder="RECARGA MATAFUEGO, Adelanto..." className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Fecha *</label>
              <input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Monto total ($) *</label>
              <MoneyInput value={form.monto_total} onChange={v => set('monto_total', v)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Cantidad de cuotas</label>
              <input type="number" min="1" value={form.cantidad_cuotas} onChange={e => set('cantidad_cuotas', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Monto por cuota ($)</label>
              <MoneyInput
                value={form.monto_cuota} onChange={v => set('monto_cuota', v)}
                placeholder={cuotaEstimada !== null ? cuotaEstimada.toFixed(2).replace('.', ',') : '0,00'}
              />
              {cuotaEstimada !== null && !form.monto_cuota && (
                <p className="text-[11px] text-muted-foreground mt-0.5">Auto: {formatCurrency(cuotaEstimada)}</p>
              )}
            </div>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={createMut.isPending}>{createMut.isPending ? 'Guardando…' : 'Registrar préstamo'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Sección "Préstamos activos" — reusada en el drawer de Empleados y en el
// drawer de detalle de Acuerdo (Sueldos Admin). ────────────────────────────────

export default function PrestamosSection({ empleadoId }: { empleadoId: number }) {
  const { data: prestamos = [], isLoading } = usePrestamosEmpleado(empleadoId);
  const deleteMut = useDeletePrestamo(empleadoId);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleDelete = (id: number) => {
    if (!window.confirm('¿Eliminar este préstamo?')) return;
    deleteMut.mutate(id, { onError: (err) => alert(getApiErrorMessage(err) ?? 'No se puede eliminar') });
  };

  return (
    <div className="pt-2 border-t border-border space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Préstamos activos</p>
        <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}><Plus size={12} className="mr-1" /> Nuevo préstamo</Button>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Cargando...</p>
      ) : prestamos.length === 0 ? (
        <p className="text-xs text-muted-foreground">Sin préstamos registrados.</p>
      ) : (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-xs">
            <thead className="text-muted-foreground">
              <tr>
                <th className="text-left px-1.5 py-1 font-medium">Detalle</th>
                <th className="text-right px-1.5 py-1 font-medium">Total</th>
                <th className="text-right px-1.5 py-1 font-medium">Cuotas</th>
                <th className="text-right px-1.5 py-1 font-medium">Pagadas</th>
                <th className="text-right px-1.5 py-1 font-medium">Pendiente</th>
                <th className="text-right px-1.5 py-1 font-medium">Saldo</th>
                <th className="px-1.5 py-1" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {prestamos.map(p => (
                <tr key={p.id}>
                  <td className="px-1.5 py-1">
                    {p.detalle}
                    {p.saldado && <Badge variant="success" className="ml-1.5">Saldado</Badge>}
                  </td>
                  <td className="px-1.5 py-1 text-right">{formatCurrency(p.monto_total)}</td>
                  <td className="px-1.5 py-1 text-right">{p.cantidad_cuotas}</td>
                  <td className="px-1.5 py-1 text-right">{p.cuotas_pagadas}</td>
                  <td className="px-1.5 py-1 text-right">{p.cuotas_pendientes}</td>
                  <td className="px-1.5 py-1 text-right font-medium">{formatCurrency(p.saldo_pendiente)}</td>
                  <td className="px-1.5 py-1 text-right">
                    {p.cuotas_pagadas === 0 && (
                      <button onClick={() => handleDelete(p.id)} className="text-muted-foreground hover:text-destructive">
                        <Trash2 size={12} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <NuevoPrestamoDialog empleadoId={empleadoId} open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </div>
  );
}
