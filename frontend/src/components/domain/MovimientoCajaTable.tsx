import React, { useState, useCallback } from 'react';
import { Trash2, Plus, Check, X } from 'lucide-react';
import {
  useMovimientosCaja, useCreateMovimientoCaja,
  useUpdateMovimientoCaja, useDeleteMovimientoCaja,
} from '@/hooks/useCaja';
import { SaldoCell } from './SaldoCell';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { MovimientoCaja, Moneda } from '@/types';

// ── Types ─────────────────────────────────────────────────────────────────────

type EditableField = 'fecha' | 'descripcion' | 'debe' | 'haber';
interface EditCell  { id: number; field: EditableField; value: string; }

interface NewRowData {
  fecha:       string;
  descripcion: string;
  debe:        string;
  haber:       string;
}

const EMPTY_ROW: NewRowData = { fecha: '', descripcion: '', debe: '', haber: '' };

// ── Helpers ───────────────────────────────────────────────────────────────────

function getCellValue(mov: MovimientoCaja, field: EditableField): string {
  switch (field) {
    case 'fecha':       return mov.fecha ? mov.fecha.split('T')[0] : '';
    case 'descripcion': return mov.descripcion ?? '';
    case 'debe':        return String(Number(mov.debe));
    case 'haber':       return String(Number(mov.haber));
  }
}

function buildUpdatePayload(field: EditableField, value: string) {
  switch (field) {
    case 'fecha':       return { fecha:       value || null };
    case 'descripcion': return { descripcion: value || null };
    case 'debe':        return { debe:        parseFloat(value) || 0 };
    case 'haber':       return { haber:       parseFloat(value) || 0 };
  }
}

// ── EditableCell ──────────────────────────────────────────────────────────────

function EditableCell({
  value, display, type, editing, className, inputClassName,
  onClick, onChange, onBlur, onKeyDown,
}: {
  value:           string;
  display:         React.ReactNode;
  type:            'text' | 'number' | 'date';
  editing:         boolean;
  className?:      string;
  inputClassName?: string;
  onClick:         () => void;
  onChange:        (v: string) => void;
  onBlur:          () => void;
  onKeyDown:       (e: React.KeyboardEvent<HTMLInputElement>) => void;
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

// ── Row ───────────────────────────────────────────────────────────────────────

function Row({
  mov, moneda, editCell, onCellClick, onCellChange, onCellSave, onKeyDown, onDelete,
}: {
  mov:          MovimientoCaja;
  moneda:       Moneda;
  editCell:     EditCell | null;
  onCellClick:  (id: number, field: EditableField, value: string) => void;
  onCellChange: (v: string) => void;
  onCellSave:   () => void;
  onKeyDown:    (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onDelete:     (id: number) => void;
}) {
  const active = (f: EditableField) => editCell?.id === mov.id && editCell?.field === f;
  const cell   = 'px-2 py-1.5 text-sm';

  return (
    <tr className="group border-b border-border">
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
      <EditableCell
        value={active('debe') ? editCell!.value : getCellValue(mov, 'debe')}
        display={<span className="tabular-nums">{formatCurrency(Number(mov.debe), moneda)}</span>}
        type="number"
        editing={active('debe')}
        className={cn(cell, 'w-28 text-right')}
        inputClassName="text-right"
        onClick={() => onCellClick(mov.id, 'debe', getCellValue(mov, 'debe'))}
        onChange={onCellChange}
        onBlur={onCellSave}
        onKeyDown={onKeyDown}
      />
      <EditableCell
        value={active('haber') ? editCell!.value : getCellValue(mov, 'haber')}
        display={<span className="tabular-nums">{formatCurrency(Number(mov.haber), moneda)}</span>}
        type="number"
        editing={active('haber')}
        className={cn(cell, 'w-28 text-right')}
        inputClassName="text-right"
        onClick={() => onCellClick(mov.id, 'haber', getCellValue(mov, 'haber'))}
        onChange={onCellChange}
        onBlur={onCellSave}
        onKeyDown={onKeyDown}
      />
      <td className="px-2 py-1.5 w-32 text-right">
        <SaldoCell saldo={mov.saldo_corriente} moneda={moneda} />
      </td>
      <td className="px-1 w-10">
        <button
          tabIndex={-1}
          onClick={() => onDelete(mov.id)}
          title="Eliminar"
          className="opacity-0 group-hover:opacity-100 p-1 rounded text-destructive hover:bg-destructive/10 transition"
        >
          <Trash2 size={14} />
        </button>
      </td>
    </tr>
  );
}

// ── MovimientoCajaTable ───────────────────────────────────────────────────────

interface Props {
  cuentaId: number;
  moneda:   Moneda;
}

export default function MovimientoCajaTable({ cuentaId, moneda }: Props) {
  const { data: movimientos = [], isLoading } = useMovimientosCaja(cuentaId);
  const createMov = useCreateMovimientoCaja(cuentaId);
  const updateMov = useUpdateMovimientoCaja(cuentaId);
  const deleteMov = useDeleteMovimientoCaja(cuentaId);

  const [editCell,    setEditCell]    = useState<EditCell | null>(null);
  const [newRow,      setNewRow]      = useState(false);
  const [newRowData,  setNewRowData]  = useState<NewRowData>(EMPTY_ROW);
  const [newRowError, setNewRowError] = useState<string | null>(null);

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
    if (!window.confirm('¿Eliminar este movimiento de caja?')) return;
    deleteMov.mutate(id);
  }, [deleteMov]);

  const openNewRow = () => {
    setNewRowData(EMPTY_ROW);
    setNewRowError(null);
    setNewRow(true);
  };

  const handleNewRowSave = async () => {
    setNewRowError(null);
    try {
      await createMov.mutateAsync({
        fecha:       newRowData.fecha       || null,
        descripcion: newRowData.descripcion || null,
        debe:        parseFloat(newRowData.debe)  || 0,
        haber:       parseFloat(newRowData.haber) || 0,
      });
      setNewRow(false);
      setNewRowData(EMPTY_ROW);
    } catch (err: any) {
      setNewRowError(err?.response?.data?.error ?? 'Error al guardar');
    }
  };

  if (isLoading) return <p className="p-4 text-sm text-muted-foreground">Cargando...</p>;

  return (
    <div className="overflow-x-auto border border-border rounded-lg">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-border bg-gray-50 text-muted-foreground text-xs font-medium">
            <th className="px-2 py-2 text-left w-28">Fecha</th>
            <th className="px-2 py-2 text-left">Descripción</th>
            <th className="px-2 py-2 text-right w-28">Debe</th>
            <th className="px-2 py-2 text-right w-28">Haber</th>
            <th className="px-2 py-2 text-right w-32">Saldo</th>
            <th className="w-10" />
          </tr>
        </thead>
        <tbody>
          {movimientos.map(mov => (
            <Row
              key={mov.id}
              mov={mov}
              moneda={moneda}
              editCell={editCell}
              onCellClick={handleCellClick}
              onCellChange={v => setEditCell(prev => prev ? { ...prev, value: v } : null)}
              onCellSave={handleCellSave}
              onKeyDown={handleKeyDown}
              onDelete={handleDelete}
            />
          ))}

          {newRow && (
            <tr className="border-b border-ring/40 bg-accent/20">
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
                  placeholder="Descripción"
                  value={newRowData.descripcion}
                  onChange={e => setNewRowData(p => ({ ...p, descripcion: e.target.value }))}
                  className="w-full border rounded px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </td>
              <td className="px-2 py-1">
                <input
                  type="number" min="0" step="0.01" placeholder="0.00"
                  value={newRowData.debe}
                  onChange={e => setNewRowData(p => ({ ...p, debe: e.target.value }))}
                  className="w-full border rounded px-1 py-0.5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </td>
              <td className="px-2 py-1">
                <input
                  type="number" min="0" step="0.01" placeholder="0.00"
                  value={newRowData.haber}
                  onChange={e => setNewRowData(p => ({ ...p, haber: e.target.value }))}
                  className="w-full border rounded px-1 py-0.5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </td>
              <td className="px-2 py-1 text-right text-muted-foreground text-xs">—</td>
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
                    onClick={() => { setNewRow(false); setNewRowData(EMPTY_ROW); setNewRowError(null); }}
                    title="Cancelar"
                    className="p-1 rounded text-muted-foreground hover:bg-accent transition"
                  >
                    <X size={14} />
                  </button>
                </div>
              </td>
            </tr>
          )}

          {newRowError && (
            <tr>
              <td colSpan={6} className="px-3 py-1 text-xs text-destructive bg-destructive/5">
                {newRowError}
              </td>
            </tr>
          )}

          {movimientos.length === 0 && !newRow && (
            <tr>
              <td colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                Sin movimientos. Hacé clic en "Agregar" para empezar.
              </td>
            </tr>
          )}
        </tbody>
      </table>

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
  );
}
