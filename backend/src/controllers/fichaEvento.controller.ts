import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { withTenant } from '../lib/tenant';
import { registrarAuditoria } from '../lib/auditoria';
import { generateFichaExcel } from '../lib/fichaExporter';
import { calcDisponibilidad, calcSugerencias } from './stock.controller';
import {
  listarHojasEvento, parseHojaFichaEvento, normalizarNombreRubro,
  type FichaEventoRowPreview,
} from '../lib/fichaEventoImporter';
import { parseEsquemaTurnos } from '../lib/esquemaTurnosImporter';
import { derivarTurno, descripcionTurno, normalizarHora, esRubroPersonal } from '../lib/esquemaTurnos';

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

const numOrNull = (v: unknown) => (v !== null && v !== undefined ? Number(v) : null);

function mapPedidoItem(pi: any) {
  return {
    ...pi,
    cantidad:          numOrNull(pi.cantidad),
    horas_por_agente:  numOrNull(pi.horas_por_agente),
    total_horas_turno: numOrNull(pi.total_horas_turno),
  };
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

const pedidoItemBaseSchema = z.object({
  cantidad:        z.number().nonnegative().nullable().optional(),
  descripcion:     z.string().min(1),
  dias_uso:        z.number().int().nonnegative().nullable().optional(),
  horario_llegada: z.string().nullable().optional(),
  horario_retiro:  z.string().nullable().optional(),
  observaciones:   z.string().nullable().optional(),
  orden:           z.number().int().positive().optional(),
  // Esquema de personal por turno — con fecha_turno el ítem es una línea de la
  // grilla de dotación. horas_por_agente/total_horas_turno son DERIVADOS: se
  // calculan de inicio/fin × cantidad (horas_por_agente sólo se respeta si el
  // turno no trae las dos horas).
  fecha_turno:       z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Fecha inválida (YYYY-MM-DD)').nullable().optional(),
  hora_inicio_turno: z.string().nullable().optional(),
  hora_fin_turno:    z.string().nullable().optional(),
  ubicacion_turno:   z.string().nullable().optional(),
  tipo_turno:        z.string().nullable().optional(),
  horas_por_agente:  z.number().nonnegative().max(24).nullable().optional(),
});

function pedidoItemRefine(d: { hora_inicio_turno?: string | null; hora_fin_turno?: string | null }, ctx: z.RefinementCtx) {
  for (const k of ['hora_inicio_turno', 'hora_fin_turno'] as const) {
    if (d[k] && !normalizarHora(d[k])) ctx.addIssue({ code: 'custom', path: [k], message: 'Hora inválida (HH:mm)' });
  }
}

const pedidoItemSchema = pedidoItemBaseSchema.superRefine(pedidoItemRefine);

// Fecha calendario (YYYY-MM-DD) → medianoche UTC, como el resto de las fechas de negocio.
const fechaTurnoDate = (s: string | null | undefined) => (s ? new Date(`${s.slice(0, 10)}T00:00:00.000Z`) : null);

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

  const esTurno = !!d.fecha_turno;
  const horaInicio = normalizarHora(d.hora_inicio_turno);
  const horaFin    = normalizarHora(d.hora_fin_turno);
  const derivado = esTurno
    ? derivarTurno({ cantidad: d.cantidad ?? null, horaInicio, horaFin, horasManual: d.horas_por_agente })
    : { horas_por_agente: null, total_horas_turno: null };

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
        ...(esTurno && {
          fecha_turno:       fechaTurnoDate(d.fecha_turno),
          hora_inicio_turno: horaInicio,
          hora_fin_turno:    horaFin,
          ubicacion_turno:   d.ubicacion_turno ?? null,
          tipo_turno:        d.tipo_turno ?? null,
          ...derivado,
        }),
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

// pedidoItemSchema lleva superRefine (ZodEffects) — se parcializa el objeto base.
const updatePedidoItemSchema = pedidoItemBaseSchema.partial().extend({
  descripcion: z.string().min(1).optional(),
}).superRefine(pedidoItemRefine);

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

  // Esquema de turno: se recalculan los derivados (horas × cantidad) y, si el
  // usuario no tocó la descripción, ésta sigue a tipo/ubicación.
  const toca = (...keys: (keyof typeof d)[]) => keys.some(k => d[k] !== undefined);
  const fechaTurno = d.fecha_turno !== undefined ? fechaTurnoDate(d.fecha_turno) : existing.fecha_turno;
  const turnoData: Record<string, unknown> = {};
  if (d.fecha_turno       !== undefined) turnoData.fecha_turno       = fechaTurno;
  if (d.hora_inicio_turno !== undefined) turnoData.hora_inicio_turno = normalizarHora(d.hora_inicio_turno);
  if (d.hora_fin_turno    !== undefined) turnoData.hora_fin_turno    = normalizarHora(d.hora_fin_turno);
  if (d.ubicacion_turno   !== undefined) turnoData.ubicacion_turno   = d.ubicacion_turno;
  if (d.tipo_turno        !== undefined) turnoData.tipo_turno        = d.tipo_turno;
  if (fechaTurno && toca('cantidad', 'hora_inicio_turno', 'hora_fin_turno', 'horas_por_agente', 'fecha_turno')) {
    Object.assign(turnoData, derivarTurno({
      cantidad:    d.cantidad !== undefined ? d.cantidad : numOrNull(existing.cantidad),
      horaInicio:  d.hora_inicio_turno !== undefined ? normalizarHora(d.hora_inicio_turno) : existing.hora_inicio_turno,
      horaFin:     d.hora_fin_turno    !== undefined ? normalizarHora(d.hora_fin_turno)    : existing.hora_fin_turno,
      horasManual: d.horas_por_agente  !== undefined ? d.horas_por_agente : numOrNull(existing.horas_por_agente),
    }));
  }
  // Quitar la fecha saca al ítem del esquema: se limpia todo lo derivado del turno
  if (d.fecha_turno === null) {
    Object.assign(turnoData, {
      hora_inicio_turno: null, hora_fin_turno: null, ubicacion_turno: null, tipo_turno: null,
      horas_por_agente: null, total_horas_turno: null,
    });
  }
  const descripcion = d.descripcion !== undefined
    ? d.descripcion
    : (fechaTurno && toca('tipo_turno', 'ubicacion_turno')
        ? descripcionTurno(
            d.tipo_turno !== undefined ? d.tipo_turno : existing.tipo_turno,
            d.ubicacion_turno !== undefined ? d.ubicacion_turno : existing.ubicacion_turno,
          )
        : undefined);

  const updated = await prisma.$transaction(async tx => {
    await tx.pedidoItem.update({
      where: { id },
      data: {
        ...(d.cantidad        !== undefined && { cantidad:        d.cantidad }),
        ...(descripcion       !== undefined && { descripcion }),
        ...(d.dias_uso        !== undefined && { dias_uso:        d.dias_uso }),
        ...(d.horario_llegada !== undefined && { horario_llegada: d.horario_llegada }),
        ...(d.horario_retiro  !== undefined && { horario_retiro:  d.horario_retiro }),
        ...(d.observaciones   !== undefined && { observaciones:   d.observaciones }),
        ...turnoData,
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

// ═══════════════════════════════════════════════════════════════════════════
// IMPORTAR FICHA DESDE EXCEL (docs/enjoy/rubro por evento.xlsx)
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/eventos/:id/ficha/importar/hojas — lista las hojas de evento del
// archivo subido, para que el usuario elija cuál corresponde a este evento.
export async function listarHojasFichaImport(req: Request, res: Response) {
  if (!req.file) { res.status(400).json({ error: 'Se requiere un archivo .xlsx' }); return; }
  try {
    const hojas = listarHojasEvento(req.file.buffer);
    res.json({ hojas });
  } catch (err: any) {
    res.status(400).json({ error: 'Error al leer el archivo', detail: err.message });
  }
}

interface FilaResuelta extends FichaEventoRowPreview {
  rubro_id:     number | null;
  rubro_nombre: string | null;
  proveedor_id: number | null;
  accion:       'CREAR' | 'ACTUALIZAR' | 'SIN_RUBRO';
}

async function resolverFilas(filas: FichaEventoRowPreview[], eventoId: number, empresaId: number): Promise<FilaResuelta[]> {
  const rubros = await prisma.rubro.findMany({
    where: { empresa_id: empresaId, tipo: 'EGRESO', activo: true, deleted_at: null },
    select: { id: true, nombre: true },
  });
  const rubroPorNombre = new Map(rubros.map(r => [normalizarNombreRubro(r.nombre), r]));

  const existentes = await prisma.rubroEvento.findMany({
    where: { evento_id: eventoId, deleted_at: null, ...withTenant(empresaId) },
    select: { rubro_id: true },
  });
  const rubroIdsExistentes = new Set(existentes.map(re => re.rubro_id));

  const proveedorCache = new Map<string, number | null>();
  async function buscarProveedorId(nombreExcel: string | null): Promise<number | null> {
    if (!nombreExcel) return null;
    if (proveedorCache.has(nombreExcel)) return proveedorCache.get(nombreExcel)!;
    const proveedor = await prisma.proveedor.findFirst({
      where: {
        ...withTenant(empresaId),
        deleted_at: null,
        OR: [
          { nombre: { contains: nombreExcel, mode: 'insensitive' } },
          { alias:  { contains: nombreExcel, mode: 'insensitive' } },
        ],
      },
      select: { id: true },
    });
    proveedorCache.set(nombreExcel, proveedor?.id ?? null);
    return proveedor?.id ?? null;
  }

  const out: FilaResuelta[] = [];
  for (const fila of filas) {
    const rubro = rubroPorNombre.get(normalizarNombreRubro(fila.servicio)) ?? null;
    const proveedor_id = await buscarProveedorId(fila.proveedor_nombre_excel);
    out.push({
      ...fila,
      rubro_id:     rubro?.id ?? null,
      rubro_nombre: rubro?.nombre ?? null,
      proveedor_id,
      accion: !rubro ? 'SIN_RUBRO' : (rubroIdsExistentes.has(rubro.id) ? 'ACTUALIZAR' : 'CREAR'),
    });
  }
  return out;
}

function resumenFilas(filas: FilaResuelta[]) {
  const confirmados = filas.filter(f => f.corresponde && f.rubro_id).length;
  const no_van      = filas.filter(f => !f.corresponde && f.rubro_id).length;
  const creados      = filas.filter(f => f.accion === 'CREAR').length;
  const actualizados = filas.filter(f => f.accion === 'ACTUALIZAR').length;
  const rubros_no_encontrados = Array.from(new Set(filas.filter(f => f.accion === 'SIN_RUBRO').map(f => f.servicio)));
  return { confirmados, no_van, creados, actualizados, rubros_no_encontrados };
}

// POST /api/eventos/:id/ficha/importar?preview=true|false
// preview=true (default): sólo parsea y resuelve — no escribe nada.
// preview=false: aplica el upsert de RubroEvento por [evento_id, rubro_id].
export async function importarFicha(req: Request, res: Response) {
  const eventoId = Number(req.params.id);
  const evento = await prisma.evento.findFirst({ where: { id: eventoId, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!evento) { res.status(404).json({ error: 'Evento no encontrado' }); return; }

  if (!req.file) { res.status(400).json({ error: 'Se requiere un archivo .xlsx' }); return; }
  const hoja = (req.body.hoja ?? req.query.hoja) as string | undefined;
  if (!hoja) { res.status(400).json({ error: 'Se requiere el nombre de la hoja del evento' }); return; }

  const esPreview = req.query.preview !== 'false';

  let filasParseadas: FichaEventoRowPreview[];
  try {
    filasParseadas = parseHojaFichaEvento(req.file.buffer, hoja);
  } catch (err: any) {
    res.status(400).json({ error: 'Error al procesar el archivo', detail: err.message }); return;
  }

  const filas = await resolverFilas(filasParseadas, eventoId, req.empresaId!);
  const stats = resumenFilas(filas);

  if (esPreview) {
    res.json({ preview: true, ...stats, filas });
    return;
  }

  await prisma.$transaction(async tx => {
    for (const fila of filas) {
      if (!fila.rubro_id) continue;

      if (fila.corresponde) {
        await tx.rubroEvento.upsert({
          where: { evento_id_rubro_id: { evento_id: eventoId, rubro_id: fila.rubro_id } },
          update: {
            estado: 'CONFIRMADO',
            proveedor_id:    fila.proveedor_id,
            coordina_nombre: fila.responsable,
            notas:           fila.comentario,
            updated_by: req.user!.id,
          },
          create: {
            evento_id: eventoId, rubro_id: fila.rubro_id, empresa_id: req.empresaId!,
            estado: 'CONFIRMADO',
            proveedor_id:    fila.proveedor_id,
            coordina_nombre: fila.responsable,
            notas:           fila.comentario,
            created_by: req.user!.id, updated_by: req.user!.id,
          },
        });
      } else {
        await tx.rubroEvento.upsert({
          where: { evento_id_rubro_id: { evento_id: eventoId, rubro_id: fila.rubro_id } },
          update: { estado: 'NO_VA', updated_by: req.user!.id },
          create: {
            evento_id: eventoId, rubro_id: fila.rubro_id, empresa_id: req.empresaId!,
            estado: 'NO_VA', created_by: req.user!.id, updated_by: req.user!.id,
          },
        });
      }
    }

    await registrarAuditoria({
      usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'CREATE', entidad: 'RubroEvento', eventoId,
      descripcion: `Importó la ficha de evento desde Excel (hoja "${hoja}") — ${stats.creados} creados, ${stats.actualizados} actualizados`,
      ip: req.ip, tx: tx as any,
    });
  });

  res.json({ preview: false, ...stats, filas });
}

// ═══════════════════════════════════════════════════════════════════════════
// IMPORTAR ESQUEMA DE PERSONAL POR TURNO (docs/enjoy/dani/SEGURIDAD FESTIVAL KM.xlsx)
// ═══════════════════════════════════════════════════════════════════════════

// Clave de upsert: [rubro_evento_id, fecha_turno, ubicacion_turno, hora_inicio_turno]
// + tipo_turno (Diurna/Nocturna/Evento pueden coincidir en lugar y hora). Se compara
// en memoria, sin distinguir mayúsculas ni espacios, y NULL == NULL: un @@unique de
// Postgres no sirve acá porque ubicacion_turno puede ser NULL (ej. "Seguridad Evento").
const claveTurno = (fecha: string, ubicacion: string | null, horaInicio: string | null, tipo: string | null) =>
  [fecha, (ubicacion ?? '').trim().toLowerCase(), horaInicio ?? '', (tipo ?? '').trim().toLowerCase()].join('|');

// POST /api/rubros-evento/:id/importar-seguridad?preview=true|false
// preview=true (default): sólo parsea y resuelve CREAR/ACTUALIZAR — no escribe nada.
// preview=false: upsert de PedidoItems con el esquema de turnos.
export async function importarEsquemaTurnos(req: Request, res: Response) {
  const rubroEventoId = Number(req.params.id);
  const rubroEvento = await prisma.rubroEvento.findFirst({
    where:   { id: rubroEventoId, deleted_at: null, ...withTenant(req.empresaId!) },
    include: { rubro: { select: { nombre: true } } },
  });
  if (!rubroEvento) { res.status(404).json({ error: 'Rubro de la ficha no encontrado' }); return; }
  if (rubroEvento.estado !== 'CONFIRMADO') {
    res.status(400).json({ error: 'El rubro debe estar CONFIRMADO para cargar su esquema' }); return;
  }
  if (!req.file) { res.status(400).json({ error: 'Se requiere un archivo .xlsx' }); return; }

  const esPreview = req.query.preview !== 'false';
  const hoja = (req.body?.hoja ?? req.query.hoja) as string | undefined;

  let parsed;
  try {
    parsed = await parseEsquemaTurnos(req.file.buffer, hoja);
  } catch (err: any) {
    res.status(400).json({ error: err.message ?? 'Error al procesar el archivo' }); return;
  }
  if (parsed.filas.length === 0) {
    res.status(400).json({ error: 'La grilla no tiene filas válidas (se requiere fecha y cantidad)', omitidas: parsed.omitidas }); return;
  }

  const existentes = await prisma.pedidoItem.findMany({
    where: { rubro_evento_id: rubroEventoId, deleted_at: null, fecha_turno: { not: null } },
    select: { id: true, fecha_turno: true, ubicacion_turno: true, hora_inicio_turno: true, tipo_turno: true },
  });
  const idPorClave = new Map<string, number>();
  for (const e of existentes) {
    idPorClave.set(claveTurno(e.fecha_turno!.toISOString().slice(0, 10), e.ubicacion_turno, e.hora_inicio_turno, e.tipo_turno), e.id);
  }

  // Un mismo turno repetido en el archivo pisa al anterior (last wins) — se avisa.
  const vistas = new Set<string>();
  const filas = parsed.filas.map(f => {
    const clave = claveTurno(f.fecha, f.ubicacion_turno, f.hora_inicio, f.tipo_turno);
    const repetida = vistas.has(clave);
    vistas.add(clave);
    return {
      ...f,
      clave,
      accion: (idPorClave.has(clave) || repetida ? 'ACTUALIZAR' : 'CREAR') as 'CREAR' | 'ACTUALIZAR',
      advertencias: repetida ? [...f.advertencias, 'Turno repetido en el archivo — se toma esta fila'] : f.advertencias,
    };
  });

  const creados      = filas.filter(f => f.accion === 'CREAR').length;
  const actualizados = filas.length - creados;
  const total_horas  = Math.round(filas.reduce((a, f) => a + (f.total_horas ?? 0), 0) * 100) / 100;
  const salida = (fs: typeof filas) => fs.map(({ clave: _c, ...f }) => f);

  if (esPreview) {
    res.json({ preview: true, hoja: parsed.hoja, creados, actualizados, total_horas, omitidas: parsed.omitidas, filas: salida(filas) });
    return;
  }

  await prisma.$transaction(async tx => {
    const last = await tx.pedidoItem.findFirst({
      where: { rubro_evento_id: rubroEventoId, deleted_at: null }, orderBy: { orden: 'desc' },
    });
    let orden = last?.orden ?? 0;

    for (const f of filas) {
      const data = {
        cantidad:          f.cantidad,
        descripcion:       descripcionTurno(f.tipo_turno, f.ubicacion_turno),
        fecha_turno:       fechaTurnoDate(f.fecha),
        hora_inicio_turno: f.hora_inicio,
        hora_fin_turno:    f.hora_fin,
        ubicacion_turno:   f.ubicacion_turno,
        tipo_turno:        f.tipo_turno,
        horas_por_agente:  f.horas_por_agente,
        total_horas_turno: f.total_horas,
      };
      const id = idPorClave.get(f.clave);
      if (id) {
        await tx.pedidoItem.update({ where: { id }, data });
      } else {
        const created = await tx.pedidoItem.create({ data: { rubro_evento_id: rubroEventoId, orden: ++orden, ...data } });
        idPorClave.set(f.clave, created.id);
      }
    }

    await registrarAuditoria({
      usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'CREATE', entidad: 'PedidoItem', entidadId: rubroEventoId,
      eventoId:    rubroEvento.evento_id,
      descripcion: `Importó el esquema de personal de "${rubroEvento.rubro.nombre}" desde Excel (hoja "${parsed.hoja}") — ${creados} turnos creados, ${actualizados} actualizados`,
      ip: req.ip, tx: tx as any,
    });
  });

  res.json({ preview: false, hoja: parsed.hoja, creados, actualizados, total_horas, omitidas: parsed.omitidas, filas: salida(filas) });
}
