import { useEffect, useState } from 'react';
import { Pencil, IdCard } from 'lucide-react';
import { useCarnets, useUpdateCarnet } from '@/hooks/useFlota';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import VencimientoBadge from '@/components/flota/VencimientoBadge';
import BaseTable from '@/components/ui/BaseTable';
import { getApiErrorMessage } from '@/lib/utils';
import type { CarnetEmpleado } from '@/types';

const inputCls = 'w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring';
const labelCls = 'block text-xs font-medium text-muted-foreground mb-0.5';

// Carnets de conducir — los lleva Lorena (OPERADOR) desde acá porque el legajo
// de RRHH es sólo ADMIN. El vencimiento alimenta el Calendario, la campanita y
// el control de salida de vehículos.

function CarnetDialog({ empleado, onClose }: { empleado: CarnetEmpleado | null; onClose: () => void }) {
  const mut = useUpdateCarnet();
  const [tiene, setTiene] = useState(false);
  const [categoria, setCategoria] = useState('');
  const [numero, setNumero] = useState('');
  const [vence, setVence] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTiene(empleado?.licencia_conducir ?? false);
    setCategoria(empleado?.licencia_categoria ?? '');
    setNumero(empleado?.licencia_numero ?? '');
    setVence(empleado?.licencia_vencimiento?.slice(0, 10) ?? '');
    setError(null);
  }, [empleado]);

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empleado) return;
    setError(null);
    try {
      await mut.mutateAsync({
        empleadoId: empleado.id,
        licencia_conducir: tiene || !!vence,
        licencia_categoria: categoria || null,
        licencia_numero: numero || null,
        licencia_vencimiento: vence || null,
      });
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  return (
    <Dialog open={!!empleado} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Carnet de {empleado?.apellido}, {empleado?.nombre}</DialogTitle></DialogHeader>
        <form onSubmit={guardar} className="space-y-3 mt-1">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={tiene || !!vence} onChange={e => setTiene(e.target.checked)} disabled={!!vence} />
            Tiene carnet de conducir
          </label>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Categoría</label>
              <input value={categoria} onChange={e => setCategoria(e.target.value.toUpperCase())} className={inputCls} placeholder="B1, C, E1…" />
            </div>
            <div>
              <label className={labelCls}>N°</label>
              <input value={numero} onChange={e => setNumero(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Vence</label>
              <input type="date" value={vence} onChange={e => setVence(e.target.value)} className={inputCls} />
            </div>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={mut.isPending}>{mut.isPending ? 'Guardando…' : 'Guardar'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function CarnetsTab({ canEdit }: { canEdit: boolean }) {
  const { data = [], isLoading } = useCarnets();
  const [soloConCarnet, setSoloConCarnet] = useState(true);
  const [editing, setEditing] = useState<CarnetEmpleado | null>(null);

  const filas = soloConCarnet ? data.filter(e => e.estado_carnet !== 'SIN_CARNET') : data;
  const vencidos = data.filter(e => e.estado_carnet === 'VENCIDO').length;
  const porVencer = data.filter(e => e.estado_carnet === 'POR_VENCER').length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={soloConCarnet} onChange={e => setSoloConCarnet(e.target.checked)} />
          Sólo los que tienen carnet
        </label>
        <div className="flex items-center gap-3 text-xs">
          {vencidos > 0 && <span className="text-red-700 font-medium">{vencidos} vencido{vencidos !== 1 ? 's' : ''}</span>}
          {porVencer > 0 && <span className="text-yellow-700 font-medium">{porVencer} por vencer</span>}
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : filas.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <IdCard size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">{soloConCarnet ? 'Nadie tiene el carnet cargado todavía. Destildá el filtro para cargarlos.' : 'No hay empleados activos.'}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <BaseTable className="w-full text-sm">
            <thead className="border-b bg-muted/30">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Empleado</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Categoría</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">N°</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Vencimiento</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {filas.map(e => (
                <tr key={e.id} className="hover:bg-muted/20">
                  <td className="px-3 py-2 font-medium" data-label="Empleado">{e.apellido}, {e.nombre}{e.apodo ? <span className="text-muted-foreground font-normal"> ({e.apodo})</span> : null}</td>
                  <td className="px-3 py-2 text-muted-foreground" data-label="Categoría">{e.licencia_categoria ?? '—'}</td>
                  <td className="px-3 py-2 text-muted-foreground" data-label="N°">{e.licencia_numero ?? '—'}</td>
                  <td className="px-3 py-2" data-label="Vencimiento">
                    {e.estado_carnet === 'SIN_CARNET'
                      ? <span className="text-xs text-muted-foreground">Sin carnet</span>
                      : <VencimientoBadge estado={e.estado_carnet === 'SIN_VENCIMIENTO' ? null : e.estado_carnet} fecha={e.licencia_vencimiento} vacio="Sin vencimiento" />}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {canEdit && <Button variant="ghost" size="icon" onClick={() => setEditing(e)} title="Editar carnet"><Pencil size={14} /></Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </BaseTable>
        </div>
      )}

      <CarnetDialog empleado={editing} onClose={() => setEditing(null)} />
    </div>
  );
}
