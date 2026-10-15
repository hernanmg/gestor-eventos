import {
  Calendar, CalendarDays, Settings, FileUp, LayoutGrid, Building2, ClipboardList, Package, FileText,
  Users, Palette, FileSignature, Wallet, ClipboardCheck, ArrowLeftRight, Truck, Landmark, Receipt,
  Building, UserCheck, Fuel, Banknote, Ambulance, FileSpreadsheet, Shirt, CreditCard,
  Route as RouteIcon, Boxes, Calculator, CalendarClock, type LucideIcon,
} from 'lucide-react';
import { useAlertasDashboard } from '@/hooks/useDashboard';
import { useAlertasStock, usePendientesFirma } from '@/hooks/useStock';
import { useAlertasFacturas } from '@/hooks/useFacturas';
import { useAlertasFlota } from '@/hooks/useFlota';
import { useResumenFacturasEmitidas } from '@/hooks/useFacturasEmitidas';
import { FEATURES } from '@/lib/features';
import { EMPRESAS } from '@/lib/empresasConstants';
import type { MeResponse } from '@/types';

// ── Navegación: fuente única para Sidebar (desktop), MobileTabBar y NavSheet ──
// Antes cada condición de visibilidad vivía repetida dentro del JSX del
// Sidebar; acá queda una sola lista de ítems con su grupo, y cada superficie
// decide cómo mostrarla. Las rutas y los criterios de visibilidad son los
// mismos que tenía el Sidebar — sólo cambia el orden (por área).

export type NavGroupId = 'inicio' | 'eventos' | 'finanzas' | 'operaciones' | 'personas' | 'sistema';

export const NAV_GROUPS: { id: NavGroupId; label: string; icon: LucideIcon }[] = [
  { id: 'inicio',      label: 'Inicio',      icon: LayoutGrid },
  { id: 'eventos',     label: 'Eventos',     icon: Calendar },
  { id: 'finanzas',    label: 'Finanzas',    icon: Wallet },
  { id: 'operaciones', label: 'Operaciones', icon: Truck },
  { id: 'personas',    label: 'Personas',    icon: Users },
  { id: 'sistema',     label: 'Sistema',     icon: Settings },
];

export type BadgeTone = 'red' | 'orange' | 'amber';

export interface NavItem {
  to:       string;
  label:    string;
  icon:     LucideIcon;
  group:    NavGroupId;
  badge?:   number;
  tone?:    BadgeTone;
  sublabel?: string;
  // Ícono de "casa": el ítem es la pantalla de inicio del usuario (home_route)
  home?:    boolean;
}

export interface NavModel {
  items: NavItem[];
  // Menú acotado (home_route propio, JORNALERO, PAÑOLERO, operador Enjoy):
  // pocos ítems, se muestran en el orden dado y sin títulos de grupo.
  flat:  boolean;
}

// Ruta sin query (/stock?tab=panol → /stock) para comparar con la URL actual.
export function navPath(to: string): string {
  return to.split('?')[0];
}

export function isNavActive(to: string, pathname: string): boolean {
  const p = navPath(to);
  return pathname === p || pathname.startsWith(p + '/');
}

export function useNavModel(user: MeResponse): NavModel {
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

  const I = {
    macro:       { to: '/macro',             label: 'Macro',              icon: LayoutGrid,     group: 'inicio',      badge: errorCount,      tone: 'red' },
    calendario:  { to: '/calendario',        label: 'Calendario',         icon: CalendarDays,   group: 'inicio' },
    eventos:     { to: '/eventos',           label: 'Eventos',            icon: Calendar,       group: 'eventos' },
    rental:      { to: '/materiales-rental', label: 'Ítems de Rental',    icon: Boxes,          group: 'eventos' },
    presupuestos:{ to: '/presupuestos',      label: 'Presupuestos',       icon: Calculator,     group: 'eventos' },
    importer:    { to: '/importer',          label: 'Importar eventos históricos', icon: FileUp, group: 'eventos', sublabel: 'Migrar eventos desde el Excel original' },
    caja:        { to: '/caja',              label: 'Caja Global',        icon: Wallet,         group: 'finanzas' },
    gastos:      { to: '/gastos-operativos', label: 'Gastos del mes',     icon: Banknote,       group: 'finanzas' },
    tarjeta:     { to: '/tarjeta-corporativa', label: 'Tarjeta Corp.',    icon: CreditCard,     group: 'finanzas' },
    espacios:    { to: '/espacios-compartidos', label: 'Espacios Compartidos', icon: Building,  group: 'finanzas' },
    facturas:    { to: '/facturas',          label: 'Facturas a Pagar',   icon: FileText,       group: 'finanzas', badge: facturasAlerts, tone: 'orange' },
    emitidas:    { to: '/facturas-emitidas', label: 'Facturas a Cobrar',  icon: Receipt,        group: 'finanzas', badge: facturasEmitidasVencidas, tone: 'red' },
    ctacte:      { to: '/cuentas-corrientes', label: 'Cuentas Corrientes', icon: ArrowLeftRight, group: 'finanzas' },
    proveedores: { to: '/proveedores',       label: 'Proveedores',        icon: Building2,      group: 'finanzas' },
    afip:        { to: '/afip-prestamos',    label: 'AFIP / Créditos',    icon: Landmark,       group: 'finanzas' },
    cierre:      { to: '/cierre-contable',   label: 'Cierre Contable',    icon: FileSpreadsheet, group: 'finanzas' },
    stock:       { to: '/stock',             label: 'Stock',              icon: Package,        group: 'operaciones', badge: stockQuiebres, tone: 'red' },
    firmar:      { to: '/stock/firmar',      label: 'Firmar movimiento',  icon: FileSignature,  group: 'operaciones', badge: pendientesFirma, tone: 'amber' },
    flota:       { to: '/flota',             label: 'Flota',              icon: Truck,          group: 'operaciones', badge: flotaAlertCount, tone: 'red' },
    combustible: { to: '/combustible',       label: 'Combustible',        icon: Fuel,           group: 'operaciones' },
    bitacora:    { to: '/bitacora-viajes',   label: 'Bitácora',           icon: RouteIcon,      group: 'operaciones' },
    movDiario:   { to: '/movimiento-diario', label: 'Movimiento Diario',  icon: CalendarClock,  group: 'operaciones' },
    rrhh:        { to: '/rrhh',              label: 'RRHH',               icon: Users,          group: 'personas' },
    presentismo: { to: '/presentismo',       label: 'Presentismo',        icon: UserCheck,      group: 'personas' },
    parte:       { to: '/parte-diario',      label: 'Parte Diario',       icon: ClipboardCheck, group: 'personas' },
    uniformes:   { to: '/uniformes',         label: 'Uniformes',          icon: Shirt,          group: 'personas' },
    siniestros:  { to: '/siniestros',        label: 'Siniestros',         icon: Ambulance,      group: 'personas' },
    config:      { to: '/configuracion',     label: 'Configuración',      icon: Settings,       group: 'sistema' },
    configEmp:   { to: '/configuracion/empresa', label: 'Config. de empresa', icon: Palette,    group: 'sistema' },
    auditoria:   { to: '/auditoria',         label: 'Auditoría',          icon: ClipboardList,  group: 'sistema' },
  } satisfies Record<string, NavItem>;

  const withHome = (items: NavItem[]): NavItem[] =>
    items.map(it => (navPath(it.to) === user.homeRoute ? { ...it, home: true } : it));
  const flat = (items: (NavItem | false)[]): NavModel =>
    ({ items: withHome(items.filter((x): x is NavItem => !!x)), flat: true });

  // ── Menús acotados ─────────────────────────────────────────────────────────
  if (user.rol === 'JORNALERO') {
    return flat([I.rrhh, FEATURES.PARTE_DIARIO && user.empresaId === EMPRESAS.DOS57 && I.parte]);
  }
  if (user.rol === 'PANOLERO') {
    return flat([{ ...I.stock, to: '/stock?tab=panol', badge: undefined }]);
  }

  // Menús acotados por home_route (Módulo de dashboards personalizados) —
  // reemplaza el criterio viejo de matchear por nombre de usuario (regex
  // "andrea"/"loren"/"santi|nico"), frágil ante altas/bajas o cambios de
  // nombre. Ahora es el campo Usuario.home_route, configurable desde
  // Configuración → Usuarios (ver resolveHomeRoute en lib/homeRoute.ts,
  // fuente única para esto y para el redirect post-login).
  switch (user.homeRoute) {
    case '/gastos-operativos':
      return flat([I.gastos, I.rrhh, I.caja, I.calendario]);
    case '/presentismo':
      return flat([I.presentismo, I.siniestros, I.uniformes, { ...I.flota, label: 'Flota y Seguros' }, I.calendario]);
    case '/combustible':
      return flat([I.combustible, I.flota, I.bitacora, I.movDiario, I.calendario]);
    case '/parte-diario':
      return flat([I.parte, FEATURES.STOCK && I.stock, I.calendario]);
  }

  // Operador de Enjoy sin dashboard propio (ej. Daniel): menú acotado a lo que usa
  // — Eventos (con su Ficha, Caja y Comidas adentro de cada evento), Stock y
  // Calendario. Sin Caja Global, Flota, Proveedores, Facturas, etc.
  if (user.rol === 'OPERADOR' && user.empresaId === EMPRESAS.ENJOY && !user.homeRoute) {
    const m = flat([I.eventos, FEATURES.STOCK && I.stock, FEATURES.STOCK && pendientesFirma > 0 && I.firmar, I.calendario]);
    m.items[0] = { ...m.items[0], home: true };
    return m;
  }

  // ── Menú completo, por área ────────────────────────────────────────────────
  const esAdmin       = user.rol === 'ADMIN';
  const adminOOper    = user.rol === 'ADMIN' || user.rol === 'OPERADOR';
  const conLectura    = adminOOper || user.rol === 'VIEWER';
  const dos57         = user.empresaId === EMPRESAS.DOS57;
  // Módulos DOS57 que el admin global ve sea cual sea su empresa activa
  // (Presentismo, Combustible, Bitácora): ADMIN/OPERADOR fijos a DOS57 o
  // admin global — él aprueba tardanzas sin tener DOS57 seleccionado.
  const dos57OGlobal  = (dos57 && adminOOper) || (esAdmin && user.puedeCambiarEmpresa);

  const items: (NavItem | false)[] = [
    // Inicio
    // Macro — vista cross-evento + KPIs globales (admin global) o vista
    // restringida por área cross-empresa (usuarios con puede_ver_macro, ej. Mayra)
    esAdmin && (user.puedeCambiarEmpresa || user.puedeVerMacro) && I.macro,
    I.calendario,
    // Eventos
    I.eventos,
    // Presupuestación (Costo Real, DOS57) — sólo ADMIN con DOS57 activa o admin global
    esAdmin && (dos57 || user.puedeCambiarEmpresa) && I.presupuestos,
    esAdmin && (dos57 || user.puedeCambiarEmpresa) && I.rental,
    esAdmin && I.importer,
    // Finanzas
    conLectura && I.caja,
    // Gastos del mes (Andrea, DOS57) — Caja del mes, siniestros de empleados y excedente de horas
    dos57 && adminOOper && I.gastos,
    esAdmin && I.tarjeta,
    esAdmin && I.espacios,
    esAdmin && I.facturas,
    esAdmin && I.emitidas,
    esAdmin && I.ctacte,
    esAdmin && I.proveedores,
    esAdmin && I.afip,
    esAdmin && I.cierre,
    // Operaciones
    FEATURES.STOCK && conLectura && I.stock,
    FEATURES.STOCK && adminOOper && pendientesFirma > 0 && I.firmar,
    adminOOper && I.flota,
    dos57OGlobal && I.combustible,
    dos57OGlobal && I.bitacora,
    dos57 && adminOOper && I.movDiario,
    // Personas
    esAdmin && I.rrhh,
    dos57OGlobal && I.presentismo,
    FEATURES.PARTE_DIARIO && dos57 && conLectura && I.parte,
    esAdmin && I.uniformes,
    // Siniestros de personal — Lorena tiene su menú acotado y Andrea lo ve embebido en Gastos del mes
    dos57 && adminOOper && I.siniestros,
    // Sistema
    esAdmin && I.config,
    user.puedeCambiarEmpresa && I.configEmp,
    esAdmin && I.auditoria,
  ];
  return { items: withHome(items.filter((x): x is NavItem => !!x)), flat: false };
}

export function groupNav(items: NavItem[]): { id: NavGroupId; label: string; icon: LucideIcon; items: NavItem[]; badge: number }[] {
  return NAV_GROUPS
    .map(g => {
      const gi = items.filter(i => i.group === g.id);
      return { ...g, items: gi, badge: gi.reduce((s, i) => s + (i.badge ?? 0), 0) };
    })
    .filter(g => g.items.length > 0);
}
