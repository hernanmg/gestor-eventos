import { useCallback, useEffect, useMemo, useState } from 'react';
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
  GripVertical, Plus, Trash2, ChevronDown, ChevronRight,
  FileSpreadsheet, Loader2, Sparkles, AlertTriangle, Warehouse, Upload, Users,
} from 'lucide-react';
import { format, subDays, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  useFichaEvento, useInicializarFicha, useExportarFicha,
  useUpdateRubroEvento, useAddPedidoItem, useUpdatePedidoItem, useDeletePedidoItem,
  useAsignarStock, useDesasignarStock,
  useListarHojasFichaImport, useImportarFicha, useImportarEsquemaTurnos,
  type PedidoItemPayload, type FichaImportResultado, type EsquemaImportResultado,
} from '@/hooks/useFichaEvento';
import { useDisponibilidad } from '@/hooks/useStock';
import ProveedorCombobox from '@/components/domain/ProveedorCombobox';
import ProductoCombobox, { type ProductoLite } from '@/components/domain/ProductoCombobox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn, getApiErrorMessage } from '@/lib/utils';
import { parseMoney } from '@/lib/formatters';
import { calcHorasPorAgente, esRubroPersonal, soloFecha, fmtFechaCorta, fmtHoras } from '@/lib/turnos';
import type {
  RubroEvento, RubroEventoAsignacionStock, PedidoItem, EstadoRubroEvento,
  ProveedorBusqueda, Moneda, Evento, UbicacionStock, SugerenciaStock,
} from '@/types';
import BaseTable from '@/components/ui/BaseTable';

// ── Constantes ────────────────────────────────────────────────────────────────

const ESTADO_LABEL: Record<EstadoRubroEvento, string> = {
  PENDIENTE:  'Pendiente',
  COTIZANDO:  'Cotizando',
  CONFIRMADO: 'Confirmado',
  NO_VA:      'No va',
  CANCELADO:  'Cancelado',
};

const ESTADO_SELECT_CLASS: Record<EstadoRubroEvento, string> = {
  PENDIENTE:  'bg-gray-100 text-gray-700',
  COTIZANDO:  'bg-yellow-100 text-yellow-800',
  CONFIRMADO: 'bg-green-100 text-green-800',
  NO_VA:      'bg-red-100 text-red-700 line-through',
  CANCELADO:  'bg-red-100 text-red-700 line-through',
};

const ESTADOS: EstadoRubroEvento[] = ['PENDIENTE', 'COTIZANDO', 'CONFIRMADO', 'NO_VA', 'CANCELADO'];

const UBICACION_LABEL: Record<UbicacionStock, string> = {
  DEPOSITO:    'Depósito',
  EN_TRANSITO: 'En tránsito',
  EN_EVENTO:   'En evento',
  EXCEDENTE:   'Excedente',
  ALQUILADO:   'Alquilado',
  BAJA:        'Baja',
};

const UBICACION_CLASS: Record<UbicacionStock, string> = {
  DEPOSITO:    'bg-gray-100 text-gray-700',
  EN_TRANSITO: 'bg-orange-100 text-orange-700',
  EN_EVENTO:   'bg-green-100 text-green-700',
  EXCEDENTE:   'bg-blue-100 text-blue-700',
  ALQUILADO:   'bg-purple-100 text-purple-700',
  BAJA:        'bg-red-100 text-red-700',
};

// Un rubro NO_VA/CANCELADO no admite pedido técnico ni stock propio nuevo —
// mismo criterio que el vaciado de PedidoItems al cambiar a esos estados.
function puedeExpandir(estado: EstadoRubroEvento): boolean {
  return estado !== 'NO_VA' && estado !== 'CANCELADO';
}

function UbicacionBadge({ ubicacion }: { ubicacion: UbicacionStock }) {
  return (
    <span className={cn('px-1.5 py-0.5 rounded-full text-[10px] font-medium', UBICACION_CLASS[ubicacion])}>
      {UBICACION_LABEL[ubicacion]}
    </span>
  );
}

const inputCls = 'w-full text-xs border border-transparent rounded px-1 py-0.5 focus:border-ring/50 focus:outline-none bg-transparent hover:bg-accent/30 focus:bg-white transition';

// ── Tabla de PedidoItems (pedido técnico del proveedor externo) ──────────────

function pedidoItemToLocal(item: PedidoItem) {
  return {
    cantidad:        item.cantidad !== null ? String(item.cantidad) : '',
    descripcion:     item.descripcion,
    dias_uso:        item.dias_uso !== null ? String(item.dias_uso) : '',
    horario_llegada: item.horario_llegada ?? '',
    horario_retiro:  item.horario_retiro ?? '',
    observaciones:   item.observaciones ?? '',
  };
}

function SortablePedidoItemRow({ item, onSave, onDelete }: {
  item:     PedidoItem;
  onSave:   (id: number, data: Partial<PedidoItemPayload>) => void;
  onDelete: (id: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  const [local, setLocal] = useState(pedidoItemToLocal(item));
  useEffect(() => { setLocal(pedidoItemToLocal(item)); }, [item]);

  const field = (key: keyof typeof local) => ({
    value: local[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setLocal(p => ({ ...p, [key]: e.target.value })),
    onBlur: () => {
      const orig = pedidoItemToLocal(item);
      if (local[key] === orig[key]) return;
      const payload: Partial<PedidoItemPayload> = {};
      if (key === 'cantidad')  payload.cantidad  = local.cantidad  !== '' ? parseFloat(local.cantidad)  : null;
      else if (key === 'dias_uso') payload.dias_uso = local.dias_uso !== '' ? parseInt(local.dias_uso, 10) : null;
      else if (key === 'descripcion') payload.descripcion = local.descripcion;
      else (payload as any)[key] = local[key] || null;
      onSave(item.id, payload);
    },
  });

  const cell = 'px-1.5 py-1';

  return (
    <tr ref={setNodeRef} style={style} className={cn('group border-b border-border/60', isDragging && 'opacity-50 bg-accent/50')}>
      <td className="w-6 px-1 py-1 text-center">
        <button {...attributes} {...listeners} tabIndex={-1} className="cursor-grab text-muted-foreground opacity-0 group-hover:opacity-60 transition-opacity">
          <GripVertical size={13} />
        </button>
      </td>
      <td className={cn(cell, 'w-20')}><input {...field('cantidad')} type="number" step="0.01" min="0" className={cn(inputCls, 'text-right')} /></td>
      <td className={cell}><input {...field('descripcion')} placeholder="Material / servicio" className={inputCls} /></td>
      <td className={cn(cell, 'w-20')}><input {...field('dias_uso')} type="number" step="1" min="0" className={cn(inputCls, 'text-right')} /></td>
      <td className={cn(cell, 'w-28')}><input {...field('horario_llegada')} placeholder="08:00" className={inputCls} /></td>
      <td className={cn(cell, 'w-28')}><input {...field('horario_retiro')} placeholder="—" className={inputCls} /></td>
      <td className={cell}><input {...field('observaciones')} className={inputCls} /></td>
      <td className="w-8 px-1">
        <button
          tabIndex={-1}
          onClick={() => onDelete(item.id)}
          className="p-1 rounded text-destructive opacity-0 group-hover:opacity-100 hover:bg-destructive/10 transition"
          title="Eliminar ítem"
        >
          <Trash2 size={13} />
        </button>
      </td>
    </tr>
  );
}

// Tabla "pelada" (sin <tr><td> envolvente) — la ubica quien la use, sea la
// fila expandida de la tabla desktop o directamente en la card mobile.
//
// `items` es el subconjunto a mostrar (en modo esquema de personal, sólo los ítems
// que NO son turnos). El backend reordena contra TODOS los hermanos, así que la
// posición destino se calcula sobre `rubroEvento.pedido_items`, no sobre el subconjunto.
function PedidoItemsTable({ eventoId, rubroEvento, items = rubroEvento.pedido_items }: {
  eventoId:    number;
  rubroEvento: RubroEvento;
  items?:      PedidoItem[];
}) {
  const addItem    = useAddPedidoItem(eventoId);
  const updateItem = useUpdatePedidoItem(eventoId);
  const deleteItem = useDeletePedidoItem(eventoId);
  const allItems = rubroEvento.pedido_items;

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const newIndex = allItems.findIndex(i => i.id === Number(over.id));
    updateItem.mutate({ id: Number(active.id), data: { orden: newIndex + 1 } });
  }, [allItems, updateItem]);

  const handleSave = useCallback((id: number, data: Partial<PedidoItemPayload>) => {
    updateItem.mutate({ id, data });
  }, [updateItem]);

  const handleDelete = useCallback((id: number) => {
    if (!window.confirm('¿Eliminar este ítem del pedido?')) return;
    deleteItem.mutate(id);
  }, [deleteItem]);

  const handleAdd = () => {
    addItem.mutate({ rubroEventoId: rubroEvento.id, data: { descripcion: 'Nuevo ítem' } });
  };

  return (
    <div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
          <div className="overflow-x-auto">
            <BaseTable className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-gray-50 text-muted-foreground text-[11px] font-medium">
                  <th className="w-6" />
                  <th className="px-1.5 py-1.5 text-right w-20">Cant.</th>
                  <th className="px-1.5 py-1.5 text-left">Descripción</th>
                  <th className="px-1.5 py-1.5 text-right w-20">Días</th>
                  <th className="px-1.5 py-1.5 text-left w-28">Llegada</th>
                  <th className="px-1.5 py-1.5 text-left w-28">Retiro</th>
                  <th className="px-1.5 py-1.5 text-left">Observaciones</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <SortablePedidoItemRow key={item.id} item={item} onSave={handleSave} onDelete={handleDelete} />
                ))}
                {items.length === 0 && (
                  <tr><td colSpan={8} className="py-4 text-center text-muted-foreground">Sin ítems cargados todavía.</td></tr>
                )}
              </tbody>
            </BaseTable>
          </div>
        </SortableContext>
      </DndContext>
      <Button variant="ghost" size="sm" onClick={handleAdd} disabled={addItem.isPending} className="h-7 text-xs text-muted-foreground hover:text-foreground mt-1.5">
        <Plus size={13} className="mr-1" /> Agregar ítem
      </Button>
    </div>
  );
}

// ── Esquema de personal por turno (seguridad, limpieza…) ─────────────────────
// Un PedidoItem con fecha_turno es una línea de la grilla de dotación:
// Fecha | Tipo de turno | Ubicación | Ingreso | Salida | Hs/agente | Cantidad | Total hs.
// Hs/agente y Total hs los deriva el backend (turnos que cruzan medianoche incluidos);
// acá se recalculan en vivo sólo para mostrarlos mientras se edita.

function turnoToLocal(item: PedidoItem) {
  return {
    fecha:     soloFecha(item.fecha_turno),
    tipo:      item.tipo_turno ?? '',
    ubicacion: item.ubicacion_turno ?? '',
    inicio:    item.hora_inicio_turno ?? '',
    fin:       item.hora_fin_turno ?? '',
    cantidad:  item.cantidad !== null ? String(item.cantidad) : '',
  };
}

function TurnoRow({ item, tiposListId, ubicListId, onSave, onDelete }: {
  item:        PedidoItem;
  tiposListId: string;
  ubicListId:  string;
  onSave:      (id: number, data: Partial<PedidoItemPayload>) => void;
  onDelete:    (id: number) => void;
}) {
  const [local, setLocal] = useState(turnoToLocal(item));
  useEffect(() => { setLocal(turnoToLocal(item)); }, [item]);

  const cantidad = local.cantidad !== '' ? parseFloat(local.cantidad) : null;
  const horas    = calcHorasPorAgente(local.inicio, local.fin) ?? item.horas_por_agente;
  const total    = horas !== null && cantidad !== null && !Number.isNaN(cantidad) ? Math.round(horas * cantidad * 100) / 100 : null;

  const field = (key: keyof typeof local) => ({
    value: local[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setLocal(p => ({ ...p, [key]: e.target.value })),
    onBlur: () => {
      const orig = turnoToLocal(item);
      if (local[key] === orig[key]) return;
      // Vaciar la fecha sacaría al ítem del esquema — se restaura en vez de guardar
      if (key === 'fecha' && !local.fecha) { setLocal(p => ({ ...p, fecha: orig.fecha })); return; }
      const payload: Partial<PedidoItemPayload> = {};
      if (key === 'fecha')          payload.fecha_turno       = local.fecha;
      else if (key === 'tipo')      payload.tipo_turno        = local.tipo.trim() || null;
      else if (key === 'ubicacion') payload.ubicacion_turno   = local.ubicacion.trim() || null;
      else if (key === 'inicio')    payload.hora_inicio_turno = local.inicio || null;
      else if (key === 'fin')       payload.hora_fin_turno    = local.fin || null;
      else if (key === 'cantidad')  payload.cantidad          = cantidad !== null && !Number.isNaN(cantidad) ? cantidad : null;
      onSave(item.id, payload);
    },
  });

  const cell = 'px-1.5 py-1';
  return (
    <tr className="group border-b border-border/60">
      <td className={cn(cell, 'w-32')}><input {...field('fecha')} type="date" className={inputCls} /></td>
      <td className={cn(cell, 'w-40')}><input {...field('tipo')} list={tiposListId} placeholder="Seguridad Diurna" className={inputCls} /></td>
      <td className={cell}><input {...field('ubicacion')} list={ubicListId} placeholder="Ubicación" className={inputCls} /></td>
      <td className={cn(cell, 'w-24')}><input {...field('inicio')} type="time" className={inputCls} /></td>
      <td className={cn(cell, 'w-24')}><input {...field('fin')} type="time" className={inputCls} /></td>
      <td className={cn(cell, 'w-16 text-right text-muted-foreground tabular-nums')} title="Horas por agente (calculadas de Ingreso y Salida)">{fmtHoras(horas)}</td>
      <td className={cn(cell, 'w-20')}><input {...field('cantidad')} type="number" step="1" min="0" className={cn(inputCls, 'text-right')} /></td>
      <td className={cn(cell, 'w-20 text-right font-medium tabular-nums')} title="Cantidad × horas por agente">{fmtHoras(total)}</td>
      <td className="w-8 px-1">
        <button
          tabIndex={-1}
          onClick={() => onDelete(item.id)}
          className="p-1 rounded text-destructive opacity-0 group-hover:opacity-100 hover:bg-destructive/10 transition"
          title="Eliminar turno"
        >
          <Trash2 size={13} />
        </button>
      </td>
    </tr>
  );
}

function EsquemaPersonalTable({ eventoId, evento, rubroEvento, turnos }: {
  eventoId:    number;
  evento:      Evento;
  rubroEvento: RubroEvento;
  turnos:      PedidoItem[];
}) {
  const addItem    = useAddPedidoItem(eventoId);
  const updateItem = useUpdatePedidoItem(eventoId);
  const deleteItem = useDeletePedidoItem(eventoId);

  // Por día y, dentro del día, en el orden cargado (igual que la grilla exportada)
  const ordenados = useMemo(
    () => [...turnos].sort((a, b) => soloFecha(a.fecha_turno).localeCompare(soloFecha(b.fecha_turno)) || a.orden - b.orden),
    [turnos],
  );
  const totalHoras = turnos.reduce((acc, t) => acc + (t.total_horas_turno ?? 0), 0);

  const listId = `turnos-${rubroEvento.id}`;
  const tipos = useMemo(() => {
    const base = /seguridad/i.test(rubroEvento.rubro.nombre) ? ['Seguridad Diurna', 'Seguridad Nocturna', 'Seguridad Evento'] : [];
    return Array.from(new Set([...base, ...turnos.map(t => t.tipo_turno).filter((x): x is string => !!x)]));
  }, [turnos, rubroEvento.rubro.nombre]);
  const ubicaciones = useMemo(
    () => Array.from(new Set(turnos.map(t => t.ubicacion_turno).filter((x): x is string => !!x))),
    [turnos],
  );

  const handleSave = useCallback((id: number, data: Partial<PedidoItemPayload>) => {
    updateItem.mutate({ id, data });
  }, [updateItem]);

  const handleDelete = useCallback((id: number) => {
    if (!window.confirm('¿Eliminar este turno del esquema?')) return;
    deleteItem.mutate(id);
  }, [deleteItem]);

  // El turno nuevo copia el último cargado (mismo día/tipo/horario/cantidad, sin
  // ubicación): la grilla real repite casi todo y sólo cambia el puesto.
  const handleAdd = () => {
    const ultimo = ordenados[ordenados.length - 1];
    addItem.mutate({
      rubroEventoId: rubroEvento.id,
      data: {
        descripcion:       'Turno',
        cantidad:          ultimo?.cantidad ?? 1,
        fecha_turno:       soloFecha(ultimo?.fecha_turno) || soloFecha(evento.fecha_inicio) || format(new Date(), 'yyyy-MM-dd'),
        tipo_turno:        ultimo?.tipo_turno ?? null,
        hora_inicio_turno: ultimo?.hora_inicio_turno ?? null,
        hora_fin_turno:    ultimo?.hora_fin_turno ?? null,
      },
    });
  };

  return (
    <div>
      <datalist id={`${listId}-tipos`}>{tipos.map(t => <option key={t} value={t} />)}</datalist>
      <datalist id={`${listId}-ubic`}>{ubicaciones.map(u => <option key={u} value={u} />)}</datalist>
      <div className="overflow-x-auto">
        <BaseTable className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-border bg-gray-50 text-muted-foreground text-[11px] font-medium">
              <th className="px-1.5 py-1.5 text-left w-32">Fecha</th>
              <th className="px-1.5 py-1.5 text-left w-40">Tipo de turno</th>
              <th className="px-1.5 py-1.5 text-left">Ubicación</th>
              <th className="px-1.5 py-1.5 text-left w-24">Ingreso</th>
              <th className="px-1.5 py-1.5 text-left w-24">Salida</th>
              <th className="px-1.5 py-1.5 text-right w-16">Hs/agente</th>
              <th className="px-1.5 py-1.5 text-right w-20">Cantidad</th>
              <th className="px-1.5 py-1.5 text-right w-20">Total hs</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {ordenados.map(t => (
              <TurnoRow
                key={t.id} item={t}
                tiposListId={`${listId}-tipos`} ubicListId={`${listId}-ubic`}
                onSave={handleSave} onDelete={handleDelete}
              />
            ))}
            {ordenados.length === 0 && (
              <tr><td colSpan={9} className="py-4 text-center text-muted-foreground">Sin turnos cargados todavía.</td></tr>
            )}
          </tbody>
          {ordenados.length > 0 && (
            <tfoot>
              <tr className="border-t border-border bg-gray-50 font-semibold">
                <td colSpan={7} className="px-1.5 py-1.5 text-right">TOTAL HORAS:</td>
                <td className="px-1.5 py-1.5 text-right tabular-nums">{fmtHoras(totalHoras)}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </BaseTable>
      </div>
      <Button variant="ghost" size="sm" onClick={handleAdd} disabled={addItem.isPending} className="h-7 text-xs text-muted-foreground hover:text-foreground mt-1.5">
        <Plus size={13} className="mr-1" /> Agregar turno
      </Button>
    </div>
  );
}

// ── Importar esquema de personal desde Excel (SEGURIDAD_FESTIVAL_KM.xlsx) ────

type EsquemaImportStep = 'archivo' | 'preview' | 'success';

function ImportarEsquemaDialog({ eventoId, rubroEvento, onClose }: {
  eventoId:    number;
  rubroEvento: RubroEvento;
  onClose:     () => void;
}) {
  const [step, setStep]           = useState<EsquemaImportStep>('archivo');
  const [file, setFile]           = useState<File | null>(null);
  const [preview, setPreview]     = useState<EsquemaImportResultado | null>(null);
  const [resultado, setResultado] = useState<EsquemaImportResultado | null>(null);
  const [error, setError]         = useState<string | null>(null);

  const importar = useImportarEsquemaTurnos(eventoId);

  const handleFile = async (f: File) => {
    setFile(f);
    setError(null);
    try {
      setPreview(await importar.mutateAsync({ rubroEventoId: rubroEvento.id, file: f, preview: true }));
      setStep('preview');
    } catch (err: any) {
      setError(getApiErrorMessage(err));
    }
  };

  const handleConfirmar = async () => {
    if (!file) return;
    setError(null);
    try {
      setResultado(await importar.mutateAsync({ rubroEventoId: rubroEvento.id, file, preview: false }));
      setStep('success');
    } catch (err: any) {
      setError(getApiErrorMessage(err));
    }
  };

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>Importar esquema de {rubroEvento.rubro.nombre} desde Excel</DialogTitle></DialogHeader>

        {step === 'archivo' && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Subí la planilla con la grilla <span className="font-medium">N° | Fecha | Tipo | Cantidad | Ubicación | Ingreso | Salida</span> (ej. SEGURIDAD FESTIVAL KM.xlsx).
              Los turnos que ya existan (misma fecha, ubicación, ingreso y tipo) se actualizan; el resto se crea.
            </p>
            <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-lg py-10 cursor-pointer hover:bg-accent/30 transition">
              <Upload size={22} className="text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {importar.isPending ? 'Leyendo archivo…' : 'Hacé clic para elegir el archivo .xlsx'}
              </span>
              <input
                type="file" accept=".xlsx" className="hidden" disabled={importar.isPending}
                onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
            </label>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        )}

        {step === 'preview' && preview && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-4 text-sm">
              <span><span className="font-semibold text-green-700">{preview.creados}</span> a crear</span>
              <span><span className="font-semibold">{preview.actualizados}</span> a actualizar</span>
              <span>Total: <span className="font-semibold">{fmtHoras(preview.total_horas)}</span> hs</span>
            </div>
            {preview.omitidas.length > 0 && (
              <div className="text-xs bg-yellow-50 text-yellow-800 rounded px-3 py-2">
                <p className="font-medium mb-1 flex items-center gap-1"><AlertTriangle size={12} /> Filas omitidas:</p>
                <p>{preview.omitidas.map(o => `fila ${o.fila_excel} (${o.motivo})`).join(', ')}</p>
              </div>
            )}
            <div className="max-h-72 overflow-y-auto">
              <BaseTable className="w-full text-xs border-collapse">
                <thead className="sticky top-0 bg-gray-50">
                  <tr className="border-b border-border text-muted-foreground font-medium">
                    <th className="px-2 py-1.5 text-center">Día</th>
                    <th className="px-2 py-1.5 text-left">Fecha</th>
                    <th className="px-2 py-1.5 text-left">Tipo</th>
                    <th className="px-2 py-1.5 text-left">Ubicación</th>
                    <th className="px-2 py-1.5 text-left">Horario</th>
                    <th className="px-2 py-1.5 text-right">Cant.</th>
                    <th className="px-2 py-1.5 text-right">Total hs</th>
                    <th className="px-2 py-1.5 text-left">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {preview.filas.map(f => (
                    <tr key={f.fila_excel}>
                      <td className="px-2 py-1 text-center text-muted-foreground">{f.dia_numero ?? '—'}</td>
                      <td className="px-2 py-1">{fmtFechaCorta(f.fecha)}</td>
                      <td className="px-2 py-1">{f.tipo_turno ?? '—'}</td>
                      <td className="px-2 py-1">{f.ubicacion_turno ?? '—'}</td>
                      <td className="px-2 py-1 whitespace-nowrap">{f.hora_inicio ?? '?'} – {f.hora_fin ?? '?'}</td>
                      <td className="px-2 py-1 text-right">{f.cantidad}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{fmtHoras(f.total_horas)}</td>
                      <td className="px-2 py-1">
                        {f.accion === 'CREAR' ? 'Crear' : 'Actualizar'}
                        {f.advertencias.length > 0 && (
                          <span title={f.advertencias.join('\n')} className="ml-1 text-yellow-700 cursor-help">
                            <AlertTriangle size={11} className="inline" />
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </BaseTable>
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => { setStep('archivo'); setPreview(null); }}>Atrás</Button>
              <Button size="sm" onClick={handleConfirmar} disabled={importar.isPending}>
                {importar.isPending ? 'Importando…' : 'Confirmar importación'}
              </Button>
            </div>
          </div>
        )}

        {step === 'success' && resultado && (
          <div className="space-y-3">
            <p className="text-sm">
              Importación completa: <span className="font-semibold text-green-700">{resultado.creados}</span> turnos creados,{' '}
              <span className="font-semibold">{resultado.actualizados}</span> actualizados — {fmtHoras(resultado.total_horas)} hs en total.
            </p>
            <div className="flex justify-end pt-1">
              <Button size="sm" onClick={onClose}>Cerrar</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Pedido técnico: tabla de material o esquema de personal ───────────────────
// En rubros de personal (Seguridad, Limpieza…) hay un toggle "Modo esquema de
// personal". Si el rubro ya tiene turnos cargados (fecha_turno) se muestra en
// modo esquema automáticamente y el toggle queda fijo: no se puede volver a la
// tabla de material sin perder de vista los turnos existentes.

function PedidoTecnicoSection({ eventoId, evento, rubroEvento }: {
  eventoId:    number;
  evento:      Evento;
  rubroEvento: RubroEvento;
}) {
  const turnos = useMemo(() => rubroEvento.pedido_items.filter(i => i.fecha_turno), [rubroEvento.pedido_items]);
  const otros  = useMemo(() => rubroEvento.pedido_items.filter(i => !i.fecha_turno), [rubroEvento.pedido_items]);

  const tieneTurnos  = turnos.length > 0;
  const puedeEsquema = tieneTurnos || esRubroPersonal(rubroEvento.rubro.nombre);
  const [manual, setManual]         = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const modoEsquema = puedeEsquema && (tieneTurnos || manual);

  return (
    <div>
      <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {modoEsquema ? 'Esquema de personal' : 'Pedido técnico'} — {rubroEvento.rubro.nombre}
        </p>
        {puedeEsquema && (
          <div className="flex items-center gap-3">
            <label
              className={cn('flex items-center gap-1.5 text-xs select-none', tieneTurnos ? 'cursor-not-allowed opacity-70' : 'cursor-pointer')}
              title={tieneTurnos ? 'Eliminá los turnos cargados para volver a la tabla de material' : undefined}
            >
              <button
                type="button" role="switch" aria-checked={modoEsquema} disabled={tieneTurnos}
                onClick={() => setManual(m => !m)}
                className={cn(
                  'relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-1 focus:ring-ring',
                  modoEsquema ? 'bg-primary' : 'bg-gray-300',
                )}
              >
                <span className={cn('inline-block h-3 w-3 rounded-full bg-white shadow transition-transform', modoEsquema ? 'translate-x-3.5' : 'translate-x-0.5')} />
              </button>
              <span className="flex items-center gap-1"><Users size={12} /> Modo esquema de personal</span>
            </label>
            {modoEsquema && (
              <Button variant="outline" size="sm" onClick={() => setImportOpen(true)} className="h-7 text-xs">
                <Upload size={12} className="mr-1" /> Importar esquema desde Excel
              </Button>
            )}
          </div>
        )}
      </div>

      {modoEsquema ? (
        <div className="space-y-3">
          <EsquemaPersonalTable eventoId={eventoId} evento={evento} rubroEvento={rubroEvento} turnos={turnos} />
          <div>
            <p className="text-[11px] font-medium text-muted-foreground mb-1">Otros ítems del pedido (cantidad / descripción)</p>
            <PedidoItemsTable eventoId={eventoId} rubroEvento={rubroEvento} items={otros} />
          </div>
        </div>
      ) : (
        <PedidoItemsTable eventoId={eventoId} rubroEvento={rubroEvento} />
      )}

      {importOpen && <ImportarEsquemaDialog eventoId={eventoId} rubroEvento={rubroEvento} onClose={() => setImportOpen(false)} />}
    </div>
  );
}

// ── Stock propio (fuentes mixtas) ─────────────────────────────────────────────

// Las fechas de negocio llegan del backend como medianoche UTC (ver
// formatDate en lib/formatters.ts) — subDays/addDays de date-fns operan sobre
// los componentes LOCALES del Date, así que hay que anclar el cálculo al día
// calendario (UTC) en vez de a new Date(iso), que en timezones negativas
// (ej. Argentina, UTC-3) representa el día anterior.
function shiftDateOnly(dateStr: string, dias: number, direction: 1 | -1): string {
  const [y, m, d] = dateStr.split('T')[0].split('-').map(Number);
  const anchor  = new Date(y, m - 1, d);
  const shifted = dias === 0 ? anchor : direction < 0 ? subDays(anchor, dias) : addDays(anchor, dias);
  const yyyy = shifted.getFullYear();
  const mm   = String(shifted.getMonth() + 1).padStart(2, '0');
  const dd   = String(shifted.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

interface AsignarStockForm {
  producto:      ProductoLite | null;
  cantidad:      number;
  fecha_salida:  string;
  fecha_retorno: string;
  notas:         string;
}

function AsignarStockDialog({ eventoId, evento, rubroEvento, onClose }: {
  eventoId:    number;
  evento:      Evento;
  rubroEvento: RubroEvento;
  onClose:     () => void;
}) {
  const defaultSalida  = evento.fecha_inicio ? shiftDateOnly(evento.fecha_inicio, evento.dias_montaje    ?? 0, -1) : '';
  const defaultRetorno = evento.fecha_fin    ? shiftDateOnly(evento.fecha_fin,    evento.dias_desmontaje ?? 0,  1) : '';

  const [form, setForm] = useState<AsignarStockForm>({
    producto: null, cantidad: 1, fecha_salida: defaultSalida, fecha_retorno: defaultRetorno, notas: '',
  });
  const [error,       setError]       = useState<string | null>(null);
  const [sugerencias, setSugerencias] = useState<SugerenciaStock[]>([]);

  const asignar = useAsignarStock(eventoId);

  const { data: disponibilidad } = useDisponibilidad({
    producto_id: form.producto?.id,
    fecha_desde: form.fecha_salida  || undefined,
    fecha_hasta: form.fecha_retorno || form.fecha_salida || undefined,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.producto) { setError('Seleccioná un producto'); return; }
    setError(null);
    setSugerencias([]);
    try {
      await asignar.mutateAsync({
        rubroEventoId: rubroEvento.id,
        data: {
          producto_id:   form.producto.id,
          cantidad:      form.cantidad,
          fecha_salida:  form.fecha_salida,
          fecha_retorno: form.fecha_retorno || null,
          notas:         form.notas || undefined,
        },
      });
      onClose();
    } catch (err: any) {
      setError(getApiErrorMessage(err));
      setSugerencias(err?.response?.data?.sugerencias ?? []);
    }
  };

  const inputFieldCls = 'w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring';
  const labelCls      = 'block text-xs font-medium text-muted-foreground mb-0.5';

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Asignar stock propio — {rubroEvento.rubro.nombre}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 mt-1">
          <div>
            <label className={labelCls}>Producto *</label>
            <ProductoCombobox value={form.producto} onChange={p => setForm(f => ({ ...f, producto: p }))} />
          </div>

          {disponibilidad && (
            <div className={cn(
              'rounded px-3 py-2 text-xs space-y-1',
              disponibilidad.disponible >= form.cantidad ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800',
            )}>
              <p>Disponible: <strong>{disponibilidad.disponible} unidades</strong></p>
              {disponibilidad.asignaciones_solapadas.map(a => (
                <p key={a.asignacion_id} className="flex items-center gap-1 text-yellow-700">
                  <AlertTriangle size={11} className="shrink-0" /> {a.cantidad} unidades comprometidas en {a.evento_nombre}
                </p>
              ))}
            </div>
          )}

          <div>
            <label className={labelCls}>Cantidad *</label>
            <input
              type="number" min={1} max={disponibilidad?.disponible} className={inputFieldCls}
              value={form.cantidad}
              onChange={e => setForm(f => ({ ...f, cantidad: Number(e.target.value) }))}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Fecha salida *</label>
              <input type="date" className={inputFieldCls} value={form.fecha_salida}
                onChange={e => setForm(f => ({ ...f, fecha_salida: e.target.value }))} required />
            </div>
            <div>
              <label className={labelCls}>Fecha retorno</label>
              <input type="date" className={inputFieldCls} value={form.fecha_retorno}
                onChange={e => setForm(f => ({ ...f, fecha_retorno: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Notas</label>
            <input className={inputFieldCls} value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} />
          </div>

          {error && (
            <div className="space-y-1.5">
              <p className="text-xs text-destructive">{error}</p>
              {sugerencias.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Fuentes alternativas:</p>
                  {sugerencias.slice(0, 3).map(s => (
                    <div key={s.asignacion_id} className="text-xs border rounded px-2 py-1 flex items-center gap-2">
                      <span className="font-medium">{s.evento_origen_nombre}</span>
                      <span className="text-muted-foreground">— {s.cantidad_disponible} u.</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={asignar.isPending}>
              {asignar.isPending ? 'Asignando…' : 'Asignar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function StockPropioSection({ eventoId, evento, rubroEvento }: {
  eventoId:    number;
  evento:      Evento;
  rubroEvento: RubroEvento;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const desasignar = useDesasignarStock(eventoId);

  const activas = rubroEvento.asignaciones_stock.filter(a => a.estado === 'ACTIVA');
  const total   = activas.reduce((sum, a) => sum + a.cantidad, 0);

  const handleDelete = (a: RubroEventoAsignacionStock) => {
    // ubicacion !== DEPOSITO ⇒ ya se firmó la salida — advertencia más fuerte,
    // cancelar no revierte el movimiento físico, sólo libera el registro.
    const yaSalio = a.ubicacion !== 'DEPOSITO';
    const msg = yaSalio
      ? `Esta asignación ya salió del depósito (${UBICACION_LABEL[a.ubicacion]}). Cancelarla no revierte el movimiento físico — ¿cancelar igual?`
      : `¿Cancelar la asignación de "${a.producto_nombre}"?`;
    if (!window.confirm(msg)) return;
    desasignar.mutate({ rubroEventoId: rubroEvento.id, asignacionId: a.id });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
          <Warehouse size={12} /> Stock propio
        </p>
        <Button variant="ghost" size="sm" onClick={() => setDialogOpen(true)} className="h-6 text-xs text-muted-foreground hover:text-foreground">
          <Plus size={12} className="mr-1" /> Asignar desde stock
        </Button>
      </div>

      {activas.length > 0 ? (
        <div className="overflow-x-auto">
          <BaseTable className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-border bg-gray-50 text-muted-foreground text-[11px] font-medium">
                <th className="px-2 py-1.5 text-left">Producto</th>
                <th className="px-2 py-1.5 text-right w-16">Cant.</th>
                <th className="px-2 py-1.5 text-left w-24">F. salida</th>
                <th className="px-2 py-1.5 text-left w-28">Ubicación</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {activas.map(a => (
                <tr key={a.id}>
                  <td className="px-2 py-1.5">{a.producto_nombre ?? `#${a.producto_id}`}</td>
                  <td className="px-2 py-1.5 text-right">{a.cantidad}</td>
                  <td className="px-2 py-1.5">{format(new Date(a.fecha_salida), 'dd/MM/yy', { locale: es })}</td>
                  <td className="px-2 py-1.5"><UbicacionBadge ubicacion={a.ubicacion} /></td>
                  <td className="w-8 px-1">
                    <button
                      onClick={() => handleDelete(a)}
                      className="p-1 rounded text-destructive hover:bg-destructive/10 transition"
                      title="Cancelar asignación"
                    >
                      <Trash2 size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </BaseTable>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Sin stock propio asignado a este rubro.</p>
      )}

      {total > 0 && <p className="text-xs text-muted-foreground text-right">Total propio: {total} u.</p>}

      {dialogOpen && (
        <AsignarStockDialog
          eventoId={eventoId}
          evento={evento}
          rubroEvento={rubroEvento}
          onClose={() => setDialogOpen(false)}
        />
      )}
    </div>
  );
}

// ── Panel de detalle expandible (stock propio + pedido técnico) ──────────────

function RubroDetallePanel({ eventoId, evento, rubroEvento, colSpan }: {
  eventoId:    number;
  evento:      Evento;
  rubroEvento: RubroEvento;
  colSpan:     number;
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="bg-muted/10 px-4 py-3 space-y-4">
        <StockPropioSection eventoId={eventoId} evento={evento} rubroEvento={rubroEvento} />

        {rubroEvento.estado === 'CONFIRMADO' ? (
          <PedidoTecnicoSection eventoId={eventoId} evento={evento} rubroEvento={rubroEvento} />
        ) : (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Pedido técnico — {rubroEvento.rubro.nombre}
            </p>
            <p className="text-xs text-muted-foreground">Confirmá el proveedor externo para cargar el pedido técnico.</p>
          </div>
        )}
      </td>
    </tr>
  );
}

// ── Fila de rubro ─────────────────────────────────────────────────────────────

function RubroEventoRow({ eventoId, evento, re, expanded, onToggleExpand }: {
  eventoId: number;
  evento:   Evento;
  re:       RubroEvento;
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  const updateRe = useUpdateRubroEvento(eventoId);

  const [contactoNombre, setContactoNombre]     = useState(re.contacto_nombre ?? '');
  const [contactoTelefono, setContactoTelefono] = useState(re.contacto_telefono ?? '');
  const [coordina, setCoordina]                 = useState(re.coordina_nombre ?? '');
  const [presupuesto, setPresupuesto]           = useState(re.presupuesto !== null ? String(re.presupuesto) : '');

  useEffect(() => {
    setContactoNombre(re.contacto_nombre ?? '');
    setContactoTelefono(re.contacto_telefono ?? '');
    setCoordina(re.coordina_nombre ?? '');
    setPresupuesto(re.presupuesto !== null ? String(re.presupuesto) : '');
  }, [re]);

  const handleProveedorChange = (v: ProveedorBusqueda | null) => {
    const data: Record<string, unknown> = { proveedor_id: v?.id ?? null };
    // Pre-cargar contacto solo si todavía no hay uno cargado a mano
    if (v && !re.contacto_nombre)   data.contacto_nombre   = v.nombre;
    if (v && !re.contacto_telefono && v.telefono) data.contacto_telefono = v.telefono;
    updateRe.mutate({ id: re.id, data });
  };

  const handleEstadoChange = (estado: EstadoRubroEvento) => {
    updateRe.mutate({ id: re.id, data: { estado } });
  };

  const saveField = (field: string, value: string | number | null) => {
    updateRe.mutate({ id: re.id, data: { [field]: value } });
  };

  const noVa = re.estado === 'NO_VA';
  const cell = 'px-2 py-1.5 text-sm align-top';
  const puedeVerDetalle = puedeExpandir(re.estado);
  const totalDetalle = re.pedido_items.length + re.asignaciones_stock.filter(a => a.estado === 'ACTIVA').length;

  return (
    <>
      <tr className={cn('border-b border-border hover:bg-muted/10', noVa && 'opacity-50')}>
        <td className={cn(cell, 'w-10 text-center text-muted-foreground')}>{re.rubro.orden}</td>
        <td className={cn(cell, 'font-medium', noVa && 'line-through')}>
          {re.rubro.nombre}
          {re.usa_stock_propio && <Warehouse size={11} className="inline-block ml-1.5 text-muted-foreground align-text-top" />}
        </td>
        <td className={cn(cell, 'w-40')}>
          <ProveedorCombobox value={re.proveedor} onChange={handleProveedorChange} />
        </td>
        <td className={cn(cell, 'w-32')}>
          <select
            value={re.estado}
            onChange={e => handleEstadoChange(e.target.value as EstadoRubroEvento)}
            className={cn('w-full rounded-full px-2 py-0.5 text-xs font-medium border-none focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer', ESTADO_SELECT_CLASS[re.estado])}
          >
            {ESTADOS.map(e => <option key={e} value={e}>{ESTADO_LABEL[e]}</option>)}
          </select>
        </td>
        <td className={cn(cell, 'w-36')}>
          <input value={contactoNombre} onChange={e => setContactoNombre(e.target.value)} onBlur={() => saveField('contacto_nombre', contactoNombre || null)} placeholder="Nombre" className={inputCls} />
          <input value={contactoTelefono} onChange={e => setContactoTelefono(e.target.value)} onBlur={() => saveField('contacto_telefono', contactoTelefono || null)} placeholder="Teléfono" className={cn(inputCls, 'mt-0.5')} />
        </td>
        <td className={cn(cell, 'w-28')}>
          <input value={coordina} onChange={e => setCoordina(e.target.value)} onBlur={() => saveField('coordina_nombre', coordina || null)} placeholder="Quién coordina" className={inputCls} />
        </td>
        <td className={cn(cell, 'w-28')}>
          <input
            type="date"
            value={re.fecha_ingreso ? re.fecha_ingreso.slice(0, 10) : ''}
            onChange={e => saveField('fecha_ingreso', e.target.value || null)}
            className={inputCls}
          />
        </td>
        <td className={cn(cell, 'w-28 text-right')}>
          <input
            value={presupuesto}
            onChange={e => setPresupuesto(e.target.value)}
            onBlur={() => saveField('presupuesto', presupuesto !== '' ? parseMoney(presupuesto) : null)}
            type="text" inputMode="decimal"
            className={cn(inputCls, 'text-right')}
          />
        </td>
        <td className={cn(cell, 'w-24 text-right')}>
          {puedeVerDetalle ? (
            <Button variant="ghost" size="sm" onClick={onToggleExpand} className="h-7 text-xs">
              {expanded ? <ChevronDown size={13} className="mr-1" /> : <ChevronRight size={13} className="mr-1" />}
              Detalle
              {totalDetalle > 0 && <span className="ml-1 text-muted-foreground">({totalDetalle})</span>}
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </td>
      </tr>
      {expanded && puedeVerDetalle && (
        <RubroDetallePanel eventoId={eventoId} evento={evento} rubroEvento={re} colSpan={9} />
      )}
    </>
  );
}

// ── Vista móvil (cards) ────────────────────────────────────────────────────────

function RubroEventoCard({ eventoId, evento, re, expanded, onToggleExpand }: {
  eventoId: number;
  evento:   Evento;
  re:       RubroEvento;
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  const updateRe = useUpdateRubroEvento(eventoId);
  const noVa = re.estado === 'NO_VA';

  return (
    <div className={cn('rounded-lg border border-border bg-white overflow-hidden', noVa && 'opacity-50')}>
      <button onClick={onToggleExpand} className="w-full flex items-center justify-between px-3 py-2.5 text-left">
        <div className="min-w-0">
          <p className={cn('text-sm font-medium truncate', noVa && 'line-through')}>{re.rubro.nombre}</p>
          <p className="text-xs text-muted-foreground truncate">{re.proveedor?.nombre ?? 'Sin proveedor'}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant={re.estado === 'CONFIRMADO' ? 'success' : re.estado === 'COTIZANDO' ? 'warning' : re.estado === 'PENDIENTE' ? 'muted' : 'destructive'}>
            {ESTADO_LABEL[re.estado]}
          </Badge>
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </div>
      </button>
      {expanded && (
        <div className="border-t border-border px-3 py-3 space-y-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-0.5">Proveedor</label>
            <ProveedorCombobox
              value={re.proveedor}
              onChange={v => updateRe.mutate({ id: re.id, data: { proveedor_id: v?.id ?? null } })}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-0.5">Estado</label>
            <select
              value={re.estado}
              onChange={e => updateRe.mutate({ id: re.id, data: { estado: e.target.value as EstadoRubroEvento } })}
              className="w-full border rounded px-2 py-1.5 text-sm"
            >
              {ESTADOS.map(e => <option key={e} value={e}>{ESTADO_LABEL[e]}</option>)}
            </select>
          </div>
          {puedeExpandir(re.estado) ? (
            <>
              <StockPropioSection eventoId={eventoId} evento={evento} rubroEvento={re} />
              {re.estado === 'CONFIRMADO' ? (
                <PedidoTecnicoSection eventoId={eventoId} evento={evento} rubroEvento={re} />
              ) : (
                <p className="text-xs text-muted-foreground">Confirmá el proveedor externo para cargar el pedido técnico.</p>
              )}
            </>
          ) : (
            <p className="text-xs text-muted-foreground">Este rubro no admite pedido ni stock propio en su estado actual.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Importar desde Excel (rubro por evento.xlsx) ─────────────────────────────

type ImportStep = 'archivo' | 'hoja' | 'preview' | 'success';

function ImportarExcelDialog({ eventoId, onClose }: { eventoId: number; onClose: () => void }) {
  const [step, setStep]   = useState<ImportStep>('archivo');
  const [file, setFile]   = useState<File | null>(null);
  const [hojas, setHojas] = useState<{ nombre_hoja: string; evento_nombre_excel: string | null }[]>([]);
  const [hoja, setHoja]   = useState('');
  const [preview, setPreview]   = useState<FichaImportResultado | null>(null);
  const [resultado, setResultado] = useState<FichaImportResultado | null>(null);
  const [error, setError] = useState<string | null>(null);

  const listarHojas = useListarHojasFichaImport();
  const importar     = useImportarFicha(eventoId);

  const handleFile = async (f: File) => {
    setFile(f);
    setError(null);
    try {
      const lista = await listarHojas.mutateAsync({ eventoId, file: f });
      if (lista.length === 0) { setError('No se encontró ninguna hoja de evento en el archivo (se espera "EVENTO" en la celda A3).'); return; }
      setHojas(lista);
      setHoja(lista[0].nombre_hoja);
      setStep('hoja');
    } catch (err: any) {
      setError(getApiErrorMessage(err));
    }
  };

  const handleVerPreview = async () => {
    if (!file || !hoja) return;
    setError(null);
    try {
      const r = await importar.mutateAsync({ file, hoja, preview: true });
      setPreview(r);
      setStep('preview');
    } catch (err: any) {
      setError(getApiErrorMessage(err));
    }
  };

  const handleConfirmar = async () => {
    if (!file || !hoja) return;
    setError(null);
    try {
      const r = await importar.mutateAsync({ file, hoja, preview: false });
      setResultado(r);
      setStep('success');
    } catch (err: any) {
      setError(getApiErrorMessage(err));
    }
  };

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Importar Ficha de Evento desde Excel</DialogTitle></DialogHeader>

        {step === 'archivo' && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Subí el archivo "rubro por evento.xlsx" con las hojas por evento.
            </p>
            <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-lg py-10 cursor-pointer hover:bg-accent/30 transition">
              <Upload size={22} className="text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {listarHojas.isPending ? 'Leyendo archivo…' : 'Hacé clic para elegir el archivo .xlsx'}
              </span>
              <input
                type="file" accept=".xlsx" className="hidden" disabled={listarHojas.isPending}
                onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
            </label>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        )}

        {step === 'hoja' && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Archivo: <span className="font-medium">{file?.name}</span></p>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Hoja del evento</label>
              <select value={hoja} onChange={e => setHoja(e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm">
                {hojas.map(h => (
                  <option key={h.nombre_hoja} value={h.nombre_hoja}>
                    {h.nombre_hoja}{h.evento_nombre_excel && h.evento_nombre_excel !== h.nombre_hoja ? ` (${h.evento_nombre_excel})` : ''}
                  </option>
                ))}
              </select>
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => setStep('archivo')}>Atrás</Button>
              <Button size="sm" onClick={handleVerPreview} disabled={importar.isPending}>
                {importar.isPending ? 'Analizando…' : 'Ver preview'}
              </Button>
            </div>
          </div>
        )}

        {step === 'preview' && preview && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-4 text-sm">
              <span><span className="font-semibold text-green-700">{preview.confirmados}</span> confirmados</span>
              <span><span className="font-semibold text-red-700">{preview.no_van}</span> no van</span>
              <span><span className="font-semibold">{preview.creados}</span> a crear</span>
              <span><span className="font-semibold">{preview.actualizados}</span> a actualizar</span>
            </div>
            {preview.rubros_no_encontrados.length > 0 && (
              <div className="text-xs bg-yellow-50 text-yellow-800 rounded px-3 py-2">
                <p className="font-medium mb-1 flex items-center gap-1"><AlertTriangle size={12} /> Rubros del Excel sin match en el catálogo (se omiten):</p>
                <p>{preview.rubros_no_encontrados.join(', ')}</p>
              </div>
            )}
            <div className="max-h-72 overflow-y-auto">
              <BaseTable className="w-full text-xs border-collapse">
                <thead className="sticky top-0 bg-gray-50">
                  <tr className="border-b border-border text-muted-foreground font-medium">
                    <th className="px-2 py-1.5 text-left">Servicio</th>
                    <th className="px-2 py-1.5 text-left">Estado</th>
                    <th className="px-2 py-1.5 text-left">Proveedor (Excel)</th>
                    <th className="px-2 py-1.5 text-left">Responsable</th>
                    <th className="px-2 py-1.5 text-left">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {preview.filas.map(f => (
                    <tr key={f.fila_excel} className={cn(f.accion === 'SIN_RUBRO' && 'opacity-50')}>
                      <td className="px-2 py-1">{f.servicio}</td>
                      <td className="px-2 py-1">
                        <Badge variant={f.corresponde ? 'success' : 'muted'}>{f.corresponde ? 'Confirmado' : 'No va'}</Badge>
                      </td>
                      <td className="px-2 py-1">
                        {f.proveedor_nombre_excel ?? '—'}
                        {f.proveedor_nombre_excel && !f.proveedor_id && <span className="text-yellow-700"> (sin match)</span>}
                      </td>
                      <td className="px-2 py-1">{f.responsable ?? '—'}</td>
                      <td className="px-2 py-1">{f.accion === 'SIN_RUBRO' ? 'Rubro no encontrado' : f.accion === 'CREAR' ? 'Crear' : 'Actualizar'}</td>
                    </tr>
                  ))}
                </tbody>
              </BaseTable>
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => setStep('hoja')}>Atrás</Button>
              <Button size="sm" onClick={handleConfirmar} disabled={importar.isPending}>
                {importar.isPending ? 'Importando…' : 'Confirmar importación'}
              </Button>
            </div>
          </div>
        )}

        {step === 'success' && resultado && (
          <div className="space-y-3">
            <p className="text-sm">
              Importación completa: <span className="font-semibold text-green-700">{resultado.creados}</span> creados,{' '}
              <span className="font-semibold">{resultado.actualizados}</span> actualizados,{' '}
              <span className="font-semibold text-green-700">{resultado.confirmados}</span> confirmados,{' '}
              <span className="font-semibold text-red-700">{resultado.no_van}</span> no van.
            </p>
            {resultado.rubros_no_encontrados.length > 0 && (
              <p className="text-xs text-yellow-800 bg-yellow-50 rounded px-3 py-2">
                Sin match en el catálogo: {resultado.rubros_no_encontrados.join(', ')}
              </p>
            )}
            <div className="flex justify-end pt-1">
              <Button size="sm" onClick={onClose}>Cerrar</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function FichaEventoPage({ eventoId, evento, initialBusqueda }: {
  eventoId: number; evento: Evento; canEdit?: boolean; monedaBase?: Moneda; initialBusqueda?: string;
}) {
  const { data: fichaData = [], isLoading } = useFichaEvento(eventoId);
  const inicializar = useInicializarFicha(eventoId);
  const { exportar, isExporting } = useExportarFicha();

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [filtroEstado, setFiltroEstado] = useState<EstadoRubroEvento | ''>('');
  const [busqueda, setBusqueda] = useState(initialBusqueda ?? '');
  const [importarOpen, setImportarOpen] = useState(false);

  const contadores = useMemo(() => ({
    confirmados: fichaData.filter(r => r.estado === 'CONFIRMADO').length,
    pendientes:  fichaData.filter(r => r.estado === 'PENDIENTE').length,
    noVan:       fichaData.filter(r => r.estado === 'NO_VA').length,
  }), [fichaData]);

  const filtrados = useMemo(() => {
    return fichaData.filter(r => {
      if (filtroEstado && r.estado !== filtroEstado) return false;
      if (busqueda) {
        const term = busqueda.toLowerCase();
        const matchRubro     = r.rubro.nombre.toLowerCase().includes(term);
        const matchProveedor = r.proveedor?.nombre.toLowerCase().includes(term) ?? false;
        if (!matchRubro && !matchProveedor) return false;
      }
      return true;
    });
  }, [fichaData, filtroEstado, busqueda]);

  const toggleExpand = (id: number) => setExpandedId(p => p === id ? null : id);

  if (isLoading) {
    return <p className="p-4 text-sm text-muted-foreground">Cargando...</p>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-lg font-semibold">Ficha de Evento</h2>
        <div className="flex items-center gap-2">
          {fichaData.length === 0 && (
            <Button size="sm" onClick={() => inicializar.mutate()} disabled={inicializar.isPending}>
              {inicializar.isPending
                ? <Loader2 size={13} className="mr-1.5 animate-spin" />
                : <Sparkles size={13} className="mr-1.5" />}
              Inicializar ficha
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => exportar(eventoId)} disabled={isExporting || fichaData.length === 0}>
            {isExporting ? <Loader2 size={13} className="mr-1.5 animate-spin" /> : <FileSpreadsheet size={13} className="mr-1.5" />}
            Exportar Excel
          </Button>
          <Button variant="outline" size="sm" onClick={() => setImportarOpen(true)}>
            <Upload size={13} className="mr-1.5" />
            Importar desde Excel
          </Button>
        </div>
      </div>

      {importarOpen && <ImportarExcelDialog eventoId={eventoId} onClose={() => setImportarOpen(false)} />}

      {fichaData.length === 0 ? (
        <p className="text-sm text-muted-foreground py-10 text-center">
          Todavía no hay rubros cargados en la ficha de este evento. Hacé clic en "Inicializar ficha" para cargar los rubros configurados.
        </p>
      ) : (
        <>
          {/* Contador */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span><span className="font-semibold text-green-700">{contadores.confirmados}</span> confirmados</span>
            <span><span className="font-semibold text-gray-700">{contadores.pendientes}</span> pendientes</span>
            <span><span className="font-semibold text-red-700">{contadores.noVan}</span> no van</span>
          </div>

          {/* Filtros */}
          <div className="flex flex-wrap gap-2">
            <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value as EstadoRubroEvento | '')} className="border rounded px-2 py-1.5 text-sm">
              <option value="">Todos los estados</option>
              {ESTADOS.map(e => <option key={e} value={e}>{ESTADO_LABEL[e]}</option>)}
            </select>
            <input
              placeholder="Buscar por rubro o proveedor..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              className="border rounded px-2 py-1.5 text-sm w-64"
            />
          </div>

          {/* Tabla — desktop */}
          <div className="hidden md:block overflow-x-auto">
            <BaseTable className="w-full border-collapse">
              <thead>
                <tr className="border-b border-border bg-gray-50 text-muted-foreground text-xs font-medium">
                  <th className="px-2 py-2 text-center w-10">#</th>
                  <th className="px-2 py-2 text-left">Rubro</th>
                  <th className="px-2 py-2 text-left w-40">Proveedor</th>
                  <th className="px-2 py-2 text-left w-32">Estado</th>
                  <th className="px-2 py-2 text-left w-36">Contacto</th>
                  <th className="px-2 py-2 text-left w-28">Coordina</th>
                  <th className="px-2 py-2 text-left w-28">F. ingreso</th>
                  <th className="px-2 py-2 text-right w-28">Presupuesto</th>
                  <th className="px-2 py-2 text-right w-24">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map(re => (
                  <RubroEventoRow
                    key={re.id}
                    eventoId={eventoId}
                    evento={evento}
                    re={re}
                    expanded={expandedId === re.id}
                    onToggleExpand={() => toggleExpand(re.id)}
                  />
                ))}
                {filtrados.length === 0 && (
                  <tr><td colSpan={9} className="py-8 text-center text-sm text-muted-foreground">Ningún rubro coincide con el filtro.</td></tr>
                )}
              </tbody>
            </BaseTable>
          </div>

          {/* Cards — mobile */}
          <div className="md:hidden space-y-2">
            {filtrados.map(re => (
              <RubroEventoCard
                key={re.id}
                eventoId={eventoId}
                evento={evento}
                re={re}
                expanded={expandedId === re.id}
                onToggleExpand={() => toggleExpand(re.id)}
              />
            ))}
            {filtrados.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">Ningún rubro coincide con el filtro.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
