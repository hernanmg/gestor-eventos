import { useEffect, useState } from 'react';
import { Info, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import MoneyInput from '@/components/ui/MoneyInput';
import { useUpdateMovimiento, useAddPagoParcial, useRemovePagoParcial } from '@/hooks/useMovimientos';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { Movimiento } from '@/types';

// Diálogos del centro de costos sobre una línea de egreso (MovimientoTable):
// - IvaDialog: desglose neto + IVA = total (debe). El IVA queda contenido en el
//   monto, así que la conciliatoria y los saldos siguen saliendo de debe.
// - PagosDialog: señas / pagos parciales al proveedor → "Falta pagar".

const input = 'w-full border border-input rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring';
const label = 'block text-xs font-medium text-muted-foreground mb-0.5';

const ALICUOTAS = [
  { label: 'Sin IVA', pct: 0 },
  { label: '10,5%',   pct: 10.5 },
  { label: '21%',     pct: 21 },
  { label: '27%',     pct: 27 },
];

const r2 = (n: number) => parseFloat(n.toFixed(2));

interface Props {
  mov:      Movimiento;
  eventoId: number;
  rubroId:  number;
  open:     boolean;
  onClose:  () => void;
}

export function IvaDialog({ mov, eventoId, rubroId, open, onClose }: Props) {
  const total = Number(mov.debe) + Number(mov.haber);
  const [neto,  setNeto]  = useState('');
  const [iva,   setIva]   = useState('');
  const [error, setError] = useState<string | null>(null);
  const update = useUpdateMovimiento(eventoId, rubroId);

  useEffect(() => {
    if (!open) return;
    const ivaActual = mov.iva ?? 0;
    setNeto(String(r2(total - ivaActual)));
    setIva(mov.iva !== null ? String(mov.iva) : '');
    setError(null);
  }, [open, mov.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const netoNum  = Number(neto) || 0;
  const ivaNum   = Number(iva)  || 0;
  const nuevoTotal = r2(netoNum + ivaNum);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await update.mutateAsync({
        id:   mov.id,
        // EGRESO → debe (convención del sistema, ver campoMontoDe en MovimientoTable)
        data: mov.tipo === 'EGRESO'
          ? { debe: nuevoTotal, haber: 0, iva: ivaNum > 0 ? ivaNum : null }
          : { haber: nuevoTotal, debe: 0, iva: ivaNum > 0 ? ivaNum : null },
      });
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'No se pudo guardar');
    }
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Neto + IVA</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground mb-2">
          {mov.concepto || 'Movimiento'}{mov.proveedor && <> — {mov.proveedor.nombre}</>}
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className={label}>Neto (consumido)</label>
            <MoneyInput value={neto} onChange={setNeto} className={input} />
          </div>
          <div>
            <label className={label}>IVA</label>
            <MoneyInput value={iva} onChange={setIva} className={input} />
            <div className="flex gap-1 mt-1.5">
              {ALICUOTAS.map(a => (
                <button
                  key={a.label}
                  type="button"
                  onClick={() => setIva(a.pct === 0 ? '' : String(r2(netoNum * a.pct / 100)))}
                  className="rounded border border-border px-2 py-0.5 text-xs hover:bg-accent"
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Total ({mov.tipo === 'EGRESO' ? 'debe' : 'haber'})</span>
            <span className="font-semibold tabular-nums">{formatCurrency(nuevoTotal, mov.moneda)}</span>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={update.isPending}>
              {update.isPending ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function PagosDialog({ mov, eventoId, rubroId, open, onClose }: Props) {
  const [fecha, setFecha] = useState('');
  const [monto, setMonto] = useState('');
  const [nota,  setNota]  = useState('');
  const [error, setError] = useState<string | null>(null);
  const addPago    = useAddPagoParcial(eventoId, rubroId);
  const removePago = useRemovePagoParcial(eventoId, rubroId);

  const pagos   = mov.pagos_parciales ?? [];
  const falta   = mov.falta_pagar ?? 0;
  const cerrado = mov.estado_movimiento === 'PAGADO' || mov.estado_movimiento === 'CANCELADO';

  useEffect(() => {
    if (!open) return;
    setFecha(new Date().toISOString().slice(0, 10));
    setMonto('');
    setNota('');
    setError(null);
  }, [open, mov.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const m = Number(monto);
    if (!fecha)   { setError('Indicá la fecha del pago'); return; }
    if (!(m > 0)) { setError('Indicá el monto pagado'); return; }
    try {
      await addPago.mutateAsync({ id: mov.id, fecha, monto: m, nota: nota || null });
      setMonto(''); setNota('');
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'No se pudo registrar el pago');
    }
  };

  const handleRemove = async (pagoId: number) => {
    if (!window.confirm('¿Quitar este pago?')) return;
    try {
      await removePago.mutateAsync({ id: mov.id, pagoId });
    } catch (err: any) {
      alert(err?.response?.data?.error ?? 'No se pudo quitar el pago');
    }
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pagos al proveedor</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground mb-2">
          {mov.concepto || 'Movimiento'}{mov.proveedor && <> — {mov.proveedor.nombre}</>}
        </p>

        <div className="grid grid-cols-2 gap-2 mb-3 text-sm">
          <div className="rounded-md bg-gray-50 px-3 py-2">
            <p className="text-xs text-muted-foreground">Pagado</p>
            <p className="font-semibold tabular-nums">{formatCurrency(mov.total_pagado ?? 0, mov.moneda)}</p>
          </div>
          <div className={cn('rounded-md px-3 py-2', falta > 0 ? 'bg-orange-50' : 'bg-green-50')}>
            <p className="text-xs text-muted-foreground">
              Falta pagar{mov.falta_pagar_sobre_presupuesto && ' (s/ presupuesto)'}
            </p>
            <p className={cn('font-semibold tabular-nums', falta > 0 ? 'text-orange-700' : 'text-green-700')}>
              {formatCurrency(falta, mov.moneda)}
            </p>
          </div>
        </div>

        {pagos.length > 0 && (
          <ul className="divide-y divide-border border border-border rounded-md mb-3">
            {pagos.map(p => (
              <li key={p.id} className="flex items-center gap-3 px-3 py-1.5 text-sm">
                <span className="w-24 text-muted-foreground">{formatDate(p.fecha)}</span>
                <span className="flex-1 truncate text-muted-foreground">{p.nota || '—'}</span>
                <span className="tabular-nums font-medium">{formatCurrency(p.monto, mov.moneda)}</span>
                {!cerrado && (
                  <button
                    type="button"
                    onClick={() => handleRemove(p.id)}
                    title="Quitar pago"
                    className="p-1 rounded text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {cerrado ? (
          <p className="text-xs text-muted-foreground">
            La línea está {mov.estado_movimiento === 'PAGADO' ? 'pagada' : 'cancelada'} — no admite más pagos.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="flex items-start gap-2 rounded-md bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-800">
              <Info size={14} className="shrink-0 mt-0.5" />
              <span>
                Registra lo que ya se le pagó (seña, cuota). No genera movimiento de caja.
                Cuando los pagos cubren el total, la línea pasa a <strong>Pagado</strong>.
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={label}>Fecha *</label>
                <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className={input} />
              </div>
              <div>
                <label className={label}>Monto *</label>
                <MoneyInput value={monto} onChange={setMonto} className={input} />
                {falta > 0 && (
                  <button type="button" onClick={() => setMonto(String(falta))} className="mt-1 text-xs text-primary hover:underline">
                    Saldar ({formatCurrency(falta, mov.moneda)})
                  </button>
                )}
              </div>
            </div>
            <div>
              <label className={label}>Nota</label>
              <input value={nota} onChange={e => setNota(e.target.value)} placeholder="Seña, transferencia, etc." className={input} />
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" size="sm" onClick={onClose}>Cerrar</Button>
              <Button type="submit" size="sm" disabled={addPago.isPending}>
                {addPago.isPending ? 'Guardando…' : 'Registrar pago'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
