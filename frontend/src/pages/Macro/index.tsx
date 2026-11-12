import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import PageHeader from '@/components/ui/PageHeader';
import TabStrip, { type TabItem } from '@/components/ui/TabStrip';
import { BarChart3, ClipboardList } from 'lucide-react';
import { useAuth, ME_QUERY_KEY } from '@/hooks/useAuth';
import KpisSection from './KpisSection';
import MovimientosSection from './MovimientosSection';
import MacroMayra from './MacroMayra';

type Tab = 'kpis' | 'movimientos';

const TABS: TabItem<Tab>[] = [
  { key: 'kpis',        label: 'KPIs y Alertas', icon: BarChart3 },
  { key: 'movimientos', label: 'Movimientos',    icon: ClipboardList },
];

// Macro clásica — cross-evento + KPIs globales, exclusiva del admin global.
function MacroAdminGlobal() {
  const [tab, setTab] = useState<Tab>('kpis');

  return (
    <>
      <TabStrip<Tab> items={TABS} value={tab} onChange={setTab} />

      {tab === 'kpis' ? <KpisSection /> : <MovimientosSection />}
    </>
  );
}

export default function MacroPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // El selector de empresa y las áreas habilitadas (empresasDisponibles,
  // areasMacro) dependen de permisos que un admin puede haber cambiado
  // recién (ver Configuración → Usuarios). La sesión cacheada por React
  // Query puede estar stale hasta su próximo refetch automático — se fuerza
  // acá para que el selector aparezca ya en la primera visita a esta página,
  // no recién en una segunda navegación.
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Admin global (Matías) → comportamiento actual sin cambios. Usuario con
  // puede_ver_macro=true pero no admin global (Mayra) → vista restringida
  // por área, cross-empresa vía UsuarioEmpresaAcceso.
  const esAdminGlobal = !!user?.puedeCambiarEmpresa;

  return (
    <div className="p-4 max-w-[1600px] mx-auto space-y-4">
      <PageHeader
        title="Macro"
        subtitle={`${esAdminGlobal ? 'Visibilidad global del negocio' : 'Finanzas, Admin, RRHH y Stock de tus empresas'} · ${
          new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}`}
      />

      {esAdminGlobal ? <MacroAdminGlobal /> : <MacroMayra />}
    </div>
  );
}
