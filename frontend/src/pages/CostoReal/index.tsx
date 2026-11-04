import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Download, FileUp, Loader2, Search } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import BaseTable from '@/components/ui/BaseTable';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useCostoRealEventos, useExportarCostoReal } from '@/hooks/useCostoReal';
import { formatCurrency, formatDate, formatFechaLocal } from '@/lib/formatters';
import { tienePermiso } from '@/lib/permisos';
import { cn, getApiErrorMessage } from '@/lib/utils';
import type { CostoRealEventoFila } from '@/types';
import ImportarMatrizDialog from '@/pages/Evento/CostoReal/ImportarMatrizDialog';

// Tablero de Flor (DOS57): el costo real de cada evento — su matriz por evento,
// con importar / exportar desde la misma fila. El detalle se carga en la
// pestaña "Costo real" de cada evento.

const cell = 'px-3 py-2 align-top';

export default function CostoRealPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: eventos = [], isLoading } = useCostoRealEventos();
  const { exportar, exportando } = useExportarCostoReal();
  const [busqueda, setBusqueda] = useState('');
  const [anio, setAnio] = useState<string>(String(new Date().getFullYear()));
  const [importar, setImportar] = useState<CostoRealEventoFila | null>(null);
  const canEdit = tienePermiso(user, 'COSTO_REAL');

  const anios = useMemo(() => {
    const s = new Set(eventos.map(e => (e.fecha_inicio ? e.fecha_inicio.slice(0, 4) : '')).filter(Boolean));
    s.add(String(new Date().getFullYear()));
    return [...s].sort().reverse();
  }, [eventos]);

  const filtrados = eventos.filter(e =>
    (!anio || (e.fecha_inicio ?? '').startsWith(anio))
    && (!busqueda || `${e.nombre} ${e.lugar ?? ''}`.toLowerCase().includes(busqueda.toLowerCase())),
  );
  const conCosto = filtrados.filter(e => e.lineas > 0);
  const total = conCosto.reduce((a, e) => a + e.costo_real, 0);
  const abrir = (e: CostoRealEventoFila) => navigate(`/eventos/${e.id}?tab=COSTO_REAL`);

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto">
      <PageHeader
        title="Costo real de eventos"
        subtitle="La matriz de cada evento: personal, alojamiento, comidas, combustible, pañol, rental y pérdidas. Importá tu planilla o cargala en la pestaña Costo real del evento."
      />

      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
        <div className="rounded-lg border border-border bg-white px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Eventos {anio || ''}</p>
          <p className="text-lg font-semibold tabular-nums">{filtrados.length}</p>
          <p className="text-[11px] text-muted-foreground">{conCosto.length} con costo real cargado</p>
        </div>
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Costo real total</p>
          <p className="text-lg font-semibold tabular-nums">{formatCurrency(total, 'ARS')}</p>
        </div>
        <div className="col-span-2 rounded-lg border border-border bg-white px-3 py-2 md:col-span-1">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Pendientes</p>
          <p className="text-lg font-semibold tabular-nums">{filtrados.length - conCosto.length}</p>
          <p className="text-[11px] text-muted-foreground">eventos sin matriz cargada</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 basis-56">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar evento o lugar"
            className="h-9 w-full rounded border border-input bg-white pl-8 pr-2 text-sm"
          />
        </div>
        <select value={anio} onChange={e => setAnio(e.target.value)} className="h-9 rounded border border-input bg-white px-2 text-sm">
          <option value="">Todos los años</option>
          {anios.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      <div className="overflow-x-auto">
        <BaseTable className="min-w-[860px] text-sm">
          <thead>
            <tr>
              <th className="px-3 py-2 text-left">Evento</th>
              <th className="px-3 py-2 text-left w-28">Fecha</th>
              <th className="px-3 py-2 text-right w-36">Rental presupuestado</th>
              <th className="px-3 py-2 text-right w-36">Costo real</th>
              <th className="px-3 py-2 text-left w-28">Actualizado</th>
              <th className="px-3 py-2 w-56" />
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">Cargando…</td></tr>}
            {!isLoading && filtrados.length === 0 && (
              <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">No hay eventos{anio ? ` en ${anio}` : ''}.</td></tr>
            )}
            {filtrados.map(e => (
              <tr key={e.id} className="cursor-pointer" onClick={() => abrir(e)}>
                <td className={cell} data-label="Evento">
                  <Link to={`/eventos/${e.id}?tab=COSTO_REAL`} className="font-medium hover:underline" onClick={ev => ev.stopPropagation()}>{e.nombre}</Link>
                  {e.lugar && <span className="block text-xs text-muted-foreground">{e.lugar}</span>}
                  {e.modalidad !== 'OPERATIVA' && (
                    <span className="block text-[11px] text-muted-foreground">Flujo de caja completo</span>
                  )}
                </td>
                <td className={cn(cell, 'text-xs')} data-label="Fecha">{e.fecha_inicio ? formatDate(e.fecha_inicio) : '—'}</td>
                <td className={cn(cell, 'text-right tabular-nums')} data-label="Presupuestado">
                  {e.presupuesto ? formatCurrency(e.presupuesto.total_rental, 'ARS') : <span className="text-muted-foreground/50">—</span>}
                </td>
                <td className={cn(cell, 'text-right tabular-nums font-semibold')} data-label="Costo real">
                  {e.lineas ? formatCurrency(e.costo_real, 'ARS') : <span className="font-normal text-muted-foreground">Sin cargar</span>}
                </td>
                <td className={cn(cell, 'text-xs')} data-label="Actualizado">{e.actualizado ? formatFechaLocal(e.actualizado) : '—'}</td>
                <td className={cn(cell, 'whitespace-nowrap text-right')} onClick={ev => ev.stopPropagation()}>
                  {canEdit && (
                    <Button variant="outline" size="sm" className="mr-1.5" onClick={() => setImportar(e)}>
                      <FileUp size={14} className="mr-1" /> Importar
                    </Button>
                  )}
                  <Button variant="outline" size="sm" disabled={exportando !== null || !e.lineas}
                    onClick={() => exportar(e.id).catch(err => alert(getApiErrorMessage(err)))}>
                    {exportando === e.id ? <Loader2 size={14} className="mr-1 animate-spin" /> : <Download size={14} className="mr-1" />}
                    Exportar
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </BaseTable>
      </div>

      {importar && (
        <ImportarMatrizDialog eventoId={importar.id} eventoNombre={importar.nombre} open onClose={() => setImportar(null)} />
      )}
    </div>
  );
}
