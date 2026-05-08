import type { Request, Response } from 'express';
import { z } from 'zod';
import { Moneda, EstadoEvento } from '@prisma/client';
import { prisma } from '../lib/prisma';

const socioSchema = z.object({
  nombre:     z.string().min(1, 'Nombre requerido'),
  porcentaje: z.number().positive('Debe ser positivo'),
});

const createSchema = z.object({
  nombre:       z.string().min(1, 'El nombre es requerido'),
  fecha_inicio: z.string().nullable().optional(),
  fecha_fin:    z.string().nullable().optional(),
  socios:       z.array(socioSchema).default([]),
  moneda_base:  z.enum(['ARS', 'USD']).default('ARS'),
});

const updateSchema = z.object({
  nombre:       z.string().min(1).optional(),
  fecha_inicio: z.string().nullable().optional(),
  fecha_fin:    z.string().nullable().optional(),
  socios:       z.array(socioSchema).optional(),
  moneda_base:  z.enum(['ARS', 'USD']).optional(),
  estado:       z.enum(['ACTIVO', 'CERRADO', 'IMPORTADO']).optional(),
});

function sociosSumOk(socios: { porcentaje: number }[]): boolean {
  if (socios.length === 0) return true;
  const sum = socios.reduce((acc, s) => acc + s.porcentaje, 0);
  return Math.abs(sum - 100) < 0.01;
}

function toDate(s: string | null | undefined): Date | null | undefined {
  if (s === null) return null;
  if (s === undefined) return undefined;
  return new Date(s);
}

const includeCount = {
  _count: { select: { movimientos: { where: { deleted_at: null as null } } } },
};

function mapEvento(e: any) {
  const { _count, ...rest } = e;
  return { ...rest, movimiento_count: _count?.movimientos ?? 0 };
}

export async function list(_req: Request, res: Response) {
  const eventos = await prisma.evento.findMany({
    where:   { deleted_at: null },
    orderBy: { created_at: 'desc' },
    include: includeCount,
  });
  res.json(eventos.map(mapEvento));
}

export async function detail(req: Request, res: Response) {
  const id = Number(req.params.id);
  const evento = await prisma.evento.findFirst({
    where:   { id, deleted_at: null },
    include: includeCount,
  });
  if (!evento) { res.status(404).json({ error: 'Evento no encontrado' }); return; }
  res.json(mapEvento(evento));
}

export async function create(req: Request, res: Response) {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors });
    return;
  }
  const { nombre, fecha_inicio, fecha_fin, socios, moneda_base } = parsed.data;
  if (!sociosSumOk(socios)) {
    res.status(400).json({ error: 'Los porcentajes de socios deben sumar 100' });
    return;
  }
  const evento = await prisma.evento.create({
    data: {
      nombre,
      fecha_inicio: toDate(fecha_inicio) ?? null,
      fecha_fin:    toDate(fecha_fin) ?? null,
      socios,
      moneda_base:  moneda_base as Moneda,
      created_by:   req.user!.id,
      updated_by:   req.user!.id,
    },
    include: includeCount,
  });
  res.status(201).json(mapEvento(evento));
}

export async function update(req: Request, res: Response) {
  const id = Number(req.params.id);
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors });
    return;
  }
  const existing = await prisma.evento.findFirst({ where: { id, deleted_at: null } });
  if (!existing) { res.status(404).json({ error: 'Evento no encontrado' }); return; }

  const { nombre, fecha_inicio, fecha_fin, socios, moneda_base, estado } = parsed.data;
  if (socios !== undefined && !sociosSumOk(socios)) {
    res.status(400).json({ error: 'Los porcentajes de socios deben sumar 100' });
    return;
  }
  const evento = await prisma.evento.update({
    where: { id },
    data: {
      ...(nombre       !== undefined && { nombre }),
      ...(fecha_inicio !== undefined && { fecha_inicio: toDate(fecha_inicio) }),
      ...(fecha_fin    !== undefined && { fecha_fin:    toDate(fecha_fin) }),
      ...(socios       !== undefined && { socios }),
      ...(moneda_base  !== undefined && { moneda_base: moneda_base as Moneda }),
      ...(estado       !== undefined && { estado: estado as EstadoEvento }),
      updated_by: req.user!.id,
    },
    include: includeCount,
  });
  res.json(mapEvento(evento));
}

export async function remove(req: Request, res: Response) {
  const id = Number(req.params.id);
  const existing = await prisma.evento.findFirst({ where: { id, deleted_at: null } });
  if (!existing) { res.status(404).json({ error: 'Evento no encontrado' }); return; }
  await prisma.evento.update({
    where: { id },
    data:  { deleted_at: new Date(), updated_by: req.user!.id },
  });
  res.json({ message: 'Evento eliminado correctamente' });
}

// ── Conciliatoria ─────────────────────────────────────────────────────────────

export async function conciliatoria(req: Request, res: Response) {
  const id = Number(req.params.id);

  const evento = await prisma.evento.findFirst({ where: { id, deleted_at: null } });
  if (!evento) { res.status(404).json({ error: 'Evento no encontrado' }); return; }

  const [tabs, movimientos, cuentas, echeqsPendientes] = await Promise.all([
    prisma.tabConfig.findMany({ orderBy: [{ tipo: 'asc' }, { numero: 'asc' }] }),
    prisma.movimiento.findMany({
      where:  { evento_id: id, deleted_at: null },
      select: { tipo: true, tab_numero: true, moneda: true, debe: true, haber: true },
    }),
    prisma.cuentaBancaria.findMany({
      where:   { evento_id: id, deleted_at: null },
      include: {
        movimientos: {
          where:   { deleted_at: null },
          orderBy: { orden: 'asc' },
          select:  { debe: true, haber: true, saldo_corriente: true },
        },
      },
    }),
    prisma.echeq.findMany({
      where:  { evento_id: id, deleted_at: null, estado: 'PENDIENTE' },
      select: { importe: true, moneda: true },
    }),
  ]);

  // Monedas presentes — at least moneda_base if no movimientos
  const monedasSet = new Set(movimientos.map(m => m.moneda as string));
  if (monedasSet.size === 0) monedasSet.add(evento.moneda_base);
  const monedas = [...monedasSet];

  const ingresoTabs = tabs.filter(t => t.tipo === 'INGRESO');
  const egresoTabs  = tabs.filter(t => t.tipo === 'EGRESO');
  const socios      = (evento.socios as { nombre: string; porcentaje: number }[]);

  const por_moneda = monedas.map(moneda => {
    const forMoneda = movimientos.filter(m => m.moneda === moneda);

    const buildTabs = (tipo: 'INGRESO' | 'EGRESO', tabList: typeof ingresoTabs) =>
      tabList.map(t => {
        const rows       = forMoneda.filter(m => m.tipo === tipo && m.tab_numero === t.numero);
        const total_debe  = rows.reduce((a, m) => a + Number(m.debe),  0);
        const total_haber = rows.reduce((a, m) => a + Number(m.haber), 0);
        const saldo       = parseFloat((total_debe - total_haber).toFixed(2));
        return { tab_numero: t.numero, nombre: t.nombre, total_debe, total_haber, saldo };
      });

    const ingresos        = buildTabs('INGRESO', ingresoTabs);
    const egresos         = buildTabs('EGRESO',  egresoTabs);
    const total_ingresos  = parseFloat(ingresos.reduce((a, t) => a + t.saldo, 0).toFixed(2));
    const total_egresos   = parseFloat(egresos.reduce((a, t) => a + t.saldo, 0).toFixed(2));
    const saldo_final     = parseFloat((total_ingresos - total_egresos).toFixed(2));

    const distribucion_socios = socios.map(s => ({
      nombre:     s.nombre,
      porcentaje: s.porcentaje,
      monto:      parseFloat((saldo_final * s.porcentaje / 100).toFixed(2)),
    }));

    return { moneda, ingresos, egresos, total_ingresos, total_egresos, saldo_final, distribucion_socios };
  });

  const caja_por_cuenta = cuentas.map(c => {
    const movs          = c.movimientos;
    const lastMov       = movs[movs.length - 1];
    const saldo_actual  = lastMov ? Number(lastMov.saldo_corriente) : Number(c.saldo_inicial);
    const total_ing     = movs.reduce((a, m) => a + Number(m.debe),  0);
    const total_egr     = movs.reduce((a, m) => a + Number(m.haber), 0);
    return {
      cuenta_id:      c.id,
      nombre:         c.nombre,
      tipo:           c.tipo,
      moneda:         c.moneda,
      saldo_inicial:  Number(c.saldo_inicial),
      saldo_actual:   parseFloat(saldo_actual.toFixed(2)),
      total_ingresos: parseFloat(total_ing.toFixed(2)),
      total_egresos:  parseFloat(total_egr.toFixed(2)),
    };
  });

  const totalPorMonedaMap = new Map<string, number>();
  for (const e of echeqsPendientes) {
    totalPorMonedaMap.set(e.moneda, (totalPorMonedaMap.get(e.moneda) ?? 0) + Number(e.importe));
  }
  const echeqs_pendientes = {
    cantidad:        echeqsPendientes.length,
    total_por_moneda: [...totalPorMonedaMap.entries()].map(([moneda, total]) => ({
      moneda,
      total: parseFloat(total.toFixed(2)),
    })),
  };

  res.json({
    evento: { id: evento.id, nombre: evento.nombre, estado: evento.estado, moneda_base: evento.moneda_base, socios },
    por_moneda,
    caja_por_cuenta,
    echeqs_pendientes,
  });
}
