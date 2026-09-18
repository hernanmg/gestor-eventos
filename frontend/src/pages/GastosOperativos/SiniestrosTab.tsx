import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSiniestros } from '@/hooks/useSiniestros';
import { useEmpleados } from '@/hooks/useRRHH';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { SiniestroEstadoBadge } from '@/components/ui/badge';
import { NuevoSiniestroDialog, SiniestroDrawer, TIPO_SINIESTRO_LABEL, ESTADOS_SINIESTRO } from '@/components/siniestros/SiniestroDialogs';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { EstadoSiniestro, SiniestroEmpleado } from '@/types';

const inputCls = 'w-full border border-input rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring';

// ── Página ────────────────────────────────────────────────────────────────────

export default function SiniestrosTab() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const canEdit = user?.rol === 'ADMIN' || user?.rol === 'OPERADOR';

  const [estado, setEstado] = useState<EstadoSiniestro | 'TODOS'>('TODOS');
  const [empleadoId, setEmpleadoId] = useState<number | null>(null);
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [nuevoOpen, setNuevoOpen] = useState(false);
  const [viewingId, setViewingId] = useState<number | null>(null);

  const { data: empleados = [] } = useEmpleados();
  const { data: siniestros = [], isLoading } = useSiniestros({
    estado: estado === 'TODOS' ? undefined : estado,
    empleado_id: empleadoId ?? undefined,
    desde: desde || undefined,
    hasta: hasta || undefined,
  });

  const empleadoOptions: ComboboxOption[] = empleados.map(e => ({ value: String(e.id), label: `${e.apellido}, ${e.nombre}` }));

  const th = 'px-3 py-2 text-left text-xs font-medium text-muted-foreground';
  const td = 'px-3 py-2.5 text-sm';

  const totalGastosEmpresa = siniestros.reduce((a, s) => a + s.total_a_cargo_empresa, 0);
  const totalGastosArt     = siniestros.reduce((a, s) => a + s.total_cubierto_art, 0);

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground bg-muted/30 rounded px-3 py-2">
        🚑 Siniestros de empleados — accidentes de trabajo y cobertura ART. La carga y el seguimiento del expediente
        los maneja Lorena en <button className="underline font-medium" onClick={() => navigate('/siniestros')}>Siniestros</button>;
        acá está el foco en los gastos que quedan a cargo de la empresa. Los siniestros de vehículos (choques, robos, daños) los maneja Flota/Lorena por separado.
      </p>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <select value={estado} onChange={e => setEstado(e.target.value as EstadoSiniestro | 'TODOS')} className={cn(inputCls, 'w-auto')}>
            <option value="TODOS">Todos los estados</option>
            {ESTADOS_SINIESTRO.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
          <div className="w-56"><Combobox options={empleadoOptions} value={empleadoId ? String(empleadoId) : null} onChange={v => setEmpleadoId(v ? Number(v) : null)} placeholder="Todos los empleados" className="w-full" /></div>
          <input type="date" value={desde} onChange={e => setDesde(e.target.value)} className={cn(inputCls, 'w-auto')} />
          <span className="text-xs text-muted-foreground">a</span>
          <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className={cn(inputCls, 'w-auto')} />
        </div>
        {canEdit && <Button size="sm" onClick={() => setNuevoOpen(true)}><Plus size={13} className="mr-1.5" /> Nuevo siniestro</Button>}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : (
        <div className="rounded-lg border bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30">
              <tr>
                <th className={th}>Empleado</th>
                <th className={th}>Siniestro</th>
                <th className={th}>Fecha</th>
                <th className={th}>Estado</th>
                <th className={th}>Gastos empresa</th>
                <th className={th}>Gastos ART</th>
                <th className={th}>Total</th>
                <th className={th} />
              </tr>
            </thead>
            <tbody className="divide-y">
              {siniestros.length === 0 ? (
                <tr><td colSpan={8} className="px-3 py-6 text-center text-sm text-muted-foreground">Sin siniestros para este filtro.</td></tr>
              ) : siniestros.map((s: SiniestroEmpleado) => (
                <tr key={s.id} className="cursor-pointer hover:bg-muted/10" onClick={() => setViewingId(s.id)}>
                  <td className={td}>{s.empleado ? `${s.empleado.apellido}, ${s.empleado.nombre}` : (s.empleado_nombre_manual ?? '—')}</td>
                  <td className={td}>{s.art_numero_siniestro ?? TIPO_SINIESTRO_LABEL[s.tipo]}</td>
                  <td className={td}>{formatDate(s.fecha_ocurrencia)}</td>
                  <td className={td}><SiniestroEstadoBadge estado={s.estado} /></td>
                  <td className={cn(td, 'text-right tabular-nums')}>{formatCurrency(s.total_a_cargo_empresa)}</td>
                  <td className={cn(td, 'text-right tabular-nums')}>{formatCurrency(s.total_cubierto_art)}</td>
                  <td className={cn(td, 'text-right tabular-nums font-medium')}>{formatCurrency(s.total_gastos)}</td>
                  <td className={td}>
                    <button className="text-xs text-primary hover:underline" onClick={e => { e.stopPropagation(); navigate(`/siniestros/${s.id}`); }}>
                      Ver detalle completo
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            {siniestros.length > 0 && (
              <tfoot className="border-t bg-muted/10">
                <tr className="font-semibold">
                  <td colSpan={4} className={td}>Total</td>
                  <td className={cn(td, 'text-right tabular-nums')}>{formatCurrency(totalGastosEmpresa)}</td>
                  <td className={cn(td, 'text-right tabular-nums')}>{formatCurrency(totalGastosArt)}</td>
                  <td className={cn(td, 'text-right tabular-nums')}>{formatCurrency(totalGastosEmpresa + totalGastosArt)}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {nuevoOpen && <NuevoSiniestroDialog onClose={() => setNuevoOpen(false)} />}
      {viewingId !== null && <SiniestroDrawer id={viewingId} canEdit={canEdit} onClose={() => setViewingId(null)} />}
    </div>
  );
}
