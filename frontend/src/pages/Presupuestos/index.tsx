import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Calculator, Plus } from 'lucide-react';
import { usePresupuestos } from '@/hooks/usePresupuestos';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { PresupuestoEstadoBadge, PRESUPUESTO_LABEL } from '@/components/ui/badge';
import BaseTable from '@/components/ui/BaseTable';
import { formatCurrency } from '@/lib/formatters';
import type { EstadoPresupuesto } from '@/types';

// Presupuestos de rental por evento (DOS57) — Nivel 1, sólo ADMIN

const thCls = 'px-3 py-2 text-left text-xs font-medium text-muted-foreground';

// created_at es un timestamp real → fecha local
const fmtFecha = (iso: string) => new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(iso));

export default function PresupuestosPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [estado, setEstado] = useState<EstadoPresupuesto | ''>('');
  const { data: presupuestos = [], isLoading } = usePresupuestos(estado ? { estado } : {});

  if (user?.rol !== 'ADMIN') return <Navigate to="/" replace />;

  return (
    <div className="p-6 space-y-4 max-w-[1300px] mx-auto">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Calculator size={22} /> Presupuestos</h1>
        <div className="flex gap-2">
          <select value={estado} onChange={e => setEstado(e.target.value as EstadoPresupuesto | '')} className="border border-input rounded px-2 py-1.5 text-sm bg-white">
            <option value="">Todos los estados</option>
            {(Object.keys(PRESUPUESTO_LABEL) as EstadoPresupuesto[]).map(e => <option key={e} value={e}>{PRESUPUESTO_LABEL[e]}</option>)}
          </select>
          <Button size="sm" onClick={() => navigate('/presupuestos/nuevo')}><Plus size={14} className="mr-1.5" /> Nuevo presupuesto</Button>
        </div>
      </div>

      {isLoading ? <p className="text-sm text-muted-foreground">Cargando…</p> : presupuestos.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Calculator size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">{estado ? 'No hay presupuestos en ese estado.' : 'Todavía no hay presupuestos.'}</p>
        </div>
      ) : (
        <BaseTable className="w-full text-sm min-w-[900px]">
          <thead className="border-b bg-muted/10">
            <tr>
              <th className={thCls}>Nombre</th>
              <th className={thCls}>Evento</th>
              <th className={`${thCls} text-right`}>% Alquiler</th>
              <th className={`${thCls} text-right`}>Total material</th>
              <th className={`${thCls} text-right`}>Total rental</th>
              <th className={thCls}>Estado</th>
              <th className={thCls}>Fecha</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {presupuestos.map(p => (
              <tr key={p.id} className="cursor-pointer hover:bg-muted/30" onClick={() => navigate(`/presupuestos/${p.id}`)}>
                <td className="px-3 py-2.5 font-medium">
                  {p.nombre}
                  {p.version > 1 && <span className="ml-1.5 text-xs font-normal text-muted-foreground">v{p.version}</span>}
                </td>
                <td className="px-3 py-2.5">{p.evento?.nombre ?? <span className="text-muted-foreground">—</span>}</td>
                <td className="px-3 py-2.5 text-right">{p.porcentaje_alquiler === 'FULL' ? 'FULL' : `${p.porcentaje_alquiler}%`}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{formatCurrency(p.totales.total_material)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums font-medium">{formatCurrency(p.totales.total_rental)}</td>
                <td className="px-3 py-2.5"><PresupuestoEstadoBadge estado={p.estado} /></td>
                <td className="px-3 py-2.5 text-muted-foreground">{fmtFecha(p.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </BaseTable>
      )}
    </div>
  );
}
