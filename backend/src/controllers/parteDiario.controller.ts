import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { withTenant } from '../lib/tenant';
import { registrarAuditoria } from '../lib/auditoria';
import { calcularHorasSegunEmpleado } from './rrhh.controller';
import { generateParteDiarioExcel } from '../lib/parteDiarioExporter';

// ── Helpers ───────────────────────────────────────────────────────────────────

const ASIGNACION_INCLUDE = {
  empleado: { select: { id: true, nombre: true, apellido: true, apodo: true } },
  camion:   { select: { id: true, codigo: true, descripcion: true } },
  evento:   { select: { id: true, nombre: true } },
};

function parseFechaParam(raw: string): Date | null {
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

// "08:00" + la fecha del parte → Date real. Devuelve null si no se puede
// interpretar como una hora HH:MM válida (no se puede calcular horas trabajadas
// sin una hora real, aunque el campo tenga texto libre cargado).
function parseHoraToDate(fecha: Date, hora: string): Date | null {
  const match = hora.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  if (h > 23 || m > 59) return null;
  const d = new Date(fecha);
  d.setHours(h, m, 0, 0);
  return d;
}

const ESTADOS_ASIGNACION = ['ASIGNADO', 'LIBRE', 'VACACIONES', 'AUSENTE', 'NO_CITADO'] as const;

// ═══════════════════════════════════════════════════════════════════════════
// PARTE DIARIO
// ═══════════════════════════════════════════════════════════════════════════

export async function listPartes(req: Request, res: Response) {
  const { desde, hasta, cerrado } = req.query;
  const where: any = { deleted_at: null, ...withTenant(req.empresaId!) };

  if (desde || hasta) {
    where.fecha = {};
    if (typeof desde === 'string') where.fecha.gte = new Date(desde);
    if (typeof hasta === 'string') where.fecha.lte = new Date(hasta);
  }
  if (cerrado === 'true')  where.cerrado = true;
  if (cerrado === 'false') where.cerrado = false;

  const partes = await prisma.parteDiario.findMany({
    where,
    orderBy: { fecha: 'desc' },
    include: { _count: { select: { asignaciones: { where: { deleted_at: null } } } } },
  });

  const jornadasCounts = await prisma.asignacionDiaria.groupBy({
    by: ['parte_diario_id'],
    where: { parte_diario_id: { in: partes.map(p => p.id) }, deleted_at: null, jornada_id: { not: null } },
    _count: true,
  });
  const jornadasMap = new Map(jornadasCounts.map(j => [j.parte_diario_id, j._count]));

  res.json(partes.map(p => ({
    ...p,
    total_personas:   p._count.asignaciones,
    jornadas_creadas: jornadasMap.get(p.id) ?? 0,
    _count: undefined,
  })));
}

export async function getParteDiario(req: Request, res: Response) {
  const fecha = parseFechaParam(req.params.fecha);
  if (!fecha) { res.status(400).json({ error: 'Fecha inválida' }); return; }

  const parte = await prisma.parteDiario.findFirst({
    where: { fecha, deleted_at: null, ...withTenant(req.empresaId!) },
    include: {
      asignaciones: {
        where:   { deleted_at: null },
        include: ASIGNACION_INCLUDE,
        orderBy: [{ seccion: 'asc' }, { orden: 'asc' }],
      },
    },
  });
  if (!parte) { res.status(404).json({ error: 'No existe un parte diario para esa fecha' }); return; }

  res.json(parte);
}

const crearParteSchema = z.object({
  fecha:  z.string().min(1),
  titulo: z.string().nullable().optional(),
  notas:  z.string().nullable().optional(),
});

export async function crearParte(req: Request, res: Response) {
  const parsed = crearParteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return;
  }
  const d = parsed.data;
  const fecha = new Date(d.fecha);

  const existing = await prisma.parteDiario.findFirst({ where: { fecha, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (existing) { res.status(400).json({ error: 'Ya existe un parte diario para esa fecha' }); return; }

  const parte = await prisma.$transaction(async tx => {
    const created = await tx.parteDiario.create({
      data: {
        ...withTenant(req.empresaId!),
        fecha,
        titulo:     d.titulo ?? null,
        notas:      d.notas ?? null,
        created_by: req.user!.id,
      },
    });
    await registrarAuditoria({
      usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'CREATE', entidad: 'ParteDiario', entidadId: created.id,
      descripcion: `Creó el parte diario del ${d.fecha}`,
      ip: req.ip, tx: tx as any,
    });
    return created;
  });

  res.status(201).json({ ...parte, asignaciones: [] });
}

const updateParteSchema = z.object({
  titulo: z.string().nullable().optional(),
  notas:  z.string().nullable().optional(),
});

// PUT /api/parte-diario/:id — editar título/notas (no forma parte del pedido
// literal de endpoints, pero el frontend pide "título editable inline").
export async function updateParte(req: Request, res: Response) {
  const id = Number(req.params.id);
  const existing = await prisma.parteDiario.findFirst({ where: { id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!existing) { res.status(404).json({ error: 'Parte diario no encontrado' }); return; }
  if (existing.cerrado) { res.status(400).json({ error: 'El parte está cerrado y no se puede editar' }); return; }

  const parsed = updateParteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return;
  }
  const d = parsed.data;

  const updated = await prisma.parteDiario.update({
    where: { id },
    data: {
      ...(d.titulo !== undefined && { titulo: d.titulo }),
      ...(d.notas  !== undefined && { notas:  d.notas }),
    },
  });

  res.json(updated);
}

// ═══════════════════════════════════════════════════════════════════════════
// ASIGNACIONES
// ═══════════════════════════════════════════════════════════════════════════

const asignacionSchema = z.object({
  empleado_id:      z.number().int().positive(),
  estado:           z.enum(ESTADOS_ASIGNACION).default('ASIGNADO'),
  hora_ingreso:     z.string().nullable().optional(),
  lugar:            z.string().nullable().optional(),
  tarea:            z.string().nullable().optional(),
  seccion:          z.string().nullable().optional(),
  camion_id:        z.number().int().positive().nullable().optional(),
  vehiculo_texto:   z.string().nullable().optional(),
  evento_id:        z.number().int().positive().nullable().optional(),
  hora_salida:      z.string().nullable().optional(),
  hora_salida_fija: z.boolean().optional(),
  orden:            z.number().int().positive().optional(),
});

async function validarReferenciasAsignacion(
  req: Request, d: { camion_id?: number | null; evento_id?: number | null },
): Promise<string | null> {
  if (d.camion_id) {
    const camion = await prisma.camion.findFirst({ where: { id: d.camion_id, deleted_at: null, ...withTenant(req.empresaId!) } });
    if (!camion) return 'Camión no encontrado';
  }
  if (d.evento_id) {
    const evento = await prisma.evento.findFirst({ where: { id: d.evento_id, deleted_at: null, ...withTenant(req.empresaId!) } });
    if (!evento) return 'Evento no encontrado';
  }
  return null;
}

export async function addAsignacion(req: Request, res: Response) {
  const parteId = Number(req.params.id);
  const parte = await prisma.parteDiario.findFirst({ where: { id: parteId, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!parte) { res.status(404).json({ error: 'Parte diario no encontrado' }); return; }
  if (parte.cerrado) { res.status(400).json({ error: 'El parte está cerrado y no se puede editar' }); return; }

  const parsed = asignacionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return;
  }
  const d = parsed.data;

  const empleado = await prisma.empleado.findFirst({ where: { id: d.empleado_id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!empleado) { res.status(400).json({ error: 'Empleado no encontrado' }); return; }

  const refError = await validarReferenciasAsignacion(req, d);
  if (refError) { res.status(400).json({ error: refError }); return; }

  let orden = d.orden;
  if (orden === undefined) {
    const last = await prisma.asignacionDiaria.findFirst({
      where:   { parte_diario_id: parteId, seccion: d.seccion ?? null, deleted_at: null },
      orderBy: { orden: 'desc' },
    });
    orden = (last?.orden ?? 0) + 1;
  }

  try {
    const asignacion = await prisma.$transaction(async tx => {
      const created = await tx.asignacionDiaria.create({
        data: {
          parte_diario_id: parteId,
          empleado_id:     d.empleado_id,
          ...withTenant(req.empresaId!),
          estado:           d.estado,
          hora_ingreso:     d.hora_ingreso ?? null,
          lugar:            d.lugar ?? null,
          tarea:            d.tarea ?? null,
          seccion:          d.seccion ?? null,
          camion_id:        d.camion_id ?? null,
          vehiculo_texto:   d.vehiculo_texto ?? null,
          evento_id:        d.evento_id ?? null,
          hora_salida:      d.hora_salida ?? null,
          hora_salida_fija: d.hora_salida_fija ?? false,
          orden:            orden!,
        },
        include: ASIGNACION_INCLUDE,
      });

      await registrarAuditoria({
        usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'CREATE', entidad: 'AsignacionDiaria', entidadId: created.id,
        descripcion:  `Agregó a ${empleado.apellido}, ${empleado.nombre} al parte diario`,
        datosDespues: parsed.data, ip: req.ip, tx: tx as any,
      });

      return created;
    });

    res.status(201).json(asignacion);
  } catch (err: any) {
    if (err?.code === 'P2002') {
      res.status(400).json({ error: 'Ese empleado ya tiene una asignación en este parte' }); return;
    }
    throw err;
  }
}

const updateAsignacionSchema = asignacionSchema.partial();

export async function updateAsignacion(req: Request, res: Response) {
  const parteId      = Number(req.params.id);
  const asignacionId = Number(req.params.asignacionId);

  const parte = await prisma.parteDiario.findFirst({ where: { id: parteId, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!parte) { res.status(404).json({ error: 'Parte diario no encontrado' }); return; }
  if (parte.cerrado) { res.status(400).json({ error: 'El parte está cerrado y no se puede editar' }); return; }

  const existing = await prisma.asignacionDiaria.findFirst({ where: { id: asignacionId, parte_diario_id: parteId, deleted_at: null } });
  if (!existing) { res.status(404).json({ error: 'Asignación no encontrada' }); return; }

  const parsed = updateAsignacionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return;
  }
  const d = parsed.data;

  const refError = await validarReferenciasAsignacion(req, d);
  if (refError) { res.status(400).json({ error: refError }); return; }

  const updated = await prisma.$transaction(async tx => {
    await tx.asignacionDiaria.update({
      where: { id: asignacionId },
      data: {
        ...(d.estado           !== undefined && { estado:           d.estado }),
        ...(d.hora_ingreso     !== undefined && { hora_ingreso:     d.hora_ingreso }),
        ...(d.lugar            !== undefined && { lugar:            d.lugar }),
        ...(d.tarea            !== undefined && { tarea:            d.tarea }),
        ...(d.seccion          !== undefined && { seccion:          d.seccion }),
        ...(d.camion_id        !== undefined && { camion_id:        d.camion_id }),
        ...(d.vehiculo_texto   !== undefined && { vehiculo_texto:   d.vehiculo_texto }),
        ...(d.evento_id        !== undefined && { evento_id:        d.evento_id }),
        ...(d.hora_salida      !== undefined && { hora_salida:      d.hora_salida }),
        ...(d.hora_salida_fija !== undefined && { hora_salida_fija: d.hora_salida_fija }),
      },
    });

    // Reordenamiento drag&drop — mismo patrón de resequencing que PedidoItem/Movimiento.
    if (d.orden !== undefined) {
      const seccion = d.seccion !== undefined ? d.seccion : existing.seccion;
      const others = await tx.asignacionDiaria.findMany({
        where:   { parte_diario_id: parteId, seccion, deleted_at: null, id: { not: asignacionId } },
        orderBy: { orden: 'asc' },
      });
      const clamped   = Math.min(Math.max(d.orden, 1), others.length + 1);
      const reordered = [...others];
      reordered.splice(clamped - 1, 0, { id: asignacionId } as any);
      for (let i = 0; i < reordered.length; i++) {
        await tx.asignacionDiaria.update({ where: { id: reordered[i].id }, data: { orden: i + 1 } });
      }
    }

    await registrarAuditoria({
      usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'UPDATE', entidad: 'AsignacionDiaria', entidadId: asignacionId,
      descripcion:  `Actualizó una asignación del parte diario #${parteId}`,
      datosAntes:   { estado: existing.estado, hora_ingreso: existing.hora_ingreso, hora_salida: existing.hora_salida },
      datosDespues: parsed.data, ip: req.ip, tx: tx as any,
    });

    return tx.asignacionDiaria.findUniqueOrThrow({ where: { id: asignacionId }, include: ASIGNACION_INCLUDE });
  });

  res.json(updated);
}

export async function deleteAsignacion(req: Request, res: Response) {
  const parteId      = Number(req.params.id);
  const asignacionId = Number(req.params.asignacionId);

  const parte = await prisma.parteDiario.findFirst({ where: { id: parteId, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!parte) { res.status(404).json({ error: 'Parte diario no encontrado' }); return; }
  if (parte.cerrado) { res.status(400).json({ error: 'El parte está cerrado y no se puede editar' }); return; }

  const existing = await prisma.asignacionDiaria.findFirst({ where: { id: asignacionId, parte_diario_id: parteId, deleted_at: null } });
  if (!existing) { res.status(404).json({ error: 'Asignación no encontrada' }); return; }

  await prisma.$transaction(async tx => {
    await tx.asignacionDiaria.update({ where: { id: asignacionId }, data: { deleted_at: new Date() } });
    await registrarAuditoria({
      usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'DELETE', entidad: 'AsignacionDiaria', entidadId: asignacionId,
      descripcion: `Eliminó una asignación del parte diario #${parteId}`,
      ip: req.ip, tx: tx as any,
    });
  });

  res.json({ message: 'Asignación eliminada correctamente' });
}

// ═══════════════════════════════════════════════════════════════════════════
// CERRAR PARTE — genera Jornadas automáticamente
// ═══════════════════════════════════════════════════════════════════════════

export async function cerrarParte(req: Request, res: Response) {
  const parteId = Number(req.params.id);
  const parte = await prisma.parteDiario.findFirst({ where: { id: parteId, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!parte) { res.status(404).json({ error: 'Parte diario no encontrado' }); return; }
  if (parte.cerrado) { res.status(400).json({ error: 'Este parte diario ya está cerrado' }); return; }

  const asignaciones = await prisma.asignacionDiaria.findMany({
    where:   { parte_diario_id: parteId, deleted_at: null },
    include: { empleado: true },
  });

  let jornadasCreadas    = 0;
  let jornadasVinculadas = 0;
  let omitidas           = 0;

  await prisma.$transaction(async tx => {
    for (const asig of asignaciones) {
      if (asig.estado !== 'ASIGNADO') continue;

      // La hora de salida solo cuenta si es fija (computada) — si es
      // voluntaria ("***" en el Excel original) no hay hora real que usar.
      if (!asig.hora_ingreso || !asig.hora_salida_fija || !asig.hora_salida) { omitidas++; continue; }

      const horaIngresoDate = parseHoraToDate(parte.fecha, asig.hora_ingreso);
      const horaSalidaDate  = parseHoraToDate(parte.fecha, asig.hora_salida);
      if (!horaIngresoDate || !horaSalidaDate) { omitidas++; continue; }

      let jornada = await tx.jornada.findUnique({
        where: { empleado_id_fecha: { empleado_id: asig.empleado_id, fecha: parte.fecha } },
      });

      if (jornada) {
        jornadasVinculadas++;
      } else {
        const { horas_normales, horas_extras } = calcularHorasSegunEmpleado(asig.empleado, horaIngresoDate, horaSalidaDate);
        jornada = await tx.jornada.create({
          data: {
            empleado_id:       asig.empleado_id,
            empresa_id:        req.empresaId!,
            evento_id:         asig.evento_id ?? null,
            fecha:             parte.fecha,
            hora_convocatoria: horaIngresoDate,
            hora_ingreso:      horaIngresoDate,
            hora_egreso:       horaSalidaDate,
            horas_normales,
            horas_extras,
            convocatoria:      asig.tarea,
            lugar_trabajo:     asig.lugar,
            camion_id:         asig.camion_id,
            estado:            'PENDIENTE',
            created_by:        req.user!.id,
          },
        });
        jornadasCreadas++;
      }

      await tx.asignacionDiaria.update({ where: { id: asig.id }, data: { jornada_id: jornada.id } });
    }

    await tx.parteDiario.update({ where: { id: parteId }, data: { cerrado: true } });

    await registrarAuditoria({
      usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'UPDATE', entidad: 'ParteDiario', entidadId: parteId,
      descripcion: `Cerró el parte diario del ${parte.fecha.toISOString().slice(0, 10)} — ${jornadasCreadas} jornadas creadas, ${jornadasVinculadas} vinculadas, ${omitidas} omitidas`,
      datosDespues: { jornadasCreadas, jornadasVinculadas, omitidas },
      ip: req.ip, tx: tx as any,
    });
  });

  res.json({ jornadas_creadas: jornadasCreadas, jornadas_vinculadas: jornadasVinculadas, omitidas });
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTAR
// ═══════════════════════════════════════════════════════════════════════════

export async function exportarParte(req: Request, res: Response) {
  const parteId = Number(req.params.id);
  const parte = await prisma.parteDiario.findFirst({ where: { id: parteId, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!parte) { res.status(404).json({ error: 'Parte diario no encontrado' }); return; }

  const { buffer, filename } = await generateParteDiarioExcel(parteId, req.empresaId!);

  res.set({
    'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
    'Content-Length':      String(buffer.length),
  });
  res.end(buffer);
}
