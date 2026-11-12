import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useGuardarPlantillaTareas, usePlantillaTareas } from '@/hooks/useOperacion';
import { cn, getApiErrorMessage } from '@/lib/utils';
import type { FaseEvento, RangoFase } from '@/types';
import { inputCls } from '../CentroCostos/LineaCostoDialog';

// Tareas tipo de un rubro (para todos los eventos): lo que "Cargar tareas tipo"
// agrega al evento, cada una en el primer día de su fase.

interface Props {
  rubroId: number | null;
  fases:   RangoFase[];
  canEdit: boolean;
  onClose: () => void;
}

export default function PlantillaTareasDialog({ rubroId, fases, canEdit, onClose }: Props) {
  const { data, isLoading } = usePlantillaTareas(rubroId);
  const guardar = useGuardarPlantillaTareas();
  const [filas, setFilas] = useState<{ actividad: string; fase: FaseEvento }[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (data) setFilas(data.tareas.map(t => ({ ...t }))); }, [data]);

  const set = (i: number, campo: 'actividad' | 'fase', v: string) =>
    setFilas(fs => fs.map((f, j) => (j === i ? { ...f, [campo]: v } : f)));
  const mover = (i: number, d: -1 | 1) => setFilas(fs => {
    const j = i + d;
    if (j < 0 || j >= fs.length) return fs;
    const c = [...fs]; [c[i], c[j]] = [c[j], c[i]]; return c;
  });

  const handleGuardar = () => {
    if (rubroId === null) return;
    const tareas = filas.filter(f => f.actividad.trim()).map(f => ({ ...f, actividad: f.actividad.trim() }));
    guardar.mutate({ rubroId, tareas }, { onSuccess: onClose, onError: e => setError(getApiErrorMessage(e)) });
  };

  return (
    <Dialog open={rubroId !== null} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Tareas tipo · {data?.rubro.nombre ?? ''}</DialogTitle>
        </DialogHeader>
        {isLoading || !data ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Cargando…</p>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Las que se agregan al evento con "Cargar tareas tipo", cada una en el primer día de su fase. Valen para todos los eventos.
              {data.es_default && ' Por ahora es la lista de base: ajustala a cómo trabaja el equipo.'}
            </p>
            <div className="space-y-1.5">
              {filas.map((f, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <input className={cn(inputCls, 'min-w-0 flex-1')} value={f.actividad} disabled={!canEdit} onChange={e => set(i, 'actividad', e.target.value)} />
                  <select className={cn(inputCls, 'w-40 shrink-0')} value={f.fase} disabled={!canEdit} onChange={e => set(i, 'fase', e.target.value)}>
                    {fases.map(fa => <option key={fa.fase} value={fa.fase}>{fa.label}</option>)}
                  </select>
                  {canEdit && (
                    <>
                      <button className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30" disabled={i === 0} onClick={() => mover(i, -1)} title="Subir"><ArrowUp size={14} /></button>
                      <button className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30" disabled={i === filas.length - 1} onClick={() => mover(i, 1)} title="Bajar"><ArrowDown size={14} /></button>
                      <button className="p-1 text-muted-foreground hover:text-destructive" onClick={() => setFilas(fs => fs.filter((_, j) => j !== i))} title="Quitar"><Trash2 size={14} /></button>
                    </>
                  )}
                </div>
              ))}
            </div>
            {canEdit && (
              <Button variant="outline" size="sm" onClick={() => setFilas(fs => [...fs, { actividad: '', fase: fs[fs.length - 1]?.fase ?? 'MONTAJE' }])}>
                <Plus size={14} className="mr-1" /> Agregar tarea
              </Button>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>{canEdit ? 'Cancelar' : 'Cerrar'}</Button>
              {canEdit && <Button onClick={handleGuardar} disabled={guardar.isPending}>{guardar.isPending ? 'Guardando…' : 'Guardar'}</Button>}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
