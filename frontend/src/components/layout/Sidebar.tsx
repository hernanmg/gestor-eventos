import { useState } from 'react';
import { Menu, X, LogOut, Calendar, CalendarDays, Settings, FileUp, LayoutGrid, Building2, ClipboardList, Package, FileText, ChevronDown, Users, Palette, FileSignature, Wallet, ClipboardCheck, ArrowLeftRight, Truck, Landmark, Receipt } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useAlertasDashboard } from '@/hooks/useDashboard';
import { useAlertasStock, usePendientesFirma } from '@/hooks/useStock';
import { useAlertasFacturas } from '@/hooks/useFacturas';
import { useAlertasFlota } from '@/hooks/useFlota';
import { useResumenFacturasEmitidas } from '@/hooks/useFacturasEmitidas';
import NotificacionesBell from './NotificacionesBell';
import { useAuth } from '@/hooks/useAuth';
import { useLogoBlobUrl } from '@/hooks/useEmpresas';
import { FEATURES } from '@/lib/features';
import { EMPRESAS } from '@/lib/empresasConstants';
import { cn } from '@/lib/utils';
import type { MeResponse } from '@/types';

// Logo si existe, si no un badge con nombre_corto coloreado con color_primario.
function EmpresaBrand({ empresaId, hasLogo, nombre, colorPrimario, size = 'header' }: {
  empresaId:     number | undefined;
  hasLogo:       boolean;
  nombre:        string;
  colorPrimario: string | null | undefined;
  size?: 'header' | 'sm';
}) {
  const logoUrl = useLogoBlobUrl(empresaId ?? null, hasLogo);
  if (logoUrl) {
    return <img src={logoUrl} alt={nombre} className={cn('object-contain shrink-0', size === 'header' ? 'h-6 w-6' : 'h-4 w-4')} />;
  }
  return (
    <span
      className="h-2 w-2 shrink-0 rounded-full"
      style={{ backgroundColor: colorPrimario ?? '#94a3b8' }}
    />
  );
}

interface SidebarProps {
  isOpen:   boolean;
  onToggle: () => void;
  user:     MeResponse;
  onLogout: () => void;
}

const ROL_LABEL: Record<MeResponse['rol'], string> = {
  ADMIN:     'Administrador',
  OPERADOR:  'Operador',
  VIEWER:    'Visualizador',
  JORNALERO: 'Jornalero',
  PANOLERO:  'Pañolero',
};

export default function Sidebar({ isOpen, onToggle, user, onLogout }: SidebarProps) {
  const { switchEmpresa, isSwitchingEmpresa } = useAuth();
  const [empresaMenuOpen, setEmpresaMenuOpen] = useState(false);
  const { data: alertasData }        = useAlertasDashboard();
  const { data: stockAlertasData }   = useAlertasStock();
  const { data: facturasAlertas }    = useAlertasFacturas();
  const { data: facturasEmitidasResumen } = useResumenFacturasEmitidas();
  const { data: flotaAlertas }       = useAlertasFlota();
  const { data: pendSalida }         = usePendientesFirma('salida');
  const { data: pendLlegada }        = usePendientesFirma('llegada');
  const { data: pendRetorno }        = usePendientesFirma('retorno');
  const errorCount      = (alertasData?.alertas ?? []).filter(a => a.severidad === 'ERROR').length;
  const stockQuiebres   = (stockAlertasData?.alertas ?? []).filter(a => a.tipo === 'QUIEBRE_ACTUAL').length;
  const facturasAlerts  = (facturasAlertas?.vencidas ?? 0) + (facturasAlertas?.vencen_pronto ?? 0);
  const facturasEmitidasVencidas = facturasEmitidasResumen?.vencidas_sin_cobrar ?? 0;
  const flotaAlertCount = (flotaAlertas?.items ?? []).filter(a => a.urgencia === 'critical').length;
  const pendientesFirma = (pendSalida?.asignaciones.length ?? 0) + (pendLlegada?.asignaciones.length ?? 0) + (pendRetorno?.asignaciones.length ?? 0);

  const navItem = ({ isActive }: { isActive: boolean }) =>
    cn(
      'flex items-center gap-3 mx-2 px-2 py-2 rounded-md text-sm transition-colors',
      'hover:bg-accent text-foreground',
      isActive ? 'bg-accent font-medium' : '',
      !isOpen && 'justify-center',
    );

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 md:hidden"
          onClick={onToggle}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          'flex flex-col h-full bg-white border-r border-border',
          'transition-all duration-200 ease-in-out overflow-hidden',
          'fixed inset-y-0 left-0 z-30',
          isOpen ? 'translate-x-0' : '-translate-x-full',
          'md:relative md:translate-x-0 md:z-auto',
          isOpen ? 'w-64' : 'w-64 md:w-14',
        )}
      >
        {/* Header */}
        <div className="relative flex h-14 items-center border-b border-border shrink-0 px-3">
          {isOpen && (
            user.puedeCambiarEmpresa ? (
              <button
                onClick={() => setEmpresaMenuOpen(v => !v)}
                disabled={isSwitchingEmpresa}
                className="flex-1 flex items-center gap-1.5 mr-2 min-w-0 rounded px-1 py-1 hover:bg-accent transition-colors disabled:opacity-50"
              >
                <EmpresaBrand
                  empresaId={user.empresa?.id}
                  hasLogo={user.empresa?.tiene_logo ?? false}
                  nombre={user.empresa?.nombre ?? 'Admin Portal'}
                  colorPrimario={user.empresa?.color_primario}
                />
                <span
                  className="text-sm font-semibold truncate"
                  style={{ color: !user.empresa?.tiene_logo ? (user.empresa?.color_primario ?? undefined) : undefined }}
                >
                  {user.empresa?.nombre_corto ?? user.empresa?.nombre ?? 'Admin Portal'}
                </span>
                <ChevronDown size={14} className="shrink-0 text-muted-foreground" />
              </button>
            ) : (
              <div className="flex-1 flex items-center gap-1.5 mr-2 min-w-0">
                <EmpresaBrand
                  empresaId={user.empresa?.id}
                  hasLogo={user.empresa?.tiene_logo ?? false}
                  nombre={user.empresa?.nombre ?? 'Admin Portal'}
                  colorPrimario={user.empresa?.color_primario}
                />
                <span
                  className="text-sm font-semibold truncate"
                  style={{ color: !user.empresa?.tiene_logo ? (user.empresa?.color_primario ?? undefined) : undefined }}
                >
                  {user.empresa?.nombre_corto ?? user.empresa?.nombre ?? 'Admin Portal'}
                </span>
              </div>
            )
          )}
          <div className="flex items-center gap-1 ml-auto">
            {isOpen && <NotificacionesBell />}
            <button
              onClick={onToggle}
              className="rounded p-1.5 hover:bg-accent transition-colors"
              aria-label={isOpen ? 'Colapsar menú' : 'Expandir menú'}
            >
              {isOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>

          {isOpen && empresaMenuOpen && user.puedeCambiarEmpresa && (
            <div className="absolute left-3 top-14 z-10 w-56 rounded-md border border-border bg-white py-1 shadow-md">
              {(user.empresasDisponibles ?? []).map((empresa) => (
                <button
                  key={empresa.id}
                  onClick={() => {
                    setEmpresaMenuOpen(false);
                    if (empresa.id !== user.empresaId) switchEmpresa(empresa.id);
                  }}
                  className={cn(
                    'flex w-full items-center gap-2 px-3 py-2 text-sm text-left hover:bg-accent transition-colors',
                    empresa.id === user.empresaId && 'font-medium bg-accent/50',
                  )}
                >
                  <EmpresaBrand
                    empresaId={empresa.id}
                    hasLogo={empresa.tiene_logo}
                    nombre={empresa.nombre}
                    colorPrimario={empresa.color_primario}
                    size="sm"
                  />
                  {empresa.nombre_corto ?? empresa.nombre}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Navegación */}
        <nav className="flex-1 overflow-y-auto py-2" aria-label="Navegación principal">
          {user.rol === 'JORNALERO' ? (
            <>
              <NavLink to="/rrhh" title={!isOpen ? 'RRHH' : undefined} className={navItem}>
                <Users size={18} className="shrink-0" />
                {isOpen && <span>RRHH</span>}
              </NavLink>
              {FEATURES.PARTE_DIARIO && user.empresaId === EMPRESAS.DOS57 && (
                <NavLink to="/parte-diario" title={!isOpen ? 'Parte Diario' : undefined} className={navItem}>
                  <ClipboardCheck size={18} className="shrink-0" />
                  {isOpen && <span>Parte Diario</span>}
                </NavLink>
              )}
            </>
          ) : user.rol === 'PANOLERO' ? (
            <NavLink to="/stock?tab=panol" title={!isOpen ? 'Stock' : undefined} className={navItem}>
              <Package size={18} className="shrink-0" />
              {isOpen && <span>Stock</span>}
            </NavLink>
          ) : (
          <>
          {/* Macro — vista cross-evento + KPIs globales (admin global) o vista
              restringida por área cross-empresa (usuarios con puede_ver_macro,
              ej. Mayra) */}
          {user.rol === 'ADMIN' && (user.puedeCambiarEmpresa || user.puedeVerMacro) && (
            <NavLink to="/macro" title={!isOpen ? 'Macro' : undefined} className={navItem}>
              <div className="relative shrink-0">
                <LayoutGrid size={18} />
                {!isOpen && errorCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-red-500" />
                )}
              </div>
              {isOpen && (
                <>
                  <span className="flex-1">Macro</span>
                  {errorCount > 0 && (
                    <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                      {errorCount > 99 ? '99+' : errorCount}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          )}

          {/* Calendario — agrega fechas de todos los módulos, visible para todos los roles */}
          <NavLink to="/calendario" title={!isOpen ? 'Calendario' : undefined} className={navItem}>
            <CalendarDays size={18} className="shrink-0" />
            {isOpen && <span>Calendario</span>}
          </NavLink>

          <NavLink to="/eventos" title={!isOpen ? 'Eventos' : undefined} className={navItem}>
            <Calendar size={18} className="shrink-0" />
            {isOpen && <span>Eventos</span>}
          </NavLink>

          {(user.rol === 'ADMIN' || user.rol === 'OPERADOR' || user.rol === 'VIEWER') && (
            <NavLink to="/caja" title={!isOpen ? 'Caja Global' : undefined} className={navItem}>
              <Wallet size={18} className="shrink-0" />
              {isOpen && <span>Caja Global</span>}
            </NavLink>
          )}

          {user.rol === 'ADMIN' && (
            <NavLink to="/proveedores" title={!isOpen ? 'Proveedores' : undefined} className={navItem}>
              <Building2 size={18} className="shrink-0" />
              {isOpen && <span>Proveedores</span>}
            </NavLink>
          )}

          {FEATURES.STOCK && (user.rol === 'ADMIN' || user.rol === 'OPERADOR' || user.rol === 'VIEWER') && (
            <NavLink to="/stock" title={!isOpen ? 'Stock' : undefined} className={navItem}>
              <div className="relative shrink-0">
                <Package size={18} />
                {!isOpen && stockQuiebres > 0 && (
                  <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-red-500" />
                )}
              </div>
              {isOpen && (
                <>
                  <span className="flex-1">Stock</span>
                  {stockQuiebres > 0 && (
                    <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                      {stockQuiebres > 99 ? '99+' : stockQuiebres}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          )}

          {FEATURES.STOCK && (user.rol === 'ADMIN' || user.rol === 'OPERADOR') && pendientesFirma > 0 && (
            <NavLink to="/stock/firmar" title={!isOpen ? 'Firmar movimiento' : undefined} className={navItem}>
              <div className="relative shrink-0">
                <FileSignature size={18} />
                {!isOpen && (
                  <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-amber-500" />
                )}
              </div>
              {isOpen && (
                <>
                  <span className="flex-1">Firmar movimiento</span>
                  <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white">
                    {pendientesFirma > 99 ? '99+' : pendientesFirma}
                  </span>
                </>
              )}
            </NavLink>
          )}

          {(user.rol === 'ADMIN' || user.rol === 'OPERADOR') && (
            <NavLink to="/flota" title={!isOpen ? 'Flota' : undefined} className={navItem}>
              <div className="relative shrink-0">
                <Truck size={18} />
                {!isOpen && flotaAlertCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-red-500" />
                )}
              </div>
              {isOpen && (
                <>
                  <span className="flex-1">Flota</span>
                  {flotaAlertCount > 0 && (
                    <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                      {flotaAlertCount > 99 ? '99+' : flotaAlertCount}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          )}

          {user.rol === 'ADMIN' && (
            <NavLink to="/facturas" title={!isOpen ? 'Facturas a Pagar' : undefined} className={navItem}>
              <div className="relative shrink-0">
                <FileText size={18} />
                {!isOpen && facturasAlerts > 0 && (
                  <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-orange-500" />
                )}
              </div>
              {isOpen && (
                <>
                  <span className="flex-1">Facturas a Pagar</span>
                  {facturasAlerts > 0 && (
                    <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold text-white">
                      {facturasAlerts > 99 ? '99+' : facturasAlerts}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          )}

          {user.rol === 'ADMIN' && (
            <NavLink to="/facturas-emitidas" title={!isOpen ? 'Facturas a Cobrar' : undefined} className={navItem}>
              <div className="relative shrink-0">
                <Receipt size={18} />
                {!isOpen && facturasEmitidasVencidas > 0 && (
                  <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-red-500" />
                )}
              </div>
              {isOpen && (
                <>
                  <span className="flex-1">Facturas a Cobrar</span>
                  {facturasEmitidasVencidas > 0 && (
                    <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                      {facturasEmitidasVencidas > 99 ? '99+' : facturasEmitidasVencidas}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          )}

          {user.rol === 'ADMIN' && (
            <NavLink to="/cuentas-corrientes" title={!isOpen ? 'Cuentas Corrientes' : undefined} className={navItem}>
              <ArrowLeftRight size={18} className="shrink-0" />
              {isOpen && <span>Cuentas Corrientes</span>}
            </NavLink>
          )}

          {user.rol === 'ADMIN' && (
            <NavLink to="/afip-prestamos" title={!isOpen ? 'AFIP / Créditos' : undefined} className={navItem}>
              <Landmark size={18} className="shrink-0" />
              {isOpen && <span>AFIP / Créditos</span>}
            </NavLink>
          )}

          {user.rol === 'ADMIN' && (
            <NavLink
              to="/importer"
              title={!isOpen ? 'Importar eventos históricos' : undefined}
              className={navItem}
            >
              <FileUp size={18} className="shrink-0" />
              {isOpen && (
                <div className="flex flex-col leading-tight">
                  <span>Importar eventos históricos</span>
                  <span className="text-[11px] font-normal text-muted-foreground">
                    Migrar eventos desde el Excel original
                  </span>
                </div>
              )}
            </NavLink>
          )}

          {user.rol === 'ADMIN' && (
            <NavLink to="/rrhh" title={!isOpen ? 'RRHH' : undefined} className={navItem}>
              <Users size={18} className="shrink-0" />
              {isOpen && <span>RRHH</span>}
            </NavLink>
          )}

          {FEATURES.PARTE_DIARIO && user.empresaId === EMPRESAS.DOS57 && (user.rol === 'ADMIN' || user.rol === 'OPERADOR' || user.rol === 'VIEWER') && (
            <NavLink to="/parte-diario" title={!isOpen ? 'Parte Diario' : undefined} className={navItem}>
              <ClipboardCheck size={18} className="shrink-0" />
              {isOpen && <span>Parte Diario</span>}
            </NavLink>
          )}

          {user.rol === 'ADMIN' && (
            <NavLink to="/auditoria" title={!isOpen ? 'Auditoría' : undefined} className={navItem}>
              <ClipboardList size={18} className="shrink-0" />
              {isOpen && <span>Auditoría</span>}
            </NavLink>
          )}

          {user.rol === 'ADMIN' && (
            <NavLink to="/configuracion" title={!isOpen ? 'Configuración' : undefined} className={navItem}>
              <Settings size={18} className="shrink-0" />
              {isOpen && <span>Configuración</span>}
            </NavLink>
          )}

          {user.puedeCambiarEmpresa && (
            <NavLink to="/configuracion/empresa" title={!isOpen ? 'Config. de empresa' : undefined} className={navItem}>
              <Palette size={18} className="shrink-0" />
              {isOpen && <span>Config. de empresa</span>}
            </NavLink>
          )}
          </>
          )}
        </nav>

        {/* Footer */}
        <div className="border-t border-border p-3 shrink-0">
          {isOpen && (
            <div className="mb-2 px-1">
              <p className="text-sm font-medium truncate">{user.nombre}</p>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              <div className="mt-1 flex flex-wrap gap-1">
                <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                  {ROL_LABEL[user.rol]}
                </span>
                {user.empresa && (
                  <span
                    className="inline-block text-xs px-2 py-0.5 rounded-full text-white"
                    style={{ backgroundColor: user.empresa.color_primario ?? '#64748b' }}
                  >
                    {user.empresa.nombre_corto ?? user.empresa.nombre}
                  </span>
                )}
              </div>
            </div>
          )}
          <button
            onClick={onLogout}
            className={cn(
              'flex items-center gap-2 w-full rounded px-2 py-1.5 text-sm',
              'text-destructive hover:bg-destructive/10 transition-colors',
              !isOpen && 'justify-center',
            )}
            title={!isOpen ? 'Cerrar sesión' : undefined}
          >
            <LogOut size={16} className="shrink-0" />
            {isOpen && <span>Cerrar sesión</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
