import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import MoneyInput from '@/components/ui/MoneyInput';
import { useCreateLineaCostoReal, useUpdateLineaCostoReal } from '@/hooks/useCostoReal';
import { formatCurrency } from '@/lib/formatters';
import { getApiErrorMessage } from '@/lib/utils';
import type { BloqueCostoRealData, LineaCostoReal } from '@/types';
import { inputCls, labelCls } from '../CentroCostos/LineaCostoDialog';

// Alta / edición de una línea del costo real. Total = cantidad × valor × % (el %
// sólo en rental y pérdidas, como en la matriz: 4% y 10%).

interface Props {
  eventoId: number;
  bloque:   BloqueCostoRealData;
  linea?:   LineaCostoReal;
  open:     boolean;
  onClose:  () => void;
}

const conPorcentaje = (b: BloqueCostoRealData) => b.porcentaje_default !== null;

const ORIGEN_TEXTO: Record<Exclude<LineaCostoReal['origen'], 'MANUAL'>, { vino: string; volver: string }> = {
  PLANILLA: { vino: 'vino de la matriz importada',        volver: 'importar la matriz' },
  SISTEMA:  { vino: 'se trajo del sistema',               volver: 'traer el bloque del sistema' },
  CAMPO:    { vino: 'vino de las planillas de campo',     volver: 'importar las planillas de campo' },
};

export default function LineaCostoRealDialog({ eventoId, bloque, linea, open, onClose }: Props) {
  const [concepto, setConcepto] = useState('');
  const [detalle,  setDetalle]  = useState('');
  const [codigo,   setCodigo]   = useState('');
  const [cantidad, setCantidad] = useState('1');
  const [valor,    setValor]    = useState('');
  const [pct,      setPct]      = useState('');
  const [desde,    setDesde]    = useState('');
  const [hasta,    setHasta]    = useState('');
  const [notas,    setNotas]    = useState('');
  const [error,    setError]    = useState<string | null>(null);

  const create = useCreateLineaCostoReal(eventoId);
  const update = useUpdateLineaCostoReal(eventoId);
  const pending = create.isPending || update.isPending;
  const usaPct = conPorcentaje(bloque) || (linea?.porcentaje ?? null) !== null;
  const esAloj = bloque.bloque === 'ALOJAMIENTO';

  useEffect(() => {
    if (!open) return;
    setConcepto(linea?.concepto ?? '');
    setDetalle(linea?.detalle ?? '');
    setCodigo(linea?.codigo ?? '');
    setCantidad(linea ? String(linea.cantidad) : '1');
    setValor(linea ? String(linea.valor_unitario) : '');
    setPct(String(linea?.porcentaje ?? bloque.porcentaje_default ?? ''));
    setDesde(linea?.fecha_desde?.slice(0, 10) ?? '');
    setHasta(linea?.fecha_hasta?.slice(0, 10) ?? '');
    setNotas(linea?.notas ?? '');
    setError(null);
  }, [open, linea, bloque]);

  // Alojamiento: con check-in y check-out, las noches salen solas
  useEffect(() => {
    if (!esAloj || !desde || !hasta) return;
    const noches = Math.round((Date.parse(hasta) - Date.parse(desde)) / 86_400_000);
    if (noches > 0) setCantidad(String(noches));
  }, [esAloj, desde, hasta]);

  const cant = Number(cantidad.replace(',', '.')) || 0;
  const val  = Number(valor) || 0;
  const porc = usaPct && pct !== '' ? Number(pct.replace(',', '.')) : null;
  const total = Math.round(cant * val * (porc === null ? 1 : porc / 100) * 100) / 100;

  const handleGuardar = () => {
    if (!concepto.trim()) { setError('Completá el concepto'); return; }
    const data = {
      concepto: concepto.trim(),
      detalle:  detalle.trim() || null,
      codigo:   codigo.trim() || null,
      cantidad: cant,
      valor_unitario: val,
      porcentaje: porc,
      fecha_desde: esAloj ? desde || null : undefined,
      fecha_hasta: esAloj ? hasta || null : undefined,
      notas: notas.trim() || null,
    };
    const opts = { onSuccess: onClose, onError: (e: unknown) => setError(getApiErrorMessage(e)) };
    if (linea) update.mutate({ id: linea.id, data }, opts);
    else create.mutate({ ...data, bloque: bloque.bloque, concepto: data.concepto }, opts);
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{linea ? 'Editar línea' : 'Agregar línea'} · {bloque.label}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {linea && linea.origen !== 'MANUAL' && (
            <p className="rounded bg-amber-50 px-2 py-1.5 text-xs text-amber-800">
              Esta línea {ORIGEN_TEXTO[linea.origen].vino}: si volvés a {ORIGEN_TEXTO[linea.origen].volver}, se reemplaza.
            </p>
          )}
          <div>
            <label className={labelCls}>Concepto</label>
            <input className={inputCls} value={concepto} onChange={e => setConcepto(e.target.value)} placeholder={esAloj ? 'Pasajero o grupo' : 'Ej: STAFF EXTRANJEROS'} autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className={bloque.bloque === 'RENTAL_IMP' ? '' : 'col-span-2'}>
              <label className={labelCls}>{esAloj ? 'Habitación / detalle' : 'Detalle'}</label>
              <input className={inputCls} value={detalle} onChange={e => setDetalle(e.target.value)} placeholder={esAloj ? 'Single, cuádruple…' : 'Opcional'} />
            </div>
            {bloque.bloque === 'RENTAL_IMP' && (
              <div>
                <label className={labelCls}>Código Layher</label>
                <input className={inputCls} value={codigo} onChange={e => setCodigo(e.target.value)} />
              </div>
            )}
          </div>
          {esAloj && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Entrada</label>
                <input type="date" className={inputCls} value={desde} onChange={e => setDesde(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Salida</label>
                <input type="date" className={inputCls} value={hasta} onChange={e => setHasta(e.target.value)} />
              </div>
            </div>
          )}
          <div className={usaPct ? 'grid grid-cols-3 gap-3' : 'grid grid-cols-2 gap-3'}>
            <div>
              <label className={labelCls}>{bloque.unidad}</label>
              <input className={inputCls} inputMode="decimal" value={cantidad} onChange={e => setCantidad(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>{bloque.valor}</label>
              <MoneyInput value={valor} onChange={setValor} className={inputCls} />
            </div>
            {usaPct && (
              <div>
                <label className={labelCls}>%</label>
                <input className={inputCls} inputMode="decimal" value={pct} onChange={e => setPct(e.target.value)} />
              </div>
            )}
          </div>
          <div>
            <label className={labelCls}>Notas</label>
            <input className={inputCls} value={notas} onChange={e => setNotas(e.target.value)} />
          </div>
          <p className="text-sm">
            Total: <span className="font-semibold tabular-nums">{formatCurrency(total, 'ARS')}</span>
            {porc !== null && <span className="ml-1 text-xs text-muted-foreground">({porc}% de {formatCurrency(cant * val, 'ARS')})</span>}
          </p>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={pending}>Cancelar</Button>
            <Button onClick={handleGuardar} disabled={pending}>{pending ? 'Guardando…' : 'Guardar'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
