import { useState, useRef, useCallback } from 'react';
import { AlertTriangle, FileText, X, Upload } from 'lucide-react';
import { useCreateFactura, useUpdateFactura } from '@/hooks/useFacturas';
import { useRubros } from '@/hooks/useRubros';
import ProveedorCombobox from '@/components/domain/ProveedorCombobox';
import { Button } from '@/components/ui/button';
import MonedaTasaCambio from '@/components/ui/MonedaTasaCambio';
import MoneyInput from '@/components/ui/MoneyInput';
import type { Factura, Moneda, ProveedorBusqueda } from '@/types';
import { cn } from '@/lib/utils';

const TIPOS_FACTURA  = ['A', 'B', 'C', 'X'] as const;
const CONDICION_PAGO = [
  { value: 'CONTADO', label: 'Contado' },
  { value: 'DIAS_30', label: '30 días' },
  { value: 'DIAS_60', label: '60 días' },
  { value: 'DIAS_90', label: '90 días' },
  { value: 'ECHEQ',   label: 'Echeq' },
  { value: 'OTRO',    label: 'Otro' },
];

const NUMERO_REGEX = /^\d{4}-\d{8}$/;

interface FieldErrors {
  proveedor?:        string;
  numero_factura?:   string;
  fecha_emision?:    string;
  importe_total?:    string;
}

interface Props {
  eventoId:   number;
  factura?:   Factura;
  onClose:    () => void;
  onSuccess?: (f: Factura) => void;
}

export default function FacturaForm({ eventoId, factura, onClose, onSuccess }: Props) {
  const isEdit = !!factura;

  const [proveedor, setProveedor] = useState<ProveedorBusqueda | null>(
    factura?.proveedor
      ? { id: factura.proveedor.id, nombre: factura.proveedor.nombre, alias: factura.proveedor.alias ?? null, cuit: factura.proveedor.cuit ?? null, categoria: null }
      : null
  );
  const [form, setForm] = useState({
    tipo_factura:      factura?.tipo_factura ?? 'A',
    numero_factura:    factura?.numero_factura ?? '',
    fecha_emision:     factura?.fecha_emision?.slice(0, 10) ?? '',
    fecha_vencimiento: factura?.fecha_vencimiento?.slice(0, 10) ?? '',
    rubro_id:          factura?.rubro_id ? String(factura.rubro_id) : '',
    importe_total:     factura?.importe_total ? String(factura.importe_total) : '',
    moneda:            (factura?.moneda ?? 'ARS') as Moneda,
    tasa_cambio:       factura?.tasa_cambio ? String(factura.tasa_cambio) : '',
    condicion_pago:    (factura?.condicion_pago ?? 'CONTADO') as string,
    notas:             factura?.notas ?? '',
  });

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [apiError,    setApiError]    = useState<string | null>(null);
  const [pdfFile,     setPdfFile]     = useState<File | null>(null);
  const [pdfDrag,     setPdfDrag]     = useState(false);

  const dropRef = useRef<HTMLDivElement>(null);

  const { data: rubrosEgreso = [] } = useRubros('EGRESO');

  const createMut = useCreateFactura(eventoId);
  const updateMut = useUpdateFactura(factura?.id ?? 0);
  const isPending  = createMut.isPending || updateMut.isPending;

  const inputCls  = (err?: string) =>
    cn('w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring',
       err ? 'border-destructive' : 'border-input');
  const labelCls  = 'block text-xs font-medium text-muted-foreground mb-0.5';
  const errorCls  = 'text-xs text-destructive mt-0.5';

  const handlePdf = useCallback((file: File) => {
    if (file.type !== 'application/pdf') { setApiError('Solo se aceptan archivos PDF'); return; }
    if (file.size > 10 * 1024 * 1024)   { setApiError('El PDF no puede superar 10 MB'); return; }
    setApiError(null);
    setPdfFile(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setPdfDrag(false);
    const file = e.dataTransfer.files[0];
    if (file) handlePdf(file);
  }, [handlePdf]);

  const validate = (): boolean => {
    const errs: FieldErrors = {};
    if (!proveedor)
      errs.proveedor = 'El proveedor es obligatorio';
    if (!form.numero_factura)
      errs.numero_factura = 'El número de factura es obligatorio';
    else if (!NUMERO_REGEX.test(form.numero_factura))
      errs.numero_factura = 'Formato inválido. Debe ser XXXX-XXXXXXXX (ej: 0001-00001234)';
    if (!form.fecha_emision)
      errs.fecha_emision = 'La fecha de emisión es obligatoria';
    if (!form.importe_total || isNaN(Number(form.importe_total)) || Number(form.importe_total) <= 0)
      errs.importe_total = 'El importe debe ser mayor a 0';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    setApiError(null);
    if (!validate()) return;

    try {
      if (isEdit) {
        const result = await updateMut.mutateAsync({
          numero_factura:    form.numero_factura,
          tipo_factura:      form.tipo_factura,
          fecha_emision:     form.fecha_emision,
          fecha_vencimiento: form.fecha_vencimiento || null,
          proveedor_id:      proveedor!.id,
          rubro_id:          form.rubro_id ? Number(form.rubro_id) : null,
          importe_total:     Number(form.importe_total),
          moneda:            form.moneda as any,
          tasa_cambio:       form.moneda !== 'ARS' && form.tasa_cambio ? Number(form.tasa_cambio) : null,
          condicion_pago:    form.condicion_pago,
          notas:             form.notas || null,
        });
        onSuccess?.(result);
      } else {
        // Construir FormData aquí para que Axios detecte el boundary correctamente
        const fd = new FormData();
        fd.append('numero_factura',  form.numero_factura);
        fd.append('tipo_factura',    form.tipo_factura);
        fd.append('fecha_emision',   form.fecha_emision);
        fd.append('proveedor_id',    String(proveedor!.id));
        fd.append('importe_total',   form.importe_total);
        fd.append('moneda',          form.moneda);
        if (form.moneda !== 'ARS' && form.tasa_cambio) fd.append('tasa_cambio', form.tasa_cambio);
        fd.append('condicion_pago',  form.condicion_pago);
        if (form.fecha_vencimiento) fd.append('fecha_vencimiento', form.fecha_vencimiento);
        if (form.rubro_id)          fd.append('rubro_id',          form.rubro_id);
        if (form.notas)             fd.append('notas',             form.notas);
        if (pdfFile)                fd.append('pdf',               pdfFile);

        const result = await createMut.mutateAsync(fd);
        onSuccess?.(result);
      }
      onClose();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (detail) {
        // Map backend field errors to inline display
        const mapped: FieldErrors = {};
        if (detail.numero_factura) mapped.numero_factura = detail.numero_factura[0];
        if (detail.fecha_emision)  mapped.fecha_emision  = detail.fecha_emision[0];
        if (detail.importe_total)  mapped.importe_total  = detail.importe_total[0];
        if (detail.proveedor_id)   mapped.proveedor      = detail.proveedor_id[0];
        setFieldErrors(mapped);
      }
      setApiError(err?.response?.data?.error ?? 'Error al guardar la factura');
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold">{isEdit ? 'Editar factura' : 'Nueva factura'}</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Proveedor */}
        <div className="sm:col-span-2">
          <label className={labelCls}>Proveedor *</label>
          <div className={cn('border rounded-md px-2 py-1.5 bg-white', fieldErrors.proveedor ? 'border-destructive' : 'border-input')}>
            <ProveedorCombobox value={proveedor} onChange={p => { setProveedor(p); setFieldErrors(e => ({ ...e, proveedor: undefined })); }} className="w-full" />
          </div>
          {fieldErrors.proveedor && <p className={errorCls}>{fieldErrors.proveedor}</p>}
        </div>

        {/* Tipo */}
        <div>
          <label className={labelCls}>Tipo *</label>
          <select value={form.tipo_factura} onChange={e => setForm(f => ({ ...f, tipo_factura: e.target.value }))} className={inputCls()}>
            {TIPOS_FACTURA.map(t => <option key={t} value={t}>Tipo {t}</option>)}
          </select>
        </div>

        {/* Número */}
        <div>
          <label className={labelCls}>N° Factura *</label>
          <input
            value={form.numero_factura}
            onChange={e => { setForm(f => ({ ...f, numero_factura: e.target.value })); setFieldErrors(x => ({ ...x, numero_factura: undefined })); }}
            placeholder="0001-00001234"
            className={inputCls(fieldErrors.numero_factura)}
          />
          {fieldErrors.numero_factura && <p className={errorCls}>{fieldErrors.numero_factura}</p>}
        </div>

        {/* Fecha emisión */}
        <div>
          <label className={labelCls}>Fecha emisión *</label>
          <input
            type="date"
            value={form.fecha_emision}
            onChange={e => { setForm(f => ({ ...f, fecha_emision: e.target.value })); setFieldErrors(x => ({ ...x, fecha_emision: undefined })); }}
            className={inputCls(fieldErrors.fecha_emision)}
          />
          {fieldErrors.fecha_emision && <p className={errorCls}>{fieldErrors.fecha_emision}</p>}
        </div>

        {/* Fecha vencimiento */}
        <div>
          <label className={labelCls}>Fecha vencimiento</label>
          <input type="date" value={form.fecha_vencimiento} onChange={e => setForm(f => ({ ...f, fecha_vencimiento: e.target.value }))} className={inputCls()} />
        </div>

        {/* Importe */}
        <div>
          <label className={labelCls}>Importe total *</label>
          <MoneyInput
            value={form.importe_total}
            onChange={v => { setForm(f => ({ ...f, importe_total: v })); setFieldErrors(x => ({ ...x, importe_total: undefined })); }}
            className={inputCls(fieldErrors.importe_total)}
          />
          {fieldErrors.importe_total && <p className={errorCls}>{fieldErrors.importe_total}</p>}
        </div>

        {/* Moneda */}
        <div>
          <label className={labelCls}>Moneda</label>
          <MonedaTasaCambio
            moneda={form.moneda}
            monto={Number(form.importe_total) || 0}
            tasaCambio={form.tasa_cambio}
            onMonedaChange={m => setForm(f => ({ ...f, moneda: m, tasa_cambio: m === 'ARS' ? '' : f.tasa_cambio }))}
            onTasaChange={t => setForm(f => ({ ...f, tasa_cambio: t }))}
          />
        </div>

        {/* Rubro */}
        <div>
          <label className={labelCls}>Rubro (egreso automático al pagar)</label>
          <select value={form.rubro_id} onChange={e => setForm(f => ({ ...f, rubro_id: e.target.value }))} className={inputCls()}>
            <option value="">Sin rubro — sin egreso automático</option>
            {rubrosEgreso.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
          </select>
          {form.rubro_id ? (
            <p className="text-xs text-muted-foreground mt-0.5">
              Al registrar el pago, el egreso se creará automáticamente en este rubro.
            </p>
          ) : (
            <p className="flex items-center gap-1 text-xs text-amber-600 mt-0.5">
              <AlertTriangle size={12} className="shrink-0" />
              Sin rubro seleccionado — el pago no generará un egreso automático.
            </p>
          )}
        </div>

        {/* Condición pago */}
        <div>
          <label className={labelCls}>Condición de pago</label>
          <select value={form.condicion_pago} onChange={e => setForm(f => ({ ...f, condicion_pago: e.target.value }))} className={inputCls()}>
            {CONDICION_PAGO.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>

        {/* Notas */}
        <div className="sm:col-span-2">
          <label className={labelCls}>Notas</label>
          <textarea value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} rows={2} className={cn(inputCls(), 'resize-none')} />
        </div>

        {/* PDF */}
        {!isEdit && (
          <div className="sm:col-span-2">
            <label className={labelCls}>PDF de la factura</label>
            {pdfFile ? (
              <div className="flex items-center gap-2 border border-green-200 bg-green-50 rounded px-3 py-2">
                <FileText size={16} className="text-green-700 shrink-0" />
                <span className="text-sm text-green-800 flex-1 truncate">{pdfFile.name}</span>
                <span className="text-xs text-muted-foreground">{(pdfFile.size / 1024).toFixed(0)} KB</span>
                <button onClick={() => setPdfFile(null)} className="text-muted-foreground hover:text-destructive"><X size={14} /></button>
              </div>
            ) : (
              <div
                ref={dropRef}
                onDragOver={e => { e.preventDefault(); setPdfDrag(true); }}
                onDragLeave={() => setPdfDrag(false)}
                onDrop={handleDrop}
                onClick={() => {
                  const i = document.createElement('input');
                  i.type = 'file'; i.accept = 'application/pdf';
                  i.onchange = ev => { const f = (ev.target as HTMLInputElement).files?.[0]; if (f) handlePdf(f); };
                  i.click();
                }}
                className={cn(
                  'flex flex-col items-center justify-center gap-2 rounded border-2 border-dashed p-6 cursor-pointer transition-colors text-muted-foreground text-sm',
                  pdfDrag ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40',
                )}
              >
                <Upload size={20} />
                <span>Arrastrá o hacé clic para subir PDF (máx 10 MB)</span>
              </div>
            )}
          </div>
        )}
      </div>

      {apiError && (
        <p className="flex items-center gap-1.5 text-sm text-destructive">
          <AlertTriangle size={14} />
          {apiError}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-2 border-t border-border">
        <Button variant="outline" size="sm" onClick={onClose} disabled={isPending}>Cancelar</Button>
        <Button size="sm" onClick={handleSubmit} disabled={isPending}>
          {isPending ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear factura'}
        </Button>
      </div>
    </div>
  );
}
