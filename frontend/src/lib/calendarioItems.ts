import type { CalendarioItem, TipoCalendario } from '@/types';

// Rótulos, colores y links de cada tipo de ítem del calendario — compartido
// por la página Calendario y la agenda "Próximos 7 días" de Macro.

// ── Constantes ────────────────────────────────────────────────────────────────
// Espejo de COLORES/TIPO_QUERY_MAP en backend/src/controllers/calendario.controller.ts

export const TIPO_LABEL: Record<TipoCalendario, string> = {
  EVENTO:               'Eventos',
  FACTURA_VENCE:        'Facturas',
  ECHEQ_COBRO:          'Echeqs',
  JORNADA:              'Jornadas',
  PARTE_DIARIO:         'Partes',
  STOCK_RETORNO:        'Stock',
  LIQUIDACION:          'Liquidaciones',
  RENDICION_PENDIENTE:  'Rendiciones',
  SALDO_MINIMO:         'Saldo bajo',
  CTA_CORRIENTE_INACTIVA: 'Cuentas corrientes',
  SEGURO_VENCE:         'Seguros',
  PATENTE_VENCE:        'Patentes',
  TALLER_RETIRO:        'Taller',
  CUOTA_AFIP:           'Cuotas AFIP',
  CUOTA_PRESTAMO:       'Cuotas créditos',
  FACTURA_EMITIDA_VENCE: 'Facturas a Cobrar',
  ACTIVO_STOCK_BAJO:    'Quiebre de stock uniformes',
  SINIESTRO_VEHICULO_PENDIENTE: 'Siniestros vehículos',
};

export const COLORES: Record<TipoCalendario, string> = {
  EVENTO:               '#1E3A5F',
  FACTURA_VENCE:        '#DC2626',
  ECHEQ_COBRO:          '#F59E0B',
  JORNADA:              '#065F46',
  PARTE_DIARIO:         '#4C1D95',
  STOCK_RETORNO:        '#92400E',
  LIQUIDACION:          '#374151',
  RENDICION_PENDIENTE:  '#7C3AED',
  SALDO_MINIMO:         '#DC2626',
  CTA_CORRIENTE_INACTIVA: '#F59E0B',
  SEGURO_VENCE:         '#F59E0B',
  PATENTE_VENCE:        '#F59E0B',
  TALLER_RETIRO:        '#4C1D95',
  CUOTA_AFIP:           '#DC2626',
  CUOTA_PRESTAMO:       '#92400E',
  FACTURA_EMITIDA_VENCE: '#065F46',
  ACTIVO_STOCK_BAJO:    '#DC2626',
  SINIESTRO_VEHICULO_PENDIENTE: '#B91C1C',
};

// ── Links de navegación por tipo ──────────────────────────────────────────────

export function getDetailLink(item: CalendarioItem): string {
  const m = item.metadata as Record<string, unknown>;
  switch (item.tipo) {
    case 'EVENTO':        return `/eventos/${item.id.replace('evento-', '')}`;
    case 'FACTURA_VENCE':  return `/facturas/${item.id.replace('factura-', '')}`;
    case 'ECHEQ_COBRO':    return m.evento_id ? `/eventos/${m.evento_id}?tab=echeqs` : '/eventos';
    // Los items JORNADA del calendario son siempre pendientes de aprobación
    // (ver resolveJornadas() en calendario.controller.ts) — se filtra directo.
    case 'JORNADA':        return `/rrhh?tab=jornadas&fecha=${item.fecha.slice(0, 10)}&estado=PENDIENTE`;
    case 'PARTE_DIARIO':   return `/parte-diario?fecha=${item.fecha.slice(0, 10)}`;
    case 'STOCK_RETORNO':  return m.evento_id ? `/eventos/${m.evento_id}?tab=stock` : '/eventos';
    case 'LIQUIDACION':    return '/rrhh?tab=liquidaciones';
    case 'RENDICION_PENDIENTE': return `/caja/${m.cuenta_id}`;
    case 'SALDO_MINIMO':        return `/caja/${m.cuenta_id}`;
    case 'CTA_CORRIENTE_INACTIVA': return `/cuentas-corrientes/${m.cuenta_id}`;
    case 'SEGURO_VENCE':   return `/flota?tab=vehiculos&vehiculo=${m.camion_id}`;
    case 'PATENTE_VENCE':  return `/flota?tab=patentes&vehiculo=${m.camion_id}`;
    case 'TALLER_RETIRO':  return '/flota?tab=taller';
    case 'CUOTA_AFIP':     return '/afip-prestamos?tab=afip';
    case 'CUOTA_PRESTAMO': return '/afip-prestamos?tab=prestamos';
    case 'FACTURA_EMITIDA_VENCE': return `/facturas-emitidas?abrir=${m.factura_id}`;
    case 'SINIESTRO_VEHICULO_PENDIENTE': return '/flota?tab=siniestros';
    default:               return '/calendario';
  }
}

export function metadataResumen(item: CalendarioItem): string[] {
  const m = item.metadata as Record<string, any>;
  switch (item.tipo) {
    case 'FACTURA_VENCE':  return [`Pendiente: $${Number(m.importe_pendiente).toLocaleString('es-AR')}`];
    case 'ECHEQ_COBRO':    return [`Importe: ${m.moneda} ${Number(m.importe).toLocaleString('es-AR')}`];
    case 'JORNADA':        return m.cantidad ? [`${m.cantidad} jornada${m.cantidad !== 1 ? 's' : ''}`] : (m.convocatoria ? [`Convocatoria: ${m.convocatoria}`] : []);
    case 'STOCK_RETORNO':  return [`Evento: ${m.evento_nombre}`, `Ubicación: ${m.ubicacion}`];
    case 'LIQUIDACION':    return [`Total a cobrar: $${Number(m.total_a_cobrar).toLocaleString('es-AR')}`];
    case 'EVENTO':         return [`Estado: ${m.estado}`];
    case 'RENDICION_PENDIENTE': return [`Responsable: ${m.responsable ?? '—'}`, `${m.dias_transcurridos} día${m.dias_transcurridos !== 1 ? 's' : ''} pendiente`];
    case 'SALDO_MINIMO':        return [`Saldo actual: $${Number(m.saldo_actual).toLocaleString('es-AR')}`, `Mínimo: $${Number(m.saldo_minimo).toLocaleString('es-AR')}`];
    case 'CTA_CORRIENTE_INACTIVA': return [`Saldo: ${m.moneda} ${Number(m.saldo_actual).toLocaleString('es-AR')}`, `${m.dias_sin_actividad} días sin actividad`];
    case 'SEGURO_VENCE':   return [`Estado: ${m.estado}`];
    case 'PATENTE_VENCE':  return [];
    case 'TALLER_RETIRO':  return m.taller_nombre ? [`Taller: ${m.taller_nombre}`] : [];
    case 'CUOTA_AFIP':     return [`Importe: $${Number(m.total_cuota).toLocaleString('es-AR')}`];
    case 'CUOTA_PRESTAMO': return [`Importe: $${Number(m.total_cuota).toLocaleString('es-AR')}`];
    case 'FACTURA_EMITIDA_VENCE': return [`Saldo pendiente: ${m.moneda} ${Number(m.saldo_pendiente).toLocaleString('es-AR')}`];
    case 'SINIESTRO_VEHICULO_PENDIENTE': return [`N° ${m.numero_siniestro ?? '—'}`, `${m.dias_sin_actividad} días sin actualizar`];
    default:               return [];
  }
}
