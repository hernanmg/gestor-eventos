import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileSpreadsheet, ChevronDown, ChevronRight, AlertTriangle, CheckCircle2, Plus, Trash2 } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

interface MovimientoPreview {
  fila_excel:             number;
  fecha:                  string | null;
  concepto:               string | null;
  descripcion:            string | null;
  debe:                   number;
  haber:                  number;
  impuesto_subcategoria?: string | null;
  advertencias:           string[];
  errores:                string[];
}

interface EcheqPreview {
  fila_excel:           number;
  numero:               string;
  razon_social:         string;
  detalle:              string | null;
  importe:              number;
  fecha_emision:        string | null;
  fecha_cobro_estimada: string | null;
}

interface HojaPreview {
  codigo:               string;
  nombre_hoja_original: string;
  tipo:                 'EGRESO' | 'INGRESO';
  tab_numero:           number;
  movimientos:          MovimientoPreview[];
  echeqs?:              EcheqPreview[];
  stats: {
    total_filas:  number;
    importables:  number;
    omitidas:     number;
    advertencias: number;
  };
}

interface PreviewResult {
  resumen: {
    total_hojas:       number;
    total_movimientos: number;
    total_echeqs:      number;
    advertencias:      number;
    errores:           number;
  };
  hojas:                HojaPreview[];
  configuracion_evento: {
    nombre_sugerido: string;
    moneda_base:     'ARS';
  };
}

interface EventoForm {
  nombre:       string;
  fecha_inicio: string;
  fecha_fin:    string;
  moneda_base:  'ARS' | 'USD';
}

interface Socio {
  nombre:     string;
  porcentaje: string;
}

// ── Step 1: Upload ────────────────────────────────────────────────────────────

function UploadStep({ onPreview }: { onPreview: (r: PreviewResult, file: File) => void }) {
  const inputRef    = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const previewMutation = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await api.post<PreviewResult>('/importer/preview', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return { data, file };
    },
    onSuccess: ({ data, file }) => onPreview(data, file),
    onError: (err: any) => setError(err?.response?.data?.error ?? 'Error al procesar el archivo'),
  });

  const handleFile = (file: File) => {
    setError(null);
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      setError('Solo se aceptan archivos .xlsx');
      return;
    }
    previewMutation.mutate(file);
  };

  return (
    <div className="max-w-xl mx-auto">
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files[0];
          if (file) handleFile(file);
        }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed',
          'p-16 cursor-pointer transition-colors',
          dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-gray-50',
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />
        {previewMutation.isPending ? (
          <>
            <FileSpreadsheet size={40} className="text-primary animate-pulse" />
            <p className="text-sm text-muted-foreground">Analizando archivo…</p>
          </>
        ) : (
          <>
            <Upload size={40} className="text-muted-foreground" />
            <div className="text-center">
              <p className="text-sm font-medium">Arrastrá o hacé clic para subir</p>
              <p className="text-xs text-muted-foreground mt-1">Plantilla Excel (.xlsx)</p>
            </div>
          </>
        )}
      </div>
      {error && (
        <p className="mt-3 flex items-center gap-1.5 text-sm text-destructive">
          <AlertTriangle size={14} />
          {error}
        </p>
      )}
    </div>
  );
}

// ── Hoja accordion row ────────────────────────────────────────────────────────

function HojaRow({ hoja }: { hoja: HojaPreview }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        className={cn(
          'w-full flex items-center gap-3 px-4 py-3 text-left bg-gray-50 hover:bg-gray-100 transition-colors',
        )}
        onClick={() => setOpen(o => !o)}
      >
        {open ? <ChevronDown size={15} className="shrink-0" /> : <ChevronRight size={15} className="shrink-0" />}
        <span className="font-mono text-xs bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded shrink-0">
          {hoja.codigo}
        </span>
        <span className="text-sm font-medium flex-1 text-left">{hoja.nombre_hoja_original}</span>
        <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
          <span className="text-green-700 font-medium">{hoja.stats.importables} ok</span>
          {hoja.stats.omitidas > 0 && (
            <span className="text-destructive font-medium">{hoja.stats.omitidas} omitidas</span>
          )}
          {hoja.stats.advertencias > 0 && (
            <span className="text-amber-600 font-medium">{hoja.stats.advertencias} advertencias</span>
          )}
        </div>
      </button>

      {open && (
        <div className="px-4 py-3 border-t border-border overflow-x-auto">
          {hoja.movimientos.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">Sin movimientos</p>
          ) : (
            <table className="w-full text-xs min-w-[600px]">
              <thead>
                <tr className="text-muted-foreground border-b border-border">
                  <th className="py-1 pr-3 text-left font-medium">Fila</th>
                  <th className="py-1 pr-3 text-left font-medium">Fecha</th>
                  <th className="py-1 pr-3 text-left font-medium">Concepto</th>
                  <th className="py-1 pr-3 text-right font-medium">Debe</th>
                  <th className="py-1 pr-3 text-right font-medium">Haber</th>
                  <th className="py-1 text-left font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {hoja.movimientos.map(m => (
                  <tr
                    key={m.fila_excel}
                    className={cn(
                      m.errores.length > 0 ? 'opacity-50 line-through' : '',
                    )}
                  >
                    <td className="py-1 pr-3 text-muted-foreground">{m.fila_excel}</td>
                    <td className="py-1 pr-3">{m.fecha ?? '—'}</td>
                    <td className="py-1 pr-3 max-w-[200px] truncate">{m.concepto ?? m.descripcion ?? '—'}</td>
                    <td className="py-1 pr-3 text-right tabular-nums">
                      {m.debe > 0 ? m.debe.toLocaleString('es-AR') : '—'}
                    </td>
                    <td className="py-1 pr-3 text-right tabular-nums">
                      {m.haber > 0 ? m.haber.toLocaleString('es-AR') : '—'}
                    </td>
                    <td className="py-1">
                      {m.errores.length > 0 ? (
                        <span className="text-destructive" title={m.errores.join(' | ')}>✕ {m.errores[0]}</span>
                      ) : m.advertencias.length > 0 ? (
                        <span className="text-amber-600" title={m.advertencias.join(' | ')}>⚠ {m.advertencias[0]}</span>
                      ) : (
                        <span className="text-green-700">✓</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {hoja.echeqs && hoja.echeqs.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-medium text-muted-foreground mb-2">Echeqs detectados ({hoja.echeqs.length})</p>
              <table className="w-full text-xs min-w-[500px]">
                <thead>
                  <tr className="text-muted-foreground border-b border-border">
                    <th className="py-1 pr-3 text-left font-medium">N°</th>
                    <th className="py-1 pr-3 text-left font-medium">Razón social</th>
                    <th className="py-1 pr-3 text-right font-medium">Importe</th>
                    <th className="py-1 pr-3 text-left font-medium">F. emisión</th>
                    <th className="py-1 text-left font-medium">F. cobro</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {hoja.echeqs.map(e => (
                    <tr key={e.fila_excel}>
                      <td className="py-1 pr-3 font-mono">{e.numero}</td>
                      <td className="py-1 pr-3">{e.razon_social}</td>
                      <td className="py-1 pr-3 text-right tabular-nums">{e.importe.toLocaleString('es-AR')}</td>
                      <td className="py-1 pr-3">{e.fecha_emision ?? '—'}</td>
                      <td className="py-1">{e.fecha_cobro_estimada ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Step 2: Preview + form ────────────────────────────────────────────────────

function PreviewStep({
  preview,
  onBack,
  onSuccess,
}: {
  preview:   PreviewResult;
  onBack:    () => void;
  onSuccess: (eventoId: number, stats: any) => void;
}) {
  const [form, setForm] = useState<EventoForm>({
    nombre:       preview.configuracion_evento.nombre_sugerido,
    fecha_inicio: '',
    fecha_fin:    '',
    moneda_base:  preview.configuracion_evento.moneda_base,
  });
  const [socios, setSocios] = useState<Socio[]>([]);
  const [error,  setError]  = useState<string | null>(null);

  const sociosSum  = socios.reduce((a, s) => a + (parseFloat(s.porcentaje) || 0), 0);
  const sociosValid = socios.length === 0 || Math.abs(sociosSum - 100) < 0.01;

  const addSocio    = () => setSocios(s => [...s, { nombre: '', porcentaje: '' }]);
  const removeSocio = (i: number) => setSocios(s => s.filter((_, idx) => idx !== i));
  const updateSocio = (i: number, field: keyof Socio, val: string) =>
    setSocios(s => s.map((item, idx) => idx === i ? { ...item, [field]: val } : item));

  const confirmarMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/importer/confirmar', {
        evento: {
          nombre:       form.nombre,
          fecha_inicio: form.fecha_inicio || null,
          fecha_fin:    form.fecha_fin    || null,
          moneda_base:  form.moneda_base,
          socios:       socios
            .filter(s => s.nombre.trim())
            .map(s => ({ nombre: s.nombre.trim(), porcentaje: parseFloat(s.porcentaje) || 0 })),
        },
        hojas: preview.hojas,
      });
      return data;
    },
    onSuccess: (data) => onSuccess(data.evento_id, data.stats),
    onError:   (err: any) => setError(err?.response?.data?.error ?? 'Error al importar'),
  });

  const { resumen } = preview;
  const hasErrors   = resumen.errores > 0;

  const input = 'w-full border border-input rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring';
  const label = 'block text-xs font-medium text-muted-foreground mb-0.5';

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Resumen */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Hojas',         value: resumen.total_hojas,       color: 'text-foreground' },
          { label: 'Movimientos',   value: resumen.total_movimientos,  color: 'text-green-700' },
          { label: 'Echeqs',        value: resumen.total_echeqs,       color: 'text-blue-700' },
          { label: 'Con errores',   value: resumen.errores,            color: resumen.errores > 0 ? 'text-destructive' : 'text-muted-foreground' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-lg border border-border p-3 text-center">
            <p className={cn('text-2xl font-semibold tabular-nums', color)}>{value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {hasErrors && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <span>
            {resumen.errores} {resumen.errores === 1 ? 'fila tiene' : 'filas tienen'} errores y serán omitidas.
            Las demás se importarán normalmente.
          </span>
        </div>
      )}

      {/* Evento form */}
      <div className="rounded-lg border border-border p-4 space-y-3">
        <h3 className="text-sm font-semibold">Datos del evento</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className={label}>Nombre *</label>
            <input
              value={form.nombre}
              onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
              className={input}
              placeholder="Nombre del evento"
            />
          </div>
          <div>
            <label className={label}>Fecha inicio</label>
            <input
              type="date"
              value={form.fecha_inicio}
              onChange={e => setForm(f => ({ ...f, fecha_inicio: e.target.value }))}
              className={input}
            />
          </div>
          <div>
            <label className={label}>Fecha fin</label>
            <input
              type="date"
              value={form.fecha_fin}
              onChange={e => setForm(f => ({ ...f, fecha_fin: e.target.value }))}
              className={input}
            />
          </div>
          <div>
            <label className={label}>Moneda base</label>
            <select
              value={form.moneda_base}
              onChange={e => setForm(f => ({ ...f, moneda_base: e.target.value as 'ARS' | 'USD' }))}
              className={input}
            >
              <option value="ARS">ARS</option>
              <option value="USD">USD</option>
            </select>
          </div>
        </div>

        {/* Socios */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Socios (opcional)</span>
            <button
              type="button"
              onClick={addSocio}
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <Plus size={12} />
              Agregar socio
            </button>
          </div>
          {socios.map((s, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input
                placeholder="Nombre del socio"
                value={s.nombre}
                onChange={e => updateSocio(i, 'nombre', e.target.value)}
                className={cn(input, 'flex-1')}
              />
              <input
                type="number"
                placeholder="%"
                min={0}
                max={100}
                step={0.01}
                value={s.porcentaje}
                onChange={e => updateSocio(i, 'porcentaje', e.target.value)}
                className={cn(input, 'w-20')}
              />
              <button
                type="button"
                onClick={() => removeSocio(i)}
                className="p-1 text-destructive hover:bg-destructive/10 rounded"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
          {socios.length > 0 && (
            <p className={cn('text-xs text-right font-medium', sociosValid ? 'text-green-600' : 'text-muted-foreground')}>
              Total: {sociosSum.toFixed(2)}%{sociosValid ? ' ✓' : ' (debe ser 100%)'}
            </p>
          )}
        </div>
      </div>

      {/* Hojas accordion */}
      <div className="space-y-2">
        {preview.hojas.map(hoja => (
          <HojaRow key={hoja.codigo} hoja={hoja} />
        ))}
      </div>

      {error && (
        <p className="flex items-center gap-1.5 text-sm text-destructive">
          <AlertTriangle size={14} />
          {error}
        </p>
      )}

      <div className="flex items-center justify-between pt-2">
        <Button variant="outline" size="sm" onClick={onBack} disabled={confirmarMutation.isPending}>
          ← Volver
        </Button>
        <Button
          size="sm"
          onClick={() => { setError(null); confirmarMutation.mutate(); }}
          disabled={confirmarMutation.isPending || !form.nombre.trim() || !sociosValid}
        >
          {confirmarMutation.isPending ? 'Importando…' : `Importar ${resumen.total_movimientos} movimiento${resumen.total_movimientos !== 1 ? 's' : ''}`}
        </Button>
      </div>
    </div>
  );
}

// ── Step 3: Success ───────────────────────────────────────────────────────────

function SuccessStep({
  eventoId,
  stats,
}: {
  eventoId: number;
  stats:    { movimientos_creados: number; echeqs_creados: number; filas_omitidas: number };
}) {
  const navigate = useNavigate();

  return (
    <div className="max-w-md mx-auto text-center space-y-6">
      <CheckCircle2 size={56} className="text-green-600 mx-auto" />
      <div>
        <h2 className="text-lg font-semibold">Importación completada</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {stats.movimientos_creados} movimiento{stats.movimientos_creados !== 1 ? 's' : ''}
          {stats.echeqs_creados > 0 && ` · ${stats.echeqs_creados} echeq${stats.echeqs_creados !== 1 ? 's' : ''}`}
          {stats.filas_omitidas > 0 && ` · ${stats.filas_omitidas} fila${stats.filas_omitidas !== 1 ? 's' : ''} omitida${stats.filas_omitidas !== 1 ? 's' : ''}`}
        </p>
      </div>
      <Button onClick={() => navigate(`/eventos/${eventoId}`)}>
        Ir al evento →
      </Button>
    </div>
  );
}

// ── ImporterPage ──────────────────────────────────────────────────────────────

type Step = 'upload' | 'preview' | 'success';

export default function ImporterPage() {
  const [step,      setStep]      = useState<Step>('upload');
  const [preview,   setPreview]   = useState<PreviewResult | null>(null);
  const [filename,  setFilename]  = useState('');
  const [eventoId,  setEventoId]  = useState<number | null>(null);
  const [stats,     setStats]     = useState<any>(null);

  const handlePreview = (result: PreviewResult, file: File) => {
    setPreview(result);
    setFilename(file.name);
    setStep('preview');
  };

  const handleSuccess = (id: number, s: any) => {
    setEventoId(id);
    setStats(s);
    setStep('success');
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border bg-white shrink-0">
        <h1 className="text-xl font-semibold">Importar Excel</h1>
        {step !== 'upload' && (
          <span className="text-sm text-muted-foreground">{filename}</span>
        )}
      </div>

      {/* Progress */}
      <div className="flex border-b border-border bg-gray-50 shrink-0 px-6">
        {(['upload', 'preview', 'success'] as Step[]).map((s, idx) => (
          <div
            key={s}
            className={cn(
              'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px',
              step === s ? 'border-primary text-primary' : 'border-transparent text-muted-foreground',
            )}
          >
            {idx + 1}. {s === 'upload' ? 'Subir archivo' : s === 'preview' ? 'Revisar y confirmar' : 'Listo'}
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-6">
        {step === 'upload' && (
          <UploadStep onPreview={handlePreview} />
        )}
        {step === 'preview' && preview && (
          <PreviewStep
            preview={preview}
            onBack={() => setStep('upload')}
            onSuccess={handleSuccess}
          />
        )}
        {step === 'success' && eventoId !== null && stats && (
          <SuccessStep eventoId={eventoId} stats={stats} />
        )}
      </div>
    </div>
  );
}
