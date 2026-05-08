import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/formatters';
import type { Moneda } from '@/types';

interface SaldoCellProps {
  saldo:  number | string;
  moneda: Moneda;
}

export function SaldoCell({ saldo, moneda }: SaldoCellProps) {
  const value = Number(saldo);
  return (
    <span className={cn('font-medium tabular-nums', value < 0 ? 'text-destructive' : 'text-foreground')}>
      {formatCurrency(value, moneda)}
    </span>
  );
}
