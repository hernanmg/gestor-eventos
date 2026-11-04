import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useCreateTarea, useUpdateTarea } from '@/hooks/useOperacion';
import { getApiErrorMessage } from '@/lib/utils';
import type { EstadoTarea, FaseEvento, RangoFase, RubroOperacion, TareaEvento } from '@/types';
import { inputCls, labelCls } from '../CentroCostos/LineaCostoDialog';
import { ESTADO_TAREA } from './constantes';

// Alta / edición de una tarea del evento. Sin fecha, la tarea va al primer día
// de la fase elegida (lo resuelve el backend con las fechas del evento).

interface Props {
  eventoId:  number;
  fases:     RangoFase[];
  rubros:    RubroOperacion[];
  tarea?:    TareaEvento;
  rubroId?:  number | null; // alta desde la tarjeta de un rubro
  open:      boolean;
  onClose:   () => void;
}

export default function TareaDialog({ eventoId, fases, rubros, tarea, rubroId, open, onClose }: Props) {
  const [actividad, setActividad]     = useState('');
  const [rubro, setRubro]             = useState<string>('');
  const [fase, setFase]               = useState<FaseEvento | ''>('');
  const [fecha, setFecha]             = useState('');
  const [hora, setHora]               = useState('');
  const [responsable, setResponsable] = useState('');
  const [observaciones, setObs]       = useState('');
  const [estado, setEstado]           = useState<EstadoTarea>('PENDIENTE');
  const [error, setError]             = useState<string | null>(null);
  const create = useCreateTarea(eventoId);
  const update = useUpdateTarea(eventoId);
  const pending = create.isPending || update.isPending;

  useEffect(() => {
    if (!open) return;
    setActividad(tarea?.actividad ?? '');
    setRubro(String(tarea?.rubro_evento_id ?? rubroId ?? ''));
    setFase(tarea?.fase ?? '');
    setFecha(tarea?.fecha.slice(0, 10) ?? '');
    setHora(tarea?.hora ?? '');
    setResponsable(tarea?.responsable ?? '');
    setObs(tarea?.observaciones ?? '');
    setEstado(tarea?.estado ?? 'PENDIENTE');
    setError(null);
  }, [open, tarea, rubroId]);

  const handleGuardar = () => {
    if (!actividad.trim()) { setError('Completá la actividad'); return; }
    if (!fecha && !fase) { setError('Elegí la fase o la fecha'); return; }
    const data = {
      actividad: actividad.trim(),
      rubro_evento_id: rubro ? Number(rubro) : null,
      ...(fecha ? { fecha } : {}),
      // Con fecha y sin fase elegida, el backend calcula la fase
      ...(fase ? { fase } : {}),
      hora: hora.trim() || null,
      responsable: responsable.trim() || null,
      observaciones: observaciones.trim() || null,
      estado,
    };
    const opts = { onSuccess: onClose, onError: (e: unknown) => setError(getApiErrorMessage(e)) };
    if (tarea) update.mutate({ id: tarea.id, data }, opts);
    else create.mutate(data, opts);
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{tarea ? 'Editar tarea' : 'Nueva tarea'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className={labelCls}>Actividad</label>
            <input className={inputCls} value={actividad} onChange={e => setActividad(e.target.value)} placeholder="Ej: Montaje del escenario" autoFocus />
          </div>
          <div>
            <label className={labelCls}>Rubro</label>
            <select className={inputCls} value={rubro} onChange={e => setRubro(e.target.value)}>
              <option value="">General del evento</option>
              {rubros.map(r => <option key={r.id} value={r.id}>{r.rubro.nombre}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Fase</label>
              <select className={inputCls} value={fase} onChange={e => setFase(e.target.value as FaseEvento | '')}>
                <option value="">{fecha ? 'Según la fecha' : 'Elegí…'}</option>
                {fases.map(f => <option key={f.fase} value={f.fase}>{f.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Fecha</label>
              <input type="date" className={inputCls} value={fecha} onChange={e => setFecha(e.target.value)} />
            </div>
          </div>
          {!fecha && fase && <p className="-mt-1 text-[11px] text-muted-foreground">Sin fecha va al primer día de la fase.</p>}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Hora</label>
              <input className={inputCls} value={hora} onChange={e => setHora(e.target.value)} placeholder="08:00" />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Responsable</label>
              <input className={inputCls} value={responsable} onChange={e => setResponsable(e.target.value)} placeholder="Quién la lleva" />
            </div>
          </div>
          <div>
            <label className={labelCls}>Estado</label>
            <div className="flex gap-2">
              {(Object.keys(ESTADO_TAREA) as EstadoTarea[]).map(e => (
                <button
                  key={e} type="button" onClick={() => setEstado(e)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium ${estado === e ? ESTADO_TAREA[e].cls + ' border-transparent' : 'border-border text-muted-foreground'}`}
                >
                  {ESTADO_TAREA[e].label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className={labelCls}>Observaciones</label>
            <textarea className={inputCls} rows={2} value={observaciones} onChange={e => setObs(e.target.value)} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={pending}>Cancelar</Button>
            <Button onClick={handleGuardar} disabled={pending}>{pending ? 'Guardando…' : 'Guardar'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
