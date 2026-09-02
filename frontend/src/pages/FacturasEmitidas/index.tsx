import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Search, Filter, AlertTriangle, FileText, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useFacturasEmitidas, useResumenFacturasEmitidas, type FacturasEmitidasFiltros } from '@/hooks/useFacturasEmitidas';
import { useEventos } from '@/hooks/useEvento';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { FacturaEmitidaEstadoBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import FacturaEmitidaForm from './FacturaEmitidaForm';
import FacturaEmitidaDetalle from './FacturaEmitidaDetalle';
import RegistrarCobroDialog from './RegistrarCobroDialog';
import { TIPO_COMPROBANTE_LABEL } from './labels';
import api from '@/lib/api';
import type { EstadoFacturaEmitida, FacturaEmitida, TipoComprobanteEmitido, Moneda } from '@/types';
import { formatCurrency } from '@/lib/formatters';
import { cn } from '@/lib/utils';

const ESTADOS: EstadoFacturaEmitida[] = ['EMITIDA', 'COBRADA_PARCIAL', 'COBRADA', 'INCOBRABLE', 'ANULADA'];
const MS_DIA = 86_400_000;

// ── Fila ──────────────────────────────────────────────────────────────────────

function FilaFactura({ f, onOpen, onCobrar }: { f: FacturaEmitida; onOpen: () => void; onCobrar: () => void }) {
  const hoy = new Date();
  const vencimiento = f.fecha_vencimiento ? new Date(f.fecha_vencimiento) : null;
  const activa = f.estado !== 'COBRADA' && f.estado !== 'ANULADA' && f.estado !== 'INCOBRABLE';
  const vencida = !!vencimiento && activa && vencimiento < hoy;
  const proximaAVencer = !!vencimiento && activa && !vencida && vencimiento.getTime() - hoy.getTime() <= 7 * MS_DIA;

  const [loadingPdf, setLoadingPdf] = useState(false);
  const handleVerPdf = async () => {
    setLoadingPdf(true);
    try {
      const res  = await api.get(`/facturas-emitidas/${f.id}/pdf`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url  = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch {
      alert('No se pudo cargar el PDF');
    } finally {
      setLoadingPdf(false);
    }
  };

  return (
    <tr
      onClick={onOpen}
      className={cn(
        'border-b border-border last:border-0 text-sm cursor-pointer transition-colors hover:bg-muted/40',
        vencida ? 'bg-destructive/5' : proximaAVencer ? 'bg-amber-50' : '',
      )}
    >
      <td className="py-2.5 px-3">{format(new Date(f.fecha_emision), 'dd/MM/yyyy', { locale: es })}</td>
      <td className="py-2.5 px-3 text-xs text-muted-foreground">{TIPO_COMPROBANTE_LABEL[f.tipo_comprobante]}</td>
      <td className="py-2.5 px-3 font-mono text-xs">{String(f.punto_venta).padStart(4, '0')}-{f.numero ?? '—'}</td>
      <td className="py-2.5 px-3 font-medium">{f.cliente_nombre}</td>
      <td className="py-2.5 px-3 text-muted-foreground text-xs max-w-[160px] truncate" title={f.concepto ?? undefined}>{f.concepto ?? '—'}</td>
      <td className="py-2.5 px-3 font-medium">{formatCurrency(f.total, f.moneda)}</td>
      <td className="py-2.5 px-3 text-green-700">{formatCurrency(f.total_cobrado, f.moneda)}</td>
      <td className="py-2.5 px-3">
        <span className={cn('font-medium', f.saldo_pendiente > 0 ? 'text-orange-600' : 'text-muted-foreground')}>
          {formatCurrency(f.saldo_pendiente, f.moneda)}
        </span>
      </td>
      <td className="py-2.5 px-3">
        <span className={cn('text-xs', vencida ? 'text-destructive font-medium' : 'text-muted-foreground')}>
          {f.fecha_vencimiento ? format(new Date(f.fecha_vencimiento), 'dd/MM/yyyy', { locale: es }) : '—'}
          {vencida && ' ⚠'}
        </span>
      </td>
      <td className="py-2.5 px-3"><FacturaEmitidaEstadoBadge estado={f.estado} /></td>
      <td className="py-2.5 px-3 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-end gap-1">
          {activa && (
            <button onClick={onCobrar} title="Registrar cobro" className="p-1.5 rounded hover:bg-accent text-primary">
              <Plus size={14} />
            </button>
          )}
          {f.pdf_nombre && (
            <button onClick={handleVerPdf} disabled={loadingPdf} title="Ver PDF" className="p-1.5 rounded hover:bg-accent text-muted-foreground">
              {loadingPdf ? <Eye size={14} className="animate-pulse" /> : <FileText size={14} />}
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

// ── Cards de resumen ──────────────────────────────────────────────────────────

function ResumenCards() {
  const { data } = useResumenFacturasEmitidas();
  if (!data) return null;

  const mesActual = format(new Date(), 'yyyy-MM');
  const mes = data.por_mes.find(m => m.mes === mesActual);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div className="border border-border bg-card rounded-lg p-3">
        <p className="text-xs text-muted-foreground">Emitido (mes actual)</p>
        <p className="text-lg font-semibold">{formatCurrency(mes?.total_emitido ?? 0, 'ARS')}</p>
      </div>
      <div className="border border-green-200 bg-green-50 rounded-lg p-3">
        <p className="text-xs text-muted-foreground">Cobrado (mes actual)</p>
        <p className="text-lg font-semibold text-green-700">{formatCurrency(mes?.total_cobrado ?? 0, 'ARS')}</p>
      </div>
      <div className="border border-orange-200 bg-orange-50 rounded-lg p-3">
        <p className="text-xs text-muted-foreground">Pendiente de cobro</p>
        <p className="text-lg font-semibold text-orange-700">{formatCurrency(data.total_pendiente, 'ARS')}</p>
      </div>
      <div className={cn('rounded-lg p-3 border', data.vencidas_sin_cobrar > 0 ? 'border-destructive/30 bg-destructive/5' : 'border-border bg-card')}>
        <p className="text-xs text-muted-foreground">Vencidas sin cobrar</p>
        <p className={cn('text-lg font-semibold', data.vencidas_sin_cobrar > 0 ? 'text-destructive' : '')}>
          {data.vencidas_sin_cobrar} {data.vencidas_sin_cobrar > 0 && <span className="text-sm font-normal">· {formatCurrency(data.vencidas_sin_cobrar_monto, 'ARS')}</span>}
        </p>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function FacturasEmitidasPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filtros, setFiltros]   = useState<FacturasEmitidasFiltros>({});
  const [busqueda, setBusqueda] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [openId,    setOpenId]      = useState<number | null>(null);
  const [cobrarId,  setCobrarId]    = useState<number | null>(null);

  const { data: eventos = [] } = useEventos();
  const { data, isLoading } = useFacturasEmitidas({ ...filtros, cliente_nombre: busqueda || undefined });

  // Abrir el drawer directamente cuando se llega desde una notificación/calendario (?abrir=<id>)
  useEffect(() => {
    const abrir = searchParams.get('abrir');
    if (abrir) {
      setOpenId(Number(abrir));
      searchParams.delete('abrir');
      setSearchParams(searchParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pre-seleccionar el filtro de evento cuando se llega desde el banner
  // "¿Se factura?" del detalle de evento (?evento_id=<id>)
  useEffect(() => {
    const eventoIdParam = searchParams.get('evento_id');
    if (eventoIdParam) {
      setFiltros(f => ({ ...f, evento_id: Number(eventoIdParam) }));
      searchParams.delete('evento_id');
      setSearchParams(searchParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const facturas = data?.items ?? [];
  const selectCls = 'border border-input rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring bg-white';
  const facturaCobrar = facturas.find(f => f.id === cobrarId);

  return (
    <div className="p-4 max-w-7xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Facturas a Cobrar</h1>
          <p className="text-sm text-muted-foreground">Facturas emitidas a clientes</p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus size={14} className="mr-1.5" /> Nueva factura
        </Button>
      </div>

      <ResumenCards />

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative">
          <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar cliente…"
            className="border border-input rounded pl-7 pr-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring w-48"
          />
        </div>
        <select value={filtros.estado ?? ''} onChange={e => setFiltros(f => ({ ...f, estado: (e.target.value || undefined) as EstadoFacturaEmitida | undefined }))} className={selectCls}>
          <option value="">Todos los estados</option>
          {ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filtros.tipo_comprobante ?? ''} onChange={e => setFiltros(f => ({ ...f, tipo_comprobante: (e.target.value || undefined) as TipoComprobanteEmitido | undefined }))} className={selectCls}>
          <option value="">Todos los comprobantes</option>
          {Object.entries(TIPO_COMPROBANTE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={filtros.evento_id ?? ''} onChange={e => setFiltros(f => ({ ...f, evento_id: e.target.value ? Number(e.target.value) : undefined }))} className={selectCls}>
          <option value="">Todos los eventos</option>
          {eventos.map(ev => <option key={ev.id} value={ev.id}>{ev.nombre}</option>)}
        </select>
        <select value={filtros.moneda ?? ''} onChange={e => setFiltros(f => ({ ...f, moneda: (e.target.value || undefined) as Moneda | undefined }))} className={selectCls}>
          <option value="">Todas las monedas</option>
          <option value="ARS">ARS</option>
          <option value="USD">USD</option>
          <option value="EUR">EUR</option>
        </select>
        <input type="date" value={filtros.desde ?? ''} onChange={e => setFiltros(f => ({ ...f, desde: e.target.value || undefined }))} className={selectCls} />
        <span className="text-xs text-muted-foreground">a</span>
        <input type="date" value={filtros.hasta ?? ''} onChange={e => setFiltros(f => ({ ...f, hasta: e.target.value || undefined }))} className={selectCls} />
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
        ) : facturas.length === 0 ? (
          <p className="text-sm text-muted-foreground p-6">Sin facturas emitidas.</p>
        ) : (
          <table className="w-full min-w-[980px]">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground bg-muted/30">
                <th className="text-left py-2.5 px-3 font-medium">Fecha</th>
                <th className="text-left py-2.5 px-3 font-medium">Tipo</th>
                <th className="text-left py-2.5 px-3 font-medium">Número</th>
                <th className="text-left py-2.5 px-3 font-medium">Cliente</th>
                <th className="text-left py-2.5 px-3 font-medium">Concepto</th>
                <th className="text-left py-2.5 px-3 font-medium">Total</th>
                <th className="text-left py-2.5 px-3 font-medium">Cobrado</th>
                <th className="text-left py-2.5 px-3 font-medium">Saldo</th>
                <th className="text-left py-2.5 px-3 font-medium">Vencimiento</th>
                <th className="text-left py-2.5 px-3 font-medium">Estado</th>
                <th className="py-2.5 px-3" />
              </tr>
            </thead>
            <tbody>
              {facturas.map(f => (
                <FilaFactura key={f.id} f={f} onOpen={() => setOpenId(f.id)} onCobrar={() => setCobrarId(f.id)} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Página {data.page} de {data.totalPages} — {data.total} facturas</span>
          <div className="flex gap-2">
            <button disabled={data.page <= 1} onClick={() => setFiltros(f => ({ ...f, page: data.page - 1 }))} className="disabled:opacity-30 hover:text-foreground">Anterior</button>
            <button disabled={data.page >= data.totalPages} onClick={() => setFiltros(f => ({ ...f, page: data.page + 1 }))} className="disabled:opacity-30 hover:text-foreground">Siguiente</button>
          </div>
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-2xl">
          <FacturaEmitidaForm onClose={() => setShowCreate(false)} />
        </DialogContent>
      </Dialog>

      {openId !== null && (
        <FacturaEmitidaDetalle facturaId={openId} onClose={() => setOpenId(null)} />
      )}

      {facturaCobrar && (
        <RegistrarCobroDialog
          facturaId={facturaCobrar.id}
          saldoPendiente={facturaCobrar.saldo_pendiente}
          moneda={facturaCobrar.moneda}
          onClose={() => setCobrarId(null)}
        />
      )}

      {!isLoading && facturas.length === 0 && (Object.values(filtros).some(Boolean) || busqueda) && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <AlertTriangle size={12} /> No hay resultados con los filtros aplicados.
        </p>
      )}
    </div>
  );
}
