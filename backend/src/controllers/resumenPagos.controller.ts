import type { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import * as XLSX from 'xlsx';
import { z } from 'zod';
import type { Prisma, EstadoLineaPago } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { withTenant } from '../lib/tenant';
import { registrarAuditoria } from '../lib/auditoria';
import { parsearResumenPagos, importarResumenPagos } from '../lib/resumenPagosImporter';

// ── Resumen semanal de pagos (Andrea arma, Matías aprueba línea por línea) ────
// Ver el comentario de ResumenPagoSemanal en schema.prisma. Ciclo:
//   BORRADOR → (enviar) → ENVIADO → (cada línea de caja con decisión) → REVISADO
// Si Andrea cambia una línea después de la revisión, esa línea vuelve a
// PENDIENTE y el resumen vuelve a ENVIADO: Matías tiene que volver a mirarla.
// HISTORICO = importado de la planilla, sólo lectura.

export const uploadExcelPagos = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/\.(xlsx|xls)$/i.test(file.originalname)) cb(null, true);
    else cb(new Error('Solo se aceptan archivos Excel (.xlsx, .xls)'));
  },
});

const TIPOS = ['JORNALEROS', 'ADELANTO', 'VIATICO', 'CAJA_CHICA', 'REPOSICION_CAJA', 'PROVEEDOR', 'OTRO'] as const;
const SECCIONES = ['CAJA_SEMANAL', 'COBERTURA'] as const;
const MS_DIA = 86_400_000;

const fechaCal = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).transform(s => new Date(`${s}T00:00:00Z`));
const textoOpc = z.preprocess(v => (typeof v === 'string' && v.trim() === '' ? null : v), z.string().trim().max(500).nullable().optional());

const resumenSchema = z.object({
  semana_desde: fechaCal,
  semana_hasta: fechaCal,
  titulo:       textoOpc,
  notas:        z.preprocess(v => (typeof v === 'string' && v.trim() === '' ? null : v), z.string().trim().max(2000).nullable().optional()),
  copiar_ultima: z.boolean().optional(),
});

const lineaSchema = z.object({
  seccion:     z.enum(SECCIONES).default('CAJA_SEMANAL'),
  tipo:        z.enum(TIPOS).default('OTRO'),
  detalle:     z.string().trim().min(1, 'El detalle es obligatorio').max(300),
  importe:     z.number().finite(),
  observacion: textoOpc,
  origen_ref:  z.string().max(4000).nullable().optional(),
});

const revisionSchema = z.object({
  estado:           z.enum(['PENDIENTE', 'APROBADA', 'OBSERVADA', 'RECHAZADA']),
  comentario:       z.preprocess(v => (typeof v === 'string' && v.trim() === '' ? null : v), z.string().trim().max(1000).nullable().optional()),
  importe_aprobado: z.number().finite().nullable().optional(),
});

function badRequest(res: Response, err: z.ZodError) {
  res.status(400).json({ error: err.errors[0]?.message ?? 'Datos inválidos', detail: err.flatten().fieldErrors });
}

type LineaDb = Prisma.LineaResumenPagoGetPayload<object>;

function serializarLinea(l: LineaDb) {
  return {
    ...l,
    importe:          Number(l.importe),
    importe_aprobado: l.importe_aprobado != null ? Number(l.importe_aprobado) : null,
  };
}

const r2 = (n: number) => Math.round(n * 100) / 100;

function totales(lineas: LineaDb[]) {
  const caja = lineas.filter(l => l.seccion === 'CAJA_SEMANAL' && !l.deleted_at);
  const cuenta = (e: EstadoLineaPago) => caja.filter(l => l.estado === e).length;
  return {
    total_pedido:   r2(caja.reduce((a, l) => a + Number(l.importe), 0)),
    total_aprobado: r2(caja.filter(l => l.estado === 'APROBADA')
      .reduce((a, l) => a + Number(l.importe_aprobado ?? l.importe), 0)),
    lineas:     caja.length,
    pendientes: cuenta('PENDIENTE'),
    aprobadas:  cuenta('APROBADA'),
    observadas: cuenta('OBSERVADA'),
    rechazadas: cuenta('RECHAZADA'),
    total_cobertura: r2(lineas.filter(l => l.seccion === 'COBERTURA' && !l.deleted_at).reduce((a, l) => a + Number(l.importe), 0)),
  };
}

async function cargarResumen(id: number, empresaId: number) {
  return prisma.resumenPagoSemanal.findFirst({
    where: { id, deleted_at: null, ...withTenant(empresaId) },
    include: { lineas: { where: { deleted_at: null }, orderBy: [{ seccion: 'asc' }, { orden: 'asc' }, { id: 'asc' }] } },
  });
}

async function nombresUsuarios(ids: (number | null | undefined)[]) {
  const limpios = [...new Set(ids.filter((x): x is number => typeof x === 'number'))];
  if (limpios.length === 0) return new Map<number, string>();
  const us = await prisma.usuario.findMany({ where: { id: { in: limpios } }, select: { id: true, nombre: true } });
  return new Map(us.map(u => [u.id, u.nombre]));
}

async function serializarDetalle(r: NonNullable<Awaited<ReturnType<typeof cargarResumen>>>) {
  const nombres = await nombresUsuarios([r.created_by, r.enviado_por, r.revisado_por, ...r.lineas.map(l => l.revisado_por)]);
  return {
    ...r,
    creado_por_nombre:   r.created_by ? nombres.get(r.created_by) ?? null : null,
    enviado_por_nombre:  r.enviado_por ? nombres.get(r.enviado_por) ?? null : null,
    revisado_por_nombre: r.revisado_por ? nombres.get(r.revisado_por) ?? null : null,
    lineas: r.lineas.map(l => ({ ...serializarLinea(l), revisado_por_nombre: l.revisado_por ? nombres.get(l.revisado_por) ?? null : null })),
    totales: totales(r.lineas),
  };
}

// Recalcula ENVIADO ↔ REVISADO según si quedan líneas de caja sin decisión.
async function recalcularEstado(tx: Prisma.TransactionClient, resumenId: number, usuarioId: number) {
  const r = await tx.resumenPagoSemanal.findUnique({ where: { id: resumenId }, select: { estado: true } });
  if (!r || (r.estado !== 'ENVIADO' && r.estado !== 'REVISADO')) return;
  const pendientes = await tx.lineaResumenPago.count({
    where: { resumen_id: resumenId, deleted_at: null, seccion: 'CAJA_SEMANAL', estado: 'PENDIENTE' },
  });
  const total = await tx.lineaResumenPago.count({ where: { resumen_id: resumenId, deleted_at: null, seccion: 'CAJA_SEMANAL' } });
  if (pendientes === 0 && total > 0 && r.estado !== 'REVISADO') {
    await tx.resumenPagoSemanal.update({ where: { id: resumenId }, data: { estado: 'REVISADO', revisado_at: new Date(), revisado_por: usuarioId } });
  } else if ((pendientes > 0 || total === 0) && r.estado === 'REVISADO') {
    await tx.resumenPagoSemanal.update({ where: { id: resumenId }, data: { estado: 'ENVIADO', revisado_at: null, revisado_por: null } });
  }
}

// ── Quién revisa ──────────────────────────────────────────────────────────────
// No alcanza con el rol ADMIN: quien arma el resumen (Andrea) también es ADMIN
// de DOS57. Revisa el administrador general (Matías, ADMIN sin empresa fija) o
// quien tenga el permiso APROBAR_PAGOS (Configuración → Usuarios).
export async function puedeRevisarPagos(usuarioId: number): Promise<boolean> {
  const u = await prisma.usuario.findFirst({
    where: { id: usuarioId, deleted_at: null, activo: true },
    select: { rol: true, empresa_id: true, permisos: true },
  });
  if (!u) return false;
  return (u.rol === 'ADMIN' && u.empresa_id === null) || u.permisos.includes('APROBAR_PAGOS');
}

export function requireRevisorPagos(req: Request, res: Response, next: NextFunction) {
  puedeRevisarPagos(req.user!.id)
    .then(ok => (ok ? next() : res.status(403).json({ error: 'Sólo el administrador general o quien tenga el permiso puede aprobar los pagos' })))
    .catch(next);
}

// ── Lectura ───────────────────────────────────────────────────────────────────

// GET /api/resumen-pagos?anio=
export async function listResumenes(req: Request, res: Response) {
  const anio = Number(req.query.anio);
  const where: Prisma.ResumenPagoSemanalWhereInput = { deleted_at: null, ...withTenant(req.empresaId!) };
  if (anio) where.semana_desde = { gte: new Date(Date.UTC(anio - 1, 11, 20)), lt: new Date(Date.UTC(anio + 1, 0, 1)) };

  const resumenes = await prisma.resumenPagoSemanal.findMany({
    where,
    orderBy: { semana_desde: 'desc' },
    include: { lineas: { where: { deleted_at: null } } },
  });
  res.json(resumenes.map(({ lineas, ...r }) => ({ ...r, totales: totales(lineas) })));
}

// GET /api/resumen-pagos/:id
export async function getResumen(req: Request, res: Response) {
  const r = await cargarResumen(Number(req.params.id), req.empresaId!);
  if (!r) { res.status(404).json({ error: 'Resumen no encontrado' }); return; }
  res.json({ ...(await serializarDetalle(r)), puede_revisar: await puedeRevisarPagos(req.user!.id) });
}

// ── Alta / edición del resumen (Andrea) ───────────────────────────────────────

// POST /api/resumen-pagos — copiar_ultima: trae las líneas de la última semana
// (mismo detalle y tipo, importe en 0) porque los grupos se repiten.
export async function createResumen(req: Request, res: Response) {
  const parsed = resumenSchema.safeParse(req.body);
  if (!parsed.success) { badRequest(res, parsed.error); return; }
  const d = parsed.data;
  if (d.semana_hasta < d.semana_desde) { res.status(400).json({ error: 'La fecha de fin es anterior a la de inicio' }); return; }

  const solapa = await prisma.resumenPagoSemanal.findFirst({
    where: { deleted_at: null, ...withTenant(req.empresaId!), semana_desde: { lte: d.semana_hasta }, semana_hasta: { gte: d.semana_desde } },
    select: { id: true, titulo: true },
  });
  if (solapa) { res.status(409).json({ error: 'Ya hay un resumen para esas fechas', resumen_id: solapa.id }); return; }

  const uid = req.user!.id;
  const resumen = await prisma.$transaction(async tx => {
    const creado = await tx.resumenPagoSemanal.create({
      data: {
        ...withTenant(req.empresaId!),
        semana_desde: d.semana_desde, semana_hasta: d.semana_hasta,
        titulo: d.titulo ?? null, notas: d.notas ?? null,
        created_by: uid, updated_by: uid,
      },
    });
    if (d.copiar_ultima) {
      const ultimo = await tx.resumenPagoSemanal.findFirst({
        where: { deleted_at: null, ...withTenant(req.empresaId!), id: { not: creado.id }, semana_desde: { lt: d.semana_desde } },
        orderBy: { semana_desde: 'desc' },
        include: { lineas: { where: { deleted_at: null, seccion: 'CAJA_SEMANAL' }, orderBy: { orden: 'asc' } } },
      });
      if (ultimo?.lineas.length) {
        await tx.lineaResumenPago.createMany({
          data: ultimo.lineas.map((l, i) => ({
            resumen_id: creado.id, orden: i + 1, seccion: 'CAJA_SEMANAL' as const, tipo: l.tipo,
            detalle: l.detalle, importe: 0, observacion: null, created_by: uid, updated_by: uid,
          })),
        });
      }
    }
    await registrarAuditoria({
      usuarioId: uid, empresaId: req.empresaId, accion: 'CREATE', entidad: 'ResumenPagoSemanal', entidadId: creado.id,
      descripcion: `Creó el resumen semanal de pagos del ${d.semana_desde.toISOString().slice(0, 10)} al ${d.semana_hasta.toISOString().slice(0, 10)}`,
      ip: req.ip, tx,
    });
    return creado;
  });
  const r = await cargarResumen(resumen.id, req.empresaId!);
  res.status(201).json(await serializarDetalle(r!));
}

// PATCH /api/resumen-pagos/:id — fechas, título, notas
export async function updateResumen(req: Request, res: Response) {
  const id = Number(req.params.id);
  const r = await cargarResumen(id, req.empresaId!);
  if (!r) { res.status(404).json({ error: 'Resumen no encontrado' }); return; }
  if (r.estado === 'HISTORICO') { res.status(409).json({ error: 'Un resumen importado de la planilla no se edita' }); return; }
  const parsed = resumenSchema.partial().safeParse(req.body);
  if (!parsed.success) { badRequest(res, parsed.error); return; }
  const { copiar_ultima: _c, ...d } = parsed.data;
  const desde = d.semana_desde ?? r.semana_desde;
  const hasta = d.semana_hasta ?? r.semana_hasta;
  if (hasta < desde) { res.status(400).json({ error: 'La fecha de fin es anterior a la de inicio' }); return; }

  await prisma.resumenPagoSemanal.update({ where: { id }, data: { ...d, updated_by: req.user!.id } });
  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'UPDATE', entidad: 'ResumenPagoSemanal', entidadId: id,
    descripcion: 'Editó los datos del resumen semanal de pagos', datosDespues: d, ip: req.ip, tx: prisma,
  });
  res.json(await serializarDetalle((await cargarResumen(id, req.empresaId!))!));
}

// DELETE /api/resumen-pagos/:id — soft delete; sólo borradores o históricos
export async function deleteResumen(req: Request, res: Response) {
  const id = Number(req.params.id);
  const r = await cargarResumen(id, req.empresaId!);
  if (!r) { res.status(404).json({ error: 'Resumen no encontrado' }); return; }
  if (r.estado === 'ENVIADO' || r.estado === 'REVISADO') {
    res.status(409).json({ error: 'El resumen ya se envió a revisar: no se puede borrar' }); return;
  }
  await prisma.resumenPagoSemanal.update({ where: { id }, data: { deleted_at: new Date(), updated_by: req.user!.id } });
  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'DELETE', entidad: 'ResumenPagoSemanal', entidadId: id,
    descripcion: `Eliminó el resumen semanal de pagos "${r.titulo ?? r.semana_desde.toISOString().slice(0, 10)}"`, ip: req.ip, tx: prisma,
  });
  res.json({ message: 'Resumen eliminado' });
}

// POST /api/resumen-pagos/:id/enviar — BORRADOR → ENVIADO
export async function enviarResumen(req: Request, res: Response) {
  const id = Number(req.params.id);
  const r = await cargarResumen(id, req.empresaId!);
  if (!r) { res.status(404).json({ error: 'Resumen no encontrado' }); return; }
  if (r.estado !== 'BORRADOR') { res.status(409).json({ error: 'El resumen ya fue enviado' }); return; }
  if (!r.lineas.some(l => l.seccion === 'CAJA_SEMANAL')) { res.status(400).json({ error: 'El resumen no tiene líneas para aprobar' }); return; }

  await prisma.$transaction(async tx => {
    await tx.resumenPagoSemanal.update({ where: { id }, data: { estado: 'ENVIADO', enviado_at: new Date(), enviado_por: req.user!.id } });
    await recalcularEstado(tx, id, req.user!.id);
    await registrarAuditoria({
      usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'UPDATE', entidad: 'ResumenPagoSemanal', entidadId: id,
      descripcion: 'Envió el resumen semanal de pagos para aprobar', ip: req.ip, tx,
    });
  });
  res.json(await serializarDetalle((await cargarResumen(id, req.empresaId!))!));
}

// ── Líneas (Andrea) ───────────────────────────────────────────────────────────

// POST /api/resumen-pagos/:id/lineas — acepta una línea o un array (sugerencias)
export async function addLineas(req: Request, res: Response) {
  const id = Number(req.params.id);
  const r = await cargarResumen(id, req.empresaId!);
  if (!r) { res.status(404).json({ error: 'Resumen no encontrado' }); return; }
  if (r.estado === 'HISTORICO') { res.status(409).json({ error: 'Un resumen importado de la planilla no se edita' }); return; }

  const parsed = z.array(lineaSchema).min(1).max(100).safeParse(Array.isArray(req.body) ? req.body : [req.body]);
  if (!parsed.success) { badRequest(res, parsed.error); return; }

  const uid = req.user!.id;
  await prisma.$transaction(async tx => {
    let orden = r.lineas.reduce((m, l) => Math.max(m, l.orden), 0);
    for (const l of parsed.data) {
      orden += 1;
      await tx.lineaResumenPago.create({
        data: {
          resumen_id: id, orden, seccion: l.seccion, tipo: l.tipo, detalle: l.detalle, importe: l.importe,
          observacion: l.observacion ?? null, origen_ref: l.origen_ref ?? null, created_by: uid, updated_by: uid,
        },
      });
    }
    await recalcularEstado(tx, id, uid);
    await registrarAuditoria({
      usuarioId: uid, empresaId: req.empresaId, accion: 'CREATE', entidad: 'LineaResumenPago', entidadId: id,
      descripcion: parsed.data.length === 1 ? `Agregó "${parsed.data[0].detalle}" al resumen semanal de pagos` : `Agregó ${parsed.data.length} líneas al resumen semanal de pagos`,
      ip: req.ip, tx,
    });
  });
  res.status(201).json(await serializarDetalle((await cargarResumen(id, req.empresaId!))!));
}

async function cargarLinea(lineaId: number, empresaId: number) {
  return prisma.lineaResumenPago.findFirst({
    where: { id: lineaId, deleted_at: null, resumen: { deleted_at: null, ...withTenant(empresaId) } },
    include: { resumen: { select: { id: true, estado: true } } },
  });
}

// PATCH /api/resumen-pagos/lineas/:lineaId — si cambia el detalle o el
// importe de una línea ya revisada, vuelve a PENDIENTE para que Matías la mire.
export async function updateLinea(req: Request, res: Response) {
  const lineaId = Number(req.params.lineaId);
  const l = await cargarLinea(lineaId, req.empresaId!);
  if (!l) { res.status(404).json({ error: 'Línea no encontrada' }); return; }
  if (l.resumen.estado === 'HISTORICO') { res.status(409).json({ error: 'Un resumen importado de la planilla no se edita' }); return; }
  const parsed = lineaSchema.partial().safeParse(req.body);
  if (!parsed.success) { badRequest(res, parsed.error); return; }
  const d = parsed.data;

  const cambiaFondo = (d.importe !== undefined && d.importe !== Number(l.importe))
    || (d.detalle !== undefined && d.detalle !== l.detalle)
    || (d.seccion !== undefined && d.seccion !== l.seccion);
  const vuelveAPendiente = cambiaFondo && l.estado !== 'PENDIENTE';

  await prisma.$transaction(async tx => {
    await tx.lineaResumenPago.update({
      where: { id: lineaId },
      data: {
        ...d,
        updated_by: req.user!.id,
        // El comentario de Matías se conserva para ver qué pidió
        ...(vuelveAPendiente ? { estado: 'PENDIENTE' as const, importe_aprobado: null, revisado_at: null, revisado_por: null } : {}),
      },
    });
    await recalcularEstado(tx, l.resumen.id, req.user!.id);
    await registrarAuditoria({
      usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'UPDATE', entidad: 'LineaResumenPago', entidadId: lineaId,
      descripcion: `Editó "${l.detalle}" en el resumen semanal de pagos${vuelveAPendiente ? ' (vuelve a revisión)' : ''}`,
      datosAntes: { detalle: l.detalle, importe: Number(l.importe), estado: l.estado }, datosDespues: d, ip: req.ip, tx,
    });
  });
  res.json(await serializarDetalle((await cargarResumen(l.resumen.id, req.empresaId!))!));
}

// DELETE /api/resumen-pagos/lineas/:lineaId
export async function deleteLinea(req: Request, res: Response) {
  const lineaId = Number(req.params.lineaId);
  const l = await cargarLinea(lineaId, req.empresaId!);
  if (!l) { res.status(404).json({ error: 'Línea no encontrada' }); return; }
  if (l.resumen.estado === 'HISTORICO') { res.status(409).json({ error: 'Un resumen importado de la planilla no se edita' }); return; }
  await prisma.$transaction(async tx => {
    await tx.lineaResumenPago.update({ where: { id: lineaId }, data: { deleted_at: new Date(), updated_by: req.user!.id } });
    await recalcularEstado(tx, l.resumen.id, req.user!.id);
    await registrarAuditoria({
      usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'DELETE', entidad: 'LineaResumenPago', entidadId: lineaId,
      descripcion: `Sacó "${l.detalle}" del resumen semanal de pagos`, ip: req.ip, tx,
    });
  });
  res.json(await serializarDetalle((await cargarResumen(l.resumen.id, req.empresaId!))!));
}

// ── Revisión (Matías, ADMIN) ──────────────────────────────────────────────────

// POST /api/resumen-pagos/lineas/:lineaId/revisar
// APROBADA (con importe_aprobado opcional si aprueba otro monto),
// OBSERVADA (pide un cambio: comentario o importe obligatorio), RECHAZADA,
// PENDIENTE (deshacer).
export async function revisarLinea(req: Request, res: Response) {
  const lineaId = Number(req.params.lineaId);
  const l = await cargarLinea(lineaId, req.empresaId!);
  if (!l) { res.status(404).json({ error: 'Línea no encontrada' }); return; }
  if (l.seccion !== 'CAJA_SEMANAL') { res.status(400).json({ error: 'Sólo se aprueban las líneas de la caja semanal' }); return; }
  if (l.resumen.estado !== 'ENVIADO' && l.resumen.estado !== 'REVISADO') {
    res.status(409).json({ error: l.resumen.estado === 'BORRADOR' ? 'El resumen todavía no se envió a revisar' : 'Este resumen no se revisa en el sistema' });
    return;
  }
  const parsed = revisionSchema.safeParse(req.body);
  if (!parsed.success) { badRequest(res, parsed.error); return; }
  const d = parsed.data;
  if (d.estado === 'OBSERVADA' && !d.comentario && d.importe_aprobado == null) {
    res.status(400).json({ error: 'Escribí qué hay que cambiar' }); return;
  }
  if (d.estado === 'RECHAZADA' && !d.comentario) { res.status(400).json({ error: 'Escribí por qué no se paga' }); return; }

  const pendiente = d.estado === 'PENDIENTE';
  const importeAprobado = d.estado === 'APROBADA' || d.estado === 'OBSERVADA'
    ? (d.importe_aprobado != null && d.importe_aprobado !== Number(l.importe) ? d.importe_aprobado : null)
    : null;

  await prisma.$transaction(async tx => {
    await tx.lineaResumenPago.update({
      where: { id: lineaId },
      data: {
        estado: d.estado,
        importe_aprobado: importeAprobado,
        comentario_revision: pendiente ? l.comentario_revision : (d.comentario ?? null),
        revisado_por: pendiente ? null : req.user!.id,
        revisado_at:  pendiente ? null : new Date(),
      },
    });
    await recalcularEstado(tx, l.resumen.id, req.user!.id);
    const verbo = { APROBADA: 'Aprobó', OBSERVADA: 'Pidió un cambio en', RECHAZADA: 'Rechazó', PENDIENTE: 'Volvió a pendiente' }[d.estado];
    await registrarAuditoria({
      usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'UPDATE', entidad: 'LineaResumenPago', entidadId: lineaId,
      descripcion: `${verbo} "${l.detalle}" del resumen semanal de pagos${importeAprobado != null ? ` por $${importeAprobado.toLocaleString('es-AR')}` : ''}${d.comentario ? `: ${d.comentario}` : ''}`,
      datosAntes: { estado: l.estado }, datosDespues: d, ip: req.ip, tx,
    });
  });
  res.json(await serializarDetalle((await cargarResumen(l.resumen.id, req.empresaId!))!));
}

// POST /api/resumen-pagos/:id/aprobar-pendientes — tilda de una vez todo lo
// que quedó pendiente, después de haber revisado las líneas que le importan.
export async function aprobarPendientes(req: Request, res: Response) {
  const id = Number(req.params.id);
  const r = await cargarResumen(id, req.empresaId!);
  if (!r) { res.status(404).json({ error: 'Resumen no encontrado' }); return; }
  if (r.estado !== 'ENVIADO') { res.status(409).json({ error: 'No hay líneas para aprobar' }); return; }
  await prisma.$transaction(async tx => {
    const { count } = await tx.lineaResumenPago.updateMany({
      where: { resumen_id: id, deleted_at: null, seccion: 'CAJA_SEMANAL', estado: 'PENDIENTE' },
      data: { estado: 'APROBADA', revisado_por: req.user!.id, revisado_at: new Date() },
    });
    await recalcularEstado(tx, id, req.user!.id);
    await registrarAuditoria({
      usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'UPDATE', entidad: 'ResumenPagoSemanal', entidadId: id,
      descripcion: `Aprobó las ${count} líneas pendientes del resumen semanal de pagos`, ip: req.ip, tx,
    });
  });
  res.json(await serializarDetalle((await cargarResumen(id, req.empresaId!))!));
}

// ── Sugerencias desde el sistema ──────────────────────────────────────────────
// Lo que ya está cargado y Andrea hoy vuelve a tipear en la planilla:
// liquidaciones de jornaleros por grupo, adelantos, viáticos de extranjeros y
// gastos de cada caja (reposición). Ventana: la semana anterior al resumen
// más la semana del resumen (los grupos se pagan por la semana trabajada).
// origen_ref evita sugerir dos veces lo que ya entró en otro resumen.

const GRUPO_CATEGORIA: Record<string, string> = {
  FOFI: 'EQUIPO FOFI', NESTORAS: 'EQUIPO NESTOR', EXTRANJERO: 'EQUIPO EXTRANJEROS',
  JORNALERO: 'GRUPO DOS57 JORNALEROS', ARMADOR: 'GRUPO ARMADORES', CAPITAN: 'GRUPO CAPITANES',
  CHOFER: 'CHOFERES', SERENO: 'SERENOS', TECNICO: 'TÉCNICOS', OTRO: 'OTROS',
};

function idsUsados(refs: (string | null)[]) {
  const usados = { liq: new Set<number>(), ant: new Set<number>(), mov: new Set<number>() };
  for (const ref of refs) {
    if (!ref) continue;
    for (const parte of ref.split(';')) {
      const [pref, lista] = parte.split(':');
      const set = usados[pref as keyof typeof usados];
      if (set && lista) lista.split(',').forEach(x => { const n = Number(x); if (n) set.add(n); });
    }
  }
  return usados;
}

const fmtDia = (d: Date) => `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
const nombreCorto = (e: { nombre: string; apellido: string }) => `${e.nombre.split(' ')[0]} ${e.apellido}`.trim().toUpperCase();

// GET /api/resumen-pagos/:id/sugerencias
export async function sugerencias(req: Request, res: Response) {
  const id = Number(req.params.id);
  const r = await cargarResumen(id, req.empresaId!);
  if (!r) { res.status(404).json({ error: 'Resumen no encontrado' }); return; }
  const empresaId = req.empresaId!;
  const desde = new Date(r.semana_desde.getTime() - 7 * MS_DIA);
  const hastaExcl = new Date(r.semana_hasta.getTime() + MS_DIA);

  const refs = await prisma.lineaResumenPago.findMany({
    where: { deleted_at: null, origen_ref: { not: null }, resumen: { deleted_at: null, ...withTenant(empresaId) } },
    select: { origen_ref: true },
  });
  const usados = idsUsados(refs.map(x => x.origen_ref));

  const [liquidaciones, anticipos, cuentas] = await Promise.all([
    prisma.liquidacion.findMany({
      where: { ...withTenant(empresaId), estado: { not: 'CANCELADA' }, fecha_hasta: { gte: desde, lt: hastaExcl } },
      include: { empleado: { select: { nombre: true, apellido: true, categoria: true } } },
    }),
    prisma.anticipo.findMany({
      where: { ...withTenant(empresaId), tipo: 'ADELANTO', fecha: { gte: r.semana_desde, lt: hastaExcl } },
      include: { empleado: { select: { nombre: true, apellido: true } } },
    }),
    prisma.cuentaBancaria.findMany({
      where: { ...withTenant(empresaId), deleted_at: null, tipo: 'EFECTIVO', evento_id: null, estado: { not: 'CERRADA' } },
      select: { id: true, nombre: true, saldo_minimo: true },
    }),
  ]);

  const out: { tipo: (typeof TIPOS)[number]; detalle: string; importe: number; observacion: string | null; origen_ref: string; fuente: string }[] = [];

  // 1) Grupos de jornaleros
  const porGrupo = new Map<string, typeof liquidaciones>();
  for (const l of liquidaciones) {
    if (usados.liq.has(l.id)) continue;
    const g = l.empleado.categoria;
    porGrupo.set(g, [...(porGrupo.get(g) ?? []), l]);
  }
  for (const [cat, ls] of porGrupo) {
    const ini = new Date(Math.min(...ls.map(l => l.fecha_desde.getTime())));
    const fin = new Date(Math.max(...ls.map(l => l.fecha_hasta.getTime())));
    const personas = [...new Set(ls.map(l => nombreCorto(l.empleado)))];
    out.push({
      tipo: 'JORNALEROS',
      detalle: `${GRUPO_CATEGORIA[cat] ?? cat} - ${personas.length} PAX (Sem. ${fmtDia(ini)} al ${fmtDia(fin)})`,
      importe: r2(ls.reduce((a, l) => a + Number(l.total_a_cobrar), 0)),
      observacion: personas.join(' / ').slice(0, 300),
      origen_ref: `liq:${ls.map(l => l.id).join(',')}`,
      fuente: `${ls.length} liquidación(es) de jornaleros`,
    });
  }

  // 2) Adelantos
  const ants = anticipos.filter(a => !usados.ant.has(a.id));
  if (ants.length) {
    out.push({
      tipo: 'ADELANTO',
      detalle: 'ADELANTOS DOS57',
      importe: r2(ants.reduce((a, x) => a + Number(x.monto), 0)),
      observacion: ants.map(a => `${nombreCorto(a.empleado)} $${Number(a.monto).toLocaleString('es-AR')}`).join(' / ').slice(0, 300),
      origen_ref: `ant:${ants.map(a => a.id).join(',')}`,
      fuente: `${ants.length} adelanto(s) cargados en RRHH`,
    });
  }

  // 3) y 4) Movimientos de las cajas de efectivo: viáticos de extranjeros
  // aparte, y el resto de los gastos como reposición de cada caja. Se dejan
  // afuera las transferencias entre cajas y lo que generó una liquidación.
  if (cuentas.length) {
    const movs = await prisma.movimientoCaja.findMany({
      where: {
        cuenta_id: { in: cuentas.map(c => c.id) }, deleted_at: null, haber: { gt: 0 },
        fecha: { gte: desde, lt: hastaExcl }, transferencia_par_id: null, liquidacion_admin_id: null,
      },
      select: { id: true, cuenta_id: true, haber: true, categoria_andrea: true, descripcion: true },
    });
    const libres = movs.filter(m => !usados.mov.has(m.id));
    const viaticos = libres.filter(m => m.categoria_andrea === 'VIATICO_EXTRANJEROS');
    if (viaticos.length) {
      out.push({
        tipo: 'VIATICO',
        detalle: 'VIÁTICOS EQUIPO EXTRANJEROS',
        importe: r2(viaticos.reduce((a, m) => a + Number(m.haber), 0)),
        observacion: viaticos.map(m => m.descripcion).filter(Boolean).join(' / ').slice(0, 300) || null,
        origen_ref: `mov:${viaticos.map(m => m.id).join(',')}`,
        fuente: `${viaticos.length} gasto(s) "Viático extranjeros" de la caja`,
      });
    }
    for (const c of cuentas) {
      const gastos = libres.filter(m => m.cuenta_id === c.id && m.categoria_andrea !== 'VIATICO_EXTRANJEROS');
      if (!gastos.length) continue;
      const ultimo = await prisma.movimientoCaja.findFirst({
        where: { cuenta_id: c.id, deleted_at: null }, orderBy: [{ fecha: 'desc' }, { orden: 'desc' }], select: { saldo_corriente: true },
      });
      const esReserva = /RESERVA/i.test(c.nombre);
      out.push({
        tipo: esReserva ? 'REPOSICION_CAJA' : 'CAJA_CHICA',
        detalle: `REPOSICIÓN ${c.nombre.toUpperCase()}`,
        importe: r2(gastos.reduce((a, m) => a + Number(m.haber), 0)),
        observacion: ultimo ? `Saldo actual $${Number(ultimo.saldo_corriente).toLocaleString('es-AR')}` : null,
        origen_ref: `mov:${gastos.map(m => m.id).join(',')}`,
        fuente: `${gastos.length} gasto(s) de ${c.nombre} entre el ${fmtDia(desde)} y el ${fmtDia(r.semana_hasta)}`,
      });
    }
  }

  res.json(out);
}

// ── Importador de la planilla ─────────────────────────────────────────────────

function leerWorkbook(req: Request, res: Response): XLSX.WorkBook | null {
  if (!req.file) { res.status(400).json({ error: 'Se requiere un archivo Excel' }); return null; }
  try {
    return XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
  } catch {
    res.status(400).json({ error: 'No se pudo leer el archivo Excel' });
    return null;
  }
}

// POST /api/resumen-pagos/importar/preview
export async function previewImport(req: Request, res: Response) {
  const wb = leerWorkbook(req, res);
  if (!wb) return;
  res.json(await parsearResumenPagos(wb, req.empresaId!));
}

// POST /api/resumen-pagos/importar
export async function confirmarImport(req: Request, res: Response) {
  const wb = leerWorkbook(req, res);
  if (!wb) return;
  const resultado = await importarResumenPagos(wb, req.empresaId!, req.user!.id);
  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'IMPORT', entidad: 'ResumenPagoSemanal',
    descripcion: `Importó la planilla de pagos semanales: ${resultado.creados} semanas nuevas, ${resultado.actualizados} actualizadas, ${resultado.omitidos} omitidas`,
    ip: req.ip, tx: prisma,
  });
  res.json(resultado);
}
