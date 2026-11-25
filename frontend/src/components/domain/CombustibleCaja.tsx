import { useState } from 'react';
import { Fuel } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { getApiErrorMessage, cn } from '@/lib/utils';
import { useCamiones } from '@/hooks/useCamiones';
import { useEventos } from '@/hooks/useEvento';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatCurrency } from '@/lib/formatters';
import type { MovimientoCaja, TipoCombustible } from '@/types';

// Combustible pagado de una caja (Logística 12): desde el gasto de la caja se
// elige el vehículo, los litros (si el ticket los trae) y el evento. Eso crea
// la carga en Combustible, que suma al vehículo y a la logística del evento.

const RE_COMBUSTIBLE = /combust|nafta|gasoil|gas ?oil|diesel|di[eé]sel|ypf|shell|axion|puma|gnc/i;

/** ¿Este gasto de caja es (o puede ser) combustible? */
export function esGastoCombustible(m: MovimientoCaja) {
  return Number(m.haber) > 0 && (m.carga_combustible != null || m.categoria_andrea === 'COMBUSTIBLE' || RE_COMBUSTIBLE.test(m.descripcion ?? ''));
}

const TIPOS: { value: TipoCombustible; label: string }[] = [
  { value: 'DIESEL', label: 'Gasoil' }, { value: 'NAFTA_SUPER', label: 'Nafta súper' },
  { value: 'NAFTA_PREMIUM', label: 'Nafta premium' }, { value: 'GNC', label: 'GNC' },
];

function useCombustibleCaja() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: { camion_id: number | null; litros?: number | null; evento_id?: number | null; tipo_combustible?: TipoCombustible } }) =>
      api.put(`/movimientos-caja/${id}/combustible`, data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['caja', 'resumen-andrea'] });
      qc.invalidateQueries({ queryKey: ['cuentas'] });
      qc.invalidateQueries({ queryKey: ['combustible'] });
      qc.invalidateQueries({ queryKey: ['evento-logistica'] });
    },
  });
}

const inputCls = 'w-full border border-input rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring bg-background';
const labelCls = 'block text-xs font-medium text-muted-foreground mb-1';

export function CombustibleCajaDialog({ mov, onClose, onSaved }: { mov: MovimientoCaja; onClose: () => void; onSaved?: () => void }) {
  const { data: camiones = [] } = useCamiones();
  const { data: eventos = [] } = useEventos();
  const guardar = useCombustibleCaja();
  const c = mov.carga_combustible;
  const [camionId, setCamionId] = useState(String(c?.camion.id ?? ''));
  const [litros, setLitros]     = useState(c?.litros != null ? String(c.litros) : '');
  const [eventoId, setEventoId] = useState(String(c?.evento?.id ?? mov.evento?.id ?? ''));
  const [tipo, setTipo]         = useState<TipoCombustible>(c?.tipo_combustible ?? 'DIESEL');
  const [error, setError]       = useState('');

  const vehiculos = camiones.filter(v => v.activo !== false && v.tipo_vehiculo !== 'TRAILER')
    .sort((a, b) => a.codigo.localeCompare(b.codigo));
  const eventosOrd = [...eventos].sort((a, b) => String(b.fecha_inicio ?? '').localeCompare(String(a.fecha_inicio ?? ''))).slice(0, 200);
  const lts = litros.trim() === '' ? null : Number(litros.replace(',', '.'));

  const enviar = async (quitar = false) => {
    setError('');
    if (!quitar && !camionId) { setError('Elegí el vehículo'); return; }
    if (!quitar && lts != null && !(lts > 0)) { setError('Los litros tienen que ser un número mayor a cero'); return; }
    try {
      await guardar.mutateAsync({ id: mov.id, data: quitar ? { camion_id: null } : { camion_id: Number(camionId), litros: lts, evento_id: eventoId ? Number(eventoId) : null, tipo_combustible: tipo } });
      onSaved?.(); onClose();
    } catch (e) { setError(getApiErrorMessage(e)); }
  };

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Combustible pagado de la caja</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground -mt-1">
          {mov.descripcion ?? 'Gasto'} · <span className="font-medium text-foreground">{formatCurrency(mov.haber)}</span>
        </p>
        <p className="text-xs text-muted-foreground">Queda como una carga del vehículo en Combustible y, si elegís el evento, en su logística y su costo real.</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className={labelCls}>Vehículo</label>
            <select value={camionId} onChange={e => setCamionId(e.target.value)} className={inputCls} autoFocus>
              <option value="">— Elegí el vehículo —</option>
              {vehiculos.map(v => <option key={v.id} value={v.id}>{v.codigo}{v.descripcion ? ` · ${v.descripcion}` : ''}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Litros (si el ticket los dice)</label>
            <input value={litros} onChange={e => setLitros(e.target.value)} inputMode="decimal" className={inputCls} placeholder="—" />
          </div>
          <div>
            <label className={labelCls}>Combustible</label>
            <select value={tipo} onChange={e => setTipo(e.target.value as TipoCombustible)} className={inputCls}>
              {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className={labelCls}>Evento (opcional)</label>
            <select value={eventoId} onChange={e => setEventoId(e.target.value)} className={inputCls}>
              <option value="">Sin evento</option>
              {eventosOrd.map(ev => <option key={ev.id} value={ev.id}>{ev.nombre}</option>)}
            </select>
          </div>
          {lts != null && lts > 0 && <p className="col-span-2 text-xs text-muted-foreground">Sale a {formatCurrency(Number(mov.haber) / lts)} el litro.</p>}
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-between gap-2 pt-1">
          <div>{c && <Button variant="ghost" className="text-destructive" onClick={() => enviar(true)} disabled={guardar.isPending}>Quitar vehículo</Button>}</div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={() => enviar()} disabled={guardar.isPending}>{guardar.isPending ? 'Guardando…' : 'Guardar'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Chip con el vehículo (o botón para atarlo) en la fila del gasto. */
export function CombustibleCajaChip({ mov, canEdit, onAbrir, className }: { mov: MovimientoCaja; canEdit: boolean; onAbrir: () => void; className?: string }) {
  if (!esGastoCombustible(mov)) return null;
  const c = mov.carga_combustible;
  if (!c && !canEdit) return null;
  return (
    <button
      type="button"
      onClick={e => { e.stopPropagation(); if (canEdit) onAbrir(); }}
      title={c ? `Carga de ${c.camion.codigo}${c.litros ? ` · ${c.litros} L` : ''}${c.evento ? ` · ${c.evento.nombre}` : ''}` : 'Atar este gasto de combustible a un vehículo'}
      className={cn('inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px] align-middle',
        c ? 'border-sky-300 bg-sky-50 text-sky-800' : 'border-dashed text-muted-foreground hover:bg-accent', className)}
    >
      <Fuel size={11} />{c ? `${c.camion.codigo}${c.litros ? ` · ${c.litros} L` : ''}` : 'Vehículo'}
    </button>
  );
}
