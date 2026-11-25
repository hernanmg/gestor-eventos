import { Prisma, EstadoCargaCombustible, TipoCombustible } from '@prisma/client';
import { prisma } from './prisma';
import { registrarAuditoria } from './auditoria';

// Combustible pagado de una caja (Logística 12): el gasto se anota en la caja
// (Caja Global, Caja del mes de Andrea, cajas chicas) y desde ahí se lo ata a
// un vehículo y, si corresponde, a un evento. Eso crea una CargaCombustible
// ligada al movimiento: aparece en Combustible por vehículo y en la logística
// y el costo real del evento. El monto y la fecha siempre siguen al movimiento.

type Tx = Prisma.TransactionClient;

export class ErrorCombustibleCaja extends Error {}

export interface DatosCombustibleCaja {
  camion_id:         number | null;      // null = quitar el vínculo
  litros?:           number | null;
  evento_id?:        number | null;
  tipo_combustible?: TipoCombustible;
}

const diaUTC = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

export async function vincularCombustibleCaja(movId: number, datos: DatosCombustibleCaja, empresaId: number, usuarioId: number) {
  const mov = await prisma.movimientoCaja.findFirst({
    where:   { id: movId, deleted_at: null, cuenta: { empresa_id: empresaId } },
    include: { cuenta: { select: { nombre: true, empresa_id: true } }, carga_combustible: true },
  });
  if (!mov) throw new ErrorCombustibleCaja('Movimiento de caja no encontrado');
  const monto = Number(mov.haber);
  const previa = mov.carga_combustible;

  if (datos.camion_id == null) {
    if (previa && !previa.deleted_at) {
      await prisma.cargaCombustible.update({ where: { id: previa.id }, data: { deleted_at: new Date() } });
      await registrarAuditoria({ usuarioId, empresaId, accion: 'DELETE', entidad: 'CargaCombustible', entidadId: previa.id, descripcion: `Quitó el vehículo del gasto de caja #${movId}`, tx: prisma as any });
    }
    return null;
  }

  if (!(monto > 0)) throw new ErrorCombustibleCaja('Sólo un gasto (haber) se puede atar a un vehículo');
  const camion = await prisma.camion.findFirst({ where: { id: datos.camion_id, deleted_at: null, empresa_id: empresaId } });
  if (!camion) throw new ErrorCombustibleCaja('Vehículo no encontrado');
  if (datos.evento_id) {
    const ev = await prisma.evento.findFirst({ where: { id: datos.evento_id, deleted_at: null, empresa_id: empresaId } });
    if (!ev) throw new ErrorCombustibleCaja('Evento no encontrado');
  }
  if (datos.litros != null && !(datos.litros > 0)) throw new ErrorCombustibleCaja('Los litros tienen que ser mayores a cero');

  const litros = datos.litros ?? null;
  const data = {
    empresa_id:         empresaId,
    camion_id:          camion.id,
    fecha:              diaUTC(mov.fecha ?? mov.created_at),
    tipo_combustible:   datos.tipo_combustible ?? previa?.tipo_combustible ?? TipoCombustible.DIESEL,
    litros,
    precio_por_litro:   litros ? Math.round((monto / litros) * 100) / 100 : null,
    monto_total:        monto,
    evento_id:          datos.evento_id ?? null,
    cuenta_corriente_id: null,
    responsable_nombre: mov.responsable_nombre,
    numero_comprobante: mov.referencia,
    // Ya está pagado: no pasa por la autorización de las cargas extra.
    estado:             EstadoCargaCombustible.AUTORIZADA,
    autorizado_por:     usuarioId,
    autorizado_at:      new Date(),
    notas:              `Pagado de la caja ${mov.cuenta.nombre}${mov.descripcion ? ` — ${mov.descripcion}` : ''}`,
    deleted_at:         null,
  };
  // Si había una carga (aunque se haya quitado antes) se reusa: movimiento_caja_id es único.
  const carga = previa
    ? await prisma.cargaCombustible.update({ where: { id: previa.id }, data })
    : await prisma.cargaCombustible.create({ data: { ...data, movimiento_caja_id: movId, created_by: usuarioId } });
  await registrarAuditoria({
    usuarioId, empresaId, accion: previa ? 'UPDATE' : 'CREATE', entidad: 'CargaCombustible', entidadId: carga.id,
    descripcion: `Ató el gasto de caja #${movId} al vehículo ${camion.codigo}${litros ? ` (${litros} L)` : ''}`, tx: prisma as any,
  });
  return carga;
}

// Al editar o borrar el movimiento de caja: la carga sigue el monto y la
// fecha, o se borra con él. Si deja de ser un gasto, también se borra.
export async function sincronizarCargaDeCaja(tx: Tx, movId: number) {
  const mov = await tx.movimientoCaja.findUnique({ where: { id: movId }, include: { carga_combustible: true } });
  const carga = mov?.carga_combustible;
  if (!mov || !carga || carga.deleted_at) return;
  const monto = Number(mov.haber);
  if (mov.deleted_at || !(monto > 0)) {
    await tx.cargaCombustible.update({ where: { id: carga.id }, data: { deleted_at: new Date() } });
    return;
  }
  const litros = carga.litros != null ? Number(carga.litros) : null;
  await tx.cargaCombustible.update({
    where: { id: carga.id },
    data:  {
      monto_total:        monto,
      fecha:              diaUTC(mov.fecha ?? mov.created_at),
      precio_por_litro:   litros ? Math.round((monto / litros) * 100) / 100 : null,
      responsable_nombre: mov.responsable_nombre,
      numero_comprobante: mov.referencia,
    },
  });
}
