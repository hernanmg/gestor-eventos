import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useEmpleados } from '@/hooks/useRRHH';
import { useAuth } from '@/hooks/useAuth';
import { useEscalafones } from '@/hooks/useEscalafones';
import {
  useAcuerdos, useCreateAcuerdo, useUpdateAcuerdo, useUpsertSplits, useEmpresasSueldos,
  type AcuerdoPayload,
} from '@/hooks/useSueldosAdmin';
import { previewSueldoBasico } from '@/lib/calcularSueldoAdmin';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { cn, getApiErrorMessage } from '@/lib/utils';
import type { AcuerdoSueldo } from '@/types';

const inputCls = 'w-full border border-input rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring';
const labelCls = 'block text-xs font-medium text-muted-foreground mb-0.5';

const EMPTY_FORM = {
  empleado_id: '', escalafon: '', escalafonOtro: '', tipo_seguro: '', fecha_inicio: '', vigencia_meses: '',
  sueldo_basico: '', horas_acordadas_mes: '200', valor_hora_extra: '',
  premio_incentivo: '', viatico: '', premio_presentismo: '', telefono: '', notas: '',
};

type Step = 1 | 2 | 3;

// ── Dialog: Nuevo acuerdo (wizard de 3 pasos — Mejora 2) ──────────────────────
// Paso 1: empleado + escalafón (dispara pre-carga de paso 3) + seguro/fechas.
// Paso 2: sueldo básico + split entre empresas, combinados.
// Paso 3: conceptos pre-cargados desde el escalafón, editables + preview total.

function NuevoAcuerdoDialog({ open, onClose, empleadosDisponibles }: {
  open: boolean; onClose: () => void; empleadosDisponibles: { id: number; nombre: string; apellido: string }[];
}) {
  const { user } = useAuth();
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState(EMPTY_FORM);
  const [splitActivo, setSplitActivo] = useState(false);
  const [splits, setSplits] = useState<{ empresa_id: string; porcentaje: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  const { data: empresas = [] }    = useEmpresasSueldos();
  const { data: escalafones = [] } = useEscalafones();
  const createMut = useCreateAcuerdo();
  const splitsMut  = useUpsertSplits();

  const reset = () => { setStep(1); setForm(EMPTY_FORM); setSplitActivo(false); setSplits([]); setError(null); };
  const handleClose = () => { reset(); onClose(); };

  const set = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }));

  // Al elegir un escalafón conocido → pre-carga los conceptos del paso 3.
  const handleEscalafonChange = (nombre: string) => {
    const match = escalafones.find(e => e.nombre === nombre);
    setForm(p => ({
      ...p,
      escalafon:          nombre,
      premio_incentivo:   match?.premio_incentivo   !== null && match?.premio_incentivo   !== undefined ? String(match.premio_incentivo)   : '',
      viatico:            match?.viatico            !== null && match?.viatico            !== undefined ? String(match.viatico)            : '',
      premio_presentismo: match?.premio_presentismo !== null && match?.premio_presentismo !== undefined ? String(match.premio_presentismo) : '',
      telefono:           match?.telefono           !== null && match?.telefono           !== undefined ? String(match.telefono)           : '',
    }));
  };

  const escalafonFinal = form.escalafon === '__otro__' ? form.escalafonOtro : form.escalafon;

  const sumaPorcentaje = splits.reduce((s, x) => s + (parseFloat(x.porcentaje) || 0), 0);
  const splitValido     = !splitActivo || (splits.length > 0 && Math.abs(sumaPorcentaje - 100) < 0.01);

  const preview = previewSueldoBasico(form);
  const totalSinAntiguedad =
    (parseFloat(form.sueldo_basico) || 0)
    + (parseFloat(form.premio_incentivo) || 0)
    + (parseFloat(form.viatico) || 0)
    + (parseFloat(form.premio_presentismo) || 0)
    + (parseFloat(form.telefono) || 0);

  const validStep1 = !!form.empleado_id && !!form.fecha_inicio;
  const validStep2 = !!form.sueldo_basico && !!form.horas_acordadas_mes;

  const handleSubmit = async () => {
    setError(null);
    if (!splitValido) { setError('Los porcentajes del split deben sumar exactamente 100%'); return; }
    try {
      const payload: AcuerdoPayload = {
        empleado_id:         Number(form.empleado_id),
        fecha_inicio:        form.fecha_inicio,
        vigencia_meses:      form.vigencia_meses ? Number(form.vigencia_meses) : null,
        escalafon:           escalafonFinal || null,
        tipo_seguro:         form.tipo_seguro || null,
        sueldo_basico:       Number(form.sueldo_basico),
        horas_acordadas_mes: Number(form.horas_acordadas_mes),
        premio_incentivo:    form.premio_incentivo   ? Number(form.premio_incentivo)   : null,
        viatico:             form.viatico            ? Number(form.viatico)            : null,
        premio_presentismo:  form.premio_presentismo ? Number(form.premio_presentismo) : null,
        valor_hora_extra:    form.valor_hora_extra   ? Number(form.valor_hora_extra)   : null,
        telefono:            form.telefono           ? Number(form.telefono)           : null,
        notas:               form.notas || null,
      };
      await createMut.mutateAsync(payload);
      if (splitActivo && splits.length > 0) {
        await splitsMut.mutateAsync({
          empleadoId: Number(form.empleado_id),
          splits:     splits.map(s => ({ empresa_id: Number(s.empresa_id), porcentaje: parseFloat(s.porcentaje) })),
        });
      }
      handleClose();
    } catch (err) {
      setError(getApiErrorMessage(err) ?? 'Error al crear el acuerdo');
    }
  };

  const addSplitRow = () => setSplits(p => [...p, { empresa_id: '', porcentaje: '' }]);
  const removeSplitRow = (i: number) => setSplits(p => p.filter((_, idx) => idx !== i));
  const updateSplitRow = (i: number, field: 'empresa_id' | 'porcentaje', value: string) =>
    setSplits(p => p.map((s, idx) => idx === i ? { ...s, [field]: value } : s));

  const isPending = createMut.isPending || splitsMut.isPending;
  const sueldoBasicoNum = parseFloat(form.sueldo_basico) || 0;

  return (
    <Dialog open={open} onOpenChange={o => !o && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Nuevo acuerdo de sueldo — paso {step} de 3</DialogTitle></DialogHeader>

        {step === 1 && (
          <div className="space-y-3 mt-1">
            <div>
              <label className={labelCls}>Empleado *</label>
              <select value={form.empleado_id} onChange={e => set('empleado_id', e.target.value)} className={inputCls}>
                <option value="">Seleccionar...</option>
                {empleadosDisponibles.map(e => <option key={e.id} value={e.id}>{e.apellido}, {e.nombre}</option>)}
              </select>
              {empleadosDisponibles.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">Todos los empleados ya tienen un acuerdo activo.</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Escalafón</label>
                <select value={form.escalafon} onChange={e => handleEscalafonChange(e.target.value)} className={inputCls}>
                  <option value="">—</option>
                  {escalafones.map(esc => <option key={esc.id} value={esc.nombre}>{esc.nombre}</option>)}
                  <option value="__otro__">Otro...</option>
                </select>
                {form.escalafon === '__otro__' && (
                  <input
                    value={form.escalafonOtro} onChange={e => set('escalafonOtro', e.target.value)}
                    placeholder="Nombre del escalafón" className={cn(inputCls, 'mt-1.5')}
                  />
                )}
              </div>
              <div>
                <label className={labelCls}>Tipo de seguro</label>
                <input value={form.tipo_seguro} onChange={e => set('tipo_seguro', e.target.value)} placeholder="ART, SANCOR..." className={inputCls} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Fecha inicio del acuerdo *</label>
                <input type="date" value={form.fecha_inicio} onChange={e => set('fecha_inicio', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Vigencia (meses)</label>
                <input type="number" min="1" value={form.vigencia_meses} onChange={e => set('vigencia_meses', e.target.value)} placeholder="Indefinido" className={inputCls} />
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3 mt-1">
            <div>
              <label className={labelCls}>Sueldo básico acordado ($) *</label>
              <input type="number" min="0" step="0.01" value={form.sueldo_basico} onChange={e => set('sueldo_basico', e.target.value)} className={inputCls} />
              <p className="text-xs text-muted-foreground mt-0.5">Este es el sueldo total del empleado.</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Horas acordadas/mes *</label>
                <input type="number" min="1" value={form.horas_acordadas_mes} onChange={e => set('horas_acordadas_mes', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Valor hora extra ($)</label>
                <input type="number" min="0" step="0.01" value={form.valor_hora_extra} onChange={e => set('valor_hora_extra', e.target.value)} className={inputCls} />
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer text-sm pt-1">
              <input type="checkbox" checked={splitActivo} onChange={e => { setSplitActivo(e.target.checked); if (e.target.checked && splits.length === 0) addSplitRow(); }} />
              ¿Este empleado trabaja para más de una empresa?
            </label>

            {!splitActivo && (
              <p className="text-xs text-muted-foreground">
                100% a cargo de {user?.empresa?.nombre_corto ?? user?.empresa?.nombre ?? 'la empresa activa'}.
              </p>
            )}

            {splitActivo && (
              <div className="space-y-2">
                {splits.map((s, i) => {
                  const empresaSel = empresas.find(e => String(e.id) === s.empresa_id);
                  const pct = parseFloat(s.porcentaje) || 0;
                  return (
                    <div key={i} className="space-y-1">
                      <div className="flex items-center gap-2">
                        <select value={s.empresa_id} onChange={e => updateSplitRow(i, 'empresa_id', e.target.value)} className={inputCls}>
                          <option value="">Empresa...</option>
                          {empresas.map(emp => <option key={emp.id} value={emp.id}>{emp.nombre_corto ?? emp.nombre}</option>)}
                        </select>
                        <input
                          type="number" min="0" max="100" step="0.01" placeholder="%"
                          value={s.porcentaje} onChange={e => updateSplitRow(i, 'porcentaje', e.target.value)}
                          className={cn(inputCls, 'w-24 text-right')}
                        />
                        <button type="button" onClick={() => removeSplitRow(i)} className="text-muted-foreground hover:text-destructive shrink-0">
                          <X size={14} />
                        </button>
                      </div>
                      {empresaSel && pct > 0 && sueldoBasicoNum > 0 && (
                        <p className="text-xs text-muted-foreground pl-1">
                          {empresaSel.nombre_corto ?? empresaSel.nombre} ({pct}%) → {formatCurrency(sueldoBasicoNum * pct / 100)}
                        </p>
                      )}
                    </div>
                  );
                })}
                <Button type="button" variant="ghost" size="sm" onClick={addSplitRow} className="text-xs">
                  <Plus size={12} className="mr-1" /> Agregar empresa
                </Button>
                <div className={cn('text-xs font-medium', Math.abs(sumaPorcentaje - 100) < 0.01 ? 'text-green-600' : 'text-destructive')}>
                  Suma: {sumaPorcentaje.toFixed(2)}% {Math.abs(sumaPorcentaje - 100) >= 0.01 && '— debe sumar 100%'}
                </div>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3 mt-1">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Premio incentivo ($)</label>
                <input type="number" min="0" step="0.01" value={form.premio_incentivo} onChange={e => set('premio_incentivo', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Viático ($)</label>
                <input type="number" min="0" step="0.01" value={form.viatico} onChange={e => set('viatico', e.target.value)} className={inputCls} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Premio presentismo ($)</label>
                <input type="number" min="0" step="0.01" value={form.premio_presentismo} onChange={e => set('premio_presentismo', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Teléfono ($)</label>
                <input type="number" min="0" step="0.01" value={form.telefono} onChange={e => set('telefono', e.target.value)} className={inputCls} />
              </div>
            </div>
            {escalafonFinal && (
              <p className="text-xs text-muted-foreground">
                Valores pre-cargados desde el escalafón "{escalafonFinal}" — podés editarlos libremente.
              </p>
            )}
            <div>
              <label className={labelCls}>Notas</label>
              <textarea value={form.notas} onChange={e => set('notas', e.target.value)} rows={2} className={cn(inputCls, 'resize-none')} />
            </div>

            {form.fecha_inicio && form.sueldo_basico && (
              <div className="rounded-md border border-border bg-muted/20 p-3 text-sm space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Básico + Incentivo + Viático + Presentismo + Teléfono</span>
                  <span>{formatCurrency(totalSinAntiguedad)}</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Antigüedad ({preview.antiguedad_anios} año{preview.antiguedad_anios !== 1 ? 's' : ''})</span>
                  <span>{formatCurrency(preview.importe_antiguedad)}</span>
                </div>
                <div className="flex justify-between font-semibold pt-1 border-t border-border">
                  <span>TOTAL ESTIMADO</span><span>{formatCurrency(preview.subtotal_bruto)}</span>
                </div>
                <p className="text-[11px] text-muted-foreground pt-0.5">Sin horas extras.</p>
              </div>
            )}
          </div>
        )}

        {error && <p className="text-xs text-destructive mt-2">{error}</p>}

        <div className="flex justify-between gap-2 pt-3 border-t border-border mt-3">
          <Button type="button" variant="outline" size="sm" onClick={step === 1 ? handleClose : () => setStep(s => (s - 1) as Step)}>
            {step === 1 ? 'Cancelar' : 'Atrás'}
          </Button>
          {step < 3 ? (
            <Button type="button" size="sm" disabled={step === 1 ? !validStep1 : !validStep2} onClick={() => setStep(s => (s + 1) as Step)}>
              Siguiente
            </Button>
          ) : (
            <Button type="button" size="sm" disabled={isPending || !splitValido} onClick={handleSubmit}>
              {isPending ? 'Guardando…' : 'Crear acuerdo'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Toggle activo (desactivar/reactivar acuerdo) ──────────────────────────────

function ToggleActivo({ acuerdo }: { acuerdo: AcuerdoSueldo }) {
  const updateMut = useUpdateAcuerdo();
  return (
    <button
      onClick={() => updateMut.mutate({ id: acuerdo.id, data: { activo: !acuerdo.activo } })}
      disabled={updateMut.isPending}
      className={cn(
        'rounded-full px-2 py-0.5 text-xs font-medium transition',
        acuerdo.activo ? 'bg-green-100 text-green-800 hover:bg-green-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
      )}
    >
      {acuerdo.activo ? 'Activo' : 'Inactivo'}
    </button>
  );
}

// ── Tab ────────────────────────────────────────────────────────────────────────

export default function AcuerdosTab() {
  const { data: acuerdos = [], isLoading } = useAcuerdos();
  const { data: empleados = [] } = useEmpleados();
  const [dialogOpen, setDialogOpen] = useState(false);

  const empleadosSinAcuerdo = empleados.filter(e => !acuerdos.some(a => a.empleado_id === e.id));

  return (
    <div>
      <div className="flex items-center justify-end mb-4">
        <Button size="sm" onClick={() => setDialogOpen(true)}><Plus size={14} className="mr-1.5" /> Nuevo acuerdo</Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-border">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Empleado</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Escalafón</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Sueldo básico</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Hrs. acordadas</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Inicio</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Vigencia</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Split empresas</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {acuerdos.length === 0 ? (
                <tr><td colSpan={8} className="px-3 py-6 text-center text-sm text-muted-foreground">No hay acuerdos cargados.</td></tr>
              ) : acuerdos.map(a => (
                <tr key={a.id} className="hover:bg-muted/20">
                  <td className="px-3 py-2.5 font-medium">{a.empleado ? `${a.empleado.apellido}, ${a.empleado.nombre}` : '-'}</td>
                  <td className="px-3 py-2.5">{a.escalafon ?? '-'}</td>
                  <td className="px-3 py-2.5 text-right">{formatCurrency(a.sueldo_basico)}</td>
                  <td className="px-3 py-2.5 text-right">{a.horas_acordadas_mes}</td>
                  <td className="px-3 py-2.5">{formatDate(a.fecha_inicio)}</td>
                  <td className="px-3 py-2.5">{a.vigencia_meses ? `${a.vigencia_meses} meses` : 'Indefinida'}</td>
                  <td className="px-3 py-2.5">
                    {a.splits && a.splits.length > 0 ? (
                      <span className="inline-flex flex-wrap gap-1">
                        {a.splits.map(s => (
                          <span key={s.empresa_id} className="rounded-full bg-accent px-2 py-0.5 text-xs">
                            {s.porcentaje}% {s.empresa_nombre}
                          </span>
                        ))}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">100% {a.empresa?.nombre_corto ?? a.empresa?.nombre}</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right"><ToggleActivo acuerdo={a} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <NuevoAcuerdoDialog open={dialogOpen} onClose={() => setDialogOpen(false)} empleadosDisponibles={empleadosSinAcuerdo} />
    </div>
  );
}
