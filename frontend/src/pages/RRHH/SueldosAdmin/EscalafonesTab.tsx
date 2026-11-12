import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import {
  useEscalafones, useCreateEscalafon, useUpdateEscalafon, useDeleteEscalafon,
  type EscalafonPayload,
} from '@/hooks/useEscalafones';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import MoneyInput from '@/components/ui/MoneyInput';
import { formatCurrency } from '@/lib/formatters';
import { getApiErrorMessage } from '@/lib/utils';
import type { EscalafonAdmin } from '@/types';
import BaseTable from '@/components/ui/BaseTable';

const inputCls = 'w-full border border-input rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring';
const labelCls = 'block text-xs font-medium text-muted-foreground mb-0.5';

const EMPTY_FORM = {
  nombre: '', viatico: '', premio_presentismo: '', telefono: '', premio_incentivo: '',
  premio_viaje_provincial: '', premio_viaje_nacional: '', premio_viaje_nacional_1000: '',
};

function EscalafonDialog({ escalafon, onClose }: { escalafon: EscalafonAdmin | 'new' | null; onClose: () => void }) {
  const isEdit = escalafon !== null && escalafon !== 'new';
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const createMut = useCreateEscalafon();
  const updateMut = useUpdateEscalafon();

  // Reinicializa el form cada vez que cambia el escalafón a editar/crear.
  useEffect(() => {
    if (isEdit) {
      setForm({
        nombre:             escalafon.nombre,
        viatico:            escalafon.viatico            !== null ? String(escalafon.viatico)            : '',
        premio_presentismo: escalafon.premio_presentismo !== null ? String(escalafon.premio_presentismo) : '',
        telefono:           escalafon.telefono           !== null ? String(escalafon.telefono)           : '',
        premio_incentivo:   escalafon.premio_incentivo   !== null ? String(escalafon.premio_incentivo)   : '',
        premio_viaje_provincial:    escalafon.premio_viaje_provincial    !== null ? String(escalafon.premio_viaje_provincial)    : '',
        premio_viaje_nacional:      escalafon.premio_viaje_nacional      !== null ? String(escalafon.premio_viaje_nacional)      : '',
        premio_viaje_nacional_1000: escalafon.premio_viaje_nacional_1000 !== null ? String(escalafon.premio_viaje_nacional_1000) : '',
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [escalafon]);

  if (escalafon === null) return null;

  const set = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const payload: EscalafonPayload = {
      nombre:             form.nombre,
      viatico:            form.viatico            ? Number(form.viatico)            : null,
      premio_presentismo: form.premio_presentismo ? Number(form.premio_presentismo) : null,
      telefono:           form.telefono           ? Number(form.telefono)           : null,
      premio_incentivo:   form.premio_incentivo   ? Number(form.premio_incentivo)   : null,
      premio_viaje_provincial:    form.premio_viaje_provincial    ? Number(form.premio_viaje_provincial)    : null,
      premio_viaje_nacional:      form.premio_viaje_nacional      ? Number(form.premio_viaje_nacional)      : null,
      premio_viaje_nacional_1000: form.premio_viaje_nacional_1000 ? Number(form.premio_viaje_nacional_1000) : null,
    };
    try {
      if (isEdit) await updateMut.mutateAsync({ id: escalafon.id, data: payload });
      else        await createMut.mutateAsync(payload);
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err) ?? 'Error al guardar');
    }
  };

  const isPending = createMut.isPending || updateMut.isPending;

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{isEdit ? 'Editar escalafón' : 'Nuevo escalafón'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 mt-1">
          <div>
            <label className={labelCls}>Nombre *</label>
            <input value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder="ADM 1" className={inputCls} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Viático ($)</label>
              <MoneyInput value={form.viatico} onChange={v => set('viatico', v)} />
            </div>
            <div>
              <label className={labelCls}>Premio presentismo ($)</label>
              <MoneyInput value={form.premio_presentismo} onChange={v => set('premio_presentismo', v)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Teléfono ($)</label>
              <MoneyInput value={form.telefono} onChange={v => set('telefono', v)} />
            </div>
            <div>
              <label className={labelCls}>Premio incentivo ($)</label>
              <MoneyInput value={form.premio_incentivo} onChange={v => set('premio_incentivo', v)} />
            </div>
          </div>
          <div className="border-t border-border pt-3">
            <p className="text-xs font-medium mb-1.5">Premios por Viajes (choferes)</p>
            <p className="text-[11px] text-muted-foreground mb-2">
              $ por vuelta — se pre-cargan en el acuerdo cuando se elige este escalafón para un empleado categoría Chofer.
            </p>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className={labelCls}>Provincial</label>
                <MoneyInput value={form.premio_viaje_provincial} onChange={v => set('premio_viaje_provincial', v)} />
              </div>
              <div>
                <label className={labelCls}>Nacional</label>
                <MoneyInput value={form.premio_viaje_nacional} onChange={v => set('premio_viaje_nacional', v)} />
              </div>
              <div>
                <label className={labelCls}>Nacional +1000km</label>
                <MoneyInput value={form.premio_viaje_nacional_1000} onChange={v => set('premio_viaje_nacional_1000', v)} />
              </div>
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

export default function EscalafonesTab() {
  const { data: escalafones = [], isLoading } = useEscalafones();
  const deleteMut = useDeleteEscalafon();
  const [editando, setEditando] = useState<EscalafonAdmin | 'new' | null>(null);

  const handleDelete = (esc: EscalafonAdmin) => {
    if (!window.confirm(`¿Eliminar el escalafón "${esc.nombre}"?`)) return;
    deleteMut.mutate(esc.id, { onError: (err) => alert(getApiErrorMessage(err) ?? 'Error al eliminar') });
  };

  return (
    <div>
      <div className="flex items-center justify-end mb-4">
        <Button size="sm" onClick={() => setEditando('new')}><Plus size={14} className="mr-1.5" /> Nuevo escalafón</Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : (
        <div className="overflow-x-auto">
          <BaseTable className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-border">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Nombre</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Viático</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Presentismo</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Teléfono</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Incentivo</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {escalafones.length === 0 ? (
                <tr><td colSpan={6} className="px-3 py-6 text-center text-sm text-muted-foreground">No hay escalafones configurados.</td></tr>
              ) : escalafones.map(esc => (
                <tr key={esc.id} className="hover:bg-muted/20">
                  <td className="px-3 py-2.5 font-medium">{esc.nombre}</td>
                  <td className="px-3 py-2.5 text-right">{esc.viatico            !== null ? formatCurrency(esc.viatico)            : '-'}</td>
                  <td className="px-3 py-2.5 text-right">{esc.premio_presentismo !== null ? formatCurrency(esc.premio_presentismo) : '-'}</td>
                  <td className="px-3 py-2.5 text-right">{esc.telefono           !== null ? formatCurrency(esc.telefono)           : '-'}</td>
                  <td className="px-3 py-2.5 text-right">{esc.premio_incentivo   !== null ? formatCurrency(esc.premio_incentivo)   : '-'}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" title="Editar" onClick={() => setEditando(esc)}><Pencil size={14} /></Button>
                      <Button variant="ghost" size="icon" title="Eliminar" onClick={() => handleDelete(esc)} className="text-destructive hover:text-destructive"><Trash2 size={14} /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </BaseTable>
        </div>
      )}

      <p className="text-xs text-muted-foreground mt-3">
        Los valores se pre-cargan al crear un acuerdo y pueden editarse por empleado.
      </p>

      <EscalafonDialog escalafon={editando} onClose={() => setEditando(null)} />
    </div>
  );
}
