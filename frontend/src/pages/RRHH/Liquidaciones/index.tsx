import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Download, FileText } from 'lucide-react';
import {
  useLiquidaciones, useEmpleados, useAprobarLiquidacion, useCancelarLiquidacion,
  useGenerarLiquidacion, usePreviewLiquidacion, descargarLiquidacionPDF,
  type LiquidacionFiltros, type GenerarLiquidacionPayload,
} from '@/hooks/useRRHH';
import { useEventos } from '@/hooks/useEvento';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn, getApiErrorMessage } from '@/lib/utils';
import type { EstadoLiquidacion } from '@/types';

const ESTADO_LABEL: Record<EstadoLiquidacion, string> = { BORRADOR: 'Borrador', APROBADA: 'Aprobada', PAGADA: 'Pagada', CANCELADA: 'Cancelada' };
const ESTADO_VARIANT: Record<EstadoLiquidacion, 'muted' | 'success' | 'info' | 'destructive'> = {
  BORRADOR: 'muted', APROBADA: 'success', PAGADA: 'info', CANCELADA: 'destructive',
};

const inputCls = 'w-full border border-input rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring';
const labelCls = 'block text-xs font-medium text-muted-foreground mb-0.5';

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
        {preview.tipo_liquidacion === 'JORNADA' ? ' por jornada' : ' lineal'})
      </p>

      {preview.jornadas.length > 0 && (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-xs">
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
                  <td className={tdCls}>{j.tipo_calculo === 'JORNADA' ? 'Jornada' : 'Lineal'}</td>
                  <td className={cn(tdCls, 'text-right')}>${j.monto_base.toLocaleString('es-AR')}</td>
                  <td className={cn(tdCls, 'text-right')}>${j.monto_extras.toLocaleString('es-AR')}</td>
                  <td className={cn(tdCls, 'text-right')}>${j.monto_viaje.toLocaleString('es-AR')}</td>
                  <td className={cn(tdCls, 'text-right font-medium')}>${j.total.toLocaleString('es-AR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex justify-between font-semibold pt-1 border-t border-border">
        <span>Total general</span><span>${preview.subtotal_horas.toLocaleString('es-AR')}</span>
      </div>
    </div>
  );
}

// ── Dialog de generar ──────────────────────────────────────────────────────────

function GenerarDialog({ open, onClose, empleadoIdFijo }: { open: boolean; onClose: () => void; empleadoIdFijo?: number }) {
  const { data: empleados = [] } = useEmpleados();
  const { data: eventos = [] }   = useEventos();
  const generarMut = useGenerarLiquidacion();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ empleado_id: empleadoIdFijo ?? '', fecha_desde: '', fecha_hasta: '', evento_id: '' });

  useEffect(() => {
    if (open) { setForm({ empleado_id: empleadoIdFijo ?? '', fecha_desde: '', fecha_hasta: '', evento_id: '' }); setError(null); }
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
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Desde *</label><input type="date" value={form.fecha_desde} onChange={e => setForm(p => ({ ...p, fecha_desde: e.target.value }))} className={inputCls} required /></div>
            <div><label className={labelCls}>Hasta *</label><input type="date" value={form.fecha_hasta} onChange={e => setForm(p => ({ ...p, fecha_hasta: e.target.value }))} className={inputCls} required /></div>
          </div>
          <div>
            <label className={labelCls}>Evento (opcional)</label>
            <select value={form.evento_id} onChange={e => setForm(p => ({ ...p, evento_id: e.target.value }))} className={inputCls}>
              <option value="">Sin evento específico</option>
              {eventos.map(ev => <option key={ev.id} value={ev.id}>{ev.nombre}</option>)}
            </select>
          </div>

          {empleadoSel && (
            <PreviewLiquidacion
              empleadoId={empleadoSel.id}
              fechaDesde={form.fecha_desde}
              fechaHasta={form.fecha_hasta}
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

// ── Página ────────────────────────────────────────────────────────────────────

export default function LiquidacionesTab({ empleadoIdInicial }: { empleadoIdInicial?: number | null }) {
  const [filtros, setFiltros] = useState<LiquidacionFiltros>({});
  useEffect(() => { if (empleadoIdInicial != null) setFiltros(p => ({ ...p, empleado_id: empleadoIdInicial })); }, [empleadoIdInicial]);

  const { data: liquidaciones = [], isLoading } = useLiquidaciones(filtros);
  const { data: empleados = [] } = useEmpleados();
  const aprobarMut  = useAprobarLiquidacion();
  const cancelarMut = useCancelarLiquidacion();
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleAprobar = (id: number, total: number) => {
    if (!window.confirm(`Al aprobar se creará un Egreso de $${total.toLocaleString('es-AR')} en el evento. ¿Confirmar?`)) return;
    aprobarMut.mutate(id, { onError: (err) => alert(getApiErrorMessage(err) ?? 'Error al aprobar') });
  };

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
          <select value={filtros.estado ?? ''} onChange={e => setFiltros(p => ({ ...p, estado: (e.target.value || undefined) as EstadoLiquidacion | undefined }))} className={inputCls}>
            <option value="">Todos los estados</option>
            {Object.entries(ESTADO_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)}><Plus size={14} className="mr-1.5" /> Generar liquidación</Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-border">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Empleado</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Período</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Hs.</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Extras</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Anticipos</th>
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
                  <td className="px-3 py-2.5">{l.fecha_desde.slice(0, 10)} → {l.fecha_hasta.slice(0, 10)}</td>
                  <td className="px-3 py-2.5 text-right">{l.horas_normales}</td>
                  <td className="px-3 py-2.5 text-right">{l.horas_extras}</td>
                  <td className="px-3 py-2.5 text-right">${l.total_anticipos.toLocaleString('es-AR')}</td>
                  <td className="px-3 py-2.5 text-right font-semibold">${l.total_a_cobrar.toLocaleString('es-AR')}</td>
                  <td className="px-3 py-2.5"><Badge variant={ESTADO_VARIANT[l.estado]}>{ESTADO_LABEL[l.estado]}</Badge></td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      {l.estado === 'BORRADOR' && (
                        <>
                          <Button variant="outline" size="sm" onClick={() => handleAprobar(l.id, l.total_a_cobrar)}>Aprobar</Button>
                          <Button variant="ghost" size="sm" onClick={() => handleCancelar(l.id)} className="text-destructive hover:text-destructive">Cancelar</Button>
                        </>
                      )}
                      {l.estado === 'APROBADA' && l.movimiento_id && (
                        <Link to={`/eventos/${l.evento_id}`} className="text-xs text-primary hover:underline flex items-center gap-1">
                          <FileText size={12} /> Ver egreso
                        </Link>
                      )}
                      <Button variant="ghost" size="icon" title="Exportar PDF" onClick={() => descargarLiquidacionPDF(l.id)}>
                        <Download size={14} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <GenerarDialog open={dialogOpen} onClose={() => setDialogOpen(false)} empleadoIdFijo={empleadoIdInicial ?? undefined} />
    </div>
  );
}
