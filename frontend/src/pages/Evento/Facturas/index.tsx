import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, CheckCircle, Clock, Ban } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useFacturasEvento } from '@/hooks/useFacturas';
import { Button } from '@/components/ui/button';
import type { EstadoFactura } from '@/types';
import { formatCurrency } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import FacturaForm from '@/pages/Facturas/FacturaForm';

const ESTADO_META: Record<EstadoFactura, { label: string; cls: string; Icon: any }> = {
  RECIBIDA: { label: 'Recibida',  cls: 'bg-blue-100 text-blue-800',    Icon: Clock },
  APROBADA: { label: 'Aprobada',  cls: 'bg-yellow-100 text-yellow-800', Icon: CheckCircle },
  PAGADA:   { label: 'Pagada',    cls: 'bg-green-100 text-green-800',   Icon: CheckCircle },
  ANULADA:  { label: 'Anulada',   cls: 'bg-red-100 text-red-800',      Icon: Ban },
};

interface Props { eventoId: number }

export default function EventoFacturas({ eventoId }: Props) {
  const [showForm, setShowForm] = useState(false);
  const { data: facturas = [], isLoading } = useFacturasEvento(eventoId);

  const pendienteTotal = facturas.filter(f => f.estado !== 'ANULADA').reduce((s, f) => s + f.importe_pendiente, 0);
  const vencidasCount  = facturas.filter(f =>
    f.fecha_vencimiento && f.estado !== 'PAGADA' && f.estado !== 'ANULADA' &&
    new Date(f.fecha_vencimiento) < new Date()
  ).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-3">
          {vencidasCount > 0 && (
            <span className="text-xs font-medium bg-destructive/10 text-destructive rounded px-2 py-1">
              {vencidasCount} vencida{vencidasCount !== 1 ? 's' : ''}
            </span>
          )}
          {pendienteTotal > 0 && (
            <span className="text-xs font-medium bg-orange-100 text-orange-700 rounded px-2 py-1">
              {formatCurrency(pendienteTotal, 'ARS')} pendiente
            </span>
          )}
        </div>
        <Button size="sm" onClick={() => setShowForm(true)}>
          <Plus size={14} className="mr-1.5" /> Nueva factura
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : facturas.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-8 text-center">
          <p className="text-sm text-muted-foreground mb-3">Sin facturas en este evento.</p>
          <Button size="sm" variant="outline" onClick={() => setShowForm(true)}>
            <Plus size={14} className="mr-1.5" /> Agregar factura
          </Button>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground bg-muted/30">
                <th className="text-left py-2 px-3 font-medium">Factura</th>
                <th className="text-left py-2 px-3 font-medium">Proveedor</th>
                <th className="text-left py-2 px-3 font-medium">Vencimiento</th>
                <th className="text-left py-2 px-3 font-medium">Total</th>
                <th className="text-left py-2 px-3 font-medium">Pendiente</th>
                <th className="text-left py-2 px-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {facturas.map(f => {
                const vencida = f.fecha_vencimiento && f.estado !== 'PAGADA' && f.estado !== 'ANULADA' && new Date(f.fecha_vencimiento) < new Date();
                const m = ESTADO_META[f.estado];
                return (
                  <tr key={f.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="py-2 px-3">
                      <Link to={`/facturas/${f.id}`} className="text-primary hover:underline font-medium">
                        {f.tipo_factura} {f.numero_factura}
                      </Link>
                    </td>
                    <td className="py-2 px-3 text-muted-foreground">{f.proveedor?.nombre ?? '—'}</td>
                    <td className={cn('py-2 px-3 text-xs', vencida ? 'text-destructive font-medium' : 'text-muted-foreground')}>
                      {f.fecha_vencimiento
                        ? format(new Date(f.fecha_vencimiento), 'dd/MM/yyyy', { locale: es })
                        : '—'}
                      {vencida && ' ⚠'}
                    </td>
                    <td className="py-2 px-3 font-medium">{formatCurrency(f.importe_total, f.moneda)}</td>
                    <td className={cn('py-2 px-3 font-medium', f.importe_pendiente > 0 && f.estado !== 'ANULADA' ? 'text-orange-600' : 'text-muted-foreground')}>
                      {formatCurrency(f.importe_pendiente, f.moneda)}
                    </td>
                    <td className="py-2 px-3">
                      <span className={cn('inline-flex items-center gap-1 text-xs rounded-full px-2 py-0.5 font-medium', m?.cls)}>
                        {m && <m.Icon size={10} />}
                        {m?.label ?? f.estado}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-2xl">
          <FacturaForm eventoId={eventoId} onClose={() => setShowForm(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
