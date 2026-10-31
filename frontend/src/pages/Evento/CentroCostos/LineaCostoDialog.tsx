import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import MoneyInput from '@/components/ui/MoneyInput';
import { Combobox } from '@/components/ui/combobox';
import ProveedorCombobox from '@/components/domain/ProveedorCombobox';
import { estadoOptions } from '@/components/domain/MovimientoTable';
import { MOVIMIENTO_LABEL } from '@/components/ui/badge';
import { useCreateMovimiento, useUpdateMovimiento } from '@/hooks/useMovimientos';
import { formatCurrency } from '@/lib/formatters';
import { getApiErrorMessage } from '@/lib/utils';
import type { EstadoMovimiento, Moneda, Movimiento, ProveedorBusqueda, Rubro } from '@/types';

// Alta / edición de una línea de costo (Movimiento EGRESO) desde el centro de
// costos, con los campos de la planilla de Male: descripción, responsable
// (proveedor), consumido neto + IVA, presupuesto, fecha/plazo de pago y si se le
// avisó al proveedor. El total va a debe (convención EGRESO → debe) y el IVA
// queda contenido en él (Movimiento.iva).

export const inputCls = 'w-full border border-input rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring bg-background';
export const labelCls = 'block text-xs font-medium text-muted-foreground mb-0.5';

export const ALICUOTAS = [
  { label: 'Sin IVA', pct: 0 },
  { label: '10,5%',   pct: 10.5 },
  { label: '21%',     pct: 21 },
  { label: '27%',     pct: 27 },
];

const r2 = (n: number) => parseFloat(n.toFixed(2));

interface Props {
  eventoId:   number;
  monedaBase: Moneda;
  open:       boolean;
  onClose:    () => void;
  mov?:       Movimiento;      // edición
  rubros:     Rubro[];         // opciones de rubro para el alta
  rubroFijo?: Rubro;           // alta en un rubro dado (RRHH)
}

export default function LineaCostoDialog({ eventoId, monedaBase, open, onClose, mov, rubros, rubroFijo }: Props) {
  const [rubroId,     setRubroId]     = useState<number | null>(null);
  const [concepto,    setConcepto]    = useState('');
  const [proveedor,   setProveedor]   = useState<ProveedorBusqueda | null>(null);
  const [neto,        setNeto]        = useState('');
  const [iva,         setIva]         = useState('');
  const [presupuesto, setPresupuesto] = useState('');
  const [moneda,      setMoneda]      = useState<Moneda>(monedaBase);
  const [plazoPago,   setPlazoPago]   = useState('');
  const [avisado,     setAvisado]     = useState(false);
  const [estado,      setEstado]      = useState<EstadoMovimiento>('CONFIRMADO');
  const [notas,       setNotas]       = useState('');
  const [error,       setError]       = useState<string | null>(null);

  const rubroActivo = mov?.rubro_id ?? rubroFijo?.id ?? rubroId ?? 0;
  const create = useCreateMovimiento(eventoId, rubroActivo);
  const update = useUpdateMovimiento(eventoId, rubroActivo);
  const pending = create.isPending || update.isPending;

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (mov) {
      const total = mov.debe + mov.haber;
      setRubroId(mov.rubro_id);
      setConcepto(mov.concepto ?? '');
      setProveedor(mov.proveedor);
      setNeto(total > 0 ? String(r2(total - (mov.iva ?? 0))) : '');
      setIva(mov.iva !== null ? String(mov.iva) : '');
      setPresupuesto(mov.presupuesto !== null ? String(mov.presupuesto) : '');
      setMoneda(mov.moneda);
      setPlazoPago(mov.plazo_pago ?? '');
      setAvisado(mov.avisado_proveedor);
      setEstado(mov.estado_movimiento);
      setNotas(mov.descripcion ?? '');
    } else {
      setRubroId(rubroFijo?.id ?? null);
      setConcepto(''); setProveedor(null); setNeto(''); setIva(''); setPresupuesto('');
      setMoneda(monedaBase); setPlazoPago(''); setAvisado(false); setEstado('CONFIRMADO'); setNotas('');
    }
  }, [open, mov?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const netoNum  = Number(neto) || 0;
  const ivaNum   = Number(iva)  || 0;
  const total    = r2(netoNum + ivaNum);
  const pagado   = mov?.estado_movimiento === 'PAGADO';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!mov && !rubroActivo) { setError('Elegí el rubro'); return; }
    const comunes = {
      concepto:          concepto.trim() || null,
      descripcion:       notas.trim() || null,
      proveedor_id:      proveedor?.id,
      presupuesto:       presupuesto === '' ? null : Number(presupuesto),
      plazo_pago:        plazoPago.trim() || null,
      avisado_proveedor: avisado,
    };
    try {
      if (mov) {
        await update.mutateAsync({
          id:   mov.id,
          data: {
            ...comunes,
            proveedor_id: proveedor?.id ?? null,
            ...(!pagado && { debe: total, haber: 0, iva: ivaNum > 0 ? ivaNum : null, moneda }),
            ...(estado !== mov.estado_movimiento && { estado_movimiento: estado }),
          },
        });
      } else {
        await create.mutateAsync({
          ...comunes,
          rubro_id:          rubroActivo,
          debe:              total,
          haber:             0,
          iva:               ivaNum > 0 ? ivaNum : null,
          moneda,
          estado_movimiento: estado,
        });
      }
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  const rubroOptions = rubros.map(r => ({ value: String(r.id), label: r.nombre }));

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{mov ? 'Editar línea de costo' : rubroFijo ? `Nueva línea — ${rubroFijo.nombre}` : 'Nueva línea de costo'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          {!mov && !rubroFijo && (
            <div>
              <label className={labelCls}>Rubro *</label>
              <Combobox
                options={rubroOptions}
                value={rubroId !== null ? String(rubroId) : null}
                onChange={v => setRubroId(Number(v))}
                placeholder="Elegí el rubro..."
                searchPlaceholder="Buscar rubro..."
                emptyMessage="Ningún rubro coincide."
              />
            </div>
          )}
          {mov?.rubro && <p className="text-xs text-muted-foreground">Rubro: {mov.rubro.nombre}</p>}

          <div>
            <label className={labelCls}>Descripción</label>
            <input className={inputCls} value={concepto} onChange={e => setConcepto(e.target.value)} placeholder="Ej: Carpas, Operador + viáticos" />
          </div>
          <div>
            <label className={labelCls}>Responsable (proveedor)</label>
            <ProveedorCombobox value={proveedor} onChange={setProveedor} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Consumido (neto)</label>
              <MoneyInput value={neto} onChange={setNeto} className={inputCls} disabled={pagado} />
            </div>
            <div>
              <label className={labelCls}>IVA</label>
              <MoneyInput value={iva} onChange={setIva} className={inputCls} disabled={pagado} />
            </div>
          </div>
          {!pagado && (
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
          )}
          {pagado && <p className="text-xs text-muted-foreground">La línea está pagada: el monto ya no se puede cambiar.</p>}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Presupuesto</label>
              <MoneyInput value={presupuesto} onChange={setPresupuesto} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Moneda</label>
              <select className={inputCls} value={moneda} onChange={e => setMoneda(e.target.value as Moneda)} disabled={pagado}>
                <option value="ARS">ARS</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Fecha de pago a proveedores</label>
              <input className={inputCls} value={plazoPago} onChange={e => setPlazoPago(e.target.value)} placeholder="Ej: Pre evento, 08/05" />
            </div>
            <div>
              <label className={labelCls}>Estado</label>
              <select className={inputCls} value={estado} onChange={e => setEstado(e.target.value as EstadoMovimiento)}>
                {(mov ? estadoOptions(mov.estado_movimiento) : (['PENDIENTE', 'COTIZANDO', 'CONFIRMADO'] as EstadoMovimiento[])).map(s => (
                  <option key={s} value={s}>{MOVIMIENTO_LABEL[s]}</option>
                ))}
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={avisado} onChange={e => setAvisado(e.target.checked)} />
            Se avisó al proveedor
          </label>

          <div>
            <label className={labelCls}>Notas</label>
            <textarea className={inputCls} rows={2} value={notas} onChange={e => setNotas(e.target.value)} />
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
