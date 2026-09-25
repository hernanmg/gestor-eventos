import { useState } from 'react';
import { Plus, Upload } from 'lucide-react';
import { useEmpleadosSiniestros } from '@/hooks/useSiniestros';
import {
  useSiniestrosVehiculo, useSiniestroVehiculo, useCreateSiniestroVehiculo, useUpdateSiniestroVehiculo,
  useResolverSiniestroVehiculo, useImportarSiniestrosVehiculo, type SiniestroVehiculoPayload,
} from '@/hooks/useSiniestrosVehiculo';
import { useVehiculosFlota } from '@/hooks/useFlota';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { SiniestroVehiculoEstadoBadge, SINIESTRO_VEHICULO_LABEL } from '@/components/ui/badge';
import BaseTable from '@/components/ui/BaseTable';
import { formatDate } from '@/lib/formatters';
import { cn, getApiErrorMessage } from '@/lib/utils';
import type { EstadoSiniestroVehiculo, ImportarSiniestrosVehiculoResultado, SiniestroVehiculo } from '@/types';

// Siniestros de vehículos (Lorena, DOS57) — se usa en /flota (tab
// "Siniestros") y en /siniestros (toggle Empleados/Vehículos).

const inputCls = 'w-full border border-input rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring';
const labelCls = 'block text-xs font-medium text-muted-foreground mb-0.5';

export const ESTADOS_SINIESTRO_VEHICULO: EstadoSiniestroVehiculo[] = ['ABIERTO', 'EN_PROCESO', 'RESUELTO', 'SIN_NOVEDAD'];

function vehiculoLabel(s: SiniestroVehiculo): string {
  if (s.camion) return s.camion.patente ?? s.camion.codigo;
  return s.patente_texto ?? '—';
}

function conductorLabel(s: SiniestroVehiculo): string {
  if (s.empleado) return `${s.empleado.apellido}, ${s.empleado.nombre}`;
  return s.empleado_nombre_manual ?? '—';
}

function terceroLabel(s: SiniestroVehiculo): string {
  const partes = [s.tercero_nombre, s.tercero_vehiculo, s.tercero_seguro].filter(Boolean);
  return partes.length ? partes.join(' / ') : 'Sin tercero';
}

const fechaInput = (iso: string | null) => (iso ? iso.slice(0, 10) : '');

// ── Importar ──────────────────────────────────────────────────────────────────

function ImportarDialog({ onClose }: { onClose: () => void }) {
  const importar = useImportarSiniestrosVehiculo();
  const [resultado, setResultado] = useState<ImportarSiniestrosVehiculoResultado | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setError(null);
    try { setResultado(await importar.mutateAsync(file)); }
    catch (err) { setError(getApiErrorMessage(err)); }
  };

  const lista = (titulo: string, items: string[], cls: string) => items.length > 0 && (
    <div className={cn('rounded p-2', cls)}>
      <p className="font-medium text-xs mb-1">{titulo}</p>
      <ul className="list-disc pl-4 text-xs space-y-0.5">{items.map((n, i) => <li key={i}>{n}</li>)}</ul>
    </div>
  );

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Importar siniestros de vehículos</DialogTitle></DialogHeader>
        <div className="space-y-3 mt-1 text-sm">
          {!resultado ? (
            <>
              <p className="text-xs text-muted-foreground">
                Subí el "Informe siniestros vehículos" — se actualiza por N° de siniestro (reimportar el mismo N° pisa los datos existentes).
              </p>
              <input type="file" accept=".xlsx" disabled={importar.isPending} className="text-sm"
                onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
              {importar.isPending && <p className="text-xs text-muted-foreground">Importando…</p>}
              {error && <p className="text-xs text-destructive">{error}</p>}
            </>
          ) : (
            <div className="space-y-2">
              <p>Filas procesadas: <span className="font-medium">{resultado.filas_procesadas}</span></p>
              <p>Creados: <span className="font-medium text-green-700">{resultado.creados}</span> · Actualizados: <span className="font-medium">{resultado.actualizados}</span>
                {resultado.omitidos > 0 && <> · Omitidos: <span className="font-medium">{resultado.omitidos}</span></>}
              </p>
              {lista('Conductor sin match en RRHH (se guardó el nombre):', resultado.sin_empleado, 'text-amber-700 bg-amber-50')}
              {lista('Vehículo no encontrado en Flota (se guardó la patente):', resultado.sin_vehiculo, 'text-amber-700 bg-amber-50')}
              {lista('Estado no reconocido (quedó ABIERTO, el texto va a observaciones):', resultado.estados_no_reconocidos, 'text-amber-700 bg-amber-50')}
              {lista('Errores:', resultado.errores, 'text-destructive bg-destructive/10')}
              <div className="flex justify-end pt-1"><Button size="sm" onClick={onClose}>Cerrar</Button></div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Alta / edición ────────────────────────────────────────────────────────────

function SiniestroVehiculoForm({ inicial, onClose }: { inicial?: SiniestroVehiculo; onClose: () => void }) {
  const createMut = useCreateSiniestroVehiculo();
  const updateMut = useUpdateSiniestroVehiculo(inicial?.id ?? 0);
  const { data: vehiculos = [] } = useVehiculosFlota();
  const { data: empleados = [] } = useEmpleadosSiniestros();

  const [form, setForm] = useState<SiniestroVehiculoPayload>(() => ({
    camion_id:              inicial?.camion_id ?? null,
    patente_texto:          inicial?.patente_texto ?? '',
    empleado_id:            inicial?.empleado_id ?? null,
    empleado_nombre_manual: inicial?.empleado_nombre_manual ?? '',
    aseguradora:            inicial?.aseguradora ?? '',
    numero_siniestro:       inicial?.numero_siniestro ?? '',
    fecha_denuncia:         fechaInput(inicial?.fecha_denuncia ?? null),
    fecha_ocurrencia:       fechaInput(inicial?.fecha_ocurrencia ?? null),
    lugar:                  inicial?.lugar ?? '',
    descripcion:            inicial?.descripcion ?? '',
    danios:                 inicial?.danios ?? '',
    tercero_nombre:         inicial?.tercero_nombre ?? '',
    tercero_vehiculo:       inicial?.tercero_vehiculo ?? '',
    tercero_seguro:         inicial?.tercero_seguro ?? '',
    estado:                 inicial?.estado ?? 'ABIERTO',
    observaciones:          inicial?.observaciones ?? '',
  }));
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof SiniestroVehiculoPayload>(k: K, v: SiniestroVehiculoPayload[K]) => setForm(p => ({ ...p, [k]: v }));

  const vehiculoOptions: ComboboxOption[] = vehiculos.map(v => ({ value: String(v.id), label: [v.patente ?? v.codigo, v.descripcion].filter(Boolean).join(' — ') }));
  const empleadoOptions: ComboboxOption[] = empleados.map(e => ({ value: String(e.id), label: `${e.apellido}, ${e.nombre}` }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.fecha_ocurrencia) { setError('La fecha del siniestro es obligatoria'); return; }
    if (!form.camion_id && !form.patente_texto?.trim()) { setError('Indicá el vehículo (de la flota o patente libre)'); return; }
    const payload: SiniestroVehiculoPayload = {
      ...form,
      patente_texto:          form.camion_id ? null : form.patente_texto,
      empleado_nombre_manual: form.empleado_id ? null : form.empleado_nombre_manual,
      fecha_denuncia:         form.fecha_denuncia || null,
    };
    try {
      if (inicial) await updateMut.mutateAsync(payload);
      else await createMut.mutateAsync(payload);
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  const pending = createMut.isPending || updateMut.isPending;
  const txt = (k: keyof SiniestroVehiculoPayload) => (form[k] as string | null | undefined) ?? '';

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{inicial ? 'Editar siniestro de vehículo' : 'Nuevo siniestro de vehículo'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 mt-1">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Vehículo (flota)</label>
              <Combobox options={vehiculoOptions} value={form.camion_id ? String(form.camion_id) : null}
                onChange={v => set('camion_id', v ? Number(v) : null)} placeholder="Buscar vehículo…" className="w-full" />
            </div>
            <div>
              <label className={labelCls}>…o patente libre (si no está en la flota)</label>
              <input value={txt('patente_texto')} disabled={!!form.camion_id} onChange={e => set('patente_texto', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Conductor (RRHH)</label>
              <Combobox options={empleadoOptions} value={form.empleado_id ? String(form.empleado_id) : null}
                onChange={v => set('empleado_id', v ? Number(v) : null)} placeholder="Buscar empleado…" className="w-full" />
            </div>
            <div>
              <label className={labelCls}>…o nombre libre</label>
              <input value={txt('empleado_nombre_manual')} disabled={!!form.empleado_id} onChange={e => set('empleado_nombre_manual', e.target.value)} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Fecha del siniestro *</label>
              <input type="date" value={txt('fecha_ocurrencia')} onChange={e => set('fecha_ocurrencia', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Aseguradora</label>
              <input value={txt('aseguradora')} onChange={e => set('aseguradora', e.target.value)} className={inputCls} placeholder="Experta, Allianz…" />
            </div>
            <div>
              <label className={labelCls}>N° siniestro</label>
              <input value={txt('numero_siniestro')} onChange={e => set('numero_siniestro', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Fecha de denuncia</label>
              <input type="date" value={txt('fecha_denuncia')} onChange={e => set('fecha_denuncia', e.target.value)} className={inputCls} />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Lugar</label>
              <input value={txt('lugar')} onChange={e => set('lugar', e.target.value)} className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Detalles del siniestro</label>
            <textarea value={txt('descripcion')} onChange={e => set('descripcion', e.target.value)} className={cn(inputCls, 'min-h-14')} />
          </div>
          <div>
            <label className={labelCls}>Daños</label>
            <input value={txt('danios')} onChange={e => set('danios', e.target.value)} className={inputCls} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Tercero — nombre</label>
              <input value={txt('tercero_nombre')} onChange={e => set('tercero_nombre', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Tercero — vehículo/patente</label>
              <input value={txt('tercero_vehiculo')} onChange={e => set('tercero_vehiculo', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Tercero — seguro</label>
              <input value={txt('tercero_seguro')} onChange={e => set('tercero_seguro', e.target.value)} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Estado</label>
              <select value={form.estado} onChange={e => set('estado', e.target.value as EstadoSiniestroVehiculo)} className={inputCls}>
                {ESTADOS_SINIESTRO_VEHICULO.map(e => <option key={e} value={e}>{SINIESTRO_VEHICULO_LABEL[e]}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Observaciones</label>
              <input value={txt('observaciones')} onChange={e => set('observaciones', e.target.value)} className={inputCls} />
            </div>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={pending}>{pending ? 'Guardando…' : 'Guardar'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Drawer de detalle ─────────────────────────────────────────────────────────

function SiniestroVehiculoDrawer({ id, canEdit, onClose }: { id: number; canEdit: boolean; onClose: () => void }) {
  const { data: s } = useSiniestroVehiculo(id);
  const resolverMut = useResolverSiniestroVehiculo();
  const [editando, setEditando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!s) return null;
  if (editando) return <SiniestroVehiculoForm inicial={s} onClose={() => setEditando(false)} />;

  const campo = (label: string, valor: React.ReactNode, full = false) => (
    <p className={cn(full && 'col-span-2')}><span className="text-muted-foreground">{label}:</span> {valor || '—'}</p>
  );

  const resolver = async () => {
    setError(null);
    try { await resolverMut.mutateAsync({ id }); }
    catch (err) { setError(getApiErrorMessage(err)); }
  };

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            🚗 {vehiculoLabel(s)} — {formatDate(s.fecha_ocurrencia)}
            <SiniestroVehiculoEstadoBadge estado={s.estado} />
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Vehículo y conductor</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 bg-muted/20 rounded p-3">
              {campo('Vehículo', s.camion ? [s.camion.patente ?? s.camion.codigo, s.camion.descripcion].filter(Boolean).join(' — ') : `${s.patente_texto ?? '—'} (no está en la flota)`, true)}
              {campo('Conductor', s.empleado ? conductorLabel(s) : (s.empleado_nombre_manual ? `${s.empleado_nombre_manual} (sin match en RRHH)` : null), true)}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Seguro y siniestro</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 bg-muted/20 rounded p-3">
              {campo('Aseguradora', s.aseguradora)}
              {campo('N° siniestro', s.numero_siniestro)}
              {campo('Fecha siniestro', formatDate(s.fecha_ocurrencia))}
              {campo('Fecha denuncia', s.fecha_denuncia ? formatDate(s.fecha_denuncia) : null)}
              {campo('Lugar', s.lugar, true)}
              {campo('Detalles', s.descripcion, true)}
              {campo('Daños', s.danios, true)}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Tercero involucrado</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 bg-muted/20 rounded p-3">
              {!s.tercero_nombre && !s.tercero_vehiculo && !s.tercero_seguro ? <p className="col-span-2 text-muted-foreground">Sin tercero</p> : (
                <>
                  {campo('Nombre', s.tercero_nombre, true)}
                  {campo('Vehículo', s.tercero_vehiculo)}
                  {campo('Seguro', s.tercero_seguro)}
                </>
              )}
            </div>
          </div>
          {campo('Observaciones', s.observaciones, true)}
          {error && <p className="text-xs text-destructive">{error}</p>}
          {canEdit && (
            <div className="flex justify-end gap-2 pt-1">
              <Button size="sm" variant="outline" onClick={() => setEditando(true)}>Editar</Button>
              {s.estado !== 'RESUELTO' && (
                <Button size="sm" onClick={resolver} disabled={resolverMut.isPending}>
                  {resolverMut.isPending ? 'Guardando…' : 'Marcar resuelto'}
                </Button>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Panel (tabla + filtros + acciones) ────────────────────────────────────────

export default function SiniestrosVehiculoPanel({ canEdit }: { canEdit: boolean }) {
  const [estado, setEstado] = useState<EstadoSiniestroVehiculo | 'TODOS'>('TODOS');
  const [camionId, setCamionId] = useState<number | null>(null);
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [nuevoOpen, setNuevoOpen] = useState(false);
  const [importarOpen, setImportarOpen] = useState(false);
  const [viewingId, setViewingId] = useState<number | null>(null);

  const { data: vehiculos = [] } = useVehiculosFlota();
  const { data: siniestros = [], isLoading } = useSiniestrosVehiculo({
    estado:    estado === 'TODOS' ? undefined : estado,
    camion_id: camionId ?? undefined,
    desde:     desde || undefined,
    hasta:     hasta || undefined,
  });

  const filtrados = siniestros;
  const pendientes = siniestros.filter(s => s.estado === 'ABIERTO' || s.estado === 'EN_PROCESO').length;

  const vehiculoOptions: ComboboxOption[] = vehiculos.map(v => ({ value: String(v.id), label: v.patente ?? v.codigo }));
  const th = 'px-2.5 py-2 text-left text-xs font-medium text-muted-foreground whitespace-nowrap';
  const td = 'px-2.5 py-2 text-sm whitespace-nowrap';
  const selCls = 'border border-input rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {siniestros.length} siniestro{siniestros.length !== 1 && 's'} · <span className="text-red-600 font-medium">{pendientes} pendiente{pendientes !== 1 && 's'}</span>
        </p>
        {canEdit && (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setImportarOpen(true)}>
              <Upload size={14} className="mr-1.5" /> Importar desde Excel
            </Button>
            <Button size="sm" onClick={() => setNuevoOpen(true)}>
              <Plus size={14} className="mr-1.5" /> Nuevo siniestro
            </Button>
          </div>
        )}
      </div>

      {/* Grid: el Combobox trae sm:w-64 propio — sin sm:w-full se desborda
          de su celda y se monta sobre el filtro de al lado. */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
        <Combobox options={vehiculoOptions} value={camionId ? String(camionId) : null} onChange={v => setCamionId(v ? Number(v) : null)} placeholder="Todos los vehículos" className="w-full sm:w-full" />
        <select value={estado} onChange={e => setEstado(e.target.value as EstadoSiniestroVehiculo | 'TODOS')} className={cn(selCls, 'w-full')}>
          <option value="TODOS">Todos los estados</option>
          {ESTADOS_SINIESTRO_VEHICULO.map(e => <option key={e} value={e}>{SINIESTRO_VEHICULO_LABEL[e]}</option>)}
        </select>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Desde
          <input type="date" value={desde} onChange={e => setDesde(e.target.value)} className={cn(selCls, 'flex-1')} />
        </label>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Hasta
          <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className={cn(selCls, 'flex-1')} />
        </label>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : (
        <div className="overflow-x-auto">
          <BaseTable className="w-full text-sm min-w-[1200px]">
            <thead className="border-b bg-muted/30">
              <tr>
                <th className={th}>Fecha</th>
                <th className={th}>Vehículo</th>
                <th className={th}>Conductor</th>
                <th className={th}>Aseguradora</th>
                <th className={th}>N° Siniestro</th>
                <th className={th}>Lugar</th>
                <th className={th}>Daños</th>
                <th className={th}>Tercero</th>
                <th className={th}>Estado</th>
                <th className={th}>Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtrados.length === 0 ? (
                <tr><td colSpan={10} className="px-3 py-6 text-center text-sm text-muted-foreground">Sin siniestros de vehículos para este filtro.</td></tr>
              ) : filtrados.map(s => (
                <tr key={s.id} className="cursor-pointer hover:bg-muted/10" onClick={() => setViewingId(s.id)}>
                  <td className={td}>{formatDate(s.fecha_ocurrencia)}</td>
                  <td className={cn(td, 'font-medium')}>{vehiculoLabel(s)}</td>
                  <td className={td}>{conductorLabel(s)}</td>
                  <td className={td}>{s.aseguradora ?? '—'}</td>
                  <td className={td}>{s.numero_siniestro ?? '—'}</td>
                  <td className={cn(td, 'max-w-[180px] truncate')} title={s.lugar ?? undefined}>{s.lugar ?? '—'}</td>
                  <td className={cn(td, 'max-w-[180px] truncate')} title={s.danios ?? undefined}>{s.danios ?? '—'}</td>
                  <td className={cn(td, 'max-w-[220px] truncate')} title={terceroLabel(s)}>{terceroLabel(s)}</td>
                  <td className={td}><SiniestroVehiculoEstadoBadge estado={s.estado} /></td>
                  <td className={td}>
                    <button className="text-xs text-primary hover:underline" onClick={e => { e.stopPropagation(); setViewingId(s.id); }}>Ver detalle</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </BaseTable>
        </div>
      )}

      {nuevoOpen && <SiniestroVehiculoForm onClose={() => setNuevoOpen(false)} />}
      {importarOpen && <ImportarDialog onClose={() => setImportarOpen(false)} />}
      {viewingId !== null && <SiniestroVehiculoDrawer id={viewingId} canEdit={canEdit} onClose={() => setViewingId(null)} />}
    </div>
  );
}
