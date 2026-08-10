import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { withTenant } from '../lib/tenant';
import { registrarAuditoria } from '../lib/auditoria';
import { generateFichaExcel } from '../lib/fichaExporter';
import { calcDisponibilidad, calcSugerencias } from './stock.controller';

// ── Helpers ───────────────────────────────────────────────────────────────────

const RUBRO_EVENTO_INCLUDE = {
  rubro:     { select: { id: true, nombre: true, orden: true } },
  proveedor: { select: { id: true, nombre: true, alias: true, cuit: true, categoria: true, telefono: true } },
  pedido_items: {
    where:   { deleted_at: null },
    orderBy: { orden: 'asc' as const },
  },
  // Stock propio vinculado (fuentes mixtas) — ver AsignacionStock.rubro_evento_id
  asignaciones_stock: {
    where:   { deleted_at: null },
    include: { producto: { select: { id: true, nombre: true } } },
    orderBy: { created_at: 'asc' as const },
  },
};

function mapPedidoItem(pi: any) {
  return { ...pi, cantidad: pi.cantidad !== null && pi.cantidad !== undefined ? Number(pi.cantidad) : null };
}

// Disponibilidad "si esta asignación no existiera" — mismo uso de
// excludeAsignacionId que el módulo de stock al editar una asignación propia.
async function mapAsignacionStock(a: any, empresaId: number) {
  const disp = await calcDisponibilidad(
    a.producto_id,
    a.fecha_salida,
    a.fecha_retorno ?? a.fecha_salida,
    empresaId,
    a.id,
  );
  return {
    id:              a.id,
    producto_id:     a.producto_id,
    producto_nombre: a.producto?.nombre ?? null,
    cantidad:        a.cantidad,
    fecha_salida:    a.fecha_salida,
    fecha_retorno:   a.fecha_retorno,
    ubicacion:       a.ubicacion,
    estado:          a.estado,
    disponibilidad:  disp ? { disponible: disp.disponible, comprometido: disp.cantidad_comprometida } : null,
  };
}

async function mapRubroEvento(re: any, empresaId: number) {
  const asignaciones_stock = Array.isArray(re.asignaciones_stock)
    ? await Promise.all(re.asignaciones_stock.map((a: any) => mapAsignacionStock(a, empresaId)))
    : undefined;
  return {
    ...re,
    presupuesto:  re.presupuesto !== null && re.presupuesto !== undefined ? Number(re.presupuesto) : null,
    pedido_items: Array.isArray(re.pedido_items) ? re.pedido_items.map(mapPedidoItem) : undefined,
    asignaciones_stock,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// FICHA (nested bajo /api/eventos/:id/ficha)
// ═══════════════════════════════════════════════════════════════════════════

export async function getFicha(req: Request, res: Response) {
  const eventoId = Number(req.params.id);
  const evento = await prisma.evento.findFirst({ where: { id: eventoId, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!evento) { res.status(404).json({ error: 'Evento no encontrado' }); return; }

  const rubrosEvento = await prisma.rubroEvento.findMany({
    where:   { evento_id: eventoId, deleted_at: null, ...withTenant(req.empresaId!) },
    include: RUBRO_EVENTO_INCLUDE,
    orderBy: { rubro: { orden: 'asc' } },
  });

  res.json(await Promise.all(rubrosEvento.map(re => mapRubroEvento(re, req.empresaId!))));
}

export async function resumenFicha(req: Request, res: Response) {
  const eventoId = Number(req.params.id);
  const evento = await prisma.evento.findFirst({ where: { id: eventoId, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!evento) { res.status(404).json({ error: 'Evento no encontrado' }); return; }

  const rubrosEvento = await prisma.rubroEvento.findMany({
    where:  { evento_id: eventoId, deleted_at: null, ...withTenant(req.empresaId!) },
    select: {
      id: true, estado: true, coordina_nombre: true,
      contacto_nombre: true, contacto_telefono: true,
      rubro:     { select: { id: true, nombre: true, orden: true } },
      proveedor: { select: { id: true, nombre: true } },
    },
    orderBy: { rubro: { orden: 'asc' } },
  });

  res.json(rubrosEvento);
}

export async function inicializarFicha(req: Request, res: Response) {
  const eventoId = Number(req.params.id);
  const evento = await prisma.evento.findFirst({ where: { id: eventoId, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!evento) { res.status(404).json({ error: 'Evento no encontrado' }); return; }

  const rubros = await prisma.rubro.findMany({
    where: { empresa_id: req.empresaId!, tipo: 'EGRESO', activo: true, deleted_at: null },
  });

  let creados = 0;
  let existentes = 0;

  await prisma.$transaction(async tx => {
    for (const rubro of rubros) {
      // @@unique([evento_id, rubro_id]) — nunca duplicar rubros en una ficha
      const existing = await tx.rubroEvento.findUnique({
        where: { evento_id_rubro_id: { evento_id: eventoId, rubro_id: rubro.id } },
      });
      if (existing) { existentes++; continue; }

      await tx.rubroEvento.create({
        data: {
          evento_id:  eventoId,
          rubro_id:   rubro.id,
          empresa_id: req.empresaId!,
          estado:     'PENDIENTE',
          created_by: req.user!.id,
          updated_by: req.user!.id,
        },
      });
      creados++;
    }

    await registrarAuditoria({
      usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'CREATE', entidad: 'RubroEvento', eventoId,
      descripcion: `Inicializó la ficha de evento — ${creados} rubros creados, ${existentes} existentes`,
      ip: req.ip, tx: tx as any,
    });
  });

  res.json({ creados, existentes });
}

export async function exportarFicha(req: Request, res: Response) {
  const eventoId = Number(req.params.id);
  const evento = await prisma.evento.findFirst({ where: { id: eventoId, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!evento) { res.status(404).json({ error: 'Evento no encontrado' }); return; }

  const { buffer, filename } = await generateFichaExcel(eventoId, req.empresaId!);

  res.set({
    'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
    'Content-Length':      String(buffer.length),
  });
  res.end(buffer);
}

// ═══════════════════════════════════════════════════════════════════════════
// RUBRO EVENTO (/api/rubros-evento)
// ═══════════════════════════════════════════════════════════════════════════

const updateRubroEventoSchema = z.object({
  proveedor_id:       z.number().int().positive().nullable().optional(),
  estado:             z.enum(['PENDIENTE', 'COTIZANDO', 'CONFIRMADO', 'NO_VA', 'CANCELADO']).optional(),
  contacto_nombre:    z.string().nullable().optional(),
  contacto_telefono:  z.string().nullable().optional(),
  contacto_cargo:     z.string().nullable().optional(),
  coordina_nombre:    z.string().nullable().optional(),
  fecha_ingreso:      z.string().nullable().optional(),
  fecha_retiro:       z.string().nullable().optional(),
  presupuesto:        z.number().nonnegative().nullable().optional(),
  moneda:             z.enum(['ARS', 'USD']).optional(),
  notas:              z.string().nullable().optional(),
  // Fuentes mixtas (stock propio + proveedor externo)
  usa_stock_propio:   z.boolean().optional(),
  cantidad_stock:     z.number().int().nonnegative().nullable().optional(),
  cantidad_proveedor: z.number().int().nonnegative().nullable().optional(),
});

export async function updateRubroEvento(req: Request, res: Response) {
  const id = Number(req.params.id);
  const existing = await prisma.rubroEvento.findFirst({ where: { id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!existing) { res.status(404).json({ error: 'Rubro de la ficha no encontrado' }); return; }

  const parsed = updateRubroEventoSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return;
  }
  const d = parsed.data;

  if (d.proveedor_id) {
    const proveedor = await prisma.proveedor.findFirst({ where: { id: d.proveedor_id, deleted_at: null, ...withTenant(req.empresaId!) } });
    if (!proveedor) { res.status(400).json({ error: 'Proveedor no encontrado' }); return; }
  }

  const updated = await prisma.$transaction(async tx => {
    await tx.rubroEvento.update({
      where: { id },
      data: {
        ...(d.proveedor_id      !== undefined && { proveedor_id:      d.proveedor_id }),
        ...(d.estado            !== undefined && { estado:            d.estado }),
        ...(d.contacto_nombre   !== undefined && { contacto_nombre:   d.contacto_nombre }),
        ...(d.contacto_telefono !== undefined && { contacto_telefono: d.contacto_telefono }),
        ...(d.contacto_cargo    !== undefined && { contacto_cargo:    d.contacto_cargo }),
        ...(d.coordina_nombre   !== undefined && { coordina_nombre:   d.coordina_nombre }),
        ...(d.fecha_ingreso     !== undefined && { fecha_ingreso:     d.fecha_ingreso ? new Date(d.fecha_ingreso) : null }),
        ...(d.fecha_retiro      !== undefined && { fecha_retiro:      d.fecha_retiro  ? new Date(d.fecha_retiro)  : null }),
        ...(d.presupuesto       !== undefined && { presupuesto:       d.presupuesto }),
        ...(d.moneda            !== undefined && { moneda:            d.moneda }),
        ...(d.notas             !== undefined && { notas:             d.notas }),
        ...(d.usa_stock_propio   !== undefined && { usa_stock_propio:   d.usa_stock_propio }),
        ...(d.cantidad_stock     !== undefined && { cantidad_stock:     d.cantidad_stock }),
        ...(d.cantidad_proveedor !== undefined && { cantidad_proveedor: d.cantidad_proveedor }),
        updated_by: req.user!.id,
      },
    });

    // Un rubro que ya NO VA o se CANCELÓ no tiene pedido técnico vigente —
    // se vacía (soft delete), pero el RubroEvento en sí queda (es historial,
    // no se borra). No toca movimientos de Egresos ya cargados en ese rubro.
    let pedidoItemsVaciados = 0;
    if (d.estado === 'CANCELADO' || d.estado === 'NO_VA') {
      const { count } = await tx.pedidoItem.updateMany({
        where: { rubro_evento_id: id, deleted_at: null },
        data:  { deleted_at: new Date() },
      });
      pedidoItemsVaciados = count;
    }

    const re = await tx.rubroEvento.findUniqueOrThrow({ where: { id }, include: RUBRO_EVENTO_INCLUDE });

    await registrarAuditoria({
      usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'UPDATE', entidad: 'RubroEvento', entidadId: id,
      eventoId:  existing.evento_id,
      descripcion:  `Actualizó "${re.rubro.nombre}" en la ficha de evento`,
      datosAntes:   { estado: existing.estado, proveedor_id: existing.proveedor_id },
      datosDespues: parsed.data,
      ip: req.ip, tx: tx as any,
    });

    if (pedidoItemsVaciados > 0) {
      await registrarAuditoria({
        usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'DELETE', entidad: 'PedidoItem', entidadId: id,
        eventoId:    existing.evento_id,
        descripcion: `Vació ${pedidoItemsVaciados} ítem(s) de pedido de "${re.rubro.nombre}" al pasar a ${d.estado}`,
        ip: req.ip, tx: tx as any,
      });
    }

    return re;
  });

  res.json(await mapRubroEvento(updated, req.empresaId!));
}

// ═══════════════════════════════════════════════════════════════════════════
// STOCK PROPIO (fuentes mixtas — asignación de AsignacionStock a un rubro)
// ═══════════════════════════════════════════════════════════════════════════

const asignarStockSchema = z.object({
  producto_id:   z.number().int().positive(),
  cantidad:      z.number().int().positive(),
  fecha_salida:  z.string(),
  fecha_retorno: z.string().nullable().optional(),
  notas:         z.string().nullable().optional(),
});

// POST /api/rubros-evento/:id/asignar-stock
export async function asignarStock(req: Request, res: Response) {
  const rubroEventoId = Number(req.params.id);
  const rubroEvento = await prisma.rubroEvento.findFirst({ where: { id: rubroEventoId, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!rubroEvento) { res.status(404).json({ error: 'Rubro de la ficha no encontrado' }); return; }

  const parsed = asignarStockSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return;
  }
  const { producto_id, cantidad, fecha_salida, fecha_retorno, notas } = parsed.data;

  const producto = await prisma.producto.findFirst({ where: { id: producto_id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!producto) { res.status(400).json({ error: 'Producto no encontrado' }); return; }

  const fechaSalidaDate  = new Date(fecha_salida);
  const fechaRetornoDate = fecha_retorno ? new Date(fecha_retorno) : null;

  // Mismo patrón de verificación que el módulo de stock (asignarProducto).
  const disp = await calcDisponibilidad(producto_id, fechaSalidaDate, fechaRetornoDate ?? fechaSalidaDate, req.empresaId!);
  if (!disp) { res.status(404).json({ error: 'Producto no encontrado' }); return; }

  if (cantidad > disp.disponible) {
    const sugerencias = await calcSugerencias(
      producto_id, rubroEvento.evento_id, fechaSalidaDate, fechaRetornoDate ?? fechaSalidaDate, req.empresaId!,
    );
    res.status(400).json({
      error:       `Stock insuficiente — disponible: ${disp.disponible}, solicitado: ${cantidad}`,
      disponible:  disp.disponible,
      sugerencias,
    });
    return;
  }

  const asignacion = await prisma.$transaction(async tx => {
    const created = await tx.asignacionStock.create({
      data: {
        producto_id,
        evento_id:       rubroEvento.evento_id,
        rubro_evento_id: rubroEvento.id,
        cantidad,
        fecha_salida:    fechaSalidaDate,
        fecha_retorno:   fechaRetornoDate,
        ubicacion:       'DEPOSITO', // todavía no salió del depósito
        estado:          'ACTIVA',
        origen:          'DEPOSITO',
        notas:           notas ?? null,
        created_by:      req.user!.id,
        updated_by:      req.user!.id,
      },
    });

    const agg = await tx.asignacionStock.aggregate({
      where: { rubro_evento_id: rubroEvento.id, estado: 'ACTIVA', deleted_at: null },
      _sum:  { cantidad: true },
    });

    await tx.rubroEvento.update({
      where: { id: rubroEvento.id },
      data:  { usa_stock_propio: true, cantidad_stock: agg._sum.cantidad ?? cantidad },
    });

    await registrarAuditoria({
      usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'CREATE', entidad: 'AsignacionStock', entidadId: created.id,
      eventoId:    rubroEvento.evento_id,
      descripcion: `Asignó ${cantidad} u. de "${producto.nombre}" (stock propio) al rubro de la ficha #${rubroEvento.id}`,
      datosDespues: { producto_id, cantidad, fecha_salida, fecha_retorno },
      ip: req.ip, tx: tx as any,
    });

    return created;
  });

  res.status(201).json({
    asignacion,
    disponibilidad_restante: disp.disponible - cantidad,
  });
}

// DELETE /api/rubros-evento/:id/asignaciones/:asignacionId
export async function desasignarStock(req: Request, res: Response) {
  const rubroEventoId = Number(req.params.id);
  const asignacionId  = Number(req.params.asignacionId);

  const rubroEvento = await prisma.rubroEvento.findFirst({ where: { id: rubroEventoId, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!rubroEvento) { res.status(404).json({ error: 'Rubro de la ficha no encontrado' }); return; }

  const asignacion = await prisma.asignacionStock.findFirst({
    where:   { id: asignacionId, rubro_evento_id: rubroEventoId, deleted_at: null },
    include: { producto: { select: { nombre: true } } },
  });
  if (!asignacion) { res.status(404).json({ error: 'Asignación no encontrada' }); return; }
  if (asignacion.estado !== 'ACTIVA') {
    res.status(400).json({ error: 'Solo se pueden cancelar asignaciones ACTIVAS' }); return;
  }

  await prisma.$transaction(async tx => {
    await tx.asignacionStock.update({
      where: { id: asignacionId },
      data:  { estado: 'CANCELADA', deleted_at: new Date(), updated_by: req.user!.id },
    });

    // Mismo movimiento que cancelarAsignacion en el módulo de stock —
    // devuelve la cantidad al depósito.
    await tx.movimientoStock.create({
      data: {
        producto_id:      asignacion.producto_id,
        asignacion_id:    asignacionId,
        tipo:             'RETORNO_DEPOSITO',
        cantidad:         asignacion.cantidad,
        evento_origen_id: rubroEvento.evento_id,
        fecha:            new Date(),
        descripcion:      `Cancelación de asignación #${asignacionId} desde la ficha`,
        created_by:       req.user!.id,
      },
    });

    const agg = await tx.asignacionStock.aggregate({
      where: { rubro_evento_id: rubroEventoId, estado: 'ACTIVA', deleted_at: null },
      _sum:  { cantidad: true },
    });
    const cantidadStock = agg._sum.cantidad ?? 0;

    await tx.rubroEvento.update({
      where: { id: rubroEventoId },
      data:  { cantidad_stock: cantidadStock, usa_stock_propio: cantidadStock > 0 },
    });

    await registrarAuditoria({
      usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'DELETE', entidad: 'AsignacionStock', entidadId: asignacionId,
      eventoId:    rubroEvento.evento_id,
      descripcion: `Canceló asignación de stock propio de "${asignacion.producto.nombre}" (${asignacion.cantidad} u.) del rubro de la ficha`,
      datosAntes:  { estado: 'ACTIVA', cantidad: asignacion.cantidad },
      ip: req.ip, tx: tx as any,
    });
  });

  res.json({ message: 'Asignación cancelada correctamente' });
}

// ═══════════════════════════════════════════════════════════════════════════
// PEDIDO ITEMS
// ═══════════════════════════════════════════════════════════════════════════

const pedidoItemSchema = z.object({
  cantidad:        z.number().nonnegative().nullable().optional(),
  descripcion:     z.string().min(1),
  dias_uso:        z.number().int().nonnegative().nullable().optional(),
  horario_llegada: z.string().nullable().optional(),
  horario_retiro:  z.string().nullable().optional(),
  observaciones:   z.string().nullable().optional(),
  orden:           z.number().int().positive().optional(),
});

// POST /api/rubros-evento/:id/items
export async function addPedidoItem(req: Request, res: Response) {
  const rubroEventoId = Number(req.params.id);
  const rubroEvento = await prisma.rubroEvento.findFirst({ where: { id: rubroEventoId, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!rubroEvento) { res.status(404).json({ error: 'Rubro de la ficha no encontrado' }); return; }
  if (rubroEvento.estado !== 'CONFIRMADO') {
    res.status(400).json({ error: 'El rubro debe estar CONFIRMADO para cargar su pedido técnico' });
    return;
  }

  const parsed = pedidoItemSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return;
  }
  const d = parsed.data;

  let orden = d.orden;
  if (orden === undefined) {
    const last = await prisma.pedidoItem.findFirst({
      where: { rubro_evento_id: rubroEventoId, deleted_at: null }, orderBy: { orden: 'desc' },
    });
    orden = (last?.orden ?? 0) + 1;
  }

  const item = await prisma.$transaction(async tx => {
    const created = await tx.pedidoItem.create({
      data: {
        rubro_evento_id: rubroEventoId,
        cantidad:        d.cantidad ?? null,
        descripcion:     d.descripcion,
        dias_uso:        d.dias_uso ?? null,
        horario_llegada: d.horario_llegada ?? null,
        horario_retiro:  d.horario_retiro ?? null,
        observaciones:   d.observaciones ?? null,
        orden:           orden!,
      },
    });

    await registrarAuditoria({
      usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'CREATE', entidad: 'PedidoItem', entidadId: created.id,
      eventoId:    rubroEvento.evento_id,
      descripcion: `Agregó ítem de pedido "${d.descripcion}"`,
      datosDespues: parsed.data, ip: req.ip, tx: tx as any,
    });

    return created;
  });

  res.status(201).json(mapPedidoItem(item));
}

const updatePedidoItemSchema = pedidoItemSchema.partial().extend({
  descripcion: z.string().min(1).optional(),
});

// PUT /api/pedido-items/:id — también resuelve el reordenamiento drag&drop
// cuando el body incluye `orden` (mismo patrón de resequencing que
// /movimientos/:id/orden: recalcula el orden 1..N de todos los hermanos).
export async function updatePedidoItem(req: Request, res: Response) {
  const id = Number(req.params.id);
  const existing = await prisma.pedidoItem.findFirst({
    where:   { id, deleted_at: null, rubro_evento: withTenant(req.empresaId!) },
    include: { rubro_evento: { select: { evento_id: true } } },
  });
  if (!existing) { res.status(404).json({ error: 'Ítem de pedido no encontrado' }); return; }

  const parsed = updatePedidoItemSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return;
  }
  const d = parsed.data;

  const updated = await prisma.$transaction(async tx => {
    await tx.pedidoItem.update({
      where: { id },
      data: {
        ...(d.cantidad        !== undefined && { cantidad:        d.cantidad }),
        ...(d.descripcion     !== undefined && { descripcion:     d.descripcion }),
        ...(d.dias_uso        !== undefined && { dias_uso:        d.dias_uso }),
        ...(d.horario_llegada !== undefined && { horario_llegada: d.horario_llegada }),
        ...(d.horario_retiro  !== undefined && { horario_retiro:  d.horario_retiro }),
        ...(d.observaciones   !== undefined && { observaciones:   d.observaciones }),
      },
    });

    if (d.orden !== undefined) {
      const others = await tx.pedidoItem.findMany({
        where:   { rubro_evento_id: existing.rubro_evento_id, deleted_at: null, id: { not: id } },
        orderBy: { orden: 'asc' },
      });
      const clamped   = Math.min(Math.max(d.orden, 1), others.length + 1);
      const reordered = [...others];
      reordered.splice(clamped - 1, 0, { id } as any);
      for (let i = 0; i < reordered.length; i++) {
        await tx.pedidoItem.update({ where: { id: reordered[i].id }, data: { orden: i + 1 } });
      }
    }

    await registrarAuditoria({
      usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'UPDATE', entidad: 'PedidoItem', entidadId: id,
      eventoId:  existing.rubro_evento.evento_id,
      descripcion:  `Actualizó ítem de pedido #${id}`,
      datosAntes:   { descripcion: existing.descripcion },
      datosDespues: parsed.data,
      ip: req.ip, tx: tx as any,
    });

    return tx.pedidoItem.findUniqueOrThrow({ where: { id } });
  });

  res.json(mapPedidoItem(updated));
}

// DELETE /api/pedido-items/:id — soft delete, nunca físico
export async function deletePedidoItem(req: Request, res: Response) {
  const id = Number(req.params.id);
  const existing = await prisma.pedidoItem.findFirst({
    where:   { id, deleted_at: null, rubro_evento: withTenant(req.empresaId!) },
    include: { rubro_evento: { select: { evento_id: true } } },
  });
  if (!existing) { res.status(404).json({ error: 'Ítem de pedido no encontrado' }); return; }

  await prisma.$transaction(async tx => {
    await tx.pedidoItem.update({ where: { id }, data: { deleted_at: new Date() } });
    await registrarAuditoria({
      usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'DELETE', entidad: 'PedidoItem', entidadId: id,
      eventoId:    existing.rubro_evento.evento_id,
      descripcion: `Eliminó ítem de pedido "${existing.descripcion}"`,
      datosAntes:  { descripcion: existing.descripcion },
      ip: req.ip, tx: tx as any,
    });
  });

  res.json({ message: 'Ítem de pedido eliminado correctamente' });
}
