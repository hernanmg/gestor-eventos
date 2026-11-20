import { useState } from 'react';
import { Upload, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useImportarComprobantesEmitidos, type ImportarEmitidasResultado } from '@/hooks/useFacturasEmitidas';
import { formatCurrency } from '@/lib/formatters';
import { getApiErrorMessage } from '@/lib/utils';

type Step = 'archivo' | 'preview' | 'success';

function Stat({ label, value, className }: { label: string; value: number | string; className?: string }) {
  return (
    <div className="border border-border rounded-lg px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-semibold ${className ?? ''}`}>{value}</p>
    </div>
  );
}

function Lista({ titulo, count, children, alerta }: { titulo: string; count: number; children: React.ReactNode; alerta?: boolean }) {
  if (count === 0) return null;
  return (
    <details className="border border-border rounded-md">
      <summary className="cursor-pointer text-xs font-medium px-3 py-2 flex items-center gap-1.5">
        {alerta && <AlertTriangle size={12} className="text-yellow-700" />} {titulo} ({count})
      </summary>
      <div className="max-h-44 overflow-y-auto border-t border-border/60 px-3 py-2 text-xs space-y-1">{children}</div>
    </details>
  );
}

function Resultado({ r }: { r: ImportarEmitidasResultado }) {
  const e = r.por_estado;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Stat label={r.preview ? 'Facturas nuevas' : 'Facturas creadas'} value={r.creadas} className="text-green-700" />
        <Stat label={r.preview ? 'A completar' : 'Completadas'} value={r.actualizadas} />
        <Stat label={r.preview ? 'Cobros a registrar' : 'Cobros registrados'} value={r.cobros_nuevos} />
        <Stat label="Ya estaban igual" value={r.sin_cambios} />
      </div>
      <p className="text-xs text-muted-foreground">
        Total facturado en el archivo: <span className="font-medium text-foreground">{formatCurrency(r.total_facturado, 'ARS')}</span>
        {' · '}Cobradas {e.COBRADA ?? 0} · Con cobro parcial {e.COBRADA_PARCIAL ?? 0} · Sin cobrar {e.EMITIDA ?? 0} · Anuladas {e.ANULADA ?? 0}
      </p>

      <Lista titulo="Pendientes de cobro" count={r.pendientes.length}>
        {r.pendientes.map((p, i) => (
          <p key={i}>{p.numero} — {p.cliente} — {formatCurrency(p.total, 'ARS')}
            {p.cobrado > 0 && <> (cobrado {formatCurrency(p.cobrado, 'ARS')})</>}
            <span className="text-muted-foreground"> — {p.motivo}</span></p>
        ))}
      </Lista>
      <Lista titulo="Anuladas por nota de crédito" count={r.anuladas.length}>
        {r.anuladas.map((a, i) => <p key={i}>{a.numero} — {a.cliente} — {formatCurrency(a.total, 'ARS')} <span className="text-muted-foreground">— {a.motivo}</span></p>)}
      </Lista>
      <Lista titulo="Notas de crédito del archivo (no se cargan: anulá o ajustá a mano la factura que corresponda)" count={r.notas_credito.length} alerta>
        {r.notas_credito.map((n, i) => <p key={i}>{n.numero} — {n.cliente} — {formatCurrency(n.total, 'ARS')} <span className="text-muted-foreground">— {n.fecha.split('-').reverse().join('/')}</span></p>)}
      </Lista>
      <Lista titulo="Filas con problemas" count={r.errores.length} alerta>
        {r.errores.map((x, i) => <p key={i} className="text-destructive">{x.hoja}, fila {x.fila_excel}: {x.motivo}</p>)}
      </Lista>
      {r.duplicadas_en_archivo > 0 && (
        <p className="text-xs text-muted-foreground">{r.duplicadas_en_archivo} comprobante(s) aparecen repetidos en el archivo y se importan una sola vez.</p>
      )}
    </div>
  );
}

export default function ImportarAfipDialog({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<Step>('archivo');
  const [file, setFile] = useState<File | null>(null);
  const [resultado, setResultado] = useState<ImportarEmitidasResultado | null>(null);
  const [error, setError] = useState<string | null>(null);
  const importar = useImportarComprobantesEmitidos();

  const correr = async (f: File, preview: boolean) => {
    setError(null);
    try {
      setResultado(await importar.mutateAsync({ file: f, preview }));
      setStep(preview ? 'preview' : 'success');
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Importar comprobantes emitidos de AFIP</DialogTitle></DialogHeader>

        {step === 'archivo' && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Subí el Excel de "Mis Comprobantes Emitidos" de AFIP, o la planilla de ventas con una hoja por mes
              (con fecha y lugar de ingreso del pago, observaciones y la hoja de conciliación). Primero vas a ver un resumen;
              no se guarda nada hasta que confirmes. Volver a subir el mismo archivo no duplica facturas.
            </p>
            <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-lg py-10 cursor-pointer hover:bg-accent/30 transition">
              <Upload size={22} className="text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {importar.isPending ? 'Analizando archivo…' : 'Hacé clic para elegir el archivo .xlsx'}
              </span>
              <input type="file" accept=".xlsx" className="hidden" disabled={importar.isPending}
                onChange={e => { const f = e.target.files?.[0]; if (f) { setFile(f); correr(f, true); } }} />
            </label>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        )}

        {step === 'preview' && resultado && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Archivo: <span className="font-medium">{file?.name}</span> — {resultado.total_filas} comprobantes en {resultado.hojas_leidas.length} hoja(s)
              {resultado.formato === 'AFIP' && '. El export de AFIP no trae cobros: las facturas quedan pendientes y los cobros se registran desde cada una.'}
            </p>
            <Resultado r={resultado} />
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => setStep('archivo')} disabled={importar.isPending}>Atrás</Button>
              <Button size="sm" onClick={() => file && correr(file, false)} disabled={importar.isPending || resultado.creadas + resultado.actualizadas === 0}>
                {importar.isPending ? 'Importando…' : 'Confirmar importación'}
              </Button>
            </div>
          </div>
        )}

        {step === 'success' && resultado && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-green-700">Importación completa.</p>
            <Resultado r={resultado} />
            <div className="flex justify-end pt-1"><Button size="sm" onClick={onClose}>Cerrar</Button></div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
