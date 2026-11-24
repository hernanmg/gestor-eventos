import { useState } from 'react';
import { AlertTriangle, Plus, X } from 'lucide-react';
import { format } from 'date-fns';
import { useRegistrarCobro } from '@/hooks/useFacturasEmitidas';
import { useCuentasEmpresa } from '@/hooks/useCaja';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import MoneyInput from '@/components/ui/MoneyInput';
import { formatCurrency } from '@/lib/formatters';
import { FORMAS_PAGO } from './labels';
import type { Moneda, FormatoCheque } from '@/types';
import { cn } from '@/lib/utils';

interface Props {
  facturaId:       number;
  saldoPendiente:  number;
  moneda:          Moneda;
  onClose:         () => void;
}

export default function RegistrarCobroDialog({ facturaId, saldoPendiente, moneda, onClose }: Props) {
  const [form, setForm] = useState({
    fecha:              format(new Date(), 'yyyy-MM-dd'),
    monto:              String(saldoPendiente),
    forma_cobro:        FORMAS_PAGO[0],
    cuenta_destino_id:  '',
    referencia:         '',
    notas:              '',
  });
  const [error, setError] = useState<string | null>(null);
  // Pagó con cheques / echeqs: cada uno entra a la cartera (Cheques → Recibidos) ligado a esta factura
  const [cheques, setCheques] = useState<{ numero: string; banco: string; importe: string; fecha_pago: string }[]>([]);
  const conCheques = /cheque|echeq/i.test(form.forma_cobro);
  const formato: FormatoCheque = /f[ií]sico/i.test(form.forma_cobro) ? 'FISICO' : 'ECHEQ';
  const sumaCheques = cheques.reduce((s, c) => s + (Number(c.importe) || 0), 0);
  const setCheque = (i: number, k: 'numero' | 'banco' | 'importe' | 'fecha_pago', v: string) => setCheques(p => p.map((c, j) => (j === i ? { ...c, [k]: v } : c)));
  const { data: cuentas = [] } = useCuentasEmpresa();
  const cobrarMut = useRegistrarCobro(facturaId);

  const input = 'w-full border border-input rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring';
  const label = 'block text-xs font-medium text-muted-foreground mb-0.5';

  const monto = Number(form.monto) || 0;
  const saldoDespues = Math.max(0, saldoPendiente - monto);

  const handleSubmit = async () => {
    setError(null);
    if (!monto || monto <= 0)          { setError('El monto debe ser mayor a 0'); return; }
    if (monto > saldoPendiente + 0.01) { setError(`No puede superar el saldo pendiente (${formatCurrency(saldoPendiente, moneda)})`); return; }
    if (!form.fecha)                   { setError('La fecha es obligatoria'); return; }
    const chequesValidos = conCheques ? cheques.filter(c => c.numero.trim() || c.importe) : [];
    if (chequesValidos.some(c => !c.numero.trim() || !Number(c.importe) || !c.fecha_pago)) { setError('A cada cheque le falta el número, el importe o la fecha de pago'); return; }
    if (chequesValidos.length && Math.abs(sumaCheques - monto) > 0.01) { setError(`Los cheques suman ${formatCurrency(sumaCheques, moneda)} y el cobro es de ${formatCurrency(monto, moneda)}`); return; }

    try {
      await cobrarMut.mutateAsync({
        fecha:             form.fecha,
        monto,
        forma_cobro:       form.forma_cobro || null,
        cuenta_destino_id: form.cuenta_destino_id ? Number(form.cuenta_destino_id) : null,
        referencia:        form.referencia || null,
        notas:             form.notas || null,
        cheques:           chequesValidos.length ? chequesValidos.map(c => ({ formato, numero: c.numero.trim(), banco: c.banco || null, importe: Number(c.importe), fecha_pago: c.fecha_pago })) : undefined,
      });
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Error al registrar el cobro');
    }
  };

  return (
    <Dialog open onOpenChange={v => { if (!v) onClose(); }}>
      {/*
        Dialog anidado (no un div fixed suelto): cuando este componente se abre
        arriba del drawer de detalle (que ya es un Dialog abierto), Radix aplica
        aria-hidden/inert sobre TODO lo que no sea el propio DialogContent del
        drawer — incluyendo cualquier div fixed hijo del árbol normal de la app,
        aunque tenga un z-index más alto. Bloqueaba todos los campos, no solo el
        input de PDF. Usando Dialog/DialogContent acá, Radix porta este segundo
        contenido directo a document.body (fuera del subárbol "inert"), y maneja
        el stacking de diálogos anidados correctamente.
      */}
      <DialogContent className="sm:max-w-md z-[60]">
        <DialogTitle className="text-base font-semibold">Registrar cobro</DialogTitle>
        <p className="text-sm text-muted-foreground">
          Saldo pendiente: <span className="font-medium text-foreground">{formatCurrency(saldoPendiente, moneda)}</span>
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Fecha *</label>
            <input type="date" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} className={input} />
          </div>
          <div>
            <label className={label}>Monto * (máx. {formatCurrency(saldoPendiente, moneda)})</label>
            <MoneyInput value={form.monto} onChange={v => setForm(f => ({ ...f, monto: v }))} className={input} />
          </div>
          <div className="col-span-2">
            <label className={label}>Forma de cobro</label>
            <select value={form.forma_cobro} onChange={e => setForm(f => ({ ...f, forma_cobro: e.target.value }))} className={input}>
              {FORMAS_PAGO.map(fc => <option key={fc} value={fc}>{fc}</option>)}
            </select>
          </div>
          {conCheques && (
            <div className="col-span-2 rounded border p-2.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">{formato === 'FISICO' ? 'Cheques' : 'Echeqs'} recibidos</span>
                <button type="button" onClick={() => setCheques(p => [...p, { numero: '', banco: '', importe: p.length ? '' : form.monto, fecha_pago: '' }])} className="text-xs text-link hover:underline inline-flex items-center gap-0.5"><Plus size={12} />Agregar</button>
              </div>
              {cheques.length === 0 && <p className="text-[11px] text-muted-foreground">Cargalos para que queden en la cartera con su fecha de pago y avise antes de depositarlos.</p>}
              {cheques.map((c, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-1.5 items-end">
                  <div><label className={label}>N°</label><input value={c.numero} onChange={e => setCheque(i, 'numero', e.target.value)} className={input} /></div>
                  <div><label className={label}>Banco</label><input value={c.banco} onChange={e => setCheque(i, 'banco', e.target.value)} className={input} /></div>
                  <div><label className={label}>Importe</label><MoneyInput value={c.importe} onChange={v => setCheque(i, 'importe', v)} className={input} /></div>
                  <div><label className={label}>Fecha de pago</label><input type="date" value={c.fecha_pago} onChange={e => setCheque(i, 'fecha_pago', e.target.value)} className={input} /></div>
                  <button type="button" onClick={() => setCheques(p => p.filter((_, j) => j !== i))} className="p-1.5 text-muted-foreground hover:text-destructive" aria-label="Quitar"><X size={14} /></button>
                </div>
              ))}
              {cheques.length > 0 && Math.abs(sumaCheques - monto) > 0.01 && <p className="text-[11px] text-amber-700">Suman {formatCurrency(sumaCheques, moneda)}: tienen que sumar el monto del cobro.</p>}
            </div>
          )}
          <div className="col-span-2">
            <label className={label}>Cuenta destino</label>
            <select value={form.cuenta_destino_id} onChange={e => setForm(f => ({ ...f, cuenta_destino_id: e.target.value }))} className={input}>
              <option value="">Sin especificar</option>
              {cuentas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className={label}>Referencia</label>
            <input value={form.referencia} onChange={e => setForm(f => ({ ...f, referencia: e.target.value }))} placeholder="N° transferencia, echeq…" className={input} />
          </div>
          <div className="col-span-2">
            <label className={label}>Notas</label>
            <textarea value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} rows={2} className={cn(input, 'resize-none')} />
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Saldo pendiente después de este cobro: <span className="font-medium text-foreground">{formatCurrency(saldoDespues, moneda)}</span>
        </p>

        {error && <p className="flex items-center gap-1.5 text-sm text-destructive"><AlertTriangle size={14} />{error}</p>}

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button variant="outline" size="sm" onClick={onClose} disabled={cobrarMut.isPending}>Cancelar</Button>
          <Button size="sm" onClick={handleSubmit} disabled={cobrarMut.isPending}>
            {cobrarMut.isPending ? 'Registrando…' : 'Confirmar cobro'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
