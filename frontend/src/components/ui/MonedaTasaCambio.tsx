import { formatCurrency } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { Moneda } from '@/types';

const MONEDAS: Moneda[] = ['ARS', 'USD', 'EUR'];

interface Props {
  moneda:       Moneda;
  monto:        number; // el importe en la moneda original — sólo para el preview
  tasaCambio:   string; // texto crudo del input, igual que el resto de los forms numéricos
  onMonedaChange: (moneda: Moneda) => void;
  onTasaChange:   (tasa: string) => void;
  className?:     string;
  size?:          'sm' | 'md';
}

// Select de moneda + (si ≠ ARS) input de tasa de cambio a ARS con preview en
// tiempo real. Reutilizado en el alta de Movimiento, Factura y Echeq.
export default function MonedaTasaCambio({
  moneda, monto, tasaCambio, onMonedaChange, onTasaChange, className, size = 'md',
}: Props) {
  const inputCls = cn(
    'border border-input rounded focus:outline-none focus:ring-1 focus:ring-ring',
    size === 'sm' ? 'px-1 py-0.5 text-xs' : 'px-2 py-1.5 text-sm',
  );
  const labelCls = size === 'sm' ? 'text-xs text-muted-foreground' : 'text-xs font-medium text-muted-foreground mb-0.5 block';

  const tasaNum   = parseFloat(tasaCambio);
  const preview   = moneda !== 'ARS' && monto > 0 && tasaNum > 0
    ? formatCurrency(monto * tasaNum, 'ARS')
    : null;

  return (
    <div className={cn('flex flex-wrap items-end gap-2', className)}>
      <div>
        {size !== 'sm' && <label className={labelCls}>Moneda</label>}
        <select
          value={moneda}
          onChange={e => onMonedaChange(e.target.value as Moneda)}
          className={inputCls}
        >
          {MONEDAS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      {moneda !== 'ARS' && (
        <div>
          {size !== 'sm' && <label className={labelCls}>{moneda} → ARS</label>}
          <input
            type="number" min="0" step="0.0001"
            value={tasaCambio}
            onChange={e => onTasaChange(e.target.value)}
            placeholder="Tasa de cambio"
            className={cn(inputCls, 'w-28 text-right')}
          />
        </div>
      )}

      {preview && (
        <span className="text-xs text-muted-foreground pb-1.5">= {preview}</span>
      )}
    </div>
  );
}
