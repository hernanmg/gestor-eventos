import { useEffect, useState } from 'react';
import { Plus, Truck, Pencil, Wrench, ShieldOff } from 'lucide-react';
import {
  useVehiculosFlota, useVehiculoFlota, useCreateVehiculoFlota, useUpdateVehiculoFlota, useDarDeBajaVehiculo,
  useSegurosVehiculo, type VehiculoFiltros, type VehiculoPayload,
} from '@/hooks/useFlota';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SeguroEstadoBadge, PatenteEstadoBadge, ServicioTallerEstadoBadge } from '@/components/ui/badge';
import { cn, getApiErrorMessage } from '@/lib/utils';
import { formatDate, formatCurrency } from '@/lib/formatters';
import type { VehiculoFlota } from '@/types';

const inputCls = 'w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring';
const labelCls = 'block text-xs font-medium text-muted-foreground mb-0.5';
const selectCls = 'border border-input rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring bg-white';

// ── Formulario vehículo ───────────────────────────────────────────────────────

interface VehiculoFormData {
  codigo:          string;
  descripcion:     string;
  patente:         string;
  tipo:            string;
  marca:           string;
  modelo:          string;
  anio:            string;
  color:           string;
  titular:         string;
  numero_telepase: string;
}

const EMPTY: VehiculoFormData = {
  codigo: '', descripcion: '', patente: '', tipo: '', marca: '', modelo: '', anio: '', color: '', titular: '', numero_telepase: '',
};

function VehiculoDialog({ open, vehiculo, onClose }: { open: boolean; vehiculo: VehiculoFlota | null; onClose: () => void }) {
  const isEdit = !!vehiculo;
  const createVehiculo = useCreateVehiculoFlota();
  const updateVehiculo = useUpdateVehiculoFlota(vehiculo?.id ?? -1);
  const [form, setForm] = useState<VehiculoFormData>(EMPTY);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm(vehiculo ? {
      codigo: vehiculo.codigo, descripcion: vehiculo.descripcion ?? '', patente: vehiculo.patente ?? '', tipo: vehiculo.tipo ?? '',
      marca: vehiculo.marca ?? '', modelo: vehiculo.modelo ?? '', anio: vehiculo.anio ? String(vehiculo.anio) : '',
      color: vehiculo.color ?? '', titular: vehiculo.titular ?? '', numero_telepase: vehiculo.numero_telepase ?? '',
    } : EMPTY);
    setError(null);
  }, [vehiculo, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const payload: VehiculoPayload = {
      codigo:          form.codigo,
      descripcion:     form.descripcion || null,
      patente:         form.patente || null,
      tipo:            form.tipo || null,
      marca:           form.marca || null,
      modelo:          form.modelo || null,
      anio:            form.anio ? Number(form.anio) : null,
      color:           form.color || null,
      titular:         form.titular || null,
      numero_telepase: form.numero_telepase || null,
    };
    try {
      if (isEdit) await updateVehiculo.mutateAsync(payload);
      else        await createVehiculo.mutateAsync(payload);
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  const pending = createVehiculo.isPending || updateVehiculo.isPending;

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar vehículo' : 'Nuevo vehículo'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 mt-1">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Código *</label>
              <input value={form.codigo} onChange={e => setForm(p => ({ ...p, codigo: e.target.value }))} className={inputCls} required placeholder="C1" />
            </div>
            <div>
              <label className={labelCls}>Tipo</label>
              <input value={form.tipo} onChange={e => setForm(p => ({ ...p, tipo: e.target.value }))} className={inputCls} placeholder="camión, camioneta, van" />
            </div>
            <div>
              <label className={labelCls}>Marca</label>
              <input value={form.marca} onChange={e => setForm(p => ({ ...p, marca: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Modelo</label>
              <input value={form.modelo} onChange={e => setForm(p => ({ ...p, modelo: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Año</label>
              <input type="number" value={form.anio} onChange={e => setForm(p => ({ ...p, anio: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Color</label>
              <input value={form.color} onChange={e => setForm(p => ({ ...p, color: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Patente</label>
              <input value={form.patente} onChange={e => setForm(p => ({ ...p, patente: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>N° Telepase</label>
              <input value={form.numero_telepase} onChange={e => setForm(p => ({ ...p, numero_telepase: e.target.value }))} className={inputCls} />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Titular registral</label>
              <input value={form.titular} onChange={e => setForm(p => ({ ...p, titular: e.target.value }))} className={inputCls} />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Descripción</label>
              <input value={form.descripcion} onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))} className={inputCls} placeholder="Mercedes Sprinter blanca" />
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
  );
}

// ── Dar de baja ───────────────────────────────────────────────────────────────

function BajaDialog({ vehiculo, onClose }: { vehiculo: VehiculoFlota | null; onClose: () => void }) {
  const darDeBaja = useDarDeBajaVehiculo();
  const { data: seguros = [] } = useSegurosVehiculo(vehiculo?.id ?? null);
  const [motivo, setMotivo] = useState('');
  const [error, setError]   = useState<string | null>(null);

  useEffect(() => { setMotivo(''); setError(null); }, [vehiculo]);

  const segurosVigentes = seguros.filter(s => s.estado === 'VIGENTE' || s.estado === 'POR_VENCER');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehiculo) return;
    setError(null);
    try {
      await darDeBaja.mutateAsync({ id: vehiculo.id, motivo_baja: motivo });
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  return (
    <Dialog open={!!vehiculo} onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Dar de baja "{vehiculo?.codigo}"</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 mt-1">
          {segurosVigentes.length > 0 && (
            <p className="text-xs bg-yellow-50 text-yellow-800 border border-yellow-200 rounded px-2 py-1.5">
              ⚠️ Este vehículo tiene {segurosVigentes.length} seguro{segurosVigentes.length !== 1 ? 's' : ''} vigente{segurosVigentes.length !== 1 ? 's' : ''}
              {' '}({segurosVigentes.map(s => `${s.aseguradora}, vence ${formatDate(s.fecha_vencimiento)}`).join(' · ')}).
              Al darlo de baja, {segurosVigentes.length !== 1 ? 'quedarán' : 'quedará'} cancelado{segurosVigentes.length !== 1 ? 's' : ''} en el sistema.
            </p>
          )}
          <div>
            <label className={labelCls}>Motivo *</label>
            <textarea value={motivo} onChange={e => setMotivo(e.target.value)} className={cn(inputCls, 'min-h-20')} required />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button type="submit" size="sm" variant="destructive" disabled={darDeBaja.isPending}>
              {darDeBaja.isPending ? 'Guardando…' : 'Dar de baja'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Drawer de detalle ─────────────────────────────────────────────────────────

function DetalleVehiculo({ id, onClose }: { id: number | null; onClose: () => void }) {
  const { data: v, isLoading } = useVehiculoFlota(id);

  return (
    <Dialog open={id != null} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        {isLoading || !v ? (
          <p className="text-sm text-muted-foreground p-4">Cargando…</p>
        ) : (
          <div className="space-y-5">
            <DialogHeader><DialogTitle>{v.codigo} — {v.descripcion ?? v.tipo ?? 'Vehículo'}</DialogTitle></DialogHeader>

            <section className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <p><span className="text-muted-foreground">Marca/Modelo:</span> {v.marca ?? '—'} {v.modelo ?? ''}</p>
              <p><span className="text-muted-foreground">Año:</span> {v.anio ?? '—'}</p>
              <p><span className="text-muted-foreground">Color:</span> {v.color ?? '—'}</p>
              <p><span className="text-muted-foreground">Patente:</span> {v.patente ?? '—'}</p>
              <p><span className="text-muted-foreground">Titular:</span> {v.titular ?? '—'}</p>
              <p><span className="text-muted-foreground">Telepase:</span> {v.numero_telepase ?? '—'}</p>
            </section>

            <section>
              <h3 className="text-sm font-semibold mb-1.5">Seguros</h3>
              {v.seguros.length === 0 ? <p className="text-xs text-muted-foreground">Sin seguros cargados.</p> : (
                <div className="space-y-1">
                  {v.seguros.map(s => (
                    <div key={s.id} className="flex items-center justify-between text-xs border rounded px-2 py-1.5">
                      <span>{s.aseguradora} {s.numero_poliza ? `— Póliza ${s.numero_poliza}` : ''} · vence {formatDate(s.fecha_vencimiento)}</span>
                      <SeguroEstadoBadge estado={s.estado} />
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h3 className="text-sm font-semibold mb-1.5">Patentes</h3>
              {v.patentes.length === 0 ? <p className="text-xs text-muted-foreground">Sin patentes cargadas.</p> : (
                <div className="space-y-1">
                  {v.patentes.map(p => (
                    <div key={p.id} className="flex items-center justify-between text-xs border rounded px-2 py-1.5">
                      <span>{p.tipo} {p.anio}{p.cuota ? ` cuota ${p.cuota}` : ''} — {formatCurrency(p.importe)} · vence {formatDate(p.fecha_vencimiento)}</span>
                      <PatenteEstadoBadge estado={p.estado} />
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h3 className="text-sm font-semibold mb-1.5">Taller</h3>
              {v.servicios_taller.length === 0 ? <p className="text-xs text-muted-foreground">Sin servicios registrados.</p> : (
                <div className="space-y-1">
                  {v.servicios_taller.slice(0, 5).map(s => (
                    <div key={s.id} className="flex items-center justify-between text-xs border rounded px-2 py-1.5">
                      <span>{s.tipo} — {s.descripcion} · {formatDate(s.fecha_ingreso)}</span>
                      <ServicioTallerEstadoBadge estado={s.estado} />
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h3 className="text-sm font-semibold mb-1.5">Últimos peajes</h3>
              {v.gastos_peaje.length === 0 ? <p className="text-xs text-muted-foreground">Sin gastos de peaje.</p> : (
                <div className="space-y-1">
                  {v.gastos_peaje.map(g => (
                    <div key={g.id} className="flex items-center justify-between text-xs border rounded px-2 py-1.5">
                      <span>{formatDate(g.fecha)} — {g.ruta ?? (g.es_carga_telepase ? 'Carga telepase' : 'Peaje')}{g.evento ? ` · ${g.evento.nombre}` : ''}</span>
                      <span className="font-medium">{formatCurrency(g.importe)}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Badges auxiliares ─────────────────────────────────────────────────────────

function SeguroCell({ v }: { v: VehiculoFlota }) {
  if (!v.seguro_vigente) return <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-600">Sin seguro</span>;
  const s = v.seguro_vigente;
  if (s.estado === 'VENCIDO') return <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-red-100 text-red-800">VENCIDO</span>;
  if (s.estado === 'POR_VENCER') {
    const dias = Math.ceil((new Date(s.fecha_vencimiento).getTime() - Date.now()) / 86_400_000);
    return <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-yellow-100 text-yellow-800">Vence en {dias} día{dias !== 1 ? 's' : ''}</span>;
  }
  return <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-800">Vigente</span>;
}

// ── Tab principal ─────────────────────────────────────────────────────────────

export default function VehiculosTab({ focusVehiculoId }: { focusVehiculoId: number | null }) {
  const { user } = useAuth();
  const isAdmin = user?.rol === 'ADMIN';
  const [filtros, setFiltros] = useState<VehiculoFiltros>({ en_servicio: 'true' });
  const { data: vehiculos = [], isLoading } = useVehiculosFlota(filtros);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<VehiculoFlota | null>(null);
  const [baja, setBaja] = useState<VehiculoFlota | null>(null);
  const [detalleId, setDetalleId] = useState<number | null>(focusVehiculoId);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <select
          value={filtros.en_servicio ?? ''}
          onChange={e => setFiltros(f => ({ ...f, en_servicio: (e.target.value as 'true' | 'false') || undefined }))}
          className={selectCls}
        >
          <option value="true">En servicio</option>
          <option value="false">Dados de baja</option>
          <option value="">Todos</option>
        </select>
        {isAdmin && (
          <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Plus size={14} className="mr-1.5" /> Nuevo vehículo
          </Button>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : vehiculos.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Truck size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No hay vehículos registrados.</p>
        </div>
      ) : (
        <div className="rounded-lg border bg-white overflow-x-auto">
          <table className="w-full text-sm min-w-[800px]">
            <thead className="border-b bg-muted/30">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Código</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Marca/Modelo</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Patente</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Tipo</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Seguro</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">En taller</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Estado</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {vehiculos.map(v => (
                <tr key={v.id} className="hover:bg-muted/20 cursor-pointer" onClick={() => setDetalleId(v.id)}>
                  <td className="px-3 py-2.5 font-mono font-medium">{v.codigo}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{[v.marca, v.modelo].filter(Boolean).join(' ') || '-'}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{v.patente ?? '-'}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{v.tipo ?? '-'}</td>
                  <td className="px-3 py-2.5"><SeguroCell v={v} /></td>
                  <td className="px-3 py-2.5">
                    {v.en_taller ? <Wrench size={14} className="text-blue-600" /> : <span className="text-muted-foreground text-xs">—</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', v.en_servicio ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600')}>
                      {v.en_servicio ? 'En servicio' : 'De baja'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                    {isAdmin && (
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => { setEditing(v); setDialogOpen(true); }} title="Editar"><Pencil size={14} /></Button>
                        {v.en_servicio && (
                          <Button variant="ghost" size="icon" onClick={() => setBaja(v)} className="text-destructive hover:text-destructive" title="Dar de baja"><ShieldOff size={14} /></Button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <VehiculoDialog open={dialogOpen} vehiculo={editing} onClose={() => { setDialogOpen(false); setEditing(null); }} />
      <BajaDialog vehiculo={baja} onClose={() => setBaja(null)} />
      <DetalleVehiculo id={detalleId} onClose={() => setDetalleId(null)} />
    </div>
  );
}
