import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { withTenant } from '../lib/tenant';
import { registrarAuditoria } from '../lib/auditoria';
import { generatePresentismoExcel } from '../lib/presentismoExporter';
import {
  ESTADOS_ASISTENCIA, DESCUENTA_POR_DEFECTO, calcularHorasTrabajadas, calcularMinutosTardanza,
  calcularConteo, esDomingoTrabajado,
} from '../lib/presentismoCalculo';
import { parsePlanillaPresentismo, aplicarPlanillaPresentismo } from '../lib/presentismoPlanillaImporter';

// ── Helpers ───────────────────────────────────────────────────────────────────

const EMPLEADO_MINI_SELECT = {
  id: true, nombre: true, apellido: true, apodo: true, categoria: true, hora_convocatoria_default: true,
} as const;

const REGISTRO_INCLUDE = {
  empleado: { select: EMPLEADO_MINI_SELECT },
  jornada:  { select: { id: true, estado: true, horas_normales: true, horas_extras: true } },
} as const;

// DEMORA y TARDE miden minutos contra la citación del día (o la default del
// empleado); el resto de los estados no tiene tardanza.
const CON_TARDANZA = new Set(['DEMORA', 'TARDE']);

function parseFechaParam(raw: string): Date | null {
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

function soloFecha(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function toNumberRegistro(r: any) {
  return { ...r, horas_trabajadas: r.horas_trabajadas != null ? Number(r.horas_trabajadas) : null };
}

function diasEnMes(anio: number, mes: number): number {
  return new Date(Date.UTC(anio, mes, 0)).getUTCDate();
}

// Días hábiles del mes (lunes a viernes) — sábados y domingos quedan afuera
// del conteo de "días hábiles" (ver vista mensual: se pintan de gris).
function diasHabilesDelMes(anio: number, mes: number): number {
  const total = diasEnMes(anio, mes);
  let habiles = 0;
  for (let d = 1; d <= total; d++) {
    const dow = new Date(Date.UTC(anio, mes - 1, d)).getUTCDay();
    if (dow !== 0 && dow !== 6) habiles++;
  }
  return habiles;
}

// ═══════════════════════════════════════════════════════════════════════════
// LISTADO / DÍA / UPSERT / EDICIÓN / BAJA
// ═══════════════════════════════════════════════════════════════════════════

export async function listRegistros(req: Request, res: Response) {
  const { fecha, mes, anio, empleado_id, estado } = req.query;
  const where: any = { deleted_at: null, ...withTenant(req.empresaId!) };

  if (mes && anio) {
    const mesNum  = Number(mes);
    const anioNum = Number(anio);
    where.fecha = {
      gte: new Date(Date.UTC(anioNum, mesNum - 1, 1)),
      lte: new Date(Date.UTC(anioNum, mesNum - 1, diasEnMes(anioNum, mesNum), 23, 59, 59)),
    };
  } else {
    const f = typeof fecha === 'string' ? parseFechaParam(fecha) : new Date();
    if (!f) { res.status(400).json({ error: 'Fecha inválida' }); return; }
    where.fecha = soloFecha(f);
  }
  if (empleado_id) where.empleado_id = Number(empleado_id);
  if (estado)       where.estado = estado;

  const registros = await prisma.registroAsistencia.findMany({
    where, include: REGISTRO_INCLUDE,
    orderBy: [{ fecha: 'asc' }, { empleado: { apellido: 'asc' } }],
  });

  res.json(registros.map(toNumberRegistro));
}

// GET /api/presentismo/hoy — todos los empleados activos con su registro del
// día (o null si Lorena todavía no lo cargó).
export async function getPresentismoHoy(req: Request, res: Response) {
  const fechaParam = typeof req.query.fecha === 'string' ? parseFechaParam(req.query.fecha) : new Date();
  if (!fechaParam) { res.status(400).json({ error: 'Fecha inválida' }); return; }
  const fecha = soloFecha(fechaParam);

  const [empleados, registros] = await Promise.all([
    prisma.empleado.findMany({
      where: { deleted_at: null, estado: 'ACTIVO', ...withTenant(req.empresaId!) },
      select: EMPLEADO_MINI_SELECT,
      orderBy: { apellido: 'asc' },
    }),
    prisma.registroAsistencia.findMany({
      where: { fecha, deleted_at: null, ...withTenant(req.empresaId!) },
      include: REGISTRO_INCLUDE,
    }),
  ]);

  const registroPorEmpleado = new Map(registros.map(r => [r.empleado_id, r]));

  res.json({
    fecha: fecha.toISOString().slice(0, 10),
    items: empleados.map(empleado => ({
      empleado,
      registro: registroPorEmpleado.has(empleado.id) ? toNumberRegistro(registroPorEmpleado.get(empleado.id)) : null,
    })),
  });
}

const registroSchema = z.object({
  empleado_id:           z.number().int().positive(),
  fecha:                 z.string().min(1),
  estado:                z.enum(ESTADOS_ASISTENCIA).default('PRESENTE'),
  hora_ingreso:          z.string().nullable().optional(),
  hora_egreso:           z.string().nullable().optional(),
  hora_convocatoria:     z.string().nullable().optional(),
  motivo:                z.string().nullable().optional(),
  descuenta_presentismo: z.boolean().optional(),
});

export async function upsertRegistro(req: Request, res: Response) {
  const parsed = registroSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return;
  }
  const d = parsed.data;
  const fecha = soloFecha(new Date(d.fecha));
  if (isNaN(fecha.getTime())) { res.status(400).json({ error: 'Fecha inválida' }); return; }

  const empleado = await prisma.empleado.findFirst({ where: { id: d.empleado_id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!empleado) { res.status(400).json({ error: 'Empleado no encontrado' }); return; }

  const horasTrabajadas   = calcularHorasTrabajadas(d.hora_ingreso, d.hora_egreso);
  const convocatoria      = d.hora_convocatoria || empleado.hora_convocatoria_default;
  const minutosTardanza   = CON_TARDANZA.has(d.estado) ? calcularMinutosTardanza(convocatoria, d.hora_ingreso) : null;
  const esTarde           = d.estado === 'TARDE';
  const descuentaDefault  = DESCUENTA_POR_DEFECTO[d.estado];

  const jornadaExistente = await prisma.jornada.findUnique({ where: { empleado_id_fecha: { empleado_id: d.empleado_id, fecha } } });

  const data = {
    ...withTenant(req.empresaId!),
    empleado_id:            d.empleado_id,
    fecha,
    estado:                 d.estado,
    hora_ingreso:           d.hora_ingreso ?? null,
    hora_egreso:            d.hora_egreso ?? null,
    hora_convocatoria:      d.hora_convocatoria ?? null,
    horas_trabajadas:       horasTrabajadas,
    minutos_tardanza:       minutosTardanza,
    motivo:                 d.motivo ?? null,
    descuenta_presentismo:  d.descuenta_presentismo ?? descuentaDefault,
    jornada_id:             jornadaExistente?.id ?? null,
    origen:                 'MANUAL',
    // Tardanza nueva → pendiente de revisión de Matías. Si se cambia el
    // estado a otra cosa, se limpia el flujo de aprobación.
    tardanza_requiere_aprobacion: esTarde,
    ...(!esTarde && { tardanza_aprobada: null, tardanza_aprobada_por: null, tardanza_aprobada_at: null, tardanza_nota: null }),
  };

  const registro = await prisma.registroAsistencia.upsert({
    where: { empresa_id_empleado_id_fecha: { empresa_id: req.empresaId!, empleado_id: d.empleado_id, fecha } },
    create: { ...data, created_by: req.user!.id },
    update: data,
    include: REGISTRO_INCLUDE,
  });

  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'CREATE', entidad: 'RegistroAsistencia', entidadId: registro.id,
    descripcion: `Cargó presentismo de ${empleado.apellido}, ${empleado.nombre} (${d.estado}) — ${d.fecha}`,
    ip: req.ip, tx: prisma as any,
  });

  res.status(201).json(toNumberRegistro(registro));
}

const updateRegistroSchema = registroSchema.omit({ empleado_id: true, fecha: true }).partial();

export async function updateRegistro(req: Request, res: Response) {
  const id = Number(req.params.id);
  const existing = await prisma.registroAsistencia.findFirst({ where: { id, deleted_at: null, ...withTenant(req.empresaId!) }, include: { empleado: true } });
  if (!existing) { res.status(404).json({ error: 'Registro no encontrado' }); return; }

  const parsed = updateRegistroSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return;
  }
  const d = parsed.data;
  const estadoFinal = d.estado ?? existing.estado;
  const ingresoFinal = d.hora_ingreso !== undefined ? d.hora_ingreso : existing.hora_ingreso;
  const egresoFinal  = d.hora_egreso  !== undefined ? d.hora_egreso  : existing.hora_egreso;
  const convFinal    = d.hora_convocatoria !== undefined ? d.hora_convocatoria : existing.hora_convocatoria;
  const esTarde      = estadoFinal === 'TARDE';

  const updated = await prisma.registroAsistencia.update({
    where: { id },
    data: {
      ...(d.estado       !== undefined && { estado: d.estado }),
      ...(d.hora_ingreso  !== undefined && { hora_ingreso: d.hora_ingreso }),
      ...(d.hora_egreso   !== undefined && { hora_egreso: d.hora_egreso }),
      ...(d.hora_convocatoria !== undefined && { hora_convocatoria: d.hora_convocatoria }),
      ...(d.motivo        !== undefined && { motivo: d.motivo }),
      horas_trabajadas: calcularHorasTrabajadas(ingresoFinal, egresoFinal),
      minutos_tardanza: CON_TARDANZA.has(estadoFinal)
        ? calcularMinutosTardanza(convFinal || existing.empleado.hora_convocatoria_default, ingresoFinal)
        : null,
      descuenta_presentismo: d.descuenta_presentismo ?? (d.estado !== undefined ? DESCUENTA_POR_DEFECTO[d.estado] : existing.descuenta_presentismo),
      tardanza_requiere_aprobacion: esTarde,
      ...(!esTarde && { tardanza_aprobada: null, tardanza_aprobada_por: null, tardanza_aprobada_at: null, tardanza_nota: null }),
    },
    include: REGISTRO_INCLUDE,
  });

  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'UPDATE', entidad: 'RegistroAsistencia', entidadId: id,
    descripcion: `Editó presentismo de ${existing.empleado.apellido}, ${existing.empleado.nombre}`,
    datosAntes: { estado: existing.estado }, datosDespues: parsed.data, ip: req.ip, tx: prisma as any,
  });

  res.json(toNumberRegistro(updated));
}

export async function deleteRegistro(req: Request, res: Response) {
  const id = Number(req.params.id);
  const existing = await prisma.registroAsistencia.findFirst({ where: { id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!existing) { res.status(404).json({ error: 'Registro no encontrado' }); return; }

  await prisma.registroAsistencia.update({ where: { id }, data: { deleted_at: new Date() } });
  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'DELETE', entidad: 'RegistroAsistencia', entidadId: id,
    descripcion: `Eliminó un registro de presentismo`, ip: req.ip, tx: prisma as any,
  });

  res.json({ message: 'Registro eliminado correctamente' });
}

// "Marcar todos presentes" — precarga PRESENTE con hora actual para los
// empleados activos que todavía no tienen registro ese día.
export async function marcarTodosPresentes(req: Request, res: Response) {
  const fechaParam = typeof req.body.fecha === 'string' ? parseFechaParam(req.body.fecha) : new Date();
  if (!fechaParam) { res.status(400).json({ error: 'Fecha inválida' }); return; }
  const fecha = soloFecha(fechaParam);
  const horaActual = new Date().toTimeString().slice(0, 5);

  const [empleados, registros] = await Promise.all([
    prisma.empleado.findMany({ where: { deleted_at: null, estado: 'ACTIVO', ...withTenant(req.empresaId!) }, select: { id: true } }),
    prisma.registroAsistencia.findMany({ where: { fecha, deleted_at: null, ...withTenant(req.empresaId!) }, select: { empleado_id: true } }),
  ]);
  const yaTienen = new Set(registros.map(r => r.empleado_id));
  const faltantes = empleados.filter(e => !yaTienen.has(e.id));

  await prisma.$transaction(
    faltantes.map(e => prisma.registroAsistencia.create({
      data: {
        ...withTenant(req.empresaId!), empleado_id: e.id, fecha, estado: 'PRESENTE',
        hora_ingreso: horaActual, descuenta_presentismo: false, origen: 'MANUAL', created_by: req.user!.id,
      },
    })),
  );

  res.json({ creados: faltantes.length });
}

// ═══════════════════════════════════════════════════════════════════════════
// RESUMEN MENSUAL
// ═══════════════════════════════════════════════════════════════════════════

// El conteo del mes (incluido el semáforo y los francos ganados/tomados) está
// en lib/presentismoCalculo.ts — lo comparten el exportador y el importador.

// Saldo histórico de francos por empleado: saldo inicial cargado a mano +
// domingos trabajados − francos tomados, sobre todos los registros (no sólo
// los del mes). `hasta` permite el saldo al cierre de un período.
async function saldosFrancos(empresaId: number, empleadoIds: number[], hasta?: Date) {
  if (empleadoIds.length === 0) return new Map<number, { inicial: number; ganados: number; tomados: number; saldo: number }>();
  const [empleados, registros] = await Promise.all([
    prisma.empleado.findMany({ where: { id: { in: empleadoIds } }, select: { id: true, francos_saldo_inicial: true } }),
    prisma.registroAsistencia.findMany({
      where: {
        empresa_id: empresaId, deleted_at: null, empleado_id: { in: empleadoIds },
        ...(hasta && { fecha: { lte: hasta } }),
      },
      select: { empleado_id: true, estado: true, fecha: true },
    }),
  ]);
  const out = new Map(empleados.map(e => [e.id, { inicial: e.francos_saldo_inicial, ganados: 0, tomados: 0, saldo: 0 }]));
  for (const r of registros) {
    const s = out.get(r.empleado_id);
    if (!s) continue;
    if (esDomingoTrabajado(r)) s.ganados++;
    if (r.estado === 'FRANCO') s.tomados++;
  }
  for (const s of out.values()) s.saldo = s.inicial + s.ganados - s.tomados;
  return out;
}

async function empleadosYRegistrosDelMes(empresaId: number, mes: number, anio: number) {
  const desde = new Date(Date.UTC(anio, mes - 1, 1));
  const hasta = new Date(Date.UTC(anio, mes - 1, diasEnMes(anio, mes), 23, 59, 59));

  const [empleados, registros] = await Promise.all([
    prisma.empleado.findMany({ where: { deleted_at: null, estado: 'ACTIVO', empresa_id: empresaId }, select: EMPLEADO_MINI_SELECT, orderBy: { apellido: 'asc' } }),
    prisma.registroAsistencia.findMany({ where: { empresa_id: empresaId, deleted_at: null, fecha: { gte: desde, lte: hasta } } }),
  ]);

  const porEmpleado = new Map<number, typeof registros>();
  for (const r of registros) {
    if (!porEmpleado.has(r.empleado_id)) porEmpleado.set(r.empleado_id, []);
    porEmpleado.get(r.empleado_id)!.push(r);
  }
  return { empleados, porEmpleado };
}

// GET /api/presentismo/resumen-mes — cálculo en vivo (no persistido) del mes
// para todos los empleados activos, con indicador de si ya fue cerrado.
export async function getResumenMes(req: Request, res: Response) {
  const mes  = Number(req.query.mes);
  const anio = Number(req.query.anio);
  if (!mes || !anio) { res.status(400).json({ error: 'Faltan mes y anio' }); return; }

  const { empleados, porEmpleado } = await empleadosYRegistrosDelMes(req.empresaId!, mes, anio);
  const cerrados = await prisma.resumenPresentismo.findMany({
    where: { empresa_id: req.empresaId!, periodo_mes: mes, periodo_anio: anio },
    select: { empleado_id: true },
  });
  const cerradoSet = new Set(cerrados.map(c => c.empleado_id));
  const diasHabiles = diasHabilesDelMes(anio, mes);
  const finDeMes = new Date(Date.UTC(anio, mes - 1, diasEnMes(anio, mes), 23, 59, 59));
  const francos = await saldosFrancos(req.empresaId!, empleados.map(e => e.id), finDeMes);

  const items = empleados.map(empleado => {
    const conteo = calcularConteo(porEmpleado.get(empleado.id) ?? []);
    return {
      empleado, dias_habiles: diasHabiles, ...conteo,
      saldo_francos: francos.get(empleado.id)?.saldo ?? 0,
      cerrado: cerradoSet.has(empleado.id),
    };
  });

  res.json({
    periodo: { mes, anio, dias_habiles: diasHabiles },
    periodo_cerrado: empleados.length > 0 && cerrados.length >= empleados.length,
    items,
  });
}

// GET /api/presentismo/resumen-mes/:empleadoId — detalle día a día
export async function getResumenMesEmpleado(req: Request, res: Response) {
  const empleadoId = Number(req.params.empleadoId);
  const mes  = Number(req.query.mes);
  const anio = Number(req.query.anio);
  if (!mes || !anio) { res.status(400).json({ error: 'Faltan mes y anio' }); return; }

  const empleado = await prisma.empleado.findFirst({ where: { id: empleadoId, deleted_at: null, ...withTenant(req.empresaId!) }, select: EMPLEADO_MINI_SELECT });
  if (!empleado) { res.status(404).json({ error: 'Empleado no encontrado' }); return; }

  const desde = new Date(Date.UTC(anio, mes - 1, 1));
  const hasta = new Date(Date.UTC(anio, mes - 1, diasEnMes(anio, mes), 23, 59, 59));
  const registros = await prisma.registroAsistencia.findMany({
    where: { empleado_id: empleadoId, deleted_at: null, ...withTenant(req.empresaId!), fecha: { gte: desde, lte: hasta } },
    orderBy: { fecha: 'asc' },
  });
  const porFecha = new Map(registros.map(r => [r.fecha.toISOString().slice(0, 10), r]));

  const dias = Array.from({ length: diasEnMes(anio, mes) }, (_, i) => {
    const key = `${anio}-${String(mes).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
    const r = porFecha.get(key);
    const esFinde = [0, 6].includes(new Date(Date.UTC(anio, mes - 1, i + 1)).getUTCDay());
    return {
      fecha: key,
      es_no_laborable: esFinde,
      registro: r ? toNumberRegistro(r) : null,
    };
  });

  const resumenPersistido = await prisma.resumenPresentismo.findFirst({ where: { empleado_id: empleadoId, periodo_mes: mes, periodo_anio: anio } });

  res.json({
    empleado,
    dias,
    conteo: calcularConteo(registros),
    cerrado: !!resumenPersistido,
    resumen_persistido: resumenPersistido ? { ...resumenPersistido, total_horas: Number(resumenPersistido.total_horas) } : null,
  });
}

const cerrarMesSchema = z.object({ mes: z.number().int().min(1).max(12), anio: z.number().int().min(2000).max(2100) });

export async function cerrarMes(req: Request, res: Response) {
  const parsed = cerrarMesSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return; }
  const { mes, anio } = parsed.data;

  const { empleados, porEmpleado } = await empleadosYRegistrosDelMes(req.empresaId!, mes, anio);
  const diasHabiles = diasHabilesDelMes(anio, mes);

  let totalCobra = 0;
  let totalNoCobra = 0;

  await prisma.$transaction(async tx => {
    for (const empleado of empleados) {
      const conteo = calcularConteo(porEmpleado.get(empleado.id) ?? []);
      if (conteo.cobra_presentismo) totalCobra++; else totalNoCobra++;

      await tx.resumenPresentismo.upsert({
        where: { empresa_id_empleado_id_periodo_mes_periodo_anio: { empresa_id: req.empresaId!, empleado_id: empleado.id, periodo_mes: mes, periodo_anio: anio } },
        create: { ...withTenant(req.empresaId!), empleado_id: empleado.id, periodo_mes: mes, periodo_anio: anio, dias_habiles: diasHabiles, ...conteo },
        update: { dias_habiles: diasHabiles, ...conteo },
      });
    }

    await registrarAuditoria({
      usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'CREATE', entidad: 'ResumenPresentismo',
      descripcion: `Cerró el presentismo de ${mes}/${anio} — ${empleados.length} empleados (${totalCobra} cobran, ${totalNoCobra} no)`,
      ip: req.ip, tx: tx as any,
    });
  });

  res.json({ periodo: { mes, anio }, empleados_procesados: empleados.length, cobran_presentismo: totalCobra, no_cobran_presentismo: totalNoCobra });
}

export async function exportarPresentismo(req: Request, res: Response) {
  const mes  = Number(req.query.mes);
  const anio = Number(req.query.anio);
  if (!mes || !anio) { res.status(400).json({ error: 'Faltan mes y anio' }); return; }

  const { buffer, filename } = await generatePresentismoExcel(req.empresaId!, mes, anio);
  res.set({
    'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
    'Content-Length':      String(buffer.length),
  });
  res.end(buffer);
}

// ═══════════════════════════════════════════════════════════════════════════
// FLUJO DE APROBACIÓN DE TARDANZAS (Matías)
// ═══════════════════════════════════════════════════════════════════════════

const aprobacionSchema = z.object({ nota: z.string().nullable().optional() });

// Sólo el admin global (Matías) resuelve tardanzas — Andrea y Mayra son
// ADMIN pero fijas a su empresa, y en la vista mensual sólo tienen lectura
// del estado (ver resolveTardanzasPendientes en notificaciones.controller.ts).
async function resolverTardanza(req: Request, res: Response, aprobada: boolean) {
  const usuario = await prisma.usuario.findFirst({ where: { id: req.user!.id, deleted_at: null }, select: { empresa_id: true } });
  if (!usuario || usuario.empresa_id !== null) { res.status(403).json({ error: 'Sólo el administrador global puede aprobar o rechazar tardanzas' }); return; }

  const id = Number(req.params.id);
  const parsed = aprobacionSchema.safeParse(req.body ?? {});
  if (!parsed.success) { res.status(400).json({ error: 'Datos inválidos' }); return; }

  // Sin filtro de empresa activa: ya se confirmó arriba que es admin global,
  // y debe poder aprobar/rechazar aunque su sesión tenga otra empresa activa
  // (ver resolveTardanzasPendientes en notificaciones.controller.ts, que por
  // el mismo motivo tampoco filtra por empresa).
  const registro = await prisma.registroAsistencia.findFirst({
    where: { id, deleted_at: null },
    include: { empleado: { select: { nombre: true, apellido: true } } },
  });
  if (!registro) { res.status(404).json({ error: 'Registro no encontrado' }); return; }
  if (registro.estado !== 'TARDE' || !registro.tardanza_requiere_aprobacion) {
    res.status(400).json({ error: 'Este registro no tiene una tardanza pendiente de aprobación' }); return;
  }

  const updated = await prisma.registroAsistencia.update({
    where: { id },
    data: {
      tardanza_aprobada:    aprobada,
      tardanza_aprobada_por: req.user!.id,
      tardanza_aprobada_at:  new Date(),
      tardanza_nota:         parsed.data.nota ?? null,
      // Aprobada → conserva el premio (no descuenta). Rechazada → impacta.
      descuenta_presentismo: !aprobada,
    },
    include: REGISTRO_INCLUDE,
  });

  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'UPDATE', entidad: 'RegistroAsistencia', entidadId: id,
    descripcion: `${aprobada ? 'Aprobó' : 'Rechazó'} la tardanza de ${registro.empleado.apellido}, ${registro.empleado.nombre} del ${registro.fecha.toISOString().slice(0, 10)}`,
    ip: req.ip, tx: prisma as any,
  });

  res.json(toNumberRegistro(updated));
}

export const aprobarTardanza  = (req: Request, res: Response) => resolverTardanza(req, res, true);
export const rechazarTardanza = (req: Request, res: Response) => resolverTardanza(req, res, false);

// ═══════════════════════════════════════════════════════════════════════════
// FRANCOS COMPENSATORIOS
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/presentismo/francos — saldo actual por empleado activo
export async function getFrancos(req: Request, res: Response) {
  const empleados = await prisma.empleado.findMany({
    where: { deleted_at: null, estado: 'ACTIVO', ...withTenant(req.empresaId!) },
    select: EMPLEADO_MINI_SELECT,
    orderBy: { apellido: 'asc' },
  });
  const saldos = await saldosFrancos(req.empresaId!, empleados.map(e => e.id));
  res.json(empleados.map(empleado => ({ empleado, ...(saldos.get(empleado.id) ?? { inicial: 0, ganados: 0, tomados: 0, saldo: 0 }) })));
}

const saldoInicialSchema = z.object({ francos_saldo_inicial: z.number().int().min(-365).max(365) });

// PUT /api/presentismo/francos/:empleadoId — saldo con el que arranca (lo que
// Lorena traía en su planilla antes de cargar en el sistema)
export async function updateSaldoInicialFrancos(req: Request, res: Response) {
  const empleadoId = Number(req.params.empleadoId);
  const parsed = saldoInicialSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return; }

  const empleado = await prisma.empleado.findFirst({ where: { id: empleadoId, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!empleado) { res.status(404).json({ error: 'Empleado no encontrado' }); return; }

  await prisma.empleado.update({ where: { id: empleadoId }, data: { francos_saldo_inicial: parsed.data.francos_saldo_inicial } });
  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'UPDATE', entidad: 'Empleado', entidadId: empleadoId,
    descripcion: `Cambió el saldo inicial de francos de ${empleado.apellido}, ${empleado.nombre} a ${parsed.data.francos_saldo_inicial}`,
    datosAntes: { francos_saldo_inicial: empleado.francos_saldo_inicial }, datosDespues: parsed.data, ip: req.ip, tx: prisma as any,
  });

  const saldos = await saldosFrancos(req.empresaId!, [empleadoId]);
  res.json(saldos.get(empleadoId));
}

// ═══════════════════════════════════════════════════════════════════════════
// IMPORTADOR DE LA PLANILLA MENSUAL DE LORENA
// ═══════════════════════════════════════════════════════════════════════════

// POST /api/presentismo/importar-planilla?preview=true|false (multipart, campo `archivo`)
// preview=true (default): parsea y matchea sin escribir. preview=false: aplica.
export async function importarPlanilla(req: Request, res: Response) {
  if (!req.file) { res.status(400).json({ error: 'Elegí la planilla de presentismo (.xlsx)' }); return; }
  const dryRun = req.query.preview !== 'false';

  let parseo;
  try {
    parseo = parsePlanillaPresentismo(req.file.buffer);
  } catch (err: any) {
    res.status(400).json({ error: err?.message ?? 'No se pudo leer la planilla' }); return;
  }
  if (parseo.hojas.length === 0) {
    res.status(400).json({ error: 'La planilla no tiene hojas por persona (con NOMBRE y la tabla ITEM / CONVOCATORIA / FECHA…)', detail: parseo.advertencias }); return;
  }

  const resultado = await aplicarPlanillaPresentismo(req.empresaId!, req.user!.id, parseo, dryRun);

  if (!dryRun) {
    await registrarAuditoria({
      usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'IMPORT', entidad: 'RegistroAsistencia',
      descripcion: `Importó planilla de presentismo (${req.file.originalname}) — ${resultado.creados} registros nuevos, ${resultado.actualizados} actualizados`,
      ip: req.ip, tx: prisma as any,
    });
  }

  res.json(resultado);
}

// ═══════════════════════════════════════════════════════════════════════════
// IMPORTADOR (reloj biométrico ET-F7) — placeholder
// ═══════════════════════════════════════════════════════════════════════════

export async function importarReloj(_req: Request, res: Response) {
  res.status(501).json({ error: 'Importación desde reloj biométrico disponible próximamente' });
}
