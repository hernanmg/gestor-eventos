import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import type { EstadoEvento, EstadoEcheq } from '@/types';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
  {
    variants: {
      variant: {
        default:  'bg-secondary text-secondary-foreground',
        success:  'bg-green-100 text-green-800',
        muted:    'bg-gray-100 text-gray-600',
        info:     'bg-blue-100 text-blue-800',
        warning:  'bg-yellow-100 text-yellow-800',
        destructive: 'bg-red-100 text-red-700',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

const ESTADO_VARIANT: Record<EstadoEvento, VariantProps<typeof badgeVariants>['variant']> = {
  ACTIVO:    'success',
  CERRADO:   'muted',
  IMPORTADO: 'info',
};

const ESTADO_LABEL: Record<EstadoEvento, string> = {
  ACTIVO:    'Activo',
  CERRADO:   'Cerrado',
  IMPORTADO: 'Importado',
};

export function EstadoBadge({ estado }: { estado: EstadoEvento }) {
  return (
    <Badge variant={ESTADO_VARIANT[estado]}>
      {ESTADO_LABEL[estado]}
    </Badge>
  );
}

const ECHEQ_VARIANT: Record<EstadoEcheq, VariantProps<typeof badgeVariants>['variant']> = {
  PENDIENTE:  'warning',
  COBRADO:    'success',
  RECHAZADO:  'destructive',
};

const ECHEQ_LABEL: Record<EstadoEcheq, string> = {
  PENDIENTE:  'Pendiente',
  COBRADO:    'Cobrado',
  RECHAZADO:  'Rechazado',
};

export function EcheqEstadoBadge({ estado }: { estado: EstadoEcheq }) {
  return (
    <Badge variant={ECHEQ_VARIANT[estado]}>
      {ECHEQ_LABEL[estado]}
    </Badge>
  );
}
