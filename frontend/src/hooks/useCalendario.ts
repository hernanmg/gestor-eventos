import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { CalendarioResponse, TipoCalendario } from '@/types';

// Espejo de TIPO_QUERY_MAP en backend/src/controllers/calendario.controller.ts
export const TIPO_QUERY_MAP: Record<TipoCalendario, string> = {
  EVENTO:               'eventos',
  FACTURA_VENCE:        'facturas',
  ECHEQ_COBRO:          'echeqs',
  JORNADA:              'jornadas',
  PARTE_DIARIO:         'partes',
  STOCK_RETORNO:        'stock',
  LIQUIDACION:          'liquidaciones',
  RENDICION_PENDIENTE:  'rendiciones',
  SALDO_MINIMO:         'saldos_bajos',
  CTA_CORRIENTE_INACTIVA: 'cuentas_corrientes',
  SEGURO_VENCE:         'seguros',
  PATENTE_VENCE:        'patentes_flota',
  TALLER_RETIRO:        'taller',
  CUOTA_AFIP:           'cuotas_afip',
  CUOTA_PRESTAMO:       'cuotas_prestamo',
  FACTURA_EMITIDA_VENCE: 'facturas_emitidas',
};

export const TODOS_LOS_TIPOS: TipoCalendario[] = Object.keys(TIPO_QUERY_MAP) as TipoCalendario[];

function toParams(desde: string, hasta: string, tipos: Set<TipoCalendario>, empresaId?: number | null) {
  const params: Record<string, string> = { desde, hasta };
  if (empresaId != null) params.empresa_id = String(empresaId);
  // Solo mandar ?tipos= cuando el filtro excluye algo — con todos activos,
  // omitir el param es equivalente y evita una query string enorme.
  if (tipos.size > 0 && tipos.size < TODOS_LOS_TIPOS.length) {
    params.tipos = [...tipos].map(t => TIPO_QUERY_MAP[t]).join(',');
  }
  return params;
}

export const calendarioKey = (desde: string, hasta: string, tipos: Set<TipoCalendario>, empresaId?: number | null) =>
  ['calendario', desde, hasta, empresaId ?? null, [...tipos].sort().join(',')];

export function useCalendario(desde: string, hasta: string, tipos: Set<TipoCalendario>, empresaId?: number | null) {
  return useQuery<CalendarioResponse>({
    queryKey:  calendarioKey(desde, hasta, tipos, empresaId),
    queryFn:   () => api.get('/calendario', { params: toParams(desde, hasta, tipos, empresaId) }).then(r => r.data),
    staleTime: 5 * 60 * 1000,
    // tipos.size === 0 ("desactivar todos los filtros") no tiene equivalente
    // en la query string — omitir ?tipos= significa "todos" para el backend,
    // no "ninguno" — así que ni siquiera se dispara el fetch: sin tipos
    // seleccionados, el resultado es vacío por definición.
    enabled:   !!desde && !!hasta && tipos.size > 0,
  });
}

// Precarga el rango del mes siguiente al navegar la vista mensual, para que
// el cambio de mes se sienta instantáneo la mayoría de las veces.
export function usePrefetchCalendario() {
  const qc = useQueryClient();
  return useCallback((desde: string, hasta: string, tipos: Set<TipoCalendario>, empresaId?: number | null) => {
    qc.prefetchQuery({
      queryKey: calendarioKey(desde, hasta, tipos, empresaId),
      queryFn:  () => api.get('/calendario', { params: toParams(desde, hasta, tipos, empresaId) }).then(r => r.data),
      staleTime: 5 * 60 * 1000,
    });
  }, [qc]);
}
