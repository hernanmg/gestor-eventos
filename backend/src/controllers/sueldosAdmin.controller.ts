import type { Request, Response } from 'express';
import { z } from 'zod';
import { EstadoLiquidacionAdmin } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { withTenant } from '../lib/tenant';
import { recalcularSaldosCaja } from '../lib/recalcularSaldos';
import { registrarAuditoria } from '../lib/auditoria';
import { renderPDF } from '../lib/pdfExporter';
import { templateLiquidacionAdmin } from '../lib/pdfTemplates/liquidacionAdmin';
import { calcularSueldoAdmin, calcularSplits, type SplitCalculado } from '../lib/calcularSueldoAdmin';

// ── Helpers de mapeo (Decimal → number) ───────────────────────────────────────

function mapDecimalsAcuerdo(a: any) {
  return {
    ...a,
    sueldo_basico:      Number(a.sueldo_basico),
    premio_incentivo:   a.premio_incentivo   !== null ? Number(a.premio_incentivo)   : null,
    viatico:            a.viatico            !== null ? Number(a.viatico)            : null,
    premio_presentismo: a.premio_presentismo !== null ? Number(a.premio_presentismo) : null,
    valor_hora_extra:   a.valor_hora_extra   !== null ? Number(a.valor_hora_extra)   : null,
    telefono:           a.telefono           !== null ? Number(a.telefono)           : null,
  };
}

function mapDecimalsLiquidacionAdmin(l: any) {
  return {
    ...l,
    sueldo_basico:        Number(l.sueldo_basico),
    horas_trabajadas:     Number(l.horas_trabajadas),
    horas_extras:         Number(l.horas_extras),
    valor_hora_extra:     l.valor_hora_extra !== null ? Number(l.valor_hora_extra) : null,
    importe_horas_extras: Number(l.importe_horas_extras),
    premio_incentivo:     Number(l.premio_incentivo),
    viatico:              Number(l.viatico),
    premio_presentismo:   Number(l.premio_presentismo),
    importe_antiguedad:   Number(l.importe_antiguedad),
    telefono:             Number(l.telefono),
    vacaciones_aguinaldo: Number(l.vacaciones_aguinaldo),
    vales_descuentos:     Number(l.vales_descuentos),
    subtotal_bruto:       Number(l.subtotal_bruto),
    total_a_cobrar:       Number(l.total_a_cobrar),
  };
}

const EMPLEADO_SELECT = { id: true, nombre: true, apellido: true, dni: true, categoria: true } as const;
const EMPRESA_SELECT  = { id: true, nombre: true, nombre_corto: true } as const;

// ═══════════════════════════════════════════════════════════════════════════
// EMPRESAS / CUENTAS — soporte para el selector de split y de cuenta de pago.
// GET /api/empresas es admin-global-only (administración cross-tenant), y
// /api/cuentas está atado al tenant activo — ninguno sirve para un ADMIN
// no-global (ej. Mayra) que necesita ver las empresas y cuentas de un split
// que involucra otra empresa distinta de la activa. Este módulo es
// intrínsecamente cross-empresa (por diseño: splits), así que expone su
// propia versión liviana, gateada igual que el resto de RRHH (requireRole ADMIN).
// ═══════════════════════════════════════════════════════════════════════════

export async function listEmpresasSueldos(_req: Request, res: Response) {
  const empresas = await prisma.empresa.findMany({
    where:   { activo: true },
    select:  EMPRESA_SELECT,
    orderBy: { id: 'asc' },
  });
  res.json(empresas);
}

export async function listCuentasPorEmpresa(req: Request, res: Response) {
  const empresaId = Number(req.params.empresaId);
  const cuentas = await prisma.cuentaBancaria.findMany({
    where:   { empresa_id: empresaId, deleted_at: null },
    select:  { id: true, nombre: true, tipo: true, moneda: true },
    orderBy: { id: 'asc' },
  });
  res.json(cuentas);
}

// ═══════════════════════════════════════════════════════════════════════════
// ACUERDOS
// ═══════════════════════════════════════════════════════════════════════════

export async function listAcuerdos(req: Request, res: Response) {
  const acuerdos = await prisma.acuerdoSueldo.findMany({
    where:   { ...withTenant(req.empresaId!), activo: true },
    include: {
      empleado: { select: EMPLEADO_SELECT },
      empresa:  { select: EMPRESA_SELECT },
    },
    orderBy: { empleado: { apellido: 'asc' } },
  });

  const empleadoIds = acuerdos.map(a => a.empleado_id);
  const splits = await prisma.empleadoEmpresaSplit.findMany({
    where:   { empleado_id: { in: empleadoIds } },
    include: { empresa: { select: EMPRESA_SELECT } },
  });
  const splitsPorEmpleado = new Map<number, typeof splits>();
  for (const s of splits) {
    if (!splitsPorEmpleado.has(s.empleado_id)) splitsPorEmpleado.set(s.empleado_id, []);
    splitsPorEmpleado.get(s.empleado_id)!.push(s);
  }

  res.json(acuerdos.map(a => ({
    ...mapDecimalsAcuerdo(a),
    splits: (splitsPorEmpleado.get(a.empleado_id) ?? []).map(s => ({
      empresa_id:     s.empresa_id,
      empresa_nombre: s.empresa.nombre_corto ?? s.empresa.nombre,
      porcentaje:     Number(s.porcentaje),
    })),
  })));
}

export async function getAcuerdoEmpleado(req: Request, res: Response) {
  const empleadoId = Number(req.params.empleadoId);
  const acuerdo = await prisma.acuerdoSueldo.findFirst({
    where:   { empleado_id: empleadoId, ...withTenant(req.empresaId!) },
    include: {
      empleado: { select: EMPLEADO_SELECT },
      empresa:  { select: EMPRESA_SELECT },
    },
  });
  if (!acuerdo) { res.status(404).json({ error: 'Este empleado no tiene un acuerdo de sueldo' }); return; }

  const splits = await prisma.empleadoEmpresaSplit.findMany({
    where:   { empleado_id: empleadoId },
    include: { empresa: { select: EMPRESA_SELECT } },
  });

  // Preview sin horas extras — a las horas acordadas exactas.
  const preview = calcularSueldoAdmin(acuerdo, acuerdo.horas_acordadas_mes);

  res.json({
    ...mapDecimalsAcuerdo(acuerdo),
    splits: splits.map(s => ({
      empresa_id:     s.empresa_id,
      empresa_nombre: s.empresa.nombre_corto ?? s.empresa.nombre,
      porcentaje:     Number(s.porcentaje),
    })),
    preview,
  });
}

const acuerdoSchema = z.object({
  empleado_id:         z.number().int().positive(),
  fecha_inicio:        z.string().min(1),
  vigencia_meses:      z.number().int().positive().nullable().optional(),
  escalafon:           z.string().nullable().optional(),
  tipo_seguro:         z.string().nullable().optional(),
  sueldo_basico:       z.number().positive(),
  horas_acordadas_mes: z.number().int().positive().default(200),
  premio_incentivo:    z.number().min(0).nullable().optional(),
  viatico:             z.number().min(0).nullable().optional(),
  premio_presentismo:  z.number().min(0).nullable().optional(),
  valor_hora_extra:    z.number().min(0).nullable().optional(),
  telefono:            z.number().min(0).nullable().optional(),
  notas:               z.string().nullable().optional(),
});

export async function createAcuerdo(req: Request, res: Response) {
  const parsed = acuerdoSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return;
  }
  const d = parsed.data;

  const empleado = await prisma.empleado.findFirst({ where: { id: d.empleado_id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!empleado) { res.status(404).json({ error: 'Empleado no encontrado' }); return; }

  const existente = await prisma.acuerdoSueldo.findUnique({ where: { empleado_id: d.empleado_id } });
  if (existente) { res.status(400).json({ error: 'Este empleado ya tiene un acuerdo de sueldo' }); return; }

  const acuerdo = await prisma.acuerdoSueldo.create({
    data: {
      empleado_id:         d.empleado_id,
      empresa_id:          req.empresaId!,
      fecha_inicio:        new Date(d.fecha_inicio),
      vigencia_meses:      d.vigencia_meses     ?? null,
      escalafon:           d.escalafon          ?? null,
      tipo_seguro:         d.tipo_seguro        ?? null,
      sueldo_basico:       d.sueldo_basico,
      horas_acordadas_mes: d.horas_acordadas_mes,
      premio_incentivo:    d.premio_incentivo   ?? null,
      viatico:             d.viatico            ?? null,
      premio_presentismo:  d.premio_presentismo ?? null,
      valor_hora_extra:    d.valor_hora_extra   ?? null,
      telefono:            d.telefono           ?? null,
      notas:               d.notas              ?? null,
      created_by:          req.user!.id,
    },
    include: { empleado: { select: EMPLEADO_SELECT }, empresa: { select: EMPRESA_SELECT } },
  });

  await registrarAuditoria({
    usuarioId:    req.user!.id,
    empresaId:    req.empresaId,
    accion:       'CREATE',
    entidad:      'AcuerdoSueldo',
    entidadId:    acuerdo.id,
    descripcion:  `Creó acuerdo de sueldo para ${empleado.apellido}, ${empleado.nombre}`,
    datosDespues: { sueldo_basico: d.sueldo_basico, escalafon: d.escalafon },
    ip:           req.ip,
    tx:           prisma as any,
  });

  res.status(201).json(mapDecimalsAcuerdo(acuerdo));
}

const updateAcuerdoSchema = acuerdoSchema.omit({ empleado_id: true }).partial().extend({
  activo: z.boolean().optional(),
});

export async function updateAcuerdo(req: Request, res: Response) {
  const id = Number(req.params.id);
  const parsed = updateAcuerdoSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return;
  }
  const d = parsed.data;

  const existing = await prisma.acuerdoSueldo.findFirst({ where: { id, ...withTenant(req.empresaId!) } });
  if (!existing) { res.status(404).json({ error: 'Acuerdo no encontrado' }); return; }

  const tieneAprobadas = await prisma.liquidacionAdmin.findFirst({
    where: { acuerdo_id: id, estado: { in: [EstadoLiquidacionAdmin.APROBADA, EstadoLiquidacionAdmin.PAGADA] } },
  });
  if (tieneAprobadas) {
    res.status(400).json({ error: 'No se puede modificar un acuerdo con liquidaciones aprobadas' }); return;
  }

  const updated = await prisma.acuerdoSueldo.update({
    where: { id },
    data: {
      ...(d.fecha_inicio        !== undefined && { fecha_inicio: new Date(d.fecha_inicio) }),
      ...(d.vigencia_meses      !== undefined && { vigencia_meses: d.vigencia_meses }),
      ...(d.escalafon           !== undefined && { escalafon: d.escalafon }),
      ...(d.tipo_seguro         !== undefined && { tipo_seguro: d.tipo_seguro }),
      ...(d.sueldo_basico       !== undefined && { sueldo_basico: d.sueldo_basico }),
      ...(d.horas_acordadas_mes !== undefined && { horas_acordadas_mes: d.horas_acordadas_mes }),
      ...(d.premio_incentivo    !== undefined && { premio_incentivo: d.premio_incentivo }),
      ...(d.viatico             !== undefined && { viatico: d.viatico }),
      ...(d.premio_presentismo  !== undefined && { premio_presentismo: d.premio_presentismo }),
      ...(d.valor_hora_extra    !== undefined && { valor_hora_extra: d.valor_hora_extra }),
      ...(d.telefono            !== undefined && { telefono: d.telefono }),
      ...(d.notas               !== undefined && { notas: d.notas }),
      ...(d.activo              !== undefined && { activo: d.activo }),
    },
    include: { empleado: { select: EMPLEADO_SELECT }, empresa: { select: EMPRESA_SELECT } },
  });

  await registrarAuditoria({
    usuarioId:   req.user!.id,
    empresaId:   req.empresaId,
    accion:      'UPDATE',
    entidad:     'AcuerdoSueldo',
    entidadId:   id,
    descripcion: `Actualizó acuerdo de sueldo #${id}`,
    datosAntes:   { sueldo_basico: Number(existing.sueldo_basico) },
    datosDespues: d,
    ip:           req.ip,
    tx:           prisma as any,
  });

  res.json(mapDecimalsAcuerdo(updated));
}

// ═══════════════════════════════════════════════════════════════════════════
// SPLITS
// ═══════════════════════════════════════════════════════════════════════════

const splitsSchema = z.object({
  splits: z.array(z.object({
    empresa_id: z.number().int().positive(),
    porcentaje: z.number().positive(),
  })).min(1),
}).refine(
  d => Math.abs(d.splits.reduce((s, x) => s + x.porcentaje, 0) - 100) < 0.01,
  { message: 'Los porcentajes deben sumar exactamente 100', path: ['splits'] },
);

export async function upsertSplits(req: Request, res: Response) {
  const empleadoId = Number(req.params.id);
  const parsed = splitsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten() }); return;
  }

  const empleado = await prisma.empleado.findFirst({ where: { id: empleadoId, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!empleado) { res.status(404).json({ error: 'Empleado no encontrado' }); return; }

  const empresaIds = parsed.data.splits.map(s => s.empresa_id);
  const empresas = await prisma.empresa.findMany({ where: { id: { in: empresaIds }, activo: true } });
  if (empresas.length !== new Set(empresaIds).size) {
    res.status(400).json({ error: 'Una o más empresas del split no existen o están inactivas' }); return;
  }

  const splits = await prisma.$transaction(async tx => {
    await tx.empleadoEmpresaSplit.deleteMany({ where: { empleado_id: empleadoId } });
    await tx.empleadoEmpresaSplit.createMany({
      data: parsed.data.splits.map(s => ({ empleado_id: empleadoId, empresa_id: s.empresa_id, porcentaje: s.porcentaje })),
    });
    return tx.empleadoEmpresaSplit.findMany({
      where:   { empleado_id: empleadoId },
      include: { empresa: { select: EMPRESA_SELECT } },
    });
  });

  await registrarAuditoria({
    usuarioId:    req.user!.id,
    empresaId:    req.empresaId,
    accion:       'UPDATE',
    entidad:      'EmpleadoEmpresaSplit',
    descripcion:  `Actualizó el split de empresas de ${empleado.apellido}, ${empleado.nombre}`,
    datosDespues: parsed.data,
    ip:           req.ip,
    tx:           prisma as any,
  });

  res.json(splits.map(s => ({
    empresa_id:     s.empresa_id,
    empresa_nombre: s.empresa.nombre_corto ?? s.empresa.nombre,
    porcentaje:     Number(s.porcentaje),
  })));
}

export async function deleteSplits(req: Request, res: Response) {
  const empleadoId = Number(req.params.id);
  const empleado = await prisma.empleado.findFirst({ where: { id: empleadoId, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!empleado) { res.status(404).json({ error: 'Empleado no encontrado' }); return; }

  await prisma.empleadoEmpresaSplit.deleteMany({ where: { empleado_id: empleadoId } });

  await registrarAuditoria({
    usuarioId:   req.user!.id,
    empresaId:   req.empresaId,
    accion:      'DELETE',
    entidad:     'EmpleadoEmpresaSplit',
    descripcion: `Eliminó el split de empresas de ${empleado.apellido}, ${empleado.nombre}`,
    ip:          req.ip,
    tx:          prisma as any,
  });

  res.json({ message: 'Splits eliminados correctamente' });
}

// ═══════════════════════════════════════════════════════════════════════════
// LIQUIDACIONES ADMIN
// ═══════════════════════════════════════════════════════════════════════════

export async function listLiquidacionesAdmin(req: Request, res: Response) {
  const { empleado_id, mes, anio, estado } = req.query;
  const where: any = { ...withTenant(req.empresaId!) };
  if (empleado_id) where.empleado_id  = Number(empleado_id);
  if (mes)         where.periodo_mes  = Number(mes);
  if (anio)        where.periodo_anio = Number(anio);
  if (estado)      where.estado       = estado;

  const liquidaciones = await prisma.liquidacionAdmin.findMany({
    where,
    include: { empleado: { select: EMPLEADO_SELECT } },
    orderBy: [{ periodo_anio: 'desc' }, { periodo_mes: 'desc' }, { empleado: { apellido: 'asc' } }],
  });
  res.json(liquidaciones.map(mapDecimalsLiquidacionAdmin));
}

export async function getLiquidacionAdmin(req: Request, res: Response) {
  const id = Number(req.params.id);
  const liquidacion = await prisma.liquidacionAdmin.findFirst({
    where:   { id, ...withTenant(req.empresaId!) },
    include: {
      empleado: { select: EMPLEADO_SELECT },
      empresa:  { select: EMPRESA_SELECT },
      acuerdo:  true,
      movimientos_caja: {
        where:  { deleted_at: null },
        select: { id: true, cuenta_id: true, debe: true, haber: true, descripcion: true, cuenta: { select: { id: true, nombre: true, empresa_id: true } } },
      },
    },
  });
  if (!liquidacion) { res.status(404).json({ error: 'Liquidación no encontrada' }); return; }

  res.json({
    ...mapDecimalsLiquidacionAdmin(liquidacion),
    acuerdo: mapDecimalsAcuerdo(liquidacion.acuerdo),
    movimientos_caja: liquidacion.movimientos_caja.map(m => ({
      id: m.id, cuenta_id: m.cuenta_id, cuenta_nombre: m.cuenta.nombre, empresa_id: m.cuenta.empresa_id,
      monto: Number(m.haber) - Number(m.debe), descripcion: m.descripcion,
    })),
  });
}

const generarSchema = z.object({
  empleado_id:          z.number().int().positive(),
  periodo_mes:          z.number().int().min(1).max(12),
  periodo_anio:         z.number().int().min(2000).max(2100),
  horas_trabajadas:     z.number().min(0),
  vales_descuentos:     z.number().min(0).default(0),
  vacaciones_aguinaldo: z.number().min(0).default(0),
});

async function obtenerSplitsCalculados(empleadoId: number, total: number): Promise<SplitCalculado[]> {
  const splits = await prisma.empleadoEmpresaSplit.findMany({
    where:   { empleado_id: empleadoId },
    include: { empresa: { select: EMPRESA_SELECT } },
  });
  if (splits.length === 0) return [];
  return calcularSplits(total, splits.map(s => ({
    empresa_id:     s.empresa_id,
    porcentaje:     s.porcentaje,
    empresa_nombre: s.empresa.nombre_corto ?? s.empresa.nombre,
  })));
}

export async function generarLiquidacionAdmin(req: Request, res: Response) {
  const parsed = generarSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return;
  }
  const d = parsed.data;

  const acuerdo = await prisma.acuerdoSueldo.findFirst({
    where:   { empleado_id: d.empleado_id, activo: true, ...withTenant(req.empresaId!) },
    include: { empleado: { select: EMPLEADO_SELECT } },
  });
  if (!acuerdo) { res.status(404).json({ error: 'Este empleado no tiene un acuerdo de sueldo activo' }); return; }

  const calculo = calcularSueldoAdmin(acuerdo, d.horas_trabajadas, d.vales_descuentos, d.vacaciones_aguinaldo);
  const splits  = await obtenerSplitsCalculados(d.empleado_id, calculo.total_a_cobrar);

  try {
    const liquidacion = await prisma.liquidacionAdmin.create({
      data: {
        empleado_id:  d.empleado_id,
        empresa_id:   acuerdo.empresa_id,
        acuerdo_id:   acuerdo.id,
        periodo_mes:  d.periodo_mes,
        periodo_anio: d.periodo_anio,
        sueldo_basico:   acuerdo.sueldo_basico,
        horas_acordadas: acuerdo.horas_acordadas_mes,
        escalafon:       acuerdo.escalafon,
        horas_trabajadas: d.horas_trabajadas,
        horas_extras:         calculo.horas_extras,
        valor_hora_extra:     acuerdo.valor_hora_extra,
        importe_horas_extras: calculo.importe_horas_extras,
        premio_incentivo:     calculo.premio_incentivo,
        viatico:              calculo.viatico,
        premio_presentismo:   calculo.premio_presentismo,
        antiguedad_anios:     calculo.antiguedad_anios,
        importe_antiguedad:   calculo.importe_antiguedad,
        telefono:             calculo.telefono,
        vacaciones_aguinaldo: d.vacaciones_aguinaldo,
        vales_descuentos:     d.vales_descuentos,
        subtotal_bruto:       calculo.subtotal_bruto,
        total_a_cobrar:       calculo.total_a_cobrar,
        splits:               splits.length > 0 ? (splits as any) : undefined,
        estado:               EstadoLiquidacionAdmin.BORRADOR,
      },
      include: { empleado: { select: EMPLEADO_SELECT } },
    });

    await registrarAuditoria({
      usuarioId:    req.user!.id,
      empresaId:    req.empresaId,
      accion:       'CREATE',
      entidad:      'LiquidacionAdmin',
      entidadId:    liquidacion.id,
      descripcion:  `Generó liquidación de ${acuerdo.empleado.apellido}, ${acuerdo.empleado.nombre} — ${d.periodo_mes}/${d.periodo_anio}`,
      datosDespues: { total_a_cobrar: calculo.total_a_cobrar },
      ip:           req.ip,
      tx:           prisma as any,
    });

    res.status(201).json(mapDecimalsLiquidacionAdmin(liquidacion));
  } catch (err: any) {
    if (err.code === 'P2002') {
      res.status(400).json({ error: 'Ya existe liquidación para ese período' }); return;
    }
    throw err;
  }
}

const updateLiquidacionSchema = z.object({
  horas_trabajadas:     z.number().min(0).optional(),
  vales_descuentos:     z.number().min(0).optional(),
  vacaciones_aguinaldo: z.number().min(0).optional(),
});

export async function updateLiquidacionAdmin(req: Request, res: Response) {
  const id = Number(req.params.id);
  const parsed = updateLiquidacionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return;
  }
  const d = parsed.data;

  const liquidacion = await prisma.liquidacionAdmin.findFirst({
    where:   { id, ...withTenant(req.empresaId!) },
    include: { acuerdo: true },
  });
  if (!liquidacion) { res.status(404).json({ error: 'Liquidación no encontrada' }); return; }
  if (liquidacion.estado !== EstadoLiquidacionAdmin.BORRADOR) {
    res.status(400).json({ error: `No se puede editar una liquidación en estado ${liquidacion.estado}` }); return;
  }

  const horasTrabajadas    = d.horas_trabajadas     ?? Number(liquidacion.horas_trabajadas);
  const valesDescuentos    = d.vales_descuentos      ?? Number(liquidacion.vales_descuentos);
  const vacacionesAguinaldo = d.vacaciones_aguinaldo ?? Number(liquidacion.vacaciones_aguinaldo);

  const calculo = calcularSueldoAdmin(liquidacion.acuerdo, horasTrabajadas, valesDescuentos, vacacionesAguinaldo);
  const splits  = await obtenerSplitsCalculados(liquidacion.empleado_id, calculo.total_a_cobrar);

  const updated = await prisma.liquidacionAdmin.update({
    where: { id },
    data: {
      horas_trabajadas:     horasTrabajadas,
      vales_descuentos:     valesDescuentos,
      vacaciones_aguinaldo: vacacionesAguinaldo,
      horas_extras:         calculo.horas_extras,
      importe_horas_extras: calculo.importe_horas_extras,
      antiguedad_anios:     calculo.antiguedad_anios,
      importe_antiguedad:   calculo.importe_antiguedad,
      subtotal_bruto:       calculo.subtotal_bruto,
      total_a_cobrar:       calculo.total_a_cobrar,
      splits:               splits.length > 0 ? (splits as any) : undefined,
    },
    include: { empleado: { select: EMPLEADO_SELECT } },
  });

  await registrarAuditoria({
    usuarioId:    req.user!.id,
    empresaId:    req.empresaId,
    accion:       'UPDATE',
    entidad:      'LiquidacionAdmin',
    entidadId:    id,
    descripcion:  `Editó liquidación #${id}`,
    datosDespues: d,
    ip:           req.ip,
    tx:           prisma as any,
  });

  res.json(mapDecimalsLiquidacionAdmin(updated));
}

const aprobarSchema = z.object({
  cuentas_pago: z.array(z.object({
    empresa_id: z.number().int().positive(),
    cuenta_id:  z.number().int().positive(),
  })).min(1),
});

export async function aprobarLiquidacionAdmin(req: Request, res: Response) {
  const id = Number(req.params.id);
  const parsed = aprobarSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten() }); return;
  }

  const liquidacion = await prisma.liquidacionAdmin.findFirst({
    where:   { id, ...withTenant(req.empresaId!) },
    include: { empleado: { select: EMPLEADO_SELECT } },
  });
  if (!liquidacion) { res.status(404).json({ error: 'Liquidación no encontrada' }); return; }
  if (liquidacion.estado !== EstadoLiquidacionAdmin.BORRADOR) {
    res.status(400).json({ error: `No se puede aprobar una liquidación en estado ${liquidacion.estado}` }); return;
  }

  // Desglose por empresa — el split guardado, o un único ítem con la empresa
  // principal si el empleado no tiene split configurado.
  const splitsGuardados = (liquidacion.splits as unknown as SplitCalculado[] | null) ?? [];
  const desglose: SplitCalculado[] = splitsGuardados.length > 0
    ? splitsGuardados
    : [{ empresa_id: liquidacion.empresa_id, empresa_nombre: '', porcentaje: 100, monto: Number(liquidacion.total_a_cobrar) }];

  // Validar que cada empresa del desglose tiene una cuenta elegida, y que esa
  // cuenta pertenece efectivamente a esa empresa.
  const cuentasPorEmpresa = new Map(parsed.data.cuentas_pago.map(c => [c.empresa_id, c.cuenta_id]));
  for (const item of desglose) {
    if (!cuentasPorEmpresa.has(item.empresa_id)) {
      res.status(400).json({ error: `Falta elegir una cuenta de pago para la empresa #${item.empresa_id}` }); return;
    }
  }
  const cuentaIds = [...cuentasPorEmpresa.values()];
  const cuentas = await prisma.cuentaBancaria.findMany({ where: { id: { in: cuentaIds }, deleted_at: null } });
  const cuentaById = new Map(cuentas.map(c => [c.id, c]));
  for (const [empresaId, cuentaId] of cuentasPorEmpresa) {
    const cuenta = cuentaById.get(cuentaId);
    if (!cuenta || cuenta.empresa_id !== empresaId) {
      res.status(400).json({ error: `La cuenta elegida para la empresa #${empresaId} no pertenece a esa empresa` }); return;
    }
  }

  const periodoLabel = `${String(liquidacion.periodo_mes).padStart(2, '0')}/${liquidacion.periodo_anio}`;
  const concepto = `Sueldo ${liquidacion.empleado.apellido} ${liquidacion.empleado.nombre} — ${periodoLabel}`;

  const result = await prisma.$transaction(async tx => {
    const movimientosCreados: number[] = [];

    for (const item of desglose) {
      const cuentaId = cuentasPorEmpresa.get(item.empresa_id)!;
      const last = await tx.movimientoCaja.findFirst({
        where:   { cuenta_id: cuentaId, deleted_at: null },
        orderBy: { orden: 'desc' },
        select:  { orden: true },
      });
      const mov = await tx.movimientoCaja.create({
        data: {
          cuenta_id:            cuentaId,
          evento_id:            null, // gasto de empresa, no de evento
          descripcion:          concepto,
          debe:                 0,
          haber:                item.monto,
          orden:                (last?.orden ?? 0) + 1,
          liquidacion_admin_id: id,
          created_by:           req.user!.id,
          updated_by:           req.user!.id,
        },
      });
      movimientosCreados.push(mov.id);
      await recalcularSaldosCaja(cuentaId, tx as any);
    }

    const updated = await tx.liquidacionAdmin.update({
      where: { id },
      data: {
        estado:       EstadoLiquidacionAdmin.APROBADA,
        aprobado_por: req.user!.id,
        aprobado_at:  new Date(),
      },
    });

    await registrarAuditoria({
      usuarioId:    req.user!.id,
      empresaId:    req.empresaId,
      accion:       'APROBAR',
      entidad:      'LiquidacionAdmin',
      entidadId:    id,
      descripcion:  `Aprobó liquidación de ${liquidacion.empleado.apellido}, ${liquidacion.empleado.nombre} — ${periodoLabel} por $${Number(liquidacion.total_a_cobrar)}`,
      datosDespues: { movimientosCreados, cuentas_pago: parsed.data.cuentas_pago },
      ip:           req.ip,
      tx:           tx as any,
    });

    return updated;
  });

  res.json(mapDecimalsLiquidacionAdmin(result));
}

export async function cancelarLiquidacionAdmin(req: Request, res: Response) {
  const id = Number(req.params.id);
  const liquidacion = await prisma.liquidacionAdmin.findFirst({ where: { id, ...withTenant(req.empresaId!) } });
  if (!liquidacion) { res.status(404).json({ error: 'Liquidación no encontrada' }); return; }
  if (liquidacion.estado === EstadoLiquidacionAdmin.PAGADA) {
    res.status(400).json({ error: 'No se puede cancelar una liquidación ya PAGADA' }); return;
  }
  if (liquidacion.estado === EstadoLiquidacionAdmin.CANCELADA) {
    res.status(400).json({ error: 'La liquidación ya está cancelada' }); return;
  }

  const updated = await prisma.liquidacionAdmin.update({
    where: { id },
    data:  { estado: EstadoLiquidacionAdmin.CANCELADA },
  });

  await registrarAuditoria({
    usuarioId:   req.user!.id,
    empresaId:   req.empresaId,
    accion:      'CANCELAR',
    entidad:     'LiquidacionAdmin',
    entidadId:   id,
    descripcion: `Canceló liquidación #${id}`,
    ip:          req.ip,
    tx:          prisma as any,
  });

  res.json(mapDecimalsLiquidacionAdmin(updated));
}

export async function exportarLiquidacionAdminPDF(req: Request, res: Response) {
  const id = Number(req.params.id);
  const liquidacion = await prisma.liquidacionAdmin.findFirst({
    where:   { id, ...withTenant(req.empresaId!) },
    include: { empleado: { select: EMPLEADO_SELECT } },
  });
  if (!liquidacion) { res.status(404).json({ error: 'Liquidación no encontrada' }); return; }

  const html = templateLiquidacionAdmin({
    empleado: {
      nombre:   liquidacion.empleado.nombre,
      apellido: liquidacion.empleado.apellido,
      dni:      liquidacion.empleado.dni,
    },
    escalafon:            liquidacion.escalafon,
    periodo_mes:          liquidacion.periodo_mes,
    periodo_anio:         liquidacion.periodo_anio,
    sueldo_basico:        Number(liquidacion.sueldo_basico),
    horas_acordadas:      liquidacion.horas_acordadas,
    horas_trabajadas:     Number(liquidacion.horas_trabajadas),
    horas_extras:         Number(liquidacion.horas_extras),
    valor_hora_extra:     liquidacion.valor_hora_extra !== null ? Number(liquidacion.valor_hora_extra) : null,
    importe_horas_extras: Number(liquidacion.importe_horas_extras),
    premio_incentivo:     Number(liquidacion.premio_incentivo),
    viatico:              Number(liquidacion.viatico),
    premio_presentismo:   Number(liquidacion.premio_presentismo),
    antiguedad_anios:     liquidacion.antiguedad_anios,
    importe_antiguedad:   Number(liquidacion.importe_antiguedad),
    telefono:             Number(liquidacion.telefono),
    vacaciones_aguinaldo: Number(liquidacion.vacaciones_aguinaldo),
    vales_descuentos:     Number(liquidacion.vales_descuentos),
    subtotal_bruto:       Number(liquidacion.subtotal_bruto),
    total_a_cobrar:       Number(liquidacion.total_a_cobrar),
    splits:               liquidacion.splits as any,
    estado:               liquidacion.estado,
    fecha_generacion:     new Date(),
  });

  const buffer   = await renderPDF(html, `${liquidacion.empleado.apellido}, ${liquidacion.empleado.nombre}`, 'Liquidación admin');
  const filename = `Sueldo-${liquidacion.empleado.apellido}-${liquidacion.periodo_mes}-${liquidacion.periodo_anio}.pdf`;

  res.set({
    'Content-Type':        'application/pdf',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Content-Length':      String(buffer.length),
  });
  res.end(buffer);
}
