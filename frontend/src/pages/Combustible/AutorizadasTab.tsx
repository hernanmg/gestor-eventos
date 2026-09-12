import { CheckCircle2, XCircle, ShieldAlert } from 'lucide-react';
import { usePendientesAutorizacionCombustible, useAutorizarCombustible, useRechazarCombustible } from '@/hooks/useCombustible';
import { Button } from '@/components/ui/button';
import { getApiErrorMessage } from '@/lib/utils';
import { formatDate, formatCurrency, formatLitros } from '@/lib/formatters';

export default function AutorizadasTab() {
  const { data: pendientes = [], isLoading } = usePendientesAutorizacionCombustible();
  const autorizar = useAutorizarCombustible();
  const rechazar  = useRechazarCombustible();

  if (isLoading) return <p className="text-sm text-muted-foreground">Cargando...</p>;

  if (pendientes.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <ShieldAlert size={40} className="mx-auto mb-3 opacity-30" />
        <p className="text-sm">No hay cargas pendientes de autorización.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-white overflow-x-auto">
      <table className="w-full text-sm min-w-[800px]">
        <thead className="border-b bg-muted/30">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Fecha</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Vehículo</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Litros</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Monto</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Responsable</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Evento</th>
            <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {pendientes.map(c => (
            <tr key={c.id} className="hover:bg-muted/20">
              <td className="px-3 py-2.5 text-muted-foreground">{formatDate(c.fecha)}</td>
              <td className="px-3 py-2.5 font-mono font-medium">{c.camion?.codigo ?? '-'}</td>
              <td className="px-3 py-2.5">{formatLitros(c.litros)} L</td>
              <td className="px-3 py-2.5 font-medium">{formatCurrency(c.monto_total)}</td>
              <td className="px-3 py-2.5 text-muted-foreground">{c.responsable_nombre ?? '-'}</td>
              <td className="px-3 py-2.5 text-muted-foreground">{c.evento?.nombre ?? '-'}</td>
              <td className="px-3 py-2.5 text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost" size="sm"
                    onClick={() => autorizar.mutate(c.id, { onError: err => alert(getApiErrorMessage(err)) })}
                    className="text-green-700 hover:text-green-800"
                  >
                    <CheckCircle2 size={14} className="mr-1" /> Autorizar
                  </Button>
                  <Button
                    variant="ghost" size="sm"
                    onClick={() => rechazar.mutate(c.id, { onError: err => alert(getApiErrorMessage(err)) })}
                    className="text-destructive hover:text-destructive"
                  >
                    <XCircle size={14} className="mr-1" /> Rechazar
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
