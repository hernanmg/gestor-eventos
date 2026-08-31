import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus, Trash2, AlertTriangle, Download, Eye, Loader2, FileText,
  ExternalLink, XCircle, Ban, Pencil,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  useFacturaEmitida, useUpdateFacturaEmitida, useAnularFacturaEmitida, useMarcarIncobrable,
  useEliminarCobro, useUploadPdfFacturaEmitida, type FacturaEmitidaPayload,
} from '@/hooks/useFacturasEmitidas';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { FacturaEmitidaEstadoBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import MonedaTasaCambio from '@/components/ui/MonedaTasaCambio';
import RegistrarCobroDialog from './RegistrarCobroDialog';
import { TIPO_COMPROBANTE_LABEL, CONDICION_CLIENTE_LABEL, FORMAS_PAGO } from './labels';
import api from '@/lib/api';
import { formatCurrency } from '@/lib/formatters';
import type { CobroFacturaEmitida, CondicionCliente, Moneda, TipoComprobanteEmitido } from '@/types';
import { cn } from '@/lib/utils';

function fmt(date: string | null | undefined) {
  if (!date) return '—';
  return format(new Date(date), 'dd/MM/yyyy', { locale: es });
}

function Row({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <>
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value ?? '—'}</span>
    </>
  );
}

async function fetchPdfBlob(facturaId: number): Promise<Blob> {
  const res = await api.get(`/facturas-emitidas/${facturaId}/pdf`, { responseType: 'blob' });
  return new Blob([res.data], { type: 'application/pdf' });
}

// ── Edición inline (solo estado EMITIDA sin cobros — mismo gate que el backend) ─

function EditForm({ facturaId, onDone }: { facturaId: number; onDone: () => void }) {
  const { data: f } = useFacturaEmitida(facturaId);
  const updateMut = useUpdateFacturaEmitida(facturaId);
  const [form, setForm] = useState(() => ({
    tipo_comprobante:  (f?.tipo_comprobante ?? 'FACTURA_A') as TipoComprobanteEmitido,
    punto_venta:       String(f?.punto_venta ?? 1),
    numero:            f?.numero ?? '',
    fecha_emision:     f?.fecha_emision?.slice(0, 10) ?? '',
    fecha_vencimiento: f?.fecha_vencimiento?.slice(0, 10) ?? '',
    concepto:          f?.concepto ?? '',
    cliente_nombre:    f?.cliente_nombre ?? '',
    cliente_cuit:       f?.cliente_cuit ?? '',
    condicion_cliente: (f?.condicion_cliente ?? '') as CondicionCliente | '',
    neto_gravado:       f?.neto_gravado != null ? String(f.neto_gravado) : '',
    iva:                f?.iva != null ? String(f.iva) : '',
    otros_impuestos:     f?.otros_impuestos != null ? String(f.otros_impuestos) : '',
    total:               String(f?.total ?? ''),
    moneda:              (f?.moneda ?? 'ARS') as Moneda,
    tasa_cambio:          f?.tasa_cambio != null ? String(f.tasa_cambio) : '',
    forma_pago:           f?.forma_pago ?? '',
    observaciones:        f?.observaciones ?? '',
  }));
  const [error, setError] = useState<string | null>(null);
  const input = 'w-full border border-input rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring';
  const label = 'block text-xs font-medium text-muted-foreground mb-0.5';

  if (!f) return <p className="text-sm text-muted-foreground">Cargando…</p>;

  const handleSave = async () => {
    setError(null);
    const payload: Partial<FacturaEmitidaPayload> = {
      tipo_comprobante:  form.tipo_comprobante,
      punto_venta:        Number(form.punto_venta) || 1,
      numero:              form.numero || null,
      fecha_emision:       form.fecha_emision,
      fecha_vencimiento:   form.fecha_vencimiento || null,
      concepto:            form.concepto || null,
      cliente_nombre:      form.cliente_nombre,
      cliente_cuit:         form.cliente_cuit || null,
      condicion_cliente:   form.condicion_cliente || null,
      neto_gravado:        form.neto_gravado     ? Number(form.neto_gravado)     : null,
      iva:                 form.iva               ? Number(form.iva)             : null,
      otros_impuestos:     form.otros_impuestos   ? Number(form.otros_impuestos) : null,
      total:               Number(form.total),
      moneda:              form.moneda,
      tasa_cambio:         form.moneda !== 'ARS' && form.tasa_cambio ? Number(form.tasa_cambio) : null,
      forma_pago:          form.forma_pago || null,
      observaciones:       form.observaciones || null,
    };
    try {
      await updateMut.mutateAsync(payload);
      onDone();
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Error al guardar los cambios');
    }
  };

  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-3">
      <h3 className="text-sm font-semibold">Editar factura</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <div>
          <label className={label}>Tipo de comprobante</label>
          <select value={form.tipo_comprobante} onChange={e => setForm(x => ({ ...x, tipo_comprobante: e.target.value as TipoComprobanteEmitido }))} className={input}>
            {Object.entries(TIPO_COMPROBANTE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className={label}>Número</label>
          <input value={form.numero} onChange={e => setForm(x => ({ ...x, numero: e.target.value }))} className={input} />
        </div>
        <div>
          <label className={label}>Fecha de emisión</label>
          <input type="date" value={form.fecha_emision} onChange={e => setForm(x => ({ ...x, fecha_emision: e.target.value }))} className={input} />
        </div>
        <div>
          <label className={label}>Fecha de vencimiento</label>
          <input type="date" value={form.fecha_vencimiento} onChange={e => setForm(x => ({ ...x, fecha_vencimiento: e.target.value }))} className={input} />
        </div>
        <div className="sm:col-span-2">
          <label className={label}>Cliente</label>
          <input value={form.cliente_nombre} onChange={e => setForm(x => ({ ...x, cliente_nombre: e.target.value }))} className={input} />
        </div>
        <div>
          <label className={label}>CUIT</label>
          <input value={form.cliente_cuit} onChange={e => setForm(x => ({ ...x, cliente_cuit: e.target.value }))} className={input} />
        </div>
        <div>
          <label className={label}>Condición ante AFIP</label>
          <select value={form.condicion_cliente} onChange={e => setForm(x => ({ ...x, condicion_cliente: e.target.value as CondicionCliente }))} className={input}>
            <option value="">Sin especificar</option>
            {Object.entries(CONDICION_CLIENTE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className={label}>Neto gravado</label>
          <input type="number" value={form.neto_gravado} onChange={e => setForm(x => ({ ...x, neto_gravado: e.target.value }))} className={input} />
        </div>
        <div>
          <label className={label}>IVA</label>
          <input type="number" value={form.iva} onChange={e => setForm(x => ({ ...x, iva: e.target.value }))} className={input} />
        </div>
        <div>
          <label className={label}>Otros impuestos</label>
          <input type="number" value={form.otros_impuestos} onChange={e => setForm(x => ({ ...x, otros_impuestos: e.target.value }))} className={input} />
        </div>
        <div>
          <label className={label}>Total</label>
          <input type="number" value={form.total} onChange={e => setForm(x => ({ ...x, total: e.target.value }))} className={input} />
        </div>
        <div>
          <label className={label}>Moneda</label>
          <MonedaTasaCambio
            moneda={form.moneda} monto={Number(form.total) || 0} tasaCambio={form.tasa_cambio}
            onMonedaChange={m => setForm(x => ({ ...x, moneda: m }))}
            onTasaChange={t => setForm(x => ({ ...x, tasa_cambio: t }))}
          />
        </div>
        <div>
          <label className={label}>Forma de pago</label>
          <select value={form.forma_pago} onChange={e => setForm(x => ({ ...x, forma_pago: e.target.value }))} className={input}>
            <option value="">Sin especificar</option>
            {FORMAS_PAGO.map(fp => <option key={fp} value={fp}>{fp}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className={label}>Concepto</label>
          <textarea value={form.concepto} onChange={e => setForm(x => ({ ...x, concepto: e.target.value }))} rows={2} className={cn(input, 'resize-none')} />
        </div>
        <div className="sm:col-span-2">
          <label className={label}>Observaciones</label>
          <textarea value={form.observaciones} onChange={e => setForm(x => ({ ...x, observaciones: e.target.value }))} rows={2} className={cn(input, 'resize-none')} />
        </div>
      </div>
      {error && <p className="flex items-center gap-1.5 text-sm text-destructive"><AlertTriangle size={14} />{error}</p>}
      <div className="flex justify-end gap-2 pt-2 border-t border-border">
        <Button variant="outline" size="sm" onClick={onDone} disabled={updateMut.isPending}>Cancelar</Button>
        <Button size="sm" onClick={handleSave} disabled={updateMut.isPending}>{updateMut.isPending ? 'Guardando…' : 'Guardar cambios'}</Button>
      </div>
    </div>
  );
}

// ── Fila de cobro ─────────────────────────────────────────────────────────────

function FilaCobro({ cobro, moneda }: { cobro: CobroFacturaEmitida; moneda: Moneda }) {
  const [confirming, setConfirming] = useState(false);
  const eliminarMut = useEliminarCobro();

  const handleEliminar = async () => {
    try {
      await eliminarMut.mutateAsync(cobro.id);
    } catch (err: any) {
      alert(err?.response?.data?.error ?? 'Error al eliminar el cobro');
    }
  };

  return (
    <tr className="border-b border-border last:border-0 text-sm">
      <td className="py-2 px-3">{fmt(cobro.fecha)}</td>
      <td className="py-2 px-3 font-medium">{formatCurrency(cobro.monto, moneda)}</td>
      <td className="py-2 px-3">{cobro.forma_cobro ?? '—'}</td>
      <td className="py-2 px-3 text-muted-foreground">{cobro.cuenta_destino?.nombre ?? '—'}</td>
      <td className="py-2 px-3 text-muted-foreground">{cobro.referencia ?? '—'}</td>
      <td className="py-2 px-3 text-right">
        {confirming ? (
          <span className="flex items-center justify-end gap-1.5">
            <button onClick={handleEliminar} disabled={eliminarMut.isPending} className="text-xs text-destructive hover:underline">Confirmar</button>
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

// ── Detalle (drawer = Dialog ancho, sin primitiva de Sheet en este codebase) ──

interface Props {
  facturaId: number;
  onClose:   () => void;
}

export default function FacturaEmitidaDetalle({ facturaId, onClose }: Props) {
  const { data: factura, isLoading } = useFacturaEmitida(facturaId);
  const anularMut     = useAnularFacturaEmitida();
  const incobrableMut = useMarcarIncobrable();
  const uploadPdf      = useUploadPdfFacturaEmitida(facturaId);

  const [editing,      setEditing]      = useState(false);
  const [showCobrar,   setShowCobrar]   = useState(false);
  const [loadingPDF,   setLoadingPDF]   = useState(false);
  const [pdfError,     setPdfError]     = useState<string | null>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  return (
    <Dialog open onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-3xl">
        {isLoading || !factura ? (
          <p className="text-sm text-muted-foreground p-4">Cargando…</p>
        ) : (
          <div className="space-y-5">
            {/* Header */}
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <h2 className="text-lg font-semibold">
                  {TIPO_COMPROBANTE_LABEL[factura.tipo_comprobante]} {String(factura.punto_venta).padStart(4, '0')}-{factura.numero ?? '—'}
                </h2>
                <p className="text-sm text-muted-foreground flex items-center gap-1.5 flex-wrap">
                  {factura.cliente_nombre}
                  {factura.evento && (
                    <Link to={`/eventos/${factura.evento_id}`} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                      <ExternalLink size={11} /> {factura.evento.nombre}
                    </Link>
                  )}
                </p>
              </div>
              <FacturaEmitidaEstadoBadge estado={factura.estado} />
            </div>

            {/* Acciones */}
            <div className="flex flex-wrap gap-2">
              {factura.estado !== 'COBRADA' && factura.estado !== 'ANULADA' && (
                <Button size="sm" onClick={() => setShowCobrar(true)}>
                  <Plus size={14} className="mr-1.5" /> Registrar cobro
                </Button>
              )}
              {factura.estado === 'EMITIDA' && factura.cantidad_cobros === 0 && !editing && (
                <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                  <Pencil size={14} className="mr-1.5" /> Editar
                </Button>
              )}
              {factura.cantidad_cobros === 0 && factura.estado !== 'ANULADA' && (
                <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10"
                  onClick={() => { if (confirm('¿Anular esta factura?')) anularMut.mutate(facturaId); }}
                  disabled={anularMut.isPending}
                >
                  <XCircle size={14} className="mr-1.5" /> Anular
                </Button>
              )}
              {(factura.estado === 'EMITIDA' || factura.estado === 'COBRADA_PARCIAL') && (
                <Button size="sm" variant="ghost" className="text-muted-foreground hover:bg-accent"
                  onClick={() => { if (confirm('¿Marcar esta factura como incobrable?')) incobrableMut.mutate(facturaId); }}
                  disabled={incobrableMut.isPending}
                >
                  <Ban size={14} className="mr-1.5" /> Marcar incobrable
                </Button>
              )}
            </div>

            {editing ? (
              <EditForm facturaId={facturaId} onDone={() => setEditing(false)} />
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Datos */}
                <div className="space-y-4">
                  <div className="bg-card border border-border rounded-lg p-4 grid grid-cols-2 gap-x-6 gap-y-2.5 text-sm">
                    <Row label="Cliente"      value={factura.cliente_nombre} />
                    <Row label="CUIT"         value={factura.cliente_cuit} />
                    <Row label="Condición"    value={factura.condicion_cliente ? CONDICION_CLIENTE_LABEL[factura.condicion_cliente] : null} />
                    <Row label="Comprobante"  value={TIPO_COMPROBANTE_LABEL[factura.tipo_comprobante]} />
                    <Row label="Emisión"      value={fmt(factura.fecha_emision)} />
                    <Row label="Vencimiento"  value={fmt(factura.fecha_vencimiento)} />
                    <Row label="Moneda"       value={factura.moneda} />
                    <Row label="Forma de pago" value={factura.forma_pago} />
                    <Row label="Concepto"     value={factura.concepto} />
                  </div>

                  <div className="bg-card border border-border rounded-lg p-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total</span>
                      <span className="font-medium">{formatCurrency(factura.total, factura.moneda)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Cobrado</span>
                      <span className="font-medium text-green-700">{formatCurrency(factura.total_cobrado, factura.moneda)}</span>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <span className="font-medium">Saldo pendiente</span>
                      <span className={cn('font-semibold', factura.saldo_pendiente > 0 ? 'text-orange-600' : 'text-green-700')}>
                        {formatCurrency(factura.saldo_pendiente, factura.moneda)}
                      </span>
                    </div>
                  </div>

                  {factura.observaciones && (
                    <div className="bg-muted/30 rounded p-3 text-sm">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Observaciones</p>
                      <p className="whitespace-pre-wrap">{factura.observaciones}</p>
                    </div>
                  )}

                  {/* Reparto */}
                  {factura.repartos && factura.repartos.length > 0 && (
                    <div className="bg-card border border-border rounded-lg overflow-hidden">
                      <div className="px-4 py-2.5 border-b border-border">
                        <h3 className="text-sm font-semibold">Reparto entre razones sociales</h3>
                      </div>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border text-xs text-muted-foreground">
                            <th className="text-left py-1.5 px-3">Razón social</th>
                            <th className="text-left py-1.5 px-3">CUIT</th>
                            <th className="text-left py-1.5 px-3">%</th>
                            <th className="text-left py-1.5 px-3">Monto</th>
                          </tr>
                        </thead>
                        <tbody>
                          {factura.repartos.map(r => (
                            <tr key={r.id} className="border-b border-border last:border-0">
                              <td className="py-1.5 px-3">{r.razon_social}</td>
                              <td className="py-1.5 px-3 text-muted-foreground">{r.cuit ?? '—'}</td>
                              <td className="py-1.5 px-3">{r.porcentaje}%</td>
                              <td className="py-1.5 px-3 font-medium">{formatCurrency(r.monto, factura.moneda)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* PDF */}
                <div>
                  {factura.pdf_nombre ? (
                    <div className="bg-card border border-border rounded-lg p-4 flex flex-col gap-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-50 border border-red-100">
                          <FileText size={20} className="text-red-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{factura.pdf_nombre}</p>
                          {factura.pdf_tamanio && <p className="text-xs text-muted-foreground">{(factura.pdf_tamanio / 1024).toFixed(0)} KB</p>}
                        </div>
                      </div>
                      {pdfError && <p className="flex items-center gap-1.5 text-xs text-destructive"><AlertTriangle size={12} /> {pdfError}</p>}
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1" disabled={loadingPDF}
                          onClick={async () => {
                            setPdfError(null); setLoadingPDF(true);
                            try {
                              const blob = await fetchPdfBlob(facturaId);
                              const url  = URL.createObjectURL(blob);
                              window.open(url, '_blank');
                              setTimeout(() => URL.revokeObjectURL(url), 30_000);
                            } catch { setPdfError('No se pudo cargar el PDF'); } finally { setLoadingPDF(false); }
                          }}
                        >
                          {loadingPDF ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : <Eye size={14} className="mr-1.5" />} Ver PDF
                        </Button>
                        <Button variant="outline" size="sm" className="flex-1" disabled={loadingPDF}
                          onClick={async () => {
                            setPdfError(null); setLoadingPDF(true);
                            try {
                              const blob = await fetchPdfBlob(facturaId);
                              const url  = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url; a.download = factura.pdf_nombre ?? 'factura.pdf';
                              document.body.appendChild(a); a.click(); document.body.removeChild(a);
                              setTimeout(() => URL.revokeObjectURL(url), 5_000);
                            } catch { setPdfError('No se pudo descargar el PDF'); } finally { setLoadingPDF(false); }
                          }}
                        >
                          <Download size={14} className="mr-1.5" /> Descargar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border bg-card p-8 text-sm text-muted-foreground">
                      <FileText size={24} className="text-muted-foreground/50" />
                      <div className="text-center">
                        <p className="font-medium">Sin PDF adjunto</p>
                        <p className="text-xs mt-0.5">Adjuntá el PDF de la factura</p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => pdfInputRef.current?.click()} disabled={uploadPdf.isPending}>
                        {uploadPdf.isPending ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : null}
                        {uploadPdf.isPending ? 'Subiendo…' : 'Adjuntar PDF'}
                      </Button>
                      {/*
                        Input ligado a un botón explícito (useRef + click programático)
                        en vez de un <label> flotando sobre un área grande — ver nota
                        en RegistrarCobroDialog.tsx sobre por qué un elemento clicable
                        "de fondo" acá terminaba interceptando el dialog de cobro que
                        se abre encima.
                      */}
                      <input
                        ref={pdfInputRef}
                        type="file" accept="application/pdf" className="hidden"
                        onChange={e => { const f = e.target.files?.[0]; if (f) uploadPdf.mutate(f); e.target.value = ''; }}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Cobros */}
            {!editing && (
              <div className="bg-card border border-border rounded-lg overflow-hidden">
                <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Historial de cobros ({factura.cantidad_cobros})</h3>
                  {factura.estado !== 'COBRADA' && factura.estado !== 'ANULADA' && (
                    <Button size="sm" onClick={() => setShowCobrar(true)}>
                      <Plus size={14} className="mr-1" /> Registrar cobro
                    </Button>
                  )}
                </div>
                {!factura.cobros || factura.cobros.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-4">Sin cobros registrados.</p>
                ) : (
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border text-xs text-muted-foreground">
                        <th className="text-left py-2 px-3">Fecha</th>
                        <th className="text-left py-2 px-3">Monto</th>
                        <th className="text-left py-2 px-3">Forma</th>
                        <th className="text-left py-2 px-3">Cuenta destino</th>
                        <th className="text-left py-2 px-3">Referencia</th>
                        <th className="py-2 px-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {factura.cobros.map(c => <FilaCobro key={c.id} cobro={c} moneda={factura.moneda} />)}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        )}
      </DialogContent>

      {showCobrar && factura && (
        <RegistrarCobroDialog
          facturaId={facturaId}
          saldoPendiente={factura.saldo_pendiente}
          moneda={factura.moneda}
          onClose={() => setShowCobrar(false)}
        />
      )}
    </Dialog>
  );
}
