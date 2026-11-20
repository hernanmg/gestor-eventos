import type { Request, Response } from 'express';
import { z } from 'zod';
import { EstadoOrdenCompra, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { registrarAuditoria } from '../lib/auditoria';
import { withTenant } from '../lib/tenant';
import { parseFechaCalendario } from '../lib/vencimientos';
import { EMPRESAS } from '../lib/empresasConstants';
import { renderRemitoPDF } from '../lib/pdfExporter';
import { templateOrdenCompra } from '../lib/pdfTemplates/ordenCompra';
import { CUIT_DOS57_FALLBACK } from './remitos.controller';

// ── Órdenes de compra a proveedores ──────────────────────────────────────────
// Ver modelo OrdenCompra. Flujo: BORRADOR (se arma y se corrige: "el Pollo me
// lo cambia, me agrega el número de referencia") → EMITIDA (PDF al proveedor)
// → RECIBIDA (control de lo que llegó) → CERRADA (factura cotejada). ANULADA
// en cualquier momento antes de cerrar.

export const formatearNumeroOC = (n: number) => `OC ${String(n).padStart(6, '0')}`;

const round2 = (n: number) => Math.round(n * 100) / 100;

const itemSchema = z.object({
  codigo:          z.string().nullable().optional(),
  descripcion:     z.string().trim().min(1, 'Cada ítem necesita una descripción'),
  cantidad:        z.number().positive('La cantidad tiene que ser mayor a cero'),
  precio_unitario: z.number().min(0),
});

const ordenSchema = z.object({
  fecha:                z.string().min(1),
  proveedor_id:         z.number().int(),
  evento_id:            z.number().int().nullable().optional(),
  contacto:             z.string().nullable().optional(),
  telefono:             z.string().nullable().optional(),
  domicilio:            z.string().nullable().optional(),
  ciudad:               z.string().nullable().optional(),
  entrega:              z.string().nullable().optional(),
  direccion_entrega:    z.string().nullable().optional(),
  plazo_pago:           z.string().nullable().optional(),
  forma_pago:           z.string().nullable().optional(),
  referencia_proveedor: z.string().nullable().optional(),
  moneda:               z.enum(['ARS', 'USD', 'EUR']).optional(),
  iva_porcentaje:       z.number().min(0).max(100).optional(),
  notas:                z.string().nullable().optional(),
  items:                z.array(itemSchema).min(1, 'Cargá al menos un ítem'),
});

function calcular(items: z.infer<typeof itemSchema>[], ivaPct: number) {
  const filas = items.map((it, i) => ({
    orden_item: i + 1,
    codigo: it.codigo || null,
    descripcion: it.descripcion,
    cantidad: it.cantidad,
    precio_unitario: it.precio_unitario,
    total: round2(it.cantidad * it.precio_unitario),
  }));
  const subtotal = round2(filas.reduce((n, f) => n + f.total, 0));
  const iva = round2(subtotal * ivaPct / 100);
  return { filas, subtotal, iva, total: round2(subtotal + iva) };
}

const listSelect = {
  id: true, numero: true, fecha: true, estado: true, moneda: true, subtotal: true, iva: true, total: true,
  referencia_proveedor: true, emitida_at: true, recibida_at: true,
  proveedor: { select: { id: true, nombre: true, cuit: true } },
  evento:    { select: { id: true, nombre: true } },
  facturas:  { where: { deleted_at: null, estado: { not: 'ANULADA' as const } }, select: { importe_total: true } },
  _count:    { select: { items: true } },
} satisfies Prisma.OrdenCompraSelect;

// GET /api/ordenes-compra
export async function listOrdenesCompra(req: Request, res: Response) {
  const { estado, proveedor_id, q } = req.query as { estado?: string; proveedor_id?: string; q?: string };
  const ordenes = await prisma.ordenCompra.findMany({
    where: {
      ...withTenant(req.empresaId!), deleted_at: null,
      ...(estado && { estado: estado as EstadoOrdenCompra }),
      ...(proveedor_id && { proveedor_id: Number(proveedor_id) }),
      ...(q && {
        OR: [
          { proveedor: { nombre: { contains: q, mode: 'insensitive' as const } } },
          { referencia_proveedor: { contains: q, mode: 'insensitive' as const } },
          { items: { some: { descripcion: { contains: q, mode: 'insensitive' as const } } } },
          ...(/^\d+$/.test(q) ? [{ numero: Number(q) }] : []),
        ],
      }),
    },
    orderBy: [{ fecha: 'desc' }, { numero: 'desc' }],
    select: listSelect,
  });
  res.json(ordenes.map(({ facturas, ...o }) => ({
    ...o,
    numero_formateado: formatearNumeroOC(o.numero),
    facturado: round2(facturas.reduce((n, f) => n + Number(f.importe_total), 0)),
    cant_facturas: facturas.length,
  })));
}

async function cargarOrden(id: number, empresaId: number) {
  return prisma.ordenCompra.findFirst({
    where: { id, empresa_id: empresaId, deleted_at: null },
    include: {
      items:     { orderBy: { orden_item: 'asc' } },
      proveedor: { select: { id: true, nombre: true, cuit: true, telefono: true, email: true } },
      evento:    { select: { id: true, nombre: true } },
      facturas: {
        where:   { deleted_at: null },
        orderBy: { fecha_emision: 'asc' },
        select:  { id: true, numero_factura: true, tipo_factura: true, fecha_emision: true, importe_total: true, neto_gravado: true, iva_importe: true, estado: true, moneda: true, importe_pendiente: true },
      },
    },
  });
}

// Cotejo: lo pedido contra lo facturado y lo recibido
function cotejo(o: NonNullable<Awaited<ReturnType<typeof cargarOrden>>>) {
  const vigentes = o.facturas.filter(f => f.estado !== 'ANULADA');
  const facturadoTotal = round2(vigentes.reduce((n, f) => n + Number(f.importe_total), 0));
  // Neto: el del libro de compras si está; si no, el total sin el IVA de la orden
  const ivaPct = Number(o.iva_porcentaje);
  const facturadoNeto = round2(vigentes.reduce((n, f) => n + (f.neto_gravado != null ? Number(f.neto_gravado) : Number(f.importe_total) / (1 + ivaPct / 100)), 0));
  const faltantes = o.items
    .filter(it => it.cantidad_recibida != null && Number(it.cantidad_recibida) < Number(it.cantidad))
    .map(it => ({ orden_item: it.orden_item, descripcion: it.descripcion, pedido: Number(it.cantidad), recibido: Number(it.cantidad_recibida) }));
  const sinControlar = o.items.filter(it => it.cantidad_recibida == null).length;
  const diferencia = round2(facturadoTotal - Number(o.total));
  return {
    facturado_total: facturadoTotal,
    facturado_neto:  facturadoNeto,
    diferencia_total: diferencia,
    diferencia_neto:  round2(facturadoNeto - Number(o.subtotal)),
    // tolerancia de redondeo: $1
    coincide: vigentes.length > 0 && Math.abs(diferencia) <= 1,
    faltantes,
    items_sin_controlar: sinControlar,
  };
}

// GET /api/ordenes-compra/:id
export async function getOrdenCompra(req: Request, res: Response) {
  const o = await cargarOrden(Number(req.params.id), req.empresaId!);
  if (!o) { res.status(404).json({ error: 'Orden de compra no encontrada' }); return; }
  res.json({ ...o, numero_formateado: formatearNumeroOC(o.numero), cotejo: cotejo(o) });
}

// GET /api/ordenes-compra/sugerencia?proveedor_id= — datos de la última orden a ese proveedor
export async function sugerenciaProveedor(req: Request, res: Response) {
  const proveedorId = Number(req.query.proveedor_id);
  const [prov, ultima] = await Promise.all([
    prisma.proveedor.findFirst({ where: { id: proveedorId, deleted_at: null }, select: { telefono: true } }),
    prisma.ordenCompra.findFirst({
      where:   { empresa_id: req.empresaId!, proveedor_id: proveedorId, deleted_at: null },
      orderBy: { created_at: 'desc' },
      select:  { contacto: true, telefono: true, domicilio: true, ciudad: true, entrega: true, direccion_entrega: true, plazo_pago: true, forma_pago: true },
    }),
  ]);
  res.json({ ...ultima, telefono: ultima?.telefono ?? prov?.telefono ?? null });
}

async function validarRelaciones(empresaId: number, proveedorId: number, eventoId: number | null | undefined) {
  const prov = await prisma.proveedor.findFirst({ where: { id: proveedorId, deleted_at: null }, select: { id: true, nombre: true } });
  if (!prov) return 'Proveedor no encontrado';
  if (eventoId) {
    const ev = await prisma.evento.findFirst({ where: { id: eventoId, empresa_id: empresaId, deleted_at: null }, select: { id: true } });
    if (!ev) return 'Evento no encontrado';
  }
  return null;
}

function datosOrden(d: z.infer<typeof ordenSchema>) {
  return {
    proveedor_id: d.proveedor_id, evento_id: d.evento_id ?? null,
    contacto: d.contacto ?? null, telefono: d.telefono ?? null, domicilio: d.domicilio ?? null, ciudad: d.ciudad ?? null,
    entrega: d.entrega ?? null, direccion_entrega: d.direccion_entrega ?? null,
    plazo_pago: d.plazo_pago ?? null, forma_pago: d.forma_pago ?? null,
    referencia_proveedor: d.referencia_proveedor ?? null,
    moneda: d.moneda ?? 'ARS', iva_porcentaje: d.iva_porcentaje ?? 21, notas: d.notas ?? null,
  };
}

// POST /api/ordenes-compra — se crea en borrador con el próximo número
export async function createOrdenCompra(req: Request, res: Response) {
  const parsed = ordenSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return; }
  const d = parsed.data;
  const fecha = parseFechaCalendario(d.fecha);
  if (!fecha) { res.status(400).json({ error: 'Fecha inválida' }); return; }
  const err = await validarRelaciones(req.empresaId!, d.proveedor_id, d.evento_id);
  if (err) { res.status(404).json({ error: err }); return; }
  const c = calcular(d.items, d.iva_porcentaje ?? 21);

  // Reintento por si dos usuarios crean a la vez y chocan en el número
  for (let intento = 0; intento < 3; intento++) {
    try {
      const orden = await prisma.$transaction(async tx => {
        const max = await tx.ordenCompra.aggregate({ where: { empresa_id: req.empresaId! }, _max: { numero: true } });
        return tx.ordenCompra.create({
          data: {
            ...withTenant(req.empresaId!), numero: (max._max.numero ?? 0) + 1, fecha,
            ...datosOrden(d), subtotal: c.subtotal, iva: c.iva, total: c.total,
            created_by: req.user!.id,
            items: { create: c.filas },
          },
        });
      });
      await registrarAuditoria({
        usuarioId: req.user!.id, empresaId: req.empresaId, eventoId: d.evento_id ?? undefined, accion: 'CREATE', entidad: 'OrdenCompra', entidadId: orden.id,
        descripcion: `Creó la ${formatearNumeroOC(orden.numero)} (borrador) por ${c.total}`, ip: req.ip, tx: prisma,
      });
      res.status(201).json({ ...orden, numero_formateado: formatearNumeroOC(orden.numero) });
      return;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002' && intento < 2) continue;
      throw e;
    }
  }
}

// PUT /api/ordenes-compra/:id — sólo en borrador
export async function updateOrdenCompra(req: Request, res: Response) {
  const id = Number(req.params.id);
  const existing = await prisma.ordenCompra.findFirst({ where: { id, ...withTenant(req.empresaId!), deleted_at: null } });
  if (!existing) { res.status(404).json({ error: 'Orden de compra no encontrada' }); return; }
  if (existing.estado !== 'BORRADOR') { res.status(409).json({ error: 'Sólo se puede editar una orden en borrador. Volvela a borrador primero.' }); return; }
  const parsed = ordenSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return; }
  const d = parsed.data;
  const fecha = parseFechaCalendario(d.fecha);
  if (!fecha) { res.status(400).json({ error: 'Fecha inválida' }); return; }
  const err = await validarRelaciones(req.empresaId!, d.proveedor_id, d.evento_id);
  if (err) { res.status(404).json({ error: err }); return; }
  const c = calcular(d.items, d.iva_porcentaje ?? 21);

  const orden = await prisma.$transaction(async tx => {
    await tx.ordenCompraItem.deleteMany({ where: { orden_id: id } });
    return tx.ordenCompra.update({
      where: { id },
      data: { fecha, ...datosOrden(d), subtotal: c.subtotal, iva: c.iva, total: c.total, items: { create: c.filas } },
    });
  });
  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'UPDATE', entidad: 'OrdenCompra', entidadId: id,
    descripcion: `Editó la ${formatearNumeroOC(orden.numero)}`,
    datosAntes: { total: existing.total }, datosDespues: { total: c.total }, ip: req.ip, tx: prisma,
  });
  res.json(orden);
}

// Transiciones de estado
const TRANSICIONES: Record<string, { desde: EstadoOrdenCompra[]; hacia: EstadoOrdenCompra; verbo: string }> = {
  emitir:          { desde: ['BORRADOR'], hacia: 'EMITIDA', verbo: 'Emitió' },
  'volver-borrador': { desde: ['EMITIDA'], hacia: 'BORRADOR', verbo: 'Volvió a borrador' },
  anular:          { desde: ['BORRADOR', 'EMITIDA', 'RECIBIDA'], hacia: 'ANULADA', verbo: 'Anuló' },
  reabrir:         { desde: ['CERRADA'], hacia: 'RECIBIDA', verbo: 'Reabrió' },
};

// POST /api/ordenes-compra/:id/:accion (emitir | volver-borrador | anular | reabrir)
export async function cambiarEstadoOrden(req: Request, res: Response) {
  const id = Number(req.params.id);
  const t = TRANSICIONES[req.params.accion];
  if (!t) { res.status(404).json({ error: 'Acción desconocida' }); return; }
  const o = await prisma.ordenCompra.findFirst({ where: { id, ...withTenant(req.empresaId!), deleted_at: null }, include: { _count: { select: { facturas: { where: { deleted_at: null } } } } } });
  if (!o) { res.status(404).json({ error: 'Orden de compra no encontrada' }); return; }
  if (!t.desde.includes(o.estado)) { res.status(409).json({ error: `No se puede ${req.params.accion.replace('-', ' ')} una orden ${o.estado.toLowerCase()}` }); return; }
  if ((req.params.accion === 'volver-borrador' || req.params.accion === 'anular') && o._count.facturas > 0) {
    res.status(409).json({ error: 'La orden tiene facturas vinculadas: desvinculalas primero.' }); return;
  }
  const upd = await prisma.ordenCompra.update({
    where: { id },
    data: {
      estado: t.hacia,
      ...(t.hacia === 'EMITIDA' && { emitida_at: new Date(), emitida_por: req.user!.id }),
      ...(t.hacia === 'BORRADOR' && { emitida_at: null, emitida_por: null }),
    },
  });
  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'UPDATE', entidad: 'OrdenCompra', entidadId: id,
    descripcion: `${t.verbo} la ${formatearNumeroOC(o.numero)}`, ip: req.ip, tx: prisma,
  });
  res.json(upd);
}

const recibirSchema = z.object({
  fecha: z.string().optional(),
  items: z.array(z.object({ id: z.number().int(), cantidad_recibida: z.number().min(0) })).min(1),
});

// POST /api/ordenes-compra/:id/recibir — control de lo que llegó (se puede repetir)
export async function recibirOrden(req: Request, res: Response) {
  const id = Number(req.params.id);
  const parsed = recibirSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Datos inválidos' }); return; }
  const o = await prisma.ordenCompra.findFirst({ where: { id, ...withTenant(req.empresaId!), deleted_at: null }, include: { items: true } });
  if (!o) { res.status(404).json({ error: 'Orden de compra no encontrada' }); return; }
  if (o.estado !== 'EMITIDA' && o.estado !== 'RECIBIDA') { res.status(409).json({ error: 'Sólo se registra la recepción de una orden emitida' }); return; }
  const ids = new Set(o.items.map(i => i.id));
  if (parsed.data.items.some(i => !ids.has(i.id))) { res.status(400).json({ error: 'Ítem que no es de esta orden' }); return; }
  const fecha = parsed.data.fecha ? parseFechaCalendario(parsed.data.fecha) : null;

  await prisma.$transaction([
    ...parsed.data.items.map(i => prisma.ordenCompraItem.update({ where: { id: i.id }, data: { cantidad_recibida: i.cantidad_recibida } })),
    prisma.ordenCompra.update({ where: { id }, data: { estado: 'RECIBIDA', recibida_at: fecha ?? o.recibida_at ?? new Date() } }),
  ]);
  const faltan = o.items.filter(it => {
    const r = parsed.data.items.find(x => x.id === it.id)?.cantidad_recibida ?? (it.cantidad_recibida != null ? Number(it.cantidad_recibida) : null);
    return r != null && r < Number(it.cantidad);
  }).length;
  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'UPDATE', entidad: 'OrdenCompra', entidadId: id,
    descripcion: `Registró la recepción de la ${formatearNumeroOC(o.numero)}${faltan ? ` — ${faltan} ítem(s) con faltante` : ' — completa'}`, ip: req.ip, tx: prisma,
  });
  const full = await cargarOrden(id, req.empresaId!);
  res.json({ ...full, numero_formateado: formatearNumeroOC(o.numero), cotejo: cotejo(full!) });
}

// POST /api/ordenes-compra/:id/cerrar — factura cotejada
export async function cerrarOrden(req: Request, res: Response) {
  const id = Number(req.params.id);
  const notas = typeof req.body?.notas_cotejo === 'string' ? req.body.notas_cotejo.trim() || null : null;
  const o = await cargarOrden(id, req.empresaId!);
  if (!o) { res.status(404).json({ error: 'Orden de compra no encontrada' }); return; }
  if (o.estado !== 'EMITIDA' && o.estado !== 'RECIBIDA') { res.status(409).json({ error: 'Sólo se cierra una orden emitida o recibida' }); return; }
  const c = cotejo(o);
  if (c.facturado_total === 0) { res.status(409).json({ error: 'Vinculá la factura antes de cerrar la orden' }); return; }
  if (!c.coincide && !notas) {
    res.status(409).json({ error: `Lo facturado difiere de la orden en ${c.diferencia_total.toLocaleString('es-AR')}: anotá el motivo para cerrarla igual` }); return;
  }
  const upd = await prisma.ordenCompra.update({ where: { id }, data: { estado: 'CERRADA', notas_cotejo: notas } });
  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'UPDATE', entidad: 'OrdenCompra', entidadId: id,
    descripcion: `Cerró la ${formatearNumeroOC(o.numero)} — facturado ${c.facturado_total}, diferencia ${c.diferencia_total}${notas ? ` (${notas})` : ''}`, ip: req.ip, tx: prisma,
  });
  res.json(upd);
}

// DELETE /api/ordenes-compra/:id — sólo borradores (el número queda salteado)
export async function deleteOrdenCompra(req: Request, res: Response) {
  const id = Number(req.params.id);
  const o = await prisma.ordenCompra.findFirst({ where: { id, ...withTenant(req.empresaId!), deleted_at: null } });
  if (!o) { res.status(404).json({ error: 'Orden de compra no encontrada' }); return; }
  if (o.estado !== 'BORRADOR') { res.status(409).json({ error: 'Sólo se elimina un borrador; una orden emitida se anula' }); return; }
  await prisma.ordenCompra.update({ where: { id }, data: { deleted_at: new Date() } });
  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'DELETE', entidad: 'OrdenCompra', entidadId: id,
    descripcion: `Eliminó el borrador ${formatearNumeroOC(o.numero)}`, ip: req.ip, tx: prisma,
  });
  res.json({ ok: true });
}

// ── Facturas de la orden ─────────────────────────────────────────────────────

// GET /api/ordenes-compra/:id/facturas-disponibles — del mismo proveedor, sin orden
export async function facturasDisponibles(req: Request, res: Response) {
  const o = await prisma.ordenCompra.findFirst({ where: { id: Number(req.params.id), ...withTenant(req.empresaId!), deleted_at: null } });
  if (!o) { res.status(404).json({ error: 'Orden de compra no encontrada' }); return; }
  const facturas = await prisma.factura.findMany({
    where: { empresa_id: req.empresaId!, proveedor_id: o.proveedor_id, deleted_at: null, orden_compra_id: null, estado: { not: 'ANULADA' } },
    orderBy: { fecha_emision: 'desc' },
    take: 50,
    select: { id: true, numero_factura: true, tipo_factura: true, fecha_emision: true, importe_total: true, estado: true },
  });
  res.json(facturas);
}

// POST /api/ordenes-compra/:id/facturas { factura_id }
export async function vincularFactura(req: Request, res: Response) {
  const id = Number(req.params.id);
  const facturaId = Number(req.body?.factura_id);
  const o = await prisma.ordenCompra.findFirst({ where: { id, ...withTenant(req.empresaId!), deleted_at: null } });
  if (!o) { res.status(404).json({ error: 'Orden de compra no encontrada' }); return; }
  if (o.estado === 'BORRADOR' || o.estado === 'ANULADA' || o.estado === 'CERRADA') { res.status(409).json({ error: 'Las facturas se vinculan a una orden emitida o recibida' }); return; }
  const f = await prisma.factura.findFirst({ where: { id: facturaId, empresa_id: req.empresaId!, deleted_at: null } });
  if (!f) { res.status(404).json({ error: 'Factura no encontrada' }); return; }
  if (f.proveedor_id !== o.proveedor_id) { res.status(400).json({ error: 'La factura es de otro proveedor' }); return; }
  if (f.orden_compra_id && f.orden_compra_id !== id) { res.status(409).json({ error: 'La factura ya está vinculada a otra orden de compra' }); return; }
  await prisma.factura.update({ where: { id: facturaId }, data: { orden_compra_id: id } });
  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'UPDATE', entidad: 'OrdenCompra', entidadId: id,
    descripcion: `Vinculó la factura ${f.tipo_factura} ${f.numero_factura} a la ${formatearNumeroOC(o.numero)}`, ip: req.ip, tx: prisma,
  });
  const full = await cargarOrden(id, req.empresaId!);
  res.json({ ...full, numero_formateado: formatearNumeroOC(o.numero), cotejo: cotejo(full!) });
}

// DELETE /api/ordenes-compra/:id/facturas/:facturaId
export async function desvincularFactura(req: Request, res: Response) {
  const id = Number(req.params.id);
  const facturaId = Number(req.params.facturaId);
  const o = await prisma.ordenCompra.findFirst({ where: { id, ...withTenant(req.empresaId!), deleted_at: null } });
  if (!o) { res.status(404).json({ error: 'Orden de compra no encontrada' }); return; }
  if (o.estado === 'CERRADA') { res.status(409).json({ error: 'La orden está cerrada: reabrila primero' }); return; }
  const r = await prisma.factura.updateMany({ where: { id: facturaId, empresa_id: req.empresaId!, orden_compra_id: id }, data: { orden_compra_id: null } });
  if (r.count === 0) { res.status(404).json({ error: 'La factura no está vinculada a esta orden' }); return; }
  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'UPDATE', entidad: 'OrdenCompra', entidadId: id,
    descripcion: `Desvinculó la factura #${facturaId} de la ${formatearNumeroOC(o.numero)}`, ip: req.ip, tx: prisma,
  });
  res.json({ ok: true });
}

// ── PDF ──────────────────────────────────────────────────────────────────────

// GET /api/ordenes-compra/:id/pdf
export async function pdfOrdenCompra(req: Request, res: Response) {
  const o = await cargarOrden(Number(req.params.id), req.empresaId!);
  if (!o) { res.status(404).json({ error: 'Orden de compra no encontrada' }); return; }
  const empresa = await prisma.empresa.findUniqueOrThrow({
    where:  { id: o.empresa_id },
    select: { id: true, nombre: true, razon_social: true, cuit: true, domicilio: true, telefono: true, email: true, logo_data: true, logo_mime: true },
  });
  const html = templateOrdenCompra({
    empresa: {
      nombre:    empresa.razon_social ?? empresa.nombre,
      cuit:      empresa.cuit ?? (empresa.id === EMPRESAS.DOS57 ? CUIT_DOS57_FALLBACK : null),
      domicilio: empresa.domicilio,
      telefono:  empresa.telefono,
      email:     empresa.email,
      logo:      empresa.logo_data && empresa.logo_mime ? `data:${empresa.logo_mime};base64,${Buffer.from(empresa.logo_data).toString('base64')}` : null,
    },
    numero:   formatearNumeroOC(o.numero),
    borrador: o.estado === 'BORRADOR',
    anulada:  o.estado === 'ANULADA',
    fecha:    o.fecha,
    proveedor: { nombre: o.proveedor.nombre, cuit: o.proveedor.cuit, contacto: o.contacto, telefono: o.telefono ?? o.proveedor.telefono, domicilio: o.domicilio, ciudad: o.ciudad },
    entrega: o.entrega, direccion_entrega: o.direccion_entrega, plazo_pago: o.plazo_pago, forma_pago: o.forma_pago,
    referencia: o.referencia_proveedor, evento: o.evento?.nombre ?? null, notas: o.notas,
    moneda: o.moneda,
    items: o.items.map(i => ({ n: i.orden_item, codigo: i.codigo, descripcion: i.descripcion, cantidad: Number(i.cantidad), precio: Number(i.precio_unitario), total: Number(i.total) })),
    subtotal: Number(o.subtotal), iva_porcentaje: Number(o.iva_porcentaje), iva: Number(o.iva), total: Number(o.total),
  });
  const numero = formatearNumeroOC(o.numero);
  const buffer = await renderRemitoPDF(html, `${numero} · ${o.proveedor.nombre}`);
  const slug = o.proveedor.nombre.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').substring(0, 40);
  res.set({
    'Content-Type':        'application/pdf',
    'Content-Disposition': `inline; filename="Orden-de-compra-${String(o.numero).padStart(6, '0')}-${slug}.pdf"`,
    'Content-Length':      String(buffer.length),
  });
  res.end(buffer);
}
