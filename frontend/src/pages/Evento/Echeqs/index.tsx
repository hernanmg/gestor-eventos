import { useState } from 'react';
import { AlertTriangle, Search, Trash2, X } from 'lucide-react';
import {
  useEcheqs, useAlertasEcheqs, useDeleteEcheq, useRechazarEcheq,
  type EcheqFilters,
} from '@/hooks/useEcheqs';
import { useCuentas } from '@/hooks/useCaja';
import { EcheqEstadoBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import CobrarEcheqDialog from '@/components/domain/CobrarEcheqDialog';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { Echeq } from '@/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function DiasVencimiento({ dias }: { dias: number | null }) {
  if (dias === null) return <span className="text-muted-foreground">—</span>;
  if (dias < 0) {
    return (
      <span className="font-medium text-red-600">
        Vencido ({Math.abs(dias)}d)
      </span>
    );
  }
  if (dias <= 7) {
    return <span className="font-medium text-amber-600">{dias}d</span>;
  }
  return <span className="text-muted-foreground">{dias}d</span>;
}

// ── Rechazar Dialog ───────────────────────────────────────────────────────────

function RechazarDialog({
  echeq, open, onClose,
}: {
  echeq:   Echeq;
  open:    boolean;
  onClose: () => void;
}) {
  const [motivo, setMotivo] = useState('');
  const [error,  setError]  = useState<string | null>(null);
  const rechazar = useRechazarEcheq(echeq.evento_id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await rechazar.mutateAsync({ id: echeq.id, motivo_rechazo: motivo || null });
      setMotivo('');
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Error al rechazar');
    }
  };

  const input = 'w-full border border-input rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring';
  const label = 'block text-xs font-medium text-muted-foreground mb-0.5';

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rechazar echeq</DialogTitle>
        </DialogHeader>
        <div className="text-sm text-muted-foreground mb-3">
          <span className="font-medium text-foreground">{echeq.numero}</span> — {echeq.razon_social}
          <span className="ml-2 font-medium text-foreground">
            {formatCurrency(echeq.importe, echeq.moneda)}
          </span>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className={label}>Motivo de rechazo (opcional)</label>
            <textarea
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              rows={3}
              className={cn(input, 'resize-none')}
              placeholder="Ej: Fondos insuficientes, datos incorrectos…"
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button type="submit" size="sm" variant="destructive" disabled={rechazar.isPending}>
              {rechazar.isPending ? 'Rechazando…' : 'Rechazar echeq'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Alertas Banner ────────────────────────────────────────────────────────────

function AlertasBanner({ eventoId }: { eventoId: number }) {
  const { data } = useAlertasEcheqs(eventoId);
  if (!data) return null;

  const { vencidos, vencen_pronto } = data;
  if (vencidos.length === 0 && vencen_pronto.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 mb-4">
      {vencidos.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <span>
            <span className="font-medium">{vencidos.length} echeq{vencidos.length !== 1 ? 's' : ''} vencido{vencidos.length !== 1 ? 's' : ''}</span>
            {' — '}
            {vencidos.map(e => e.numero).join(', ')}
          </span>
        </div>
      )}
      {vencen_pronto.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <span>
            <span className="font-medium">{vencen_pronto.length} echeq{vencen_pronto.length !== 1 ? 's' : ''}</span>
            {' vence'}
            {vencen_pronto.length !== 1 ? 'n' : ''}
            {' en los próximos 7 días — '}
            {vencen_pronto.map(e => e.numero).join(', ')}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Filter Panel ──────────────────────────────────────────────────────────────

function FilterPanel({
  filters, onChange,
}: {
  filters:  EcheqFilters;
  onChange: (f: EcheqFilters) => void;
}) {
  const hasFilters = Object.values(filters).some(v => v !== undefined && v !== '');

  const input = 'border border-input rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring bg-white';

  return (
    <div className="flex flex-wrap items-end gap-2 mb-4">
      <div className="flex items-center gap-1 border border-input rounded px-2 py-1.5 bg-white">
        <Search size={13} className="text-muted-foreground shrink-0" />
        <input
          placeholder="Razón social"
          value={filters.razon_social ?? ''}
          onChange={e => onChange({ ...filters, razon_social: e.target.value || undefined })}
          className="text-sm focus:outline-none w-40"
        />
      </div>
      <select
        value={filters.estado ?? ''}
        onChange={e => onChange({ ...filters, estado: e.target.value || undefined })}
        className={input}
      >
        <option value="">Todos los estados</option>
        <option value="PENDIENTE">Pendiente</option>
        <option value="COBRADO">Cobrado</option>
        <option value="RECHAZADO">Rechazado</option>
      </select>
      <select
        value={filters.moneda ?? ''}
        onChange={e => onChange({ ...filters, moneda: e.target.value || undefined })}
        className={input}
      >
        <option value="">Todas las monedas</option>
        <option value="ARS">ARS</option>
        <option value="USD">USD</option>
      </select>
      <div className="flex items-center gap-1">
        <label className="text-xs text-muted-foreground">Desde</label>
        <input
          type="date"
          value={filters.desde ?? ''}
          onChange={e => onChange({ ...filters, desde: e.target.value || undefined })}
          className={input}
        />
      </div>
      <div className="flex items-center gap-1">
        <label className="text-xs text-muted-foreground">Hasta</label>
        <input
          type="date"
          value={filters.hasta ?? ''}
          onChange={e => onChange({ ...filters, hasta: e.target.value || undefined })}
          className={input}
        />
      </div>
      {hasFilters && (
        <button
          onClick={() => onChange({})}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition"
        >
          <X size={12} />
          Limpiar
        </button>
      )}
    </div>
  );
}

// ── EcheqsPage ────────────────────────────────────────────────────────────────

interface Props {
  eventoId: number;
  canEdit:  boolean;
}

export default function EcheqsPage({ eventoId, canEdit }: Props) {
  const [filters,        setFilters]        = useState<EcheqFilters>({});
  const [cobrarTarget,   setCobrarTarget]   = useState<Echeq | null>(null);
  const [rechazarTarget, setRechazarTarget] = useState<Echeq | null>(null);

  const { data: echeqs  = [], isLoading } = useEcheqs(eventoId, filters);
  const { data: cuentas = [] }            = useCuentas(eventoId);
  const deleteEcheq = useDeleteEcheq(eventoId);

  const activeCuentas = cuentas.filter(c => !c.deleted_at);

  const handleDelete = (e: Echeq) => {
    if (!window.confirm(`¿Eliminar echeq ${e.numero}?`)) return;
    deleteEcheq.mutate(e.id);
  };

  const th = 'px-3 py-2 text-left text-xs font-medium text-muted-foreground';
  const td = 'px-3 py-2 text-sm';

  return (
    <div>
      <AlertasBanner eventoId={eventoId} />
      <FilterPanel filters={filters} onChange={setFilters} />

      {isLoading ? (
        <p className="text-sm text-muted-foreground py-4">Cargando...</p>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-border">
              <tr>
                <th className={th}>N°</th>
                <th className={th}>Razón social</th>
                <th className={cn(th, 'text-right')}>Importe</th>
                <th className={th}>Moneda</th>
                <th className={th}>Estado</th>
                <th className={th}>Emisión</th>
                <th className={th}>Cobro est.</th>
                <th className={th}>Vto.</th>
                <th className={th}>Cobro real</th>
                {canEdit && <th className={cn(th, 'text-right')}>Acciones</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {echeqs.length === 0 ? (
                <tr>
                  <td colSpan={canEdit ? 10 : 9} className="py-10 text-center text-sm text-muted-foreground">
                    Sin echeqs{Object.values(filters).some(Boolean) ? ' con los filtros aplicados' : ''}.
                  </td>
                </tr>
              ) : echeqs.map(e => (
                <tr key={e.id} className={cn('group', e.estado === 'RECHAZADO' && 'opacity-60')}>
                  <td className={cn(td, 'font-mono text-xs')}>{e.numero}</td>
                  <td className={td}>
                    <div>{e.razon_social}</div>
                    {e.detalle && <div className="text-xs text-muted-foreground">{e.detalle}</div>}
                    {e.estado === 'RECHAZADO' && e.motivo_rechazo && (
                      <div className="text-xs text-red-600">{e.motivo_rechazo}</div>
                    )}
                  </td>
                  <td className={cn(td, 'text-right tabular-nums font-medium')}>
                    {formatCurrency(e.importe, e.moneda)}
                  </td>
                  <td className={cn(td, 'text-muted-foreground')}>{e.moneda}</td>
                  <td className={td}>
                    <EcheqEstadoBadge estado={e.estado} />
                  </td>
                  <td className={cn(td, 'text-muted-foreground')}>{formatDate(e.fecha_emision)}</td>
                  <td className={cn(td, 'text-muted-foreground')}>{formatDate(e.fecha_cobro_estimada)}</td>
                  <td className={td}>
                    <DiasVencimiento dias={e.dias_para_vencimiento} />
                  </td>
                  <td className={cn(td, 'text-muted-foreground')}>{formatDate(e.fecha_cobro_real)}</td>
                  {canEdit && (
                    <td className={td}>
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition">
                        {e.estado === 'PENDIENTE' && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 text-xs"
                              onClick={() => setCobrarTarget(e)}
                            >
                              Cobrar
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 text-xs text-destructive hover:text-destructive"
                              onClick={() => setRechazarTarget(e)}
                            >
                              Rechazar
                            </Button>
                          </>
                        )}
                        {e.estado !== 'COBRADO' && (
                          <button
                            onClick={() => handleDelete(e)}
                            title="Eliminar"
                            className="p-1 rounded text-destructive hover:bg-destructive/10 transition"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {cobrarTarget && (
        <CobrarEcheqDialog
          echeq={cobrarTarget}
          cuentas={activeCuentas}
          open
          onClose={() => setCobrarTarget(null)}
        />
      )}
      {rechazarTarget && (
        <RechazarDialog
          echeq={rechazarTarget}
          open
          onClose={() => setRechazarTarget(null)}
        />
      )}
    </div>
  );
}
