import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useCobrarEcheq } from '@/hooks/useEcheqs';
import { formatCurrency } from '@/lib/formatters';
import type { CuentaBancaria, Echeq } from '@/types';

interface Props {
  echeq:   Echeq;
  cuentas: CuentaBancaria[];
  open:    boolean;
  onClose: () => void;
}

export default function CobrarEcheqDialog({ echeq, cuentas, open, onClose }: Props) {
  const [cuentaId,   setCuentaId]   = useState('');
  const [fechaCobro, setFechaCobro] = useState('');
  const [error,      setError]      = useState<string | null>(null);
  const cobrar = useCobrarEcheq(echeq.evento_id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!cuentaId) { setError('Seleccioná una cuenta bancaria'); return; }
    try {
      await cobrar.mutateAsync({
        id:               echeq.id,
        cuenta_id:        Number(cuentaId),
        fecha_cobro_real: fechaCobro || null,
      });
      setCuentaId(''); setFechaCobro('');
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Error al cobrar');
    }
  };

  const input = 'w-full border border-input rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring';
  const label = 'block text-xs font-medium text-muted-foreground mb-0.5';

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cobrar echeq</DialogTitle>
        </DialogHeader>
        <div className="text-sm text-muted-foreground mb-3">
          <span className="font-medium text-foreground">{echeq.numero}</span> — {echeq.razon_social}
          <span className="ml-2 font-medium text-foreground">
            {formatCurrency(echeq.importe, echeq.moneda)}
          </span>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className={label}>Cuenta bancaria *</label>
            <select value={cuentaId} onChange={e => setCuentaId(e.target.value)} className={input}>
              <option value="">— Seleccionar cuenta</option>
              {cuentas.map(c => (
                <option key={c.id} value={c.id}>{c.nombre} ({c.moneda})</option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>Fecha de cobro</label>
            <input
              type="date"
              value={fechaCobro}
              onChange={e => setFechaCobro(e.target.value)}
              className={input}
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={cobrar.isPending}>
              {cobrar.isPending ? 'Procesando…' : 'Cobrar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
