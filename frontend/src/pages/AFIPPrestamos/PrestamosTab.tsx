import { useEffect, useState } from 'react';
import { Plus, FileText, Pencil, Upload, Trash2, Download, Building2 } from 'lucide-react';
import {
  usePrestamos, usePrestamo, useCreatePrestamo, useUpdatePrestamo, usePagarCuotaPrestamo, useUpdateCuotaPrestamo,
  useSubirDocumentoPrestamo, useEliminarDocumentoPrestamo, documentoPrestamoUrl,
  type PrestamoFiltros, type PrestamoPayload, type CuotaPrestamoInput,
} from '@/hooks/useAfipPrestamos';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge, PrestamoEstadoBadge } from '@/components/ui/badge';
import MoneyInput from '@/components/ui/MoneyInput';
import { useAuth } from '@/hooks/useAuth';
import { getApiErrorMessage, cn } from '@/lib/utils';
import { formatDate, formatCurrency } from '@/lib/formatters';
import type { PrestamoBancario, CuotaPrestamo, Moneda } from '@/types';

const inputCls   = 'w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring';
const labelCls   = 'block text-xs font-medium text-muted-foreground mb-0.5';
const selectCls  = 'border border-input rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring bg-white';
const cellInput  = 'w-full border-0 bg-transparent px-1 py-0.5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-ring rounded';

function CardResumen({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-white px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold mt-0.5">{value}</p>
    </div>
  );
}

// ── Dialog: crear / editar préstamo ───────────────────────────────────────────

interface PrestamoFormData {
  entidad:             string;
  numero_operacion:    string;
  tipo:                string;
  fecha_otorgamiento:  string;
  capital_original:    string;
  moneda:              Moneda;
  tasa_nominal_anual:  string;
  tasa_efectiva_anual: string;
  cantidad_cuotas:     string;
  dia_debito:          string;
  notas:               string;
  estado:              string;
  empresa_id:          string;
}

const EMPTY_PRESTAMO: PrestamoFormData = {
  entidad: '', numero_operacion: '', tipo: '', fecha_otorgamiento: '', capital_original: '', moneda: 'ARS',
  tasa_nominal_anual: '', tasa_efectiva_anual: '', cantidad_cuotas: '', dia_debito: '', notas: '', estado: 'ACTIVO',
  empresa_id: '',
};

function PrestamoDialog({ open, prestamo, onClose }: { open: boolean; prestamo: PrestamoBancario | null; onClose: () => void }) {
  const isEdit = !!prestamo;
  const { user } = useAuth();
  // Sólo al crear: admin global (Matías) o usuarios con puede_ver_macro (ej.
  // Mayra) pueden elegir a qué empresa se carga el crédito sin desloguearse
  // y cambiar de sesión — ver FIX 1 del módulo AFIP/Créditos.
  const puedeElegirEmpresa = !isEdit && !!user && (user.puedeCambiarEmpresa || user.puedeVerMacro);
  const [form, setForm] = useState<PrestamoFormData>(EMPTY_PRESTAMO);
  const [cargarTabla, setCargarTabla] = useState(false);
  const [cuotasManuales, setCuotasManuales] = useState<CuotaPrestamoInput[]>([]);
  const [error, setError] = useState<string | null>(null);
  const createPrestamo = useCreatePrestamo();
  const updatePrestamo = useUpdatePrestamo(prestamo?.id ?? -1);

  useEffect(() => {
    setForm(prestamo ? {
      entidad: prestamo.entidad, numero_operacion: prestamo.numero_operacion ?? '', tipo: prestamo.tipo ?? '',
      fecha_otorgamiento: prestamo.fecha_otorgamiento.slice(0, 10), capital_original: String(prestamo.capital_original),
      moneda: prestamo.moneda, tasa_nominal_anual: prestamo.tasa_nominal_anual != null ? String(prestamo.tasa_nominal_anual) : '',
      tasa_efectiva_anual: prestamo.tasa_efectiva_anual != null ? String(prestamo.tasa_efectiva_anual) : '',
      cantidad_cuotas: String(prestamo.cantidad_cuotas), dia_debito: prestamo.dia_debito != null ? String(prestamo.dia_debito) : '',
      notas: prestamo.notas ?? '', estado: prestamo.estado, empresa_id: '',
    } : { ...EMPTY_PRESTAMO, empresa_id: user?.empresaId != null ? String(user.empresaId) : '' });
    setCargarTabla(false);
    setCuotasManuales([]);
    setError(null);
  }, [prestamo, open, user?.empresaId]);

  const generarFilasManuales = () => {
    const n = Number(form.cantidad_cuotas) || 0;
    if (n <= 0) { setError('Indicá primero la cantidad de cuotas'); return; }
    setCuotasManuales(Array.from({ length: n }, (_, i) => ({
      numero_cuota: i + 1, fecha_vencimiento: '', capital: null, interes: null, iva_interes: null, seguro: null, otros_impuestos: null, total_cuota: 0,
    })));
  };

  const updateFila = (idx: number, patch: Partial<CuotaPrestamoInput>) => {
    setCuotasManuales(rows => rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isEdit && cargarTabla) {
      const incompletas = cuotasManuales.some(c => !c.fecha_vencimiento || !c.total_cuota);
      if (incompletas) { setError('Completá fecha de vencimiento e importe total en todas las cuotas'); return; }
    }

    const payload: PrestamoPayload = {
      ...(puedeElegirEmpresa && form.empresa_id ? { empresa_id: Number(form.empresa_id) } : {}),
      entidad:             form.entidad,
      numero_operacion:    form.numero_operacion || null,
      tipo:                form.tipo || null,
      fecha_otorgamiento:  form.fecha_otorgamiento,
      capital_original:    Number(form.capital_original),
      moneda:              form.moneda,
      tasa_nominal_anual:  form.tasa_nominal_anual ? Number(form.tasa_nominal_anual) : null,
      tasa_efectiva_anual: form.tasa_efectiva_anual ? Number(form.tasa_efectiva_anual) : null,
      cantidad_cuotas:     Number(form.cantidad_cuotas),
      dia_debito:          form.dia_debito ? Number(form.dia_debito) : null,
      notas:               form.notas || null,
      ...(!isEdit && cargarTabla ? { cuotas: cuotasManuales } : {}),
    };

    try {
      if (isEdit) await updatePrestamo.mutateAsync({ ...payload, estado: form.estado });
      else        await createPrestamo.mutateAsync(payload);
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  const pending = createPrestamo.isPending || updatePrestamo.isPending;

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader><DialogTitle>{isEdit ? 'Editar crédito' : 'Nuevo crédito'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 mt-1 max-h-[75vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-3">
            {puedeElegirEmpresa && (
              <div className="col-span-2">
                <label className={labelCls}>Empresa</label>
                <select value={form.empresa_id} onChange={e => setForm(p => ({ ...p, empresa_id: e.target.value }))} className={selectCls + ' w-full'}>
                  {(user?.empresasDisponibles ?? []).map(e => (
                    <option key={e.id} value={e.id}>{e.nombre_corto ?? e.nombre}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className={labelCls}>Entidad *</label>
              <input value={form.entidad} onChange={e => setForm(p => ({ ...p, entidad: e.target.value }))} className={inputCls} placeholder="Bancor, Galicia, Nación…" required />
            </div>
            <div>
              <label className={labelCls}>N° de operación</label>
              <input value={form.numero_operacion} onChange={e => setForm(p => ({ ...p, numero_operacion: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Tipo</label>
              <input value={form.tipo} onChange={e => setForm(p => ({ ...p, tipo: e.target.value }))} className={inputCls} placeholder="Personal, Hipotecario, Prendario…" />
            </div>
            <div>
              <label className={labelCls}>Fecha de otorgamiento *</label>
              <input type="date" value={form.fecha_otorgamiento} onChange={e => setForm(p => ({ ...p, fecha_otorgamiento: e.target.value }))} className={inputCls} required />
            </div>
            <div>
              <label className={labelCls}>Capital original *</label>
              <MoneyInput value={form.capital_original} onChange={v => setForm(p => ({ ...p, capital_original: v }))} className={inputCls} required />
            </div>
            <div>
              <label className={labelCls}>Moneda</label>
              <select value={form.moneda} onChange={e => setForm(p => ({ ...p, moneda: e.target.value as Moneda }))} className={selectCls + ' w-full'}>
                <option value="ARS">ARS</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>TNA (%)</label>
              <input type="number" step="0.01" value={form.tasa_nominal_anual} onChange={e => setForm(p => ({ ...p, tasa_nominal_anual: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>TEA (%)</label>
              <input type="number" step="0.01" value={form.tasa_efectiva_anual} onChange={e => setForm(p => ({ ...p, tasa_efectiva_anual: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Cantidad de cuotas *</label>
              <input type="number" min={1} value={form.cantidad_cuotas} onChange={e => setForm(p => ({ ...p, cantidad_cuotas: e.target.value }))} className={inputCls} required disabled={isEdit && cargarTabla} />
            </div>
            <div>
              <label className={labelCls}>Día de débito</label>
              <input type="number" min={1} max={31} value={form.dia_debito} onChange={e => setForm(p => ({ ...p, dia_debito: e.target.value }))} className={inputCls} />
            </div>
            {isEdit && (
              <div>
                <label className={labelCls}>Estado</label>
                <select value={form.estado} onChange={e => setForm(p => ({ ...p, estado: e.target.value }))} className={selectCls + ' w-full'}>
                  <option value="ACTIVO">Activo</option>
                  <option value="FINALIZADO">Finalizado</option>
                  <option value="CANCELADO_ANTICIPADO">Cancelado anticipado</option>
                </select>
              </div>
            )}
            <div className="col-span-2">
              <label className={labelCls}>Notas</label>
              <textarea value={form.notas} onChange={e => setForm(p => ({ ...p, notas: e.target.value }))} className={inputCls} />
            </div>
          </div>

          {!isEdit && (
            <div className="border-t pt-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={cargarTabla} onChange={e => { setCargarTabla(e.target.checked); if (e.target.checked) generarFilasManuales(); else setCuotasManuales([]); }} />
                ¿Cargar tabla de amortización ahora? (para copiar los valores reales del Excel del banco)
              </label>
              {!cargarTabla && (
                <p className="text-xs text-muted-foreground mt-1">Si no la cargás, se genera automáticamente dividiendo el capital en partes iguales — podés editarla después.</p>
              )}
              {cargarTabla && cuotasManuales.length > 0 && (
                <div className="mt-2 border rounded-md overflow-x-auto max-h-56 overflow-y-auto">
                  <table className="w-full text-xs min-w-[640px]">
                    <thead className="border-b bg-muted/30 sticky top-0">
                      <tr>
                        <th className="px-2 py-1 text-left">N°</th>
                        <th className="px-2 py-1 text-left">Vencimiento</th>
                        <th className="px-2 py-1 text-right">Capital</th>
                        <th className="px-2 py-1 text-right">Interés</th>
                        <th className="px-2 py-1 text-right">IVA</th>
                        <th className="px-2 py-1 text-right">Seguro</th>
                        <th className="px-2 py-1 text-right">Otros</th>
                        <th className="px-2 py-1 text-right">Total *</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {cuotasManuales.map((c, idx) => (
                        <tr key={idx}>
                          <td className="px-2 py-1">{c.numero_cuota}</td>
                          <td className="px-1 py-1"><input type="date" value={c.fecha_vencimiento} onChange={e => updateFila(idx, { fecha_vencimiento: e.target.value })} className="w-full border-0 bg-transparent px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring rounded" /></td>
                          <td className="px-1 py-1"><MoneyInput value={c.capital != null ? String(c.capital) : ''} onChange={v => updateFila(idx, { capital: v !== '' ? Number(v) : null })} className={cellInput} /></td>
                          <td className="px-1 py-1"><MoneyInput value={c.interes != null ? String(c.interes) : ''} onChange={v => updateFila(idx, { interes: v !== '' ? Number(v) : null })} className={cellInput} /></td>
                          <td className="px-1 py-1"><MoneyInput value={c.iva_interes != null ? String(c.iva_interes) : ''} onChange={v => updateFila(idx, { iva_interes: v !== '' ? Number(v) : null })} className={cellInput} /></td>
                          <td className="px-1 py-1"><MoneyInput value={c.seguro != null ? String(c.seguro) : ''} onChange={v => updateFila(idx, { seguro: v !== '' ? Number(v) : null })} className={cellInput} /></td>
                          <td className="px-1 py-1"><MoneyInput value={c.otros_impuestos != null ? String(c.otros_impuestos) : ''} onChange={v => updateFila(idx, { otros_impuestos: v !== '' ? Number(v) : null })} className={cellInput} /></td>
                          <td className="px-1 py-1"><MoneyInput value={c.total_cuota ? String(c.total_cuota) : ''} onChange={v => updateFila(idx, { total_cuota: v !== '' ? Number(v) : 0 })} className={cellInput + ' font-medium'} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
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

// ── Dialog: registrar pago de cuota ───────────────────────────────────────────

function PagarCuotaDialog({ cuota, onClose }: { cuota: CuotaPrestamo | null; onClose: () => void }) {
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null);
  const pagar = usePagarCuotaPrestamo();

  useEffect(() => { setFecha(new Date().toISOString().slice(0, 10)); setError(null); }, [cuota]);

  const handleConfirm = async () => {
    if (!cuota) return;
    try {
      await pagar.mutateAsync({ id: cuota.id, fecha_pago_real: fecha });
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  return (
    <Dialog open={cuota != null} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>Registrar pago — cuota {cuota?.numero_cuota}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <label className={labelCls}>Fecha de pago</label>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className={inputCls} />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button type="button" size="sm" onClick={handleConfirm} disabled={pagar.isPending}>
              {pagar.isPending ? 'Guardando…' : 'Confirmar pago'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Fila editable de la tabla de amortización ────────────────────────────────

function CuotaRow({ cuota, onPagar }: { cuota: CuotaPrestamo; onPagar: (c: CuotaPrestamo) => void }) {
  const [row, setRow] = useState(cuota);
  const updateCuota = useUpdateCuotaPrestamo();
  useEffect(() => setRow(cuota), [cuota]);

  const commit = (patch: Partial<CuotaPrestamo>) => {
    const merged = { ...row, ...patch };
    setRow(merged);
    updateCuota.mutate({ id: cuota.id, data: patch });
  };

  const vencida = !cuota.pagada && new Date(cuota.fecha_vencimiento) < new Date();
  const numField = (value: number | null, key: 'capital' | 'interes' | 'iva_interes' | 'seguro' | 'otros_impuestos') => (
    <MoneyInput
      value={value != null ? String(value) : ''}
      onChange={v => commit({ [key]: v !== '' ? Number(v) : null } as Partial<CuotaPrestamo>)}
      className={cellInput}
    />
  );

  return (
    <tr className={cn(vencida && 'bg-red-50')}>
      <td className="px-2 py-1.5">{cuota.numero_cuota}</td>
      <td className="px-1 py-1.5">
        <input type="date" defaultValue={cuota.fecha_vencimiento.slice(0, 10)} onBlur={e => commit({ fecha_vencimiento: e.target.value })} className="w-full border-0 bg-transparent px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring rounded" />
      </td>
      <td className="px-1 py-1.5">{numField(row.capital, 'capital')}</td>
      <td className="px-1 py-1.5">{numField(row.interes, 'interes')}</td>
      <td className="px-1 py-1.5">{numField(row.iva_interes, 'iva_interes')}</td>
      <td className="px-1 py-1.5">{numField(row.seguro, 'seguro')}</td>
      <td className="px-1 py-1.5">{numField(row.otros_impuestos, 'otros_impuestos')}</td>
      <td className="px-2 py-1.5 text-right font-medium">{formatCurrency(row.total_cuota)}</td>
      <td className="px-2 py-1.5 text-center">
        <input type="checkbox" checked={cuota.pagada} disabled={cuota.pagada} onChange={() => onPagar(cuota)} />
      </td>
      <td className="px-2 py-1.5">{cuota.fecha_pago_real ? formatDate(cuota.fecha_pago_real) : '—'}</td>
    </tr>
  );
}

// ── Drawer de detalle ─────────────────────────────────────────────────────────

function DetallePrestamo({ id, onClose, onEditar }: { id: number | null; onClose: () => void; onEditar: (p: PrestamoBancario) => void }) {
  const { data: prestamo, isLoading } = usePrestamo(id);
  const [cuotaAPagar, setCuotaAPagar] = useState<CuotaPrestamo | null>(null);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [nombreDoc, setNombreDoc] = useState('');
  const [descDoc, setDescDoc] = useState('');
  const subirDoc = useSubirDocumentoPrestamo(id ?? -1);
  const eliminarDoc = useEliminarDocumentoPrestamo(id ?? -1);

  const handleUpload = async () => {
    if (!archivo) return;
    await subirDoc.mutateAsync({ archivo, nombre: nombreDoc || undefined, descripcion: descDoc || undefined });
    setArchivo(null); setNombreDoc(''); setDescDoc('');
  };

  return (
    <>
      <Dialog open={id != null} onOpenChange={o => !o && onClose()}>
        <DialogContent className="sm:max-w-4xl">
          {isLoading || !prestamo ? (
            <p className="text-sm text-muted-foreground p-4">Cargando…</p>
          ) : (
            <div className="space-y-5">
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between gap-2 pr-6">
                  <span>{prestamo.entidad} {prestamo.tipo ? `— ${prestamo.tipo}` : ''}</span>
                  <div className="flex items-center gap-2">
                    <PrestamoEstadoBadge estado={prestamo.estado} />
                    <Button size="sm" variant="outline" onClick={() => onEditar(prestamo)}><Pencil size={13} className="mr-1" />Editar</Button>
                  </div>
                </DialogTitle>
              </DialogHeader>

              <section className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <p><span className="text-muted-foreground">N° operación:</span> {prestamo.numero_operacion ?? '—'}</p>
                <p><span className="text-muted-foreground">Fecha otorgamiento:</span> {formatDate(prestamo.fecha_otorgamiento)}</p>
                <p><span className="text-muted-foreground">Capital original:</span> {formatCurrency(prestamo.capital_original, prestamo.moneda)}</p>
                <p><span className="text-muted-foreground">Saldo capital pendiente:</span> {formatCurrency(prestamo.saldo_capital_pendiente, prestamo.moneda)}</p>
                <p><span className="text-muted-foreground">TNA / TEA:</span> {prestamo.tasa_nominal_anual ?? '—'}% / {prestamo.tasa_efectiva_anual ?? '—'}%</p>
                <p><span className="text-muted-foreground">Día de débito:</span> {prestamo.dia_debito ?? '—'}</p>
                {prestamo.notas && <p className="col-span-2"><span className="text-muted-foreground">Notas:</span> {prestamo.notas}</p>}
              </section>

              <section>
                <h3 className="text-sm font-semibold mb-1.5">Tabla de amortización ({prestamo.cuotas_pagadas}/{prestamo.cuotas?.length ?? prestamo.cantidad_cuotas})</h3>
                {!prestamo.cuotas || prestamo.cuotas.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Sin cuotas cargadas.</p>
                ) : (
                  <div className="border rounded-md overflow-x-auto max-h-80 overflow-y-auto">
                    <table className="w-full text-xs min-w-[760px]">
                      <thead className="border-b bg-muted/30 sticky top-0">
                        <tr>
                          <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">N°</th>
                          <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Vencimiento</th>
                          <th className="px-2 py-1.5 text-right font-medium text-muted-foreground">Capital</th>
                          <th className="px-2 py-1.5 text-right font-medium text-muted-foreground">Interés</th>
                          <th className="px-2 py-1.5 text-right font-medium text-muted-foreground">IVA</th>
                          <th className="px-2 py-1.5 text-right font-medium text-muted-foreground">Seguro</th>
                          <th className="px-2 py-1.5 text-right font-medium text-muted-foreground">Otros</th>
                          <th className="px-2 py-1.5 text-right font-medium text-muted-foreground">Total</th>
                          <th className="px-2 py-1.5 text-center font-medium text-muted-foreground">Pagada</th>
                          <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Fecha pago</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {prestamo.cuotas.map(c => <CuotaRow key={c.id} cuota={c} onPagar={setCuotaAPagar} />)}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <section>
                <h3 className="text-sm font-semibold mb-1.5">Documentos</h3>
                <div className="space-y-1 mb-2">
                  {(prestamo.documentos ?? []).length === 0 ? (
                    <p className="text-xs text-muted-foreground">Sin documentos adjuntos.</p>
                  ) : prestamo.documentos!.map(d => (
                    <div key={d.id} className="flex items-center justify-between text-xs border rounded px-2 py-1.5">
                      <span className="flex items-center gap-1.5"><FileText size={13} className="text-muted-foreground" /> {d.nombre} {d.descripcion ? `— ${d.descripcion}` : ''}</span>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => window.open(documentoPrestamoUrl(prestamo.id, d.id), '_blank')} title="Descargar"><Download size={13} /></Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => eliminarDoc.mutate(d.id)} title="Eliminar"><Trash2 size={13} /></Button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input value={nombreDoc} onChange={e => setNombreDoc(e.target.value)} placeholder="Nombre (opcional)" className={inputCls + ' w-40'} />
                  <input value={descDoc} onChange={e => setDescDoc(e.target.value)} placeholder="Descripción (opcional)" className={inputCls + ' w-48'} />
                  <input type="file" accept="application/pdf,image/*" onChange={e => setArchivo(e.target.files?.[0] ?? null)} className="text-xs" />
                  <Button size="sm" variant="outline" disabled={!archivo || subirDoc.isPending} onClick={handleUpload}>
                    <Upload size={13} className="mr-1" /> Subir documento
                  </Button>
                </div>
              </section>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <PagarCuotaDialog cuota={cuotaAPagar} onClose={() => setCuotaAPagar(null)} />
    </>
  );
}

// ── Tab principal ─────────────────────────────────────────────────────────────

export default function PrestamosTab() {
  const { user } = useAuth();
  const mostrarEmpresa = !!user && (user.puedeCambiarEmpresa || user.puedeVerMacro);
  const [filtros, setFiltros] = useState<PrestamoFiltros>({});
  const { data: prestamos = [], isLoading } = usePrestamos(filtros);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PrestamoBancario | null>(null);
  const [detalleId, setDetalleId] = useState<number | null>(null);

  const activos = prestamos.filter(p => p.estado === 'ACTIVO');
  const hoy = new Date();
  const cuotasVencidas = activos.filter(p => p.proxima_cuota && new Date(p.proxima_cuota.fecha_vencimiento) < hoy).length;
  const saldoTotalCapital = activos.reduce((s, p) => s + p.saldo_capital_pendiente, 0);
  const proximaGlobal = activos
    .flatMap(p => p.proxima_cuota ? [{ prestamo: p, cuota: p.proxima_cuota }] : [])
    .sort((a, b) => new Date(a.cuota.fecha_vencimiento).getTime() - new Date(b.cuota.fecha_vencimiento).getTime())[0];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <CardResumen label="Créditos activos" value={String(activos.length)} />
        <CardResumen label="Cuotas vencidas sin pagar" value={String(cuotasVencidas)} />
        <CardResumen
          label="Próxima cuota"
          value={proximaGlobal ? `${proximaGlobal.prestamo.entidad} — ${formatCurrency(proximaGlobal.cuota.total_cuota)}` : '—'}
        />
        <CardResumen label="Saldo total de capital" value={formatCurrency(saldoTotalCapital)} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <select value={filtros.estado ?? ''} onChange={e => setFiltros(f => ({ ...f, estado: e.target.value || undefined }))} className={selectCls}>
            <option value="">Todos los estados</option>
            <option value="ACTIVO">Activo</option>
            <option value="FINALIZADO">Finalizado</option>
            <option value="CANCELADO_ANTICIPADO">Cancelado anticipado</option>
          </select>
        </div>
        <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <Plus size={14} className="mr-1.5" /> Nuevo crédito
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : prestamos.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Building2 size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No hay créditos bancarios cargados.</p>
        </div>
      ) : (
        <div className="rounded-lg border bg-white overflow-x-auto">
          <table className="w-full text-sm min-w-[960px]">
            <thead className="border-b bg-muted/30">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Entidad</th>
                {mostrarEmpresa && <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Empresa</th>}
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Tipo</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Capital original</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Cuotas</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Próxima cuota</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Saldo capital</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Estado</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {prestamos.map(p => (
                <tr key={p.id} className="hover:bg-muted/20 cursor-pointer" onClick={() => setDetalleId(p.id)}>
                  <td className="px-3 py-2.5 font-medium">{p.entidad}</td>
                  {mostrarEmpresa && (
                    <td className="px-3 py-2.5"><Badge variant="muted">{p.empresa?.nombre_corto ?? p.empresa?.nombre ?? '—'}</Badge></td>
                  )}
                  <td className="px-3 py-2.5 text-muted-foreground">{p.tipo ?? '—'}</td>
                  <td className="px-3 py-2.5 text-right">{formatCurrency(p.capital_original, p.moneda)}</td>
                  <td className="px-3 py-2.5">{p.cuotas_pagadas}/{p.cuotas_pagadas + p.cuotas_pendientes}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{p.proxima_cuota ? formatDate(p.proxima_cuota.fecha_vencimiento) : '—'}</td>
                  <td className="px-3 py-2.5 text-right">{formatCurrency(p.saldo_capital_pendiente, p.moneda)}</td>
                  <td className="px-3 py-2.5"><PrestamoEstadoBadge estado={p.estado} /></td>
                  <td className="px-3 py-2.5 text-right" onClick={e => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" onClick={() => { setEditing(p); setDialogOpen(true); }} title="Editar"><Pencil size={14} /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <PrestamoDialog open={dialogOpen} prestamo={editing} onClose={() => { setDialogOpen(false); setEditing(null); }} />
      <DetallePrestamo id={detalleId} onClose={() => setDetalleId(null)} onEditar={p => { setEditing(p); setDialogOpen(true); }} />
    </div>
  );
}
