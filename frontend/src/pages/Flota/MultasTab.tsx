import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Receipt } from 'lucide-react';
import {
  useMultas, useResumenMultas, useOpcionesMultas, useCreateMulta, useUpdateMulta, useDeleteMulta,
  type MultaFiltros, type MultaPayload,
} from '@/hooks/useMultas';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Combobox } from '@/components/ui/combobox';
import MoneyInput from '@/components/ui/MoneyInput';
import BaseTable from '@/components/ui/BaseTable';
import VencimientoBadge from '@/components/flota/VencimientoBadge';
import TabStrip from '@/components/ui/TabStrip';
import { cn, getApiErrorMessage } from '@/lib/utils';
import { formatCurrency, formatDate, formatearPatente } from '@/lib/formatters';
import type { Multa, TipoMulta, EstadoMulta } from '@/types';

const inputCls = 'w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring';
const labelCls = 'block text-xs font-medium text-muted-foreground mb-0.5';
const selectCls = 'border border-input rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring bg-white';

// Multas de tránsito e internas (Lorena). Reemplaza su planilla por patente:
// fecha, lugar, motivo, vencimiento, monto, pago, medio de pago y si se le
// descontó al empleado. Descontar crea un vale MULTA que entra solo en la
// próxima liquidación de sueldos.

const TIPO_LABEL: Record<TipoMulta, string> = { TRANSITO: 'Tránsito', INTERNA: 'Interna' };
const ESTADO_LABEL: Record<EstadoMulta, string> = { PENDIENTE: 'Pendiente de pago', PAGADA: 'Pagada', ANULADA: 'Anulada' };
const ESTADO_CLASS: Record<EstadoMulta, string> = {
  PENDIENTE: 'bg-yellow-100 text-yellow-800', PAGADA: 'bg-green-100 text-green-800', ANULADA: 'bg-gray-100 text-gray-500 line-through',
};

interface FormMulta {
  tipo: TipoMulta; fecha: string; camion_id: number | null; patente_texto: string;
  empleado_id: number | null; empleado_nombre_manual: string; lugar: string; motivo: string; numero_acta: string;
  fecha_vencimiento: string; monto: string; estado: EstadoMulta; fecha_pago: string; medio_pago: string;
  descontar_empleado: boolean; observaciones: string;
}

function formDesde(m: Multa | null): FormMulta {
  return {
    tipo: m?.tipo ?? 'TRANSITO', fecha: m?.fecha.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    camion_id: m?.camion_id ?? null, patente_texto: m?.patente_texto ? formatearPatente(m.patente_texto) : '',
    empleado_id: m?.empleado_id ?? null, empleado_nombre_manual: m?.empleado_nombre_manual ?? '',
    lugar: m?.lugar ?? '', motivo: m?.motivo ?? '', numero_acta: m?.numero_acta ?? '',
    fecha_vencimiento: m?.fecha_vencimiento?.slice(0, 10) ?? '', monto: m ? String(m.monto) : '',
    estado: m?.estado ?? 'PENDIENTE', fecha_pago: m?.fecha_pago?.slice(0, 10) ?? '', medio_pago: m?.medio_pago ?? '',
    descontar_empleado: m?.descontar_empleado ?? false, observaciones: m?.observaciones ?? '',
  };
}

function MultaDialog({ open, multa, onClose }: { open: boolean; multa: Multa | null; onClose: () => void }) {
  const { data: opciones } = useOpcionesMultas(open);
  const crear = useCreateMulta();
  const actualizar = useUpdateMulta();
  const [form, setForm] = useState<FormMulta>(formDesde(null));
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof FormMulta>(k: K, v: FormMulta[K]) => setForm(p => ({ ...p, [k]: v }));

  useEffect(() => { if (open) { setForm(formDesde(multa)); setError(null); } }, [open, multa]);

  const vehiculoOptions = (opciones?.vehiculos ?? []).map(v => ({ value: String(v.id), label: `${v.codigo}${v.patente ? ` · ${formatearPatente(v.patente)}` : ''}${v.descripcion ? ` — ${v.descripcion}` : ''}` }));
  const empleadoOptions = (opciones?.empleados ?? []).map(e => ({ value: String(e.id), label: `${e.apellido}, ${e.nombre}${e.apodo ? ` (${e.apodo})` : ''}` }));
  const yaDescontada = !!multa?.descontada;

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const payload: MultaPayload = {
      tipo: form.tipo, fecha: form.fecha, camion_id: form.camion_id, patente_texto: form.camion_id ? null : (form.patente_texto || null),
      empleado_id: form.empleado_id, empleado_nombre_manual: form.empleado_id ? null : (form.empleado_nombre_manual || null),
      lugar: form.lugar || null, motivo: form.motivo, numero_acta: form.numero_acta || null,
      fecha_vencimiento: form.fecha_vencimiento || null, monto: Number(form.monto || 0),
      estado: form.estado, fecha_pago: form.fecha_pago || null, medio_pago: form.medio_pago || null,
      descontar_empleado: form.descontar_empleado, observaciones: form.observaciones || null,
    };
    try {
      if (multa) await actualizar.mutateAsync({ id: multa.id, ...payload });
      else await crear.mutateAsync(payload);
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  const pending = crear.isPending || actualizar.isPending;

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{multa ? 'Editar multa' : 'Nueva multa'}</DialogTitle></DialogHeader>
        <form onSubmit={guardar} className="space-y-3 mt-1">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Tipo</label>
              <select value={form.tipo} onChange={e => set('tipo', e.target.value as TipoMulta)} className={cn(selectCls, 'w-full')}>
                <option value="TRANSITO">De tránsito</option>
                <option value="INTERNA">Interna (ej. vehículo sucio)</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Fecha *</label>
              <input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} className={inputCls} required />
            </div>
            <div>
              <label className={labelCls}>N° de acta</label>
              <input value={form.numero_acta} onChange={e => set('numero_acta', e.target.value)} className={inputCls} />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Vehículo</label>
              <Combobox options={vehiculoOptions} value={form.camion_id ? String(form.camion_id) : null}
                onChange={v => set('camion_id', v ? Number(v) : null)} placeholder="Buscar vehículo…" className="w-full sm:w-full" />
            </div>
            <div>
              <label className={labelCls}>…o patente libre</label>
              <input value={form.patente_texto} disabled={!!form.camion_id} onChange={e => set('patente_texto', e.target.value)}
                onBlur={e => set('patente_texto', formatearPatente(e.target.value))} className={inputCls} />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Empleado</label>
              <Combobox options={empleadoOptions} value={form.empleado_id ? String(form.empleado_id) : null}
                onChange={v => set('empleado_id', v ? Number(v) : null)} placeholder="Buscar empleado…" className="w-full sm:w-full" />
            </div>
            <div>
              <label className={labelCls}>…o nombre libre</label>
              <input value={form.empleado_nombre_manual} disabled={!!form.empleado_id} onChange={e => set('empleado_nombre_manual', e.target.value)} className={inputCls} />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Motivo *</label>
              <input value={form.motivo} onChange={e => set('motivo', e.target.value)} className={inputCls} required placeholder="Exceso de velocidad, estacionamiento, camioneta sucia…" />
            </div>
            <div>
              <label className={labelCls}>Lugar</label>
              <input value={form.lugar} onChange={e => set('lugar', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Monto *</label>
              <MoneyInput value={form.monto} onChange={v => set('monto', v)} className={inputCls} required disabled={yaDescontada} />
            </div>
            <div>
              <label className={labelCls}>Vence el pago</label>
              <input type="date" value={form.fecha_vencimiento} onChange={e => set('fecha_vencimiento', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Estado</label>
              <select value={form.estado} onChange={e => set('estado', e.target.value as EstadoMulta)} className={cn(selectCls, 'w-full')}>
                {(['PENDIENTE', 'PAGADA', 'ANULADA'] as const).map(s => <option key={s} value={s}>{ESTADO_LABEL[s]}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Fecha de pago</label>
              <input type="date" value={form.fecha_pago} onChange={e => { set('fecha_pago', e.target.value); if (e.target.value && form.estado === 'PENDIENTE') set('estado', 'PAGADA'); }} className={inputCls} />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Medio de pago</label>
              <input value={form.medio_pago} onChange={e => set('medio_pago', e.target.value)} className={inputCls} placeholder="Transferencia, tarjeta corporativa, efectivo…" />
            </div>
          </div>

          <label className={cn('flex items-start gap-2 text-sm rounded border px-3 py-2', form.descontar_empleado ? 'bg-amber-50 border-amber-200' : 'bg-muted/20')}>
            <input type="checkbox" className="mt-0.5" checked={form.descontar_empleado} disabled={yaDescontada}
              onChange={e => set('descontar_empleado', e.target.checked)} />
            <span>
              Descontarla al empleado
              <span className="block text-xs text-muted-foreground">
                {yaDescontada
                  ? 'Ya se descontó en una liquidación: no se puede cambiar el monto, el empleado ni el descuento.'
                  : 'Se carga como vale tipo MULTA y entra solo en la próxima liquidación de sueldos.'}
              </span>
            </span>
          </label>

          <div>
            <label className={labelCls}>Observaciones</label>
            <input value={form.observaciones} onChange={e => set('observaciones', e.target.value)} className={inputCls} />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={pending}>{pending ? 'Guardando…' : 'Guardar'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ResumenMultasView({ filtros }: { filtros: MultaFiltros }) {
  const { data, isLoading } = useResumenMultas(filtros);
  if (isLoading || !data) return <p className="text-sm text-muted-foreground">Cargando...</p>;
  return (
    <div className="space-y-4">
      <p className="text-sm">
        <span className="font-medium">{data.total.cantidad}</span> multa{data.total.cantidad !== 1 ? 's' : ''} en el período ·{' '}
        <span className="font-medium">{formatCurrency(data.total.monto)}</span> (sin anuladas)
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold mb-1.5">Por empleado</h3>
          <BaseTable className="w-full text-sm">
            <thead className="border-b bg-muted/30">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Empleado</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Multas</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Total</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">A descontar</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.por_empleado.map(e => (
                <tr key={`${e.empleado_id}-${e.nombre}`}>
                  <td className="px-3 py-1.5" data-label="Empleado">{e.nombre}</td>
                  <td className="px-3 py-1.5 text-right" data-label="Multas">{e.cantidad}</td>
                  <td className="px-3 py-1.5 text-right" data-label="Total">{formatCurrency(e.monto_total)}</td>
                  <td className="px-3 py-1.5 text-right" data-label="A descontar">{e.monto_descontado ? formatCurrency(e.monto_descontado) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </BaseTable>
        </div>
        <div>
          <h3 className="text-sm font-semibold mb-1.5">Por vehículo</h3>
          <BaseTable className="w-full text-sm">
            <thead className="border-b bg-muted/30">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Vehículo</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Multas</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Total</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Sin pagar</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.por_vehiculo.length === 0 ? (
                <tr><td colSpan={4} className="px-3 py-4 text-center text-xs text-muted-foreground">Sin multas con vehículo.</td></tr>
              ) : data.por_vehiculo.map(v => (
                <tr key={`${v.camion_id}-${v.vehiculo}`}>
                  <td className="px-3 py-1.5" data-label="Vehículo">{v.vehiculo}</td>
                  <td className="px-3 py-1.5 text-right" data-label="Multas">{v.cantidad}</td>
                  <td className="px-3 py-1.5 text-right" data-label="Total">{formatCurrency(v.monto_total)}</td>
                  <td className="px-3 py-1.5 text-right" data-label="Sin pagar">{v.pendientes_pago || '—'}</td>
                </tr>
              ))}
            </tbody>
          </BaseTable>
        </div>
      </div>
    </div>
  );
}

export default function MultasTab({ canEdit }: { canEdit: boolean }) {
  const [vista, setVista] = useState<'lista' | 'informe'>('lista');
  const [filtros, setFiltros] = useState<MultaFiltros>({});
  const { data: multas = [], isLoading } = useMultas(filtros);
  const borrar = useDeleteMulta();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Multa | null>(null);

  const eliminar = (m: Multa) => {
    if (!window.confirm(`¿Eliminar la multa "${m.motivo}"?`)) return;
    borrar.mutate(m.id, { onError: err => alert(getApiErrorMessage(err)) });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <input type="date" value={filtros.desde ?? ''} onChange={e => setFiltros(f => ({ ...f, desde: e.target.value || undefined }))} className="border border-input rounded px-2 py-1.5 text-sm" title="Desde" />
          <span className="text-muted-foreground">a</span>
          <input type="date" value={filtros.hasta ?? ''} onChange={e => setFiltros(f => ({ ...f, hasta: e.target.value || undefined }))} className="border border-input rounded px-2 py-1.5 text-sm" title="Hasta" />
          <select value={filtros.tipo ?? ''} onChange={e => setFiltros(f => ({ ...f, tipo: (e.target.value as TipoMulta) || undefined }))} className={selectCls}>
            <option value="">Tránsito e internas</option>
            <option value="TRANSITO">Tránsito</option>
            <option value="INTERNA">Internas</option>
          </select>
          {vista === 'lista' && (
            <select value={filtros.estado ?? ''} onChange={e => setFiltros(f => ({ ...f, estado: (e.target.value as EstadoMulta) || undefined }))} className={selectCls}>
              <option value="">Todos los estados</option>
              {(['PENDIENTE', 'PAGADA', 'ANULADA'] as const).map(s => <option key={s} value={s}>{ESTADO_LABEL[s]}</option>)}
            </select>
          )}
        </div>
        {canEdit && (
          <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Plus size={14} className="mr-1.5" /> Nueva multa
          </Button>
        )}
      </div>

      <TabStrip<'lista' | 'informe'> value={vista} onChange={setVista} variant="pill"
        items={[{ key: 'lista', label: 'Multas' }, { key: 'informe', label: 'Informe por empleado / vehículo' }]} />

      {vista === 'informe' ? <ResumenMultasView filtros={{ desde: filtros.desde, hasta: filtros.hasta, tipo: filtros.tipo }} /> : isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : multas.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Receipt size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No hay multas cargadas.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <BaseTable className="w-full text-sm min-w-[900px]">
            <thead className="border-b bg-muted/30">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Fecha</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Tipo</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Vehículo</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Empleado</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Motivo / lugar</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Monto</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Pago</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Descuento</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {multas.map(m => (
                <tr key={m.id} className="hover:bg-muted/20">
                  <td className="px-3 py-2 whitespace-nowrap" data-label="Fecha">{formatDate(m.fecha)}</td>
                  <td className="px-3 py-2 text-muted-foreground" data-label="Tipo">{TIPO_LABEL[m.tipo]}</td>
                  <td className="px-3 py-2 font-mono" data-label="Vehículo">{m.camion?.codigo ?? (m.patente_texto ? formatearPatente(m.patente_texto) : '—')}</td>
                  <td className="px-3 py-2" data-label="Empleado">{m.empleado ? `${m.empleado.apellido}, ${m.empleado.nombre}` : (m.empleado_nombre_manual ?? '—')}</td>
                  <td className="px-3 py-2" data-label="Motivo">{m.motivo}{m.lugar && <span className="block text-xs text-muted-foreground">{m.lugar}</span>}</td>
                  <td className="px-3 py-2 text-right font-medium whitespace-nowrap" data-label="Monto">{formatCurrency(m.monto)}</td>
                  <td className="px-3 py-2" data-label="Pago">
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap', ESTADO_CLASS[m.estado])}>{ESTADO_LABEL[m.estado]}</span>
                    {m.estado === 'PENDIENTE' && m.fecha_vencimiento && <span className="block mt-0.5"><VencimientoBadge estado={m.estado_vencimiento} fecha={m.fecha_vencimiento} /></span>}
                    {m.estado === 'PAGADA' && (m.fecha_pago || m.medio_pago) && <span className="block text-[11px] text-muted-foreground">{[m.fecha_pago && formatDate(m.fecha_pago), m.medio_pago].filter(Boolean).join(' · ')}</span>}
                  </td>
                  <td className="px-3 py-2 text-xs" data-label="Descuento">
                    {!m.descontar_empleado ? <span className="text-muted-foreground">No</span>
                      : m.descontada ? <span className="text-green-700 font-medium">Descontada</span>
                      : <span className="text-amber-700 font-medium">En la próxima liquidación</span>}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    {canEdit && (
                      <>
                        <Button variant="ghost" size="icon" onClick={() => { setEditing(m); setDialogOpen(true); }} title="Editar"><Pencil size={14} /></Button>
                        {!m.descontada && <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => eliminar(m)} title="Eliminar"><Trash2 size={14} /></Button>}
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </BaseTable>
        </div>
      )}

      <MultaDialog open={dialogOpen} multa={editing} onClose={() => { setDialogOpen(false); setEditing(null); }} />
    </div>
  );
}
