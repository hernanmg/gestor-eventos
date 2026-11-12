import type { Request, Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import * as XLSX from 'xlsx';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { registrarAuditoria } from '../lib/auditoria';
import { renderPDF } from '../lib/pdfExporter';
import { templateTarjetaCorporativa } from '../lib/pdfTemplates/tarjetaCorporativa';
import {
  importarTarjetaCorporativa, obtenerOCrearTarjeta, buscarUsuarioPorApodo,
  descontadoDesdeObservaciones, TIPO_PERSONAL, TIPO_EMPRESA,
} from '../lib/tarjetaCorporativaImporter';

// Tarjeta Corporativa Galicia (DOS57 / Enjoy) — sólo ADMIN. Una misma pantalla
// muestra las tarjetas de todas las empresas a las que el usuario tiene acceso
// (una tab por empresa), así que el scope no es la empresa activa de sesión
// sino el acceso multi-empresa — mismo criterio que afipPrestamos.controller.ts.

export const uploadPlanillaTC = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const isXlsx =
      file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.originalname.toLowerCase().endsWith('.xlsx');
    if (isXlsx) cb(null, true);
    else cb(new Error('Solo se aceptan archivos .xlsx'));
  },
});

// ── Acceso multi-empresa ──────────────────────────────────────────────────────
// Admin global (ADMIN sin empresa fija) → todas las empresas activas;
// puede_ver_macro → las de su UsuarioEmpresaAcceso; resto → empresa de sesión.

async function empresasAccesibles(req: Request): Promise<number[]> {
  const usuario = await prisma.usuario.findFirst({
    where:  { id: req.user!.id, deleted_at: null },
    select: { empresa_id: true, puede_ver_macro: true },
  });
  if (!usuario) return [];
  if (req.user!.rol === 'ADMIN' && usuario.empresa_id === null) {
    const empresas = await prisma.empresa.findMany({ where: { activo: true }, select: { id: true } });
    return empresas.map(e => e.id);
  }
  if (usuario.puede_ver_macro) {
    const accesos = await prisma.usuarioEmpresaAcceso.findMany({ where: { usuario_id: req.user!.id }, select: { empresa_id: true } });
    return [...new Set([req.empresaId!, ...accesos.map(a => a.empresa_id)])];
  }
  return [req.empresaId!];
}

async function tarjetaAccesible(req: Request, res: Response, tarjetaId: number) {
  const ids = await empresasAccesibles(req);
  const tarjeta = await prisma.tarjetaCorporativa.findFirst({ where: { id: tarjetaId, empresa_id: { in: ids } } });
  if (!tarjeta) { res.status(404).json({ error: 'Tarjeta no encontrada' }); return null; }
  return tarjeta;
}

const num = (v: Prisma.Decimal | null | undefined): number | null => (v == null ? null : Number(v));
const r2  = (n: number) => Math.round(n * 100) / 100;

function mapConsumo(c: any) {
  return { ...c, monto_ars: num(c.monto_ars), monto_usd: num(c.monto_usd) };
}

const RESPONSABLE_SELECT = { select: { id: true, nombre: true, tipo: true, usuario_id: true } } as const;

// Totales por responsable de un conjunto de consumos — mismo formato que el
// bloque resumen del Excel (ARS + USD por responsable), pero calculado del detalle.
function totalesPorResponsable(consumos: { responsable_id: number; monto_ars: any; monto_usd: any }[],
  responsables: { id: number; nombre: string; tipo: string }[]) {
  const acc = new Map<number, { consumos: number; ars: number; usd: number }>();
  for (const c of consumos) {
    const t = acc.get(c.responsable_id) ?? { consumos: 0, ars: 0, usd: 0 };
    t.consumos++;
    t.ars += Number(c.monto_ars ?? 0);
    t.usd += Number(c.monto_usd ?? 0);
    acc.set(c.responsable_id, t);
  }
  const porResponsable = responsables
    .filter(r => acc.has(r.id))
    .map(r => ({
      responsable_id: r.id, nombre: r.nombre, tipo: r.tipo,
      consumos:  acc.get(r.id)!.consumos,
      total_ars: r2(acc.get(r.id)!.ars),
      total_usd: r2(acc.get(r.id)!.usd),
    }));
  return {
    por_responsable: porResponsable,
    total_ars: r2(porResponsable.reduce((s, r) => s + r.total_ars, 0)),
    total_usd: r2(porResponsable.reduce((s, r) => s + r.total_usd, 0)),
  };
}

// ── GET /api/tarjeta-corporativa ─────────────────────────────────────────────
// Empresas accesibles (para las tabs) + sus tarjetas con responsables.

export async function listTarjetas(req: Request, res: Response) {
  const ids = await empresasAccesibles(req);
  const [empresas, tarjetas] = await Promise.all([
    prisma.empresa.findMany({ where: { id: { in: ids }, activo: true }, select: { id: true, nombre: true, nombre_corto: true }, orderBy: { id: 'asc' } }),
    prisma.tarjetaCorporativa.findMany({
      where:   { empresa_id: { in: ids } },
      include: {
        empresa:      { select: { id: true, nombre: true, nombre_corto: true } },
        responsables: { where: { activo: true }, orderBy: [{ nombre: 'asc' }, { tipo: 'desc' }], include: { usuario: { select: { id: true, nombre: true } } } },
        _count:       { select: { consumos: { where: { deleted_at: null } } } },
      },
      orderBy: { id: 'asc' },
    }),
  ]);
  res.json({ empresas, tarjetas });
}

// ── POST /api/tarjeta-corporativa ────────────────────────────────────────────
// Crea la tarjeta de una empresa (para cargar consumos a mano sin importar).

export async function createTarjeta(req: Request, res: Response) {
  const empresaId = Number(req.body?.empresa_id);
  const ids = await empresasAccesibles(req);
  if (!ids.includes(empresaId)) { res.status(400).json({ error: 'Sin permisos para esa empresa' }); return; }
  const tarjeta = await obtenerOCrearTarjeta(empresaId);
  res.status(201).json(tarjeta);
}

// ── GET /api/tarjeta-corporativa/:id/consumos ────────────────────────────────
// Filtros: ?mes=&anio= (período imputado), responsable_id, desde/hasta (fecha).

export async function listConsumos(req: Request, res: Response) {
  const tarjeta = await tarjetaAccesible(req, res, Number(req.params.id));
  if (!tarjeta) return;

  const { mes, anio, responsable_id, desde, hasta } = req.query as Record<string, string | undefined>;
  const where: Prisma.ConsumoTCWhereInput = { tarjeta_id: tarjeta.id, deleted_at: null };
  if (mes)  where.periodo_mes  = Number(mes);
  if (anio) where.periodo_anio = Number(anio);
  if (responsable_id) where.responsable_id = Number(responsable_id);
  const rango: Prisma.DateTimeFilter = {};
  if (desde) rango.gte = new Date(`${desde.slice(0, 10)}T00:00:00.000Z`);
  if (hasta) rango.lte = new Date(`${hasta.slice(0, 10)}T23:59:59.999Z`);
  if (rango.gte || rango.lte) where.fecha = rango;

  const [consumos, responsables] = await Promise.all([
    prisma.consumoTC.findMany({
      where,
      include: { responsable: RESPONSABLE_SELECT },
      orderBy: [{ responsable: { nombre: 'asc' } }, { fecha: 'asc' }, { id: 'asc' }],
    }),
    prisma.responsableTC.findMany({ where: { tarjeta_id: tarjeta.id }, orderBy: [{ nombre: 'asc' }, { tipo: 'desc' }] }),
  ]);

  res.json({ consumos: consumos.map(mapConsumo), ...totalesPorResponsable(consumos, responsables) });
}

// ── GET /api/tarjeta-corporativa/:id/resumen-mensual?mes=&anio= ─────────────

async function calcularResumenMensual(tarjetaId: number, mes: number, anio: number) {
  const [consumos, responsables] = await Promise.all([
    prisma.consumoTC.findMany({
      where:  { tarjeta_id: tarjetaId, deleted_at: null, periodo_mes: mes, periodo_anio: anio },
      select: { responsable_id: true, monto_ars: true, monto_usd: true },
    }),
    prisma.responsableTC.findMany({ where: { tarjeta_id: tarjetaId }, orderBy: [{ nombre: 'asc' }, { tipo: 'desc' }] }),
  ]);
  return { mes, anio, ...totalesPorResponsable(consumos, responsables) };
}

export async function resumenMensual(req: Request, res: Response) {
  const tarjeta = await tarjetaAccesible(req, res, Number(req.params.id));
  if (!tarjeta) return;
  const mes = Number(req.query.mes), anio = Number(req.query.anio);
  if (!(mes >= 1 && mes <= 12) || !(anio > 2000)) { res.status(400).json({ error: 'mes y anio son obligatorios' }); return; }
  res.json(await calcularResumenMensual(tarjeta.id, mes, anio));
}

// ── Periodos con datos (para que el selector de mes arranque en el último) ──

export async function periodosConDatos(req: Request, res: Response) {
  const tarjeta = await tarjetaAccesible(req, res, Number(req.params.id));
  if (!tarjeta) return;
  const grupos = await prisma.consumoTC.groupBy({
    by:      ['periodo_anio', 'periodo_mes'],
    where:   { tarjeta_id: tarjeta.id, deleted_at: null },
    _count:  { _all: true },
    orderBy: [{ periodo_anio: 'asc' }, { periodo_mes: 'asc' }],
  });
  res.json(grupos.map(g => ({ anio: g.periodo_anio, mes: g.periodo_mes, consumos: g._count._all })));
}

// ── Alta / edición / baja manual ─────────────────────────────────────────────

const consumoSchema = z.object({
  responsable_id:     z.number().int().positive().optional(),
  // Alternativa a responsable_id: crea el responsable si no existe.
  responsable_nombre: z.string().trim().min(1).optional(),
  responsable_tipo:   z.enum([TIPO_PERSONAL, TIPO_EMPRESA]).optional(),
  fecha:              z.string().min(10),
  periodo_mes:        z.number().int().min(1).max(12).optional(),
  periodo_anio:       z.number().int().min(2000).max(2100).optional(),
  monto_ars:          z.number().nullable().optional(),
  monto_usd:          z.number().nullable().optional(),
  detalle:            z.string().nullable().optional(),
  observaciones:      z.string().nullable().optional(),
  empresa_imputa:     z.string().nullable().optional(),
  descontado:         z.boolean().optional(),
  nota_descuento:     z.string().nullable().optional(),
});

const emptyToNull = (v: string | null | undefined) => (v === undefined ? undefined : (v?.trim() ? v.trim() : null));
const fechaUTC = (s: string) => new Date(`${s.slice(0, 10)}T00:00:00.000Z`);

async function resolverResponsable(tarjetaId: number, empresaId: number, d: z.infer<typeof consumoSchema>): Promise<number | null> {
  if (d.responsable_id) {
    const r = await prisma.responsableTC.findFirst({ where: { id: d.responsable_id, tarjeta_id: tarjetaId } });
    return r?.id ?? null;
  }
  if (!d.responsable_nombre) return null;
  const nombre = d.responsable_nombre.toUpperCase();
  const tipo = d.responsable_tipo ?? TIPO_PERSONAL;
  const existente = await prisma.responsableTC.findFirst({ where: { tarjeta_id: tarjetaId, nombre, tipo } });
  if (existente) return existente.id;
  const creado = await prisma.responsableTC.create({
    data: { tarjeta_id: tarjetaId, nombre, tipo, usuario_id: await buscarUsuarioPorApodo(nombre, empresaId) },
  });
  return creado.id;
}

export async function createConsumo(req: Request, res: Response) {
  const tarjeta = await tarjetaAccesible(req, res, Number(req.params.id));
  if (!tarjeta) return;
  const parsed = consumoSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return; }
  const d = parsed.data;
  if (d.monto_ars == null && d.monto_usd == null) { res.status(400).json({ error: 'Indicá un monto en $ o en USD' }); return; }

  const responsableId = await resolverResponsable(tarjeta.id, tarjeta.empresa_id, d);
  if (!responsableId) { res.status(400).json({ error: 'Responsable inválido' }); return; }

  const fecha = fechaUTC(d.fecha);
  const observaciones = emptyToNull(d.observaciones) ?? null;
  const creado = await prisma.consumoTC.create({
    data: {
      tarjeta_id:     tarjeta.id,
      responsable_id: responsableId,
      fecha,
      periodo_mes:    d.periodo_mes  ?? fecha.getUTCMonth() + 1,
      periodo_anio:   d.periodo_anio ?? fecha.getUTCFullYear(),
      monto_ars:      d.monto_ars ?? null,
      monto_usd:      d.monto_usd ?? null,
      detalle:        emptyToNull(d.detalle) ?? null,
      observaciones,
      empresa_imputa: emptyToNull(d.empresa_imputa) ?? null,
      descontado:     d.descontado ?? descontadoDesdeObservaciones(observaciones),
      nota_descuento: emptyToNull(d.nota_descuento) ?? null,
      created_by:     req.user!.id,
    },
    include: { responsable: RESPONSABLE_SELECT },
  });

  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId: tarjeta.empresa_id, accion: 'CREATE', entidad: 'ConsumoTC', entidadId: creado.id,
    descripcion: `Cargó consumo de tarjeta corporativa (${creado.responsable.nombre}) — ${creado.detalle ?? ''}`,
    datosDespues: mapConsumo(creado), ip: req.ip, tx: prisma,
  });
  res.status(201).json(mapConsumo(creado));
}

async function consumoAccesible(req: Request, res: Response) {
  const consumo = await prisma.consumoTC.findFirst({ where: { id: Number(req.params.id), deleted_at: null } });
  if (!consumo) { res.status(404).json({ error: 'Consumo no encontrado' }); return null; }
  const tarjeta = await tarjetaAccesible(req, res, consumo.tarjeta_id);
  if (!tarjeta) return null;
  return { consumo, tarjeta };
}

export async function updateConsumo(req: Request, res: Response) {
  const acc = await consumoAccesible(req, res);
  if (!acc) return;
  const parsed = consumoSchema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return; }
  const d = parsed.data;

  let responsableId: number | undefined;
  if (d.responsable_id || d.responsable_nombre) {
    const id = await resolverResponsable(acc.tarjeta.id, acc.tarjeta.empresa_id, d as z.infer<typeof consumoSchema>);
    if (!id) { res.status(400).json({ error: 'Responsable inválido' }); return; }
    responsableId = id;
  }

  const actualizado = await prisma.consumoTC.update({
    where: { id: acc.consumo.id },
    data: {
      ...(responsableId !== undefined && { responsable_id: responsableId }),
      ...(d.fecha          !== undefined && { fecha: fechaUTC(d.fecha) }),
      ...(d.periodo_mes    !== undefined && { periodo_mes: d.periodo_mes }),
      ...(d.periodo_anio   !== undefined && { periodo_anio: d.periodo_anio }),
      ...(d.monto_ars      !== undefined && { monto_ars: d.monto_ars }),
      ...(d.monto_usd      !== undefined && { monto_usd: d.monto_usd }),
      ...(d.detalle        !== undefined && { detalle: emptyToNull(d.detalle) }),
      ...(d.observaciones  !== undefined && { observaciones: emptyToNull(d.observaciones) }),
      ...(d.empresa_imputa !== undefined && { empresa_imputa: emptyToNull(d.empresa_imputa) }),
      ...(d.descontado     !== undefined && { descontado: d.descontado }),
      ...(d.nota_descuento !== undefined && { nota_descuento: emptyToNull(d.nota_descuento) }),
    },
    include: { responsable: RESPONSABLE_SELECT },
  });

  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId: acc.tarjeta.empresa_id, accion: 'UPDATE', entidad: 'ConsumoTC', entidadId: actualizado.id,
    descripcion: 'Editó consumo de tarjeta corporativa',
    datosAntes: mapConsumo(acc.consumo), datosDespues: mapConsumo(actualizado), ip: req.ip, tx: prisma,
  });
  res.json(mapConsumo(actualizado));
}

export async function deleteConsumo(req: Request, res: Response) {
  const acc = await consumoAccesible(req, res);
  if (!acc) return;
  await prisma.consumoTC.update({ where: { id: acc.consumo.id }, data: { deleted_at: new Date() } });
  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId: acc.tarjeta.empresa_id, accion: 'DELETE', entidad: 'ConsumoTC', entidadId: acc.consumo.id,
    descripcion: 'Eliminó consumo de tarjeta corporativa', datosAntes: mapConsumo(acc.consumo), ip: req.ip, tx: prisma,
  });
  res.status(204).end();
}

// ── POST /api/tarjeta-corporativa/importar?empresa_id=&preview=true|false ───
// preview=true (default): sólo parsea y calcula creados/actualizados.

export async function importarTC(req: Request, res: Response) {
  if (!req.file) { res.status(400).json({ error: 'Se requiere un archivo .xlsx' }); return; }
  const empresaId = Number(req.query.empresa_id);
  const ids = await empresasAccesibles(req);
  if (!ids.includes(empresaId)) { res.status(400).json({ error: 'Empresa inválida o sin permisos' }); return; }
  const esPreview = req.query.preview !== 'false';

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
  } catch (err: any) {
    res.status(400).json({ error: 'Error al procesar el archivo', detail: err.message }); return;
  }

  const resultado = await importarTarjetaCorporativa(workbook, empresaId, req.user!.id, esPreview);
  if (resultado.meses_detectados === 0) {
    res.status(400).json({ error: 'El archivo no tiene hojas "CONSUMOS <MES> <AÑO>" reconocibles', ...resultado }); return;
  }

  if (!esPreview) {
    await registrarAuditoria({
      usuarioId: req.user!.id, empresaId, accion: 'IMPORT', entidad: 'ConsumoTC',
      descripcion: `Importó tarjeta corporativa (${resultado.tarjeta.nombre}) — ${resultado.creados} creados, ${resultado.actualizados} actualizados, ${resultado.eliminados} dados de baja`,
      datosDespues: { ...resultado, hojas: resultado.hojas.map(h => ({ hoja: h.hoja, consumos: h.consumos })) }, ip: req.ip, tx: prisma,
    });
  }
  res.json({ preview: esPreview, ...resultado });
}

// ── GET /api/tarjeta-corporativa/:id/pdf?mes=&anio= ─────────────────────────

export async function exportarPdfMes(req: Request, res: Response) {
  const tarjeta = await tarjetaAccesible(req, res, Number(req.params.id));
  if (!tarjeta) return;
  const mes = Number(req.query.mes), anio = Number(req.query.anio);
  if (!(mes >= 1 && mes <= 12) || !(anio > 2000)) { res.status(400).json({ error: 'mes y anio son obligatorios' }); return; }

  const [resumen, consumos, empresa] = await Promise.all([
    calcularResumenMensual(tarjeta.id, mes, anio),
    prisma.consumoTC.findMany({
      where:   { tarjeta_id: tarjeta.id, deleted_at: null, periodo_mes: mes, periodo_anio: anio },
      include: { responsable: RESPONSABLE_SELECT },
      orderBy: [{ responsable: { nombre: 'asc' } }, { fecha: 'asc' }, { id: 'asc' }],
    }),
    prisma.empresa.findUniqueOrThrow({ where: { id: tarjeta.empresa_id }, select: { nombre: true, nombre_corto: true } }),
  ]);

  const html = templateTarjetaCorporativa({
    tarjeta:  tarjeta.nombre,
    empresa:  empresa.nombre_corto ?? empresa.nombre,
    mes, anio,
    resumen,
    consumos: consumos.map(c => ({
      responsable:    c.responsable.nombre,
      tipo:           c.responsable.tipo,
      fecha:          c.fecha,
      monto_ars:      num(c.monto_ars),
      monto_usd:      num(c.monto_usd),
      detalle:        c.detalle,
      observaciones:  c.observaciones,
      empresa_imputa: c.empresa_imputa,
      descontado:     c.descontado,
    })),
  });

  const buffer = await renderPDF(html, tarjeta.nombre, 'Consumos del mes');
  const filename = `${tarjeta.nombre.replace(/\s+/g, '_')}_${anio}-${String(mes).padStart(2, '0')}.pdf`;
  res.set({
    'Content-Type':        'application/pdf',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Content-Length':      String(buffer.length),
  });
  res.end(buffer);
}
