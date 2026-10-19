import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/formatters';
import type { EstadoVencimiento } from '@/types';

// Semáforo de vencimientos (RTO/ITV, carnets, multas): verde vigente, amarillo
// dentro de los próximos 30 días, rojo vencido — mismo criterio que los
// seguros (backend/src/lib/vencimientos.ts).

function diasHasta(fechaISO: string): number {
  const hoy = new Date();
  const hoyUTC = Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  return Math.round((new Date(fechaISO).getTime() - hoyUTC) / 86_400_000);
}

export default function VencimientoBadge({ estado, fecha, prefijo, vacio = 'Sin cargar' }: {
  estado:   EstadoVencimiento | null | undefined;
  fecha:    string | null | undefined;
  prefijo?: string;
  vacio?:   string;
}) {
  if (!fecha || !estado) {
    return <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-600 whitespace-nowrap">{vacio}</span>;
  }
  const p = prefijo ? `${prefijo} ` : '';
  if (estado === 'VENCIDO') {
    return <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-red-100 text-red-800 whitespace-nowrap">{p}venció {formatDate(fecha)}</span>;
  }
  if (estado === 'POR_VENCER') {
    const dias = diasHasta(fecha);
    return (
      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-yellow-100 text-yellow-800 whitespace-nowrap" title={formatDate(fecha)}>
        {p}vence en {dias} día{dias !== 1 ? 's' : ''}
      </span>
    );
  }
  return <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-800 whitespace-nowrap')}>{p}{formatDate(fecha)}</span>;
}
