import { useState } from 'react';
import { Menu, X, LogOut, ChevronDown, ChevronRight, Sun, Moon, Search, KeyRound } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import NotificacionesBell from './NotificacionesBell';
import NavSearch from './NavSearch';
import { EmpresaBrand, HomeMark, NavBadge, ROL_LABEL, groupTone } from './NavParts';
import { groupNav, isNavActive, useNavModel, type NavItem, type NavGroupId } from './navConfig';
import { useAuth } from '@/hooks/useAuth';
import { useLogoBlobUrl } from '@/hooks/useEmpresas';
import { cn } from '@/lib/utils';
import { useTheme } from '@/lib/theme';
import type { MeResponse } from '@/types';

// Logo al tope del sidebar (sobre la navegación), de borde a borde: sin
// padding, a todo el ancho de los 256px. Alto natural de la imagen con tope
// de 176px (DOS57 580×384 → 256×169 entero; Enjoy 621×536 → tope, queda
// 204px de ancho centrado). Detrás va #1A1A1A: los logos reales son fotos
// oscuras, así los costados que deja el tope se funden y un logo con fondo
// transparente o blanco igual se lee en tema oscuro.
// Sin empresa activa (admin global antes de elegir) muestra los logos de
// todas las disponibles, chicos y lado a lado. Si una empresa no tiene logo
// cargado no se muestra nada para ella — el nombre ya está en el header.
function SidebarLogo({ empresaId, nombre }: { empresaId: number; nombre: string }) {
  const url = useLogoBlobUrl(empresaId, true);
  if (!url) return null;
  return (
    <div className="w-full shrink-0 border-b border-border bg-[#1A1A1A]">
      <img src={url} alt={nombre} className="mx-auto block h-auto max-h-44 w-full object-contain" />
    </div>
  );
}

function SidebarLogoChico({ empresaId, nombre }: { empresaId: number; nombre: string }) {
  const url = useLogoBlobUrl(empresaId, true);
  if (!url) return null;
  return <img src={url} alt={nombre} className="h-full min-w-0 flex-1 rounded-lg object-contain" />;
}

function SidebarLogos({ user }: { user: MeResponse }) {
  if (user.empresa) {
    if (!user.empresa.tiene_logo) return null;
    return <SidebarLogo empresaId={user.empresa.id} nombre={user.empresa.nombre} />;
  }
  const conLogo = (user.empresasDisponibles ?? []).filter(e => e.tiene_logo);
  if (conLogo.length === 0) return null;
  return (
    <div className="flex h-20 w-full items-center gap-2 px-4 py-3 shrink-0 border-b border-border">
      {conLogo.map(e => <SidebarLogoChico key={e.id} empresaId={e.id} nombre={e.nombre} />)}
    </div>
  );
}

// Grupos plegados — por navegador, como el tema. El grupo de la pantalla
// actual se muestra siempre abierto.
const COLLAPSED_KEY = 'erp-nav-collapsed';
function readCollapsed(): NavGroupId[] {
  try { return JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? '[]'); } catch { return []; }
}

interface SidebarProps {
  isOpen:   boolean;
  onToggle: () => void;
  user:     MeResponse;
  onLogout: () => void;
}

export default function Sidebar({ isOpen, onToggle, user, onLogout }: SidebarProps) {
  const { switchEmpresa, isSwitchingEmpresa } = useAuth();
  const [theme, toggleTheme] = useTheme();
  const [empresaMenuOpen, setEmpresaMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<NavGroupId[]>(readCollapsed);
  const { pathname } = useLocation();
  const nav = useNavModel(user);

  const toggleGroup = (id: NavGroupId) => {
    setCollapsed(prev => {
      const next = prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id];
      try { localStorage.setItem(COLLAPSED_KEY, JSON.stringify(next)); } catch { /* sin persistencia */ }
      return next;
    });
  };

  const navItem = ({ isActive }: { isActive: boolean }) =>
    cn(
      'flex items-center gap-3 mx-2 px-2 py-1.5 min-h-[34px] rounded-lg text-sm transition-colors',
      'hover:bg-accent text-foreground',
      isActive && 'nav-active font-semibold',
      !isOpen && 'justify-center',
    );

  const renderItem = (it: NavItem) => (
    <NavLink key={it.to} to={it.to} title={!isOpen ? it.label : undefined} className={navItem}>
      <div className="relative shrink-0">
        <it.icon size={18} />
        {!isOpen && <NavBadge count={it.badge} tone={it.tone} dot />}
      </div>
      {isOpen && (
        it.sublabel ? (
          <div className="flex flex-1 flex-col leading-tight min-w-0">
            <span>{it.label}</span>
            <span className="text-[11px] font-normal text-muted-foreground">{it.sublabel}</span>
          </div>
        ) : (
          <>
            <span className="flex-1 truncate">{it.label}</span>
            <NavBadge count={it.badge} tone={it.tone} />
            <HomeMark show={it.home} />
          </>
        )
      )}
    </NavLink>
  );

  return (
    <aside
      className={cn(
        // Sólo desktop: en mobile la navegación es MobileTabBar + NavSheet.
        'app-sidebar no-print hidden md:flex flex-col h-full border-r border-border shrink-0',
        'transition-[width] duration-200 ease-in-out overflow-hidden',
        isOpen ? 'w-64' : 'w-14',
      )}
    >
      {/* Header */}
      <div className="relative flex h-14 items-center border-b border-border shrink-0 px-3">
        {isOpen && (
          user.puedeCambiarEmpresa ? (
            <button
              onClick={() => setEmpresaMenuOpen(v => !v)}
              disabled={isSwitchingEmpresa}
              className="flex-1 flex items-center gap-1.5 mr-2 min-w-0 rounded-lg px-1.5 py-1 hover:bg-accent transition-colors disabled:opacity-50"
            >
              <EmpresaBrand
                empresaId={user.empresa?.id}
                hasLogo={false}
                nombre={user.empresa?.nombre ?? 'Admin Portal'}
                colorPrimario={user.empresa?.color_primario}
              />
              <span className="text-sm font-semibold truncate">
                {user.empresa?.nombre_corto ?? user.empresa?.nombre ?? 'Admin Portal'}
              </span>
              <ChevronDown size={14} className="shrink-0 text-muted-foreground" />
            </button>
          ) : (
            <div className="flex-1 flex items-center gap-1.5 mr-2 min-w-0">
              <EmpresaBrand
                empresaId={user.empresa?.id}
                hasLogo={false}
                nombre={user.empresa?.nombre ?? 'Admin Portal'}
                colorPrimario={user.empresa?.color_primario}
              />
              <span className="text-sm font-semibold truncate">
                {user.empresa?.nombre_corto ?? user.empresa?.nombre ?? 'Admin Portal'}
              </span>
            </div>
          )
        )}
        <div className="flex items-center gap-1 ml-auto">
          {isOpen && <NotificacionesBell />}
          <button
            onClick={onToggle}
            className="rounded-lg p-1.5 hover:bg-accent transition-colors"
            aria-label={isOpen ? 'Colapsar menú' : 'Expandir menú'}
          >
            {isOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        {isOpen && empresaMenuOpen && user.puedeCambiarEmpresa && (
          <div className="absolute left-3 top-14 z-10 w-56 rounded-xl border border-border bg-popover p-1 shadow-[0_4px_16px_rgba(0,0,0,0.12)]">
            {(user.empresasDisponibles ?? []).map((empresa) => (
              <button
                key={empresa.id}
                onClick={() => {
                  setEmpresaMenuOpen(false);
                  if (empresa.id !== user.empresaId) switchEmpresa(empresa.id);
                }}
                className={cn(
                  'flex w-full items-center gap-2 rounded-lg px-4 py-2.5 my-0.5 text-sm text-left hover:bg-accent transition-colors',
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

      {isOpen && <SidebarLogos user={user} />}

      {/* Buscador de módulos */}
      {nav.items.length > 5 && (
        <div className="px-2 pt-2 shrink-0">
          <button
            onClick={() => setSearchOpen(true)}
            title={!isOpen ? 'Buscar módulo (Ctrl K)' : undefined}
            className={cn(
              'flex w-full items-center gap-2 rounded-lg bg-secondary px-2.5 h-9 text-sm text-muted-foreground hover:text-foreground transition-colors',
              !isOpen && 'justify-center px-0',
            )}
          >
            <Search size={16} className="shrink-0" />
            {isOpen && (
              <>
                <span className="flex-1 text-left">Buscar…</span>
                <kbd className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px]">Ctrl K</kbd>
              </>
            )}
          </button>
          <NavSearch items={nav.items} open={searchOpen} onOpenChange={setSearchOpen} />
        </div>
      )}

      {/* Navegación */}
      <nav className="flex-1 overflow-y-auto py-2" aria-label="Navegación principal">
        {nav.flat ? (
          <div className="flex flex-col gap-0.5">{nav.items.map(renderItem)}</div>
        ) : (
          groupNav(nav.items).map((g, idx) => {
            const activo = g.items.some(it => isNavActive(it.to, pathname));
            const abierto = activo || !collapsed.includes(g.id);
            if (!isOpen) {
              return (
                <div key={g.id} className={cn('flex flex-col gap-0.5', idx > 0 && 'mt-2 pt-2 border-t border-border mx-2 [&>a]:mx-0')}>
                  {g.items.map(renderItem)}
                </div>
              );
            }
            return (
              <div key={g.id} className="mb-1">
                <button
                  onClick={() => toggleGroup(g.id)}
                  disabled={activo}
                  aria-expanded={abierto}
                  className="flex w-full items-center gap-1 px-4 pt-3 pb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-muted-foreground hover:text-foreground disabled:hover:text-muted-foreground transition-colors"
                >
                  <span className="flex-1 text-left">{g.label}</span>
                  {!abierto && <NavBadge count={g.badge} tone={groupTone(g.items)} className="h-4 min-w-[16px] text-[9px]" />}
                  {!activo && (abierto ? <ChevronDown size={13} /> : <ChevronRight size={13} />)}
                </button>
                {abierto && <div className="flex flex-col gap-0.5">{g.items.map(renderItem)}</div>}
              </div>
            );
          })
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
                <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-empresa text-empresa-text">
                  {user.empresa.nombre_corto ?? user.empresa.nombre}
                </span>
              )}
            </div>
          </div>
        )}
        <button
          onClick={toggleTheme}
          className={cn(
            'flex items-center gap-2 w-full rounded-lg px-2 py-1.5 text-sm mb-1',
            'text-muted-foreground hover:bg-accent hover:text-foreground transition-colors',
            !isOpen && 'justify-center',
          )}
          title={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
          aria-label={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
        >
          {theme === 'dark' ? <Sun size={16} className="shrink-0" /> : <Moon size={16} className="shrink-0" />}
          {isOpen && <span>{theme === 'dark' ? 'Tema claro' : 'Tema oscuro'}</span>}
        </button>
        <NavLink
          to="/cambiar-password"
          className={cn(
            'flex items-center gap-2 w-full rounded-lg px-2 py-1.5 text-sm mb-1',
            'text-muted-foreground hover:bg-accent hover:text-foreground transition-colors',
            !isOpen && 'justify-center',
          )}
          title={!isOpen ? 'Cambiar contraseña' : undefined}
        >
          <KeyRound size={16} className="shrink-0" />
          {isOpen && <span>Cambiar contraseña</span>}
        </NavLink>
        <button
          onClick={onLogout}
          className={cn(
            'flex items-center gap-2 w-full rounded-lg px-2 py-1.5 text-sm',
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
  );
}
