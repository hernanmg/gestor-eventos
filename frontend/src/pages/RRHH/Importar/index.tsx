import { useRef, useState } from 'react';
import { Upload, FileSpreadsheet, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useImportarEmpleados, useImportarJornadas } from '@/hooks/useRRHH';
import { Button } from '@/components/ui/button';
import { cn, getApiErrorMessage } from '@/lib/utils';
import BaseTable from '@/components/ui/BaseTable';
import PageHeader from '@/components/ui/PageHeader';
import TabStrip from '@/components/ui/TabStrip';

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
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <BaseTable className="w-full text-sm">
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
            </BaseTable>
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

// ── Importar jornadas (planilla HORAS Y VALES de Enjoy) ───────────────────────

interface FilaJornada { fila_excel: number; fecha: string; inicio: string | null; fin: string | null; horas: number; detalle: string | null; accion: 'crear' | 'actualizar' | 'liquidada'; aviso?: string }
interface ValeJornada { fila_excel: number; fecha: string; detalle: string | null; monto: number; tipo: string; accion: 'crear' | 'existente' }
interface HojaJornadas {
  hoja: string; es_planilla: boolean; periodo: string | null; empleado_nombre: string | null; crea_empleado: boolean; empleado_id: number | null;
  avisos: string[]; dias_libres: number; horas_total: number; horas_planilla: number | null; filas: FilaJornada[]; vales: ValeJornada[];
}
interface PreviewJornadas { hojas: HojaJornadas[]; total_importables: number; total_vales: number; empleados_nuevos: number }
interface ResultadoJornadas { creadas: number; actualizadas: number; vales_creados: number; empleados_creados: number }

const ACCION_LABEL: Record<FilaJornada['accion'], string> = { crear: 'Nueva', actualizar: 'Se actualiza', liquidada: 'Ya liquidada' };

function HojaPreview({ h }: { h: HojaJornadas }) {
  const [abierta, setAbierta] = useState(false);
  if (!h.es_planilla) {
    return <div className="p-3 text-xs text-muted-foreground">{h.hoja}: no es una hoja de horas, se saltea.</div>;
  }
  const importable = !!h.empleado_id || h.crea_empleado;
  return (
    <div className="p-3 space-y-1">
      <button type="button" onClick={() => setAbierta(a => !a)} className="w-full text-left">
        <p className="text-sm font-medium">
          {h.hoja}{' '}
          {h.empleado_nombre
            ? <span className={cn(h.crea_empleado ? 'text-amber-700' : 'text-muted-foreground')}>→ {h.empleado_nombre}{h.crea_empleado && ' (nuevo)'}</span>
            : <span className="text-destructive">(sin empleado)</span>}
          {h.periodo && <span className="ml-2 text-xs text-muted-foreground">{h.periodo}</span>}
        </p>
        <p className="text-xs text-muted-foreground">
          {h.filas.length} día(s) trabajados · {h.horas_total} hs
          {h.horas_planilla !== null && ` (la hoja dice ${h.horas_planilla})`}
          {h.dias_libres > 0 && ` · ${h.dias_libres} libres`}
          {h.vales.length > 0 && ` · ${h.vales.length} vale(s)`}
          {' · '}<span className="text-link">{abierta ? 'ocultar detalle' : 'ver detalle'}</span>
        </p>
      </button>
      {h.avisos.map(a => <p key={a} className="text-xs text-amber-700 flex items-start gap-1"><AlertTriangle size={12} className="mt-0.5 shrink-0" />{a}</p>)}
      {abierta && importable && (
        <div className="overflow-x-auto pt-1">
          <BaseTable className="w-full text-xs">
            <thead className="text-muted-foreground">
              <tr>
                <th className="px-1.5 py-1 text-left">Fecha</th>
                <th className="px-1.5 py-1 text-left">Horario</th>
                <th className="px-1.5 py-1 text-right">Hs.</th>
                <th className="px-1.5 py-1 text-left">Detalle</th>
                <th className="px-1.5 py-1 text-left">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {h.filas.map(f => (
                <tr key={f.fila_excel}>
                  <td className="px-1.5 py-1">{f.fecha.slice(8, 10)}/{f.fecha.slice(5, 7)}</td>
                  <td className="px-1.5 py-1">{f.inicio ?? '—'} a {f.fin ?? '—'}</td>
                  <td className="px-1.5 py-1 text-right">{f.horas}</td>
                  <td className="px-1.5 py-1">{f.detalle ?? '—'}{f.aviso && <span className="block text-amber-700">{f.aviso}</span>}</td>
                  <td className={cn('px-1.5 py-1', f.accion === 'liquidada' && 'text-muted-foreground')}>{ACCION_LABEL[f.accion]}</td>
                </tr>
              ))}
              {h.vales.map(v => (
                <tr key={`v${v.fila_excel}-${v.monto}`} className="bg-muted/30">
                  <td className="px-1.5 py-1">{v.fecha.slice(8, 10)}/{v.fecha.slice(5, 7)}</td>
                  <td className="px-1.5 py-1" colSpan={2}>{v.tipo.toLowerCase()} ${v.monto.toLocaleString('es-AR')}</td>
                  <td className="px-1.5 py-1">{v.detalle ?? '—'}</td>
                  <td className="px-1.5 py-1">{v.accion === 'crear' ? 'Nuevo' : 'Ya cargado'}</td>
                </tr>
              ))}
            </tbody>
          </BaseTable>
        </div>
      )}
    </div>
  );
}

function ImportarJornadas() {
  const importarMut = useImportarJornadas();
  const [file, setFile]       = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewJornadas | null>(null);
  const [resultado, setResultado] = useState<ResultadoJornadas | null>(null);
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
      setResultado(data);
      setPreview(null);
    } catch (err) {
      setError(getApiErrorMessage(err) ?? 'Error al importar');
    }
  };

  if (resultado) {
    return (
      <div className="max-w-xl rounded-lg border border-border p-6 text-center space-y-2">
        <CheckCircle2 size={32} className="text-green-600 mx-auto" />
        <p className="text-sm font-medium">{resultado.creadas} jornada(s) nuevas · {resultado.actualizadas} actualizada(s)</p>
        <p className="text-xs text-muted-foreground">
          {resultado.vales_creados} vale(s) cargados{resultado.empleados_creados > 0 && ` · ${resultado.empleados_creados} empleado(s) dados de alta (falta cargarles el valor hora)`}
        </p>
        <p className="text-xs text-muted-foreground">Las jornadas quedan aprobadas: ya se pueden liquidar desde Liquidaciones → Generar pendientes.</p>
        <Button size="sm" variant="outline" onClick={() => { setResultado(null); setFile(null); }}>Importar otro archivo</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground max-w-xl">
        Planilla HORAS Y VALES del mes: una hoja por persona (Nombre, DNI, días con ingreso, egreso y horas trabajadas, y los vales abajo).
        Se toman las horas trabajadas de la planilla y las jornadas quedan aprobadas. Reimportar el mismo archivo no duplica.
      </p>
      {!preview && <Dropzone onFile={handleFile} busy={importarMut.isPending} />}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {preview && (
        <div className="space-y-3">
          <p className="text-sm">
            {preview.total_importables} jornada(s) y {preview.total_vales} vale(s) para importar
            {preview.empleados_nuevos > 0 && ` · ${preview.empleados_nuevos} persona(s) nuevas`}
          </p>
          <div className="rounded-lg border border-border overflow-hidden max-h-[28rem] overflow-y-auto divide-y divide-border">
            {preview.hojas.map(h => <HojaPreview key={h.hoja} h={h} />)}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => { setPreview(null); setFile(null); }}>Cancelar</Button>
            <Button size="sm" onClick={confirmar} disabled={importarMut.isPending || (preview.total_importables === 0 && preview.total_vales === 0)}>
              {importarMut.isPending ? 'Importando…' : `Confirmar (${preview.total_importables} jornadas)`}
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
      <PageHeader title="Importar RRHH" className="mb-4" />
      <TabStrip<'empleados' | 'jornadas'>
        value={tab}
        onChange={setTab}
        className="mb-6"
        items={[{ key: 'empleados', label: 'Importar empleados' }, { key: 'jornadas', label: 'Horas y vales' }]}
      />
      {tab === 'empleados' ? <ImportarEmpleados /> : <ImportarJornadas />}
    </div>
  );
}
