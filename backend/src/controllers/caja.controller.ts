import type { Request, Response } from 'express';
import { z } from 'zod';
import { TipoCuenta, Moneda } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { recalcularSaldosCaja } from '../lib/recalcularSaldos';

// ── Helpers ───────────────────────────────────────────────────────────────────

function mapCuenta(c: any) {
  return { ...c, saldo_inicial: Number(c.saldo_inicial) };
}

function mapMovCaja(m: any) {
  return {
    ...m,
    debe:            Number(m.debe),
    haber:           Number(m.haber),
    saldo_corriente: Number(m.saldo_corriente),
  };
}

// ── Schemas ───────────────────────────────────────────────────────────────────

const createCuentaSchema = z.object({
  nombre:        z.string().min(1),
  tipo:          z.enum(['EFECTIVO', 'BANCO']),
  moneda:        z.enum(['ARS', 'USD']).default('ARS'),
  saldo_inicial: z.number().default(0),
});

const updateCuentaSchema = z.object({
  nombre:        z.string().min(1).optional(),
  tipo:          z.enum(['EFECTIVO', 'BANCO']).optional(),
  moneda:        z.enum(['ARS', 'USD']).optional(),
  saldo_inicial: z.number().optional(),
});

const createMovCajaSchema = z.object({
  fecha:       z.string().nullable().optional(),
  descripcion: z.string().nullable().optional(),
  debe:        z.number().min(0).default(0),
  haber:       z.number().min(0).default(0),
});

const updateMovCajaSchema = z.object({
  fecha:       z.string().nullable().optional(),
  descripcion: z.string().nullable().optional(),
  debe:        z.number().min(0).optional(),
  haber:       z.number().min(0).optional(),
});

// ── Cuentas ───────────────────────────────────────────────────────────────────

export async function listCuentas(req: Request, res: Response) {
  const eventoId = Number(req.params.id);
  const cuentas  = await prisma.cuentaBancaria.findMany({
    where:   { evento_id: eventoId, deleted_at: null },
    orderBy: { id: 'asc' },
  });
  res.json(cuentas.map(mapCuenta));
}

export async function createCuenta(req: Request, res: Response) {
  const eventoId = Number(req.params.id);
  const parsed   = createCuentaSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors });
    return;
  }

  const evento = await prisma.evento.findFirst({ where: { id: eventoId, deleted_at: null } });
  if (!evento) { res.status(404).json({ error: 'Evento no encontrado' }); return; }

  const cuenta = await prisma.cuentaBancaria.create({
    data: {
      evento_id:     eventoId,
      nombre:        parsed.data.nombre,
      tipo:          parsed.data.tipo as TipoCuenta,
      moneda:        parsed.data.moneda as Moneda,
      saldo_inicial: parsed.data.saldo_inicial,
    },
  });
  res.status(201).json(mapCuenta(cuenta));
}

export async function updateCuenta(req: Request, res: Response) {
  const id     = Number(req.params.id);
  const parsed = updateCuentaSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors });
    return;
  }

  const existing = await prisma.cuentaBancaria.findFirst({ where: { id, deleted_at: null } });
  if (!existing) { res.status(404).json({ error: 'Cuenta no encontrada' }); return; }

  const { nombre, tipo, moneda, saldo_inicial } = parsed.data;

  const updated = await prisma.$transaction(async tx => {
    const c = await tx.cuentaBancaria.update({
      where: { id },
      data: {
        ...(nombre        !== undefined && { nombre }),
        ...(tipo          !== undefined && { tipo: tipo as TipoCuenta }),
        ...(moneda        !== undefined && { moneda: moneda as Moneda }),
        ...(saldo_inicial !== undefined && { saldo_inicial }),
      },
    });
    if (saldo_inicial !== undefined) {
      await recalcularSaldosCaja(id, tx);
    }
    return c;
  });

  res.json(mapCuenta(updated));
}

export async function deleteCuenta(req: Request, res: Response) {
  const id       = Number(req.params.id);
  const existing = await prisma.cuentaBancaria.findFirst({ where: { id, deleted_at: null } });
  if (!existing) { res.status(404).json({ error: 'Cuenta no encontrada' }); return; }

  await prisma.cuentaBancaria.update({ where: { id }, data: { deleted_at: new Date() } });
  res.json({ message: 'Cuenta eliminada correctamente' });
}

// ── Movimientos de Caja ───────────────────────────────────────────────────────

export async function listMovimientosCaja(req: Request, res: Response) {
  const cuentaId = Number(req.params.id);
  const movs     = await prisma.movimientoCaja.findMany({
    where:   { cuenta_id: cuentaId, deleted_at: null },
    orderBy: { orden: 'asc' },
  });
  res.json(movs.map(mapMovCaja));
}

export async function createMovimientoCaja(req: Request, res: Response) {
  const cuentaId = Number(req.params.id);
  const parsed   = createMovCajaSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors });
    return;
  }

  const cuenta = await prisma.cuentaBancaria.findFirst({ where: { id: cuentaId, deleted_at: null } });
  if (!cuenta) { res.status(404).json({ error: 'Cuenta no encontrada' }); return; }

  const movId = await prisma.$transaction(async tx => {
    const last = await tx.movimientoCaja.findFirst({
      where:   { cuenta_id: cuentaId, deleted_at: null },
      orderBy: { orden: 'desc' },
      select:  { orden: true },
    });
    const mov = await tx.movimientoCaja.create({
      data: {
        cuenta_id:   cuentaId,
        fecha:       parsed.data.fecha ? new Date(parsed.data.fecha) : null,
        descripcion: parsed.data.descripcion ?? null,
        debe:        parsed.data.debe,
        haber:       parsed.data.haber,
        orden:       (last?.orden ?? 0) + 1,
        created_by:  req.user!.id,
        updated_by:  req.user!.id,
      },
    });
    await recalcularSaldosCaja(cuentaId, tx);
    return mov.id;
  });

  const updated = await prisma.movimientoCaja.findUnique({ where: { id: movId } });
  res.status(201).json(mapMovCaja(updated));
}

export async function updateMovimientoCaja(req: Request, res: Response) {
  const id     = Number(req.params.id);
  const parsed = updateMovCajaSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors });
    return;
  }

  const existing = await prisma.movimientoCaja.findFirst({ where: { id, deleted_at: null } });
  if (!existing) { res.status(404).json({ error: 'Movimiento de caja no encontrado' }); return; }

  const movId = await prisma.$transaction(async tx => {
    await tx.movimientoCaja.update({
      where: { id },
      data: {
        ...(parsed.data.fecha       !== undefined && { fecha: parsed.data.fecha ? new Date(parsed.data.fecha) : null }),
        ...(parsed.data.descripcion !== undefined && { descripcion: parsed.data.descripcion }),
        ...(parsed.data.debe        !== undefined && { debe: parsed.data.debe }),
        ...(parsed.data.haber       !== undefined && { haber: parsed.data.haber }),
        updated_by: req.user!.id,
      },
    });
    await recalcularSaldosCaja(existing.cuenta_id, tx);
    return id;
  });

  const updated = await prisma.movimientoCaja.findUnique({ where: { id: movId } });
  res.json(mapMovCaja(updated));
}

export async function deleteMovimientoCaja(req: Request, res: Response) {
  const id       = Number(req.params.id);
  const existing = await prisma.movimientoCaja.findFirst({ where: { id, deleted_at: null } });
  if (!existing) { res.status(404).json({ error: 'Movimiento de caja no encontrado' }); return; }

  await prisma.$transaction(async tx => {
    await tx.movimientoCaja.update({
      where: { id },
      data:  { deleted_at: new Date(), updated_by: req.user!.id },
    });
    await recalcularSaldosCaja(existing.cuenta_id, tx);
  });

  res.json({ message: 'Movimiento de caja eliminado correctamente' });
}
