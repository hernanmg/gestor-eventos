import { useEffect, useState } from 'react';
import { Plus, Download } from 'lucide-react';
import { useEmpleados, useAnticiposEmpleado, useCreateAnticipo, type AnticipoPayload } from '@/hooks/useRRHH';
import {
  useAcuerdos, useAcuerdoEmpleado, useCuentasPorEmpresa,
  useLiquidacionesAdmin, useLiquidacionAdmin, useGenerarLiquidacionAdmin, useUpdateLiquidacionAdmin,
  useAprobarLiquidacionAdmin, useCancelarLiquidacionAdmin, descargarLiquidacionAdminPDF,
  usePrestamosEmpleado, useHorasPeriodo, useResumenMensual, useResumenBitacora, useIpcIndec,
  type LiquidacionAdminFiltros, type GenerarLiquidacionAdminPayload,
} from '@/hooks/useSueldosAdmin';
import { useResumenMesEmpleado } from '@/hooks/usePresentismo';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import MoneyInput from '@/components/ui/MoneyInput';
import { formatCurrency } from '@/lib/formatters';
import { cn, getApiErrorMessage } from '@/lib/utils';
import type { EstadoLiquidacionAdmin, LiquidacionAdmin, TipoAumento, TipoAnticipo, ResumenMesEmpleadoResponse } from '@/types';

const inputCls = 'w-full border border-input rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring';
const labelCls = 'block text-xs font-medium text-muted-foreground mb-0.5';

const ESTADO_LABEL: Record<EstadoLiquidacionAdmin, string> = { BORRADOR: 'Borrador', APROBADA: 'Aprobada', PAGADA: 'Pagada', CANCELADA: 'Cancelada' };
const ESTADO_VARIANT: Record<EstadoLiquidacionAdmin, 'muted' | 'success' | 'info' | 'destructive'> = {
  BORRADOR: 'muted', APROBADA: 'success', PAGADA: 'info', CANCELADA: 'destructive',
};
const TIPO_ANTICIPO_LABEL: Record<TipoAnticipo, string> = { ADELANTO: 'Adelanto', VALE: 'Vale', DESCUENTO: 'Descuento', MULTA: 'Multa' };
const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

// ── Preview de generación (desglose completo, incluye split si aplica) ───────

function GenerarPreview({ empleadoId, horasTrabajadas, valesDescuentos, vacacionesAguinaldo, prestamosDescuento = 0, viaticoOverride, aumentoPorcentaje, presentismo, premioPresentismoOverride }: {
  empleadoId: number; horasTrabajadas: string; valesDescuentos: number; vacacionesAguinaldo: string; prestamosDescuento?: number;
  viaticoOverride?: number | null; aumentoPorcentaje?: number | null;
  presentismo?: ResumenMesEmpleadoResponse; premioPresentismoOverride?: number | null;
}) {
  const { data: acuerdo } = useAcuerdoEmpleado(empleadoId);
  if (!acuerdo) return null;

  const esChofer = acuerdo.categoria_acuerdo === 'CHOFER';
  const horas   = parseFloat(horasTrabajadas) || 0;
  const basico  = aumentoPorcentaje ? acuerdo.sueldo_basico * (1 + aumentoPorcentaje / 100) : acuerdo.sueldo_basico;
  // Sueldo básico, viático, teléfono, antigüedad e incentivo son fijos — no
  // se tocan por horas. Las horas extras sólo existen si superó el mínimo
  // acordado (mismo criterio que calcularSueldoAdmin.ts). CHOFER no usa horas
  // para nada de esto. El Premio Presentismo, en cambio, ya NO depende de las
  // horas: si Lorena cerró el Control de Presentismo del período, manda eso
  // (cobra_presentismo); si no lo cerró, se puede pisar manualmente.
  const cumpleHoras   = esChofer ? true : horas >= acuerdo.horas_acordadas_mes;
  const extras        = esChofer ? 0 : (cumpleHoras ? Math.max(0, horas - acuerdo.horas_acordadas_mes) : 0);
  const importeExtras = esChofer ? 0 : extras * (acuerdo.valor_hora_extra ?? 0);
  const presentismoCerrado = presentismo?.cerrado ?? false;
  const cobraPresentismo   = presentismoCerrado ? (presentismo!.resumen_persistido?.cobra_presentismo ?? true) : cumpleHoras;
  const premioPresentismo  = presentismoCerrado
    ? (cobraPresentismo ? (acuerdo.premio_presentismo ?? 0) : 0)
    : (premioPresentismoOverride ?? (cumpleHoras ? (acuerdo.premio_presentismo ?? 0) : 0));
  const vales   = valesDescuentos;
  const vacac   = parseFloat(vacacionesAguinaldo) || 0;
  const viatico = viaticoOverride ?? acuerdo.viatico ?? 0;

  // La antigüedad real la trae el preview del acuerdo (ya calculada server-side).
  const antiguedad = acuerdo.preview?.importe_antiguedad ?? 0;
  const aniosAntiguedad = acuerdo.preview?.antiguedad_anios ?? 0;

  const subtotal =
    basico
    + (acuerdo.premio_incentivo ?? 0)
    + viatico
    + premioPresentismo
    + antiguedad
    + (acuerdo.telefono ?? 0)
    + importeExtras
    + vacac;
  const total = subtotal - vales - prestamosDescuento;

  return (
    <div className="rounded-md border border-border bg-muted/20 p-3 text-sm space-y-1.5">
      {!esChofer && (
        <p className="text-xs font-medium text-muted-foreground">
          Acordadas: {acuerdo.horas_acordadas_mes} hs — Extra: {extras} hs {horas > 0 && `si trabajó ${horas}`}
        </p>
      )}
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
        <span>Sueldo básico{aumentoPorcentaje ? ` (+${aumentoPorcentaje}%)` : ''}</span><span className="text-right">{formatCurrency(basico)}</span>
        {!esChofer && (<><span>Horas extras</span><span className="text-right">{formatCurrency(importeExtras)}</span></>)}
        <span>Antigüedad ({aniosAntiguedad} año{aniosAntiguedad !== 1 ? 's' : ''})</span><span className="text-right">{formatCurrency(antiguedad)}</span>
        {acuerdo.premio_incentivo   ? (<><span>Premio incentivo</span><span className="text-right">{formatCurrency(acuerdo.premio_incentivo)}</span></>) : null}
        {viatico ? (
          <>
            <span>Viático{viaticoOverride != null ? ' (bitácora)' : ''}</span>
            <span className="text-right">{formatCurrency(viatico)}</span>
          </>
        ) : null}
        {acuerdo.premio_presentismo ? (
          <>
            <span>Premio presentismo</span>
            {!cobraPresentismo ? (
              <span className="text-right text-destructive line-through">{formatCurrency(acuerdo.premio_presentismo)}</span>
            ) : (
              <span className="text-right">{formatCurrency(premioPresentismo)}</span>
            )}
          </>
        ) : null}
        {acuerdo.telefono           ? (<><span>Teléfono</span><span className="text-right">{formatCurrency(acuerdo.telefono)}</span></>) : null}
        {vacac > 0 ? (<><span>Vacaciones/Aguinaldo/Extras</span><span className="text-right">{formatCurrency(vacac)}</span></>) : null}
        {vales > 0 ? (<><span>Vales/Descuentos</span><span className="text-right text-destructive">-{formatCurrency(vales)}</span></>) : null}
        {prestamosDescuento > 0 ? (<><span>Préstamos</span><span className="text-right text-destructive">-{formatCurrency(prestamosDescuento)}</span></>) : null}
      </div>
      {!cobraPresentismo && acuerdo.premio_presentismo ? (
        <p className="text-xs text-destructive">
          {presentismoCerrado ? `No cobra presentismo — ${presentismo?.resumen_persistido?.motivo_sin_presentismo ?? 'ver Control de Presentismo'}.` : 'No alcanzó las horas acordadas — pierde el premio presentismo.'}
        </p>
      ) : null}
      <div className="flex justify-between font-semibold pt-1 border-t border-border">
        <span>Total a cobrar</span><span>{formatCurrency(total)}</span>
      </div>

      {acuerdo.splits && acuerdo.splits.length > 0 && (
        <div className="pt-1 border-t border-border">
          <p className="text-xs font-medium text-muted-foreground mb-1">Desglose por empresa</p>
          {acuerdo.splits.map(s => (
            <div key={s.empresa_id} className="flex justify-between text-xs">
              <span>{s.empresa_nombre} ({s.porcentaje}%)</span>
              <span>{formatCurrency(total * s.porcentaje / 100)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Panel: horas registradas en el sistema para el período elegido ───────────

function HorasPeriodoPanel({ empleadoId, mes, anio, onUsar }: {
  empleadoId: number; mes: number; anio: number; onUsar: (horas: number) => void;
}) {
  const { data, isLoading } = useHorasPeriodo(empleadoId, mes, anio);
  if (isLoading || !data) return null;

  return (
    <div className="rounded-md border border-border bg-muted/20 p-3 text-sm space-y-1">
      <p className="text-xs font-medium text-muted-foreground">📊 Horas registradas en el sistema</p>
      <p className="text-xs text-muted-foreground">Período: {MESES[mes - 1]} {anio}</p>
      <p className="text-xs text-muted-foreground">Jornadas aprobadas: {data.cantidad_jornadas} día{data.cantidad_jornadas !== 1 ? 's' : ''}</p>
      <p className="text-xs text-muted-foreground">Total horas trabajadas: {data.total_horas} hs</p>
      <p className="text-xs text-muted-foreground">Horas acordadas: {data.horas_acordadas} hs</p>
      <p className="text-xs text-muted-foreground">
        Horas extras: {data.horas_extras} hs {data.horas_extras === 0 && '(no superó el mínimo)'}
      </p>
      <Button type="button" variant="outline" size="sm" className="mt-1" onClick={() => onUsar(data.total_horas)}>
        Usar este valor
      </Button>
    </div>
  );
}

// ── Panel: resumen de bitácora de viajes del período (choferes) ──────────────

const TIPO_RECORRIDO_UNIT_LABEL: Record<'provincial' | 'nacional' | 'nacional_1000', string> = {
  provincial: 'Provincial', nacional: 'Nacional', nacional_1000: 'Nacional +1000km',
};

function BitacoraResumenPanel({ empleadoId, mes, anio, onUsar, autoAplicado = false }: {
  empleadoId: number; mes: number; anio: number; onUsar: (viatico: number) => void;
  // true cuando el acuerdo es categoria_acuerdo=CHOFER — el backend ya aplica
  // este viático automáticamente al generar, sin necesidad del botón.
  autoAplicado?: boolean;
}) {
  const { data: acuerdo } = useAcuerdoEmpleado(empleadoId);
  const { data: resumen, isLoading } = useResumenBitacora(empleadoId, mes, anio);
  if (isLoading || !resumen || resumen.registros.length === 0) return null;

  const valorPorTipo = {
    provincial:    acuerdo?.viatico_provincial    ?? null,
    nacional:      acuerdo?.viatico_nacional      ?? null,
    nacional_1000: acuerdo?.viatico_nacional_1000 ?? null,
  };

  return (
    <div className="rounded-md border border-border bg-muted/20 p-3 text-sm space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">🚚 Premios de viaje — bitácora del período</p>
      {(Object.entries(resumen.total_vueltas) as [keyof typeof resumen.total_vueltas, number][])
        .filter(([, vueltas]) => vueltas > 0)
        .map(([tipo, vueltas]) => {
          const valor = valorPorTipo[tipo];
          return (
            <p key={tipo} className="text-xs text-muted-foreground">
              {TIPO_RECORRIDO_UNIT_LABEL[tipo]}: {vueltas} vuelta{vueltas !== 1 ? 's' : ''}
              {valor !== null ? ` × ${formatCurrency(valor)} = ${formatCurrency(vueltas * valor)}` : ' — sin valor cargado en el acuerdo'}
            </p>
          );
        })}
      <p className="text-sm font-semibold pt-1 border-t border-border">
        Total premios de viaje: {formatCurrency(resumen.total_viatico)}
      </p>
      {autoAplicado ? (
        <p className="text-[11px] text-muted-foreground">Se aplica automáticamente por ser categoría Chofer.</p>
      ) : (
        <Button type="button" variant="outline" size="sm" className="mt-1" onClick={() => onUsar(resumen.total_viatico)}>
          Usar viático calculado
        </Button>
      )}
    </div>
  );
}

// ── Panel: Control de Presentismo del período (Lorena) ────────────────────────

function PresentismoPanel({ data, isLoading, override, onOverrideChange }: {
  data?: ResumenMesEmpleadoResponse; isLoading: boolean; override: string; onOverrideChange: (v: string) => void;
}) {
  if (isLoading || !data) return null;

  if (data.cerrado && data.resumen_persistido) {
    const r = data.resumen_persistido;
    return (
      <div className="rounded-md border border-border bg-muted/20 p-3 text-sm space-y-1">
        <p className="text-xs font-medium text-muted-foreground">✓ Presentismo cerrado por Lorena</p>
        <p className="text-xs text-muted-foreground">
          Días presente: {r.dias_presente} | Ausentes: {r.dias_ausente} | Tardanzas: {r.dias_tarde}
        </p>
        <p className="text-xs">
          Premio presentismo: {r.cobra_presentismo
            ? <span className="text-green-700 font-medium">Cobra ✓</span>
            : <span className="text-destructive font-medium">No cobra — {r.motivo_sin_presentismo}</span>}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm space-y-1.5">
      <p className="text-xs font-medium text-amber-800">⚠️ Lorena no cerró el presentismo de este mes todavía</p>
      <div>
        <label className={labelCls}>Premio presentismo manual ($)</label>
        <MoneyInput value={override} onChange={onOverrideChange} />
      </div>
    </div>
  );
}

// ── Panel: banco de horas acumuladas (choferes) ───────────────────────────────

function BancoHorasPanel({ acumuladoAnterior, horasEsteMes }: { acumuladoAnterior: number; horasEsteMes: number }) {
  const nuevo = Math.round((acumuladoAnterior + horasEsteMes) * 100) / 100;
  return (
    <div className="rounded-md border border-border bg-muted/20 p-3 text-sm space-y-1">
      <p className="text-xs font-medium text-muted-foreground">🕒 Banco de horas</p>
      <div className="grid grid-cols-2 gap-x-4 text-xs text-muted-foreground">
        <span>Acumulado anterior</span><span className="text-right">{acumuladoAnterior} hs</span>
        <span>Horas este mes</span><span className="text-right">{horasEsteMes} hs</span>
      </div>
      <p className="text-sm font-semibold pt-1 border-t border-border">Nuevo acumulado: {nuevo} hs</p>
      <p className="text-[11px] text-muted-foreground">No impacta en el monto — es sólo registro. Se guarda en el acuerdo recién al aprobar.</p>
    </div>
  );
}

// ── Dialog: agregar vale/descuento (crea un Anticipo) ─────────────────────────

function AgregarValeDialog({ empleadoId, open, onClose, onCreated }: {
  empleadoId: number; open: boolean; onClose: () => void; onCreated: (id: number) => void;
}) {
  const createMut = useCreateAnticipo();
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ tipo: 'VALE' as TipoAnticipo, monto: '', fecha: today, motivo: '' });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) { setForm({ tipo: 'VALE', monto: '', fecha: today, motivo: '' }); setError(null); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.monto || Number(form.monto) <= 0) { setError('El monto debe ser mayor a 0'); return; }
    const payload: AnticipoPayload = {
      empleado_id: empleadoId, tipo: form.tipo, monto: Number(form.monto), fecha: form.fecha, motivo: form.motivo || null,
    };
    try {
      const creado = await createMut.mutateAsync(payload);
      onCreated(creado.id);
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err) ?? 'Error al guardar el vale');
    }
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Agregar vale</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 mt-1">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Fecha *</label>
              <input type="date" value={form.fecha} onChange={e => setForm(p => ({ ...p, fecha: e.target.value }))} className={inputCls} required />
            </div>
            <div>
              <label className={labelCls}>Tipo</label>
              <select value={form.tipo} onChange={e => setForm(p => ({ ...p, tipo: e.target.value as TipoAnticipo }))} className={inputCls}>
                {Object.entries(TIPO_ANTICIPO_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>
          <div><label className={labelCls}>Detalle / Motivo</label><input value={form.motivo} onChange={e => setForm(p => ({ ...p, motivo: e.target.value }))} className={inputCls} /></div>
          <div><label className={labelCls}>Monto *</label><MoneyInput value={form.monto} onChange={v => setForm(p => ({ ...p, monto: v }))} /></div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={createMut.isPending}>{createMut.isPending ? 'Guardando…' : 'Guardar'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Sección: vales y descuentos del período (Anticipos pendientes) ───────────

function AnticiposSection({ empleadoId, selected, onToggle }: {
  empleadoId: number; selected: Set<number>; onToggle: (id: number) => void;
}) {
  const { data: anticipos = [], isLoading } = useAnticiposEmpleado(empleadoId);
  const [agregarOpen, setAgregarOpen] = useState(false);
  const pendientes = anticipos.filter(a => !a.descontado);
  const total = pendientes.filter(a => selected.has(a.id)).reduce((s, a) => s + a.monto, 0);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className={labelCls}>📋 Vales y descuentos del período</label>
        <Button type="button" variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setAgregarOpen(true)}>
          <Plus size={12} className="mr-1" /> Agregar vale
        </Button>
      </div>
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Cargando…</p>
      ) : pendientes.length === 0 ? (
        <p className="text-xs text-muted-foreground">Sin vales pendientes para este empleado.</p>
      ) : (
        <div className="rounded-md border border-border divide-y divide-border/60 max-h-40 overflow-y-auto">
          {pendientes.map(a => (
            <label key={a.id} className="flex items-center gap-2 px-2 py-1.5 text-xs cursor-pointer">
              <input type="checkbox" checked={selected.has(a.id)} onChange={() => onToggle(a.id)} />
              <span className="w-20 shrink-0 text-muted-foreground">{a.fecha.slice(0, 10)}</span>
              <span className="flex-1 truncate">{a.motivo ?? '—'}</span>
              <Badge variant="muted">{TIPO_ANTICIPO_LABEL[a.tipo]}</Badge>
              <span className="w-24 shrink-0 text-right font-medium">{formatCurrency(a.monto)}</span>
            </label>
          ))}
        </div>
      )}
      {total > 0 && <p className="text-xs text-muted-foreground">Total seleccionado: <span className="font-medium text-foreground">{formatCurrency(total)}</span></p>}

      <AgregarValeDialog empleadoId={empleadoId} open={agregarOpen} onClose={() => setAgregarOpen(false)} onCreated={onToggle} />
    </div>
  );
}

// ── Dialog: Generar liquidación ───────────────────────────────────────────────

function GenerarDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: acuerdos = [] } = useAcuerdos();
  const generarMut = useGenerarLiquidacionAdmin();
  const ipcMut = useIpcIndec();
  const [error, setError] = useState<string | null>(null);
  const hoy = new Date();
  const [form, setForm] = useState({
    empleado_id: '', periodo_mes: String(hoy.getMonth() + 1), periodo_anio: String(hoy.getFullYear()),
    horas_trabajadas: '', vacaciones_aguinaldo: '', viatico_override: '', premio_presentismo_override: '',
    tipo_aumento: 'SIN_AUMENTO' as TipoAumento, porcentaje_aumento: '',
  });
  const [ipcInfo, setIpcInfo] = useState<{ mes: string; valor: number } | null>(null);
  const [ipcError, setIpcError] = useState<string | null>(null);
  const [prestamosSel, setPrestamosSel] = useState<Set<number>>(new Set());
  const [anticiposSel, setAnticiposSel] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (open) {
      setForm({
        empleado_id: '', periodo_mes: String(hoy.getMonth() + 1), periodo_anio: String(hoy.getFullYear()),
        horas_trabajadas: '', vacaciones_aguinaldo: '', viatico_override: '', premio_presentismo_override: '',
        tipo_aumento: 'SIN_AUMENTO', porcentaje_aumento: '',
      });
      setIpcInfo(null);
      setIpcError(null);
      setPrestamosSel(new Set());
      setAnticiposSel(new Set());
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = (k: keyof typeof form, v: string) => {
    setForm(p => ({ ...p, [k]: v, ...((k === 'empleado_id' || k === 'periodo_mes' || k === 'periodo_anio') && { viatico_override: '', premio_presentismo_override: '' }) }));
    if (k === 'empleado_id') { setPrestamosSel(new Set()); setAnticiposSel(new Set()); }
    if (k === 'tipo_aumento') { setIpcInfo(null); setIpcError(null); if (v !== 'MANUAL' && v !== 'IPC') set('porcentaje_aumento', ''); }
  };

  const empleadoIdNum = form.empleado_id ? Number(form.empleado_id) : null;
  const { data: acuerdoSel } = useAcuerdoEmpleado(empleadoIdNum);
  const esChofer = acuerdoSel?.categoria_acuerdo === 'CHOFER';
  const { data: presentismo, isLoading: presentismoLoading } = useResumenMesEmpleado(empleadoIdNum, Number(form.periodo_mes), Number(form.periodo_anio));
  const { data: prestamos = [] } = usePrestamosEmpleado(empleadoIdNum);
  const prestamosPendientes = prestamos.filter(p => !p.saldado);
  const totalPrestamosSel = prestamosPendientes.filter(p => prestamosSel.has(p.id)).reduce((s, p) => s + p.monto_cuota, 0);
  const togglePrestamo = (id: number) => setPrestamosSel(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const { data: anticipos = [] } = useAnticiposEmpleado(empleadoIdNum);
  const totalAnticiposSel = anticipos.filter(a => !a.descontado && anticiposSel.has(a.id)).reduce((s, a) => s + a.monto, 0);
  const toggleAnticipo = (id: number) => setAnticiposSel(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const handleTraerIpc = async () => {
    setIpcError(null);
    setIpcInfo(null);
    try {
      const r = await ipcMut.mutateAsync({ mes: Number(form.periodo_mes), anio: Number(form.periodo_anio) });
      setIpcInfo({ mes: r.mes, valor: r.ipc_mensual });
      set('porcentaje_aumento', String(r.ipc_mensual));
    } catch (err) {
      setIpcError(getApiErrorMessage(err) ?? 'No se pudo obtener el IPC del INDEC. Ingresá el porcentaje manualmente.');
    }
  };

  const aumentoPorcentaje = form.tipo_aumento !== 'SIN_AUMENTO' && form.porcentaje_aumento ? Number(form.porcentaje_aumento) : null;
  const basicoConAumento = acuerdoSel && aumentoPorcentaje ? acuerdoSel.sueldo_basico * (1 + aumentoPorcentaje / 100) : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.empleado_id) { setError('Completá el empleado'); return; }
    if (!esChofer && !form.horas_trabajadas) { setError('Completá las horas trabajadas'); return; }
    if (form.tipo_aumento !== 'SIN_AUMENTO' && !form.porcentaje_aumento) { setError('Falta el porcentaje de aumento'); return; }
    const payload: GenerarLiquidacionAdminPayload = {
      empleado_id:          Number(form.empleado_id),
      periodo_mes:          Number(form.periodo_mes),
      periodo_anio:         Number(form.periodo_anio),
      horas_trabajadas:     form.horas_trabajadas ? Number(form.horas_trabajadas) : 0,
      anticipo_ids:         Array.from(anticiposSel),
      vacaciones_aguinaldo: form.vacaciones_aguinaldo ? Number(form.vacaciones_aguinaldo) : 0,
      viatico_override:     form.viatico_override ? Number(form.viatico_override) : undefined,
      premio_presentismo_override: form.premio_presentismo_override ? Number(form.premio_presentismo_override) : undefined,
      ...(form.tipo_aumento !== 'SIN_AUMENTO' && {
        tipo_aumento:       form.tipo_aumento,
        porcentaje_aumento: Number(form.porcentaje_aumento),
        ...(form.tipo_aumento === 'IPC' && ipcInfo && { ipc_mes_referencia: ipcInfo.mes, ipc_valor_aplicado: ipcInfo.valor }),
      }),
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
          <div>
            <label className={labelCls}>Empleado *</label>
            <select value={form.empleado_id} onChange={e => set('empleado_id', e.target.value)} className={inputCls} required>
              <option value="">Seleccionar...</option>
              {acuerdos.map(a => a.empleado && (
                <option key={a.empleado_id} value={a.empleado_id}>{a.empleado.apellido}, {a.empleado.nombre}</option>
              ))}
            </select>
            {acuerdos.length === 0 && <p className="text-xs text-muted-foreground mt-1">No hay empleados con acuerdo activo.</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Mes *</label>
              <select value={form.periodo_mes} onChange={e => set('periodo_mes', e.target.value)} className={inputCls}>
                {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Año *</label>
              <input type="number" value={form.periodo_anio} onChange={e => set('periodo_anio', e.target.value)} className={inputCls} />
            </div>
          </div>
          {!esChofer && empleadoIdNum && (
            <HorasPeriodoPanel
              empleadoId={empleadoIdNum}
              mes={Number(form.periodo_mes)}
              anio={Number(form.periodo_anio)}
              onUsar={horas => set('horas_trabajadas', String(horas))}
            />
          )}
          {empleadoIdNum && (
            <BitacoraResumenPanel
              empleadoId={empleadoIdNum}
              mes={Number(form.periodo_mes)}
              anio={Number(form.periodo_anio)}
              onUsar={viatico => set('viatico_override', String(viatico))}
              autoAplicado={esChofer}
            />
          )}
          {!esChofer && form.viatico_override && (
            <p className="text-xs text-muted-foreground -mt-1">
              Usando viático calculado de la bitácora: {formatCurrency(Number(form.viatico_override))}
              {' — '}
              <button type="button" className="underline hover:text-foreground" onClick={() => set('viatico_override', '')}>
                usar el fijo del acuerdo
              </button>
            </p>
          )}

          {esChofer ? (
            <div>
              <label className={labelCls}>Horas este mes (banco de horas — no impacta el monto)</label>
              <input type="number" min="0" step="0.5" value={form.horas_trabajadas} onChange={e => set('horas_trabajadas', e.target.value)} className={inputCls} />
            </div>
          ) : (
            <div>
              <label className={labelCls}>Horas trabajadas *</label>
              <input type="number" min="0" step="0.5" value={form.horas_trabajadas} onChange={e => set('horas_trabajadas', e.target.value)} className={inputCls} required />
            </div>
          )}
          {esChofer && (
            <BancoHorasPanel acumuladoAnterior={acuerdoSel?.horas_pendientes_acum ?? 0} horasEsteMes={Number(form.horas_trabajadas) || 0} />
          )}

          <div>
            <label className={labelCls}>Vacaciones/Aguinaldos/Extras ($)</label>
            <MoneyInput value={form.vacaciones_aguinaldo} onChange={v => set('vacaciones_aguinaldo', v)} />
          </div>

          {empleadoIdNum && acuerdoSel?.premio_presentismo ? (
            <PresentismoPanel
              data={presentismo} isLoading={presentismoLoading}
              override={form.premio_presentismo_override}
              onOverrideChange={v => set('premio_presentismo_override', v)}
            />
          ) : null}

          {empleadoIdNum && (
            <AnticiposSection empleadoId={empleadoIdNum} selected={anticiposSel} onToggle={toggleAnticipo} />
          )}

          <div className="rounded-md border border-border p-3 space-y-2">
            <p className="text-xs font-medium">📈 Aumento sobre el básico (opcional)</p>
            <div className="flex gap-2">
              {([['SIN_AUMENTO', 'Sin aumento'], ['MANUAL', '% Manual'], ['IPC', 'IPC del INDEC']] as const).map(([v, l]) => (
                <button
                  key={v} type="button" onClick={() => set('tipo_aumento', v)}
                  className={cn(
                    'flex-1 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors',
                    form.tipo_aumento === v ? 'border-primary bg-primary/10 text-primary' : 'border-input text-muted-foreground hover:bg-accent',
                  )}
                >
                  {l}
                </button>
              ))}
            </div>
            {form.tipo_aumento === 'MANUAL' && (
              <div>
                <label className={labelCls}>Porcentaje</label>
                <input type="number" min="0" step="0.01" value={form.porcentaje_aumento} onChange={e => set('porcentaje_aumento', e.target.value)} className={inputCls} placeholder="%" />
              </div>
            )}
            {form.tipo_aumento === 'IPC' && (
              <div className="space-y-1.5">
                <Button type="button" variant="outline" size="sm" disabled={ipcMut.isPending} onClick={handleTraerIpc}>
                  {ipcMut.isPending ? 'Consultando…' : `Traer IPC de ${MESES[Number(form.periodo_mes) - 1]} ${form.periodo_anio} →`}
                </Button>
                {ipcInfo && (
                  <p className="text-xs text-muted-foreground">
                    IPC {ipcInfo.mes}: {ipcInfo.valor.toLocaleString('es-AR')}% (variación mensual — Fuente: INDEC)
                  </p>
                )}
                {ipcError && <p className="text-xs text-destructive">{ipcError}</p>}
                {(ipcError || ipcInfo) && (
                  <div>
                    <label className={labelCls}>Porcentaje {ipcError && '(ingresalo manualmente)'}</label>
                    <input type="number" min="0" step="0.01" value={form.porcentaje_aumento} onChange={e => set('porcentaje_aumento', e.target.value)} className={inputCls} placeholder="%" />
                  </div>
                )}
              </div>
            )}
            {basicoConAumento !== null && (
              <p className="text-xs text-muted-foreground">Básico con aumento: {formatCurrency(basicoConAumento)}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className={labelCls}>💰 Préstamos a descontar este mes</label>
            {prestamosPendientes.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sin préstamos pendientes.</p>
            ) : (
              <>
                {prestamosPendientes.map(p => (
                  <label key={p.id} className="flex items-center gap-2 text-xs cursor-pointer">
                    <input type="checkbox" checked={prestamosSel.has(p.id)} onChange={() => togglePrestamo(p.id)} />
                    {p.detalle} — Cuota {formatCurrency(p.monto_cuota)} ({p.cuotas_pagadas + 1} de {p.cantidad_cuotas})
                  </label>
                ))}
                {totalPrestamosSel > 0 && (
                  <p className="text-xs text-muted-foreground">Total de descuentos: {formatCurrency(totalPrestamosSel)}</p>
                )}
                <p className="text-[11px] text-muted-foreground">
                  Esta selección es sólo para el preview — se confirma al aprobar la liquidación.
                </p>
              </>
            )}
          </div>

          {form.empleado_id && (
            <GenerarPreview
              empleadoId={Number(form.empleado_id)}
              horasTrabajadas={form.horas_trabajadas}
              valesDescuentos={totalAnticiposSel}
              vacacionesAguinaldo={form.vacaciones_aguinaldo}
              prestamosDescuento={totalPrestamosSel}
              viaticoOverride={form.viatico_override ? Number(form.viatico_override) : null}
              aumentoPorcentaje={aumentoPorcentaje}
              presentismo={presentismo}
              premioPresentismoOverride={form.premio_presentismo_override ? Number(form.premio_presentismo_override) : null}
            />
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

// ── Dialog: Editar (BORRADOR) ─────────────────────────────────────────────────

function EditarDialog({ liquidacion, onClose }: { liquidacion: LiquidacionAdmin | null; onClose: () => void }) {
  const updateMut = useUpdateLiquidacionAdmin();
  const [form, setForm] = useState({ horas_trabajadas: '', vales_descuentos: '', vacaciones_aguinaldo: '' });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (liquidacion) {
      setForm({
        horas_trabajadas:     String(liquidacion.horas_trabajadas),
        vales_descuentos:     String(liquidacion.vales_descuentos),
        vacaciones_aguinaldo: String(liquidacion.vacaciones_aguinaldo),
      });
      setError(null);
    }
  }, [liquidacion]);

  if (!liquidacion) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await updateMut.mutateAsync({
        id: liquidacion.id,
        data: {
          horas_trabajadas:     Number(form.horas_trabajadas),
          vales_descuentos:     Number(form.vales_descuentos),
          vacaciones_aguinaldo: Number(form.vacaciones_aguinaldo),
        },
      });
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err) ?? 'Error al editar');
    }
  };

  return (
    <Dialog open={!!liquidacion} onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Editar liquidación — {liquidacion.empleado?.apellido}, {liquidacion.empleado?.nombre}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 mt-1">
          <div>
            <label className={labelCls}>Horas trabajadas</label>
            <input type="number" min="0" step="0.5" value={form.horas_trabajadas} onChange={e => setForm(p => ({ ...p, horas_trabajadas: e.target.value }))} className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Vales/Descuentos ($)</label>
              <MoneyInput value={form.vales_descuentos} onChange={v => setForm(p => ({ ...p, vales_descuentos: v }))} />
            </div>
            <div>
              <label className={labelCls}>Vacaciones/Aguinaldo ($)</label>
              <MoneyInput value={form.vacaciones_aguinaldo} onChange={v => setForm(p => ({ ...p, vacaciones_aguinaldo: v }))} />
            </div>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={updateMut.isPending}>{updateMut.isPending ? 'Guardando…' : 'Guardar'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Dialog: Aprobar (elegir cuenta de pago por empresa) ───────────────────────

function CuentaSelectEmpresa({ empresaId, empresaLabel, monto, value, onChange }: {
  empresaId: number; empresaLabel: string; monto: number; value: string; onChange: (v: string) => void;
}) {
  const { data: cuentas = [], isLoading } = useCuentasPorEmpresa(empresaId);
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium">{empresaLabel} — {formatCurrency(monto)}</p>
      <select value={value} onChange={e => onChange(e.target.value)} className={inputCls} disabled={isLoading}>
        <option value="">{isLoading ? 'Cargando cuentas...' : 'Seleccionar cuenta...'}</option>
        {cuentas.map(c => <option key={c.id} value={c.id}>{c.nombre} ({c.moneda})</option>)}
      </select>
      {!isLoading && cuentas.length === 0 && <p className="text-xs text-destructive">Sin cuentas configuradas para esta empresa</p>}
    </div>
  );
}

function AprobarDialog({ liquidacion, onClose }: { liquidacion: LiquidacionAdmin | null; onClose: () => void }) {
  const aprobarMut = useAprobarLiquidacionAdmin();
  const { data: detalle } = useLiquidacionAdmin(liquidacion?.id ?? null);
  const [cuentas, setCuentas] = useState<Record<number, string>>({});
  // prestamo_id -> monto (string) — sólo presente si está tildado
  const [prestamosSel, setPrestamosSel] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setCuentas({}); setPrestamosSel({}); setError(null); }, [liquidacion]);

  if (!liquidacion) return null;

  const prestamosPendientes = detalle?.prestamos_pendientes ?? [];
  const totalPrestamos = Object.values(prestamosSel).reduce((s, v) => s + (parseFloat(v) || 0), 0);
  const totalNeto = Math.round((liquidacion.subtotal_bruto - liquidacion.vales_descuentos - totalPrestamos) * 100) / 100;

  const togglePrestamo = (id: number, montoCuota: number, checked: boolean) => {
    setPrestamosSel(prev => {
      const next = { ...prev };
      if (checked) next[id] = String(montoCuota); else delete next[id];
      return next;
    });
  };

  // Desglose para elegir cuenta — recalculado sobre el total neto (post
  // préstamos) para que el monto por cuenta sea el que efectivamente se paga.
  // El backend recalcula esto con precisión exacta al aprobar; acá es sólo
  // para mostrar un monto de referencia por empresa.
  const splitsBase = liquidacion.splits && liquidacion.splits.length > 0
    ? liquidacion.splits
    : [{ empresa_id: liquidacion.empresa_id, empresa_nombre: '', porcentaje: 100 }];
  const desglose = splitsBase.map(d => ({ ...d, monto: Math.round(totalNeto * d.porcentaje / 100 * 100) / 100 }));

  const faltaCuenta = desglose.some(d => !cuentas[d.empresa_id]);

  const handleAprobar = async () => {
    setError(null);
    try {
      await aprobarMut.mutateAsync({
        id: liquidacion.id,
        cuentas_pago: desglose.map(d => ({ empresa_id: d.empresa_id, cuenta_id: Number(cuentas[d.empresa_id]) })),
        prestamos_a_descontar: Object.entries(prestamosSel).map(([prestamo_id, monto]) => ({ prestamo_id: Number(prestamo_id), monto: parseFloat(monto) })),
      });
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err) ?? 'Error al aprobar');
    }
  };

  return (
    <Dialog open={!!liquidacion} onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Aprobar liquidación — {liquidacion.empleado?.apellido}, {liquidacion.empleado?.nombre}</DialogTitle></DialogHeader>
        <div className="space-y-3 mt-1">
          <p className="text-sm text-muted-foreground">
            Total: <span className="font-semibold text-foreground">{formatCurrency(liquidacion.total_a_cobrar)}</span>
          </p>

          {prestamosPendientes.length > 0 && (
            <div className="space-y-1.5 rounded-md border border-border p-2.5">
              <p className="text-xs font-medium">Préstamos a descontar</p>
              {prestamosPendientes.map(p => {
                const checked = p.id in prestamosSel;
                return (
                  <div key={p.id} className="flex items-center gap-2 text-xs">
                    <input type="checkbox" checked={checked} onChange={e => togglePrestamo(p.id, p.monto_cuota, e.target.checked)} />
                    <span className="flex-1">{p.detalle} — cuota {p.cuotas_pagadas + 1} de {p.cantidad_cuotas}</span>
                    {checked ? (
                      <MoneyInput
                        value={prestamosSel[p.id]}
                        onChange={v => setPrestamosSel(prev => ({ ...prev, [p.id]: v }))}
                        className="w-24"
                      />
                    ) : (
                      <span className="text-muted-foreground">{formatCurrency(p.monto_cuota)}</span>
                    )}
                  </div>
                );
              })}
              {totalPrestamos > 0 && (
                <p className="text-xs text-destructive pt-1 border-t border-border">
                  Descuentos: {formatCurrency(totalPrestamos)} ({prestamosPendientes.filter(p => p.id in prestamosSel).map(p => p.detalle).join(', ')})
                </p>
              )}
            </div>
          )}

          {totalPrestamos > 0 && (
            <p className="text-sm">
              Total a cobrar neto: <span className="font-semibold text-foreground">{formatCurrency(totalNeto)}</span>
            </p>
          )}

          <p className="text-xs text-muted-foreground">Elegí desde qué cuenta se paga cada parte.</p>
          {desglose.map(d => (
            <CuentaSelectEmpresa
              key={d.empresa_id}
              empresaId={d.empresa_id}
              empresaLabel={desglose.length > 1 ? `${d.empresa_nombre} (${d.porcentaje}%)` : (d.empresa_nombre || 'Empresa')}
              monto={d.monto ?? 0}
              value={cuentas[d.empresa_id] ?? ''}
              onChange={v => setCuentas(p => ({ ...p, [d.empresa_id]: v }))}
            />
          ))}
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button type="button" size="sm" disabled={faltaCuenta || aprobarMut.isPending} onClick={handleAprobar}>
              {aprobarMut.isPending ? 'Aprobando…' : 'Confirmar y aprobar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Tab ────────────────────────────────────────────────────────────────────────

export default function LiquidacionesTab({ empleadoIdInicial, mesInicial, anioInicial }: {
  empleadoIdInicial?: number | null;
  mesInicial?:        number | null;
  anioInicial?:       number | null;
}) {
  const [filtros, setFiltros] = useState<LiquidacionAdminFiltros>({});
  useEffect(() => { if (empleadoIdInicial != null) setFiltros(p => ({ ...p, empleado_id: empleadoIdInicial })); }, [empleadoIdInicial]);
  // Deep-link desde "Ver liquidaciones del período" (Gastos del mes, Andrea).
  useEffect(() => {
    if (mesInicial != null || anioInicial != null) {
      setFiltros(p => ({ ...p, ...(mesInicial != null && { mes: mesInicial }), ...(anioInicial != null && { anio: anioInicial }) }));
    }
  }, [mesInicial, anioInicial]);

  const { data: liquidaciones = [], isLoading } = useLiquidacionesAdmin(filtros);
  const { data: empleados = [] } = useEmpleados();
  const cancelarMut = useCancelarLiquidacionAdmin();

  // Totales de nómina — sólo tiene sentido mostrarlos cuando el filtro está
  // acotado a un mes y año puntuales (si no, "TOTAL NÓMINA" no tendría período).
  const { data: resumen } = useResumenMensual(filtros.mes ?? null, filtros.anio ?? null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editando, setEditando]   = useState<LiquidacionAdmin | null>(null);
  const [aprobando, setAprobando] = useState<LiquidacionAdmin | null>(null);

  const handleCancelar = (id: number) => {
    if (!window.confirm('¿Cancelar esta liquidación?')) return;
    cancelarMut.mutate(id, { onError: (err) => alert(getApiErrorMessage(err) ?? 'Error al cancelar') });
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 justify-between mb-4">
        <div className="flex flex-wrap gap-2">
          <select value={filtros.empleado_id ?? ''} onChange={e => setFiltros(p => ({ ...p, empleado_id: e.target.value ? Number(e.target.value) : undefined }))} className={inputCls}>
            <option value="">Todos los empleados</option>
            {empleados.map(emp => <option key={emp.id} value={emp.id}>{emp.apellido}, {emp.nombre}</option>)}
          </select>
          <select value={filtros.mes ?? ''} onChange={e => setFiltros(p => ({ ...p, mes: e.target.value ? Number(e.target.value) : undefined }))} className={inputCls}>
            <option value="">Todos los meses</option>
            {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select value={filtros.anio ?? ''} onChange={e => setFiltros(p => ({ ...p, anio: e.target.value ? Number(e.target.value) : undefined }))} className={inputCls}>
            <option value="">Todos los años</option>
            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <select value={filtros.estado ?? ''} onChange={e => setFiltros(p => ({ ...p, estado: (e.target.value || undefined) as EstadoLiquidacionAdmin | undefined }))} className={inputCls}>
            <option value="">Todos los estados</option>
            {Object.entries(ESTADO_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)}><Plus size={14} className="mr-1.5" /> Generar liquidación</Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-border">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Empleado</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Período</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Básico</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Extras</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Descuentos</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Total</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Estado</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {liquidaciones.length === 0 ? (
                <tr><td colSpan={8} className="px-3 py-6 text-center text-sm text-muted-foreground">No hay liquidaciones generadas.</td></tr>
              ) : liquidaciones.map(l => (
                <tr key={l.id} className="hover:bg-muted/20">
                  <td className="px-3 py-2.5 font-medium">{l.empleado ? `${l.empleado.apellido}, ${l.empleado.nombre}` : '-'}</td>
                  <td className="px-3 py-2.5">{MESES[l.periodo_mes - 1]} {l.periodo_anio}</td>
                  <td className="px-3 py-2.5 text-right">{formatCurrency(l.sueldo_basico)}</td>
                  <td className="px-3 py-2.5 text-right">{formatCurrency(l.importe_horas_extras)}</td>
                  <td className="px-3 py-2.5 text-right">{formatCurrency(l.vales_descuentos)}</td>
                  <td className="px-3 py-2.5 text-right font-semibold">{formatCurrency(l.total_a_cobrar)}</td>
                  <td className="px-3 py-2.5"><Badge variant={ESTADO_VARIANT[l.estado]}>{ESTADO_LABEL[l.estado]}</Badge></td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      {l.estado === 'BORRADOR' && (
                        <>
                          <Button variant="outline" size="sm" onClick={() => setEditando(l)}>Editar</Button>
                          <Button variant="outline" size="sm" onClick={() => setAprobando(l)}>Aprobar</Button>
                          <Button variant="ghost" size="sm" onClick={() => handleCancelar(l.id)} className="text-destructive hover:text-destructive">Cancelar</Button>
                        </>
                      )}
                      <Button variant="ghost" size="icon" title="Exportar PDF" onClick={() => descargarLiquidacionAdminPDF(l.id)}>
                        <Download size={14} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            {resumen && liquidaciones.length > 0 && (
              <tfoot className="bg-gray-50 border-t-2 border-border">
                <tr>
                  <td colSpan={2} className="px-3 py-2 text-sm font-semibold">TOTAL NÓMINA {resumen.periodo.toUpperCase()}</td>
                  <td className="px-3 py-2 text-right font-semibold">{formatCurrency(resumen.totales.basico)}</td>
                  <td className="px-3 py-2 text-right font-semibold">{formatCurrency(resumen.totales.extras)}</td>
                  <td className="px-3 py-2 text-right font-semibold">{formatCurrency(resumen.totales.descuentos + resumen.totales.prestamos)}</td>
                  <td className="px-3 py-2 text-right font-semibold">{formatCurrency(resumen.totales.total)}</td>
                  <td colSpan={2} />
                </tr>
                {resumen.totales.por_empresa.map(pe => (
                  <tr key={pe.empresa_nombre}>
                    <td colSpan={5} className="px-3 py-1 text-right text-xs text-muted-foreground">TOTAL {pe.empresa_nombre.toUpperCase()}</td>
                    <td className="px-3 py-1 text-right text-xs text-muted-foreground">{formatCurrency(pe.monto)}</td>
                    <td colSpan={2} />
                  </tr>
                ))}
              </tfoot>
            )}
          </table>
        </div>
      )}

      <GenerarDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
      <EditarDialog liquidacion={editando} onClose={() => setEditando(null)} />
      <AprobarDialog liquidacion={aprobando} onClose={() => setAprobando(null)} />
    </div>
  );
}
