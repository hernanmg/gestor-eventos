import { useState, useEffect } from 'react';
import {
  useEventoStock, useAsignarProducto, useCancelarAsignacion,
  useDisponibilidad, useSugerencias, useTransferencia, useProductos,
} from '@/hooks/useStock';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { AsignacionStock, Evento, RiesgoSugerencia, SugerenciaStock } from '@/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Plus, AlertTriangle, ArrowRight } from 'lucide-react';

const RIESGO_CLASS: Record<RiesgoSugerencia, string> = {
  BAJO:  'bg-green-100 text-green-800',
  MEDIO: 'bg-yellow-100 text-yellow-800',
  ALTO:  'bg-red-100 text-red-800',
};

// ── Asignar producto dialog ───────────────────────────────────────────────────

interface AsignarForm {
  producto_id:   number | '';
  cantidad:      number;
  fecha_salida:  string;
  fecha_retorno: string;
  notas:         string;
}

function AsignarDialog({
  open, evento, onClose,
}: {
  open:    boolean;
  evento:  Evento;
  onClose: () => void;
}) {
  const defaultSalida  = evento.fecha_inicio ? evento.fecha_inicio.split('T')[0] : '';
  const defaultRetorno = evento.fecha_fin    ? evento.fecha_fin.split('T')[0]    : '';

  const [form, setForm] = useState<AsignarForm>({
    producto_id: '', cantidad: 1,
    fecha_salida: defaultSalida, fecha_retorno: defaultRetorno, notas: '',
  });
  const [error,    setError]    = useState<string | null>(null);
  const [warning,  setWarning]  = useState<{ faltante: number; sugerencias: SugerenciaStock[] } | null>(null);
  const [confirmar, setConfirmar] = useState(false);

  const { data: productos = [] } = useProductos();
  const asignar = useAsignarProducto(evento.id);

  // Real-time availability
  const { data: disponibilidad } = useDisponibilidad({
    producto_id: form.producto_id || undefined,
    fecha_desde: form.fecha_salida  || undefined,
    fecha_hasta: form.fecha_retorno || form.fecha_salida || undefined,
  });

  // Sugerencias when quiebre
  const { data: sugData } = useSugerencias({
    producto_id: disponibilidad?.en_quiebre ? (form.producto_id || undefined) : undefined,
    evento_id:   evento.id,
    fecha_desde: form.fecha_salida  || undefined,
    fecha_hasta: form.fecha_retorno || form.fecha_salida || undefined,
  });

  useEffect(() => {
    if (!open) {
      setForm({ producto_id: '', cantidad: 1, fecha_salida: defaultSalida, fecha_retorno: defaultRetorno, notas: '' });
      setError(null); setWarning(null); setConfirmar(false);
    }
  }, [open]);

  const productosDisp = disponibilidad?.disponible ?? null;
  const enQuiebre     = disponibilidad ? disponibilidad.disponible < form.cantidad : false;
  const sugerencias   = sugData?.sugerencias ?? [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.producto_id) { setError('Seleccioná un producto'); return; }
    if (enQuiebre && !confirmar) { setConfirmar(true); return; }
    setError(null);
    try {
      const result = await asignar.mutateAsync({
        producto_id:   Number(form.producto_id),
        cantidad:      form.cantidad,
        fecha_salida:  form.fecha_salida,
        fecha_retorno: form.fecha_retorno || null,
        notas:         form.notas || undefined,
      });
      if ((result as any).advertencia) {
        setWarning((result as any).advertencia);
      } else {
        onClose();
      }
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Error al asignar');
    }
  };

  const inputCls = 'w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring';
  const labelCls = 'block text-xs font-medium text-muted-foreground mb-0.5';

  if (warning) {
    return (
      <Dialog open={open} onOpenChange={o => !o && onClose()}>
        <DialogContent>
          <DialogHeader><DialogTitle>Asignación creada con advertencia</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2 text-yellow-700 bg-yellow-50 rounded p-3 text-sm">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>Stock insuficiente. Faltante: <strong>{warning.faltante} u.</strong></span>
            </div>
            {warning.sugerencias.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Fuentes alternativas:</p>
                {warning.sugerencias.map(s => (
                  <div key={s.asignacion_id} className="flex items-center gap-2 text-xs border rounded px-2 py-1.5">
                    <span className={cn('px-1.5 py-0.5 rounded font-medium', RIESGO_CLASS[s.riesgo])}>{s.riesgo}</span>
                    <span className="font-medium">{s.evento_origen_nombre}</span>
                    <span className="text-muted-foreground">— {s.cantidad_disponible} u.</span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end">
              <Button size="sm" onClick={onClose}>Cerrar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Asignar producto al evento</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 mt-1">
          <div>
            <label className={labelCls}>Producto *</label>
            <select
              className={inputCls}
              value={form.producto_id}
              onChange={e => setForm(p => ({ ...p, producto_id: e.target.value ? Number(e.target.value) : '' }))}
              required
            >
              <option value="">Seleccioná un producto…</option>
              {productos.map(p => (
                <option key={p.id} value={p.id}>{p.nombre}{p.codigo ? ` (${p.codigo})` : ''}</option>
              ))}
            </select>
          </div>

          {disponibilidad && (
            <div className={cn(
              'flex items-center gap-2 rounded px-3 py-2 text-xs',
              disponibilidad.disponible >= form.cantidad
                ? 'bg-green-50 text-green-800'
                : 'bg-red-50 text-red-800',
            )}>
              <span>Disponible para esas fechas: <strong>{disponibilidad.disponible} {disponibilidad.nombre && ''}</strong></span>
              {disponibilidad.en_quiebre && <span className="font-bold">— QUIEBRE</span>}
            </div>
          )}

          {enQuiebre && sugerencias.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-yellow-700">Fuentes alternativas disponibles:</p>
              {sugerencias.slice(0, 3).map(s => (
                <div key={s.asignacion_id} className="flex items-center gap-2 text-xs border rounded px-2 py-1">
                  <span className={cn('px-1.5 py-0.5 rounded text-xs font-medium', RIESGO_CLASS[s.riesgo])}>{s.riesgo}</span>
                  <span className="font-medium">{s.evento_origen_nombre}</span>
                  <span className="text-muted-foreground">— {s.cantidad_disponible} u.</span>
                </div>
              ))}
            </div>
          )}

          <div>
            <label className={labelCls}>Cantidad *</label>
            <input type="number" min={1} className={inputCls} value={form.cantidad}
              onChange={e => setForm(p => ({ ...p, cantidad: Number(e.target.value) }))} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Fecha salida *</label>
              <input type="date" className={inputCls} value={form.fecha_salida}
                onChange={e => setForm(p => ({ ...p, fecha_salida: e.target.value }))} required />
            </div>
            <div>
              <label className={labelCls}>Fecha retorno</label>
              <input type="date" className={inputCls} value={form.fecha_retorno}
                onChange={e => setForm(p => ({ ...p, fecha_retorno: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Notas</label>
            <input className={inputCls} value={form.notas}
              onChange={e => setForm(p => ({ ...p, notas: e.target.value }))} />
          </div>

          {confirmar && enQuiebre && (
            <div className="bg-yellow-50 rounded p-3 text-xs text-yellow-800 flex gap-2">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>Stock insuficiente. La asignación se creará con quiebre. ¿Confirmar igual?</span>
            </div>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button
              type="submit"
              size="sm"
              disabled={asignar.isPending}
              variant={confirmar && enQuiebre ? 'destructive' : 'default'}
            >
              {asignar.isPending ? 'Asignando…' : confirmar && enQuiebre ? 'Confirmar con quiebre' : 'Asignar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Transferencia dialog ──────────────────────────────────────────────────────

function TransferenciaDialog({
  open, sugerencia, evento, onClose,
}: {
  open:       boolean;
  sugerencia: SugerenciaStock;
  evento:     Evento;
  onClose:    () => void;
}) {
  const [cantidad, setCantidad] = useState(1);
  const [fecha,    setFecha]    = useState(new Date().toISOString().split('T')[0]);
  const [notas,    setNotas]    = useState('');
  const [error,    setError]    = useState<string | null>(null);

  const transferir = useTransferencia();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await transferir.mutateAsync({
        asignacion_origen_id: sugerencia.asignacion_id,
        evento_destino_id:    evento.id,
        cantidad,
        fecha_transferencia:  fecha,
        notas: notas || undefined,
      });
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Error al transferir');
    }
  };

  const inputCls = 'w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring';
  const labelCls = 'block text-xs font-medium text-muted-foreground mb-0.5';

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Generar transferencia</DialogTitle></DialogHeader>
        <div className="text-sm space-y-1 mb-3">
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <span className="font-medium text-foreground">{sugerencia.evento_origen_nombre}</span>
            <ArrowRight size={12} />
            <span className="font-medium text-foreground">{evento.nombre}</span>
          </div>
          <p className="text-xs text-muted-foreground">Disponible: {sugerencia.cantidad_disponible} u.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className={labelCls}>Cantidad *</label>
            <input type="number" min={1} max={sugerencia.cantidad_disponible} className={inputCls}
              value={cantidad} onChange={e => setCantidad(Number(e.target.value))} required />
          </div>
          <div>
            <label className={labelCls}>Fecha de transferencia *</label>
            <input type="date" className={inputCls} value={fecha}
              onChange={e => setFecha(e.target.value)} required />
          </div>
          <div>
            <label className={labelCls}>Notas</label>
            <input className={inputCls} value={notas} onChange={e => setNotas(e.target.value)} />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={transferir.isPending}>
              {transferir.isPending ? 'Transfiriendo…' : 'Confirmar transferencia'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function EventoStockPage({ evento, canEdit }: { evento: Evento; canEdit: boolean }) {
  const { data, isLoading } = useEventoStock(evento.id);
  const cancelar = useCancelarAsignacion();

  const [asignarOpen, setAsignarOpen] = useState(false);
  const [transDialog, setTransDialog] = useState<SugerenciaStock | null>(null);

  const asignaciones = data?.asignaciones ?? [];
  const prestadas    = data?.prestadas    ?? [];
  const activas      = asignaciones.filter((a: AsignacionStock) => a.estado === 'ACTIVA');

  // Get any pending quiebre sugerencias for this event
  const [sugActive, setSugActive] = useState<{ productoId: number; asig: AsignacionStock } | null>(null);
  const { data: sugData } = useSugerencias({
    producto_id: sugActive?.productoId,
    evento_id:   evento.id,
    fecha_desde: sugActive?.asig.fecha_salida.split('T')[0],
    fecha_hasta: sugActive?.asig.fecha_retorno?.split('T')[0],
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Cargando stock...</p>;

  return (
    <div className="space-y-6">
      {/* Asignadas a este evento */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">Stock asignado a este evento</h2>
          {canEdit && (
            <Button size="sm" onClick={() => setAsignarOpen(true)}>
              <Plus size={14} className="mr-1.5" /> Asignar producto
            </Button>
          )}
        </div>

        {activas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin stock asignado.</p>
        ) : (
          <div className="rounded-lg border bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/30">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Producto</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Cantidad</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Salida</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Retorno</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Origen</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Notas</th>
                  {canEdit && <th className="px-3 py-2 w-20" />}
                </tr>
              </thead>
              <tbody className="divide-y">
                {activas.map((a: AsignacionStock) => (
                  <tr key={a.id}>
                    <td className="px-3 py-2.5">
                      <span className="font-medium">{a.producto?.nombre ?? `#${a.producto_id}`}</span>
                      {a.producto?.codigo && <span className="ml-1.5 text-xs text-muted-foreground font-mono">{a.producto.codigo}</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right">{a.cantidad}</td>
                    <td className="px-3 py-2.5 text-xs">{format(new Date(a.fecha_salida), 'dd/MM/yy', { locale: es })}</td>
                    <td className="px-3 py-2.5 text-xs">{a.fecha_retorno ? format(new Date(a.fecha_retorno), 'dd/MM/yy', { locale: es }) : '—'}</td>
                    <td className="px-3 py-2.5 text-xs">
                      {a.origen === 'EVENTO' && a.evento_origen ? (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">
                          Prestado: {a.evento_origen.nombre}
                        </span>
                      ) : 'Depósito'}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{a.notas ?? '—'}</td>
                    {canEdit && (
                      <td className="px-3 py-2.5">
                        <button
                          onClick={() => { if (window.confirm('¿Cancelar asignación y devolver al depósito?')) cancelar.mutate(a.id); }}
                          className="text-xs text-destructive hover:underline"
                        >
                          Cancelar
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Stock prestado a otros eventos */}
      {prestadas.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-3">Stock prestado a otros eventos</h2>
          <div className="rounded-lg border bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/30">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Producto</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Cantidad</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Evento destino</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Fecha</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Alerta</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {prestadas.map((a: AsignacionStock) => {
                  // Check if this event's fecha_fin causes conflict with the transfer
                  const lenderFinMs    = evento.fecha_fin ? new Date(evento.fecha_fin).getTime() : null;
                  const transferSalida = new Date(a.fecha_salida).getTime();
                  const conflicto      = lenderFinMs !== null && lenderFinMs > transferSalida;

                  return (
                    <tr key={a.id} className={conflicto ? 'bg-yellow-50' : ''}>
                      <td className="px-3 py-2.5 font-medium">{a.producto?.nombre ?? `#${a.producto_id}`}</td>
                      <td className="px-3 py-2.5 text-right">{a.cantidad}</td>
                      <td className="px-3 py-2.5 text-xs">{a.evento?.nombre ?? `Evento #${a.evento_id}`}</td>
                      <td className="px-3 py-2.5 text-xs">{format(new Date(a.fecha_salida), 'dd/MM/yy', { locale: es })}</td>
                      <td className="px-3 py-2.5">
                        {conflicto && (
                          <span className="flex items-center gap-1 text-xs text-yellow-700">
                            <AlertTriangle size={12} /> Fecha fin de este evento superpone transferencia
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {asignarOpen && (
        <AsignarDialog
          open
          evento={evento}
          onClose={() => setAsignarOpen(false)}
        />
      )}

      {transDialog && (
        <TransferenciaDialog
          open
          sugerencia={transDialog}
          evento={evento}
          onClose={() => setTransDialog(null)}
        />
      )}
    </div>
  );
}
