import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Pencil } from 'lucide-react';
import { useProveedorDetalle, useUpdateProveedor } from '@/hooks/useProveedores';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { Proveedor } from '@/types';

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

// ── Edit dialog ───────────────────────────────────────────────────────────────

function EditDialog({ proveedor, open, onClose }: { proveedor: Proveedor; open: boolean; onClose: () => void }) {
  const [form,  setForm]  = useState({
    nombre:    proveedor.nombre,
    alias:     proveedor.alias     ?? '',
    cuit:      proveedor.cuit      ?? '',
    categoria: proveedor.categoria ?? '',
    notas:     proveedor.notas     ?? '',
  });
  const [error, setError] = useState<string | null>(null);
  const update = useUpdateProveedor(proveedor.id);

  const f = (key: string) => ({
    value:    (form as any)[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(p => ({ ...p, [key]: e.target.value })),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await update.mutateAsync({
        nombre:    form.nombre.trim(),
        alias:     form.alias.trim()     || undefined,
        cuit:      form.cuit.trim()      || undefined,
        categoria: form.categoria.trim() || undefined,
        notas:     form.notas.trim()     || undefined,
      });
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Error al guardar');
    }
  };

  const input = 'w-full border border-input rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring';
  const label = 'block text-xs font-medium text-muted-foreground mb-0.5';

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Editar proveedor</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 mt-1">
          <div>
            <label className={label}>Nombre *</label>
            <input {...f('nombre')} className={input} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Alias</label>
              <input {...f('alias')} className={input} />
            </div>
            <div>
              <label className={label}>CUIT</label>
              <input {...f('cuit')} className={input} placeholder="30-12345678-9" />
            </div>
          </div>
          <div>
            <label className={label}>Categoría</label>
            <input {...f('categoria')} className={input} />
          </div>
          <div>
            <label className={label}>Notas</label>
            <textarea {...f('notas')} rows={2} className={cn(input, 'resize-none')} />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={update.isPending}>
              {update.isPending ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── ProveedorDetallePage ──────────────────────────────────────────────────────

type HistorialTab = 'movimientos' | 'echeqs';

export default function ProveedorDetallePage() {
  const { id }     = useParams<{ id: string }>();
  const navigate   = useNavigate();
  const provId     = Number(id);
  const [histTab,  setHistTab]  = useState<HistorialTab>('movimientos');
  const [editOpen, setEditOpen] = useState(false);

  const { data, isLoading } = useProveedorDetalle(provId);

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Cargando...</div>;
  }
  if (!data) {
    return (
      <div className="p-6">
        <p className="text-sm text-destructive">Proveedor no encontrado.</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate('/proveedores')}>
          Volver
        </Button>
      </div>
    );
  }

  const { proveedor, historial } = data;
  const { stats } = historial;

  const th = 'px-3 py-2 text-left text-xs font-medium text-muted-foreground';
  const td = 'px-3 py-2 text-sm';

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button
          onClick={() => navigate('/proveedores')}
          className="text-muted-foreground hover:text-foreground transition-colors mt-1"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-semibold">
              {proveedor.nombre}
              {proveedor.alias && (
                <span className="text-muted-foreground font-normal text-lg ml-2">({proveedor.alias})</span>
              )}
            </h1>
            <span className={cn(
              'text-xs px-2 py-0.5 rounded-full font-medium',
              proveedor.activo ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500',
            )}>
              {proveedor.activo ? 'Activo' : 'Inactivo'}
            </span>
            {proveedor.categoria && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                {proveedor.categoria}
              </span>
            )}
          </div>
          {proveedor.cuit && (
            <p className="text-sm text-muted-foreground font-mono mt-0.5">CUIT: {proveedor.cuit}</p>
          )}
          {proveedor.notas && (
            <p className="text-sm text-muted-foreground mt-1">{proveedor.notas}</p>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
          <Pencil size={13} className="mr-1.5" /> Editar
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Movimientos"  value={stats.total_movimientos} />
        <StatCard label="Eventos"      value={stats.total_eventos} />
        <StatCard label="Facturado ARS" value={formatCurrency(stats.total_facturado_ars, 'ARS')} />
        <StatCard label="Facturado USD" value={formatCurrency(stats.total_facturado_usd, 'USD')} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Echeqs emitidos"   value={stats.total_echeqs_emitidos} />
        <StatCard label="Echeqs cobrados"   value={stats.total_echeqs_cobrados} />
        <StatCard label="Echeqs pendientes" value={stats.total_echeqs_pendientes} />
      </div>

      {/* Historial tabs */}
      <div>
        <div className="flex border-b border-border mb-4">
          {([
            { key: 'movimientos', label: 'Movimientos' },
            { key: 'echeqs',      label: 'Echeqs' },
          ] as { key: HistorialTab; label: string }[]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setHistTab(key)}
              className={cn(
                'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
                histTab === key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {histTab === 'movimientos' && (
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-border">
                <tr>
                  <th className={th}>Evento</th>
                  <th className={th}>Tipo</th>
                  <th className={th}>Tab</th>
                  <th className={th}>Fecha</th>
                  <th className={th}>Concepto</th>
                  <th className={cn(th, 'text-right')}>Debe</th>
                  <th className={cn(th, 'text-right')}>Haber</th>
                  <th className={th}>Moneda</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {historial.movimientos.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                      Sin movimientos.
                    </td>
                  </tr>
                ) : historial.movimientos.map((m: any) => (
                  <tr
                    key={m.id}
                    className="cursor-pointer hover:bg-accent/30 transition-colors"
                    onClick={() => navigate(`/eventos/${m.evento_id}`)}
                  >
                    <td className={cn(td, 'font-medium')}>{m.evento_nombre}</td>
                    <td className={cn(td, 'text-muted-foreground text-xs')}>{m.tipo}</td>
                    <td className={cn(td, 'text-muted-foreground text-xs')}>{m.tab_nombre}</td>
                    <td className={cn(td, 'text-muted-foreground')}>{formatDate(m.fecha)}</td>
                    <td className={td}>{m.concepto ?? '—'}</td>
                    <td className={cn(td, 'text-right tabular-nums')}>{formatCurrency(m.debe, m.moneda)}</td>
                    <td className={cn(td, 'text-right tabular-nums')}>{formatCurrency(m.haber, m.moneda)}</td>
                    <td className={cn(td, 'text-muted-foreground text-xs')}>{m.moneda}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {historial.movimientos.length === 20 && (
              <p className="px-3 py-2 text-xs text-muted-foreground border-t border-border">
                Mostrando los últimos 20 movimientos.
              </p>
            )}
          </div>
        )}

        {histTab === 'echeqs' && (
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-border">
                <tr>
                  <th className={th}>Evento</th>
                  <th className={th}>N°</th>
                  <th className={cn(th, 'text-right')}>Importe</th>
                  <th className={th}>Moneda</th>
                  <th className={th}>Estado</th>
                  <th className={th}>Emisión</th>
                  <th className={th}>Cobro real</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {historial.echeqs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                      Sin echeqs.
                    </td>
                  </tr>
                ) : historial.echeqs.map((e: any) => (
                  <tr
                    key={e.id}
                    className="cursor-pointer hover:bg-accent/30 transition-colors"
                    onClick={() => navigate(`/eventos/${e.evento_id}`)}
                  >
                    <td className={cn(td, 'font-medium')}>{e.evento_nombre}</td>
                    <td className={cn(td, 'font-mono text-xs')}>{e.numero}</td>
                    <td className={cn(td, 'text-right tabular-nums font-medium')}>{formatCurrency(e.importe, e.moneda)}</td>
                    <td className={cn(td, 'text-muted-foreground text-xs')}>{e.moneda}</td>
                    <td className={td}>
                      <span className={cn(
                        'text-xs px-2 py-0.5 rounded-full font-medium',
                        e.estado === 'COBRADO'   && 'bg-green-50 text-green-700',
                        e.estado === 'PENDIENTE' && 'bg-amber-50 text-amber-700',
                        e.estado === 'RECHAZADO' && 'bg-red-50 text-red-700',
                      )}>
                        {e.estado}
                      </span>
                    </td>
                    <td className={cn(td, 'text-muted-foreground')}>{formatDate(e.fecha_emision)}</td>
                    <td className={cn(td, 'text-muted-foreground')}>{formatDate(e.fecha_cobro_real)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <EditDialog proveedor={proveedor} open={editOpen} onClose={() => setEditOpen(false)} />
    </div>
  );
}
