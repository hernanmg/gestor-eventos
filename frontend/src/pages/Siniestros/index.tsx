import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import SiniestrosVehiculoPanel from '@/components/siniestros/SiniestrosVehiculoPanel';
import { Plus, Upload } from 'lucide-react';
import { useSiniestros, useImportarSiniestros, useEmpleadosSiniestros, type ImportarSiniestrosResultado } from '@/hooks/useSiniestros';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { SiniestroEstadoBadge } from '@/components/ui/badge';
import { NuevoSiniestroDialog, SiniestroDrawer, ESTADOS_SINIESTRO } from '@/components/siniestros/SiniestroDialogs';
import { formatDate } from '@/lib/formatters';
import { cn, getApiErrorMessage } from '@/lib/utils';
import type { EstadoSiniestro, SiniestroEmpleado } from '@/types';
import BaseTable from '@/components/ui/BaseTable';

const inputCls = 'border border-input rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring';

// ── Importar desde Excel ─────────────────────────────────────────────────────

function ImportarDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const importar = useImportarSiniestros();
  const [resultado, setResultado] = useState<ImportarSiniestrosResultado | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (open) { setResultado(null); setError(null); } }, [open]);

  const handleFile = async (file: File) => {
    setError(null);
    try {
      setResultado(await importar.mutateAsync(file));
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Importar planilla de siniestros</DialogTitle></DialogHeader>
        <div className="space-y-3 mt-1 text-sm">
          {!resultado && (
            <>
              <p className="text-xs text-muted-foreground">
                Subí el "Informe Siniestros Personal" — se actualiza por N° de siniestro (un mismo N° reimportado pisa los datos existentes).
              </p>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
                disabled={importar.isPending}
                className="text-sm"
              />
              {importar.isPending && <p className="text-xs text-muted-foreground">Importando…</p>}
              {error && <p className="text-xs text-destructive">{error}</p>}
            </>
          )}
          {resultado && (
            <div className="space-y-2">
              <p>Filas procesadas: <span className="font-medium">{resultado.filas_procesadas}</span></p>
              <p>Siniestros creados: <span className="font-medium text-green-700">{resultado.creados}</span></p>
              <p>Siniestros actualizados: <span className="font-medium">{resultado.actualizados}</span></p>
              {resultado.omitidos > 0 && <p>Filas omitidas: <span className="font-medium">{resultado.omitidos}</span></p>}
              {resultado.sin_empleado.length > 0 && (
                <div className="text-amber-700 bg-amber-50 rounded p-2">
                  <p className="font-medium text-xs mb-1">Sin match en RRHH (se guardaron con nombre manual):</p>
                  <ul className="list-disc pl-4 text-xs space-y-0.5">
                    {resultado.sin_empleado.map((n, i) => <li key={i}>{n}</li>)}
                  </ul>
                </div>
              )}
              {resultado.errores.length > 0 && (
                <div className="text-destructive bg-destructive/10 rounded p-2">
                  <p className="font-medium text-xs mb-1">Errores:</p>
                  <ul className="list-disc pl-4 text-xs space-y-0.5">
                    {resultado.errores.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </div>
              )}
              <div className="flex justify-end pt-1"><Button size="sm" onClick={onClose}>Cerrar</Button></div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Página ────────────────────────────────────────────────────────────────────

// Lorena gestiona siniestros de personal (ART) y de vehículos desde la misma
// pantalla — toggle [Empleados] [Vehículos] (?vista=vehiculos).
export default function SiniestrosPage() {
  const { user } = useAuth();
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const vista: 'empleados' | 'vehiculos' = !id && searchParams.get('vista') === 'vehiculos' ? 'vehiculos' : 'empleados';
  const canEdit = user?.rol === 'ADMIN' || user?.rol === 'OPERADOR';

  const setVista = (v: 'empleados' | 'vehiculos') => setSearchParams(v === 'vehiculos' ? { vista: 'vehiculos' } : {}, { replace: true });

  const toggle = (
    <div className="inline-flex rounded-md border border-border p-0.5 bg-muted/30">
      {([['empleados', '👷 Empleados'], ['vehiculos', '🚗 Vehículos']] as const).map(([k, label]) => (
        <button
          key={k}
          onClick={() => setVista(k)}
          className={cn('px-3 py-1 text-sm rounded', vista === k ? 'bg-white shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground')}
        >
          {label}
        </button>
      ))}
    </div>
  );

  if (vista === 'vehiculos') {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-lg font-semibold">🚗 Siniestros de vehículos</h1>
            <p className="text-xs text-muted-foreground">Informe de siniestros de la flota — seguro, tercero involucrado y resolución.</p>
          </div>
          {toggle}
        </div>
        <SiniestrosVehiculoPanel canEdit={canEdit} />
      </div>
    );
  }

  return <SiniestrosEmpleadosView toggle={toggle} />;
}

function SiniestrosEmpleadosView({ toggle }: { toggle: React.ReactNode }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const canEdit = user?.rol === 'ADMIN' || user?.rol === 'OPERADOR';

  const [estado, setEstado]         = useState<EstadoSiniestro | 'TODOS'>('TODOS');
  const [empleadoId, setEmpleadoId] = useState<number | null>(null);
  const [art, setArt]               = useState<string | 'TODOS'>('TODOS');
  const [anio, setAnio]             = useState<number | 'TODOS'>('TODOS');
  const [condicion, setCondicion]   = useState<string | 'TODOS'>('TODOS');
  const [nuevoOpen, setNuevoOpen]   = useState(false);
  const [importarOpen, setImportarOpen] = useState(false);
  const [viewingId, setViewingId]   = useState<number | null>(id ? Number(id) : null);

  useEffect(() => { setViewingId(id ? Number(id) : null); }, [id]);

  const { data: empleados = [] } = useEmpleadosSiniestros();
  const { data: siniestros = [], isLoading } = useSiniestros({
    estado: estado === 'TODOS' ? undefined : estado,
    empleado_id: empleadoId ?? undefined,
  });

  const anios = useMemo(
    () => Array.from(new Set(siniestros.map(s => new Date(s.fecha_ocurrencia).getUTCFullYear()))).sort((a, b) => b - a),
    [siniestros],
  );
  const artOptions = useMemo(
    () => Array.from(new Set(siniestros.map(s => s.art_nombre).filter((v): v is string => !!v))).sort(),
    [siniestros],
  );
  const condicionOptions = useMemo(
    () => Array.from(new Set(siniestros.map(s => s.condicion_laboral).filter((v): v is string => !!v))).sort(),
    [siniestros],
  );

  const filtrados = siniestros.filter(s =>
    (art === 'TODOS' || s.art_nombre === art) &&
    (anio === 'TODOS' || new Date(s.fecha_ocurrencia).getUTCFullYear() === anio) &&
    (condicion === 'TODOS' || s.condicion_laboral === condicion),
  );

  const anioActual = new Date().getUTCFullYear();
  const delAnioActual = siniestros.filter(s => new Date(s.fecha_ocurrencia).getUTCFullYear() === anioActual);
  const abiertos = siniestros.filter(s => s.estado === 'ABIERTO' || s.estado === 'EN_TRAMITE').length;
  const cerrados = siniestros.filter(s => s.estado === 'CERRADO').length;
  const porArt = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of siniestros) {
      if (!s.art_nombre) continue;
      map.set(s.art_nombre, (map.get(s.art_nombre) ?? 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [siniestros]);

  const empleadoOptions: ComboboxOption[] = empleados.map(e => ({ value: String(e.id), label: `${e.apellido}, ${e.nombre}` }));

  const th = 'px-2.5 py-2 text-left text-xs font-medium text-muted-foreground whitespace-nowrap';
  const td = 'px-2.5 py-2 text-sm whitespace-nowrap';

  const closeDrawer = () => { setViewingId(null); if (id) navigate('/siniestros'); };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">🚑 Siniestros de empleados</h1>
          <p className="text-xs text-muted-foreground">Informe de siniestros de personal (ART) — carga y seguimiento.</p>
        </div>
        <div className="flex items-center gap-2">
          {toggle}
          {canEdit && (
            <Button size="sm" variant="outline" onClick={() => setImportarOpen(true)}>
              <Upload size={14} className="mr-1.5" /> Importar desde Excel
            </Button>
          )}
          {canEdit && (
            <Button size="sm" onClick={() => setNuevoOpen(true)}>
              <Plus size={14} className="mr-1.5" /> Nuevo siniestro
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-lg border bg-white p-3">
          <p className="text-xs text-muted-foreground">Total {anioActual}</p>
          <p className="text-2xl font-semibold">{delAnioActual.length}</p>
        </div>
        <div className="rounded-lg border bg-white p-3">
          <p className="text-xs text-muted-foreground">Abiertos</p>
          <p className="text-2xl font-semibold text-red-600">{abiertos}</p>
        </div>
        <div className="rounded-lg border bg-white p-3">
          <p className="text-xs text-muted-foreground">Cerrados</p>
          <p className="text-2xl font-semibold text-green-600">{cerrados}</p>
        </div>
        <div className="rounded-lg border bg-white p-3">
          <p className="text-xs text-muted-foreground mb-1">Por ART</p>
          {porArt.length === 0 ? <p className="text-sm text-muted-foreground">—</p> : (
            <div className="space-y-0.5">
              {porArt.map(([nombre, cant]) => (
                <p key={nombre} className="text-xs flex justify-between"><span>{nombre}</span><span className="font-medium">{cant}</span></p>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Grid: el Combobox trae sm:w-64 propio — sin sm:w-full se desborda
          de su celda y se monta sobre el filtro de al lado. */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
        <Combobox options={empleadoOptions} value={empleadoId ? String(empleadoId) : null} onChange={v => setEmpleadoId(v ? Number(v) : null)} placeholder="Todos los empleados" className="w-full sm:w-full" />
        <select value={art} onChange={e => setArt(e.target.value)} className={cn(inputCls, 'w-full')}>
          <option value="TODOS">Todas las ART</option>
          {artOptions.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={estado} onChange={e => setEstado(e.target.value as EstadoSiniestro | 'TODOS')} className={cn(inputCls, 'w-full')}>
          <option value="TODOS">Todos los estados</option>
          {ESTADOS_SINIESTRO.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
        <select value={String(anio)} onChange={e => setAnio(e.target.value === 'TODOS' ? 'TODOS' : Number(e.target.value))} className={cn(inputCls, 'w-full')}>
          <option value="TODOS">Todos los años</option>
          {anios.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={condicion} onChange={e => setCondicion(e.target.value)} className={cn(inputCls, 'w-full')}>
          <option value="TODOS">Toda condición laboral</option>
          {condicionOptions.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : (
        <div className="overflow-x-auto">
          <BaseTable className="w-full text-sm min-w-[1400px]">
            <thead className="border-b bg-muted/30">
              <tr>
                <th className={th}>Item</th>
                <th className={th}>Fecha</th>
                <th className={th}>N° Siniestro</th>
                <th className={th}>Empleado</th>
                <th className={th}>ART</th>
                <th className={th}>Condición</th>
                <th className={th}>Tipo de incidente</th>
                <th className={th}>Diagnóstico</th>
                <th className={th}>Zona afectada</th>
                <th className={th}>Lugar</th>
                <th className={th}>Alta médica</th>
                <th className={th}>Estado</th>
                <th className={th}>Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtrados.length === 0 ? (
                <tr><td colSpan={13} className="px-3 py-6 text-center text-sm text-muted-foreground">Sin siniestros para este filtro.</td></tr>
              ) : filtrados.map((s: SiniestroEmpleado, i: number) => (
                <tr key={s.id} className="cursor-pointer hover:bg-muted/10" onClick={() => navigate(`/siniestros/${s.id}`)}>
                  <td className={td}>{i + 1}</td>
                  <td className={td}>{formatDate(s.fecha_ocurrencia)}</td>
                  <td className={td}>{s.art_numero_siniestro ?? '—'}</td>
                  <td className={td}>{s.empleado ? `${s.empleado.apellido}, ${s.empleado.nombre}` : (s.empleado_nombre_manual ?? '—')}</td>
                  <td className={td}>{s.art_nombre ?? '—'}</td>
                  <td className={td}>{s.condicion_laboral ?? '—'}</td>
                  <td className={cn(td, 'max-w-[220px] truncate whitespace-normal')}>{s.descripcion}</td>
                  <td className={cn(td, 'max-w-[180px] truncate whitespace-normal')}>{s.diagnostico ?? '—'}</td>
                  <td className={td}>{s.zona_afectada ?? '—'}</td>
                  <td className={td}>{s.lugar ?? '—'}</td>
                  <td className={td}>{s.fecha_alta_medica ? formatDate(s.fecha_alta_medica) : '—'}</td>
                  <td className={td}><SiniestroEstadoBadge estado={s.estado} /></td>
                  <td className={td}>
                    <button className="text-xs text-primary hover:underline" onClick={e => { e.stopPropagation(); navigate(`/siniestros/${s.id}`); }}>Ver detalle</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </BaseTable>
        </div>
      )}

      {nuevoOpen && <NuevoSiniestroDialog onClose={() => setNuevoOpen(false)} />}
      <ImportarDialog open={importarOpen} onClose={() => setImportarOpen(false)} />
      {viewingId !== null && <SiniestroDrawer id={viewingId} canEdit={canEdit} onClose={closeDrawer} />}
    </div>
  );
}
