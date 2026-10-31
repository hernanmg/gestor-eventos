import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import MoneyInput from '@/components/ui/MoneyInput';
import { useCreateExtra, useUpdateExtra } from '@/hooks/useCentroCostos';
import { formatCurrency } from '@/lib/formatters';
import { getApiErrorMessage } from '@/lib/utils';
import type { ExtraEvento, Moneda } from '@/types';
import { ALICUOTAS, inputCls, labelCls } from './LineaCostoDialog';

// Alta / edición de un Extra (hoja "Extras" de la planilla de Male). Por defecto
// lo paga el cliente y no suma al costo; "A cargo de la empresa" lo pasa a costo
// (genera una línea en Gastos Extra — ver backend lib/extrasEvento.ts).

const r2 = (n: number) => parseFloat(n.toFixed(2));

interface Props {
  eventoId:   number;
  monedaBase: Moneda;
  open:       boolean;
  onClose:    () => void;
  extra?:     ExtraEvento;
}

export default function ExtraDialog({ eventoId, monedaBase, open, onClose, extra }: Props) {
  const [descripcion,   setDescripcion]   = useState('');
  const [responsable,   setResponsable]   = useState('');
  const [neto,          setNeto]          = useState('');
  const [iva,           setIva]           = useState('');
  const [moneda,        setMoneda]        = useState<Moneda>(monedaBase);
  const [pagado,        setPagado]        = useState(false);
  const [plazoPago,     setPlazoPago]     = useState('');
  const [datosCuenta,   setDatosCuenta]   = useState('');
  const [factura,       setFactura]       = useState('');
  const [notas,         setNotas]         = useState('');
  const [aCargoCliente, setACargoCliente] = useState(true);
  const [error,         setError]         = useState<string | null>(null);

  const create  = useCreateExtra(eventoId);
  const update  = useUpdateExtra(eventoId);
  const pending = create.isPending || update.isPending;

  useEffect(() => {
    if (!open) return;
    setError(null);
    setDescripcion(extra?.descripcion ?? '');
    setResponsable(extra?.responsable ?? '');
    setNeto(extra ? String(extra.neto) : '');
    setIva(extra && extra.iva > 0 ? String(extra.iva) : '');
    setMoneda(extra?.moneda ?? monedaBase);
    setPagado(extra?.pagado ?? false);
    setPlazoPago(extra?.plazo_pago ?? '');
    setDatosCuenta(extra?.datos_cuenta ?? '');
    setFactura(extra?.factura ?? '');
    setNotas(extra?.notas ?? '');
    setACargoCliente(extra?.a_cargo_cliente ?? true);
  }, [open, extra?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const netoNum = Number(neto) || 0;
  const ivaNum  = Number(iva)  || 0;
  const total   = r2(netoNum + ivaNum);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!descripcion.trim()) { setError('La descripción es requerida'); return; }
    const data = {
      descripcion:     descripcion.trim(),
      responsable:     responsable.trim() || null,
      neto:            netoNum,
      iva:             ivaNum,
      moneda,
      pagado,
      plazo_pago:      plazoPago.trim() || null,
      datos_cuenta:    datosCuenta.trim() || null,
      factura:         factura.trim() || null,
      notas:           notas.trim() || null,
      a_cargo_cliente: aCargoCliente,
    };
    try {
      if (extra) await update.mutateAsync({ id: extra.id, data });
      else       await create.mutateAsync(data);
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{extra ? 'Editar extra' : 'Nuevo extra'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className={labelCls}>Descripción *</label>
            <input className={inputCls} value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Ej: Pauta radio, Host redes sociales" />
          </div>
          <div>
            <label className={labelCls}>Responsable (proveedor / persona)</label>
            <input className={inputCls} value={responsable} onChange={e => setResponsable(e.target.value)} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Consumido (neto)</label>
              <MoneyInput value={neto} onChange={setNeto} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>IVA</label>
              <MoneyInput value={iva} onChange={setIva} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Moneda</label>
              <select className={inputCls} value={moneda} onChange={e => setMoneda(e.target.value as Moneda)}>
                <option value="ARS">ARS</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1">
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
            <span className="ml-auto text-sm">
              Total <span className="font-semibold tabular-nums">{formatCurrency(total, moneda)}</span>
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Fecha de pago a proveedores</label>
              <input className={inputCls} value={plazoPago} onChange={e => setPlazoPago(e.target.value)} placeholder="Ej: Pre evento, antes del 1/05" />
            </div>
            <div>
              <label className={labelCls}>Factura (FC)</label>
              <input className={inputCls} value={factura} onChange={e => setFactura(e.target.value)} placeholder="Ej: Con FC, Deben factura" />
            </div>
          </div>
          <div>
            <label className={labelCls}>Datos de cuenta</label>
            <textarea className={inputCls} rows={3} value={datosCuenta} onChange={e => setDatosCuenta(e.target.value)} placeholder="Titular, CUIT, CBU, alias" />
          </div>
          <div>
            <label className={labelCls}>Notas</label>
            <textarea className={inputCls} rows={2} value={notas} onChange={e => setNotas(e.target.value)} />
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={pagado} onChange={e => setPagado(e.target.checked)} />
            Pagado
          </label>

          <div className="rounded-md border border-border p-2.5 space-y-1.5">
            <p className={labelCls}>¿Quién lo paga?</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setACargoCliente(true)}
                className={`flex-1 rounded border px-2 py-1.5 text-sm ${aCargoCliente ? 'border-foreground bg-secondary font-medium' : 'border-border'}`}
              >
                El cliente
              </button>
              <button
                type="button"
                onClick={() => setACargoCliente(false)}
                className={`flex-1 rounded border px-2 py-1.5 text-sm ${!aCargoCliente ? 'border-foreground bg-secondary font-medium' : 'border-border'}`}
              >
                La empresa
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              {aCargoCliente
                ? 'No suma al costo del evento: queda en la planilla de extras para el cliente.'
                : 'Suma al costo del evento (se agrega como línea en Gastos Extra).'}
            </p>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={pending}>{pending ? 'Guardando…' : 'Guardar'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
