import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ResumenEventos {
  total:     number;
  activos:   number;
  cerrados:  number;
  importados: number;
}

export interface PorMonedaResumen {
  moneda:          string;
  total_ingresos:  number;
  total_egresos:   number;
  saldo_neto:      number;
}

export interface CajaResumen {
  total_cuentas:   number;
  saldo_total_ars: number;
  saldo_total_usd: number;
}

export interface EcheqsResumen {
  pendientes:         number;
  vencidos:           number;
  proximos_a_vencer:  number;
  total_expuesto_ars: number;
  total_expuesto_usd: number;
}

export interface EventoReciente {
  id:          number;
  nombre:      string;
  estado:      string;
  moneda_base: string;
  updated_at:  string;
}

export interface ResumenDashboard {
  eventos:           ResumenEventos;
  por_moneda:        PorMonedaResumen[];
  caja:              CajaResumen;
  echeqs:            EcheqsResumen;
  eventos_recientes: EventoReciente[];
}

export interface TabKPI {
  tab_numero:           number;
  nombre:               string;
  saldo:                number;
  porcentaje_del_total: number;
}

export interface EvolucionPoint {
  fecha:            string;
  saldo_acumulado:  number;
}

export interface PorMonedaKPI {
  moneda:           string;
  ingresos_por_tab: TabKPI[];
  egresos_por_tab:  TabKPI[];
  total_ingresos:   number;
  total_egresos:    number;
  saldo_final:      number;
  evolucion_saldo:  EvolucionPoint[];
}

export interface CuentaKPI {
  nombre:       string;
  saldo_actual: number;
  moneda:       string;
}

export interface KPIsEvento {
  evento: {
    id:          number;
    nombre:      string;
    estado:      string;
    fecha_inicio: string | null;
    fecha_fin:    string | null;
    moneda_base: string;
    socios:      { nombre: string; porcentaje: number }[];
  };
  por_moneda: PorMonedaKPI[];
  caja: {
    saldo_total_ars: number;
    saldo_total_usd: number;
    cuentas:         CuentaKPI[];
  };
  echeqs: {
    pendientes:         number;
    total_expuesto_ars: number;
    total_expuesto_usd: number;
  };
}

export type AlertaTipo      = 'ECHEQ_VENCIDO' | 'ECHEQ_POR_VENCER' | 'EVENTO_SIN_CERRAR' | 'SALDO_NEGATIVO';
export type AlertaSeveridad = 'ERROR' | 'WARNING' | 'INFO';

export interface Alerta {
  tipo:          AlertaTipo;
  severidad:     AlertaSeveridad;
  mensaje:       string;
  evento_id:     number;
  evento_nombre: string;
  metadata:      Record<string, unknown>;
}

export interface AlertasDashboard {
  alertas: Alerta[];
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function useResumenDashboard() {
  return useQuery<ResumenDashboard>({
    queryKey: ['dashboard', 'resumen'],
    queryFn:  () => api.get('/dashboard/resumen').then(r => r.data),
    refetchInterval: 5 * 60 * 1000,
  });
}

export function useKPIsEvento(eventoId: number | null) {
  return useQuery<KPIsEvento>({
    queryKey: ['dashboard', 'kpis', eventoId],
    queryFn:  () => api.get(`/dashboard/evento/${eventoId}/kpis`).then(r => r.data),
    enabled:  eventoId !== null,
  });
}

export function useAlertasDashboard() {
  return useQuery<AlertasDashboard>({
    queryKey:        ['dashboard', 'alertas'],
    queryFn:         () => api.get('/dashboard/alertas').then(r => r.data),
    placeholderData: { alertas: [] },
    refetchInterval: 5 * 60 * 1000,
  });
}
