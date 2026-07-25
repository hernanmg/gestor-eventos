import type { Prisma } from '@prisma/client';
import { Tipo } from '@prisma/client';

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
    select:  { id: true, debe: true, haber: true },
  });

  let saldo = 0;
  for (const m of movs) {
    saldo = parseFloat((saldo + Number(m.debe) - Number(m.haber)).toFixed(2));
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
    select:  { id: true, debe: true, haber: true },
  });

  let saldo = 0;
  for (const m of movs) {
    saldo = parseFloat((saldo + Number(m.debe) - Number(m.haber)).toFixed(2));
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
