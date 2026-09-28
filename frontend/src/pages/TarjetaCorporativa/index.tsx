import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CreditCard, FileDown, IdCard, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import {
  useTarjetasCorporativas, usePeriodosTC, useConsumosTC, useCrearTarjetaTC, useCrearConsumoTC,
  useEditarConsumoTC, useEliminarConsumoTC, useImportarTC, useExportarPdfTC,
} from '@/hooks/useTarjetaCorporativa';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import MoneyInput from '@/components/ui/MoneyInput';
import BaseTable from '@/components/ui/BaseTable';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EMPRESAS } from '@/lib/empresasConstants';
import { fmtMoney, formatDate } from '@/lib/formatters';
import { cn, getApiErrorMessage } from '@/lib/utils';
import type { ConsumoTC, ImportarTCResultado, ResponsableTC, TarjetaCorporativa, TipoResponsableTC, TotalResponsableTC } from '@/types';

// Tarjeta Corporativa Galicia (DOS57 / Enjoy) — Santi. Replica la hoja mensual
// del Excel: bloque resumen por responsable arriba, detalle abajo. Los totales
// se calculan del detalle (el resumen del Excel tiene valores tipeados a mano).

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const selCls = 'border border-input rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring';
const labelCls = 'block text-xs font-medium text-muted-foreground mb-0.5';

const MARCA_MIXTO_RE = /\(MIXTO/i;
const sinAcentos = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

// "NO SE DESCONTO" primero: "SE DESCONTO" es substring del negativo.
function estadoDescuento(c: ConsumoTC): 'NO' | 'SI' | null {
  const obs = sinAcentos(c.observaciones ?? '').toUpperCase();
  if (/NO SE DESCONT/.test(obs)) return 'NO';
  if (c.descontado || /SE DESCONT/.test(obs)) return 'SI';
  return null;
}

// El tipo sólo se muestra en los responsables divididos (ANDRE PERSONAL / ANDRE EMPRESA).
function useEtiquetaResponsable(responsables: { nombre: string; tipo: TipoResponsableTC }[]) {
  return useMemo(() => {
    const tipos = new Map<string, Set<string>>();
    for (const r of responsables) {
      if (!tipos.has(r.nombre)) tipos.set(r.nombre, new Set());
      tipos.get(r.nombre)!.add(r.tipo);
    }
    return (nombre: string, tipo: TipoResponsableTC) =>
      (tipos.get(nombre)?.size ?? 0) > 1 || tipo === 'EMPRESA' ? `${nombre} ${tipo === 'EMPRESA' ? 'Empresa' : 'Personal'}` : nombre;
  }, [responsables]);
}

const ordenEmpresa = (id: number) => (id === EMPRESAS.DOS57 ? 0 : id === EMPRESAS.ENJOY ? 1 : 2);
const etiquetaEmpresa = (e: { id: number; nombre: string; nombre_corto: string | null }) =>
  e.id === EMPRESAS.DOS57 ? 'DOS57' : e.id === EMPRESAS.ENJOY ? 'Enjoy' : (e.nombre_corto ?? e.nombre);

// ── Importar (preview → confirmar) ────────────────────────────────────────────

function ImportarDialog({ empresas, empresaDefault, onClose }: {
  empresas: { id: number; nombre: string; nombre_corto: string | null }[]; empresaDefault: number; onClose: () => void;
}) {
  const importar = useImportarTC();
  const [file, setFile] = useState<File | null>(null);
  const [empresaId, setEmpresaId] = useState(empresaDefault);
  const [preview, setPreview] = useState<ImportarTCResultado | null>(null);
  const [final, setFinal] = useState<ImportarTCResultado | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setPreview(null); setError(null); }, [file, empresaId]);

  const correr = async (esPreview: boolean) => {
    if (!file) return;
    setError(null);
    try {
      const r = await importar.mutateAsync({ file, empresaId, preview: esPreview });
      if (esPreview) setPreview(r); else setFinal(r);
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  const r = final ?? preview;
  const advertencias = r?.hojas.flatMap(h => h.advertencias.map(a => `${h.hoja}: ${a}`)) ?? [];
  const mixtos = r?.hojas.reduce((s, h) => s + h.mixtos, 0) ?? 0;

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Importar tarjeta corporativa desde Excel</DialogTitle></DialogHeader>
        <div className="space-y-3 mt-1 text-sm">
          {!final && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Empresa</label>
                <select value={empresaId} onChange={e => setEmpresaId(Number(e.target.value))} className={cn(selCls, 'w-full')}>
                  {empresas.map(e => <option key={e.id} value={e.id}>{etiquetaEmpresa(e)}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Archivo (.xlsx)</label>
                <input type="file" accept=".xlsx" className="text-sm w-full" onChange={e => setFile(e.target.files?.[0] ?? null)} />
              </div>
            </div>
          )}

          {r && (
            <div className="space-y-2 rounded-md border border-border p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {final ? '✓ Importación realizada' : 'Vista previa — todavía no se guardó nada'}
              </p>
              <p>
                {r.tarjeta.nombre} · meses detectados: <span className="font-medium">{r.meses_detectados}</span>
                {' '}(con datos: <span className="font-medium">{r.meses_con_datos}</span>)
              </p>
              <p>
                Consumos {final ? 'creados' : 'a crear'}: <span className="font-medium text-green-700">{r.creados}</span>
                {' · '}{final ? 'actualizados' : 'a actualizar'}: <span className="font-medium">{r.actualizados}</span>
                {r.eliminados > 0 && <>{' · '}{final ? 'dados de baja' : 'a dar de baja'} (ya no están en el Excel): <span className="font-medium text-red-700">{r.eliminados}</span></>}
              </p>
              <table className="w-full text-xs">
                <thead className="text-muted-foreground">
                  <tr><th className="text-left py-1">Mes</th><th className="text-right">Consumos</th><th className="text-right">Total $</th><th className="text-right">Total USD</th></tr>
                </thead>
                <tbody className="divide-y">
                  {r.hojas.map(h => (
                    <tr key={h.hoja} className={cn(h.consumos === 0 && 'text-muted-foreground')}>
                      <td className="py-1">{h.mes ? `${MESES[h.mes - 1]} ${h.anio}` : h.hoja}</td>
                      <td className="text-right">{h.consumos || '—'}</td>
                      <td className="text-right">{h.consumos ? fmtMoney(h.total_ars) : ''}</td>
                      <td className="text-right">{h.total_usd ? fmtMoney(h.total_usd, 'USD') : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {r.responsables_nuevos.length > 0 && (
                <p className="text-xs">Responsables nuevos: <span className="font-medium">{r.responsables_nuevos.join(', ')}</span></p>
              )}
              {mixtos > 0 && (
                <div className="rounded bg-amber-50 text-amber-800 p-2 text-xs">
                  {mixtos} consumo(s) marcados "PERSONAL Y EMPRESA" en el Excel se imputan a la parte Empresa con la observación
                  "(MIXTO – revisar)" — el reparto real no figura en la planilla; editalos o dividilos a mano.
                </div>
              )}
              {advertencias.length > 0 && (
                <details className="rounded bg-muted/40 p-2 text-xs">
                  <summary className="cursor-pointer font-medium">Avisos ({advertencias.length})</summary>
                  <ul className="list-disc pl-4 mt-1 space-y-0.5">{advertencias.map((a, i) => <li key={i}>{a}</li>)}</ul>
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

// ── Alta / edición de consumo ─────────────────────────────────────────────────

const NUEVO = '__nuevo__';

function ConsumoDialog({ tarjeta, consumo, mes, anio, onClose }: {
  tarjeta: TarjetaCorporativa; consumo: ConsumoTC | null; mes: number; anio: number; onClose: () => void;
}) {
  const crear = useCrearConsumoTC();
  const editar = useEditarConsumoTC();
  const etiqueta = useEtiquetaResponsable(tarjeta.responsables);
  const [responsableSel, setResponsableSel] = useState<string>(consumo ? String(consumo.responsable_id) : (tarjeta.responsables[0] ? String(tarjeta.responsables[0].id) : NUEVO));
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoTipo, setNuevoTipo] = useState<TipoResponsableTC>('PERSONAL');
  const hoy = new Date().toISOString().slice(0, 10);
  const [fecha, setFecha] = useState(consumo ? consumo.fecha.slice(0, 10) : hoy);
  const [periodoMes, setPeriodoMes] = useState(consumo?.periodo_mes ?? mes);
  const [periodoAnio, setPeriodoAnio] = useState(consumo?.periodo_anio ?? anio);
  const [ars, setArs] = useState(consumo?.monto_ars != null ? String(consumo.monto_ars) : '');
  const [usd, setUsd] = useState(consumo?.monto_usd != null ? String(consumo.monto_usd) : '');
  const [detalle, setDetalle] = useState(consumo?.detalle ?? '');
  const [observaciones, setObservaciones] = useState(consumo?.observaciones ?? '');
  const [empresaImputa, setEmpresaImputa] = useState(consumo?.empresa_imputa ?? '');
  const [descontado, setDescontado] = useState(consumo?.descontado ?? false);
  const [error, setError] = useState<string | null>(null);

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!ars && !usd) { setError('Indicá un monto en $ o en USD'); return; }
    if (responsableSel === NUEVO && !nuevoNombre.trim()) { setError('Indicá el nombre del responsable'); return; }
    const data = {
      ...(responsableSel === NUEVO
        ? { responsable_nombre: nuevoNombre.trim(), responsable_tipo: nuevoTipo }
        : { responsable_id: Number(responsableSel) }),
      fecha,
      periodo_mes:    periodoMes,
      periodo_anio:   periodoAnio,
      monto_ars:      ars ? Number(ars) : null,
      monto_usd:      usd ? Number(usd) : null,
      detalle:        detalle || null,
      observaciones:  observaciones || null,
      empresa_imputa: empresaImputa || null,
      descontado,
    };
    try {
      if (consumo) await editar.mutateAsync({ id: consumo.id, data });
      else await crear.mutateAsync({ tarjetaId: tarjeta.id, data });
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  const pending = crear.isPending || editar.isPending;

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>{consumo ? 'Editar consumo' : 'Nuevo consumo'} — {tarjeta.nombre}</DialogTitle></DialogHeader>
        <form onSubmit={guardar} className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div className={cn(responsableSel === NUEVO ? 'col-span-2' : 'col-span-1')}>
              <label className={labelCls}>Responsable</label>
              <select value={responsableSel} onChange={e => setResponsableSel(e.target.value)} className={cn(selCls, 'w-full')}>
                {tarjeta.responsables.map((r: ResponsableTC) => <option key={r.id} value={r.id}>{etiqueta(r.nombre, r.tipo)}</option>)}
                <option value={NUEVO}>+ Nuevo responsable…</option>
              </select>
              {responsableSel === NUEVO && (
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <Input value={nuevoNombre} onChange={e => setNuevoNombre(e.target.value)} placeholder="Nombre (ej. POLLO)" />
                  <select value={nuevoTipo} onChange={e => setNuevoTipo(e.target.value as TipoResponsableTC)} className={selCls}>
                    <option value="PERSONAL">Personal</option>
                    <option value="EMPRESA">Empresa</option>
                  </select>
                </div>
              )}
            </div>
            <div>
              <label className={labelCls}>Fecha</label>
              <Input type="date" value={fecha} onChange={e => setFecha(e.target.value)} required />
            </div>
            <div>
              <label className={labelCls}>Monto $</label>
              <MoneyInput value={ars} onChange={setArs} placeholder="0,00" />
            </div>
            <div>
              <label className={labelCls}>Monto USD</label>
              <MoneyInput value={usd} onChange={setUsd} placeholder="0,00" />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Detalle</label>
              <Input value={detalle} onChange={e => setDetalle(e.target.value)} placeholder="Texto del resumen del banco" />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Observaciones</label>
              <Input value={observaciones} onChange={e => setObservaciones(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Empresa (imputación)</label>
              <Input value={empresaImputa} onChange={e => setEmpresaImputa(e.target.value)} placeholder="DOS57 / ENJOY / PERSONAL" />
            </div>
            <div>
              <label className={labelCls}>Período (resumen)</label>
              <div className="flex gap-1">
                <select value={periodoMes} onChange={e => setPeriodoMes(Number(e.target.value))} className={cn(selCls, 'flex-1')}>
                  {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                </select>
                <Input type="number" value={periodoAnio} onChange={e => setPeriodoAnio(Number(e.target.value))} className="w-20" />
              </div>
            </div>
            <label className="col-span-2 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={descontado} onChange={e => setDescontado(e.target.checked)} />
              Se descontó al responsable
            </label>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={pending}>{pending ? 'Guardando…' : 'Guardar'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Bloque resumen (cards por responsable, igual al Excel) ───────────────────

function ResumenCards({ porResponsable, totalArs, totalUsd, filtro, onFiltro, etiqueta }: {
  porResponsable: TotalResponsableTC[]; totalArs: number; totalUsd: number;
  filtro: number | null; onFiltro: (id: number | null) => void;
  etiqueta: (nombre: string, tipo: TipoResponsableTC) => string;
}) {
  // Agrupa por nombre: ANDRE Personal + ANDRE Empresa en un mismo card con total combinado.
  const grupos = useMemo(() => {
    const m = new Map<string, TotalResponsableTC[]>();
    for (const r of porResponsable) {
      if (!m.has(r.nombre)) m.set(r.nombre, []);
      m.get(r.nombre)!.push(r);
    }
    return [...m.entries()];
  }, [porResponsable]);

  const linea = (r: TotalResponsableTC) => (
    <div className="space-y-0.5 text-sm">
      <p>ARS: <span className="font-semibold tabular-nums">{fmtMoney(r.total_ars)}</span></p>
      <p className="text-muted-foreground">USD: <span className="font-medium tabular-nums">{fmtMoney(r.total_usd, 'USD')}</span></p>
    </div>
  );

  return (
    <div className="flex flex-col lg:flex-row gap-3">
      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {grupos.map(([nombre, partes]) => {
          const seleccionado = partes.some(p => p.responsable_id === filtro);
          const cardCls = cn('rounded-lg border bg-white p-3 shadow-sm transition-colors', seleccionado ? 'border-primary ring-1 ring-primary' : 'border-border');
          if (partes.length === 1) {
            const r = partes[0];
            return (
              <button key={nombre} type="button" onClick={() => onFiltro(seleccionado ? null : r.responsable_id)} className={cn(cardCls, 'text-left hover:border-primary/60')}>
                <p className="flex items-center gap-1.5 font-semibold mb-1"><IdCard size={16} className="text-muted-foreground" /> {etiqueta(r.nombre, r.tipo)}</p>
                {linea(r)}
                <p className="text-[11px] text-muted-foreground mt-1">{r.consumos} consumo{r.consumos !== 1 ? 's' : ''}</p>
              </button>
            );
          }
          const combArs = partes.reduce((s, p) => s + p.total_ars, 0);
          const combUsd = partes.reduce((s, p) => s + p.total_usd, 0);
          return (
            <div key={nombre} className={cn(cardCls, 'sm:col-span-2')}>
              <p className="flex items-center gap-1.5 font-semibold mb-2"><IdCard size={16} className="text-muted-foreground" /> {nombre}</p>
              <div className="grid grid-cols-3 gap-2">
                {partes.map(p => (
                  <button key={p.responsable_id} type="button" onClick={() => onFiltro(filtro === p.responsable_id ? null : p.responsable_id)}
                    className={cn('rounded-md border p-2 text-left hover:border-primary/60', filtro === p.responsable_id ? 'border-primary bg-primary/5' : 'border-border')}>
                    <p className="text-xs font-medium text-muted-foreground mb-0.5">{p.tipo === 'EMPRESA' ? 'Empresa' : 'Personal'}</p>
                    {linea(p)}
                  </button>
                ))}
                <div className="rounded-md bg-muted/40 p-2">
                  <p className="text-xs font-medium text-muted-foreground mb-0.5">Total combinado</p>
                  <div className="space-y-0.5 text-sm">
                    <p>ARS: <span className="font-semibold tabular-nums">{fmtMoney(combArs)}</span></p>
                    <p className="text-muted-foreground">USD: <span className="font-medium tabular-nums">{fmtMoney(combUsd, 'USD')}</span></p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="lg:w-64 rounded-lg border border-border bg-muted/30 p-4 flex flex-col justify-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total del período</p>
        <p className="text-2xl font-bold tabular-nums mt-1">{fmtMoney(totalArs)}</p>
        <p className="text-sm text-muted-foreground tabular-nums">{fmtMoney(totalUsd, 'USD')}</p>
      </div>
    </div>
  );
}

// ── Contenido de una tarjeta (tab) ───────────────────────────────────────────

function TarjetaPanel({ tarjeta, onNuevo, onEditar, pdfRef }: {
  tarjeta: TarjetaCorporativa;
  onNuevo: (mes: number, anio: number) => void;
  onEditar: (c: ConsumoTC, mes: number, anio: number) => void;
  pdfRef: (fn: { exportar: () => void; isExporting: boolean; vacio: boolean }) => void;
}) {
  const hoy = new Date();
  const { data: periodos } = usePeriodosTC(tarjeta.id);
  const [periodo, setPeriodo] = useState<{ mes: number; anio: number } | null>(null);
  const [filtro, setFiltro] = useState<number | null>(null);

  // Arranca en el último mes con consumos (o el mes actual si no hay datos).
  useEffect(() => {
    if (periodo || !periodos) return;
    const ultimo = periodos[periodos.length - 1];
    setPeriodo(ultimo ? { mes: ultimo.mes, anio: ultimo.anio } : { mes: hoy.getMonth() + 1, anio: hoy.getFullYear() });
  }, [periodos]); // eslint-disable-line react-hooks/exhaustive-deps

  const mes = periodo?.mes ?? hoy.getMonth() + 1;
  const anio = periodo?.anio ?? hoy.getFullYear();
  const { data, isLoading, error } = useConsumosTC(periodo ? tarjeta.id : null, mes, anio);
  const eliminar = useEliminarConsumoTC();
  const { exportar, isExporting } = useExportarPdfTC();
  const etiqueta = useEtiquetaResponsable(tarjeta.responsables);

  useEffect(() => { setFiltro(null); }, [mes, anio]);
  useEffect(() => {
    pdfRef({ exportar: () => { void exportar(tarjeta.id, mes, anio); }, isExporting, vacio: !data || data.consumos.length === 0 });
  }, [tarjeta.id, mes, anio, isExporting, data]); // eslint-disable-line react-hooks/exhaustive-deps

  const mover = (delta: number) => {
    const d = new Date(Date.UTC(anio, mes - 1 + delta, 1));
    setPeriodo({ mes: d.getUTCMonth() + 1, anio: d.getUTCFullYear() });
  };

  const consumos = (data?.consumos ?? []).filter(c => filtro == null || c.responsable_id === filtro);
  const conDatos = new Set((periodos ?? []).map(p => `${p.anio}-${p.mes}`));

  const borrar = async (c: ConsumoTC) => {
    if (!window.confirm(`¿Eliminar el consumo "${c.detalle ?? ''}" de ${formatDate(c.fecha)}?`)) return;
    try { await eliminar.mutateAsync(c.id); } catch (err) { window.alert(getApiErrorMessage(err)); }
  };

  const th = 'px-2 py-2 text-xs font-medium text-muted-foreground whitespace-nowrap';
  const td = 'px-2 py-1.5 text-sm';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button size="sm" variant="outline" onClick={() => mover(-1)} aria-label="Mes anterior"><ChevronLeft size={16} /></Button>
          <div className="min-w-[170px] text-center font-semibold">
            {MESES[mes - 1]} {anio}
            {!conDatos.has(`${anio}-${mes}`) && <span className="block text-[11px] font-normal text-muted-foreground">sin consumos</span>}
          </div>
          <Button size="sm" variant="outline" onClick={() => mover(1)} aria-label="Mes siguiente"><ChevronRight size={16} /></Button>
        </div>
        <Button size="sm" variant="outline" onClick={() => onNuevo(mes, anio)}>
          <Plus size={14} className="mr-1.5" /> Nuevo consumo
        </Button>
      </div>

      {isLoading || !periodo ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : error ? (
        <p className="text-sm text-destructive">{getApiErrorMessage(error)}</p>
      ) : !data || data.consumos.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-white p-10 text-center">
          <CreditCard size={32} className="mx-auto text-muted-foreground/60 mb-2" />
          <p className="text-sm font-medium">Sin consumos en {MESES[mes - 1]} {anio}.</p>
          {(periodos?.length ?? 0) > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              Hay datos de {periodos!.slice(-6).map(p => `${MESES[p.mes - 1].slice(0, 3)} ${p.anio}`).join(', ')}.
            </p>
          )}
        </div>
      ) : (
        <>
          <ResumenCards porResponsable={data.por_responsable} totalArs={data.total_ars} totalUsd={data.total_usd}
            filtro={filtro} onFiltro={setFiltro} etiqueta={etiqueta} />

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground mr-1">Filtrar:</span>
            <button type="button" onClick={() => setFiltro(null)}
              className={cn('rounded-full border px-3 py-1 text-xs', filtro == null ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-white hover:bg-muted/40')}>
              Todos ({data.consumos.length})
            </button>
            {data.por_responsable.map(r => (
              <button key={r.responsable_id} type="button" onClick={() => setFiltro(filtro === r.responsable_id ? null : r.responsable_id)}
                className={cn('rounded-full border px-3 py-1 text-xs', filtro === r.responsable_id ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-white hover:bg-muted/40')}>
                {etiqueta(r.nombre, r.tipo)} ({r.consumos})
              </button>
            ))}
          </div>

          <div className="overflow-x-auto">
            <BaseTable className="w-full text-sm min-w-[1100px]">
              <thead>
                <tr>
                  <th className={cn(th, 'text-left')}>Responsable</th>
                  <th className={cn(th, 'text-left')}>Fecha</th>
                  <th className={cn(th, 'text-right')}>Monto $</th>
                  <th className={cn(th, 'text-right')}>Monto USD</th>
                  <th className={cn(th, 'text-left')}>Detalle</th>
                  <th className={cn(th, 'text-left')}>Observaciones</th>
                  <th className={cn(th, 'text-left')}>Empresa</th>
                  <th className={cn(th, 'text-left')}>Descontado</th>
                  <th className={th} />
                </tr>
              </thead>
              <tbody>
                {consumos.map(c => {
                  const desc = estadoDescuento(c);
                  return (
                    <tr key={c.id}>
                      <td className={cn(td, 'font-medium whitespace-nowrap')}>{etiqueta(c.responsable.nombre, c.responsable.tipo)}</td>
                      <td className={cn(td, 'whitespace-nowrap')}>{formatDate(c.fecha)}</td>
                      <td className={cn(td, 'text-right tabular-nums whitespace-nowrap', (c.monto_ars ?? 0) < 0 && 'text-green-700')}>
                        {c.monto_ars != null ? fmtMoney(c.monto_ars) : ''}
                      </td>
                      <td className={cn(td, 'text-right tabular-nums whitespace-nowrap')}>{c.monto_usd != null ? fmtMoney(c.monto_usd, 'USD') : ''}</td>
                      <td className={cn(td, 'max-w-[240px]')}>{c.detalle}</td>
                      <td className={cn(td, 'max-w-[320px] text-xs text-muted-foreground')}>
                        {c.observaciones}
                        {c.observaciones && MARCA_MIXTO_RE.test(c.observaciones) && <Badge variant="warning" className="ml-1">Mixto</Badge>}
                      </td>
                      <td className={cn(td, 'text-xs whitespace-nowrap')}>{c.empresa_imputa}</td>
                      <td className={td}>
                        {desc === 'SI' && <Badge variant="destructive">Descontado</Badge>}
                        {desc === 'NO' && <Badge variant="muted">No descontado</Badge>}
                      </td>
                      <td className={cn(td, 'whitespace-nowrap text-right')}>
                        <button type="button" title="Editar" onClick={() => onEditar(c, mes, anio)} className="p-1 text-muted-foreground hover:text-foreground"><Pencil size={14} /></button>
                        <button type="button" title="Eliminar" onClick={() => borrar(c)} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="font-semibold">
                  <td className={td} colSpan={2}>{filtro == null ? 'Total período' : 'Subtotal'}</td>
                  <td className={cn(td, 'text-right tabular-nums')}>{fmtMoney(consumos.reduce((s, c) => s + (c.monto_ars ?? 0), 0))}</td>
                  <td className={cn(td, 'text-right tabular-nums')}>{fmtMoney(consumos.reduce((s, c) => s + (c.monto_usd ?? 0), 0), 'USD')}</td>
                  <td className={td} colSpan={5} />
                </tr>
              </tfoot>
            </BaseTable>
          </div>
        </>
      )}
    </div>
  );
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function TarjetaCorporativaPage() {
  const { data, isLoading, error } = useTarjetasCorporativas();
  const crearTarjeta = useCrearTarjetaTC();
  const [empresaTab, setEmpresaTab] = useState<number | null>(null);
  const [importarOpen, setImportarOpen] = useState(false);
  const [dialogConsumo, setDialogConsumo] = useState<{ consumo: ConsumoTC | null; mes: number; anio: number } | null>(null);
  const [pdf, setPdf] = useState<{ exportar: () => void; isExporting: boolean; vacio: boolean } | null>(null);

  const empresas = useMemo(() => [...(data?.empresas ?? [])].sort((a, b) => ordenEmpresa(a.id) - ordenEmpresa(b.id)), [data]);
  useEffect(() => { if (empresaTab == null && empresas.length) setEmpresaTab(empresas[0].id); }, [empresas, empresaTab]);

  const tarjeta = data?.tarjetas.find(t => t.empresa_id === empresaTab) ?? null;
  useEffect(() => { if (!tarjeta) setPdf(null); }, [tarjeta]);

  return (
    <div className="p-6 space-y-4 max-w-[1400px] mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><CreditCard size={22} /> Tarjeta Corporativa</h1>
          <p className="text-xs text-muted-foreground">Consumos mensuales por responsable (TC Galicia) — totales calculados del detalle.</p>
        </div>
        <div className="flex items-center gap-2">
          {tarjeta && (
            <Button size="sm" variant="outline" disabled={!pdf || pdf.isExporting || pdf.vacio} onClick={() => pdf?.exportar()}
              title={pdf?.vacio ? 'No hay consumos en el mes para exportar' : 'PDF del mes seleccionado'}>
              <FileDown size={14} className="mr-1.5" /> {pdf?.isExporting ? 'Exportando…' : 'Exportar PDF'}
            </Button>
          )}
          <Button size="sm" variant="outline" disabled={!empresas.length} onClick={() => setImportarOpen(true)}>
            <Upload size={14} className="mr-1.5" /> Importar desde Excel
          </Button>
        </div>
      </div>

      {empresas.length > 1 && (
        <div className="flex border-b border-border overflow-x-auto">
          {empresas.map(e => (
            <button key={e.id} onClick={() => setEmpresaTab(e.id)}
              className={cn(
                'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap',
                empresaTab === e.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground',
              )}>
              {etiquetaEmpresa(e)}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : error ? (
        <p className="text-sm text-destructive">{getApiErrorMessage(error)}</p>
      ) : !tarjeta ? (
        <div className="rounded-lg border border-dashed border-border bg-white p-10 text-center space-y-2">
          <CreditCard size={32} className="mx-auto text-muted-foreground/60" />
          <p className="text-sm font-medium">Todavía no hay tarjeta corporativa cargada para esta empresa.</p>
          <p className="text-xs text-muted-foreground">Importá la planilla de Santi o creala vacía para cargar consumos a mano.</p>
          <div className="flex justify-center gap-2 pt-2">
            <Button size="sm" variant="outline" onClick={() => setImportarOpen(true)}><Upload size={14} className="mr-1.5" /> Importar desde Excel</Button>
            <Button size="sm" disabled={crearTarjeta.isPending || empresaTab == null} onClick={() => empresaTab != null && crearTarjeta.mutate(empresaTab)}>
              <Plus size={14} className="mr-1.5" /> Crear tarjeta
            </Button>
          </div>
        </div>
      ) : (
        <TarjetaPanel key={tarjeta.id} tarjeta={tarjeta}
          onNuevo={(mes, anio) => setDialogConsumo({ consumo: null, mes, anio })}
          onEditar={(c, mes, anio) => setDialogConsumo({ consumo: c, mes, anio })}
          pdfRef={setPdf} />
      )}

      {importarOpen && empresaTab != null && (
        <ImportarDialog empresas={empresas} empresaDefault={empresaTab} onClose={() => setImportarOpen(false)} />
      )}
      {dialogConsumo && tarjeta && (
        <ConsumoDialog tarjeta={tarjeta} consumo={dialogConsumo.consumo} mes={dialogConsumo.mes} anio={dialogConsumo.anio}
          onClose={() => setDialogConsumo(null)} />
      )}
    </div>
  );
}
