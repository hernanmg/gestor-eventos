import type { Request, Response } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { withTenant } from '../lib/tenant';
import { registrarAuditoria } from '../lib/auditoria';
import { normalizarPatente } from '../lib/normalizarPatente';
import { parseFechaCalendario, estadoVencimiento } from '../lib/vencimientos';

// ── Multas (Lorena, DOS57) ───────────────────────────────────────────────────
// Reemplaza su planilla de multas por patente: fecha, lugar, motivo,
// vencimiento, monto, pago, medio de pago y si se le descontó al empleado.
// "Descontar al empleado" crea un Anticipo tipo MULTA no descontado: la
// próxima liquidación lo toma como cualquier vale/descuento (ver
// generarLiquidacionAdmin y rrhh.controller#generarLiquidacion).

class MultaError extends Error {}

const MULTA_INCLUDE = {
  camion:   { select: { id: true, codigo: true, patente: true, descripcion: true } },
  empleado: { select: { id: true, nombre: true, apellido: true, apodo: true } },
  anticipo: { select: { id: true, descontado: true, liquidacion_id: true, liquidacion_admin_id: true } },
} as const;

type MultaConRelaciones = Prisma.MultaGetPayload<{ include: typeof MULTA_INCLUDE }>;

function serializar(m: MultaConRelaciones) {
  return {
    ...m,
    monto: Number(m.monto),
    estado_vencimiento: m.estado === 'PENDIENTE' ? estadoVencimiento(m.fecha_vencimiento) : null,
    descontada: !!m.anticipo?.descontado,
  };
}

const multaSchema = z.object({
  tipo:                   z.enum(['TRANSITO', 'INTERNA']).default('TRANSITO'),
  fecha:                  z.string().min(1),
  camion_id:              z.number().int().positive().nullable().optional(),
  patente_texto:          z.string().nullable().optional(),
  empleado_id:            z.number().int().positive().nullable().optional(),
  empleado_nombre_manual: z.string().nullable().optional(),
  lugar:                  z.string().nullable().optional(),
  motivo:                 z.string().trim().min(1, 'Falta el motivo'),
  numero_acta:            z.string().nullable().optional(),
  fecha_vencimiento:      z.string().nullable().optional(),
  monto:                  z.number().min(0),
  estado:                 z.enum(['PENDIENTE', 'PAGADA', 'ANULADA']).optional(),
  fecha_pago:             z.string().nullable().optional(),
  medio_pago:             z.string().nullable().optional(),
  descontar_empleado:     z.boolean().optional(),
  observaciones:          z.string().nullable().optional(),
});

function fechasMulta(d: { fecha?: string; fecha_vencimiento?: string | null; fecha_pago?: string | null }) {
  const fecha = d.fecha !== undefined ? parseFechaCalendario(d.fecha) : undefined;
  const vto   = d.fecha_vencimiento !== undefined ? parseFechaCalendario(d.fecha_vencimiento) : undefined;
  const pago  = d.fecha_pago !== undefined ? parseFechaCalendario(d.fecha_pago) : undefined;
  if (d.fecha !== undefined && !fecha) throw new MultaError('Fecha de la multa inválida');
  if (d.fecha_vencimiento && !vto) throw new MultaError('Vencimiento inválido');
  if (d.fecha_pago && !pago) throw new MultaError('Fecha de pago inválida');
  return { fecha, vto, pago };
}

async function validarRelaciones(empresaId: number, d: { camion_id?: number | null; empleado_id?: number | null }) {
  if (d.camion_id) {
    const c = await prisma.camion.findFirst({ where: { id: d.camion_id, empresa_id: empresaId, deleted_at: null }, select: { id: true } });
    if (!c) throw new MultaError('Vehículo no encontrado');
  }
  if (d.empleado_id) {
    const e = await prisma.empleado.findFirst({ where: { id: d.empleado_id, empresa_id: empresaId, deleted_at: null }, select: { id: true } });
    if (!e) throw new MultaError('Empleado no encontrado');
  }
}

function motivoAnticipo(m: { tipo: string; motivo: string; fecha: Date; camion?: { codigo: string } | null; patente_texto: string | null }) {
  const vehiculo = m.camion?.codigo ?? m.patente_texto;
  return `Multa ${m.tipo === 'INTERNA' ? 'interna' : 'de tránsito'}: ${m.motivo}${vehiculo ? ` (${vehiculo})` : ''} — ${m.fecha.toLocaleDateString('es-AR', { timeZone: 'UTC' })}`;
}

// Deja el Anticipo MULTA en línea con la multa: lo crea si corresponde
// descontar, lo actualiza si cambió, lo borra si ya no se descuenta. Un
// anticipo ya aplicado en una liquidación no se toca: cambiar monto/empleado o
// dejar de descontarlo da error.
async function sincronizarAnticipo(tx: Prisma.TransactionClient, multaId: number, usuarioId: number) {
  const m = await tx.multa.findUniqueOrThrow({ where: { id: multaId }, include: { anticipo: true, camion: { select: { codigo: true } } } });
  const corresponde = m.descontar_empleado && !!m.empleado_id && m.estado !== 'ANULADA' && m.deleted_at === null;
  const a = m.anticipo;

  if (a?.descontado) {
    const cambio = !corresponde || a.empleado_id !== m.empleado_id || Number(a.monto) !== Number(m.monto);
    if (cambio) throw new MultaError('Esta multa ya se descontó en una liquidación: no se puede cambiar el monto, el empleado ni dejar de descontarla.');
    return;
  }

  if (corresponde && !a) {
    const nuevo = await tx.anticipo.create({
      data: {
        empresa_id: m.empresa_id, empleado_id: m.empleado_id!, tipo: 'MULTA',
        monto: m.monto, fecha: m.fecha, motivo: motivoAnticipo(m), created_by: usuarioId,
      },
    });
    await tx.multa.update({ where: { id: multaId }, data: { anticipo_id: nuevo.id } });
  } else if (corresponde && a) {
    await tx.anticipo.update({
      where: { id: a.id },
      data:  { empleado_id: m.empleado_id!, monto: m.monto, fecha: m.fecha, motivo: motivoAnticipo(m) },
    });
  } else if (!corresponde && a) {
    await tx.multa.update({ where: { id: multaId }, data: { anticipo_id: null } });
    await tx.anticipo.delete({ where: { id: a.id } });
  }
}

function manejarError(res: Response, err: unknown): boolean {
  if (err instanceof MultaError) { res.status(400).json({ error: err.message }); return true; }
  return false;
}

// ── Listado / resumen ─────────────────────────────────────────────────────────

const listQuerySchema = z.object({
  desde:       z.string().optional(),
  hasta:       z.string().optional(),
  tipo:        z.enum(['TRANSITO', 'INTERNA']).optional(),
  estado:      z.enum(['PENDIENTE', 'PAGADA', 'ANULADA']).optional(),
  camion_id:   z.coerce.number().int().positive().optional(),
  empleado_id: z.coerce.number().int().positive().optional(),
});

function whereMultas(req: Request): Prisma.MultaWhereInput | null {
  const q = listQuerySchema.safeParse(req.query);
  if (!q.success) return null;
  const desde = parseFechaCalendario(q.data.desde);
  const hasta = parseFechaCalendario(q.data.hasta);
  if (desde === undefined || hasta === undefined) return null;
  return {
    deleted_at: null, ...withTenant(req.empresaId!),
    ...((desde || hasta) && { fecha: { ...(desde && { gte: desde }), ...(hasta && { lte: hasta }) } }),
    ...(q.data.tipo && { tipo: q.data.tipo }),
    ...(q.data.estado && { estado: q.data.estado }),
    ...(q.data.camion_id && { camion_id: q.data.camion_id }),
    ...(q.data.empleado_id && { empleado_id: q.data.empleado_id }),
  };
}

// GET /api/multas
export async function listMultas(req: Request, res: Response) {
  const where = whereMultas(req);
  if (!where) { res.status(400).json({ error: 'Parámetros inválidos' }); return; }
  const multas = await prisma.multa.findMany({ where, include: MULTA_INCLUDE, orderBy: [{ fecha: 'desc' }, { id: 'desc' }] });
  res.json(multas.map(serializar));
}

// GET /api/multas/resumen — el informe que Lorena le pasa a Mati: por
// empleado y por vehículo (sin anuladas).
export async function resumenMultas(req: Request, res: Response) {
  const where = whereMultas(req);
  if (!where) { res.status(400).json({ error: 'Parámetros inválidos' }); return; }
  const multas = await prisma.multa.findMany({ where: { ...where, estado: { not: 'ANULADA' } }, include: MULTA_INCLUDE });

  const porEmpleado = new Map<string, { empleado_id: number | null; nombre: string; cantidad: number; monto_total: number; monto_descontado: number; pendientes_pago: number }>();
  const porVehiculo = new Map<string, { camion_id: number | null; vehiculo: string; cantidad: number; monto_total: number; pendientes_pago: number }>();

  for (const m of multas) {
    const monto = Number(m.monto);
    const kE = m.empleado ? `e${m.empleado.id}` : `n${m.empleado_nombre_manual ?? '—'}`;
    const e = porEmpleado.get(kE) ?? {
      empleado_id: m.empleado?.id ?? null,
      nombre: m.empleado ? `${m.empleado.apellido}, ${m.empleado.nombre}` : (m.empleado_nombre_manual ?? 'Sin empleado'),
      cantidad: 0, monto_total: 0, monto_descontado: 0, pendientes_pago: 0,
    };
    e.cantidad++; e.monto_total += monto;
    if (m.descontar_empleado && m.empleado_id) e.monto_descontado += monto;
    if (m.estado === 'PENDIENTE') e.pendientes_pago++;
    porEmpleado.set(kE, e);

    if (m.camion || m.patente_texto) {
      const kV = m.camion ? `c${m.camion.id}` : `p${normalizarPatente(m.patente_texto)}`;
      const v = porVehiculo.get(kV) ?? {
        camion_id: m.camion?.id ?? null,
        vehiculo: m.camion ? `${m.camion.codigo}${m.camion.descripcion ? ` — ${m.camion.descripcion}` : ''}` : (m.patente_texto ?? ''),
        cantidad: 0, monto_total: 0, pendientes_pago: 0,
      };
      v.cantidad++; v.monto_total += monto;
      if (m.estado === 'PENDIENTE') v.pendientes_pago++;
      porVehiculo.set(kV, v);
    }
  }

  const orden = <T extends { monto_total: number }>(xs: T[]) => xs.sort((a, b) => b.monto_total - a.monto_total);
  res.json({
    por_empleado: orden([...porEmpleado.values()]),
    por_vehiculo: orden([...porVehiculo.values()]),
    total: { cantidad: multas.length, monto: multas.reduce((s, m) => s + Number(m.monto), 0) },
  });
}

// GET /api/multas/opciones — selects del formulario (listado propio: /rrhh
// es sólo ADMIN y Lorena es OPERADOR)
export async function opcionesMultas(req: Request, res: Response) {
  const [vehiculos, empleados] = await Promise.all([
    prisma.camion.findMany({ where: { deleted_at: null, ...withTenant(req.empresaId!) }, select: { id: true, codigo: true, patente: true, descripcion: true }, orderBy: { codigo: 'asc' } }),
    prisma.empleado.findMany({ where: { deleted_at: null, estado: 'ACTIVO', ...withTenant(req.empresaId!) }, select: { id: true, nombre: true, apellido: true, apodo: true }, orderBy: { apellido: 'asc' } }),
  ]);
  res.json({ vehiculos, empleados });
}

// ── ABM ───────────────────────────────────────────────────────────────────────

// POST /api/multas
export async function createMulta(req: Request, res: Response) {
  const parsed = multaSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return; }
  const d = parsed.data;
  try {
    const { fecha, vto, pago } = fechasMulta(d);
    await validarRelaciones(req.empresaId!, d);
    if (d.descontar_empleado && !d.empleado_id) throw new MultaError('Para descontarla elegí el empleado');

    const multa = await prisma.$transaction(async tx => {
      const creada = await tx.multa.create({
        data: {
          ...withTenant(req.empresaId!),
          tipo: d.tipo, fecha: fecha!, motivo: d.motivo, monto: d.monto,
          camion_id: d.camion_id ?? null,
          patente_texto: d.camion_id ? null : (normalizarPatente(d.patente_texto) || null),
          empleado_id: d.empleado_id ?? null,
          empleado_nombre_manual: d.empleado_id ? null : (d.empleado_nombre_manual?.trim() || null),
          lugar: d.lugar ?? null, numero_acta: d.numero_acta ?? null,
          fecha_vencimiento: vto ?? null,
          estado: d.estado ?? (pago ? 'PAGADA' : 'PENDIENTE'),
          fecha_pago: pago ?? null, medio_pago: d.medio_pago ?? null,
          descontar_empleado: d.descontar_empleado ?? false,
          observaciones: d.observaciones ?? null,
          created_by: req.user!.id,
        },
      });
      await sincronizarAnticipo(tx, creada.id, req.user!.id);
      return tx.multa.findUniqueOrThrow({ where: { id: creada.id }, include: MULTA_INCLUDE });
    });

    await registrarAuditoria({
      usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'CREATE', entidad: 'Multa', entidadId: multa.id,
      descripcion: `Cargó multa ${multa.tipo === 'INTERNA' ? 'interna' : 'de tránsito'} "${multa.motivo}" por $${Number(multa.monto).toLocaleString('es-AR')}${multa.descontar_empleado ? ' (se descuenta al empleado)' : ''}`,
      ip: req.ip, tx: prisma,
    });
    res.status(201).json(serializar(multa));
  } catch (err) {
    if (!manejarError(res, err)) throw err;
  }
}

// PUT /api/multas/:id
export async function updateMulta(req: Request, res: Response) {
  const id = Number(req.params.id);
  const parsed = multaSchema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return; }
  const d = parsed.data;

  const existing = await prisma.multa.findFirst({ where: { id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!existing) { res.status(404).json({ error: 'Multa no encontrada' }); return; }

  try {
    const { fecha, vto, pago } = fechasMulta(d);
    await validarRelaciones(req.empresaId!, d);
    const empleadoFinal = d.empleado_id !== undefined ? d.empleado_id : existing.empleado_id;
    const descontarFinal = d.descontar_empleado ?? existing.descontar_empleado;
    if (descontarFinal && !empleadoFinal) throw new MultaError('Para descontarla elegí el empleado');

    const multa = await prisma.$transaction(async tx => {
      await tx.multa.update({
        where: { id },
        data: {
          ...(d.tipo !== undefined && { tipo: d.tipo }),
          ...(fecha && { fecha }),
          ...(d.motivo !== undefined && { motivo: d.motivo }),
          ...(d.monto !== undefined && { monto: d.monto }),
          ...(d.camion_id !== undefined && { camion_id: d.camion_id, ...(d.camion_id && { patente_texto: null }) }),
          ...(d.patente_texto !== undefined && !(d.camion_id ?? existing.camion_id) && { patente_texto: normalizarPatente(d.patente_texto) || null }),
          ...(d.empleado_id !== undefined && { empleado_id: d.empleado_id, ...(d.empleado_id && { empleado_nombre_manual: null }) }),
          ...(d.empleado_nombre_manual !== undefined && !empleadoFinal && { empleado_nombre_manual: d.empleado_nombre_manual?.trim() || null }),
          ...(d.lugar !== undefined && { lugar: d.lugar }),
          ...(d.numero_acta !== undefined && { numero_acta: d.numero_acta }),
          ...(vto !== undefined && { fecha_vencimiento: vto }),
          ...(pago !== undefined && { fecha_pago: pago }),
          ...(d.medio_pago !== undefined && { medio_pago: d.medio_pago }),
          // Cargar la fecha de pago la da por pagada si no se mandó el estado
          ...(d.estado !== undefined ? { estado: d.estado } : pago ? { estado: 'PAGADA' as const } : {}),
          ...(d.descontar_empleado !== undefined && { descontar_empleado: d.descontar_empleado }),
          ...(d.observaciones !== undefined && { observaciones: d.observaciones }),
        },
      });
      await sincronizarAnticipo(tx, id, req.user!.id);
      return tx.multa.findUniqueOrThrow({ where: { id }, include: MULTA_INCLUDE });
    });

    await registrarAuditoria({
      usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'UPDATE', entidad: 'Multa', entidadId: id,
      descripcion: `Editó la multa "${multa.motivo}"`, datosDespues: d, ip: req.ip, tx: prisma,
    });
    res.json(serializar(multa));
  } catch (err) {
    if (!manejarError(res, err)) throw err;
  }
}

// DELETE /api/multas/:id — soft delete; borra el Anticipo si todavía no se descontó
export async function deleteMulta(req: Request, res: Response) {
  const id = Number(req.params.id);
  const existing = await prisma.multa.findFirst({ where: { id, deleted_at: null, ...withTenant(req.empresaId!) }, include: { anticipo: true } });
  if (!existing) { res.status(404).json({ error: 'Multa no encontrada' }); return; }
  if (existing.anticipo?.descontado) {
    res.status(400).json({ error: 'Esta multa ya se descontó en una liquidación: no se puede eliminar. Si no correspondía, anulala.' }); return;
  }

  await prisma.$transaction(async tx => {
    await tx.multa.update({ where: { id }, data: { deleted_at: new Date(), anticipo_id: null } });
    if (existing.anticipo) await tx.anticipo.delete({ where: { id: existing.anticipo.id } });
  });

  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'DELETE', entidad: 'Multa', entidadId: id,
    descripcion: `Eliminó la multa "${existing.motivo}"`, ip: req.ip, tx: prisma,
  });
  res.json({ message: 'Multa eliminada' });
}
