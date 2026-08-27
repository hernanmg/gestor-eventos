import { useEffect, useState } from 'react';
import { Plus, ShieldCheck, Pencil, Trash2, FileText } from 'lucide-react';
import {
  useSegurosFlota, useVehiculosFlota, useCreateSeguroVehiculo, useUpdateSeguroVehiculo, useDeleteSeguroVehiculo,
  polizaSeguroUrl, type SeguroFiltros, type SeguroPayload,
} from '@/hooks/useFlota';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SeguroEstadoBadge } from '@/components/ui/badge';
import { getApiErrorMessage } from '@/lib/utils';
import { formatDate, formatCurrency } from '@/lib/formatters';
import type { SeguroVehiculo, Moneda } from '@/types';

const inputCls  = 'w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring';
const labelCls  = 'block text-xs font-medium text-muted-foreground mb-0.5';
const selectCls = 'border border-input rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring bg-white';

interface SeguroFormData {
  camion_id:         string;
  aseguradora:       string;
  numero_poliza:     string;
  tipo_cobertura:    string;
  fecha_inicio:      string;
  fecha_vencimiento: string;
  importe_anual:     string;
  moneda:            Moneda;
  notas:             string;
}

const EMPTY: SeguroFormData = {
  camion_id: '', aseguradora: '', numero_poliza: '', tipo_cobertura: '', fecha_inicio: '', fecha_vencimiento: '',
  importe_anual: '', moneda: 'ARS', notas: '',
};

function SeguroDialog({ open, seguro, onClose }: { open: boolean; seguro: SeguroVehiculo | null; onClose: () => void }) {
  const isEdit = !!seguro;
  const { data: vehiculos = [] } = useVehiculosFlota();
  const [form, setForm] = useState<SeguroFormData>(EMPTY);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const updateSeguro = useUpdateSeguroVehiculo(seguro?.id ?? -1);

  useEffect(() => {
    setForm(seguro ? {
      camion_id: String(seguro.camion_id), aseguradora: seguro.aseguradora, numero_poliza: seguro.numero_poliza ?? '',
      tipo_cobertura: seguro.tipo_cobertura ?? '', fecha_inicio: seguro.fecha_inicio.slice(0, 10), fecha_vencimiento: seguro.fecha_vencimiento.slice(0, 10),
      importe_anual: seguro.importe_anual != null ? String(seguro.importe_anual) : '', moneda: seguro.moneda, notas: seguro.notas ?? '',
    } : EMPTY);
    setArchivo(null);
    setError(null);
  }, [seguro, open]);

  const createSeguroForVehiculo = useCreateSeguroVehiculo(Number(form.camion_id) || -1);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!isEdit && !form.camion_id) { setError('Seleccioná un vehículo'); return; }

    const payload: SeguroPayload = {
      aseguradora:       form.aseguradora,
      numero_poliza:     form.numero_poliza || null,
      tipo_cobertura:    form.tipo_cobertura || null,
      fecha_inicio:      form.fecha_inicio,
      fecha_vencimiento: form.fecha_vencimiento,
      importe_anual:     form.importe_anual ? Number(form.importe_anual) : null,
      moneda:            form.moneda,
      notas:             form.notas || null,
      archivo,
    };

    try {
      if (isEdit) await updateSeguro.mutateAsync(payload);
      else        await createSeguroForVehiculo.mutateAsync(payload);
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  const pending = updateSeguro.isPending || createSeguroForVehiculo.isPending;

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{isEdit ? 'Editar seguro' : 'Nuevo seguro'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 mt-1">
          {!isEdit && (
            <div>
              <label className={labelCls}>Vehículo *</label>
              <select value={form.camion_id} onChange={e => setForm(p => ({ ...p, camion_id: e.target.value }))} className={selectCls + ' w-full'} required>
                <option value="">Seleccionar…</option>
                {vehiculos.map(v => <option key={v.id} value={v.id}>{v.codigo} {v.descripcion ? `— ${v.descripcion}` : ''}</option>)}
              </select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className={labelCls}>Aseguradora *</label>
              <input value={form.aseguradora} onChange={e => setForm(p => ({ ...p, aseguradora: e.target.value }))} className={inputCls} required />
            </div>
            <div>
              <label className={labelCls}>N° de póliza</label>
              <input value={form.numero_poliza} onChange={e => setForm(p => ({ ...p, numero_poliza: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Tipo de cobertura</label>
              <input value={form.tipo_cobertura} onChange={e => setForm(p => ({ ...p, tipo_cobertura: e.target.value }))} className={inputCls} placeholder="Responsabilidad Civil, Todo Riesgo…" />
            </div>
            <div>
              <label className={labelCls}>Fecha inicio *</label>
              <input type="date" value={form.fecha_inicio} onChange={e => setForm(p => ({ ...p, fecha_inicio: e.target.value }))} className={inputCls} required />
            </div>
            <div>
              <label className={labelCls}>Fecha vencimiento *</label>
              <input type="date" value={form.fecha_vencimiento} onChange={e => setForm(p => ({ ...p, fecha_vencimiento: e.target.value }))} className={inputCls} required />
            </div>
            <div>
              <label className={labelCls}>Importe anual</label>
              <input type="number" step="0.01" value={form.importe_anual} onChange={e => setForm(p => ({ ...p, importe_anual: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Moneda</label>
              <select value={form.moneda} onChange={e => setForm(p => ({ ...p, moneda: e.target.value as Moneda }))} className={selectCls + ' w-full'}>
                <option value="ARS">ARS</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Póliza (PDF/imagen)</label>
              <input type="file" accept="application/pdf,image/*" onChange={e => setArchivo(e.target.files?.[0] ?? null)} className="text-sm" />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Notas</label>
              <textarea value={form.notas} onChange={e => setForm(p => ({ ...p, notas: e.target.value }))} className={inputCls} />
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

export default function SegurosTab() {
  const { user } = useAuth();
  const isAdmin = user?.rol === 'ADMIN';
  const [filtros, setFiltros] = useState<SeguroFiltros>({});
  const { data: seguros = [], isLoading } = useSegurosFlota(filtros);
  const deleteSeguro = useDeleteSeguroVehiculo();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SeguroVehiculo | null>(null);

  const ordenados = [...seguros].sort((a, b) => new Date(a.fecha_vencimiento).getTime() - new Date(b.fecha_vencimiento).getTime());

  const handleDelete = (s: SeguroVehiculo) => {
    if (!window.confirm(`¿Eliminar el seguro de "${s.aseguradora}"?`)) return;
    deleteSeguro.mutate(s.id, { onError: err => alert(getApiErrorMessage(err)) });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <select value={filtros.estado ?? ''} onChange={e => setFiltros(f => ({ ...f, estado: e.target.value || undefined }))} className={selectCls}>
            <option value="">Todos los estados</option>
            <option value="VIGENTE">Vigente</option>
            <option value="POR_VENCER">Por vencer</option>
            <option value="VENCIDO">Vencido</option>
            <option value="CANCELADO">Cancelado</option>
          </select>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Plus size={14} className="mr-1.5" /> Nuevo seguro
          </Button>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : ordenados.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <ShieldCheck size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No hay seguros cargados.</p>
        </div>
      ) : (
        <div className="rounded-lg border bg-white overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead className="border-b bg-muted/30">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Vehículo</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Aseguradora</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Póliza</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Cobertura</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Vencimiento</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Importe anual</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Estado</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {ordenados.map(s => (
                <tr key={s.id} className="hover:bg-muted/20">
                  <td className="px-3 py-2.5 font-mono font-medium">{s.camion?.codigo ?? '—'}</td>
                  <td className="px-3 py-2.5">{s.aseguradora}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{s.numero_poliza ?? '-'}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{s.tipo_cobertura ?? '-'}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{formatDate(s.fecha_vencimiento)}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{s.importe_anual != null ? formatCurrency(s.importe_anual, s.moneda) : '-'}</td>
                  <td className="px-3 py-2.5"><SeguroEstadoBadge estado={s.estado} /></td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      {s.documento_nombre && (
                        <Button variant="ghost" size="icon" onClick={() => window.open(polizaSeguroUrl(s.id), '_blank')} title="Ver póliza"><FileText size={14} /></Button>
                      )}
                      {isAdmin && (
                        <>
                          <Button variant="ghost" size="icon" onClick={() => { setEditing(s); setDialogOpen(true); }} title="Editar"><Pencil size={14} /></Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(s)} className="text-destructive hover:text-destructive" title="Eliminar"><Trash2 size={14} /></Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <SeguroDialog open={dialogOpen} seguro={editing} onClose={() => { setDialogOpen(false); setEditing(null); }} />
    </div>
  );
}
