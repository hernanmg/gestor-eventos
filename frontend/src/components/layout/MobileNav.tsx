import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { LayoutGrid, LogOut, Moon, Search, Sun, Check, KeyRound } from 'lucide-react';
import NotificacionesBell from './NotificacionesBell';
import NavSearch from './NavSearch';
import { EmpresaBrand, HomeMark, NavBadge, ROL_LABEL, groupTone } from './NavParts';
import { groupNav, isNavActive, useNavModel, type NavItem, type NavGroupId, type NavModel } from './navConfig';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';
import type { MeResponse } from '@/types';
import type { LucideIcon } from 'lucide-react';

// ── Navegación mobile (< 768px) ──────────────────────────────────────────────
// Barra superior (empresa, buscar, notificaciones, cuenta) + barra inferior
// de hasta 5 pestañas. Reemplaza al sidebar, que en mobile no se muestra.
// - Menú acotado (≤ 5 ítems): una pestaña por ítem.
// - Menú completo: una pestaña por área (Inicio, Eventos, Finanzas,
//   Operaciones) + "Más". Un área con un solo módulo navega directo; con
//   varios abre una hoja con sus módulos. Inicio va directo a su primer ítem
//   (Macro) y el resto de Inicio (Calendario) queda en "Más".
// Las rutas son las mismas del sidebar; no hay pantallas nuevas.

type SheetGroup = { id: string; label: string; items: NavItem[] };
type Tab =
  | { kind: 'link';  key: string; label: string; icon: LucideIcon; item: NavItem; badge?: number; tone?: NavItem['tone'] }
  | { kind: 'sheet'; key: string; label: string; icon: LucideIcon; groups: SheetGroup[]; account: boolean; badge: number; tone: NavItem['tone'] };

const SHORT: Partial<Record<NavGroupId, string>> = { operaciones: 'Operac.' };

function buildTabs(nav: NavModel): Tab[] {
  const linkTab = (it: NavItem, label = it.label, icon = it.icon): Tab =>
    ({ kind: 'link', key: it.to, label, icon, item: it, badge: it.badge, tone: it.tone });
  const moreTab = (groups: SheetGroup[]): Tab => {
    const items = groups.flatMap(g => g.items);
    return { kind: 'sheet', key: 'mas', label: 'Más', icon: LayoutGrid, groups, account: true,
      badge: items.reduce((s, i) => s + (i.badge ?? 0), 0), tone: groupTone(items) };
  };

  if (nav.items.length <= 1) return [];
  if (nav.flat || nav.items.length <= 5) {
    if (nav.items.length <= 5) return nav.items.map(it => linkTab(it));
    return [...nav.items.slice(0, 4).map(it => linkTab(it)), moreTab([{ id: 'mas', label: 'Más', items: nav.items.slice(4) }])];
  }

  const groups = groupNav(nav.items);
  const tabs: Tab[] = [];
  const resto: SheetGroup[] = [];
  const maxPrincipales = groups.length <= 5 ? 5 : 4;
  for (const g of groups) {
    if (tabs.length >= maxPrincipales) { resto.push(g); continue; }
    if (g.id === 'inicio') {
      tabs.push(linkTab(g.items[0], g.items.length > 1 ? g.label : g.items[0].label, g.items.length > 1 ? g.icon : g.items[0].icon));
      if (g.items.length > 1) resto.unshift({ id: g.id, label: g.label, items: g.items.slice(1) });
    } else if (g.items.length === 1) {
      tabs.push(linkTab(g.items[0], SHORT[g.id] ?? g.label, g.icon));
    } else {
      tabs.push({ kind: 'sheet', key: g.id, label: SHORT[g.id] ?? g.label, icon: g.icon,
        groups: [{ id: g.id, label: g.label, items: g.items }], account: false, badge: g.badge, tone: groupTone(g.items) });
    }
  }
  if (resto.length) {
    if (tabs.length >= 5) tabs.pop();
    tabs.push(moreTab(resto));
  }
  return tabs;
}

function initials(nombre: string): string {
  const partes = nombre.split(/\s+/).filter(Boolean);
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return partes.slice(0, 2).map(p => p[0]!.toUpperCase()).join('') || '?';
}

// ── Hoja inferior ────────────────────────────────────────────────────────────
function NavSheet({ open, onOpenChange, title, groups, account, user, onLogout }: {
  open: boolean; onOpenChange: (o: boolean) => void; title: string;
  groups: SheetGroup[]; account: boolean; user: MeResponse; onLogout: () => void;
}) {
  const { switchEmpresa, isSwitchingEmpresa } = useAuth();
  const [theme, toggleTheme] = useTheme();
  const close = () => onOpenChange(false);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className={cn(
            'fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto rounded-t-2xl border-t border-border bg-popover text-popover-foreground shadow-2xl',
            'px-3 pt-2 pb-[calc(12px+env(safe-area-inset-bottom))]',
            'data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom',
          )}
        >
          <div className="mx-auto mb-2 mt-1 h-1 w-10 rounded-full bg-border" aria-hidden="true" />
          <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>

          {groups.map(g => (
            <div key={g.id} className="mb-1">
              {(groups.length > 1 || g.label !== title) && (
                <p className="px-3 pt-2 pb-1 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">{g.label}</p>
              )}
              {groups.length === 1 && g.label === title && (
                <p className="px-3 pt-1 pb-2 text-base font-semibold">{g.label}</p>
              )}
              {g.items.map(it => (
                <NavLink
                  key={it.to}
                  to={it.to}
                  onClick={close}
                  className={({ isActive }) => cn(
                    'flex items-center gap-3 rounded-xl px-3 min-h-[44px] text-[15px] transition-colors active:bg-accent',
                    isActive && 'nav-active font-semibold',
                  )}
                >
                  <it.icon size={19} className="shrink-0" />
                  <span className="flex-1">{it.label}</span>
                  <NavBadge count={it.badge} tone={it.tone} />
                  <HomeMark show={it.home} />
                </NavLink>
              ))}
            </div>
          ))}

          {account && (
            <div className={cn('flex flex-col gap-0.5', groups.length > 0 && 'mt-2 border-t border-border pt-2')}>
              <div className="flex items-center gap-3 px-3 py-2">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary text-sm font-semibold">{initials(user.nombre)}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{user.nombre}</p>
                  <p className="text-xs text-muted-foreground truncate">{ROL_LABEL[user.rol]} · {user.email}</p>
                </div>
              </div>
              {user.puedeCambiarEmpresa && (user.empresasDisponibles ?? []).map(empresa => (
                <button
                  key={empresa.id}
                  disabled={isSwitchingEmpresa}
                  onClick={() => { close(); if (empresa.id !== user.empresaId) switchEmpresa(empresa.id); }}
                  className="flex items-center gap-3 rounded-xl px-3 min-h-[44px] text-[15px] text-left active:bg-accent disabled:opacity-50"
                >
                  <span className="grid h-[19px] w-[19px] shrink-0 place-items-center">
                    <EmpresaBrand empresaId={empresa.id} hasLogo={empresa.tiene_logo} nombre={empresa.nombre} colorPrimario={empresa.color_primario} size="sm" />
                  </span>
                  <span className="flex-1">{empresa.nombre_corto ?? empresa.nombre}</span>
                  {empresa.id === user.empresaId && <Check size={16} className="text-muted-foreground" />}
                </button>
              ))}
              <button onClick={toggleTheme} className="flex items-center gap-3 rounded-xl px-3 min-h-[44px] text-[15px] text-left active:bg-accent">
                {theme === 'dark' ? <Sun size={19} className="shrink-0" /> : <Moon size={19} className="shrink-0" />}
                {theme === 'dark' ? 'Tema claro' : 'Tema oscuro'}
              </button>
              <NavLink to="/cambiar-password" onClick={close} className="flex items-center gap-3 rounded-xl px-3 min-h-[44px] text-[15px] text-left active:bg-accent">
                <KeyRound size={19} className="shrink-0" />
                Cambiar contraseña
              </NavLink>
              <button onClick={() => { close(); onLogout(); }} className="flex items-center gap-3 rounded-xl px-3 min-h-[44px] text-[15px] text-left text-destructive active:bg-destructive/10">
                <LogOut size={19} className="shrink-0" />
                Cerrar sesión
              </button>
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

// ── Barra superior ───────────────────────────────────────────────────────────
export function MobileTopBar({ user, onLogout }: { user: MeResponse; onLogout: () => void }) {
  const nav = useNavModel(user);
  const [searchOpen, setSearchOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const nombreEmpresa = user.empresa?.nombre_corto ?? user.empresa?.nombre ?? 'Admin Portal';

  return (
    <header className="no-print md:hidden flex h-14 shrink-0 items-center gap-2 border-b border-border bg-card px-3 pt-[env(safe-area-inset-top)] box-content">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <EmpresaBrand empresaId={user.empresa?.id} hasLogo={false} nombre={nombreEmpresa} colorPrimario={user.empresa?.color_primario} />
        <span className="truncate text-[15px] font-semibold">{nombreEmpresa}</span>
      </div>
      {nav.items.length > 5 && (
        <>
          <button onClick={() => setSearchOpen(true)} className="grid h-10 w-10 place-items-center rounded-lg hover:bg-accent" aria-label="Buscar módulo">
            <Search size={19} />
          </button>
          <NavSearch items={nav.items} open={searchOpen} onOpenChange={setSearchOpen} />
        </>
      )}
      <div className="grid h-10 w-10 place-items-center"><NotificacionesBell /></div>
      <button
        onClick={() => setAccountOpen(true)}
        className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-xs font-semibold"
        aria-label="Cuenta"
      >
        {initials(user.nombre)}
      </button>
      <NavSheet open={accountOpen} onOpenChange={setAccountOpen} title="Cuenta" groups={[]} account user={user} onLogout={onLogout} />
    </header>
  );
}

// ── Barra inferior ───────────────────────────────────────────────────────────
export function MobileTabBar({ user, onLogout }: { user: MeResponse; onLogout: () => void }) {
  const nav = useNavModel(user);
  const { pathname } = useLocation();
  const [sheet, setSheet] = useState<string | null>(null);
  const tabs = buildTabs(nav);
  if (tabs.length === 0) return null;

  const tabClass = (active: boolean) => cn(
    'relative flex min-w-0 flex-1 flex-col items-center gap-0.5 pt-1.5 pb-1 text-[10.5px] leading-tight transition-colors',
    active ? 'text-foreground font-semibold' : 'text-muted-foreground',
  );
  const pill = (active: boolean) => cn('relative grid h-7 w-12 place-items-center rounded-full transition-colors', active && 'nav-active');

  return (
    <nav
      aria-label="Navegación principal"
      className="no-print md:hidden flex shrink-0 border-t border-border bg-card px-1 pb-[env(safe-area-inset-bottom)]"
    >
      {tabs.map(tab => {
        if (tab.kind === 'link') {
          const active = isNavActive(tab.item.to, pathname);
          return (
            <NavLink key={tab.key} to={tab.item.to} className={tabClass(active)} aria-current={active ? 'page' : undefined}>
              <span className={pill(active)}>
                <tab.icon size={20} />
                <NavBadge count={tab.badge} tone={tab.tone} className="absolute -top-1 left-7 h-4 min-w-[16px] text-[9px] ring-2 ring-card" />
              </span>
              <span className="max-w-full truncate px-0.5">{tab.label}</span>
            </NavLink>
          );
        }
        const active = sheet === tab.key || tab.groups.some(g => g.items.some(it => isNavActive(it.to, pathname)));
        return (
          <button key={tab.key} onClick={() => setSheet(tab.key)} className={tabClass(active)} aria-haspopup="dialog">
            <span className={pill(active)}>
              <tab.icon size={20} />
              <NavBadge count={tab.badge} tone={tab.tone} className="absolute -top-1 left-7 h-4 min-w-[16px] text-[9px] ring-2 ring-card" />
            </span>
            <span className="max-w-full truncate px-0.5">{tab.label}</span>
          </button>
        );
      })}
      {/* Fuera de los botones: los eventos de React atraviesan el portal y un
          click adentro de la hoja volvería a abrirla. */}
      {tabs.map(tab => tab.kind === 'sheet' && (
        <NavSheet
          key={tab.key}
          open={sheet === tab.key}
          onOpenChange={o => setSheet(o ? tab.key : null)}
          title={tab.groups.length === 1 ? tab.groups[0].label : tab.label}
          groups={tab.groups}
          account={tab.account}
          user={user}
          onLogout={onLogout}
        />
      ))}
    </nav>
  );
}
