import type { Request, Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { Prisma, TipoCruceMaterial } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { registrarAuditoria } from '../lib/auditoria';
import { withTenant } from '../lib/tenant';
import { parseFechaCalendario } from '../lib/vencimientos';
import {
  esTemporal, aplicarStockCompraVenta, StockCruceNegativo, valoresCruce, leerPlanillaCruce, TIPO_CRUCE_LABEL,
} from '../lib/cruceMaterial';

// ── Cruce de material con terceros (Depósito 5) ──────────────────────────────

export const uploadPlanillaCruce = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

const INCLUDE = {
  items: { orderBy: { orden: 'asc' }, include: { producto: { select: { id: true, nombre: true, codigo_externo: true, codigo_interno: true } } } },
  evento: { select: { id: true, nombre: true } },
} satisfies Prisma.CruceMaterialInclude;
type CruceFull = Prisma.CruceMaterialGetPayload<{ include: typeof INCLUDE }>;

function mapCruce(c: CruceFull) {
  const pendientes = c.items.reduce((a, i) => a + Math.max(0, i.cantidad - i.cantidad_devuelta), 0);
  return {
    ...c,
    tasa_euro: c.tasa_euro != null ? Number(c.tasa_euro) : null,
    porcentaje_alquiler: c.porcentaje_alquiler != null ? Number(c.porcentaje_alquiler) : null,
    items: c.items.map(i => ({ ...i, valor_unitario_eur: i.valor_unitario_eur != null ? Number(i.valor_unitario_eur) : null })),
    temporal: esTemporal(c.tipo),
    piezas: c.items.reduce((a, i) => a + i.cantidad, 0),
    pendientes,
    ...valoresCruce(c),
  };
}

const itemSchema = z.object({
  producto_id:        z.number().int().nullable().optional(),
  descripcion:        z.string().trim().min(1, 'Falta la descripción de una pieza'),
  cantidad:           z.number().int().positive('La cantidad tiene que ser mayor a cero'),
  valor_unitario_eur: z.number().nonnegative().nullable().optional(),
});
const cruceSchema = z.object({
  tercero:             z.string().trim().min(1, 'Indicá con quién es'),
  tipo:                z.nativeEnum(TipoCruceMaterial),
  fecha_desde:         z.string().min(1, 'Indicá la fecha'),
  fecha_hasta:         z.string().nullable().optional(),
  evento_id:           z.number().int().nullable().optional(),
  referencia:          z.string().nullable().optional(),
  tasa_euro:           z.number().positive().nullable().optional(),
  porcentaje_alquiler: z.number().nonnegative().max(100).nullable().optional(),
  notas:               z.string().nullable().optional(),
  import_key:          z.string().nullable().optional(),
  items:               z.array(itemSchema).min(1, 'Cargá al menos una pieza'),
});

async function validar(empresaId: number, d: z.infer<typeof cruceSchema>) {
  const desde = parseFechaCalendario(d.fecha_desde);
  if (!desde) return { error: 'Fecha inválida' } as const;
  const hasta = d.fecha_hasta ? parseFechaCalendario(d.fecha_hasta) : null;
  if (d.fecha_hasta && !hasta) return { error: 'Fecha de devolución inválida' } as const;
  if (hasta && hasta < desde) return { error: 'La devolución no puede ser antes de la salida' } as const;
  if (!esTemporal(d.tipo) && hasta) return { error: 'Una compra o venta no tiene fecha de devolución' } as const;
  const prodIds = [...new Set(d.items.map(i => i.producto_id).filter((x): x is number => !!x))];
  if (prodIds.length) {
    const n = await prisma.producto.count({ where: { id: { in: prodIds }, empresa_id: empresaId, deleted_at: null } });
    if (n !== prodIds.length) return { error: 'Hay una pieza con un producto que no es de la empresa' } as const;
  }
  if (d.evento_id) {
    const ev = await prisma.evento.findFirst({ where: { id: d.evento_id, empresa_id: empresaId, deleted_at: null }, select: { id: true } });
    if (!ev) return { error: 'Evento no encontrado' } as const;
  }
  return { desde, hasta } as const;
}

const itemsData = (items: z.infer<typeof itemSchema>[]) => items.map((i, k) => ({
  producto_id: i.producto_id ?? null, descripcion: i.descripcion, cantidad: i.cantidad,
  valor_unitario_eur: i.valor_unitario_eur ?? null, orden: k,
}));

// GET /stock/cruces
export async function listCruces(req: Request, res: Response) {
  const estado = typeof req.query.estado === 'string' ? req.query.estado : undefined;
  const cruces = await prisma.cruceMaterial.findMany({
    where: { ...withTenant(req.empresaId!), deleted_at: null, ...(estado === 'abiertos' ? { estado: 'ABIERTO' as const } : {}) },
    orderBy: [{ fecha_desde: 'desc' }, { id: 'desc' }],
    include: INCLUDE,
  });
  const terceros = [...new Set(cruces.map(c => c.tercero))].sort((a, b) => a.localeCompare(b));
  res.json({ cruces: cruces.map(mapCruce), terceros });
}

// POST /stock/cruces
export async function createCruce(req: Request, res: Response) {
  const parsed = cruceSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }); return; }
  const d = parsed.data;
  const empresaId = req.empresaId!;
  const v = await validar(empresaId, d);
  if ('error' in v) { res.status(400).json({ error: v.error }); return; }
  if (d.import_key) {
    const prev = await prisma.cruceMaterial.findFirst({ where: { empresa_id: empresaId, import_key: d.import_key } });
    if (prev && !prev.deleted_at && prev.estado !== 'ANULADO') { res.status(400).json({ error: 'Esa hoja de la planilla ya se cargó' }); return; }
    if (prev) await prisma.cruceMaterial.update({ where: { id: prev.id }, data: { import_key: null } });
  }
  const temporal = esTemporal(d.tipo);
  try {
    const c = await prisma.$transaction(async tx => {
      const creado = await tx.cruceMaterial.create({
        data: {
          empresa_id: empresaId, tercero: d.tercero, tipo: d.tipo,
          estado: temporal ? 'ABIERTO' : 'CERRADO', fecha_desde: v.desde, fecha_hasta: v.hasta,
          fecha_cierre: temporal ? null : v.desde,
          evento_id: d.evento_id ?? null, referencia: d.referencia || null,
          tasa_euro: d.tasa_euro ?? null, porcentaje_alquiler: d.porcentaje_alquiler ?? null,
          notas: d.notas || null, import_key: d.import_key || null, created_by: req.user!.id,
          items: { create: itemsData(d.items) },
        },
      });
      await aplicarStockCompraVenta(tx, creado.id, 1);
      return creado;
    });
    await registrarAuditoria({
      usuarioId: req.user!.id, empresaId, accion: 'CREATE', entidad: 'CruceMaterial', entidadId: c.id,
      descripcion: `${TIPO_CRUCE_LABEL[d.tipo]} de material con ${d.tercero} (${d.items.length} pieza/s)${d.import_key ? ' desde la planilla' : ''}`,
      ip: req.ip, tx: prisma,
    });
    const full = await prisma.cruceMaterial.findUniqueOrThrow({ where: { id: c.id }, include: INCLUDE });
    res.status(201).json(mapCruce(full));
  } catch (e) {
    if (e instanceof StockCruceNegativo) { res.status(400).json({ error: `${e.message}: revisá las cantidades` }); return; }
    throw e;
  }
}

// PUT /stock/cruces/:id — alquileres y préstamos abiertos (las piezas ya
// devueltas no se pueden bajar por debajo de lo devuelto). Compra y venta: sólo
// datos generales; para cambiar las piezas, anular y cargar de nuevo.
export async function updateCruce(req: Request, res: Response) {
  const id = Number(req.params.id);
  const c = await prisma.cruceMaterial.findFirst({ where: { id, deleted_at: null, ...withTenant(req.empresaId!) }, include: { items: true } });
  if (!c) { res.status(404).json({ error: 'Operación no encontrada' }); return; }
  if (c.estado === 'ANULADO') { res.status(400).json({ error: 'La operación está anulada' }); return; }
  const parsed = cruceSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }); return; }
  const d = parsed.data;
  if (d.tipo !== c.tipo) { res.status(400).json({ error: 'No se puede cambiar el tipo: anulala y cargala de nuevo' }); return; }
  const v = await validar(req.empresaId!, d);
  if ('error' in v) { res.status(400).json({ error: v.error }); return; }
  const temporal = esTemporal(c.tipo);

  // Piezas: se conservan por posición las que tienen devoluciones.
  const itemsIn = d.items as (z.infer<typeof itemSchema> & { id?: number })[];
  const idsIn = (req.body.items as { id?: number }[]).map(i => i?.id);
  if (!temporal) {
    const iguales = c.items.length === d.items.length && c.items.every((it, k) =>
      it.cantidad === d.items[k].cantidad && (it.producto_id ?? null) === (d.items[k].producto_id ?? null));
    if (!iguales) { res.status(400).json({ error: 'En una compra o venta no se cambian las piezas: anulala y cargala de nuevo' }); return; }
  }
  for (const it of c.items) {
    if (it.cantidad_devuelta === 0) continue;
    const k = idsIn.indexOf(it.id);
    if (k < 0) { res.status(400).json({ error: `"${it.descripcion}" ya tiene piezas devueltas: no se puede sacar` }); return; }
    if (itemsIn[k].cantidad < it.cantidad_devuelta) { res.status(400).json({ error: `"${it.descripcion}": ya volvieron ${it.cantidad_devuelta}` }); return; }
  }

  await prisma.$transaction(async tx => {
    await tx.cruceMaterial.update({
      where: { id },
      data: {
        tercero: d.tercero, fecha_desde: v.desde, fecha_hasta: v.hasta, evento_id: d.evento_id ?? null,
        referencia: d.referencia || null, tasa_euro: d.tasa_euro ?? null, porcentaje_alquiler: d.porcentaje_alquiler ?? null,
        notas: d.notas || null, updated_by: req.user!.id,
        ...(!temporal && { fecha_cierre: v.desde }),
      },
    });
    const conservar = new Set<number>();
    for (let k = 0; k < itemsIn.length; k++) {
      const it = itemsIn[k]; const idIt = idsIn[k];
      const previo = idIt ? c.items.find(x => x.id === idIt) : undefined;
      const data = { producto_id: it.producto_id ?? null, descripcion: it.descripcion, cantidad: it.cantidad, valor_unitario_eur: it.valor_unitario_eur ?? null, orden: k };
      if (previo) { conservar.add(previo.id); await tx.cruceMaterialItem.update({ where: { id: previo.id }, data }); }
      else await tx.cruceMaterialItem.create({ data: { ...data, cruce_id: id } });
    }
    await tx.cruceMaterialItem.deleteMany({ where: { cruce_id: id, id: { notIn: [...conservar] }, cantidad_devuelta: 0 } });
    if (temporal) {
      const items = await tx.cruceMaterialItem.findMany({ where: { cruce_id: id } });
      const todo = items.every(i => i.cantidad_devuelta >= i.cantidad);
      await tx.cruceMaterial.update({ where: { id }, data: todo ? { estado: 'CERRADO', fecha_cierre: c.fecha_cierre ?? v.desde } : { estado: 'ABIERTO', fecha_cierre: null } });
    }
  });
  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'UPDATE', entidad: 'CruceMaterial', entidadId: id,
    descripcion: `Editó ${TIPO_CRUCE_LABEL[c.tipo].toLowerCase()} de material con ${d.tercero}`, ip: req.ip, tx: prisma,
  });
  res.json(mapCruce(await prisma.cruceMaterial.findUniqueOrThrow({ where: { id }, include: INCLUDE })));
}

const devolucionSchema = z.object({
  fecha: z.string().min(1),
  items: z.array(z.object({ item_id: z.number().int(), cantidad: z.number().int().positive() })).min(1, 'Indicá qué volvió'),
});

// POST /stock/cruces/:id/devolucion — lo que vuelve (o lo que devolvemos)
export async function devolverCruce(req: Request, res: Response) {
  const id = Number(req.params.id);
  const parsed = devolucionSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }); return; }
  const fecha = parseFechaCalendario(parsed.data.fecha);
  if (!fecha) { res.status(400).json({ error: 'Fecha inválida' }); return; }
  const c = await prisma.cruceMaterial.findFirst({ where: { id, deleted_at: null, ...withTenant(req.empresaId!) }, include: { items: true } });
  if (!c) { res.status(404).json({ error: 'Operación no encontrada' }); return; }
  if (!esTemporal(c.tipo)) { res.status(400).json({ error: 'Una compra o venta no se devuelve' }); return; }
  if (c.estado !== 'ABIERTO') { res.status(400).json({ error: 'La operación no está abierta' }); return; }
  for (const d of parsed.data.items) {
    const it = c.items.find(i => i.id === d.item_id);
    if (!it) { res.status(400).json({ error: 'Pieza inexistente' }); return; }
    if (it.cantidad_devuelta + d.cantidad > it.cantidad) { res.status(400).json({ error: `"${it.descripcion}": faltan devolver ${it.cantidad - it.cantidad_devuelta}` }); return; }
  }
  await prisma.$transaction(async tx => {
    for (const d of parsed.data.items) await tx.cruceMaterialItem.update({ where: { id: d.item_id }, data: { cantidad_devuelta: { increment: d.cantidad } } });
    const items = await tx.cruceMaterialItem.findMany({ where: { cruce_id: id } });
    if (items.every(i => i.cantidad_devuelta >= i.cantidad)) await tx.cruceMaterial.update({ where: { id }, data: { estado: 'CERRADO', fecha_cierre: fecha } });
  });
  const total = parsed.data.items.reduce((a, i) => a + i.cantidad, 0);
  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'UPDATE', entidad: 'CruceMaterial', entidadId: id,
    descripcion: `Devolución de ${total} pieza/s (${c.tercero})`, datosDespues: parsed.data, ip: req.ip, tx: prisma,
  });
  res.json(mapCruce(await prisma.cruceMaterial.findUniqueOrThrow({ where: { id }, include: INCLUDE })));
}

// POST /stock/cruces/:id/anular — revierte una compra o venta en el stock
export async function anularCruce(req: Request, res: Response) {
  const id = Number(req.params.id);
  const c = await prisma.cruceMaterial.findFirst({ where: { id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!c) { res.status(404).json({ error: 'Operación no encontrada' }); return; }
  if (c.estado === 'ANULADO') { res.status(400).json({ error: 'Ya estaba anulada' }); return; }
  try {
    await prisma.$transaction(async tx => {
      await aplicarStockCompraVenta(tx, id, -1);
      await tx.cruceMaterial.update({ where: { id }, data: { estado: 'ANULADO', updated_by: req.user!.id } });
    });
  } catch (e) {
    if (e instanceof StockCruceNegativo) { res.status(400).json({ error: `${e.message} al anular: corregí primero el stock` }); return; }
    throw e;
  }
  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'UPDATE', entidad: 'CruceMaterial', entidadId: id,
    descripcion: `Anuló ${TIPO_CRUCE_LABEL[c.tipo].toLowerCase()} de material con ${c.tercero}`, ip: req.ip, tx: prisma,
  });
  res.json({ ok: true });
}

// POST /stock/cruces/leer-planilla — las hojas de un cuadro de cruce, con cada
// pieza buscada en el catálogo. No guarda nada: la operación se crea después
// con el tercero, el tipo y las fechas que elige el usuario.
export async function leerPlanilla(req: Request, res: Response) {
  if (!req.file) { res.status(400).json({ error: 'Se requiere un archivo Excel' }); return; }
  try {
    const hojas = await leerPlanillaCruce(req.file.buffer, req.empresaId!);
    const archivo = Buffer.from(req.file.originalname ?? 'planilla', 'latin1').toString('utf8');
    const ya = await prisma.cruceMaterial.findMany({
      where: { empresa_id: req.empresaId!, deleted_at: null, estado: { not: 'ANULADO' }, import_key: { in: hojas.map(h => `${archivo}|${h.hoja}`) } },
      select: { id: true, import_key: true },
    });
    res.json({ archivo, hojas: hojas.map(h => ({ ...h, import_key: `${archivo}|${h.hoja}`, ya_cargada: ya.some(y => y.import_key === `${archivo}|${h.hoja}`) })) });
  } catch {
    res.status(400).json({ error: 'No se pudo leer el archivo Excel' });
  }
}
