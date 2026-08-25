import type { Prisma } from '@prisma/client';
import { TipoMovCCC } from '@prisma/client';

// DEBE suma, HABER resta, AJUSTE aplica su propio signo — ver comentario del
// enum TipoMovCCC en schema.prisma para la convención completa.
// DEBE = lo que el tercero nos debe / cargo → aumenta el saldo.
// HABER = lo que les pagamos / abono → reduce el saldo.
// Saldo positivo = el tercero nos debe · saldo negativo = nosotros les debemos.
function delta(tipo: TipoMovCCC, monto: number): number {
  if (tipo === TipoMovCCC.DEBE)  return monto;
  if (tipo === TipoMovCCC.HABER) return -monto;
  return monto; // AJUSTE — el monto ya viene con signo propio
}

// Recorre los movimientos activos de la cuenta en orden cronológico, persiste
// el saldo acumulado en cada fila (mismo criterio que recalcularSaldos para
// Movimiento) y deja CuentaCorriente.saldo_actual en el último valor.
// Recompute completo en vez de incremental (+=) para no arrastrar drift ante
// ediciones/bajas — mismo criterio que recalcularFactura.
export async function recalcularSaldoCCC(
  cuentaCorrienteId: number,
  tx: Prisma.TransactionClient,
): Promise<void> {
  const movs = await tx.movimientoCCC.findMany({
    where:   { cuenta_ccc_id: cuentaCorrienteId, deleted_at: null },
    orderBy: [{ fecha: 'asc' }, { id: 'asc' }],
    select:  { id: true, tipo: true, monto: true },
  });

  let saldo = 0;
  for (const m of movs) {
    saldo = parseFloat((saldo + delta(m.tipo, Number(m.monto))).toFixed(2));
    await tx.movimientoCCC.update({ where: { id: m.id }, data: { saldo } });
  }

  await tx.cuentaCorriente.update({
    where: { id: cuentaCorrienteId },
    data:  { saldo_actual: saldo },
  });
}
