import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { withTenant } from '../lib/tenant';
import { registrarAuditoria } from '../lib/auditoria';
import { generateComidasExcel } from '../lib/comidasExporter';

// ── Helpers ───────────────────────────────────────────────────────────────────

const PEDIDO_INCLUDE = {
  proveedor: { select: { id: true, nombre: true, alias: true, cuit: true, categoria: true, telefono: true } },
  lineas: {
    where:   { deleted_at: null },
    orderBy: [{ area: 'asc' as const }, { tipo: 'asc' as const }],
  },
};

function mapLinea(l: any) {
  return {
    ...l,
    cantidad:       Number(l.cantidad),
    valor_unitario: l.valor_unitario !== null && l.valor_unitario !== undefined ? Number(l.valor_unitario) : null,
  };
}

function mapPedido(p: any) {
  return {
    ...p,
    lineas: Array.isArray(p.lineas) ? p.lineas.map(mapLinea) : undefined,
  };
}

// "YYYY-MM-DD" → medianoche UTC. Fecha de negocio (calendario), no timestamp
// real — mismo criterio que ParteDiario.fecha / RubroEvento.fecha_ingreso.
function parseFechaParam(raw: string): Date | null {
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

// ═══════════════════════════════════════════════════════════════════════════
// PEDIDO DE COMIDA (nested bajo /api/eventos/:id/comidas)
// ═══════════════════════════════════════════════════════════════════════════

export async function listComidas(req: Request, res: Response) {
  const eventoId = Number(req.params.id);
  const evento = await prisma.evento.findFirst({ where: { id: eventoId, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!evento) { res.status(404).json({ error: 'Evento no encontrado' }); return; }

  const pedidos = await prisma.pedidoComida.findMany({
    where:   { evento_id: eventoId, deleted_at: null, ...withTenant(req.empresaId!) },
    include: PEDIDO_INCLUDE,
    orderBy: { fecha: 'asc' },
  });

  res.json(pedidos.map(mapPedido));
}

export async function getPedidoComidaPorFecha(req: Request, res: Response) {
  const eventoId = Number(req.params.id);
  const fecha = parseFechaParam(req.params.fecha);
  if (!fecha) { res.status(400).json({ error: 'Fecha inválida' }); return; }

  const evento = await prisma.evento.findFirst({ where: { id: eventoId, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!evento) { res.status(404).json({ error: 'Evento no encontrado' }); return; }

  const pedido = await prisma.pedidoComida.findFirst({
    where:   { evento_id: eventoId, fecha, deleted_at: null, ...withTenant(req.empresaId!) },
    include: PEDIDO_INCLUDE,
  });
  if (!pedido) { res.status(404).json({ error: 'No hay pedido de comidas para esa fecha' }); return; }

  res.json(mapPedido(pedido));
}

const crearPedidoSchema = z.object({
  fecha:           z.string().min(1),
  proveedor_id:    z.number().int().positive().nullable().optional(),
  proveedor_texto: z.string().nullable().optional(),
  forma_pago:      z.string().nullable().optional(),
  notas:           z.string().nullable().optional(),
});

export async function crearPedidoComida(req: Request, res: Response) {
  const eventoId = Number(req.params.id);
  const evento = await prisma.evento.findFirst({ where: { id: eventoId, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!evento) { res.status(404).json({ error: 'Evento no encontrado' }); return; }

  const parsed = crearPedidoSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return;
  }
  const d = parsed.data;
  const fecha = parseFechaParam(d.fecha);
  if (!fecha) { res.status(400).json({ error: 'Fecha inválida' }); return; }

  if (d.proveedor_id) {
    const proveedor = await prisma.proveedor.findFirst({ where: { id: d.proveedor_id, deleted_at: null, ...withTenant(req.empresaId!) } });
    if (!proveedor) { res.status(400).json({ error: 'Proveedor no encontrado' }); return; }
  }

  const existing = await prisma.pedidoComida.findFirst({ where: { evento_id: eventoId, fecha, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (existing) { res.status(400).json({ error: 'Ya existe un pedido de comidas para esa fecha' }); return; }

  const pedido = await prisma.$transaction(async tx => {
    const created = await tx.pedidoComida.create({
      data: {
        evento_id:  eventoId,
        ...withTenant(req.empresaId!),
        fecha,
        proveedor_id:    d.proveedor_id ?? null,
        proveedor_texto: d.proveedor_texto ?? null,
        forma_pago:      d.forma_pago ?? null,
        notas:           d.notas ?? null,
        created_by: req.user!.id,
        updated_by: req.user!.id,
      },
    });

    await registrarAuditoria({
      usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'CREATE', entidad: 'PedidoComida', entidadId: created.id,
      eventoId,
      descripcion: `Registró comidas del ${d.fecha}`,
      datosDespues: parsed.data, ip: req.ip, tx: tx as any,
    });

    return created;
  });

  res.status(201).json({ ...pedido, proveedor: null, lineas: [] });
}

const updatePedidoSchema = z.object({
  proveedor_id:    z.number().int().positive().nullable().optional(),
  proveedor_texto: z.string().nullable().optional(),
  forma_pago:      z.string().nullable().optional(),
  notas:           z.string().nullable().optional(),
});

// PUT /api/comidas/:id
export async function updatePedidoComida(req: Request, res: Response) {
  const id = Number(req.params.id);
  const existing = await prisma.pedidoComida.findFirst({ where: { id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!existing) { res.status(404).json({ error: 'Pedido de comidas no encontrado' }); return; }

  const parsed = updatePedidoSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return;
  }
  const d = parsed.data;

  if (d.proveedor_id) {
    const proveedor = await prisma.proveedor.findFirst({ where: { id: d.proveedor_id, deleted_at: null, ...withTenant(req.empresaId!) } });
    if (!proveedor) { res.status(400).json({ error: 'Proveedor no encontrado' }); return; }
  }

  const updated = await prisma.$transaction(async tx => {
    const pc = await tx.pedidoComida.update({
      where: { id },
      data: {
        ...(d.proveedor_id      !== undefined && { proveedor_id:      d.proveedor_id }),
        ...(d.proveedor_texto   !== undefined && { proveedor_texto:   d.proveedor_texto }),
        ...(d.forma_pago        !== undefined && { forma_pago:        d.forma_pago }),
        ...(d.notas             !== undefined && { notas:             d.notas }),
        updated_by: req.user!.id,
      },
      include: PEDIDO_INCLUDE,
    });

    await registrarAuditoria({
      usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'UPDATE', entidad: 'PedidoComida', entidadId: id,
      eventoId:  existing.evento_id,
      descripcion:  `Actualizó cabecera de comidas del pedido #${id}`,
      datosAntes:   { proveedor_id: existing.proveedor_id, forma_pago: existing.forma_pago },
      datosDespues: parsed.data,
      ip: req.ip, tx: tx as any,
    });

    return pc;
  });

  res.json(mapPedido(updated));
}

// DELETE /api/comidas/:id — soft delete del pedido y sus líneas
export async function deletePedidoComida(req: Request, res: Response) {
  const id = Number(req.params.id);
  const existing = await prisma.pedidoComida.findFirst({ where: { id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!existing) { res.status(404).json({ error: 'Pedido de comidas no encontrado' }); return; }

  await prisma.$transaction(async tx => {
    const now = new Date();
    await tx.lineaComida.updateMany({ where: { pedido_comida_id: id, deleted_at: null }, data: { deleted_at: now } });
    await tx.pedidoComida.update({ where: { id }, data: { deleted_at: now } });

    await registrarAuditoria({
      usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'DELETE', entidad: 'PedidoComida', entidadId: id,
      eventoId:    existing.evento_id,
      descripcion: `Eliminó el pedido de comidas del ${existing.fecha.toISOString().slice(0, 10)}`,
      ip: req.ip, tx: tx as any,
    });
  });

  res.json({ message: 'Pedido de comidas eliminado correctamente' });
}

// ═══════════════════════════════════════════════════════════════════════════
// LINEAS DE COMIDA
// ═══════════════════════════════════════════════════════════════════════════

const lineaSchema = z.object({
  tipo:           z.enum(['ALMUERZO', 'CENA', 'DESAYUNO', 'MERIENDA']),
  area:           z.string().min(1),
  cantidad:       z.number().int().nonnegative(),
  valor_unitario: z.number().nonnegative().nullable().optional(),
  detalle:        z.string().nullable().optional(),
});

// POST /api/comidas/:id/lineas — upsert por (pedido_comida_id, tipo, area):
// si ya existe una línea con ese tipo+área, actualiza cantidad en vez de duplicar.
export async function addLineaComida(req: Request, res: Response) {
  const pedidoComidaId = Number(req.params.id);
  const pedido = await prisma.pedidoComida.findFirst({ where: { id: pedidoComidaId, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!pedido) { res.status(404).json({ error: 'Pedido de comidas no encontrado' }); return; }

  const parsed = lineaSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return;
  }
  const d = parsed.data;

  const linea = await prisma.$transaction(async tx => {
    const upserted = await tx.lineaComida.upsert({
      where: {
        pedido_comida_id_tipo_area: { pedido_comida_id: pedidoComidaId, tipo: d.tipo, area: d.area },
      },
      create: {
        pedido_comida_id: pedidoComidaId,
        tipo:             d.tipo,
        area:             d.area,
        cantidad:         d.cantidad,
        valor_unitario:   d.valor_unitario ?? null,
        detalle:          d.detalle ?? null,
      },
      update: {
        cantidad:       d.cantidad,
        valor_unitario: d.valor_unitario ?? null,
        detalle:        d.detalle ?? null,
        deleted_at:     null,
      },
    });

    await registrarAuditoria({
      usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'CREATE', entidad: 'LineaComida', entidadId: upserted.id,
      eventoId:    pedido.evento_id,
      descripcion: `Cargó ${d.cantidad} ${d.tipo.toLowerCase()}(s) — ${d.area}`,
      datosDespues: parsed.data, ip: req.ip, tx: tx as any,
    });

    return upserted;
  });

  res.status(201).json(mapLinea(linea));
}

const updateLineaSchema = z.object({
  cantidad:       z.number().int().nonnegative().optional(),
  valor_unitario: z.number().nonnegative().nullable().optional(),
  detalle:        z.string().nullable().optional(),
});

// PUT /api/comidas/lineas/:id
export async function updateLineaComida(req: Request, res: Response) {
  const id = Number(req.params.id);
  const existing = await prisma.lineaComida.findFirst({
    where:   { id, deleted_at: null, pedido_comida: withTenant(req.empresaId!) },
    include: { pedido_comida: { select: { evento_id: true } } },
  });
  if (!existing) { res.status(404).json({ error: 'Línea de comida no encontrada' }); return; }

  const parsed = updateLineaSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return;
  }
  const d = parsed.data;

  const updated = await prisma.$transaction(async tx => {
    await tx.lineaComida.update({
      where: { id },
      data: {
        ...(d.cantidad       !== undefined && { cantidad:       d.cantidad }),
        ...(d.valor_unitario !== undefined && { valor_unitario: d.valor_unitario }),
        ...(d.detalle        !== undefined && { detalle:        d.detalle }),
      },
    });

    await registrarAuditoria({
      usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'UPDATE', entidad: 'LineaComida', entidadId: id,
      eventoId:  existing.pedido_comida.evento_id,
      descripcion:  `Actualizó línea de comida #${id}`,
      datosAntes:   { cantidad: existing.cantidad, valor_unitario: existing.valor_unitario },
      datosDespues: parsed.data,
      ip: req.ip, tx: tx as any,
    });

    return tx.lineaComida.findUniqueOrThrow({ where: { id } });
  });

  res.json(mapLinea(updated));
}

// DELETE /api/comidas/lineas/:id
export async function deleteLineaComida(req: Request, res: Response) {
  const id = Number(req.params.id);
  const existing = await prisma.lineaComida.findFirst({
    where:   { id, deleted_at: null, pedido_comida: withTenant(req.empresaId!) },
    include: { pedido_comida: { select: { evento_id: true } } },
  });
  if (!existing) { res.status(404).json({ error: 'Línea de comida no encontrada' }); return; }

  await prisma.$transaction(async tx => {
    await tx.lineaComida.update({ where: { id }, data: { deleted_at: new Date() } });
    await registrarAuditoria({
      usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'DELETE', entidad: 'LineaComida', entidadId: id,
      eventoId:    existing.pedido_comida.evento_id,
      descripcion: `Eliminó línea de comida "${existing.tipo} — ${existing.area}"`,
      datosAntes:  { tipo: existing.tipo, area: existing.area, cantidad: existing.cantidad },
      ip: req.ip, tx: tx as any,
    });
  });

  res.json({ message: 'Línea de comida eliminada correctamente' });
}

// ═══════════════════════════════════════════════════════════════════════════
// RESUMEN Y EXPORTAR
// ═══════════════════════════════════════════════════════════════════════════

export async function resumenComidas(req: Request, res: Response) {
  const eventoId = Number(req.params.id);
  const evento = await prisma.evento.findFirst({ where: { id: eventoId, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!evento) { res.status(404).json({ error: 'Evento no encontrado' }); return; }

  const pedidos = await prisma.pedidoComida.findMany({
    where:   { evento_id: eventoId, deleted_at: null, ...withTenant(req.empresaId!) },
    include: { lineas: { where: { deleted_at: null } } },
    orderBy: { fecha: 'asc' },
  });

  const resumen = pedidos.map(p => {
    const sumTipo = (tipo: string) => p.lineas.filter(l => l.tipo === tipo).reduce((s, l) => s + l.cantidad, 0);
    const areas = [...new Set(p.lineas.map(l => l.area))];

    return {
      fecha:            p.fecha,
      total_almuerzos:  sumTipo('ALMUERZO'),
      total_cenas:      sumTipo('CENA'),
      total_personas:   p.lineas.reduce((s, l) => s + l.cantidad, 0),
      costo_total:      p.lineas.reduce((s, l) => s + l.cantidad * Number(l.valor_unitario ?? 0), 0),
      por_area: areas.map(area => ({
        area,
        almuerzo: p.lineas.filter(l => l.area === area && l.tipo === 'ALMUERZO').reduce((s, l) => s + l.cantidad, 0),
        cena:     p.lineas.filter(l => l.area === area && l.tipo === 'CENA').reduce((s, l) => s + l.cantidad, 0),
      })),
    };
  });

  res.json(resumen);
}

export async function exportarComidas(req: Request, res: Response) {
  const eventoId = Number(req.params.id);
  const evento = await prisma.evento.findFirst({ where: { id: eventoId, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!evento) { res.status(404).json({ error: 'Evento no encontrado' }); return; }

  const { buffer, filename } = await generateComidasExcel(eventoId, req.empresaId!);

  res.set({
    'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
    'Content-Length':      String(buffer.length),
  });
  res.end(buffer);
}
