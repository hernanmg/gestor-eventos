import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useJornadas } from '@/hooks/useRRHH';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { JornadaDialog, soloHora, ESTADO_LABEL, ESTADO_VARIANT } from './index';

export default function JornadasPropias({ empleadoId }: { empleadoId: number }) {
  const { data: jornadas = [], isLoading } = useJornadas({ empleado_id: empleadoId });
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus size={14} className="mr-1.5" /> Cargar jornada
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-border">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Evento</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Fecha</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Ingreso</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Egreso</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Hs. norm.</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Hs. extra</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {jornadas.length === 0 ? (
                <tr><td colSpan={7} className="px-3 py-6 text-center text-sm text-muted-foreground">Todavía no cargaste jornadas.</td></tr>
              ) : jornadas.map(j => (
                <tr key={j.id}>
                  <td className="px-3 py-2.5">{j.evento?.nombre ?? 'Depósito'}</td>
                  <td className="px-3 py-2.5">{j.fecha.slice(0, 10)}</td>
                  <td className="px-3 py-2.5">{soloHora(j.hora_ingreso)}</td>
                  <td className="px-3 py-2.5">{soloHora(j.hora_egreso)}</td>
                  <td className="px-3 py-2.5 text-right">{j.horas_normales}</td>
                  <td className="px-3 py-2.5 text-right">{j.horas_extras}</td>
                  <td className="px-3 py-2.5">
                    <span title={j.estado === 'RECHAZADA' ? j.motivo_rechazo ?? undefined : undefined}>
                      <Badge variant={ESTADO_VARIANT[j.estado]}>{ESTADO_LABEL[j.estado]}</Badge>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <JornadaDialog open={dialogOpen} onClose={() => setDialogOpen(false)} empleadoIdFijo={empleadoId} />
    </div>
  );
}
