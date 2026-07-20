import { useState, useEffect } from 'react';
import { Plus, Boxes, Trash2, Pencil } from 'lucide-react';
import {
  useCunas, useCuna, useCreateCuna, useUpdateCuna, useDeleteCuna,
  useAddProductoCuna, useRemoveProductoCuna,
} from '@/hooks/useCunas';
import { useProductos } from '@/hooks/useStock';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getApiErrorMessage } from '@/lib/utils';
import type { Cuna } from '@/types';

function CunaFormDialog({ open, cuna, onClose }: { open: boolean; cuna: Cuna | null; onClose: () => void }) {
  const isEdit      = !!cuna;
  const createCuna  = useCreateCuna();
  const updateCuna  = useUpdateCuna();
  const [codigo, setCodigo]           = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [error, setError]             = useState<string | null>(null);

  // Se re-ejecuta al abrir el dialog o cambiar la cuna a editar — el dialog
  // queda montado entre aperturas, así que el useState inicial no alcanza.
  useEffect(() => {
    if (!open) return;
    setCodigo(cuna?.codigo ?? '');
    setDescripcion(cuna?.descripcion ?? '');
    setError(null);
  }, [open, cuna]);

  const inputCls = 'w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring';
  const labelCls = 'block text-xs font-medium text-muted-foreground mb-0.5';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      if (isEdit) await updateCuna.mutateAsync({ id: cuna!.id, data: { codigo, descripcion: descripcion || null } });
      else        await createCuna.mutateAsync({ codigo, descripcion: descripcion || null });
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  const isPending = createCuna.isPending || updateCuna.isPending;

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{isEdit ? 'Editar cuna' : 'Nueva cuna'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 mt-1">
          <div>
            <label className={labelCls}>Código *</label>
            <input value={codigo} onChange={e => setCodigo(e.target.value)} className={inputCls} required placeholder="C-001" />
          </div>
          <div>
            <label className={labelCls}>Descripción</label>
            <input value={descripcion} onChange={e => setDescripcion(e.target.value)} className={inputCls} />
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

function CunaContenidoDialog({ cunaId, onClose }: { cunaId: number | null; onClose: () => void }) {
  const { data: cuna } = useCuna(cunaId);
  const { data: productos = [] } = useProductos();
  const addProducto    = useAddProductoCuna();
  const removeProducto = useRemoveProductoCuna();

  const [productoId, setProductoId] = useState('');
  const [cantidad, setCantidad]     = useState(1);
  const [error, setError]           = useState<string | null>(null);

  useEffect(() => { setProductoId(''); setCantidad(1); setError(null); }, [cunaId]);

  if (!cuna) return null;

  const yaAgregados = new Set((cuna.productos ?? []).map(p => p.producto_id));
  const disponibles  = productos.filter(p => !yaAgregados.has(p.id));

  const handleAdd = async () => {
    if (!productoId) return;
    setError(null);
    try {
      await addProducto.mutateAsync({ cunaId: cuna.id, producto_id: Number(productoId), cantidad });
      setProductoId(''); setCantidad(1);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Error al agregar producto');
    }
  };

  return (
    <Dialog open={!!cunaId} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Cuna {cuna.codigo} — Contenido estandarizado</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 mt-1">
          {cuna.descripcion && <p className="text-sm text-muted-foreground">{cuna.descripcion}</p>}

          <div className="rounded-lg border overflow-hidden">
            {(cuna.productos ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground p-4 text-center">Esta cuna no tiene productos cargados.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/30">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Producto</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Cantidad</th>
                    <th className="px-3 py-2 w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(cuna.productos ?? []).map(cp => (
                    <tr key={cp.id}>
                      <td className="px-3 py-2">{cp.producto?.nombre ?? `Producto #${cp.producto_id}`}</td>
                      <td className="px-3 py-2 text-right">{cp.cantidad} {cp.producto?.unidad ?? ''}</td>
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={() => removeProducto.mutate({ cunaId: cuna.id, productoId: cp.producto_id })}
                          className="text-muted-foreground hover:text-destructive"
                          title="Quitar de la cuna"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="block text-xs font-medium text-muted-foreground mb-0.5">Agregar producto</label>
              <select value={productoId} onChange={e => setProductoId(e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm">
                <option value="">Seleccionar producto…</option>
                {disponibles.map(p => <option key={p.id} value={p.id}>{p.nombre}{p.codigo_interno ? ` (${p.codigo_interno})` : ''}</option>)}
              </select>
            </div>
            <div className="w-24">
              <label className="block text-xs font-medium text-muted-foreground mb-0.5">Cantidad</label>
              <input type="number" min={1} value={cantidad} onChange={e => setCantidad(Number(e.target.value))} className="w-full border rounded px-2 py-1.5 text-sm" />
            </div>
            <Button size="sm" onClick={handleAdd} disabled={!productoId || addProducto.isPending}>Agregar</Button>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex justify-end pt-1">
            <Button variant="outline" size="sm" onClick={onClose}>Cerrar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function CunasTab() {
  const { data: cunas = [], isLoading } = useCunas();
  const deleteCuna = useDeleteCuna();
  const [formOpen, setFormOpen]       = useState(false);
  const [editing, setEditing]         = useState<Cuna | null>(null);
  const [selectedId, setSelectedId]   = useState<number | null>(null);

  const handleDelete = (c: Cuna) => {
    if (!window.confirm(`¿Eliminar la cuna "${c.codigo}"?`)) return;
    deleteCuna.mutate(c.id, { onError: err => alert(getApiErrorMessage(err)) });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true); }}>
          <Plus size={14} className="mr-1.5" /> Nueva cuna
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : cunas.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Boxes size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No hay cunas registradas.</p>
        </div>
      ) : (
        <div className="rounded-lg border bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Código</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Descripción</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Productos distintos</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Total unidades</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {cunas.map((c: Cuna) => (
                <tr key={c.id} className="hover:bg-muted/20 cursor-pointer" onClick={() => setSelectedId(c.id)}>
                  <td className="px-3 py-2.5 font-mono font-medium">{c.codigo}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{c.descripcion ?? '-'}</td>
                  <td className="px-3 py-2.5 text-right">{c.productos_distintos ?? 0}</td>
                  <td className="px-3 py-2.5 text-right">{c.total_unidades ?? 0}</td>
                  <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => { setEditing(c); setFormOpen(true); }} title="Editar"><Pencil size={14} /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(c)} className="text-destructive hover:text-destructive" title="Eliminar"><Trash2 size={14} /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CunaFormDialog open={formOpen} cuna={editing} onClose={() => { setFormOpen(false); setEditing(null); }} />
      <CunaContenidoDialog cunaId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}
