import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Building2, Plus, ChevronDown, ChevronRight, Pencil, Trash2, Download, Lock } from 'lucide-react';
import {
  useEspacioCompartido,
  useMesesEspacio, useMesDetalle, useGenerarMes, useCerrarMes,
  useCreateParte, useUpdateParte, useRemoveParte,
  useCreateGastoTipo, useUpdateGastoTipo, useRemoveGastoTipo,
  useAgregarLineaManual, useUpdateLinea, usePagarLinea, useRemoveLinea,
  comprobanteLineaUrl,
  type ParteInput, type GastoTipoInput, type LineaManualInput,
} from '@/hooks/useEspaciosCompartidos';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import MoneyInput from '@/components/ui/MoneyInput';
import { LineaGastoEstadoBadge } from '@/components/ui/badge';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { getApiErrorMessage, cn } from '@/lib/utils';
import type { LineaGastoEspacio, ParteEspacio, GastoTipoEspacio } from '@/types';

const inputCls = 'w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring';
const labelCls = 'block text-xs font-medium text-muted-foreground mb-0.5';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

function hoyMesAnio(): { mes: number; anio: number } {
  const hoy = new Date();
  return { mes: hoy.getUTCMonth() + 1, anio: hoy.getUTCFullYear() };
}

// ── Dialog: agregar / editar línea ────────────────────────────────────────────

function LineaFormDialog({
  espacioId, mes, anio, linea, onClose,
}: {
  espacioId: number; mes: number; anio: number; linea: LineaGastoEspacio | null; onClose: () => void;
}) {
  const isEdit = !!linea;
  const [nombre, setNombre]     = useState('');
  const [monto, setMonto]       = useState('');
  const [vencimiento, setVencimiento] = useState('');
  const [error, setError]       = useState<string | null>(null);
  const crear     = useAgregarLineaManual(espacioId, mes, anio);
  const actualizar = useUpdateLinea(espacioId);

  useEffect(() => {
    if (linea) {
      setNombre(linea.nombre);
      setMonto(String(linea.monto_real));
      setVencimiento(linea.fecha_vencimiento ? linea.fecha_vencimiento.slice(0, 10) : '');
    } else {
      setNombre(''); setMonto(''); setVencimiento('');
    }
    setError(null);
  }, [linea]);

  const handleSubmit = async () => {
    setError(null);
    if (!nombre.trim()) { setError('El nombre es obligatorio'); return; }
    if (!monto || Number(monto) <= 0) { setError('El monto debe ser mayor a 0'); return; }

    try {
      if (isEdit) {
        const data: Partial<LineaManualInput> = {
          nombre: nombre.trim(), monto_real: Number(monto), fecha_vencimiento: vencimiento || null,
        };
        await actualizar.mutateAsync({ id: linea.id, data });
      } else {
        await crear.mutateAsync({ nombre: nombre.trim(), monto_real: Number(monto), fecha_vencimiento: vencimiento || null });
      }
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  const pending = crear.isPending || actualizar.isPending;

  return (
    <Dialog open={true} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>{isEdit ? 'Editar gasto' : 'Agregar gasto variable'}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <label className={labelCls}>Nombre *</label>
            <input value={nombre} onChange={e => setNombre(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Monto *</label>
            <MoneyInput value={monto} onChange={setMonto} />
          </div>
          <div>
            <label className={labelCls}>Vencimiento</label>
            <input type="date" value={vencimiento} onChange={e => setVencimiento(e.target.value)} className={inputCls} />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button type="button" size="sm" onClick={handleSubmit} disabled={pending}>{pending ? 'Guardando…' : 'Guardar'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Dialog: marcar pagado ─────────────────────────────────────────────────────

function PagarLineaDialog({ espacioId, linea, onClose }: { espacioId: number; linea: LineaGastoEspacio | null; onClose: () => void }) {
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [archivo, setArchivo] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pagar = usePagarLinea(espacioId);

  useEffect(() => { setFecha(new Date().toISOString().slice(0, 10)); setArchivo(null); setError(null); }, [linea]);

  const handleConfirm = async () => {
    if (!linea) return;
    try {
      await pagar.mutateAsync({ id: linea.id, fecha_pago: fecha, comprobante: archivo ?? undefined });
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  return (
    <Dialog open={linea != null} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>Marcar pagado — {linea?.nombre}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <label className={labelCls}>Fecha de pago</label>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Comprobante (opcional)</label>
            <input type="file" accept="application/pdf,image/*" onChange={e => setArchivo(e.target.files?.[0] ?? null)} className="text-xs" />
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

// ── Fila de línea con reparto expandible ──────────────────────────────────────

function LineaRow({ linea, espacioId, onEditar, onPagar }: { linea: LineaGastoEspacio; espacioId: number; onEditar: () => void; onPagar: () => void }) {
  const [abierto, setAbierto] = useState(false);
  const eliminar = useRemoveLinea(espacioId);

  const handleAnular = () => {
    if (!window.confirm(`¿Anular el gasto "${linea.nombre}"? Se reversarán los movimientos de cuenta corriente asociados.`)) return;
    eliminar.mutate(linea.id);
  };

  return (
    <>
      <tr className="border-b last:border-0 hover:bg-muted/20 text-sm">
        <td className="px-3 py-2">
          <button onClick={() => setAbierto(a => !a)} className="flex items-center gap-1.5 text-left">
            {abierto ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            {linea.nombre}
          </button>
        </td>
        <td className="px-3 py-2 text-right">{formatCurrency(linea.monto_real)}</td>
        <td className="px-3 py-2">{linea.fecha_vencimiento ? formatDate(linea.fecha_vencimiento) : '—'}</td>
        <td className="px-3 py-2"><LineaGastoEstadoBadge estado={linea.estado} /></td>
        <td className="px-3 py-2 text-right">
          <div className="flex items-center justify-end gap-1">
            {linea.estado === 'PENDIENTE' && (
              <Button size="sm" variant="outline" onClick={onPagar}>Marcar pagado</Button>
            )}
            {linea.tiene_comprobante && (
              <Button variant="ghost" size="icon" className="h-7 w-7" title="Descargar comprobante" onClick={() => window.open(comprobanteLineaUrl(linea.id), '_blank')}>
                <Download size={13} />
              </Button>
            )}
            {linea.estado !== 'ANULADO' && (
              <>
                <Button variant="ghost" size="icon" className="h-7 w-7" title="Editar" onClick={onEditar}><Pencil size={13} /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" title="Anular" onClick={handleAnular}><Trash2 size={13} /></Button>
              </>
            )}
          </div>
        </td>
      </tr>
      {abierto && (
        <tr className="border-b last:border-0 bg-muted/10">
          <td colSpan={5} className="px-6 py-2">
            <div className="space-y-1">
              {(linea.repartos ?? []).map(r => (
                <div key={r.id} className="flex justify-between text-xs text-muted-foreground">
                  <span>{r.parte?.nombre ?? `Parte #${r.parte_id}`} ({Number(r.porcentaje)}%)</span>
                  <span className="font-medium text-foreground">{formatCurrency(r.monto)}</span>
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Tab: mes (actual o histórico) ──────────────────────────────────────────────

function TabMes({ espacioId, espacioNombre, mes, anio }: { espacioId: number; espacioNombre: string; mes: number; anio: number }) {
  const { data: gastoMes, isLoading } = useMesDetalle(espacioId, mes, anio);
  const generar = useGenerarMes(espacioId);
  const cerrar  = useCerrarMes(espacioId, mes, anio);
  const [dialogLinea, setDialogLinea] = useState<{ open: boolean; linea: LineaGastoEspacio | null }>({ open: false, linea: null });
  const [lineaAPagar, setLineaAPagar] = useState<LineaGastoEspacio | null>(null);
  const [errorCierre, setErrorCierre] = useState<string | null>(null);

  if (isLoading) return <p className="text-sm text-muted-foreground">Cargando…</p>;

  if (!gastoMes) {
    return (
      <div className="rounded-lg border bg-amber-50 border-amber-200 p-4 flex items-center justify-between gap-3">
        <p className="text-sm text-amber-900">
          📅 El mes de {MESES[mes - 1].toLowerCase()} {anio} no fue generado para {espacioNombre}.
        </p>
        <Button size="sm" onClick={() => generar.mutate({ mes, anio })} disabled={generar.isPending}>
          {generar.isPending ? 'Generando…' : 'Generar ahora'}
        </Button>
      </div>
    );
  }

  const lineasActivas = gastoMes.lineas.filter(l => l.estado !== 'ANULADO');
  const totalMes    = lineasActivas.reduce((s, l) => s + l.monto_real, 0);
  const totalPagado = lineasActivas.filter(l => l.estado === 'PAGADO').reduce((s, l) => s + l.monto_real, 0);
  const totalPendiente = totalMes - totalPagado;
  const hayPendientes = lineasActivas.some(l => l.estado === 'PENDIENTE');

  const handleCerrar = async () => {
    setErrorCierre(null);
    if (!window.confirm('¿Cerrar este mes? No se podrán agregar ni editar más gastos.')) return;
    try {
      await cerrar.mutateAsync();
    } catch (err) {
      setErrorCierre(getApiErrorMessage(err));
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{MESES[mes - 1]} {anio} {gastoMes.cerrado && <span className="text-muted-foreground font-normal">(cerrado)</span>}</h3>
        {!gastoMes.cerrado && (
          <Button size="sm" variant="outline" onClick={() => setDialogLinea({ open: true, linea: null })}>
            <Plus size={14} className="mr-1.5" /> Agregar gasto variable
          </Button>
        )}
      </div>

      {gastoMes.lineas.length === 0 ? (
        <p className="text-sm text-muted-foreground">Este mes no tiene gastos cargados.</p>
      ) : (
        <div className="rounded-lg border bg-white overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead className="border-b bg-muted/30">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Gasto</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Monto</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Vencimiento</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Estado</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {gastoMes.lineas.map(l => (
                <LineaRow
                  key={l.id}
                  linea={l}
                  espacioId={espacioId}
                  onEditar={() => setDialogLinea({ open: true, linea: l })}
                  onPagar={() => setLineaAPagar(l)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="rounded-lg border bg-white p-3 grid grid-cols-3 gap-3 text-sm">
        <div><p className="text-xs text-muted-foreground">Total del mes</p><p className="font-semibold">{formatCurrency(totalMes)}</p></div>
        <div><p className="text-xs text-muted-foreground">Pagado</p><p className="font-semibold text-green-700">{formatCurrency(totalPagado)}</p></div>
        <div><p className="text-xs text-muted-foreground">Pendiente</p><p className="font-semibold text-amber-700">{formatCurrency(totalPendiente)}</p></div>
      </div>

      {!gastoMes.cerrado && (
        <div className="flex justify-end items-center gap-2">
          {errorCierre && <p className="text-xs text-destructive">{errorCierre}</p>}
          <Button size="sm" variant="outline" onClick={handleCerrar} disabled={hayPendientes || cerrar.isPending} title={hayPendientes ? 'Hay gastos pendientes de pago' : undefined}>
            <Lock size={13} className="mr-1.5" /> Cerrar mes
          </Button>
        </div>
      )}

      {dialogLinea.open && (
        <LineaFormDialog espacioId={espacioId} mes={mes} anio={anio} linea={dialogLinea.linea} onClose={() => setDialogLinea({ open: false, linea: null })} />
      )}
      <PagarLineaDialog espacioId={espacioId} linea={lineaAPagar} onClose={() => setLineaAPagar(null)} />
    </div>
  );
}

// ── Tab: historial ─────────────────────────────────────────────────────────────

function TabHistorial({ espacioId, onVerMes }: { espacioId: number; onVerMes: (mes: number, anio: number) => void }) {
  const { data: meses = [], isLoading } = useMesesEspacio(espacioId);

  if (isLoading) return <p className="text-sm text-muted-foreground">Cargando…</p>;
  if (meses.length === 0) return <p className="text-sm text-muted-foreground">Sin meses generados todavía.</p>;

  return (
    <div className="rounded-lg border bg-white overflow-x-auto">
      <table className="w-full text-sm min-w-[480px]">
        <thead className="border-b bg-muted/30">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Mes</th>
            <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Total</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Pagados</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Pendientes</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Estado</th>
          </tr>
        </thead>
        <tbody>
          {meses.map(m => (
            <tr key={m.id} className="border-b last:border-0 hover:bg-muted/20 cursor-pointer" onClick={() => onVerMes(m.periodo_mes, m.periodo_anio)}>
              <td className="px-3 py-2 font-medium">{MESES[m.periodo_mes - 1]} {m.periodo_anio}</td>
              <td className="px-3 py-2 text-right">{formatCurrency(m.total_gastos)}</td>
              <td className="px-3 py-2">{m.pagados}</td>
              <td className="px-3 py-2">{m.pendientes}</td>
              <td className="px-3 py-2 text-muted-foreground">{m.cerrado ? 'Cerrado' : 'Abierto'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Tab: configuración ─────────────────────────────────────────────────────────

const PARTE_VACIA: ParteInput = { nombre: '', porcentaje: 0 };

function ParteDialog({ espacioId, parte, onClose }: { espacioId: number; parte: ParteEspacio | null; onClose: () => void }) {
  const isEdit = !!parte;
  const [form, setForm] = useState<ParteInput>(PARTE_VACIA);
  const [error, setError] = useState<string | null>(null);
  const crear = useCreateParte(espacioId);
  const actualizar = useUpdateParte();

  useEffect(() => {
    setForm(parte ? { nombre: parte.nombre, porcentaje: Number(parte.porcentaje) } : PARTE_VACIA);
    setError(null);
  }, [parte]);

  const handleSubmit = async () => {
    setError(null);
    if (!form.nombre.trim()) { setError('El nombre es obligatorio'); return; }
    try {
      if (isEdit) await actualizar.mutateAsync({ id: parte.id, data: form });
      else        await crear.mutateAsync(form);
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  const pending = crear.isPending || actualizar.isPending;

  return (
    <Dialog open={true} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader><DialogTitle>{isEdit ? 'Editar parte' : 'Nueva parte'}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <label className={labelCls}>Nombre *</label>
            <input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Porcentaje *</label>
            <input type="number" value={form.porcentaje || ''} onChange={e => setForm(f => ({ ...f, porcentaje: Number(e.target.value) }))} className={inputCls} />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button type="button" size="sm" onClick={handleSubmit} disabled={pending}>{pending ? 'Guardando…' : 'Guardar'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function GastoTipoDialog({ espacioId, tipo, onClose }: { espacioId: number; tipo: GastoTipoEspacio | null; onClose: () => void }) {
  const isEdit = !!tipo;
  const [nombre, setNombre] = useState('');
  const [monto, setMonto]   = useState('');
  const [diaVencimiento, setDiaVencimiento] = useState('');
  const [error, setError]   = useState<string | null>(null);
  const crear = useCreateGastoTipo(espacioId);
  const actualizar = useUpdateGastoTipo();

  useEffect(() => {
    if (tipo) {
      setNombre(tipo.nombre); setMonto(String(tipo.monto_estimado));
      setDiaVencimiento(tipo.dia_vencimiento != null ? String(tipo.dia_vencimiento) : '');
    } else {
      setNombre(''); setMonto(''); setDiaVencimiento('');
    }
    setError(null);
  }, [tipo]);

  const handleSubmit = async () => {
    setError(null);
    if (!nombre.trim()) { setError('El nombre es obligatorio'); return; }
    const data: GastoTipoInput = {
      nombre: nombre.trim(), monto_estimado: Number(monto) || 0,
      dia_vencimiento: diaVencimiento ? Number(diaVencimiento) : null,
    };
    try {
      if (isEdit) await actualizar.mutateAsync({ id: tipo.id, data });
      else        await crear.mutateAsync(data);
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  const pending = crear.isPending || actualizar.isPending;

  return (
    <Dialog open={true} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>{isEdit ? 'Editar tipo de gasto' : 'Nuevo tipo de gasto fijo'}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <label className={labelCls}>Nombre *</label>
            <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Alquiler, Municipalidad…" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Monto estimado *</label>
            <MoneyInput value={monto} onChange={setMonto} />
          </div>
          <div>
            <label className={labelCls}>Día de vencimiento</label>
            <input type="number" min={1} max={31} value={diaVencimiento} onChange={e => setDiaVencimiento(e.target.value)} className={cn(inputCls, 'w-24')} />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button type="button" size="sm" onClick={handleSubmit} disabled={pending}>{pending ? 'Guardando…' : 'Guardar'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TabConfiguracion({ espacioId, partes, gastosTipo }: { espacioId: number; partes: ParteEspacio[]; gastosTipo: GastoTipoEspacio[] }) {
  const [parteDialog, setParteDialog] = useState<{ open: boolean; parte: ParteEspacio | null }>({ open: false, parte: null });
  const [tipoDialog, setTipoDialog]   = useState<{ open: boolean; tipo: GastoTipoEspacio | null }>({ open: false, tipo: null });
  const eliminarParte = useRemoveParte();
  const eliminarTipo   = useRemoveGastoTipo();

  const suma = partes.reduce((s, p) => s + Number(p.porcentaje), 0);

  return (
    <div className="space-y-6">
      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold">Partes y % de reparto</h3>
          <Button size="sm" variant="outline" onClick={() => setParteDialog({ open: true, parte: null })}>
            <Plus size={13} className="mr-1" /> Nueva parte
          </Button>
        </div>
        <div className="rounded-lg border bg-white divide-y">
          {partes.map(p => (
            <div key={p.id} className="flex items-center justify-between px-3 py-2 text-sm">
              <span>{p.nombre}</span>
              <div className="flex items-center gap-2">
                <span className="font-medium">{Number(p.porcentaje)}%</span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setParteDialog({ open: true, parte: p })}><Pencil size={13} /></Button>
                <Button
                  variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={() => { if (window.confirm(`¿Eliminar la parte "${p.nombre}"?`)) eliminarParte.mutate(p.id); }}
                >
                  <Trash2 size={13} />
                </Button>
              </div>
            </div>
          ))}
        </div>
        <p className={cn('text-xs mt-1', Math.abs(suma - 100) < 0.01 ? 'text-green-700' : 'text-destructive')}>
          Suma: {suma}% {Math.abs(suma - 100) < 0.01 ? '✓' : '(debería ser 100%)'}
        </p>
      </section>

      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold">Tipos de gasto fijo</h3>
          <Button size="sm" variant="outline" onClick={() => setTipoDialog({ open: true, tipo: null })}>
            <Plus size={13} className="mr-1" /> Nuevo tipo de gasto fijo
          </Button>
        </div>
        <div className="rounded-lg border bg-white divide-y">
          {gastosTipo.length === 0 && <p className="text-sm text-muted-foreground px-3 py-3">Sin tipos de gasto cargados.</p>}
          {gastosTipo.map(t => (
            <div key={t.id} className={cn('flex items-center justify-between px-3 py-2 text-sm', !t.activo && 'opacity-50')}>
              <div>
                <span>{t.nombre}</span>
                {!t.activo && <span className="text-xs text-muted-foreground ml-2">(inactivo)</span>}
                {t.dia_vencimiento && <span className="text-xs text-muted-foreground ml-2">vence día {t.dia_vencimiento}</span>}
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{formatCurrency(t.monto_estimado)}</span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setTipoDialog({ open: true, tipo: t })}><Pencil size={13} /></Button>
                {t.activo && (
                  <Button
                    variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => { if (window.confirm(`¿Desactivar "${t.nombre}"? No se volverá a generar en los próximos meses.`)) eliminarTipo.mutate(t.id); }}
                  >
                    <Trash2 size={13} />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {parteDialog.open && <ParteDialog espacioId={espacioId} parte={parteDialog.parte} onClose={() => setParteDialog({ open: false, parte: null })} />}
      {tipoDialog.open && <GastoTipoDialog espacioId={espacioId} tipo={tipoDialog.tipo} onClose={() => setTipoDialog({ open: false, tipo: null })} />}
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

type Tab = 'mes' | 'historial' | 'configuracion';

export default function EspacioCompartidoDetallePage() {
  const { id } = useParams<{ id: string }>();
  const espacioId = Number(id);
  const navigate = useNavigate();
  const { data: espacio, isLoading } = useEspacioCompartido(espacioId);
  const [tab, setTab] = useState<Tab>('mes');
  const [{ mes, anio }, setMesSeleccionado] = useState(hoyMesAnio());

  if (isLoading || !espacio) {
    return <div className="p-6"><p className="text-sm text-muted-foreground">Cargando…</p></div>;
  }

  return (
    <div className="p-6 space-y-4 max-w-5xl mx-auto">
      <button onClick={() => navigate('/espacios-compartidos')} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft size={14} /> Espacios Compartidos
      </button>

      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Building2 size={22} /> {espacio.nombre}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {espacio.partes.map(p => `${p.nombre} ${Number(p.porcentaje)}%`).join(' · ')}
        </p>
      </div>

      <div className="flex border-b border-border overflow-x-auto">
        {([
          { key: 'mes',           label: 'Mes actual' },
          { key: 'historial',     label: 'Historial' },
          { key: 'configuracion', label: 'Configuración' },
        ] as { key: Tab; label: string }[]).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => { setTab(key); if (key === 'mes') setMesSeleccionado(hoyMesAnio()); }}
            className={cn(
              'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap',
              tab === key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'mes' && <TabMes espacioId={espacioId} espacioNombre={espacio.nombre} mes={mes} anio={anio} />}
      {tab === 'historial' && (
        <TabHistorial espacioId={espacioId} onVerMes={(m, a) => { setMesSeleccionado({ mes: m, anio: a }); setTab('mes'); }} />
      )}
      {tab === 'configuracion' && (
        <TabConfiguracion espacioId={espacioId} partes={espacio.partes} gastosTipo={espacio.gastosTipo ?? []} />
      )}
    </div>
  );
}
