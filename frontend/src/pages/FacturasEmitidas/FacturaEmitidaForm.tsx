import { useState, useEffect } from 'react';
import { AlertTriangle, X, Plus, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { useCreateFacturaEmitida, useUploadPdfFacturaEmitida, type RepartoPayload } from '@/hooks/useFacturasEmitidas';
import { useEventos } from '@/hooks/useEvento';
import { Button } from '@/components/ui/button';
import MonedaTasaCambio from '@/components/ui/MonedaTasaCambio';
import ClienteCombobox from './ClienteCombobox';
import { TIPO_COMPROBANTE_LABEL, CONDICION_CLIENTE_LABEL, FORMAS_PAGO } from './labels';
import type { TipoComprobanteEmitido, CondicionCliente, Moneda } from '@/types';
import { cn } from '@/lib/utils';

interface Props {
  onClose:    () => void;
  // Cuando se abre desde la tab "A Cobrar" de un evento (ver Evento/index.tsx)
  // — precarga y bloquea el vínculo, en vez del combobox libre de "Vincular a evento".
  eventoId?:     number;
  eventoNombre?: string;
}

const inputCls = 'w-full border border-input rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring';
const labelCls = 'block text-xs font-medium text-muted-foreground mb-0.5';

// ── Paso 1 — Comprobante ──────────────────────────────────────────────────────

interface Paso1State {
  tipo_comprobante:   TipoComprobanteEmitido;
  punto_venta:        string;
  numero:             string;
  fecha_emision:      string;
  fecha_vencimiento:  string;
  concepto:           string;
}

function Paso1({ value, onChange, onNext, onCancel }: { value: Paso1State; onChange: (v: Paso1State) => void; onNext: () => void; onCancel: () => void }) {
  const [error, setError] = useState<string | null>(null);

  const next = () => {
    if (!value.fecha_emision) { setError('La fecha de emisión es obligatoria'); return; }
    setError(null);
    onNext();
  };

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold">Nueva factura emitida — Paso 1: Comprobante</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <label className={labelCls}>Tipo de comprobante *</label>
          <select value={value.tipo_comprobante} onChange={e => onChange({ ...value, tipo_comprobante: e.target.value as TipoComprobanteEmitido })} className={inputCls}>
            {Object.entries(TIPO_COMPROBANTE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Punto de venta</label>
          <input type="number" min={1} value={value.punto_venta} onChange={e => onChange({ ...value, punto_venta: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Número de factura</label>
          <input value={value.numero} onChange={e => onChange({ ...value, numero: e.target.value })} placeholder="00001234" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Fecha de emisión *</label>
          <input type="date" value={value.fecha_emision} onChange={e => onChange({ ...value, fecha_emision: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Fecha de vencimiento</label>
          <input type="date" value={value.fecha_vencimiento} onChange={e => onChange({ ...value, fecha_vencimiento: e.target.value })} className={inputCls} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>Concepto / descripción del servicio</label>
          <textarea value={value.concepto} onChange={e => onChange({ ...value, concepto: e.target.value })} rows={2} className={cn(inputCls, 'resize-none')} />
        </div>
      </div>
      {error && <p className="flex items-center gap-1.5 text-sm text-destructive"><AlertTriangle size={14} />{error}</p>}
      <div className="flex justify-end gap-2 pt-2 border-t border-border">
        <Button variant="outline" size="sm" onClick={onCancel}>Cancelar</Button>
        <Button size="sm" onClick={next}>Siguiente</Button>
      </div>
    </div>
  );
}

// ── Paso 2 — Cliente y montos ─────────────────────────────────────────────────

interface Paso2State {
  cliente_nombre:     string;
  cliente_cuit:        string;
  condicion_cliente:  CondicionCliente | '';
  neto_gravado:       string;
  iva:                string;
  otros_impuestos:    string;
  total:              string;
  totalManual:        boolean;
  moneda:             Moneda;
  tasa_cambio:        string;
  forma_pago:         string;
  evento_id:          string;
  tieneReparto:       boolean;
  repartos:           RepartoPayload[];
}

const PORCENTAJES_IVA = [21, 10.5, 27, 0];

function Paso2({
  value, onChange, onBack, onSubmit, pdfFile, onPdfChange, isPending, apiError, eventoId, eventoNombre,
}: {
  value:       Paso2State;
  onChange:    (v: Paso2State) => void;
  onBack:      () => void;
  onSubmit:    () => void;
  pdfFile:     File | null;
  onPdfChange: (f: File | null) => void;
  isPending:   boolean;
  apiError:    string | null;
  eventoId?:     number;
  eventoNombre?: string;
}) {
  const [error, setError]     = useState<string | null>(null);
  const { data: eventos = [] } = useEventos();

  const netoNum  = Number(value.neto_gravado) || 0;
  const ivaNum   = Number(value.iva) || 0;
  const otrosNum = Number(value.otros_impuestos) || 0;
  const totalNum = Number(value.total) || 0;

  useEffect(() => {
    if (!value.totalManual) {
      const suma = netoNum + ivaNum + otrosNum;
      if (suma > 0) onChange({ ...value, total: String(suma) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.neto_gravado, value.iva, value.otros_impuestos]);

  const aplicarPorcentajeIva = (pct: number) => {
    const calculado = parseFloat((netoNum * (pct / 100)).toFixed(2));
    onChange({ ...value, iva: String(calculado) });
  };

  const sumaPorcentajes = value.repartos.reduce((s, r) => s + (Number(r.porcentaje) || 0), 0);

  const addReparto = () => onChange({ ...value, repartos: [...value.repartos, { razon_social: '', cuit: '', porcentaje: 0, monto: 0 }] });
  const removeReparto = (idx: number) => onChange({ ...value, repartos: value.repartos.filter((_, i) => i !== idx) });
  const updateReparto = (idx: number, patch: Partial<RepartoPayload>) => {
    const repartos = value.repartos.map((r, i) => {
      if (i !== idx) return r;
      const merged = { ...r, ...patch };
      merged.monto = parseFloat(((totalNum * (Number(merged.porcentaje) || 0)) / 100).toFixed(2));
      return merged;
    });
    onChange({ ...value, repartos });
  };

  const handleSubmit = () => {
    setError(null);
    if (!value.cliente_nombre.trim()) { setError('El nombre del cliente es obligatorio'); return; }
    if (!totalNum || totalNum <= 0)   { setError('El total debe ser mayor a 0'); return; }
    if (value.tieneReparto) {
      if (value.repartos.length === 0) { setError('Agregá al menos un reparto o desactivá la opción'); return; }
      if (Math.abs(sumaPorcentajes - 100) > 0.01) { setError(`La suma de porcentajes debe ser 100% (actual: ${sumaPorcentajes.toFixed(2)}%)`); return; }
    }
    onSubmit();
  };

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold">Nueva factura emitida — Paso 2: Cliente y montos</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <label className={labelCls}>Cliente *</label>
          <ClienteCombobox
            value={value.cliente_nombre}
            onChange={nombre => onChange({ ...value, cliente_nombre: nombre })}
            onSelect={(nombre, cuit, condicion) => onChange({
              ...value,
              cliente_nombre:     nombre,
              cliente_cuit:       cuit ?? value.cliente_cuit,
              condicion_cliente:  condicion ?? value.condicion_cliente,
            })}
          />
        </div>
        <div>
          <label className={labelCls}>CUIT del cliente</label>
          <input value={value.cliente_cuit} onChange={e => onChange({ ...value, cliente_cuit: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Condición ante AFIP</label>
          <select value={value.condicion_cliente} onChange={e => onChange({ ...value, condicion_cliente: e.target.value as CondicionCliente })} className={inputCls}>
            <option value="">Sin especificar</option>
            {Object.entries(CONDICION_CLIENTE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>

        <div>
          <label className={labelCls}>Neto gravado ($)</label>
          <input type="number" min={0} step={0.01} value={value.neto_gravado} onChange={e => onChange({ ...value, neto_gravado: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>IVA ($)</label>
          <div className="flex gap-1">
            <input type="number" min={0} step={0.01} value={value.iva} onChange={e => onChange({ ...value, iva: e.target.value })} className={inputCls} />
          </div>
          <div className="flex gap-1 mt-1">
            {PORCENTAJES_IVA.map(pct => (
              <button key={pct} type="button" onClick={() => aplicarPorcentajeIva(pct)}
                className="text-[11px] px-1.5 py-0.5 rounded border border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors">
                {pct}%
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className={labelCls}>Otros impuestos ($)</label>
          <input type="number" min={0} step={0.01} value={value.otros_impuestos} onChange={e => onChange({ ...value, otros_impuestos: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Total *</label>
          <input
            type="number" min={0} step={0.01}
            value={value.total}
            onChange={e => onChange({ ...value, total: e.target.value, totalManual: true })}
            className={inputCls}
          />
        </div>

        <div>
          <label className={labelCls}>Moneda</label>
          <MonedaTasaCambio
            moneda={value.moneda}
            monto={totalNum}
            tasaCambio={value.tasa_cambio}
            onMonedaChange={m => onChange({ ...value, moneda: m, tasa_cambio: m === 'ARS' ? '' : value.tasa_cambio })}
            onTasaChange={t => onChange({ ...value, tasa_cambio: t })}
          />
        </div>
        <div>
          <label className={labelCls}>Forma de pago</label>
          <select value={value.forma_pago} onChange={e => onChange({ ...value, forma_pago: e.target.value })} className={inputCls}>
            <option value="">Sin especificar</option>
            {FORMAS_PAGO.map(fp => <option key={fp} value={fp}>{fp}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>Vincular a evento (opcional)</label>
          {eventoId ? (
            <input value={eventoNombre ?? `Evento #${eventoId}`} disabled className={cn(inputCls, 'bg-muted text-muted-foreground')} />
          ) : (
            <select value={value.evento_id} onChange={e => onChange({ ...value, evento_id: e.target.value })} className={inputCls}>
              <option value="">Sin evento</option>
              {eventos.map(ev => <option key={ev.id} value={ev.id}>{ev.nombre}</option>)}
            </select>
          )}
        </div>

        {/* Reparto */}
        <div className="sm:col-span-2 border border-border rounded-lg p-3 space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
            <input type="checkbox" checked={value.tieneReparto} onChange={e => onChange({ ...value, tieneReparto: e.target.checked, repartos: e.target.checked && value.repartos.length === 0 ? [{ razon_social: '', cuit: '', porcentaje: 0, monto: 0 }] : value.repartos })} />
            ¿Hay reparto entre razones sociales?
          </label>
          {value.tieneReparto && (
            <div className="space-y-2">
              {value.repartos.map((r, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_1fr_70px_100px_auto] gap-1.5 items-center">
                  <input placeholder="Razón social" value={r.razon_social} onChange={e => updateReparto(idx, { razon_social: e.target.value })} className={cn(inputCls, 'text-xs')} />
                  <input placeholder="CUIT" value={r.cuit ?? ''} onChange={e => updateReparto(idx, { cuit: e.target.value })} className={cn(inputCls, 'text-xs')} />
                  <input type="number" min={0} max={100} placeholder="%" value={r.porcentaje || ''} onChange={e => updateReparto(idx, { porcentaje: Number(e.target.value) })} className={cn(inputCls, 'text-xs')} />
                  <span className="text-xs text-muted-foreground text-right pr-1">${r.monto.toLocaleString('es-AR')}</span>
                  <button type="button" onClick={() => removeReparto(idx)} className="text-destructive hover:bg-destructive/10 rounded p-1"><Trash2 size={12} /></button>
                </div>
              ))}
              <div className="flex items-center justify-between">
                <button type="button" onClick={addReparto} className="flex items-center gap-1 text-xs text-primary hover:underline">
                  <Plus size={12} /> Agregar razón social
                </button>
                <span className={cn('text-xs font-medium', Math.abs(sumaPorcentajes - 100) < 0.01 ? 'text-green-700' : 'text-destructive')}>
                  Suma: {sumaPorcentajes.toFixed(2)}%
                </span>
              </div>
            </div>
          )}
        </div>

        {/* PDF */}
        <div className="sm:col-span-2">
          <label className={labelCls}>PDF de la factura (opcional)</label>
          {pdfFile ? (
            <div className="flex items-center gap-2 border border-green-200 bg-green-50 rounded px-3 py-2">
              <span className="text-sm text-green-800 flex-1 truncate">{pdfFile.name}</span>
              <button onClick={() => onPdfChange(null)} className="text-muted-foreground hover:text-destructive"><X size={14} /></button>
            </div>
          ) : (
            <input
              type="file" accept="application/pdf"
              onChange={e => { const f = e.target.files?.[0]; if (f) onPdfChange(f); }}
              className="text-sm"
            />
          )}
        </div>
      </div>

      {(error || apiError) && (
        <p className="flex items-center gap-1.5 text-sm text-destructive">
          <AlertTriangle size={14} />{error ?? apiError}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-2 border-t border-border">
        <Button variant="outline" size="sm" onClick={onBack} disabled={isPending}>Atrás</Button>
        <Button size="sm" onClick={handleSubmit} disabled={isPending}>{isPending ? 'Guardando…' : 'Crear factura'}</Button>
      </div>
    </div>
  );
}

// ── Wizard ────────────────────────────────────────────────────────────────────

export default function FacturaEmitidaForm({ onClose, eventoId, eventoNombre }: Props) {
  const [paso, setPaso] = useState<1 | 2>(1);
  const [paso1, setPaso1] = useState<Paso1State>({
    tipo_comprobante:  'FACTURA_A',
    punto_venta:       '1',
    numero:            '',
    fecha_emision:     format(new Date(), 'yyyy-MM-dd'),
    fecha_vencimiento: '',
    concepto:          '',
  });
  const [paso2, setPaso2] = useState<Paso2State>({
    cliente_nombre:     '',
    cliente_cuit:        '',
    condicion_cliente:  '',
    neto_gravado:        '',
    iva:                 '',
    otros_impuestos:     '',
    total:               '',
    totalManual:         false,
    moneda:              'ARS',
    tasa_cambio:         '',
    forma_pago:          '',
    evento_id:           eventoId ? String(eventoId) : '',
    tieneReparto:        false,
    repartos:            [],
  });
  const [pdfFile, setPdfFile]   = useState<File | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const createMut = useCreateFacturaEmitida();
  const [createdId, setCreatedId] = useState<number | null>(null);
  const uploadPdf  = useUploadPdfFacturaEmitida(createdId ?? 0);

  const handleSubmit = async () => {
    setApiError(null);
    try {
      const factura = await createMut.mutateAsync({
        tipo_comprobante:  paso1.tipo_comprobante,
        punto_venta:       Number(paso1.punto_venta) || 1,
        numero:             paso1.numero || null,
        fecha_emision:      paso1.fecha_emision,
        fecha_vencimiento:  paso1.fecha_vencimiento || null,
        concepto:           paso1.concepto || null,
        cliente_nombre:     paso2.cliente_nombre,
        cliente_cuit:        paso2.cliente_cuit || null,
        condicion_cliente:  paso2.condicion_cliente || null,
        neto_gravado:        paso2.neto_gravado     ? Number(paso2.neto_gravado)     : null,
        iva:                 paso2.iva               ? Number(paso2.iva)             : null,
        otros_impuestos:     paso2.otros_impuestos   ? Number(paso2.otros_impuestos) : null,
        total:               Number(paso2.total),
        moneda:              paso2.moneda,
        tasa_cambio:         paso2.moneda !== 'ARS' && paso2.tasa_cambio ? Number(paso2.tasa_cambio) : null,
        forma_pago:          paso2.forma_pago || null,
        evento_id:           eventoId ?? (paso2.evento_id ? Number(paso2.evento_id) : null),
        repartos:            paso2.tieneReparto ? paso2.repartos : undefined,
      });

      if (pdfFile) {
        setCreatedId(factura.id);
        await uploadPdf.mutateAsync(pdfFile).catch(() => {
          // La factura ya se creó — el PDF se puede adjuntar después desde el detalle.
        });
      }
      onClose();
    } catch (err: any) {
      setApiError(err?.response?.data?.error ?? 'Error al crear la factura');
    }
  };

  return paso === 1
    ? <Paso1 value={paso1} onChange={setPaso1} onNext={() => setPaso(2)} onCancel={onClose} />
    : (
      <Paso2
        value={paso2}
        onChange={setPaso2}
        onBack={() => setPaso(1)}
        onSubmit={handleSubmit}
        pdfFile={pdfFile}
        onPdfChange={setPdfFile}
        isPending={createMut.isPending || uploadPdf.isPending}
        apiError={apiError}
        eventoId={eventoId}
        eventoNombre={eventoNombre}
      />
    );
}
