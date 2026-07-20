import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  useEmpleados, useAnticiposEmpleado, useCreateAnticipo, useDeleteAnticipo, type AnticipoPayload,
} from '@/hooks/useRRHH';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getApiErrorMessage } from '@/lib/utils';
import type { TipoAnticipo } from '@/types';

const TIPO_LABEL: Record<TipoAnticipo, string> = { ADELANTO: 'Adelanto', VALE: 'Vale', DESCUENTO: 'Descuento' };

const inputCls = 'w-full border border-input rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring';
const labelCls = 'block text-xs font-medium text-muted-foreground mb-0.5';

function AnticipoDialog({ open, onClose, empleadoIdFijo }: { open: boolean; onClose: () => void; empleadoIdFijo?: number }) {
  const { data: empleados = [] } = useEmpleados();
  const createMut = useCreateAnticipo();
  const [error, setError] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ empleado_id: empleadoIdFijo ?? '', tipo: 'ADELANTO' as TipoAnticipo, monto: '', fecha: today, motivo: '' });

  useEffect(() => {
    if (open) { setForm({ empleado_id: empleadoIdFijo ?? '', tipo: 'ADELANTO', monto: '', fecha: today, motivo: '' }); setError(null); }
  }, [open, empleadoIdFijo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.empleado_id) { setError('Seleccioná un empleado'); return; }
    const payload: AnticipoPayload = {
      empleado_id: Number(form.empleado_id),
      tipo:        form.tipo,
      monto:       Number(form.monto),
      fecha:       form.fecha,
      motivo:      form.motivo || null,
    };
    try {
      await createMut.mutateAsync(payload);
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err) ?? 'Error al guardar');
    }
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nuevo anticipo</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 mt-1">
          {!empleadoIdFijo && (
            <div>
              <label className={labelCls}>Empleado *</label>
              <select value={form.empleado_id} onChange={e => setForm(p => ({ ...p, empleado_id: e.target.value }))} className={inputCls} required>
                <option value="">Seleccionar...</option>
                {empleados.map(emp => <option key={emp.id} value={emp.id}>{emp.apellido}, {emp.nombre}</option>)}
              </select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Tipo</label>
              <select value={form.tipo} onChange={e => setForm(p => ({ ...p, tipo: e.target.value as TipoAnticipo }))} className={inputCls}>
                {Object.entries(TIPO_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div><label className={labelCls}>Monto *</label><input type="number" step="0.01" min="0.01" value={form.monto} onChange={e => setForm(p => ({ ...p, monto: e.target.value }))} className={inputCls} required /></div>
          </div>
          <div><label className={labelCls}>Fecha *</label><input type="date" value={form.fecha} onChange={e => setForm(p => ({ ...p, fecha: e.target.value }))} className={inputCls} required /></div>
          <div><label className={labelCls}>Motivo</label><input value={form.motivo} onChange={e => setForm(p => ({ ...p, motivo: e.target.value }))} className={inputCls} /></div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={createMut.isPending}>{createMut.isPending ? 'Guardando…' : 'Guardar'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function AnticiposTab({ empleadoIdInicial }: { empleadoIdInicial?: number | null }) {
  const { data: empleados = [] } = useEmpleados();
  const [empleadoId, setEmpleadoId] = useState<number | null>(empleadoIdInicial ?? null);
  const [soloPendientes, setSoloPendientes] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => { if (empleadoIdInicial != null) setEmpleadoId(empleadoIdInicial); }, [empleadoIdInicial]);

  const { data: anticipos = [], isLoading } = useAnticiposEmpleado(empleadoId);
  const deleteMut = useDeleteAnticipo();

  const visibles = soloPendientes ? anticipos.filter(a => !a.descontado) : anticipos;

  const handleDelete = (id: number) => {
    if (!window.confirm('¿Eliminar este anticipo?')) return;
    deleteMut.mutate(id, { onError: (err) => alert(getApiErrorMessage(err) ?? 'Error al eliminar') });
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 justify-between mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <select value={empleadoId ?? ''} onChange={e => setEmpleadoId(e.target.value ? Number(e.target.value) : null)} className={inputCls}>
            <option value="">Seleccioná un empleado...</option>
            {empleados.map(emp => <option key={emp.id} value={emp.id}>{emp.apellido}, {emp.nombre}</option>)}
          </select>
          <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <input type="checkbox" checked={soloPendientes} onChange={e => setSoloPendientes(e.target.checked)} />
            Solo pendientes
          </label>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)}><Plus size={14} className="mr-1.5" /> Nuevo anticipo</Button>
      </div>

      {!empleadoId ? (
        <p className="text-sm text-muted-foreground">Seleccioná un empleado para ver sus anticipos.</p>
      ) : isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-border">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Tipo</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Monto</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Fecha</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Motivo</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Estado</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visibles.length === 0 ? (
                <tr><td colSpan={6} className="px-3 py-6 text-center text-sm text-muted-foreground">Sin anticipos.</td></tr>
              ) : visibles.map(a => (
                <tr key={a.id} className="hover:bg-muted/20">
                  <td className="px-3 py-2.5">{TIPO_LABEL[a.tipo]}</td>
                  <td className="px-3 py-2.5 text-right">${a.monto.toLocaleString('es-AR')}</td>
                  <td className="px-3 py-2.5">{a.fecha.slice(0, 10)}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{a.motivo ?? '-'}</td>
                  <td className="px-3 py-2.5">
                    <Badge variant={a.descontado ? 'muted' : 'warning'}>{a.descontado ? 'Descontado' : 'Pendiente'}</Badge>
                  </td>
                  <td className="px-3 py-2.5">
                    {!a.descontado && (
                      <div className="flex justify-end">
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(a.id)} className="text-destructive hover:text-destructive" title="Eliminar">
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AnticipoDialog open={dialogOpen} onClose={() => setDialogOpen(false)} empleadoIdFijo={empleadoId ?? undefined} />
    </div>
  );
}
