import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import type { EstadoEvento, EstadoEcheq, EstadoMovimiento, EstadoSeguro, EstadoPatente, EstadoServicioTaller } from '@/types';

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

const MOVIMIENTO_VARIANT: Record<EstadoMovimiento, VariantProps<typeof badgeVariants>['variant']> = {
  PENDIENTE:  'muted',
  COTIZANDO:  'warning',
  CONFIRMADO: 'info',
  PAGADO:     'success',
  CANCELADO:  'destructive',
};

export const MOVIMIENTO_LABEL: Record<EstadoMovimiento, string> = {
  PENDIENTE:  'Pendiente',
  COTIZANDO:  'Cotizando',
  CONFIRMADO: 'Confirmado',
  PAGADO:     'Pagado',
  CANCELADO:  'Cancelado',
};

export function MovimientoEstadoBadge({ estado }: { estado: EstadoMovimiento }) {
  return (
    <Badge variant={MOVIMIENTO_VARIANT[estado]} className={cn(estado === 'CANCELADO' && 'line-through')}>
      {MOVIMIENTO_LABEL[estado]}
    </Badge>
  );
}

// ── Flota ─────────────────────────────────────────────────────────────────────

const SEGURO_VARIANT: Record<EstadoSeguro, VariantProps<typeof badgeVariants>['variant']> = {
  VIGENTE:     'success',
  POR_VENCER:  'warning',
  VENCIDO:     'destructive',
  CANCELADO:   'muted',
};

export const SEGURO_LABEL: Record<EstadoSeguro, string> = {
  VIGENTE:    'Vigente',
  POR_VENCER: 'Por vencer',
  VENCIDO:    'Vencido',
  CANCELADO:  'Cancelado',
};

export function SeguroEstadoBadge({ estado }: { estado: EstadoSeguro }) {
  return <Badge variant={SEGURO_VARIANT[estado]}>{SEGURO_LABEL[estado]}</Badge>;
}

const PATENTE_VARIANT: Record<EstadoPatente, VariantProps<typeof badgeVariants>['variant']> = {
  PAGADA:     'success',
  PENDIENTE:  'warning',
  VENCIDA:    'destructive',
};

export const PATENTE_LABEL: Record<EstadoPatente, string> = {
  PAGADA:    'Pagada',
  PENDIENTE: 'Pendiente',
  VENCIDA:   'Vencida',
};

export function PatenteEstadoBadge({ estado }: { estado: EstadoPatente }) {
  return <Badge variant={PATENTE_VARIANT[estado]}>{PATENTE_LABEL[estado]}</Badge>;
}

const SERVICIO_TALLER_VARIANT: Record<EstadoServicioTaller, VariantProps<typeof badgeVariants>['variant']> = {
  PRESUPUESTADO: 'muted',
  EN_PROCESO:    'info',
  FINALIZADO:    'success',
  CANCELADO:     'destructive',
};

export const SERVICIO_TALLER_LABEL: Record<EstadoServicioTaller, string> = {
  PRESUPUESTADO: 'Presupuestado',
  EN_PROCESO:    'En proceso',
  FINALIZADO:    'Finalizado',
  CANCELADO:     'Cancelado',
};

export function ServicioTallerEstadoBadge({ estado }: { estado: EstadoServicioTaller }) {
  return (
    <Badge variant={SERVICIO_TALLER_VARIANT[estado]} className={cn(estado === 'CANCELADO' && 'line-through')}>
      {SERVICIO_TALLER_LABEL[estado]}
    </Badge>
  );
}
