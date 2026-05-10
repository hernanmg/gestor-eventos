import { useState, useMemo } from 'react';
import { Plus, Trash2, ChevronDown, ChevronRight, ArrowLeftRight } from 'lucide-react';
import {
  useCuentas, useCreateCuenta, useUpdateCuenta, useDeleteCuenta,
  useTransferencia, usePosicionConsolidada,
} from '@/hooks/useCaja';
import { useEcheqs, useDeleteEcheq } from '@/hooks/useEcheqs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import MovimientoCajaTable from '@/components/domain/MovimientoCajaTable';
import CobrarEcheqDialog from '@/components/domain/CobrarEcheqDialog';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { CuentaBancaria, Echeq, Moneda, TipoCuenta, PosicionConsolidada } from '@/types';

// ── Add Cuenta Dialog ─────────────────────────────────────────────────────────

function AddCuentaDialog({
  eventoId, open, onClose,
}: {
  eventoId: number;
  open:     boolean;
  onClose:  () => void;
}) {
  const [nombre,       setNombre]       = useState('');
  const [tipo,         setTipo]         = useState<TipoCuenta>('BANCO');
  const [moneda,       setMoneda]       = useState<Moneda>('ARS');
  const [saldoInicial, setSaldoInicial] = useState('0');
  const [error,        setError]        = useState<string | null>(null);

  const createCuenta = useCreateCuenta(eventoId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!nombre.trim()) { setError('El nombre es obligatorio'); return; }
    try {
      await createCuenta.mutateAsync({
        nombre:        nombre.trim(),
        tipo,
        moneda,
        saldo_inicial: parseFloat(saldoInicial) || 0,
      });
      setNombre(''); setTipo('BANCO'); setMoneda('ARS'); setSaldoInicial('0');
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Error al crear');
    }
  };

  const input = 'w-full border border-input rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring';
  const label = 'block text-xs font-medium text-muted-foreground mb-0.5';

  return (
    <Dialog open={open} onOpenChange={open => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva cuenta bancaria</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 mt-1">
          <div>
            <label className={label}>Nombre *</label>
            <input
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              className={input}
              placeholder="Banco Galicia, Efectivo…"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={label}>Tipo</label>
              <select
                value={tipo}
                onChange={e => setTipo(e.target.value as TipoCuenta)}
                className={input}
              >
                <option value="BANCO">Banco</option>
                <option value="EFECTIVO">Efectivo</option>
              </select>
            </div>
            <div>
              <label className={label}>Moneda</label>
              <select
                value={moneda}
                onChange={e => setMoneda(e.target.value as Moneda)}
                className={input}
              >
                <option value="ARS">ARS</option>
                <option value="USD">USD</option>
              </select>
            </div>
            <div>
              <label className={label}>Saldo inicial</label>
              <input
                type="number" min="0" step="0.01"
                value={saldoInicial}
                onChange={e => setSaldoInicial(e.target.value)}
                className={cn(input, 'text-right')}
              />
            </div>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={createCuenta.isPending}>
              {createCuenta.isPending ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Transferencia Dialog ──────────────────────────────────────────────────────

function TransferenciaDialog({
  eventoId, cuentas, posicion, open, onClose,
}: {
  eventoId: number;
  cuentas:  CuentaBancaria[];
  posicion: PosicionConsolidada | undefined;
  open:     boolean;
  onClose:  () => void;
}) {
  const [moneda,      setMoneda]      = useState<Moneda>('ARS');
  const [origenId,    setOrigenId]    = useState('');
  const [destinoId,   setDestinoId]   = useState('');
  const [importe,     setImporte]     = useState('');
  const [fecha,       setFecha]       = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [error,       setError]       = useState<string | null>(null);

  const transferencia = useTransferencia(eventoId);

  const saldoMap = useMemo(() => {
    const map = new Map<number, number>();
    posicion?.por_moneda.forEach(pm =>
      pm.cuentas.forEach(c => map.set(c.cuenta_id, c.saldo_actual)),
    );
    return map;
  }, [posicion]);

  const cuentasMoneda  = cuentas.filter(c => c.moneda === moneda);
  const cuentasDestino = cuentasMoneda.filter(c => String(c.id) !== origenId);

  const handleMonedaChange = (m: Moneda) => {
    setMoneda(m);
    setOrigenId('');
    setDestinoId('');
  };

  const handleOrigenChange = (id: string) => {
    setOrigenId(id);
    if (id === destinoId) setDestinoId('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const imp = parseFloat(importe);
    if (isNaN(imp) || imp <= 0) { setError('El importe debe ser mayor a 0'); return; }
    if (!origenId || !destinoId) { setError('Seleccioná cuenta origen y destino'); return; }
    try {
      await transferencia.mutateAsync({
        cuenta_origen_id:  Number(origenId),
        cuenta_destino_id: Number(destinoId),
        importe:           imp,
        moneda,
        fecha:       fecha || null,
        descripcion: descripcion.trim() || null,
      });
      setImporte(''); setFecha(''); setDescripcion(''); setOrigenId(''); setDestinoId('');
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Error al transferir');
    }
  };

  const input = 'w-full border border-input rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring';
  const label = 'block text-xs font-medium text-muted-foreground mb-0.5';

  const cuentaLabel = (c: CuentaBancaria) => {
    const saldo = saldoMap.get(c.id);
    return saldo !== undefined ? `${c.nombre} (${formatCurrency(saldo, c.moneda)})` : c.nombre;
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva transferencia</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 mt-1">
          <div>
            <label className={label}>Moneda</label>
            <select value={moneda} onChange={e => handleMonedaChange(e.target.value as Moneda)} className={input}>
              <option value="ARS">ARS</option>
              <option value="USD">USD</option>
            </select>
          </div>
          <div>
            <label className={label}>Cuenta origen *</label>
            <select value={origenId} onChange={e => handleOrigenChange(e.target.value)} className={input}>
              <option value="">-- seleccionar --</option>
              {cuentasMoneda.map(c => (
                <option key={c.id} value={c.id}>{cuentaLabel(c)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>Cuenta destino *</label>
            <select
              value={destinoId}
              onChange={e => setDestinoId(e.target.value)}
              className={input}
              disabled={!origenId}
            >
              <option value="">-- seleccionar --</option>
              {cuentasDestino.map(c => (
                <option key={c.id} value={c.id}>{cuentaLabel(c)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>Importe *</label>
            <input
              type="number" min="0.01" step="0.01"
              value={importe}
              onChange={e => setImporte(e.target.value)}
              className={cn(input, 'text-right')}
              placeholder="0.00"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Fecha</label>
              <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className={input} />
            </div>
            <div>
              <label className={label}>Descripción</label>
              <input
                value={descripcion}
                onChange={e => setDescripcion(e.target.value)}
                className={input}
                placeholder="Opcional"
              />
            </div>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={transferencia.isPending}>
              {transferencia.isPending ? 'Transfiriendo…' : 'Transferir'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Posición Consolidada Section ──────────────────────────────────────────────

function PosicionConsolidadaSection({ posicion }: { posicion: PosicionConsolidada | undefined }) {
  const [expanded, setExpanded] = useState(true);

  if (!posicion || posicion.por_moneda.length === 0) return null;

  const thClass = 'px-3 py-1.5 text-left text-xs font-medium text-muted-foreground';

  return (
    <div className="mb-4 rounded-lg border border-border overflow-hidden">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 text-xs font-semibold text-muted-foreground uppercase tracking-wide hover:bg-gray-100 transition"
      >
        <span>Posición consolidada</span>
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>
      {expanded && (
        <div className={cn('p-3', posicion.por_moneda.length > 1 && 'sm:grid sm:grid-cols-2 sm:gap-3 space-y-3 sm:space-y-0')}>
          {posicion.por_moneda.map(pm => (
            <div key={pm.moneda} className="rounded-lg border border-border overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-border">
                <span className="text-xs font-semibold text-muted-foreground">{pm.moneda}</span>
                <span className="text-sm font-bold tabular-nums">{formatCurrency(pm.saldo_total, pm.moneda)}</span>
              </div>
              {/* Desktop: full breakdown */}
              <table className="w-full hidden sm:table">
                <thead>
                  <tr className="border-b border-border">
                    <th className={thClass}>Cuenta</th>
                    <th className={cn(thClass, 'text-right')}>Saldo</th>
                    <th className={cn(thClass, 'text-right')}>Debe</th>
                    <th className={cn(thClass, 'text-right')}>Haber</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pm.cuentas.map(c => (
                    <tr key={c.cuenta_id}>
                      <td className="px-3 py-1.5 text-sm">{c.nombre}</td>
                      <td className="px-3 py-1.5 text-sm text-right tabular-nums font-medium">{formatCurrency(c.saldo_actual, pm.moneda)}</td>
                      <td className="px-3 py-1.5 text-sm text-right tabular-nums text-muted-foreground">{formatCurrency(c.total_debe, pm.moneda)}</td>
                      <td className="px-3 py-1.5 text-sm text-right tabular-nums text-muted-foreground">{formatCurrency(c.total_haber, pm.moneda)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Echeqs Section ────────────────────────────────────────────────────────────

function EcheqsSection({
  eventoId, cuentas,
}: {
  eventoId: number;
  cuentas:  CuentaBancaria[];
}) {
  const { data: echeqs = [] } = useEcheqs(eventoId);
  const deleteEcheq           = useDeleteEcheq(eventoId);

  const [cobrarTarget,  setCobrarTarget]  = useState<Echeq | null>(null);
  const [historialOpen, setHistorialOpen] = useState(false);

  const pendientes = echeqs.filter(e => e.estado === 'PENDIENTE');
  const cobrados   = echeqs.filter(e => e.estado === 'COBRADO');
  const rechazados = echeqs.filter(e => e.estado === 'RECHAZADO');
  const historial  = [...cobrados, ...rechazados];

  const handleDelete = (id: number) => {
    if (!window.confirm('¿Eliminar este echeq?')) return;
    deleteEcheq.mutate(id);
  };

  const thClass = 'px-3 py-2 text-left text-xs font-medium text-muted-foreground';
  const tdClass = 'px-3 py-2 text-sm';

  return (
    <div className="mt-6">
      <h3 className="text-sm font-semibold mb-3">Echeqs</h3>

      {/* Pendientes */}
      <div className="rounded-lg border border-border overflow-hidden mb-4">
        <div className="bg-gray-50 px-3 py-2 border-b border-border">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Pendientes ({pendientes.length})
          </span>
        </div>
        {pendientes.length === 0 ? (
          <p className="px-3 py-4 text-sm text-muted-foreground text-center">Sin echeqs pendientes.</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className={thClass}>N°</th>
                <th className={thClass}>Razón social</th>
                <th className={cn(thClass, 'text-right')}>Importe</th>
                <th className={thClass}>Fecha cobro est.</th>
                <th className={thClass} />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pendientes.map(e => (
                <tr key={e.id} className="group">
                  <td className={tdClass}>{e.numero}</td>
                  <td className={tdClass}>{e.razon_social}</td>
                  <td className={cn(tdClass, 'text-right tabular-nums font-medium')}>
                    {formatCurrency(e.importe, e.moneda)}
                  </td>
                  <td className={cn(tdClass, 'text-muted-foreground')}>
                    {formatDate(e.fecha_cobro_estimada)}
                  </td>
                  <td className={cn(tdClass, 'text-right')}>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 text-xs"
                        onClick={() => setCobrarTarget(e)}
                      >
                        Cobrar
                      </Button>
                      <button
                        onClick={() => handleDelete(e.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded text-destructive hover:bg-destructive/10 transition"
                        title="Eliminar"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Historial */}
      {historial.length > 0 && (
        <div className="rounded-lg border border-border overflow-hidden">
          <button
            onClick={() => setHistorialOpen(v => !v)}
            className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide hover:bg-gray-100 transition"
          >
            <span>Historial ({historial.length})</span>
            {historialOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          {historialOpen && (
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className={thClass}>N°</th>
                  <th className={thClass}>Razón social</th>
                  <th className={cn(thClass, 'text-right')}>Importe</th>
                  <th className={thClass}>Estado</th>
                  <th className={thClass}>Fecha cobro real</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {historial.map(e => (
                  <tr key={e.id}>
                    <td className={tdClass}>{e.numero}</td>
                    <td className={tdClass}>{e.razon_social}</td>
                    <td className={cn(tdClass, 'text-right tabular-nums')}>
                      {formatCurrency(e.importe, e.moneda)}
                    </td>
                    <td className={tdClass}>
                      <span className={cn(
                        'text-xs px-1.5 py-0.5 rounded-full font-medium',
                        e.estado === 'COBRADO' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700',
                      )}>
                        {e.estado}
                      </span>
                    </td>
                    <td className={cn(tdClass, 'text-muted-foreground')}>
                      {formatDate(e.fecha_cobro_real)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {cobrarTarget && (
        <CobrarEcheqDialog
          echeq={cobrarTarget}
          cuentas={cuentas}
          open
          onClose={() => setCobrarTarget(null)}
        />
      )}
    </div>
  );
}

// ── CajaPage ──────────────────────────────────────────────────────────────────

interface Props {
  eventoId:   number;
  monedaBase: Moneda;
  canEdit:    boolean;
}

export default function CajaPage({ eventoId, monedaBase, canEdit }: Props) {
  const { data: cuentas = [], isLoading } = useCuentas(eventoId);
  const { data: posicion }                = usePosicionConsolidada(eventoId);
  const updateCuenta  = useUpdateCuenta(eventoId);
  const deleteCuenta  = useDeleteCuenta(eventoId);

  const [selectedId,        setSelectedId]        = useState<number | null>(null);
  const [addCuentaOpen,     setAddCuentaOpen]     = useState(false);
  const [transferenciaOpen, setTransferenciaOpen] = useState(false);
  const [editSaldo,         setEditSaldo]         = useState<string | null>(null);

  const activeCuentas  = cuentas.filter(c => !c.deleted_at);
  const selectedCuenta = activeCuentas.find(c => c.id === selectedId) ?? activeCuentas[0] ?? null;
  const effectiveId    = selectedCuenta?.id ?? null;

  const handleSaldoSave = () => {
    if (editSaldo === null || !selectedCuenta) return;
    const val = parseFloat(editSaldo);
    if (!isNaN(val) && val !== selectedCuenta.saldo_inicial) {
      updateCuenta.mutate({ id: selectedCuenta.id, data: { saldo_inicial: val } });
    }
    setEditSaldo(null);
  };

  const handleDeleteCuenta = (id: number) => {
    if (!window.confirm('¿Eliminar esta cuenta? Se perderán todos sus movimientos.')) return;
    deleteCuenta.mutate(id);
    if (selectedId === id) setSelectedId(null);
  };

  if (isLoading) {
    return <p className="p-4 text-sm text-muted-foreground">Cargando...</p>;
  }

  if (activeCuentas.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-sm text-muted-foreground mb-3">
          No hay cuentas bancarias configuradas para este evento.
        </p>
        {canEdit && (
          <>
            <Button size="sm" onClick={() => setAddCuentaOpen(true)}>
              <Plus size={14} className="mr-1.5" />
              Agregar cuenta
            </Button>
            <AddCuentaDialog eventoId={eventoId} open={addCuentaOpen} onClose={() => setAddCuentaOpen(false)} />
          </>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* Posición consolidada */}
      <PosicionConsolidadaSection posicion={posicion} />

      {/* Cuenta selector + actions */}
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-1 flex-wrap">
          {activeCuentas.map(c => (
            <button
              key={c.id}
              onClick={() => setSelectedId(c.id)}
              className={cn(
                'px-3 py-1.5 text-sm rounded-md border transition-colors',
                (selectedCuenta?.id === c.id)
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border hover:bg-accent',
              )}
            >
              {c.nombre}
            </button>
          ))}
          {canEdit && (
            <button
              onClick={() => setAddCuentaOpen(true)}
              className="px-3 py-1.5 text-sm rounded-md border border-dashed border-border text-muted-foreground hover:bg-accent transition-colors"
            >
              <Plus size={13} className="inline mr-1" />
              Agregar
            </button>
          )}
        </div>
        {canEdit && activeCuentas.length >= 2 && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setTransferenciaOpen(true)}
            className="shrink-0"
          >
            <ArrowLeftRight size={13} className="mr-1.5" />
            Nueva transferencia
          </Button>
        )}
      </div>

      {selectedCuenta && (
        <>
          {/* Cuenta header */}
          <div className="flex items-center justify-between gap-4 mb-4 p-3 rounded-lg border border-border bg-gray-50">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <span className="text-muted-foreground">
                Tipo: <span className="text-foreground font-medium">{selectedCuenta.tipo}</span>
              </span>
              <span className="text-muted-foreground">
                Moneda: <span className="text-foreground font-medium">{selectedCuenta.moneda}</span>
              </span>
              <span className="text-muted-foreground flex items-center gap-1">
                Saldo inicial:
                {canEdit && editSaldo !== null ? (
                  <input
                    autoFocus
                    type="number"
                    step="0.01"
                    value={editSaldo}
                    onChange={e => setEditSaldo(e.target.value)}
                    onBlur={handleSaldoSave}
                    onKeyDown={e => {
                      if (e.key === 'Enter')  handleSaldoSave();
                      if (e.key === 'Escape') setEditSaldo(null);
                    }}
                    className="ml-1 w-32 border border-ring rounded px-1 py-0.5 text-sm text-right focus:outline-none"
                  />
                ) : (
                  <span
                    className={cn(
                      'ml-1 font-medium text-foreground tabular-nums',
                      canEdit && 'cursor-pointer hover:underline',
                    )}
                    onClick={() => canEdit && setEditSaldo(String(selectedCuenta.saldo_inicial))}
                  >
                    {formatCurrency(selectedCuenta.saldo_inicial, selectedCuenta.moneda)}
                  </span>
                )}
              </span>
            </div>
            {canEdit && (
              <button
                onClick={() => handleDeleteCuenta(selectedCuenta.id)}
                title="Eliminar cuenta"
                className="p-1 rounded text-destructive hover:bg-destructive/10 transition"
              >
                <Trash2 size={15} />
              </button>
            )}
          </div>

          {/* Movimientos table */}
          {effectiveId !== null && (
            <MovimientoCajaTable
              cuentaId={effectiveId}
              moneda={selectedCuenta.moneda}
              eventoId={eventoId}
              canEdit={canEdit}
            />
          )}

          {/* Echeqs section */}
          <EcheqsSection eventoId={eventoId} cuentas={activeCuentas} />
        </>
      )}

      <AddCuentaDialog eventoId={eventoId} open={addCuentaOpen} onClose={() => setAddCuentaOpen(false)} />

      <TransferenciaDialog
        eventoId={eventoId}
        cuentas={activeCuentas}
        posicion={posicion}
        open={transferenciaOpen}
        onClose={() => setTransferenciaOpen(false)}
      />
    </div>
  );
}
