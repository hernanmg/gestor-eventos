import { Fuel } from 'lucide-react';
import { useCombustible } from '@/hooks/useCombustible';
import { formatDate, formatCurrency, formatLitros } from '@/lib/formatters';
import { CombustibleEstadoBadge } from '@/components/ui/badge';

export default function EventoCombustibleTab({ eventoId }: { eventoId: number }) {
  const { data: cargas = [], isLoading } = useCombustible({ evento_id: eventoId });

  const totalLitros = cargas.reduce((s, c) => s + Number(c.litros), 0);
  const totalMonto  = cargas.reduce((s, c) => s + Number(c.monto_total), 0);

  if (isLoading) return <p className="p-6 text-sm text-muted-foreground">Cargando...</p>;

  return (
    <div className="p-6 space-y-4">
      {cargas.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Fuel size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Este evento no tiene combustible cargado.</p>
        </div>
      ) : (
        <>
          <div className="rounded-lg border bg-white overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead className="border-b bg-muted/30">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Fecha</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Vehículo</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Litros</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Monto</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {cargas.map(c => (
                  <tr key={c.id} className="hover:bg-muted/20">
                    <td className="px-3 py-2.5 text-muted-foreground">{formatDate(c.fecha)}</td>
                    <td className="px-3 py-2.5 font-mono font-medium">{c.camion?.codigo ?? '-'}</td>
                    <td className="px-3 py-2.5">{formatLitros(c.litros)} L</td>
                    <td className="px-3 py-2.5 font-medium">{formatCurrency(c.monto_total)}</td>
                    <td className="px-3 py-2.5"><CombustibleEstadoBadge estado={c.estado} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <p>Total litros: <span className="font-semibold text-foreground">{formatLitros(totalLitros)} L</span></p>
            <p>Total monto: <span className="font-semibold text-foreground">{formatCurrency(totalMonto)}</span></p>
          </div>
        </>
      )}
    </div>
  );
}
