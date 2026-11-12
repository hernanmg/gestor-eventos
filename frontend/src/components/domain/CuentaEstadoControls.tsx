import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useUpdateEstadoCuenta } from '@/hooks/useCaja';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { CuentaBancaria } from '@/types';

const input = 'w-full border border-input rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring';
const label = 'block text-xs font-medium text-muted-foreground mb-0.5';

// ── Badge de estado ────────────────────────────────────────────────────────────

export function EstadoBadge({ estado }: { estado: CuentaBancaria['estado'] }) {
  const cls = estado === 'ABIERTA'
    ? 'bg-green-50 text-green-700'
    : estado === 'PENDIENTE_RENDICION'
    ? 'bg-amber-50 text-amber-700'
    : 'bg-gray-100 text-gray-600';
  const texto = estado === 'ABIERTA' ? 'Abierta' : estado === 'PENDIENTE_RENDICION' ? 'Pendiente rendición' : 'Cerrada';
  return (
    <span className={cn('inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-full font-medium', cls)}>
      {estado === 'PENDIENTE_RENDICION' && <AlertTriangle size={11} />}
      {texto}
    </span>
  );
}

// ── Dialog: Marcar pendiente de rendición (ABIERTA → PENDIENTE_RENDICION) ────

export function MarcarPendienteDialog({ cuenta, open, onClose }: { cuenta: CuentaBancaria; open: boolean; onClose: () => void }) {
  const [notas, setNotas] = useState('');
  const [error, setError] = useState<string | null>(null);
  const updateEstado = useUpdateEstadoCuenta();

  const handleConfirm = async () => {
    setError(null);
    try {
      await updateEstado.mutateAsync({ id: cuenta.id, estado: 'PENDIENTE_RENDICION', notas_rendicion: notas.trim() || null });
      setNotas('');
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Error al actualizar el estado');
    }
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Marcar pendiente de rendición</DialogTitle>
        </DialogHeader>
        <p className="text-sm">
          ¿Confirmar que <strong>{cuenta.nombre}</strong> volvió y la cuenta está pendiente de rendición?
        </p>
        <div>
          <label className={label}>Notas (opcional)</label>
          <textarea value={notas} onChange={e => setNotas(e.target.value)} className={cn(input, 'min-h-16')} />
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button type="button" size="sm" disabled={updateEstado.isPending} onClick={handleConfirm}>
            {updateEstado.isPending ? 'Guardando…' : 'Confirmar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Dialog: Confirmar rendición — solo ADMIN (PENDIENTE_RENDICION → CERRADA) ─

export function ConfirmarRendicionDialog({ cuenta, open, onClose }: { cuenta: CuentaBancaria; open: boolean; onClose: () => void }) {
  const [notas, setNotas] = useState(cuenta.notas_rendicion ?? '');
  const [error, setError] = useState<string | null>(null);
  const updateEstado = useUpdateEstadoCuenta();

  const handleConfirm = async () => {
    setError(null);
    try {
      await updateEstado.mutateAsync({ id: cuenta.id, estado: 'CERRADA', notas_rendicion: notas.trim() || null });
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Error al cerrar la cuenta');
    }
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirmar rendición</DialogTitle>
        </DialogHeader>
        <p className="text-sm">
          Confirmá que la rendición de <strong>{cuenta.nombre}</strong> está completa.
        </p>
        <div>
          <label className={label}>Notas de rendición</label>
          <textarea value={notas} onChange={e => setNotas(e.target.value)} className={cn(input, 'min-h-16')} />
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button type="button" size="sm" disabled={updateEstado.isPending} onClick={handleConfirm}>
            {updateEstado.isPending ? 'Cerrando…' : 'Cerrar cuenta'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
