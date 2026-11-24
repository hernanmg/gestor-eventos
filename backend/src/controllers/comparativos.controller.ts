import type { Request, Response } from 'express';
import { z } from 'zod';
import { EstadoComparativo, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { registrarAuditoria } from '../lib/auditoria';
import { withTenant } from '../lib/tenant';
import { parseFechaCalendario } from '../lib/vencimientos';
import { EMPRESAS } from '../lib/empresasConstants';
import { renderRemitoPDF } from '../lib/pdfExporter';
import { templateComparativo } from '../lib/pdfTemplates/comparativo';
import { CUIT_DOS57_FALLBACK } from './remitos.controller';
import { crearOrdenCompra, datosUltimaOrden, formatearNumeroOC } from './ordenesCompra.controller';

// ── Comparativo de presupuestos de proveedores (Proveedores, punto 15) ───────
// Los mismos artículos cotizados por varios proveedores. ABIERTO: se cargan y
// corrigen las cotizaciones → DECIDIDO: se elige una (con motivo si no es la
// más barata) → se arma la orden de compra en borrador con esos precios.
// ANULADO si no se compra.

export const formatearNumeroCP = (n: number) => `CP ${String(n).padStart(6, '0')}`;

const round2 = (n: number) => Math.round(n * 100) / 100;
const TOLERANCIA = 1; // $1 de redondeo para decir que dos totales empatan

const itemSchema = z.object({
  codigo:      z.string().nullable().optional(),
  descripcion: z.string().trim().min(1, 'Cada artículo necesita una descripción'),
  cantidad:    z.number().positive('La cantidad tiene que ser mayor a cero'),
});

const cotizacionSchema = z.object({
  proveedor_id:   z.number().int(),
  referencia:     z.string().nullable().optional(),
  fecha:          z.string().nullable().optional(),
  validez:        z.string().nullable().optional(),
  plazo_entrega:  z.string().nullable().optional(),
  plazo_pago:     z.string().nullable().optional(),
  forma_pago:     z.string().nullable().optional(),
  iva_porcentaje: z.number().min(0).max(100).optional(),
  notas:          z.string().nullable().optional(),
  precios:        z.array(z.number().min(0).nullable()),
});

const comparativoSchema = z.object({
  fecha:        z.string().min(1),
  titulo:       z.string().trim().min(1, 'Poné qué se compra'),
  evento_id:    z.number().int().nullable().optional(),
  moneda:       z.enum(['ARS', 'USD', 'EUR']).optional(),
  notas:        z.string().nullable().optional(),
  items:        z.array(itemSchema).min(1, 'Cargá al menos un artículo'),
  cotizaciones: z.array(cotizacionSchema),
});

type ComparativoInput = z.infer<typeof comparativoSchema>;

function totalesCotizacion(items: { cantidad: number }[], precios: (number | null)[], ivaPct: number) {
  const subtotal = round2(items.reduce((n, it, i) => n + (precios[i] != null ? it.cantidad * precios[i]! : 0), 0));
  return { subtotal, total: round2(subtotal + round2(subtotal * ivaPct / 100)) };
}

async function validar(d: ComparativoInput, empresaId: number): Promise<string | null> {
  const ids = d.cotizaciones.map(c => c.proveedor_id);
  if (new Set(ids).size !== ids.length) return 'Hay un proveedor cargado dos veces';
  for (const c of d.cotizaciones) {
    if (c.precios.length !== d.items.length) return 'Cada cotización tiene que tener un precio (o vacío) por artículo';
    if (c.precios.every(p => p == null)) return 'Hay una cotización sin ningún precio';
  }
  if (ids.length) {
    const n = await prisma.proveedor.count({ where: { id: { in: ids }, deleted_at: null } });
    if (n !== ids.length) return 'Proveedor no encontrado';
  }
  if (d.evento_id) {
    const ev = await prisma.evento.findFirst({ where: { id: d.evento_id, empresa_id: empresaId, deleted_at: null }, select: { id: true } });
    if (!ev) return 'Evento no encontrado';
  }
  return null;
}

function datosHijos(d: ComparativoInput) {
  const items = d.items.map((it, i) => ({ orden_item: i + 1, codigo: it.codigo || null, descripcion: it.descripcion, cantidad: it.cantidad }));
  const cotizaciones = d.cotizaciones.map((c, i) => {
    const iva = c.iva_porcentaje ?? 21;
    const t = totalesCotizacion(d.items, c.precios, iva);
    return {
      orden: i + 1, proveedor_id: c.proveedor_id, referencia: c.referencia || null,
      fecha: c.fecha ? parseFechaCalendario(c.fecha) : null,
      validez: c.validez || null, plazo_entrega: c.plazo_entrega || null, plazo_pago: c.plazo_pago || null, forma_pago: c.forma_pago || null,
      iva_porcentaje: iva, notas: c.notas || null, precios: c.precios as Prisma.InputJsonValue, subtotal: t.subtotal, total: t.total,
    };
  });
  return { items, cotizaciones };
}

const include = {
  items:        { orderBy: { orden_item: 'asc' as const } },
  cotizaciones: { orderBy: { orden: 'asc' as const }, include: { proveedor: { select: { id: true, nombre: true, cuit: true } } } },
  evento:       { select: { id: true, nombre: true } },
  orden_compra: { select: { id: true, numero: true, estado: true, deleted_at: true } },
} satisfies Prisma.ComparativoCompraInclude;

async function cargar(id: number, empresaId: number) {
  return prisma.comparativoCompra.findFirst({ where: { id, empresa_id: empresaId, deleted_at: null }, include });
}
type Cargado = NonNullable<Awaited<ReturnType<typeof cargar>>>;

// El cuadro: precio más bajo de cada artículo y la cotización más barata
function analizar(c: Cargado) {
  const precios = c.cotizaciones.map(q => (q.precios as (number | null)[]) ?? []);
  const minimos = c.items.map((_, i) => {
    const vals = precios.map(p => p[i]).filter((v): v is number => v != null);
    return vals.length ? Math.min(...vals) : null;
  });
  const cot = c.cotizaciones.map((q, k) => {
    const cotizados = precios[k].filter(v => v != null).length;
    return {
      id: q.id, cotizados, completa: cotizados === c.items.length,
      mas_bajos: c.items.filter((_, i) => precios[k][i] != null && minimos[i] != null && Math.abs(precios[k][i]! - minimos[i]!) < 0.005).length,
      total: Number(q.total),
    };
  });
  const completas = cot.filter(x => x.completa);
  const base = completas.length ? completas : cot;
  const min = base.length ? Math.min(...base.map(x => x.total)) : null;
  const masBaratas = min == null ? [] : base.filter(x => x.total - min <= TOLERANCIA).map(x => x.id);
  // Comprando cada artículo al que lo cotizó más barato (referencia)
  const optimo = round2(c.items.reduce((n, it, i) => n + (minimos[i] != null ? Number(it.cantidad) * minimos[i]! : 0), 0));
  return { minimos, cotizaciones: cot, mas_baratas: masBaratas, hay_completas: completas.length > 0, subtotal_optimo: optimo };
}

function ocVigente(c: Cargado) {
  return c.orden_compra && !c.orden_compra.deleted_at && c.orden_compra.estado !== 'ANULADA' ? c.orden_compra : null;
}

function mapear(c: Cargado) {
  return {
    ...c,
    numero_formateado: formatearNumeroCP(c.numero),
    cotizaciones: c.cotizaciones.map(q => ({ ...q, precios: q.precios as (number | null)[], subtotal: Number(q.subtotal), total: Number(q.total), iva_porcentaje: Number(q.iva_porcentaje) })),
    items: c.items.map(i => ({ ...i, cantidad: Number(i.cantidad) })),
    orden_compra: ocVigente(c) ? { id: c.orden_compra!.id, numero: formatearNumeroOC(c.orden_compra!.numero), estado: c.orden_compra!.estado } : null,
    analisis: analizar(c),
  };
}

// GET /api/comparativos
export async function listComparativos(req: Request, res: Response) {
  const { estado, q } = req.query as { estado?: string; q?: string };
  const lista = await prisma.comparativoCompra.findMany({
    where: {
      ...withTenant(req.empresaId!), deleted_at: null,
      ...(estado && { estado: estado as EstadoComparativo }),
      ...(q && {
        OR: [
          { titulo: { contains: q, mode: 'insensitive' as const } },
          { items: { some: { descripcion: { contains: q, mode: 'insensitive' as const } } } },
          { cotizaciones: { some: { proveedor: { nombre: { contains: q, mode: 'insensitive' as const } } } } },
          ...(/^\d+$/.test(q) ? [{ numero: Number(q) }] : []),
        ],
      }),
    },
    orderBy: [{ fecha: 'desc' }, { numero: 'desc' }],
    include,
  });
  res.json(lista.map(c => {
    const a = analizar(c);
    const elegida = c.cotizaciones.find(q => q.id === c.cotizacion_elegida_id);
    return {
      id: c.id, numero: c.numero, numero_formateado: formatearNumeroCP(c.numero), fecha: c.fecha, titulo: c.titulo, estado: c.estado, moneda: c.moneda,
      evento: c.evento, cant_items: c.items.length,
      cotizaciones: c.cotizaciones.map(q => ({ id: q.id, proveedor: q.proveedor.nombre, total: Number(q.total), mas_barata: a.mas_baratas.includes(q.id) })),
      elegida: elegida ? { proveedor: elegida.proveedor.nombre, total: Number(elegida.total) } : null,
      orden_compra: ocVigente(c) ? { id: c.orden_compra!.id, numero: formatearNumeroOC(c.orden_compra!.numero) } : null,
    };
  }));
}

// GET /api/comparativos/:id
export async function getComparativo(req: Request, res: Response) {
  const c = await cargar(Number(req.params.id), req.empresaId!);
  if (!c) { res.status(404).json({ error: 'Comparativo no encontrado' }); return; }
  res.json(mapear(c));
}

// POST /api/comparativos
export async function createComparativo(req: Request, res: Response) {
  const parsed = comparativoSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }); return; }
  const d = parsed.data;
  const fecha = parseFechaCalendario(d.fecha);
  if (!fecha) { res.status(400).json({ error: 'Fecha inválida' }); return; }
  const err = await validar(d, req.empresaId!);
  if (err) { res.status(400).json({ error: err }); return; }
  const h = datosHijos(d);
  for (let intento = 0; ; intento++) {
    try {
      const c = await prisma.$transaction(async tx => {
        const max = await tx.comparativoCompra.aggregate({ where: { empresa_id: req.empresaId! }, _max: { numero: true } });
        return tx.comparativoCompra.create({
          data: {
            ...withTenant(req.empresaId!), numero: (max._max.numero ?? 0) + 1, fecha, titulo: d.titulo,
            evento_id: d.evento_id ?? null, moneda: d.moneda ?? 'ARS', notas: d.notas || null, created_by: req.user!.id,
            items: { create: h.items }, cotizaciones: { create: h.cotizaciones },
          },
        });
      });
      await registrarAuditoria({
        usuarioId: req.user!.id, empresaId: req.empresaId, eventoId: d.evento_id ?? undefined, accion: 'CREATE', entidad: 'ComparativoCompra', entidadId: c.id,
        descripcion: `Creó el comparativo ${formatearNumeroCP(c.numero)} "${d.titulo}" con ${d.cotizaciones.length} cotización(es)`, ip: req.ip, tx: prisma,
      });
      res.status(201).json({ id: c.id, numero_formateado: formatearNumeroCP(c.numero) });
      return;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002' && intento < 2) continue;
      throw e;
    }
  }
}

// PUT /api/comparativos/:id — sólo abierto; reemplaza artículos y cotizaciones
export async function updateComparativo(req: Request, res: Response) {
  const id = Number(req.params.id);
  const parsed = comparativoSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }); return; }
  const c = await prisma.comparativoCompra.findFirst({ where: { id, ...withTenant(req.empresaId!), deleted_at: null } });
  if (!c) { res.status(404).json({ error: 'Comparativo no encontrado' }); return; }
  if (c.estado !== 'ABIERTO') { res.status(409).json({ error: 'Sólo se edita un comparativo abierto: reabrilo primero' }); return; }
  const d = parsed.data;
  const fecha = parseFechaCalendario(d.fecha);
  if (!fecha) { res.status(400).json({ error: 'Fecha inválida' }); return; }
  const err = await validar(d, req.empresaId!);
  if (err) { res.status(400).json({ error: err }); return; }
  const h = datosHijos(d);
  await prisma.$transaction([
    prisma.comparativoItem.deleteMany({ where: { comparativo_id: id } }),
    prisma.cotizacionProveedor.deleteMany({ where: { comparativo_id: id } }),
    prisma.comparativoCompra.update({
      where: { id },
      data: {
        fecha, titulo: d.titulo, evento_id: d.evento_id ?? null, moneda: d.moneda ?? 'ARS', notas: d.notas || null,
        items: { create: h.items }, cotizaciones: { create: h.cotizaciones },
      },
    }),
  ]);
  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'UPDATE', entidad: 'ComparativoCompra', entidadId: id,
    descripcion: `Editó el comparativo ${formatearNumeroCP(c.numero)} (${d.cotizaciones.length} cotización(es))`, ip: req.ip, tx: prisma,
  });
  res.json(mapear((await cargar(id, req.empresaId!))!));
}

// DELETE /api/comparativos/:id — sólo abierto (el número queda salteado)
export async function deleteComparativo(req: Request, res: Response) {
  const id = Number(req.params.id);
  const c = await prisma.comparativoCompra.findFirst({ where: { id, ...withTenant(req.empresaId!), deleted_at: null } });
  if (!c) { res.status(404).json({ error: 'Comparativo no encontrado' }); return; }
  if (c.estado !== 'ABIERTO') { res.status(409).json({ error: 'Sólo se elimina un comparativo abierto' }); return; }
  await prisma.comparativoCompra.update({ where: { id }, data: { deleted_at: new Date() } });
  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'DELETE', entidad: 'ComparativoCompra', entidadId: id,
    descripcion: `Eliminó el comparativo ${formatearNumeroCP(c.numero)}`, ip: req.ip, tx: prisma,
  });
  res.json({ ok: true });
}

// POST /api/comparativos/:id/elegir { cotizacion_id, motivo }
export async function elegirCotizacion(req: Request, res: Response) {
  const id = Number(req.params.id);
  const cotizacionId = Number(req.body?.cotizacion_id);
  const motivo = typeof req.body?.motivo === 'string' ? req.body.motivo.trim() : '';
  const c = await cargar(id, req.empresaId!);
  if (!c) { res.status(404).json({ error: 'Comparativo no encontrado' }); return; }
  if (c.estado !== 'ABIERTO') { res.status(409).json({ error: 'El comparativo no está abierto' }); return; }
  const q = c.cotizaciones.find(x => x.id === cotizacionId);
  if (!q) { res.status(400).json({ error: 'Esa cotización no es de este comparativo' }); return; }
  const a = analizar(c);
  const info = a.cotizaciones.find(x => x.id === q.id)!;
  if ((!a.mas_baratas.includes(q.id) || !info.completa) && !motivo) {
    res.status(400).json({ error: info.completa ? 'No es la más barata: anotá por qué se elige' : 'No cotizó todos los artículos: anotá por qué se elige' });
    return;
  }
  await prisma.comparativoCompra.update({
    where: { id },
    data: { estado: 'DECIDIDO', cotizacion_elegida_id: q.id, motivo_eleccion: motivo || null, decidido_por: req.user!.id, decidido_at: new Date() },
  });
  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'UPDATE', entidad: 'ComparativoCompra', entidadId: id,
    descripcion: `Eligió a ${q.proveedor.nombre} (${Number(q.total)}) en el comparativo ${formatearNumeroCP(c.numero)}${motivo ? ` — ${motivo}` : ''}`, ip: req.ip, tx: prisma,
  });
  res.json(mapear((await cargar(id, req.empresaId!))!));
}

// POST /api/comparativos/:id/:accion (reabrir | anular)
export async function cambiarEstadoComparativo(req: Request, res: Response) {
  const id = Number(req.params.id);
  const accion = req.params.accion;
  if (accion !== 'reabrir' && accion !== 'anular') { res.status(404).json({ error: 'Acción desconocida' }); return; }
  const c = await cargar(id, req.empresaId!);
  if (!c) { res.status(404).json({ error: 'Comparativo no encontrado' }); return; }
  if (ocVigente(c)) { res.status(409).json({ error: `Ya se armó la ${formatearNumeroOC(c.orden_compra!.numero)}: anulala primero` }); return; }
  if (accion === 'reabrir' && c.estado !== 'DECIDIDO' && c.estado !== 'ANULADO') { res.status(409).json({ error: 'El comparativo ya está abierto' }); return; }
  if (accion === 'anular' && c.estado === 'ANULADO') { res.status(409).json({ error: 'Ya está anulado' }); return; }
  await prisma.comparativoCompra.update({
    where: { id },
    data: accion === 'reabrir'
      ? { estado: 'ABIERTO', cotizacion_elegida_id: null, motivo_eleccion: null, decidido_por: null, decidido_at: null, orden_compra_id: null }
      : { estado: 'ANULADO', orden_compra_id: null },
  });
  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'UPDATE', entidad: 'ComparativoCompra', entidadId: id,
    descripcion: `${accion === 'reabrir' ? 'Reabrió' : 'Anuló'} el comparativo ${formatearNumeroCP(c.numero)}`, ip: req.ip, tx: prisma,
  });
  res.json(mapear((await cargar(id, req.empresaId!))!));
}

// POST /api/comparativos/:id/orden-compra — arma la OC (borrador) con la cotización elegida
export async function armarOrdenCompra(req: Request, res: Response) {
  const id = Number(req.params.id);
  const c = await cargar(id, req.empresaId!);
  if (!c) { res.status(404).json({ error: 'Comparativo no encontrado' }); return; }
  if (c.estado !== 'DECIDIDO') { res.status(409).json({ error: 'Primero elegí una cotización' }); return; }
  if (ocVigente(c)) { res.status(409).json({ error: `Ya se armó la ${formatearNumeroOC(c.orden_compra!.numero)}` }); return; }
  const q = c.cotizaciones.find(x => x.id === c.cotizacion_elegida_id)!;
  const precios = q.precios as (number | null)[];
  const items = c.items
    .map((it, i) => ({ codigo: it.codigo, descripcion: it.descripcion, cantidad: Number(it.cantidad), precio_unitario: precios[i] }))
    .filter((it): it is typeof it & { precio_unitario: number } => it.precio_unitario != null);
  const sinPrecio = c.items.length - items.length;
  const prev = await datosUltimaOrden(req.empresaId!, q.proveedor_id);
  const hoy = new Date();
  const r = await crearOrdenCompra({
    fecha: `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`,
    proveedor_id: q.proveedor_id, evento_id: c.evento_id,
    contacto: prev.contacto ?? null, telefono: prev.telefono ?? null, domicilio: prev.domicilio ?? null, ciudad: prev.ciudad ?? null,
    entrega: prev.entrega ?? null, direccion_entrega: prev.direccion_entrega ?? null,
    plazo_pago: q.plazo_pago ?? prev.plazo_pago ?? null, forma_pago: q.forma_pago ?? prev.forma_pago ?? null,
    referencia_proveedor: q.referencia, moneda: c.moneda, iva_porcentaje: Number(q.iva_porcentaje),
    notas: `Del comparativo ${formatearNumeroCP(c.numero)}${c.motivo_eleccion ? ` — ${c.motivo_eleccion}` : ''}`,
    items,
  }, req.empresaId!, req.user!.id, req.ip);
  if (r.status !== 201) { res.status(r.status).json(r.body); return; }
  await prisma.comparativoCompra.update({ where: { id }, data: { orden_compra_id: r.body.id } });
  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'UPDATE', entidad: 'ComparativoCompra', entidadId: id,
    descripcion: `Armó la ${r.body.numero_formateado} desde el comparativo ${formatearNumeroCP(c.numero)}`, ip: req.ip, tx: prisma,
  });
  res.status(201).json({ orden_compra_id: r.body.id, numero: r.body.numero_formateado, articulos_sin_precio: sinPrecio });
}

// GET /api/comparativos/:id/pdf — el cuadro para presentar
export async function pdfComparativo(req: Request, res: Response) {
  const c = await cargar(Number(req.params.id), req.empresaId!);
  if (!c) { res.status(404).json({ error: 'Comparativo no encontrado' }); return; }
  const empresa = await prisma.empresa.findUniqueOrThrow({
    where:  { id: c.empresa_id },
    select: { id: true, nombre: true, razon_social: true, cuit: true, logo_data: true, logo_mime: true },
  });
  const m = mapear(c);
  const html = templateComparativo({
    empresa: {
      nombre: empresa.razon_social ?? empresa.nombre,
      cuit:   empresa.cuit ?? (empresa.id === EMPRESAS.DOS57 ? CUIT_DOS57_FALLBACK : null),
      logo:   empresa.logo_data && empresa.logo_mime ? `data:${empresa.logo_mime};base64,${Buffer.from(empresa.logo_data).toString('base64')}` : null,
    },
    numero: m.numero_formateado, fecha: c.fecha, titulo: c.titulo, evento: c.evento?.nombre ?? null, moneda: c.moneda, notas: c.notas,
    anulado: c.estado === 'ANULADO',
    items: m.items.map(i => ({ n: i.orden_item, codigo: i.codigo, descripcion: i.descripcion, cantidad: i.cantidad })),
    cotizaciones: m.cotizaciones.map(q => ({
      id: q.id, proveedor: q.proveedor.nombre, referencia: q.referencia, plazo_entrega: q.plazo_entrega, plazo_pago: q.plazo_pago, forma_pago: q.forma_pago, validez: q.validez,
      precios: q.precios, subtotal: q.subtotal, iva_porcentaje: q.iva_porcentaje, total: q.total,
    })),
    minimos: m.analisis.minimos,
    mas_baratas: m.analisis.mas_baratas,
    elegida_id: c.cotizacion_elegida_id, motivo: c.motivo_eleccion,
  });
  const buffer = await renderRemitoPDF(html, `${m.numero_formateado} · ${c.titulo}`);
  res.set({
    'Content-Type':        'application/pdf',
    'Content-Disposition': `inline; filename="Comparativo-${String(c.numero).padStart(6, '0')}.pdf"`,
    'Content-Length':      String(buffer.length),
  });
  res.end(buffer);
}
