import type { Prisma } from '@prisma/client';
import { EstadoMovimiento, Tipo, TipoRubro } from '@prisma/client';
import { recalcularSaldosRubro } from './recalcularSaldos';
import { registrarAuditoria } from './auditoria';
import { convertirARS } from './convertirARS';
import { RUBROS_SISTEMA } from './rubrosConstants';

// ── Extras del centro de costos → costo del evento ────────────────────────────
// Un Extra (ExtraEvento) lo paga normalmente el cliente directo y no suma al
// costo del evento. Si se marca a nuestro cargo (a_cargo_cliente=false) tiene que
// verse como costo en todos lados (resumen, conciliatoria, macro), así que se
// mantiene una línea de egreso en el rubro Gastos Extra (EG-EXTRA) espejo del
// Extra. La línea la maneja sólo esta función: movimientos.controller rechaza
// editarla o borrarla a mano.
//
// Reglas (idempotente — se llama en cada alta/edición/baja del Extra):
// - A nuestro cargo y vigente → crea la línea, o la actualiza (concepto,
//   proveedor en descripción, total, IVA, moneda, plazo).
// - A cargo del cliente o borrado → la línea se da de baja (soft delete) y se
//   desvincula.
// - La línea queda CONFIRMADO: el "pagado" del Extra es un dato de seguimiento de
//   la planilla y no pasa la línea a PAGADO (irreversible). Por lo mismo la línea
//   no admite pagos parciales (addPagoParcial la rechaza).

async function rubroGastosExtra(tx: Prisma.TransactionClient, empresaId: number): Promise<number | null> {
  const r = await tx.rubro.findFirst({
    where:  { empresa_id: empresaId, tipo: TipoRubro.EGRESO, codigo: RUBROS_SISTEMA.GASTOS_EXTRA, deleted_at: null },
    select: { id: true },
  });
  return r?.id ?? null;
}

export type ResultadoExtra = 'creada' | 'actualizada' | 'quitada' | null;

export async function sincronizarMovimientoExtra(
  tx:      Prisma.TransactionClient,
  extraId: number,
  userId:  number,
): Promise<ResultadoExtra> {
  const ex = await tx.extraEvento.findUnique({
    where:   { id: extraId },
    include: { movimiento: true },
  });
  if (!ex) return null;

  const mov = ex.movimiento && ex.movimiento.deleted_at === null ? ex.movimiento : null;
  const cuentaComoCosto = !ex.a_cargo_cliente && ex.deleted_at === null;

  if (cuentaComoCosto) {
    const total     = parseFloat((Number(ex.neto) + Number(ex.iva)).toFixed(2));
    const iva       = Number(ex.iva) > 0 ? Number(ex.iva) : null;
    const montoArs  = convertirARS(total, ex.moneda, mov?.tasa_cambio != null ? Number(mov.tasa_cambio) : null);
    const datos = {
      concepto:    ex.descripcion,
      descripcion: ex.responsable,
      debe:        total,
      iva,
      moneda:      ex.moneda,
      monto_ars:   montoArs,
      plazo_pago:  ex.plazo_pago,
    };

    if (mov) {
      await tx.movimiento.update({
        where: { id: mov.id },
        data:  {
          ...datos,
          ...(mov.estado_movimiento === EstadoMovimiento.CANCELADO && { estado_movimiento: EstadoMovimiento.CONFIRMADO }),
          updated_by: userId,
        },
      });
      await recalcularSaldosRubro(ex.evento_id, Tipo.EGRESO, mov.rubro_id!, tx);
      return 'actualizada';
    }

    const rubroId = await rubroGastosExtra(tx, ex.empresa_id);
    if (rubroId === null) throw new Error('La empresa no tiene el rubro Gastos Extraordinarios (EG-EXTRA)');
    const last = await tx.movimiento.findFirst({
      where:   { evento_id: ex.evento_id, tipo: Tipo.EGRESO, rubro_id: rubroId, deleted_at: null },
      orderBy: { orden: 'desc' },
      select:  { orden: true },
    });
    const creado = await tx.movimiento.create({
      data: {
        ...datos,
        evento_id:         ex.evento_id,
        tipo:              Tipo.EGRESO,
        rubro_id:          rubroId,
        haber:             0,
        estado_movimiento: EstadoMovimiento.CONFIRMADO,
        orden:             (last?.orden ?? 0) + 1,
        created_by:        userId,
        updated_by:        userId,
      },
    });
    await tx.extraEvento.update({ where: { id: ex.id }, data: { movimiento_id: creado.id } });
    await recalcularSaldosRubro(ex.evento_id, Tipo.EGRESO, rubroId, tx);
    await registrarAuditoria({
      usuarioId:   userId,
      empresaId:   ex.empresa_id,
      accion:      'CREATE',
      entidad:     'Movimiento',
      entidadId:   creado.id,
      eventoId:    ex.evento_id,
      descripcion: `Generó la línea de Gastos Extra del extra "${ex.descripcion}" (a cargo de la empresa)`,
      tx:          tx as any,
    });
    return 'creada';
  }

  if (!mov) return null;
  await tx.movimiento.update({ where: { id: mov.id }, data: { deleted_at: new Date(), updated_by: userId } });
  await tx.extraEvento.update({ where: { id: ex.id }, data: { movimiento_id: null } });
  await recalcularSaldosRubro(ex.evento_id, Tipo.EGRESO, mov.rubro_id!, tx);
  return 'quitada';
}
