import { useState } from 'react';
import { Upload, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useImportarProveedoresFormulario, type ImportarFormularioResultado } from '@/hooks/useProveedores';
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

function Resultado({ r }: { r: ImportarFormularioResultado }) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-medium mb-1.5">Proveedores</p>
        <div className="grid grid-cols-2 gap-2">
          <Stat label={r.preview ? 'A crear' : 'Creados'} value={r.proveedores_creados} className="text-green-700" />
          <Stat label={r.preview ? 'A actualizar' : 'Actualizados'} value={r.proveedores_actualizados} />
        </div>
      </div>
      <div>
        <p className="text-xs font-medium mb-1.5">Jornaleros (empleados)</p>
        <div className="grid grid-cols-2 gap-2">
          <Stat label={r.preview ? 'A crear' : 'Creados'} value={r.empleados_creados} className="text-green-700" />
          <Stat label={r.preview ? 'A actualizar' : 'Actualizados'} value={r.empleados_actualizados} />
        </div>
      </div>

      {r.duplicados_en_archivo > 0 && (
        <p className="text-xs text-muted-foreground">
          {r.duplicados_en_archivo} respuesta(s) repetidas en el archivo (mismo CUIT o DNI): se usa la más reciente.
        </p>
      )}
      {r.errores.length > 0 && (
        <details className="border border-border rounded-md">
          <summary className="cursor-pointer text-xs font-medium px-3 py-2 flex items-center gap-1.5">
            <AlertTriangle size={12} className="text-yellow-700" /> Filas omitidas por error ({r.errores.length})
          </summary>
          <div className="max-h-44 overflow-y-auto border-t border-border/60 px-3 py-2 text-xs space-y-1">
            {r.errores.map((e, i) => <p key={i} className="text-destructive">Fila {e.fila}: {e.motivo}</p>)}
          </div>
        </details>
      )}
    </div>
  );
}

// Un mismo endpoint crea Proveedores y Empleados (jornaleros), así que este diálogo
// se usa igual desde Proveedores y desde RRHH → Empleados.
export default function ImportarFormularioDialog({ onClose }: { onClose: () => void }) {
  const [step, setStep]           = useState<Step>('archivo');
  const [file, setFile]           = useState<File | null>(null);
  const [resultado, setResultado] = useState<ImportarFormularioResultado | null>(null);
  const [error, setError]         = useState<string | null>(null);
  const importar = useImportarProveedoresFormulario();

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
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Importar desde formulario</DialogTitle></DialogHeader>

        {step === 'archivo' && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Subí el Excel de respuestas del formulario de Google. Las filas con servicio "jornalero" se cargan como
              empleados; el resto, como proveedores. Primero vas a ver un resumen; no se guarda nada hasta que confirmes.
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
            <p className="text-sm text-muted-foreground">Archivo: <span className="font-medium">{file?.name}</span> — {resultado.total_filas} respuestas leídas.</p>
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
