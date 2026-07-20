import { useRef, useState } from 'react';
import { Upload, FileSpreadsheet, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useImportarEmpleados, useImportarJornadas } from '@/hooks/useRRHH';
import { Button } from '@/components/ui/button';
import { cn, getApiErrorMessage } from '@/lib/utils';

// ── Dropzone genérico ─────────────────────────────────────────────────────────

function Dropzone({ onFile, busy }: { onFile: (file: File) => void; busy: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = (file: File) => {
    setError(null);
    if (!file.name.toLowerCase().endsWith('.xlsx')) { setError('Solo se aceptan archivos .xlsx'); return; }
    onFile(file);
  };

  return (
    <div className="max-w-xl">
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-12 cursor-pointer transition-colors',
          dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-gray-50',
        )}
      >
        <input ref={inputRef} type="file" accept=".xlsx" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        {busy ? (
          <><FileSpreadsheet size={32} className="text-primary animate-pulse" /><p className="text-sm text-muted-foreground">Analizando archivo…</p></>
        ) : (
          <><Upload size={32} className="text-muted-foreground" /><p className="text-sm font-medium">Arrastrá o hacé clic para subir un .xlsx</p></>
        )}
      </div>
      {error && <p className="mt-2 flex items-center gap-1.5 text-sm text-destructive"><AlertTriangle size={14} />{error}</p>}
    </div>
  );
}

// ── Importar empleados ─────────────────────────────────────────────────────────

interface FilaEmpleado { fila_excel: number; nombre: string | null; apellido: string | null; dni: string | null; importable: boolean; errores: string[] }
interface PreviewEmpleados { total_filas: number; importables: number; omitidas: number; filas: FilaEmpleado[] }

function ImportarEmpleados() {
  const importarMut = useImportarEmpleados();
  const [file, setFile]       = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewEmpleados | null>(null);
  const [resultado, setResultado] = useState<{ creados: number; omitidos: number } | null>(null);
  const [error, setError]     = useState<string | null>(null);

  const handleFile = async (f: File) => {
    setFile(f); setError(null); setResultado(null);
    try {
      const data = await importarMut.mutateAsync({ file: f, dryRun: true });
      setPreview(data);
    } catch (err) {
      setError(getApiErrorMessage(err) ?? 'Error al procesar el archivo');
    }
  };

  const confirmar = async () => {
    if (!file) return;
    setError(null);
    try {
      const data = await importarMut.mutateAsync({ file, dryRun: false });
      setResultado({ creados: data.creados, omitidos: data.omitidos });
      setPreview(null);
    } catch (err) {
      setError(getApiErrorMessage(err) ?? 'Error al importar');
    }
  };

  if (resultado) {
    return (
      <div className="max-w-xl rounded-lg border border-border p-6 text-center space-y-2">
        <CheckCircle2 size={32} className="text-green-600 mx-auto" />
        <p className="text-sm font-medium">{resultado.creados} empleado(s) importado(s)</p>
        {resultado.omitidos > 0 && <p className="text-xs text-muted-foreground">{resultado.omitidos} fila(s) omitida(s)</p>}
        <Button size="sm" variant="outline" onClick={() => { setResultado(null); setFile(null); }}>Importar otro archivo</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground max-w-xl">
        Mapeo esperado: nombre, apellido, dni, cuit, cbu, alias, banco, email, teléfono — mismo layout que Proveedores-datos.xlsx.
      </p>
      {!preview && <Dropzone onFile={handleFile} busy={importarMut.isPending} />}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {preview && (
        <div className="space-y-3">
          <div className="flex items-center gap-4 text-sm">
            <span>{preview.total_filas} filas</span>
            <span className="text-green-600">{preview.importables} importables</span>
            {preview.omitidas > 0 && <span className="text-destructive">{preview.omitidas} omitidas</span>}
          </div>
          <div className="rounded-lg border border-border overflow-hidden max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-border sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Fila</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Nombre</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">DNI</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {preview.filas.map(f => (
                  <tr key={f.fila_excel} className={cn(!f.importable && 'bg-red-50')}>
                    <td className="px-3 py-2">{f.fila_excel}</td>
                    <td className="px-3 py-2">{f.apellido}, {f.nombre}</td>
                    <td className="px-3 py-2">{f.dni}</td>
                    <td className="px-3 py-2 text-xs">
                      {f.importable ? <span className="text-green-600">Importable</span> : <span className="text-destructive">{f.errores.join(', ')}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => { setPreview(null); setFile(null); }}>Cancelar</Button>
            <Button size="sm" onClick={confirmar} disabled={importarMut.isPending || preview.importables === 0}>
              {importarMut.isPending ? 'Importando…' : `Confirmar (${preview.importables})`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Importar jornadas ──────────────────────────────────────────────────────────

interface FilaJornada { fila_excel: number; fecha: string | null; importable: boolean; errores: string[] }
interface HojaJornadas { hoja: string; empleado_nombre: string | null; filas: FilaJornada[] }
interface PreviewJornadas { hojas: HojaJornadas[]; total_importables: number }

function ImportarJornadas() {
  const importarMut = useImportarJornadas();
  const [file, setFile]       = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewJornadas | null>(null);
  const [resultado, setResultado] = useState<{ creados: number; omitidos: number } | null>(null);
  const [error, setError]     = useState<string | null>(null);

  const handleFile = async (f: File) => {
    setFile(f); setError(null); setResultado(null);
    try {
      const data = await importarMut.mutateAsync({ file: f, dryRun: true });
      setPreview(data);
    } catch (err) {
      setError(getApiErrorMessage(err) ?? 'Error al procesar el archivo');
    }
  };

  const confirmar = async () => {
    if (!file) return;
    setError(null);
    try {
      const data = await importarMut.mutateAsync({ file, dryRun: false });
      setResultado({ creados: data.creados, omitidos: data.omitidos });
      setPreview(null);
    } catch (err) {
      setError(getApiErrorMessage(err) ?? 'Error al importar');
    }
  };

  if (resultado) {
    return (
      <div className="max-w-xl rounded-lg border border-border p-6 text-center space-y-2">
        <CheckCircle2 size={32} className="text-green-600 mx-auto" />
        <p className="text-sm font-medium">{resultado.creados} jornada(s) importada(s)</p>
        {resultado.omitidos > 0 && <p className="text-xs text-muted-foreground">{resultado.omitidos} fila(s) omitida(s) (duplicadas o inválidas)</p>}
        <Button size="sm" variant="outline" onClick={() => { setResultado(null); setFile(null); }}>Importar otro archivo</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground max-w-xl">
        Un empleado por hoja (el nombre de la hoja se matchea contra el apellido/nombre de empleados existentes) — mismo layout que Horas-y-vales.xlsx.
      </p>
      {!preview && <Dropzone onFile={handleFile} busy={importarMut.isPending} />}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {preview && (
        <div className="space-y-3">
          <p className="text-sm">{preview.total_importables} jornada(s) importables en {preview.hojas.length} hoja(s)</p>
          <div className="rounded-lg border border-border overflow-hidden max-h-96 overflow-y-auto divide-y divide-border">
            {preview.hojas.map(h => (
              <div key={h.hoja} className="p-3">
                <p className="text-sm font-medium mb-1">
                  {h.hoja} {h.empleado_nombre ? <span className="text-muted-foreground">→ {h.empleado_nombre}</span> : <span className="text-destructive">(sin empleado asociado)</span>}
                </p>
                <p className="text-xs text-muted-foreground">
                  {h.filas.filter(f => f.importable).length} de {h.filas.length} filas importables
                </p>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => { setPreview(null); setFile(null); }}>Cancelar</Button>
            <Button size="sm" onClick={confirmar} disabled={importarMut.isPending || preview.total_importables === 0}>
              {importarMut.isPending ? 'Importando…' : `Confirmar (${preview.total_importables})`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function RRHHImportarPage() {
  const [tab, setTab] = useState<'empleados' | 'jornadas'>('empleados');

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-foreground mb-6">Importar RRHH</h1>
      <div className="flex border-b border-border mb-6">
        {([{ key: 'empleados', label: 'Importar empleados' }, { key: 'jornadas', label: 'Importar jornadas' }] as const).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              tab === t.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'empleados' ? <ImportarEmpleados /> : <ImportarJornadas />}
    </div>
  );
}
