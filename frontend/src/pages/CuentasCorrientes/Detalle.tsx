import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Plus, Download, Trash2, Paperclip, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  useCuentaCorriente,
  useMovimientosCCC,
  useCreateMovimientoCCC,
  useDeleteMovimientoCCC,
  getDocumentoUrl,
  type MovimientoPayload,
} from '@/hooks/useCuentasCorrientes';
import { useFacturas } from '@/hooks/useFacturas';
import { useEventos } from '@/hooks/useEvento';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import api from '@/lib/api';
import type { TipoMovCCC, MonedaCCC, MovimientoCCC } from '@/types';
import { formatCurrency } from '@/lib/formatters';
import { cn } from '@/lib/utils';

const inputCls = 'w-full border border-input rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring';
const labelCls = 'block text-xs font-medium text-muted-foreground mb-0.5';

// DEBE aumenta el saldo (el tercero nos debe más) → mismo verde que un saldo
// positivo; HABER lo reduce (le pagamos/abonamos) → mismo rojo que un saldo
// negativo. Ver recalcularSaldoCCC.ts para la convención de signo.
const TIPO_META: Record<TipoMovCCC, { label: string; cls: string }> = {
  DEBE:   { label: 'Debe',   cls: 'bg-green-100 text-green-800' },
  HABER:  { label: 'Haber',  cls: 'bg-red-100 text-red-800' },
  AJUSTE: { label: 'Ajuste', cls: 'bg-gray-100 text-gray-800' },
};

function fmt(date: string | null | undefined) {
  if (!date) return '—';
  return format(new Date(date), 'dd/MM/yyyy', { locale: es });
}

// ── Dialog nuevo movimiento ───────────────────────────────────────────────────

function NuevoMovimientoDialog({ cuenta, onClose }: { cuenta: NonNullable<ReturnType<typeof useCuentaCorriente>['data']>; onClose: () => void }) {
  const [tipo, setTipo]           = useState<TipoMovCCC>('DEBE');
  const [fecha, setFecha]         = useState(format(new Date(), 'yyyy-MM-dd'));
  const [concepto, setConcepto]   = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [monto, setMonto]         = useState('');
  const [moneda, setMoneda]       = useState<MonedaCCC>(cuenta.moneda);
  const [tasaCambio, setTasaCambio] = useState('');
  const [facturaId, setFacturaId] = useState('');
  const [eventoId, setEventoId]   = useState('');
  const [documento, setDocumento] = useState<File | null>(null);
  const [error, setError]         = useState<string | null>(null);

  const createMut = useCreateMovimientoCCC(cuenta.id);
  const { data: facturas = [] } = useFacturas(cuenta.proveedor_id ? { proveedor_id: cuenta.proveedor_id } : {});
  const { data: eventos = [] }  = useEventos();

  const montoNum = Number(monto);
  const tasaNum  = tasaCambio ? Number(tasaCambio) : null;
  const previewArs = moneda !== 'ARS' && tasaNum && montoNum ? montoNum * tasaNum : null;

  const handleSubmit = async () => {
    setError(null);
    if (!concepto.trim())            { setError('El concepto es obligatorio'); return; }
    if (!fecha)                      { setError('La fecha es obligatoria'); return; }
    if (!monto || (tipo !== 'AJUSTE' && montoNum <= 0)) { setError('El monto debe ser mayor a 0'); return; }
    if (tipo === 'AJUSTE' && montoNum === 0)            { setError('El monto de un ajuste no puede ser 0'); return; }

    const payload: MovimientoPayload = {
      tipo, fecha, concepto: concepto.trim(),
      descripcion: descripcion.trim() || undefined,
      monto:       montoNum,
      moneda,
      tasa_cambio: moneda !== 'ARS' ? tasaNum ?? undefined : undefined,
      factura_id:  facturaId ? Number(facturaId) : undefined,
      evento_id:   eventoId  ? Number(eventoId)  : undefined,
      documento,
    };

    try {
      await createMut.mutateAsync(payload);
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Error al registrar el movimiento');
    }
  };

  return (
    <div className="space-y-4">
      <DialogTitle>Nuevo movimiento</DialogTitle>

      <div className="grid grid-cols-3 gap-2">
        {(['DEBE', 'HABER', 'AJUSTE'] as TipoMovCCC[]).map(t => (
          <button
            key={t}
            onClick={() => setTipo(t)}
            className={cn(
              'rounded-lg border-2 py-2.5 text-sm font-medium transition-colors',
              tipo === t
                ? t === 'DEBE'   ? 'border-green-500 bg-green-50 text-green-700'
                : t === 'HABER'  ? 'border-red-500 bg-red-50 text-red-700'
                :                  'border-gray-500 bg-gray-50 text-gray-700'
                : 'border-border text-muted-foreground hover:border-foreground/30',
            )}
          >
            {TIPO_META[t].label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Fecha *</label>
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Monto *</label>
          <input type="number" step={0.01} value={monto} onChange={e => setMonto(e.target.value)} className={inputCls} />
        </div>
        <div className="col-span-2">
          <label className={labelCls}>Concepto *</label>
          <input value={concepto} onChange={e => setConcepto(e.target.value)} className={inputCls} />
        </div>
        <div className="col-span-2">
          <label className={labelCls}>Descripción</label>
          <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} rows={2} className={cn(inputCls, 'resize-none')} />
        </div>
        <div>
          <label className={labelCls}>Moneda</label>
          <select value={moneda} onChange={e => setMoneda(e.target.value as MonedaCCC)} className={inputCls}>
            <option value="ARS">ARS</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
          </select>
        </div>
        {moneda !== 'ARS' && (
          <div>
            <label className={labelCls}>Tasa de cambio (a ARS)</label>
            <input type="number" step={0.0001} value={tasaCambio} onChange={e => setTasaCambio(e.target.value)} className={inputCls} />
          </div>
        )}
        {previewArs !== null && (
          <p className="col-span-2 text-xs text-muted-foreground">
            ≈ {formatCurrency(previewArs, 'ARS')}
          </p>
        )}
        <div>
          <label className={labelCls}>Vincular a factura</label>
          <select value={facturaId} onChange={e => setFacturaId(e.target.value)} className={inputCls}>
            <option value="">— Sin vincular —</option>
            {facturas.map(f => <option key={f.id} value={f.id}>{f.tipo_factura} {f.numero_factura}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Vincular a evento</label>
          <select value={eventoId} onChange={e => setEventoId(e.target.value)} className={inputCls}>
            <option value="">— Sin vincular —</option>
            {eventos.map(ev => <option key={ev.id} value={ev.id}>{ev.nombre}</option>)}
          </select>
        </div>
        <div className="col-span-2">
          <label className={labelCls}>Adjuntar documento</label>
          <input
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            onChange={e => setDocumento(e.target.files?.[0] ?? null)}
            className="text-sm"
          />
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-end gap-2 border-t border-border pt-3">
        <Button variant="outline" size="sm" onClick={onClose} disabled={createMut.isPending}>Cancelar</Button>
        <Button size="sm" onClick={handleSubmit} disabled={createMut.isPending}>
          {createMut.isPending ? 'Guardando…' : 'Registrar movimiento'}
        </Button>
      </div>
    </div>
  );
}

// ── Fila de movimiento ────────────────────────────────────────────────────────

function FilaMovimiento({ m, onDelete, deleting }: { m: MovimientoCCC; onDelete: () => void; deleting: boolean }) {
  const [confirming, setConfirming] = useState(false);
  const meta = TIPO_META[m.tipo];
  const esDebe = m.tipo === 'DEBE' || (m.tipo === 'AJUSTE' && m.monto >= 0);

  return (
    <tr className="border-b border-border last:border-0 text-sm">
      <td className="py-2 px-3">{fmt(m.fecha)}</td>
      <td className="py-2 px-3">
        <span className={cn('inline-flex items-center text-xs rounded-full px-2 py-0.5 font-medium', meta.cls)}>{meta.label}</span>
      </td>
      <td className="py-2 px-3">
        <div>{m.concepto}</div>
        {m.descripcion && <div className="text-xs text-muted-foreground">{m.descripcion}</div>}
        <div className="flex gap-2 mt-0.5">
          {m.factura && <Link to={`/facturas/${m.factura.id}`} className="text-xs text-primary hover:underline">Fact. {m.factura.numero_factura}</Link>}
          {m.evento  && <Link to={`/eventos/${m.evento.id}`} className="text-xs text-primary hover:underline">{m.evento.nombre}</Link>}
        </div>
      </td>
      <td className="py-2 px-3 text-right font-medium text-green-700">{esDebe ? formatCurrency(Math.abs(m.monto), m.moneda) : ''}</td>
      <td className="py-2 px-3 text-right font-medium text-red-700">{!esDebe ? formatCurrency(Math.abs(m.monto), m.moneda) : ''}</td>
      <td className="py-2 px-3 text-right font-semibold">{formatCurrency(m.saldo, m.moneda)}</td>
      <td className="py-2 px-3 text-xs text-muted-foreground">{m.moneda}</td>
      <td className="py-2 px-3 text-xs text-muted-foreground">{m.tasa_cambio ?? '—'}</td>
      <td className="py-2 px-3">
        {m.documento_nombre ? (
          <a href={getDocumentoUrl(m.id)} target="_blank" rel="noreferrer" title={m.documento_nombre} className="text-muted-foreground hover:text-primary">
            <Paperclip size={14} />
          </a>
        ) : '—'}
      </td>
      <td className="py-2 px-3 text-right">
        {confirming ? (
          <span className="flex items-center justify-end gap-1.5">
            <button onClick={onDelete} disabled={deleting} className="text-xs text-destructive hover:underline">Confirmar</button>
            <button onClick={() => setConfirming(false)} className="text-xs text-muted-foreground hover:underline">Cancelar</button>
          </span>
        ) : (
          <button onClick={() => setConfirming(true)} className="p-1 rounded hover:bg-destructive/10 text-destructive">
            <Trash2 size={14} />
          </button>
        )}
      </td>
    </tr>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CuentaCorrienteDetalle() {
  const { id }   = useParams<{ id: string }>();
  const navigate = useNavigate();
  const cuentaId = Number(id);

  const [showNuevo, setShowNuevo] = useState(false);
  const [exporting, setExporting] = useState(false);

  const { data: cuenta, isLoading: loadingCuenta } = useCuentaCorriente(cuentaId);
  const { data: movsData, isLoading: loadingMovs } = useMovimientosCCC(cuentaId, { limit: 100 });
  const deleteMovMut = useDeleteMovimientoCCC(cuentaId);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  if (loadingCuenta) return <div className="p-8 text-sm text-muted-foreground">Cargando…</div>;
  if (!cuenta) return <div className="p-8 text-sm text-destructive">No se encontró la cuenta corriente.</div>;

  const terceroNombre = cuenta.proveedor?.nombre ?? cuenta.tercero_nombre ?? '—';
  const terceroCuit   = cuenta.proveedor?.cuit ?? cuenta.tercero_cuit;
  const positivo      = cuenta.saldo_actual >= 0;
  const movimientos   = movsData?.movimientos ?? [];

  const handleDelete = async (movId: number) => {
    setDeletingId(movId);
    try {
      await deleteMovMut.mutateAsync(movId);
    } catch (err: any) {
      alert(err?.response?.data?.error ?? 'Error al eliminar el movimiento');
    } finally {
      setDeletingId(null);
    }
  };

  const handleExportar = async () => {
    setExporting(true);
    try {
      const res = await api.get(`/cuentas-corrientes/${cuentaId}/exportar`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${cuenta.nombre}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch {
      alert('No se pudo exportar el Excel');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6">
      <div className="flex items-start gap-4">
        <button onClick={() => navigate(-1)} className="mt-0.5 text-muted-foreground hover:text-foreground">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold">{cuenta.nombre}</h1>
          <p className="text-sm text-muted-foreground">
            {terceroNombre}{terceroCuit ? ` — CUIT ${terceroCuit}` : ''}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Saldo actual</p>
          <p className={cn('text-2xl font-bold', positivo ? 'text-green-700' : 'text-red-600')}>
            {formatCurrency(cuenta.saldo_actual, cuenta.moneda)}
          </p>
        </div>
      </div>

      {cuenta.tiene_reparto && cuenta.partes && cuenta.partes.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-sm font-semibold mb-2">Reparto por parte</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {cuenta.partes.map(p => (
              <div key={p.id} className="border border-border rounded p-2.5">
                <p className="text-xs text-muted-foreground">{p.nombre} ({p.porcentaje}%)</p>
                <p className="font-medium">{formatCurrency(cuenta.saldo_actual * p.porcentaje / 100, cuenta.moneda)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => setShowNuevo(true)}>
          <Plus size={14} className="mr-1.5" /> Nuevo movimiento
        </Button>
        <Button size="sm" variant="outline" onClick={handleExportar} disabled={exporting}>
          {exporting ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : <Download size={14} className="mr-1.5" />}
          Exportar Excel
        </Button>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-x-auto">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold">Movimientos ({movsData?.total ?? 0})</h3>
        </div>
        {loadingMovs ? (
          <p className="text-sm text-muted-foreground p-4">Cargando…</p>
        ) : movimientos.length === 0 ? (
          <p className="text-sm text-muted-foreground p-4">Sin movimientos registrados.</p>
        ) : (
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="text-left py-2 px-3">Fecha</th>
                <th className="text-left py-2 px-3">Tipo</th>
                <th className="text-left py-2 px-3">Concepto</th>
                <th className="text-right py-2 px-3">Debe</th>
                <th className="text-right py-2 px-3">Haber</th>
                <th className="text-right py-2 px-3">Saldo</th>
                <th className="text-left py-2 px-3">Moneda</th>
                <th className="text-left py-2 px-3">T/C</th>
                <th className="text-left py-2 px-3">Doc.</th>
                <th className="py-2 px-3" />
              </tr>
            </thead>
            <tbody>
              {movimientos.map(m => (
                <FilaMovimiento key={m.id} m={m} onDelete={() => handleDelete(m.id)} deleting={deletingId === m.id} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={showNuevo} onOpenChange={setShowNuevo}>
        <DialogContent className="sm:max-w-xl">
          <NuevoMovimientoDialog cuenta={cuenta} onClose={() => setShowNuevo(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
