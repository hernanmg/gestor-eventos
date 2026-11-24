import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { withTenant } from '../lib/tenant';

// ── Validation ────────────────────────────────────────────────────────────────

const CUIT_REGEX = /^\d{2}-\d{8}-\d$/;

const proveedorSchema = z.object({
  nombre:    z.string().min(2),
  alias:     z.string().optional(),
  cuit:      z.string().regex(CUIT_REGEX, 'Formato de CUIT inválido (XX-XXXXXXXX-X)').optional(),
  categoria: z.string().optional(),
  telefono:  z.string().nullable().optional(),
  notas:     z.string().optional(),
  // Comisionista (ej. "Polaco") — cobra un % sobre facturas emitidas donde
  // participa del reparto. Ver POST /api/facturas-emitidas.
  es_comisionista:     z.boolean().optional(),
  porcentaje_comision: z.number().min(0).max(100).nullable().optional(),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function mapProv(p: any) {
  return { ...p, porcentaje_comision: p.porcentaje_comision !== null && p.porcentaje_comision !== undefined ? Number(p.porcentaje_comision) : null };
}

// ── Controllers ───────────────────────────────────────────────────────────────

export async function list(req: Request, res: Response) {
  const { q, categoria, activo } = req.query;

  const where: any = { ...withTenant(req.empresaId!), deleted_at: null };

  // Default: only active; unless activo=false is explicit
  if (activo === 'false') {
    where.activo = false;
  } else if (activo !== 'all') {
    where.activo = true;
  }

  if (q) {
    const term = String(q);
    where.OR = [
      { nombre:    { contains: term, mode: 'insensitive' } },
      { alias:     { contains: term, mode: 'insensitive' } },
      { cuit:      { contains: term, mode: 'insensitive' } },
    ];
  }

  if (categoria) where.categoria = String(categoria);
  if (req.query.es_comisionista === 'true') where.es_comisionista = true;

  const proveedores = await prisma.proveedor.findMany({
    where,
    orderBy: { nombre: 'asc' },
  });

  res.json(proveedores.map(mapProv));
}

export async function getById(req: Request, res: Response) {
  const id = Number(req.params.id);

  const proveedor = await prisma.proveedor.findFirst({ where: { id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!proveedor) { res.status(404).json({ error: 'Proveedor no encontrado' }); return; }

  // Fetch last 20 movimientos
  const movimientos = await prisma.movimiento.findMany({
    where:   { proveedor_id: id, deleted_at: null },
    include: { evento: { select: { nombre: true } } },
    orderBy: { created_at: 'desc' },
    take:    20,
  });

  // Tab names for the movimientos
  const tabConfigs = await prisma.tabConfig.findMany({ where: withTenant(req.empresaId!) });
  const tabMap = new Map(tabConfigs.map(t => [`${t.tipo}-${t.numero}`, t.nombre]));

  const movimientosFormatted = movimientos.map(m => ({
    id:           m.id,
    evento_id:    m.evento_id,
    evento_nombre: m.evento.nombre,
    tipo:         m.tipo,
    tab_nombre:   tabMap.get(`${m.tipo}-${m.tab_numero}`) ?? `Tab ${m.tab_numero}`,
    fecha:        m.fecha,
    concepto:     m.concepto,
    descripcion:  m.descripcion,
    debe:         Number(m.debe),
    haber:        Number(m.haber),
    moneda:       m.moneda,
    created_at:   m.created_at,
  }));

  // All movimientos for stats
  const allMovs = await prisma.movimiento.findMany({
    where:  { proveedor_id: id, deleted_at: null },
    select: { debe: true, moneda: true, evento_id: true },
  });

  // All echeqs
  const echeqs = await prisma.echeq.findMany({
    where:   { proveedor_id: id, deleted_at: null },
    include: { evento: { select: { nombre: true } } },
    orderBy: { created_at: 'desc' },
  });

  const echeqsFormatted = echeqs.map(e => ({
    id:              e.id,
    evento_id:       e.evento_id,
    evento_nombre:   e.evento?.nombre ?? null,
    numero:          e.numero,
    importe:         Number(e.importe),
    moneda:          e.moneda,
    estado:          e.estado,
    fecha_emision:   e.fecha_emision,
    fecha_cobro_real: e.fecha_cobro_real,
  }));

  // Stats
  const eventoIds = new Set(allMovs.map(m => m.evento_id));
  const totalARS  = allMovs.filter(m => m.moneda === 'ARS').reduce((s, m) => s + Number(m.debe), 0);
  const totalUSD  = allMovs.filter(m => m.moneda === 'USD').reduce((s, m) => s + Number(m.debe), 0);

  const stats = {
    total_movimientos:       allMovs.length,
    total_eventos:           eventoIds.size,
    total_facturado_ars:     totalARS,
    total_facturado_usd:     totalUSD,
    total_echeqs_emitidos:   echeqs.length,
    total_echeqs_cobrados:   echeqs.filter(e => e.estado === 'COBRADO').length,
    total_echeqs_pendientes: echeqs.filter(e => e.estado === 'PENDIENTE').length,
  };

  res.json({
    proveedor: mapProv(proveedor),
    historial: {
      movimientos: movimientosFormatted,
      echeqs:      echeqsFormatted,
      stats,
    },
  });
}

export async function create(req: Request, res: Response) {
  const parsed = proveedorSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors });
    return;
  }

  const { nombre, alias, cuit, categoria, telefono, notas, es_comisionista, porcentaje_comision } = parsed.data;

  if (cuit) {
    const existing = await prisma.proveedor.findFirst({ where: { cuit, deleted_at: null } });
    if (existing) {
      res.status(400).json({ error: 'Ya existe un proveedor activo con ese CUIT' }); return;
    }
  }

  const proveedor = await prisma.proveedor.create({
    data: {
      ...withTenant(req.empresaId!),
      nombre,
      alias:     alias     ?? null,
      cuit:      cuit      ?? null,
      categoria: categoria ?? null,
      telefono:  telefono  ?? null,
      notas:     notas     ?? null,
      es_comisionista:     es_comisionista     ?? false,
      porcentaje_comision: porcentaje_comision ?? null,
      created_by: req.user!.id,
      updated_by: req.user!.id,
    },
  });

  res.status(201).json(mapProv(proveedor));
}

export async function update(req: Request, res: Response) {
  const id     = Number(req.params.id);
  const parsed = proveedorSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors });
    return;
  }

  const proveedor = await prisma.proveedor.findFirst({ where: { id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!proveedor) { res.status(404).json({ error: 'Proveedor no encontrado' }); return; }

  const { nombre, alias, cuit, categoria, telefono, notas, es_comisionista, porcentaje_comision } = parsed.data;

  if (cuit && cuit !== proveedor.cuit) {
    const dup = await prisma.proveedor.findFirst({ where: { cuit, deleted_at: null, id: { not: id } } });
    if (dup) {
      res.status(400).json({ error: 'Ya existe un proveedor activo con ese CUIT' }); return;
    }
  }

  const updated = await prisma.proveedor.update({
    where: { id },
    data: {
      ...(nombre    !== undefined && { nombre }),
      ...(alias     !== undefined && { alias }),
      ...(cuit      !== undefined && { cuit }),
      ...(categoria !== undefined && { categoria }),
      ...(telefono  !== undefined && { telefono }),
      ...(notas     !== undefined && { notas }),
      ...(es_comisionista     !== undefined && { es_comisionista }),
      ...(porcentaje_comision !== undefined && { porcentaje_comision }),
      updated_by: req.user!.id,
    },
  });

  res.json(mapProv(updated));
}

export async function remove(req: Request, res: Response) {
  const id = Number(req.params.id);

  const proveedor = await prisma.proveedor.findFirst({ where: { id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!proveedor) { res.status(404).json({ error: 'Proveedor no encontrado' }); return; }

  await prisma.proveedor.update({
    where: { id },
    data:  { deleted_at: new Date(), updated_by: req.user!.id },
  });

  res.json({ message: 'Proveedor eliminado correctamente' });
}

export async function buscar(req: Request, res: Response) {
  const q = String(req.query.q ?? '');

  if (!q.trim()) { res.json([]); return; }

  const results = await prisma.proveedor.findMany({
    where: {
      ...withTenant(req.empresaId!),
      activo:     true,
      deleted_at: null,
      OR: [
        // nombre = empresa / razón social; alias = contacto (la persona).
        { nombre:         { contains: q, mode: 'insensitive' } },
        { alias:          { contains: q, mode: 'insensitive' } },
        { titular_cuenta: { contains: q, mode: 'insensitive' } },
        { servicio:       { contains: q, mode: 'insensitive' } },
        { cuit:           { contains: q.replace(/\D/g, '') || q, mode: 'insensitive' } },
      ],
    },
    select:  { id: true, nombre: true, alias: true, cuit: true, categoria: true, telefono: true, servicio: true },
    orderBy: { nombre: 'asc' },
    take:    10,
  });

  res.json(results);
}

export async function toggleActivo(req: Request, res: Response) {
  const id = Number(req.params.id);

  const proveedor = await prisma.proveedor.findFirst({ where: { id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!proveedor) { res.status(404).json({ error: 'Proveedor no encontrado' }); return; }

  const updated = await prisma.proveedor.update({
    where: { id },
    data:  { activo: !proveedor.activo, updated_by: req.user!.id },
  });

  res.json(mapProv(updated));
}

// ── Cuenta del proveedor: facturas, saldo, pagos y órdenes ───────────────────
// GET /api/proveedores/:id/cuenta — mismo acceso que Facturas a Pagar.

const r2 = (n: number) => Math.round(n * 100) / 100;
const numOC = (n: number) => `OC ${String(n).padStart(6, '0')}`;
const numOP = (n: number) => `OP ${String(n).padStart(6, '0')}`;

export async function getCuenta(req: Request, res: Response) {
  const id = Number(req.params.id);
  const empresaId = req.empresaId!;
  const proveedor = await prisma.proveedor.findFirst({ where: { id, deleted_at: null, ...withTenant(empresaId) }, select: { id: true } });
  if (!proveedor) { res.status(404).json({ error: 'Proveedor no encontrado' }); return; }

  const [facturas, pagos, ordenesCompra, ordenesPago] = await Promise.all([
    prisma.factura.findMany({
      where:   { proveedor_id: id, empresa_id: empresaId, deleted_at: null },
      orderBy: [{ fecha_emision: 'desc' }, { id: 'desc' }],
      select: {
        id: true, numero_factura: true, tipo_factura: true, fecha_emision: true, fecha_vencimiento: true,
        importe_total: true, importe_pagado: true, importe_pendiente: true, moneda: true, estado: true,
        evento:       { select: { id: true, nombre: true } },
        orden_compra: { select: { id: true, numero: true } },
      },
    }),
    prisma.pagoFactura.findMany({
      where:   { deleted_at: null, factura: { proveedor_id: id, empresa_id: empresaId, deleted_at: null } },
      orderBy: [{ fecha_pago: 'desc' }, { id: 'desc' }],
      take:    200,
      select: {
        id: true, fecha_pago: true, importe: true, moneda: true, medio_pago: true, referencia: true,
        factura:    { select: { id: true, numero_factura: true, tipo_factura: true } },
        orden_pago: { select: { id: true, numero: true } },
      },
    }),
    prisma.ordenCompra.findMany({
      where:   { proveedor_id: id, empresa_id: empresaId, deleted_at: null },
      orderBy: [{ fecha: 'desc' }, { numero: 'desc' }],
      select:  { id: true, numero: true, fecha: true, estado: true, total: true, moneda: true, evento: { select: { id: true, nombre: true } } },
    }),
    prisma.ordenPago.findMany({
      where:   { proveedor_id: id, empresa_id: empresaId, deleted_at: null },
      orderBy: [{ fecha: 'desc' }, { numero: 'desc' }],
      select:  { id: true, numero: true, fecha: true, estado: true, total_facturas: true, moneda: true, concepto: true },
    }),
  ]);

  // Hoy a medianoche UTC (las fechas de vencimiento son de calendario)
  const ahora = new Date();
  const hoy = new Date(Date.UTC(ahora.getFullYear(), ahora.getMonth(), ahora.getDate()));

  const porMoneda = new Map<string, { moneda: string; facturado: number; pagado: number; pendiente: number; vencido: number; facturas_pendientes: number }>();
  for (const f of facturas) {
    if (f.estado === 'ANULADA') continue;
    const m = porMoneda.get(f.moneda) ?? { moneda: f.moneda, facturado: 0, pagado: 0, pendiente: 0, vencido: 0, facturas_pendientes: 0 };
    const pend = Number(f.importe_pendiente);
    m.facturado += Number(f.importe_total);
    m.pagado    += Number(f.importe_pagado);
    m.pendiente += pend;
    if (pend > 0.005) {
      m.facturas_pendientes++;
      if (f.fecha_vencimiento && f.fecha_vencimiento < hoy) m.vencido += pend;
    }
    porMoneda.set(f.moneda, m);
  }

  res.json({
    saldo: [...porMoneda.values()].map(m => ({ ...m, facturado: r2(m.facturado), pagado: r2(m.pagado), pendiente: r2(m.pendiente), vencido: r2(m.vencido) })),
    facturas: facturas.map(f => ({
      id: f.id, numero_factura: f.numero_factura, tipo_factura: f.tipo_factura,
      fecha_emision: f.fecha_emision, fecha_vencimiento: f.fecha_vencimiento,
      importe_total: Number(f.importe_total), importe_pendiente: Number(f.importe_pendiente), moneda: f.moneda, estado: f.estado,
      vencida: f.estado !== 'ANULADA' && Number(f.importe_pendiente) > 0.005 && !!f.fecha_vencimiento && f.fecha_vencimiento < hoy,
      evento: f.evento,
      orden_compra: f.orden_compra ? { id: f.orden_compra.id, numero: numOC(f.orden_compra.numero) } : null,
    })),
    pagos: pagos.map(p => ({
      id: p.id, fecha_pago: p.fecha_pago, importe: Number(p.importe), moneda: p.moneda, medio_pago: p.medio_pago, referencia: p.referencia,
      factura: p.factura,
      orden_pago: p.orden_pago ? { id: p.orden_pago.id, numero: numOP(p.orden_pago.numero) } : null,
    })),
    ordenes_compra: ordenesCompra.map(o => ({ id: o.id, numero: numOC(o.numero), fecha: o.fecha, estado: o.estado, total: Number(o.total), moneda: o.moneda, evento: o.evento })),
    ordenes_pago: ordenesPago.map(o => ({ id: o.id, numero: numOP(o.numero), fecha: o.fecha, estado: o.estado, total: Number(o.total_facturas), moneda: o.moneda, concepto: o.concepto })),
  });
}
