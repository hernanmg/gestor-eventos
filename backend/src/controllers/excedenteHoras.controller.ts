import type { Request, Response } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { withTenant } from '../lib/tenant';

const EMPLEADO_SELECT = { id: true, nombre: true, apellido: true, categoria: true } as const;

function mapExcedente(e: any) {
  return {
    ...e,
    horas_excedente: Number(e.horas_excedente),
    valor_hora:      Number(e.valor_hora),
    monto_total:     Number(e.monto_total),
  };
}

const createSchema = z.object({
  empleado_id:     z.number().int().positive(),
  periodo_mes:     z.number().int().min(1).max(12),
  periodo_anio:    z.number().int().min(2000),
  horas_excedente: z.number().positive(),
  valor_hora:      z.number().positive(),
});

export async function listExcedenteHoras(req: Request, res: Response) {
  const { empleado_id, pagado, mes, anio } = req.query;
  const where: Prisma.ExcedenteHorasWhereInput = { ...withTenant(req.empresaId!) };

  if (typeof empleado_id === 'string' && empleado_id !== '') where.empleado_id = Number(empleado_id);
  if (typeof pagado === 'string' && (pagado === 'true' || pagado === 'false')) where.pagado = pagado === 'true';
  if (typeof mes === 'string' && mes !== '')   where.periodo_mes  = Number(mes);
  if (typeof anio === 'string' && anio !== '') where.periodo_anio = Number(anio);

  const items = await prisma.excedenteHoras.findMany({
    where,
    orderBy: [{ periodo_anio: 'desc' }, { periodo_mes: 'desc' }, { id: 'desc' }],
    include: { empleado: { select: EMPLEADO_SELECT } },
  });

  const total_pendiente = items.filter(i => !i.pagado).reduce((a, i) => a + Number(i.monto_total), 0);
  res.json({ items: items.map(mapExcedente), total_pendiente: parseFloat(total_pendiente.toFixed(2)) });
}

export async function createExcedenteHoras(req: Request, res: Response) {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return; }

  const empleado = await prisma.empleado.findFirst({ where: { id: parsed.data.empleado_id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!empleado) { res.status(404).json({ error: 'Empleado no encontrado' }); return; }

  const montoTotal = parseFloat((parsed.data.horas_excedente * parsed.data.valor_hora).toFixed(2));

  try {
    const excedente = await prisma.excedenteHoras.create({
      data: {
        ...withTenant(req.empresaId!),
        empleado_id:     parsed.data.empleado_id,
        periodo_mes:     parsed.data.periodo_mes,
        periodo_anio:    parsed.data.periodo_anio,
        horas_excedente: parsed.data.horas_excedente,
        valor_hora:      parsed.data.valor_hora,
        monto_total:     montoTotal,
        created_by:      req.user!.id,
      },
      include: { empleado: { select: EMPLEADO_SELECT } },
    });
    res.status(201).json(mapExcedente(excedente));
  } catch (err: any) {
    if (err?.code === 'P2002') {
      res.status(400).json({ error: 'Ya existe un excedente cargado para este empleado en ese período' });
      return;
    }
    throw err;
  }
}

const pagarSchema = z.object({
  fecha_pago:           z.string(),
  liquidacion_admin_id: z.number().int().positive().nullable().optional(),
});

export async function pagarExcedenteHoras(req: Request, res: Response) {
  const id     = Number(req.params.id);
  const parsed = pagarSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return; }

  const existing = await prisma.excedenteHoras.findFirst({ where: { id, ...withTenant(req.empresaId!) } });
  if (!existing) { res.status(404).json({ error: 'Excedente no encontrado' }); return; }
  if (existing.pagado) { res.status(400).json({ error: 'Este excedente ya fue pagado' }); return; }

  if (parsed.data.liquidacion_admin_id) {
    const liq = await prisma.liquidacionAdmin.findFirst({ where: { id: parsed.data.liquidacion_admin_id, empleado_id: existing.empleado_id, ...withTenant(req.empresaId!) } });
    if (!liq) { res.status(404).json({ error: 'Liquidación no encontrada para ese empleado' }); return; }
  }

  const excedente = await prisma.excedenteHoras.update({
    where: { id },
    data: {
      pagado:               true,
      fecha_pago:           new Date(parsed.data.fecha_pago),
      liquidacion_admin_id: parsed.data.liquidacion_admin_id ?? null,
    },
    include: { empleado: { select: EMPLEADO_SELECT } },
  });
  res.json(mapExcedente(excedente));
}
