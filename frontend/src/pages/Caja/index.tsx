import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wallet, Plus, ChevronRight, AlertTriangle } from 'lucide-react';
import { useCuentasEmpresa, useCreateCuentaEmpresa } from '@/hooks/useCaja';
import { useEventos } from '@/hooks/useEvento';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EstadoBadge, MarcarPendienteDialog, ConfirmarRendicionDialog } from '@/components/domain/CuentaEstadoControls';
import { formatCurrency } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { CuentaBancaria, Moneda, TipoCuenta } from '@/types';

// ── Nueva cuenta de empresa (sin evento) ──────────────────────────────────────

function NuevaCuentaEmpresaDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [nombre,       setNombre]       = useState('');
  const [tipo,         setTipo]         = useState<TipoCuenta>('EFECTIVO');
  const [moneda,       setMoneda]       = useState<Moneda>('ARS');
  const [saldoInicial, setSaldoInicial] = useState('0');
  const [saldoMinimo,  setSaldoMinimo]  = useState('');
  const [error,        setError]        = useState<string | null>(null);

  const createCuenta = useCreateCuentaEmpresa();

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
        saldo_minimo:  saldoMinimo.trim() === '' ? null : parseFloat(saldoMinimo),
      });
      setNombre(''); setTipo('EFECTIVO'); setMoneda('ARS'); setSaldoInicial('0'); setSaldoMinimo('');
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Error al crear');
    }
  };

  const input = 'w-full border border-input rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring';
  const label = 'block text-xs font-medium text-muted-foreground mb-0.5';

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva cuenta de empresa</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground -mt-2 mb-1">
          No se asocia a ningún evento — ideal para caja chica por persona, caja de reserva, o caja general.
        </p>
        <form onSubmit={handleSubmit} className="space-y-3 mt-1">
          <div>
            <label className={label}>Nombre *</label>
            <input
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              className={input}
              placeholder="Caja Chica Jazmín, Caja Reserva…"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={label}>Tipo</label>
              <select value={tipo} onChange={e => setTipo(e.target.value as TipoCuenta)} className={input}>
                <option value="EFECTIVO">Efectivo</option>
                <option value="BANCO">Banco</option>
              </select>
            </div>
            <div>
              <label className={label}>Moneda</label>
              <select value={moneda} onChange={e => setMoneda(e.target.value as Moneda)} className={input}>
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
          <div>
            <label className={label}>Saldo mínimo (opcional)</label>
            <input
              type="number" min="0" step="0.01"
              value={saldoMinimo}
              onChange={e => setSaldoMinimo(e.target.value)}
              className={input}
              placeholder="Ej: 500000"
            />
            <p className="text-[11px] text-muted-foreground mt-0.5">
              El sistema te alertará si el saldo cae por debajo de este valor.
            </p>
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

// ── Página principal ──────────────────────────────────────────────────────────

export default function CajaGlobalPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canEdit  = user?.rol === 'ADMIN' || user?.rol === 'OPERADOR'; // crear cuenta: ADMIN_OPERADOR (matriz de permisos)
  const [eventoFiltro, setEventoFiltro] = useState<'todas' | 'empresa' | number>('todas');
  const [nuevaOpen,    setNuevaOpen]    = useState(false);

  const { data: cuentas = [], isLoading } = useCuentasEmpresa();
  const { data: eventos = [] } = useEventos();
  const isAdmin = user?.rol === 'ADMIN';

  const [pendienteTarget,  setPendienteTarget]  = useState<CuentaBancaria | null>(null);
  const [rendicionTarget,  setRendicionTarget]  = useState<CuentaBancaria | null>(null);

  const cuentasFiltradas = useMemo(() => {
    if (eventoFiltro === 'todas')   return cuentas;
    if (eventoFiltro === 'empresa') return cuentas.filter(c => c.evento_id === null);
    return cuentas.filter(c => c.evento_id === eventoFiltro);
  }, [cuentas, eventoFiltro]);

  // La vista consolidada siempre suma TODAS las cuentas, sin importar el filtro de la tabla.
  const totalesPorMoneda = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of cuentas) {
      const saldo = c.saldo_actual ?? c.saldo_inicial;
      map.set(c.moneda, (map.get(c.moneda) ?? 0) + saldo);
    }
    return [...map.entries()];
  }, [cuentas]);

  return (
    <div className="p-6 space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Wallet size={22} />
          Caja Global
        </h1>
        {canEdit && (
          <Button size="sm" onClick={() => setNuevaOpen(true)}>
            <Plus size={14} className="mr-1.5" /> Nueva cuenta
          </Button>
        )}
      </div>
      <p className="text-sm text-muted-foreground -mt-2">
        Todas las cuentas de la empresa: las cajas propias de cada evento y las cajas de empresa
        (caja chica por persona, caja de reserva, etc.) sin evento asociado.
      </p>

      {/* Vista consolidada */}
      <div className="flex flex-wrap gap-3">
        {totalesPorMoneda.length === 0 && !isLoading && (
          <p className="text-sm text-muted-foreground">Sin cuentas todavía.</p>
        )}
        {totalesPorMoneda.map(([moneda, total]) => (
          <div key={moneda} className="rounded-lg border bg-white px-4 py-3 min-w-[180px]">
            <p className="text-xs text-muted-foreground">Saldo consolidado {moneda}</p>
            <p className="text-xl font-bold tabular-nums">{formatCurrency(total, moneda as Moneda)}</p>
          </div>
        ))}
      </div>

      {/* Filtro */}
      <div className="flex items-center gap-2">
        <label className="text-xs font-medium text-muted-foreground">Ver:</label>
        <select
          value={typeof eventoFiltro === 'number' ? String(eventoFiltro) : eventoFiltro}
          onChange={e => {
            const v = e.target.value;
            setEventoFiltro(v === 'todas' || v === 'empresa' ? v : Number(v));
          }}
          className="border rounded px-2 py-1.5 text-sm"
        >
          <option value="todas">Todas las cuentas</option>
          <option value="empresa">Sin evento (empresa)</option>
          {eventos.map(ev => (
            <option key={ev.id} value={ev.id}>{ev.nombre}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : cuentasFiltradas.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay cuentas para este filtro.</p>
      ) : (
        <div className="rounded-lg border bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Nombre</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Evento</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Estado</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Tipo</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Moneda</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Saldo actual</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground" />
                <th className="px-3 py-2 w-6" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {cuentasFiltradas.map(c => (
                <tr
                  key={c.id}
                  className={cn('hover:bg-muted/20 cursor-pointer', c.alerta_saldo_minimo && 'bg-red-50/60')}
                  onClick={() => navigate(`/caja/${c.id}`)}
                >
                  <td className="px-3 py-2.5 font-medium">{c.nombre}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">
                    {c.evento ? c.evento.nombre : <span className="italic">— Empresa —</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    <EstadoBadge estado={c.estado} />
                  </td>
                  <td className="px-3 py-2.5">{c.tipo}</td>
                  <td className="px-3 py-2.5">{c.moneda}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-medium">
                    <div className="flex items-center justify-end gap-1.5">
                      {formatCurrency(c.saldo_actual ?? c.saldo_inicial, c.moneda)}
                      {c.alerta_saldo_minimo && (
                        <span className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-full font-medium bg-red-100 text-red-700">
                          <AlertTriangle size={11} /> Saldo bajo
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right" onClick={e => e.stopPropagation()}>
                    {c.estado === 'ABIERTA' && (
                      <Button variant="outline" size="sm" className="h-6 text-xs" onClick={() => setPendienteTarget(c)}>
                        Marcar pendiente de rendición
                      </Button>
                    )}
                    {c.estado === 'PENDIENTE_RENDICION' && isAdmin && (
                      <Button size="sm" className="h-6 text-xs" onClick={() => setRendicionTarget(c)}>
                        Confirmar rendición
                      </Button>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">
                    <ChevronRight size={14} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <NuevaCuentaEmpresaDialog open={nuevaOpen} onClose={() => setNuevaOpen(false)} />
      {pendienteTarget && (
        <MarcarPendienteDialog cuenta={pendienteTarget} open onClose={() => setPendienteTarget(null)} />
      )}
      {rendicionTarget && (
        <ConfirmarRendicionDialog cuenta={rendicionTarget} open onClose={() => setRendicionTarget(null)} />
      )}
    </div>
  );
}
