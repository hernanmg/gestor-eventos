import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Loader2, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { useCreateNovedad, useOpcionesNovedad, useSubirAdjuntosNovedad, useUpdateNovedad, prepararArchivo, type NovedadPayload } from '@/hooks/useNovedades';
import { cn, getApiErrorMessage } from '@/lib/utils';
import type { EstadoNovedad, GravedadNovedad, Novedad } from '@/types';
import { GRAVEDAD, GRAVEDADES_ORDEN, ESTADO, hoyISO, horaAhora } from './novedadesUi';

const inputCls = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring';
const labelCls = 'mb-1 block text-xs font-medium text-muted-foreground';
const NINGUNO = '';

// Alta y edición de una novedad. Pensado para cargarla desde el celular en el
// momento: tipo, gravedad, qué pasó y una foto alcanzan; el resto es opcional.
export default function NovedadDialog({ open, onOpenChange, novedad, inicial, onCreada }: {
  open:          boolean;
  onOpenChange:  (o: boolean) => void;
  novedad?:      Novedad | null;               // edición
  inicial?:      Partial<NovedadPayload>;       // alta con vínculo fijo (ej. desde el evento)
  onCreada?:     (n: Novedad) => void;
}) {
  const { data: op } = useOpcionesNovedad(open);
  const crear = useCreateNovedad();
  const editar = useUpdateNovedad();
  const subir = useSubirAdjuntosNovedad();
  const [f, setF] = useState<NovedadPayload>(() => vacio(inicial));
  const [fotos, setFotos] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [masDatos, setMasDatos] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setFotos([]);
    if (novedad) {
      setF({
        tipo_id: novedad.tipo_id, fecha: novedad.fecha.slice(0, 10), hora: novedad.hora, titulo: novedad.titulo,
        descripcion: novedad.descripcion, lugar: novedad.lugar, gravedad: novedad.gravedad, estado: novedad.estado,
        reportado_por: novedad.reportado_por, responsable_id: novedad.responsable_id, evento_id: novedad.evento_id,
        camion_id: novedad.camion_id, empleado_id: novedad.empleado_id, proveedor_id: novedad.proveedor_id, resolucion: novedad.resolucion,
      });
      setMasDatos(!!(novedad.reportado_por || novedad.responsable_id || novedad.empleado_id || novedad.proveedor_id || novedad.lugar));
    } else {
      setF(vacio(inicial));
      setMasDatos(false);
    }
  }, [open, novedad]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sin tipo por defecto: si se preselecciona uno, las novedades quedan mal
  // clasificadas por no tocarlo. Se elige siempre.
  const tiposActivos = useMemo(() => (op?.tipos ?? []).filter(t => t.activo || t.id === f.tipo_id), [op, f.tipo_id]);

  const set = <K extends keyof NovedadPayload>(k: K, v: NovedadPayload[K]) => setF(p => ({ ...p, [k]: v }));
  const opts = (xs: { id: number; label: string }[], vacioLabel: string): ComboboxOption[] =>
    [{ value: NINGUNO, label: vacioLabel }, ...xs.map(x => ({ value: String(x.id), label: x.label }))];

  const eventosOpts = useMemo(() => opts((op?.eventos ?? []).map(e => ({ id: e.id, label: e.nombre + (e.fecha_inicio ? ` (${e.fecha_inicio.slice(0, 10).split('-').reverse().join('/')})` : '') })), 'Sin evento'), [op]);
  const camionesOpts = useMemo(() => opts((op?.camiones ?? []).map(c => ({ id: c.id, label: [c.codigo, c.patente].filter(Boolean).join(' · ') })), 'Sin vehículo'), [op]);
  const empleadosOpts = useMemo(() => opts((op?.empleados ?? []).map(e => ({ id: e.id, label: `${e.apellido}, ${e.nombre}` })), 'Nadie en particular'), [op]);
  const proveedoresOpts = useMemo(() => opts((op?.proveedores ?? []).map(p => ({ id: p.id, label: p.nombre })), 'Sin proveedor'), [op]);
  const usuariosOpts = useMemo(() => opts((op?.usuarios ?? []).map(u => ({ id: u.id, label: u.nombre })), 'Sin asignar'), [op]);
  const idDe = (v: string) => (v === NINGUNO ? null : Number(v));

  const guardando = crear.isPending || editar.isPending || subir.isPending;

  const agregarFotos = async (lista: FileList | null) => {
    if (!lista?.length) return;
    const preparadas = await Promise.all([...lista].map(prepararArchivo));
    setFotos(p => [...p, ...preparadas].slice(0, 10));
  };

  const guardar = async () => {
    setError(null);
    if (!f.tipo_id) { setError('Elegí el tipo'); return; }
    if (f.titulo.trim().length < 3) { setError('Contá en pocas palabras qué pasó'); return; }
    try {
      let n: Novedad;
      if (novedad) n = await editar.mutateAsync({ id: novedad.id, ...f });
      else n = await crear.mutateAsync(f);
      if (fotos.length) n = await subir.mutateAsync({ id: n.id, archivos: fotos });
      onOpenChange(false);
      if (!novedad) onCreada?.(n);
    } catch (e) {
      setError(getApiErrorMessage(e));
    }
  };

  const eventoFijo = !novedad && inicial?.evento_id != null;

  return (
    <Dialog open={open} onOpenChange={o => !guardando && onOpenChange(o)}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{novedad ? 'Editar novedad' : 'Nueva novedad'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Tipo */}
          <div>
            <span className={labelCls}>Tipo</span>
            <div className="flex flex-wrap gap-1.5">
              {tiposActivos.map(t => (
                <button
                  key={t.id} type="button" onClick={() => set('tipo_id', t.id)}
                  className={cn('tab-pill inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-sm font-medium', f.tipo_id !== t.id && 'text-muted-foreground')}
                  aria-selected={f.tipo_id === t.id}
                >
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: t.color ?? '#6B7280' }} />
                  {t.nombre}
                </button>
              ))}
            </div>
          </div>

          {/* Gravedad */}
          <div>
            <span className={labelCls}>Gravedad</span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {GRAVEDADES_ORDEN.map(g => {
                const sel = f.gravedad === g;
                return (
                  <button
                    key={g} type="button" onClick={() => set('gravedad', g as GravedadNovedad)} title={GRAVEDAD[g].ayuda}
                    className={cn(
                      'rounded-xl border px-2 py-2 text-left text-sm transition-shadow',
                      sel ? cn('shadow-md', GRAVEDAD[g].suave) : 'border-border bg-[var(--bg-card)] hover:shadow-sm',
                    )}
                    style={sel ? { borderColor: GRAVEDAD[g].color } : undefined}
                  >
                    <span className="flex items-center gap-1.5 font-semibold">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: GRAVEDAD[g].color }} />
                      {GRAVEDAD[g].label}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{GRAVEDAD[f.gravedad].ayuda}</p>
          </div>

          {/* Qué pasó */}
          <div>
            <label className={labelCls} htmlFor="nov-titulo">Qué pasó</label>
            <input id="nov-titulo" className={inputCls} value={f.titulo} onChange={e => set('titulo', e.target.value)} placeholder="Ej.: se pinchó una goma del C3 camino a Carlos Paz" maxLength={200} autoFocus={!novedad} />
          </div>
          <div>
            <label className={labelCls} htmlFor="nov-desc">Detalle (opcional)</label>
            <textarea id="nov-desc" className={cn(inputCls, 'min-h-[72px]')} value={f.descripcion ?? ''} onChange={e => set('descripcion', e.target.value)} placeholder="Cómo pasó, qué se hizo en el momento, qué hace falta…" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls} htmlFor="nov-fecha">Fecha</label>
              <input id="nov-fecha" type="date" className={inputCls} value={f.fecha} max={hoyISO()} onChange={e => set('fecha', e.target.value)} />
            </div>
            <div>
              <label className={labelCls} htmlFor="nov-hora">Hora (opcional)</label>
              <input id="nov-hora" type="time" className={inputCls} value={f.hora ?? ''} onChange={e => set('hora', e.target.value || null)} />
            </div>
          </div>

          {/* Vínculos principales */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <span className={labelCls}>Evento</span>
              {eventoFijo
                ? <div className={cn(inputCls, 'bg-[var(--bg-secondary)]')}>{op?.eventos.find(e => e.id === f.evento_id)?.nombre ?? 'Este evento'}</div>
                : <Combobox className="w-full sm:w-full" options={eventosOpts} value={f.evento_id ? String(f.evento_id) : NINGUNO} onChange={v => set('evento_id', idDe(v))} placeholder="Sin evento" searchPlaceholder="Buscar evento…" />}
            </div>
            <div>
              <span className={labelCls}>Vehículo</span>
              <Combobox className="w-full sm:w-full" options={camionesOpts} value={f.camion_id ? String(f.camion_id) : NINGUNO} onChange={v => set('camion_id', idDe(v))} placeholder="Sin vehículo" searchPlaceholder="Buscar por código o patente…" />
            </div>
          </div>

          {/* Fotos */}
          <div>
            <span className={labelCls}>Fotos o PDF (opcional)</span>
            <div className="flex flex-wrap items-center gap-2">
              {fotos.map((a, i) => (
                <span key={i} className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1 text-xs">
                  {a.name.length > 22 ? a.name.slice(0, 20) + '…' : a.name}
                  <button type="button" onClick={() => setFotos(p => p.filter((_, j) => j !== i))} aria-label="Quitar"><X size={12} /></button>
                </span>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                <Camera size={14} className="mr-1.5" /> Agregar foto
              </Button>
              <input ref={fileRef} type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={e => { agregarFotos(e.target.files); e.target.value = ''; }} />
            </div>
          </div>

          {/* Más datos */}
          {!masDatos ? (
            <button type="button" className="text-sm font-medium text-link hover:underline" onClick={() => setMasDatos(true)}>
              + Más datos: lugar, quién avisó, persona, proveedor, responsable
            </button>
          ) : (
            <div className="grid gap-3 rounded-xl border border-border p-3 sm:grid-cols-2">
              <div>
                <label className={labelCls} htmlFor="nov-lugar">Lugar</label>
                <input id="nov-lugar" className={inputCls} value={f.lugar ?? ''} onChange={e => set('lugar', e.target.value)} placeholder="Ruta 20 km 15, depósito, predio…" />
              </div>
              <div>
                <label className={labelCls} htmlFor="nov-rep">Quién avisó</label>
                <input id="nov-rep" className={inputCls} value={f.reportado_por ?? ''} onChange={e => set('reportado_por', e.target.value)} placeholder="Si no sos vos (ej.: Luis, chofer)" />
              </div>
              <div>
                <span className={labelCls}>Persona involucrada</span>
                <Combobox className="w-full sm:w-full" options={empleadosOpts} value={f.empleado_id ? String(f.empleado_id) : NINGUNO} onChange={v => set('empleado_id', idDe(v))} placeholder="Nadie en particular" searchPlaceholder="Buscar persona…" />
              </div>
              <div>
                <span className={labelCls}>Proveedor</span>
                <Combobox className="w-full sm:w-full" options={proveedoresOpts} value={f.proveedor_id ? String(f.proveedor_id) : NINGUNO} onChange={v => set('proveedor_id', idDe(v))} placeholder="Sin proveedor" searchPlaceholder="Buscar proveedor…" />
              </div>
              <div className="sm:col-span-2">
                <span className={labelCls}>Quién se ocupa (le llega el aviso)</span>
                <Combobox className="w-full sm:w-full" options={usuariosOpts} value={f.responsable_id ? String(f.responsable_id) : NINGUNO} onChange={v => set('responsable_id', idDe(v))} placeholder="Sin asignar" searchPlaceholder="Buscar usuario…" />
              </div>
            </div>
          )}

          {/* Estado y resolución (sólo al editar) */}
          {novedad && (
            <div className="grid gap-3 rounded-xl border border-border p-3">
              <div>
                <span className={labelCls}>Estado</span>
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(ESTADO) as EstadoNovedad[]).map(e => (
                    <button key={e} type="button" aria-selected={f.estado === e} onClick={() => set('estado', e)}
                      className={cn('tab-pill h-8 rounded-full px-3 text-sm font-medium', f.estado !== e && 'text-muted-foreground')}>
                      {ESTADO[e].label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelCls} htmlFor="nov-res">Resolución</label>
                <textarea id="nov-res" className={cn(inputCls, 'min-h-[60px]')} value={f.resolucion ?? ''} onChange={e => set('resolucion', e.target.value)} placeholder="Qué se hizo para resolverla" />
              </div>
            </div>
          )}

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={guardando}>Cancelar</Button>
            <Button onClick={guardar} disabled={guardando}>
              {guardando && <Loader2 size={14} className="mr-1.5 animate-spin" />}
              {novedad ? 'Guardar' : 'Cargar novedad'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function vacio(inicial?: Partial<NovedadPayload>): NovedadPayload {
  return {
    tipo_id: 0, fecha: hoyISO(), hora: horaAhora(), titulo: '', descripcion: null, lugar: null, gravedad: 'MEDIA',
    reportado_por: null, responsable_id: null, evento_id: null, camion_id: null, empleado_id: null, proveedor_id: null,
    ...inicial,
  };
}
