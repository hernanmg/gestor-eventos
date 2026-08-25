import type { Prisma } from '@prisma/client';
import { Tipo } from '@prisma/client';

// debe/haber en su equivalente ARS — usa monto_ars (precomputado al
// crear/editar el movimiento, ver convertirARS.ts) cuando está disponible;
// si no (moneda ARS, o moneda extranjera sin tasa_cambio todavía), cae al
// valor crudo de debe/haber. Necesario para que el saldo corrido de un rubro
// tenga sentido aunque mezcle movimientos en distinta moneda.
function debeHaberArs(m: { debe: unknown; haber: unknown; moneda: string; monto_ars: unknown }): { debeArs: number; haberArs: number } {
  const debe  = Number(m.debe);
  const haber = Number(m.haber);
  if (m.moneda === 'ARS' || m.monto_ars === null || m.monto_ars === undefined) {
    return { debeArs: debe, haberArs: haber };
  }
  const montoArs = Number(m.monto_ars);
  return { debeArs: debe > 0 ? montoArs : 0, haberArs: haber > 0 ? montoArs : 0 };
}

// Legado — agrupa por tab_numero. Usado por movimientos generados fuera del
// modelo de rubros configurables (Facturas, aún ligadas a TabConfig).
export async function recalcularSaldos(
  eventoId:  number,
  tipo:      Tipo,
  tabNumero: number,
  tx:        Prisma.TransactionClient,
): Promise<void> {
  const movs = await tx.movimiento.findMany({
    where:   { evento_id: eventoId, tipo, tab_numero: tabNumero, deleted_at: null },
    orderBy: { orden: 'asc' },
    select:  { id: true, debe: true, haber: true, moneda: true, monto_ars: true },
  });

  let saldo = 0;
  for (const m of movs) {
    const { debeArs, haberArs } = debeHaberArs(m);
    saldo = parseFloat((saldo + debeArs - haberArs).toFixed(2));
    await tx.movimiento.update({ where: { id: m.id }, data: { saldo } });
  }
}

// Modelo de rubros configurables — agrupa el saldo corrido por rubro_id
// (análogo a recalcularSaldos, pero con la categoría configurable en lugar
// de la tab fija).
export async function recalcularSaldosRubro(
  eventoId: number,
  tipo:     Tipo,
  rubroId:  number,
  tx:       Prisma.TransactionClient,
): Promise<void> {
  const movs = await tx.movimiento.findMany({
    where:   { evento_id: eventoId, tipo, rubro_id: rubroId, deleted_at: null },
    orderBy: { orden: 'asc' },
    select:  { id: true, debe: true, haber: true, moneda: true, monto_ars: true },
  });

  let saldo = 0;
  for (const m of movs) {
    const { debeArs, haberArs } = debeHaberArs(m);
    saldo = parseFloat((saldo + debeArs - haberArs).toFixed(2));
    await tx.movimiento.update({ where: { id: m.id }, data: { saldo } });
  }
}

export async function recalcularSaldosCaja(
  cuentaId: number,
  tx:       Prisma.TransactionClient,
): Promise<void> {
  const cuenta = await tx.cuentaBancaria.findUnique({
    where:  { id: cuentaId },
    select: { saldo_inicial: true },
  });

  const movs = await tx.movimientoCaja.findMany({
    where:   { cuenta_id: cuentaId, deleted_at: null },
    orderBy: { orden: 'asc' },
    select:  { id: true, debe: true, haber: true },
  });

  let saldo = Number(cuenta?.saldo_inicial ?? 0);
  for (const m of movs) {
    saldo = parseFloat((saldo + Number(m.debe) - Number(m.haber)).toFixed(2));
    await tx.movimientoCaja.update({ where: { id: m.id }, data: { saldo_corriente: saldo } });
  }
}
