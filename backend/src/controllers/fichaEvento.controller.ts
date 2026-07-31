import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { withTenant } from '../lib/tenant';
import { registrarAuditoria } from '../lib/auditoria';
import { generateFichaExcel } from '../lib/fichaExporter';

// ── Helpers ───────────────────────────────────────────────────────────────────

const RUBRO_EVENTO_INCLUDE = {
  rubro:     { select: { id: true, nombre: true, orden: true } },
  proveedor: { select: { id: true, nombre: true, alias: true, cuit: true, categoria: true, telefono: true } },
  pedido_items: {
    where:   { deleted_at: null },
    orderBy: { orden: 'asc' as const },
  },
};

function mapPedidoItem(pi: any) {
  return { ...pi, cantidad: pi.cantidad !== null && pi.cantidad !== undefined ? Number(pi.cantidad) : null };
}

function mapRubroEvento(re: any) {
  return {
    ...re,
    presupuesto:  re.presupuesto !== null && re.presupuesto !== undefined ? Number(re.presupuesto) : null,
    pedido_items: Array.isArray(re.pedido_items) ? re.pedido_items.map(mapPedidoItem) : undefined,
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

  res.json(rubrosEvento.map(mapRubroEvento));
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
    const re = await tx.rubroEvento.update({
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
        updated_by: req.user!.id,
      },
      include: RUBRO_EVENTO_INCLUDE,
    });

    await registrarAuditoria({
      usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'UPDATE', entidad: 'RubroEvento', entidadId: id,
      eventoId:  existing.evento_id,
      descripcion:  `Actualizó "${re.rubro.nombre}" en la ficha de evento`,
      datosAntes:   { estado: existing.estado, proveedor_id: existing.proveedor_id },
      datosDespues: parsed.data,
      ip: req.ip, tx: tx as any,
    });

    return re;
  });

  res.json(mapRubroEvento(updated));
}

// ═══════════════════════════════════════════════════════════════════════════
// PEDIDO ITEMS
// ═══════════════════════════════════════════════════════════════════════════

const pedidoItemSchema = z.object({
  cantidad:        z.number().nonnegative().nullable().optional(),
  unidad:          z.string().nullable().optional(),
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
        unidad:          d.unidad ?? null,
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
        ...(d.unidad          !== undefined && { unidad:          d.unidad }),
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
