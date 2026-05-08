import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import type { Moneda } from '@/types';

export interface TabResumen {
  tab_numero:  number;
  nombre:      string;
  total_debe:  number;
  total_haber: number;
  saldo:       number;
}

export interface PorMoneda {
  moneda:             Moneda;
  ingresos:           TabResumen[];
  egresos:            TabResumen[];
  total_ingresos:     number;
  total_egresos:      number;
  saldo_final:        number;
  distribucion_socios: { nombre: string; porcentaje: number; monto: number }[];
}

export interface CajaCuenta {
  cuenta_id:      number;
  nombre:         string;
  tipo:           string;
  moneda:         Moneda;
  saldo_inicial:  number;
  saldo_actual:   number;
  total_ingresos: number;
  total_egresos:  number;
}

export interface ConciliatoriaData {
  evento: {
    id:          number;
    nombre:      string;
    estado:      string;
    moneda_base: Moneda;
    socios:      { nombre: string; porcentaje: number }[];
  };
  por_moneda:        PorMoneda[];
  caja_por_cuenta:   CajaCuenta[];
  echeqs_pendientes: {
    cantidad:        number;
    total_por_moneda: { moneda: Moneda; total: number }[];
  };
}

export function useConciliatoria(eventoId: number) {
  return useQuery<ConciliatoriaData>({
    queryKey: ['eventos', eventoId, 'conciliatoria'],
    queryFn:  () => api.get(`/eventos/${eventoId}/conciliatoria`).then(r => r.data),
  });
}
