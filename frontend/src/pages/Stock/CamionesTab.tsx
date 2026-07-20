import { useState, useEffect } from 'react';
import { Plus, Truck, Pencil, Trash2 } from 'lucide-react';
import { useCamiones, useCreateCamion, useUpdateCamion, useDeleteCamion } from '@/hooks/useCamiones';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn, getApiErrorMessage } from '@/lib/utils';
import type { Camion } from '@/types';

interface CamionFormData {
  codigo:      string;
  descripcion: string;
  patente:     string;
  tipo:        string;
}

const EMPTY: CamionFormData = { codigo: '', descripcion: '', patente: '', tipo: '' };

function CamionDialog({ open, camion, onClose }: { open: boolean; camion: Camion | null; onClose: () => void }) {
  const isEdit       = !!camion;
  const createCamion = useCreateCamion();
  const updateCamion = useUpdateCamion();
  const [form, setForm]   = useState<CamionFormData>(EMPTY);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm(camion
      ? { codigo: camion.codigo, descripcion: camion.descripcion ?? '', patente: camion.patente ?? '', tipo: camion.tipo ?? '' }
      : EMPTY);
    setError(null);
  }, [camion, open]);

  const inputCls = 'w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring';
  const labelCls = 'block text-xs font-medium text-muted-foreground mb-0.5';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const payload = {
      codigo:      form.codigo,
      descripcion: form.descripcion || null,
      patente:     form.patente     || null,
      tipo:        form.tipo        || null,
    };
    try {
      if (isEdit) await updateCamion.mutateAsync({ id: camion!.id, data: payload });
      else        await createCamion.mutateAsync(payload);
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Error al guardar');
    }
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar camión' : 'Nuevo camión / vehículo'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 mt-1">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Código *</label>
              <input value={form.codigo} onChange={e => setForm(p => ({ ...p, codigo: e.target.value }))} className={inputCls} required placeholder="C1" />
            </div>
            <div>
              <label className={labelCls}>Tipo</label>
              <input value={form.tipo} onChange={e => setForm(p => ({ ...p, tipo: e.target.value }))} className={inputCls} placeholder="camión, camioneta, van" />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Descripción</label>
              <input value={form.descripcion} onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))} className={inputCls} placeholder="Mercedes Sprinter blanca" />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Patente</label>
              <input value={form.patente} onChange={e => setForm(p => ({ ...p, patente: e.target.value }))} className={inputCls} />
            </div>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={createCamion.isPending || updateCamion.isPending}>
              {createCamion.isPending || updateCamion.isPending ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function CamionesTab() {
  const { data: camiones = [], isLoading } = useCamiones();
  const updateCamion = useUpdateCamion();
  const deleteCamion = useDeleteCamion();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing,    setEditing]    = useState<Camion | null>(null);

  const handleDelete = (c: Camion) => {
    if (!window.confirm(`¿Eliminar el camión "${c.codigo}"?`)) return;
    deleteCamion.mutate(c.id, { onError: err => alert(getApiErrorMessage(err)) });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <Plus size={14} className="mr-1.5" /> Nuevo camión / vehículo
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : camiones.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Truck size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No hay camiones registrados.</p>
        </div>
      ) : (
        <div className="rounded-lg border bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Código</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Descripción</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Patente</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Tipo</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Activo</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {camiones.map(c => (
                <tr key={c.id} className="hover:bg-muted/20">
                  <td className="px-3 py-2.5 font-mono font-medium">{c.codigo}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{c.descripcion ?? '-'}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{c.patente ?? '-'}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{c.tipo ?? '-'}</td>
                  <td className="px-3 py-2.5">
                    <button
                      onClick={() => updateCamion.mutate({ id: c.id, data: { activo: !c.activo } })}
                      className={cn('text-xs px-2 py-0.5 rounded-full font-medium', c.activo ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600')}
                    >
                      {c.activo ? 'Activo' : 'Inactivo'}
                    </button>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => { setEditing(c); setDialogOpen(true); }} title="Editar"><Pencil size={14} /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(c)} className="text-destructive hover:text-destructive" title="Eliminar"><Trash2 size={14} /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CamionDialog open={dialogOpen} camion={editing} onClose={() => { setDialogOpen(false); setEditing(null); }} />
    </div>
  );
}
