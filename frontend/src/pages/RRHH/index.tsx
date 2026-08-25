import { useState } from 'react';
import { Navigate, Link, useSearchParams } from 'react-router-dom';
import { FileUp } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import EmpleadosTab from './Empleados';
import JornadasTab from './Jornadas';
import JornadasPropias from './Jornadas/Propias';
import AnticiposTab from './Anticipos';
import LiquidacionesTab from './Liquidaciones';
import SueldosAdminTab from './SueldosAdmin';

type TabKey = 'empleados' | 'jornadas' | 'anticipos' | 'liquidaciones' | 'sueldos-admin';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'empleados',      label: 'Empleados' },
  { key: 'jornadas',       label: 'Jornadas' },
  { key: 'anticipos',      label: 'Anticipos' },
  { key: 'liquidaciones',  label: 'Liquidaciones' },
  { key: 'sueldos-admin',  label: 'Sueldos Admin' },
];

const TAB_KEYS: TabKey[] = ['empleados', 'jornadas', 'anticipos', 'liquidaciones', 'sueldos-admin'];

export default function RRHHPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') as TabKey | null;
  const [activeTab, setActiveTab] = useState<TabKey>(tabParam && TAB_KEYS.includes(tabParam) ? tabParam : 'empleados');
  const [filtroEmpleadoId, setFiltroEmpleadoId] = useState<number | null>(null);

  if (!user) return null;

  // RRHH es exclusivo de ADMIN — la única excepción es JORNALERO viendo/
  // cargando sus propias jornadas (matriz de permisos: OPERADOR y VIEWER ya
  // no tienen acceso, ni siquiera de autoservicio).
  const esAutoservicio = user.rol === 'JORNALERO' && user.empleadoId != null;
  const tieneAcceso     = user.rol === 'ADMIN' || esAutoservicio;
  if (!tieneAcceso) return <Navigate to="/dashboard" replace />;

  if (esAutoservicio) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold text-foreground mb-6">Mis jornadas</h1>
        <JornadasPropias empleadoId={user.empleadoId!} />
      </div>
    );
  }

  const verJornadas = (empleadoId: number)      => { setFiltroEmpleadoId(empleadoId); setActiveTab('jornadas'); };
  const verLiquidaciones = (empleadoId: number) => { setFiltroEmpleadoId(empleadoId); setActiveTab('liquidaciones'); };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-foreground">RRHH</h1>
        <Link to="/rrhh/importar" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
          <FileUp size={14} /> Importar desde Excel
        </Link>
      </div>

      <div className="flex border-b border-border mb-6">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === t.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'empleados'     && <EmpleadosTab onVerJornadas={verJornadas} onVerLiquidaciones={verLiquidaciones} />}
      {activeTab === 'jornadas'      && <JornadasTab empleadoIdInicial={filtroEmpleadoId} />}
      {activeTab === 'anticipos'     && <AnticiposTab empleadoIdInicial={filtroEmpleadoId} />}
      {activeTab === 'liquidaciones' && <LiquidacionesTab empleadoIdInicial={filtroEmpleadoId} />}
      {activeTab === 'sueldos-admin' && <SueldosAdminTab empleadoIdInicial={filtroEmpleadoId} />}
    </div>
  );
}
