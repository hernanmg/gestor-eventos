import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { withTenant } from '../lib/tenant';
import { registrarAuditoria } from '../lib/auditoria';
import { generatePresentismoExcel } from '../lib/presentismoExporter';

// ── Helpers ───────────────────────────────────────────────────────────────────

const EMPLEADO_MINI_SELECT = {
  id: true, nombre: true, apellido: true, apodo: true, categoria: true,
} as const;

const REGISTRO_INCLUDE = {
  empleado: { select: EMPLEADO_MINI_SELECT },
  jornada:  { select: { id: true, estado: true, horas_normales: true, horas_extras: true } },
} as const;

const ESTADOS_ASISTENCIA = [
  'PRESENTE', 'TARDE', 'MEDIA_JORNADA', 'AUSENTE', 'JUSTIFICADO', 'LIBRE', 'VACACIONES', 'LICENCIA',
] as const;

// Estados que, por defecto (si no se manda descuenta_presentismo explícito),
// impactan el premio del mes. AUSENTE siempre lo pierde; TARDE queda pendiente
// de la decisión de Matías (ver flujo de aprobación) y arranca contando en
// contra hasta que se apruebe. El resto no descuenta por defecto.
const DESCUENTA_POR_DEFECTO: Record<(typeof ESTADOS_ASISTENCIA)[number], boolean> = {
  PRESENTE: false, MEDIA_JORNADA: false, JUSTIFICADO: false, LIBRE: false, VACACIONES: false, LICENCIA: false,
  AUSENTE: true, TARDE: true,
};

function parseFechaParam(raw: string): Date | null {
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

function soloFecha(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function minutosDesdeMedianoche(hhmm: string): number | null {
  const match = hhmm.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

function calcularHorasTrabajadas(ingreso?: string | null, egreso?: string | null): number | null {
  if (!ingreso || !egreso) return null;
  const mIn  = minutosDesdeMedianoche(ingreso);
  const mOut = minutosDesdeMedianoche(egreso);
  if (mIn === null || mOut === null || mOut <= mIn) return null;
  return Math.round(((mOut - mIn) / 60) * 100) / 100;
}

function calcularMinutosTardanza(convocatoriaDefault?: string | null, ingreso?: string | null): number | null {
  if (!convocatoriaDefault || !ingreso) return null;
  const mConv = minutosDesdeMedianoche(convocatoriaDefault);
  const mIn   = minutosDesdeMedianoche(ingreso);
  if (mConv === null || mIn === null) return null;
  return Math.max(0, mIn - mConv);
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
  const minutosTardanza   = d.estado === 'TARDE' ? calcularMinutosTardanza(empleado.hora_convocatoria_default, d.hora_ingreso) : null;
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
  const esTarde      = estadoFinal === 'TARDE';

  const updated = await prisma.registroAsistencia.update({
    where: { id },
    data: {
      ...(d.estado       !== undefined && { estado: d.estado }),
      ...(d.hora_ingreso  !== undefined && { hora_ingreso: d.hora_ingreso }),
      ...(d.hora_egreso   !== undefined && { hora_egreso: d.hora_egreso }),
      ...(d.motivo        !== undefined && { motivo: d.motivo }),
      horas_trabajadas: calcularHorasTrabajadas(ingresoFinal, egresoFinal),
      minutos_tardanza: esTarde ? calcularMinutosTardanza(existing.empleado.hora_convocatoria_default, ingresoFinal) : null,
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

// Criterio de corte para perder el premio presentismo — placeholder simple
// (0 ausencias en el mes). Configurable a futuro; queda pendiente confirmar
// el umbral real con Lorena/Mayra.
const UMBRAL_AUSENCIAS_PRESENTISMO = 0;

interface ConteoResumen {
  dias_presente: number; dias_tarde: number; dias_media_jornada: number; dias_ausente: number;
  dias_justificado: number; dias_libre: number; dias_vacaciones: number;
  total_horas: number; total_tardanzas_min: number;
  cobra_presentismo: boolean; motivo_sin_presentismo: string | null;
}

function calcularConteo(registros: { estado: string; horas_trabajadas: any; minutos_tardanza: number | null; descuenta_presentismo: boolean; fecha: Date }[]): ConteoResumen {
  const c: ConteoResumen = {
    dias_presente: 0, dias_tarde: 0, dias_media_jornada: 0, dias_ausente: 0,
    dias_justificado: 0, dias_libre: 0, dias_vacaciones: 0,
    total_horas: 0, total_tardanzas_min: 0, cobra_presentismo: true, motivo_sin_presentismo: null,
  };
  const descuentos: string[] = [];
  for (const r of registros) {
    if (r.estado === 'PRESENTE')       c.dias_presente++;
    if (r.estado === 'TARDE')          c.dias_tarde++;
    if (r.estado === 'MEDIA_JORNADA')  c.dias_media_jornada++;
    if (r.estado === 'AUSENTE')        c.dias_ausente++;
    if (r.estado === 'JUSTIFICADO')    c.dias_justificado++;
    if (r.estado === 'LIBRE')          c.dias_libre++;
    if (r.estado === 'VACACIONES' || r.estado === 'LICENCIA') c.dias_vacaciones++;
    if (r.horas_trabajadas != null)    c.total_horas += Number(r.horas_trabajadas);
    if (r.minutos_tardanza != null)    c.total_tardanzas_min += r.minutos_tardanza;
    if (r.descuenta_presentismo) descuentos.push(`${r.estado} el ${r.fecha.toISOString().slice(0, 10)}`);
  }
  c.total_horas = Math.round(c.total_horas * 100) / 100;

  if (c.dias_ausente > UMBRAL_AUSENCIAS_PRESENTISMO) {
    c.cobra_presentismo = false;
    c.motivo_sin_presentismo = `${c.dias_ausente} día${c.dias_ausente !== 1 ? 's' : ''} ausente`;
  } else if (descuentos.length > 0) {
    c.cobra_presentismo = false;
    c.motivo_sin_presentismo = descuentos.join(', ');
  }
  return c;
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

  const items = empleados.map(empleado => {
    const conteo = calcularConteo(porEmpleado.get(empleado.id) ?? []);
    return { empleado, dias_habiles: diasHabiles, ...conteo, cerrado: cerradoSet.has(empleado.id) };
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
// IMPORTADOR (reloj biométrico ET-F7) — placeholder
// ═══════════════════════════════════════════════════════════════════════════

export async function importarReloj(_req: Request, res: Response) {
  res.status(501).json({ error: 'Importación desde reloj biométrico disponible próximamente' });
}
