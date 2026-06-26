import { useState } from 'react';
import { Info } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useCobrarEcheq } from '@/hooks/useEcheqs';
import { usePosicionConsolidada } from '@/hooks/useCaja';
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
  const [referencia, setReferencia] = useState('');
  const [error,      setError]      = useState<string | null>(null);

  const cobrar    = useCobrarEcheq(echeq.evento_id);
  const { data: posicion } = usePosicionConsolidada(echeq.evento_id);

  // Build saldo map: cuenta_id → saldo_actual
  const saldoMap: Record<number, number> = {};
  posicion?.por_moneda.forEach(pm =>
    pm.cuentas.forEach(c => { saldoMap[c.cuenta_id] = c.saldo_actual; })
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!cuentaId) { setError('Seleccioná una cuenta bancaria'); return; }
    try {
      await cobrar.mutateAsync({
        id:               echeq.id,
        cuenta_id:        Number(cuentaId),
        fecha_cobro_real: fechaCobro || null,
        referencia:       referencia || null,
      });
      setCuentaId(''); setFechaCobro(''); setReferencia('');
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Error al registrar el pago');
    }
  };

  const input = 'w-full border border-input rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring';
  const label = 'block text-xs font-medium text-muted-foreground mb-0.5';

  const saldoCuenta = cuentaId ? saldoMap[Number(cuentaId)] : undefined;
  const saldoInsuficiente = saldoCuenta !== undefined && saldoCuenta < echeq.importe;

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar pago de echeq</DialogTitle>
        </DialogHeader>

        {/* Texto explicativo */}
        <div className="flex items-start gap-2 rounded-md bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-800 mb-1">
          <Info size={14} className="shrink-0 mt-0.5" />
          <span>
            Se registrará una <strong>salida de caja</strong> en la cuenta seleccionada
            por el importe del echeq. El dinero <strong>sale</strong> de tu cuenta bancaria.
          </span>
        </div>

        <div className="text-sm text-muted-foreground mb-3">
          <span className="font-medium text-foreground">{echeq.numero}</span>
          {echeq.razon_social && <> — {echeq.razon_social}</>}
          <span className="ml-2 font-semibold text-foreground">
            {formatCurrency(echeq.importe, echeq.moneda)}
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className={label}>Cuenta bancaria *</label>
            <select value={cuentaId} onChange={e => setCuentaId(e.target.value)} className={input}>
              <option value="">— Seleccionar cuenta</option>
              {cuentas.map(c => {
                const saldo = saldoMap[c.id];
                const saldoStr = saldo !== undefined
                  ? ` | Saldo: ${formatCurrency(saldo, c.moneda)}`
                  : '';
                return (
                  <option key={c.id} value={c.id}>
                    {c.nombre} ({c.moneda}){saldoStr}
                  </option>
                );
              })}
            </select>
            {saldoInsuficiente && (
              <p className="text-xs text-amber-600 mt-1">
                ⚠ Saldo insuficiente — el pago llevará la cuenta a negativo
              </p>
            )}
          </div>

          <div>
            <label className={label}>Fecha de cobro efectivo</label>
            <input
              type="date"
              value={fechaCobro}
              onChange={e => setFechaCobro(e.target.value)}
              className={input}
            />
          </div>

          <div>
            <label className={label}>Referencia bancaria (opcional)</label>
            <input
              value={referencia}
              onChange={e => setReferencia(e.target.value)}
              placeholder="N° de débito, CBU, etc."
              className={input}
            />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={cobrar.isPending}>
              {cobrar.isPending ? 'Procesando…' : 'Confirmar pago'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
