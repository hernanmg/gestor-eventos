import type { AcuerdoSueldo, EmpleadoEmpresaSplit } from '@prisma/client';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Tabla de antigüedad fija (extraída del Excel real de DOS57) — monto según
// años completos cumplidos desde AcuerdoSueldo.fecha_inicio. No se persiste
// en el acuerdo: se recalcula siempre al liquidar, para que un empleado con
// más antigüedad cobre el escalón correcto sin tener que tocar su acuerdo.
const TABLA_ANTIGUEDAD = [
  { anios: 1, monto: 14637.5 },
  { anios: 2, monto: 23420 },
  { anios: 3, monto: 32202.5 },
  { anios: 4, monto: 40985 },
  { anios: 5, monto: 49767.5 },
  { anios: 6, monto: 74651.25 },
  { anios: 7, monto: 149302.5 },
  { anios: 8, monto: 234200 },
] as const;

function diferenciaEnAnios(desde: Date, hasta: Date): number {
  let anios = hasta.getUTCFullYear() - desde.getUTCFullYear();
  const aunNoLlegoAlAniversario =
    hasta.getUTCMonth() < desde.getUTCMonth() ||
    (hasta.getUTCMonth() === desde.getUTCMonth() && hasta.getUTCDate() < desde.getUTCDate());
  if (aunNoLlegoAlAniversario) anios--;
  return Math.max(0, anios);
}

export function calcularAntiguedad(fechaInicio: Date, fechaReferencia: Date = new Date()): { anios: number; monto: number } {
  const anios   = diferenciaEnAnios(fechaInicio, fechaReferencia);
  // Último escalón cuyo umbral no supera los años del empleado — a partir del
  // año 8 se mantiene en el tope de la tabla (234200), no sigue creciendo.
  const entrada = [...TABLA_ANTIGUEDAD].reverse().find(t => t.anios <= anios);
  return { anios, monto: entrada?.monto ?? 0 };
}

export interface ResultadoSueldoAdmin {
  sueldo_basico:        number; // con aumento aplicado, si corresponde — ver aumentoPorcentaje
  horas_extras:         number;
  importe_horas_extras: number;
  premio_incentivo:     number;
  viatico:              number;
  premio_presentismo:   number;
  // true cuando horas_trabajadas < horas_acordadas_mes — perdió el
  // presentismo (premio_presentismo ya viene en 0 en ese caso). El frontend
  // lo usa para mostrar el aviso "No alcanzó las horas acordadas". Para
  // CHOFER siempre es false — el presentismo no depende de horas.
  presentismo_perdido:  boolean;
  antiguedad_anios:     number;
  importe_antiguedad:   number;
  telefono:             number;
  subtotal_bruto:       number;
  total_a_cobrar:       number;
}

export function calcularSueldoAdmin(
  acuerdo:              Pick<AcuerdoSueldo, 'sueldo_basico' | 'horas_acordadas_mes' | 'premio_incentivo' | 'viatico' | 'premio_presentismo' | 'valor_hora_extra' | 'telefono' | 'fecha_inicio' | 'categoria_acuerdo'>,
  horasTrabajadas:      number,
  valesDescuentos:      number = 0,
  vacacionesAguinaldo:  number = 0,
  fechaReferencia:      Date = new Date(),
  // Choferes con bitácora de viajes: el viático efectivo del período viene de
  // BitacoraViaje (suma de cantidad_vueltas × valor_por_vuelta), no del monto
  // fijo del acuerdo — ver calcularResumenBitacora() en
  // bitacoraViajes.controller.ts.
  viaticoOverride?:     number,
  // % de aumento sobre el básico (manual o IPC) aplicado en esta liquidación
  // — ver LiquidacionAdmin.porcentaje_aumento_aplicado.
  aumentoPorcentaje?:   number,
): ResultadoSueldoAdmin {
  const esChofer = acuerdo.categoria_acuerdo === 'CHOFER';

  const sueldoBasico = aumentoPorcentaje
    ? round2(Number(acuerdo.sueldo_basico) * (1 + aumentoPorcentaje / 100))
    : Number(acuerdo.sueldo_basico);

  // El sueldo básico, viático, teléfono, antigüedad e incentivo son fijos —
  // no se tocan por horas. Sólo el Premio Presentismo depende de haber
  // llegado al mínimo acordado (regla del Excel de Mayra), y las horas
  // extras sólo existen si se superó ese mínimo.
  //
  // CHOFER: no usa horas acordadas ni extras para el cálculo — las horas se
  // registran para control/banco de horas (ver LiquidacionAdmin.horas_pendientes_*)
  // pero no impactan el monto, y el presentismo nunca se pierde por horas.
  const cumpleHoras         = esChofer ? true : horasTrabajadas >= acuerdo.horas_acordadas_mes;
  const horasExtras         = esChofer ? 0 : (cumpleHoras ? round2(horasTrabajadas - acuerdo.horas_acordadas_mes) : 0);
  const importeHorasExtras  = esChofer ? 0 : round2(horasExtras * Number(acuerdo.valor_hora_extra ?? 0));
  const premioPresentismo   = cumpleHoras ? Number(acuerdo.premio_presentismo ?? 0) : 0;
  const antiguedad          = calcularAntiguedad(acuerdo.fecha_inicio, fechaReferencia);
  const viatico             = viaticoOverride ?? Number(acuerdo.viatico ?? 0);

  const subtotalBruto = round2(
    sueldoBasico
    + Number(acuerdo.premio_incentivo ?? 0)
    + viatico
    + premioPresentismo
    + antiguedad.monto
    + Number(acuerdo.telefono ?? 0)
    + importeHorasExtras
    + vacacionesAguinaldo,
  );
  const totalACobrar = round2(subtotalBruto - valesDescuentos);

  return {
    sueldo_basico:         sueldoBasico,
    horas_extras:         horasExtras,
    importe_horas_extras: importeHorasExtras,
    premio_incentivo:     Number(acuerdo.premio_incentivo ?? 0),
    viatico,
    premio_presentismo:   premioPresentismo,
    presentismo_perdido:  !cumpleHoras,
    antiguedad_anios:     antiguedad.anios,
    importe_antiguedad:   antiguedad.monto,
    telefono:             Number(acuerdo.telefono ?? 0),
    subtotal_bruto:       subtotalBruto,
    total_a_cobrar:       totalACobrar,
  };
}

export interface SplitCalculado {
  empresa_id:     number;
  empresa_nombre: string;
  porcentaje:     number;
  monto:          number;
}

// Aplica los porcentajes de EmpleadoEmpresaSplit al total y devuelve el
// desglose por empresa — el último split se ajusta con el resto para que la
// suma de montos sea exactamente `total` (evita drift por redondeo).
export function calcularSplits(
  total:  number,
  splits: { empresa_id: number; porcentaje: number | EmpleadoEmpresaSplit['porcentaje']; empresa_nombre: string }[],
): SplitCalculado[] {
  if (splits.length === 0) return [];

  const resultado: SplitCalculado[] = [];
  let acumulado = 0;

  splits.forEach((s, i) => {
    const esUltimo = i === splits.length - 1;
    const monto    = esUltimo ? round2(total - acumulado) : round2(total * Number(s.porcentaje) / 100);
    acumulado += monto;
    resultado.push({
      empresa_id:     s.empresa_id,
      empresa_nombre: s.empresa_nombre,
      porcentaje:     Number(s.porcentaje),
      monto,
    });
  });

  return resultado;
}
