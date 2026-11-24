import type { Request, Response } from 'express';
import { z } from 'zod';
import * as XLSX from 'xlsx';
import { EstadoChequeRecibido, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { registrarAuditoria } from '../lib/auditoria';
import { withTenant } from '../lib/tenant';
import { parseFechaCalendario } from '../lib/vencimientos';
import { recalcularSaldosCaja } from '../lib/recalcularSaldos';
import { hoyCalendario } from './cheques.controller';

// ── Cheques recibidos de clientes (Finanzas, punto 10) ───────────────────────
// La cartera: los cheques y echeqs con los que pagan los clientes. Entran al
// registrar el cobro de una factura emitida (quedan ligados a la factura y al
// cobro), a mano o desde la hoja RECIBIDOS de la planilla del banco.
// Mayra: "si lo pongo en custodia el día anterior a la fecha de vencimiento,
// automáticamente el otro día se me acredita" → aviso el día anterior y el día
// de pago para los que siguen en cartera. Un echeq se puede depositar hasta 30
// días después de la fecha de pago; pasado eso se muestra como vencido.
// Al acreditarse o venderse, si se elige la cuenta, el ingreso se asienta en
// Caja Global (al DEBE). El cobro de la factura no mueve caja: lo mueve el cheque.

const MS_DIA = 86400000;
const DIAS_PARA_DEPOSITAR = 30;
const EN_LA_EMPRESA: EstadoChequeRecibido[] = ['EN_CARTERA', 'EN_CUSTODIA', 'DEPOSITADO'];
const n = (d: Prisma.Decimal | null | undefined) => (d == null ? null : Number(d));
const bancoNorm = (b: string | null | undefined) =>
  b ? b.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim() || null : null;

export class ErrorCheque extends Error { constructor(public status: number, msg: string) { super(msg); } }

const INCLUDE = {
  factura_emitida: { select: { id: true, numero: true, punto_venta: true, tipo_comprobante: true, cliente_nombre: true } },
  cuenta:          { select: { id: true, nombre: true } },
  proveedor:       { select: { id: true, nombre: true } },
} satisfies Prisma.ChequeRecibidoInclude;

type ChequeConInclude = Prisma.ChequeRecibidoGetPayload<{ include: typeof INCLUDE }>;

export function mapCheque(c: ChequeConInclude, hoy = hoyCalendario()) {
  const dias = Math.round((c.fecha_pago.getTime() - hoy.getTime()) / MS_DIA);
  const enCartera = c.estado === 'EN_CARTERA';
  return {
    ...c,
    importe:        Number(c.importe),
    tasa_descuento: n(c.tasa_descuento),
    monto_neto:     n(c.monto_neto),
    dias_para_pago: dias,
    // En cartera: hay que depositarlo o ponerlo en custodia (mañana o hoy), o ya se pasó el plazo
    accion: enCartera
      ? (dias < -DIAS_PARA_DEPOSITAR ? 'VENCIDO' : dias <= 1 ? 'DEPOSITAR_YA' : dias <= 7 ? 'PROXIMO' : null)
      : null,
  };
}

// ── Alta desde el cobro de una factura (lo usa facturasEmitidas.controller) ──

export const chequeInputSchema = z.object({
  formato:       z.enum(['ECHEQ', 'FISICO']).default('ECHEQ'),
  numero:        z.string().trim().min(1, 'Falta el número del cheque'),
  banco:         z.string().nullable().optional(),
  importe:       z.number().positive('El importe del cheque tiene que ser mayor a cero'),
  fecha_pago:    z.string().min(1, 'Falta la fecha de pago del cheque'),
  fecha_emision: z.string().nullable().optional(),
  notas:         z.string().nullable().optional(),
});
export type ChequeInput = z.infer<typeof chequeInputSchema>;

export async function crearChequesDeCobro(
  tx: Prisma.TransactionClient, cheques: ChequeInput[],
  ctx: { empresaId: number; facturaId: number; cobroId: number; librador: string; libradorCuit: string | null; moneda: 'ARS' | 'USD' | 'EUR'; usuarioId: number },
) {
  for (const ch of cheques) {
    const fechaPago = parseFechaCalendario(ch.fecha_pago);
    if (!fechaPago) throw new ErrorCheque(400, `Fecha de pago inválida en el cheque ${ch.numero}`);
    const fechaEmision = parseFechaCalendario(ch.fecha_emision ?? null);
    if (fechaEmision === undefined) throw new ErrorCheque(400, `Fecha de emisión inválida en el cheque ${ch.numero}`);
    await tx.chequeRecibido.create({
      data: {
        empresa_id: ctx.empresaId, formato: ch.formato, numero: ch.numero, banco: bancoNorm(ch.banco),
        librador: ctx.librador, librador_cuit: ctx.libradorCuit, importe: ch.importe, moneda: ctx.moneda,
        fecha_pago: fechaPago, fecha_emision: fechaEmision, notas: ch.notas ?? null,
        factura_emitida_id: ctx.facturaId, cobro_id: ctx.cobroId, created_by: ctx.usuarioId, updated_by: ctx.usuarioId,
      },
    });
  }
}

// Al borrar un cobro: sus cheques se van con él, salvo que ya hayan salido de la cartera.
export async function chequesQueTraban(cobroId: number) {
  return prisma.chequeRecibido.findMany({
    where: { cobro_id: cobroId, deleted_at: null, estado: { notIn: ['EN_CARTERA', 'EN_CUSTODIA'] } },
    select: { numero: true, estado: true },
  });
}

// ── Listado y resumen ────────────────────────────────────────────────────────

export async function listChequesRecibidos(req: Request, res: Response) {
  const E = req.empresaId!;
  const vista = String(req.query.vista ?? 'cartera'); // cartera | todos
  const q = String(req.query.q ?? '').trim();
  const where: Prisma.ChequeRecibidoWhereInput = {
    deleted_at: null, ...withTenant(E),
    ...(vista === 'cartera' ? { estado: { in: EN_LA_EMPRESA } } : {}),
    ...(q ? { OR: [
      { numero: { contains: q, mode: 'insensitive' } },
      { librador: { contains: q, mode: 'insensitive' } },
      { banco: { contains: q, mode: 'insensitive' } },
    ] } : {}),
  };
  const hoy = hoyCalendario();
  const cheques = await prisma.chequeRecibido.findMany({
    where, include: INCLUDE, orderBy: vista === 'cartera' ? { fecha_pago: 'asc' } : { fecha_pago: 'desc' }, take: 1000,
  });
  const cartera = await prisma.chequeRecibido.findMany({
    where: { deleted_at: null, ...withTenant(E), estado: { in: EN_LA_EMPRESA } },
    select: { estado: true, importe: true, moneda: true, fecha_pago: true },
  });
  const ars = cartera.filter(c => c.moneda === 'ARS');
  const sum = (xs: typeof ars) => Math.round(xs.reduce((s, c) => s + Number(c.importe), 0) * 100) / 100;
  const dias = (c: { fecha_pago: Date }) => Math.round((c.fecha_pago.getTime() - hoy.getTime()) / MS_DIA);
  const enCartera = ars.filter(c => c.estado === 'EN_CARTERA');
  const resumen = {
    en_la_empresa:   { cantidad: ars.length, total: sum(ars) },
    en_cartera:      { cantidad: enCartera.length, total: sum(enCartera) },
    en_custodia:     { cantidad: ars.filter(c => c.estado === 'EN_CUSTODIA').length, total: sum(ars.filter(c => c.estado === 'EN_CUSTODIA')) },
    depositar_ya:    { cantidad: enCartera.filter(c => dias(c) <= 1 && dias(c) >= -DIAS_PARA_DEPOSITAR).length, total: sum(enCartera.filter(c => dias(c) <= 1 && dias(c) >= -DIAS_PARA_DEPOSITAR)) },
    proximos_7_dias: { cantidad: ars.filter(c => dias(c) >= 0 && dias(c) <= 7).length, total: sum(ars.filter(c => dias(c) >= 0 && dias(c) <= 7)) },
    vencidos:        { cantidad: enCartera.filter(c => dias(c) < -DIAS_PARA_DEPOSITAR).length },
  };
  res.json({ cheques: cheques.map(c => mapCheque(c, hoy)), resumen });
}

// ── Alta / edición manual ────────────────────────────────────────────────────

const chequeSchema = chequeInputSchema.extend({
  librador:           z.string().trim().min(1, 'Poné quién lo dio'),
  librador_cuit:      z.string().nullable().optional(),
  moneda:             z.enum(['ARS', 'USD']).default('ARS'),
  factura_emitida_id: z.number().int().nullable().optional(),
});

async function validarFactura(id: number | null | undefined, empresaId: number) {
  if (!id) return true;
  return !!(await prisma.facturaEmitida.findFirst({ where: { id, deleted_at: null, empresa_id: empresaId } }));
}

export async function createChequeRecibido(req: Request, res: Response) {
  const p = chequeSchema.safeParse(req.body);
  if (!p.success) { res.status(400).json({ error: p.error.issues[0]?.message ?? 'Datos inválidos' }); return; }
  const fechaPago = parseFechaCalendario(p.data.fecha_pago);
  const fechaEmision = parseFechaCalendario(p.data.fecha_emision ?? null);
  if (!fechaPago || fechaEmision === undefined) { res.status(400).json({ error: 'Fecha inválida' }); return; }
  if (!(await validarFactura(p.data.factura_emitida_id, req.empresaId!))) { res.status(400).json({ error: 'La factura no es de esta empresa' }); return; }
  const c = await prisma.chequeRecibido.create({
    data: {
      empresa_id: req.empresaId!, formato: p.data.formato, numero: p.data.numero, banco: bancoNorm(p.data.banco),
      librador: p.data.librador, librador_cuit: p.data.librador_cuit ?? null, importe: p.data.importe, moneda: p.data.moneda,
      fecha_pago: fechaPago, fecha_emision: fechaEmision, notas: p.data.notas ?? null,
      factura_emitida_id: p.data.factura_emitida_id ?? null, created_by: req.user!.id, updated_by: req.user!.id,
    },
    include: INCLUDE,
  });
  await registrarAuditoria({ usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'CREATE', entidad: 'ChequeRecibido', entidadId: c.id, descripcion: `Cargó el cheque recibido ${c.numero} de ${c.librador} por $${Number(c.importe)}`, ip: req.ip, tx: prisma as any });
  res.status(201).json(mapCheque(c));
}

export async function updateChequeRecibido(req: Request, res: Response) {
  const id = Number(req.params.id);
  const actual = await prisma.chequeRecibido.findFirst({ where: { id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!actual) { res.status(404).json({ error: 'Cheque no encontrado' }); return; }
  const p = chequeSchema.partial().safeParse(req.body);
  if (!p.success) { res.status(400).json({ error: p.error.issues[0]?.message ?? 'Datos inválidos' }); return; }
  // Del cobro de la factura: el importe y el librador salen del cobro
  if (actual.cobro_id && (p.data.importe !== undefined && p.data.importe !== Number(actual.importe))) {
    res.status(400).json({ error: 'El importe de un cheque que entró con el cobro de una factura se corrige en el cobro' }); return;
  }
  const data: Prisma.ChequeRecibidoUpdateInput = { updated_by: req.user!.id };
  if (p.data.formato) data.formato = p.data.formato;
  if (p.data.numero) data.numero = p.data.numero;
  if (p.data.banco !== undefined) data.banco = bancoNorm(p.data.banco);
  if (p.data.librador && !actual.cobro_id) data.librador = p.data.librador;
  if (p.data.librador_cuit !== undefined && !actual.cobro_id) data.librador_cuit = p.data.librador_cuit;
  if (p.data.importe !== undefined) data.importe = p.data.importe;
  if (p.data.notas !== undefined) data.notas = p.data.notas;
  if (p.data.fecha_pago) { const f = parseFechaCalendario(p.data.fecha_pago); if (!f) { res.status(400).json({ error: 'Fecha de pago inválida' }); return; } data.fecha_pago = f; }
  if (p.data.fecha_emision !== undefined) { const f = parseFechaCalendario(p.data.fecha_emision); if (f === undefined) { res.status(400).json({ error: 'Fecha de emisión inválida' }); return; } data.fecha_emision = f; }
  if (p.data.factura_emitida_id !== undefined && !actual.cobro_id) {
    if (!(await validarFactura(p.data.factura_emitida_id, req.empresaId!))) { res.status(400).json({ error: 'La factura no es de esta empresa' }); return; }
    data.factura_emitida = p.data.factura_emitida_id ? { connect: { id: p.data.factura_emitida_id } } : { disconnect: true };
  }
  const c = await prisma.chequeRecibido.update({ where: { id }, data, include: INCLUDE });
  await registrarAuditoria({ usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'UPDATE', entidad: 'ChequeRecibido', entidadId: id, descripcion: `Modificó el cheque recibido ${c.numero}`, datosAntes: actual, datosDespues: p.data, ip: req.ip, tx: prisma as any });
  res.json(mapCheque(c));
}

export async function deleteChequeRecibido(req: Request, res: Response) {
  const id = Number(req.params.id);
  const actual = await prisma.chequeRecibido.findFirst({ where: { id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!actual) { res.status(404).json({ error: 'Cheque no encontrado' }); return; }
  if (actual.cobro_id) { res.status(409).json({ error: 'Entró con el cobro de una factura: para sacarlo, eliminá ese cobro en Facturas a Cobrar' }); return; }
  if (actual.movimiento_caja_id) { res.status(409).json({ error: 'Está asentado en la caja: volvelo a "en cartera" antes de eliminarlo' }); return; }
  await prisma.chequeRecibido.update({ where: { id }, data: { deleted_at: new Date(), updated_by: req.user!.id } });
  await registrarAuditoria({ usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'DELETE', entidad: 'ChequeRecibido', entidadId: id, descripcion: `Eliminó el cheque recibido ${actual.numero} de ${actual.librador}`, ip: req.ip, tx: prisma as any });
  res.json({ ok: true });
}

// ── Cambiar el estado ────────────────────────────────────────────────────────
// POST /api/cheques-recibidos/:id/estado

const estadoSchema = z.object({
  estado:          z.nativeEnum(EstadoChequeRecibido),
  fecha:           z.string().nullable().optional(),
  cuenta_id:       z.number().int().nullable().optional(),
  asentar_en_caja: z.boolean().optional(),
  banco_descuento: z.string().nullable().optional(),
  tasa_descuento:  z.number().min(0).max(100).nullable().optional(),
  monto_neto:      z.number().positive().nullable().optional(),
  endosado_a:      z.string().trim().nullable().optional(),
  proveedor_id:    z.number().int().nullable().optional(),
  motivo_rechazo:  z.string().trim().nullable().optional(),
});

export async function cambiarEstadoCheque(id: number, input: z.infer<typeof estadoSchema>, empresaId: number, usuarioId: number, ip?: string) {
  const ch = await prisma.chequeRecibido.findFirst({ where: { id, deleted_at: null, empresa_id: empresaId }, include: { movimiento_caja: { select: { id: true, cuenta_id: true, deleted_at: true } } } });
  if (!ch) throw new ErrorCheque(404, 'Cheque no encontrado');
  const fecha = parseFechaCalendario(input.fecha ?? null);
  if (fecha === undefined) throw new ErrorCheque(400, 'Fecha inválida');
  const e = input.estado;

  // Cuenta donde se deposita: para custodia/depósito es informativa; al acreditar o vender, se puede asentar.
  let cuenta: { id: number; nombre: string } | null = null;
  if (input.cuenta_id) {
    const c = await prisma.cuentaBancaria.findFirst({ where: { id: input.cuenta_id, deleted_at: null, empresa_id: empresaId }, select: { id: true, nombre: true, moneda: true } });
    if (!c) throw new ErrorCheque(400, 'La cuenta no es de esta empresa');
    if (c.moneda !== ch.moneda) throw new ErrorCheque(400, `La cuenta "${c.nombre}" es en ${c.moneda} y el cheque en ${ch.moneda}`);
    cuenta = c;
  }
  const asentar = (e === 'ACREDITADO' || e === 'VENDIDO') && (input.asentar_en_caja ?? !!cuenta);
  if (asentar && !cuenta) throw new ErrorCheque(400, 'Elegí la cuenta donde entró la plata');
  if (e === 'ENDOSADO' && !input.endosado_a && !input.proveedor_id) throw new ErrorCheque(400, 'Poné a quién se le entregó');
  let proveedorNombre: string | null = null;
  if (e === 'ENDOSADO' && input.proveedor_id) {
    const p = await prisma.proveedor.findFirst({ where: { id: input.proveedor_id, deleted_at: null, empresa_id: empresaId }, select: { nombre: true } });
    if (!p) throw new ErrorCheque(400, 'El proveedor no es de esta empresa');
    proveedorNombre = p.nombre;
  }
  const montoNeto = e === 'VENDIDO' ? (input.monto_neto ?? Number(ch.importe)) : null;
  if (montoNeto != null && montoNeto > Number(ch.importe) + 0.01) throw new ErrorCheque(400, 'Lo que entró por la venta no puede ser más que el importe del cheque');
  const montoCaja = e === 'VENDIDO' ? montoNeto! : Number(ch.importe);
  const fechaEstado = e === 'EN_CARTERA' ? null : (fecha ?? hoyCalendario());

  return prisma.$transaction(async tx => {
    const movPrevio = ch.movimiento_caja && !ch.movimiento_caja.deleted_at ? ch.movimiento_caja : null;
    let movId: number | null = movPrevio?.id ?? null;
    const recalcular = new Set<number>();
    const desc = e === 'VENDIDO'
      ? `Venta del ${ch.formato === 'ECHEQ' ? 'echeq' : 'cheque'} ${ch.numero} de ${ch.librador}`
      : `${ch.formato === 'ECHEQ' ? 'Echeq' : 'Cheque'} ${ch.numero} de ${ch.librador} acreditado`;
    if (movPrevio && (!asentar || movPrevio.cuenta_id !== cuenta!.id)) {
      await tx.movimientoCaja.update({ where: { id: movPrevio.id }, data: { deleted_at: new Date(), updated_by: usuarioId } });
      recalcular.add(movPrevio.cuenta_id);
      movId = null;
    }
    if (asentar) {
      if (movId) {
        await tx.movimientoCaja.update({ where: { id: movId }, data: { fecha: fechaEstado, debe: montoCaja, haber: 0, descripcion: desc, updated_by: usuarioId } });
      } else {
        const last = await tx.movimientoCaja.findFirst({ where: { cuenta_id: cuenta!.id, deleted_at: null }, orderBy: { orden: 'desc' }, select: { orden: true } });
        const mov = await tx.movimientoCaja.create({
          data: { cuenta_id: cuenta!.id, fecha: fechaEstado, descripcion: desc, debe: montoCaja, haber: 0, orden: (last?.orden ?? 0) + 1, created_by: usuarioId, updated_by: usuarioId },
        });
        movId = mov.id;
      }
      recalcular.add(cuenta!.id);
    }
    const data: Prisma.ChequeRecibidoUncheckedUpdateInput = {
      estado: e, fecha_estado: fechaEstado, movimiento_caja_id: movId, updated_by: usuarioId,
      cuenta_id: ['EN_CUSTODIA', 'DEPOSITADO', 'ACREDITADO', 'VENDIDO'].includes(e) ? (cuenta?.id ?? ch.cuenta_id) : null,
      banco_descuento: e === 'VENDIDO' ? bancoNorm(input.banco_descuento) : null,
      tasa_descuento:  e === 'VENDIDO' ? (input.tasa_descuento ?? null) : null,
      monto_neto:      montoNeto,
      endosado_a:      e === 'ENDOSADO' ? (input.endosado_a || proveedorNombre) : null,
      proveedor_id:    e === 'ENDOSADO' ? (input.proveedor_id ?? null) : null,
      motivo_rechazo:  e === 'RECHAZADO' ? (input.motivo_rechazo || null) : null,
    };
    const c = await tx.chequeRecibido.update({ where: { id }, data, include: INCLUDE });
    for (const cid of recalcular) await recalcularSaldosCaja(cid, tx);
    await registrarAuditoria({
      usuarioId, empresaId, accion: 'UPDATE', entidad: 'ChequeRecibido', entidadId: id,
      descripcion: `Cheque recibido ${ch.numero} de ${ch.librador}: ${ch.estado} → ${e}${asentar ? ` (asentado en ${cuenta!.nombre})` : ''}`,
      datosAntes: { estado: ch.estado }, datosDespues: data, ip, tx: tx as any,
    });
    // Rechazado: la factura sigue cobrada hasta que se corrija el cobro
    const aviso = e === 'RECHAZADO' && ch.cobro_id
      ? 'La factura sigue figurando cobrada: eliminá ese cobro en Facturas a Cobrar (o registrá el nuevo pago) para que vuelva a quedar pendiente.'
      : null;
    return { cheque: mapCheque(c), aviso };
  });
}

export async function postEstadoCheque(req: Request, res: Response) {
  const p = estadoSchema.safeParse(req.body);
  if (!p.success) { res.status(400).json({ error: p.error.issues[0]?.message ?? 'Datos inválidos' }); return; }
  try {
    res.json(await cambiarEstadoCheque(Number(req.params.id), p.data, req.empresaId!, req.user!.id, req.ip));
  } catch (e) {
    if (e instanceof ErrorCheque) { res.status(e.status).json({ error: e.message }); return; }
    throw e;
  }
}

// ── Aviso para la campanita ──────────────────────────────────────────────────
// Los que siguen en cartera y se pagan mañana (o ya se pueden cobrar y no se
// depositaron): hay que depositarlos o ponerlos en custodia.
export async function avisoChequesRecibidos(empresaId: number, ahora = new Date()) {
  const hoy = hoyCalendario(ahora);
  const manana = new Date(hoy.getTime() + MS_DIA);
  const desde = new Date(hoy.getTime() - DIAS_PARA_DEPOSITAR * MS_DIA);
  const cheques = await prisma.chequeRecibido.findMany({
    where: { empresa_id: empresaId, deleted_at: null, estado: 'EN_CARTERA', fecha_pago: { gte: desde, lte: manana } },
    select: { id: true, numero: true, librador: true, importe: true, moneda: true, fecha_pago: true },
    orderBy: { fecha_pago: 'asc' },
  });
  if (!cheques.length) return null;
  return {
    cantidad: cheques.length,
    total:    cheques.filter(c => c.moneda === 'ARS').reduce((s, c) => s + Number(c.importe), 0),
    manana:   cheques.filter(c => c.fecha_pago.getTime() === manana.getTime()).length,
    atrasados: cheques.filter(c => c.fecha_pago < hoy).length,
    cheques,
  };
}

// ── Importar la hoja RECIBIDOS de la planilla del banco ──────────────────────
// docs/dos57/mayra/BANCOS/Cheques Pendientes - GALICIA - DOS57.xlsx, hojas
// "RECIBIDOS 2022" / "RECIBIDOS 2023": Tipo | Número | Recibido de | Pago |
// Emisión | Importe | Estado. Estado: Pagado → acreditado, Disponible → en
// cartera, Vendido, Depósito en proceso → depositado; un nombre ("Fede
// Cragnolini") → endosado a esa persona.

function serialAFecha(v: unknown): Date | null {
  if (typeof v === 'number' && v > 20000 && v < 80000) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * MS_DIA);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }
  if (typeof v === 'string') {
    const m = v.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (m) return new Date(Date.UTC(Number(m[3].length === 2 ? '20' + m[3] : m[3]), Number(m[2]) - 1, Number(m[1])));
  }
  return null;
}
function estadoDePlanilla(raw: unknown): { estado: EstadoChequeRecibido; endosado_a: string | null } {
  const s = String(raw ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();
  if (!s || s === 'DISPONIBLE') return { estado: 'EN_CARTERA', endosado_a: null };
  if (s.startsWith('PAGADO') || s.startsWith('ACREDITADO') || s.startsWith('COBRADO')) return { estado: 'ACREDITADO', endosado_a: null };
  if (s.startsWith('VENDIDO')) return { estado: 'VENDIDO', endosado_a: null };
  if (s.startsWith('DEPOSITO')) return { estado: 'DEPOSITADO', endosado_a: null };
  if (s.startsWith('CUSTODIA') || s.startsWith('EN CUSTODIA')) return { estado: 'EN_CUSTODIA', endosado_a: null };
  if (s.startsWith('RECHAZ')) return { estado: 'RECHAZADO', endosado_a: null };
  return { estado: 'ENDOSADO', endosado_a: String(raw).trim() };
}

export function leerRecibidos(buffer: Buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: false });
  const filas: { hoja: string; key: string; formato: 'ECHEQ' | 'FISICO'; numero: string; librador: string; fecha_pago: Date; fecha_emision: Date | null; importe: number; estado: EstadoChequeRecibido; endosado_a: string | null }[] = [];
  const hojas: string[] = [];
  for (const nombre of wb.SheetNames.filter(h => /^\s*recibidos/i.test(h))) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[nombre], { header: 1, raw: true, defval: null });
    const hi = rows.findIndex(r => String(r[0] ?? '').trim().toUpperCase() === 'TIPO' && /RECIBIDO/i.test(String(r[2] ?? '')));
    if (hi < 0) continue;
    hojas.push(nombre.trim());
    const ocurr = new Map<string, number>();
    for (const r of rows.slice(hi + 1)) {
      const tipo = String(r[0] ?? '').toUpperCase();
      const numero = String(r[1] ?? '').trim();
      const fechaPago = serialAFecha(r[3]);
      const importe = typeof r[5] === 'number' ? Math.round(r[5] * 100) / 100 : null;
      if (!numero || !fechaPago || !importe) continue;
      const base = `REC|${numero}|${fechaPago.toISOString().slice(0, 10)}|${importe}`;
      const k = (ocurr.get(base) ?? 0) + 1;
      ocurr.set(base, k);
      const { estado, endosado_a } = estadoDePlanilla(r[6]);
      filas.push({
        hoja: nombre.trim(), key: `${base}|${k}`, formato: /FISICO|FÍSICO/.test(tipo) ? 'FISICO' : 'ECHEQ', numero,
        librador: String(r[2] ?? '').trim() || 'Sin dato', fecha_pago: fechaPago, fecha_emision: serialAFecha(r[4]), importe, estado, endosado_a,
      });
    }
  }
  return { filas, hojas };
}

export async function importarChequesRecibidos(req: Request, res: Response) {
  if (!req.file) { res.status(400).json({ error: 'Se requiere un archivo .xlsx' }); return; }
  const aplicar = req.query.preview === 'false';
  const E = req.empresaId!;
  const { filas, hojas } = leerRecibidos(req.file.buffer);
  if (!filas.length) { res.status(400).json({ error: 'No encontré hojas "RECIBIDOS" con las columnas Tipo | Número | Recibido de | Pago | Emisión | Importe | Estado' }); return; }
  const existentes = new Set((await prisma.chequeRecibido.findMany({ where: { empresa_id: E, import_key: { in: filas.map(f => f.key) } }, select: { import_key: true } })).map(c => c.import_key));
  const nuevos = filas.filter(f => !existentes.has(f.key));
  const porEstado: Record<string, number> = {};
  for (const f of nuevos) porEstado[f.estado] = (porEstado[f.estado] ?? 0) + 1;
  const resultado = {
    hojas, total: filas.length, nuevos: nuevos.length, ya_estaban: filas.length - nuevos.length, por_estado: porEstado,
    muestra: nuevos.slice(0, 8).map(f => ({ numero: f.numero, librador: f.librador, fecha_pago: f.fecha_pago, importe: f.importe, estado: f.estado })),
    aplicado: false,
  };
  if (!aplicar || !nuevos.length) { res.json({ ...resultado, aplicado: aplicar }); return; }
  await prisma.$transaction(async tx => {
    for (const f of nuevos) {
      await tx.chequeRecibido.create({
        data: {
          empresa_id: E, formato: f.formato, numero: f.numero, librador: f.librador, importe: f.importe, fecha_pago: f.fecha_pago,
          fecha_emision: f.fecha_emision, estado: f.estado, endosado_a: f.endosado_a,
          // La planilla no dice cuándo cambió de estado: se toma la fecha de pago
          fecha_estado: f.estado === 'EN_CARTERA' ? null : f.fecha_pago,
          notas: `Importado de la hoja ${f.hoja}`, import_key: f.key, created_by: req.user!.id, updated_by: req.user!.id,
        },
      });
    }
    await registrarAuditoria({ usuarioId: req.user!.id, empresaId: E, accion: 'IMPORT', entidad: 'ChequeRecibido', descripcion: `Importó ${nuevos.length} cheques recibidos (${hojas.join(', ')})`, ip: req.ip, tx: tx as any });
  }, { timeout: 60000 });
  res.json({ ...resultado, aplicado: true });
}
