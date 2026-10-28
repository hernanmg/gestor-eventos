import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Upload, AlertTriangle } from 'lucide-react';
import {
  useProduccion, useProduccionMutations, useImportarProduccion,
  type TipoProduccion, type ProduccionImportResultado, type Espacio,
} from '@/hooks/useProduccion';
import TabStrip, { TabCount } from '@/components/ui/TabStrip';
import BaseTable from '@/components/ui/BaseTable';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn, getApiErrorMessage } from '@/lib/utils';
import { fmtMoney } from '@/lib/formatters';
import { fmtFechaCorta } from '@/lib/turnos';

// Producción del evento: las hojas de la planilla de producción de Dani que no
// son pedidos a proveedores. Cada lista se edita en el lugar (se guarda al salir
// del campo) y se puede importar la planilla entera.

type Sub = 'cronograma' | 'espacios' | 'internet' | 'branding' | 'compras';

const inputCls = 'w-full text-xs border border-transparent rounded px-1 py-0.5 focus:border-ring/50 focus:outline-none bg-transparent hover:bg-accent/30 focus:bg-white transition';

type TipoCampo = 'text' | 'date' | 'number' | 'bool';
interface Columna { key: string; label: string; tipo?: TipoCampo; className?: string; placeholder?: string; requerido?: boolean }

const COLUMNAS: Record<Exclude<Sub, 'espacios'> | 'espacio-items', Columna[]> = {
  cronograma: [
    { key: 'fecha', label: 'Fecha', tipo: 'date', className: 'w-32', requerido: true },
    { key: 'hora', label: 'Hora', className: 'w-20', placeholder: '08:00' },
    { key: 'actividad', label: 'Actividad', requerido: true },
    { key: 'proveedor', label: 'Proveedor', className: 'w-36' },
    { key: 'responsable', label: 'Responsable', className: 'w-32' },
    { key: 'observaciones', label: 'Observaciones' },
  ],
  'espacio-items': [
    { key: 'elemento', label: 'Lleva', requerido: true },
    { key: 'estado', label: 'Estado', className: 'w-28' },
    { key: 'responsable', label: 'Responsable', className: 'w-32' },
    { key: 'observaciones', label: 'Observaciones' },
  ],
  internet: [
    { key: 'numero', label: 'N°', tipo: 'number', className: 'w-14' },
    { key: 'zona', label: 'Zona', requerido: true },
    { key: 'uso', label: 'Uso' },
    { key: 'tipo_conexion', label: 'Tipo de conexión', className: 'w-44' },
    { key: 'observaciones', label: 'Observaciones' },
  ],
  branding: [
    { key: 'tipo', label: 'Tipo', requerido: true },
    { key: 'marca', label: 'Marca', className: 'w-32' },
    { key: 'cantidad', label: 'Cant.', tipo: 'number', className: 'w-16' },
    { key: 'ubicacion', label: 'Ubicación' },
    { key: 'estado', label: 'Estado', className: 'w-28' },
    { key: 'observaciones', label: 'Observaciones' },
  ],
  compras: [
    { key: 'fecha', label: 'Fecha', tipo: 'date', className: 'w-32' },
    { key: 'pedido', label: 'Pedido', requerido: true, className: 'min-w-[14rem]' },
    { key: 'cantidad', label: 'Cant.', tipo: 'number', className: 'w-16' },
    { key: 'valor', label: 'Valor', tipo: 'number', className: 'w-28' },
    { key: 'proveedor', label: 'Proveedor', className: 'w-32' },
    { key: 'forma_pago', label: 'Forma de pago', className: 'w-36' },
    { key: 'solicita', label: 'Solicita', className: 'w-28' },
    { key: 'autoriza', label: 'Autoriza', className: 'w-28' },
    { key: 'observaciones', label: 'Observaciones', className: 'min-w-[10rem]' },
    { key: 'cancelada', label: 'Cancelada', tipo: 'bool', className: 'w-20' },
  ],
};

const aLocal = (v: unknown): string => (v === null || v === undefined ? '' : String(v));

function valorPayload(col: Columna, v: string): unknown {
  if (col.tipo === 'number') return v.trim() === '' ? null : Number(v.replace(',', '.'));
  return v.trim() === '' ? null : v.trim();
}

// ── Fila editable ─────────────────────────────────────────────────────────────

function FilaEditable({ row, columnas, onSave, onDelete, canEdit }: {
  row: Record<string, any>; columnas: Columna[]; canEdit: boolean;
  onSave: (data: Record<string, unknown>) => void; onDelete: () => void;
}) {
  const inicial = () => Object.fromEntries(columnas.map(c => [c.key, aLocal(row[c.key])]));
  const [local, setLocal] = useState<Record<string, string>>(inicial);
  useEffect(() => { setLocal(inicial()); }, [row]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <tr className={cn('group border-b border-border/60', row.cancelada && 'opacity-60 line-through decoration-muted-foreground/40')}>
      {columnas.map(col => (
        <td key={col.key} className={cn('px-1.5 py-1', col.className)} data-label={col.label}>
          {col.tipo === 'bool' ? (
            <input
              type="checkbox" checked={!!row[col.key]} disabled={!canEdit}
              onChange={e => onSave({ [col.key]: e.target.checked })}
            />
          ) : (
            <input
              type={col.tipo === 'date' ? 'date' : 'text'}
              inputMode={col.tipo === 'number' ? 'decimal' : undefined}
              value={local[col.key]} placeholder={col.placeholder} disabled={!canEdit}
              onChange={e => setLocal(p => ({ ...p, [col.key]: e.target.value }))}
              onBlur={() => {
                if (local[col.key] === aLocal(row[col.key])) return;
                if (col.requerido && !local[col.key].trim()) { setLocal(inicial()); return; }
                onSave({ [col.key]: valorPayload(col, local[col.key]) });
              }}
              className={cn(inputCls, col.tipo === 'number' && 'text-right')}
            />
          )}
        </td>
      ))}
      <td className="w-8 px-1">
        {canEdit && (
          <button tabIndex={-1} onClick={onDelete} title="Eliminar"
            className="p-1 rounded text-destructive opacity-0 group-hover:opacity-100 hover:bg-destructive/10 transition">
            <Trash2 size={13} />
          </button>
        )}
      </td>
    </tr>
  );
}

function FilaNueva({ columnas, onCrear, defaults }: {
  columnas: Columna[]; onCrear: (data: Record<string, unknown>) => Promise<unknown>; defaults?: Record<string, string>;
}) {
  const vacio = () => Object.fromEntries(columnas.map(c => [c.key, defaults?.[c.key] ?? '']));
  const [local, setLocal] = useState<Record<string, string>>(vacio);
  const [error, setError] = useState<string | null>(null);
  const faltan = columnas.filter(c => c.requerido && !local[c.key].trim());

  const guardar = async () => {
    if (faltan.length) { setError(`Completá ${faltan.map(c => c.label.toLowerCase()).join(' y ')}`); return; }
    const data: Record<string, unknown> = {};
    for (const c of columnas) {
      if (c.tipo === 'bool') continue;
      const v = valorPayload(c, local[c.key]);
      if (v !== null) data[c.key] = v;
    }
    try {
      await onCrear(data);
      setLocal(p => ({ ...vacio(), ...(columnas.some(c => c.key === 'fecha') ? { fecha: p.fecha } : {}) }));
      setError(null);
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  return (
    <>
      <tr className="bg-accent/20">
        {columnas.map(col => (
          <td key={col.key} className={cn('px-1.5 py-1', col.className)} data-label={col.label}>
            {col.tipo === 'bool' ? null : (
              <input
                type={col.tipo === 'date' ? 'date' : 'text'} value={local[col.key]}
                placeholder={col.placeholder ?? (col.requerido ? col.label : '')}
                onChange={e => setLocal(p => ({ ...p, [col.key]: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') guardar(); }}
                className={cn(inputCls, 'border-border/60 bg-background', col.tipo === 'number' && 'text-right')}
              />
            )}
          </td>
        ))}
        <td className="w-8 px-1">
          <button onClick={guardar} title="Agregar" className="p-1 rounded hover:bg-accent text-foreground"><Plus size={14} /></button>
        </td>
      </tr>
      {error && <tr><td colSpan={columnas.length + 1} className="px-2 py-1 text-xs text-destructive">{error}</td></tr>}
    </>
  );
}

function TablaLista({ tipo, filas, canEdit, eventoId, extraCrear, pie, agrupar }: {
  tipo: TipoProduccion; filas: Record<string, any>[]; canEdit: boolean; eventoId: number;
  extraCrear?: Record<string, unknown>; pie?: React.ReactNode; agrupar?: (r: Record<string, any>) => string;
}) {
  const columnas = COLUMNAS[tipo as keyof typeof COLUMNAS];
  const { crear, actualizar, eliminar } = useProduccionMutations(eventoId);
  const [error, setError] = useState<string | null>(null);
  const onError = (err: unknown) => setError(getApiErrorMessage(err));

  let grupoPrevio: string | null = null;
  return (
    <div className="space-y-1">
      <div className="overflow-x-auto">
        <BaseTable className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-border text-muted-foreground font-medium">
              {columnas.map(c => <th key={c.key} className={cn('px-1.5 py-1.5 text-left', c.className)}>{c.label}</th>)}
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {filas.map(r => {
              const grupo = agrupar?.(r) ?? null;
              const cabecera = grupo !== null && grupo !== grupoPrevio;
              grupoPrevio = grupo;
              return [
                cabecera && (
                  <tr key={`g-${grupo}`} className="bg-muted/40">
                    <td colSpan={columnas.length + 1} className="px-2 py-1 text-xs font-semibold">{grupo}</td>
                  </tr>
                ),
                <FilaEditable
                  key={r.id} row={r} columnas={columnas} canEdit={canEdit}
                  onSave={data => actualizar.mutate({ tipo, id: r.id, data }, { onError })}
                  onDelete={() => eliminar.mutate({ tipo, id: r.id }, { onError })}
                />,
              ];
            })}
            {canEdit && (
              <FilaNueva
                columnas={columnas}
                defaults={tipo === 'cronograma' && filas.length ? { fecha: filas[filas.length - 1].fecha } : undefined}
                onCrear={data => crear.mutateAsync({ tipo, data: { ...data, ...extraCrear } })}
              />
            )}
          </tbody>
          {pie}
        </BaseTable>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

// ── Espacios ──────────────────────────────────────────────────────────────────

function EspacioCard({ espacio, eventoId, canEdit }: { espacio: Espacio; eventoId: number; canEdit: boolean }) {
  const { actualizar, eliminar } = useProduccionMutations(eventoId);
  const [nombre, setNombre] = useState(espacio.nombre);
  const [actividad, setActividad] = useState(espacio.actividad ?? '');
  const [observaciones, setObservaciones] = useState(espacio.observaciones ?? '');
  useEffect(() => { setNombre(espacio.nombre); setActividad(espacio.actividad ?? ''); setObservaciones(espacio.observaciones ?? ''); }, [espacio]);
  const guardar = (data: Record<string, unknown>) => actualizar.mutate({ tipo: 'espacios', id: espacio.id, data });

  return (
    <div className="rounded-lg border border-border p-3 space-y-2">
      <div className="flex items-start gap-2">
        <span className="text-xs text-muted-foreground pt-1 w-6 shrink-0">{espacio.numero ?? ''}</span>
        <div className="flex-1 grid gap-1 sm:grid-cols-[1fr_1.4fr]">
          <input value={nombre} disabled={!canEdit} onChange={e => setNombre(e.target.value)}
            onBlur={() => { if (nombre.trim() && nombre !== espacio.nombre) guardar({ nombre }); else setNombre(espacio.nombre); }}
            className={cn(inputCls, 'text-sm font-semibold')} />
          <input value={actividad} disabled={!canEdit} placeholder="Actividad / función" onChange={e => setActividad(e.target.value)}
            onBlur={() => { if (actividad !== (espacio.actividad ?? '')) guardar({ actividad: actividad || null }); }}
            className={cn(inputCls, 'text-sm')} />
          <input value={observaciones} disabled={!canEdit} placeholder="Observaciones del espacio" onChange={e => setObservaciones(e.target.value)}
            onBlur={() => { if (observaciones !== (espacio.observaciones ?? '')) guardar({ observaciones: observaciones || null }); }}
            className={cn(inputCls, 'sm:col-span-2 text-muted-foreground')} />
        </div>
        {canEdit && (
          <button
            onClick={() => { if (confirm(`¿Eliminar el espacio "${espacio.nombre}" y todo lo que lleva?`)) eliminar.mutate({ tipo: 'espacios', id: espacio.id }); }}
            title="Eliminar espacio" className="p-1 rounded text-destructive hover:bg-destructive/10"><Trash2 size={13} /></button>
        )}
      </div>
      <TablaLista tipo="espacio-items" filas={espacio.items} canEdit={canEdit} eventoId={eventoId} extraCrear={{ espacio_id: espacio.id }} />
    </div>
  );
}

function NuevoEspacio({ eventoId, siguiente }: { eventoId: number; siguiente: number }) {
  const { crear } = useProduccionMutations(eventoId);
  const [nombre, setNombre] = useState('');
  const [actividad, setActividad] = useState('');
  const agregar = async () => {
    if (!nombre.trim()) return;
    await crear.mutateAsync({ tipo: 'espacios', data: { nombre: nombre.trim(), actividad: actividad.trim() || null, numero: siguiente } });
    setNombre(''); setActividad('');
  };
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-border p-3">
      <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nuevo espacio (ej. PLAYÓN 1)"
        onKeyDown={e => { if (e.key === 'Enter') agregar(); }} className="flex-1 min-w-40 border rounded px-2 py-1 text-sm bg-background" />
      <input value={actividad} onChange={e => setActividad(e.target.value)} placeholder="Actividad / función"
        onKeyDown={e => { if (e.key === 'Enter') agregar(); }} className="flex-1 min-w-40 border rounded px-2 py-1 text-sm bg-background" />
      <Button size="sm" variant="outline" onClick={agregar} disabled={!nombre.trim() || crear.isPending}><Plus size={13} className="mr-1" /> Agregar espacio</Button>
    </div>
  );
}

// ── Importar ──────────────────────────────────────────────────────────────────

function ImportarProduccionDialog({ eventoId, onClose }: { eventoId: number; onClose: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ProduccionImportResultado | null>(null);
  const [final, setFinal] = useState<ProduccionImportResultado | null>(null);
  const [error, setError] = useState<string | null>(null);
  const importar = useImportarProduccion(eventoId);

  const elegir = async (f: File) => {
    setFile(f); setPreview(null); setError(null);
    try { setPreview(await importar.mutateAsync({ file: f, preview: true })); } catch (err) { setError(getApiErrorMessage(err)); }
  };
  const confirmar = async () => {
    if (!file) return;
    setError(null);
    try { setFinal(await importar.mutateAsync({ file, preview: false })); } catch (err) { setError(getApiErrorMessage(err)); }
  };

  const r = final ?? preview;
  const linea = (label: string, c: { hoja: string; total: number; nuevos: number; actualizados: number } | null) => c && (
    <li key={label}>
      <span className="font-medium">{label}</span> <span className="text-muted-foreground">(hoja "{c.hoja}")</span>: {c.total}
      {' '}— {c.nuevos} nuevos, {c.actualizados} ya estaban
    </li>
  );

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>Importar planilla de producción</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {!final && (
            <>
              <p className="text-sm text-muted-foreground">
                Se leen las hojas de cronograma de montaje, espacios (operativo), puntos de internet, branding y compras. Cada
                una se reconoce por sus columnas, no por el nombre de la hoja.
              </p>
              <label className="flex items-center gap-3 border-2 border-dashed border-border rounded-lg px-4 py-4 cursor-pointer hover:bg-accent/30 transition">
                <Upload size={18} className="text-muted-foreground shrink-0" />
                <span className="text-sm text-muted-foreground truncate">
                  {importar.isPending && !preview ? 'Leyendo archivo…' : file ? file.name : 'Hacé clic para elegir el archivo .xlsx'}
                </span>
                <input type="file" accept=".xlsx" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) elegir(f); e.target.value = ''; }} />
              </label>
            </>
          )}
          {r && (
            <div className="text-sm space-y-2">
              {final && <p className="font-medium text-green-700">Importación completa.</p>}
              <ul className="space-y-1 list-disc pl-5">
                {linea('Cronograma', r.cronograma)}
                {linea('Espacios', r.espacios)}
                {r.espacios && <li className="list-none -ml-5 pl-5 text-muted-foreground">Lo que lleva cada espacio: {r.espacios.items.total} — {r.espacios.items.nuevos} nuevos</li>}
                {linea('Puntos de internet', r.internet)}
                {linea('Branding', r.branding)}
                {linea('Compras', r.compras)}
              </ul>
              {r.compras && (
                <p className={cn('text-xs rounded px-3 py-2', r.compras.total_planilla !== null && Math.abs(r.compras.total_planilla - r.compras.total_importado) > 0.01 ? 'bg-yellow-50 text-yellow-800' : 'bg-muted/50')}>
                  Compras: {fmtMoney(r.compras.total_importado)}
                  {r.compras.total_planilla !== null && <> (la planilla suma {fmtMoney(r.compras.total_planilla)})</>}
                  {' '}· sin las canceladas {fmtMoney(r.compras.total_sin_canceladas)}
                  {r.compras.pendientes_de_valor > 0 && <> · {r.compras.pendientes_de_valor} sin valor todavía</>}
                </p>
              )}
              {r.hojas_omitidas.length > 0 && (
                <p className="text-xs text-muted-foreground flex items-start gap-1">
                  <AlertTriangle size={11} className="mt-0.5 shrink-0" />
                  Hojas que no son de producción: {r.hojas_omitidas.join(', ')}. Los pedidos a proveedores se importan desde la Ficha.
                </p>
              )}
            </div>
          )}
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            {final ? <Button size="sm" onClick={onClose}>Cerrar</Button> : (
              <>
                <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
                <Button size="sm" onClick={confirmar} disabled={!preview || importar.isPending}>
                  {importar.isPending && preview ? 'Importando…' : 'Confirmar importación'}
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Página ────────────────────────────────────────────────────────────────────

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const diaSemana = (ymd: string) => DIAS[new Date(`${ymd}T00:00:00Z`).getUTCDay()];

export default function ProduccionEventoPage({ eventoId, canEdit }: { eventoId: number; canEdit: boolean }) {
  const { data, isLoading } = useProduccion(eventoId);
  const [sub, setSub] = useState<Sub>('cronograma');
  const [importarOpen, setImportarOpen] = useState(false);

  const totalCompras = useMemo(() => (data?.compras ?? []).filter(c => !c.cancelada).reduce((a, c) => a + (c.valor ?? 0), 0), [data]);

  if (isLoading || !data) return <p className="p-4 text-sm text-muted-foreground">Cargando...</p>;

  const items = [
    { key: 'cronograma' as Sub, label: 'Cronograma', badge: <TabCount count={data.cronograma.length} tone="neutral" /> },
    { key: 'espacios' as Sub, label: 'Espacios', badge: <TabCount count={data.espacios.length} tone="neutral" /> },
    { key: 'internet' as Sub, label: 'Internet', badge: <TabCount count={data.internet.length} tone="neutral" /> },
    { key: 'branding' as Sub, label: 'Branding', badge: <TabCount count={data.branding.length} tone="neutral" /> },
    { key: 'compras' as Sub, label: 'Compras', badge: <TabCount count={data.compras.length} tone="neutral" /> },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-lg font-semibold">Producción</h2>
        {canEdit && (
          <Button variant="outline" size="sm" onClick={() => setImportarOpen(true)}>
            <Upload size={13} className="mr-1.5" /> Importar planilla de producción
          </Button>
        )}
      </div>
      {importarOpen && <ImportarProduccionDialog eventoId={eventoId} onClose={() => setImportarOpen(false)} />}

      <TabStrip<Sub> items={items} value={sub} onChange={setSub} variant="pill" />

      {sub === 'cronograma' && (
        <TablaLista tipo="cronograma" filas={data.cronograma} canEdit={canEdit} eventoId={eventoId}
          agrupar={r => `${diaSemana(r.fecha)} ${fmtFechaCorta(r.fecha)}`} />
      )}

      {sub === 'espacios' && (
        <div className="space-y-3">
          {data.espacios.length === 0 && <p className="text-sm text-muted-foreground">Todavía no hay espacios. Agregá uno o importá la planilla.</p>}
          {data.espacios.map(e => <EspacioCard key={e.id} espacio={e} eventoId={eventoId} canEdit={canEdit} />)}
          {canEdit && <NuevoEspacio eventoId={eventoId} siguiente={(data.espacios.at(-1)?.numero ?? data.espacios.length) + 1} />}
        </div>
      )}

      {sub === 'internet' && <TablaLista tipo="internet" filas={data.internet} canEdit={canEdit} eventoId={eventoId} />}
      {sub === 'branding' && <TablaLista tipo="branding" filas={data.branding} canEdit={canEdit} eventoId={eventoId} />}

      {sub === 'compras' && (
        <TablaLista tipo="compras" filas={data.compras} canEdit={canEdit} eventoId={eventoId}
          pie={(
            <tfoot>
              <tr className="border-t border-border font-semibold">
                <td colSpan={3} className="px-2 py-1.5 text-right">Total (sin canceladas)</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{fmtMoney(totalCompras)}</td>
                <td colSpan={7} />
              </tr>
            </tfoot>
          )} />
      )}
    </div>
  );
}
