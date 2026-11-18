import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Camera, CheckCircle2, Download, MapPin, Pencil, Plus, RotateCcw, Search, Trash2, Truck, User, UserCheck, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import TabStrip, { TabCount } from '@/components/ui/TabStrip';
import {
  useNovedades, useNovedad, useTiposNovedad, useUpdateNovedad, useDeleteNovedad, useSubirAdjuntosNovedad,
  useBorrarAdjuntoNovedad, prepararArchivo, type FiltrosNovedades,
} from '@/hooks/useNovedades';
import { useAuth } from '@/hooks/useAuth';
import { formatDate, formatFechaLocal } from '@/lib/formatters';
import { cn, getApiErrorMessage } from '@/lib/utils';
import type { GravedadNovedad, Novedad } from '@/types';
import NovedadDialog from './NovedadDialog';
import { EstadoBadge, GRAVEDAD, GRAVEDADES_ORDEN, GravedadBadge, Miniatura, TipoChip, useBlobAdjunto } from './novedadesUi';

type EstadoFiltro = NonNullable<FiltrosNovedades['estado']>;

// Lista de novedades con filtros, usada por la pantalla Novedades (todas) y
// por la pestaña Novedades del evento (filtro fijo evento_id). Orden: sin
// resolver primero, después por gravedad y por fecha.
export default function NovedadesLista({ eventoId, abrirId, onAbrirConsumido }: {
  eventoId?:        number;
  abrirId?:         number | null;
  onAbrirConsumido?: () => void;
}) {
  const { user } = useAuth();
  const puedeCargar = !!user && ['ADMIN', 'OPERADOR', 'PANOLERO'].includes(user.rol);
  const [estado, setEstado] = useState<EstadoFiltro>('ABIERTAS');
  const [tipoId, setTipoId] = useState<number | 'todos'>('todos');
  const [gravedad, setGravedad] = useState<GravedadNovedad | null>(null);
  const [q, setQ] = useState('');
  const [qDeb, setQDeb] = useState('');
  const [nueva, setNueva] = useState(false);
  const [detalleId, setDetalleId] = useState<number | null>(null);

  useEffect(() => { const t = setTimeout(() => setQDeb(q.trim()), 300); return () => clearTimeout(t); }, [q]);
  useEffect(() => { if (abrirId) { setDetalleId(abrirId); onAbrirConsumido?.(); } }, [abrirId]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: tipos } = useTiposNovedad();
  const { data, isLoading } = useNovedades({
    estado, evento_id: eventoId, q: qDeb || undefined,
    tipo_id: tipoId === 'todos' ? undefined : tipoId, gravedad: gravedad ?? undefined,
  });

  const totalTipos = useMemo(() => Object.values(data?.por_tipo ?? {}).reduce((a, b) => a + b, 0), [data]);
  const tiposItems = useMemo(() => [
    { key: 'todos', label: 'Todos los tipos', badge: <TabCount count={totalTipos} tone="neutral" /> },
    ...(tipos ?? []).filter(t => t.activo || data?.por_tipo[t.id]).map(t => ({
      key: String(t.id),
      label: <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: t.color ?? '#6B7280' }} />{t.nombre}</span>,
      badge: <TabCount count={data?.por_tipo[t.id]} tone="neutral" />,
    })),
  ], [tipos, data, totalTipos]);

  const items = data?.items ?? [];

  return (
    <div className="space-y-4">
      {/* Tarjetas por gravedad: filtran al tocarlas */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {GRAVEDADES_ORDEN.map(g => {
          const n = data?.por_gravedad[g] ?? 0;
          const sel = gravedad === g;
          return (
            <button
              key={g} type="button" onClick={() => setGravedad(sel ? null : g)}
              className={cn('rounded-xl border bg-[var(--bg-card)] px-4 py-3 text-left shadow-sm transition-shadow hover:shadow-md', sel ? 'shadow-md' : 'border-border')}
              style={{ borderLeftWidth: 4, borderLeftColor: GRAVEDAD[g].color, ...(sel ? { borderColor: GRAVEDAD[g].color } : {}) }}
            >
              <div className="text-xs font-medium text-muted-foreground">{GRAVEDAD[g].label}</div>
              <div className={cn('text-2xl font-bold tabular-nums', n > 0 ? GRAVEDAD[g].texto : 'text-muted-foreground')}>{n}</div>
            </button>
          );
        })}
      </div>

      <TabStrip<string> variant="pill" items={tiposItems} value={String(tipoId)} onChange={k => setTipoId(k === 'todos' ? 'todos' : Number(k))} />

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl border border-border bg-[var(--bg-card)] p-0.5 shadow-sm">
          {(['ABIERTAS', 'RESUELTAS', 'TODAS'] as EstadoFiltro[]).map(e => (
            <button key={e} type="button" onClick={() => setEstado(e)}
              className={cn('rounded-lg px-3 py-1.5 text-sm font-medium', estado === e ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground')}>
              {e === 'ABIERTAS' ? 'Sin resolver' : e === 'RESUELTAS' ? 'Resueltas' : 'Todas'}
            </button>
          ))}
        </div>
        <div className="relative min-w-[180px] flex-1 sm:max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar…" className="w-full rounded-xl border border-input bg-[var(--bg-card)] py-2 pl-8 pr-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
        {(gravedad || tipoId !== 'todos' || q) && (
          <button type="button" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground" onClick={() => { setGravedad(null); setTipoId('todos'); setQ(''); }}>
            <X size={14} /> Limpiar filtros
          </button>
        )}
        {puedeCargar && (
          <Button className="ml-auto" onClick={() => setNueva(true)}>
            <Plus size={15} className="mr-1.5" /> Nueva novedad
          </Button>
        )}
      </div>

      {isLoading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Cargando…</p>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-[var(--bg-card)] px-4 py-10 text-center text-sm text-muted-foreground">
          {estado === 'ABIERTAS' ? 'No hay novedades sin resolver' : 'No hay novedades'}{gravedad || tipoId !== 'todos' || qDeb ? ' con estos filtros' : ''}.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(n => <NovedadCard key={n.id} n={n} mostrarEvento={!eventoId} onClick={() => setDetalleId(n.id)} />)}
          {data?.recortado && <p className="text-center text-xs text-muted-foreground">Se muestran las 500 más recientes. Usá los filtros para encontrar las anteriores.</p>}
        </div>
      )}

      <NovedadDialog open={nueva} onOpenChange={setNueva} inicial={eventoId ? { evento_id: eventoId } : undefined} onCreada={n => setDetalleId(n.id)} />
      <NovedadDetalle id={detalleId} onClose={() => setDetalleId(null)} />
    </div>
  );
}

function NovedadCard({ n, mostrarEvento, onClick }: { n: Novedad; mostrarEvento: boolean; onClick: () => void }) {
  const resuelta = n.estado === 'RESUELTA';
  const vehiculo = n.camion ? [n.camion.codigo, n.camion.patente].filter(Boolean).join(' · ') : null;
  return (
    <button
      type="button" onClick={onClick}
      className={cn('flex w-full gap-3 rounded-xl border border-border bg-[var(--bg-card)] p-3 text-left shadow-sm transition-shadow hover:shadow-md', resuelta && 'opacity-75')}
      style={{ borderLeftWidth: 4, borderLeftColor: GRAVEDAD[n.gravedad].color }}
    >
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <GravedadBadge gravedad={n.gravedad} />
          <TipoChip nombre={n.tipo.nombre} color={n.tipo.color} />
          <EstadoBadge estado={n.estado} />
        </div>
        <div className={cn('font-semibold leading-snug', resuelta && 'line-through decoration-1')}>{n.titulo}</div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1"><Calendar size={12} />{formatDate(n.fecha)}{n.hora ? ` ${n.hora}` : ''}</span>
          {mostrarEvento && n.evento && <span className="inline-flex items-center gap-1">🎪 {n.evento.nombre}</span>}
          {vehiculo && <span className="inline-flex items-center gap-1"><Truck size={12} />{vehiculo}</span>}
          {n.empleado && <span className="inline-flex items-center gap-1"><User size={12} />{n.empleado.apellido}, {n.empleado.nombre}</span>}
          {n.lugar && <span className="inline-flex items-center gap-1"><MapPin size={12} />{n.lugar}</span>}
          {n.responsable_nombre && <span className="inline-flex items-center gap-1"><UserCheck size={12} />{n.responsable_nombre}</span>}
          {n.adjuntos.length > 0 && <span className="inline-flex items-center gap-1"><Camera size={12} />{n.adjuntos.length}</span>}
        </div>
      </div>
      {n.adjuntos[0]?.mime.startsWith('image/') && (
        <Miniatura id={n.adjuntos[0].id} mime={n.adjuntos[0].mime} nombre={n.adjuntos[0].nombre} className="pointer-events-none h-16 w-16" />
      )}
    </button>
  );
}

function NovedadDetalle({ id, onClose }: { id: number | null; onClose: () => void }) {
  const { user } = useAuth();
  const { data: n, error } = useNovedad(id);
  const actualizar = useUpdateNovedad();
  const borrar = useDeleteNovedad();
  const subir = useSubirAdjuntosNovedad();
  const quitarAdj = useBorrarAdjuntoNovedad();
  const [editar, setEditar] = useState(false);
  const [resolver, setResolver] = useState(false);
  const [resolucion, setResolucion] = useState('');
  const [foto, setFoto] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { setResolver(false); setErr(null); }, [id]);

  const puedeBorrar = !!n && !!user && (user.rol === 'ADMIN' || n.created_by === user.id);

  const cambiarEstado = async (estado: Novedad['estado'], res?: string) => {
    if (!n) return;
    setErr(null);
    try {
      await actualizar.mutateAsync({ id: n.id, estado, ...(res !== undefined && { resolucion: res || null }) });
      setResolver(false);
    } catch (e) { setErr(getApiErrorMessage(e)); }
  };

  const agregar = async (lista: FileList | null) => {
    if (!n || !lista?.length) return;
    setErr(null);
    try {
      const archivos = await Promise.all([...lista].map(prepararArchivo));
      await subir.mutateAsync({ id: n.id, archivos });
    } catch (e) { setErr(getApiErrorMessage(e)); }
  };

  return (
    <>
      <Drawer open={!!id} onOpenChange={o => !o && onClose()}>
        <DrawerContent className="max-w-lg p-0">
          {!n ? (
            <div className="p-6 text-sm text-muted-foreground">
              <DrawerTitle className="sr-only">Novedad</DrawerTitle>
              {error ? getApiErrorMessage(error) : 'Cargando…'}
            </div>
          ) : (
            <div className="flex min-h-full flex-col">
              <div className="space-y-2 border-b border-border p-5 pr-10" style={{ borderTop: `4px solid ${GRAVEDAD[n.gravedad].color}` }}>
                <div className="flex flex-wrap items-center gap-1.5">
                  <GravedadBadge gravedad={n.gravedad} />
                  <TipoChip nombre={n.tipo.nombre} color={n.tipo.color} />
                  <EstadoBadge estado={n.estado} />
                </div>
                <DrawerTitle className="text-lg font-semibold leading-snug">{n.titulo}</DrawerTitle>
                <div className="text-xs text-muted-foreground">
                  {formatDate(n.fecha)}{n.hora ? ` a las ${n.hora}` : ''}
                  {n.creado_por_nombre && <> · cargada por {n.creado_por_nombre} el {formatFechaLocal(n.created_at)}</>}
                </div>
              </div>

              <div className="flex-1 space-y-5 p-5">
                {n.descripcion && <p className="whitespace-pre-wrap text-sm">{n.descripcion}</p>}

                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                  {n.evento && <><dt className="text-muted-foreground">Evento</dt><dd><Link className="text-link hover:underline" to={`/eventos/${n.evento.id}?tab=novedades`} onClick={onClose}>{n.evento.nombre}</Link></dd></>}
                  {n.camion && <><dt className="text-muted-foreground">Vehículo</dt><dd>{[n.camion.codigo, n.camion.patente].filter(Boolean).join(' · ')}</dd></>}
                  {n.empleado && <><dt className="text-muted-foreground">Persona</dt><dd>{n.empleado.apellido}, {n.empleado.nombre}</dd></>}
                  {n.proveedor && <><dt className="text-muted-foreground">Proveedor</dt><dd>{n.proveedor.nombre}</dd></>}
                  {n.lugar && <><dt className="text-muted-foreground">Lugar</dt><dd>{n.lugar}</dd></>}
                  {n.reportado_por && <><dt className="text-muted-foreground">Avisó</dt><dd>{n.reportado_por}</dd></>}
                  <dt className="text-muted-foreground">Se ocupa</dt><dd>{n.responsable_nombre ?? <span className="text-muted-foreground">Sin asignar</span>}</dd>
                </dl>

                {/* Fotos */}
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Fotos y archivos</span>
                    {n.puede_editar && (
                      <label className="inline-flex cursor-pointer items-center gap-1 text-sm font-medium text-link hover:underline">
                        <Camera size={14} /> {subir.isPending ? 'Subiendo…' : 'Agregar'}
                        <input type="file" accept="image/*,application/pdf" multiple className="hidden" disabled={subir.isPending} onChange={e => { agregar(e.target.files); e.target.value = ''; }} />
                      </label>
                    )}
                  </div>
                  {n.adjuntos.length === 0
                    ? <p className="text-sm text-muted-foreground">Sin fotos.</p>
                    : (
                      <div className="flex flex-wrap gap-2">
                        {n.adjuntos.map(a => <Miniatura key={a.id} id={a.id} mime={a.mime} nombre={a.nombre} className="h-20 w-20" onClick={() => setFoto(a.id)} />)}
                      </div>
                    )}
                </div>

                {/* Resolución */}
                {(n.estado === 'RESUELTA' || n.resolucion) && (
                  <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm dark:border-green-900 dark:bg-green-950/40">
                    <div className="mb-1 flex items-center gap-1.5 font-semibold text-green-800 dark:text-green-300"><CheckCircle2 size={15} /> Resolución</div>
                    <p className="whitespace-pre-wrap">{n.resolucion ?? 'Sin detalle.'}</p>
                    {n.resuelta_at && <p className="mt-1 text-xs text-muted-foreground">{n.resuelta_por_nombre ? `${n.resuelta_por_nombre}, ` : ''}{formatFechaLocal(n.resuelta_at)}</p>}
                  </div>
                )}

                {resolver && (
                  <div className="space-y-2 rounded-xl border border-border p-3">
                    <label className="block text-xs font-medium text-muted-foreground" htmlFor="res-txt">Qué se hizo para resolverla</label>
                    <textarea id="res-txt" autoFocus className="min-h-[72px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring" value={resolucion} onChange={e => setResolucion(e.target.value)} />
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => setResolver(false)}>Cancelar</Button>
                      <Button size="sm" disabled={actualizar.isPending} onClick={() => cambiarEstado('RESUELTA', resolucion)}>Marcar resuelta</Button>
                    </div>
                  </div>
                )}

                {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{err}</p>}
              </div>

              {n.puede_editar && !resolver && (
                <div className="sticky bottom-0 flex flex-wrap gap-2 border-t border-border bg-[var(--bg-card)] p-4">
                  {n.estado !== 'RESUELTA' ? (
                    <>
                      <Button onClick={() => { setResolucion(n.resolucion ?? ''); setResolver(true); }}><CheckCircle2 size={15} className="mr-1.5" /> Resolver</Button>
                      {n.estado === 'ABIERTA' && <Button variant="outline" disabled={actualizar.isPending} onClick={() => cambiarEstado('EN_CURSO')}>En curso</Button>}
                    </>
                  ) : (
                    <Button variant="outline" disabled={actualizar.isPending} onClick={() => cambiarEstado('ABIERTA')}><RotateCcw size={15} className="mr-1.5" /> Reabrir</Button>
                  )}
                  <Button variant="outline" onClick={() => setEditar(true)}><Pencil size={15} className="mr-1.5" /> Editar</Button>
                  {puedeBorrar && (
                    <Button variant="ghost" className="ml-auto text-red-600 hover:text-red-700" disabled={borrar.isPending}
                      onClick={async () => {
                        if (!window.confirm('¿Borrar esta novedad?')) return;
                        try { await borrar.mutateAsync(n.id); onClose(); } catch (e) { setErr(getApiErrorMessage(e)); }
                      }}>
                      <Trash2 size={15} />
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </DrawerContent>
      </Drawer>

      {n && <NovedadDialog open={editar} onOpenChange={setEditar} novedad={n} />}
      {n && foto && (
        <VisorAdjunto
          adjunto={n.adjuntos.find(a => a.id === foto)!}
          onClose={() => setFoto(null)}
          onQuitar={n.puede_editar ? async () => { await quitarAdj.mutateAsync(foto); setFoto(null); } : undefined}
        />
      )}
    </>
  );
}

function VisorAdjunto({ adjunto, onClose, onQuitar }: { adjunto: Novedad['adjuntos'][number] | undefined; onClose: () => void; onQuitar?: () => void }) {
  const { url } = useBlobAdjunto(adjunto?.id ?? 0, !!adjunto);
  if (!adjunto) return null;
  const esImagen = adjunto.mime.startsWith('image/');
  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle className="truncate pr-6 text-sm">{adjunto.nombre}</DialogTitle></DialogHeader>
        {esImagen
          ? (url ? <img src={url} alt={adjunto.nombre} className="max-h-[70dvh] w-full rounded-lg object-contain" /> : <p className="py-10 text-center text-sm text-muted-foreground">Cargando…</p>)
          : (url ? <iframe src={url} title={adjunto.nombre} className="h-[70dvh] w-full rounded-lg border" /> : <p className="py-10 text-center text-sm text-muted-foreground">Cargando…</p>)}
        <div className="flex justify-between gap-2">
          {onQuitar
            ? <Button variant="ghost" className="text-red-600" onClick={() => { if (window.confirm('¿Quitar este archivo?')) onQuitar(); }}><Trash2 size={15} className="mr-1.5" /> Quitar</Button>
            : <span />}
          {url && <a href={url} download={adjunto.nombre}><Button variant="outline"><Download size={15} className="mr-1.5" /> Descargar</Button></a>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
