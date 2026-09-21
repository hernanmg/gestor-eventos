import { useState } from 'react';
import { Upload, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useImportarLibroCompras, type ImportarLibroResultado } from '@/hooks/useFacturas';
import { formatCurrency } from '@/lib/formatters';
import { getApiErrorMessage } from '@/lib/utils';

type Step = 'archivo' | 'preview' | 'success';

function Stat({ label, value, className }: { label: string; value: number; className?: string }) {
  return (
    <div className="border border-border rounded-lg px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-semibold ${className ?? ''}`}>{value}</p>
    </div>
  );
}

function Lista({ titulo, vacio, children, count }: { titulo: string; vacio?: string; children: React.ReactNode; count: number }) {
  if (count === 0) return vacio ? <p className="text-xs text-muted-foreground">{vacio}</p> : null;
  return (
    <details className="border border-border rounded-md">
      <summary className="cursor-pointer text-xs font-medium px-3 py-2 flex items-center gap-1.5">
        <AlertTriangle size={12} className="text-yellow-700" /> {titulo} ({count})
      </summary>
      <div className="max-h-44 overflow-y-auto border-t border-border/60 px-3 py-2 text-xs space-y-1">{children}</div>
    </details>
  );
}

function Resultado({ r }: { r: ImportarLibroResultado }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Stat label={r.preview ? 'A crear' : 'Creadas'} value={r.creadas} className="text-green-700" />
        <Stat label={r.preview ? 'A actualizar' : 'Actualizadas'} value={r.actualizadas} />
        <Stat label="Vinculadas a evento" value={r.vinculadas_a_evento} />
        <Stat label="Marcadas como faltantes" value={r.faltantes_marcadas} />
      </div>

      <Lista titulo={r.preview ? 'Proveedores que se van a crear' : 'Proveedores creados'} count={r.proveedores_creados.length}>
        {r.proveedores_creados.map(p => <p key={p.cuit}>{p.nombre} <span className="text-muted-foreground">— {p.cuit}</span></p>)}
      </Lista>
      <Lista titulo="Con texto de evento sin vincular (quedan anotadas en notas)" count={r.sin_evento.length}>
        {r.sin_evento.map((e, i) => (
          <p key={i}>{e.proveedor} — {formatCurrency(e.total, 'ARS')} <span className="text-muted-foreground">— "{e.texto_evento}"</span></p>
        ))}
      </Lista>
      <Lista titulo="Sin PDF" count={r.sin_pdf.length}>
        {r.sin_pdf.map((f, i) => <p key={i}>{f.proveedor} — {formatCurrency(f.total, 'ARS')}</p>)}
      </Lista>
      <Lista titulo="Filas con problemas" count={r.errores.length}>
        {r.errores.map((e, i) => (
          <p key={i} className="text-destructive">{e.hoja === 'FALTANTES' ? 'Faltantes' : 'Hoja principal'}, fila {e.fila_excel}: {e.motivo}</p>
        ))}
      </Lista>
      {r.duplicadas_en_archivo > 0 && (
        <p className="text-xs text-muted-foreground">{r.duplicadas_en_archivo} comprobante(s) aparecen repetidos en el archivo y se importaron una sola vez.</p>
      )}
      {r.sin_texto_evento > 0 && (
        <p className="text-xs text-muted-foreground">{r.sin_texto_evento} facturas no traen evento en el Excel; se vinculan a mano desde su detalle.</p>
      )}
    </div>
  );
}

export default function ImportarLibroDialog({ onClose }: { onClose: () => void }) {
  const [step, setStep]         = useState<Step>('archivo');
  const [file, setFile]         = useState<File | null>(null);
  const [resultado, setResultado] = useState<ImportarLibroResultado | null>(null);
  const [error, setError]       = useState<string | null>(null);
  const importar = useImportarLibroCompras();

  const handleFile = async (f: File) => {
    setFile(f);
    setError(null);
    try {
      setResultado(await importar.mutateAsync({ file: f, preview: true }));
      setStep('preview');
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  const handleConfirmar = async () => {
    if (!file) return;
    setError(null);
    try {
      setResultado(await importar.mutateAsync({ file, preview: false }));
      setStep('success');
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Importar libro de compras AFIP</DialogTitle></DialogHeader>

        {step === 'archivo' && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Subí el Excel de comprobantes recibidos de AFIP (hoja principal y, si está, la hoja "Faltantes más de $500.000").
              Primero vas a ver un resumen; no se guarda nada hasta que confirmes.
            </p>
            <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-lg py-10 cursor-pointer hover:bg-accent/30 transition">
              <Upload size={22} className="text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {importar.isPending ? 'Analizando archivo…' : 'Hacé clic para elegir el archivo .xlsx'}
              </span>
              <input
                type="file" accept=".xlsx" className="hidden" disabled={importar.isPending}
                onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
            </label>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        )}

        {step === 'preview' && resultado && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Archivo: <span className="font-medium">{file?.name}</span> — {resultado.total_filas} filas leídas.</p>
            <Resultado r={resultado} />
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => setStep('archivo')} disabled={importar.isPending}>Atrás</Button>
              <Button size="sm" onClick={handleConfirmar} disabled={importar.isPending}>
                {importar.isPending ? 'Importando…' : 'Confirmar importación'}
              </Button>
            </div>
          </div>
        )}

        {step === 'success' && resultado && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-green-700">Importación completa.</p>
            <Resultado r={resultado} />
            <div className="flex justify-end pt-1">
              <Button size="sm" onClick={onClose}>Cerrar</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
