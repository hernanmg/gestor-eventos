import { Menu, X, LogOut, Calendar, Settings, FileUp, LayoutDashboard, Building2, ClipboardList } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useAlertasDashboard } from '@/hooks/useDashboard';
import { cn } from '@/lib/utils';
import type { MeResponse } from '@/types';

interface SidebarProps {
  isOpen:   boolean;
  onToggle: () => void;
  user:     MeResponse;
  onLogout: () => void;
}

const ROL_LABEL: Record<MeResponse['rol'], string> = {
  ADMIN:    'Administrador',
  OPERADOR: 'Operador',
  VIEWER:   'Visualizador',
};

export default function Sidebar({ isOpen, onToggle, user, onLogout }: SidebarProps) {
  const { data: alertasData } = useAlertasDashboard();
  const errorCount = alertasData?.alertas.filter(a => a.severidad === 'ERROR').length ?? 0;

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
        <div className="flex h-14 items-center border-b border-border shrink-0 px-3">
          {isOpen && (
            <span className="flex-1 text-sm font-semibold truncate mr-2">Admin Portal</span>
          )}
          <button
            onClick={onToggle}
            className="rounded p-1.5 hover:bg-accent transition-colors ml-auto"
            aria-label={isOpen ? 'Colapsar menú' : 'Expandir menú'}
          >
            {isOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        {/* Navegación */}
        <nav className="flex-1 overflow-y-auto py-2" aria-label="Navegación principal">
          {/* Dashboard — visible for all roles */}
          <NavLink to="/dashboard" title={!isOpen ? 'Dashboard' : undefined} className={navItem}>
            <div className="relative shrink-0">
              <LayoutDashboard size={18} />
              {!isOpen && errorCount > 0 && (
                <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-red-500" />
              )}
            </div>
            {isOpen && (
              <>
                <span className="flex-1">Dashboard</span>
                {errorCount > 0 && (
                  <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                    {errorCount > 99 ? '99+' : errorCount}
                  </span>
                )}
              </>
            )}
          </NavLink>

          <NavLink to="/eventos" title={!isOpen ? 'Eventos' : undefined} className={navItem}>
            <Calendar size={18} className="shrink-0" />
            {isOpen && <span>Eventos</span>}
          </NavLink>

          {(user.rol === 'ADMIN' || user.rol === 'OPERADOR') && (
            <NavLink to="/proveedores" title={!isOpen ? 'Proveedores' : undefined} className={navItem}>
              <Building2 size={18} className="shrink-0" />
              {isOpen && <span>Proveedores</span>}
            </NavLink>
          )}

          {(user.rol === 'ADMIN' || user.rol === 'OPERADOR') && (
            <NavLink to="/importer" title={!isOpen ? 'Importar Excel' : undefined} className={navItem}>
              <FileUp size={18} className="shrink-0" />
              {isOpen && <span>Importar Excel</span>}
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
        </nav>

        {/* Footer */}
        <div className="border-t border-border p-3 shrink-0">
          {isOpen && (
            <div className="mb-2 px-1">
              <p className="text-sm font-medium truncate">{user.nombre}</p>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                {ROL_LABEL[user.rol]}
              </span>
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
