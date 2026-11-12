import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useSGRList, useCreateSGR, useUpdateSGR, useDeleteSGR, type SGRPayload } from '@/hooks/useSGR';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import MoneyInput from '@/components/ui/MoneyInput';
import { getApiErrorMessage, cn } from '@/lib/utils';
import { formatDate, formatCurrency } from '@/lib/formatters';
import type { SGR, EstadoVinculacionSGR, Moneda } from '@/types';
import BaseTable from '@/components/ui/BaseTable';

const inputCls  = 'w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring';
const labelCls  = 'block text-xs font-medium text-muted-foreground mb-0.5';
const selectCls = 'border border-input rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring bg-white';

const ESTADO_VARIANT: Record<EstadoVinculacionSGR, 'success' | 'warning' | 'destructive'> = {
  ACTIVO: 'success', SUSPENDIDO: 'warning', VENCIDO: 'destructive',
};
const ESTADO_LABEL: Record<EstadoVinculacionSGR, string> = {
  ACTIVO: 'Activo', SUSPENDIDO: 'Suspendido', VENCIDO: 'Vencido',
};

// Verde > 50% disponible, amarillo 20-50%, rojo < 20% — mismo umbral que la
// alerta de notificaciones/calendario (cupo_disponible < 20% del total).
function CupoBar({ total, disponible }: { total: number | null; disponible: number | null }) {
  if (total === null || total <= 0 || disponible === null) {
    return <span className="text-xs text-muted-foreground">Sin cupo cargado</span>;
  }
  const pct = Math.max(0, Math.min(100, (disponible / total) * 100));
  const color = pct > 50 ? 'bg-green-500' : pct >= 20 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="w-full min-w-[100px]">
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[11px] text-muted-foreground mt-0.5">{pct.toFixed(0)}% disponible</p>
    </div>
  );
}

// ── Dialog: nueva / editar SGR (todos los campos) ────────────────────────────

interface SGRFormData {
  empresa_id: string; nombre: string; estado_vinculacion: EstadoVinculacionSGR;
  fecha_vinculacion: string; fecha_vencimiento: string;
  cupo_total: string; cupo_utilizado: string; moneda: Moneda;
  contacto_nombre: string; contacto_tel: string; notas: string;
}

const EMPTY_FORM: SGRFormData = {
  empresa_id: '', nombre: '', estado_vinculacion: 'ACTIVO',
  fecha_vinculacion: '', fecha_vencimiento: '',
  cupo_total: '', cupo_utilizado: '', moneda: 'ARS',
  contacto_nombre: '', contacto_tel: '', notas: '',
};

function SGRDialog({ open, sgr, onClose }: { open: boolean; sgr: SGR | null; onClose: () => void }) {
  const isEdit = !!sgr;
  const { user } = useAuth();
  const puedeElegirEmpresa = !isEdit && !!user && (user.puedeCambiarEmpresa || user.puedeVerMacro);
  const [form, setForm] = useState<SGRFormData>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const createMut = useCreateSGR();
  const updateMut = useUpdateSGR(sgr?.id ?? -1);

  useEffect(() => {
    setForm(sgr ? {
      empresa_id: '', nombre: sgr.nombre, estado_vinculacion: sgr.estado_vinculacion,
      fecha_vinculacion: sgr.fecha_vinculacion?.slice(0, 10) ?? '', fecha_vencimiento: sgr.fecha_vencimiento?.slice(0, 10) ?? '',
      cupo_total: sgr.cupo_total !== null ? String(sgr.cupo_total) : '', cupo_utilizado: sgr.cupo_utilizado !== null ? String(sgr.cupo_utilizado) : '',
      moneda: sgr.moneda, contacto_nombre: sgr.contacto_nombre ?? '', contacto_tel: sgr.contacto_tel ?? '', notas: sgr.notas ?? '',
    } : { ...EMPTY_FORM, empresa_id: user?.empresaId != null ? String(user.empresaId) : '' });
    setError(null);
  }, [sgr, open, user?.empresaId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const payload: SGRPayload = {
      ...(puedeElegirEmpresa && form.empresa_id ? { empresa_id: Number(form.empresa_id) } : {}),
      nombre: form.nombre,
      estado_vinculacion: form.estado_vinculacion,
      fecha_vinculacion: form.fecha_vinculacion || null,
      fecha_vencimiento: form.fecha_vencimiento || null,
      cupo_total: form.cupo_total ? Number(form.cupo_total) : null,
      cupo_utilizado: form.cupo_utilizado ? Number(form.cupo_utilizado) : null,
      moneda: form.moneda,
      contacto_nombre: form.contacto_nombre || null,
      contacto_tel: form.contacto_tel || null,
      notas: form.notas || null,
    };
    try {
      if (isEdit) await updateMut.mutateAsync(payload);
      else        await createMut.mutateAsync(payload);
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  const pending = createMut.isPending || updateMut.isPending;

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>{isEdit ? 'Editar SGR' : 'Nueva SGR'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 mt-1">
          <div className="grid grid-cols-2 gap-3">
            {puedeElegirEmpresa && (
              <div className="col-span-2">
                <label className={labelCls}>Empresa</label>
                <select value={form.empresa_id} onChange={e => setForm(p => ({ ...p, empresa_id: e.target.value }))} className={selectCls + ' w-full'}>
                  {(user?.empresasDisponibles ?? []).map(e => (
                    <option key={e.id} value={e.id}>{e.nombre_corto ?? e.nombre}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="col-span-2">
              <label className={labelCls}>Nombre *</label>
              <input value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} className={inputCls} placeholder="Garantizar, Acindar…" required />
            </div>
            <div>
              <label className={labelCls}>Estado de vinculación</label>
              <select value={form.estado_vinculacion} onChange={e => setForm(p => ({ ...p, estado_vinculacion: e.target.value as EstadoVinculacionSGR }))} className={selectCls + ' w-full'}>
                <option value="ACTIVO">Activo</option>
                <option value="SUSPENDIDO">Suspendido</option>
                <option value="VENCIDO">Vencido</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Moneda</label>
              <select value={form.moneda} onChange={e => setForm(p => ({ ...p, moneda: e.target.value as Moneda }))} className={selectCls + ' w-full'}>
                <option value="ARS">ARS</option>
                <option value="USD">USD</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Fecha de vinculación</label>
              <input type="date" value={form.fecha_vinculacion} onChange={e => setForm(p => ({ ...p, fecha_vinculacion: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Fecha de vencimiento</label>
              <input type="date" value={form.fecha_vencimiento} onChange={e => setForm(p => ({ ...p, fecha_vencimiento: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Cupo total</label>
              <MoneyInput value={form.cupo_total} onChange={v => setForm(p => ({ ...p, cupo_total: v }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Cupo utilizado</label>
              <MoneyInput value={form.cupo_utilizado} onChange={v => setForm(p => ({ ...p, cupo_utilizado: v }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Contacto</label>
              <input value={form.contacto_nombre} onChange={e => setForm(p => ({ ...p, contacto_nombre: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Teléfono de contacto</label>
              <input value={form.contacto_tel} onChange={e => setForm(p => ({ ...p, contacto_tel: e.target.value }))} className={inputCls} />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Notas</label>
              <textarea value={form.notas} onChange={e => setForm(p => ({ ...p, notas: e.target.value }))} rows={2} className={cn(inputCls, 'resize-none')} />
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

// ── Dialog rápido: actualizar sólo el cupo ───────────────────────────────────

function ActualizarCupoDialog({ sgr, onClose }: { sgr: SGR; onClose: () => void }) {
  const [cupoTotal, setCupoTotal]     = useState(sgr.cupo_total !== null ? String(sgr.cupo_total) : '');
  const [cupoUtilizado, setCupoUtilizado] = useState(sgr.cupo_utilizado !== null ? String(sgr.cupo_utilizado) : '');
  const [error, setError] = useState<string | null>(null);
  const updateMut = useUpdateSGR(sgr.id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await updateMut.mutateAsync({
        cupo_total:     cupoTotal ? Number(cupoTotal) : null,
        cupo_utilizado: cupoUtilizado ? Number(cupoUtilizado) : null,
      });
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Actualizar cupo — {sgr.nombre}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 mt-1">
          <div>
            <label className={labelCls}>Cupo total</label>
            <MoneyInput value={cupoTotal} onChange={setCupoTotal} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Cupo utilizado</label>
            <MoneyInput value={cupoUtilizado} onChange={setCupoUtilizado} className={inputCls} />
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

// ── Tab principal ─────────────────────────────────────────────────────────────

export default function SGRTab() {
  const { data: sgrs = [], isLoading } = useSGRList();
  const deleteMut = useDeleteSGR();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing]       = useState<SGR | null>(null);
  const [cupoTarget, setCupoTarget] = useState<SGR | null>(null);

  const openNew  = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (s: SGR) => { setEditing(s); setDialogOpen(true); };
  const handleDelete = (s: SGR) => {
    if (!window.confirm(`¿Eliminar la SGR "${s.nombre}"?`)) return;
    deleteMut.mutate(s.id);
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={openNew}><Plus size={14} className="mr-1.5" /> Nueva SGR</Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : sgrs.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">Sin SGRs cargadas.</p>
      ) : (
        <div className="overflow-x-auto">
          <BaseTable className="w-full text-sm min-w-[820px]">
            <thead className="border-b bg-muted/30">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Nombre</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Estado</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Cupo total</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Utilizado</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Disponible</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Vencimiento</th>
                <th className="px-3 py-2 w-24" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {sgrs.map(s => (
                <tr key={s.id} className="hover:bg-muted/20">
                  <td className="px-3 py-2.5 font-medium">
                    {s.nombre}
                    {s.empresa && <span className="ml-2 text-xs text-muted-foreground">({s.empresa.nombre_corto ?? s.empresa.nombre})</span>}
                  </td>
                  <td className="px-3 py-2.5"><Badge variant={ESTADO_VARIANT[s.estado_vinculacion]}>{ESTADO_LABEL[s.estado_vinculacion]}</Badge></td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{s.cupo_total !== null ? formatCurrency(s.cupo_total, s.moneda) : '—'}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{s.cupo_utilizado !== null ? formatCurrency(s.cupo_utilizado, s.moneda) : '—'}</td>
                  <td className="px-3 py-2.5"><CupoBar total={s.cupo_total} disponible={s.cupo_disponible} /></td>
                  <td className="px-3 py-2.5 text-muted-foreground">{s.fecha_vencimiento ? formatDate(s.fecha_vencimiento) : '—'}</td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="outline" size="sm" className="h-6 text-xs" onClick={() => setCupoTarget(s)}>Cupo</Button>
                      <button onClick={() => openEdit(s)} className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"><Pencil size={13} /></button>
                      <button onClick={() => handleDelete(s)} className="p-1 rounded hover:bg-destructive/10 text-destructive"><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </BaseTable>
        </div>
      )}

      <SGRDialog open={dialogOpen} sgr={editing} onClose={() => setDialogOpen(false)} />
      {cupoTarget && <ActualizarCupoDialog sgr={cupoTarget} onClose={() => setCupoTarget(null)} />}
    </div>
  );
}
