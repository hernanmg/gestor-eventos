import { useState } from 'react';
import { Calculator, Plus, Trash2, Pencil } from 'lucide-react';
import {
  useAguinaldoSugerido, usePremiosPuntuales, usePremiosVigentes, useGuardarPremioPuntual, useDeletePremioPuntual,
  useUpdateFormaPagoLiquidacion, useUpdateFormaPagoAcuerdo, useAcuerdos,
  type ResumenMensual, type ResumenMensualEmpleado,
} from '@/hooks/useSueldosAdmin';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import MoneyInput from '@/components/ui/MoneyInput';
import BaseTable from '@/components/ui/BaseTable';
import { formatCurrency } from '@/lib/formatters';
import { cn, getApiErrorMessage } from '@/lib/utils';
import type { AguinaldoSugerido, FormaPagoSueldo, PremioPuntual } from '@/types';

// Conceptos que Mayra hoy junta en una sola celda ("VACACIONES/AGUINALDOS/
// EXTRAS"), los premios que Matías da por un tiempo y el cierre del mes
// (efectivo / transferencia, hoja TOTALES).

const inputCls = 'w-full border border-input rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring';
const labelCls = 'block text-xs font-medium text-muted-foreground mb-0.5';
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

// ── Vacaciones / aguinaldo / extras ──────────────────────────────────────────

export interface ConceptosForm { vacaciones: string; aguinaldo: string; extras: string; extras_detalle: string }
export const CONCEPTOS_VACIOS: ConceptosForm = { vacaciones: '', aguinaldo: '', extras: '', extras_detalle: '' };
export const totalConceptos = (c: ConceptosForm) => (parseFloat(c.vacaciones) || 0) + (parseFloat(c.aguinaldo) || 0) + (parseFloat(c.extras) || 0);

export function ConceptosMesFields({ value, onChange, empleadoId, mes, anio, baseActual }: {
  value: ConceptosForm; onChange: (v: ConceptosForm) => void;
  empleadoId: number | null; mes: number; anio: number;
  // Sueldo de este mes sin vacaciones/aguinaldo/extras (de la vista previa),
  // para incluirlo en el cálculo del aguinaldo si todavía no está generado.
  baseActual?: number;
}) {
  const sugerir = useAguinaldoSugerido();
  const [detalle, setDetalle] = useState<AguinaldoSugerido | null>(null);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof ConceptosForm, v: string) => onChange({ ...value, [k]: v });
  const esMesAguinaldo = mes === 6 || mes === 12;

  const calcular = async () => {
    if (!empleadoId) return;
    setError(null);
    try {
      const r = await sugerir.mutateAsync({ empleadoId, mes, anio, base_actual: baseActual !== undefined ? Math.round(baseActual * 100) / 100 : undefined });
      setDetalle(r);
      set('aguinaldo', String(r.aguinaldo));
    } catch (err) { setError(getApiErrorMessage(err)); }
  };

  return (
    <div className="rounded-md border border-border p-3 space-y-2">
      <p className="text-xs font-medium">Vacaciones, aguinaldo y extras</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Vacaciones ($)</label>
          <MoneyInput value={value.vacaciones} onChange={v => set('vacaciones', v)} />
        </div>
        <div>
          <label className={labelCls}>
            Aguinaldo ($)
            {empleadoId && (
              <button type="button" onClick={calcular} disabled={sugerir.isPending}
                className={cn('ml-2 inline-flex items-center gap-0.5 text-link hover:underline', !esMesAguinaldo && 'text-muted-foreground')}>
                <Calculator size={11} /> {sugerir.isPending ? 'calculando…' : 'calcular'}
              </button>
            )}
          </label>
          <MoneyInput value={value.aguinaldo} onChange={v => set('aguinaldo', v)} />
        </div>
        <div>
          <label className={labelCls}>Extras / premio de este mes ($)</label>
          <MoneyInput value={value.extras} onChange={v => set('extras', v)} />
        </div>
        <div>
          <label className={labelCls}>Aclaración de los extras</label>
          <input value={value.extras_detalle} onChange={e => set('extras_detalle', e.target.value)} className={inputCls}
            placeholder="Premio productividad…" disabled={!(parseFloat(value.extras) > 0)} />
        </div>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {detalle && (
        <div className="text-[11px] text-muted-foreground border-t border-border pt-1.5 space-y-0.5">
          <p className="font-medium text-foreground">Aguinaldo {detalle.semestre}: suma de los sueldos ÷ 6 ÷ 2, como en la planilla</p>
          <div className="grid grid-cols-3 gap-x-3">
            {detalle.meses.map(m => (
              <span key={m.mes} className={cn(m.base === null && 'text-yellow-800')}>
                {m.nombre}: {m.base === null ? 'sin sueldo' : formatCurrency(m.base)}{m.origen === 'este_mes' ? ' (este mes)' : ''}
              </span>
            ))}
          </div>
          <p>Suma {formatCurrency(detalle.suma)} · promedio {formatCurrency(detalle.promedio)} · aguinaldo <span className="font-semibold text-foreground">{formatCurrency(detalle.aguinaldo)}</span></p>
          {detalle.meses_sin_dato.length > 0 && (
            <p className="text-yellow-800">
              Sin sueldo en el sistema: {detalle.meses_sin_dato.join(', ')}. Si trabajó esos meses, el monto queda bajo: corregilo a mano.
            </p>
          )}
        </div>
      )}
      {!esMesAguinaldo && !detalle && (
        <p className="text-[11px] text-muted-foreground">El aguinaldo se paga en junio y diciembre; "calcular" toma los sueldos del semestre de este mes.</p>
      )}
    </div>
  );
}

// ── Premios puntuales ────────────────────────────────────────────────────────

const periodoLabel = (p: PremioPuntual) =>
  `desde ${MESES[p.desde_mes - 1].toLowerCase()} ${p.desde_anio}${p.hasta_mes ? ` hasta ${MESES[p.hasta_mes - 1].toLowerCase()} ${p.hasta_anio}` : ', sin fecha de fin'}`;

function PremioDialog({ empleadoId, premio, mes, anio, onClose }: {
  empleadoId: number; premio: PremioPuntual | null; mes: number; anio: number; onClose: () => void;
}) {
  const guardar = useGuardarPremioPuntual(empleadoId);
  const [f, setF] = useState({
    nombre: premio?.nombre ?? '', monto: premio ? String(premio.monto) : '',
    desde_mes: String(premio?.desde_mes ?? mes), desde_anio: String(premio?.desde_anio ?? anio),
    con_fin: !!premio?.hasta_mes,
    hasta_mes: String(premio?.hasta_mes ?? mes), hasta_anio: String(premio?.hasta_anio ?? anio),
    notas: premio?.notas ?? '',
  });
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await guardar.mutateAsync({
        id: premio?.id,
        data: {
          nombre: f.nombre.trim(), monto: Number(f.monto),
          desde_mes: Number(f.desde_mes), desde_anio: Number(f.desde_anio),
          hasta_mes: f.con_fin ? Number(f.hasta_mes) : null, hasta_anio: f.con_fin ? Number(f.hasta_anio) : null,
          notas: f.notas.trim() || null,
        },
      });
      onClose();
    } catch (err) { setError(getApiErrorMessage(err)); }
  };
  const mesSelect = (k: 'desde_mes' | 'hasta_mes') => (
    <select value={f[k]} onChange={e => setF(p => ({ ...p, [k]: e.target.value }))} className={inputCls}>
      {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
    </select>
  );
  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{premio ? 'Editar premio' : 'Nuevo premio de Matías'}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3 mt-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className={labelCls}>Nombre *</label>
              <input value={f.nombre} onChange={e => setF(p => ({ ...p, nombre: e.target.value }))} className={inputCls} placeholder="Premio casa" required />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Monto por mes *</label>
              <MoneyInput value={f.monto} onChange={v => setF(p => ({ ...p, monto: v }))} />
            </div>
            <div><label className={labelCls}>Desde</label>{mesSelect('desde_mes')}</div>
            <div><label className={labelCls}>Año</label><input type="number" value={f.desde_anio} onChange={e => setF(p => ({ ...p, desde_anio: e.target.value }))} className={inputCls} /></div>
            <label className="col-span-2 flex items-center gap-2 text-xs">
              <input type="checkbox" checked={f.con_fin} onChange={e => setF(p => ({ ...p, con_fin: e.target.checked }))} />
              Tiene fecha de fin (si no, sigue hasta que lo termines)
            </label>
            {f.con_fin && (
              <>
                <div><label className={labelCls}>Hasta (último mes que lo cobra)</label>{mesSelect('hasta_mes')}</div>
                <div><label className={labelCls}>Año</label><input type="number" value={f.hasta_anio} onChange={e => setF(p => ({ ...p, hasta_anio: e.target.value }))} className={inputCls} /></div>
              </>
            )}
            <div className="col-span-2">
              <label className={labelCls}>Notas</label>
              <input value={f.notas} onChange={e => setF(p => ({ ...p, notas: e.target.value }))} className={inputCls} />
            </div>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={guardar.isPending || !f.monto}>Guardar</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function PremiosPuntualesPanel({ empleadoId, mes, anio, excluidos, onToggle }: {
  empleadoId: number; mes: number; anio: number;
  excluidos: Set<number>; onToggle: (id: number) => void;
}) {
  const { data: vigentes = [] } = usePremiosVigentes(empleadoId, mes, anio);
  const { data: todos = [] } = usePremiosPuntuales(empleadoId);
  const borrar = useDeletePremioPuntual();
  const guardar = useGuardarPremioPuntual(empleadoId);
  const [editando, setEditando] = useState<PremioPuntual | null | 'nuevo'>(null);
  const [verTodos, setVerTodos] = useState(false);
  const vigentesIds = new Set(vigentes.map(v => v.id));
  const otros = todos.filter(p => !vigentesIds.has(p.id));

  // "Terminar": el último mes que lo cobra es el anterior al que se liquida.
  const terminar = (p: PremioPuntual) => {
    const fin = mes === 1 ? { m: 12, a: anio - 1 } : { m: mes - 1, a: anio };
    if (!window.confirm(`¿"${p.nombre}" deja de cobrarse desde ${MESES[mes - 1].toLowerCase()} ${anio}?`)) return;
    guardar.mutate({ id: p.id, data: { nombre: p.nombre, monto: p.monto, desde_mes: p.desde_mes, desde_anio: p.desde_anio, hasta_mes: fin.m, hasta_anio: fin.a, notas: p.notas } },
      { onError: err => alert(getApiErrorMessage(err)) });
  };

  return (
    <div className="rounded-md border border-border p-3 space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium">Premios de Matías (por un tiempo)</p>
        <button type="button" onClick={() => setEditando('nuevo')} className="text-xs text-link hover:underline inline-flex items-center gap-0.5"><Plus size={11} /> agregar</button>
      </div>
      {vigentes.length === 0 ? (
        <p className="text-xs text-muted-foreground">No tiene premios vigentes en {MESES[mes - 1].toLowerCase()}.</p>
      ) : vigentes.map(v => {
        const p = todos.find(t => t.id === v.id);
        return (
          <div key={v.id} className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={!excluidos.has(v.id)} onChange={() => onToggle(v.id)} title="Sumarlo este mes" />
            <span className={cn('flex-1', excluidos.has(v.id) && 'line-through text-muted-foreground')}>
              {v.nombre} — {formatCurrency(v.monto)}
              {p && <span className="text-muted-foreground"> · {periodoLabel(p)}</span>}
            </span>
            {p && <button type="button" onClick={() => setEditando(p)} className="text-muted-foreground hover:text-foreground" title="Editar"><Pencil size={11} /></button>}
            {p && <button type="button" onClick={() => terminar(p)} className="text-link hover:underline">terminar</button>}
          </div>
        );
      })}
      {otros.length > 0 && (
        <button type="button" onClick={() => setVerTodos(v => !v)} className="text-[11px] text-muted-foreground hover:underline">
          {verTodos ? 'Ocultar' : `Ver ${otros.length} premio(s) de otros meses`}
        </button>
      )}
      {verTodos && otros.map(p => (
        <div key={p.id} className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="flex-1">{p.nombre} — {formatCurrency(p.monto)} · {periodoLabel(p)}</span>
          <button type="button" onClick={() => setEditando(p)} title="Editar"><Pencil size={11} /></button>
          <button type="button" title="Eliminar (cargado por error)" className="text-destructive" onClick={() => {
            if (window.confirm(`¿Eliminar "${p.nombre}"? Las liquidaciones ya generadas no cambian.`)) borrar.mutate(p.id);
          }}><Trash2 size={11} /></button>
        </div>
      ))}
      {editando && (
        <PremioDialog empleadoId={empleadoId} premio={editando === 'nuevo' ? null : editando} mes={mes} anio={anio} onClose={() => setEditando(null)} />
      )}
    </div>
  );
}

// ── Cierre del mes: efectivo / transferencia ─────────────────────────────────

export const FORMA_PAGO_LABEL: Record<FormaPagoSueldo, string> = { TRANSFERENCIA: 'Transferencia', EFECTIVO: 'Efectivo', A_DEFINIR: 'A definir cada mes' };

function FormaPagoDialog({ fila, onClose }: { fila: ResumenMensualEmpleado; onClose: () => void }) {
  const guardar = useUpdateFormaPagoLiquidacion();
  const [ef, setEf] = useState(String(fila.efectivo || ''));
  const [tr, setTr] = useState(String(fila.transferencia || ''));
  const [error, setError] = useState<string | null>(null);
  const resto = Math.round((fila.total - (parseFloat(ef) || 0) - (parseFloat(tr) || 0)) * 100) / 100;
  const enviar = async (monto_efectivo: number | null, monto_transferencia: number | null) => {
    setError(null);
    try { await guardar.mutateAsync({ id: fila.liquidacion_id, monto_efectivo, monto_transferencia }); onClose(); }
    catch (err) { setError(getApiErrorMessage(err)); }
  };
  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>Cómo se paga — {fila.empleado_nombre}</DialogTitle></DialogHeader>
        <div className="space-y-3 mt-1">
          <p className="text-sm">A cobrar: <span className="font-semibold">{formatCurrency(fila.total)}</span></p>
          <div className="flex gap-1.5">
            <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => { setEf(String(fila.total)); setTr(''); }}>Todo efectivo</Button>
            <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => { setTr(String(fila.total)); setEf(''); }}>Todo transferencia</Button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Efectivo</label><MoneyInput value={ef} onChange={setEf} /></div>
            <div><label className={labelCls}>Transferencia</label><MoneyInput value={tr} onChange={setTr} /></div>
          </div>
          <p className={cn('text-xs', resto < 0 ? 'text-destructive' : resto > 0 ? 'text-yellow-800' : 'text-muted-foreground')}>
            {resto === 0 ? 'Queda todo asignado.' : resto > 0 ? `Sin asignar: ${formatCurrency(resto)} (queda como saldo / faltante)` : `Te pasaste ${formatCurrency(-resto)}`}
          </p>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-between gap-2">
            <Button type="button" variant="ghost" size="sm" className="text-xs" onClick={() => enviar(null, null)} title="Usar la forma de pago habitual del acuerdo">
              Volver a la habitual ({FORMA_PAGO_LABEL[fila.forma_pago].toLowerCase()})
            </Button>
            <Button type="button" size="sm" disabled={guardar.isPending || resto < 0}
              onClick={() => enviar(parseFloat(ef) || 0, parseFloat(tr) || 0)}>Guardar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function CierreMesPanel({ resumen }: { resumen: ResumenMensual }) {
  const [editando, setEditando] = useState<ResumenMensualEmpleado | null>(null);
  const { data: acuerdos = [] } = useAcuerdos();
  const cambiarHabitual = useUpdateFormaPagoAcuerdo();
  const t = resumen.totales;
  const acuerdoDe = (empleadoId: number) => acuerdos.find(a => a.empleado_id === empleadoId);
  const filas = resumen.empleados.filter(e => e.estado !== 'CANCELADA');
  if (filas.length === 0) return null;

  return (
    <div className="mt-6 space-y-2">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Cierre de sueldos — {resumen.periodo}</h3>
          <p className="text-xs text-muted-foreground">Cuánto se paga en efectivo y cuánto por transferencia. Tocá una fila para repartirla.</p>
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          <span>Efectivo <span className="font-semibold tabular-nums">{formatCurrency(t.efectivo)}</span></span>
          <span>Transferencias <span className="font-semibold tabular-nums">{formatCurrency(t.transferencia)}</span></span>
          {t.sin_asignar !== 0 && <span className="text-yellow-800">Sin asignar <span className="font-semibold tabular-nums">{formatCurrency(t.sin_asignar)}</span></span>}
        </div>
      </div>
      {(t.vacaciones > 0 || t.aguinaldo > 0 || t.extras_mes > 0 || t.premios_puntuales > 0) && (
        <p className="text-xs text-muted-foreground">
          Incluye: {[
            t.aguinaldo > 0 && `aguinaldo ${formatCurrency(t.aguinaldo)}`,
            t.vacaciones > 0 && `vacaciones ${formatCurrency(t.vacaciones)}`,
            t.extras_mes > 0 && `extras ${formatCurrency(t.extras_mes)}`,
            t.premios_puntuales > 0 && `premios de Matías ${formatCurrency(t.premios_puntuales)}`,
          ].filter(Boolean).join(' · ')}
        </p>
      )}
      <div className="overflow-x-auto">
        <BaseTable className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-border">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Empleado</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Forma habitual</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">A cobrar</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Efectivo</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Transferencia</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Sin asignar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filas.map(e => {
              const acuerdo = acuerdoDe(e.empleado_id);
              return (
                <tr key={e.liquidacion_id} className="hover:bg-muted/20 cursor-pointer" onClick={() => setEditando(e)}>
                  <td className="px-3 py-2" data-label="Empleado">{e.empleado_nombre}</td>
                  <td className="px-3 py-2" data-label="Forma habitual" onClick={ev => ev.stopPropagation()}>
                    {acuerdo ? (
                      <select value={e.forma_pago} className="border border-input rounded px-1.5 py-0.5 text-xs bg-white"
                        onChange={ev => cambiarHabitual.mutate({ acuerdoId: acuerdo.id, forma_pago: ev.target.value as FormaPagoSueldo }, { onError: err => alert(getApiErrorMessage(err)) })}>
                        {(Object.keys(FORMA_PAGO_LABEL) as FormaPagoSueldo[]).map(f => <option key={f} value={f}>{FORMA_PAGO_LABEL[f]}</option>)}
                      </select>
                    ) : FORMA_PAGO_LABEL[e.forma_pago]}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums" data-label="A cobrar">{formatCurrency(e.total)}</td>
                  <td className="px-3 py-2 text-right tabular-nums" data-label="Efectivo">{e.efectivo ? formatCurrency(e.efectivo) : '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums" data-label="Transferencia">{e.transferencia ? formatCurrency(e.transferencia) : '—'}</td>
                  <td className={cn('px-3 py-2 text-right tabular-nums', e.sin_asignar !== 0 && 'text-yellow-800 font-medium')} data-label="Sin asignar">
                    {e.sin_asignar !== 0 ? formatCurrency(e.sin_asignar) : '—'}
                    {e.pago_manual && <span className="block text-[10px] text-muted-foreground">repartido a mano</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-gray-50 border-t-2 border-border">
            <tr>
              <td colSpan={2} className="px-3 py-2 text-sm font-semibold">Totales</td>
              <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatCurrency(t.total)}</td>
              <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatCurrency(t.efectivo)}</td>
              <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatCurrency(t.transferencia)}</td>
              <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatCurrency(t.sin_asignar)}</td>
            </tr>
          </tfoot>
        </BaseTable>
      </div>
      {editando && <FormaPagoDialog fila={editando} onClose={() => setEditando(null)} />}
    </div>
  );
}
