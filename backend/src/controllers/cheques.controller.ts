import type { Request, Response } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { EstadoEcheq, Moneda } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { withTenant } from '../lib/tenant';
import { registrarAuditoria } from '../lib/auditoria';
import { convertirARS } from '../lib/convertirARS';
import { parseFechaCalendario } from '../lib/vencimientos';
import multer from 'multer';
import * as XLSX from 'xlsx';
import { importarChequesBanco } from '../lib/chequesBancoImporter';

// ── Cheques emitidos de la empresa, por banco (Mayra) ────────────────────────
// Mismo modelo Echeq que la pestaña del evento: acá se ven todos, tengan o no
// evento, agrupados por banco. Reemplaza las planillas "Cheques Pendientes -
// <BANCO>" (fecha de pago, n° de cheque, concepto, monto, estado, fecha de
// entrada) y su sección verde de financiamiento con SGR.

const MS_DIA = 86_400_000;

// Bancos con los que opera cada empresa según la entrevista; el campo es texto
// libre en mayúsculas, esto sólo alimenta las sugerencias del front.
export const BANCOS_SUGERIDOS = ['GALICIA', 'NACION', 'BBVA', 'BANCOR'];

// Hoy como fecha de calendario (medianoche UTC) según el reloj local del
// servidor (TZ=America/Argentina/Buenos_Aires): a las 22 h de un jueves sigue
// siendo jueves, aunque en UTC ya sea viernes.
export function hoyCalendario(ahora = new Date()): Date {
  return new Date(Date.UTC(ahora.getFullYear(), ahora.getMonth(), ahora.getDate()));
}

// Viernes de la semana de `hoy` (si hoy es sábado o domingo, el siguiente).
// Mayra junta los cheques para que caigan los viernes; el fin de semana se
// suma al mismo bloque porque entra al banco el lunes y se cubre igual.
export function bloqueViernes(hoy: Date): { viernes: Date; hasta: Date } {
  const dow = hoy.getUTCDay(); // 0 dom … 5 vie … 6 sáb
  const diff = dow <= 5 ? 5 - dow : 6; // sábado → viernes siguiente
  const viernes = new Date(hoy.getTime() + diff * MS_DIA);
  return { viernes, hasta: new Date(viernes.getTime() + 2 * MS_DIA) };
}

export const normalizarBanco = (b: string | null | undefined) => {
  const v = (b ?? '').trim().toUpperCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '');
  return v || null;
};

const SIN_BANCO = 'SIN BANCO';

// Cheques vivos: los de eventos borrados no cuentan.
const vivo = (empresaId: number): Prisma.EcheqWhereInput => ({
  deleted_at: null, ...withTenant(empresaId),
  OR: [{ evento_id: null }, { evento: { deleted_at: null } }],
});

const include = {
  evento:    { select: { id: true, nombre: true } },
  proveedor: { select: { id: true, nombre: true } },
  sgr:       { select: { id: true, nombre: true } },
} satisfies Prisma.EcheqInclude;

type ChequeRow = Prisma.EcheqGetPayload<{ include: typeof include }>;

function mapCheque(e: ChequeRow) {
  return {
    ...e,
    importe:             Number(e.importe),
    monto_ars:           e.monto_ars !== null ? Number(e.monto_ars) : null,
    tasa_cambio:         e.tasa_cambio !== null ? Number(e.tasa_cambio) : null,
    tasa_descuento:      e.tasa_descuento !== null ? Number(e.tasa_descuento) : null,
    monto_neto_recibido: e.monto_neto_recibido !== null ? Number(e.monto_neto_recibido) : null,
  };
}

const importeArs = (e: { importe: Prisma.Decimal; monto_ars: Prisma.Decimal | null }) => Number(e.monto_ars ?? e.importe);

// ── Listado ──────────────────────────────────────────────────────────────────

const listSchema = z.object({
  banco:  z.string().optional(),
  estado: z.nativeEnum(EstadoEcheq).optional(),
  tipo:   z.enum(['PAGO', 'FINANCIAMIENTO_PROPIO', 'FINANCIAMIENTO_AVALADO', 'FINANCIAMIENTO']).optional(),
  desde:  z.string().optional(),
  hasta:  z.string().optional(),
  buscar: z.string().optional(),
});

export async function listCheques(req: Request, res: Response) {
  const q = listSchema.safeParse(req.query);
  if (!q.success) { res.status(400).json({ error: 'Parámetros inválidos' }); return; }
  const { banco, estado, tipo, desde, hasta, buscar } = q.data;

  const where: Prisma.EcheqWhereInput = { ...vivo(req.empresaId!) };
  const and: Prisma.EcheqWhereInput[] = [];
  if (banco) and.push(banco === SIN_BANCO ? { banco: null } : { banco: normalizarBanco(banco) });
  if (estado) where.estado = estado;
  if (tipo === 'FINANCIAMIENTO') where.tipo = { in: ['FINANCIAMIENTO_PROPIO', 'FINANCIAMIENTO_AVALADO'] };
  else if (tipo) where.tipo = tipo;
  const fd = parseFechaCalendario(desde), fh = parseFechaCalendario(hasta);
  if (fd || fh) where.fecha_cobro_estimada = { ...(fd ? { gte: fd } : {}), ...(fh ? { lte: fh } : {}) };
  if (buscar?.trim()) {
    const t = buscar.trim();
    and.push({ OR: [
      { numero: { contains: t, mode: 'insensitive' } },
      { razon_social: { contains: t, mode: 'insensitive' } },
      { detalle: { contains: t, mode: 'insensitive' } },
    ] });
  }
  if (and.length) where.AND = and;

  const cheques = await prisma.echeq.findMany({
    where, include,
    orderBy: [{ fecha_cobro_estimada: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }],
    take: 2000,
  });
  res.json(cheques.map(mapCheque));
}

// ── Resumen: por banco + bloque del viernes ──────────────────────────────────

export async function resumenCheques(req: Request, res: Response) {
  const empresaId = req.empresaId!;
  const hoy = hoyCalendario();
  const { viernes, hasta } = bloqueViernes(hoy);

  const [pendientes, usados] = await Promise.all([
    prisma.echeq.findMany({
      where:  { ...vivo(empresaId), estado: 'PENDIENTE' },
      select: { banco: true, tipo: true, importe: true, monto_ars: true, fecha_cobro_estimada: true },
    }),
    prisma.echeq.findMany({
      where: { deleted_at: null, ...withTenant(empresaId), banco: { not: null } },
      distinct: ['banco'], select: { banco: true },
    }),
  ]);

  type Bucket = { banco: string; cantidad: number; total: number; financiamiento: number; vencidos: number; total_vencidos: number; bloque_viernes: number; total_bloque_viernes: number; avalados_bloque: number };
  const porBanco = new Map<string, Bucket>();
  for (const p of pendientes) {
    const banco = p.banco ?? SIN_BANCO;
    const b = porBanco.get(banco) ?? { banco, cantidad: 0, total: 0, financiamiento: 0, vencidos: 0, total_vencidos: 0, bloque_viernes: 0, total_bloque_viernes: 0, avalados_bloque: 0 };
    const imp = importeArs(p);
    b.cantidad++; b.total += imp;
    if (p.tipo !== 'PAGO') b.financiamiento += imp;
    const f = p.fecha_cobro_estimada;
    if (f && f < hoy) { b.vencidos++; b.total_vencidos += imp; }
    if (f && f >= viernes && f <= hasta) {
      b.bloque_viernes++; b.total_bloque_viernes += imp;
      if (p.tipo === 'FINANCIAMIENTO_AVALADO') b.avalados_bloque++;
    }
    porBanco.set(banco, b);
  }
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const bancos = [...porBanco.values()]
    .map(b => ({ ...b, total: r2(b.total), financiamiento: r2(b.financiamiento), total_vencidos: r2(b.total_vencidos), total_bloque_viernes: r2(b.total_bloque_viernes) }))
    .sort((a, b) => b.total - a.total);

  res.json({
    hoy:          hoy.toISOString().slice(0, 10),
    viernes:      viernes.toISOString().slice(0, 10),
    hasta:        hasta.toISOString().slice(0, 10),
    bancos,
    total_bloque_viernes: r2(bancos.reduce((a, b) => a + b.total_bloque_viernes, 0)),
    bancos_usados: [...new Set([...BANCOS_SUGERIDOS, ...usados.map(u => u.banco!).filter(Boolean)])],
  });
}

// ── Alta / edición ───────────────────────────────────────────────────────────

const fecha = z.string().nullable().optional();
const baseSchema = z.object({
  evento_id:            z.number().int().positive().nullable().optional(),
  proveedor_id:         z.number().int().positive().nullable().optional(),
  sgr_id:               z.number().int().positive().nullable().optional(),
  numero:               z.string().trim().min(1),
  razon_social:         z.string().trim().min(1).nullable().optional(),
  detalle:              z.string().nullable().optional(),
  importe:              z.number().positive(),
  moneda:               z.enum(['ARS', 'USD', 'EUR']).default('ARS'),
  tasa_cambio:          z.number().positive().nullable().optional(),
  banco:                z.string().nullable().optional(),
  formato:              z.enum(['ECHEQ', 'FISICO']).default('ECHEQ'),
  tipo:                 z.enum(['PAGO', 'FINANCIAMIENTO_PROPIO', 'FINANCIAMIENTO_AVALADO']).default('PAGO'),
  fecha_emision:        fecha,
  fecha_cobro_estimada: fecha,
});
const createSchema = baseSchema;
const updateSchema = baseSchema.partial();

async function validarRefs(empresaId: number, d: { evento_id?: number | null; proveedor_id?: number | null; sgr_id?: number | null }) {
  if (d.evento_id) {
    const ev = await prisma.evento.findFirst({ where: { id: d.evento_id, deleted_at: null, ...withTenant(empresaId) }, select: { id: true } });
    if (!ev) return 'Evento no encontrado';
  }
  if (d.sgr_id) {
    const s = await prisma.sGR.findFirst({ where: { id: d.sgr_id, deleted_at: null, ...withTenant(empresaId) }, select: { id: true } });
    if (!s) return 'SGR no encontrada';
  }
  if (d.proveedor_id) {
    const p = await prisma.proveedor.findFirst({ where: { id: d.proveedor_id, deleted_at: null, ...withTenant(empresaId) }, select: { id: true } });
    if (!p) return 'Proveedor no encontrado';
  }
  return null;
}

function fechas(d: { fecha_emision?: string | null; fecha_cobro_estimada?: string | null }) {
  const fe = parseFechaCalendario(d.fecha_emision);
  const fc = parseFechaCalendario(d.fecha_cobro_estimada);
  if (fe === undefined || fc === undefined) return null;
  return { fe, fc };
}

export async function createCheque(req: Request, res: Response) {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return; }
  const d = parsed.data;
  const empresaId = req.empresaId!;

  const err = await validarRefs(empresaId, d);
  if (err) { res.status(400).json({ error: err }); return; }
  const f = fechas(d);
  if (!f) { res.status(400).json({ error: 'Fecha inválida' }); return; }

  let razonSocial = d.razon_social ?? null;
  if (!razonSocial && d.proveedor_id) {
    razonSocial = (await prisma.proveedor.findUnique({ where: { id: d.proveedor_id }, select: { nombre: true } }))?.nombre ?? null;
  }
  if (!razonSocial && d.sgr_id) {
    razonSocial = (await prisma.sGR.findUnique({ where: { id: d.sgr_id }, select: { nombre: true } }))?.nombre ?? null;
  }
  if (!razonSocial) { res.status(400).json({ error: 'Indicá a quién va el cheque (proveedor, SGR o concepto)' }); return; }

  const creado = await prisma.echeq.create({
    data: {
      empresa_id:           empresaId,
      evento_id:            d.evento_id ?? null,
      proveedor_id:         d.proveedor_id ?? null,
      sgr_id:               d.tipo === 'PAGO' ? null : (d.sgr_id ?? null),
      numero:               d.numero,
      razon_social:         razonSocial,
      detalle:              d.detalle ?? null,
      importe:              d.importe,
      moneda:               d.moneda as Moneda,
      tasa_cambio:          d.tasa_cambio ?? null,
      monto_ars:            convertirARS(d.importe, d.moneda as Moneda, d.tasa_cambio ?? null),
      banco:                normalizarBanco(d.banco),
      formato:              d.formato,
      tipo:                 d.tipo,
      fecha_emision:        f.fe,
      fecha_cobro_estimada: f.fc,
      created_by:           req.user!.id,
      updated_by:           req.user!.id,
    },
    include,
  });

  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId, accion: 'CREATE', entidad: 'Echeq', entidadId: creado.id,
    eventoId: creado.evento_id ?? undefined,
    descripcion: `Cargó cheque ${creado.numero} (${creado.banco ?? 'sin banco'}) por ${d.importe} ${d.moneda} — ${razonSocial}`,
    datosDespues: { numero: creado.numero, banco: creado.banco, tipo: creado.tipo, importe: d.importe },
    ip: req.ip, tx: prisma as any,
  });
  res.status(201).json(mapCheque(creado));
}

export async function updateCheque(req: Request, res: Response) {
  const id = Number(req.params.id);
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return; }
  const d = parsed.data;
  const empresaId = req.empresaId!;

  const existing = await prisma.echeq.findFirst({ where: { id, deleted_at: null, ...withTenant(empresaId) } });
  if (!existing) { res.status(404).json({ error: 'Cheque no encontrado' }); return; }
  // Los que nacieron de un movimiento o de un pago de factura quedan atados a
  // ese evento: moverlos de evento desarmaría el egreso.
  if (d.evento_id !== undefined && d.evento_id !== existing.evento_id && existing.movimiento_id) {
    res.status(400).json({ error: 'Este cheque salió de un egreso del evento: no se puede cambiar de evento' }); return;
  }
  const err = await validarRefs(empresaId, d);
  if (err) { res.status(400).json({ error: err }); return; }
  const f = fechas(d);
  if (!f) { res.status(400).json({ error: 'Fecha inválida' }); return; }

  const importe = d.importe ?? Number(existing.importe);
  const moneda  = (d.moneda ?? existing.moneda) as Moneda;
  const tasa    = d.tasa_cambio !== undefined ? d.tasa_cambio : (existing.tasa_cambio !== null ? Number(existing.tasa_cambio) : null);
  const tipo    = d.tipo ?? existing.tipo;

  const updated = await prisma.echeq.update({
    where: { id },
    data: {
      ...(d.evento_id    !== undefined && { evento_id: d.evento_id }),
      ...(d.proveedor_id !== undefined && { proveedor_id: d.proveedor_id }),
      ...(d.numero       !== undefined && { numero: d.numero }),
      ...(d.razon_social !== undefined && d.razon_social !== null && { razon_social: d.razon_social }),
      ...(d.detalle      !== undefined && { detalle: d.detalle }),
      ...(d.importe      !== undefined && { importe: d.importe }),
      ...(d.moneda       !== undefined && { moneda }),
      ...(d.tasa_cambio  !== undefined && { tasa_cambio: d.tasa_cambio }),
      ...((d.importe !== undefined || d.moneda !== undefined || d.tasa_cambio !== undefined) && { monto_ars: convertirARS(importe, moneda, tasa) }),
      ...(d.banco        !== undefined && { banco: normalizarBanco(d.banco) }),
      ...(d.formato      !== undefined && { formato: d.formato }),
      ...(d.tipo         !== undefined && { tipo: d.tipo }),
      ...(tipo === 'PAGO' ? { sgr_id: null } : d.sgr_id !== undefined ? { sgr_id: d.sgr_id } : {}),
      ...(d.fecha_emision        !== undefined && { fecha_emision: f.fe }),
      ...(d.fecha_cobro_estimada !== undefined && { fecha_cobro_estimada: f.fc }),
      updated_by: req.user!.id,
    },
    include,
  });

  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId, accion: 'UPDATE', entidad: 'Echeq', entidadId: id,
    eventoId: updated.evento_id ?? undefined,
    descripcion: `Actualizó cheque ${existing.numero}`,
    datosAntes: { numero: existing.numero, banco: existing.banco, tipo: existing.tipo, importe: Number(existing.importe), fecha_cobro_estimada: existing.fecha_cobro_estimada },
    datosDespues: d, ip: req.ip, tx: prisma as any,
  });
  res.json(mapCheque(updated));
}

// ── Debitado (lo que en la planilla es "PAGADO" + fecha de entrada) ─────────
// No toca ninguna caja: el egreso ya quedó asentado cuando se emitió el cheque
// (pago de factura o gasto del evento). Para el cobro con asiento en la caja
// del evento sigue estando "Cobrar" en la pestaña del evento.

const debitarSchema = z.object({ fecha: z.string().nullable().optional() });

export async function debitarCheque(req: Request, res: Response) {
  const id = Number(req.params.id);
  const parsed = debitarSchema.safeParse(req.body ?? {});
  if (!parsed.success) { res.status(400).json({ error: 'Datos inválidos' }); return; }
  const fechaEntrada = parseFechaCalendario(parsed.data.fecha);
  if (fechaEntrada === undefined) { res.status(400).json({ error: 'Fecha inválida' }); return; }

  const existing = await prisma.echeq.findFirst({ where: { id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!existing) { res.status(404).json({ error: 'Cheque no encontrado' }); return; }
  if (existing.estado !== 'PENDIENTE') { res.status(400).json({ error: 'Sólo se marca como debitado un cheque pendiente' }); return; }

  const updated = await prisma.echeq.update({
    where: { id },
    data:  { estado: 'COBRADO', fecha_cobro_real: fechaEntrada ?? existing.fecha_cobro_estimada ?? hoyCalendario(), updated_by: req.user!.id },
    include,
  });
  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'UPDATE', entidad: 'Echeq', entidadId: id,
    eventoId: existing.evento_id ?? undefined,
    descripcion: `Marcó debitado el cheque ${existing.numero} (${existing.banco ?? 'sin banco'})`,
    datosAntes: { estado: existing.estado }, datosDespues: { estado: 'COBRADO', fecha_cobro_real: updated.fecha_cobro_real },
    ip: req.ip, tx: prisma as any,
  });
  res.json(mapCheque(updated));
}

// Deshacer un "debitado" o un "rechazado" marcado por error. Si el cobro
// generó un asiento en la caja del evento, se deshace desde esa caja.
export async function reabrirCheque(req: Request, res: Response) {
  const id = Number(req.params.id);
  const existing = await prisma.echeq.findFirst({ where: { id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!existing) { res.status(404).json({ error: 'Cheque no encontrado' }); return; }
  if (existing.estado !== 'COBRADO' && existing.estado !== 'RECHAZADO') {
    res.status(400).json({ error: 'Sólo se reabre un cheque debitado o rechazado' }); return;
  }
  if (existing.movimiento_caja_id) {
    res.status(400).json({ error: 'El cobro tiene un movimiento en la caja del evento: anulalo desde la caja' }); return;
  }
  const updated = await prisma.echeq.update({
    where: { id },
    data:  { estado: 'PENDIENTE', fecha_cobro_real: null, motivo_rechazo: null, updated_by: req.user!.id },
    include,
  });
  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'UPDATE', entidad: 'Echeq', entidadId: id,
    eventoId: existing.evento_id ?? undefined,
    descripcion: `Volvió a pendiente el cheque ${existing.numero}`,
    datosAntes: { estado: existing.estado, fecha_cobro_real: existing.fecha_cobro_real }, datosDespues: { estado: 'PENDIENTE' },
    ip: req.ip, tx: prisma as any,
  });
  res.json(mapCheque(updated));
}

// ── Aviso de los jueves (lo usa notificaciones.controller) ───────────────────
// Jueves y viernes: los cheques pendientes que caen el viernes (o el fin de
// semana) y el total a cubrir, por banco. Mayra: "todos los jueves, que te
// alerte si hay algún cheque pendiente para el viernes".
export async function avisoChequesViernes(empresaId: number, ahora = new Date()) {
  const hoy = hoyCalendario(ahora);
  const dow = hoy.getUTCDay();
  if (dow !== 4 && dow !== 5) return null;
  const { viernes, hasta } = bloqueViernes(hoy);
  const cheques = await prisma.echeq.findMany({
    where:  { ...vivo(empresaId), estado: 'PENDIENTE', fecha_cobro_estimada: { gte: viernes, lte: hasta } },
    select: { banco: true, tipo: true, importe: true, monto_ars: true },
  });
  if (!cheques.length) return null;
  const porBanco = new Map<string, number>();
  for (const c of cheques) porBanco.set(c.banco ?? SIN_BANCO, (porBanco.get(c.banco ?? SIN_BANCO) ?? 0) + importeArs(c));
  return {
    viernes,
    cantidad: cheques.length,
    avalados: cheques.filter(c => c.tipo === 'FINANCIAMIENTO_AVALADO').length,
    total:    cheques.reduce((a, c) => a + importeArs(c), 0),
    porBanco: [...porBanco.entries()].sort((a, b) => b[1] - a[1]),
  };
}

// ── Importar la planilla del banco (preview → importar) ──────────────────────

export const uploadPlanillaCheques = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.originalname.toLowerCase().endsWith('.xlsx')) cb(null, true);
    else cb(new Error('Solo se aceptan archivos .xlsx'));
  },
});

export async function importarCheques(req: Request, res: Response) {
  if (!req.file) { res.status(400).json({ error: 'Se requiere un archivo .xlsx' }); return; }
  const empresaId = req.empresaId!;
  const esPreview = req.query.preview !== 'false';
  const hojas = typeof req.query.hojas === 'string' && req.query.hojas ? req.query.hojas.split(',').map(h => h.trim()) : undefined;

  const empresa = await prisma.empresa.findUnique({ where: { id: empresaId }, select: { id: true, nombre: true, nombre_corto: true } });
  if (!empresa) { res.status(400).json({ error: 'Empresa inválida' }); return; }

  let wb: XLSX.WorkBook;
  try { wb = XLSX.read(req.file.buffer, { type: 'buffer' }); }
  catch (err: any) { res.status(400).json({ error: 'Error al procesar el archivo', detail: err.message }); return; }

  const resultado = await importarChequesBanco(wb, empresa, req.user!.id, esPreview, hojas);
  if (resultado.errores.length) { res.status(400).json({ error: resultado.errores[0], ...resultado }); return; }
  if (resultado.total_cheques === 0) {
    res.status(400).json({ error: 'No se encontraron bloques "<EMPRESA> - <BANCO> - FLUJO DE CHEQUES - <MES> <AÑO>" en el archivo', ...resultado }); return;
  }
  if (!esPreview) {
    await registrarAuditoria({
      usuarioId: req.user!.id, empresaId, accion: 'IMPORT', entidad: 'Echeq',
      descripcion: `Importó planilla de cheques (${resultado.bancos.join(', ')}) — ${resultado.creados} nuevos, ${resultado.actualizados} actualizados, ${resultado.vinculados} vinculados`,
      datosDespues: { bancos: resultado.bancos, creados: resultado.creados, actualizados: resultado.actualizados, vinculados: resultado.vinculados, hojas: resultado.hojas.map(h => h.hoja), archivo: req.file.originalname },
      ip: req.ip, tx: prisma as any,
    });
  }
  res.json(resultado);
}
