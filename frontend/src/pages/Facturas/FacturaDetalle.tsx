import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, FileText, Plus, Trash2, AlertTriangle,
  CheckCircle, Clock, XCircle, Ban, ExternalLink, Download,
  Eye, Loader2,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  useFactura,
  useAprobarFactura,
  useAnularFactura,
  usePagarFactura,
  useAnularPago,
  useUploadPDF,
  type PagoPayload,
} from '@/hooks/useFacturas';
import { Button } from '@/components/ui/button';
import MoneyInput from '@/components/ui/MoneyInput';
import api from '@/lib/api';
import type { EstadoFactura, MedioPago, PagoFactura } from '@/types';
import { formatCurrency } from '@/lib/formatters';
import { cn } from '@/lib/utils';

// ── Estado badge ───────────────────────────────────────────────────────────────

const ESTADO_META: Record<EstadoFactura, { label: string; cls: string; Icon: any }> = {
  RECIBIDA: { label: 'Recibida', cls: 'bg-blue-100 text-blue-800',    Icon: Clock },
  APROBADA: { label: 'Aprobada', cls: 'bg-yellow-100 text-yellow-800', Icon: CheckCircle },
  PAGADA:   { label: 'Pagada',   cls: 'bg-green-100 text-green-800',  Icon: CheckCircle },
  ANULADA:  { label: 'Anulada',  cls: 'bg-red-100 text-red-800',     Icon: Ban },
};

const MEDIO_LABEL: Record<MedioPago, string> = {
  TRANSFERENCIA: 'Transferencia',
  ECHEQ:         'Echeq',
  EFECTIVO:      'Efectivo',
  CHEQUE:        'Cheque',
};

function fmt(date: string | null | undefined) {
  if (!date) return '—';
  return format(new Date(date), 'dd/MM/yyyy', { locale: es });
}

// ── Dialog pagar ──────────────────────────────────────────────────────────────

interface PagarDialogProps {
  facturaId:        number;
  importePendiente: number;
  moneda:           string;
  onClose:          () => void;
}

function PagarDialog({ facturaId, importePendiente, moneda, onClose }: PagarDialogProps) {
  const [form, setForm] = useState({
    fecha_pago:                  format(new Date(), 'yyyy-MM-dd'),
    importe:                     String(importePendiente),
    medio_pago:                  'TRANSFERENCIA' as MedioPago,
    referencia:                  '',
    notas:                       '',
    echeq_numero:                '',
    echeq_fecha_cobro_estimada:  '',
  });
  const [error,  setError]  = useState<string | null>(null);
  const pagarMut = usePagarFactura(facturaId);

  const input = 'w-full border border-input rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring';
  const label = 'block text-xs font-medium text-muted-foreground mb-0.5';

  const handleSubmit = async () => {
    setError(null);
    const importe = Number(form.importe);
    if (!importe || importe <= 0)           { setError('El importe debe ser mayor a 0'); return; }
    if (importe > importePendiente + 0.001) { setError(`No puede superar el pendiente (${formatCurrency(importePendiente, moneda as any)})`); return; }
    if (!form.fecha_pago)                   { setError('La fecha es obligatoria'); return; }
    if (form.medio_pago === 'ECHEQ' && !form.echeq_numero) { setError('El N° de Echeq es obligatorio'); return; }

    const payload: PagoPayload = {
      fecha_pago:                 form.fecha_pago,
      importe,
      medio_pago:                 form.medio_pago,
      referencia:                 form.referencia || undefined,
      notas:                      form.notas      || undefined,
      echeq_numero:               form.echeq_numero || undefined,
      echeq_fecha_cobro_estimada: form.echeq_fecha_cobro_estimada || undefined,
    };

    try {
      await pagarMut.mutateAsync(payload);
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Error al registrar el pago');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md space-y-4">
        <h3 className="text-base font-semibold">Registrar pago</h3>
        <p className="text-sm text-muted-foreground">
          Pendiente: <span className="font-medium text-foreground">{formatCurrency(importePendiente, moneda as any)}</span>
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Fecha *</label>
            <input type="date" value={form.fecha_pago} onChange={e => setForm(f => ({ ...f, fecha_pago: e.target.value }))} className={input} />
          </div>
          <div>
            <label className={label}>Importe *</label>
            <MoneyInput value={form.importe} onChange={v => setForm(f => ({ ...f, importe: v }))} className={input} />
          </div>
          <div className="col-span-2">
            <label className={label}>Medio de pago *</label>
            <select value={form.medio_pago} onChange={e => setForm(f => ({ ...f, medio_pago: e.target.value as MedioPago }))} className={input}>
              {Object.entries(MEDIO_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          {form.medio_pago === 'ECHEQ' && <>
            <div className="col-span-2">
              <label className={label}>N° Echeq *</label>
              <input value={form.echeq_numero} onChange={e => setForm(f => ({ ...f, echeq_numero: e.target.value }))} className={input} />
            </div>
            <div className="col-span-2">
              <label className={label}>Fecha cobro estimada</label>
              <input type="date" value={form.echeq_fecha_cobro_estimada} onChange={e => setForm(f => ({ ...f, echeq_fecha_cobro_estimada: e.target.value }))} className={input} />
            </div>
          </>}
          <div className="col-span-2">
            <label className={label}>Referencia</label>
            <input value={form.referencia} onChange={e => setForm(f => ({ ...f, referencia: e.target.value }))} className={input} />
          </div>
          <div className="col-span-2">
            <label className={label}>Notas</label>
            <textarea value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} rows={2} className={cn(input, 'resize-none')} />
          </div>
        </div>

        {error && <p className="flex items-center gap-1.5 text-sm text-destructive"><AlertTriangle size={14} />{error}</p>}

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button variant="outline" size="sm" onClick={onClose} disabled={pagarMut.isPending}>Cancelar</Button>
          <Button size="sm" onClick={handleSubmit} disabled={pagarMut.isPending}>
            {pagarMut.isPending ? 'Registrando…' : 'Confirmar pago'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Fila de pago ──────────────────────────────────────────────────────────────

function FilaPago({ pago, moneda }: { pago: PagoFactura; moneda: string }) {
  const [confirming, setConfirming] = useState(false);
  const anularMut  = useAnularPago();
  const echeqCobrado = pago.echeq?.estado === 'COBRADO';

  const handleAnular = async () => {
    try {
      await anularMut.mutateAsync(pago.id);
    } catch (err: any) {
      alert(err?.response?.data?.error ?? 'Error al anular el pago');
    }
  };

  return (
    <tr className="border-b border-border last:border-0 text-sm">
      <td className="py-2 px-3">{fmt(pago.fecha_pago)}</td>
      <td className="py-2 px-3 font-medium">{formatCurrency(pago.importe, moneda as any)}</td>
      <td className="py-2 px-3">{MEDIO_LABEL[pago.medio_pago] ?? pago.medio_pago}</td>
      <td className="py-2 px-3 text-muted-foreground">{pago.referencia ?? '—'}</td>
      <td className="py-2 px-3 text-muted-foreground">{pago.movimiento?.rubro?.nombre ?? '—'}</td>
      <td className="py-2 px-3">
        {pago.echeq ? (
          <span className={cn('inline-flex items-center gap-1 text-xs rounded-full px-2 py-0.5 font-medium',
            pago.echeq.estado === 'COBRADO'   ? 'bg-green-100 text-green-800'  :
            pago.echeq.estado === 'RECHAZADO' ? 'bg-red-100 text-red-800'      :
            'bg-yellow-100 text-yellow-800')}>
            {pago.echeq.estado} #{pago.echeq.numero}
          </span>
        ) : '—'}
      </td>
      <td className="py-2 px-3 text-right">
        {!pago.deleted_at && (
          confirming ? (
            <span className="flex items-center justify-end gap-1.5">
              {echeqCobrado
                ? <span className="text-xs text-muted-foreground">Echeq COBRADO — no anulable</span>
                : <button onClick={handleAnular} disabled={anularMut.isPending} className="text-xs text-destructive hover:underline">Confirmar</button>
              }
              <button onClick={() => setConfirming(false)} className="text-xs text-muted-foreground hover:underline">Cancelar</button>
            </span>
          ) : (
            <button
              onClick={() => setConfirming(true)}
              disabled={echeqCobrado}
              title={echeqCobrado ? 'No se puede anular: Echeq COBRADO' : 'Anular pago'}
              className={cn('p-1 rounded hover:bg-destructive/10', echeqCobrado ? 'opacity-30 cursor-not-allowed' : 'text-destructive')}
            >
              <Trash2 size={14} />
            </button>
          )
        )}
        {pago.deleted_at && <span className="text-xs text-muted-foreground italic">Anulado</span>}
      </td>
    </tr>
  );
}

// ── Row helper ────────────────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <>
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value ?? '—'}</span>
    </>
  );
}

// ── PDF helpers ───────────────────────────────────────────────────────────────

async function fetchPdfBlob(facturaId: number): Promise<Blob> {
  const res = await api.get(`/facturas/${facturaId}/pdf`, { responseType: 'blob' });
  return new Blob([res.data], { type: 'application/pdf' });
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function FacturaDetalle() {
  const { id }      = useParams<{ id: string }>();
  const navigate    = useNavigate();
  const facturaId   = Number(id);

  const [showPagar,   setShowPagar]   = useState(false);
  const [loadingPDF,  setLoadingPDF]  = useState(false);
  const [pdfError,    setPdfError]    = useState<string | null>(null);

  const { data: factura, isLoading, error } = useFactura(facturaId);
  const aprobarMut  = useAprobarFactura();
  const anularMut   = useAnularFactura();
  const uploadPDF   = useUploadPDF(facturaId);

  if (isLoading) return <div className="p-8 text-sm text-muted-foreground">Cargando…</div>;
  if (error || !factura) return <div className="p-8 text-sm text-destructive">No se encontró la factura.</div>;

  const meta    = ESTADO_META[factura.estado];
  const hasPdf  = !!factura.pdf_nombre;

  const rubroNombre = factura.rubro?.nombre ?? '— (sin egreso automático)';

  const canApprove = factura.estado === 'RECIBIDA';
  const canPagar   = factura.estado === 'APROBADA' && factura.importe_pendiente > 0;
  const canAnular  = factura.estado !== 'PAGADA' && factura.estado !== 'ANULADA';

  const pagosActivos = factura.pagos?.filter(p => !p.deleted_at) ?? [];

  // Abrir PDF en nueva pestaña — solo al hacer click
  const handleVerPDF = async () => {
    setPdfError(null);
    setLoadingPDF(true);
    try {
      const blob = await fetchPdfBlob(facturaId);
      const url  = URL.createObjectURL(blob);
      const tab  = window.open(url, '_blank');
      if (!tab) {
        // Fallback si el browser bloqueó el popup
        const a = document.createElement('a');
        a.href = url; a.download = factura.pdf_nombre ?? 'factura.pdf';
        a.click();
      }
      // Revocar después de que el browser cargó el PDF
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch {
      setPdfError('No se pudo cargar el PDF');
    } finally {
      setLoadingPDF(false);
    }
  };

  // Descargar con nombre original del archivo
  const handleDescargarPDF = async () => {
    setPdfError(null);
    setLoadingPDF(true);
    try {
      const blob = await fetchPdfBlob(facturaId);
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url;
      a.download = factura.pdf_nombre ?? 'factura.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 5_000);
    } catch {
      setPdfError('No se pudo descargar el PDF');
    } finally {
      setLoadingPDF(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button onClick={() => navigate(-1)} className="mt-0.5 text-muted-foreground hover:text-foreground">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold">
            Factura {factura.tipo_factura} {factura.numero_factura}
          </h1>
          <p className="text-sm text-muted-foreground flex items-center gap-1.5 flex-wrap">
            {factura.proveedor?.nombre} — {factura.evento?.nombre}
            {factura.rubro && (
              <span className="inline-flex items-center text-xs font-medium rounded-full px-2 py-0.5 bg-secondary text-secondary-foreground">
                {factura.rubro.nombre}
              </span>
            )}
          </p>
        </div>
        <span className={cn('inline-flex items-center gap-1 text-xs font-medium rounded-full px-2.5 py-1', meta.cls)}>
          <meta.Icon size={12} />
          {meta.label}
        </span>
      </div>

      {/* Acciones */}
      <div className="flex flex-wrap gap-2">
        {canApprove && (
          <Button size="sm" variant="outline" onClick={() => aprobarMut.mutate(facturaId)} disabled={aprobarMut.isPending}>
            <CheckCircle size={14} className="mr-1.5" /> Aprobar
          </Button>
        )}
        {canPagar && (
          <Button size="sm" onClick={() => setShowPagar(true)}>
            <Plus size={14} className="mr-1.5" /> Registrar pago
          </Button>
        )}
        {canAnular && (
          <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10"
            onClick={() => { if (confirm('¿Anular esta factura?')) anularMut.mutate(facturaId); }}
            disabled={anularMut.isPending}
          >
            <XCircle size={14} className="mr-1.5" /> Anular
          </Button>
        )}
        {factura.evento && (
          <Link to={`/eventos/${factura.evento_id}`} className="ml-auto">
            <Button size="sm" variant="ghost" className="text-muted-foreground">
              <ExternalLink size={14} className="mr-1.5" /> Ver evento
            </Button>
          </Link>
        )}
      </div>

      {/* Datos + PDF */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Columna izquierda — Info */}
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-lg p-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <Row label="Proveedor"   value={factura.proveedor?.nombre} />
            <Row label="Evento"      value={factura.evento?.nombre} />
            <Row label="Tipo"        value={`Tipo ${factura.tipo_factura}`} />
            <Row label="N° factura"  value={factura.numero_factura} />
            <Row label="Emisión"     value={fmt(factura.fecha_emision)} />
            <Row label="Vencimiento" value={fmt(factura.fecha_vencimiento)} />
            <Row label="Moneda"      value={factura.moneda} />
            <Row label="Condición"   value={factura.condicion_pago} />
            <Row label="Rubro"       value={rubroNombre} />
          </div>

          {/* Importes */}
          <div className="bg-card border border-border rounded-lg p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total</span>
              <span className="font-medium">{formatCurrency(factura.importe_total, factura.moneda)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Pagado</span>
              <span className="font-medium text-green-700">{formatCurrency(factura.importe_pagado, factura.moneda)}</span>
            </div>
            <div className="flex justify-between border-t pt-2">
              <span className="font-medium">Pendiente</span>
              <span className={cn('font-semibold', factura.importe_pendiente > 0 ? 'text-orange-600' : 'text-green-700')}>
                {formatCurrency(factura.importe_pendiente, factura.moneda)}
              </span>
            </div>
          </div>

          {factura.notas && (
            <div className="bg-muted/30 rounded p-3 text-sm">
              <p className="text-xs font-medium text-muted-foreground mb-1">Notas</p>
              <p className="whitespace-pre-wrap">{factura.notas}</p>
            </div>
          )}
        </div>

        {/* Columna derecha — PDF card */}
        <div>
          {hasPdf ? (
            <div className="bg-card border border-border rounded-lg p-4 flex flex-col gap-4">
              {/* Info del archivo */}
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-50 border border-red-100">
                  <FileText size={20} className="text-red-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{factura.pdf_nombre}</p>
                  {factura.pdf_tamanio && (
                    <p className="text-xs text-muted-foreground">
                      {(factura.pdf_tamanio / 1024).toFixed(0)} KB
                    </p>
                  )}
                </div>
              </div>

              {pdfError && (
                <p className="flex items-center gap-1.5 text-xs text-destructive">
                  <AlertTriangle size={12} /> {pdfError}
                </p>
              )}

              {/* Botones */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={handleVerPDF}
                  disabled={loadingPDF}
                >
                  {loadingPDF
                    ? <Loader2 size={14} className="mr-1.5 animate-spin" />
                    : <Eye size={14} className="mr-1.5" />}
                  Ver PDF
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={handleDescargarPDF}
                  disabled={loadingPDF}
                >
                  <Download size={14} className="mr-1.5" />
                  Descargar
                </Button>
              </div>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border bg-card p-8 cursor-pointer text-sm text-muted-foreground hover:border-primary/40 transition-colors">
              <FileText size={24} className="text-muted-foreground/50" />
              <div className="text-center">
                <p className="font-medium">Sin PDF adjunto</p>
                <p className="text-xs mt-0.5">Hacé clic para adjuntar un PDF</p>
              </div>
              <input
                type="file"
                accept="application/pdf"
                className="sr-only"
                onChange={e => { const f = e.target.files?.[0]; if (f) uploadPDF.mutate(f); }}
              />
              {uploadPDF.isPending && (
                <span className="flex items-center gap-1.5 text-xs text-primary">
                  <Loader2 size={12} className="animate-spin" /> Subiendo…
                </span>
              )}
            </label>
          )}
        </div>
      </div>

      {/* Pagos */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-semibold">Pagos ({pagosActivos.length})</h3>
          {canPagar && (
            <Button size="sm" onClick={() => setShowPagar(true)}>
              <Plus size={14} className="mr-1" /> Pagar
            </Button>
          )}
        </div>
        {pagosActivos.length === 0 ? (
          <p className="text-sm text-muted-foreground p-4">Sin pagos registrados.</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="text-left py-2 px-3">Fecha</th>
                <th className="text-left py-2 px-3">Importe</th>
                <th className="text-left py-2 px-3">Medio</th>
                <th className="text-left py-2 px-3">Referencia</th>
                <th className="text-left py-2 px-3">Rubro</th>
                <th className="text-left py-2 px-3">Echeq</th>
                <th className="py-2 px-3" />
              </tr>
            </thead>
            <tbody>
              {pagosActivos.map(p => <FilaPago key={p.id} pago={p} moneda={factura.moneda} />)}
            </tbody>
          </table>
        )}
      </div>

      {showPagar && (
        <PagarDialog
          facturaId={facturaId}
          importePendiente={factura.importe_pendiente}
          moneda={factura.moneda}
          onClose={() => setShowPagar(false)}
        />
      )}
    </div>
  );
}
