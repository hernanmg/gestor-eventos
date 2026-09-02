import type { Request, Response } from 'express';
import { z } from 'zod';
import { EstadoLiquidacionAdmin, CategoriaAcuerdo, TipoAumento } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { withTenant } from '../lib/tenant';
import { recalcularSaldosCaja } from '../lib/recalcularSaldos';
import { registrarAuditoria } from '../lib/auditoria';
import { renderPDF } from '../lib/pdfExporter';
import { templateLiquidacionAdmin } from '../lib/pdfTemplates/liquidacionAdmin';
import { calcularSueldoAdmin, calcularSplits, type SplitCalculado } from '../lib/calcularSueldoAdmin';
import { calcularResumenBitacora } from './bitacoraViajes.controller';

// ── Helpers de mapeo (Decimal → number) ───────────────────────────────────────

function mapDecimalsAcuerdo(a: any) {
  return {
    ...a,
    sueldo_basico:         Number(a.sueldo_basico),
    premio_incentivo:      a.premio_incentivo      !== null ? Number(a.premio_incentivo)      : null,
    viatico:               a.viatico               !== null ? Number(a.viatico)               : null,
    premio_presentismo:    a.premio_presentismo    !== null ? Number(a.premio_presentismo)    : null,
    valor_hora_extra:      a.valor_hora_extra      !== null ? Number(a.valor_hora_extra)      : null,
    telefono:              a.telefono              !== null ? Number(a.telefono)              : null,
    viatico_provincial:    a.viatico_provincial    !== null ? Number(a.viatico_provincial)    : null,
    viatico_nacional:      a.viatico_nacional      !== null ? Number(a.viatico_nacional)      : null,
    viatico_nacional_1000: a.viatico_nacional_1000 !== null ? Number(a.viatico_nacional_1000) : null,
    porcentaje_acuerdo:    a.porcentaje_acuerdo    !== null ? Number(a.porcentaje_acuerdo)    : null,
    horas_pendientes_acum: a.horas_pendientes_acum !== null ? Number(a.horas_pendientes_acum) : null,
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
    prestamos_descontados: Number(l.prestamos_descontados),
    subtotal_bruto:       Number(l.subtotal_bruto),
    total_a_cobrar:       Number(l.total_a_cobrar),
    porcentaje_aumento_aplicado: l.porcentaje_aumento_aplicado !== null ? Number(l.porcentaje_aumento_aplicado) : null,
    ipc_valor_aplicado:          l.ipc_valor_aplicado          !== null ? Number(l.ipc_valor_aplicado)          : null,
    horas_pendientes_anterior:   l.horas_pendientes_anterior   !== null ? Number(l.horas_pendientes_anterior)   : null,
    horas_pendientes_nuevo:      l.horas_pendientes_nuevo      !== null ? Number(l.horas_pendientes_nuevo)      : null,
  };
}

function mapDecimalsPrestamo(p: any) {
  return {
    ...p,
    monto_total: Number(p.monto_total),
    monto_cuota: Number(p.monto_cuota),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
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
    where:   { ...withTenant(req.empresaId!), activo: true, deleted_at: null },
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
    where:   { empleado_id: empleadoId, deleted_at: null, ...withTenant(req.empresaId!) },
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
  // Choferes con bitácora de viajes — viático por tipo de recorrido, en vez
  // del monto fijo de arriba (ver BitacoraViaje / calcularResumenBitacora).
  viatico_provincial:    z.number().min(0).nullable().optional(),
  viatico_nacional:      z.number().min(0).nullable().optional(),
  viatico_nacional_1000: z.number().min(0).nullable().optional(),
  // % de aumento que representó este acuerdo sobre el anterior — informativo.
  porcentaje_acuerdo:    z.number().nullable().optional(),
  categoria_acuerdo:     z.nativeEnum(CategoriaAcuerdo).default('GENERAL'),
  // Banco de horas inicial (CHOFER) — para cargar un saldo arrastrado desde
  // fuera del sistema; después sólo se actualiza al aprobar liquidaciones.
  horas_pendientes_acum: z.number().nullable().optional(),
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

  const existente = await prisma.acuerdoSueldo.findFirst({ where: { empleado_id: d.empleado_id, deleted_at: null } });
  if (existente) { res.status(400).json({ error: 'Este empleado ya tiene un acuerdo de sueldo' }); return; }

  const acuerdo = await prisma.$transaction(async tx => {
    const nuevo = await tx.acuerdoSueldo.create({
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
        viatico_provincial:    d.viatico_provincial    ?? null,
        viatico_nacional:      d.viatico_nacional      ?? null,
        viatico_nacional_1000: d.viatico_nacional_1000 ?? null,
        porcentaje_acuerdo:    d.porcentaje_acuerdo    ?? null,
        categoria_acuerdo:     d.categoria_acuerdo,
        horas_pendientes_acum: d.horas_pendientes_acum ?? null,
        notas:               d.notas              ?? null,
        created_by:          req.user!.id,
      },
      include: { empleado: { select: EMPLEADO_SELECT }, empresa: { select: EMPRESA_SELECT } },
    });

    // Split por defecto — 100% a la empresa activa de la sesión. Si el
    // frontend llama después a POST /empleados/:id/splits con un reparto
    // real, ese endpoint reemplaza esta fila (deleteMany + createMany).
    await tx.empleadoEmpresaSplit.upsert({
      where:  { empleado_id_empresa_id: { empleado_id: d.empleado_id, empresa_id: req.empresaId! } },
      update: {},
      create: { empleado_id: d.empleado_id, empresa_id: req.empresaId!, porcentaje: 100 },
    });

    return nuevo;
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

  const existing = await prisma.acuerdoSueldo.findFirst({ where: { id, deleted_at: null, ...withTenant(req.empresaId!) } });
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
      ...(d.viatico_provincial    !== undefined && { viatico_provincial: d.viatico_provincial }),
      ...(d.viatico_nacional      !== undefined && { viatico_nacional: d.viatico_nacional }),
      ...(d.viatico_nacional_1000 !== undefined && { viatico_nacional_1000: d.viatico_nacional_1000 }),
      ...(d.porcentaje_acuerdo    !== undefined && { porcentaje_acuerdo: d.porcentaje_acuerdo }),
      ...(d.categoria_acuerdo     !== undefined && { categoria_acuerdo: d.categoria_acuerdo }),
      ...(d.horas_pendientes_acum !== undefined && { horas_pendientes_acum: d.horas_pendientes_acum }),
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

export async function deleteAcuerdo(req: Request, res: Response) {
  const id = Number(req.params.id);
  const existing = await prisma.acuerdoSueldo.findFirst({ where: { id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!existing) { res.status(404).json({ error: 'Acuerdo no encontrado' }); return; }

  const tieneAprobadas = await prisma.liquidacionAdmin.findFirst({
    where: { acuerdo_id: id, estado: { in: [EstadoLiquidacionAdmin.APROBADA, EstadoLiquidacionAdmin.PAGADA] } },
  });
  if (tieneAprobadas) {
    res.status(400).json({ error: 'No se puede eliminar: hay liquidaciones aprobadas vinculadas a este acuerdo' }); return;
  }

  await prisma.acuerdoSueldo.update({ where: { id }, data: { deleted_at: new Date() } });

  await registrarAuditoria({
    usuarioId:   req.user!.id,
    empresaId:   req.empresaId,
    accion:      'DELETE',
    entidad:     'AcuerdoSueldo',
    entidadId:   id,
    descripcion: `Eliminó acuerdo de sueldo #${id}`,
    ip:          req.ip,
    tx:          prisma as any,
  });

  res.json({ message: 'Acuerdo eliminado correctamente' });
}

export async function restaurarAcuerdo(req: Request, res: Response) {
  const id = Number(req.params.id);
  const existing = await prisma.acuerdoSueldo.findFirst({ where: { id, deleted_at: { not: null }, ...withTenant(req.empresaId!) } });
  if (!existing) { res.status(404).json({ error: 'Acuerdo eliminado no encontrado' }); return; }

  // Si mientras tanto se creó otro acuerdo activo para el mismo empleado, no
  // se puede restaurar sin generar un duplicado (AcuerdoSueldo.empleado_id
  // es único entre acuerdos no eliminados en la práctica del negocio).
  const otroActivo = await prisma.acuerdoSueldo.findFirst({ where: { empleado_id: existing.empleado_id, deleted_at: null } });
  if (otroActivo) {
    res.status(400).json({ error: 'Este empleado ya tiene otro acuerdo de sueldo activo — no se puede restaurar' }); return;
  }

  const restaurado = await prisma.acuerdoSueldo.update({ where: { id }, data: { deleted_at: null } });

  await registrarAuditoria({
    usuarioId:   req.user!.id,
    empresaId:   req.empresaId,
    accion:      'UPDATE',
    entidad:     'AcuerdoSueldo',
    entidadId:   id,
    descripcion: `Restauró acuerdo de sueldo #${id}`,
    ip:          req.ip,
    tx:          prisma as any,
  });

  res.json(mapDecimalsAcuerdo(restaurado));
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

  const prestamosPendientes = liquidacion.estado === EstadoLiquidacionAdmin.BORRADOR
    ? await prisma.prestamoEmpleado.findMany({
        where:  { empleado_id: liquidacion.empleado_id, deleted_at: null, saldado: false },
        select: { id: true, detalle: true, monto_cuota: true, cuotas_pagadas: true, cantidad_cuotas: true },
      })
    : [];

  res.json({
    ...mapDecimalsLiquidacionAdmin(liquidacion),
    acuerdo: mapDecimalsAcuerdo(liquidacion.acuerdo),
    movimientos_caja: liquidacion.movimientos_caja.map(m => ({
      id: m.id, cuenta_id: m.cuenta_id, cuenta_nombre: m.cuenta.nombre, empresa_id: m.cuenta.empresa_id,
      monto: Number(m.haber) - Number(m.debe), descripcion: m.descripcion,
    })),
    prestamos_pendientes: prestamosPendientes.map(p => ({ ...p, monto_cuota: Number(p.monto_cuota) })),
  });
}

const generarSchema = z.object({
  empleado_id:          z.number().int().positive(),
  periodo_mes:          z.number().int().min(1).max(12),
  periodo_anio:         z.number().int().min(2000).max(2100),
  // Opcional — para CHOFER el frontend no la pide como obligatoria (el sueldo
  // no depende de horas); si se manda, sólo se usa para el banco de horas.
  horas_trabajadas:     z.number().min(0).default(0),
  vales_descuentos:     z.number().min(0).default(0),
  vacaciones_aguinaldo: z.number().min(0).default(0),
  // Opt-in manual — se envía cuando el usuario clickeó "Usar viático
  // calculado" sobre el resumen de bitácora en el dialog de generar. Para
  // acuerdos categoria_acuerdo=CHOFER esto se aplica automáticamente aunque
  // no se mande (ver generarLiquidacionAdmin).
  viatico_override:     z.number().min(0).nullable().optional(),
  // Aumento sobre el básico — manual o traído del INDEC (ver GET /ipc-indec).
  tipo_aumento:          z.nativeEnum(TipoAumento).nullable().optional(),
  porcentaje_aumento:    z.number().nullable().optional(),
  ipc_mes_referencia:    z.string().nullable().optional(),
  ipc_valor_aplicado:    z.number().nullable().optional(),
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
    where:   { empleado_id: d.empleado_id, activo: true, deleted_at: null, ...withTenant(req.empresaId!) },
    include: { empleado: { select: EMPLEADO_SELECT } },
  });
  if (!acuerdo) { res.status(404).json({ error: 'Este empleado no tiene un acuerdo de sueldo activo' }); return; }

  // Bitácora de viajes del período (choferes) — informativa siempre que haya
  // registros. Para acuerdos categoria_acuerdo=CHOFER se aplica automático
  // como viático efectivo (reemplaza el fijo del acuerdo); para el resto,
  // sólo si el frontend manda viatico_override (botón "Usar viático calculado").
  const bitacoraResumen = await calcularResumenBitacora(d.empleado_id, d.periodo_mes, d.periodo_anio);
  const tieneBitacora    = bitacoraResumen.registros.length > 0;
  const esChofer         = acuerdo.categoria_acuerdo === CategoriaAcuerdo.CHOFER;

  if ((d.tipo_aumento === TipoAumento.MANUAL || d.tipo_aumento === TipoAumento.IPC) && (d.porcentaje_aumento === null || d.porcentaje_aumento === undefined)) {
    res.status(400).json({ error: 'Falta el porcentaje de aumento' }); return;
  }

  const viaticoEfectivo = esChofer && tieneBitacora ? bitacoraResumen.total_viatico : (d.viatico_override ?? undefined);

  const calculo = calcularSueldoAdmin(
    acuerdo, d.horas_trabajadas, d.vales_descuentos, d.vacaciones_aguinaldo, undefined,
    viaticoEfectivo, d.porcentaje_aumento ?? undefined,
  );
  const splits  = await obtenerSplitsCalculados(d.empleado_id, calculo.total_a_cobrar);

  // Banco de horas (CHOFER) — snapshot al generar; se persiste en el acuerdo
  // recién al aprobar (ver aprobarLiquidacionAdmin).
  const horasPendientesAnterior = esChofer ? Number(acuerdo.horas_pendientes_acum ?? 0) : null;
  const horasPendientesNuevo    = esChofer ? round2(horasPendientesAnterior! + d.horas_trabajadas) : null;

  try {
    const liquidacion = await prisma.liquidacionAdmin.create({
      data: {
        empleado_id:  d.empleado_id,
        empresa_id:   acuerdo.empresa_id,
        acuerdo_id:   acuerdo.id,
        periodo_mes:  d.periodo_mes,
        periodo_anio: d.periodo_anio,
        sueldo_basico:   calculo.sueldo_basico,
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
        porcentaje_aumento_aplicado: d.porcentaje_aumento ?? null,
        tipo_aumento:                d.tipo_aumento ?? null,
        ipc_mes_referencia:          d.ipc_mes_referencia ?? null,
        ipc_valor_aplicado:          d.ipc_valor_aplicado ?? null,
        horas_pendientes_anterior:   horasPendientesAnterior,
        horas_pendientes_nuevo:      horasPendientesNuevo,
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

    // Vincula los registros de bitácora del período a esta liquidación — a
    // partir de acá quedan congelados si la liquidación pasa a APROBADA
    // (ver ESTADOS_BLOQUEAN_EDICION en bitacoraViajes.controller.ts).
    if (tieneBitacora) {
      await prisma.bitacoraViaje.updateMany({
        where: { id: { in: bitacoraResumen.registros.map(r => r.id) } },
        data:  { liquidacion_admin_id: liquidacion.id },
      });
    }

    const prestamosPendientes = await prisma.prestamoEmpleado.findMany({
      where:  { empleado_id: d.empleado_id, deleted_at: null, saldado: false },
      select: { id: true, detalle: true, monto_cuota: true, cuotas_pagadas: true, cantidad_cuotas: true },
    });

    res.status(201).json({
      ...mapDecimalsLiquidacionAdmin(liquidacion),
      prestamos_pendientes: prestamosPendientes.map(p => ({ ...p, monto_cuota: Number(p.monto_cuota) })),
      ...(tieneBitacora && { bitacora_resumen: bitacoraResumen }),
    });
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

  // El viático y el % de aumento ya persistidos en la liquidación se
  // preservan tal cual — recalcularlos desde liquidacion.acuerdo perdería un
  // eventual viatico_override cargado desde bitácora al generar (ver
  // generarLiquidacionAdmin), y además podría reflejar un acuerdo editado
  // después de generar esta liquidación pero antes de aprobarla.
  const aumentoPersistido = liquidacion.porcentaje_aumento_aplicado !== null ? Number(liquidacion.porcentaje_aumento_aplicado) : undefined;
  const calculo = calcularSueldoAdmin(liquidacion.acuerdo, horasTrabajadas, valesDescuentos, vacacionesAguinaldo, undefined, Number(liquidacion.viatico), aumentoPersistido);
  const splits  = await obtenerSplitsCalculados(liquidacion.empleado_id, calculo.total_a_cobrar);

  // Banco de horas (CHOFER) — recalculado sobre el `anterior` ya persistido
  // al generar (no se vuelve a leer del acuerdo, mismo criterio que el
  // viático: evita drift si se aprobó otra liquidación de este empleado
  // entretanto).
  const horasPendientesNuevo = liquidacion.horas_pendientes_anterior !== null
    ? round2(Number(liquidacion.horas_pendientes_anterior) + horasTrabajadas)
    : null;

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
      ...(horasPendientesNuevo !== null && { horas_pendientes_nuevo: horasPendientesNuevo }),
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
  prestamos_a_descontar: z.array(z.object({
    prestamo_id: z.number().int().positive(),
    monto:       z.number().positive(),
  })).optional(),
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

  // Préstamos a descontar — validar que existen, son del mismo empleado y no
  // están saldados, antes de tocar nada.
  const prestamosADescontar = parsed.data.prestamos_a_descontar ?? [];
  let prestamos: Awaited<ReturnType<typeof prisma.prestamoEmpleado.findMany>> = [];
  if (prestamosADescontar.length > 0) {
    prestamos = await prisma.prestamoEmpleado.findMany({
      where: { id: { in: prestamosADescontar.map(p => p.prestamo_id) }, deleted_at: null },
    });
    for (const p of prestamosADescontar) {
      const prestamo = prestamos.find(x => x.id === p.prestamo_id);
      if (!prestamo || prestamo.empleado_id !== liquidacion.empleado_id) {
        res.status(400).json({ error: `El préstamo #${p.prestamo_id} no corresponde a este empleado` }); return;
      }
      if (prestamo.saldado) {
        res.status(400).json({ error: `El préstamo "${prestamo.detalle}" ya está saldado` }); return;
      }
    }
  }
  const totalPrestamos = round2(prestamosADescontar.reduce((s, p) => s + p.monto, 0));

  // Total neto luego de descontar los préstamos elegidos — el efectivo que
  // realmente sale de caja es menor al total_a_cobrar original.
  const totalNeto = round2(Number(liquidacion.subtotal_bruto) - Number(liquidacion.vales_descuentos) - totalPrestamos);

  // Desglose por empresa — el split guardado, o un único ítem con la empresa
  // principal si el empleado no tiene split configurado. Recalculado sobre el
  // total NETO (post-préstamos) para que la plata que efectivamente se paga
  // por cuenta coincida con lo que el empleado cobra.
  const splitsGuardados = (liquidacion.splits as unknown as SplitCalculado[] | null) ?? [];
  const desglose: SplitCalculado[] = splitsGuardados.length > 0
    ? calcularSplits(totalNeto, splitsGuardados.map(s => ({ empresa_id: s.empresa_id, porcentaje: s.porcentaje, empresa_nombre: s.empresa_nombre })))
    : [{ empresa_id: liquidacion.empresa_id, empresa_nombre: '', porcentaje: 100, monto: totalNeto }];

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

    // Préstamos descontados — una cuota por préstamo elegido, vinculada a esta
    // liquidación. Incrementa cuotas_pagadas y marca saldado si corresponde.
    for (const p of prestamosADescontar) {
      const prestamo = prestamos.find(x => x.id === p.prestamo_id)!;
      await tx.pagoPrestamoEmpleado.create({
        data: {
          prestamo_id:          p.prestamo_id,
          liquidacion_admin_id: id,
          monto:                p.monto,
          fecha:                new Date(),
        },
      });
      const cuotasPagadas = prestamo.cuotas_pagadas + 1;
      await tx.prestamoEmpleado.update({
        where: { id: p.prestamo_id },
        data: {
          cuotas_pagadas: cuotasPagadas,
          saldado:        cuotasPagadas >= prestamo.cantidad_cuotas,
        },
      });
    }

    const updated = await tx.liquidacionAdmin.update({
      where: { id },
      data: {
        estado:                EstadoLiquidacionAdmin.APROBADA,
        prestamos_descontados: totalPrestamos,
        total_a_cobrar:        totalNeto,
        splits:                splitsGuardados.length > 0 ? (desglose as any) : undefined,
        aprobado_por:          req.user!.id,
        aprobado_at:           new Date(),
      },
    });

    // Banco de horas (CHOFER) — recién se persiste en el acuerdo al aprobar,
    // no al generar el borrador (ver generarLiquidacionAdmin/updateLiquidacionAdmin).
    if (liquidacion.horas_pendientes_nuevo !== null) {
      await tx.acuerdoSueldo.update({
        where: { id: liquidacion.acuerdo_id },
        data:  { horas_pendientes_acum: liquidacion.horas_pendientes_nuevo },
      });
    }

    await registrarAuditoria({
      usuarioId:    req.user!.id,
      empresaId:    req.empresaId,
      accion:       'APROBAR',
      entidad:      'LiquidacionAdmin',
      entidadId:    id,
      descripcion:  `Aprobó liquidación de ${liquidacion.empleado.apellido}, ${liquidacion.empleado.nombre} — ${periodoLabel} por $${totalNeto}${totalPrestamos > 0 ? ` (préstamos descontados: $${totalPrestamos})` : ''}`,
      datosDespues: { movimientosCreados, cuentas_pago: parsed.data.cuentas_pago, prestamos_a_descontar: prestamosADescontar },
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

  const desde = new Date(Date.UTC(liquidacion.periodo_anio, liquidacion.periodo_mes - 1, 1));
  const hasta = new Date(Date.UTC(liquidacion.periodo_anio, liquidacion.periodo_mes, 1));

  const [empresa, jornadas, pagosPrestamos] = await Promise.all([
    prisma.empresa.findUnique({ where: { id: req.empresaId! }, select: { nombre: true, logo_data: true, logo_mime: true } }),
    prisma.jornada.findMany({
      where:  { empleado_id: liquidacion.empleado_id, estado: 'APROBADA', fecha: { gte: desde, lt: hasta }, deleted_at: null },
      select: { fecha: true, horas_normales: true, horas_extras: true },
      orderBy: { fecha: 'asc' },
    }),
    prisma.pagoPrestamoEmpleado.findMany({
      where:   { liquidacion_admin_id: id },
      include: { prestamo: { select: { detalle: true } } },
    }),
  ]);

  const logoDataUrl = empresa?.logo_data && empresa.logo_mime
    ? `data:${empresa.logo_mime};base64,${Buffer.from(empresa.logo_data).toString('base64')}`
    : null;

  const html = templateLiquidacionAdmin({
    empresa: { nombre: empresa?.nombre ?? '', logo_data_url: logoDataUrl },
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
    prestamos_descontados: Number(liquidacion.prestamos_descontados),
    subtotal_bruto:       Number(liquidacion.subtotal_bruto),
    total_a_cobrar:       Number(liquidacion.total_a_cobrar),
    splits:               liquidacion.splits as any,
    estado:               liquidacion.estado,
    jornadas:             jornadas.map(j => ({ fecha: j.fecha!, horas: round2(Number(j.horas_normales) + Number(j.horas_extras)) })),
    prestamos_pagos:      pagosPrestamos.map(p => ({ detalle: p.prestamo.detalle, monto: Number(p.monto) })),
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

// ═══════════════════════════════════════════════════════════════════════════
// HORAS DEL PERÍODO — resumen de Jornadas APROBADAS de un empleado en un mes,
// usado para pre-cargar "Horas trabajadas" al generar una liquidación.
// ═══════════════════════════════════════════════════════════════════════════

const horasPeriodoSchema = z.object({
  mes:  z.coerce.number().int().min(1).max(12),
  anio: z.coerce.number().int().min(2000).max(2100),
});

export async function getHorasPeriodo(req: Request, res: Response) {
  const empleadoId = Number(req.params.id);
  const parsed = horasPeriodoSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'Se requieren mes y anio' }); return;
  }
  const { mes, anio } = parsed.data;

  const empleado = await prisma.empleado.findFirst({ where: { id: empleadoId, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!empleado) { res.status(404).json({ error: 'Empleado no encontrado' }); return; }

  const desde = new Date(Date.UTC(anio, mes - 1, 1));
  const hasta = new Date(Date.UTC(anio, mes, 1)); // exclusivo

  const [jornadas, acuerdo] = await Promise.all([
    prisma.jornada.findMany({
      where:  { empleado_id: empleadoId, estado: 'APROBADA', fecha: { gte: desde, lt: hasta }, deleted_at: null },
      select: { horas_normales: true, horas_extras: true },
    }),
    prisma.acuerdoSueldo.findFirst({ where: { empleado_id: empleadoId, activo: true, deleted_at: null } }),
  ]);

  const totalHoras = round2(jornadas.reduce((s, j) => s + Number(j.horas_normales) + Number(j.horas_extras), 0));
  const horasAcordadas = acuerdo?.horas_acordadas_mes ?? 0;
  const horasExtras = round2(Math.max(0, totalHoras - horasAcordadas));

  res.json({
    total_horas:       totalHoras,
    cantidad_jornadas: jornadas.length,
    horas_acordadas:   horasAcordadas,
    horas_extras:      horasExtras,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// RESUMEN MENSUAL — nómina consolidada del período, con desglose por empresa.
// ═══════════════════════════════════════════════════════════════════════════

const resumenMensualSchema = z.object({
  mes:  z.coerce.number().int().min(1).max(12),
  anio: z.coerce.number().int().min(2000).max(2100),
});

const MESES_LABEL = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export async function getResumenMensual(req: Request, res: Response) {
  const parsed = resumenMensualSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'Se requieren mes y anio' }); return;
  }
  const { mes, anio } = parsed.data;

  const liquidaciones = await prisma.liquidacionAdmin.findMany({
    where: {
      periodo_mes: mes, periodo_anio: anio, ...withTenant(req.empresaId!),
      estado: { not: EstadoLiquidacionAdmin.CANCELADA },
    },
    include: { empleado: { select: EMPLEADO_SELECT } },
  });

  const empleados = liquidaciones.map(l => {
    const splits = (l.splits as unknown as SplitCalculado[] | null) ?? [];
    return {
      empleado_id:     l.empleado_id,
      empleado_nombre: `${l.empleado.apellido}, ${l.empleado.nombre}`,
      basico:          Number(l.sueldo_basico),
      extras:          Number(l.importe_horas_extras),
      descuentos:      Number(l.vales_descuentos),
      prestamos:       Number(l.prestamos_descontados),
      total:           Number(l.total_a_cobrar),
      splits:          splits.map(s => ({ empresa_nombre: s.empresa_nombre, monto: s.monto })),
    };
  });

  const totales = {
    basico:     round2(empleados.reduce((s, e) => s + e.basico, 0)),
    extras:     round2(empleados.reduce((s, e) => s + e.extras, 0)),
    descuentos: round2(empleados.reduce((s, e) => s + e.descuentos, 0)),
    prestamos:  round2(empleados.reduce((s, e) => s + e.prestamos, 0)),
    total:      round2(empleados.reduce((s, e) => s + e.total, 0)),
    por_empresa: [] as { empresa_nombre: string; monto: number }[],
  };

  const porEmpresaMap = new Map<string, number>();
  for (const e of empleados) {
    if (e.splits.length > 0) {
      for (const s of e.splits) {
        porEmpresaMap.set(s.empresa_nombre, round2((porEmpresaMap.get(s.empresa_nombre) ?? 0) + s.monto));
      }
    }
  }
  totales.por_empresa = [...porEmpresaMap.entries()].map(([empresa_nombre, monto]) => ({ empresa_nombre, monto }));

  res.json({
    periodo: `${MESES_LABEL[mes - 1]} ${anio}`,
    empleados,
    totales,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// IPC DEL INDEC — para pre-cargar el % de aumento al generar una liquidación.
// Fuente pública apis.datos.gob.ar, serie 145.3_INGNACUAL_DICI_M_38. El campo
// "field" de esa serie dice explícitamente "Tasa de variación mensual...
// Variación intermensual" — el valor que devuelve YA ES el % de variación
// mensual como fracción (ej. 0.0211377... = 2,11%), no un nivel de índice.
// Por eso el cálculo es simplemente valor × 100, sin restar contra el punto
// anterior — confirmado pegándole a la API real: para julio 2026 devuelve
// 0.0211377242678618 → 2.11% ≈ el "~2,1%" esperado. (Si se tratara como nivel
// de índice y se calculara ((actual-anterior)/anterior)*100, como sugiere la
// fórmula típica para series de nivel, daría ~12%, que no coincide.) Se pide
// limit=2 igual para tener el punto anterior disponible por si se necesita
// más adelante, aunque el cálculo actual sólo usa el último. El INDEC publica
// con rezago, así que se usa el ÚLTIMO dato disponible de la serie (no
// necesariamente el mes/año pedido) y se informa qué mes es realmente en la
// respuesta (`mes`). Si la API no responde o la serie viene vacía, se
// devuelve un error claro para que el usuario cargue el % manualmente —
// nunca se inventa un valor.
// ═══════════════════════════════════════════════════════════════════════════

const ipcQuerySchema = z.object({
  mes:  z.coerce.number().int().min(1).max(12),
  anio: z.coerce.number().int().min(2000).max(2100),
});

const IPC_SERIES_URL = 'https://apis.datos.gob.ar/series/api/series/?ids=145.3_INGNACUAL_DICI_M_38&limit=2&sort=desc';

function mesLabelDesdeFecha(fechaISO: string): string {
  const [anio, mes] = fechaISO.split('-').map(Number);
  return `${MESES_LABEL[mes - 1].toLowerCase()} ${anio}`;
}

export async function getIpcIndec(req: Request, res: Response) {
  const parsed = ipcQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'Se requieren mes y anio' }); return;
  }

  const ERROR_INDEC = { error: 'No se pudo obtener el IPC del INDEC. Ingresá el porcentaje manualmente.' };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    let resp: Awaited<ReturnType<typeof fetch>>;
    try {
      resp = await fetch(IPC_SERIES_URL, { signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
    if (!resp.ok) { res.status(502).json(ERROR_INDEC); return; }

    const json = await resp.json() as { data?: [string, number][] };
    const serie = json.data ?? [];
    if (serie.length < 1) { res.status(502).json(ERROR_INDEC); return; }

    const [fechaActual, valorActual] = serie[0];
    const ipcMensual = round2(valorActual * 100);

    res.json({
      mes:        mesLabelDesdeFecha(fechaActual),
      ipc_mensual: ipcMensual,
      // La serie ya no trae 13 puntos (limit=2) — no hay forma de calcular la
      // variación anual con esta consulta. Se deja el campo en null en vez de
      // sacarlo del contrato de la respuesta, para no romper al frontend.
      ipc_anual:   null,
      fuente:      'INDEC',
    });
  } catch {
    res.status(502).json(ERROR_INDEC);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PRÉSTAMOS A EMPLEADOS — distinto de Anticipo (adelanto simple): se paga en
// cuotas y puede quedar pendiente entre liquidaciones. La cuota efectivamente
// pagada se registra en PagoPrestamoEmpleado sólo al aprobar una
// LiquidacionAdmin (ver aprobarLiquidacionAdmin).
// ═══════════════════════════════════════════════════════════════════════════

export async function listPrestamosEmpleado(req: Request, res: Response) {
  const empleadoId = Number(req.params.id);
  const empleado = await prisma.empleado.findFirst({ where: { id: empleadoId, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!empleado) { res.status(404).json({ error: 'Empleado no encontrado' }); return; }

  const prestamos = await prisma.prestamoEmpleado.findMany({
    where:   { empleado_id: empleadoId, deleted_at: null },
    orderBy: { fecha: 'desc' },
  });

  res.json(prestamos.map(p => {
    const montoCuota = Number(p.monto_cuota);
    return {
      ...mapDecimalsPrestamo(p),
      saldo_pendiente:   round2(Number(p.monto_total) - montoCuota * p.cuotas_pagadas),
      cuotas_pendientes: p.cantidad_cuotas - p.cuotas_pagadas,
    };
  }));
}

const prestamoSchema = z.object({
  fecha:           z.string().min(1),
  detalle:         z.string().min(1),
  monto_total:     z.number().positive(),
  cantidad_cuotas: z.number().int().positive().default(1),
  monto_cuota:     z.number().positive().optional(),
});

export async function createPrestamo(req: Request, res: Response) {
  const empleadoId = Number(req.params.id);
  const parsed = prestamoSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return;
  }
  const d = parsed.data;

  const empleado = await prisma.empleado.findFirst({ where: { id: empleadoId, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!empleado) { res.status(404).json({ error: 'Empleado no encontrado' }); return; }

  const montoCuota = d.monto_cuota ?? round2(d.monto_total / d.cantidad_cuotas);

  const prestamo = await prisma.prestamoEmpleado.create({
    data: {
      empleado_id:     empleadoId,
      empresa_id:      req.empresaId!,
      fecha:           new Date(d.fecha),
      detalle:         d.detalle,
      monto_total:     d.monto_total,
      cantidad_cuotas: d.cantidad_cuotas,
      monto_cuota:     montoCuota,
      created_by:      req.user!.id,
    },
  });

  await registrarAuditoria({
    usuarioId:    req.user!.id,
    empresaId:    req.empresaId,
    accion:       'CREATE',
    entidad:      'PrestamoEmpleado',
    entidadId:    prestamo.id,
    descripcion:  `Registró préstamo "${d.detalle}" de $${d.monto_total} para ${empleado.apellido}, ${empleado.nombre}`,
    datosDespues: { monto_total: d.monto_total, cantidad_cuotas: d.cantidad_cuotas, monto_cuota: montoCuota },
    ip:           req.ip,
    tx:           prisma as any,
  });

  res.status(201).json({
    ...mapDecimalsPrestamo(prestamo),
    saldo_pendiente:   Number(prestamo.monto_total),
    cuotas_pendientes: prestamo.cantidad_cuotas,
  });
}

export async function deletePrestamo(req: Request, res: Response) {
  const id = Number(req.params.id);
  const prestamo = await prisma.prestamoEmpleado.findFirst({ where: { id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!prestamo) { res.status(404).json({ error: 'Préstamo no encontrado' }); return; }
  if (prestamo.cuotas_pagadas > 0) {
    res.status(400).json({ error: 'No se puede eliminar un préstamo con cuotas ya pagadas' }); return;
  }

  await prisma.prestamoEmpleado.update({ where: { id }, data: { deleted_at: new Date() } });

  await registrarAuditoria({
    usuarioId:   req.user!.id,
    empresaId:   req.empresaId,
    accion:      'DELETE',
    entidad:     'PrestamoEmpleado',
    entidadId:   id,
    descripcion: `Eliminó préstamo "${prestamo.detalle}"`,
    ip:          req.ip,
    tx:          prisma as any,
  });

  res.json({ message: 'Préstamo eliminado correctamente' });
}
