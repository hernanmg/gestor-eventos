import { useEffect, useState } from 'react';
import { Download, Plus, Shirt, Upload } from 'lucide-react';
import { useResumenUniformes, useImportarUniformes, useExportarUniformes, PRENDAS_UNIFORME, PRENDA_LABEL } from '@/hooks/useUniformes';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import BaseTable from '@/components/ui/BaseTable';
import HistorialUniformes, { EntregaUniformeDialog } from '@/components/uniformes/HistorialUniformes';
import { EMPRESAS } from '@/lib/empresasConstants';
import { cn, getApiErrorMessage } from '@/lib/utils';
import type { ImportarUniformesResultado, ModoImportUniformes, ResumenUniformesFila } from '@/types';

// Entregas de uniformes (Lorena, DOS57) — resumen anual por empleado, estilo
// hoja DOS57_ENTREGA_AAAA del Excel, + importador del libro completo.

const selCls = 'border border-input rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring';
const labelCls = 'block text-xs font-medium text-muted-foreground mb-0.5';

const EMPRESA_OPTS = [
  { id: EMPRESAS.DOS57, label: 'DOS57' },
  { id: EMPRESAS.ENJOY, label: 'Enjoy' },
];

const MODO_LABEL: Record<ModoImportUniformes, string> = {
  HISTORIAL: 'Historial (PLANTA ESTABLE + hojas por empleado)',
  RESUMEN:   'Resumen anual (DOS57_ENTREGA_AAAA)',
  TODO:      'Todo',
};

// ── Importar (preview → confirmar) ────────────────────────────────────────────

function ImportarDialog({ empresaDefault, onClose }: { empresaDefault: number; onClose: () => void }) {
  const importar = useImportarUniformes();
  const [file, setFile] = useState<File | null>(null);
  const [empresaId, setEmpresaId] = useState(empresaDefault);
  const [modo, setModo] = useState<ModoImportUniformes>('TODO');
  const [preview, setPreview] = useState<ImportarUniformesResultado | null>(null);
  const [final, setFinal] = useState<ImportarUniformesResultado | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Cambiar archivo/empresa/modo invalida el preview
  useEffect(() => { setPreview(null); setError(null); }, [file, empresaId, modo]);

  const correr = async (dryRun: boolean) => {
    if (!file) return;
    setError(null);
    try {
      const r = await importar.mutateAsync({ file, modo, empresaId, dryRun });
      if (dryRun) setPreview(r); else setFinal(r);
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  const r = final ?? preview;

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Importar entregas de uniformes</DialogTitle></DialogHeader>
        <div className="space-y-3 mt-1 text-sm">
          {!final && (
            <>
              <div>
                <label className={labelCls}>Archivo (.xlsx)</label>
                <input type="file" accept=".xlsx" className="text-sm" onChange={e => setFile(e.target.files?.[0] ?? null)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Empresa</label>
                  <select value={empresaId} onChange={e => setEmpresaId(Number(e.target.value))} className={cn(selCls, 'w-full')}>
                    {EMPRESA_OPTS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Modo</label>
                  <select value={modo} onChange={e => setModo(e.target.value as ModoImportUniformes)} className={cn(selCls, 'w-full')}>
                    {(Object.keys(MODO_LABEL) as ModoImportUniformes[]).map(m => <option key={m} value={m}>{MODO_LABEL[m]}</option>)}
                  </select>
                </div>
              </div>
            </>
          )}

          {r && (
            <div className="space-y-2 rounded-md border border-border p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {final ? '✓ Importación realizada' : 'Vista previa — todavía no se guardó nada'}
              </p>
              <p>
                Entregas {final ? 'creadas' : 'a crear'}: <span className="font-medium text-green-700">{r.entregas_creadas}</span>
                {' · '}{final ? 'actualizadas' : 'a actualizar'}: <span className="font-medium">{r.entregas_actualizadas}</span>
                {' · '}hojas: <span className="font-medium">{r.hojas_procesadas.length}</span>
              </p>
              {r.empleados_dados_baja.length > 0 && (
                <div className="rounded bg-red-50 text-red-800 p-2">
                  <p className="font-medium text-xs mb-1">
                    {final ? 'Empleados dados de baja' : 'Se van a dar de baja (estado INACTIVO)'} — {r.empleados_dados_baja.length}:
                  </p>
                  <ul className="list-disc pl-4 text-xs space-y-0.5">
                    {r.empleados_dados_baja.map(b => <li key={b.empleado_id}>{b.nombre} <span className="opacity-70">(hoja "{b.hoja}")</span></li>)}
                  </ul>
                </div>
              )}
              {r.bajas_ambiguas.length > 0 && (
                <div className="rounded bg-amber-50 text-amber-800 p-2">
                  <p className="font-medium text-xs mb-1">Hoja en rojo pero NO se da de baja:</p>
                  <ul className="list-disc pl-4 text-xs space-y-0.5">
                    {r.bajas_ambiguas.map((b, i) => <li key={i}>{b.nombre} — {b.motivo}</li>)}
                  </ul>
                </div>
              )}
              {r.empleados_no_encontrados.length > 0 && (
                <div className="rounded bg-amber-50 text-amber-800 p-2">
                  <p className="font-medium text-xs mb-1">No encontrados en RRHH ({r.empleados_no_encontrados.length}) — se guardan con el nombre de la planilla:</p>
                  <p className="text-xs">{r.empleados_no_encontrados.map(n => n.nombre).join(', ')}</p>
                </div>
              )}
              {r.errores.length > 0 && (
                <details className="rounded bg-muted/40 p-2 text-xs">
                  <summary className="cursor-pointer font-medium">Filas omitidas / avisos ({r.errores.length})</summary>
                  <ul className="list-disc pl-4 mt-1 space-y-0.5">
                    {r.errores.map((e, i) => <li key={i}><span className="font-medium">{e.hoja}:</span> {e.motivo}</li>)}
                  </ul>
                </details>
              )}
            </div>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            {final ? (
              <Button size="sm" onClick={onClose}>Cerrar</Button>
            ) : (
              <>
                <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
                {!preview ? (
                  <Button size="sm" disabled={!file || importar.isPending} onClick={() => correr(true)}>
                    {importar.isPending ? 'Analizando…' : 'Vista previa'}
                  </Button>
                ) : (
                  <Button size="sm" disabled={importar.isPending} onClick={() => correr(false)}>
                    {importar.isPending ? 'Importando…' : 'Confirmar importación'}
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Modal: historial completo de una persona (click en la fila) ──────────────

function HistorialModal({ fila, empresaId, canEdit, onClose }: {
  fila: ResumenUniformesFila; empresaId: number; canEdit: boolean; onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <Shirt size={18} /> {fila.empleado_nombre}
            {fila.empleado_id === null && <Badge variant="warning">sin legajo en RRHH</Badge>}
            {fila.empleado_estado === 'INACTIVO' && <Badge variant="muted">baja</Badge>}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">Historial completo de entregas (todos los años).</p>
        </DialogHeader>
        <HistorialUniformes
          refEmpleado={fila.empleado_id !== null ? { empleadoId: fila.empleado_id } : { empleadoNombre: fila.empleado_nombre, empresaId }}
          canEdit={canEdit}
        />
      </DialogContent>
    </Dialog>
  );
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function UniformesPage() {
  const { user } = useAuth();
  // La sección la administra Lorena (OPERADOR) — importar/exportar para ADMIN y OPERADOR.
  const puedeGestionar = user?.rol === 'ADMIN' || user?.rol === 'OPERADOR';
  const { exportar, isExporting } = useExportarUniformes();
  const [exportError, setExportError] = useState<string | null>(null);
  const handleExportar = async () => {
    setExportError(null);
    try { await exportar(anio, empresaId); }
    catch (err) { console.error('[Uniformes] exportar falló:', err); setExportError('No se pudo exportar el Excel.'); }
  };
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [empresaId, setEmpresaId] = useState<number>(user?.empresaId ?? EMPRESAS.DOS57);
  const [importarOpen, setImportarOpen] = useState(false);
  const [nuevaOpen, setNuevaOpen] = useState(false);
  const [filaSel, setFilaSel] = useState<ResumenUniformesFila | null>(null);
  const { data, isLoading, error } = useResumenUniformes(anio, empresaId);

  // No silenciar fallos de la query — se ven en pantalla y en la consola.
  useEffect(() => { if (error) console.error('[Uniformes] GET /uniformes/resumen falló:', error); }, [error]);
  const sinDatosNunca = !!data && data.anios_disponibles.length === 0;

  const anios = Array.from(new Set([anio, new Date().getFullYear(), ...(data?.anios_disponibles ?? [])])).sort((a, b) => b - a);
  const th = 'px-2 py-2 text-xs font-medium text-muted-foreground whitespace-nowrap';
  const td = 'px-2 py-1.5 text-sm whitespace-nowrap';

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2"><Shirt size={20} /> Entrega de uniformes</h1>
          <p className="text-xs text-muted-foreground">Totales por empleado del año — hacé click en una fila para ver, cargar o corregir su historial de entregas.</p>
        </div>
        {puedeGestionar && (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={handleExportar} disabled={isExporting || !data || data.filas.length === 0}
              title={!data || data.filas.length === 0 ? `No hay entregas en ${anio} para exportar` : 'Resumen del año + detalle de cada entrega'}>
              <Download size={14} className="mr-1.5" /> {isExporting ? 'Exportando…' : 'Exportar a Excel'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setImportarOpen(true)}>
              <Upload size={14} className="mr-1.5" /> Importar desde Excel
            </Button>
            <Button size="sm" onClick={() => setNuevaOpen(true)}>
              <Plus size={14} className="mr-1.5" /> Nueva entrega
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select value={anio} onChange={e => setAnio(Number(e.target.value))} className={selCls}>
          {anios.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={empresaId} onChange={e => setEmpresaId(Number(e.target.value))} className={selCls}>
          {EMPRESA_OPTS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      </div>

      {exportError && <p className="text-sm text-destructive">{exportError}</p>}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : error ? (
        <p className="text-sm text-destructive">{getApiErrorMessage(error)}</p>
      ) : !data || data.filas.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-white p-10 text-center space-y-2 min-h-[200px] flex flex-col items-center justify-center">
          <Shirt size={32} className="text-muted-foreground/60" />
          <p className="text-sm font-medium">Sin entregas registradas para {anio}.</p>
          {sinDatosNunca ? (
            <p className="text-xs text-muted-foreground max-w-md">
              Todavía no se importó la planilla de entrega de uniformes para esta empresa.
              {puedeGestionar ? ' Usá "Importar desde Excel" para cargar el historial.' : ' Pedile a un administrador que la importe.'}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">Probá con otro año: hay datos de {data!.anios_disponibles.join(', ')}.</p>
          )}
          {puedeGestionar && sinDatosNunca && (
            <Button size="sm" variant="outline" className="mt-2" onClick={() => setImportarOpen(true)}>
              <Upload size={14} className="mr-1.5" /> Importar desde Excel
            </Button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <BaseTable className="w-full text-sm min-w-[1100px]">
            <thead className="border-b bg-muted/30">
              <tr>
                <th className={cn(th, 'text-left')}>Empleado</th>
                {PRENDAS_UNIFORME.map(p => <th key={p} className={cn(th, 'text-right')}>{PRENDA_LABEL[p]}</th>)}
                <th className={cn(th, 'text-left')}>Otros</th>
                <th className={cn(th, 'text-left')}>Fuente</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.filas.map(f => (
                <tr key={f.empleado_id ?? f.empleado_nombre} onClick={() => setFilaSel(f)} title="Ver historial de entregas"
                  className={cn('cursor-pointer hover:bg-muted/10', f.empleado_estado === 'INACTIVO' && 'text-muted-foreground')}>
                  <td className={cn(td, 'font-medium')}>
                    {f.empleado_nombre}
                    {f.empleado_id === null && <Badge variant="warning" className="ml-1.5">sin RRHH</Badge>}
                    {f.empleado_estado === 'INACTIVO' && <Badge variant="muted" className="ml-1.5">baja</Badge>}
                  </td>
                  {PRENDAS_UNIFORME.map(p => (
                    <td key={p} className={cn(td, 'text-right', f[p] === 0 && 'text-muted-foreground/50')}>{f[p] || '—'}</td>
                  ))}
                  <td className={cn(td, 'max-w-[220px] truncate text-xs')} title={f.otros ?? undefined}>{f.otros ?? '—'}</td>
                  <td className={cn(td, 'text-xs text-muted-foreground')} title={f.fuente === 'RESUMEN' ? 'Hoja de resumen anual de la planilla' : `Suma de ${f.entregas} entrega(s) del historial`}>
                    {f.fuente === 'RESUMEN' ? 'Resumen anual' : `${f.entregas} entrega${f.entregas !== 1 ? 's' : ''}`}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold">
                <td className={td}>Total</td>
                {PRENDAS_UNIFORME.map(p => <td key={p} className={cn(td, 'text-right')}>{data.totales[p]}</td>)}
                <td className={td} colSpan={2} />
              </tr>
            </tfoot>
          </BaseTable>
        </div>
      )}

      {importarOpen && <ImportarDialog empresaDefault={empresaId} onClose={() => setImportarOpen(false)} />}
      {nuevaOpen && <EntregaUniformeDialog onClose={() => setNuevaOpen(false)} />}
      {filaSel && <HistorialModal fila={filaSel} empresaId={empresaId} canEdit={puedeGestionar} onClose={() => setFilaSel(null)} />}
    </div>
  );
}
