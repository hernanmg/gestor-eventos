import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Download, FileText, Send, CheckCheck, Banknote, CalendarDays, Copy, Paperclip, Undo2, ListChecks } from 'lucide-react';
import {
  useLiquidaciones, useEmpleados, useAprobarLiquidacion, useCancelarLiquidacion,
  useGenerarLiquidacion, usePreviewLiquidacion, descargarLiquidacionPDF,
  usePreAprobarLiquidaciones, useAprobarLiquidacionesLote, useVolverBorradorLiquidacion,
  useCambiarFechaPagoLiquidaciones, usePagarLiquidaciones, useSubirComprobanteLiquidacion,
  descargarComprobanteLiquidacion, useGenerarLiquidacionesPendientes, useCuentasEmpresa,
  type LiquidacionFiltros, type GenerarLiquidacionPayload, type GenerarPendientesResponse,
} from '@/hooks/useRRHH';
import { useEventos } from '@/hooks/useEvento';
import { useAuth } from '@/hooks/useAuth';
import { useEmpresaActual } from '@/hooks/useEmpresas';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn, getApiErrorMessage } from '@/lib/utils';
import type { EstadoLiquidacion, Liquidacion } from '@/types';
import BaseTable from '@/components/ui/BaseTable';

const ESTADO_LABEL: Record<EstadoLiquidacion, string> = {
  BORRADOR: 'Borrador', PRE_APROBADA: 'Pre-aprobada', APROBADA: 'Aprobada', PAGADA: 'Pagada', CANCELADA: 'Cancelada',
};
const ESTADO_VARIANT: Record<EstadoLiquidacion, 'muted' | 'success' | 'info' | 'destructive' | 'warning'> = {
  BORRADOR: 'muted', PRE_APROBADA: 'warning', APROBADA: 'success', PAGADA: 'info', CANCELADA: 'destructive',
};

const inputCls = 'w-full border border-input rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring';
const labelCls = 'block text-xs font-medium text-muted-foreground mb-0.5';

// ── Fechas ────────────────────────────────────────────────────────────────────

const hoyISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Enjoy paga los viernes: por defecto, el viernes más próximo (hoy si es viernes).
function proximoViernesISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// "2026-11-20" → "20/11" (fecha de calendario, sin pasar por la zona horaria)
const ddmm = (iso: string | null | undefined) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '—');
const ddmmaa = (iso: string | null | undefined) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(2, 4)}` : '—');
const diaSemana = (iso: string) => ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'][new Date(`${iso.slice(0, 10)}T12:00:00Z`).getUTCDay()];

// $3.102.500 · $2.083.453,85 — como en el WhatsApp de Male
const pesos = (n: number) =>
  '$' + n.toLocaleString('es-AR', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 });

// ── Preview de liquidación dentro del dialog de generar ───────────────────────
// Desglose real por jornada — usa el mismo cálculo (LINEAL u JORNADA) que
// aplicará el backend al generar, para que el preview nunca diverja del total final.

function PreviewLiquidacion({ empleadoId, fechaDesde, fechaHasta }: {
  empleadoId: number | null; fechaDesde: string; fechaHasta: string;
}) {
  const { data: preview, isLoading } = usePreviewLiquidacion({
    empleado_id: empleadoId ?? undefined,
    fecha_desde: fechaDesde || undefined,
    fecha_hasta: fechaHasta || undefined,
  });

  if (!empleadoId || !fechaDesde || !fechaHasta) return null;
  if (isLoading || !preview) return <p className="text-xs text-muted-foreground">Calculando preview…</p>;

  const thCls = 'text-left px-1.5 py-1 font-medium';
  const tdCls = 'px-1.5 py-1';

  return (
    <div className="rounded-md border border-border bg-muted/20 p-3 text-sm space-y-2">
      <p className="text-xs font-medium text-muted-foreground">
        Preview ({preview.jornadas.length} jornada(s) aprobada(s) —
        {preview.tipo_liquidacion === 'JORNADA' ? ' por jornada' : ' por hora, base de 10 hs por día'})
      </p>

      {preview.jornadas.length > 0 && (
        <div className="overflow-x-auto -mx-1">
          <BaseTable className="w-full text-xs">
            <thead className="text-muted-foreground">
              <tr>
                <th className={thCls}>Fecha</th>
                <th className={thCls}>Convocatoria</th>
                <th className={cn(thCls, 'text-right')}>Hs.</th>
                <th className={thCls}>Cálculo</th>
                <th className={cn(thCls, 'text-right')}>Base</th>
                <th className={cn(thCls, 'text-right')}>Extras</th>
                <th className={cn(thCls, 'text-right')}>Viajes</th>
                <th className={cn(thCls, 'text-right')}>Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {preview.jornadas.map(j => (
                <tr key={j.jornada_id}>
                  <td className={tdCls}>{j.fecha.slice(0, 10)}</td>
                  <td className={tdCls}>{j.convocatoria ?? '-'}</td>
                  <td className={cn(tdCls, 'text-right')}>{j.horas_trabajadas}</td>
                  <td className={tdCls}>{j.tipo_calculo === 'JORNADA' ? 'Jornada' : 'Por hora'}</td>
                  <td className={cn(tdCls, 'text-right')}>${j.monto_base.toLocaleString('es-AR')}</td>
                  <td className={cn(tdCls, 'text-right')}>${j.monto_extras.toLocaleString('es-AR')}</td>
                  <td className={cn(tdCls, 'text-right')}>${j.monto_viaje.toLocaleString('es-AR')}</td>
                  <td className={cn(tdCls, 'text-right font-medium')}>${j.total.toLocaleString('es-AR')}</td>
                </tr>
              ))}
            </tbody>
          </BaseTable>
        </div>
      )}

      <div className="flex justify-between font-semibold pt-1 border-t border-border">
        <span>Total general</span><span>${preview.subtotal_horas.toLocaleString('es-AR')}</span>
      </div>
    </div>
  );
}

// ── Dialog: generar una liquidación ───────────────────────────────────────────

function GenerarDialog({ open, onClose, empleadoIdFijo }: { open: boolean; onClose: () => void; empleadoIdFijo?: number }) {
  const { data: empleados = [] } = useEmpleados();
  const { data: eventos = [] }   = useEventos();
  const generarMut = useGenerarLiquidacion();
  const [error, setError] = useState<string | null>(null);
  const vacio = () => ({ empleado_id: empleadoIdFijo ?? '', fecha_desde: '', fecha_hasta: '', evento_id: '', fecha_pago: proximoViernesISO() });
  const [form, setForm] = useState(vacio);

  useEffect(() => {
    if (open) { setForm(vacio()); setError(null); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, empleadoIdFijo]);

  const empleadoSel = empleados.find(e => e.id === Number(form.empleado_id));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.empleado_id || !form.fecha_desde || !form.fecha_hasta) { setError('Completá empleado y período'); return; }
    const payload: GenerarLiquidacionPayload = {
      empleado_id: Number(form.empleado_id),
      fecha_desde: form.fecha_desde,
      fecha_hasta: form.fecha_hasta,
      evento_id:   form.evento_id ? Number(form.evento_id) : null,
      fecha_pago:  form.fecha_pago || null,
    };
    try {
      await generarMut.mutateAsync(payload);
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err) ?? 'Error al generar la liquidación');
    }
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Generar liquidación</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 mt-1">
          {!empleadoIdFijo && (
            <div>
              <label className={labelCls}>Empleado *</label>
              <select value={form.empleado_id} onChange={e => setForm(p => ({ ...p, empleado_id: e.target.value }))} className={inputCls} required>
                <option value="">Seleccionar...</option>
                {empleados.map(emp => <option key={emp.id} value={emp.id}>{emp.apellido}, {emp.nombre}</option>)}
              </select>
            </div>
          )}
          <div className="grid grid-cols-3 gap-3">
            <div><label className={labelCls}>Desde *</label><input type="date" value={form.fecha_desde} onChange={e => setForm(p => ({ ...p, fecha_desde: e.target.value }))} className={inputCls} required /></div>
            <div><label className={labelCls}>Hasta *</label><input type="date" value={form.fecha_hasta} onChange={e => setForm(p => ({ ...p, fecha_hasta: e.target.value }))} className={inputCls} required /></div>
            <div><label className={labelCls}>Fecha de pago</label><input type="date" value={form.fecha_pago} onChange={e => setForm(p => ({ ...p, fecha_pago: e.target.value }))} className={inputCls} /></div>
          </div>
          <div>
            <label className={labelCls}>Evento (opcional)</label>
            <select value={form.evento_id} onChange={e => setForm(p => ({ ...p, evento_id: e.target.value }))} className={inputCls}>
              <option value="">Sin evento específico</option>
              {eventos.map(ev => <option key={ev.id} value={ev.id}>{ev.nombre}</option>)}
            </select>
          </div>

          {empleadoSel && (
            <PreviewLiquidacion empleadoId={empleadoSel.id} fechaDesde={form.fecha_desde} fechaHasta={form.fecha_hasta} />
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={generarMut.isPending}>{generarMut.isPending ? 'Generando…' : 'Generar'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Dialog: generar las pendientes de pago (todas las personas de una vez) ────

function GenerarPendientesDialog({ open, onClose, onGeneradas }: { open: boolean; onClose: () => void; onGeneradas: (fechaPago: string) => void }) {
  const mut = useGenerarLiquidacionesPendientes();
  const [hasta, setHasta] = useState(hoyISO());
  const [fechaPago, setFechaPago] = useState(proximoViernesISO());
  const [preview, setPreview] = useState<GenerarPendientesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setHasta(hoyISO()); setFechaPago(proximoViernesISO()); setPreview(null); setError(null);
  }, [open]);

  useEffect(() => {
    if (!open || !hasta) return;
    let vigente = true;
    setError(null);
    mut.mutateAsync({ hasta, fecha_pago: fechaPago, dry_run: true })
      .then(r => { if (vigente) setPreview(r); })
      .catch(err => { if (vigente) setError(getApiErrorMessage(err) ?? 'Error al calcular'); });
    return () => { vigente = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, hasta, fechaPago]);

  const generar = async () => {
    try {
      const r = await mut.mutateAsync({ hasta, fecha_pago: fechaPago });
      onGeneradas(r.fecha_pago);
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err) ?? 'Error al generar');
    }
  };

  const lista = preview?.liquidaciones ?? [];
  const total = lista.reduce((s, l) => s + l.total_a_cobrar, 0);

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>Generar liquidaciones pendientes de pago</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground">
          Arma una liquidación por persona con las jornadas aprobadas que todavía no se liquidaron.
          Cada una empieza el día siguiente a su última liquidación, así nadie cobra dos veces el mismo día.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={labelCls}>Jornadas hasta el</label><input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className={inputCls} /></div>
          <div>
            <label className={labelCls}>Fecha de pago</label>
            <input type="date" value={fechaPago} onChange={e => setFechaPago(e.target.value)} className={inputCls} />
            <p className="text-[11px] text-muted-foreground mt-0.5">Por defecto, el viernes más próximo</p>
          </div>
        </div>

        {mut.isPending && !preview ? (
          <p className="text-sm text-muted-foreground">Calculando…</p>
        ) : lista.length === 0 ? (
          <p className="text-sm text-muted-foreground rounded-md border border-dashed border-border p-4 text-center">
            No hay jornadas aprobadas sin liquidar hasta esa fecha.
          </p>
        ) : (
          <div className="max-h-80 overflow-y-auto rounded-md border border-border">
            <BaseTable className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-border sticky top-0">
                <tr>
                  <th className="px-2 py-1.5 text-left text-xs font-medium text-muted-foreground">Persona</th>
                  <th className="px-2 py-1.5 text-left text-xs font-medium text-muted-foreground">Período</th>
                  <th className="px-2 py-1.5 text-right text-xs font-medium text-muted-foreground">Días</th>
                  <th className="px-2 py-1.5 text-right text-xs font-medium text-muted-foreground">Hs + extras</th>
                  <th className="px-2 py-1.5 text-right text-xs font-medium text-muted-foreground">Anticipos</th>
                  <th className="px-2 py-1.5 text-right text-xs font-medium text-muted-foreground">A cobrar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {lista.map(l => (
                  <tr key={l.empleado_id}>
                    <td className="px-2 py-1.5" data-label="Persona">
                      {l.empleado_nombre}
                      {l.sin_valor_hora && <span className="block text-[11px] text-amber-700">Sin valor hora cargado: da $0</span>}
                    </td>
                    <td className="px-2 py-1.5" data-label="Período">{ddmmaa(l.fecha_desde)} → {ddmmaa(l.fecha_hasta)}</td>
                    <td className="px-2 py-1.5 text-right" data-label="Días">{l.jornadas}</td>
                    <td className="px-2 py-1.5 text-right" data-label="Horas">{l.horas_normales} + {l.horas_extras}</td>
                    <td className="px-2 py-1.5 text-right" data-label="Anticipos">{l.total_anticipos ? `−${pesos(l.total_anticipos)}` : '—'}</td>
                    <td className="px-2 py-1.5 text-right font-semibold" data-label="A cobrar">{pesos(l.total_a_cobrar)}</td>
                  </tr>
                ))}
              </tbody>
            </BaseTable>
          </div>
        )}

        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <span className="text-sm">{lista.length > 0 && <>{lista.length} persona(s) · <strong>{pesos(total)}</strong> a pagar el {ddmm(fechaPago)}</>}</span>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button size="sm" disabled={mut.isPending || lista.length === 0} onClick={generar}>Generar {lista.length || ''}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Dialog: pedido de transferencias (pre-aprobación por WhatsApp) ────────────
// Arma el mismo mensaje que Male le manda a Matías, para copiar y pegar.

function armarMensaje(liqs: Liquidacion[], titulo: string, caja: string, concepto: (l: Liquidacion) => string): string {
  const pagos = liqs.map((l, i) => {
    const e = l.empleado;
    const lineas = [
      `Pago ${i + 1}`,
      `Titular: ${e ? `${e.nombre} ${e.apellido}` : '—'}`,
      `CUIL/CUIT: ${e?.cuit || e?.dni || '—'}`,
      `CBU: ${e?.cbu || '—'}`,
      `Alias: ${e?.alias || '—'}`,
      `Importe: ${pesos(l.total_a_cobrar)}`,
      `Concepto: ${concepto(l)}`,
    ];
    return lineas.join('\n');
  });
  const total = liqs.reduce((s, l) => s + l.total_a_cobrar, 0);
  return [titulo, caja, '', pagos.join('\n\n'), '', `TOTAL: ${pesos(total)}`].join('\n');
}

function PedidoTransferenciasDialog({ liqs, onClose, onPreAprobar, preAprobando }: {
  liqs: Liquidacion[]; onClose: () => void; onPreAprobar: (ids: number[]) => Promise<void>; preAprobando: boolean;
}) {
  const { data: empresa } = useEmpresaActual();
  const fechaPago = liqs.find(l => l.fecha_pago)?.fecha_pago ?? proximoViernesISO();
  const [titulo, setTitulo] = useState(`SOLICITUD DE TRANSFERENCIAS ${ddmm(fechaPago)}`);
  const [caja, setCaja] = useState('');
  const [concepto, setConcepto] = useState('Sueldo {desde} al {hasta}');
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (empresa && !caja) setCaja(`CAJA ${(empresa.nombre_corto || empresa.nombre).toUpperCase()}`);
  }, [empresa, caja]);

  const conceptoDe = (l: Liquidacion) => concepto
    .replace('{desde}', ddmm(l.fecha_desde))
    .replace('{hasta}', ddmm(l.fecha_hasta))
    .replace('{apellido}', l.empleado?.apellido ?? '')
    .replace('{horas}', String(l.horas_normales + l.horas_extras));

  const generado = useMemo(() => armarMensaje(liqs, titulo, caja, conceptoDe), [liqs, titulo, caja, concepto]); // eslint-disable-line react-hooks/exhaustive-deps
  const [texto, setTexto] = useState(generado);
  useEffect(() => { setTexto(generado); setCopiado(false); }, [generado]);

  const sinDatos = liqs.filter(l => !l.empleado?.cbu && !l.empleado?.alias);
  const borradores = liqs.filter(l => l.estado === 'BORRADOR');

  const copiar = async () => {
    try { await navigator.clipboard.writeText(texto); } catch { /* el textarea queda para copiar a mano */ }
    setCopiado(true);
  };

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Pedido de transferencias para Matías</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div><label className={labelCls}>Título</label><input value={titulo} onChange={e => setTitulo(e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls}>Caja</label><input value={caja} onChange={e => setCaja(e.target.value)} className={inputCls} /></div>
          <div>
            <label className={labelCls}>Concepto</label>
            <input value={concepto} onChange={e => setConcepto(e.target.value)} className={inputCls} title="Podés usar {desde}, {hasta}, {apellido} y {horas}" />
          </div>
        </div>
        {sinDatos.length > 0 && (
          <p className="text-xs text-amber-700">
            Sin CBU ni alias: {sinDatos.map(l => `${l.empleado?.apellido}, ${l.empleado?.nombre}`).join(' · ')}. Cargalos en RRHH → Empleados.
          </p>
        )}
        <textarea
          value={texto}
          onChange={e => { setTexto(e.target.value); setCopiado(false); }}
          rows={16}
          className="w-full rounded-md border border-input p-3 font-mono text-xs leading-relaxed focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <p className="text-[11px] text-muted-foreground">
          El texto se puede retocar antes de copiarlo. Al marcarlas como pre-aprobadas quedan esperando la aprobación de Matías.
        </p>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>Cerrar</Button>
          <Button variant="outline" size="sm" onClick={copiar}><Copy size={14} className="mr-1.5" />{copiado ? 'Copiado' : 'Copiar'}</Button>
          {borradores.length > 0 && (
            <Button size="sm" disabled={preAprobando} onClick={async () => { await copiar(); await onPreAprobar(borradores.map(l => l.id)); onClose(); }}>
              <Send size={14} className="mr-1.5" />Copiar y marcar {borradores.length} como pre-aprobada{borradores.length !== 1 ? 's' : ''}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Dialog: registrar el pago (salida de la cuenta, con comprobante) ──────────

function PagoDialog({ liqs, onClose }: { liqs: Liquidacion[]; onClose: () => void }) {
  const { user } = useAuth();
  const { data: cuentas = [] } = useCuentasEmpresa(user?.empresaId);
  const pagarMut = usePagarLiquidaciones();
  const [cuentaId, setCuentaId] = useState('');
  const [fecha, setFecha] = useState(liqs[0]?.fecha_pago?.slice(0, 10) && liqs[0].fecha_pago!.slice(0, 10) <= hoyISO() ? liqs[0].fecha_pago!.slice(0, 10) : hoyISO());
  const [archivo, setArchivo] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const total = liqs.reduce((s, l) => s + l.total_a_cobrar, 0);
  const sinAprobar = liqs.filter(l => l.estado !== 'APROBADA').length;

  const confirmar = async () => {
    if (!cuentaId) { setError('Elegí de qué cuenta sale el pago'); return; }
    setError(null);
    try {
      await pagarMut.mutateAsync({ ids: liqs.map(l => l.id), cuenta_id: Number(cuentaId), fecha, comprobante: archivo });
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err) ?? 'Error al registrar el pago');
    }
  };

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Registrar pago</DialogTitle></DialogHeader>
        <p className="text-sm">
          {liqs.length === 1 ? `${liqs[0].empleado?.apellido}, ${liqs[0].empleado?.nombre}` : `${liqs.length} liquidaciones`} · <strong>{pesos(total)}</strong>
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Sale de la cuenta *</label>
            <select value={cuentaId} onChange={e => setCuentaId(e.target.value)} className={inputCls}>
              <option value="">Elegir…</option>
              {cuentas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div><label className={labelCls}>Fecha del pago</label><input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className={inputCls} /></div>
        </div>
        {liqs.length === 1 ? (
          <div>
            <label className={labelCls}>Comprobante de la transferencia (PDF o imagen)</label>
            <input type="file" accept="application/pdf,image/*" onChange={e => setArchivo(e.target.files?.[0] ?? null)} className="text-sm" />
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Los comprobantes se suben después, de a uno, desde cada fila.</p>
        )}
        <p className="text-xs text-muted-foreground">
          Queda como gasto en la cuenta elegida (Caja Global).
          {sinAprobar > 0 && ` ${sinAprobar} todavía no estaba${sinAprobar !== 1 ? 'n' : ''} aprobada${sinAprobar !== 1 ? 's' : ''}: se aprueba${sinAprobar !== 1 ? 'n' : ''} en el mismo paso.`}
        </p>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" disabled={pagarMut.isPending} onClick={confirmar}>{pagarMut.isPending ? 'Registrando…' : 'Registrar pago'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function LiquidacionesTab({ empleadoIdInicial }: { empleadoIdInicial?: number | null }) {
  const [searchParams] = useSearchParams();
  const fechaPagoParam = searchParams.get('fecha_pago') ?? undefined;
  const [filtros, setFiltros] = useState<LiquidacionFiltros>(() => (fechaPagoParam ? { fecha_pago: fechaPagoParam, pendientes: true } : {}));
  useEffect(() => { if (empleadoIdInicial != null) setFiltros(p => ({ ...p, empleado_id: empleadoIdInicial })); }, [empleadoIdInicial]);
  useEffect(() => { if (fechaPagoParam) setFiltros(p => ({ ...p, fecha_pago: fechaPagoParam, pendientes: true })); }, [fechaPagoParam]);

  const { data: liquidaciones = [], isLoading } = useLiquidaciones(filtros);
  const { data: empleados = [] } = useEmpleados();
  const aprobarMut     = useAprobarLiquidacion();
  const cancelarMut    = useCancelarLiquidacion();
  const preAprobarMut  = usePreAprobarLiquidaciones();
  const aprobarLoteMut = useAprobarLiquidacionesLote();
  const volverMut      = useVolverBorradorLiquidacion();
  const fechaPagoMut   = useCambiarFechaPagoLiquidaciones();
  const comprobanteMut = useSubirComprobanteLiquidacion();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendientesOpen, setPendientesOpen] = useState(false);
  const [seleccion, setSeleccion] = useState<Set<number>>(new Set());
  const [pedido, setPedido] = useState<Liquidacion[] | null>(null);
  const [pago, setPago] = useState<Liquidacion[] | null>(null);

  // La selección sólo vive sobre lo que está en pantalla
  useEffect(() => {
    setSeleccion(prev => new Set([...prev].filter(id => liquidaciones.some(l => l.id === id))));
  }, [liquidaciones]);

  const seleccionadas = liquidaciones.filter(l => seleccion.has(l.id));
  const seleccionables = liquidaciones.filter(l => l.estado !== 'CANCELADA' && l.estado !== 'PAGADA');
  const todasSel = seleccionables.length > 0 && seleccionables.every(l => seleccion.has(l.id));
  const totalSel = seleccionadas.reduce((s, l) => s + l.total_a_cobrar, 0);
  const totalLista = liquidaciones.filter(l => l.estado !== 'CANCELADA').reduce((s, l) => s + l.total_a_cobrar, 0);

  const toggle = (id: number) => setSeleccion(p => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleTodas = () => setSeleccion(todasSel ? new Set() : new Set(seleccionables.map(l => l.id)));
  const alerta = (err: unknown, msg: string) => alert(getApiErrorMessage(err) ?? msg);

  const handleAprobar = (l: Liquidacion) => {
    const msg = l.evento_id
      ? `Al aprobar se crea un egreso de ${pesos(l.total_a_cobrar)} en el evento. ¿Confirmar?`
      : `¿Aprobar la liquidación de ${l.empleado?.apellido} por ${pesos(l.total_a_cobrar)}?`;
    if (!window.confirm(msg)) return;
    aprobarMut.mutate(l.id, { onError: err => alerta(err, 'Error al aprobar') });
  };

  const aprobarSeleccion = () => {
    const ids = seleccionadas.filter(l => l.estado === 'BORRADOR' || l.estado === 'PRE_APROBADA').map(l => l.id);
    if (ids.length === 0) { alert('Ninguna de las seleccionadas está para aprobar'); return; }
    if (!window.confirm(`¿Aprobar ${ids.length} liquidación(es)? Las que tienen evento generan su egreso.`)) return;
    aprobarLoteMut.mutate(ids, { onSuccess: () => setSeleccion(new Set()), onError: err => alerta(err, 'Error al aprobar') });
  };

  const cambiarFechaSeleccion = () => {
    const nueva = window.prompt('Nueva fecha de pago (AAAA-MM-DD)', proximoViernesISO());
    if (!nueva || !/^\d{4}-\d{2}-\d{2}$/.test(nueva)) return;
    fechaPagoMut.mutate({ ids: [...seleccion], fecha_pago: nueva }, { onError: err => alerta(err, 'Error al cambiar la fecha') });
  };

  const subirComprobante = (l: Liquidacion) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/pdf,image/*';
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) comprobanteMut.mutate({ id: l.id, file }, { onError: err => alerta(err, 'Error al subir el comprobante') });
    };
    input.click();
  };

  const th = 'px-3 py-2 text-left text-xs font-medium text-muted-foreground';
  const td = 'px-3 py-2.5';

  return (
    <div>
      <div className="flex flex-wrap items-end gap-2 justify-between mb-3">
        <div className="flex flex-wrap items-end gap-2">
          <select value={filtros.empleado_id ?? ''} onChange={e => setFiltros(p => ({ ...p, empleado_id: e.target.value ? Number(e.target.value) : undefined }))} className={cn(inputCls, 'w-auto')}>
            <option value="">Todos los empleados</option>
            {empleados.map(emp => <option key={emp.id} value={emp.id}>{emp.apellido}, {emp.nombre}</option>)}
          </select>
          <select
            value={filtros.pendientes ? 'PENDIENTES' : (filtros.estado ?? '')}
            onChange={e => {
              const v = e.target.value;
              setFiltros(p => ({ ...p, pendientes: v === 'PENDIENTES' || undefined, estado: v && v !== 'PENDIENTES' ? v as EstadoLiquidacion : undefined }));
            }}
            className={cn(inputCls, 'w-auto')}
          >
            <option value="">Todos los estados</option>
            <option value="PENDIENTES">Pendientes de pago</option>
            {Object.entries(ESTADO_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <div>
            <label className="block text-[11px] text-muted-foreground">Fecha de pago</label>
            <div className="flex items-center gap-1">
              <input
                type="date"
                value={filtros.fecha_pago ?? ''}
                onChange={e => setFiltros(p => ({ ...p, fecha_pago: e.target.value || undefined }))}
                className={cn(inputCls, 'w-auto')}
              />
              <Button type="button" variant="outline" size="sm" title="Próximo viernes" onClick={() => setFiltros(p => ({ ...p, fecha_pago: proximoViernesISO() }))}>
                <CalendarDays size={14} />
              </Button>
              {filtros.fecha_pago && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setFiltros(p => ({ ...p, fecha_pago: undefined }))}>Todas</Button>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setDialogOpen(true)}><Plus size={14} className="mr-1.5" /> Una liquidación</Button>
          <Button size="sm" onClick={() => setPendientesOpen(true)}><ListChecks size={14} className="mr-1.5" /> Generar pendientes</Button>
        </div>
      </div>

      {seleccion.size > 0 && (
        <div className="sticky top-0 z-10 mb-3 flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
          <span className="mr-auto">{seleccion.size} seleccionada{seleccion.size !== 1 ? 's' : ''} · <strong>{pesos(totalSel)}</strong></span>
          <Button size="sm" variant="outline" onClick={() => setPedido(seleccionadas)}><Send size={14} className="mr-1.5" />Pedido de transferencias</Button>
          <Button size="sm" variant="outline" disabled={aprobarLoteMut.isPending} onClick={aprobarSeleccion}><CheckCheck size={14} className="mr-1.5" />Aprobar</Button>
          <Button size="sm" variant="outline" onClick={() => setPago(seleccionadas)}><Banknote size={14} className="mr-1.5" />Registrar pago</Button>
          <Button size="sm" variant="ghost" onClick={cambiarFechaSeleccion}><CalendarDays size={14} className="mr-1.5" />Cambiar fecha de pago</Button>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : (
        <div className="overflow-x-auto">
          <BaseTable className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-border">
              <tr>
                <th className={cn(th, 'w-8')}>
                  <input type="checkbox" checked={todasSel} onChange={toggleTodas} aria-label="Seleccionar todas" disabled={seleccionables.length === 0} />
                </th>
                <th className={th}>Empleado</th>
                <th className={th}>Período</th>
                <th className={th}>Pago</th>
                <th className={cn(th, 'text-right')}>Hs.</th>
                <th className={cn(th, 'text-right')}>Extras</th>
                <th className={cn(th, 'text-right')}>Anticipos</th>
                <th className={cn(th, 'text-right')}>Total</th>
                <th className={th}>Estado</th>
                <th className={cn(th, 'text-right')}>Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {liquidaciones.length === 0 ? (
                <tr><td colSpan={10} className="px-3 py-6 text-center text-sm text-muted-foreground">No hay liquidaciones{filtros.fecha_pago ? ` para pagar el ${ddmmaa(filtros.fecha_pago)}` : ''}.</td></tr>
              ) : liquidaciones.map(l => {
                const seleccionable = l.estado !== 'CANCELADA' && l.estado !== 'PAGADA';
                return (
                  <tr key={l.id} className={cn('hover:bg-muted/20', seleccion.has(l.id) && 'bg-primary/5')}>
                    <td className={td}>
                      {seleccionable && <input type="checkbox" checked={seleccion.has(l.id)} onChange={() => toggle(l.id)} aria-label="Seleccionar" />}
                    </td>
                    <td className={cn(td, 'font-medium')} data-label="Empleado">{l.empleado ? `${l.empleado.apellido}, ${l.empleado.nombre}` : '-'}</td>
                    <td className={td} data-label="Período">{ddmmaa(l.fecha_desde)} → {ddmmaa(l.fecha_hasta)}</td>
                    <td className={td} data-label="Pago">
                      {l.fecha_pago ? <span title={l.fecha_pago.slice(0, 10)}>{diaSemana(l.fecha_pago)} {ddmmaa(l.fecha_pago)}</span> : '—'}
                      {l.pago && <span className="block text-[11px] text-muted-foreground">{l.pago.cuenta_nombre}</span>}
                    </td>
                    <td className={cn(td, 'text-right')} data-label="Hs.">{l.horas_normales}</td>
                    <td className={cn(td, 'text-right')} data-label="Extras">{l.horas_extras}</td>
                    <td className={cn(td, 'text-right')} data-label="Anticipos">{l.total_anticipos ? pesos(l.total_anticipos) : '—'}</td>
                    <td className={cn(td, 'text-right font-semibold')} data-label="Total">{pesos(l.total_a_cobrar)}</td>
                    <td className={td} data-label="Estado"><Badge variant={ESTADO_VARIANT[l.estado]} className="whitespace-nowrap">{ESTADO_LABEL[l.estado]}</Badge></td>
                    <td className={td}>
                      <div className="flex items-center justify-end gap-1 flex-wrap">
                        {(l.estado === 'BORRADOR' || l.estado === 'PRE_APROBADA') && (
                          <Button variant="outline" size="sm" onClick={() => handleAprobar(l)}>Aprobar</Button>
                        )}
                        {l.estado === 'PRE_APROBADA' && (
                          <Button variant="ghost" size="icon" title="Volver a borrador" onClick={() => volverMut.mutate(l.id, { onError: err => alerta(err, 'Error') })}>
                            <Undo2 size={14} />
                          </Button>
                        )}
                        {(l.estado === 'APROBADA' || l.estado === 'PRE_APROBADA') && (
                          <Button variant="outline" size="sm" onClick={() => setPago([l])}>Pagar</Button>
                        )}
                        {l.estado === 'PAGADA' && (l.pago?.tiene_comprobante ? (
                          <Button variant="ghost" size="icon" title="Descargar comprobante" onClick={() => descargarComprobanteLiquidacion(l.id).catch(err => alerta(err, 'Error'))}>
                            <Paperclip size={14} className="text-primary" />
                          </Button>
                        ) : (
                          <Button variant="ghost" size="sm" title="Subir comprobante" onClick={() => subirComprobante(l)}>
                            <Paperclip size={14} className="mr-1" />Comprobante
                          </Button>
                        ))}
                        {(l.estado === 'APROBADA' || l.estado === 'PAGADA') && l.movimiento_id && l.evento_id && (
                          <Link to={`/eventos/${l.evento_id}`} className="text-xs text-link hover:underline flex items-center gap-1">
                            <FileText size={12} /> Egreso
                          </Link>
                        )}
                        <Button variant="ghost" size="icon" title="PDF individual" onClick={() => descargarLiquidacionPDF(l.id).catch(err => alerta(err, 'No se pudo generar el PDF'))}>
                          <Download size={14} />
                        </Button>
                        {l.estado !== 'PAGADA' && l.estado !== 'CANCELADA' && (
                          <Button
                            variant="ghost" size="sm" className="text-destructive hover:text-destructive"
                            onClick={() => window.confirm('¿Cancelar esta liquidación?') && cancelarMut.mutate(l.id, { onError: err => alerta(err, 'Error al cancelar') })}
                          >
                            Cancelar
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {liquidaciones.length > 0 && (
              <tfoot>
                <tr className="border-t border-border">
                  <td colSpan={7} className="px-3 py-2 text-right text-xs text-muted-foreground">Total (sin canceladas)</td>
                  <td className="px-3 py-2 text-right font-semibold">{pesos(totalLista)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </BaseTable>
        </div>
      )}

      <GenerarDialog open={dialogOpen} onClose={() => setDialogOpen(false)} empleadoIdFijo={empleadoIdInicial ?? undefined} />
      <GenerarPendientesDialog
        open={pendientesOpen}
        onClose={() => setPendientesOpen(false)}
        onGeneradas={fecha => setFiltros(p => ({ ...p, fecha_pago: fecha, pendientes: true, estado: undefined }))}
      />
      {pedido && (
        <PedidoTransferenciasDialog
          liqs={pedido}
          onClose={() => setPedido(null)}
          preAprobando={preAprobarMut.isPending}
          onPreAprobar={async ids => {
            try { await preAprobarMut.mutateAsync(ids); setSeleccion(new Set()); } catch (err) { alerta(err, 'Error al pre-aprobar'); }
          }}
        />
      )}
      {pago && <PagoDialog liqs={pago} onClose={() => { setPago(null); setSeleccion(new Set()); }} />}
    </div>
  );
}
