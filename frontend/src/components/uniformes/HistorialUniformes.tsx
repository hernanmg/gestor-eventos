import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import {
  useHistorialUniformes, useEmpleadosUniformes, useCrearEntregaUniforme, useEditarEntregaUniforme, useEliminarEntregaUniforme,
  PRENDAS_UNIFORME, PRENDA_LABEL, type RefEmpleadoUniformes, type EntregaUniformePayload,
} from '@/hooks/useUniformes';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { formatDate } from '@/lib/formatters';
import { cn, getApiErrorMessage } from '@/lib/utils';
import type { EntregaUniforme, PrendaUniforme } from '@/types';

// Historial de entregas de uniforme de una persona + ABM (Lorena, DOS57).
// Se usa en el drawer de RRHH → Empleados (tab Uniformes) y en el modal de
// /uniformes al hacer click en una fila del resumen.

const inputCls = 'w-full border border-input rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring';
const labelCls = 'block text-xs font-medium text-muted-foreground mb-0.5';

// ── Dialog: nueva entrega / editar entrega ────────────────────────────────────

export function EntregaUniformeDialog({ entrega, persona, onClose }: {
  // Editar: la entrega existente. Crear: undefined.
  entrega?: EntregaUniforme;
  // Crear para una persona fija (desde su historial). Sin esto, el dialog
  // muestra el selector de empleado (botón "Nueva entrega" de /uniformes).
  persona?: { empleadoId: number | null; empleadoNombre: string };
  onClose: () => void;
}) {
  const crearMut  = useCrearEntregaUniforme();
  const editarMut = useEditarEntregaUniforme();
  const eligeEmpleado = !entrega && !persona;
  const { data: empleados = [] } = useEmpleadosUniformes();

  const [empleadoId, setEmpleadoId]   = useState<number | null>(null);
  const [nombreLibre, setNombreLibre] = useState('');
  const [fecha, setFecha] = useState(entrega ? entrega.fecha_entrega.slice(0, 10) : new Date().toISOString().slice(0, 10));
  const [cant, setCant] = useState<Record<PrendaUniforme, string>>(
    () => Object.fromEntries(PRENDAS_UNIFORME.map(p => [p, entrega && entrega[p] ? String(entrega[p]) : ''])) as Record<PrendaUniforme, string>,
  );
  const [otros, setOtros] = useState(entrega?.otros ?? '');
  const [error, setError] = useState<string | null>(null);

  const empleadoOptions: ComboboxOption[] = empleados.map(e => ({
    value: String(e.id), label: `${e.apellido}, ${e.nombre}${e.estado !== 'ACTIVO' ? ' (baja)' : ''}`,
  }));

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setError(null);
    const cantidades = Object.fromEntries(PRENDAS_UNIFORME.map(p => [p, Math.max(0, Math.trunc(Number(cant[p]) || 0))])) as Record<PrendaUniforme, number>;
    if (!PRENDAS_UNIFORME.some(p => cantidades[p] > 0) && !otros.trim()) { setError('Cargá al menos una prenda u "otros"'); return; }
    if (!fecha) { setError('La fecha es obligatoria'); return; }

    const base: EntregaUniformePayload = { fecha_entrega: fecha, ...cantidades, otros: otros.trim() || null };
    try {
      if (entrega) {
        await editarMut.mutateAsync({ id: entrega.id, data: base });
      } else if (persona) {
        await crearMut.mutateAsync({ ...base, empleado_id: persona.empleadoId, empleado_nombre: persona.empleadoId ? null : persona.empleadoNombre });
      } else {
        if (!empleadoId && !nombreLibre.trim()) { setError('Elegí un empleado o escribí el nombre'); return; }
        await crearMut.mutateAsync({ ...base, empleado_id: empleadoId, empleado_nombre: empleadoId ? null : nombreLibre.trim() });
      }
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  const pending = crearMut.isPending || editarMut.isPending;

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {entrega ? 'Editar entrega' : 'Nueva entrega de uniforme'}
            {(persona || entrega) && <span className="block text-sm font-normal text-muted-foreground">{persona?.empleadoNombre ?? entrega?.empleado_nombre}</span>}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 mt-1">
          {eligeEmpleado && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Empleado</label>
                <Combobox options={empleadoOptions} value={empleadoId ? String(empleadoId) : null}
                  onChange={v => setEmpleadoId(v ? Number(v) : null)} placeholder="Buscar empleado…" className="w-full sm:w-full" />
              </div>
              <div>
                <label className={labelCls}>…o nombre (si no está en RRHH)</label>
                <input value={nombreLibre} disabled={!!empleadoId} onChange={e => setNombreLibre(e.target.value)} className={inputCls} />
              </div>
            </div>
          )}
          <div className="w-44">
            <label className={labelCls}>Fecha de entrega *</label>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className={inputCls} />
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {PRENDAS_UNIFORME.map(p => (
              <div key={p}>
                <label className={labelCls}>{PRENDA_LABEL[p]}</label>
                <input type="number" min={0} step={1} value={cant[p]} placeholder="0"
                  onChange={e => setCant(c => ({ ...c, [p]: e.target.value }))} className={cn(inputCls, 'text-right')} />
              </div>
            ))}
          </div>
          <div>
            <label className={labelCls}>Otros (casco, martillo, arnés…)</label>
            <input value={otros} onChange={e => setOtros(e.target.value)} className={inputCls} />
          </div>
          {entrega && entrega.origen_hoja !== 'MANUAL' && (
            <p className="text-[11px] text-amber-700 bg-amber-50 rounded p-2">
              Esta entrega vino de la planilla (hoja "{entrega.origen_hoja}"). Si se vuelve a importar el mismo Excel, la corrección se pisa con lo que diga la planilla.
            </p>
          )}
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={pending}>{pending ? 'Guardando…' : 'Guardar'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Historial (cards por entrega + total acumulado) ───────────────────────────

export default function HistorialUniformes({ refEmpleado, canEdit }: { refEmpleado: RefEmpleadoUniformes; canEdit: boolean }) {
  const { data, isLoading } = useHistorialUniformes(refEmpleado);
  const eliminarMut = useEliminarEntregaUniforme();
  const [editando, setEditando] = useState<EntregaUniforme | null>(null);
  const [nuevaOpen, setNuevaOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isLoading || !data) return <p className="text-sm text-muted-foreground">Cargando...</p>;

  const persona = { empleadoId: data.empleado?.id ?? null, empleadoNombre: data.empleado_nombre };

  const eliminar = async (e: EntregaUniforme) => {
    const cuando = e.anio_resumen ? `resumen ${e.anio_resumen}` : formatDate(e.fecha_entrega);
    if (!window.confirm(`¿Eliminar la entrega del ${cuando}${e.origen_hoja !== 'MANUAL' ? ` (hoja "${e.origen_hoja}")` : ''}?`)) return;
    setError(null);
    try { await eliminarMut.mutateAsync(e.id); }
    catch (err) { setError(getApiErrorMessage(err)); }
  };

  return (
    <div className="space-y-2">
      {canEdit && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setNuevaOpen(true)}><Plus size={14} className="mr-1" /> Agregar entrega</Button>
        </div>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
      {data.entregas.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin entregas de uniforme registradas.</p>
      ) : data.entregas.map(e => {
        const prendas = PRENDAS_UNIFORME.filter(p => e[p] > 0);
        return (
          <div key={e.id} className={cn('rounded-md border border-border p-2.5 text-xs space-y-1', !e.cuenta_en_total && 'bg-muted/30')}>
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-sm">
                {e.anio_resumen ? `Resumen ${e.anio_resumen}` : formatDate(e.fecha_entrega)}
              </span>
              <div className="flex items-center gap-1 min-w-0">
                <span className="text-[10px] text-muted-foreground truncate" title={e.origen_hoja}>
                  {e.origen_hoja === 'MANUAL' ? 'Carga manual' : e.origen_hoja}
                </span>
                {canEdit && (
                  <>
                    <button type="button" title="Editar" onClick={() => setEditando(e)} className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground">
                      <Pencil size={12} />
                    </button>
                    <button type="button" title="Eliminar" onClick={() => eliminar(e)} disabled={eliminarMut.isPending} className="p-1 rounded hover:bg-destructive/10 text-destructive">
                      <Trash2 size={12} />
                    </button>
                  </>
                )}
              </div>
            </div>
            {prendas.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {prendas.map(p => (
                  <span key={p} className="rounded bg-secondary px-1.5 py-0.5">{PRENDA_LABEL[p]} × {e[p]}</span>
                ))}
              </div>
            )}
            {e.otros && <p className="text-muted-foreground">Otros: {e.otros}</p>}
            {!e.cuenta_en_total && (
              <p className="text-[10px] text-muted-foreground italic">
                {e.anio_resumen ? 'Total anual de la planilla — no suma al acumulado' : 'Duplicada en otra hoja con la misma fecha — no suma al acumulado'}
              </p>
            )}
          </div>
        );
      })}
      {data.entregas.length > 0 && (
        <div className="rounded-md border-2 border-primary/30 p-2.5 text-xs">
          <p className="font-semibold text-sm mb-1.5">Total acumulado</p>
          <div className="grid grid-cols-3 gap-x-3 gap-y-0.5">
            {PRENDAS_UNIFORME.map(p => (
              <div key={p} className={cn('flex justify-between', data.totales[p] === 0 && 'text-muted-foreground')}>
                <span>{PRENDA_LABEL[p]}</span><span className="font-medium">{data.totales[p]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {nuevaOpen && <EntregaUniformeDialog persona={persona} onClose={() => setNuevaOpen(false)} />}
      {editando && <EntregaUniformeDialog entrega={editando} onClose={() => setEditando(null)} />}
    </div>
  );
}
