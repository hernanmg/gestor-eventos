import type { Request, Response } from 'express';
import { z } from 'zod';
import { Moneda, EstadoEcheq } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { recalcularSaldosCaja } from '../lib/recalcularSaldos';

// ── Helpers ───────────────────────────────────────────────────────────────────

function mapEcheq(e: any) {
  return { ...e, importe: Number(e.importe) };
}

// ── Schemas ───────────────────────────────────────────────────────────────────

const createEcheqSchema = z.object({
  movimiento_id:        z.number().int().positive().optional(),
  numero:               z.string().min(1),
  razon_social:         z.string().min(1),
  detalle:              z.string().nullable().optional(),
  importe:              z.number().positive(),
  moneda:               z.enum(['ARS', 'USD']).default('ARS'),
  fecha_emision:        z.string().nullable().optional(),
  fecha_cobro_estimada: z.string().nullable().optional(),
});

const updateEcheqSchema = z.object({
  numero:               z.string().min(1).optional(),
  razon_social:         z.string().min(1).optional(),
  detalle:              z.string().nullable().optional(),
  importe:              z.number().positive().optional(),
  moneda:               z.enum(['ARS', 'USD']).optional(),
  fecha_emision:        z.string().nullable().optional(),
  fecha_cobro_estimada: z.string().nullable().optional(),
});

const cobrarSchema = z.object({
  cuenta_id:        z.number().int().positive(),
  fecha_cobro_real: z.string().nullable().optional(),
});

// ── Controllers ───────────────────────────────────────────────────────────────

export async function listEcheqs(req: Request, res: Response) {
  const eventoId = Number(req.params.id);
  const echeqs   = await prisma.echeq.findMany({
    where:   { evento_id: eventoId, deleted_at: null },
    orderBy: { created_at: 'desc' },
  });
  res.json(echeqs.map(mapEcheq));
}

export async function createEcheq(req: Request, res: Response) {
  const eventoId = Number(req.params.id);
  const parsed   = createEcheqSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors });
    return;
  }

  const evento = await prisma.evento.findFirst({ where: { id: eventoId, deleted_at: null } });
  if (!evento) { res.status(404).json({ error: 'Evento no encontrado' }); return; }

  if (parsed.data.movimiento_id) {
    const mov = await prisma.movimiento.findFirst({
      where: { id: parsed.data.movimiento_id, evento_id: eventoId, deleted_at: null },
    });
    if (!mov) {
      res.status(400).json({ error: 'Movimiento no encontrado en este evento' }); return;
    }
    if (mov.tipo !== 'EGRESO' || mov.tab_numero !== 3) {
      res.status(400).json({ error: 'Los echeqs solo se pueden crear desde EG-EXTRA (Egresos tab 3)' }); return;
    }
    const existing = await prisma.echeq.findFirst({
      where: { movimiento_id: parsed.data.movimiento_id, deleted_at: null },
    });
    if (existing) {
      res.status(400).json({ error: 'Este movimiento ya tiene un echeq asociado' }); return;
    }
  }

  const echeq = await prisma.echeq.create({
    data: {
      evento_id:            eventoId,
      movimiento_id:        parsed.data.movimiento_id        ?? null,
      numero:               parsed.data.numero,
      razon_social:         parsed.data.razon_social,
      detalle:              parsed.data.detalle               ?? null,
      importe:              parsed.data.importe,
      moneda:               parsed.data.moneda                as Moneda,
      fecha_emision:        parsed.data.fecha_emision        ? new Date(parsed.data.fecha_emision)        : null,
      fecha_cobro_estimada: parsed.data.fecha_cobro_estimada ? new Date(parsed.data.fecha_cobro_estimada) : null,
      created_by:           req.user!.id,
      updated_by:           req.user!.id,
    },
  });
  res.status(201).json(mapEcheq(echeq));
}

export async function updateEcheq(req: Request, res: Response) {
  const id     = Number(req.params.id);
  const parsed = updateEcheqSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors });
    return;
  }

  const existing = await prisma.echeq.findFirst({ where: { id, deleted_at: null } });
  if (!existing) { res.status(404).json({ error: 'Echeq no encontrado' }); return; }
  if (existing.estado === EstadoEcheq.COBRADO) {
    res.status(400).json({ error: 'No se puede modificar un echeq cobrado' }); return;
  }

  const updated = await prisma.echeq.update({
    where: { id },
    data: {
      ...(parsed.data.numero               !== undefined && { numero: parsed.data.numero }),
      ...(parsed.data.razon_social         !== undefined && { razon_social: parsed.data.razon_social }),
      ...(parsed.data.detalle              !== undefined && { detalle: parsed.data.detalle }),
      ...(parsed.data.importe              !== undefined && { importe: parsed.data.importe }),
      ...(parsed.data.moneda               !== undefined && { moneda: parsed.data.moneda as Moneda }),
      ...(parsed.data.fecha_emision        !== undefined && {
        fecha_emision: parsed.data.fecha_emision ? new Date(parsed.data.fecha_emision) : null,
      }),
      ...(parsed.data.fecha_cobro_estimada !== undefined && {
        fecha_cobro_estimada: parsed.data.fecha_cobro_estimada ? new Date(parsed.data.fecha_cobro_estimada) : null,
      }),
      updated_by: req.user!.id,
    },
  });
  res.json(mapEcheq(updated));
}

export async function deleteEcheq(req: Request, res: Response) {
  const id       = Number(req.params.id);
  const existing = await prisma.echeq.findFirst({ where: { id, deleted_at: null } });
  if (!existing) { res.status(404).json({ error: 'Echeq no encontrado' }); return; }
  if (existing.estado === EstadoEcheq.COBRADO) {
    res.status(400).json({ error: 'No se puede eliminar un echeq cobrado' }); return;
  }

  await prisma.echeq.update({
    where: { id },
    data:  { deleted_at: new Date(), updated_by: req.user!.id },
  });
  res.json({ message: 'Echeq eliminado correctamente' });
}

export async function cobrarEcheq(req: Request, res: Response) {
  const id     = Number(req.params.id);
  const parsed = cobrarSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'cuenta_id es requerido' }); return;
  }

  const echeq = await prisma.echeq.findFirst({ where: { id, deleted_at: null } });
  if (!echeq) { res.status(404).json({ error: 'Echeq no encontrado' }); return; }
  if (echeq.estado !== EstadoEcheq.PENDIENTE) {
    res.status(400).json({ error: 'Solo se pueden cobrar echeqs en estado PENDIENTE' }); return;
  }

  const cuenta = await prisma.cuentaBancaria.findFirst({
    where: { id: parsed.data.cuenta_id, evento_id: echeq.evento_id, deleted_at: null },
  });
  if (!cuenta) { res.status(400).json({ error: 'Cuenta bancaria no encontrada en este evento' }); return; }

  await prisma.$transaction(async tx => {
    const last = await tx.movimientoCaja.findFirst({
      where:   { cuenta_id: parsed.data.cuenta_id, deleted_at: null },
      orderBy: { orden: 'desc' },
      select:  { orden: true },
    });

    const cajaMov = await tx.movimientoCaja.create({
      data: {
        cuenta_id:   parsed.data.cuenta_id,
        fecha:       parsed.data.fecha_cobro_real ? new Date(parsed.data.fecha_cobro_real) : new Date(),
        descripcion: `Cobro echeq ${echeq.numero} — ${echeq.razon_social}`,
        debe:        0,
        haber:       Number(echeq.importe),
        orden:       (last?.orden ?? 0) + 1,
        created_by:  req.user!.id,
        updated_by:  req.user!.id,
      },
    });

    await tx.echeq.update({
      where: { id },
      data: {
        estado:             EstadoEcheq.COBRADO,
        movimiento_caja_id: cajaMov.id,
        fecha_cobro_real:   parsed.data.fecha_cobro_real ? new Date(parsed.data.fecha_cobro_real) : new Date(),
        updated_by:         req.user!.id,
      },
    });

    await recalcularSaldosCaja(parsed.data.cuenta_id, tx);
  });

  const updated = await prisma.echeq.findUnique({ where: { id } });
  res.json(mapEcheq(updated));
}
