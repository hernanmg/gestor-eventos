import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { registrarAuditoria } from '../lib/auditoria';
import { withTenant } from '../lib/tenant';
import type { Prisma, TipoPanolItem, EstadoPanolItem, TipoMovPanol } from '@prisma/client';

// ── Schemas ───────────────────────────────────────────────────────────────────

const panolItemCreateSchema = z.object({
  nombre:      z.string().min(1),
  descripcion: z.string().nullable().optional(),
  tipo:        z.enum(['HERRAMIENTA', 'CONSUMIBLE']),
  stock_total: z.number().int().min(0),
  valor:       z.number().nonnegative().nullable().optional(),
  estado:      z.enum(['DISPONIBLE', 'FUERA_DE_SERVICIO', 'BAJA']).optional(),
  notas:       z.string().nullable().optional(),
});

const panolItemUpdateSchema = panolItemCreateSchema.partial();

const movimientoCreateSchema = z.object({
  panol_item_id:      z.number().int().positive(),
  tipo:               z.enum(['SALIDA', 'USO_INTERNO']),
  cantidad:            z.number().int().positive(),
  evento_id:           z.number().int().positive().nullable().optional(),
  responsable_id:      z.number().int().positive().nullable().optional(),
  responsable_nombre:  z.string().nullable().optional(),
  fecha:               z.string(),
  descripcion:         z.string().nullable().optional(),
});

const devolucionSchema = z.object({
  cantidad_devuelta: z.number().int().min(0),
  motivo_faltante:   z.string().nullable().optional(),
});

function toDate(s: string): Date { return new Date(s); }

// ── Items ─────────────────────────────────────────────────────────────────────

export async function listPanolItems(req: Request, res: Response) {
  const tipo   = typeof req.query.tipo   === 'string' ? req.query.tipo   as TipoPanolItem   : undefined;
  const estado = typeof req.query.estado === 'string' ? req.query.estado as EstadoPanolItem : undefined;

  const where: Prisma.PanolItemWhereInput = { deleted_at: null, ...withTenant(req.empresaId!) };
  if (tipo)   where.tipo   = tipo;
  if (estado) where.estado = estado;

  const items = await prisma.panolItem.findMany({ where, orderBy: { nombre: 'asc' } });
  res.json(items);
}

export async function getPanolItem(req: Request, res: Response) {
  const id = Number(req.params.id);
  const item = await prisma.panolItem.findFirst({
    where:   { id, deleted_at: null, ...withTenant(req.empresaId!) },
    include: {
      movimientos: {
        include: { evento: { select: { id: true, nombre: true, estado: true } } },
        orderBy: { fecha: 'desc' },
      },
    },
  });
  if (!item) { res.status(404).json({ error: 'Ítem de pañol no encontrado' }); return; }
  res.json(item);
}

export async function createPanolItem(req: Request, res: Response) {
  const parsed = panolItemCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return;
  }
  const { nombre, descripcion, tipo, stock_total, valor, estado, notas } = parsed.data;

  const item = await prisma.panolItem.create({
    data: {
      ...withTenant(req.empresaId!),
      nombre, descripcion: descripcion ?? null, tipo, stock_total,
      stock_disponible: stock_total, valor: valor ?? null, estado: estado ?? 'DISPONIBLE',
      notas: notas ?? null, created_by: req.user!.id,
    },
  });

  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'CREATE', entidad: 'PanolItem', entidadId: item.id,
    descripcion: `Creó ítem de pañol "${nombre}"`, datosDespues: { nombre, tipo, stock_total }, ip: req.ip, tx: prisma,
  });

  res.status(201).json(item);
}

export async function updatePanolItem(req: Request, res: Response) {
  const id     = Number(req.params.id);
  const parsed = panolItemUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return;
  }

  const existing = await prisma.panolItem.findFirst({ where: { id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!existing) { res.status(404).json({ error: 'Ítem de pañol no encontrado' }); return; }

  const { nombre, descripcion, tipo, stock_total, valor, estado, notas } = parsed.data;

  // Si cambia stock_total, ajustar stock_disponible por la misma diferencia
  let stock_disponible: number | undefined;
  if (stock_total !== undefined && stock_total !== existing.stock_total) {
    const diff = stock_total - existing.stock_total;
    stock_disponible = existing.stock_disponible + diff;
    if (stock_disponible < 0) { res.status(400).json({ error: 'El nuevo stock total es menor al comprometido actualmente' }); return; }
  }

  const item = await prisma.panolItem.update({
    where: { id },
    data: {
      ...(nombre           !== undefined && { nombre }),
      ...(descripcion      !== undefined && { descripcion }),
      ...(tipo             !== undefined && { tipo }),
      ...(stock_total      !== undefined && { stock_total }),
      ...(stock_disponible !== undefined && { stock_disponible }),
      ...(valor            !== undefined && { valor }),
      ...(estado           !== undefined && { estado }),
      ...(notas            !== undefined && { notas }),
    },
  });

  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'UPDATE', entidad: 'PanolItem', entidadId: id,
    descripcion: `Actualizó ítem de pañol "${existing.nombre}"`, datosAntes: { nombre: existing.nombre }, datosDespues: parsed.data,
    ip: req.ip, tx: prisma,
  });

  res.json(item);
}

export async function deletePanolItem(req: Request, res: Response) {
  const id = Number(req.params.id);

  const existing = await prisma.panolItem.findFirst({ where: { id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!existing) { res.status(404).json({ error: 'Ítem de pañol no encontrado' }); return; }

  if (existing.stock_disponible !== existing.stock_total) {
    res.status(400).json({ error: 'No se puede eliminar: hay unidades en campo sin devolver' }); return;
  }

  await prisma.panolItem.update({ where: { id }, data: { deleted_at: new Date() } });

  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'DELETE', entidad: 'PanolItem', entidadId: id,
    descripcion: `Eliminó ítem de pañol "${existing.nombre}"`, datosAntes: { nombre: existing.nombre }, ip: req.ip, tx: prisma,
  });

  res.json({ message: 'Ítem de pañol eliminado correctamente' });
}

// ── Movimientos ───────────────────────────────────────────────────────────────

export async function listMovimientosPanol(req: Request, res: Response) {
  const eventoId = req.query.evento_id ? Number(req.query.evento_id) : undefined;
  const tipo      = typeof req.query.tipo  === 'string' ? req.query.tipo as TipoMovPanol : undefined;
  const desde     = typeof req.query.desde === 'string' ? req.query.desde : undefined;
  const hasta     = typeof req.query.hasta === 'string' ? req.query.hasta : undefined;

  const where: Prisma.MovimientoPanolWhereInput = { ...withTenant(req.empresaId!) };
  if (eventoId) where.evento_id = eventoId;
  if (tipo)     where.tipo      = tipo;
  if (desde || hasta) {
    where.fecha = {
      ...(desde && { gte: toDate(desde) }),
      ...(hasta && { lte: toDate(hasta) }),
    };
  }

  const movimientos = await prisma.movimientoPanol.findMany({
    where,
    include: {
      panol_item: { select: { id: true, nombre: true, tipo: true } },
      evento:     { select: { id: true, nombre: true, estado: true } },
    },
    orderBy: { fecha: 'desc' },
  });

  res.json(movimientos);
}

export async function createMovimientoPanol(req: Request, res: Response) {
  const parsed = movimientoCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return;
  }
  const { panol_item_id, tipo, cantidad, evento_id, responsable_id, responsable_nombre, fecha, descripcion } = parsed.data;

  const item = await prisma.panolItem.findFirst({ where: { id: panol_item_id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!item) { res.status(404).json({ error: 'Ítem de pañol no encontrado' }); return; }

  if (evento_id) {
    const evento = await prisma.evento.findFirst({ where: { id: evento_id, deleted_at: null, ...withTenant(req.empresaId!) } });
    if (!evento) { res.status(400).json({ error: 'Evento no encontrado' }); return; }
  }

  if (cantidad > item.stock_disponible) {
    res.status(400).json({ error: 'Stock insuficiente en pañol' }); return;
  }

  const movimiento = await prisma.$transaction(async tx => {
    await tx.panolItem.update({
      where: { id: panol_item_id },
      data:  { stock_disponible: { decrement: cantidad } },
    });

    const m = await tx.movimientoPanol.create({
      data: {
        ...withTenant(req.empresaId!),
        panol_item_id, tipo, cantidad,
        evento_id: evento_id ?? null,
        responsable_id: responsable_id ?? null,
        responsable_nombre: responsable_nombre ?? null,
        fecha: toDate(fecha),
        descripcion: descripcion ?? null,
        created_by: req.user!.id,
      },
    });

    await registrarAuditoria({
      usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'CREATE', entidad: 'MovimientoPanol', entidadId: m.id,
      eventoId: evento_id ?? undefined,
      descripcion: `Registró ${tipo === 'SALIDA' ? 'salida' : 'uso interno'} de "${item.nombre}" × ${cantidad}`,
      datosDespues: { panol_item_id, tipo, cantidad }, ip: req.ip, tx: tx as any,
    });

    return m;
  });

  res.status(201).json(movimiento);
}

export async function devolverMovimientoPanol(req: Request, res: Response) {
  const id     = Number(req.params.id);
  const parsed = devolucionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return;
  }
  const { cantidad_devuelta, motivo_faltante } = parsed.data;

  const existing = await prisma.movimientoPanol.findFirst({
    where:   { id, ...withTenant(req.empresaId!) },
    include: { panol_item: true },
  });
  if (!existing) { res.status(404).json({ error: 'Movimiento no encontrado' }); return; }
  if (existing.tipo !== 'SALIDA' && existing.tipo !== 'USO_INTERNO') {
    res.status(400).json({ error: 'Solo se puede registrar devolución de una salida o uso interno' }); return;
  }
  if (existing.devolucion_at) { res.status(400).json({ error: 'Este movimiento ya tiene una devolución registrada' }); return; }
  if (cantidad_devuelta > existing.cantidad) {
    res.status(400).json({ error: `La cantidad devuelta (${cantidad_devuelta}) supera la cantidad de salida (${existing.cantidad})` }); return;
  }

  const cantidad_faltante = existing.cantidad - cantidad_devuelta;
  if (cantidad_faltante > 0 && !motivo_faltante) {
    res.status(400).json({ error: 'Se requiere el motivo del faltante' }); return;
  }

  const movimiento = await prisma.$transaction(async tx => {
    await tx.panolItem.update({
      where: { id: existing.panol_item_id },
      data:  { stock_disponible: { increment: cantidad_devuelta } },
    });

    const m = await tx.movimientoPanol.update({
      where: { id },
      data: {
        cantidad_devuelta,
        cantidad_faltante,
        motivo_faltante: cantidad_faltante > 0 ? motivo_faltante : null,
        devolucion_at:   new Date(),
      },
    });

    await registrarAuditoria({
      usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'DEVOLUCION', entidad: 'MovimientoPanol', entidadId: id,
      descripcion: `Registró devolución de "${existing.panol_item.nombre}" — ${cantidad_devuelta}/${existing.cantidad}`
        + (cantidad_faltante > 0 ? ` (faltante: ${cantidad_faltante})` : ''),
      ip: req.ip, tx: tx as any,
    });

    return m;
  });

  res.json(movimiento);
}

// ── Alertas ───────────────────────────────────────────────────────────────────

export async function getAlertasPanol(req: Request, res: Response) {
  const pendientes = await prisma.movimientoPanol.findMany({
    where: {
      ...withTenant(req.empresaId!),
      tipo:          { in: ['SALIDA', 'USO_INTERNO'] },
      evento_id:     { not: null },
      devolucion_at: null,
      evento:        { estado: 'CERRADO' },
    },
    include: {
      panol_item: { select: { id: true, nombre: true, tipo: true } },
      evento:     { select: { id: true, nombre: true, estado: true, fecha_fin: true } },
    },
    orderBy: { fecha: 'asc' },
  });

  const now = new Date();
  const alertas = pendientes.map(m => ({
    movimiento_id:      m.id,
    panol_item_id:      m.panol_item_id,
    panol_item_nombre:  m.panol_item.nombre,
    evento_id:          m.evento_id,
    evento_nombre:      m.evento?.nombre,
    dias_finalizado:    m.evento?.fecha_fin ? Math.floor((now.getTime() - m.evento.fecha_fin.getTime()) / (1000 * 60 * 60 * 24)) : null,
    responsable_id:     m.responsable_id,
    responsable_nombre: m.responsable_nombre,
    cantidad_pendiente: m.cantidad,
    fecha_salida:       m.fecha,
  }));

  res.json({ alertas });
}
