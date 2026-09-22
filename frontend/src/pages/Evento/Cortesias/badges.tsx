import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const base = 'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap';

/** VISADO: verde con ✓; sin visar: gris "Pendiente". */
export function VisadoBadge({ visado }: { visado: boolean }) {
  return visado
    ? <span className={cn(base, 'bg-green-100 text-green-700')}><Check size={11} /> Visado</span>
    : <span className={cn(base, 'bg-gray-100 text-gray-600')}>Pendiente</span>;
}

/** ENTREGADO: azul con ✓; si no, gris "Pendiente". */
export function EntregadoBadge({ entregado }: { entregado: boolean }) {
  return entregado
    ? <span className={cn(base, 'bg-blue-100 text-blue-700')}><Check size={11} /> Entregado</span>
    : <span className={cn(base, 'bg-gray-100 text-gray-600')}>Pendiente</span>;
}
