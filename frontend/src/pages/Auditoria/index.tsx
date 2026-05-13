import { useState } from 'react';
import { ChevronDown, ChevronRight, Filter } from 'lucide-react';
import { useAuditoria } from '@/hooks/useAuditoria';
import type { AuditoriaLog } from '@/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const ACCIONES = ['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'EXPORT'];
const ENTIDADES = ['Movimiento', 'Evento', 'CuentaBancaria', 'MovimientoCaja', 'Echeq', 'Usuario', 'EventoAcceso'];

function DataCell({ label, data }: { label: string; data: Record<string, unknown> | null }) {
  if (!data) return null;
  return (
    <div className="text-xs">
      <span className="font-medium text-muted-foreground mr-1">{label}:</span>
      <code className="bg-muted px-1 rounded">{JSON.stringify(data)}</code>
    </div>
  );
}

function LogRow({ log }: { log: AuditoriaLog }) {
  const [expanded, setExpanded] = useState(false);
  const hasExtra = log.datos_antes || log.datos_despues;

  const accionColor: Record<string, string> = {
    CREATE: 'bg-green-100 text-green-800',
    UPDATE: 'bg-blue-100 text-blue-800',
    DELETE: 'bg-red-100 text-red-800',
    LOGIN:  'bg-purple-100 text-purple-800',
    LOGOUT: 'bg-gray-100 text-gray-800',
    EXPORT: 'bg-yellow-100 text-yellow-800',
  };

  return (
    <>
      <tr
        className={`border-b hover:bg-muted/30 ${hasExtra ? 'cursor-pointer' : ''}`}
        onClick={() => hasExtra && setExpanded(p => !p)}
      >
        <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
          {format(new Date(log.created_at), 'dd/MM/yy HH:mm:ss', { locale: es })}
        </td>
        <td className="px-3 py-2">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${accionColor[log.accion] ?? 'bg-gray-100 text-gray-800'}`}>
            {log.accion}
          </span>
        </td>
        <td className="px-3 py-2 text-sm">{log.entidad}</td>
        <td className="px-3 py-2 text-sm text-muted-foreground">
          {log.usuario ? `${log.usuario.nombre}` : 'Sistema'}
        </td>
        <td className="px-3 py-2 text-sm max-w-xs truncate">{log.descripcion}</td>
        <td className="px-3 py-2 text-xs text-muted-foreground">{log.ip ?? '-'}</td>
        <td className="px-3 py-2 text-center">
          {hasExtra
            ? (expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />)
            : null}
        </td>
      </tr>
      {expanded && hasExtra && (
        <tr className="border-b bg-muted/20">
          <td colSpan={7} className="px-6 py-2 space-y-1">
            <DataCell label="Antes"   data={log.datos_antes} />
            <DataCell label="Después" data={log.datos_despues} />
          </td>
        </tr>
      )}
    </>
  );
}

export default function AuditoriaPage() {
  const [page, setPage]       = useState(1);
  const [accion, setAccion]   = useState('');
  const [entidad, setEntidad] = useState('');
  const [desde, setDesde]     = useState('');
  const [hasta, setHasta]     = useState('');

  const { data, isLoading } = useAuditoria({
    page,
    limit: 50,
    accion:  accion  || undefined,
    entidad: entidad || undefined,
    desde:   desde   || undefined,
    hasta:   hasta   || undefined,
  });

  function resetFilters() {
    setPage(1); setAccion(''); setEntidad(''); setDesde(''); setHasta('');
  }

  function applyFilter() { setPage(1); }

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold">Auditoría</h1>

      {/* Filtros */}
      <div className="bg-white rounded-lg border p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Filter size={14} />
          <span>Filtros</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Acción</label>
            <select
              className="w-full border rounded px-2 py-1.5 text-sm"
              value={accion}
              onChange={e => setAccion(e.target.value)}
            >
              <option value="">Todas</option>
              {ACCIONES.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Entidad</label>
            <select
              className="w-full border rounded px-2 py-1.5 text-sm"
              value={entidad}
              onChange={e => setEntidad(e.target.value)}
            >
              <option value="">Todas</option>
              {ENTIDADES.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Desde</label>
            <input
              type="date"
              className="w-full border rounded px-2 py-1.5 text-sm"
              value={desde}
              onChange={e => setDesde(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Hasta</label>
            <input
              type="date"
              className="w-full border rounded px-2 py-1.5 text-sm"
              value={hasta}
              onChange={e => setHasta(e.target.value)}
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={applyFilter}
            className="px-3 py-1.5 text-sm rounded bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Aplicar
          </button>
          <button
            onClick={resetFilters}
            className="px-3 py-1.5 text-sm rounded border hover:bg-muted"
          >
            Limpiar
          </button>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-lg border overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Cargando...</div>
        ) : !data?.data.length ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Sin registros de auditoría</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/30">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Fecha</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Acción</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Entidad</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Usuario</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Descripción</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">IP</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {data.data.map(log => <LogRow key={log.id} log={log} />)}
                </tbody>
              </table>
            </div>

            {/* Paginación */}
            <div className="flex items-center justify-between px-4 py-3 border-t text-sm">
              <span className="text-muted-foreground">
                {data.total} registros — página {data.page} de {data.pages}
              </span>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(p => p - 1)}
                  className="px-3 py-1 border rounded disabled:opacity-40 hover:bg-muted"
                >
                  Anterior
                </button>
                <button
                  disabled={page >= data.pages}
                  onClick={() => setPage(p => p + 1)}
                  className="px-3 py-1 border rounded disabled:opacity-40 hover:bg-muted"
                >
                  Siguiente
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
