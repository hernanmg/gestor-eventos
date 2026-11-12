import type { Request, Response } from 'express';
import { z } from 'zod';
import multer from 'multer';
import * as XLSX from 'xlsx';
import { Prisma, TipoCombustible, EstadoCargaCombustible, TipoMovCCC } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { registrarAuditoria } from '../lib/auditoria';
import { withTenant } from '../lib/tenant';
import { recalcularSaldoCCC } from '../lib/recalcularSaldoCCC';
import { generateCombustibleExcel } from '../lib/combustibleExporter';
import { importarPlanillaCombustible } from '../lib/combustibleImporter';
import { parseFechaUTC } from './bitacoraViajes.controller';

export const uploadComprobante = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Solo se aceptan archivos PDF o imágenes'));
  },
});

export const uploadExcel = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/\.(xlsx|xls)$/i.test(file.originalname)) cb(null, true);
    else cb(new Error('Solo se aceptan archivos Excel (.xlsx, .xls)'));
  },
});

const CAMION_SELECT = { id: true, codigo: true, descripcion: true, patente: true } as const;
const EVENTO_SELECT = { id: true, nombre: true } as const;

// ── Semanas (corte real de Santi, UTC) ────────────────────────────────────────
// Mismo criterio que el resto del sistema para fechas de negocio: siempre en
// componentes UTC, nunca locales (ver [[fecha_offset_utc_fix]]).

// Verificado contra la planilla real (JUNIO/JULIO/AGOSTO.2026): el corte cae
// en sábado, pero NO es tan simple como "cortar en cada sábado" — ver los dos
// ajustes en getSemanasCombustible más abajo (día 1 = sábado, y remanente
// final corto que se funde con la semana anterior).
// JULIO.2026   → 5 semanas: 1-4, 5-11, 12-18, 19-25, 26-31.
// JUNIO.2026   → 4 semanas: 1-6, 7-13, 14-20, 21-30.
// AGOSTO.2026  → 4 semanas: 1-8, 9-15, 16-22, 23-31.
// Por eso la cantidad de semanas por mes varía (4 o 5) — ver [[combustible_flota_dos57]].

export function diasEnMes(anio: number, mesUno: number): number {
  return new Date(Date.UTC(anio, mesUno, 0)).getUTCDate();
}

export interface RangoSemanaCombustible { numero: number; desde: Date; hasta: Date }

// Dos ajustes sobre el algoritmo "cortar en cada sábado" ingenuo, verificados
// contra JUNIO/JULIO/AGOSTO.2026 reales:
//  1. La búsqueda del sábado siempre arranca al día SIGUIENTE del inicio de
//     semana, nunca en el propio día de inicio — si no, un mes que arranca
//     un sábado (AGOSTO.2026: 1/8 es sábado) daría una "semana 1" de un solo
//     día en vez de ir hasta el sábado siguiente (real: 1/8 al 8/8).
//  2. Si el último bloque calculado queda más corto que 4 días, se funde con
//     el anterior en vez de quedar como semana propia — así nunca aparece un
//     cierre de mes de 2-3 días (JUNIO real: 21/6-30/6 fundido, no 21-27 +
//     28-30; AGOSTO real: 23/8-31/8 fundido, no 23-29 + 30-31). JULIO no
//     necesita fusión porque el remanente (26/7-31/7) ya tiene 6 días.
export function getSemanasCombustible(anio: number, mesUno: number): RangoSemanaCombustible[] {
  const finMes = new Date(Date.UTC(anio, mesUno - 1, diasEnMes(anio, mesUno)));

  const cortes: { desde: Date; hasta: Date }[] = [];
  let inicio = new Date(Date.UTC(anio, mesUno - 1, 1));
  while (inicio.getTime() <= finMes.getTime()) {
    let fin = new Date(inicio.getTime() + 86_400_000);
    while (fin.getUTCDay() !== 6 && fin.getTime() < finMes.getTime()) {
      fin = new Date(fin.getTime() + 86_400_000);
    }
    if (fin.getTime() > finMes.getTime()) fin = finMes;
    cortes.push({ desde: inicio, hasta: fin });
    inicio = new Date(fin.getTime() + 86_400_000);
  }

  if (cortes.length > 1) {
    const ultimo = cortes[cortes.length - 1];
    const dias = Math.round((ultimo.hasta.getTime() - ultimo.desde.getTime()) / 86_400_000) + 1;
    if (dias < 4) {
      cortes[cortes.length - 2].hasta = ultimo.hasta;
      cortes.pop();
    }
  }

  return cortes.map((c, i) => ({ numero: i + 1, desde: c.desde, hasta: c.hasta }));
}

export interface PeriodoMes { anio: number; mes: number; numero: number }

export function rangoSemanaFija(p: PeriodoMes): { desde: Date; hasta: Date } {
  const semanas = getSemanasCombustible(p.anio, p.mes);
  const s = semanas[p.numero - 1] ?? semanas[semanas.length - 1];
  return { desde: s.desde, hasta: s.hasta };
}

export function periodoAnterior(p: PeriodoMes): PeriodoMes {
  if (p.numero > 1) return { anio: p.anio, mes: p.mes, numero: p.numero - 1 };
  const mesAnterior = p.mes === 1 ? 12 : p.mes - 1;
  const anioAnterior = p.mes === 1 ? p.anio - 1 : p.anio;
  const cantSemanas = getSemanasCombustible(anioAnterior, mesAnterior).length;
  return { anio: anioAnterior, mes: mesAnterior, numero: cantSemanas };
}

export function claveSemanaFija(p: PeriodoMes): string {
  return `${p.anio}-${p.mes}-${p.numero}`;
}

export function ubicarPeriodo(fecha: Date): PeriodoMes {
  const anio = fecha.getUTCFullYear();
  const mes  = fecha.getUTCMonth() + 1;
  const dia  = fecha.getUTCDate();
  const semanas = getSemanasCombustible(anio, mes);
  const semana = semanas.find(s => dia >= s.desde.getUTCDate() && dia <= s.hasta.getUTCDate()) ?? semanas[semanas.length - 1];
  return { anio, mes, numero: semana.numero };
}

function fmtCorta(d: Date): string {
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Los litros se muestran con 3 decimales en toda la UI (igual que la
// planilla real de Santi, ej. 781,103 L) — round2 los redondearía de más.
function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

// ── Listado / detalle ─────────────────────────────────────────────────────────

export async function listCombustible(req: Request, res: Response) {
  const { camion_id, desde, hasta, evento_id, estado, mes, anio } = req.query as Record<string, string | undefined>;

  const where: Prisma.CargaCombustibleWhereInput = {
    deleted_at: null,
    ...withTenant(req.empresaId!),
    ...(camion_id && { camion_id: Number(camion_id) }),
    ...(evento_id && { evento_id: Number(evento_id) }),
    ...(estado && { estado: estado as EstadoCargaCombustible }),
  };

  if (mes && anio) {
    const gte = new Date(Date.UTC(Number(anio), Number(mes) - 1, 1));
    const lt  = new Date(Date.UTC(Number(anio), Number(mes), 1));
    where.fecha = { gte, lt };
  } else if (anio) {
    where.fecha = { gte: new Date(Date.UTC(Number(anio), 0, 1)), lt: new Date(Date.UTC(Number(anio) + 1, 0, 1)) };
  } else if (desde || hasta) {
    where.fecha = {
      ...(desde && { gte: new Date(`${desde}T00:00:00.000Z`) }),
      ...(hasta && { lte: new Date(`${hasta}T23:59:59.999Z`) }),
    };
  }

  const cargas = await prisma.cargaCombustible.findMany({
    where,
    include: { camion: { select: CAMION_SELECT }, evento: { select: EVENTO_SELECT } },
    orderBy: [{ fecha: 'desc' }, { orden: 'desc' }, { id: 'desc' }],
  });

  res.json(cargas.map(c => ({ ...c, comprobante_data: undefined })));
}

// ── Crear / editar / eliminar ─────────────────────────────────────────────────

const cargaSchema = z.object({
  camion_id:           z.number().int().positive(),
  fecha:               z.string().min(1),
  tipo_combustible:    z.nativeEnum(TipoCombustible).optional(),
  litros:              z.number().positive(),
  precio_por_litro:    z.number().nullable().optional(),
  monto_total:         z.number().positive(),
  estacion_nombre:     z.string().nullable().optional(),
  estacion_ciudad:     z.string().nullable().optional(),
  km_actual:           z.number().int().nullable().optional(),
  evento_id:           z.number().int().positive().nullable().optional(),
  cuenta_corriente_id: z.number().int().positive().nullable().optional(),
  responsable_nombre:  z.string().nullable().optional(),
  notas:               z.string().nullable().optional(),
  // Ledger de la planilla real — mismas columnas que el Excel de Santi (N°
  // FA/COMP, TIPO, PAGOS, SALDO), también cargables a mano para reflejar
  // registros históricos que no vinieron de una importación.
  numero_comprobante:  z.string().nullable().optional(),
  tipo_movimiento:     z.string().nullable().optional(),
  pagos:               z.number().nullable().optional(),
  saldo:               z.number().nullable().optional(),
});

async function resolverKmYRendimiento(camionId: number | null, fecha: Date, kmActual: number | null | undefined, excluirId?: number) {
  if (kmActual == null || camionId == null) return { km_anterior: null, km_recorridos: null, rendimiento: null };

  const anterior = await prisma.cargaCombustible.findFirst({
    where: {
      camion_id: camionId,
      deleted_at: null,
      km_actual: { not: null },
      fecha: { lte: fecha },
      ...(excluirId && { id: { not: excluirId } }),
    },
    orderBy: [{ fecha: 'desc' }, { orden: 'desc' }, { id: 'desc' }],
    select: { km_actual: true },
  });

  const kmAnterior = anterior?.km_actual ?? null;
  const kmRecorridos = kmAnterior != null ? kmActual - kmAnterior : null;
  return { km_anterior: kmAnterior, km_recorridos: kmRecorridos };
}

export async function createCombustible(req: Request, res: Response) {
  const b = req.body;
  const parsed = cargaSchema.safeParse({
    ...b,
    camion_id:           b.camion_id           !== undefined ? Number(b.camion_id) : undefined,
    litros:              b.litros              !== undefined ? parseFloat(b.litros) : undefined,
    precio_por_litro:    b.precio_por_litro    ? parseFloat(b.precio_por_litro) : undefined,
    monto_total:         b.monto_total         !== undefined ? parseFloat(b.monto_total) : undefined,
    km_actual:           b.km_actual           ? Number(b.km_actual) : undefined,
    evento_id:           b.evento_id           ? Number(b.evento_id) : null,
    cuenta_corriente_id: b.cuenta_corriente_id ? Number(b.cuenta_corriente_id) : null,
    pagos:               b.pagos               ? parseFloat(b.pagos) : undefined,
    saldo:               b.saldo               ? parseFloat(b.saldo) : undefined,
  });
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return;
  }
  const d = parsed.data;

  const camion = await prisma.camion.findFirst({ where: { id: d.camion_id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!camion) { res.status(400).json({ error: 'Vehículo no encontrado' }); return; }

  if (d.evento_id) {
    const evento = await prisma.evento.findFirst({ where: { id: d.evento_id, deleted_at: null, ...withTenant(req.empresaId!) } });
    if (!evento) { res.status(400).json({ error: 'Evento no encontrado' }); return; }
  }

  let cuenta: { id: number } | null = null;
  if (d.cuenta_corriente_id) {
    cuenta = await prisma.cuentaCorriente.findFirst({ where: { id: d.cuenta_corriente_id, deleted_at: null, ...withTenant(req.empresaId!) }, select: { id: true } });
    if (!cuenta) { res.status(400).json({ error: 'Cuenta corriente no encontrada' }); return; }
  }

  // Fecha de negocio sin hora — siempre parseada en UTC explícito, nunca con
  // el constructor Date crudo (mismo criterio que bitacoraViajes.controller.ts
  // y fmtDate — ver [[fecha_offset_utc_fix]]).
  const fecha = parseFechaUTC(d.fecha);
  const { km_anterior, km_recorridos } = await resolverKmYRendimiento(d.camion_id, fecha, d.km_actual);
  const rendimiento = km_recorridos != null && km_recorridos > 0 ? round2((d.litros / km_recorridos) * 100) : null;

  // Cuenta corriente del proveedor de combustible → nace autorizada (el
  // vehículo ya está habilitado en la estación). Sin cuenta corriente → carga
  // extra pagada de caja chica, requiere autorización de ADMIN.
  const estado = cuenta ? EstadoCargaCombustible.AUTORIZADA : EstadoCargaCombustible.PENDIENTE_AUTORIZACION;

  const carga = await prisma.$transaction(async tx => {
    const nueva = await tx.cargaCombustible.create({
      data: {
        ...withTenant(req.empresaId!),
        camion_id:           d.camion_id,
        fecha,
        tipo_combustible:    d.tipo_combustible ?? TipoCombustible.DIESEL,
        litros:              d.litros,
        precio_por_litro:    d.precio_por_litro ?? null,
        monto_total:         d.monto_total,
        estacion_nombre:     d.estacion_nombre ?? null,
        estacion_ciudad:     d.estacion_ciudad ?? null,
        km_actual:           d.km_actual ?? null,
        km_anterior,
        km_recorridos,
        rendimiento_lts_100km: rendimiento,
        estado,
        evento_id:           d.evento_id ?? null,
        cuenta_corriente_id: d.cuenta_corriente_id ?? null,
        responsable_nombre:  d.responsable_nombre ?? null,
        numero_comprobante:  d.numero_comprobante ?? null,
        tipo_movimiento:     d.tipo_movimiento ?? null,
        pagos:               d.pagos ?? null,
        saldo:               d.saldo ?? null,
        comprobante_data:    req.file?.buffer       ?? null,
        comprobante_nombre:  req.file?.originalname ?? null,
        comprobante_mime:    req.file?.mimetype     ?? null,
        notas:               d.notas ?? null,
        created_by:          req.user!.id,
      },
    });

    if (d.km_actual != null) {
      await tx.camion.update({ where: { id: d.camion_id }, data: { km_actual: d.km_actual } });
    }

    if (cuenta) {
      await tx.movimientoCCC.create({
        data: {
          cuenta_ccc_id: cuenta.id,
          empresa_id:    req.empresaId!,
          tipo:          TipoMovCCC.DEBE,
          fecha,
          concepto:      `Carga de combustible — ${camion.codigo}`,
          descripcion:   `${d.litros} L${d.estacion_nombre ? ` · ${d.estacion_nombre}` : ''}`,
          monto:         d.monto_total,
          moneda:        'ARS',
          monto_ars:     d.monto_total,
          created_by:    req.user!.id,
          updated_by:    req.user!.id,
        },
      });
      await recalcularSaldoCCC(cuenta.id, tx as unknown as Prisma.TransactionClient);
    }

    return nueva;
  });

  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'CREATE', entidad: 'CargaCombustible', entidadId: carga.id,
    descripcion: `Cargó combustible — "${camion.codigo}" ${d.litros} L`, ip: req.ip, tx: prisma,
  });

  res.status(201).json({ ...carga, comprobante_data: undefined });
}

const cargaUpdateSchema = cargaSchema.partial();

export async function updateCombustible(req: Request, res: Response) {
  const id = Number(req.params.id);
  const existing = await prisma.cargaCombustible.findFirst({ where: { id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!existing) { res.status(404).json({ error: 'Carga no encontrada' }); return; }

  const b = req.body;
  const parsed = cargaUpdateSchema.safeParse({
    ...b,
    camion_id:           b.camion_id           !== undefined ? Number(b.camion_id) : undefined,
    litros:              b.litros              !== undefined ? parseFloat(b.litros) : undefined,
    precio_por_litro:    b.precio_por_litro    !== undefined ? (b.precio_por_litro ? parseFloat(b.precio_por_litro) : null) : undefined,
    monto_total:         b.monto_total         !== undefined ? parseFloat(b.monto_total) : undefined,
    km_actual:           b.km_actual           !== undefined ? (b.km_actual ? Number(b.km_actual) : null) : undefined,
    evento_id:           b.evento_id           !== undefined ? (b.evento_id ? Number(b.evento_id) : null) : undefined,
    cuenta_corriente_id: b.cuenta_corriente_id !== undefined ? (b.cuenta_corriente_id ? Number(b.cuenta_corriente_id) : null) : undefined,
    pagos:               b.pagos               !== undefined ? (b.pagos ? parseFloat(b.pagos) : null) : undefined,
    saldo:               b.saldo               !== undefined ? (b.saldo ? parseFloat(b.saldo) : null) : undefined,
  });
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return;
  }
  const d = parsed.data;

  const camionId = d.camion_id ?? existing.camion_id;
  const fecha    = d.fecha ? parseFechaUTC(d.fecha) : existing.fecha;

  let kmActualizado = existing.km_actual;
  let kmAnterior    = existing.km_anterior;
  let kmRecorridos  = existing.km_recorridos;
  let rendimiento   = existing.rendimiento_lts_100km;
  if (d.km_actual !== undefined || d.camion_id !== undefined || d.fecha !== undefined) {
    kmActualizado = d.km_actual !== undefined ? d.km_actual : existing.km_actual;
    const r = await resolverKmYRendimiento(camionId, fecha, kmActualizado, id);
    kmAnterior   = r.km_anterior;
    kmRecorridos = r.km_recorridos;
    const litros = d.litros ?? Number(existing.litros);
    rendimiento = kmRecorridos != null && kmRecorridos > 0 ? new Prisma.Decimal(round2((litros / kmRecorridos) * 100)) : null;
  }

  const carga = await prisma.$transaction(async tx => {
    const updated = await tx.cargaCombustible.update({
      where: { id },
      data: {
        ...(d.camion_id           !== undefined && { camion_id: d.camion_id }),
        ...(d.fecha                !== undefined && { fecha }),
        ...(d.tipo_combustible     !== undefined && { tipo_combustible: d.tipo_combustible }),
        ...(d.litros               !== undefined && { litros: d.litros }),
        ...(d.precio_por_litro     !== undefined && { precio_por_litro: d.precio_por_litro }),
        ...(d.monto_total          !== undefined && { monto_total: d.monto_total }),
        ...(d.estacion_nombre      !== undefined && { estacion_nombre: d.estacion_nombre }),
        ...(d.estacion_ciudad      !== undefined && { estacion_ciudad: d.estacion_ciudad }),
        ...(d.evento_id            !== undefined && { evento_id: d.evento_id }),
        ...(d.responsable_nombre   !== undefined && { responsable_nombre: d.responsable_nombre }),
        ...(d.numero_comprobante   !== undefined && { numero_comprobante: d.numero_comprobante }),
        ...(d.tipo_movimiento      !== undefined && { tipo_movimiento: d.tipo_movimiento }),
        ...(d.pagos                !== undefined && { pagos: d.pagos }),
        ...(d.saldo                !== undefined && { saldo: d.saldo }),
        ...(d.notas                !== undefined && { notas: d.notas }),
        ...(req.file && { comprobante_data: req.file.buffer, comprobante_nombre: req.file.originalname, comprobante_mime: req.file.mimetype }),
        ...((d.km_actual !== undefined || d.camion_id !== undefined || d.fecha !== undefined) && {
          km_actual: kmActualizado, km_anterior: kmAnterior, km_recorridos: kmRecorridos, rendimiento_lts_100km: rendimiento,
        }),
      },
    });

    if (camionId != null && d.km_actual != null && d.km_actual !== existing.km_actual) {
      await tx.camion.update({ where: { id: camionId }, data: { km_actual: d.km_actual } });
    }

    return updated;
  });

  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'UPDATE', entidad: 'CargaCombustible', entidadId: id,
    descripcion: `Actualizó carga de combustible #${id}`, ip: req.ip, tx: prisma,
  });

  res.json({ ...carga, comprobante_data: undefined });
}

export async function deleteCombustible(req: Request, res: Response) {
  const id = Number(req.params.id);
  const existing = await prisma.cargaCombustible.findFirst({ where: { id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!existing) { res.status(404).json({ error: 'Carga no encontrada' }); return; }

  if (existing.cuenta_corriente_id) {
    res.status(400).json({ error: 'No se puede eliminar una carga con cuenta corriente vinculada. Editala en su lugar.' }); return;
  }

  await prisma.cargaCombustible.update({ where: { id }, data: { deleted_at: new Date() } });

  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'DELETE', entidad: 'CargaCombustible', entidadId: id,
    descripcion: `Eliminó carga de combustible #${id}`, ip: req.ip, tx: prisma,
  });

  res.json({ message: 'Carga eliminada correctamente' });
}

// ── Autorización ──────────────────────────────────────────────────────────────

export async function autorizarCombustible(req: Request, res: Response) {
  const id = Number(req.params.id);
  const existing = await prisma.cargaCombustible.findFirst({ where: { id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!existing) { res.status(404).json({ error: 'Carga no encontrada' }); return; }

  const carga = await prisma.cargaCombustible.update({
    where: { id },
    data: { estado: EstadoCargaCombustible.AUTORIZADA, autorizado_por: req.user!.id, autorizado_at: new Date() },
  });

  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'UPDATE', entidad: 'CargaCombustible', entidadId: id,
    descripcion: `Autorizó carga de combustible #${id}`, ip: req.ip, tx: prisma,
  });

  res.json(carga);
}

export async function rechazarCombustible(req: Request, res: Response) {
  const id = Number(req.params.id);
  const existing = await prisma.cargaCombustible.findFirst({ where: { id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!existing) { res.status(404).json({ error: 'Carga no encontrada' }); return; }

  const carga = await prisma.cargaCombustible.update({
    where: { id },
    data: { estado: EstadoCargaCombustible.RECHAZADA, autorizado_por: req.user!.id, autorizado_at: new Date() },
  });

  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'UPDATE', entidad: 'CargaCombustible', entidadId: id,
    descripcion: `Rechazó carga de combustible #${id}`, ip: req.ip, tx: prisma,
  });

  res.json(carga);
}

export async function listPendientesAutorizacion(req: Request, res: Response) {
  const cargas = await prisma.cargaCombustible.findMany({
    where: { deleted_at: null, ...withTenant(req.empresaId!), estado: EstadoCargaCombustible.PENDIENTE_AUTORIZACION },
    include: { camion: { select: CAMION_SELECT }, evento: { select: EVENTO_SELECT } },
    orderBy: { fecha: 'desc' },
  });
  res.json(cargas.map(c => ({ ...c, comprobante_data: undefined })));
}

// ── Resumen mensual ───────────────────────────────────────────────────────────

export async function resumenMensual(req: Request, res: Response) {
  const { mes, anio } = req.query as { mes?: string; anio?: string };
  if (!mes || !anio) { res.status(400).json({ error: 'mes y anio son requeridos' }); return; }

  const gte = new Date(Date.UTC(Number(anio), Number(mes) - 1, 1));
  const lt  = new Date(Date.UTC(Number(anio), Number(mes), 1));

  const cargas = await prisma.cargaCombustible.findMany({
    where: { deleted_at: null, ...withTenant(req.empresaId!), fecha: { gte, lt } },
    include: { camion: { select: CAMION_SELECT }, evento: { select: EVENTO_SELECT } },
  });

  const porCamion = new Map<number, {
    camion_id: number; camion_codigo: string; camion_patente: string | null; total_litros: number; total_monto: number;
    suma_precio: number; cant_precio: number; suma_rendimiento: number; cant_rendimiento: number;
    cantidad_cargas: number; por_evento: Map<number, { evento_id: number; evento_nombre: string; litros: number; monto: number }>;
  }>();

  // Las filas de PAGOS/NC del ledger (TIPO=RE/NC) no tienen vehículo — no
  // entran en el resumen por vehículo, sólo en el ledger crudo de /combustible.
  for (const c of cargas) {
    if (c.camion_id == null || !c.camion) continue;
    if (!porCamion.has(c.camion_id)) {
      porCamion.set(c.camion_id, {
        camion_id: c.camion_id, camion_codigo: c.camion.codigo, camion_patente: c.camion.patente, total_litros: 0, total_monto: 0,
        suma_precio: 0, cant_precio: 0, suma_rendimiento: 0, cant_rendimiento: 0, cantidad_cargas: 0,
        por_evento: new Map(),
      });
    }
    const acc = porCamion.get(c.camion_id)!;
    acc.total_litros += Number(c.litros);
    acc.total_monto  += Number(c.monto_total);
    acc.cantidad_cargas += 1;
    if (c.precio_por_litro != null) { acc.suma_precio += Number(c.precio_por_litro); acc.cant_precio += 1; }
    if (c.rendimiento_lts_100km != null) { acc.suma_rendimiento += Number(c.rendimiento_lts_100km); acc.cant_rendimiento += 1; }
    if (c.evento_id && c.evento) {
      if (!acc.por_evento.has(c.evento_id)) acc.por_evento.set(c.evento_id, { evento_id: c.evento_id, evento_nombre: c.evento.nombre, litros: 0, monto: 0 });
      const ev = acc.por_evento.get(c.evento_id)!;
      ev.litros += Number(c.litros);
      ev.monto  += Number(c.monto_total);
    }
  }

  const resultado = [...porCamion.values()].map(acc => ({
    camion_id:               acc.camion_id,
    camion_codigo:           acc.camion_codigo,
    camion_patente:          acc.camion_patente,
    total_litros:            round3(acc.total_litros),
    total_monto:             round2(acc.total_monto),
    promedio_precio_litro:   acc.cant_precio > 0 ? round2(acc.suma_precio / acc.cant_precio) : null,
    rendimiento_promedio:    acc.cant_rendimiento > 0 ? round2(acc.suma_rendimiento / acc.cant_rendimiento) : null,
    cantidad_cargas:         acc.cantidad_cargas,
    por_evento:              [...acc.por_evento.values()].map(ev => ({ ...ev, litros: round3(ev.litros), monto: round2(ev.monto) })),
  })).sort((a, b) => b.total_litros - a.total_litros);

  res.json(resultado);
}

// ── Resumen semanal ───────────────────────────────────────────────────────────
// Semanas reales de la planilla (corte en sábado, 4 o 5 por mes) — ver nota en
// los helpers de período más arriba y [[combustible_flota_dos57]]. Se trae
// también la última semana del mes anterior sólo para poder calcular la
// variación de la Semana 1 del mes pedido.

export async function resumenSemanal(req: Request, res: Response) {
  const { mes, anio } = req.query as { mes?: string; anio?: string };
  if (!mes || !anio) { res.status(400).json({ error: 'mes y anio son requeridos' }); return; }

  const mesNum  = Number(mes);
  const anioNum = Number(anio);
  const semanasDelMes = getSemanasCombustible(anioNum, mesNum);
  const finMes = new Date(semanasDelMes[semanasDelMes.length - 1].hasta.getTime() + 86_400_000);
  const periodoAnteriorAlPrimero = periodoAnterior({ anio: anioNum, mes: mesNum, numero: 1 });
  const desdeConPadding = rangoSemanaFija(periodoAnteriorAlPrimero).desde;

  const cargas = await prisma.cargaCombustible.findMany({
    where: { deleted_at: null, ...withTenant(req.empresaId!), fecha: { gte: desdeConPadding, lt: finMes } },
    include: { camion: { select: CAMION_SELECT } },
    orderBy: { fecha: 'asc' },
  });

  const porPeriodo = new Map<string, {
    total_litros: number; total_monto: number; total_pagos: number;
    por_vehiculo: Map<number, { camion_id: number; codigo: string; patente: string | null; litros: number; monto: number }>;
  }>();

  for (const c of cargas) {
    const key = claveSemanaFija(ubicarPeriodo(c.fecha));
    if (!porPeriodo.has(key)) porPeriodo.set(key, { total_litros: 0, total_monto: 0, total_pagos: 0, por_vehiculo: new Map() });
    const acc = porPeriodo.get(key)!;
    acc.total_litros += Number(c.litros);
    acc.total_monto  += Number(c.monto_total);
    acc.total_pagos  += Number(c.pagos ?? 0);
    // Las filas de PAGOS/NC (TIPO=RE/NC) no tienen vehículo — no entran en el
    // desglose por vehículo, sólo en el total del período.
    if (c.camion_id == null || !c.camion) continue;
    if (!acc.por_vehiculo.has(c.camion_id)) acc.por_vehiculo.set(c.camion_id, { camion_id: c.camion_id, codigo: c.camion.codigo, patente: c.camion.patente, litros: 0, monto: 0 });
    const v = acc.por_vehiculo.get(c.camion_id)!;
    v.litros += Number(c.litros);
    v.monto  += Number(c.monto_total);
  }

  // Siempre las semanas del mes pedido (4 o 5, según el corte real en sábado),
  // aunque alguna esté vacía — así el selector del frontend es estable
  // independientemente de si ya hay cargas cargadas para esas fechas.
  const resultado = semanasDelMes.map(({ numero, desde, hasta }) => {
    const periodo = { anio: anioNum, mes: mesNum, numero };
    const key = claveSemanaFija(periodo);
    const acc = porPeriodo.get(key);

    const anteriorKey = claveSemanaFija(periodoAnterior(periodo));
    const anterior = porPeriodo.get(anteriorKey);
    const totalLitros = acc?.total_litros ?? 0;
    const variacion = anterior && anterior.total_litros > 0
      ? round2(((totalLitros - anterior.total_litros) / anterior.total_litros) * 100)
      : null;

    return {
      semana_key:           key,
      numero,
      semana_inicio:        desde.toISOString().slice(0, 10),
      semana_fin:           hasta.toISOString().slice(0, 10),
      label:                `Semana ${numero}: ${fmtCorta(desde)} al ${fmtCorta(hasta)}`,
      total_litros:         round3(totalLitros),
      total_monto:          round2(acc?.total_monto ?? 0),
      total_pagos:          round2(acc?.total_pagos ?? 0),
      variacion_litros_pct: variacion,
      por_vehiculo:         acc
        ? [...acc.por_vehiculo.values()].map(v => ({ ...v, litros: round3(v.litros), monto: round2(v.monto) })).sort((a, b) => b.litros - a.litros)
        : [],
    };
  });

  res.json({ semanas: resultado });
}

// ── Análisis anual ────────────────────────────────────────────────────────────

const MESES_LABEL = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];

export async function analisisAnual(req: Request, res: Response) {
  const anioParam = req.query.anio as string | undefined;
  const anio = anioParam ? Number(anioParam) : new Date().getUTCFullYear();

  const cargas = await prisma.cargaCombustible.findMany({
    where: {
      deleted_at: null, ...withTenant(req.empresaId!),
      fecha: { gte: new Date(Date.UTC(anio, 0, 1)), lt: new Date(Date.UTC(anio + 1, 0, 1)) },
    },
    include: { camion: { select: CAMION_SELECT } },
  });

  const litrosPorMes = new Array(12).fill(0);
  const montoPorMes  = new Array(12).fill(0);
  const porVehiculo  = new Map<number, {
    camion_id: number; codigo: string;
    total_anual: number; por_mes: number[];
    total_anual_monto: number; por_mes_monto: number[];
  }>();

  for (const c of cargas) {
    const m = c.fecha.getUTCMonth();
    litrosPorMes[m] += Number(c.litros);
    montoPorMes[m]  += Number(c.monto_total);

    // Las filas de PAGOS/NC (TIPO=RE/NC) no tienen vehículo — sólo suman al
    // total mensual, no entran en el desglose por vehículo.
    if (c.camion_id == null || !c.camion) continue;
    if (!porVehiculo.has(c.camion_id)) {
      porVehiculo.set(c.camion_id, {
        camion_id: c.camion_id, codigo: c.camion.codigo,
        total_anual: 0, por_mes: new Array(12).fill(0),
        total_anual_monto: 0, por_mes_monto: new Array(12).fill(0),
      });
    }
    const v = porVehiculo.get(c.camion_id)!;
    v.total_anual       += Number(c.litros);
    v.por_mes[m]         += Number(c.litros);
    v.total_anual_monto += Number(c.monto_total);
    v.por_mes_monto[m]   += Number(c.monto_total);
  }

  // Sin mes anterior válido para comparar (Enero, o un mes cuyo anterior no
  // tuvo carga), o sin datos reales en el mes actual (mes futuro/vacío,
  // el único monto que trae es el arrastre de saldo anterior) → variación =
  // null, nunca -100% (un salto desde/hacia "nada" no es una caída real).
  // El frontend no dibuja ese punto de la línea (connectNulls={false}) y el
  // tooltip omite el campo "% variación".
  const porMes = MESES_LABEL.map((label, i) => {
    const hayAnteriorValido = i > 0 && litrosPorMes[i - 1] > 0 && litrosPorMes[i] > 0;
    return {
      mes:           i + 1,
      label,
      litros:        round3(litrosPorMes[i]),
      monto:         round2(montoPorMes[i]),
      variacion_pct: hayAnteriorValido ? round2(((litrosPorMes[i] - litrosPorMes[i - 1]) / litrosPorMes[i - 1]) * 100) : null,
    };
  });

  // Forecasting — promedio de los últimos 3 meses con datos, proyectado sobre
  // los meses restantes del año (sólo tiene sentido para el año en curso).
  const hoy = new Date();
  const esAnioActual = anio === hoy.getUTCFullYear();
  const ultimoMesConDatos = litrosPorMes.reduce((last, v, i) => (v > 0 ? i : last), -1);
  let forecast: { mes: number; label: string; litros_proyectados: number; monto_proyectado: number }[] = [];

  if (esAnioActual && ultimoMesConDatos >= 0 && ultimoMesConDatos < 11) {
    const desde = Math.max(0, ultimoMesConDatos - 2);
    const mesesBase = litrosPorMes.slice(desde, ultimoMesConDatos + 1).filter(v => v > 0);
    const montosBase = montoPorMes.slice(desde, ultimoMesConDatos + 1).filter(v => v > 0);
    const promLitros = mesesBase.length ? mesesBase.reduce((a, b) => a + b, 0) / mesesBase.length : 0;
    const promMonto  = montosBase.length ? montosBase.reduce((a, b) => a + b, 0) / montosBase.length : 0;

    forecast = MESES_LABEL.slice(ultimoMesConDatos + 1).map((label, idx) => ({
      mes: ultimoMesConDatos + 2 + idx,
      label,
      litros_proyectados: round3(promLitros),
      monto_proyectado:   round2(promMonto),
    }));
  }

  const resultadoPorVehiculo = [...porVehiculo.values()]
    .map(v => ({
      ...v,
      total_anual:       round3(v.total_anual),
      por_mes:           v.por_mes.map(round3),
      total_anual_monto: round2(v.total_anual_monto),
      por_mes_monto:     v.por_mes_monto.map(round2),
    }))
    .sort((a, b) => b.total_anual - a.total_anual);

  res.json({
    anio,
    total_litros_anual: round3(litrosPorMes.reduce((a, b) => a + b, 0)),
    total_monto_anual:  round2(montoPorMes.reduce((a, b) => a + b, 0)),
    por_mes:            porMes,
    por_vehiculo:       resultadoPorVehiculo,
    forecast,
  });
}

// ── Exportar / Importar ───────────────────────────────────────────────────────

export async function exportarCombustible(req: Request, res: Response) {
  const anio = req.query.anio ? Number(req.query.anio) : new Date().getUTCFullYear();
  const { buffer, filename } = await generateCombustibleExcel(req.empresaId!, anio);

  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'EXPORT', entidad: 'CargaCombustible',
    descripcion: `Exportó Excel de combustible ${anio}`, ip: req.ip, tx: prisma,
  });

  res.set({
    'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Content-Length':      String(buffer.length),
  });
  res.end(buffer);
}

export async function importarCombustible(req: Request, res: Response) {
  if (!req.file) { res.status(400).json({ error: 'Adjuntá el archivo Excel' }); return; }

  const workbook = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
  const resultado = await importarPlanillaCombustible(workbook, req.empresaId!, req.user!.id);

  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'IMPORT', entidad: 'CargaCombustible',
    descripcion: `Importó planilla de combustible — ${resultado.hojas_procesadas} hoja(s), ${resultado.creados} creados, ${resultado.actualizados} actualizados`,
    datosDespues: resultado, ip: req.ip, tx: prisma,
  });

  res.json(resultado);
}
