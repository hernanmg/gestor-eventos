import { useEffect, useMemo, useState } from 'react';
import { ClipboardCheck, Plus, Trash2 } from 'lucide-react';
import {
  useControlesSalida, useSugeridosControlSalida, useOpcionesControlSalida,
  useCreateControlSalida, useUpdateControlSalida, useDeleteControlSalida, type ControlSalidaPayload,
} from '@/hooks/useFlota';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Combobox } from '@/components/ui/combobox';
import BaseTable from '@/components/ui/BaseTable';
import { cn, getApiErrorMessage } from '@/lib/utils';
import { formatDate, formatearPatente } from '@/lib/formatters';
import type { ControlSalidaVehiculo, EstadoControlSalida, AlertaDocumental, SugerenciaControlSalida } from '@/types';

const inputCls = 'w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring';
const labelCls = 'block text-xs font-medium text-muted-foreground mb-0.5';
const selectCls = 'border border-input rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring bg-white';

// Control de salida de vehículos — antes de cada viaje Lorena y David revisan
// la papelería. El sistema precarga el estado del seguro, la RTO/ITV y el
// carnet del chofer (rojo = no debería salir); ellos tildan lo que vieron.

const SEMAFORO_DOT: Record<ControlSalidaVehiculo['semaforo'], string> = {
  verde: 'bg-green-500', amarillo: 'bg-yellow-400', rojo: 'bg-red-500',
};
const ESTADO_LABEL: Record<EstadoControlSalida, string> = { PENDIENTE: 'Pendiente', REVISADO: 'Revisado', OBSERVADO: 'Observado' };
const ESTADO_CLASS: Record<EstadoControlSalida, string> = {
  PENDIENTE: 'bg-yellow-100 text-yellow-800', REVISADO: 'bg-green-100 text-green-800', OBSERVADO: 'bg-red-100 text-red-800',
};
const CHECKS = [
  { key: 'check_tarjeta_verde', label: 'Tarjeta verde / cédula' },
  { key: 'check_seguro',        label: 'Seguro (póliza o certificado)' },
  { key: 'check_tecnica',       label: 'RTO / ITV' },
  { key: 'check_carnet',        label: 'Carnet del chofer' },
] as const;

function isoHoy(delta = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + delta);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function AlertaChip({ a }: { a: AlertaDocumental }) {
  return (
    <span className={cn('inline-block text-[11px] px-1.5 py-0.5 rounded', a.nivel === 'rojo' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800')}>
      {a.mensaje}
    </span>
  );
}

function choferLabel(c: ControlSalidaVehiculo): string {
  return c.chofer ? `${c.chofer.apellido}, ${c.chofer.nombre}` : (c.chofer_nombre ?? '—');
}

// ── Nuevo control ─────────────────────────────────────────────────────────────

function NuevoControlDialog({ open, inicial, onClose, onCreado }: {
  open: boolean; inicial: Partial<ControlSalidaPayload> | null; onClose: () => void; onCreado: (c: ControlSalidaVehiculo) => void;
}) {
  const { data: opciones } = useOpcionesControlSalida(open);
  const crear = useCreateControlSalida();
  const [form, setForm] = useState<ControlSalidaPayload>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (open) { setForm({ fecha_salida: isoHoy(), ...inicial }); setError(null); } }, [open, inicial]);

  const vehiculoOptions = (opciones?.vehiculos ?? []).map(v => ({
    value: String(v.id), label: `${v.codigo}${v.patente ? ` · ${formatearPatente(v.patente)}` : ''}${v.descripcion ? ` — ${v.descripcion}` : ''}${v.en_servicio ? '' : ' (de baja)'}`,
  }));
  const empleadoOptions = (opciones?.empleados ?? []).map(e => ({ value: String(e.id), label: `${e.apellido}, ${e.nombre}${e.apodo ? ` (${e.apodo})` : ''}` }));

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.camion_id) { setError('Elegí el vehículo'); return; }
    setError(null);
    try {
      const c = await crear.mutateAsync(form);
      onCreado(c);
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Nuevo control de salida</DialogTitle></DialogHeader>
        <form onSubmit={guardar} className="space-y-3 mt-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className={labelCls}>Vehículo *</label>
              <Combobox options={vehiculoOptions} value={form.camion_id ? String(form.camion_id) : null}
                onChange={v => setForm(p => ({ ...p, camion_id: v ? Number(v) : undefined }))} placeholder="Buscar vehículo…" className="w-full sm:w-full" />
            </div>
            <div>
              <label className={labelCls}>Fecha de salida *</label>
              <input type="date" value={form.fecha_salida ?? ''} onChange={e => setForm(p => ({ ...p, fecha_salida: e.target.value }))} className={inputCls} required />
            </div>
            <div>
              <label className={labelCls}>Destino</label>
              <input value={form.destino ?? ''} onChange={e => setForm(p => ({ ...p, destino: e.target.value || null }))} className={inputCls} placeholder="Tucumán, Polo…" />
            </div>
            <div>
              <label className={labelCls}>Chofer</label>
              <Combobox options={empleadoOptions} value={form.chofer_id ? String(form.chofer_id) : null}
                onChange={v => setForm(p => ({ ...p, chofer_id: v ? Number(v) : null, ...(v && { chofer_nombre: null }) }))} placeholder="Buscar empleado…" className="w-full sm:w-full" />
            </div>
            <div>
              <label className={labelCls}>…o nombre libre</label>
              <input value={form.chofer_nombre ?? ''} disabled={!!form.chofer_id} onChange={e => setForm(p => ({ ...p, chofer_nombre: e.target.value || null }))} className={inputCls} />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Evento</label>
              <select value={form.evento_id ?? ''} onChange={e => setForm(p => ({ ...p, evento_id: e.target.value ? Number(e.target.value) : null }))} className={cn(selectCls, 'w-full')}>
                <option value="">Sin evento</option>
                {(opciones?.eventos ?? []).map(ev => <option key={ev.id} value={ev.id}>{ev.nombre}{ev.fecha_inicio ? ` (${formatDate(ev.fecha_inicio)})` : ''}</option>)}
              </select>
            </div>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={crear.isPending}>{crear.isPending ? 'Creando…' : 'Crear y revisar'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Revisión ──────────────────────────────────────────────────────────────────

function RevisionDialog({ control, onClose }: { control: ControlSalidaVehiculo | null; onClose: () => void }) {
  const actualizar = useUpdateControlSalida();
  const borrar = useDeleteControlSalida();
  const [checks, setChecks] = useState({ check_tarjeta_verde: false, check_seguro: false, check_tecnica: false, check_carnet: false });
  const [revisadoPor, setRevisadoPor] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!control) return;
    setChecks({
      check_tarjeta_verde: control.check_tarjeta_verde, check_seguro: control.check_seguro,
      check_tecnica: control.check_tecnica, check_carnet: control.check_carnet,
    });
    setRevisadoPor(control.revisado_por ?? '');
    setObservaciones(control.observaciones ?? '');
    setError(null);
  }, [control]);

  if (!control) return null;
  const rojas = control.alertas.filter(a => a.nivel === 'rojo');

  const guardar = async (estado: EstadoControlSalida) => {
    setError(null);
    try {
      await actualizar.mutateAsync({ id: control.id, ...checks, estado, revisado_por: revisadoPor || null, observaciones: observaciones || null });
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  const eliminar = async () => {
    if (!window.confirm('¿Eliminar este control de salida?')) return;
    try { await borrar.mutateAsync(control.id); onClose(); } catch (err) { setError(getApiErrorMessage(err)); }
  };

  const pending = actualizar.isPending || borrar.isPending;

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className={cn('inline-block w-3 h-3 rounded-full', SEMAFORO_DOT[control.semaforo])} />
            {control.camion.codigo} — {formatDate(control.fecha_salida)}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <p className="text-xs text-muted-foreground">
            Chofer: {choferLabel(control)}{control.destino ? ` · Destino: ${control.destino}` : ''}{control.evento ? ` · ${control.evento.nombre}` : ''}
          </p>

          <div>
            <p className={labelCls}>Lo que dice el sistema{control.estado !== 'PENDIENTE' ? ' (al momento de revisarlo)' : ''}</p>
            {control.alertas.length === 0
              ? <p className="text-xs text-green-700">Seguro, revisión técnica y carnet en regla.</p>
              : <div className="flex flex-wrap gap-1">{control.alertas.map((a, i) => <AlertaChip key={i} a={a} />)}</div>}
            {rojas.length > 0 && <p className="text-xs text-red-700 mt-1">Con alertas en rojo el vehículo no debería salir: se puede marcar como observado, no como revisado.</p>}
          </div>

          <div>
            <p className={labelCls}>Lo que vieron en la carpeta</p>
            <div className="grid grid-cols-2 gap-1.5">
              {CHECKS.map(c => (
                <label key={c.key} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={checks[c.key]} onChange={e => setChecks(p => ({ ...p, [c.key]: e.target.checked }))} />
                  {c.label}
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Revisó</label>
              <input value={revisadoPor} onChange={e => setRevisadoPor(e.target.value)} className={inputCls} placeholder="Lore, David" />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Observaciones</label>
              <input value={observaciones} onChange={e => setObservaciones(e.target.value)} className={inputCls} placeholder="Qué faltó, qué se pidió…" />
            </div>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex flex-wrap justify-between gap-2 pt-1">
            <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={eliminar} disabled={pending}>
              <Trash2 size={14} className="mr-1" /> Eliminar
            </Button>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => guardar('PENDIENTE')} disabled={pending}>Guardar pendiente</Button>
              <Button variant="outline" size="sm" className="text-red-700" onClick={() => guardar('OBSERVADO')} disabled={pending}>Marcar observado</Button>
              <Button size="sm" onClick={() => guardar('REVISADO')} disabled={pending || rojas.length > 0}>Dar por revisado</Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Tab ───────────────────────────────────────────────────────────────────────

export default function ControlesSalidaTab({ canEdit }: { canEdit: boolean }) {
  const [desde, setDesde] = useState(isoHoy(-30));
  const [hasta, setHasta] = useState(isoHoy(30));
  const [estado, setEstado] = useState<EstadoControlSalida | ''>('');
  const [fechaSugeridos, setFechaSugeridos] = useState(isoHoy());
  const { data: controles = [], isLoading } = useControlesSalida({ desde, hasta, ...(estado && { estado }) });
  const { data: sugeridos } = useSugeridosControlSalida(fechaSugeridos);

  const [nuevo, setNuevo] = useState<Partial<ControlSalidaPayload> | null>(null);
  const [abiertoId, setAbiertoId] = useState<number | null>(null);
  const abierto = useMemo(() => controles.find(c => c.id === abiertoId) ?? null, [controles, abiertoId]);

  const desdeSugerido = (s: SugerenciaControlSalida): Partial<ControlSalidaPayload> => ({
    camion_id: s.camion_id, fecha_salida: fechaSugeridos,
    chofer_id: s.chofer_id, chofer_nombre: s.chofer_id ? null : s.chofer_nombre,
    evento_id: s.evento?.id ?? null, destino: s.destino,
  });

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="rounded-md border bg-muted/20 p-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">Salen el</span>
            <input type="date" value={fechaSugeridos} onChange={e => setFechaSugeridos(e.target.value)} className="border border-input rounded px-2 py-1 text-sm" />
            <span className="text-xs text-muted-foreground">según la bitácora de viajes y el parte diario, sin control cargado:</span>
          </div>
          {(sugeridos?.items ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground">No hay salidas pendientes de control para ese día.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {sugeridos!.items.map(s => (
                <Button key={s.camion_id} size="sm" variant="outline" onClick={() => setNuevo(desdeSugerido(s))} title={s.origen}>
                  <Plus size={13} className="mr-1" /> {s.camion?.codigo ?? `#${s.camion_id}`}{s.chofer_nombre ? ` · ${s.chofer_nombre}` : ''}{s.destino ? ` → ${s.destino}` : ''}
                </Button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <input type="date" value={desde} onChange={e => setDesde(e.target.value)} className="border border-input rounded px-2 py-1.5 text-sm" />
          <span className="text-muted-foreground">a</span>
          <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className="border border-input rounded px-2 py-1.5 text-sm" />
          <select value={estado} onChange={e => setEstado(e.target.value as EstadoControlSalida | '')} className={selectCls}>
            <option value="">Todos</option>
            <option value="PENDIENTE">Pendientes</option>
            <option value="REVISADO">Revisados</option>
            <option value="OBSERVADO">Observados</option>
          </select>
        </div>
        {canEdit && (
          <Button size="sm" onClick={() => setNuevo({})}>
            <Plus size={14} className="mr-1.5" /> Nuevo control
          </Button>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : controles.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <ClipboardCheck size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No hay controles de salida en el período.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <BaseTable className="w-full text-sm min-w-[800px]">
            <thead className="border-b bg-muted/30">
              <tr>
                <th className="px-3 py-2 w-6" />
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Salida</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Vehículo</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Chofer</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Destino / evento</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Alertas</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-muted-foreground">Papeles</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {controles.map(c => {
                const tildados = CHECKS.filter(k => c[k.key]).length;
                return (
                  <tr key={c.id} className="hover:bg-muted/20 cursor-pointer" onClick={() => canEdit && setAbiertoId(c.id)}>
                    <td className="px-3 py-2"><span className={cn('inline-block w-3 h-3 rounded-full', SEMAFORO_DOT[c.semaforo])} /></td>
                    <td className="px-3 py-2 whitespace-nowrap" data-label="Salida">{formatDate(c.fecha_salida)}</td>
                    <td className="px-3 py-2 font-mono font-medium" data-label="Vehículo">{c.camion.codigo}</td>
                    <td className="px-3 py-2" data-label="Chofer">{choferLabel(c)}</td>
                    <td className="px-3 py-2 text-muted-foreground" data-label="Destino">{[c.destino, c.evento?.nombre].filter(Boolean).join(' · ') || '—'}</td>
                    <td className="px-3 py-2" data-label="Alertas">
                      <div className="flex flex-wrap gap-1">{c.alertas.length === 0 ? <span className="text-xs text-green-700">En regla</span> : c.alertas.map((a, i) => <AlertaChip key={i} a={a} />)}</div>
                    </td>
                    <td className="px-3 py-2 text-center text-xs" data-label="Papeles">{tildados}/4</td>
                    <td className="px-3 py-2" data-label="Estado">
                      <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', ESTADO_CLASS[c.estado])}>{ESTADO_LABEL[c.estado]}</span>
                      {c.revisado_por && <span className="block text-[10px] text-muted-foreground">{c.revisado_por}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </BaseTable>
        </div>
      )}

      <NuevoControlDialog
        open={nuevo !== null}
        inicial={nuevo}
        onClose={() => setNuevo(null)}
        onCreado={c => { setNuevo(null); setAbiertoId(c.id); }}
      />
      <RevisionDialog control={abierto} onClose={() => setAbiertoId(null)} />
    </div>
  );
}
