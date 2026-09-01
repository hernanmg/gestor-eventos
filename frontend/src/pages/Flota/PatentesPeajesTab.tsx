import { useEffect, useState } from 'react';
import { Plus, FileStack, Route as RouteIcon, CheckCircle, Trash2 } from 'lucide-react';
import {
  usePatentesFlota, useVehiculosFlota, useCreatePatenteVehiculo, useRegistrarPagoPatente,
  usePeajesFlota, useCreatePeaje, useDeletePeaje,
  type PatenteFiltros, type PatentePayload, type PeajeFiltros, type PeajePayload,
} from '@/hooks/useFlota';
import { useEventos } from '@/hooks/useEvento';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PatenteEstadoBadge } from '@/components/ui/badge';
import MoneyInput from '@/components/ui/MoneyInput';
import { cn, getApiErrorMessage } from '@/lib/utils';
import { formatDate, formatCurrency } from '@/lib/formatters';
import type { PatenteVehiculo } from '@/types';

const inputCls  = 'w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring';
const labelCls  = 'block text-xs font-medium text-muted-foreground mb-0.5';
const selectCls = 'border border-input rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring bg-white';

// ── Patentes ──────────────────────────────────────────────────────────────────

interface PatenteFormData {
  camion_id:         string;
  tipo:              'MUNICIPAL' | 'PROVINCIAL' | 'NACIONAL';
  anio:              string;
  cuota:             string;
  importe:           string;
  fecha_vencimiento: string;
  notas:             string;
}

const EMPTY_PATENTE: PatenteFormData = {
  camion_id: '', tipo: 'MUNICIPAL', anio: String(new Date().getFullYear()), cuota: '', importe: '', fecha_vencimiento: '', notas: '',
};

function PatenteDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: vehiculos = [] } = useVehiculosFlota();
  const [form, setForm] = useState<PatenteFormData>(EMPTY_PATENTE);
  const [error, setError] = useState<string | null>(null);
  const createPatente = useCreatePatenteVehiculo(Number(form.camion_id) || -1);

  useEffect(() => { setForm(EMPTY_PATENTE); setError(null); }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.camion_id) { setError('Seleccioná un vehículo'); return; }
    const payload: PatentePayload = {
      tipo: form.tipo, anio: Number(form.anio), cuota: form.cuota ? Number(form.cuota) : null,
      importe: Number(form.importe), fecha_vencimiento: form.fecha_vencimiento, notas: form.notas || null,
    };
    try {
      await createPatente.mutateAsync(payload);
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nueva patente</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 mt-1">
          <div>
            <label className={labelCls}>Vehículo *</label>
            <select value={form.camion_id} onChange={e => setForm(p => ({ ...p, camion_id: e.target.value }))} className={selectCls + ' w-full'} required>
              <option value="">Seleccionar…</option>
              {vehiculos.map(v => <option key={v.id} value={v.id}>{v.codigo} {v.descripcion ? `— ${v.descripcion}` : ''}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Tipo *</label>
              <select value={form.tipo} onChange={e => setForm(p => ({ ...p, tipo: e.target.value as PatenteFormData['tipo'] }))} className={selectCls + ' w-full'}>
                <option value="MUNICIPAL">Municipal</option>
                <option value="PROVINCIAL">Provincial</option>
                <option value="NACIONAL">Nacional</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Año *</label>
              <input type="number" value={form.anio} onChange={e => setForm(p => ({ ...p, anio: e.target.value }))} className={inputCls} required />
            </div>
            <div>
              <label className={labelCls}>Cuota</label>
              <input type="number" value={form.cuota} onChange={e => setForm(p => ({ ...p, cuota: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Importe *</label>
              <MoneyInput value={form.importe} onChange={v => setForm(p => ({ ...p, importe: v }))} className={inputCls} required />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Fecha vencimiento *</label>
              <input type="date" value={form.fecha_vencimiento} onChange={e => setForm(p => ({ ...p, fecha_vencimiento: e.target.value }))} className={inputCls} required />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Notas</label>
              <textarea value={form.notas} onChange={e => setForm(p => ({ ...p, notas: e.target.value }))} className={inputCls} />
            </div>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={createPatente.isPending}>{createPatente.isPending ? 'Guardando…' : 'Guardar'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PagoPatenteDialog({ patente, onClose }: { patente: PatenteVehiculo | null; onClose: () => void }) {
  const registrarPago = useRegistrarPagoPatente();
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [archivo, setArchivo] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setFecha(new Date().toISOString().slice(0, 10)); setArchivo(null); setError(null); }, [patente]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patente) return;
    try {
      await registrarPago.mutateAsync({ id: patente.id, fecha_pago: fecha, archivo });
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  return (
    <Dialog open={!!patente} onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Registrar pago de patente</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 mt-1">
          <div>
            <label className={labelCls}>Fecha de pago *</label>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className={inputCls} required />
          </div>
          <div>
            <label className={labelCls}>Comprobante</label>
            <input type="file" accept="application/pdf,image/*" onChange={e => setArchivo(e.target.files?.[0] ?? null)} className="text-sm" />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={registrarPago.isPending}>{registrarPago.isPending ? 'Guardando…' : 'Registrar pago'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PatentesSubTab({ focusVehiculoId }: { focusVehiculoId: number | null }) {
  const { user } = useAuth();
  const isAdmin = user?.rol === 'ADMIN';
  const [filtros, setFiltros] = useState<PatenteFiltros>(focusVehiculoId ? { vehiculo_id: focusVehiculoId } : {});
  const { data: patentes = [], isLoading } = usePatentesFlota(filtros);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pagando, setPagando] = useState<PatenteVehiculo | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <select value={filtros.estado ?? ''} onChange={e => setFiltros(f => ({ ...f, estado: e.target.value || undefined }))} className={selectCls}>
          <option value="">Todos los estados</option>
          <option value="PENDIENTE">Pendiente</option>
          <option value="PAGADA">Pagada</option>
          <option value="VENCIDA">Vencida</option>
        </select>
        {isAdmin && (
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus size={14} className="mr-1.5" /> Nueva patente
          </Button>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : patentes.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <FileStack size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No hay patentes cargadas.</p>
        </div>
      ) : (
        <div className="rounded-lg border bg-white overflow-x-auto">
          <table className="w-full text-sm min-w-[800px]">
            <thead className="border-b bg-muted/30">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Vehículo</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Tipo</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Año</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Cuota</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Vencimiento</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Importe</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Estado</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {patentes.map(p => (
                <tr key={p.id} className="hover:bg-muted/20">
                  <td className="px-3 py-2.5 font-mono font-medium">{p.camion?.codigo ?? '—'}</td>
                  <td className="px-3 py-2.5">{p.tipo}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{p.anio}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{p.cuota ?? '-'}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{formatDate(p.fecha_vencimiento)}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{formatCurrency(p.importe)}</td>
                  <td className="px-3 py-2.5"><PatenteEstadoBadge estado={p.estado} /></td>
                  <td className="px-3 py-2.5 text-right">
                    {isAdmin && p.estado === 'PENDIENTE' && (
                      <Button variant="ghost" size="icon" onClick={() => setPagando(p)} title="Registrar pago"><CheckCircle size={14} /></Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <PatenteDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
      <PagoPatenteDialog patente={pagando} onClose={() => setPagando(null)} />
    </div>
  );
}

// ── Peajes / Telepase ─────────────────────────────────────────────────────────

interface PeajeFormData {
  camion_id:           string;
  fecha:               string;
  ruta:                string;
  importe:             string;
  evento_id:           string;
  es_carga_telepase:   boolean;
  saldo_telepase_post: string;
  notas:               string;
}

const EMPTY_PEAJE: PeajeFormData = {
  camion_id: '', fecha: new Date().toISOString().slice(0, 10), ruta: '', importe: '', evento_id: '',
  es_carga_telepase: false, saldo_telepase_post: '', notas: '',
};

function PeajeDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: vehiculos = [] } = useVehiculosFlota();
  const { data: eventos = [] } = useEventos();
  const createPeaje = useCreatePeaje();
  const [form, setForm] = useState<PeajeFormData>(EMPTY_PEAJE);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setForm(EMPTY_PEAJE); setError(null); }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.camion_id) { setError('Seleccioná un vehículo'); return; }
    const payload: PeajePayload = {
      camion_id: Number(form.camion_id), fecha: form.fecha, ruta: form.ruta || null, importe: Number(form.importe),
      evento_id: form.evento_id ? Number(form.evento_id) : null, es_carga_telepase: form.es_carga_telepase,
      saldo_telepase_post: form.saldo_telepase_post ? Number(form.saldo_telepase_post) : null, notas: form.notas || null,
    };
    try {
      await createPeaje.mutateAsync(payload);
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Registrar peaje / carga telepase</DialogTitle></DialogHeader>
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
              <label className={labelCls}>Fecha *</label>
              <input type="date" value={form.fecha} onChange={e => setForm(p => ({ ...p, fecha: e.target.value }))} className={inputCls} required />
            </div>
            <div>
              <label className={labelCls}>Importe *</label>
              <MoneyInput value={form.importe} onChange={v => setForm(p => ({ ...p, importe: v }))} className={inputCls} required />
            </div>
            <div>
              <label className={labelCls}>Ruta</label>
              <input value={form.ruta} onChange={e => setForm(p => ({ ...p, ruta: e.target.value }))} className={inputCls} placeholder="Ruta 9, Autopista…" />
            </div>
            <div>
              <label className={labelCls}>Evento</label>
              <select value={form.evento_id} onChange={e => setForm(p => ({ ...p, evento_id: e.target.value }))} className={selectCls + ' w-full'}>
                <option value="">Sin vincular</option>
                {eventos.map(ev => <option key={ev.id} value={ev.id}>{ev.nombre}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.es_carga_telepase} onChange={e => setForm(p => ({ ...p, es_carga_telepase: e.target.checked }))} />
                Es carga de cuenta telepase
              </label>
            </div>
            {form.es_carga_telepase && (
              <div className="col-span-2">
                <label className={labelCls}>Saldo telepase post-carga</label>
                <MoneyInput value={form.saldo_telepase_post} onChange={v => setForm(p => ({ ...p, saldo_telepase_post: v }))} className={inputCls} />
              </div>
            )}
            <div className="col-span-2">
              <label className={labelCls}>Notas</label>
              <textarea value={form.notas} onChange={e => setForm(p => ({ ...p, notas: e.target.value }))} className={inputCls} />
            </div>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={createPeaje.isPending}>{createPeaje.isPending ? 'Guardando…' : 'Guardar'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PeajesSubTab() {
  const [filtros, setFiltros] = useState<PeajeFiltros>({});
  const { data: peajes = [], isLoading } = usePeajesFlota(filtros);
  const deletePeaje = useDeletePeaje();
  const [dialogOpen, setDialogOpen] = useState(false);

  const total = peajes.reduce((s, p) => s + Number(p.importe), 0);

  const handleDelete = (id: number) => {
    if (!window.confirm('¿Eliminar este gasto?')) return;
    deletePeaje.mutate(id, { onError: err => alert(getApiErrorMessage(err)) });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <input type="date" value={filtros.desde ?? ''} onChange={e => setFiltros(f => ({ ...f, desde: e.target.value || undefined }))} className={inputCls + ' w-auto'} />
          <input type="date" value={filtros.hasta ?? ''} onChange={e => setFiltros(f => ({ ...f, hasta: e.target.value || undefined }))} className={inputCls + ' w-auto'} />
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus size={14} className="mr-1.5" /> Registrar peaje/carga telepase
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : peajes.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <RouteIcon size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No hay gastos de peaje registrados.</p>
        </div>
      ) : (
        <div className="rounded-lg border bg-white overflow-x-auto">
          <table className="w-full text-sm min-w-[800px]">
            <thead className="border-b bg-muted/30">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Fecha</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Vehículo</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Ruta</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Importe</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Evento</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Tipo</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {peajes.map(p => (
                <tr key={p.id} className="hover:bg-muted/20">
                  <td className="px-3 py-2.5 text-muted-foreground">{formatDate(p.fecha)}</td>
                  <td className="px-3 py-2.5 font-mono font-medium">{p.camion?.codigo ?? '—'}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{p.ruta ?? '-'}</td>
                  <td className="px-3 py-2.5 font-medium">{formatCurrency(p.importe)}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{p.evento?.nombre ?? '-'}</td>
                  <td className="px-3 py-2.5">
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', p.es_carga_telepase ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600')}>
                      {p.es_carga_telepase ? 'Carga telepase' : 'Peaje'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(p.id)} className="text-destructive hover:text-destructive" title="Eliminar"><Trash2 size={14} /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t bg-muted/30 font-medium">
                <td className="px-3 py-2.5" colSpan={3}>Total del período</td>
                <td className="px-3 py-2.5">{formatCurrency(total)}</td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <PeajeDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </div>
  );
}

// ── Tab principal ─────────────────────────────────────────────────────────────

export default function PatentesPeajesTab({ focusVehiculoId }: { focusVehiculoId: number | null }) {
  const [subTab, setSubTab] = useState<'patentes' | 'peajes'>('patentes');
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(['patentes', 'peajes'] as const).map(key => (
          <button
            key={key}
            onClick={() => setSubTab(key)}
            className={cn(
              'px-3 py-1.5 text-xs font-medium rounded-full transition-colors',
              subTab === key ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
            )}
          >
            {key === 'patentes' ? 'Patentes' : 'Peajes/Telepase'}
          </button>
        ))}
      </div>
      {subTab === 'patentes' ? <PatentesSubTab focusVehiculoId={focusVehiculoId} /> : <PeajesSubTab />}
    </div>
  );
}
