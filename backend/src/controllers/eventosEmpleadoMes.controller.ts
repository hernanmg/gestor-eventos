import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { withTenant } from '../lib/tenant';
import { registrarAuditoria } from '../lib/auditoria';
import { calcularPremioPax } from '../lib/calcularSueldoAdmin';

// Premio de producción — eventos del mes en que participó un empleado (ver
// AcuerdoSueldo.cobra_premio_produccion / EventoEmpleadoMes en schema.prisma).
// Distinto de Jornada: esto es un monto fijo por evento, no por día trabajado.

function mapDecimals(e: any) {
  return {
    ...e,
    monto_premio:     e.monto_premio     !== null ? Number(e.monto_premio)     : null,
    valor_por_pax:    e.valor_por_pax    !== null ? Number(e.valor_por_pax)    : null,
    premio_pax_total: e.premio_pax_total !== null ? Number(e.premio_pax_total) : null,
  };
}

// Monto efectivo de una fila: premio fijo + premio PAX (Fofi/Nestoras).
function montoFila(e: { monto_premio: any; premio_pax_total: any }): number {
  return (e.monto_premio !== null ? Number(e.monto_premio) : 0)
    + (e.premio_pax_total !== null ? Number(e.premio_pax_total) : 0);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Reutilizado por generarLiquidacionAdmin (sueldosAdmin.controller.ts) —
// mismo criterio que calcularResumenBitacora en bitacoraViajes.controller.ts.
export async function calcularResumenEventosMes(empleadoId: number, mes: number, anio: number) {
  const eventos = await prisma.eventoEmpleadoMes.findMany({
    where:   { empleado_id: empleadoId, periodo_mes: mes, periodo_anio: anio },
    include: { evento: { select: { id: true, nombre: true, fecha_inicio: true } } },
    orderBy: { created_at: 'asc' },
  });

  const cobrados = eventos.filter(e => e.cobra_premio);
  const total     = round2(cobrados.reduce((s, e) => s + montoFila(e), 0));
  const total_pax = round2(cobrados.reduce((s, e) => s + (e.premio_pax_total !== null ? Number(e.premio_pax_total) : 0), 0));

  return { total, total_pax, eventos: eventos.map(mapDecimals) };
}

const querySchema = z.object({
  mes:  z.coerce.number().int().min(1).max(12),
  anio: z.coerce.number().int().min(2000).max(2100),
});

export async function listEventosEmpleadoMes(req: Request, res: Response) {
  const empleadoId = Number(req.params.id);
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: 'Se requieren mes y anio' }); return; }
  const { mes, anio } = parsed.data;

  const empleado = await prisma.empleado.findFirst({ where: { id: empleadoId, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!empleado) { res.status(404).json({ error: 'Empleado no encontrado' }); return; }

  res.json(await calcularResumenEventosMes(empleadoId, mes, anio));
}

const createSchema = z.object({
  evento_id:     z.number().int().positive().nullable().optional(),
  evento_nombre: z.string().min(1).nullable().optional(),
  periodo_mes:   z.number().int().min(1).max(12),
  periodo_anio:  z.number().int().min(2000).max(2100),
  monto_premio:  z.number().min(0).nullable().optional(),
  cobra_premio:  z.boolean().default(true),
  cantidad_pax:    z.number().int().min(0).nullable().optional(),
  valor_por_pax:   z.number().min(0).nullable().optional(),
  dias_trabajados: z.number().int().min(0).nullable().optional(),
}).refine(d => d.evento_id || d.evento_nombre, {
  message: 'evento_id o evento_nombre son requeridos', path: ['evento_nombre'],
});

export async function createEventoEmpleadoMes(req: Request, res: Response) {
  const empleadoId = Number(req.params.id);
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors });
    return;
  }
  const d = parsed.data;

  const empleado = await prisma.empleado.findFirst({ where: { id: empleadoId, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!empleado) { res.status(404).json({ error: 'Empleado no encontrado' }); return; }

  if (d.evento_id) {
    const evento = await prisma.evento.findFirst({ where: { id: d.evento_id, deleted_at: null, ...withTenant(req.empresaId!) } });
    if (!evento) { res.status(400).json({ error: 'Evento no encontrado' }); return; }
  }

  try {
    const creado = await prisma.eventoEmpleadoMes.create({
      data: {
        empresa_id:    req.empresaId!,
        empleado_id:   empleadoId,
        evento_id:     d.evento_id     ?? null,
        evento_nombre: d.evento_nombre ?? null,
        periodo_mes:   d.periodo_mes,
        periodo_anio:  d.periodo_anio,
        cobra_premio:  d.cobra_premio,
        monto_premio:  d.monto_premio ?? null,
        cantidad_pax:     d.cantidad_pax    ?? null,
        valor_por_pax:    d.valor_por_pax   ?? null,
        dias_trabajados:  d.dias_trabajados ?? 1,
        premio_pax_total: calcularPremioPax(d.cantidad_pax, d.valor_por_pax, d.dias_trabajados ?? 1),
        created_by:    req.user!.id,
      },
      include: { evento: { select: { id: true, nombre: true, fecha_inicio: true } } },
    });

    await registrarAuditoria({
      usuarioId:    req.user!.id,
      empresaId:    req.empresaId,
      accion:       'CREATE',
      entidad:      'EventoEmpleadoMes',
      entidadId:    creado.id,
      descripcion:  `Agregó evento "${d.evento_nombre ?? creado.evento?.nombre}" al premio de producción de ${d.periodo_mes}/${d.periodo_anio}`,
      datosDespues: { empleado_id: empleadoId, monto_premio: d.monto_premio },
      ip:           req.ip,
      tx:           prisma as any,
    });

    res.status(201).json(mapDecimals(creado));
  } catch (err: any) {
    if (err.code === 'P2002') {
      res.status(400).json({ error: 'Ya existe un registro para ese evento y período' }); return;
    }
    throw err;
  }
}

const updateSchema = z.object({
  monto_premio:    z.number().min(0).nullable().optional(),
  cobra_premio:    z.boolean().optional(),
  cantidad_pax:    z.number().int().min(0).nullable().optional(),
  valor_por_pax:   z.number().min(0).nullable().optional(),
  dias_trabajados: z.number().int().min(0).nullable().optional(),
});

export async function updateEventoEmpleadoMes(req: Request, res: Response) {
  const id = Number(req.params.id);
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors });
    return;
  }

  const existing = await prisma.eventoEmpleadoMes.findFirst({ where: { id, ...withTenant(req.empresaId!) } });
  if (!existing) { res.status(404).json({ error: 'Registro no encontrado' }); return; }

  const d = parsed.data;
  // premio_pax_total se recalcula siempre server-side sobre los valores
  // resultantes (lo mandado + lo ya persistido) — nunca viene del frontend.
  const cantidadPax    = d.cantidad_pax    !== undefined ? d.cantidad_pax    : existing.cantidad_pax;
  const valorPorPax    = d.valor_por_pax   !== undefined ? d.valor_por_pax   : (existing.valor_por_pax !== null ? Number(existing.valor_por_pax) : null);
  const diasTrabajados = d.dias_trabajados !== undefined ? d.dias_trabajados : existing.dias_trabajados;
  const tocaPax = d.cantidad_pax !== undefined || d.valor_por_pax !== undefined || d.dias_trabajados !== undefined;

  const updated = await prisma.eventoEmpleadoMes.update({
    where: { id },
    data: {
      ...(d.monto_premio    !== undefined && { monto_premio: d.monto_premio }),
      ...(d.cobra_premio    !== undefined && { cobra_premio: d.cobra_premio }),
      ...(d.cantidad_pax    !== undefined && { cantidad_pax: d.cantidad_pax }),
      ...(d.valor_por_pax   !== undefined && { valor_por_pax: d.valor_por_pax }),
      ...(d.dias_trabajados !== undefined && { dias_trabajados: d.dias_trabajados }),
      ...(tocaPax && { premio_pax_total: calcularPremioPax(cantidadPax, valorPorPax, diasTrabajados) }),
    },
    include: { evento: { select: { id: true, nombre: true, fecha_inicio: true } } },
  });

  res.json(mapDecimals(updated));
}

export async function deleteEventoEmpleadoMes(req: Request, res: Response) {
  const id = Number(req.params.id);
  const existing = await prisma.eventoEmpleadoMes.findFirst({ where: { id, ...withTenant(req.empresaId!) } });
  if (!existing) { res.status(404).json({ error: 'Registro no encontrado' }); return; }

  await prisma.eventoEmpleadoMes.delete({ where: { id } });

  await registrarAuditoria({
    usuarioId:   req.user!.id,
    empresaId:   req.empresaId,
    accion:      'DELETE',
    entidad:     'EventoEmpleadoMes',
    entidadId:   id,
    descripcion: `Eliminó un evento del premio de producción de ${existing.periodo_mes}/${existing.periodo_anio}`,
    ip:          req.ip,
    tx:          prisma as any,
  });

  res.json({ message: 'Registro eliminado correctamente' });
}
