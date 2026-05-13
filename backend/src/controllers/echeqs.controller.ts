import type { Request, Response } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { Moneda, EstadoEcheq } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { recalcularSaldosCaja } from '../lib/recalcularSaldos';
import { registrarAuditoria } from '../lib/auditoria';

function mapEcheq(e: any) {
  return { ...e, importe: Number(e.importe) };
}

function calcDiasVencimiento(e: any): number | null {
  if (e.estado !== EstadoEcheq.PENDIENTE || !e.fecha_cobro_estimada) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((new Date(e.fecha_cobro_estimada).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function mapEcheqFull(e: any) {
  return { ...mapEcheq(e), dias_para_vencimiento: calcDiasVencimiento(e) };
}

const createEcheqSchema = z.object({
  movimiento_id:        z.number().int().positive().optional(),
  proveedor_id:         z.number().int().positive().optional(),
  numero:               z.string().min(1),
  razon_social:         z.string().min(1).optional(),
  detalle:              z.string().nullable().optional(),
  importe:              z.number().positive(),
  moneda:               z.enum(['ARS', 'USD']).default('ARS'),
  fecha_emision:        z.string().nullable().optional(),
  fecha_cobro_estimada: z.string().nullable().optional(),
}).refine(
  d => d.razon_social || d.proveedor_id,
  { message: 'razon_social o proveedor_id son requeridos', path: ['razon_social'] },
);

const updateEcheqSchema = z.object({
  proveedor_id:         z.number().int().positive().nullable().optional(),
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

const rechazarSchema = z.object({
  motivo_rechazo: z.string().nullable().optional(),
});

export async function listEcheqs(req: Request, res: Response) {
  const eventoId = Number(req.params.id);
  const { estado, moneda, desde, hasta, razon_social, vencen_en_dias } = req.query;

  const where: Prisma.EcheqWhereInput = { evento_id: eventoId, deleted_at: null };

  if (estado)       where.estado = estado as EstadoEcheq;
  if (moneda)       where.moneda = moneda as Moneda;
  if (razon_social) where.razon_social = { contains: String(razon_social), mode: 'insensitive' };

  const fechaFilter: Prisma.DateTimeNullableFilter<'Echeq'> = {};
  if (desde) fechaFilter.gte = new Date(String(desde));
  if (hasta) fechaFilter.lte = new Date(String(hasta));

  if (vencen_en_dias !== undefined) {
    const limit = new Date();
    limit.setDate(limit.getDate() + Number(vencen_en_dias));
    where.estado = EstadoEcheq.PENDIENTE;
    fechaFilter.lte = limit;
  }

  if (Object.keys(fechaFilter).length > 0) where.fecha_cobro_estimada = fechaFilter;

  const echeqs = await prisma.echeq.findMany({
    where,
    orderBy: { created_at: 'desc' },
  });

  res.json(echeqs.map(mapEcheqFull));
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

  let razonSocial = parsed.data.razon_social ?? null;
  if (parsed.data.proveedor_id) {
    const prov = await prisma.proveedor.findFirst({ where: { id: parsed.data.proveedor_id, activo: true, deleted_at: null } });
    if (!prov) { res.status(400).json({ error: 'Proveedor no encontrado o inactivo' }); return; }
    if (!razonSocial) razonSocial = prov.nombre;
  }
  if (!razonSocial) { res.status(400).json({ error: 'razon_social o proveedor_id son requeridos' }); return; }

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
      movimiento_id:        parsed.data.movimiento_id  ?? null,
      proveedor_id:         parsed.data.proveedor_id   ?? null,
      numero:               parsed.data.numero,
      razon_social:         razonSocial,
      detalle:              parsed.data.detalle        ?? null,
      importe:              parsed.data.importe,
      moneda:               parsed.data.moneda                as Moneda,
      fecha_emision:        parsed.data.fecha_emision        ? new Date(parsed.data.fecha_emision)        : null,
      fecha_cobro_estimada: parsed.data.fecha_cobro_estimada ? new Date(parsed.data.fecha_cobro_estimada) : null,
      created_by:           req.user!.id,
      updated_by:           req.user!.id,
    },
  });

  await registrarAuditoria({
    usuarioId:    req.user!.id,
    accion:       'CREATE',
    entidad:      'Echeq',
    entidadId:    echeq.id,
    eventoId,
    descripcion:  `Creó echeq #${parsed.data.numero} por ${parsed.data.importe} ${parsed.data.moneda} — ${razonSocial}`,
    datosDespues: { numero: parsed.data.numero, importe: parsed.data.importe, moneda: parsed.data.moneda, razon_social: razonSocial },
    ip:           req.ip,
    tx:           prisma as any,
  });

  res.status(201).json(mapEcheqFull(echeq));
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
      ...(parsed.data.proveedor_id         !== undefined && { proveedor_id: parsed.data.proveedor_id }),
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

  await registrarAuditoria({
    usuarioId:    req.user!.id,
    accion:       'UPDATE',
    entidad:      'Echeq',
    entidadId:    id,
    eventoId:     existing.evento_id,
    descripcion:  `Actualizó echeq #${existing.numero}`,
    datosAntes:   { numero: existing.numero, importe: Number(existing.importe), moneda: existing.moneda, estado: existing.estado },
    datosDespues: parsed.data,
    ip:           req.ip,
    tx:           prisma as any,
  });

  res.json(mapEcheqFull(updated));
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

  await registrarAuditoria({
    usuarioId:  req.user!.id,
    accion:     'DELETE',
    entidad:    'Echeq',
    entidadId:  id,
    eventoId:   existing.evento_id,
    descripcion: `Eliminó echeq #${existing.numero}`,
    datosAntes:  { numero: existing.numero, importe: Number(existing.importe), moneda: existing.moneda, razon_social: existing.razon_social },
    ip:          req.ip,
    tx:          prisma as any,
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
        debe:        Number(echeq.importe),
        haber:       0,
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

    await registrarAuditoria({
      usuarioId:    req.user!.id,
      accion:       'UPDATE',
      entidad:      'Echeq',
      entidadId:    id,
      eventoId:     echeq.evento_id,
      descripcion:  `Cobró echeq #${echeq.numero} — ${echeq.razon_social}`,
      datosAntes:   { estado: 'PENDIENTE', numero: echeq.numero },
      datosDespues: { estado: 'COBRADO', cuenta_id: parsed.data.cuenta_id },
      ip:           req.ip,
      tx:           tx as any,
    });
  });

  const updated = await prisma.echeq.findUnique({ where: { id } });
  res.json(mapEcheqFull(updated));
}

export async function rechazarEcheq(req: Request, res: Response) {
  const id     = Number(req.params.id);
  const parsed = rechazarSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos' }); return;
  }

  const echeq = await prisma.echeq.findFirst({ where: { id, deleted_at: null } });
  if (!echeq) { res.status(404).json({ error: 'Echeq no encontrado' }); return; }
  if (echeq.estado !== EstadoEcheq.PENDIENTE) {
    res.status(400).json({ error: 'Solo se pueden rechazar echeqs en estado PENDIENTE' }); return;
  }

  const updated = await prisma.echeq.update({
    where: { id },
    data: {
      estado:         EstadoEcheq.RECHAZADO,
      motivo_rechazo: parsed.data.motivo_rechazo ?? null,
      updated_by:     req.user!.id,
    },
  });

  await registrarAuditoria({
    usuarioId:    req.user!.id,
    accion:       'UPDATE',
    entidad:      'Echeq',
    entidadId:    id,
    eventoId:     echeq.evento_id,
    descripcion:  `Rechazó echeq #${echeq.numero}${parsed.data.motivo_rechazo ? ` — ${parsed.data.motivo_rechazo}` : ''}`,
    datosAntes:   { estado: 'PENDIENTE', numero: echeq.numero },
    datosDespues: { estado: 'RECHAZADO', motivo_rechazo: parsed.data.motivo_rechazo },
    ip:           req.ip,
    tx:           prisma as any,
  });

  res.json(mapEcheqFull(updated));
}

export async function alertasEcheqs(req: Request, res: Response) {
  const eventoId = Number(req.params.id);
  const today    = new Date();
  today.setHours(0, 0, 0, 0);
  const en7Dias  = new Date(today);
  en7Dias.setDate(en7Dias.getDate() + 7);

  const [vencidos, vencen_pronto] = await Promise.all([
    prisma.echeq.findMany({
      where: {
        evento_id:            eventoId,
        deleted_at:           null,
        estado:               EstadoEcheq.PENDIENTE,
        fecha_cobro_estimada: { lt: today },
      },
      orderBy: { fecha_cobro_estimada: 'asc' },
    }),
    prisma.echeq.findMany({
      where: {
        evento_id:            eventoId,
        deleted_at:           null,
        estado:               EstadoEcheq.PENDIENTE,
        fecha_cobro_estimada: { gte: today, lte: en7Dias },
      },
      orderBy: { fecha_cobro_estimada: 'asc' },
    }),
  ]);

  res.json({
    vencidos:      vencidos.map(mapEcheqFull),
    vencen_pronto: vencen_pronto.map(mapEcheqFull),
  });
}
