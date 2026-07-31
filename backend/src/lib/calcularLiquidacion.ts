import type { Empleado, Jornada } from '@prisma/client';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface ResultadoCalculoJornada {
  tipo_calculo:     'LINEAL' | 'JORNADA';
  horas_trabajadas: number;
  horas_normales:   number;
  horas_extras:     number;
  monto_base:       number; // jornal (JORNADA) u horas normales × valor_hora (LINEAL)
  monto_extras:     number; // horas extras × valor correspondiente
  monto_viaje:      number; // viajes × valor_viaje (0 en LINEAL)
  dif_hs_jornal:    number; // diferencia con el umbral aplicado (0 en LINEAL)
  total:            number;
}

// Recupera el total de horas trabajadas de una jornada ya persistida — la suma
// de horas_normales + horas_extras siempre reconstruye el total real sin
// importar qué umbral se haya usado para partirlas al guardar la jornada.
function horasTrabajadasDeJornada(jornada: Jornada): number {
  return round2(Number(jornada.horas_normales) + Number(jornada.horas_extras));
}

function calcularLineal(empleado: Empleado, horasTrabajadas: number): ResultadoCalculoJornada {
  const valorHora      = Number(empleado.valor_hora);
  const valorHoraExtra = Number(empleado.valor_hora_extra);
  const horasNormales  = Math.min(horasTrabajadas, 8);
  const horasExtras    = Math.max(0, round2(horasTrabajadas - 8));
  const montoBase      = round2(horasNormales * valorHora);
  const montoExtras    = round2(horasExtras * valorHoraExtra);

  return {
    tipo_calculo:     'LINEAL',
    horas_trabajadas: horasTrabajadas,
    horas_normales:   horasNormales,
    horas_extras:     horasExtras,
    monto_base:       montoBase,
    monto_extras:     montoExtras,
    monto_viaje:      0,
    dif_hs_jornal:    0,
    total:            round2(montoBase + montoExtras),
  };
}

function calcularPorJornada(empleado: Empleado, jornada: Jornada, horasTrabajadas: number): ResultadoCalculoJornada {
  const umbralJornada         = Number(empleado.umbral_horas_jornada ?? 0);
  const umbralMedia           = Number(empleado.umbral_horas_media ?? 0);
  const valorJornadaCompleta  = Number(empleado.valor_jornada_completa ?? 0);
  const valorMediaJornada     = Number(empleado.valor_media_jornada ?? 0);
  const valorHoraExtraJornada = Number(empleado.valor_hora_extra_jornada ?? 0);
  const valorViaje            = Number(empleado.valor_viaje ?? 0);
  const cantidadViajes        = jornada.cantidad_viajes ?? 0;

  let montoBase = 0;
  let horasExtras = 0;
  let difHsJornal = 0;

  if (horasTrabajadas >= umbralJornada) {
    montoBase   = valorJornadaCompleta;
    horasExtras = round2(horasTrabajadas - umbralJornada);
    difHsJornal = horasExtras;
  } else if (horasTrabajadas >= umbralMedia) {
    montoBase   = valorMediaJornada;
    horasExtras = 0;
    difHsJornal = round2(horasTrabajadas - umbralMedia);
  } else {
    montoBase   = 0;
    horasExtras = 0;
    difHsJornal = round2(horasTrabajadas - umbralMedia);
  }

  const montoExtras   = round2(horasExtras * valorHoraExtraJornada);
  const montoViaje    = round2(cantidadViajes * valorViaje);
  const horasNormales = round2(horasTrabajadas - horasExtras);

  return {
    tipo_calculo:     'JORNADA',
    horas_trabajadas: horasTrabajadas,
    horas_normales:   horasNormales,
    horas_extras:     horasExtras,
    monto_base:       montoBase,
    monto_extras:     montoExtras,
    monto_viaje:      montoViaje,
    dif_hs_jornal:    difHsJornal,
    total:            round2(montoBase + montoExtras + montoViaje),
  };
}

export function calcularMontoJornada(empleado: Empleado, jornada: Jornada): ResultadoCalculoJornada {
  const horasTrabajadas = horasTrabajadasDeJornada(jornada);

  if (empleado.tipo_liquidacion === 'JORNADA') {
    return calcularPorJornada(empleado, jornada, horasTrabajadas);
  }
  return calcularLineal(empleado, horasTrabajadas);
}
