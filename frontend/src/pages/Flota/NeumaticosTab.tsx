import { Fragment, useMemo, useRef, useState } from 'react';
import { Plus, Upload, ChevronDown, ChevronRight, Pencil, Trash2 } from 'lucide-react';
import { useCambiosVehiculo, useGuardarCambio, useEliminarCambio, useImportarCambios } from '@/hooks/useCambiosVehiculo';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import MoneyInput from '@/components/ui/MoneyInput';
import BaseTable from '@/components/ui/BaseTable';
import { cn, getApiErrorMessage } from '@/lib/utils';
import { formatCurrency, formatDate } from '@/lib/formatters';
import type { CambioVehiculo, EstadoCambiosVehiculo, ImportCambiosResultado, TipoCambioVehiculo } from '@/types';

// Neumáticos y baterías por vehículo (planilla de Santi: hojas CAMBIO DE
// NEUMATICOS y CAMBIO DE BATERIA). Cubiertas nuevas, rotaciones por km y
// baterías; avisa cuando un vehículo llega a la rotación o a la fecha de
// cambio de la batería.

const inputCls = 'w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring bg-background';
const labelCls = 'block text-xs font-medium text-muted-foreground mb-0.5';

const TIPO: Record<TipoCambioVehiculo, { label: string; corto: string; placeholder: string }> = {
  NEUMATICOS: { label: 'Cubiertas nuevas', corto: 'Cubiertas',  placeholder: '4 cubiertas Bridgestone 265/65 R17' },
  ROTACION:   { label: 'Rotación',         corto: 'Rotación',   placeholder: 'Rotación de las 4' },
  BATERIA:    { label: 'Batería',          corto: 'Batería',    placeholder: 'Varta 12V/110 Ah' },
};

const km = (n: number | null | undefined) => (n == null ? '—' : `${n.toLocaleString('es-AR')} km`);
const hoyISO = () => new Date().toISOString().slice(0, 10);

// ── Registrar / editar ───────────────────────────────────────────────────────
function CambioDialog({ vehiculos, inicial, onClose, rotacionCada }: {
  vehiculos: EstadoCambiosVehiculo[];
  inicial: { camion_id?: number; tipo?: TipoCambioVehiculo; cambio?: CambioVehiculo };
  onClose: () => void;
  rotacionCada: number;
}) {
  const guardar = useGuardarCambio();
  const c = inicial.cambio;
  const [tipo, setTipo]         = useState<TipoCambioVehiculo>(c?.tipo ?? inicial.tipo ?? 'NEUMATICOS');
  const [camionId, setCamionId] = useState(String(c?.camion_id ?? inicial.camion_id ?? ''));
  const v = vehiculos.find(x => x.camion.id === Number(camionId));
  const [fecha, setFecha]       = useState(c ? (c.fecha?.slice(0, 10) ?? '') : hoyISO());
  const [kmTxt, setKm]          = useState(c?.km != null ? String(c.km) : '');
  const [detalle, setDetalle]   = useState(c?.detalle ?? '');
  const [proxKm, setProxKm]     = useState(c?.proximo_km != null ? String(c.proximo_km) : '');
  const [proxFecha, setProxF]   = useState(c?.proxima_fecha?.slice(0, 10) ?? '');
  const [importe, setImporte]   = useState(c?.importe != null ? String(c.importe) : '');
  const [proveedor, setProv]    = useState(c?.proveedor ?? '');
  const [notas, setNotas]       = useState(c?.notas ?? '');
  const [error, setError]       = useState('');
  const kmNum = kmTxt.trim() ? Number(kmTxt.replace(/\D/g, '')) : null;

  const enviar = async () => {
    setError('');
    if (!camionId) { setError('Elegí el vehículo'); return; }
    if (!fecha && kmNum == null) { setError('Poné la fecha o el km'); return; }
    try {
      await guardar.mutateAsync({
        id: c?.id,
        data: {
          camion_id: Number(camionId), tipo, fecha: fecha || null, km: kmNum, detalle: detalle.trim() || null,
          proximo_km: tipo !== 'BATERIA' && proxKm.trim() ? Number(proxKm.replace(/\D/g, '')) : null,
          proxima_fecha: tipo === 'BATERIA' && proxFecha ? proxFecha : null,
          importe: importe ? Number(importe) : null, proveedor: proveedor.trim() || null, notas: notas.trim() || null,
        },
      });
      onClose();
    } catch (e) { setError(getApiErrorMessage(e)); }
  };

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>{c ? 'Editar' : 'Registrar'} {TIPO[tipo].label.toLowerCase()}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 flex flex-wrap gap-1.5">
            {(Object.keys(TIPO) as TipoCambioVehiculo[]).map(t => (
              <button key={t} type="button" onClick={() => setTipo(t)}
                className={cn('rounded-full border px-3 py-1 text-xs', tipo === t ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted')}>
                {TIPO[t].label}
              </button>
            ))}
          </div>
          <div className="col-span-2">
            <label className={labelCls}>Vehículo</label>
            <select value={camionId} onChange={e => setCamionId(e.target.value)} className={inputCls}>
              <option value="">— Elegí el vehículo —</option>
              {vehiculos.map(x => <option key={x.camion.id} value={x.camion.id}>{x.camion.codigo}{x.camion.descripcion ? ` · ${x.camion.descripcion}` : ''}</option>)}
            </select>
          </div>
          <div><label className={labelCls}>Fecha</label><input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className={inputCls} /></div>
          <div>
            <label className={labelCls}>Km del vehículo</label>
            <input value={kmTxt} onChange={e => setKm(e.target.value)} inputMode="numeric" className={inputCls} placeholder={v?.km_actual != null ? `actual ${v.km_actual.toLocaleString('es-AR')}` : ''} />
          </div>
          <div className="col-span-2"><label className={labelCls}>Detalle</label><input value={detalle} onChange={e => setDetalle(e.target.value)} className={inputCls} placeholder={TIPO[tipo].placeholder} /></div>
          {tipo !== 'BATERIA' ? (
            <div className="col-span-2">
              <label className={labelCls}>Próxima rotación (km)</label>
              <input value={proxKm} onChange={e => setProxKm(e.target.value)} inputMode="numeric" className={inputCls}
                placeholder={kmNum != null ? `${(kmNum + rotacionCada).toLocaleString('es-AR')} (cada ${rotacionCada.toLocaleString('es-AR')} km)` : `cada ${rotacionCada.toLocaleString('es-AR')} km`} />
            </div>
          ) : (
            <div className="col-span-2"><label className={labelCls}>Próximo cambio (si lo sabés)</label><input type="date" value={proxFecha} onChange={e => setProxF(e.target.value)} className={inputCls} /></div>
          )}
          <div><label className={labelCls}>Importe</label><MoneyInput value={importe} onChange={setImporte} className={inputCls} placeholder="—" /></div>
          <div><label className={labelCls}>Dónde</label><input value={proveedor} onChange={e => setProv(e.target.value)} className={inputCls} placeholder="Gomería, casa de baterías…" /></div>
          <div className="col-span-2"><label className={labelCls}>Notas</label><input value={notas} onChange={e => setNotas(e.target.value)} className={inputCls} /></div>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={enviar} disabled={guardar.isPending}>{guardar.isPending ? 'Guardando…' : 'Guardar'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Importar la planilla de Santi ────────────────────────────────────────────
function ImportarDialog({ onClose }: { onClose: () => void }) {
  const imp = useImportarCambios();
  const ref = useRef<HTMLInputElement>(null);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [r, setR] = useState<ImportCambiosResultado | null>(null);
  const [error, setError] = useState('');
  const correr = async (f: File, aplicar: boolean) => {
    setError('');
    try { setR(await imp.mutateAsync({ file: f, aplicar })); } catch (e) { setError(getApiErrorMessage(e)); }
  };
  const aproximados = r?.filas.filter(f => f.aproximado) ?? [];
  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader><DialogTitle>Importar neumáticos y baterías</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground -mt-1">Planilla NOVEDADES Y PENDIENTES PARQUE AUTOMOTOR: hojas CAMBIO DE NEUMATICOS y CAMBIO DE BATERIA. Volver a importarla no duplica y no pisa lo corregido a mano.</p>
        <input ref={ref} type="file" accept=".xlsx,.xls" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) { setArchivo(f); setR(null); void correr(f, false); } }} />
        <Button variant="outline" onClick={() => ref.current?.click()} disabled={imp.isPending} className="self-start"><Upload className="h-4 w-4 mr-1" />{archivo?.name ?? 'Elegir archivo'}</Button>
        {imp.isPending && <p className="text-sm text-muted-foreground">{imp.variables?.aplicar ? 'Importando…' : 'Leyendo…'}</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}
        {r && (
          <div className="space-y-2 text-sm">
            <p>
              {r.aplicado ? 'Importado: ' : ''}<b>{r.nuevos}</b> registro{r.nuevos === 1 ? '' : 's'} nuevo{r.nuevos === 1 ? '' : 's'}
              {r.existentes > 0 && <> · {r.existentes} ya estaba{r.existentes === 1 ? '' : 'n'}</>}
              {r.km_actualizados.length > 0 && <> · km actualizado en {r.km_actualizados.length} vehículo{r.km_actualizados.length === 1 ? '' : 's'}</>}
            </p>
            {aproximados.length > 0 && (
              <p className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800">
                Patente parecida (revisar): {aproximados.map(f => `"${f.vehiculo}" → ${f.camion!.codigo}`).join(' · ')}
              </p>
            )}
            {r.sin_vehiculo.length > 0 && (
              <p className="rounded border px-2 py-1 text-xs text-muted-foreground">
                Sin vehículo en el sistema (no se importan): {r.sin_vehiculo.map(s => s.vehiculo).join(' · ')}
              </p>
            )}
            <div className="max-h-72 overflow-auto rounded border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted"><tr className="text-left"><th className="px-2 py-1">Vehículo</th><th className="px-2 py-1">Qué se registra</th><th className="px-2 py-1 text-right">Km actual</th></tr></thead>
                <tbody className="divide-y">
                  {r.filas.map(f => (
                    <tr key={`${f.hoja}-${f.fila}`}>
                      <td className="px-2 py-1 whitespace-nowrap"><b>{f.camion?.codigo}</b> <span className="text-muted-foreground">{f.vehiculo}</span></td>
                      <td className="px-2 py-1">
                        {f.acciones.length === 0 && <span className="text-muted-foreground">—</span>}
                        {f.acciones.map((a, i) => (
                          <div key={i} className={cn(a.estado === 'EXISTE' && 'text-muted-foreground')}>
                            {TIPO[a.tipo].corto}{a.fecha ? ` ${formatDate(a.fecha)}` : ''}{a.km != null ? ` a los ${km(a.km)}` : ''}{a.proximo_km ? ` → próxima ${km(a.proximo_km)}` : ''}{a.detalle ? ` · ${a.detalle}` : ''}{a.estado === 'EXISTE' ? ' (ya estaba)' : ''}
                          </div>
                        ))}
                      </td>
                      <td className="px-2 py-1 text-right tabular-nums">{f.km_actual != null ? f.km_actual.toLocaleString('es-AR') : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>{r?.aplicado ? 'Cerrar' : 'Cancelar'}</Button>
          {r && !r.aplicado && (r.nuevos > 0 || r.km_actualizados.length > 0) && archivo && <Button onClick={() => correr(archivo, true)} disabled={imp.isPending}>Importar</Button>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Pestaña ──────────────────────────────────────────────────────────────────
function Semaforo({ nivel, children }: { nivel: 'VENCIDA' | 'PROXIMA' | null; children: React.ReactNode }) {
  return <span className={cn('rounded px-1.5 py-0.5 text-xs', nivel === 'VENCIDA' ? 'bg-red-100 text-red-800' : nivel === 'PROXIMA' ? 'bg-amber-100 text-amber-800' : 'text-muted-foreground')}>{children}</span>;
}

export default function NeumaticosTab({ canEdit }: { canEdit: boolean }) {
  const { user } = useAuth();
  const esAdmin = user?.rol === 'ADMIN';
  const { data, isLoading } = useCambiosVehiculo();
  const eliminar = useEliminarCambio();
  const [dialogo, setDialogo] = useState<{ camion_id?: number; tipo?: TipoCambioVehiculo; cambio?: CambioVehiculo } | null>(null);
  const [importando, setImportando] = useState(false);
  const [abierto, setAbierto] = useState<number | null>(null);
  const [soloAtencion, setSoloAtencion] = useState(false);

  const vehiculos = data?.vehiculos ?? [];
  const filas = useMemo(() => vehiculos.filter(v => !soloAtencion || v.alerta_rotacion || v.alerta_bateria), [vehiculos, soloAtencion]);
  const nRotar = vehiculos.filter(v => v.alerta_rotacion).length;
  const nBat = vehiculos.filter(v => v.alerta_bateria).length;
  const cada = data?.rotacion_cada_km ?? 10000;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground max-w-2xl">
          Cubiertas, rotaciones y baterías de cada vehículo. La rotación se avisa por km (cada {cada.toLocaleString('es-AR')} km, salvo que se anote otra); el km actual sale de las cargas de combustible y de lo que se registra acá.
        </p>
        {canEdit && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setImportando(true)}><Upload size={14} className="mr-1.5" />Importar planilla</Button>
            <Button size="sm" onClick={() => setDialogo({})}><Plus size={14} className="mr-1.5" />Registrar</Button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className={cn('rounded-full border px-2.5 py-0.5', nRotar ? 'border-amber-300 bg-amber-50 text-amber-800' : 'text-muted-foreground')}>{nRotar} para rotar</span>
        <span className={cn('rounded-full border px-2.5 py-0.5', nBat ? 'border-amber-300 bg-amber-50 text-amber-800' : 'text-muted-foreground')}>{nBat} batería{nBat === 1 ? '' : 's'} por cambiar</span>
        <label className="flex items-center gap-2"><input type="checkbox" checked={soloAtencion} onChange={e => setSoloAtencion(e.target.checked)} />Sólo los que necesitan atención</label>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
      {data && (
        <BaseTable className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="px-3 py-2 w-6" /><th className="px-3 py-2">Vehículo</th><th className="px-3 py-2 text-right">Km actual</th>
              <th className="px-3 py-2">Cubiertas</th><th className="px-3 py-2">Rotación</th><th className="px-3 py-2">Batería</th>
              {canEdit && <th className="px-3 py-2 text-right">Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {filas.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">{soloAtencion ? 'Ningún vehículo necesita atención.' : 'No hay vehículos en servicio.'}</td></tr>}
            {filas.map(v => (
              <Fragment key={v.camion.id}>
                <tr className={cn((v.alerta_rotacion === 'VENCIDA' || v.alerta_bateria === 'VENCIDA') && 'bg-red-50/50')}>
                  <td className="px-3 py-2" data-label="">
                    {v.historial.length > 0 && (
                      <button onClick={() => setAbierto(abierto === v.camion.id ? null : v.camion.id)} aria-label="Ver historial" className="text-muted-foreground hover:text-foreground">
                        {abierto === v.camion.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>
                    )}
                  </td>
                  <td className="px-3 py-2" data-label="Vehículo"><div className="font-medium">{v.camion.codigo}</div>{v.camion.descripcion && <div className="text-xs text-muted-foreground">{v.camion.descripcion}</div>}</td>
                  <td className="px-3 py-2 text-right tabular-nums" data-label="Km actual">{v.km_actual != null ? v.km_actual.toLocaleString('es-AR') : '—'}</td>
                  <td className="px-3 py-2" data-label="Cubiertas">
                    {v.neumaticos ? <><div>{v.neumaticos.fecha ? formatDate(v.neumaticos.fecha) : <span className="text-muted-foreground">sin fecha</span>}</div>{v.neumaticos.detalle && <div className="text-xs text-muted-foreground max-w-56 truncate" title={v.neumaticos.detalle}>{v.neumaticos.detalle}</div>}</> : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2" data-label="Rotación">
                    {v.rotacion?.proxima_km != null ? (
                      <>
                        <div>a los {km(v.rotacion.proxima_km)}</div>
                        <Semaforo nivel={v.alerta_rotacion}>
                          {v.rotacion.faltan_km == null ? 'sin km actual' : v.rotacion.faltan_km <= 0 ? `pasada por ${km(-v.rotacion.faltan_km)}` : `faltan ${km(v.rotacion.faltan_km)}`}
                        </Semaforo>
                      </>
                    ) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2" data-label="Batería">
                    {v.bateria ? (
                      <>
                        <div>{v.bateria.fecha ? formatDate(v.bateria.fecha) : '—'}{v.bateria.detalle ? <span className="text-xs text-muted-foreground"> · {v.bateria.detalle}</span> : null}</div>
                        <Semaforo nivel={v.alerta_bateria}>
                          {v.bateria.proxima_fecha ? `cambiar el ${formatDate(v.bateria.proxima_fecha)}` : v.bateria.meses != null ? `hace ${v.bateria.meses < 1 ? 'menos de un mes' : `${v.bateria.meses} mes${v.bateria.meses === 1 ? '' : 'es'}`}` : ''}
                        </Semaforo>
                      </>
                    ) : <span className="text-muted-foreground">—</span>}
                  </td>
                  {canEdit && (
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <select value="" onChange={e => e.target.value && setDialogo({ camion_id: v.camion.id, tipo: e.target.value as TipoCambioVehiculo })} className="h-7 rounded border px-1 text-xs bg-white" aria-label="Registrar">
                        <option value="">Registrar…</option>
                        {(Object.keys(TIPO) as TipoCambioVehiculo[]).map(t => <option key={t} value={t}>{TIPO[t].label}</option>)}
                      </select>
                    </td>
                  )}
                </tr>
                {abierto === v.camion.id && (
                  <tr className="bg-muted/20">
                    <td />
                    <td colSpan={canEdit ? 6 : 5} className="px-3 py-2">
                      <div className="space-y-1">
                        {v.historial.map(h => (
                          <div key={h.id} className="flex items-center gap-3 text-xs">
                            <span className="w-20 font-medium">{TIPO[h.tipo].corto}</span>
                            <span className="w-20">{h.fecha ? formatDate(h.fecha) : 'sin fecha'}</span>
                            <span className="w-24 tabular-nums">{h.km != null ? km(h.km) : ''}</span>
                            <span className="flex-1 text-muted-foreground">
                              {[h.detalle, h.tipo !== 'BATERIA' && h.proximo_km ? `próxima a los ${km(h.proximo_km)}` : null, h.proxima_fecha ? `próximo cambio ${formatDate(h.proxima_fecha)}` : null, h.importe != null ? formatCurrency(h.importe) : null, h.proveedor, h.notas].filter(Boolean).join(' · ')}
                            </span>
                            {canEdit && <button title="Editar" onClick={() => setDialogo({ cambio: h })} className="p-1 rounded hover:bg-accent text-muted-foreground"><Pencil size={12} /></button>}
                            {esAdmin && <button title="Eliminar" onClick={() => { if (window.confirm('¿Eliminar este registro?')) eliminar.mutate(h.id, { onError: e => alert(getApiErrorMessage(e)) }); }} className="p-1 rounded hover:bg-destructive/10 text-destructive"><Trash2 size={12} /></button>}
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </BaseTable>
      )}

      {dialogo && <CambioDialog vehiculos={vehiculos} inicial={dialogo} onClose={() => setDialogo(null)} rotacionCada={cada} />}
      {importando && <ImportarDialog onClose={() => setImportando(false)} />}
    </div>
  );
}
