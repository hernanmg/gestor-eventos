import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  DndContext, closestCenter,
  KeyboardSensor, PointerSensor,
  useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, sortableKeyboardCoordinates,
  verticalListSortingStrategy, useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ChevronLeft, ChevronRight, Plus, Trash2, Pencil, GripVertical,
  FileSpreadsheet, Loader2, Lock, CheckCircle2, AlertTriangle, History,
} from 'lucide-react';
import {
  useParteDiario, useCrearParte, useUpdateParte, useCerrarParte, useExportarParte,
  useAddAsignacion, useUpdateAsignacion, useDeleteAsignacion,
  type AsignacionDiariaPayload,
} from '@/hooks/useParteDiario';
import { useEmpleados } from '@/hooks/useRRHH';
import { useCamiones } from '@/hooks/useCamiones';
import { useEventos } from '@/hooks/useEvento';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { cn, getApiErrorMessage } from '@/lib/utils';
import type { AsignacionDiaria, EstadoAsignacionDiaria } from '@/types';

// ── Constantes ────────────────────────────────────────────────────────────────

const SECCIONES = ['Administración', 'Depósito', 'Eventos'] as const;
const SECCION_HEADER_CLASS: Record<string, string> = {
  'Administración': 'bg-sky-100 text-sky-900',
  'Depósito':       'bg-yellow-100 text-yellow-900',
  'Eventos':        'bg-green-100 text-green-900',
  'NO CITADOS':     'bg-gray-100 text-gray-700',
};

const ESTADO_LABEL: Record<EstadoAsignacionDiaria, string> = {
  ASIGNADO:   'Asignado',
  LIBRE:      'Libre',
  VACACIONES: 'Vacaciones',
  AUSENTE:    'Ausente',
  NO_CITADO:  'No citado',
};
const ESTADOS: EstadoAsignacionDiaria[] = ['ASIGNADO', 'LIBRE', 'VACACIONES', 'AUSENTE', 'NO_CITADO'];

const inputCls = 'w-full border border-input rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring';
const labelCls = 'block text-xs font-medium text-muted-foreground mb-0.5';

// Fecha "de hoy"/navegación de días en el calendario LOCAL del usuario — a
// diferencia de fmtDate/formatDate (fechas de negocio en UTC), acá sí
// queremos la hora local real, por eso se evita toISOString() (que convierte
// a UTC y corre un día para adelante/atrás cerca de la medianoche local).
function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function todayStr(): string {
  return toDateStr(new Date());
}

function addDays(fecha: string, days: number): string {
  const d = new Date(fecha + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return toDateStr(d);
}

// Elegible para generar Jornada al cerrar — misma condición que el backend.
function esElegibleParaJornada(a: AsignacionDiaria): boolean {
  return a.estado === 'ASIGNADO' && !!a.hora_ingreso && a.hora_salida_fija && !!a.hora_salida;
}

// ── Dialog de alta/edición de asignación ──────────────────────────────────────

interface AsignacionFormState {
  empleado_id:      string;
  estado:           EstadoAsignacionDiaria;
  seccion:          string;
  hora_ingreso:     string;
  lugar:            string;
  tarea:            string;
  camion_id:        string;
  vehiculo_texto:   string;
  evento_id:        string;
  hora_salida:      string;
  hora_salida_fija: boolean;
}

function asignacionToForm(a: AsignacionDiaria | null, seccionInicial?: string): AsignacionFormState {
  if (!a) {
    return {
      empleado_id: '', estado: 'ASIGNADO', seccion: seccionInicial ?? SECCIONES[0],
      hora_ingreso: '', lugar: '', tarea: '', camion_id: '', vehiculo_texto: '',
      evento_id: '', hora_salida: '', hora_salida_fija: false,
    };
  }
  return {
    empleado_id: String(a.empleado_id),
    estado: a.estado,
    seccion: a.seccion ?? seccionInicial ?? SECCIONES[0],
    hora_ingreso: a.hora_ingreso ?? '',
    lugar: a.lugar ?? '',
    tarea: a.tarea ?? '',
    camion_id: a.camion_id ? String(a.camion_id) : '',
    vehiculo_texto: a.vehiculo_texto ?? '',
    evento_id: a.evento_id ? String(a.evento_id) : '',
    hora_salida: a.hora_salida ?? '',
    hora_salida_fija: a.hora_salida_fija,
  };
}

function AsignacionDialog({ open, onClose, parteId, fecha, editing, seccionInicial }: {
  open: boolean; onClose: () => void; parteId: number; fecha: string;
  editing: AsignacionDiaria | null; seccionInicial?: string;
}) {
  const { data: empleados = [] } = useEmpleados();
  const { data: camiones  = [] } = useCamiones();
  const { data: eventos   = [] } = useEventos();
  const addMut    = useAddAsignacion(fecha);
  const updateMut = useUpdateAsignacion(fecha);

  const [form, setForm]   = useState<AsignacionFormState>(asignacionToForm(editing, seccionInicial));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) { setForm(asignacionToForm(editing, seccionInicial)); setError(null); }
  }, [open, editing, seccionInicial]);

  const empleadoOptions: ComboboxOption[] = useMemo(() => empleados.map(e => ({
    value: String(e.id),
    label: `${e.apellido}, ${e.nombre}${e.apodo ? ` (${e.apodo})` : ''}`,
  })), [empleados]);

  const isPending = addMut.isPending || updateMut.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.empleado_id) { setError('Seleccioná un empleado'); return; }

    const payload: AsignacionDiariaPayload = {
      empleado_id: Number(form.empleado_id),
      estado:      form.estado,
      ...(form.estado === 'ASIGNADO' ? {
        seccion:          form.seccion || null,
        hora_ingreso:     form.hora_ingreso || null,
        lugar:            form.lugar || null,
        tarea:            form.tarea || null,
        camion_id:        form.camion_id ? Number(form.camion_id) : null,
        vehiculo_texto:   form.vehiculo_texto || null,
        evento_id:        form.evento_id ? Number(form.evento_id) : null,
        hora_salida:      form.hora_salida || null,
        hora_salida_fija: form.hora_salida_fija,
      } : {
        seccion: null, hora_ingreso: null, lugar: null, tarea: null,
        camion_id: null, vehiculo_texto: null, evento_id: null,
        hora_salida: null, hora_salida_fija: false,
      }),
    };

    try {
      if (editing) await updateMut.mutateAsync({ parteId, id: editing.id, data: payload });
      else         await addMut.mutateAsync({ parteId, data: payload });
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err) ?? 'Error al guardar');
    }
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{editing ? 'Editar asignación' : 'Nueva asignación'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 mt-1">
          <div>
            <label className={labelCls}>Empleado *</label>
            <Combobox
              options={empleadoOptions}
              value={form.empleado_id || null}
              onChange={v => setForm(p => ({ ...p, empleado_id: v }))}
              placeholder="Buscar por nombre o apodo…"
              searchPlaceholder="Buscar…"
              className="w-full"
            />
          </div>
          <div>
            <label className={labelCls}>Estado</label>
            <select value={form.estado} onChange={e => setForm(p => ({ ...p, estado: e.target.value as EstadoAsignacionDiaria }))} className={inputCls}>
              {ESTADOS.map(e => <option key={e} value={e}>{ESTADO_LABEL[e]}</option>)}
            </select>
          </div>

          {form.estado === 'ASIGNADO' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Sección</label>
                  <select value={form.seccion} onChange={e => setForm(p => ({ ...p, seccion: e.target.value }))} className={inputCls}>
                    {SECCIONES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Hora ingreso</label>
                  <input value={form.hora_ingreso} onChange={e => setForm(p => ({ ...p, hora_ingreso: e.target.value }))} placeholder="08:00" className={inputCls} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Lugar</label>
                <input value={form.lugar} onChange={e => setForm(p => ({ ...p, lugar: e.target.value }))} placeholder="Polo, Santiago del Estero…" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Tarea</label>
                <input value={form.tarea} onChange={e => setForm(p => ({ ...p, tarea: e.target.value }))} className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Vehículo (Camiones)</label>
                  <select value={form.camion_id} onChange={e => setForm(p => ({ ...p, camion_id: e.target.value }))} className={inputCls}>
                    <option value="">Sin asignar</option>
                    {camiones.map(c => <option key={c.id} value={c.id}>{c.codigo}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Vehículo (texto libre)</label>
                  <input value={form.vehiculo_texto} onChange={e => setForm(p => ({ ...p, vehiculo_texto: e.target.value }))} placeholder="ej: Sprinter" className={inputCls} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Evento (opcional)</label>
                <select value={form.evento_id} onChange={e => setForm(p => ({ ...p, evento_id: e.target.value }))} className={inputCls}>
                  <option value="">Sin evento</option>
                  {eventos.map(ev => <option key={ev.id} value={ev.id}>{ev.nombre}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3 items-end">
                <div>
                  <label className={labelCls}>Hora salida</label>
                  <input
                    value={form.hora_salida}
                    onChange={e => setForm(p => ({ ...p, hora_salida: e.target.value }))}
                    placeholder={form.hora_salida_fija ? '18:00' : '***'}
                    disabled={!form.hora_salida_fija}
                    className={inputCls}
                  />
                </div>
                <label className="flex items-center gap-2 text-sm pb-1.5">
                  <input type="checkbox" checked={form.hora_salida_fija} onChange={e => setForm(p => ({ ...p, hora_salida_fija: e.target.checked }))} />
                  Hora fija
                </label>
              </div>
            </>
          )}

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

// ── Fila con drag & drop ───────────────────────────────────────────────────────

function JornadaCreadaCell({ asignacion, cerrado }: { asignacion: AsignacionDiaria; cerrado: boolean }) {
  if (!cerrado) return <span className="text-muted-foreground">—</span>;
  if (asignacion.jornada_id) {
    return (
      <Link to="/rrhh" title="Jornada creada — ver en RRHH" className="inline-flex items-center text-green-600 hover:text-green-700">
        <CheckCircle2 size={16} />
      </Link>
    );
  }
  if (esElegibleParaJornada(asignacion)) return <span className="text-muted-foreground">—</span>;
  if (asignacion.estado !== 'ASIGNADO') return <span className="text-muted-foreground">—</span>;
  return (
    <span title="Faltan datos — no se generó la jornada">
      <AlertTriangle size={16} className="text-amber-500" />
    </span>
  );
}

function SortableAsignacionRow({ asignacion, cerrado, onEdit, onDelete }: {
  asignacion: AsignacionDiaria; cerrado: boolean;
  onEdit: () => void; onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: asignacion.id, disabled: cerrado });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const cell = 'px-2 py-1.5 text-sm';
  const vehiculo = asignacion.camion?.codigo ?? asignacion.vehiculo_texto ?? '—';

  return (
    <tr ref={setNodeRef} style={style} className={cn('group border-b border-border/60', isDragging && 'opacity-50 bg-accent/50')}>
      <td className="w-6 px-1 text-center">
        {!cerrado && (
          <button {...attributes} {...listeners} tabIndex={-1} className="cursor-grab text-muted-foreground opacity-0 group-hover:opacity-60 transition-opacity">
            <GripVertical size={13} />
          </button>
        )}
      </td>
      <td className={cn(cell, 'font-medium')}>{asignacion.empleado.apellido}, {asignacion.empleado.nombre}{asignacion.empleado.apodo ? ` (${asignacion.empleado.apodo})` : ''}</td>
      <td className={cell}><Badge variant={asignacion.estado === 'ASIGNADO' ? 'success' : 'muted'}>{ESTADO_LABEL[asignacion.estado]}</Badge></td>
      <td className={cell}>{asignacion.hora_ingreso ?? '—'}</td>
      <td className={cell}>{asignacion.lugar ?? '—'}</td>
      <td className={cell}>{asignacion.tarea ?? '—'}</td>
      <td className={cell}>{vehiculo}</td>
      <td className={cell}>{asignacion.evento?.nombre ?? '—'}</td>
      <td className={cell}>{asignacion.hora_salida_fija ? (asignacion.hora_salida ?? '—') : '***'}</td>
      <td className={cn(cell, 'text-center')}><JornadaCreadaCell asignacion={asignacion} cerrado={cerrado} /></td>
      <td className="px-1">
        {!cerrado && (
          <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition">
            <button onClick={onEdit} className="p-1 rounded text-muted-foreground hover:bg-accent transition" title="Editar"><Pencil size={13} /></button>
            <button onClick={onDelete} className="p-1 rounded text-destructive hover:bg-destructive/10 transition" title="Eliminar"><Trash2 size={13} /></button>
          </div>
        )}
      </td>
    </tr>
  );
}

// ── Sección ────────────────────────────────────────────────────────────────────

function SeccionTabla({ titulo, asignaciones, parteId, fecha, cerrado, onAdd, onEdit }: {
  titulo: string; asignaciones: AsignacionDiaria[]; parteId: number; fecha: string; cerrado: boolean;
  onAdd: () => void; onEdit: (a: AsignacionDiaria) => void;
}) {
  const updateMut = useUpdateAsignacion(fecha);
  const deleteMut = useDeleteAsignacion(fecha);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const newIndex = asignaciones.findIndex(a => a.id === Number(over.id));
    updateMut.mutate({ parteId, id: Number(active.id), data: { orden: newIndex + 1 } });
  }, [asignaciones, parteId, updateMut]);

  const handleDelete = (a: AsignacionDiaria) => {
    if (!window.confirm(`¿Eliminar a ${a.empleado.apellido}, ${a.empleado.nombre} del parte?`)) return;
    deleteMut.mutate({ parteId, id: a.id }, { onError: err => alert(getApiErrorMessage(err)) });
  };

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className={cn('flex items-center justify-between px-3 py-2', SECCION_HEADER_CLASS[titulo] ?? 'bg-gray-100 text-gray-700')}>
        <h3 className="text-sm font-semibold uppercase tracking-wide">{titulo} ({asignaciones.length})</h3>
        {!cerrado && (
          <Button variant="ghost" size="sm" onClick={onAdd} className="h-7 text-xs hover:bg-white/50">
            <Plus size={13} className="mr-1" /> Agregar
          </Button>
        )}
      </div>
      {asignaciones.length === 0 ? (
        <p className="px-3 py-4 text-sm text-muted-foreground text-center">Sin personas en esta sección.</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={asignaciones.map(a => a.id)} strategy={verticalListSortingStrategy}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border bg-white text-muted-foreground text-xs font-medium">
                    <th className="w-6" />
                    <th className="px-2 py-2 text-left">Empleado</th>
                    <th className="px-2 py-2 text-left">Estado</th>
                    <th className="px-2 py-2 text-left">Hora ingreso</th>
                    <th className="px-2 py-2 text-left">Lugar</th>
                    <th className="px-2 py-2 text-left">Tarea</th>
                    <th className="px-2 py-2 text-left">Vehículo</th>
                    <th className="px-2 py-2 text-left">Evento</th>
                    <th className="px-2 py-2 text-left">Hora salida</th>
                    <th className="px-2 py-2 text-center">Jornada</th>
                    <th className="w-16" />
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {asignaciones.map(a => (
                    <SortableAsignacionRow
                      key={a.id} asignacion={a} cerrado={cerrado}
                      onEdit={() => onEdit(a)} onDelete={() => handleDelete(a)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function ParteDiarioPage() {
  const [searchParams] = useSearchParams();
  const [fecha, setFecha] = useState(searchParams.get('fecha') || todayStr());
  const { data: parte, isLoading } = useParteDiario(fecha);
  const crearMut  = useCrearParte();
  const cerrarMut = useCerrarParte(fecha);
  const updateParteMut = useUpdateParte(fecha);
  const { exportar, isExporting } = useExportarParte();

  const [dialogOpen, setDialogOpen]         = useState(false);
  const [editing, setEditing]               = useState<AsignacionDiaria | null>(null);
  const [seccionParaAlta, setSeccionParaAlta] = useState<string | undefined>(undefined);
  const [titulo, setTitulo] = useState('');

  useEffect(() => { setTitulo(parte?.titulo ?? ''); }, [parte?.id, parte?.titulo]);

  const handleCrear = () => {
    crearMut.mutate({ fecha }, { onError: err => alert(getApiErrorMessage(err)) });
  };

  const openAdd = (seccion?: string) => { setEditing(null); setSeccionParaAlta(seccion); setDialogOpen(true); };
  const openEdit = (a: AsignacionDiaria) => { setEditing(a); setSeccionParaAlta(a.seccion ?? undefined); setDialogOpen(true); };

  const asignaciones = parte?.asignaciones ?? [];
  const asignados    = asignaciones.filter(a => a.estado === 'ASIGNADO');
  const noCitados     = asignaciones.filter(a => a.estado !== 'ASIGNADO');
  const bySeccion = (seccion: string) => asignados.filter(a => (a.seccion ?? SECCIONES[0]) === seccion);
  const otrasSecciones = [...new Set(asignados.map(a => a.seccion).filter((s): s is string => !!s && !(SECCIONES as readonly string[]).includes(s)))];

  const elegibles = asignaciones.filter(esElegibleParaJornada).length;

  const handleCerrar = () => {
    if (!parte) return;
    if (!window.confirm(`Se crearán/vincularán jornadas para ${elegibles} asignación(es) con hora de ingreso y salida definidas. ¿Cerrar el parte?`)) return;
    cerrarMut.mutate(parte.id, {
      onSuccess: (r) => alert(`Parte cerrado. ${r.jornadas_creadas} jornadas creadas, ${r.jornadas_vinculadas} vinculadas, ${r.omitidas} omitidas por falta de datos.`),
      onError: err => alert(getApiErrorMessage(err)),
    });
  };

  const handleTituloBlur = () => {
    if (!parte || titulo === (parte.titulo ?? '')) return;
    updateParteMut.mutate({ id: parte.id, data: { titulo: titulo || null } });
  };

  return (
    <div className="p-6 space-y-4 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-bold">Parte Diario de Personal</h1>
        <Link to="/parte-diario/historial" className="text-sm text-primary hover:underline flex items-center gap-1.5">
          <History size={14} /> Ver historial
        </Link>
      </div>

      {/* Selector de fecha */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={() => setFecha(f => addDays(f, -1))}><ChevronLeft size={16} /></Button>
        <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className="border rounded px-2 py-1.5 text-sm" />
        <Button variant="outline" size="icon" onClick={() => setFecha(f => addDays(f, 1))}><ChevronRight size={16} /></Button>
        {parte?.cerrado && <Badge variant="info">CERRADO</Badge>}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : !parte ? (
        <div className="text-center py-16 border border-dashed rounded-lg">
          <p className="text-sm text-muted-foreground mb-3">Todavía no hay un parte diario para el {fecha}.</p>
          <Button size="sm" onClick={handleCrear} disabled={crearMut.isPending}>
            {crearMut.isPending ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : <Plus size={14} className="mr-1.5" />}
            Crear parte del día
          </Button>
        </div>
      ) : (
        <>
          {/* Header del parte */}
          <div className="flex items-center justify-between gap-3 flex-wrap rounded-lg border border-border bg-white px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-lg font-semibold">{fecha}</p>
              <input
                value={titulo}
                onChange={e => setTitulo(e.target.value)}
                onBlur={handleTituloBlur}
                disabled={parte.cerrado}
                placeholder="Título del parte (opcional)"
                className="text-sm text-muted-foreground border-none bg-transparent focus:outline-none focus:ring-1 focus:ring-ring rounded px-1 -ml-1 w-full max-w-sm disabled:opacity-60"
              />
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={() => exportar(parte.id)} disabled={isExporting}>
                {isExporting ? <Loader2 size={13} className="mr-1.5 animate-spin" /> : <FileSpreadsheet size={13} className="mr-1.5" />}
                Exportar Excel
              </Button>
              {!parte.cerrado && (
                <Button size="sm" onClick={handleCerrar} disabled={cerrarMut.isPending}>
                  {cerrarMut.isPending ? <Loader2 size={13} className="mr-1.5 animate-spin" /> : <Lock size={13} className="mr-1.5" />}
                  Cerrar parte y crear jornadas
                </Button>
              )}
            </div>
          </div>

          {/* Secciones */}
          <div className="space-y-4">
            {SECCIONES.map(seccion => (
              <SeccionTabla
                key={seccion} titulo={seccion} asignaciones={bySeccion(seccion)}
                parteId={parte.id} fecha={fecha} cerrado={parte.cerrado}
                onAdd={() => openAdd(seccion)} onEdit={openEdit}
              />
            ))}
            {otrasSecciones.map(seccion => (
              <SeccionTabla
                key={seccion} titulo={seccion} asignaciones={bySeccion(seccion)}
                parteId={parte.id} fecha={fecha} cerrado={parte.cerrado}
                onAdd={() => openAdd(seccion)} onEdit={openEdit}
              />
            ))}
            <SeccionTabla
              titulo="NO CITADOS" asignaciones={noCitados}
              parteId={parte.id} fecha={fecha} cerrado={parte.cerrado}
              onAdd={() => openAdd(undefined)} onEdit={openEdit}
            />
          </div>
        </>
      )}

      {parte && (
        <AsignacionDialog
          open={dialogOpen} onClose={() => setDialogOpen(false)}
          parteId={parte.id} fecha={fecha} editing={editing} seccionInicial={seccionParaAlta}
        />
      )}
    </div>
  );
}
