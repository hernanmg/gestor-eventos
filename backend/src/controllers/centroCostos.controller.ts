import type { Request, Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { Moneda, Tipo } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { withTenant } from '../lib/tenant';
import { registrarAuditoria } from '../lib/auditoria';
import { RUBROS_SISTEMA } from '../lib/rubrosConstants';
import { sincronizarMovimientoExtra } from '../lib/extrasEvento';
import { generateCentroCostosExcel } from '../lib/centroCostosExporter';
import { MOV_INCLUDE, mapMov } from './movimientos.controller';

// Centro de costos del evento (planilla de Male: docs/enjoy/KM - Centro de Costos.xlsx).
// Es una vista sobre los Movimiento de egreso — Costos = todo egreso salvo RRHH,
// RRHH = rubro RRHH — más los Extras (ExtraEvento), que por defecto paga el
// cliente y no suman al costo. Los eventos en modalidad CENTRO_COSTOS ven sólo
// esto en lugar de Egresos/Ingresos/Caja; los FLUJO_CAJA lo pueden abrir igual.

export const uploadComprobanteExtra = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Solo se aceptan archivos PDF o imágenes'));
  },
});

const r2 = (n: number) => parseFloat(n.toFixed(2));

async function buscarEvento(req: Request, res: Response) {
  const evento = await prisma.evento.findFirst({
    where:  { id: Number(req.params.id), deleted_at: null, ...withTenant(req.empresaId!) },
    select: { id: true, nombre: true, modalidad: true, moneda_base: true, fecha_inicio: true, fecha_fin: true, lugar: true },
  });
  if (!evento) res.status(404).json({ error: 'Evento no encontrado' });
  return evento;
}

export function mapExtra(e: any) {
  const { comprobante_data, ...rest } = e;
  const neto  = Number(e.neto);
  const iva   = Number(e.iva);
  const total = r2(neto + iva);
  return {
    ...rest,
    neto, iva, total,
    falta_pagar:       e.pagado ? 0 : total,
    tiene_comprobante: comprobante_data != null,
  };
}

type LineaTotal = { moneda: Moneda; total: number; iva: number; falta_pagar: number };

// Totales en la moneda base del evento; las líneas en otra moneda no se suman
// (no hay cotización por línea en la planilla) y se avisa con otras_monedas.
function totalizar(lineas: LineaTotal[], monedaBase: Moneda) {
  const enBase = lineas.filter(l => l.moneda === monedaBase);
  return {
    total:         r2(enBase.reduce((a, l) => a + l.total, 0)),
    iva:           r2(enBase.reduce((a, l) => a + l.iva, 0)),
    falta_pagar:   r2(enBase.reduce((a, l) => a + l.falta_pagar, 0)),
    otras_monedas: lineas.length - enBase.length,
  };
}

async function cargarCentroCostos(eventoId: number, empresaId: number, monedaBase: Moneda) {
  const movs = await prisma.movimiento.findMany({
    where:   { evento_id: eventoId, tipo: Tipo.EGRESO, deleted_at: null, estado_movimiento: { not: 'CANCELADO' } },
    orderBy: [{ rubro: { orden: 'asc' } }, { orden: 'asc' }],
    include: MOV_INCLUDE,
  });
  const lineas = movs.map(mapMov);
  // Las líneas espejo de un Extra a cargo de la empresa se muestran en Extras
  const costos = lineas.filter(m => m.rubro?.codigo !== RUBROS_SISTEMA.RRHH && m.extra_evento_id === null);
  const rrhh   = lineas.filter(m => m.rubro?.codigo === RUBROS_SISTEMA.RRHH);

  const extras = (await prisma.extraEvento.findMany({
    where:   { evento_id: eventoId, empresa_id: empresaId, deleted_at: null },
    orderBy: [{ orden: 'asc' }, { id: 'asc' }],
  })).map(mapExtra);

  const aTotal = (m: ReturnType<typeof mapMov>): LineaTotal => ({
    moneda: m.moneda, total: m.debe + m.haber, iva: m.iva ?? 0, falta_pagar: m.falta_pagar ?? 0,
  });
  const totCostos  = totalizar(costos.map(aTotal), monedaBase);
  const totRrhh    = totalizar(rrhh.map(aTotal), monedaBase);
  const totCliente = totalizar(extras.filter(e => e.a_cargo_cliente), monedaBase);
  const totEmpresa = totalizar(extras.filter(e => !e.a_cargo_cliente), monedaBase);

  return {
    costos, rrhh, extras,
    totales: {
      costos:          totCostos,
      rrhh:            totRrhh,
      extras_cliente:  totCliente,
      extras_empresa:  totEmpresa,
      // Costo del evento = costos + RRHH + extras a cargo de la empresa (los del
      // cliente quedan afuera, igual que en la planilla de KM)
      costo_evento:    r2(totCostos.total + totRrhh.total + totEmpresa.total),
      falta_pagar:     r2(totCostos.falta_pagar + totRrhh.falta_pagar + totEmpresa.falta_pagar),
      moneda:          monedaBase,
    },
  };
}

export async function getCentroCostos(req: Request, res: Response) {
  const evento = await buscarEvento(req, res);
  if (!evento) return;
  res.json({ evento, ...(await cargarCentroCostos(evento.id, req.empresaId!, evento.moneda_base)) });
}

export async function exportarCentroCostos(req: Request, res: Response) {
  const evento = await buscarEvento(req, res);
  if (!evento) return;
  const data = await cargarCentroCostos(evento.id, req.empresaId!, evento.moneda_base);
  const soloExtras = req.query.hoja === 'extras';
  const { buffer, filename } = await generateCentroCostosExcel(evento, data, { soloExtras });
  res.set({
    'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
    'Content-Length':      String(buffer.length),
  });
  res.end(buffer);
}

// ── Extras ────────────────────────────────────────────────────────────────────

const extraSchema = z.object({
  descripcion:     z.string().trim().min(1, 'La descripción es requerida'),
  responsable:     z.string().trim().nullable().optional(),
  moneda:          z.nativeEnum(Moneda).optional(),
  neto:            z.number().min(0).optional(),
  iva:             z.number().min(0).optional(),
  pagado:          z.boolean().optional(),
  plazo_pago:      z.string().trim().nullable().optional(),
  datos_cuenta:    z.string().trim().nullable().optional(),
  factura:         z.string().trim().nullable().optional(),
  notas:           z.string().trim().nullable().optional(),
  a_cargo_cliente: z.boolean().optional(),
});

const textoONull = (v: string | null | undefined) => (v === undefined ? undefined : v || null);

export async function createExtra(req: Request, res: Response) {
  const evento = await buscarEvento(req, res);
  if (!evento) return;
  const parsed = extraSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors });
    return;
  }
  const d = parsed.data;

  const extra = await prisma.$transaction(async tx => {
    const last = await tx.extraEvento.findFirst({
      where: { evento_id: evento.id, deleted_at: null }, orderBy: { orden: 'desc' }, select: { orden: true },
    });
    const created = await tx.extraEvento.create({
      data: {
        empresa_id:      req.empresaId!,
        evento_id:       evento.id,
        orden:           (last?.orden ?? 0) + 1,
        descripcion:     d.descripcion,
        responsable:     textoONull(d.responsable) ?? null,
        moneda:          d.moneda ?? evento.moneda_base,
        neto:            d.neto ?? 0,
        iva:             d.iva ?? 0,
        pagado:          d.pagado ?? false,
        plazo_pago:      textoONull(d.plazo_pago) ?? null,
        datos_cuenta:    textoONull(d.datos_cuenta) ?? null,
        factura:         textoONull(d.factura) ?? null,
        notas:           textoONull(d.notas) ?? null,
        a_cargo_cliente: d.a_cargo_cliente ?? true,
        created_by:      req.user!.id,
        updated_by:      req.user!.id,
      },
    });
    await sincronizarMovimientoExtra(tx, created.id, req.user!.id);
    await registrarAuditoria({
      usuarioId:   req.user!.id,
      empresaId:   req.empresaId,
      accion:      'CREATE',
      entidad:     'ExtraEvento',
      entidadId:   created.id,
      eventoId:    evento.id,
      descripcion: `Cargó el extra "${created.descripcion}"${created.a_cargo_cliente ? '' : ' (a cargo de la empresa)'}`,
      tx:          tx as any,
    });
    return tx.extraEvento.findUniqueOrThrow({ where: { id: created.id } });
  });
  res.status(201).json(mapExtra(extra));
}

async function buscarExtra(req: Request, res: Response) {
  const extra = await prisma.extraEvento.findFirst({
    where: { id: Number(req.params.id), deleted_at: null, ...withTenant(req.empresaId!) },
  });
  if (!extra) res.status(404).json({ error: 'Extra no encontrado' });
  return extra;
}

export async function updateExtra(req: Request, res: Response) {
  const existing = await buscarExtra(req, res);
  if (!existing) return;
  const parsed = extraSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors });
    return;
  }
  const d = parsed.data;

  const extra = await prisma.$transaction(async tx => {
    await tx.extraEvento.update({
      where: { id: existing.id },
      data:  {
        ...(d.descripcion     !== undefined && { descripcion: d.descripcion }),
        ...(d.responsable     !== undefined && { responsable: textoONull(d.responsable) }),
        ...(d.moneda          !== undefined && { moneda: d.moneda }),
        ...(d.neto            !== undefined && { neto: d.neto }),
        ...(d.iva             !== undefined && { iva: d.iva }),
        ...(d.pagado          !== undefined && { pagado: d.pagado }),
        ...(d.plazo_pago      !== undefined && { plazo_pago: textoONull(d.plazo_pago) }),
        ...(d.datos_cuenta    !== undefined && { datos_cuenta: textoONull(d.datos_cuenta) }),
        ...(d.factura         !== undefined && { factura: textoONull(d.factura) }),
        ...(d.notas           !== undefined && { notas: textoONull(d.notas) }),
        ...(d.a_cargo_cliente !== undefined && { a_cargo_cliente: d.a_cargo_cliente }),
        updated_by: req.user!.id,
      },
    });
    await sincronizarMovimientoExtra(tx, existing.id, req.user!.id);
    if (d.a_cargo_cliente !== undefined && d.a_cargo_cliente !== existing.a_cargo_cliente) {
      await registrarAuditoria({
        usuarioId:   req.user!.id,
        empresaId:   req.empresaId,
        accion:      'UPDATE',
        entidad:     'ExtraEvento',
        entidadId:   existing.id,
        eventoId:    existing.evento_id,
        descripcion: `Pasó el extra "${existing.descripcion}" a cargo ${d.a_cargo_cliente ? 'del cliente' : 'de la empresa (suma al costo)'}`,
        tx:          tx as any,
      });
    }
    return tx.extraEvento.findUniqueOrThrow({ where: { id: existing.id } });
  });
  res.json(mapExtra(extra));
}

export async function deleteExtra(req: Request, res: Response) {
  const existing = await buscarExtra(req, res);
  if (!existing) return;
  await prisma.$transaction(async tx => {
    await tx.extraEvento.update({
      where: { id: existing.id },
      data:  { deleted_at: new Date(), updated_by: req.user!.id },
    });
    await sincronizarMovimientoExtra(tx, existing.id, req.user!.id);
    await registrarAuditoria({
      usuarioId:   req.user!.id,
      empresaId:   req.empresaId,
      accion:      'DELETE',
      entidad:     'ExtraEvento',
      entidadId:   existing.id,
      eventoId:    existing.evento_id,
      descripcion: `Eliminó el extra "${existing.descripcion}"`,
      tx:          tx as any,
    });
  });
  res.json({ message: 'Extra eliminado' });
}

export async function subirComprobanteExtra(req: Request, res: Response) {
  const existing = await buscarExtra(req, res);
  if (!existing) return;
  if (!req.file) { res.status(400).json({ error: 'Falta el archivo' }); return; }
  const extra = await prisma.extraEvento.update({
    where: { id: existing.id },
    data:  {
      comprobante_data:   req.file.buffer,
      comprobante_nombre: req.file.originalname,
      comprobante_mime:   req.file.mimetype,
      updated_by:         req.user!.id,
    },
  });
  res.json(mapExtra(extra));
}

export async function quitarComprobanteExtra(req: Request, res: Response) {
  const existing = await buscarExtra(req, res);
  if (!existing) return;
  const extra = await prisma.extraEvento.update({
    where: { id: existing.id },
    data:  { comprobante_data: null, comprobante_nombre: null, comprobante_mime: null, updated_by: req.user!.id },
  });
  res.json(mapExtra(extra));
}

export async function descargarComprobanteExtra(req: Request, res: Response) {
  const extra = await buscarExtra(req, res);
  if (!extra) return;
  if (!extra.comprobante_data) { res.status(404).json({ error: 'Comprobante no encontrado' }); return; }
  const buffer   = Buffer.from(extra.comprobante_data);
  const filename = encodeURIComponent(extra.comprobante_nombre ?? 'comprobante');
  res.setHeader('Content-Type',        extra.comprobante_mime ?? 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length',      buffer.length);
  res.end(buffer);
}
