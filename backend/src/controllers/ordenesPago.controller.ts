import type { Request, Response } from 'express';
import { z } from 'zod';
import { EstadoOrdenPago, MedioPago, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { registrarAuditoria } from '../lib/auditoria';
import { withTenant } from '../lib/tenant';
import { parseFechaCalendario } from '../lib/vencimientos';
import { EMPRESAS } from '../lib/empresasConstants';
import { renderRemitoPDF } from '../lib/pdfExporter';
import { templateOrdenPago } from '../lib/pdfTemplates/ordenPago';
import { CUIT_DOS57_FALLBACK } from './remitos.controller';
import { crearPagoFacturaTx } from './facturas.controller';
import { puedeRevisarPagos } from './resumenPagos.controller';

// ── Órdenes de pago a proveedores ────────────────────────────────────────────
// Hoja "ORDEN DE PAGO" de Mayra: facturas del proveedor que se pagan juntas, el
// medio de cada parte (echeq con número, transferencia…), totales, y quién la
// elaboró, revisó y autorizó. Flujo:
//   BORRADOR (se arma) → REVISADA (los totales cierran) → AUTORIZADA (Matías o
//   quien tenga el permiso de aprobar pagos) → PAGADA (genera los pagos de cada
//   factura y los echeqs). ANULADA en cualquier momento antes de pagar.
// Al pagar, los medios se reparten entre las facturas en orden: un echeq que
// cubre dos facturas genera un pago en cada una y un solo echeq.

export const formatearNumeroOP = (n: number) => `OP ${String(n).padStart(6, '0')}`;
const round2 = (n: number) => Math.round(n * 100) / 100;
const TOLERANCIA = 1; // $1 de diferencia por redondeos
const ABIERTAS: EstadoOrdenPago[] = ['BORRADOR', 'REVISADA', 'AUTORIZADA'];

const MEDIO_LABEL: Record<MedioPago, string> = { ECHEQ: 'Echeq', TRANSFERENCIA: 'Transferencia', EFECTIVO: 'Efectivo', CHEQUE: 'Cheque' };

const ordenSchema = z.object({
  fecha:        z.string().min(1),
  proveedor_id: z.number().int(),
  concepto:     z.string().nullable().optional(),
  notas:        z.string().nullable().optional(),
  facturas: z.array(z.object({
    factura_id: z.number().int(),
    importe:    z.number().positive('El importe a pagar de cada factura tiene que ser mayor a cero'),
  })).min(1, 'Agregá al menos una factura'),
  medios: z.array(z.object({
    medio_pago: z.enum(['TRANSFERENCIA', 'ECHEQ', 'EFECTIVO', 'CHEQUE']),
    numero:     z.string().nullable().optional(),
    banco:      z.string().nullable().optional(),
    fecha_pago: z.string().min(1),
    importe:    z.number().positive('El importe de cada pago tiene que ser mayor a cero'),
  })).default([]),
});
type OrdenInput = z.infer<typeof ordenSchema>;

const facturaSelect = {
  id: true, numero_factura: true, tipo_factura: true, fecha_emision: true, importe_total: true, importe_pendiente: true,
  estado: true, moneda: true, proveedor_id: true, empresa_id: true, deleted_at: true,
  evento: { select: { id: true, nombre: true } },
} satisfies Prisma.FacturaSelect;

async function cargarOrden(id: number, empresaId: number) {
  return prisma.ordenPago.findFirst({
    where: { id, empresa_id: empresaId, deleted_at: null },
    include: {
      proveedor: { select: { id: true, nombre: true, cuit: true, cbu: true, alias_bancario: true, banco: true } },
      facturas:  { orderBy: { orden_item: 'asc' }, include: { factura: { select: facturaSelect } } },
      medios:    { orderBy: { orden_item: 'asc' } },
      pagos:     { where: { deleted_at: null }, select: { id: true, factura_id: true, importe: true, medio_pago: true, referencia: true, echeq_id: true, fecha_pago: true } },
    },
  });
}
type OrdenCargada = NonNullable<Awaited<ReturnType<typeof cargarOrden>>>;

async function nombresUsuarios(ids: (number | null)[]) {
  const validos = [...new Set(ids.filter((x): x is number => x != null))];
  const us = validos.length ? await prisma.usuario.findMany({ where: { id: { in: validos } }, select: { id: true, nombre: true } }) : [];
  return new Map(us.map(u => [u.id, u.nombre]));
}

async function mapOrden(o: OrdenCargada, usuarioId?: number) {
  const nombres = await nombresUsuarios([o.elaborado_por ?? o.created_by, o.revisado_por, o.autorizado_por]);
  const total_facturas = Number(o.total_facturas), total_pagos = Number(o.total_pagos);
  return {
    ...o,
    numero_formateado: formatearNumeroOP(o.numero),
    total_facturas, total_pagos,
    diferencia: round2(total_facturas - total_pagos),
    cierra: Math.abs(total_facturas - total_pagos) <= TOLERANCIA,
    elaborado_nombre:  nombres.get(o.elaborado_por ?? o.created_by ?? -1) ?? null,
    revisado_nombre:   o.revisado_por ? nombres.get(o.revisado_por) ?? null : null,
    autorizado_nombre: o.autorizado_por ? nombres.get(o.autorizado_por) ?? null : null,
    puede_autorizar:   usuarioId ? await puedeRevisarPagos(usuarioId) : false,
    facturas: o.facturas.map(f => ({
      id: f.id, orden_item: f.orden_item, factura_id: f.factura_id, importe: Number(f.importe),
      factura: { ...f.factura, importe_total: Number(f.factura.importe_total), importe_pendiente: Number(f.factura.importe_pendiente) },
    })),
    medios: o.medios.map(m => ({ ...m, importe: Number(m.importe) })),
    pagos:  o.pagos.map(p => ({ ...p, importe: Number(p.importe) })),
  };
}

// Valida facturas (empresa, proveedor, pendiente, otra orden abierta) y medios.
async function validar(empresaId: number, d: OrdenInput, ordenId: number | null) {
  const prov = await prisma.proveedor.findFirst({ where: { id: d.proveedor_id, deleted_at: null }, select: { id: true } });
  if (!prov) return { error: 'Proveedor no encontrado' };
  const ids = d.facturas.map(f => f.factura_id);
  if (new Set(ids).size !== ids.length) return { error: 'Hay una factura repetida en la orden' };
  const facturas = await prisma.factura.findMany({ where: { id: { in: ids }, empresa_id: empresaId, deleted_at: null }, select: facturaSelect });
  if (facturas.length !== ids.length) return { error: 'Alguna de las facturas no existe en esta empresa' };
  for (const f of facturas) {
    const etiqueta = `${f.tipo_factura} ${f.numero_factura}`;
    if (f.proveedor_id !== d.proveedor_id) return { error: `La factura ${etiqueta} es de otro proveedor` };
    if (f.estado === 'ANULADA' || f.estado === 'PAGADA') return { error: `La factura ${etiqueta} está ${f.estado === 'PAGADA' ? 'pagada' : 'anulada'}` };
    const imp = d.facturas.find(x => x.factura_id === f.id)!.importe;
    if (imp > Number(f.importe_pendiente) + 0.01) return { error: `La factura ${etiqueta} tiene pendientes ${Number(f.importe_pendiente)}; no se le pueden pagar ${imp}` };
  }
  const monedas = new Set(facturas.map(f => f.moneda));
  if (monedas.size > 1) return { error: 'Las facturas de una orden de pago tienen que estar en la misma moneda' };
  const enOtra = await prisma.ordenPagoFactura.findFirst({
    where: { factura_id: { in: ids }, orden_pago: { deleted_at: null, estado: { in: ABIERTAS }, ...(ordenId ? { id: { not: ordenId } } : {}) } },
    include: { orden_pago: { select: { numero: true } }, factura: { select: { tipo_factura: true, numero_factura: true } } },
  });
  if (enOtra) return { error: `La factura ${enOtra.factura.tipo_factura} ${enOtra.factura.numero_factura} ya está en la ${formatearNumeroOP(enOtra.orden_pago.numero)}, que sigue abierta` };
  const medios = [];
  for (const [i, m] of d.medios.entries()) {
    const fecha = parseFechaCalendario(m.fecha_pago);
    if (!fecha) return { error: `Fecha de pago inválida en el pago ${i + 1}` };
    if ((m.medio_pago === 'ECHEQ' || m.medio_pago === 'CHEQUE') && !m.numero?.trim()) return { error: `Falta el número del ${MEDIO_LABEL[m.medio_pago].toLowerCase()} en el pago ${i + 1}` };
    medios.push({ orden_item: i + 1, medio_pago: m.medio_pago as MedioPago, numero: m.numero?.trim() || null, banco: m.banco?.trim().toUpperCase() || null, fecha_pago: fecha, importe: round2(m.importe) });
  }
  const filas = d.facturas.map((f, i) => ({ orden_item: i + 1, factura_id: f.factura_id, importe: round2(f.importe) }));
  return {
    moneda: [...monedas][0],
    filas, medios,
    total_facturas: round2(filas.reduce((s, f) => s + f.importe, 0)),
    total_pagos:    round2(medios.reduce((s, m) => s + m.importe, 0)),
  };
}

// GET /api/ordenes-pago
export async function listOrdenesPago(req: Request, res: Response) {
  const { estado, proveedor_id, q } = req.query as Record<string, string | undefined>;
  const where: Prisma.OrdenPagoWhereInput = { ...withTenant(req.empresaId!), deleted_at: null };
  if (estado && estado in EstadoOrdenPago) where.estado = estado as EstadoOrdenPago;
  if (proveedor_id) where.proveedor_id = Number(proveedor_id);
  if (q?.trim()) {
    const t = q.trim();
    const n = Number(t.replace(/\D/g, ''));
    where.OR = [
      { proveedor: { nombre: { contains: t, mode: 'insensitive' } } },
      { concepto: { contains: t, mode: 'insensitive' } },
      { facturas: { some: { factura: { numero_factura: { contains: t } } } } },
      { medios: { some: { numero: { contains: t } } } },
      ...(n ? [{ numero: n }] : []),
    ];
  }
  const ordenes = await prisma.ordenPago.findMany({
    where, orderBy: [{ fecha: 'desc' }, { numero: 'desc' }],
    select: {
      id: true, numero: true, fecha: true, estado: true, moneda: true, concepto: true, total_facturas: true, total_pagos: true,
      proveedor: { select: { id: true, nombre: true } },
      _count: { select: { facturas: true, medios: true } },
      medios: { select: { medio_pago: true } },
    },
  });
  res.json(ordenes.map(o => ({
    ...o, numero_formateado: formatearNumeroOP(o.numero),
    total_facturas: Number(o.total_facturas), total_pagos: Number(o.total_pagos),
    cant_facturas: o._count.facturas, cant_medios: o._count.medios,
    medios: [...new Set(o.medios.map(m => MEDIO_LABEL[m.medio_pago]))],
  })));
}

// GET /api/ordenes-pago/:id
export async function getOrdenPago(req: Request, res: Response) {
  const o = await cargarOrden(Number(req.params.id), req.empresaId!);
  if (!o) { res.status(404).json({ error: 'Orden de pago no encontrada' }); return; }
  res.json(await mapOrden(o, req.user!.id));
}

// GET /api/ordenes-pago/facturas-pendientes?proveedor_id=&orden_id=
// Facturas del proveedor con saldo, que no estén en otra orden abierta.
export async function facturasPendientesProveedor(req: Request, res: Response) {
  const proveedorId = Number(req.query.proveedor_id);
  const ordenId = req.query.orden_id ? Number(req.query.orden_id) : null;
  if (!proveedorId) { res.status(400).json({ error: 'Falta el proveedor' }); return; }
  const facturas = await prisma.factura.findMany({
    where: {
      ...withTenant(req.empresaId!), deleted_at: null, proveedor_id: proveedorId,
      estado: { notIn: ['ANULADA', 'PAGADA'] }, importe_pendiente: { gt: 0 },
      ordenesPago: { none: { orden_pago: { deleted_at: null, estado: { in: ABIERTAS }, ...(ordenId ? { id: { not: ordenId } } : {}) } } },
    },
    orderBy: { fecha_emision: 'asc' },
    select: facturaSelect,
  });
  res.json(facturas.map(f => ({ ...f, importe_total: Number(f.importe_total), importe_pendiente: Number(f.importe_pendiente) })));
}

// POST /api/ordenes-pago
export async function createOrdenPago(req: Request, res: Response) {
  const parsed = ordenSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }); return; }
  const d = parsed.data;
  const fecha = parseFechaCalendario(d.fecha);
  if (!fecha) { res.status(400).json({ error: 'Fecha inválida' }); return; }
  const v = await validar(req.empresaId!, d, null);
  if ('error' in v) { res.status(400).json({ error: v.error }); return; }

  for (let intento = 0; intento < 3; intento++) {
    try {
      const orden = await prisma.$transaction(async tx => {
        const max = await tx.ordenPago.aggregate({ where: { empresa_id: req.empresaId! }, _max: { numero: true } });
        const o = await tx.ordenPago.create({
          data: {
            ...withTenant(req.empresaId!), numero: (max._max.numero ?? 0) + 1, fecha,
            proveedor_id: d.proveedor_id, concepto: d.concepto?.trim() || null, notas: d.notas?.trim() || null,
            moneda: v.moneda, total_facturas: v.total_facturas, total_pagos: v.total_pagos,
            elaborado_por: req.user!.id, created_by: req.user!.id, updated_by: req.user!.id,
            facturas: { create: v.filas }, medios: { create: v.medios },
          },
        });
        await registrarAuditoria({
          usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'CREATE', entidad: 'OrdenPago', entidadId: o.id,
          descripcion: `Creó la ${formatearNumeroOP(o.numero)} (borrador) por ${v.total_facturas}`, ip: req.ip, tx: tx as any,
        });
        return o;
      });
      res.status(201).json(await mapOrden((await cargarOrden(orden.id, req.empresaId!))!, req.user!.id));
      return;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002' && intento < 2) continue;
      throw e;
    }
  }
}

// PUT /api/ordenes-pago/:id — sólo en borrador
export async function updateOrdenPago(req: Request, res: Response) {
  const id = Number(req.params.id);
  const actual = await prisma.ordenPago.findFirst({ where: { id, empresa_id: req.empresaId!, deleted_at: null }, select: { id: true, estado: true, numero: true } });
  if (!actual) { res.status(404).json({ error: 'Orden de pago no encontrada' }); return; }
  if (actual.estado !== 'BORRADOR') { res.status(409).json({ error: 'Sólo se edita en borrador. Volvela a borrador para cambiarla.' }); return; }
  const parsed = ordenSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }); return; }
  const d = parsed.data;
  const fecha = parseFechaCalendario(d.fecha);
  if (!fecha) { res.status(400).json({ error: 'Fecha inválida' }); return; }
  const v = await validar(req.empresaId!, d, id);
  if ('error' in v) { res.status(400).json({ error: v.error }); return; }
  await prisma.$transaction(async tx => {
    await tx.ordenPagoFactura.deleteMany({ where: { orden_pago_id: id } });
    await tx.ordenPagoMedio.deleteMany({ where: { orden_pago_id: id } });
    await tx.ordenPago.update({
      where: { id },
      data: {
        fecha, proveedor_id: d.proveedor_id, concepto: d.concepto?.trim() || null, notas: d.notas?.trim() || null,
        moneda: v.moneda, total_facturas: v.total_facturas, total_pagos: v.total_pagos, updated_by: req.user!.id,
        facturas: { create: v.filas }, medios: { create: v.medios },
      },
    });
    await registrarAuditoria({
      usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'UPDATE', entidad: 'OrdenPago', entidadId: id,
      descripcion: `Editó la ${formatearNumeroOP(actual.numero)}`, ip: req.ip, tx: tx as any,
    });
  });
  res.json(await mapOrden((await cargarOrden(id, req.empresaId!))!, req.user!.id));
}

// DELETE /api/ordenes-pago/:id — sólo borrador (soft delete)
export async function deleteOrdenPago(req: Request, res: Response) {
  const id = Number(req.params.id);
  const o = await prisma.ordenPago.findFirst({ where: { id, empresa_id: req.empresaId!, deleted_at: null }, select: { estado: true, numero: true } });
  if (!o) { res.status(404).json({ error: 'Orden de pago no encontrada' }); return; }
  if (o.estado !== 'BORRADOR') { res.status(409).json({ error: 'Sólo se elimina un borrador; las demás se anulan' }); return; }
  await prisma.ordenPago.update({ where: { id }, data: { deleted_at: new Date(), updated_by: req.user!.id } });
  await registrarAuditoria({ usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'DELETE', entidad: 'OrdenPago', entidadId: id, descripcion: `Eliminó el borrador ${formatearNumeroOP(o.numero)}`, ip: req.ip, tx: prisma });
  res.json({ ok: true });
}

// POST /api/ordenes-pago/:id/:accion — revisar | autorizar | volver-borrador | anular
export async function cambiarEstadoOrdenPago(req: Request, res: Response) {
  const id = Number(req.params.id);
  const accion = req.params.accion;
  const o = await cargarOrden(id, req.empresaId!);
  if (!o) { res.status(404).json({ error: 'Orden de pago no encontrada' }); return; }
  const etiqueta = formatearNumeroOP(o.numero);
  let data: Prisma.OrdenPagoUpdateInput;
  let descripcion: string;

  if (accion === 'revisar') {
    if (o.estado !== 'BORRADOR') { res.status(409).json({ error: 'Sólo se revisa un borrador' }); return; }
    if (o.medios.length === 0) { res.status(409).json({ error: 'Cargá cómo se paga (echeqs, transferencias…) antes de revisarla' }); return; }
    if (Math.abs(Number(o.total_facturas) - Number(o.total_pagos)) > TOLERANCIA) {
      res.status(409).json({ error: `El total pagado (${Number(o.total_pagos)}) no coincide con el total a pagar (${Number(o.total_facturas)})` }); return;
    }
    data = { estado: 'REVISADA', revisado_por: req.user!.id, revisado_at: new Date() };
    descripcion = `Revisó la ${etiqueta}`;
  } else if (accion === 'autorizar') {
    if (o.estado !== 'REVISADA') { res.status(409).json({ error: 'Primero tiene que estar revisada' }); return; }
    if (!(await puedeRevisarPagos(req.user!.id))) { res.status(403).json({ error: 'Autoriza el administrador general o quien tenga el permiso de aprobar pagos' }); return; }
    data = { estado: 'AUTORIZADA', autorizado_por: req.user!.id, autorizado_at: new Date() };
    descripcion = `Autorizó la ${etiqueta}`;
  } else if (accion === 'volver-borrador') {
    if (o.estado !== 'REVISADA' && o.estado !== 'AUTORIZADA') { res.status(409).json({ error: 'Sólo vuelve a borrador una orden revisada o autorizada' }); return; }
    data = { estado: 'BORRADOR', revisado_por: null, revisado_at: null, autorizado_por: null, autorizado_at: null };
    descripcion = `Volvió a borrador la ${etiqueta}`;
  } else if (accion === 'anular') {
    if (!ABIERTAS.includes(o.estado)) { res.status(409).json({ error: o.estado === 'PAGADA' ? 'Ya está pagada: anulá los pagos desde cada factura' : 'Ya está anulada' }); return; }
    data = { estado: 'ANULADA' };
    descripcion = `Anuló la ${etiqueta}`;
  } else {
    res.status(404).json({ error: 'Acción desconocida' }); return;
  }

  await prisma.ordenPago.update({ where: { id }, data: { ...data, updated_by: req.user!.id } });
  await registrarAuditoria({ usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'UPDATE', entidad: 'OrdenPago', entidadId: id, descripcion, ip: req.ip, tx: prisma });
  res.json(await mapOrden((await cargarOrden(id, req.empresaId!))!, req.user!.id));
}

// POST /api/ordenes-pago/:id/pagar — AUTORIZADA → PAGADA
// Reparte los medios entre las facturas en orden y registra cada pago en su factura.
export async function pagarOrdenPago(req: Request, res: Response) {
  const id = Number(req.params.id);
  const o = await cargarOrden(id, req.empresaId!);
  if (!o) { res.status(404).json({ error: 'Orden de pago no encontrada' }); return; }
  if (o.estado !== 'AUTORIZADA') { res.status(409).json({ error: 'Sólo se registra el pago de una orden autorizada' }); return; }
  const etiqueta = formatearNumeroOP(o.numero);

  const facturas = await prisma.factura.findMany({
    where: { id: { in: o.facturas.map(f => f.factura_id) }, deleted_at: null },
    include: { proveedor: { select: { nombre: true } } },
  });
  const porId = new Map(facturas.map(f => [f.id, f]));
  for (const f of o.facturas) {
    const fac = porId.get(f.factura_id);
    if (!fac || fac.estado === 'ANULADA' || fac.estado === 'PAGADA' || Number(f.importe) > Number(fac.importe_pendiente) + 0.01) {
      res.status(409).json({ error: `La factura ${f.factura.tipo_factura} ${f.factura.numero_factura} cambió desde que se armó la orden (pagada, anulada o con menos pendiente). Volvé la orden a borrador y revisala.` });
      return;
    }
  }

  // Reparto: cola de facturas y de medios, de a tramos.
  const pendFact = o.facturas.map(f => ({ factura_id: f.factura_id, resto: Number(f.importe) }));
  const tramos: { factura_id: number; medio: OrdenCargada['medios'][number]; importe: number; primero: boolean }[] = [];
  let i = 0;
  for (const m of o.medios) {
    let restoMedio = Number(m.importe);
    let primero = true;
    while (restoMedio > 0.005 && i < pendFact.length) {
      const imp = round2(Math.min(restoMedio, pendFact[i].resto));
      if (imp > 0) { tramos.push({ factura_id: pendFact[i].factura_id, medio: m, importe: imp, primero }); primero = false; }
      restoMedio = round2(restoMedio - imp);
      pendFact[i].resto = round2(pendFact[i].resto - imp);
      if (pendFact[i].resto <= 0.005) i++;
    }
  }

  await prisma.$transaction(async tx => {
    for (const t of tramos) {
      const fac = porId.get(t.factura_id)!;
      const m = t.medio;
      const ref = [etiqueta, m.numero ? `n° ${m.numero}` : null, m.banco].filter(Boolean).join(' · ');
      await crearPagoFacturaTx(tx, fac, {
        fecha_pago: m.fecha_pago, importe: t.importe, medio_pago: m.medio_pago, referencia: ref,
        notas: o.concepto ? `Orden de pago: ${o.concepto}` : null,
        orden_pago_id: o.id,
        echeq: m.medio_pago === 'ECHEQ' && t.primero ? {
          numero: m.numero!, importe: Number(m.importe), fecha_emision: o.fecha, fecha_cobro_estimada: m.fecha_pago, banco: m.banco,
        } : null,
      }, { usuarioId: req.user!.id, empresaId: req.empresaId!, ip: req.ip });
    }
    await tx.ordenPago.update({ where: { id }, data: { estado: 'PAGADA', pagada_at: new Date(), updated_by: req.user!.id } });
    await registrarAuditoria({
      usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'UPDATE', entidad: 'OrdenPago', entidadId: id,
      descripcion: `Registró el pago de la ${etiqueta}: ${tramos.length} pago(s) en ${o.facturas.length} factura(s)`, ip: req.ip, tx: tx as any,
    });
  }, { timeout: 60_000 });

  res.json(await mapOrden((await cargarOrden(id, req.empresaId!))!, req.user!.id));
}

// GET /api/ordenes-pago/:id/pdf
export async function pdfOrdenPago(req: Request, res: Response) {
  const o = await cargarOrden(Number(req.params.id), req.empresaId!);
  if (!o) { res.status(404).json({ error: 'Orden de pago no encontrada' }); return; }
  const m = await mapOrden(o);
  const empresa = await prisma.empresa.findUniqueOrThrow({
    where:  { id: o.empresa_id },
    select: { id: true, nombre: true, razon_social: true, cuit: true, domicilio: true, telefono: true, email: true, logo_data: true, logo_mime: true },
  });
  const html = templateOrdenPago({
    empresa: {
      nombre:    empresa.razon_social ?? empresa.nombre,
      cuit:      empresa.cuit ?? (empresa.id === EMPRESAS.DOS57 ? CUIT_DOS57_FALLBACK : null),
      domicilio: empresa.domicilio, telefono: empresa.telefono, email: empresa.email,
      logo:      empresa.logo_data && empresa.logo_mime ? `data:${empresa.logo_mime};base64,${Buffer.from(empresa.logo_data).toString('base64')}` : null,
    },
    numero:   m.numero_formateado,
    borrador: o.estado === 'BORRADOR',
    anulada:  o.estado === 'ANULADA',
    fecha:    o.fecha,
    proveedor: { nombre: o.proveedor.nombre, cuit: o.proveedor.cuit },
    concepto: o.concepto,
    moneda:   o.moneda,
    facturas: m.facturas.map(f => ({ fecha: f.factura.fecha_emision, numero: `${f.factura.tipo_factura} ${f.factura.numero_factura}`, importe: f.importe, total_factura: f.factura.importe_total })),
    medios:   m.medios.map(x => ({ medio: [MEDIO_LABEL[x.medio_pago], x.numero ? `N° ${x.numero}` : null, x.banco].filter(Boolean).join(' '), importe: x.importe, fecha: x.fecha_pago })),
    total_facturas: m.total_facturas, total_pagos: m.total_pagos,
    elaborado: m.elaborado_nombre, revisado: m.revisado_nombre, autorizado: m.autorizado_nombre,
    notas: o.notas,
  });
  const buffer = await renderRemitoPDF(html, `${m.numero_formateado} · ${o.proveedor.nombre}`);
  const slug = o.proveedor.nombre.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').substring(0, 40);
  res.set({
    'Content-Type':        'application/pdf',
    'Content-Disposition': `inline; filename="Orden-de-pago-${String(o.numero).padStart(6, '0')}-${slug}.pdf"`,
    'Content-Length':      String(buffer.length),
  });
  res.end(buffer);
}
