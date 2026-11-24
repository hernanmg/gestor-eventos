import { useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus, Pencil, Trash2, FileUp, CheckCircle2, AlertTriangle, ExternalLink } from 'lucide-react';
import {
  useAgendaPagosFijos, useConceptosPagoFijo, useGuardarConcepto, useEliminarConcepto, useRegistrarMes, useImportarPagosFijos,
} from '@/hooks/usePagosFijos';
import { useCuentasEmpresa } from '@/hooks/useCaja';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import MoneyInput from '@/components/ui/MoneyInput';
import BaseTable from '@/components/ui/BaseTable';
import PageHeader from '@/components/ui/PageHeader';
import { formatDate, formatCurrency } from '@/lib/formatters';
import { cn, getApiErrorMessage } from '@/lib/utils';
import type { EstadoPagoFijo, ImportPagosFijosResultado, Moneda, PagoFijoConcepto, PagoFijoFila } from '@/types';

// Agenda de pagos fijos del mes (Finanzas, punto 17): lo que se paga todos los
// meses, con su vencimiento, medio y estado — la PLANILLA PAGOS MENSUALES
// TOTALES de Mayra. Abajo, lo que vence en el mes desde otros módulos (AFIP,
// créditos, espacios compartidos).

const inputCls  = 'w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring';
const labelCls  = 'block text-xs font-medium text-muted-foreground mb-0.5';
const selectCls = 'w-full border border-input rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring bg-white';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
function periodoHoy() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function moverPeriodo(p: string, delta: number) {
  const [a, m] = p.split('-').map(Number);
  const d = new Date(a, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
const nombrePeriodo = (p: string) => `${MESES[Number(p.slice(5)) - 1]} ${p.slice(0, 4)}`;
function hoyISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const isoDia = (s: string | null) => (s ? s.slice(0, 10) : '');

const ESTADO: Record<EstadoPagoFijo, { label: string; variant: 'warning' | 'success' | 'info' | 'muted' }> = {
  PENDIENTE:      { label: 'Pendiente',      variant: 'warning' },
  PAGADO:         { label: 'Pagado',         variant: 'success' },
  DEBITADO:       { label: 'Debitado',       variant: 'success' },
  A_FAVOR:        { label: 'A favor',        variant: 'info' },
  NO_CORRESPONDE: { label: 'No corresponde', variant: 'muted' },
};

function EstadoPill({ fila }: { fila: Pick<PagoFijoFila, 'estado' | 'vencido'> }) {
  if (fila.vencido) return <Badge variant="destructive">Vencido</Badge>;
  return <Badge variant={ESTADO[fila.estado].variant}>{ESTADO[fila.estado].label}</Badge>;
}

// ── Cuentas de Caja Global (sin evento) ──────────────────────────────────────
function useCuentasCaja() {
  const { data } = useCuentasEmpresa({ estado: 'ABIERTA' });
  return useMemo(() => (data ?? []).filter(c => c.evento_id == null), [data]);
}

// ── Registrar el pago del mes ────────────────────────────────────────────────
function RegistrarDialog({ fila, periodo, onClose }: { fila: PagoFijoFila; periodo: string; onClose: () => void }) {
  const registrar = useRegistrarMes();
  const cuentas = useCuentasCaja();
  const [estado, setEstado]         = useState<EstadoPagoFijo>(fila.estado === 'PENDIENTE' ? (/d[eé]bito/i.test(fila.medio_pago ?? '') ? 'DEBITADO' : 'PAGADO') : fila.estado);
  const [monto, setMonto]           = useState(fila.monto != null ? String(fila.monto) : '');
  const [vencimiento, setVenc]      = useState(isoDia(fila.vencimiento));
  const [fechaPago, setFechaPago]   = useState(isoDia(fila.fecha_pago) || hoyISO());
  const [medio, setMedio]           = useState(fila.medio_pago ?? '');
  const [notas, setNotas]           = useState(fila.notas ?? '');
  // Si ya estaba asentado en la caja se mantiene; si no, se propone la cuenta habitual.
  const [asentar, setAsentar]       = useState(fila.movimiento_caja_id != null || (fila.mes_id == null && fila.cuenta_id != null));
  const [cuentaId, setCuentaId]     = useState(String(fila.cuenta_id ?? ''));
  const [error, setError]           = useState('');
  const pagado = estado === 'PAGADO' || estado === 'DEBITADO';
  const cuentasMoneda = cuentas.filter(c => c.moneda === fila.moneda);

  const guardar = async () => {
    setError('');
    if (pagado && asentar && !cuentaId) { setError('Elegí la cuenta de la que salió'); return; }
    if (pagado && asentar && !monto) { setError('Para asentarlo en la caja hace falta el monto'); return; }
    try {
      await registrar.mutateAsync({
        id: fila.pago_fijo_id, periodo,
        data: {
          estado, monto: monto === '' ? null : Number(monto), vencimiento: vencimiento || null,
          fecha_pago: pagado ? fechaPago : null, medio_pago: medio || null, notas: notas || null,
          cuenta_id: pagado && asentar ? Number(cuentaId) : null,
        },
      });
      onClose();
    } catch (e) { setError(getApiErrorMessage(e)); }
  };

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{fila.nombre} · {nombrePeriodo(periodo)}</DialogTitle></DialogHeader>
        {fila.referencia && <p className="text-xs text-muted-foreground -mt-2">{fila.referencia}</p>}
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className={labelCls}>Estado</label>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(ESTADO) as EstadoPagoFijo[]).map(e => (
                <button key={e} type="button" onClick={() => setEstado(e)}
                  className={cn('rounded-full border px-3 py-1 text-xs', estado === e ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted')}>
                  {ESTADO[e].label}
                </button>
              ))}
            </div>
          </div>
          <div><label className={labelCls}>Monto ({fila.moneda})</label><MoneyInput value={monto} onChange={setMonto} className={inputCls} placeholder={fila.monto_estimado != null ? `habitual ${fila.monto_estimado}` : ''} /></div>
          <div><label className={labelCls}>Vence</label><input type="date" value={vencimiento} onChange={e => setVenc(e.target.value)} className={inputCls} /></div>
          {pagado && <div><label className={labelCls}>Fecha de pago</label><input type="date" value={fechaPago} onChange={e => setFechaPago(e.target.value)} className={inputCls} /></div>}
          <div className={pagado ? '' : 'col-span-2'}><label className={labelCls}>Medio de pago</label><input value={medio} onChange={e => setMedio(e.target.value)} className={inputCls} placeholder="Débito en cuenta Galicia, VEP…" /></div>
          {pagado && (
            <div className="col-span-2 rounded border p-2.5 space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={asentar} onChange={e => setAsentar(e.target.checked)} />
                Asentar el gasto en Caja Global
              </label>
              {asentar && (
                <select value={cuentaId} onChange={e => setCuentaId(e.target.value)} className={selectCls}>
                  <option value="">— Cuenta de la que salió —</option>
                  {cuentasMoneda.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              )}
              {!asentar && fila.movimiento_caja_id != null && <p className="text-xs text-amber-700">Se va a borrar el gasto que estaba asentado en la caja.</p>}
            </div>
          )}
          {!pagado && fila.movimiento_caja_id != null && <p className="col-span-2 text-xs text-amber-700">Estaba asentado en la caja: al guardar se borra ese gasto.</p>}
          <div className="col-span-2"><label className={labelCls}>Notas</label><input value={notas} onChange={e => setNotas(e.target.value)} className={inputCls} /></div>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={guardar} disabled={registrar.isPending}>{registrar.isPending ? 'Guardando…' : 'Guardar'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Alta / edición del pago fijo ─────────────────────────────────────────────
function ConceptoDialog({ concepto, grupos, onClose }: { concepto: PagoFijoConcepto | null; grupos: string[]; onClose: () => void }) {
  const guardar = useGuardarConcepto();
  const eliminar = useEliminarConcepto();
  const cuentas = useCuentasCaja();
  const [f, setF] = useState({
    grupo: concepto?.grupo ?? 'Empresa', nombre: concepto?.nombre ?? '', referencia: concepto?.referencia ?? '',
    medio_pago: concepto?.medio_pago ?? '', cuenta_id: String(concepto?.cuenta_id ?? ''),
    dia_vencimiento: concepto?.dia_vencimiento ? String(concepto.dia_vencimiento) : '',
    monto_estimado: concepto?.monto_estimado != null ? String(concepto.monto_estimado) : '',
    moneda: (concepto?.moneda ?? 'ARS') as Moneda, activo: concepto?.activo ?? true, notas: concepto?.notas ?? '',
  });
  const [error, setError] = useState('');
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF(p => ({ ...p, [k]: e.target.value }));

  const submit = async () => {
    setError('');
    if (!f.nombre.trim()) { setError('Poné qué se paga'); return; }
    const dia = f.dia_vencimiento ? Number(f.dia_vencimiento) : null;
    if (dia != null && (dia < 1 || dia > 31)) { setError('El día de vencimiento va de 1 a 31'); return; }
    try {
      await guardar.mutateAsync({
        id: concepto?.id,
        data: {
          grupo: f.grupo.trim() || 'Empresa', nombre: f.nombre.trim(), referencia: f.referencia.trim() || null,
          medio_pago: f.medio_pago.trim() || null, cuenta_id: f.cuenta_id ? Number(f.cuenta_id) : null,
          dia_vencimiento: dia, monto_estimado: f.monto_estimado === '' ? null : Number(f.monto_estimado),
          moneda: f.moneda, activo: f.activo, notas: f.notas.trim() || null,
        },
      });
      onClose();
    } catch (e) { setError(getApiErrorMessage(e)); }
  };
  const borrar = async () => {
    if (!concepto || !confirm(`¿Eliminar "${concepto.nombre}"? Si ya tiene pagos registrados, deja de aparecer pero el historial queda.`)) return;
    try { await eliminar.mutateAsync(concepto.id); onClose(); } catch (e) { setError(getApiErrorMessage(e)); }
  };

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{concepto ? 'Editar pago fijo' : 'Nuevo pago fijo'}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className={labelCls}>Qué se paga</label><input value={f.nombre} onChange={set('nombre')} className={inputCls} placeholder="EPEC, expensas nave 15, F.931…" autoFocus /></div>
          <div>
            <label className={labelCls}>Grupo</label>
            <input value={f.grupo} onChange={set('grupo')} className={inputCls} list="grupos-pf" />
            <datalist id="grupos-pf">{grupos.map(g => <option key={g} value={g} />)}</datalist>
          </div>
          <div><label className={labelCls}>N° de cliente / contrato</label><input value={f.referencia} onChange={set('referencia')} className={inputCls} placeholder="Sin usuarios ni claves" /></div>
          <div><label className={labelCls}>Vence el día</label><input type="number" min={1} max={31} value={f.dia_vencimiento} onChange={set('dia_vencimiento')} className={inputCls} placeholder="10" /></div>
          <div className="grid grid-cols-[1fr_auto] gap-1.5">
            <div><label className={labelCls}>Monto habitual</label><MoneyInput value={f.monto_estimado} onChange={v => setF(p => ({ ...p, monto_estimado: v }))} className={inputCls} placeholder="variable" /></div>
            <div><label className={labelCls}>&nbsp;</label><select value={f.moneda} onChange={set('moneda')} className={selectCls}><option>ARS</option><option>USD</option></select></div>
          </div>
          <div><label className={labelCls}>Medio de pago</label><input value={f.medio_pago} onChange={set('medio_pago')} className={inputCls} placeholder="Débito en cuenta Galicia" /></div>
          <div>
            <label className={labelCls}>Sale de (Caja Global)</label>
            <select value={f.cuenta_id} onChange={set('cuenta_id')} className={selectCls}>
              <option value="">— No se asienta —</option>
              {cuentas.filter(c => c.moneda === f.moneda).map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div className="col-span-2"><label className={labelCls}>Notas</label><input value={f.notas} onChange={set('notas')} className={inputCls} /></div>
          {concepto && (
            <label className="col-span-2 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={f.activo} onChange={e => setF(p => ({ ...p, activo: e.target.checked }))} />
              Se sigue pagando (si no, deja de aparecer en los meses nuevos)
            </label>
          )}
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-between gap-2 pt-1">
          <div>{concepto && <Button variant="ghost" className="text-destructive" onClick={borrar}><Trash2 className="h-4 w-4 mr-1" />Eliminar</Button>}</div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={submit} disabled={guardar.isPending}>{guardar.isPending ? 'Guardando…' : 'Guardar'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Importar la planilla de Mayra ────────────────────────────────────────────
function ImportarDialog({ onClose }: { onClose: () => void }) {
  const importar = useImportarPagosFijos();
  const [archivo, setArchivo] = useState<File | null>(null);
  const [prev, setPrev] = useState<ImportPagosFijosResultado | null>(null);
  const [elegidas, setElegidas] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const previsualizar = async (file: File) => {
    setArchivo(file); setError(''); setPrev(null);
    try {
      const r = await importar.mutateAsync({ archivo: file, preview: true });
      setPrev(r); setElegidas(new Set(r.elegidas));
    } catch (e) { setError(getApiErrorMessage(e)); }
  };
  const aplicar = async () => {
    if (!archivo) return;
    setError('');
    try { setPrev(await importar.mutateAsync({ archivo, preview: false, secciones: [...elegidas] })); }
    catch (e) { setError(getApiErrorMessage(e)); }
  };

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Importar la planilla de pagos mensuales</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground -mt-1">
          La planilla con una hoja por mes (MARZO 2024, ABRIL 2024…). Se cargan los pagos fijos con su último medio, día y monto, y lo registrado en cada mes.
          No se guardan usuarios, claves ni mails; los planes de AFIP ya están en AFIP / Créditos.
        </p>
        <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) previsualizar(f); e.target.value = ''; }} />
        <Button variant="outline" onClick={() => inputRef.current?.click()} disabled={importar.isPending}>
          <FileUp className="h-4 w-4 mr-1" />{archivo ? archivo.name : 'Elegir archivo'}
        </Button>
        {importar.isPending && <p className="text-sm text-muted-foreground">Leyendo…</p>}
        {prev && !prev.aplicado && (
          <div className="space-y-3">
            <p className="text-sm">{prev.hojas.length} meses ({nombrePeriodo(prev.hojas[0])} a {nombrePeriodo(prev.hojas[prev.hojas.length - 1])}). Elegí qué bloques importar:</p>
            {prev.secciones.map(s => (
              <label key={s.clave} className={cn('block rounded border p-2.5', !s.importable && 'opacity-60')}>
                <div className="flex items-center gap-2">
                  <input type="checkbox" disabled={!s.importable} checked={elegidas.has(s.clave)}
                    onChange={e => setElegidas(p => { const n = new Set(p); if (e.target.checked) n.add(s.clave); else n.delete(s.clave); return n; })} />
                  <span className="font-medium text-sm">{s.titulo}</span>
                  <span className="text-xs text-muted-foreground">→ grupo "{s.grupo}" · {s.conceptos.length} pagos · {s.meses_con_datos} meses con datos</span>
                </div>
                {s.aviso && <p className="text-xs text-amber-700 mt-1 ml-6">{s.aviso}</p>}
                <p className="text-xs text-muted-foreground mt-1 ml-6">{s.conceptos.map(c => c.nombre).join(' · ')}</p>
              </label>
            ))}
            <p className="text-xs text-muted-foreground">
              Se omiten {prev.omitidos.afip} filas de planes de AFIP y {prev.omitidos.datos_de_acceso} datos que parecían usuario, mail o clave.
              Reimportar no duplica: sólo completa lo que esté vacío.
            </p>
          </div>
        )}
        {prev?.aplicado && (
          <div className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-800">
            <CheckCircle2 className="inline h-4 w-4 mr-1" />
            Listo: {prev.conceptos_creados} pagos fijos nuevos{prev.conceptos_actualizados ? `, ${prev.conceptos_actualizados} completados` : ''} y {prev.meses_creados} meses registrados{prev.meses_actualizados ? ` (${prev.meses_actualizados} completados)` : ''}.
          </div>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>{prev?.aplicado ? 'Cerrar' : 'Cancelar'}</Button>
          {prev && !prev.aplicado && <Button onClick={aplicar} disabled={importar.isPending || !elegidas.size}>Importar</Button>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Página ───────────────────────────────────────────────────────────────────
export default function PagosFijosPage() {
  const [params, setParams] = useSearchParams();
  const periodo = /^\d{4}-\d{2}$/.test(params.get('periodo') ?? '') ? params.get('periodo')! : periodoHoy();
  const setPeriodo = (p: string) => setParams(prev => { const n = new URLSearchParams(prev); n.set('periodo', p); return n; }, { replace: true });
  const { data, isLoading } = useAgendaPagosFijos(periodo);
  const { data: conceptos } = useConceptosPagoFijo();
  const [registrando, setRegistrando] = useState<PagoFijoFila | null>(null);
  const [editando, setEditando] = useState<PagoFijoConcepto | null | 'nuevo'>(null);
  const [importando, setImportando] = useState(false);
  const [soloPendientes, setSoloPendientes] = useState(false);

  const grupos = useMemo(() => {
    const m = new Map<string, PagoFijoFila[]>();
    for (const f of data?.filas ?? []) {
      if (soloPendientes && f.estado !== 'PENDIENTE') continue;
      m.set(f.grupo, [...(m.get(f.grupo) ?? []), f]);
    }
    // "Empresa" primero, los demás como vienen
    return [...m.entries()].sort(([a], [b]) => (a === 'Empresa' ? -1 : b === 'Empresa' ? 1 : a.localeCompare(b)));
  }, [data, soloPendientes]);
  const nombresGrupo = useMemo(() => [...new Set(['Empresa', ...(conceptos ?? []).map(c => c.grupo)])], [conceptos]);
  const otros = (data?.otros ?? []).filter(o => !soloPendientes || !o.pagado);
  const t = data?.totales;
  const esMesActual = periodo === periodoHoy();

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">
      <PageHeader
        title="Pagos fijos"
        subtitle="Lo que se paga todos los meses: servicios, expensas, impuestos, débitos automáticos. Con su vencimiento, cómo se paga y si ya se pagó."
        actions={<>
          <Button variant="outline" onClick={() => setImportando(true)}><FileUp className="h-4 w-4 mr-1" />Importar planilla</Button>
          <Button onClick={() => setEditando('nuevo')}><Plus className="h-4 w-4 mr-1" />Pago fijo</Button>
        </>}
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={() => setPeriodo(moverPeriodo(periodo, -1))} aria-label="Mes anterior"><ChevronLeft className="h-4 w-4" /></Button>
          <span className="min-w-36 text-center font-semibold">{nombrePeriodo(periodo)}</span>
          <Button variant="outline" size="sm" onClick={() => setPeriodo(moverPeriodo(periodo, 1))} aria-label="Mes siguiente"><ChevronRight className="h-4 w-4" /></Button>
          {!esMesActual && <Button variant="ghost" size="sm" onClick={() => setPeriodo(periodoHoy())}>Este mes</Button>}
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={soloPendientes} onChange={e => setSoloPendientes(e.target.checked)} />Sólo lo que falta pagar</label>
      </div>

      {t && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Total del mes</p><p className="text-lg font-semibold">{formatCurrency(t.total)}</p></div>
          <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Pagado</p><p className="text-lg font-semibold text-green-700">{formatCurrency(t.pagado)}</p></div>
          <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Falta pagar ({t.cantidad_pendientes})</p><p className="text-lg font-semibold">{formatCurrency(t.pendiente)}</p>{t.sin_monto > 0 && <p className="text-xs text-muted-foreground">{t.sin_monto} sin monto todavía</p>}</div>
          <div className={cn('rounded-lg border p-3', t.cantidad_vencidos > 0 && 'border-red-200 bg-red-50')}><p className="text-xs text-muted-foreground">Vencido ({t.cantidad_vencidos})</p><p className={cn('text-lg font-semibold', t.cantidad_vencidos > 0 && 'text-red-700')}>{formatCurrency(t.vencido)}</p></div>
        </div>
      )}

      {isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
      {data && !data.filas.length && (
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Todavía no hay pagos fijos. Agregalos con "+ Pago fijo" o importá la planilla de pagos mensuales.
        </div>
      )}

      {grupos.map(([grupo, filas]) => (
        <section key={grupo} className="space-y-1.5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{grupo}</h2>
          <BaseTable className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="px-3 py-2">Servicio</th><th className="px-3 py-2">Medio de pago</th><th className="px-3 py-2">Vence</th>
                <th className="px-3 py-2 text-right">Monto</th><th className="px-3 py-2">Estado</th><th className="px-3 py-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filas.map(f => (
                <tr key={f.pago_fijo_id} className={cn(!f.activo && 'opacity-60')}>
                  <td className="px-3 py-2">
                    <div className="font-medium">{f.nombre}</div>
                    {f.referencia && <div className="text-xs text-muted-foreground">{f.referencia}</div>}
                    {f.notas && <div className="text-xs text-muted-foreground italic">{f.notas}</div>}
                  </td>
                  <td className="px-3 py-2">{f.medio_pago ?? '—'}{f.movimiento_caja_id != null && f.cuenta_nombre && <div className="text-xs text-muted-foreground">Asentado en caja</div>}</td>
                  <td className="px-3 py-2">{formatDate(f.vencimiento)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {f.monto != null ? formatCurrency(f.monto, f.moneda) : <span className="text-muted-foreground">—</span>}
                    {f.mes_id == null && f.monto != null && <div className="text-xs text-muted-foreground">habitual</div>}
                  </td>
                  <td className="px-3 py-2"><EstadoPill fila={f} />{f.fecha_pago && f.estado !== 'PENDIENTE' && <div className="text-xs text-muted-foreground mt-0.5">{formatDate(f.fecha_pago)}</div>}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <Button size="sm" variant={f.estado === 'PENDIENTE' ? 'default' : 'outline'} onClick={() => setRegistrando(f)}>
                      {f.estado === 'PENDIENTE' ? 'Registrar pago' : 'Ver'}
                    </Button>
                    <Button size="sm" variant="ghost" aria-label="Editar pago fijo" onClick={() => setEditando(conceptos?.find(c => c.id === f.pago_fijo_id) ?? null)}><Pencil className="h-4 w-4" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </BaseTable>
        </section>
      ))}

      {otros.length > 0 && (
        <section className="space-y-1.5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">También vence este mes</h2>
          <p className="text-xs text-muted-foreground">Cuotas de AFIP, créditos y gastos de los espacios compartidos: se pagan en su pantalla.</p>
          <BaseTable className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="px-3 py-2">Concepto</th><th className="px-3 py-2">Detalle</th><th className="px-3 py-2">Vence</th>
                <th className="px-3 py-2 text-right">Monto</th><th className="px-3 py-2">Estado</th><th className="px-3 py-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {otros.map(o => (
                <tr key={`${o.origen}-${o.id}`}>
                  <td className="px-3 py-2 font-medium">{o.nombre}</td>
                  <td className="px-3 py-2 text-muted-foreground">{o.detalle}</td>
                  <td className="px-3 py-2">{formatDate(o.vencimiento)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(o.monto)}</td>
                  <td className="px-3 py-2">{o.vencido ? <Badge variant="destructive">Vencido</Badge> : o.pagado ? <Badge variant="success">Pagado</Badge> : <Badge variant="warning">Pendiente</Badge>}</td>
                  <td className="px-3 py-2 text-right"><Link to={o.ruta} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">Ir <ExternalLink className="h-3.5 w-3.5" /></Link></td>
                </tr>
              ))}
            </tbody>
          </BaseTable>
        </section>
      )}

      {t && t.cantidad_vencidos > 0 && esMesActual && (
        <p className="flex items-center gap-1.5 text-sm text-red-700"><AlertTriangle className="h-4 w-4" />Hay {t.cantidad_vencidos} pago{t.cantidad_vencidos === 1 ? '' : 's'} vencido{t.cantidad_vencidos === 1 ? '' : 's'} sin registrar.</p>
      )}

      {registrando && <RegistrarDialog fila={registrando} periodo={periodo} onClose={() => setRegistrando(null)} />}
      {editando && <ConceptoDialog concepto={editando === 'nuevo' ? null : editando} grupos={nombresGrupo} onClose={() => setEditando(null)} />}
      {importando && <ImportarDialog onClose={() => setImportando(false)} />}
    </div>
  );
}
