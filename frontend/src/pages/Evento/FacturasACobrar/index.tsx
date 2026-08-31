import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useFacturasEmitidas } from '@/hooks/useFacturasEmitidas';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { FacturaEmitidaEstadoBadge } from '@/components/ui/badge';
import FacturaEmitidaForm from '@/pages/FacturasEmitidas/FacturaEmitidaForm';
import FacturaEmitidaDetalle from '@/pages/FacturasEmitidas/FacturaEmitidaDetalle';
import { TIPO_COMPROBANTE_LABEL } from '@/pages/FacturasEmitidas/labels';
import { formatCurrency } from '@/lib/formatters';

interface Props {
  eventoId:   number;
  eventoNombre: string;
}

// Tab "A Cobrar" dentro de un evento — facturas emitidas a clientes vinculadas
// a este evento_id. Distinto de la tab "Facturas" (cuentas a PAGAR a
// proveedores, ver Evento/Facturas/index.tsx) — ver FIX 4.
export default function FacturasACobrarTab({ eventoId, eventoNombre }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [openId,   setOpenId]   = useState<number | null>(null);
  const { data, isLoading } = useFacturasEmitidas({ evento_id: eventoId });

  const facturas = data?.items ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Facturas emitidas al cliente por este evento</p>
        <Button size="sm" onClick={() => setShowForm(true)}>
          <Plus size={14} className="mr-1.5" /> Nueva factura a cobrar
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : facturas.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-8 text-center">
          <p className="text-sm text-muted-foreground mb-3">Sin facturas a cobrar en este evento.</p>
          <Button size="sm" variant="outline" onClick={() => setShowForm(true)}>
            <Plus size={14} className="mr-1.5" /> Agregar factura a cobrar
          </Button>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground bg-muted/30">
                <th className="text-left py-2 px-3 font-medium">Tipo</th>
                <th className="text-left py-2 px-3 font-medium">Número</th>
                <th className="text-left py-2 px-3 font-medium">Cliente</th>
                <th className="text-left py-2 px-3 font-medium">Total</th>
                <th className="text-left py-2 px-3 font-medium">Cobrado</th>
                <th className="text-left py-2 px-3 font-medium">Saldo</th>
                <th className="text-left py-2 px-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {facturas.map(f => (
                <tr
                  key={f.id}
                  onClick={() => setOpenId(f.id)}
                  className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors cursor-pointer"
                >
                  <td className="py-2 px-3 text-xs text-muted-foreground">{TIPO_COMPROBANTE_LABEL[f.tipo_comprobante]}</td>
                  <td className="py-2 px-3 font-mono text-xs">{String(f.punto_venta).padStart(4, '0')}-{f.numero ?? '—'}</td>
                  <td className="py-2 px-3 font-medium">{f.cliente_nombre}</td>
                  <td className="py-2 px-3 font-medium">{formatCurrency(f.total, f.moneda)}</td>
                  <td className="py-2 px-3 text-green-700">{formatCurrency(f.total_cobrado, f.moneda)}</td>
                  <td className="py-2 px-3 font-medium text-orange-600">{formatCurrency(f.saldo_pendiente, f.moneda)}</td>
                  <td className="py-2 px-3"><FacturaEmitidaEstadoBadge estado={f.estado} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-2xl">
          <FacturaEmitidaForm onClose={() => setShowForm(false)} eventoId={eventoId} eventoNombre={eventoNombre} />
        </DialogContent>
      </Dialog>

      {openId !== null && (
        <FacturaEmitidaDetalle facturaId={openId} onClose={() => setOpenId(null)} />
      )}
    </div>
  );
}
