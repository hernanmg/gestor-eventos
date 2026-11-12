import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Circle, Clock, Download, ListChecks, Loader2, Package, Pencil, Plus, Settings2, Trash2, Truck, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import BaseTable from '@/components/ui/BaseTable';
import {
  useCargarTareasTipo, useDeleteTarea, useExportarCuadrilla, useOperacion, useUpdateTarea,
} from '@/hooks/useOperacion';
import { formatDate } from '@/lib/formatters';
import { cn, getApiErrorMessage } from '@/lib/utils';
import type { EstadoTarea, Operacion, RubroOperacion, TareaEvento } from '@/types';
import TareaDialog from './TareaDialog';
import PlantillaTareasDialog from './PlantillaTareasDialog';
import { ESTADO_TAREA, FASE_CORTA, SIGUIENTE_ESTADO } from './constantes';

// Pestaña "Operación" (DOS57, modalidad OPERATIVA): el evento armado desde los
// rubros elegidos. Por rubro: el material (stock propio y proveedor, de la
// Ficha) y sus tareas por fase. Abajo, la cuadrilla del evento por fase (sale
// del Parte diario y de las jornadas) y el material que salió en los remitos.

const ESTADO_ICONO: Record<EstadoTarea, typeof Circle> = { PENDIENTE: Circle, EN_CURSO: Clock, HECHA: CheckCircle2 };
const ESTADO_COLOR: Record<EstadoTarea, string> = { PENDIENTE: 'text-gray-400', EN_CURSO: 'text-amber-600', HECHA: 'text-green-600' };
const ESTADO_RUBRO: Record<string, string> = {
  PENDIENTE: 'bg-gray-100 text-gray-700', COTIZANDO: 'bg-yellow-100 text-yellow-800', CONFIRMADO: 'bg-green-100 text-green-800',
};
const fechaCorta = (s: string | null) => (s ? formatDate(s).slice(0, 5) : '');

interface Props {
  eventoId: number;
  canEdit:  boolean;
  onIrA:    (tab: 'FICHA' | 'LOGISTICA') => void;
}

export default function OperacionTab({ eventoId, canEdit, onIrA }: Props) {
  const { data, isLoading } = useOperacion(eventoId);
  const [tareaDialog, setTareaDialog] = useState<{ tarea?: TareaEvento; rubroId?: number | null } | null>(null);
  const [plantillaRubro, setPlantillaRubro] = useState<number | null>(null);

  if (isLoading || !data) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Cargando operación…</p>;
  }

  const { evento, fases } = data;
  const faltanFechas = !evento.fecha_inicio;
  const sinMontaje = !faltanFechas && evento.dias_montaje === 0 && evento.dias_desmontaje === 0;

  return (
    <div className="space-y-5">
      {/* Fases */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        {fases.map(f => (
          <div key={f.fase} className="rounded-lg border border-border bg-white px-3 py-2 min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{f.label}</p>
            <p className="truncate text-sm font-medium">
              {f.desde && f.hasta ? `${fechaCorta(f.desde)} al ${fechaCorta(f.hasta)}`
                : f.hasta ? `Hasta el ${fechaCorta(f.hasta)}`
                : f.desde ? `Desde el ${fechaCorta(f.desde)}` : '—'}
            </p>
            {f.dias !== null && <p className="text-[11px] text-muted-foreground">{f.dias} día{f.dias === 1 ? '' : 's'}</p>}
          </div>
        ))}
      </div>
      {(faltanFechas || sinMontaje) && (
        <p className="flex items-start gap-1.5 rounded bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          {faltanFechas
            ? 'El evento no tiene fecha de inicio: cargala en Editar evento para ubicar las tareas y la cuadrilla en cada fase.'
            : 'El evento no tiene días de montaje ni de desmontaje: todo lo anterior y posterior al evento cuenta como viaje. Cargalos en Editar evento.'}
        </p>
      )}

      {/* Rubros */}
      <section className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="flex items-center gap-1.5 text-base font-semibold"><ListChecks size={18} /> Rubros: material y tareas</h3>
          {canEdit && (
            <Button size="sm" variant="outline" className="ml-auto" onClick={() => setTareaDialog({ rubroId: null })}>
              <Plus size={14} className="mr-1" /> Tarea general
            </Button>
          )}
        </div>
        {data.rubros.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            El evento no tiene rubros elegidos. Se eligen en la Pre-Macro o en la <button className="underline" onClick={() => onIrA('FICHA')}>Ficha</button>.
          </p>
        ) : (
          <div className="grid gap-3 xl:grid-cols-2">
            {data.rubros.map(r => (
              <RubroCard
                key={r.id} eventoId={eventoId} rubro={r} canEdit={canEdit}
                onIrFicha={() => onIrA('FICHA')}
                onNueva={() => setTareaDialog({ rubroId: r.id })}
                onEditar={t => setTareaDialog({ tarea: t })}
                onPlantilla={() => setPlantillaRubro(r.rubro.id)}
              />
            ))}
          </div>
        )}
        {data.generales.length > 0 && (
          <div className="rounded-lg border border-border bg-white p-3">
            <p className="mb-1 text-sm font-medium">Generales del evento</p>
            <ListaTareas eventoId={eventoId} tareas={data.generales} canEdit={canEdit} onEditar={t => setTareaDialog({ tarea: t })} />
          </div>
        )}
      </section>

      <Cuadrilla eventoId={eventoId} data={data} />

      <Remitos data={data} onIrLogistica={() => onIrA('LOGISTICA')} />

      {tareaDialog && (
        <TareaDialog
          eventoId={eventoId} fases={fases} rubros={data.rubros}
          tarea={tareaDialog.tarea} rubroId={tareaDialog.rubroId}
          open onClose={() => setTareaDialog(null)}
        />
      )}
      <PlantillaTareasDialog rubroId={plantillaRubro} fases={fases} canEdit={canEdit} onClose={() => setPlantillaRubro(null)} />
    </div>
  );
}

function RubroCard({ eventoId, rubro, canEdit, onIrFicha, onNueva, onEditar, onPlantilla }: {
  eventoId: number; rubro: RubroOperacion; canEdit: boolean;
  onIrFicha: () => void; onNueva: () => void; onEditar: (t: TareaEvento) => void; onPlantilla: () => void;
}) {
  const cargar = useCargarTareasTipo(eventoId);
  const total = rubro.tareas.length;
  const unidadesStock = rubro.material.reduce((a, m) => a + m.cantidad, 0);

  return (
    <div className="rounded-lg border border-border bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <span className="font-semibold">{rubro.rubro.nombre}</span>
        <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', ESTADO_RUBRO[rubro.estado] ?? 'bg-gray-100')}>
          {rubro.estado.charAt(0) + rubro.estado.slice(1).toLowerCase()}
        </span>
        {rubro.coordina_nombre && <span className="text-xs text-muted-foreground">Coordina {rubro.coordina_nombre}</span>}
        {total > 0 && (
          <span className={cn('ml-auto text-xs font-medium', rubro.hechas === total ? 'text-green-700' : 'text-muted-foreground')}>
            {rubro.hechas}/{total} hechas
          </span>
        )}
      </div>

      {/* Material */}
      <div className="border-b border-border px-3 py-2 text-sm">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground"><Package size={13} /> Material</span>
          {unidadesStock > 0 && <span>Stock propio: <b className="tabular-nums">{unidadesStock}</b> u.</span>}
          {rubro.proveedor && <span>Proveedor: <b>{rubro.proveedor.nombre}</b>{rubro.cantidad_proveedor ? ` (${rubro.cantidad_proveedor} u.)` : ''}</span>}
          {!unidadesStock && !rubro.proveedor && <span className="text-muted-foreground">Sin asignar</span>}
          <button className="ml-auto text-xs text-blue-700 hover:underline" onClick={onIrFicha}>
            {canEdit ? 'Asignar en la Ficha' : 'Ver en la Ficha'}
          </button>
        </div>
        {rubro.material.length > 0 && (
          <p className="mt-1 text-xs text-muted-foreground">
            {rubro.material.slice(0, 5).map(m => `${m.producto} × ${m.cantidad}`).join(' · ')}
            {rubro.material.length > 5 && ` · y ${rubro.material.length - 5} más`}
          </p>
        )}
      </div>

      {/* Tareas */}
      <div className="px-3 py-2">
        {total === 0 ? (
          <p className="py-1 text-sm text-muted-foreground">Sin tareas todavía.</p>
        ) : (
          <ListaTareas eventoId={eventoId} tareas={rubro.tareas} canEdit={canEdit} onEditar={onEditar} />
        )}
        <div className="mt-2 flex flex-wrap gap-2">
          {canEdit && (
            <Button size="sm" variant="outline" onClick={onNueva}><Plus size={14} className="mr-1" /> Tarea</Button>
          )}
          {canEdit && (
            <Button
              size="sm" variant="outline" disabled={cargar.isPending}
              onClick={() => cargar.mutate(rubro.id, {
                onSuccess: r => { if (!r.creadas) alert('Las tareas tipo ya estaban cargadas.'); },
                onError:   e => alert(getApiErrorMessage(e)),
              })}
            >
              {cargar.isPending ? <Loader2 size={14} className="mr-1 animate-spin" /> : <ListChecks size={14} className="mr-1" />}
              Cargar tareas tipo
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onPlantilla} title="Las tareas que se cargan para este rubro en cada evento">
            <Settings2 size={14} className="mr-1" /> Tareas tipo
          </Button>
        </div>
      </div>
    </div>
  );
}

function ListaTareas({ eventoId, tareas, canEdit, onEditar }: {
  eventoId: number; tareas: TareaEvento[]; canEdit: boolean; onEditar: (t: TareaEvento) => void;
}) {
  const update = useUpdateTarea(eventoId);
  const remove = useDeleteTarea(eventoId);
  const onError = (e: unknown) => alert(getApiErrorMessage(e));

  return (
    <ul className="divide-y divide-border">
      {tareas.map(t => {
        const Icono = ESTADO_ICONO[t.estado];
        return (
          <li key={t.id} className="flex items-start gap-2 py-1.5">
            <button
              disabled={!canEdit || update.isPending}
              onClick={() => update.mutate({ id: t.id, data: { estado: SIGUIENTE_ESTADO[t.estado] } }, { onError })}
              title={`${ESTADO_TAREA[t.estado].label}${canEdit ? ` — clic para pasar a ${ESTADO_TAREA[SIGUIENTE_ESTADO[t.estado]].label.toLowerCase()}` : ''}`}
              className={cn('mt-0.5 shrink-0', ESTADO_COLOR[t.estado])}
            >
              <Icono size={18} />
            </button>
            <div className="min-w-0 flex-1">
              <p className={cn('text-sm', t.estado === 'HECHA' && 'text-muted-foreground line-through')}>{t.actividad}</p>
              <p className="text-[11px] text-muted-foreground">
                {fechaCorta(t.fecha)}{t.hora ? ` ${t.hora}` : ''}
                {t.fase && ` · ${FASE_CORTA[t.fase]}`}
                {t.responsable && ` · ${t.responsable}`}
                {t.estado === 'EN_CURSO' && <span className="ml-1 font-medium text-amber-700">· En curso</span>}
              </p>
            </div>
            {canEdit && (
              <span className="flex shrink-0">
                <button className="p-1 text-muted-foreground hover:text-foreground" title="Editar" onClick={() => onEditar(t)}><Pencil size={13} /></button>
                <button
                  className="p-1 text-muted-foreground hover:text-destructive" title="Eliminar"
                  onClick={() => confirm(`¿Eliminar "${t.actividad}"?`) && remove.mutate(t.id, { onError })}
                >
                  <Trash2 size={13} />
                </button>
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Cuadrilla({ eventoId, data }: { eventoId: number; data: Operacion }) {
  const { exportar, exportando } = useExportarCuadrilla();
  const { personas, por_categoria } = data.cuadrilla;
  const cell = 'px-2 py-1.5';
  const totalFase = (f: string) => por_categoria.reduce((a, c) => a + c.dias[f as keyof typeof c.dias], 0);
  const planificados = personas.some(p => p.planificados > 0);

  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="flex items-center gap-1.5 text-base font-semibold"><Users size={18} /> Cuadrilla ({personas.length})</h3>
        <span className="text-xs text-muted-foreground">
          Sale del <Link to="/parte-diario" className="text-blue-700 hover:underline">Parte diario</Link>: días por fase de cada persona asignada al evento.
        </span>
        <Button size="sm" variant="outline" className="ml-auto" disabled={exportando || !personas.length}
          onClick={() => exportar(eventoId).catch(e => alert(getApiErrorMessage(e)))}>
          {exportando ? <Loader2 size={14} className="mr-1 animate-spin" /> : <Download size={14} className="mr-1" />}
          Exportar cuadrilla
        </Button>
      </div>
      {personas.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          Nadie asignado todavía. Asigná la cuadrilla a este evento en el Parte diario.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <BaseTable className="min-w-[760px] text-sm">
            <thead>
              <tr>
                <th className="px-2 py-2 text-left">Persona</th>
                {data.fases.map(f => <th key={f.fase} className="px-2 py-2 text-right w-24">{FASE_CORTA[f.fase]}</th>)}
                <th className="px-2 py-2 text-right w-20">Total</th>
              </tr>
            </thead>
            <tbody>
              {por_categoria.map(c => (
                <CategoriaFilas key={c.categoria} cat={c} personas={personas.filter(p => p.categoria === c.categoria)} fases={data.fases.map(f => f.fase)} />
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold">
                <td className={cell}>Total turnos</td>
                {data.fases.map(f => <td key={f.fase} className={cn(cell, 'text-right tabular-nums')}>{totalFase(f.fase) || '—'}</td>)}
                <td className={cn(cell, 'text-right tabular-nums')}>{por_categoria.reduce((a, c) => a + c.total, 0)}</td>
              </tr>
            </tfoot>
          </BaseTable>
        </div>
      )}
      {planificados && (
        <p className="text-xs text-muted-foreground">
          <span className="rounded bg-blue-50 px-1 text-blue-700">plan.</span> = días asignados en un Parte diario que todavía no se cerró (sin jornada).
        </p>
      )}
    </section>
  );
}

function CategoriaFilas({ cat, personas, fases }: {
  cat: Operacion['cuadrilla']['por_categoria'][number]; personas: Operacion['cuadrilla']['personas']; fases: string[];
}) {
  const cell = 'px-2 py-1.5';
  return (
    <>
      <tr className="bg-muted/40">
        <td className={cn(cell, 'text-xs font-semibold uppercase tracking-wide text-muted-foreground')}>{cat.label} ({cat.personas})</td>
        {fases.map(f => <td key={f} className={cn(cell, 'text-right text-xs font-semibold tabular-nums text-muted-foreground')}>{cat.dias[f as keyof typeof cat.dias] || ''}</td>)}
        <td className={cn(cell, 'text-right text-xs font-semibold tabular-nums text-muted-foreground')}>{cat.total}</td>
      </tr>
      {personas.map(p => (
        <tr key={p.empleado_id}>
          <td className={cell}>
            {p.nombre}
            {p.planificados > 0 && <span className="ml-1.5 rounded bg-blue-50 px-1 text-[10px] text-blue-700" title={`${p.planificados} día(s) asignados sin jornada todavía`}>plan. {p.planificados}</span>}
          </td>
          {fases.map(f => <td key={f} className={cn(cell, 'text-right tabular-nums')}>{p.dias[f as keyof typeof p.dias] || <span className="text-muted-foreground/40">—</span>}</td>)}
          <td className={cn(cell, 'text-right tabular-nums font-medium')}>{p.total}</td>
        </tr>
      ))}
    </>
  );
}

const TIPO_REMITO: Record<string, string> = { LAYHER: 'Layher', NACIONAL: 'Nacional', TECHOS: 'Techos', PANOL: 'Pañol', LONAS_AFORO: 'Lonas y aforo' };

function Remitos({ data, onIrLogistica }: { data: Operacion; onIrLogistica: () => void }) {
  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="flex items-center gap-1.5 text-base font-semibold"><Truck size={18} /> Material que salió (remitos)</h3>
        <button className="ml-auto text-xs text-blue-700 hover:underline" onClick={onIrLogistica}>Ir a Logística</button>
      </div>
      {data.remitos.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin remitos todavía. Se arman en la pestaña Logística.</p>
      ) : (
        <div className="overflow-x-auto">
          <BaseTable className="min-w-[560px] text-sm">
            <thead>
              <tr>
                <th className="px-2 py-2 text-left">Remito</th>
                <th className="px-2 py-2 text-left w-24">Fecha</th>
                <th className="px-2 py-2 text-left">Chofer</th>
                <th className="px-2 py-2 text-right w-20">Ítems</th>
                <th className="px-2 py-2 text-right w-24">Unidades</th>
                <th className="px-2 py-2 text-left w-24">Estado</th>
              </tr>
            </thead>
            <tbody>
              {data.remitos.map(r => (
                <tr key={r.id}>
                  <td className="px-2 py-1.5">{TIPO_REMITO[r.tipo] ?? r.tipo} Nº {String(r.numero).padStart(4, '0')}</td>
                  <td className="px-2 py-1.5 text-xs">{formatDate(r.fecha)}</td>
                  <td className="px-2 py-1.5">{r.chofer ?? <span className="text-muted-foreground/50">—</span>}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{r.items}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{r.unidades.toLocaleString('es-AR')}</td>
                  <td className="px-2 py-1.5 text-xs">{r.estado === 'EMITIDO' ? 'Emitido' : 'Borrador'}</td>
                </tr>
              ))}
            </tbody>
          </BaseTable>
        </div>
      )}
    </section>
  );
}
