import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Route as RouteIcon, Upload, AlertTriangle, CheckCircle2, Plus, Pencil, Trash2, Link2 } from 'lucide-react';
import {
  useBitacoraFlota, useOpcionesBitacoraFlota, useImportarBitacoraFlota, useEliminarViajeFlota, type BitacoraFlotaFiltros,
} from '@/hooks/useBitacoraFlota';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import BaseTable from '@/components/ui/BaseTable';
import { getApiErrorMessage } from '@/lib/utils';
import { formatDate, formatCurrency, formatLitros, formatearPatente } from '@/lib/formatters';
import type { ViajeFlota, ImportarBitacoraFlotaResultado } from '@/types';
import ViajeDrawer from './ViajeDrawer';

const selectCls = 'border border-input rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring bg-white';
const thCls     = 'px-3 py-2 text-left text-xs font-medium text-muted-foreground';

const fmtKm = (n: number) => n.toLocaleString('es-AR');

// horario_salida/llegada son timestamps reales → hora local, no UTC
const fmtHora = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso)) : null;

function CamionCell({ v }: { v: ViajeFlota }) {
  const patente = v.camion?.patente ?? v.patente_camion;
  if (!patente && !v.alias_camion) return <span className="text-muted-foreground">—</span>;
  return (
    <div>
      {patente
        ? <span className="font-mono font-medium">{formatearPatente(patente)}</span>
        : <span className="text-muted-foreground italic">sin patente</span>}
      {v.alias_camion && <span className="ml-1.5 text-xs text-muted-foreground">({v.alias_camion})</span>}
      {v.camion?.descripcion && <div className="text-xs text-muted-foreground">{v.camion.descripcion}</div>}
    </div>
  );
}

// Evento real vinculado → link a la ficha (tab Logística); si no, el texto libre de la planilla
function EventoCell({ v }: { v: ViajeFlota }) {
  if (v.evento) {
    return (
      <Link
        to={`/eventos/${v.evento.id}?tab=LOGISTICA`}
        className="inline-flex items-center gap-1 rounded bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-800 hover:underline"
        title={v.convocatoria && v.convocatoria !== v.evento.nombre ? `En la planilla: ${v.convocatoria}` : 'Evento del sistema'}
      >
        <Link2 size={11} className="shrink-0" />{v.evento.nombre}
      </Link>
    );
  }
  return v.convocatoria ? <span className="text-xs">{v.convocatoria}</span> : <span className="text-muted-foreground">—</span>;
}

function ChoferCell({ v }: { v: ViajeFlota }) {
  if (v.empleado) return <span>{v.empleado.nombre} {v.empleado.apellido}</span>;
  if (v.chofer_nombre) return <span className="text-amber-700" title="No vinculado a un empleado">{v.chofer_nombre}</span>;
  return <span className="text-muted-foreground">—</span>;
}

// ── Importar ──────────────────────────────────────────────────────────────────

function Seccion({ titulo, children, tono = 'normal' }: { titulo: string; children: React.ReactNode; tono?: 'normal' | 'warn' }) {
  return (
    <div>
      <p className={`text-xs font-semibold uppercase tracking-wide mb-1 ${tono === 'warn' ? 'text-amber-700' : 'text-muted-foreground'}`}>{titulo}</p>
      {children}
    </div>
  );
}

// Respuesta del usuario a cada sugerencia de vinculación, por nombre de evento de la planilla
type Respuestas = Record<string, boolean>;

function Vinculaciones({ r, respuestas, onResponder }: {
  r: ImportarBitacoraFlotaResultado;
  respuestas: Respuestas;
  onResponder: (convocatoria: string, si: boolean) => void;
}) {
  if (r.vinculaciones.length === 0) return null;
  return (
    <Seccion titulo="Vinculación con eventos del sistema">
      <ul className="text-xs space-y-1.5">
        {r.vinculaciones.map(g => {
          const yaVinculado = g.evento_actual && g.vinculados === g.viajes && g.evento_actual.id === g.candidato?.id;
          if (yaVinculado || (g.evento_actual && !g.candidato)) {
            return (
              <li key={g.convocatoria} className="flex items-start gap-1">
                <CheckCircle2 size={13} className="text-green-700 mt-0.5 shrink-0" />
                <span><span className="font-medium">{g.convocatoria}</span> ({g.viajes} viajes) — {g.vinculados === g.viajes ? 'ya' : `${g.vinculados} ya`} vinculados a “{g.evento_actual!.nombre}”</span>
              </li>
            );
          }
          if (!g.candidato) {
            return (
              <li key={g.convocatoria} className="text-muted-foreground">
                • <span className="font-medium text-foreground">{g.convocatoria}</span> ({g.viajes} viajes) — sin evento parecido en el sistema; se importa como texto libre
              </li>
            );
          }
          const resp = respuestas[g.convocatoria];
          return (
            <li key={g.convocatoria} className="rounded border p-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex-1 min-w-[200px]">
                  <span className="font-medium">{g.convocatoria}</span>: ¿Vincular estos {g.viajes} viajes a “{g.candidato.nombre}”?
                  <span className="text-muted-foreground"> ({Math.round(g.candidato.similitud * 100)}% de coincidencia)</span>
                </span>
                {r.preview ? (
                  <span className="flex gap-1">
                    <Button type="button" size="sm" variant={resp === true ? 'default' : 'outline'} className="h-7 px-3" onClick={() => onResponder(g.convocatoria, true)}>Sí</Button>
                    <Button type="button" size="sm" variant={resp === false ? 'default' : 'outline'} className="h-7 px-3" onClick={() => onResponder(g.convocatoria, false)}>No</Button>
                  </span>
                ) : (
                  <span className="text-muted-foreground">{g.evento_actual?.id === g.candidato.id ? 'Vinculados' : 'No vinculados'}</span>
                )}
              </div>
              {g.evento_actual && g.evento_actual.id !== g.candidato.id && (
                <p className="text-muted-foreground mt-1">{g.vinculados} de estos viajes ya están vinculados a “{g.evento_actual.nombre}” — si respondés No, se mantienen así.</p>
              )}
            </li>
          );
        })}
      </ul>
    </Seccion>
  );
}

function ResultadoImport({ r, respuestas, onResponder }: {
  r: ImportarBitacoraFlotaResultado;
  respuestas: Respuestas;
  onResponder: (convocatoria: string, si: boolean) => void;
}) {
  return (
    <div className="space-y-4 text-sm">
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded border p-2 text-center"><p className="text-xs text-muted-foreground">{r.preview ? 'Se crean' : 'Creados'}</p><p className="text-lg font-semibold text-green-700">{r.creados}</p></div>
        <div className="rounded border p-2 text-center"><p className="text-xs text-muted-foreground">{r.preview ? 'Se actualizan' : 'Actualizados'}</p><p className="text-lg font-semibold">{r.actualizados}</p></div>
        <div className="rounded border p-2 text-center"><p className="text-xs text-muted-foreground">Filas ignoradas</p><p className="text-lg font-semibold">{r.ignoradas.length}</p></div>
      </div>
      <p className="text-xs text-muted-foreground">
        {r.filas_leidas} filas de viaje leídas → {r.viajes} viajes
        {r.fusionados.length > 0 && <> ({r.fusionados.length} estaban repetidos en más de una hoja y se fusionaron)</>}
        {r.sin_fecha > 0 && <> · {r.sin_fecha} sin fecha en la planilla</>}
        {' '}· {fmtKm(r.totales.km)} km · {formatLitros(r.totales.litros)} L cargados · {formatLitros(r.totales.litros_consumidos)} L consumidos · combustible {formatCurrency(r.totales.combustible)} · caja {formatCurrency(r.totales.caja)}
      </p>

      <Seccion titulo="Bloques detectados">
        <ul className="text-xs space-y-0.5">
          {r.bloques.map((b, i) => (
            <li key={i}><span className="font-medium">{b.hoja}</span>{b.titulo && <> — {b.titulo}</>} <span className="text-muted-foreground">(tipo {b.tipo}, {b.viajes} viajes)</span></li>
          ))}
        </ul>
        {r.hojas_no_reconocidas.length > 0 && (
          <p className="text-xs text-muted-foreground mt-1">Hojas sin formato reconocido: {r.hojas_no_reconocidas.join(', ')}</p>
        )}
      </Seccion>

      <Vinculaciones r={r} respuestas={respuestas} onResponder={onResponder} />

      <Seccion titulo="Camiones" tono={r.camiones.no_encontrados.length ? 'warn' : 'normal'}>
        {r.camiones.resueltos.length > 0 && (
          <p className="text-xs flex items-start gap-1"><CheckCircle2 size={13} className="text-green-700 mt-0.5 shrink-0" />
            {r.camiones.resueltos.map(c => `${c.valor} → ${formatearPatente(c.camion.patente ?? c.camion.codigo)}`).join(' · ')}
          </p>
        )}
        {r.camiones.no_encontrados.length > 0 && (
          <ul className="text-xs text-amber-800 mt-1 space-y-0.5">
            {r.camiones.no_encontrados.map(c => <li key={c.valor}>• {c.valor} — {c.motivo} ({c.viajes} viajes)</li>)}
          </ul>
        )}
      </Seccion>

      <Seccion titulo="Choferes" tono={r.choferes.no_encontrados.length ? 'warn' : 'normal'}>
        {r.choferes.encontrados.length > 0 && (
          <p className="text-xs flex items-start gap-1"><CheckCircle2 size={13} className="text-green-700 mt-0.5 shrink-0" />
            {r.choferes.encontrados.map(c => `${c.nombre} → ${c.empleado.nombre} ${c.empleado.apellido}`).join(' · ')}
          </p>
        )}
        {r.choferes.no_encontrados.length > 0 && (
          <p className="text-xs text-amber-800 mt-1">
            No encontrados (quedan sin vincular, con el nombre en observaciones): {r.choferes.no_encontrados.map(c => `${c.nombre} (${c.viajes})`).join(', ')}
          </p>
        )}
      </Seccion>

      {r.saldos_iniciales.length > 0 && (
        <Seccion titulo="Saldo inicial de tanque">
          <ul className="text-xs space-y-0.5">
            {r.saldos_iniciales.map((s, i) => (
              <li key={i}>
                Saldo inicial tanque: <span className="font-medium">{s.litros != null ? `${formatLitros(s.litros)} L` : 'sin dato'}</span>
                {s.chofer && <> ({s.chofer})</>}
                <span className="text-muted-foreground"> — {s.hoja}{s.km_inicial != null && <>, odómetro {fmtKm(s.km_inicial)}</>}</span>
              </li>
            ))}
          </ul>
        </Seccion>
      )}

      {r.ignoradas.length > 0 && (
        <Seccion titulo="Filas ignoradas">
          <ul className="text-xs space-y-0.5 max-h-32 overflow-y-auto">
            {r.ignoradas.map((f, i) => <li key={i}><span className="text-muted-foreground">{f.hoja} fila {f.fila}:</span> {f.motivo}</li>)}
          </ul>
        </Seccion>
      )}

      {r.advertencias.length > 0 && (
        <Seccion titulo={`Advertencias (${r.advertencias.length})`} tono="warn">
          <ul className="text-xs space-y-0.5 max-h-32 overflow-y-auto">
            {r.advertencias.map((a, i) => <li key={i}><span className="text-muted-foreground">{a.hoja} fila {a.fila}:</span> {a.mensaje}</li>)}
          </ul>
        </Seccion>
      )}
    </div>
  );
}

function ImportarDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const importar = useImportarBitacoraFlota();
  const [file, setFile] = useState<File | null>(null);
  const [resultado, setResultado] = useState<ImportarBitacoraFlotaResultado | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [respuestas, setRespuestas] = useState<Respuestas>({});

  useEffect(() => { if (open) { setFile(null); setResultado(null); setError(null); setRespuestas({}); } }, [open]);

  const ejecutar = async (f: File, preview: boolean) => {
    setError(null);
    // Sólo viajan los grupos confirmados con "Sí"
    const vinculos: Record<string, number> = {};
    if (!preview && resultado) {
      for (const g of resultado.vinculaciones) {
        if (g.candidato && respuestas[g.convocatoria]) vinculos[g.convocatoria] = g.candidato.id;
      }
    }
    try {
      const r = await importar.mutateAsync({ file: f, preview, vinculos });
      setResultado(r);
      // Grupos que ya estaban vinculados al candidato arrancan en "Sí"
      if (preview) {
        setRespuestas(Object.fromEntries(r.vinculaciones
          .filter(g => g.candidato && g.evento_actual?.id === g.candidato.id && g.vinculados === g.viajes)
          .map(g => [g.convocatoria, true])));
      }
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  const pendientes = resultado?.preview
    ? resultado.vinculaciones.filter(g => g.candidato && respuestas[g.convocatoria] === undefined).length
    : 0;

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Importar planilla de viajes de camiones</DialogTitle></DialogHeader>
        <div className="space-y-3 mt-1">
          {!resultado && (
            <>
              <p className="text-xs text-muted-foreground">
                Subí la planilla de Flor. Se detectan solas las hojas por evento, la de logística diaria (con sus bloques) y las de viajes con horario.
                Primero vas a ver una vista previa — no se guarda nada hasta confirmar.
              </p>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={e => { const f = e.target.files?.[0]; if (f) { setFile(f); ejecutar(f, true); } }}
                disabled={importar.isPending}
                className="text-sm"
              />
            </>
          )}
          {importar.isPending && <p className="text-xs text-muted-foreground">Procesando…</p>}
          {error && <p className="text-xs text-destructive">{error}</p>}
          {resultado && (
            <>
              {resultado.preview
                ? <p className="text-xs flex items-center gap-1 text-amber-700"><AlertTriangle size={13} /> Vista previa — todavía no se guardó nada.</p>
                : <p className="text-xs flex items-center gap-1 text-green-700"><CheckCircle2 size={13} /> Importación aplicada.</p>}
              <ResultadoImport r={resultado} respuestas={respuestas} onResponder={(c, si) => setRespuestas(p => ({ ...p, [c]: si }))} />
            </>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" size="sm" variant="outline" onClick={onClose}>
              {resultado && !resultado.preview ? 'Cerrar' : 'Cancelar'}
            </Button>
            {resultado?.preview && file && (
              <Button
                type="button" size="sm" disabled={importar.isPending || pendientes > 0} onClick={() => ejecutar(file, false)}
                title={pendientes > 0 ? 'Respondé Sí o No en cada sugerencia de vinculación' : undefined}
              >
                Confirmar importación{pendientes > 0 && ` (${pendientes} vinculación${pendientes > 1 ? 'es' : ''} sin responder)`}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Página ────────────────────────────────────────────────────────────────────

const DASH = <span className="text-muted-foreground">—</span>;
const celdaNum = (v: number | null, fmt: (n: number) => string = fmtKm) => (v != null ? fmt(v) : DASH);
const fmtDec = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 2 });

// Horario con la fecha sólo si cae en otro día que la fecha del viaje (llegadas de madrugada)
function HorarioCell({ iso, fecha }: { iso: string | null; fecha: string | null }) {
  if (!iso) return DASH;
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  const mismoDia = fecha?.slice(0, 10) === `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  return (
    <span className="whitespace-nowrap">
      {fmtHora(iso)}
      {!mismoDia && <span className="text-xs text-muted-foreground ml-1">{new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit' }).format(d)}</span>}
    </span>
  );
}

function Tarjeta({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold tabular-nums">{valor}</p>
    </div>
  );
}

export default function BitacoraViajesPage() {
  const { user } = useAuth();
  const isAdmin = user?.rol === 'ADMIN';
  // ?desde=&hasta= (YYYY-MM-DD) llega desde Movimiento Diario ("Ver en Bitácora")
  const [searchParams] = useSearchParams();
  const [filtros, setFiltros] = useState<BitacoraFlotaFiltros>(() => {
    const f: BitacoraFlotaFiltros = {};
    for (const k of ['desde', 'hasta'] as const) {
      const v = searchParams.get(k);
      if (v && /^\d{4}-\d{2}-\d{2}$/.test(v)) f[k] = v;
    }
    return f;
  });
  const { data: viajes = [], isLoading } = useBitacoraFlota(filtros);
  const { data: opciones } = useOpcionesBitacoraFlota();
  const eliminar = useEliminarViajeFlota();
  const [importOpen, setImportOpen] = useState(false);
  // undefined = cerrado · null = alta · viaje = edición
  const [editando, setEditando] = useState<ViajeFlota | null | undefined>(undefined);

  const set = (k: keyof BitacoraFlotaFiltros) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setFiltros(f => ({ ...f, [k]: e.target.value || undefined }));

  // Un solo select para eventos reales ("ev:12") y textos libres ("txt:JUJUY - LA RENGA")
  const eventoSel = filtros.evento_id ? `ev:${filtros.evento_id}` : filtros.evento ? `txt:${filtros.evento}` : '';
  const setEvento = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value;
    setFiltros(f => ({
      ...f,
      evento_id: v.startsWith('ev:') ? Number(v.slice(3)) : undefined,
      evento:    v.startsWith('txt:') ? v.slice(4) : undefined,
    }));
  };

  const totales = useMemo(() => ({
    km:          viajes.reduce((s, v) => s + (v.km_recorridos ?? 0), 0),
    litros:      viajes.reduce((s, v) => s + (v.litros_cargados_ruta ?? 0), 0),
    consumidos:  viajes.reduce((s, v) => s + (v.litros_consumidos ?? 0), 0),
    combustible: viajes.reduce((s, v) => s + (v.monto_combustible ?? 0), 0),
    caja:        viajes.reduce((s, v) => s + (v.monto_caja_entregada ?? 0), 0),
  }), [viajes]);

  const hayFiltros = Object.values(filtros).some(Boolean);

  const handleEliminar = (v: ViajeFlota) => {
    if (!window.confirm(`¿Eliminar el viaje ${v.recorrido ?? ''}${v.fecha ? ` del ${formatDate(v.fecha)}` : ''}?`)) return;
    eliminar.mutate(v.id, { onError: err => alert(getApiErrorMessage(err)) });
  };

  return (
    <div className="p-6 space-y-4 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <RouteIcon size={22} />
          Bitácora de viajes
          <span className="text-sm font-normal text-muted-foreground">({viajes.length} viaje{viajes.length !== 1 ? 's' : ''})</span>
        </h1>
        {isAdmin && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
              <Upload size={14} className="mr-1.5" /> Importar planilla
            </Button>
            <Button size="sm" onClick={() => setEditando(null)}>
              <Plus size={14} className="mr-1.5" /> Agregar viaje
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select value={eventoSel} onChange={setEvento} className={selectCls}>
          <option value="">Todos los eventos</option>
          {opciones?.eventos.map(e => e.tipo === 'evento'
            ? <option key={`ev:${e.evento_id}`} value={`ev:${e.evento_id}`}>● {e.valor}</option>
            : <option key={`txt:${e.valor}`} value={`txt:${e.valor}`}>{e.valor} (sin vincular)</option>)}
        </select>
        <select value={filtros.camion ?? ''} onChange={set('camion')} className={selectCls}>
          <option value="">Todos los camiones</option>
          {opciones?.camiones.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <select value={filtros.chofer ?? ''} onChange={set('chofer')} className={selectCls}>
          <option value="">Todos los choferes</option>
          {opciones?.choferes.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <label className="text-xs text-muted-foreground flex items-center gap-1">
          Desde <input type="date" value={filtros.desde ?? ''} onChange={set('desde')} className={selectCls} />
        </label>
        <label className="text-xs text-muted-foreground flex items-center gap-1">
          Hasta <input type="date" value={filtros.hasta ?? ''} onChange={set('hasta')} className={selectCls} />
        </label>
        {hayFiltros && <Button size="sm" variant="ghost" onClick={() => setFiltros({})}>Limpiar</Button>}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Tarjeta label="Total KM recorridos" valor={fmtKm(totales.km)} />
        <Tarjeta label="Total L. cargados" valor={`${formatLitros(totales.litros)} L`} />
        <Tarjeta label="Total L. consumidos" valor={`${formatLitros(totales.consumidos)} L`} />
        <Tarjeta label="Total $ combustible" valor={formatCurrency(totales.combustible)} />
        <Tarjeta label="Total $ caja" valor={formatCurrency(totales.caja)} />
      </div>
      {(filtros.desde || filtros.hasta) && (
        <p className="text-xs text-muted-foreground -mt-2">Con rango de fechas no se incluyen los viajes que la planilla no traía fechados.</p>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : viajes.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <RouteIcon size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">{hayFiltros ? 'No hay viajes con estos filtros.' : 'Todavía no hay viajes cargados.'}</p>
        </div>
      ) : (
        <BaseTable className="w-full text-sm min-w-[1700px]">
          <thead className="border-b bg-muted/10">
            <tr>
              <th className={thCls}>Fecha</th>
              <th className={thCls}>Evento</th>
              <th className={thCls}>Camión</th>
              <th className={thCls}>Chofer</th>
              <th className={thCls}>Tramo</th>
              <th className={`${thCls} text-right`}>KM Iniciales</th>
              <th className={`${thCls} text-right`}>KM Finales</th>
              <th className={`${thCls} text-right`}>KM Rec.</th>
              <th className={`${thCls} text-right`}>L. Cargados</th>
              <th className={`${thCls} text-right`}>L. Consumidos</th>
              <th className={`${thCls} text-right`}>KM/L</th>
              <th className={`${thCls} text-right`}>$ Combustible</th>
              <th className={`${thCls} text-right`}>$ Caja</th>
              <th className={thCls}>Horario Salida</th>
              <th className={thCls}>Horario Llegada</th>
              <th className={thCls}>Obs.</th>
              {isAdmin && <th className={`${thCls} text-right`}>Acciones</th>}
            </tr>
          </thead>
          <tbody className="divide-y">
            {viajes.map(v => (
              <tr key={v.id} className="hover:bg-muted/20 align-top">
                <td className="px-3 py-2.5 whitespace-nowrap">{v.fecha ? formatDate(v.fecha) : <span className="text-muted-foreground italic">sin fecha</span>}</td>
                <td className="px-3 py-2.5"><EventoCell v={v} /></td>
                <td className="px-3 py-2.5"><CamionCell v={v} /></td>
                <td className="px-3 py-2.5"><ChoferCell v={v} /></td>
                <td className="px-3 py-2.5">{v.recorrido ?? DASH}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{celdaNum(v.km_iniciales)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{celdaNum(v.km_finales)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums font-medium">{celdaNum(v.km_recorridos)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{celdaNum(v.litros_cargados_ruta, fmtDec)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{celdaNum(v.litros_consumidos, fmtDec)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{celdaNum(v.km_por_litro, fmtDec)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{celdaNum(v.monto_combustible, formatCurrency)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{celdaNum(v.monto_caja_entregada, formatCurrency)}</td>
                <td className="px-3 py-2.5"><HorarioCell iso={v.horario_salida} fecha={v.fecha} /></td>
                <td className="px-3 py-2.5"><HorarioCell iso={v.horario_llegada} fecha={v.fecha} /></td>
                <td className="px-3 py-2.5 text-xs text-muted-foreground max-w-xs">
                  {v.observaciones ?? (v.litros_iniciales_tanque == null && DASH)}
                  {v.litros_iniciales_tanque != null && <div className="text-foreground">Tanque inicial: {formatLitros(v.litros_iniciales_tanque)} L</div>}
                </td>
                {isAdmin && (
                  <td className="px-3 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setEditando(v)} title="Editar"><Pencil size={14} /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleEliminar(v)} className="text-destructive hover:text-destructive" title="Eliminar"><Trash2 size={14} /></Button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </BaseTable>
      )}

      <ImportarDialog open={importOpen} onClose={() => setImportOpen(false)} />
      {/* Montado sólo al abrir: carga empleados (/rrhh/empleados es sólo ADMIN) */}
      {isAdmin && editando !== undefined && (
        <ViajeDrawer
          key={editando?.id ?? 'nuevo'}
          viaje={editando}
          convocatorias={opciones?.convocatorias ?? []}
          onClose={() => setEditando(undefined)}
        />
      )}
    </div>
  );
}
