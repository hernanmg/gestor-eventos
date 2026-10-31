// "Falta pagar" de una línea de egreso (centro de costos).
// Base = monto real (debe/haber — ver convención en movimientos.controller) y,
// mientras no haya real cargado, el presupuesto: así una línea recién generada
// desde la Ficha ya muestra cuánto falta pagarle al proveedor y admite señas.
// PAGADO / CANCELADO → no falta nada, aunque los pagos parciales no sumen el total
// (PAGADO puede marcarse a mano sin registrar cada pago).

type MovPagos = {
  estado_movimiento: string;
  debe:              unknown;
  haber:             unknown;
  presupuesto:       unknown;
  pagos_parciales?:  { monto: unknown }[];
};

const r2 = (n: number) => parseFloat(n.toFixed(2));

export function calcFaltaPagar(m: MovPagos) {
  const real        = Number(m.debe) + Number(m.haber);
  const sobrePresup = real === 0 && m.presupuesto !== null && m.presupuesto !== undefined;
  const base        = real > 0 ? real : sobrePresup ? Number(m.presupuesto) : 0;
  const pagado      = (m.pagos_parciales ?? []).reduce((a, p) => a + Number(p.monto), 0);
  const cerrado     = m.estado_movimiento === 'PAGADO' || m.estado_movimiento === 'CANCELADO';
  return {
    total_pagado:            r2(pagado),
    falta_pagar:             cerrado ? 0 : r2(Math.max(base - pagado, 0)),
    falta_pagar_sobre_presupuesto: !cerrado && sobrePresup,
  };
}
