import type { Request, Response } from 'express';
import { z } from 'zod';
import { Tipo, Moneda } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { recalcularSaldos, recalcularSaldosCaja } from '../lib/recalcularSaldos';

// ── Constantes ────────────────────────────────────────────────────────────────

const SUBCATEGORIAS_IMP = [
  'PAYWAY', 'REBA', 'AUTOENTRADA', 'IVA', 'IIBB', 'MUNICIPALIDAD', 'GANANCIAS',
] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

function toDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  return new Date(s);
}

function mapMov(m: any) {
  return {
    ...m,
    debe:  Number(m.debe),
    haber: Number(m.haber),
    saldo: Number(m.saldo),
  };
}

// ── Schemas Zod ───────────────────────────────────────────────────────────────

const createSchema = z.object({
  tipo:                  z.enum(['EGRESO', 'INGRESO']),
  tab_numero:            z.number().int().min(1).max(5),
  fecha:                 z.string().nullable().optional(),
  concepto:              z.string().nullable().optional(),
  descripcion:           z.string().nullable().optional(),
  debe:                  z.number().min(0).default(0),
  haber:                 z.number().min(0).default(0),
  moneda:                z.enum(['ARS', 'USD']).default('ARS'),
  orden:                 z.number().int().min(1).optional(),
  impuesto_subcategoria: z.string().nullable().optional(),
  impacta_caja:          z.boolean().optional(),
  cuenta_id:             z.number().int().positive().optional(),
}).refine(
  d => !(d.impacta_caja && !d.cuenta_id),
  { message: 'cuenta_id es requerido cuando impacta_caja es true', path: ['cuenta_id'] },
);

const updateSchema = z.object({
  fecha:                 z.string().nullable().optional(),
  concepto:              z.string().nullable().optional(),
  descripcion:           z.string().nullable().optional(),
  debe:                  z.number().min(0).optional(),
  haber:                 z.number().min(0).optional(),
  moneda:                z.enum(['ARS', 'USD']).optional(),
  impuesto_subcategoria: z.string().nullable().optional(),
});

// ── Controllers ───────────────────────────────────────────────────────────────

export async function listSinConciliar(req: Request, res: Response) {
  const eventoId = Number(req.params.id);
  const [movs, tabs] = await Promise.all([
    prisma.movimiento.findMany({
      where:   { evento_id: eventoId, movimiento_caja_id: null, deleted_at: null },
      orderBy: [{ tipo: 'asc' }, { tab_numero: 'asc' }, { orden: 'asc' }],
    }),
    prisma.tabConfig.findMany(),
  ]);
  const tabMap = new Map(tabs.map(t => [`${t.tipo}-${t.numero}`, t.codigo]));
  res.json(movs.map(m => ({
    ...mapMov(m),
    tab_codigo: tabMap.get(`${m.tipo}-${m.tab_numero}`) ?? null,
  })));
}

export async function list(req: Request, res: Response) {
  const eventoId = Number(req.params.id);
  const tipo     = req.query.tipo as string | undefined;
  const tab      = req.query.tab  ? Number(req.query.tab) : undefined;

  if (!tipo || !tab || !['EGRESO', 'INGRESO'].includes(tipo)) {
    res.status(400).json({ error: 'Se requieren tipo (EGRESO|INGRESO) y tab (1-5)' });
    return;
  }

  const movs = await prisma.movimiento.findMany({
    where:   { evento_id: eventoId, tipo: tipo as Tipo, tab_numero: tab, deleted_at: null },
    orderBy: { orden: 'asc' },
  });
  res.json(movs.map(mapMov));
}

export async function create(req: Request, res: Response) {
  const eventoId = Number(req.params.id);
  const parsed   = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors });
    return;
  }

  const {
    tipo, tab_numero, fecha, concepto, descripcion,
    debe, haber, moneda, impuesto_subcategoria,
    impacta_caja, cuenta_id,
  } = parsed.data;

  // EG-IMP validation
  if (tipo === 'EGRESO' && tab_numero === 4) {
    if (!impuesto_subcategoria) {
      res.status(400).json({ error: 'impuesto_subcategoria es requerido para EG-IMP' });
      return;
    }
    if (!SUBCATEGORIAS_IMP.includes(impuesto_subcategoria as any)) {
      res.status(400).json({
        error: `Subcategoría inválida. Valores válidos: ${SUBCATEGORIAS_IMP.join(', ')}`,
      });
      return;
    }
  }

  const evento = await prisma.evento.findFirst({ where: { id: eventoId, deleted_at: null } });
  if (!evento) { res.status(404).json({ error: 'Evento no encontrado' }); return; }

  if (cuenta_id) {
    const cuenta = await prisma.cuentaBancaria.findFirst({
      where: { id: cuenta_id, evento_id: eventoId, deleted_at: null },
    });
    if (!cuenta) { res.status(400).json({ error: 'Cuenta bancaria no encontrada en este evento' }); return; }
  }

  const movId = await prisma.$transaction(async tx => {
    // Auto-assign orden if not provided
    let orden = parsed.data.orden;
    if (orden === undefined) {
      const last = await tx.movimiento.findFirst({
        where:   { evento_id: eventoId, tipo: tipo as Tipo, tab_numero, deleted_at: null },
        orderBy: { orden: 'desc' },
        select:  { orden: true },
      });
      orden = (last?.orden ?? 0) + 1;
    }

    const mov = await tx.movimiento.create({
      data: {
        evento_id:             eventoId,
        tipo:                  tipo as Tipo,
        tab_numero,
        fecha:                 toDate(fecha),
        concepto:              concepto ?? null,
        descripcion:           descripcion ?? null,
        debe:                  debe ?? 0,
        haber:                 haber ?? 0,
        moneda:                (moneda ?? 'ARS') as Moneda,
        orden,
        impuesto_subcategoria: impuesto_subcategoria ?? null,
        created_by:            req.user!.id,
        updated_by:            req.user!.id,
      },
    });

    if (impacta_caja && cuenta_id) {
      const lastCaja = await tx.movimientoCaja.findFirst({
        where:   { cuenta_id, deleted_at: null },
        orderBy: { orden: 'desc' },
        select:  { orden: true },
      });
      const cajaMov = await tx.movimientoCaja.create({
        data: {
          cuenta_id,
          fecha:       toDate(fecha),
          descripcion: descripcion ?? null,
          debe:        debe ?? 0,
          haber:       haber ?? 0,
          orden:       (lastCaja?.orden ?? 0) + 1,
          created_by:  req.user!.id,
          updated_by:  req.user!.id,
        },
      });
      await tx.movimiento.update({
        where: { id: mov.id },
        data:  { movimiento_caja_id: cajaMov.id },
      });
      await recalcularSaldosCaja(cuenta_id, tx);
    }

    await recalcularSaldos(eventoId, tipo as Tipo, tab_numero, tx);
    return mov.id;
  });

  const updated = await prisma.movimiento.findUnique({ where: { id: movId } });
  res.status(201).json(mapMov(updated));
}

export async function update(req: Request, res: Response) {
  const id     = Number(req.params.id);
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors });
    return;
  }

  const existing = await prisma.movimiento.findFirst({ where: { id, deleted_at: null } });
  if (!existing) { res.status(404).json({ error: 'Movimiento no encontrado' }); return; }

  const { fecha, concepto, descripcion, debe, haber, moneda, impuesto_subcategoria } = parsed.data;

  // EG-IMP: validate subcategory if provided
  if (
    existing.tipo === Tipo.EGRESO &&
    existing.tab_numero === 4 &&
    impuesto_subcategoria !== undefined &&
    impuesto_subcategoria !== null
  ) {
    if (!SUBCATEGORIAS_IMP.includes(impuesto_subcategoria as any)) {
      res.status(400).json({
        error: `Subcategoría inválida. Valores válidos: ${SUBCATEGORIAS_IMP.join(', ')}`,
      });
      return;
    }
  }

  const movId = await prisma.$transaction(async tx => {
    await tx.movimiento.update({
      where: { id },
      data: {
        ...(fecha              !== undefined && { fecha: toDate(fecha) }),
        ...(concepto           !== undefined && { concepto }),
        ...(descripcion        !== undefined && { descripcion }),
        ...(debe               !== undefined && { debe }),
        ...(haber              !== undefined && { haber }),
        ...(moneda             !== undefined && { moneda: moneda as Moneda }),
        ...(impuesto_subcategoria !== undefined && { impuesto_subcategoria }),
        updated_by: req.user!.id,
      },
    });

    await recalcularSaldos(existing.evento_id, existing.tipo, existing.tab_numero, tx);
    return id;
  });

  const updated = await prisma.movimiento.findUnique({ where: { id: movId } });
  res.json(mapMov(updated));
}

export async function remove(req: Request, res: Response) {
  const id       = Number(req.params.id);
  const existing = await prisma.movimiento.findFirst({ where: { id, deleted_at: null } });
  if (!existing) { res.status(404).json({ error: 'Movimiento no encontrado' }); return; }

  await prisma.$transaction(async tx => {
    await tx.movimiento.update({
      where: { id },
      data:  { deleted_at: new Date(), updated_by: req.user!.id },
    });
    await recalcularSaldos(existing.evento_id, existing.tipo, existing.tab_numero, tx);
  });

  res.json({ message: 'Movimiento eliminado correctamente' });
}

export async function reordenar(req: Request, res: Response) {
  const id     = Number(req.params.id);
  const parsed = z.object({ orden: z.number().int().min(1) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'orden inválido' });
    return;
  }

  const moving = await prisma.movimiento.findFirst({ where: { id, deleted_at: null } });
  if (!moving) { res.status(404).json({ error: 'Movimiento no encontrado' }); return; }

  const { orden: newOrden } = parsed.data;

  await prisma.$transaction(async tx => {
    const others = await tx.movimiento.findMany({
      where:   {
        evento_id:  moving.evento_id,
        tipo:       moving.tipo,
        tab_numero: moving.tab_numero,
        deleted_at: null,
        id:         { not: id },
      },
      orderBy: { orden: 'asc' },
    });

    const clamped   = Math.min(Math.max(newOrden, 1), others.length + 1);
    const reordered = [...others];
    reordered.splice(clamped - 1, 0, moving as any);

    for (let i = 0; i < reordered.length; i++) {
      await tx.movimiento.update({
        where: { id: reordered[i].id },
        data:  { orden: i + 1 },
      });
    }

    await recalcularSaldos(moving.evento_id, moving.tipo, moving.tab_numero, tx);
  });

  const updated = await prisma.movimiento.findUnique({ where: { id } });
  res.json(mapMov(updated));
}

