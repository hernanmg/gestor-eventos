import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Filter, AlertTriangle, CheckCircle, Clock, Ban } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useFacturas, type FacturaFiltros } from '@/hooks/useFacturas';
import { useEventos } from '@/hooks/useEvento';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import FacturaForm from './FacturaForm';
import { Button } from '@/components/ui/button';
import type { EstadoFactura, Factura } from '@/types';
import { formatCurrency } from '@/lib/formatters';
import { cn } from '@/lib/utils';

// ── Badge ─────────────────────────────────────────────────────────────────────

const ESTADO_META: Record<EstadoFactura, { label: string; cls: string; Icon: any }> = {
  RECIBIDA: { label: 'Recibida',  cls: 'bg-blue-100 text-blue-800',    Icon: Clock },
  APROBADA: { label: 'Aprobada',  cls: 'bg-yellow-100 text-yellow-800', Icon: CheckCircle },
  PAGADA:   { label: 'Pagada',    cls: 'bg-green-100 text-green-800',   Icon: CheckCircle },
  ANULADA:  { label: 'Anulada',   cls: 'bg-red-100 text-red-800',      Icon: Ban },
};

function EstadoBadge({ estado }: { estado: EstadoFactura }) {
  const m = ESTADO_META[estado];
  if (!m) return <span>{estado}</span>;
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs rounded-full px-2 py-0.5 font-medium', m.cls)}>
      <m.Icon size={10} />
      {m.label}
    </span>
  );
}

// ── Fila ──────────────────────────────────────────────────────────────────────

function FilaFactura({ f }: { f: Factura }) {
  const vencida = f.fecha_vencimiento && f.estado !== 'PAGADA' && f.estado !== 'ANULADA' && new Date(f.fecha_vencimiento) < new Date();
  return (
    <tr className="border-b border-border last:border-0 hover:bg-muted/30 text-sm transition-colors">
      <td className="py-2.5 px-3">
        <Link to={`/facturas/${f.id}`} className="font-medium hover:underline text-primary">
          {f.tipo_factura} {f.numero_factura}
        </Link>
      </td>
      <td className="py-2.5 px-3 text-muted-foreground">{f.proveedor?.nombre ?? '—'}</td>
      <td className="py-2.5 px-3">
        {f.evento ? (
          <Link to={`/eventos/${f.evento_id}`} className="text-muted-foreground hover:underline text-xs">
            {f.evento.nombre}
          </Link>
        ) : '—'}
      </td>
      <td className="py-2.5 px-3 font-medium">{formatCurrency(f.importe_total, f.moneda)}</td>
      <td className="py-2.5 px-3">
        <span className={cn('font-medium', f.importe_pendiente > 0 && f.estado !== 'ANULADA' ? 'text-orange-600' : 'text-muted-foreground')}>
          {formatCurrency(f.importe_pendiente, f.moneda)}
        </span>
      </td>
      <td className="py-2.5 px-3">
        <span className={cn('text-xs', vencida ? 'text-destructive font-medium' : 'text-muted-foreground')}>
          {f.fecha_vencimiento
            ? format(new Date(f.fecha_vencimiento), 'dd/MM/yyyy', { locale: es })
            : '—'}
          {vencida && ' ⚠'}
        </span>
      </td>
      <td className="py-2.5 px-3"><EstadoBadge estado={f.estado} /></td>
    </tr>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

// ── Crear factura desde lista global ─────────────────────────────────────────

function NuevaFacturaDialog({ onClose }: { onClose: () => void }) {
  const [eventoId, setEventoId] = useState<number | null>(null);
  const { data: eventos = [] } = useEventos();
  const activos = eventos.filter(e => e.estado !== 'CERRADO');

  if (!eventoId) {
    return (
      <div className="space-y-4">
        <h2 className="text-base font-semibold">Nueva factura — seleccioná el evento</h2>
        <div className="space-y-1.5 max-h-72 overflow-y-auto">
          {activos.length === 0 && <p className="text-sm text-muted-foreground">No hay eventos activos.</p>}
          {activos.map(e => (
            <button
              key={e.id}
              onClick={() => setEventoId(e.id)}
              className="w-full text-left px-3 py-2 rounded border border-border hover:border-primary hover:bg-primary/5 transition-colors text-sm"
            >
              <span className="font-medium">{e.nombre}</span>
              <span className="ml-2 text-xs text-muted-foreground">{e.estado}</span>
            </button>
          ))}
        </div>
        <div className="flex justify-end border-t pt-3">
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
        </div>
      </div>
    );
  }

  return <FacturaForm eventoId={eventoId} onClose={onClose} />;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function FacturasPage() {
  const [filtros, setFiltros] = useState<FacturaFiltros>({});
  const [busqueda, setBusqueda] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const { data: facturas = [], isLoading } = useFacturas(filtros);

  const filtered = busqueda
    ? facturas.filter(f =>
        f.numero_factura.toLowerCase().includes(busqueda.toLowerCase()) ||
        (f.proveedor?.nombre ?? '').toLowerCase().includes(busqueda.toLowerCase()) ||
        (f.evento?.nombre   ?? '').toLowerCase().includes(busqueda.toLowerCase())
      )
    : facturas;

  const estados: EstadoFactura[] = ['RECIBIDA', 'APROBADA', 'PAGADA', 'ANULADA'];
  const selectCls = 'border border-input rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring bg-white';

  const vencidasCount  = facturas.filter(f => f.fecha_vencimiento && f.estado !== 'PAGADA' && f.estado !== 'ANULADA' && new Date(f.fecha_vencimiento) < new Date()).length;
  const pendienteTotal = facturas
    .filter(f => f.estado !== 'ANULADA')
    .reduce((s, f) => s + f.importe_pendiente, 0);

  return (
    <div className="p-4 max-w-7xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Facturas a Pagar</h1>
          <p className="text-sm text-muted-foreground">Facturas de todos los eventos</p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus size={14} className="mr-1.5" /> Nueva factura
        </Button>
      </div>

      {/* KPIs */}
      {(vencidasCount > 0 || pendienteTotal > 0) && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {vencidasCount > 0 && (
            <div className="border border-destructive/30 bg-destructive/5 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">Vencidas</p>
              <p className="text-lg font-semibold text-destructive">{vencidasCount}</p>
            </div>
          )}
          <div className="border border-orange-200 bg-orange-50 rounded-lg p-3">
            <p className="text-xs text-muted-foreground">Pendiente total</p>
            <p className="text-lg font-semibold text-orange-700">{formatCurrency(pendienteTotal, 'ARS')}</p>
          </div>
          <div className="border border-border bg-card rounded-lg p-3">
            <p className="text-xs text-muted-foreground">Facturas</p>
            <p className="text-lg font-semibold">{filtered.length}</p>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative">
          <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar…"
            className="border border-input rounded pl-7 pr-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring w-48"
          />
        </div>
        <select value={filtros.estado ?? ''} onChange={e => setFiltros(f => ({ ...f, estado: e.target.value as EstadoFactura || undefined }))} className={selectCls}>
          <option value="">Todos los estados</option>
          {estados.map(s => <option key={s} value={s}>{ESTADO_META[s].label}</option>)}
        </select>
        <select value={filtros.moneda ?? ''} onChange={e => setFiltros(f => ({ ...f, moneda: e.target.value as any || undefined }))} className={selectCls}>
          <option value="">Ambas monedas</option>
          <option value="ARS">ARS</option>
          <option value="USD">USD</option>
        </select>
        <button
          onClick={() => setFiltros({ vencen_en_dias: filtros.vencen_en_dias !== undefined ? undefined : 7 })}
          className={cn(
            'flex items-center gap-1 text-xs px-2.5 py-1.5 rounded border transition-colors',
            filtros.vencen_en_dias !== undefined
              ? 'border-orange-400 bg-orange-50 text-orange-700'
              : 'border-border text-muted-foreground hover:border-orange-300',
          )}
        >
          <AlertTriangle size={12} /> Vencen pronto
        </button>
        {(Object.values(filtros).some(Boolean) || busqueda) && (
          <button onClick={() => { setFiltros({}); setBusqueda(''); }} className="text-xs text-muted-foreground hover:text-foreground">
            <Filter size={12} className="inline mr-1" /> Limpiar
          </button>
        )}
      </div>

      {/* Tabla */}
      <div className="bg-card border border-border rounded-lg overflow-x-auto">
        {isLoading ? (
          <p className="text-sm text-muted-foreground p-6">Cargando…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground p-6">Sin facturas.</p>
        ) : (
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground bg-muted/30">
                <th className="text-left py-2.5 px-3 font-medium">Factura</th>
                <th className="text-left py-2.5 px-3 font-medium">Proveedor</th>
                <th className="text-left py-2.5 px-3 font-medium">Evento</th>
                <th className="text-left py-2.5 px-3 font-medium">Total</th>
                <th className="text-left py-2.5 px-3 font-medium">Pendiente</th>
                <th className="text-left py-2.5 px-3 font-medium">Vencimiento</th>
                <th className="text-left py-2.5 px-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(f => <FilaFactura key={f.id} f={f} />)}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-2xl">
          <NuevaFacturaDialog onClose={() => setShowCreate(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
