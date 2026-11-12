import { useState } from 'react';
import { Navigate, Link, useSearchParams } from 'react-router-dom';
import { FileUp } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import PageHeader from '@/components/ui/PageHeader';
import TabStrip from '@/components/ui/TabStrip';
import EmpleadosTab from './Empleados';
import JornadasTab from './Jornadas';
import JornadasPropias from './Jornadas/Propias';
import AnticiposTab from './Anticipos';
import LiquidacionesTab from './Liquidaciones';
import SueldosAdminTab, { type SubTabKey as SueldosAdminSubTabKey } from './SueldosAdmin';

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
  // Deep-link desde "Ver liquidaciones del período" (Gastos del mes, Andrea):
  // /rrhh?tab=sueldos-admin&subtab=liquidaciones&mes=X&anio=Y
  const subtabParamRaw = searchParams.get('subtab');
  const SUELDOS_ADMIN_SUBTABS: SueldosAdminSubTabKey[] = ['acuerdos', 'liquidaciones', 'escalafones', 'bitacora'];
  const subtabParam = subtabParamRaw && SUELDOS_ADMIN_SUBTABS.includes(subtabParamRaw as SueldosAdminSubTabKey) ? (subtabParamRaw as SueldosAdminSubTabKey) : undefined;
  const mesParam  = searchParams.get('mes')  ? Number(searchParams.get('mes'))  : null;
  const anioParam = searchParams.get('anio') ? Number(searchParams.get('anio')) : null;

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
        <PageHeader title="Mis jornadas" className="mb-6" />
        <JornadasPropias empleadoId={user.empleadoId!} />
      </div>
    );
  }

  const verJornadas = (empleadoId: number)      => { setFiltroEmpleadoId(empleadoId); setActiveTab('jornadas'); };
  const verLiquidaciones = (empleadoId: number) => { setFiltroEmpleadoId(empleadoId); setActiveTab('liquidaciones'); };

  return (
    <div className="p-6">
      <PageHeader
        title="RRHH"
        className="mb-4"
        actions={
          <Link to="/rrhh/importar" className="inline-flex items-center gap-1.5 text-sm text-link hover:underline">
            <FileUp size={14} /> Importar desde Excel
          </Link>
        }
      />

      <TabStrip<TabKey> items={TABS} value={activeTab} onChange={setActiveTab} className="mb-6" />

      {activeTab === 'empleados'     && <EmpleadosTab onVerJornadas={verJornadas} onVerLiquidaciones={verLiquidaciones} />}
      {activeTab === 'jornadas'      && <JornadasTab empleadoIdInicial={filtroEmpleadoId} />}
      {activeTab === 'anticipos'     && <AnticiposTab empleadoIdInicial={filtroEmpleadoId} />}
      {activeTab === 'liquidaciones' && <LiquidacionesTab empleadoIdInicial={filtroEmpleadoId} />}
      {activeTab === 'sueldos-admin' && <SueldosAdminTab empleadoIdInicial={filtroEmpleadoId} subTabInicial={subtabParam} mesInicial={mesParam} anioInicial={anioParam} />}
    </div>
  );
}
