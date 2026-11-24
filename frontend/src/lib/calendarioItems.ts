import type { CalendarioItem, TipoCalendario } from '@/types';

// Rótulos, colores y links de cada tipo de ítem del calendario — compartido
// por la página Calendario y la agenda "Próximos 7 días" de Macro.

// ── Constantes ────────────────────────────────────────────────────────────────
// Espejo de COLORES/TIPO_QUERY_MAP en backend/src/controllers/calendario.controller.ts

export const TIPO_LABEL: Record<TipoCalendario, string> = {
  EVENTO:               'Eventos',
  MONTAJE:              'Montaje / desmontaje',
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
  SGR_VENCE:            'SGR',
  GASTO_ESPACIO_VENCE:  'Gastos de espacios',
  EXCEDENTE_PENDIENTE:  'Excedente de horas',
  SINIESTRO_PENDIENTE:  'Siniestros personal',
  ACTIVO_STOCK_BAJO:    'Quiebre de stock uniformes',
  SINIESTRO_VEHICULO_PENDIENTE: 'Siniestros vehículos',
  TECNICA_VENCE:        'RTO / ITV',
  CARNET_VENCE:         'Carnets',
  MULTA_VENCE:          'Multas',
  CONTROL_SALIDA:       'Control de salida',
  NOVEDAD:              'Novedades',
  CUMPLEANOS:           'Cumpleaños',
  SEGURO_PERSONAL_VENCE: 'Seguro del personal',
  PAGO_FIJO:            'Pagos fijos',
  CHEQUE_RECIBIDO:      'Cheques recibidos',
};

export const COLORES: Record<TipoCalendario, string> = {
  EVENTO:               '#1E3A5F',
  MONTAJE:              '#5B7BA6',
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
  SGR_VENCE:            '#F59E0B',
  GASTO_ESPACIO_VENCE:  '#3730A3',
  EXCEDENTE_PENDIENTE:  '#F59E0B',
  SINIESTRO_PENDIENTE:  '#DC2626',
  ACTIVO_STOCK_BAJO:    '#DC2626',
  SINIESTRO_VEHICULO_PENDIENTE: '#B91C1C',
  TECNICA_VENCE:        '#F59E0B',
  CARNET_VENCE:         '#F59E0B',
  MULTA_VENCE:          '#F59E0B',
  CONTROL_SALIDA:       '#0E7490',
  NOVEDAD:              '#BE123C',
  CUMPLEANOS:           '#DB2777',
  SEGURO_PERSONAL_VENCE: '#F59E0B',
  PAGO_FIJO:            '#0F766E',
  CHEQUE_RECIBIDO:      '#15803D',
};

// ── Links de navegación por tipo ──────────────────────────────────────────────

export function getDetailLink(item: CalendarioItem): string {
  const m = item.metadata as Record<string, unknown>;
  switch (item.tipo) {
    case 'EVENTO':        return `/eventos/${item.id.replace('evento-', '')}`;
    case 'FACTURA_VENCE':  return `/facturas/${item.id.replace('factura-', '')}`;
    case 'ECHEQ_COBRO':    return m.evento_id ? `/eventos/${m.evento_id}?tab=echeqs` : `/cheques?viernes=${item.fecha.slice(0, 10)}`;
    // Los items JORNADA del calendario son siempre pendientes de aprobación
    // (ver resolveJornadas() en calendario.controller.ts) — se filtra directo.
    case 'JORNADA':        return `/rrhh?tab=jornadas&fecha=${item.fecha.slice(0, 10)}&estado=PENDIENTE`;
    case 'PARTE_DIARIO':   return `/parte-diario?fecha=${item.fecha.slice(0, 10)}`;
    case 'STOCK_RETORNO':  return m.evento_id ? `/eventos/${m.evento_id}?tab=stock` : '/eventos';
    case 'LIQUIDACION':    return m.fecha_pago ? `/rrhh?tab=liquidaciones&fecha_pago=${m.fecha_pago}` : '/rrhh?tab=liquidaciones';
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
    case 'TECNICA_VENCE':  return `/flota?tab=vehiculos&vehiculo=${m.camion_id}`;
    case 'CARNET_VENCE':   return '/flota?tab=carnets';
    case 'MULTA_VENCE':    return '/flota?tab=multas';
    case 'CONTROL_SALIDA': return '/flota?tab=salidas';
    case 'NOVEDAD':        return `/novedades?abrir=${m.novedad_id}`;
    case 'MONTAJE':        return `/eventos/${m.evento_id}`;
    case 'SGR_VENCE':      return '/afip-prestamos?tab=sgr';
    case 'GASTO_ESPACIO_VENCE': return `/espacios-compartidos/${m.espacio_id}`;
    case 'EXCEDENTE_PENDIENTE': return '/gastos-operativos?tab=excedente-horas';
    case 'SINIESTRO_PENDIENTE': return `/siniestros/${m.siniestro_id}`;
    case 'CUMPLEANOS':     return '/rrhh?tab=empleados';
    case 'SEGURO_PERSONAL_VENCE': return '/seguros-personal';
    case 'PAGO_FIJO':      return `/pagos-fijos?periodo=${m.periodo}`;
    case 'CHEQUE_RECIBIDO': return '/cheques?tab=recibidos';
    default:               return '/calendario';
  }
}

export function metadataResumen(item: CalendarioItem): string[] {
  const m = item.metadata as Record<string, any>;
  switch (item.tipo) {
    case 'FACTURA_VENCE':  return [`Pendiente: $${Number(m.importe_pendiente).toLocaleString('es-AR')}`];
    case 'ECHEQ_COBRO':    return [`Importe: ${m.moneda} ${Number(m.importe).toLocaleString('es-AR')}`, ...(m.banco ? [`Banco: ${m.banco}`] : []), ...(m.tipo && m.tipo !== 'PAGO' ? [m.tipo === 'FINANCIAMIENTO_AVALADO' ? 'Financiamiento avalado' : 'Financiamiento propio'] : [])];
    case 'JORNADA':        return m.cantidad ? [`${m.cantidad} jornada${m.cantidad !== 1 ? 's' : ''}`] : (m.convocatoria ? [`Convocatoria: ${m.convocatoria}`] : []);
    case 'STOCK_RETORNO':  return [`Evento: ${m.evento_nombre}`, `Ubicación: ${m.ubicacion}`];
    case 'LIQUIDACION': {
      const e = (m.estados ?? {}) as Record<string, number>;
      const partes = [e.BORRADOR && `${e.BORRADOR} en borrador`, e.PRE_APROBADA && `${e.PRE_APROBADA} pre-aprobada(s)`, e.APROBADA && `${e.APROBADA} aprobada(s)`].filter(Boolean) as string[];
      return [`Total a pagar: $${Number(m.total_a_cobrar).toLocaleString('es-AR')}`, ...(partes.length ? [partes.join(' · ')] : [])];
    }
    case 'EVENTO':         return [`Estado: ${m.estado}`];
    case 'RENDICION_PENDIENTE': return [`Responsable: ${m.responsable ?? '—'}`, `${m.dias_transcurridos} día${m.dias_transcurridos !== 1 ? 's' : ''} pendiente`];
    case 'SALDO_MINIMO':        return [`Saldo actual: $${Number(m.saldo_actual).toLocaleString('es-AR')}`, `Mínimo: $${Number(m.saldo_minimo).toLocaleString('es-AR')}`];
    case 'CTA_CORRIENTE_INACTIVA': return [`Saldo: ${m.moneda} ${Number(m.saldo_actual).toLocaleString('es-AR')}`, `${m.dias_sin_actividad} días sin actividad`];
    case 'SEGURO_VENCE':   return [`Estado: ${m.estado}`];
    case 'SEGURO_PERSONAL_VENCE': return [`${m.cubiertos} persona${m.cubiertos === 1 ? '' : 's'} anotada${m.cubiertos === 1 ? '' : 's'}`];
    case 'PATENTE_VENCE':  return [];
    case 'PAGO_FIJO':      return [m.grupo, ...(m.medio_pago ? [m.medio_pago] : [])];
    case 'CHEQUE_RECIBIDO': return [`N° ${m.numero}`, m.estado === 'EN_CARTERA' ? 'En cartera: depositarlo o ponerlo en custodia' : m.estado === 'EN_CUSTODIA' ? 'En custodia' : 'Depositado'];
    case 'TALLER_RETIRO':  return m.taller_nombre ? [`Taller: ${m.taller_nombre}`] : [];
    case 'CUOTA_AFIP':     return [`Importe: $${Number(m.total_cuota).toLocaleString('es-AR')}`];
    case 'CUOTA_PRESTAMO': return [`Importe: $${Number(m.total_cuota).toLocaleString('es-AR')}`];
    case 'FACTURA_EMITIDA_VENCE': return [`Saldo pendiente: ${m.moneda} ${Number(m.saldo_pendiente).toLocaleString('es-AR')}`];
    case 'SINIESTRO_VEHICULO_PENDIENTE': return [`N° ${m.numero_siniestro ?? '—'}`, `${m.dias_sin_actividad} días sin actualizar`];
    case 'MULTA_VENCE':    return [`Monto: ${Number(m.monto).toLocaleString('es-AR')}`];
    case 'MONTAJE':        return [m.fase === 'MONTAJE' ? 'Armado previo al evento' : 'Desarme posterior al evento', ...(m.lugar ? [`Lugar: ${m.lugar}`] : [])];
    case 'SGR_VENCE':      return m.estado_vinculacion ? [`Vinculación: ${String(m.estado_vinculacion).toLowerCase()}`] : [];
    case 'GASTO_ESPACIO_VENCE': return [`Monto: $${Number(m.monto).toLocaleString('es-AR')}`];
    case 'EXCEDENTE_PENDIENTE': return [`Período: ${m.periodo_mes}/${m.periodo_anio}`, `Total: $${Number(m.monto_total).toLocaleString('es-AR')}`];
    case 'SINIESTRO_PENDIENTE': return [`Estado: ${String(m.estado).toLowerCase().replace('_', ' ')}`, `${m.dias_sin_actividad} días sin novedad`];
    case 'CUMPLEANOS':     return m.edad ? [`Cumple ${m.edad}`] : [];
    case 'NOVEDAD':        return [`Gravedad: ${String(m.gravedad).toLowerCase().replace('critica', 'crítica')}`, m.estado === 'RESUELTA' ? 'Resuelta' : m.estado === 'EN_CURSO' ? 'En curso' : 'Abierta', ...(m.evento_nombre ? [`Evento: ${m.evento_nombre}`] : [])];
    default:               return [];
  }
}
