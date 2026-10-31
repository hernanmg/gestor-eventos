import type { Prisma } from '@prisma/client';
import { EstadoMovimiento, Tipo } from '@prisma/client';
import { recalcularSaldosRubro } from './recalcularSaldos';
import { registrarAuditoria } from './auditoria';
import { RUBROS_SISTEMA } from './rubrosConstants';

// ── Puente Ficha → Centro de costos ───────────────────────────────────────────
// Un rubro CONFIRMADO en la Ficha del evento tiene que aparecer como línea de
// costo en Egresos (docs/enjoy/KM - Centro de Costos.xlsx "se nutre" de
// rubro por evento.xlsx). La línea se genera con presupuesto y proveedor de la
// Ficha y debe = 0: el costo real se carga después en Egresos, así que generar
// la línea no mueve saldos ni la conciliatoria.
//
// Reglas (idempotente — se puede llamar en cada escritura de RubroEvento):
// - Sólo rubros EGRESO no técnicos (RRHH/Impuestos/Gastos Extra tienen su
//   propio circuito: liquidaciones, subcategorías, echeqs).
// - CONFIRMADO sin línea generada → se crea, salvo que el rubro ya tenga
//   movimientos cargados a mano en el evento (no duplicar lo que ya existe).
// - CONFIRMADO con línea generada → se sincronizan proveedor/presupuesto/moneda
//   (la Ficha manda) y se reactiva si estaba CANCELADA. Una línea PAGADA no se toca.
// - NO_VA / CANCELADO → se cancela la línea generada sólo si sigue vacía (sin
//   monto real ni pagos parciales). Si ya tiene plata cargada queda como está.
// - PENDIENTE / COTIZANDO → no hace nada.

const CODIGOS_TECNICOS: string[] = Object.values(RUBROS_SISTEMA);

export type ResultadoLineaCosto = 'creada' | 'actualizada' | 'reactivada' | 'cancelada' | null;

export async function sincronizarLineaCosto(
  tx:            Prisma.TransactionClient,
  rubroEventoId: number,
  userId:        number,
): Promise<ResultadoLineaCosto> {
  const re = await tx.rubroEvento.findUnique({
    where:   { id: rubroEventoId },
    include: { rubro: { select: { id: true, nombre: true, tipo: true, codigo: true } } },
  });
  if (!re) return null;
  if (re.rubro.tipo !== 'EGRESO') return null;
  if (re.rubro.codigo && CODIGOS_TECNICOS.includes(re.rubro.codigo)) return null;

  const generadas = await tx.movimiento.findMany({
    where:   { rubro_evento_id: re.id, deleted_at: null },
    include: { pagos_parciales: { where: { deleted_at: null }, select: { id: true } } },
    orderBy: { orden: 'asc' },
  });

  const vigente = re.estado === 'CONFIRMADO' && re.deleted_at === null;

  if (vigente) {
    if (generadas.length === 0) {
      const manuales = await tx.movimiento.count({
        where: { evento_id: re.evento_id, rubro_id: re.rubro_id, deleted_at: null },
      });
      if (manuales > 0) return null;

      const last = await tx.movimiento.findFirst({
        where:   { evento_id: re.evento_id, tipo: Tipo.EGRESO, rubro_id: re.rubro_id, deleted_at: null },
        orderBy: { orden: 'desc' },
        select:  { orden: true },
      });
      const mov = await tx.movimiento.create({
        data: {
          evento_id:         re.evento_id,
          tipo:              Tipo.EGRESO,
          rubro_id:          re.rubro_id,
          rubro_evento_id:   re.id,
          concepto:          re.rubro.nombre,
          proveedor_id:      re.proveedor_id,
          presupuesto:       re.presupuesto,
          moneda:            re.moneda,
          estado_movimiento: EstadoMovimiento.CONFIRMADO,
          debe:              0,
          haber:             0,
          monto_ars:         0,
          orden:             (last?.orden ?? 0) + 1,
          created_by:        userId,
          updated_by:        userId,
        },
      });
      await recalcularSaldosRubro(re.evento_id, Tipo.EGRESO, re.rubro_id, tx);
      await registrarAuditoria({
        usuarioId:   userId,
        empresaId:   re.empresa_id,
        accion:      'CREATE',
        entidad:     'Movimiento',
        entidadId:   mov.id,
        eventoId:    re.evento_id,
        descripcion: `Generó la línea de costo de "${re.rubro.nombre}" desde la Ficha (rubro confirmado)`,
        tx:          tx as any,
      });
      return 'creada';
    }

    // Más de una línea generada no debería pasar (se genera una sola); si
    // alguien las duplicó a mano no se adivina cuál sincronizar.
    if (generadas.length > 1) return null;

    const g = generadas[0];
    if (g.estado_movimiento === EstadoMovimiento.PAGADO) return null;

    const sinMonto = Number(g.debe) === 0 && Number(g.haber) === 0;
    const data: Prisma.MovimientoUpdateInput = {};
    if (re.proveedor_id !== null && re.proveedor_id !== g.proveedor_id) {
      data.proveedor = { connect: { id: re.proveedor_id } };
    }
    if (re.presupuesto !== null && (g.presupuesto === null || !re.presupuesto.equals(g.presupuesto))) {
      data.presupuesto = re.presupuesto;
    }
    if (sinMonto && re.moneda !== g.moneda) data.moneda = re.moneda;
    const reactivar = g.estado_movimiento === EstadoMovimiento.CANCELADO;
    if (reactivar) data.estado_movimiento = EstadoMovimiento.CONFIRMADO;

    if (Object.keys(data).length === 0) return null;
    await tx.movimiento.update({ where: { id: g.id }, data: { ...data, updated_by: userId } });
    return reactivar ? 'reactivada' : 'actualizada';
  }

  if (re.estado === 'NO_VA' || re.estado === 'CANCELADO' || re.deleted_at !== null) {
    const cancelables = generadas.filter(g =>
      g.estado_movimiento !== EstadoMovimiento.PAGADO &&
      g.estado_movimiento !== EstadoMovimiento.CANCELADO &&
      Number(g.debe) === 0 && Number(g.haber) === 0 &&
      g.pagos_parciales.length === 0,
    );
    if (cancelables.length === 0) return null;
    await tx.movimiento.updateMany({
      where: { id: { in: cancelables.map(g => g.id) } },
      data:  { estado_movimiento: EstadoMovimiento.CANCELADO, updated_by: userId },
    });
    return 'cancelada';
  }

  return null;
}
