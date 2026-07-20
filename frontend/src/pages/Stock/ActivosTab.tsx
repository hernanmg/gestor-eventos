import { useState, useEffect } from 'react';
import { Plus, Archive } from 'lucide-react';
import { useActivos, useCreateActivo, useUpdateActivo } from '@/hooks/useActivos';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { Activo, EstadoActivo } from '@/types';

const inputCls = 'w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring';
const labelCls = 'block text-xs font-medium text-muted-foreground mb-0.5';

const ESTADO_CLASS: Record<EstadoActivo, string> = {
  BUENO:       'bg-green-100 text-green-800',
  REGULAR:     'bg-yellow-100 text-yellow-800',
  DETERIORADO: 'bg-orange-100 text-orange-800',
  BAJA:        'bg-red-100 text-red-700',
};

interface ActivoFormData {
  nombre: string; descripcion: string; categoria: string; numero_serie: string;
  fecha_compra: string; valor_compra: string; estado: EstadoActivo; ubicacion: string; observaciones: string;
}
const EMPTY: ActivoFormData = {
  nombre: '', descripcion: '', categoria: '', numero_serie: '',
  fecha_compra: '', valor_compra: '', estado: 'BUENO', ubicacion: '', observaciones: '',
};

function NuevoActivoDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const createActivo = useCreateActivo();
  const [form, setForm]   = useState<ActivoFormData>(EMPTY);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (open) { setForm(EMPTY); setError(null); } }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await createActivo.mutateAsync({
        nombre: form.nombre, descripcion: form.descripcion || null, categoria: form.categoria || null,
        numero_serie: form.numero_serie || null, fecha_compra: form.fecha_compra || null,
        valor_compra: form.valor_compra ? Number(form.valor_compra) : null,
        estado: form.estado, ubicacion: form.ubicacion || null, observaciones: form.observaciones || null,
      } as Partial<Activo>);
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Error al guardar');
    }
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nuevo activo</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 mt-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className={labelCls}>Nombre *</label>
              <input value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} className={inputCls} required />
            </div>
            <div>
              <label className={labelCls}>Categoría</label>
              <input value={form.categoria} onChange={e => setForm(p => ({ ...p, categoria: e.target.value }))} className={inputCls} placeholder="Vehículo, Informático, Mobiliario..." />
            </div>
            <div>
              <label className={labelCls}>Número de serie</label>
              <input value={form.numero_serie} onChange={e => setForm(p => ({ ...p, numero_serie: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Fecha de compra</label>
              <input type="date" value={form.fecha_compra} onChange={e => setForm(p => ({ ...p, fecha_compra: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Valor de compra</label>
              <input type="number" min={0} value={form.valor_compra} onChange={e => setForm(p => ({ ...p, valor_compra: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Estado</label>
              <select value={form.estado} onChange={e => setForm(p => ({ ...p, estado: e.target.value as EstadoActivo }))} className={inputCls}>
                <option value="BUENO">Bueno</option>
                <option value="REGULAR">Regular</option>
                <option value="DETERIORADO">Deteriorado</option>
                <option value="BAJA">Baja</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Ubicación</label>
              <input value={form.ubicacion} onChange={e => setForm(p => ({ ...p, ubicacion: e.target.value }))} className={inputCls} placeholder="Depósito central, Oficina..." />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Descripción</label>
              <input value={form.descripcion} onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))} className={inputCls} />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Observaciones</label>
              <input value={form.observaciones} onChange={e => setForm(p => ({ ...p, observaciones: e.target.value }))} className={inputCls} />
            </div>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={createActivo.isPending}>{createActivo.isPending ? 'Guardando…' : 'Guardar'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EstadoSelect({ activo }: { activo: Activo }) {
  const updateActivo = useUpdateActivo();
  return (
    <select
      value={activo.estado}
      onChange={e => updateActivo.mutate({ id: activo.id, data: { estado: e.target.value as EstadoActivo } })}
      className={cn('text-xs px-2 py-0.5 rounded-full font-medium border-0 cursor-pointer', ESTADO_CLASS[activo.estado])}
    >
      <option value="BUENO">Bueno</option>
      <option value="REGULAR">Regular</option>
      <option value="DETERIORADO">Deteriorado</option>
      <option value="BAJA">Baja</option>
    </select>
  );
}

function ObservacionesCell({ activo }: { activo: Activo }) {
  const updateActivo = useUpdateActivo();
  const [value, setValue]     = useState(activo.observaciones ?? '');
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <button className="text-xs text-muted-foreground hover:text-foreground text-left" onClick={() => setEditing(true)}>
        {activo.observaciones || '— editar —'}
      </button>
    );
  }

  return (
    <input
      autoFocus
      value={value}
      onChange={e => setValue(e.target.value)}
      onBlur={() => { setEditing(false); if (value !== (activo.observaciones ?? '')) updateActivo.mutate({ id: activo.id, data: { observaciones: value || null } }); }}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
      className="w-full border rounded px-1.5 py-1 text-xs"
    />
  );
}

export default function ActivosTab() {
  const [categoriaFiltro, setCategoriaFiltro] = useState('');
  const [estadoFiltro, setEstadoFiltro]       = useState('');
  const [nuevoOpen, setNuevoOpen]             = useState(false);
  const { data: activos = [], isLoading } = useActivos({ categoria: categoriaFiltro || undefined, estado: estadoFiltro || undefined });
  const categorias = Array.from(new Set(activos.map(a => a.categoria).filter((c): c is string => !!c)));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap justify-between">
        <div className="flex items-center gap-2">
          <select value={categoriaFiltro} onChange={e => setCategoriaFiltro(e.target.value)} className="border rounded px-2 py-1.5 text-sm">
            <option value="">Todas las categorías</option>
            {categorias.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={estadoFiltro} onChange={e => setEstadoFiltro(e.target.value)} className="border rounded px-2 py-1.5 text-sm">
            <option value="">Todos los estados</option>
            <option value="BUENO">Bueno</option>
            <option value="REGULAR">Regular</option>
            <option value="DETERIORADO">Deteriorado</option>
            <option value="BAJA">Baja</option>
          </select>
        </div>
        <Button size="sm" onClick={() => setNuevoOpen(true)}><Plus size={14} className="mr-1.5" /> Nuevo activo</Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : activos.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Archive size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No hay activos registrados.</p>
        </div>
      ) : (
        <div className="rounded-lg border bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Nombre</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Categoría</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Estado</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Fecha compra</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Valor</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Ubicación</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Observaciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {activos.map(a => (
                <tr key={a.id} className="hover:bg-muted/20">
                  <td className="px-3 py-2.5 font-medium">{a.nombre}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{a.categoria ?? '-'}</td>
                  <td className="px-3 py-2.5"><EstadoSelect activo={a} /></td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">{a.fecha_compra ? new Date(a.fecha_compra).toLocaleDateString('es-AR') : '-'}</td>
                  <td className="px-3 py-2.5 text-right text-muted-foreground">{a.valor_compra ?? '-'}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{a.ubicacion ?? '-'}</td>
                  <td className="px-3 py-2.5 w-48"><ObservacionesCell activo={a} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <NuevoActivoDialog open={nuevoOpen} onClose={() => setNuevoOpen(false)} />
    </div>
  );
}
