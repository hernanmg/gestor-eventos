import { useState } from 'react';
import { Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import {
  useCuentas, useCreateCuenta, useUpdateCuenta, useDeleteCuenta,
} from '@/hooks/useCaja';
import { useEcheqs, useDeleteEcheq, useCobrarEcheq } from '@/hooks/useEcheqs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import MovimientoCajaTable from '@/components/domain/MovimientoCajaTable';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { CuentaBancaria, Echeq, Moneda, TipoCuenta } from '@/types';

// ── Cobrar Echeq Dialog ───────────────────────────────────────────────────────

function CobrarEcheqDialog({
  echeq, cuentas, open, onClose,
}: {
  echeq:   Echeq;
  cuentas: CuentaBancaria[];
  open:    boolean;
  onClose: () => void;
}) {
  const [cuentaId,      setCuentaId]      = useState('');
  const [fechaCobro,    setFechaCobro]    = useState('');
  const [error,         setError]         = useState<string | null>(null);
  const cobrar = useCobrarEcheq(echeq.evento_id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!cuentaId) { setError('Seleccioná una cuenta bancaria'); return; }
    try {
      await cobrar.mutateAsync({
        id:              echeq.id,
        cuenta_id:       Number(cuentaId),
        fecha_cobro_real: fechaCobro || null,
      });
      setCuentaId(''); setFechaCobro('');
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Error al cobrar');
    }
  };

  const input = 'w-full border border-input rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring';
  const label = 'block text-xs font-medium text-muted-foreground mb-0.5';

  return (
    <Dialog open={open} onOpenChange={open => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cobrar echeq</DialogTitle>
        </DialogHeader>
        <div className="text-sm text-muted-foreground mb-3">
          <span className="font-medium text-foreground">{echeq.numero}</span> — {echeq.razon_social}
          <span className="ml-2 font-medium text-foreground">
            {formatCurrency(echeq.importe, echeq.moneda)}
          </span>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className={label}>Cuenta bancaria *</label>
            <select
              value={cuentaId}
              onChange={e => setCuentaId(e.target.value)}
              className={input}
            >
              <option value="">— Seleccionar cuenta</option>
              {cuentas.map(c => (
                <option key={c.id} value={c.id}>
                  {c.nombre} ({c.moneda})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>Fecha de cobro</label>
            <input
              type="date"
              value={fechaCobro}
              onChange={e => setFechaCobro(e.target.value)}
              className={input}
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={cobrar.isPending}>
              {cobrar.isPending ? 'Procesando…' : 'Cobrar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

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

// ── Echeqs Section ────────────────────────────────────────────────────────────

function EcheqsSection({
  eventoId, cuentas,
}: {
  eventoId: number;
  cuentas:  CuentaBancaria[];
}) {
  const { data: echeqs = [] } = useEcheqs(eventoId);
  const deleteEcheq           = useDeleteEcheq(eventoId);

  const [cobrarTarget,    setCobrarTarget]    = useState<Echeq | null>(null);
  const [historialOpen,   setHistorialOpen]   = useState(false);

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
                        e.estado === 'COBRADO'   ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700',
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
  const updateCuenta  = useUpdateCuenta(eventoId);
  const deleteCuenta  = useDeleteCuenta(eventoId);

  const [selectedId,    setSelectedId]    = useState<number | null>(null);
  const [addCuentaOpen, setAddCuentaOpen] = useState(false);
  const [editSaldo,     setEditSaldo]     = useState<string | null>(null);

  const activeCuentas = cuentas.filter(c => !c.deleted_at);
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
      {/* Cuenta selector tabs */}
      <div className="flex items-center gap-1 mb-4 flex-wrap">
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
            />
          )}

          {/* Echeqs section */}
          <EcheqsSection eventoId={eventoId} cuentas={activeCuentas} />
        </>
      )}

      <AddCuentaDialog eventoId={eventoId} open={addCuentaOpen} onClose={() => setAddCuentaOpen(false)} />
    </div>
  );
}
