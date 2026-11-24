import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useProveedorCuenta } from '@/hooks/useProveedores';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import BaseTable from '@/components/ui/BaseTable';
import TabStrip from '@/components/ui/TabStrip';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { EstadoFactura, EstadoOrdenCompra, EstadoOrdenPago, MedioPago } from '@/types';

// Cuenta del proveedor en su ficha: lo que se le debe, sus facturas, los pagos
// hechos y las órdenes de compra y de pago. Mismo acceso que Facturas a Pagar.

type Variante = 'muted' | 'info' | 'warning' | 'success' | 'destructive';

const EST_FACTURA: Record<EstadoFactura, { label: string; v: Variante }> = {
  RECIBIDA: { label: 'Recibida', v: 'info' },
  APROBADA: { label: 'Aprobada', v: 'warning' },
  PAGADA:   { label: 'Pagada',   v: 'success' },
  ANULADA:  { label: 'Anulada',  v: 'destructive' },
};
const EST_OC: Record<EstadoOrdenCompra, { label: string; v: Variante }> = {
  BORRADOR: { label: 'Borrador', v: 'muted' },
  EMITIDA:  { label: 'Emitida',  v: 'info' },
  RECIBIDA: { label: 'Recibida', v: 'warning' },
  CERRADA:  { label: 'Cerrada',  v: 'success' },
  ANULADA:  { label: 'Anulada',  v: 'destructive' },
};
const EST_OP: Record<EstadoOrdenPago, { label: string; v: Variante }> = {
  BORRADOR:   { label: 'Borrador',   v: 'muted' },
  REVISADA:   { label: 'Revisada',   v: 'info' },
  AUTORIZADA: { label: 'Autorizada', v: 'warning' },
  PAGADA:     { label: 'Pagada',     v: 'success' },
  ANULADA:    { label: 'Anulada',    v: 'destructive' },
};
const MEDIO: Record<MedioPago, string> = { TRANSFERENCIA: 'Transferencia', ECHEQ: 'Echeq', EFECTIVO: 'Efectivo', CHEQUE: 'Cheque' };

type Tab = 'facturas' | 'pagos' | 'oc' | 'op';

const th = 'px-3 py-2 text-left text-xs font-medium text-muted-foreground';
const td = 'px-3 py-2 text-sm';

function Vacio({ cols, texto }: { cols: number; texto: string }) {
  return <tr><td colSpan={cols} className="py-8 text-center text-sm text-muted-foreground">{texto}</td></tr>;
}

export default function CuentaProveedor({ proveedorId }: { proveedorId: number }) {
  const { data, isLoading } = useProveedorCuenta(proveedorId, true);
  const [tab, setTab] = useState<Tab>('facturas');
  const [soloPendientes, setSoloPendientes] = useState(false);

  if (isLoading || !data) return <p className="text-sm text-muted-foreground">Cargando la cuenta…</p>;

  const facturas = soloPendientes
    ? data.facturas.filter(f => f.estado !== 'ANULADA' && f.importe_pendiente > 0.005)
    : data.facturas;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-sm font-semibold">Cuenta del proveedor</h2>
        <div className="flex gap-2">
          <Button asChild size="sm" variant="outline"><Link to="/ordenes-compra"><Plus size={13} className="mr-1" /> Orden de compra</Link></Button>
          <Button asChild size="sm" variant="outline"><Link to="/ordenes-pago"><Plus size={13} className="mr-1" /> Orden de pago</Link></Button>
        </div>
      </div>

      {/* Saldo por moneda */}
      {data.saldo.length === 0 ? (
        <p className="text-sm text-muted-foreground">No tiene facturas cargadas.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {data.saldo.map(s => (
            <div key={s.moneda} className="contents">
              <div className="rounded-lg border border-border p-4">
                <p className="text-xs text-muted-foreground mb-1">Le debemos ({s.moneda})</p>
                <p className={cn('text-xl font-semibold tabular-nums', s.pendiente > 0.005 && 'text-amber-700')}>{formatCurrency(s.pendiente, s.moneda)}</p>
                <p className="text-xs text-muted-foreground mt-1">{s.facturas_pendientes} factura{s.facturas_pendientes === 1 ? '' : 's'} pendiente{s.facturas_pendientes === 1 ? '' : 's'}</p>
              </div>
              <div className="rounded-lg border border-border p-4">
                <p className="text-xs text-muted-foreground mb-1">Vencido ({s.moneda})</p>
                <p className={cn('text-xl font-semibold tabular-nums', s.vencido > 0.005 && 'text-destructive')}>{formatCurrency(s.vencido, s.moneda)}</p>
              </div>
              <div className="rounded-lg border border-border p-4">
                <p className="text-xs text-muted-foreground mb-1">Facturado ({s.moneda})</p>
                <p className="text-xl font-semibold tabular-nums">{formatCurrency(s.facturado, s.moneda)}</p>
              </div>
              <div className="rounded-lg border border-border p-4">
                <p className="text-xs text-muted-foreground mb-1">Pagado ({s.moneda})</p>
                <p className="text-xl font-semibold tabular-nums">{formatCurrency(s.pagado, s.moneda)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <TabStrip<Tab>
        value={tab}
        onChange={setTab}
        items={[
          { key: 'facturas', label: `Facturas (${data.facturas.length})` },
          { key: 'pagos',    label: `Pagos (${data.pagos.length})` },
          { key: 'oc',       label: `Órdenes de compra (${data.ordenes_compra.length})` },
          { key: 'op',       label: `Órdenes de pago (${data.ordenes_pago.length})` },
        ]}
      />

      {tab === 'facturas' && (
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={soloPendientes} onChange={e => setSoloPendientes(e.target.checked)} /> Sólo las pendientes de pago
          </label>
          <div className="overflow-x-auto">
            <BaseTable className="w-full">
              <thead className="bg-gray-50 border-b border-border">
                <tr>
                  <th className={th}>Factura</th>
                  <th className={th}>Emisión</th>
                  <th className={th}>Vence</th>
                  <th className={th}>Evento</th>
                  <th className={th}>Orden de compra</th>
                  <th className={cn(th, 'text-right')}>Total</th>
                  <th className={cn(th, 'text-right')}>Pendiente</th>
                  <th className={th}>Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {facturas.length === 0 ? <Vacio cols={8} texto={soloPendientes ? 'No hay facturas pendientes.' : 'Sin facturas.'} /> : facturas.map(f => (
                  <tr key={f.id}>
                    <td className={cn(td, 'font-medium')} data-label="Factura"><Link className="underline" to={`/facturas/${f.id}`}>{f.tipo_factura} {f.numero_factura}</Link></td>
                    <td className={cn(td, 'text-muted-foreground')} data-label="Emisión">{formatDate(f.fecha_emision)}</td>
                    <td className={cn(td, f.vencida ? 'text-destructive font-medium' : 'text-muted-foreground')} data-label="Vence">{formatDate(f.fecha_vencimiento)}</td>
                    <td className={td} data-label="Evento">{f.evento ? <Link className="underline" to={`/eventos/${f.evento.id}`}>{f.evento.nombre}</Link> : '—'}</td>
                    <td className={td} data-label="Orden de compra">{f.orden_compra ? <Link className="underline" to={`/ordenes-compra?abrir=${f.orden_compra.id}`}>{f.orden_compra.numero}</Link> : '—'}</td>
                    <td className={cn(td, 'text-right tabular-nums')} data-label="Total">{formatCurrency(f.importe_total, f.moneda)}</td>
                    <td className={cn(td, 'text-right tabular-nums', f.importe_pendiente > 0.005 && f.estado !== 'ANULADA' && 'font-medium')} data-label="Pendiente">
                      {f.estado === 'ANULADA' ? '—' : formatCurrency(f.importe_pendiente, f.moneda)}
                    </td>
                    <td className={td} data-label="Estado"><Badge variant={EST_FACTURA[f.estado].v}>{EST_FACTURA[f.estado].label}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </BaseTable>
          </div>
        </div>
      )}

      {tab === 'pagos' && (
        <div className="overflow-x-auto">
          <BaseTable className="w-full">
            <thead className="bg-gray-50 border-b border-border">
              <tr>
                <th className={th}>Fecha</th>
                <th className={th}>Factura</th>
                <th className={th}>Medio</th>
                <th className={th}>Referencia</th>
                <th className={th}>Orden de pago</th>
                <th className={cn(th, 'text-right')}>Importe</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.pagos.length === 0 ? <Vacio cols={6} texto="Sin pagos registrados." /> : data.pagos.map(p => (
                <tr key={p.id}>
                  <td className={cn(td, 'text-muted-foreground')} data-label="Fecha">{formatDate(p.fecha_pago)}</td>
                  <td className={td} data-label="Factura"><Link className="underline" to={`/facturas/${p.factura.id}`}>{p.factura.tipo_factura} {p.factura.numero_factura}</Link></td>
                  <td className={td} data-label="Medio">{MEDIO[p.medio_pago] ?? p.medio_pago}</td>
                  <td className={cn(td, 'text-muted-foreground text-xs')} data-label="Referencia">{p.referencia ?? '—'}</td>
                  <td className={td} data-label="Orden de pago">{p.orden_pago ? <Link className="underline" to={`/ordenes-pago?abrir=${p.orden_pago.id}`}>{p.orden_pago.numero}</Link> : '—'}</td>
                  <td className={cn(td, 'text-right tabular-nums font-medium')} data-label="Importe">{formatCurrency(p.importe, p.moneda)}</td>
                </tr>
              ))}
            </tbody>
          </BaseTable>
          {data.pagos.length === 200 && <p className="px-3 py-2 text-xs text-muted-foreground">Mostrando los últimos 200 pagos.</p>}
        </div>
      )}

      {tab === 'oc' && (
        <div className="overflow-x-auto">
          <BaseTable className="w-full">
            <thead className="bg-gray-50 border-b border-border">
              <tr>
                <th className={th}>Número</th>
                <th className={th}>Fecha</th>
                <th className={th}>Evento</th>
                <th className={cn(th, 'text-right')}>Total</th>
                <th className={th}>Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.ordenes_compra.length === 0 ? <Vacio cols={5} texto="Sin órdenes de compra." /> : data.ordenes_compra.map(o => (
                <tr key={o.id}>
                  <td className={cn(td, 'font-medium')} data-label="Número"><Link className="underline" to={`/ordenes-compra?abrir=${o.id}`}>{o.numero}</Link></td>
                  <td className={cn(td, 'text-muted-foreground')} data-label="Fecha">{formatDate(o.fecha)}</td>
                  <td className={td} data-label="Evento">{o.evento ? <Link className="underline" to={`/eventos/${o.evento.id}`}>{o.evento.nombre}</Link> : '—'}</td>
                  <td className={cn(td, 'text-right tabular-nums')} data-label="Total">{formatCurrency(o.total, o.moneda)}</td>
                  <td className={td} data-label="Estado"><Badge variant={EST_OC[o.estado].v}>{EST_OC[o.estado].label}</Badge></td>
                </tr>
              ))}
            </tbody>
          </BaseTable>
        </div>
      )}

      {tab === 'op' && (
        <div className="overflow-x-auto">
          <BaseTable className="w-full">
            <thead className="bg-gray-50 border-b border-border">
              <tr>
                <th className={th}>Número</th>
                <th className={th}>Fecha</th>
                <th className={th}>Concepto</th>
                <th className={cn(th, 'text-right')}>Total</th>
                <th className={th}>Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.ordenes_pago.length === 0 ? <Vacio cols={5} texto="Sin órdenes de pago." /> : data.ordenes_pago.map(o => (
                <tr key={o.id}>
                  <td className={cn(td, 'font-medium')} data-label="Número"><Link className="underline" to={`/ordenes-pago?abrir=${o.id}`}>{o.numero}</Link></td>
                  <td className={cn(td, 'text-muted-foreground')} data-label="Fecha">{formatDate(o.fecha)}</td>
                  <td className={td} data-label="Concepto">{o.concepto ?? '—'}</td>
                  <td className={cn(td, 'text-right tabular-nums')} data-label="Total">{formatCurrency(o.total, o.moneda)}</td>
                  <td className={td} data-label="Estado"><Badge variant={EST_OP[o.estado].v}>{EST_OP[o.estado].label}</Badge></td>
                </tr>
              ))}
            </tbody>
          </BaseTable>
        </div>
      )}
    </section>
  );
}
