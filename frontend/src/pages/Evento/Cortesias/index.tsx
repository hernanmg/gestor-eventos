import { useMemo, useState } from 'react';
import { Plus, Upload, FileSpreadsheet, Loader2, Check, Pencil, Trash2, Search } from 'lucide-react';
import {
  useCortesias, useMarcarCortesia, useDeleteCortesia, useExportarCortesias, type CortesiaEvento,
} from '@/hooks/useCortesias';
import { Button } from '@/components/ui/button';
import BaseTable from '@/components/ui/BaseTable';
import { cn, getApiErrorMessage } from '@/lib/utils';
import { CortesiaFormDialog, ImportarCortesiasDialog } from './CortesiaDialogs';
import CortesiaDrawer from './CortesiaDrawer';
import { VisadoBadge, EntregadoBadge } from './badges';

type FiltroEstado = '' | 'SIN_VISAR' | 'VISADAS' | 'SIN_ENTREGAR' | 'ENTREGADAS';

// "Ruta Larga - Kit Estándar" → encabezado de dos líneas: "Ruta Larga" / "Kit Estándar"
function partesTipo(tipo: string): { grupo: string; kit: string } {
  const i = tipo.indexOf(' - ');
  return i >= 0 ? { grupo: tipo.slice(0, i), kit: tipo.slice(i + 3) } : { grupo: '', kit: tipo };
}

export default function CortesiasPage({ eventoId, canEdit }: { eventoId: number; canEdit: boolean }) {
  const { data, isLoading } = useCortesias(eventoId);
  const marcar   = useMarcarCortesia(eventoId);
  const eliminar = useDeleteCortesia(eventoId);
  const { exportar, isExporting } = useExportarCortesias();

  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro]     = useState<FiltroEstado>('');
  const [seleccionadaId, setSeleccionadaId] = useState<number | null>(null);
  const [formulario, setFormulario] = useState<{ cortesia?: CortesiaEvento } | null>(null);
  const [importarOpen, setImportarOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cortesias = data?.cortesias ?? [];
  const totales = data?.totales;
  const tipos = totales?.por_tipo.map(t => t.tipo_ticket) ?? [];
  const seleccionada = cortesias.find(c => c.id === seleccionadaId) ?? null;

  const filtradas = useMemo(() => {
    const term = busqueda.trim().toLowerCase();
    return cortesias.filter(c => {
      if (filtro === 'SIN_VISAR' && c.visado) return false;
      if (filtro === 'VISADAS' && !c.visado) return false;
      if (filtro === 'SIN_ENTREGAR' && c.entregado) return false;
      if (filtro === 'ENTREGADAS' && !c.entregado) return false;
      if (!term) return true;
      return [c.cliente_nombre, c.contacto_nombre, c.autorizado_por, c.observacion].some(x => x?.toLowerCase().includes(term));
    });
  }, [cortesias, busqueda, filtro]);

  const handleMarcar = async (c: CortesiaEvento, campo: 'visar' | 'entregar') => {
    setError(null);
    const actual = campo === 'visar' ? c.visado : c.entregado;
    try { await marcar.mutateAsync({ id: c.id, campo, valor: !actual }); }
    catch (err) { setError(getApiErrorMessage(err)); }
  };

  const handleEliminar = async (c: CortesiaEvento) => {
    if (!window.confirm(`¿Eliminar la cortesía de "${c.cliente_nombre}" (${c.total} tickets)?`)) return;
    setError(null);
    try {
      await eliminar.mutateAsync(c.id);
      if (seleccionadaId === c.id) setSeleccionadaId(null);
    } catch (err) { setError(getApiErrorMessage(err)); }
  };

  if (isLoading) return <p className="p-4 text-sm text-muted-foreground">Cargando...</p>;

  const cantidadDeTipo = (c: CortesiaEvento, tipo: string) => c.items.filter(i => i.tipo_ticket === tipo).reduce((a, i) => a + i.cantidad, 0);
  const stop = (e: React.MouseEvent) => e.stopPropagation();
  const btnAccion = 'p-1.5 rounded text-muted-foreground hover:bg-accent hover:text-foreground transition disabled:opacity-40';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-lg font-semibold">Cortesías</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => exportar(eventoId)} disabled={isExporting || cortesias.length === 0}>
            {isExporting ? <Loader2 size={13} className="mr-1.5 animate-spin" /> : <FileSpreadsheet size={13} className="mr-1.5" />}
            Exportar Excel
          </Button>
          {canEdit && (
            <>
              <Button variant="outline" size="sm" onClick={() => setImportarOpen(true)}><Upload size={13} className="mr-1.5" />Importar desde Excel</Button>
              <Button size="sm" onClick={() => setFormulario({})}><Plus size={13} className="mr-1.5" />Nueva cortesía</Button>
            </>
          )}
        </div>
      </div>

      {/* Totales por tipo de ticket */}
      {totales && totales.total > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-2">
          {totales.por_tipo.map(t => {
            const { grupo, kit } = partesTipo(t.tipo_ticket);
            return (
              <div key={t.tipo_ticket} className="rounded-lg border border-gray-100 bg-white shadow-sm px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground truncate">{grupo}</p>
                <p className="text-xs text-muted-foreground truncate">{kit}</p>
                <p className="text-2xl font-bold tabular-nums leading-tight">{t.cantidad}</p>
              </div>
            );
          })}
          <div className="rounded-lg border border-primary/30 bg-primary/5 shadow-sm px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Total general</p>
            <p className="text-2xl font-bold tabular-nums leading-tight">{totales.total} <span className="text-xs font-normal text-muted-foreground">tickets</span></p>
            <p className="text-[11px] text-muted-foreground">{totales.asignaciones} asignaciones · {totales.visadas} visadas · {totales.entregadas} entregadas</p>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      {cortesias.length === 0 ? (
        <p className="text-sm text-muted-foreground py-10 text-center">
          Este evento todavía no tiene cortesías.{canEdit ? ' Cargá una con "Nueva cortesía" o importá la planilla con "Importar desde Excel".' : ''}
        </p>
      ) : (
        <>
          {/* Filtros */}
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                placeholder="Buscar cliente, contacto u observación…" value={busqueda} onChange={e => setBusqueda(e.target.value)}
                className="border rounded pl-7 pr-2 py-1.5 text-sm w-72 focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <select value={filtro} onChange={e => setFiltro(e.target.value as FiltroEstado)} className="border rounded px-2 py-1.5 text-sm">
              <option value="">Todas</option>
              <option value="SIN_VISAR">Sin visar</option>
              <option value="VISADAS">Visadas</option>
              <option value="SIN_ENTREGAR">Sin entregar</option>
              <option value="ENTREGADAS">Entregadas</option>
            </select>
            <span className="text-xs text-muted-foreground self-center">{filtradas.length} de {cortesias.length}</span>
          </div>

          {/* Tabla de asignaciones (card por fila) */}
          <div className="overflow-x-auto">
            <BaseTable className="w-full text-sm">
              <thead>
                <tr>
                  <th className="px-3 py-2 text-left">Cliente</th>
                  <th className="px-3 py-2 text-left">Contacto</th>
                  <th className="px-3 py-2 text-left">Autoriza</th>
                  {tipos.map(t => {
                    const { grupo, kit } = partesTipo(t);
                    return (
                      <th key={t} className="px-2 py-2 text-center leading-tight">
                        <span className="block text-[10px] font-normal opacity-80">{grupo}</span>{kit}
                      </th>
                    );
                  })}
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="px-3 py-2 text-left">Visado</th>
                  <th className="px-3 py-2 text-left">Entregado</th>
                  {canEdit && <th className="px-3 py-2 text-right sticky right-0 z-[1]">Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {filtradas.map(c => (
                  <tr key={c.id} onClick={() => setSeleccionadaId(c.id)} className="cursor-pointer">
                    <td className="px-3 py-2 font-medium max-w-[230px]">
                      <span className="block truncate" title={c.cliente_nombre}>{c.cliente_nombre}</span>
                      {c.observacion && <span className="block text-xs font-normal text-muted-foreground truncate" title={c.observacion}>{c.observacion}</span>}
                    </td>
                    <td className="px-3 py-2 max-w-[130px]"><span className="block truncate" title={c.contacto_nombre ?? undefined}>{c.contacto_nombre ?? '—'}</span></td>
                    <td className="px-3 py-2 max-w-[100px]"><span className="block truncate" title={c.autorizado_por ?? undefined}>{c.autorizado_por ?? '—'}</span></td>
                    {tipos.map(t => {
                      const n = cantidadDeTipo(c, t);
                      return <td key={t} className={cn('px-2 py-2 text-center tabular-nums', n > 0 ? 'font-semibold' : 'text-muted-foreground/40')}>{n > 0 ? n : '·'}</td>;
                    })}
                    <td className="px-3 py-2 text-right font-bold tabular-nums">{c.total}</td>
                    <td className="px-3 py-2"><VisadoBadge visado={c.visado} /></td>
                    <td className="px-3 py-2"><EntregadoBadge entregado={c.entregado} /></td>
                    {canEdit && (
                      <td className="px-3 py-2 text-right whitespace-nowrap sticky right-0 z-[1]" onClick={stop}>
                        <button className={btnAccion} title={c.visado ? 'Quitar visado' : 'Visar'} onClick={() => handleMarcar(c, 'visar')} disabled={marcar.isPending}>
                          <Check size={14} className={c.visado ? 'text-green-600' : undefined} />
                        </button>
                        <button className={btnAccion} title="Editar" onClick={() => setFormulario({ cortesia: c })}><Pencil size={14} /></button>
                        <button className={cn(btnAccion, 'hover:text-destructive')} title="Eliminar" onClick={() => handleEliminar(c)}><Trash2 size={14} /></button>
                      </td>
                    )}
                  </tr>
                ))}
                {filtradas.length === 0 && (
                  <tr><td colSpan={7 + tipos.length} className="py-8 text-center text-muted-foreground">Ninguna cortesía coincide con el filtro.</td></tr>
                )}
              </tbody>
            </BaseTable>
          </div>
        </>
      )}

      <CortesiaDrawer
        cortesia={seleccionada} canEdit={canEdit}
        onClose={() => setSeleccionadaId(null)}
        onEditar={c => { setSeleccionadaId(null); setFormulario({ cortesia: c }); }}
        onEliminar={handleEliminar}
        onMarcar={handleMarcar}
      />
      {formulario && (
        <CortesiaFormDialog eventoId={eventoId} cortesia={formulario.cortesia} tiposExistentes={tipos} onClose={() => setFormulario(null)} />
      )}
      {importarOpen && <ImportarCortesiasDialog eventoId={eventoId} onClose={() => setImportarOpen(false)} />}
    </div>
  );
}
