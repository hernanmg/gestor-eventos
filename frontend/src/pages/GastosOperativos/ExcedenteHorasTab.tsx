import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useExcedenteHoras, useCreateExcedenteHoras, usePagarExcedenteHoras, type ExcedentePayload } from '@/hooks/useExcedenteHoras';
import { useEmpleados } from '@/hooks/useRRHH';
import { useLiquidacionesAdmin } from '@/hooks/useSueldosAdmin';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import MoneyInput from '@/components/ui/MoneyInput';
import { formatCurrency } from '@/lib/formatters';
import { cn, getApiErrorMessage } from '@/lib/utils';
import type { ExcedenteHoras } from '@/types';

const inputCls = 'w-full border border-input rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring';
const labelCls = 'block text-xs font-medium text-muted-foreground mb-0.5';
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

// ── Nuevo excedente ────────────────────────────────────────────────────────────

function RegistrarExcedenteDialog({ onClose }: { onClose: () => void }) {
  const createMut = useCreateExcedenteHoras();
  const { data: empleados = [] } = useEmpleados();
  const fofisNestoras = useMemo(() => empleados.filter(e => e.categoria === 'FOFI' || e.categoria === 'NESTORAS'), [empleados]);

  const hoy = new Date();
  const [form, setForm] = useState<ExcedentePayload>({
    empleado_id: 0, periodo_mes: hoy.getMonth() + 1, periodo_anio: hoy.getFullYear(), horas_excedente: 0, valor_hora: 0,
  });
  const [horasStr, setHorasStr] = useState('');
  const [valorStr, setValorStr] = useState('');
  const [error, setError] = useState<string | null>(null);

  const empleadoOptions: ComboboxOption[] = fofisNestoras.map(e => ({ value: String(e.id), label: `${e.apellido}, ${e.nombre}` }));
  const montoCalculado = (parseFloat(horasStr) || 0) * (parseFloat(valorStr) || 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const horas = parseFloat(horasStr) || 0;
    const valorHora = parseFloat(valorStr) || 0;
    if (!form.empleado_id) { setError('Seleccioná un empleado'); return; }
    if (horas <= 0 || valorHora <= 0) { setError('Horas y valor hora deben ser mayores a cero'); return; }
    try {
      await createMut.mutateAsync({ ...form, horas_excedente: horas, valor_hora: valorHora });
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Registrar excedente de horas</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 mt-1">
          <div>
            <label className={labelCls}>Empleado * (Fofi / Nestoras)</label>
            <Combobox options={empleadoOptions} value={form.empleado_id ? String(form.empleado_id) : null}
              onChange={v => setForm(p => ({ ...p, empleado_id: Number(v) }))} placeholder="Buscar empleado…" className="w-full" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Mes</label>
              <select value={form.periodo_mes} onChange={e => setForm(p => ({ ...p, periodo_mes: Number(e.target.value) }))} className={inputCls}>
                {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Año</label>
              <input type="number" value={form.periodo_anio} onChange={e => setForm(p => ({ ...p, periodo_anio: Number(e.target.value) }))} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Horas excedente *</label>
              <input type="number" step="0.01" value={horasStr} onChange={e => setHorasStr(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Valor hora *</label>
              <MoneyInput value={valorStr} onChange={setValorStr} className={inputCls} />
            </div>
          </div>
          <p className="text-sm">Monto calculado: <strong>{formatCurrency(montoCalculado)}</strong></p>
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

// ── Registrar pago ────────────────────────────────────────────────────────────

function RegistrarPagoDialog({ excedente, onClose }: { excedente: ExcedenteHoras; onClose: () => void }) {
  const pagarMut = usePagarExcedenteHoras();
  const { data: liquidaciones = [] } = useLiquidacionesAdmin({ empleado_id: excedente.empleado_id });
  const [fechaPago, setFechaPago] = useState(new Date().toISOString().slice(0, 10));
  const [liquidacionId, setLiquidacionId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await pagarMut.mutateAsync({ id: excedente.id, fecha_pago: fechaPago, liquidacion_admin_id: liquidacionId });
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Registrar pago</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 mt-1">
          <p className="text-sm text-muted-foreground">
            {excedente.empleado?.apellido}, {excedente.empleado?.nombre} — {formatCurrency(excedente.monto_total)}
          </p>
          <div>
            <label className={labelCls}>Fecha de pago *</label>
            <input type="date" value={fechaPago} onChange={e => setFechaPago(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Vincular a liquidación existente (opcional)</label>
            <select value={liquidacionId ?? ''} onChange={e => setLiquidacionId(e.target.value ? Number(e.target.value) : null)} className={inputCls}>
              <option value="">Sin vincular</option>
              {liquidaciones.map(l => (
                <option key={l.id} value={l.id}>{l.periodo_mes}/{l.periodo_anio} — {formatCurrency(l.total_a_cobrar)}</option>
              ))}
            </select>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={pagarMut.isPending}>{pagarMut.isPending ? 'Guardando…' : 'Confirmar pago'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function ExcedenteHorasTab() {
  const { user } = useAuth();
  const canEdit = user?.rol === 'ADMIN' || user?.rol === 'OPERADOR';

  const [soloPendientes, setSoloPendientes] = useState(false);
  const [nuevoOpen, setNuevoOpen] = useState(false);
  const [pagando, setPagando] = useState<ExcedenteHoras | null>(null);

  const { data, isLoading } = useExcedenteHoras(soloPendientes ? { pagado: false } : {});
  const items = data?.items ?? [];

  const th = 'px-3 py-2 text-left text-xs font-medium text-muted-foreground';
  const td = 'px-3 py-2.5 text-sm';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-1.5 text-sm">
          <input type="checkbox" checked={soloPendientes} onChange={e => setSoloPendientes(e.target.checked)} />
          Sólo pendientes
        </label>
        {canEdit && <Button size="sm" onClick={() => setNuevoOpen(true)}><Plus size={13} className="mr-1.5" /> Registrar excedente</Button>}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : (
        <div className="rounded-lg border bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30">
              <tr>
                <th className={th}>Empleado</th>
                <th className={th}>Período</th>
                <th className={th}>Horas excedente</th>
                <th className={th}>Valor/hora</th>
                <th className={th}>Monto total</th>
                <th className={th}>Estado</th>
                {canEdit && <th className={th} />}
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.length === 0 ? (
                <tr><td colSpan={7} className="px-3 py-6 text-center text-sm text-muted-foreground">Sin excedentes cargados.</td></tr>
              ) : items.map(e => (
                <tr key={e.id}>
                  <td className={td}>{e.empleado?.apellido}, {e.empleado?.nombre}</td>
                  <td className={td}>{e.periodo_mes}/{e.periodo_anio}</td>
                  <td className={cn(td, 'tabular-nums')}>{e.horas_excedente}</td>
                  <td className={cn(td, 'tabular-nums')}>{formatCurrency(e.valor_hora)}</td>
                  <td className={cn(td, 'tabular-nums font-medium')}>{formatCurrency(e.monto_total)}</td>
                  <td className={td}>
                    <Badge variant={e.pagado ? 'success' : 'warning'}>{e.pagado ? 'Pagado' : 'Pendiente'}</Badge>
                  </td>
                  {canEdit && (
                    <td className={td}>
                      {!e.pagado && <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => setPagando(e)}>Registrar pago</Button>}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            {items.length > 0 && (
              <tfoot className="border-t bg-muted/20">
                <tr>
                  <td colSpan={4} className={cn(td, 'font-semibold')}>Total pendiente de pago</td>
                  <td className={cn(td, 'font-semibold tabular-nums')}>{formatCurrency(data?.total_pendiente ?? 0)}</td>
                  <td colSpan={canEdit ? 2 : 1} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {nuevoOpen && <RegistrarExcedenteDialog onClose={() => setNuevoOpen(false)} />}
      {pagando && <RegistrarPagoDialog excedente={pagando} onClose={() => setPagando(null)} />}
    </div>
  );
}
