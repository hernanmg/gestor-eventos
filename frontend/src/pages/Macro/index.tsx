import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { useAuth, ME_QUERY_KEY } from '@/hooks/useAuth';
import KpisSection from './KpisSection';
import MovimientosSection from './MovimientosSection';
import MacroMayra from './MacroMayra';

type Tab = 'kpis' | 'movimientos';

const TABS: { key: Tab; label: string }[] = [
  { key: 'kpis',        label: '📊 KPIs y Alertas' },
  { key: 'movimientos', label: '📋 Movimientos' },
];

// Macro clásica — cross-evento + KPIs globales, exclusiva del admin global.
function MacroAdminGlobal() {
  const [tab, setTab] = useState<Tab>('kpis');

  return (
    <>
      <div className="flex gap-1 border-b border-border">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              tab === t.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

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
      <div>
        <h1 className="text-xl font-semibold">Macro</h1>
        <p className="text-sm text-muted-foreground">
          {esAdminGlobal ? 'Visibilidad global del negocio' : 'Finanzas, Admin, RRHH y Stock de tus empresas'}
        </p>
      </div>

      {esAdminGlobal ? <MacroAdminGlobal /> : <MacroMayra />}
    </div>
  );
}
