import { useEffect, useState } from 'react';
import { Plus, Check, X as XIcon, Trash2 } from 'lucide-react';
import {
  useJornadas, useCreateJornada, useAprobarJornada, useRechazarJornada, useDeleteJornada, useEmpleados,
  type JornadaFiltros, type JornadaPayload,
} from '@/hooks/useRRHH';
import { useEventos } from '@/hooks/useEvento';
import { useCamiones } from '@/hooks/useCamiones';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getApiErrorMessage } from '@/lib/utils';
import type { Jornada, EstadoJornada } from '@/types';

const ESTADO_LABEL: Record<EstadoJornada, string> = { PENDIENTE: 'Pendiente', APROBADA: 'Aprobada', RECHAZADA: 'Rechazada' };
const ESTADO_VARIANT: Record<EstadoJornada, 'warning' | 'success' | 'destructive'> = {
  PENDIENTE: 'warning', APROBADA: 'success', RECHAZADA: 'destructive',
};

// Para empleados con tipo_liquidacion=JORNADA, horas_normales/horas_extras ya
// vienen partidas por el umbral del empleado (no por la regla fija de 8hs) —
// esto traduce esa partición a la indicación visual que pidió el cliente.
function getJornadaBadge(j: Jornada): { label: string; variant: 'success' | 'warning' | 'muted' } | null {
  const emp = j.empleado;
  if (!emp || emp.tipo_liquidacion !== 'JORNADA') return null;

  const horasTrabajadas = j.horas_normales + j.horas_extras;
  const umbralJornada    = emp.umbral_horas_jornada ?? 0;
  const umbralMedia      = emp.umbral_horas_media   ?? 0;

  if (horasTrabajadas >= umbralJornada) return { label: 'Jornada completa', variant: 'success' };
  if (horasTrabajadas >= umbralMedia)   return { label: 'Media jornada',    variant: 'warning' };
  return { label: 'Sin jornal', variant: 'muted' };
}

const inputCls = 'w-full border border-input rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring';
const labelCls = 'block text-xs font-medium text-muted-foreground mb-0.5';

function combineFechaHora(fecha: string, hora: string): string | null {
  if (!fecha || !hora) return null;
  return new Date(`${fecha}T${hora}:00`).toISOString();
}

function soloHora(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// ── Dialog de nueva jornada ────────────────────────────────────────────────────

function JornadaDialog({ open, onClose, empleadoIdFijo }: { open: boolean; onClose: () => void; empleadoIdFijo?: number }) {
  const { data: empleados = [] } = useEmpleados();
  const { data: eventos = [] }   = useEventos();
  const { data: camiones = [] }  = useCamiones();
  const createMut = useCreateJornada();
  const [error, setError] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  const EMPTY_FORM = {
    empleado_id: empleadoIdFijo ?? '', evento_id: '', fecha: today,
    hora_convocatoria: '', hora_ingreso: '', hora_egreso: '', descripcion: '',
    convocatoria: '', lugar_trabajo: '', camion_id: '', cantidad_viajes: '',
  };
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    if (open) { setForm(EMPTY_FORM); setError(null); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, empleadoIdFijo]);

  const empleadoActivo = empleados.find(e => e.id === Number(empleadoIdFijo ?? form.empleado_id));
  const mostrarViajes  = !!empleadoActivo?.valor_viaje;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const payload: JornadaPayload = {
      ...(empleadoIdFijo ? {} : { empleado_id: Number(form.empleado_id) }),
      evento_id:         form.evento_id ? Number(form.evento_id) : null,
      fecha:             form.fecha,
      hora_convocatoria: combineFechaHora(form.fecha, form.hora_convocatoria),
      hora_ingreso:      combineFechaHora(form.fecha, form.hora_ingreso),
      hora_egreso:       combineFechaHora(form.fecha, form.hora_egreso),
      descripcion:       form.descripcion || null,
      convocatoria:      form.convocatoria || null,
      lugar_trabajo:     form.lugar_trabajo || null,
      camion_id:         form.camion_id ? Number(form.camion_id) : null,
      cantidad_viajes:   form.cantidad_viajes ? Number(form.cantidad_viajes) : null,
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
        <DialogHeader><DialogTitle>Nueva jornada</DialogTitle></DialogHeader>
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
          <div>
            <label className={labelCls}>Evento</label>
            <select value={form.evento_id} onChange={e => setForm(p => ({ ...p, evento_id: e.target.value }))} className={inputCls}>
              <option value="">Trabajo en depósito (sin evento)</option>
              {eventos.map(ev => <option key={ev.id} value={ev.id}>{ev.nombre}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Convocatoria</label><input value={form.convocatoria} onChange={e => setForm(p => ({ ...p, convocatoria: e.target.value }))} className={inputCls} placeholder="ej: SANTIAGO.E, POLO…" /></div>
            <div><label className={labelCls}>Lugar de trabajo</label><input value={form.lugar_trabajo} onChange={e => setForm(p => ({ ...p, lugar_trabajo: e.target.value }))} className={inputCls} placeholder="ej: Depósito, Santiago del Estero…" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Camión / Vehículo</label>
              <select value={form.camion_id} onChange={e => setForm(p => ({ ...p, camion_id: e.target.value }))} className={inputCls}>
                <option value="">Sin asignar</option>
                {camiones.map(c => <option key={c.id} value={c.id}>{c.codigo}{c.descripcion ? ` — ${c.descripcion}` : ''}</option>)}
              </select>
            </div>
            {mostrarViajes && (
              <div><label className={labelCls}>Cantidad de viajes</label><input type="number" min="0" step="1" value={form.cantidad_viajes} onChange={e => setForm(p => ({ ...p, cantidad_viajes: e.target.value }))} className={inputCls} /></div>
            )}
          </div>
          <div><label className={labelCls}>Fecha *</label><input type="date" value={form.fecha} onChange={e => setForm(p => ({ ...p, fecha: e.target.value }))} className={inputCls} required /></div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className={labelCls}>Hora convocatoria</label><input type="time" value={form.hora_convocatoria} onChange={e => setForm(p => ({ ...p, hora_convocatoria: e.target.value }))} className={inputCls} /></div>
            <div><label className={labelCls}>Ingreso</label><input type="time" value={form.hora_ingreso} onChange={e => setForm(p => ({ ...p, hora_ingreso: e.target.value }))} className={inputCls} /></div>
            <div><label className={labelCls}>Egreso</label><input type="time" value={form.hora_egreso} onChange={e => setForm(p => ({ ...p, hora_egreso: e.target.value }))} className={inputCls} /></div>
          </div>
          <div><label className={labelCls}>Descripción</label><input value={form.descripcion} onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))} className={inputCls} /></div>
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

// ── Rechazo dialog ─────────────────────────────────────────────────────────────

function RechazarDialog({ jornada, onClose }: { jornada: Jornada | null; onClose: () => void }) {
  const rechazarMut = useRechazarJornada();
  const [motivo, setMotivo] = useState('');
  const [error,  setError]  = useState<string | null>(null);

  useEffect(() => { setMotivo(''); setError(null); }, [jornada?.id]);

  if (!jornada) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!motivo.trim()) { setError('El motivo es requerido'); return; }
    try {
      await rechazarMut.mutateAsync({ id: jornada.id, motivo: motivo.trim() });
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err) ?? 'Error al rechazar');
    }
  };

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Rechazar jornada</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 mt-1">
          <div>
            <label className={labelCls}>Motivo *</label>
            <input autoFocus value={motivo} onChange={e => setMotivo(e.target.value)} className={inputCls} required />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button type="submit" variant="destructive" size="sm" disabled={rechazarMut.isPending}>Rechazar</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function JornadasTab({ empleadoIdInicial }: { empleadoIdInicial?: number | null }) {
  const [filtros, setFiltros] = useState<JornadaFiltros>({});
  useEffect(() => {
    if (empleadoIdInicial != null) setFiltros(p => ({ ...p, empleado_id: empleadoIdInicial }));
  }, [empleadoIdInicial]);

  const { data: jornadas = [], isLoading } = useJornadas(filtros);
  const { data: empleados = [] } = useEmpleados();
  const { data: eventos = [] }   = useEventos();
  const aprobarMut = useAprobarJornada();
  const deleteMut  = useDeleteJornada();

  const [dialogOpen, setDialogOpen]     = useState(false);
  const [rechazando, setRechazando]     = useState<Jornada | null>(null);
  const [seleccion,  setSeleccion]      = useState<Set<number>>(new Set());

  const toggleSel = (id: number) => setSeleccion(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const aprobarSeleccionadas = async () => {
    if (!window.confirm(`¿Aprobar ${seleccion.size} jornada(s) seleccionada(s)?`)) return;
    for (const id of seleccion) await aprobarMut.mutateAsync(id);
    setSeleccion(new Set());
  };

  const handleDelete = (j: Jornada) => {
    if (!window.confirm('¿Eliminar esta jornada?')) return;
    deleteMut.mutate(j.id, { onError: (err) => alert(getApiErrorMessage(err) ?? 'Error al eliminar') });
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 justify-between mb-4">
        <div className="flex flex-wrap gap-2">
          <select value={filtros.empleado_id ?? ''} onChange={e => setFiltros(p => ({ ...p, empleado_id: e.target.value ? Number(e.target.value) : undefined }))} className={inputCls}>
            <option value="">Todos los empleados</option>
            {empleados.map(emp => <option key={emp.id} value={emp.id}>{emp.apellido}, {emp.nombre}</option>)}
          </select>
          <select value={filtros.evento_id ?? ''} onChange={e => setFiltros(p => ({ ...p, evento_id: e.target.value ? Number(e.target.value) : undefined }))} className={inputCls}>
            <option value="">Todos los eventos</option>
            {eventos.map(ev => <option key={ev.id} value={ev.id}>{ev.nombre}</option>)}
          </select>
          <select value={filtros.estado ?? ''} onChange={e => setFiltros(p => ({ ...p, estado: (e.target.value || undefined) as EstadoJornada | undefined }))} className={inputCls}>
            <option value="">Todos los estados</option>
            {Object.entries(ESTADO_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <input type="date" value={filtros.desde ?? ''} onChange={e => setFiltros(p => ({ ...p, desde: e.target.value || undefined }))} className={inputCls} />
          <input type="date" value={filtros.hasta ?? ''} onChange={e => setFiltros(p => ({ ...p, hasta: e.target.value || undefined }))} className={inputCls} />
        </div>
        <div className="flex gap-2">
          {seleccion.size > 0 && (
            <Button size="sm" variant="outline" onClick={aprobarSeleccionadas}>
              Aprobar seleccionadas ({seleccion.size})
            </Button>
          )}
          <Button size="sm" onClick={() => setDialogOpen(true)}><Plus size={14} className="mr-1.5" /> Nueva jornada</Button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-border">
              <tr>
                <th className="px-2 py-2 w-8" />
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Empleado</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Evento</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Fecha</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Convoc.</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Ingreso</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Egreso</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Hs. norm.</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Hs. extra</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Tipo jornal</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Estado</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {jornadas.length === 0 ? (
                <tr><td colSpan={12} className="px-3 py-6 text-center text-sm text-muted-foreground">No hay jornadas cargadas.</td></tr>
              ) : jornadas.map(j => {
                const badge = getJornadaBadge(j);
                return (
                <tr key={j.id} className="hover:bg-muted/20">
                  <td className="px-2 py-2">
                    {j.estado === 'PENDIENTE' && (
                      <input type="checkbox" checked={seleccion.has(j.id)} onChange={() => toggleSel(j.id)} />
                    )}
                  </td>
                  <td className="px-3 py-2.5 font-medium">{j.empleado ? `${j.empleado.apellido}, ${j.empleado.nombre}` : '-'}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{j.evento?.nombre ?? 'Depósito'}</td>
                  <td className="px-3 py-2.5">{j.fecha.slice(0, 10)}</td>
                  <td className="px-3 py-2.5">{soloHora(j.hora_convocatoria)}</td>
                  <td className="px-3 py-2.5">{soloHora(j.hora_ingreso)}</td>
                  <td className="px-3 py-2.5">{soloHora(j.hora_egreso)}</td>
                  <td className="px-3 py-2.5 text-right">{j.horas_normales}</td>
                  <td className="px-3 py-2.5 text-right">{j.horas_extras}</td>
                  <td className="px-3 py-2.5">
                    {badge ? <Badge variant={badge.variant}>{badge.label}</Badge> : <span className="text-muted-foreground">-</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    <span title={j.estado === 'RECHAZADA' ? j.motivo_rechazo ?? undefined : undefined}>
                      <Badge variant={ESTADO_VARIANT[j.estado]}>{ESTADO_LABEL[j.estado]}</Badge>
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    {j.estado === 'PENDIENTE' && (
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" title="Aprobar" onClick={() => aprobarMut.mutate(j.id)}>
                          <Check size={14} className="text-green-600" />
                        </Button>
                        <Button variant="ghost" size="icon" title="Rechazar" onClick={() => setRechazando(j)}>
                          <XIcon size={14} className="text-destructive" />
                        </Button>
                        <Button variant="ghost" size="icon" title="Eliminar" onClick={() => handleDelete(j)}>
                          <Trash2 size={14} className="text-muted-foreground" />
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <JornadaDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
      <RechazarDialog jornada={rechazando} onClose={() => setRechazando(null)} />
    </div>
  );
}

export { JornadaDialog, combineFechaHora, soloHora, ESTADO_LABEL, ESTADO_VARIANT };
