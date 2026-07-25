import React, { useState, useCallback } from 'react';
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
import { GripVertical, Trash2, Plus, Check, X, FileCheck } from 'lucide-react';
import {
  useMovimientos, useCreateMovimiento, useUpdateMovimiento,
  useDeleteMovimiento, useReordenarMovimiento,
} from '@/hooks/useMovimientos';
import { useCuentas } from '@/hooks/useCuentas';
import { useUsuarios } from '@/hooks/useUsuarios';
import ProveedorCombobox from './ProveedorCombobox';
import { SaldoCell } from './SaldoCell';
import { EcheqEstadoBadge, MOVIMIENTO_LABEL } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { Echeq, Movimiento, Rubro, Moneda, ProveedorBusqueda, EstadoMovimiento } from '@/types';

// ── Constants ─────────────────────────────────────────────────────────────────

const SUBCATEGORIAS = [
  'PAYWAY', 'REBA', 'AUTOENTRADA', 'IVA', 'IIBB', 'MUNICIPALIDAD', 'GANANCIAS',
] as const;

const ESTADO_ORDEN: EstadoMovimiento[] = ['PENDIENTE', 'COTIZANDO', 'CONFIRMADO', 'PAGADO'];

function estadoOptions(actual: EstadoMovimiento): EstadoMovimiento[] {
  if (actual === 'PAGADO')     return ['PAGADO', 'CANCELADO'];
  if (actual === 'CANCELADO')  return ['CANCELADO', ...ESTADO_ORDEN];
  const idx = ESTADO_ORDEN.indexOf(actual);
  return [...ESTADO_ORDEN.slice(idx), 'CANCELADO'];
}

// Badge de color por estado — mismo mapeo que MovimientoEstadoBadge, aplicado
// directamente al <select> para que la celda se vea como badge editable.
const ESTADO_SELECT_CLASS: Record<EstadoMovimiento, string> = {
  PENDIENTE:  'bg-gray-100 text-gray-700',
  COTIZANDO:  'bg-yellow-100 text-yellow-800',
  CONFIRMADO: 'bg-blue-100 text-blue-800',
  PAGADO:     'bg-green-100 text-green-800',
  CANCELADO:  'bg-red-100 text-red-700 line-through',
};

// ── Types ─────────────────────────────────────────────────────────────────────

type EditableField = 'fecha' | 'concepto' | 'descripcion' | 'debe' | 'haber' | 'impuesto_subcategoria' | 'presupuesto' | 'fecha_pago';
interface EditCell  { id: number; field: EditableField; value: string; }

interface NewRowData {
  fecha:                 string;
  concepto:              string;
  descripcion:           string;
  monto:                 string;   // va a HABER para EGRESO, a DEBE para INGRESO
  moneda:                Moneda;
  impuesto_subcategoria: string;
  impacta_caja:          boolean;
  cuenta_id:             string;
  proveedor:             ProveedorBusqueda | null;
  presupuesto:           string;
  responsable_id:        string;
  fecha_pago:            string;
  avisado_proveedor:     boolean;
}

const EMPTY_ROW: NewRowData = {
  fecha: '', concepto: '', descripcion: '', monto: '',
  moneda: 'ARS', impuesto_subcategoria: '', impacta_caja: false, cuenta_id: '', proveedor: null,
  presupuesto: '', responsable_id: '', fecha_pago: '', avisado_proveedor: false,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getCellValue(mov: Movimiento, field: EditableField): string {
  switch (field) {
    case 'fecha':                 return mov.fecha ? mov.fecha.split('T')[0] : '';
    case 'concepto':              return mov.concepto              ?? '';
    case 'descripcion':           return mov.descripcion           ?? '';
    case 'debe':                  return String(Number(mov.debe));
    case 'haber':                 return String(Number(mov.haber));
    case 'impuesto_subcategoria': return mov.impuesto_subcategoria ?? '';
    case 'presupuesto':           return mov.presupuesto !== null ? String(mov.presupuesto) : '';
    case 'fecha_pago':            return mov.fecha_pago ? mov.fecha_pago.split('T')[0] : '';
  }
}

function buildUpdatePayload(field: EditableField, value: string) {
  switch (field) {
    case 'fecha':                 return { fecha:                 value || null };
    case 'concepto':              return { concepto:              value || null };
    case 'descripcion':           return { descripcion:           value || null };
    case 'debe':                  return { debe:                  parseFloat(value) || 0 };
    case 'haber':                 return { haber:                 parseFloat(value) || 0 };
    case 'impuesto_subcategoria': return { impuesto_subcategoria: value || null };
    case 'presupuesto':           return { presupuesto:           value ? parseFloat(value) : null };
    case 'fecha_pago':            return { fecha_pago:            value || null };
  }
}

// ── EditableCell ──────────────────────────────────────────────────────────────

function EditableCell({
  value, display, type, editing, className, inputClassName,
  onClick, onChange, onBlur, onKeyDown,
}: {
  value:          string;
  display:        React.ReactNode;
  type:           'text' | 'number' | 'date';
  editing:        boolean;
  className?:     string;
  inputClassName?: string;
  onClick:        () => void;
  onChange:       (v: string) => void;
  onBlur:         () => void;
  onKeyDown:      (e: React.KeyboardEvent<HTMLInputElement>) => void;
}) {
  if (editing) {
    return (
      <td className={className}>
        <input
          autoFocus
          type={type}
          value={value}
          step={type === 'number' ? '0.01' : undefined}
          min={type === 'number' ? '0' : undefined}
          onChange={e => onChange(e.target.value)}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
          className={cn(
            'w-full border border-ring rounded px-1 py-0.5 text-sm',
            'focus:outline-none focus:ring-1 focus:ring-ring',
            inputClassName,
          )}
        />
      </td>
    );
  }
  return (
    <td className={cn(className, 'select-none cursor-pointer')} onClick={onClick}>
      {display}
    </td>
  );
}

// ── SortableRow ───────────────────────────────────────────────────────────────

function SortableRow({
  mov, isEgImp, isEgExtra, editCell, onCellClick, onCellChange, onCellSave, onKeyDown, onDelete,
  onCreateEcheq, echeqForRow, onNavigateToEcheqs, onProveedorChange, onEstadoChange, onResponsableChange,
  onAvisadoChange, usuarios,
}: {
  mov:                  Movimiento;
  isEgImp:              boolean;
  isEgExtra:            boolean;
  editCell:             EditCell | null;
  onCellClick:          (id: number, field: EditableField, value: string) => void;
  onCellChange:         (v: string) => void;
  onCellSave:           () => void;
  onKeyDown:            (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onDelete:             (id: number) => void;
  onCreateEcheq?:       (movimientoId: number) => void;
  echeqForRow?:         Echeq;
  onNavigateToEcheqs?:  () => void;
  onProveedorChange:    (id: number, v: ProveedorBusqueda | null) => void;
  onEstadoChange:       (id: number, estado: EstadoMovimiento) => void;
  onResponsableChange:  (id: number, responsableId: number | null) => void;
  onAvisadoChange:      (id: number, avisado: boolean) => void;
  usuarios:             { id: number; nombre: string }[];
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: mov.id });

  const style = { transform: CSS.Transform.toString(transform), transition };
  const active = (f: EditableField) => editCell?.id === mov.id && editCell?.field === f;

  const cell = 'px-2 py-1.5 text-sm';
  const cancelado = mov.estado_movimiento === 'CANCELADO';
  const pagado    = mov.estado_movimiento === 'PAGADO';

  // debe/haber: el monto real puede estar en cualquiera de los dos campos según
  // el origen de la fila (alta manual vs. import histórico) — sumar ambos es
  // robusto porque en la práctica solo uno es distinto de cero por movimiento.
  const real = Number(mov.debe) + Number(mov.haber);
  const diferencia = mov.presupuesto !== null ? parseFloat((mov.presupuesto - real).toFixed(2)) : null;

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={cn(
        'group border-b border-border',
        isDragging && 'opacity-50 bg-accent/50',
        cancelado && 'line-through opacity-50',
        pagado && !cancelado && 'bg-green-50/60',
      )}
    >
      {/* Drag handle */}
      <td className="w-6 px-1 py-1.5 text-center">
        <button
          {...attributes}
          {...listeners}
          tabIndex={-1}
          className="cursor-grab text-muted-foreground opacity-0 group-hover:opacity-60 transition-opacity"
        >
          <GripVertical size={14} />
        </button>
      </td>

      {/* Fecha */}
      <EditableCell
        value={active('fecha') ? editCell!.value : getCellValue(mov, 'fecha')}
        display={<span className={mov.fecha ? '' : 'text-muted-foreground/40'}>{formatDate(mov.fecha)}</span>}
        type="date"
        editing={active('fecha')}
        className={cn(cell, 'w-28')}
        onClick={() => onCellClick(mov.id, 'fecha', getCellValue(mov, 'fecha'))}
        onChange={onCellChange}
        onBlur={onCellSave}
        onKeyDown={onKeyDown}
      />

      {/* Concepto */}
      <EditableCell
        value={active('concepto') ? editCell!.value : getCellValue(mov, 'concepto')}
        display={<span className={mov.concepto ? '' : 'text-muted-foreground/40'}>{mov.concepto || '—'}</span>}
        type="text"
        editing={active('concepto')}
        className={cell}
        onClick={() => onCellClick(mov.id, 'concepto', getCellValue(mov, 'concepto'))}
        onChange={onCellChange}
        onBlur={onCellSave}
        onKeyDown={onKeyDown}
      />

      {/* Descripción */}
      <EditableCell
        value={active('descripcion') ? editCell!.value : getCellValue(mov, 'descripcion')}
        display={<span className={mov.descripcion ? '' : 'text-muted-foreground/40'}>{mov.descripcion || '—'}</span>}
        type="text"
        editing={active('descripcion')}
        className={cell}
        onClick={() => onCellClick(mov.id, 'descripcion', getCellValue(mov, 'descripcion'))}
        onChange={onCellChange}
        onBlur={onCellSave}
        onKeyDown={onKeyDown}
      />

      {/* Proveedor */}
      <td className={cn(cell, 'w-32')}>
        <ProveedorCombobox
          value={mov.proveedor ?? null}
          onChange={v => onProveedorChange(mov.id, v)}
        />
      </td>

      {/* Subcategoría — rubro Impuestos únicamente */}
      {isEgImp && (
        <td
          className={cn(cell, 'w-36 cursor-pointer')}
          onClick={() => !active('impuesto_subcategoria') &&
            onCellClick(mov.id, 'impuesto_subcategoria', getCellValue(mov, 'impuesto_subcategoria'))}
        >
          {active('impuesto_subcategoria') ? (
            <select
              autoFocus
              value={editCell!.value}
              onChange={e => onCellChange(e.target.value)}
              onBlur={onCellSave}
              onKeyDown={onKeyDown as any}
              className="w-full border border-ring rounded px-1 py-0.5 text-xs focus:outline-none"
            >
              <option value="">—</option>
              {SUBCATEGORIAS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          ) : (
            <span className={mov.impuesto_subcategoria ? '' : 'text-muted-foreground/40'}>
              {mov.impuesto_subcategoria || '—'}
            </span>
          )}
        </td>
      )}

      {/* Estado */}
      <td className={cn(cell, 'w-32')}>
        <select
          value={mov.estado_movimiento}
          onChange={e => onEstadoChange(mov.id, e.target.value as EstadoMovimiento)}
          className={cn(
            'rounded-full px-2.5 py-0.5 text-xs font-medium border-none focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer',
            ESTADO_SELECT_CLASS[mov.estado_movimiento],
          )}
        >
          {estadoOptions(mov.estado_movimiento).map(e => (
            <option key={e} value={e}>{MOVIMIENTO_LABEL[e]}</option>
          ))}
        </select>
      </td>

      {/* Presupuesto */}
      <EditableCell
        value={active('presupuesto') ? editCell!.value : getCellValue(mov, 'presupuesto')}
        display={<span className="tabular-nums">{mov.presupuesto !== null ? formatCurrency(mov.presupuesto, mov.moneda) : <span className="text-muted-foreground/40">—</span>}</span>}
        type="number"
        editing={active('presupuesto')}
        className={cn(cell, 'w-28 text-right')}
        inputClassName="text-right"
        onClick={() => onCellClick(mov.id, 'presupuesto', getCellValue(mov, 'presupuesto'))}
        onChange={onCellChange}
        onBlur={onCellSave}
        onKeyDown={onKeyDown}
      />

      {/* Real */}
      <td className={cn(cell, 'w-28 text-right tabular-nums text-muted-foreground')}>
        {formatCurrency(real, mov.moneda)}
      </td>

      {/* Diferencia */}
      <td className={cn(cell, 'w-28 text-right tabular-nums')}>
        {diferencia === null ? (
          <span className="text-muted-foreground/40">—</span>
        ) : (
          <span className={cn('font-medium', real > (mov.presupuesto ?? 0) ? 'text-destructive' : real < (mov.presupuesto ?? 0) ? 'text-green-600' : '')}>
            {formatCurrency(diferencia, mov.moneda)}
          </span>
        )}
      </td>

      {/* Debe */}
      <EditableCell
        value={active('debe') ? editCell!.value : getCellValue(mov, 'debe')}
        display={<span className="tabular-nums">{formatCurrency(Number(mov.debe), mov.moneda)}</span>}
        type="number"
        editing={active('debe')}
        className={cn(cell, 'w-28 text-right')}
        inputClassName="text-right"
        onClick={() => onCellClick(mov.id, 'debe', getCellValue(mov, 'debe'))}
        onChange={onCellChange}
        onBlur={onCellSave}
        onKeyDown={onKeyDown}
      />

      {/* Haber */}
      <EditableCell
        value={active('haber') ? editCell!.value : getCellValue(mov, 'haber')}
        display={<span className="tabular-nums">{formatCurrency(Number(mov.haber), mov.moneda)}</span>}
        type="number"
        editing={active('haber')}
        className={cn(cell, 'w-28 text-right')}
        inputClassName="text-right"
        onClick={() => onCellClick(mov.id, 'haber', getCellValue(mov, 'haber'))}
        onChange={onCellChange}
        onBlur={onCellSave}
        onKeyDown={onKeyDown}
      />

      {/* Saldo — read only */}
      <td className="px-2 py-1.5 w-32 text-right">
        <SaldoCell saldo={mov.saldo} moneda={mov.moneda} />
      </td>

      {/* Responsable */}
      <td className={cn(cell, 'w-36')}>
        <select
          value={mov.responsable_id ?? ''}
          onChange={e => onResponsableChange(mov.id, e.target.value ? Number(e.target.value) : null)}
          className="w-full border-none bg-transparent text-xs focus:outline-none cursor-pointer"
        >
          <option value="">— Sin asignar</option>
          {usuarios.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
        </select>
      </td>

      {/* Fecha pago */}
      <EditableCell
        value={active('fecha_pago') ? editCell!.value : getCellValue(mov, 'fecha_pago')}
        display={<span className={mov.fecha_pago ? '' : 'text-muted-foreground/40'}>{formatDate(mov.fecha_pago)}</span>}
        type="date"
        editing={active('fecha_pago')}
        className={cn(cell, 'w-28')}
        onClick={() => onCellClick(mov.id, 'fecha_pago', getCellValue(mov, 'fecha_pago'))}
        onChange={onCellChange}
        onBlur={onCellSave}
        onKeyDown={onKeyDown}
      />

      {/* ¿Avisado? */}
      <td className={cn(cell, 'w-14 text-center')}>
        <input
          type="checkbox"
          checked={mov.avisado_proveedor}
          onChange={e => onAvisadoChange(mov.id, e.target.checked)}
          title="¿Proveedor avisado?"
        />
      </td>

      {/* Actions */}
      <td className="px-1 w-20">
        <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition">
          {isEgExtra && (
            echeqForRow ? (
              <button
                tabIndex={-1}
                onClick={onNavigateToEcheqs}
                title="Ver echeq"
                className="p-0.5 rounded transition"
              >
                <EcheqEstadoBadge estado={echeqForRow.estado} />
              </button>
            ) : onCreateEcheq ? (
              <button
                tabIndex={-1}
                onClick={() => onCreateEcheq(mov.id)}
                title="Crear echeq"
                className="p-1 rounded text-primary hover:bg-primary/10 transition"
              >
                <FileCheck size={14} />
              </button>
            ) : null
          )}
          <button
            tabIndex={-1}
            onClick={() => onDelete(mov.id)}
            title="Eliminar"
            className="p-1 rounded text-destructive hover:bg-destructive/10 transition"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── MovimientoTable ───────────────────────────────────────────────────────────

interface Props {
  eventoId:            number;
  rubro:               Rubro;
  monedaBase?:         Moneda;
  onCreateEcheq?:      (movimientoId: number) => void;
  echeqs?:             Echeq[];
  onNavigateToEcheqs?: () => void;
}

export default function MovimientoTable({ eventoId, rubro, monedaBase = 'ARS', onCreateEcheq, echeqs, onNavigateToEcheqs }: Props) {
  const isEgImp   = rubro.codigo === 'EG-IMP';
  const isEgExtra = rubro.codigo === 'EG-EXTRA';

  const { data: movimientos = [], isLoading } = useMovimientos(eventoId, rubro.id);
  const { data: cuentas     = [] }            = useCuentas(eventoId);
  const { data: usuarios    = [] }            = useUsuarios();

  const createMov    = useCreateMovimiento(eventoId, rubro.id);
  const updateMov    = useUpdateMovimiento(eventoId, rubro.id);
  const deleteMov    = useDeleteMovimiento(eventoId, rubro.id);
  const reordenarMov = useReordenarMovimiento(eventoId, rubro.id);

  const [editCell,    setEditCell]    = useState<EditCell | null>(null);
  const [newRow,      setNewRow]      = useState(false);
  const [newRowData,  setNewRowData]  = useState<NewRowData>(EMPTY_ROW);
  const [newRowError, setNewRowError] = useState<string | null>(null);

  // DnD
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const newIndex = movimientos.findIndex(m => m.id === Number(over.id));
    reordenarMov.mutate({ id: Number(active.id), orden: newIndex + 1 });
  }, [movimientos, reordenarMov]);

  // Cell editing
  const handleCellClick = useCallback((id: number, field: EditableField, value: string) => {
    if (editCell?.id === id && editCell?.field === field) return;
    setEditCell({ id, field, value });
  }, [editCell]);

  const handleCellSave = useCallback(() => {
    if (!editCell) return;
    const mov = movimientos.find(m => m.id === editCell.id);
    if (!mov) { setEditCell(null); return; }
    if (editCell.value !== getCellValue(mov, editCell.field)) {
      updateMov.mutate({ id: editCell.id, data: buildUpdatePayload(editCell.field, editCell.value) });
    }
    setEditCell(null);
  }, [editCell, movimientos, updateMov]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter')  handleCellSave();
    if (e.key === 'Escape') setEditCell(null);
  }, [handleCellSave]);

  const handleDelete = useCallback((id: number) => {
    if (!window.confirm('¿Eliminar este movimiento?')) return;
    deleteMov.mutate(id);
  }, [deleteMov]);

  const handleProveedorChange = useCallback((id: number, v: ProveedorBusqueda | null) => {
    updateMov.mutate({ id, data: { proveedor_id: v?.id ?? null } });
  }, [updateMov]);

  const handleEstadoChange = useCallback((id: number, estado: EstadoMovimiento) => {
    updateMov.mutate({ id, data: { estado_movimiento: estado } }, {
      onError: (err: any) => alert(err?.response?.data?.error ?? 'No se pudo cambiar el estado'),
    });
  }, [updateMov]);

  const handleResponsableChange = useCallback((id: number, responsableId: number | null) => {
    updateMov.mutate({ id, data: { responsable_id: responsableId } });
  }, [updateMov]);

  const handleAvisadoChange = useCallback((id: number, avisado: boolean) => {
    updateMov.mutate({ id, data: { avisado_proveedor: avisado } });
  }, [updateMov]);

  // New row
  const openNewRow = () => {
    setNewRowData({ ...EMPTY_ROW, moneda: monedaBase });
    setNewRowError(null);
    setNewRow(true);
  };

  const handleNewRowSave = async () => {
    setNewRowError(null);
    if (isEgImp && !newRowData.impuesto_subcategoria) {
      setNewRowError('Subcategoría obligatoria para el rubro de Impuestos');
      return;
    }
    if (newRowData.impacta_caja && !newRowData.cuenta_id) {
      setNewRowError('Seleccioná una cuenta bancaria');
      return;
    }
    try {
      await createMov.mutateAsync({
        rubro_id:              rubro.id,
        fecha:                 newRowData.fecha      || null,
        concepto:              newRowData.concepto   || null,
        descripcion:           newRowData.descripcion || null,
        // EGRESO → haber (resta al saldo); INGRESO → debe (suma al saldo)
        debe:                  rubro.tipo === 'INGRESO' ? (parseFloat(newRowData.monto) || 0) : 0,
        haber:                 rubro.tipo === 'EGRESO'  ? (parseFloat(newRowData.monto) || 0) : 0,
        moneda:                newRowData.moneda,
        impuesto_subcategoria: isEgImp ? (newRowData.impuesto_subcategoria || null) : null,
        presupuesto:           newRowData.presupuesto ? parseFloat(newRowData.presupuesto) : null,
        fecha_pago:            newRowData.fecha_pago || null,
        avisado_proveedor:     newRowData.avisado_proveedor,
        ...(newRowData.responsable_id && { responsable_id: Number(newRowData.responsable_id) }),
        ...(newRowData.proveedor && { proveedor_id: newRowData.proveedor.id }),
        ...(newRowData.impacta_caja && newRowData.cuenta_id && {
          impacta_caja: true,
          cuenta_id:    Number(newRowData.cuenta_id),
        }),
      });
      setNewRow(false);
      setNewRowData(EMPTY_ROW);
    } catch (err: any) {
      setNewRowError(err?.response?.data?.error ?? 'Error al guardar');
    }
  };

  const handleNewRowCancel = () => {
    setNewRow(false);
    setNewRowData(EMPTY_ROW);
    setNewRowError(null);
  };

  const colCount = 16 + (isEgImp ? 1 : 0);

  if (isLoading) {
    return <p className="p-4 text-sm text-muted-foreground">Cargando...</p>;
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={movimientos.map(m => m.id)} strategy={verticalListSortingStrategy}>
        <div className="overflow-x-auto border border-border rounded-lg">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border bg-gray-50 text-muted-foreground text-xs font-medium">
                <th className="w-6" />
                <th className="px-2 py-2 text-left w-28">Fecha</th>
                <th className="px-2 py-2 text-left">Concepto</th>
                <th className="px-2 py-2 text-left">Descripción</th>
                <th className="px-2 py-2 text-left w-32">Proveedor</th>
                {isEgImp && <th className="px-2 py-2 text-left w-36">Subcategoría</th>}
                <th className="px-2 py-2 text-left w-32">Estado</th>
                <th className="px-2 py-2 text-right w-28">Presupuesto</th>
                <th className="px-2 py-2 text-right w-28">Real</th>
                <th className="px-2 py-2 text-right w-28">Diferencia</th>
                <th className="px-2 py-2 text-right w-28">Debe</th>
                <th className="px-2 py-2 text-right w-28">Haber</th>
                <th className="px-2 py-2 text-right w-32">Saldo</th>
                <th className="px-2 py-2 text-left w-36">Responsable</th>
                <th className="px-2 py-2 text-left w-28">Fecha pago</th>
                <th className="px-2 py-2 text-center w-14">¿Avisado?</th>
                <th className="w-16" />
              </tr>
            </thead>
            <tbody>
              {movimientos.map(mov => (
                <SortableRow
                  key={mov.id}
                  mov={mov}
                  isEgImp={isEgImp}
                  isEgExtra={isEgExtra}
                  editCell={editCell}
                  onCellClick={handleCellClick}
                  onCellChange={v => setEditCell(prev => prev ? { ...prev, value: v } : null)}
                  onCellSave={handleCellSave}
                  onKeyDown={handleKeyDown}
                  onDelete={handleDelete}
                  onProveedorChange={handleProveedorChange}
                  onEstadoChange={handleEstadoChange}
                  onResponsableChange={handleResponsableChange}
                  onAvisadoChange={handleAvisadoChange}
                  usuarios={usuarios}
                  onCreateEcheq={onCreateEcheq}
                  echeqForRow={echeqs?.find(e => e.movimiento_id === mov.id)}
                  onNavigateToEcheqs={onNavigateToEcheqs}
                />
              ))}

              {/* New row inputs */}
              {newRow && (
                <>
                  <tr className="border-b border-ring/40 bg-accent/20">
                    <td />
                    <td className="px-2 py-1">
                      <input
                        type="date"
                        value={newRowData.fecha}
                        onChange={e => setNewRowData(p => ({ ...p, fecha: e.target.value }))}
                        className="w-full border rounded px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </td>
                    <td className="px-2 py-1">
                      <input
                        placeholder="Concepto"
                        value={newRowData.concepto}
                        onChange={e => setNewRowData(p => ({ ...p, concepto: e.target.value }))}
                        className="w-full border rounded px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </td>
                    <td className="px-2 py-1">
                      <input
                        placeholder="Descripción"
                        value={newRowData.descripcion}
                        onChange={e => setNewRowData(p => ({ ...p, descripcion: e.target.value }))}
                        className="w-full border rounded px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </td>
                    <td className="px-2 py-1">
                      <ProveedorCombobox
                        value={newRowData.proveedor}
                        onChange={v => setNewRowData(p => ({ ...p, proveedor: v }))}
                      />
                    </td>
                    {isEgImp && (
                      <td className="px-2 py-1">
                        <select
                          value={newRowData.impuesto_subcategoria}
                          onChange={e => setNewRowData(p => ({ ...p, impuesto_subcategoria: e.target.value }))}
                          className="w-full border rounded px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                        >
                          <option value="">— Subcategoría *</option>
                          {SUBCATEGORIAS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                    )}
                    {/* Estado */}
                    <td className="px-2 py-1 text-xs text-muted-foreground">Pendiente</td>
                    {/* Presupuesto */}
                    <td className="px-2 py-1">
                      <input
                        type="number" min="0" step="0.01" placeholder="0.00"
                        value={newRowData.presupuesto}
                        onChange={e => setNewRowData(p => ({ ...p, presupuesto: e.target.value }))}
                        className="w-full border rounded px-1 py-0.5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </td>
                    {/* Real (n/a hasta guardar) */}
                    <td className="px-2 py-1 text-right text-muted-foreground text-xs">—</td>
                    {/* Diferencia */}
                    <td className="px-2 py-1 text-right text-muted-foreground text-xs">—</td>
                    {/* DEBE: activo para INGRESO, vacío para EGRESO */}
                    <td className="px-2 py-1">
                      {rubro.tipo === 'INGRESO' ? (
                        <input
                          type="number" min="0" step="0.01" placeholder="0.00"
                          value={newRowData.monto}
                          onChange={e => setNewRowData(p => ({ ...p, monto: e.target.value }))}
                          className="w-full border rounded px-1 py-0.5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      ) : (
                        <span className="block text-xs text-right text-muted-foreground px-1">0.00</span>
                      )}
                    </td>
                    {/* HABER: activo para EGRESO, vacío para INGRESO */}
                    <td className="px-2 py-1">
                      {rubro.tipo === 'EGRESO' ? (
                        <input
                          type="number" min="0" step="0.01" placeholder="0.00"
                          value={newRowData.monto}
                          onChange={e => setNewRowData(p => ({ ...p, monto: e.target.value }))}
                          className="w-full border rounded px-1 py-0.5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      ) : (
                        <span className="block text-xs text-right text-muted-foreground px-1">0.00</span>
                      )}
                    </td>
                    <td className="px-2 py-1 text-right text-muted-foreground text-xs">—</td>
                    {/* Responsable */}
                    <td className="px-2 py-1">
                      <select
                        value={newRowData.responsable_id}
                        onChange={e => setNewRowData(p => ({ ...p, responsable_id: e.target.value }))}
                        className="w-full border rounded px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        <option value="">— Sin asignar</option>
                        {usuarios.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
                      </select>
                    </td>
                    {/* Fecha pago */}
                    <td className="px-2 py-1">
                      <input
                        type="date"
                        value={newRowData.fecha_pago}
                        onChange={e => setNewRowData(p => ({ ...p, fecha_pago: e.target.value }))}
                        className="w-full border rounded px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </td>
                    {/* Avisado */}
                    <td className="px-2 py-1 text-center">
                      <input
                        type="checkbox"
                        checked={newRowData.avisado_proveedor}
                        onChange={e => setNewRowData(p => ({ ...p, avisado_proveedor: e.target.checked }))}
                      />
                    </td>
                    <td className="px-1 py-1">
                      <div className="flex gap-0.5">
                        <button
                          onClick={handleNewRowSave}
                          disabled={createMov.isPending}
                          title="Guardar"
                          className="p-1 rounded text-green-600 hover:bg-green-50 transition disabled:opacity-50"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          onClick={handleNewRowCancel}
                          title="Cancelar"
                          className="p-1 rounded text-muted-foreground hover:bg-accent transition"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Extra options row: moneda + impacta_caja */}
                  <tr className="bg-accent/10 border-b border-dashed border-border">
                    <td colSpan={isEgImp ? 5 : 4} className="px-3 py-1.5">
                      <div className="flex flex-wrap items-center gap-4 text-xs">
                        <label className="flex items-center gap-1.5 text-muted-foreground">
                          Moneda:
                          <select
                            value={newRowData.moneda}
                            onChange={e => setNewRowData(p => ({ ...p, moneda: e.target.value as Moneda }))}
                            className="border rounded px-1 py-0.5 text-xs"
                          >
                            <option value="ARS">ARS</option>
                            <option value="USD">USD</option>
                          </select>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={newRowData.impacta_caja}
                            onChange={e => setNewRowData(p => ({
                              ...p, impacta_caja: e.target.checked, cuenta_id: '',
                            }))}
                          />
                          Impacta caja
                        </label>
                        {newRowData.impacta_caja && (
                          <select
                            value={newRowData.cuenta_id}
                            onChange={e => setNewRowData(p => ({ ...p, cuenta_id: e.target.value }))}
                            className="border rounded px-1 py-0.5 text-xs"
                          >
                            <option value="">— Seleccionar cuenta</option>
                            {cuentas.length === 0 && (
                              <option disabled>Sin cuentas configuradas</option>
                            )}
                            {cuentas.map(c => (
                              <option key={c.id} value={c.id}>
                                {c.nombre} ({c.moneda})
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </td>
                    <td colSpan={colCount - (isEgImp ? 5 : 4)} className="px-3 py-1.5">
                      {newRowError && (
                        <p className="text-xs text-destructive">{newRowError}</p>
                      )}
                    </td>
                  </tr>
                </>
              )}

              {/* Empty state */}
              {movimientos.length === 0 && !newRow && (
                <tr>
                  <td colSpan={colCount} className="py-10 text-center text-sm text-muted-foreground">
                    Sin movimientos. Hacé clic en "Agregar" para empezar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Add button */}
          {!newRow && (
            <div className="px-2 py-1.5 border-t border-border bg-gray-50/50">
              <Button
                variant="ghost"
                size="sm"
                onClick={openNewRow}
                className="h-7 text-xs text-muted-foreground hover:text-foreground"
              >
                <Plus size={13} className="mr-1" />
                Agregar movimiento
              </Button>
            </div>
          )}
        </div>
      </SortableContext>
    </DndContext>
  );
}
