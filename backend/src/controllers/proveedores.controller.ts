import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';

// ── Validation ────────────────────────────────────────────────────────────────

const CUIT_REGEX = /^\d{2}-\d{8}-\d$/;

const proveedorSchema = z.object({
  nombre:    z.string().min(2),
  alias:     z.string().optional(),
  cuit:      z.string().regex(CUIT_REGEX, 'Formato de CUIT inválido (XX-XXXXXXXX-X)').optional(),
  categoria: z.string().optional(),
  notas:     z.string().optional(),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function mapProv(p: any) {
  return p;
}

// ── Controllers ───────────────────────────────────────────────────────────────

export async function list(req: Request, res: Response) {
  const { q, categoria, activo } = req.query;

  const where: any = { deleted_at: null };

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

  const proveedores = await prisma.proveedor.findMany({
    where,
    orderBy: { nombre: 'asc' },
  });

  res.json(proveedores.map(mapProv));
}

export async function getById(req: Request, res: Response) {
  const id = Number(req.params.id);

  const proveedor = await prisma.proveedor.findFirst({ where: { id, deleted_at: null } });
  if (!proveedor) { res.status(404).json({ error: 'Proveedor no encontrado' }); return; }

  // Fetch last 20 movimientos
  const movimientos = await prisma.movimiento.findMany({
    where:   { proveedor_id: id, deleted_at: null },
    include: { evento: { select: { nombre: true } } },
    orderBy: { created_at: 'desc' },
    take:    20,
  });

  // Tab names for the movimientos
  const tabConfigs = await prisma.tabConfig.findMany();
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
    evento_nombre:   e.evento.nombre,
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
    proveedor,
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

  const { nombre, alias, cuit, categoria, notas } = parsed.data;

  if (cuit) {
    const existing = await prisma.proveedor.findFirst({ where: { cuit, deleted_at: null } });
    if (existing) {
      res.status(400).json({ error: 'Ya existe un proveedor activo con ese CUIT' }); return;
    }
  }

  const proveedor = await prisma.proveedor.create({
    data: {
      nombre,
      alias:     alias     ?? null,
      cuit:      cuit      ?? null,
      categoria: categoria ?? null,
      notas:     notas     ?? null,
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

  const proveedor = await prisma.proveedor.findFirst({ where: { id, deleted_at: null } });
  if (!proveedor) { res.status(404).json({ error: 'Proveedor no encontrado' }); return; }

  const { nombre, alias, cuit, categoria, notas } = parsed.data;

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
      ...(notas     !== undefined && { notas }),
      updated_by: req.user!.id,
    },
  });

  res.json(mapProv(updated));
}

export async function remove(req: Request, res: Response) {
  const id = Number(req.params.id);

  const proveedor = await prisma.proveedor.findFirst({ where: { id, deleted_at: null } });
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
      activo:     true,
      deleted_at: null,
      OR: [
        { nombre:    { contains: q, mode: 'insensitive' } },
        { alias:     { contains: q, mode: 'insensitive' } },
        { cuit:      { contains: q, mode: 'insensitive' } },
      ],
    },
    select:  { id: true, nombre: true, alias: true, cuit: true, categoria: true },
    orderBy: { nombre: 'asc' },
    take:    10,
  });

  res.json(results);
}

export async function toggleActivo(req: Request, res: Response) {
  const id = Number(req.params.id);

  const proveedor = await prisma.proveedor.findFirst({ where: { id, deleted_at: null } });
  if (!proveedor) { res.status(404).json({ error: 'Proveedor no encontrado' }); return; }

  const updated = await prisma.proveedor.update({
    where: { id },
    data:  { activo: !proveedor.activo, updated_by: req.user!.id },
  });

  res.json(mapProv(updated));
}
