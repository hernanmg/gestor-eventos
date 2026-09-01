import { useEffect, useMemo, useState } from 'react';
import { Plus, Wrench, CheckCircle2, Pencil, Trash2 } from 'lucide-react';
import {
  useTallerFlota, useVehiculosFlota, useCreateServicioTaller, useUpdateServicioTaller, useDeleteServicioTaller,
  type TallerFiltros, type TallerPayload,
} from '@/hooks/useFlota';
import { useCuentasCorrientes, useCreateCuentaCorriente, type CuentaCorrientePayload } from '@/hooks/useCuentasCorrientes';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ServicioTallerEstadoBadge } from '@/components/ui/badge';
import MoneyInput from '@/components/ui/MoneyInput';
import { cn, getApiErrorMessage } from '@/lib/utils';
import { formatDate, formatCurrency } from '@/lib/formatters';
import type { ServicioTaller, TipoServicioTaller } from '@/types';

const inputCls  = 'w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring';
const labelCls  = 'block text-xs font-medium text-muted-foreground mb-0.5';
const selectCls = 'border border-input rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring bg-white';

const TIPO_LABEL: Record<TipoServicioTaller, string> = {
  MANTENIMIENTO:    'Mantenimiento',
  REPARACION:       'Reparación',
  NEUMATICOS:       'Neumáticos',
  CHAPERIA_PINTURA: 'Chapería/Pintura',
  ELECTRICIDAD:     'Electricidad',
  OTROS:            'Otros',
};

const NUEVA_CUENTA = '__nueva__';

// Diferencia en días de calendario entre dos fechas — comparando componentes
// UTC en vez de restar timestamps locales, mismo criterio que el resto del
// sistema para fechas de negocio (ver [[fecha_offset_utc_fix]]): fecha_ingreso/
// fecha_estimada vienen como calendario puro en UTC medianoche.
function diferenciaDiasUTC(desde: Date, hasta: Date): number {
  const a = Date.UTC(desde.getUTCFullYear(), desde.getUTCMonth(), desde.getUTCDate());
  const b = Date.UTC(hasta.getUTCFullYear(), hasta.getUTCMonth(), hasta.getUTCDate());
  return Math.round((b - a) / 86_400_000);
}

function diasEnTaller(fechaIngreso: string): number {
  return diferenciaDiasUTC(new Date(fechaIngreso), new Date());
}

// ── Crear cuenta corriente rápida (vinculada al taller) ──────────────────────

function CrearCuentaTallerDialog({
  open, nombreInicial, onClose, onCreated,
}: { open: boolean; nombreInicial: string; onClose: () => void; onCreated: (id: number) => void }) {
  const createCuenta = useCreateCuentaCorriente();
  const [nombre, setNombre] = useState(nombreInicial);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setNombre(nombreInicial); setError(null); }, [open, nombreInicial]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!nombre.trim()) { setError('El nombre es obligatorio'); return; }
    const payload: CuentaCorrientePayload = {
      nombre: nombre.trim(), tipo_tercero: 'OTRO', tercero_nombre: nombre.trim(), moneda: 'ARS', tiene_reparto: false,
    };
    try {
      const cuenta = await createCuenta.mutateAsync(payload);
      onCreated(cuenta.id);
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nueva cuenta corriente</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 mt-1">
          <div>
            <label className={labelCls}>Nombre *</label>
            <input value={nombre} onChange={e => setNombre(e.target.value)} className={inputCls} placeholder="Nombre del taller" />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={createCuenta.isPending}>{createCuenta.isPending ? 'Creando…' : 'Crear'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Nuevo / editar servicio ───────────────────────────────────────────────────

interface TallerFormData {
  camion_id:           string;
  taller_nombre:       string;
  tipo:                TipoServicioTaller;
  descripcion:         string;
  fecha_ingreso:       string;
  fecha_estimada:      string;
  presupuesto:         string;
  cuenta_corriente_id: string;
}

const EMPTY: TallerFormData = {
  camion_id: '', taller_nombre: '', tipo: 'MANTENIMIENTO', descripcion: '', fecha_ingreso: new Date().toISOString().slice(0, 10),
  fecha_estimada: '', presupuesto: '', cuenta_corriente_id: '',
};

function formFromServicio(s: ServicioTaller): TallerFormData {
  return {
    camion_id: String(s.camion_id), taller_nombre: s.taller_nombre ?? '', tipo: s.tipo, descripcion: s.descripcion,
    fecha_ingreso: s.fecha_ingreso.slice(0, 10), fecha_estimada: s.fecha_estimada ? s.fecha_estimada.slice(0, 10) : '',
    presupuesto: s.presupuesto != null ? String(s.presupuesto) : '', cuenta_corriente_id: s.cuenta_corriente_id ? String(s.cuenta_corriente_id) : '',
  };
}

function ServicioDialog({ open, servicio, onClose }: { open: boolean; servicio: ServicioTaller | null; onClose: () => void }) {
  const isEdit = !!servicio;
  const { data: vehiculos = [] } = useVehiculosFlota();
  const { data: cuentas = [] } = useCuentasCorrientes({ activa: 'true' });
  const cuentasElegibles = cuentas.filter(c => c.tipo_tercero === 'PROVEEDOR' || c.tipo_tercero === 'OTRO');
  const createServicio = useCreateServicioTaller();
  const updateServicio = useUpdateServicioTaller();
  const [form, setForm] = useState<TallerFormData>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [crearCuentaOpen, setCrearCuentaOpen] = useState(false);

  useEffect(() => { setForm(servicio ? formFromServicio(servicio) : EMPTY); setError(null); }, [servicio, open]);

  const handleCuentaChange = (value: string) => {
    if (value === NUEVA_CUENTA) { setCrearCuentaOpen(true); return; }
    setForm(p => ({ ...p, cuenta_corriente_id: value }));
  };

  const handleCuentaCreada = (id: number) => {
    setForm(p => ({ ...p, cuenta_corriente_id: String(id) }));
    setCrearCuentaOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.camion_id) { setError('Seleccioná un vehículo'); return; }
    const payload: TallerPayload = {
      camion_id: Number(form.camion_id), taller_nombre: form.taller_nombre || null, tipo: form.tipo,
      descripcion: form.descripcion, fecha_ingreso: form.fecha_ingreso, fecha_estimada: form.fecha_estimada || null,
      presupuesto: form.presupuesto ? Number(form.presupuesto) : null,
      cuenta_corriente_id: form.cuenta_corriente_id ? Number(form.cuenta_corriente_id) : null,
    };
    try {
      if (isEdit) await updateServicio.mutateAsync({ id: servicio!.id, data: payload });
      else        await createServicio.mutateAsync(payload);
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  const pending = createServicio.isPending || updateServicio.isPending;

  return (
    <>
      <Dialog open={open} onOpenChange={o => !o && onClose()}>
        <DialogContent>
          <DialogHeader><DialogTitle>{isEdit ? 'Editar servicio de taller' : 'Nuevo servicio de taller'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3 mt-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className={labelCls}>Vehículo *</label>
                <select value={form.camion_id} onChange={e => setForm(p => ({ ...p, camion_id: e.target.value }))} className={selectCls + ' w-full'} required>
                  <option value="">Seleccionar…</option>
                  {vehiculos.map(v => <option key={v.id} value={v.id}>{v.codigo} {v.descripcion ? `— ${v.descripcion}` : ''}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Taller</label>
                <input value={form.taller_nombre} onChange={e => setForm(p => ({ ...p, taller_nombre: e.target.value }))} className={inputCls} placeholder="Nombre libre" />
              </div>
              <div>
                <label className={labelCls}>Tipo *</label>
                <select value={form.tipo} onChange={e => setForm(p => ({ ...p, tipo: e.target.value as TipoServicioTaller }))} className={selectCls + ' w-full'}>
                  {Object.entries(TIPO_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Descripción *</label>
                <textarea value={form.descripcion} onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))} className={inputCls} required />
              </div>
              <div>
                <label className={labelCls}>Fecha ingreso *</label>
                <input type="date" value={form.fecha_ingreso} onChange={e => setForm(p => ({ ...p, fecha_ingreso: e.target.value }))} className={inputCls} required />
              </div>
              <div>
                <label className={labelCls}>Fecha estimada de retiro</label>
                <input type="date" value={form.fecha_estimada} onChange={e => setForm(p => ({ ...p, fecha_estimada: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Presupuesto inicial</label>
                <MoneyInput value={form.presupuesto} onChange={v => setForm(p => ({ ...p, presupuesto: v }))} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Cuenta corriente del taller</label>
                <select value={form.cuenta_corriente_id} onChange={e => handleCuentaChange(e.target.value)} className={selectCls + ' w-full'}>
                  <option value="">Sin vincular</option>
                  {cuentasElegibles.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  <option value={NUEVA_CUENTA}>+ Crear cuenta corriente nueva</option>
                </select>
              </div>
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
              <Button type="submit" size="sm" disabled={pending}>{pending ? 'Guardando…' : 'Guardar'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <CrearCuentaTallerDialog
        open={crearCuentaOpen}
        nombreInicial={form.taller_nombre}
        onClose={() => setCrearCuentaOpen(false)}
        onCreated={handleCuentaCreada}
      />
    </>
  );
}

// ── Finalizar ─────────────────────────────────────────────────────────────────

function FinalizarDialog({ servicio, onClose }: { servicio: ServicioTaller | null; onClose: () => void }) {
  const updateServicio = useUpdateServicioTaller();
  const [importe, setImporte] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setImporte(servicio?.presupuesto != null ? String(servicio.presupuesto) : ''); setError(null); }, [servicio]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!servicio) return;
    setError(null);
    try {
      await updateServicio.mutateAsync({ id: servicio.id, data: { estado: 'FINALIZADO', importe_final: Number(importe) } });
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  return (
    <Dialog open={!!servicio} onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Finalizar servicio</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 mt-1">
          {servicio?.cuenta_corriente_id && (
            <p className="text-xs text-muted-foreground">Tiene cuenta corriente vinculada — se cargará el importe final como movimiento.</p>
          )}
          <div>
            <label className={labelCls}>Importe final *</label>
            <MoneyInput value={importe} onChange={setImporte} className={inputCls} required />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={updateServicio.isPending}>{updateServicio.isPending ? 'Guardando…' : 'Finalizar'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Retiro estimado (celda editable inline) ──────────────────────────────────

function RetiroEstimadoCell({ servicio }: { servicio: ServicioTaller }) {
  const updateServicio = useUpdateServicioTaller();
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(servicio.fecha_estimada ? servicio.fecha_estimada.slice(0, 10) : '');

  if (editando) {
    return (
      <input
        type="date"
        autoFocus
        value={valor}
        onChange={e => setValor(e.target.value)}
        onBlur={() => {
          setEditando(false);
          if (valor !== (servicio.fecha_estimada ? servicio.fecha_estimada.slice(0, 10) : '')) {
            updateServicio.mutate({ id: servicio.id, data: { fecha_estimada: valor || null } });
          }
        }}
        className={inputCls}
      />
    );
  }

  if (!servicio.fecha_estimada) {
    return (
      <button onClick={() => setEditando(true)} className="text-xs text-muted-foreground hover:text-foreground hover:underline">
        Sin fecha estimada
      </button>
    );
  }

  const diasRestantes = diferenciaDiasUTC(new Date(), new Date(servicio.fecha_estimada));
  const texto = diasRestantes > 0 ? `En ${diasRestantes} día${diasRestantes !== 1 ? 's' : ''}`
    : diasRestantes === 0 ? 'Hoy'
    : `Atrasado ${Math.abs(diasRestantes)} día${Math.abs(diasRestantes) !== 1 ? 's' : ''}`;
  const color = diasRestantes > 0 ? 'bg-green-100 text-green-800' : diasRestantes === 0 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800';

  return (
    <button onClick={() => setEditando(true)} className={cn('text-xs px-2 py-0.5 rounded-full font-medium hover:opacity-80', color)} title="Click para editar">
      {texto}
    </button>
  );
}

// ── Tab principal ─────────────────────────────────────────────────────────────

export default function TallerTab() {
  const [filtros, setFiltros] = useState<TallerFiltros>({});
  const { data: servicios = [], isLoading } = useTallerFlota(filtros);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ServicioTaller | null>(null);
  const [finalizando, setFinalizando] = useState<ServicioTaller | null>(null);
  const iniciarProceso = useUpdateServicioTaller();
  const deleteServicio = useDeleteServicioTaller();

  const stats = useMemo(() => {
    const esteAnio = new Date().getFullYear();
    const totalGastado = servicios
      .filter(s => s.importe_final != null && new Date(s.fecha_ingreso).getFullYear() === esteAnio)
      .reduce((sum, s) => sum + Number(s.importe_final), 0);
    const porVehiculo = new Map<string, number>();
    for (const s of servicios) {
      const key = s.camion?.codigo ?? String(s.camion_id);
      porVehiculo.set(key, (porVehiculo.get(key) ?? 0) + 1);
    }
    const top = [...porVehiculo.entries()].sort((a, b) => b[1] - a[1])[0];
    return { totalGastado, top };
  }, [servicios]);

  const handleDelete = (s: ServicioTaller) => {
    if (!window.confirm(`¿Eliminar el servicio de taller de "${s.camion?.codigo ?? s.camion_id}"?`)) return;
    deleteServicio.mutate(s.id, { onError: err => alert(getApiErrorMessage(err)) });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <select value={filtros.estado ?? ''} onChange={e => setFiltros(f => ({ ...f, estado: e.target.value || undefined }))} className={selectCls}>
            <option value="">Todos los estados</option>
            <option value="PRESUPUESTADO">Presupuestado</option>
            <option value="EN_PROCESO">En proceso</option>
            <option value="FINALIZADO">Finalizado</option>
            <option value="CANCELADO">Cancelado</option>
          </select>
        </div>
        <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <Plus size={14} className="mr-1.5" /> Nuevo servicio
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : servicios.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Wrench size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No hay servicios de taller registrados.</p>
        </div>
      ) : (
        <div className="rounded-lg border bg-white overflow-x-auto">
          <table className="w-full text-sm min-w-[1100px]">
            <thead className="border-b bg-muted/30">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Vehículo</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Taller</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Tipo</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Descripción</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Ingreso</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Retiro estimado</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Estado</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Presupuesto</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Final</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {servicios.map(s => (
                <tr key={s.id} className="hover:bg-muted/20">
                  <td className="px-3 py-2.5 font-mono font-medium">{s.camion?.codigo ?? '—'}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{s.taller_nombre ?? '-'}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{TIPO_LABEL[s.tipo]}</td>
                  <td className="px-3 py-2.5 text-muted-foreground max-w-[220px] truncate" title={s.descripcion}>{s.descripcion}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{formatDate(s.fecha_ingreso)}</td>
                  <td className="px-3 py-2.5"><RetiroEstimadoCell servicio={s} /></td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <ServicioTallerEstadoBadge estado={s.estado} />
                      {s.estado === 'EN_PROCESO' && <span className="text-xs text-muted-foreground">Día {diasEnTaller(s.fecha_ingreso)}</span>}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{s.presupuesto != null ? formatCurrency(s.presupuesto) : '-'}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{s.importe_final != null ? formatCurrency(s.importe_final) : '-'}</td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {s.estado === 'PRESUPUESTADO' && (
                        <Button variant="ghost" size="sm" onClick={() => iniciarProceso.mutate({ id: s.id, data: { estado: 'EN_PROCESO' } })}>
                          Iniciar
                        </Button>
                      )}
                      {s.estado === 'EN_PROCESO' && (
                        <Button variant="ghost" size="icon" onClick={() => setFinalizando(s)} title="Finalizar"><CheckCircle2 size={14} /></Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => { setEditing(s); setDialogOpen(true); }} title="Editar"><Pencil size={14} /></Button>
                      {s.estado === 'PRESUPUESTADO' && (
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(s)} className="text-destructive hover:text-destructive" title="Eliminar"><Trash2 size={14} /></Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
        <p>Total gastado en taller este año: <span className="font-semibold text-foreground">{formatCurrency(stats.totalGastado)}</span></p>
        {stats.top && <p>Vehículo con más visitas: <span className="font-semibold text-foreground">{stats.top[0]} ({stats.top[1]})</span></p>}
      </div>

      <ServicioDialog open={dialogOpen} servicio={editing} onClose={() => { setDialogOpen(false); setEditing(null); }} />
      <FinalizarDialog servicio={finalizando} onClose={() => setFinalizando(null)} />
    </div>
  );
}
