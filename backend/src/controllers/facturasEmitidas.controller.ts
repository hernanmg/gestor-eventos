import type { Request, Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { EstadoFacturaEmitida, Moneda } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { withTenant } from '../lib/tenant';
import { convertirARS } from '../lib/convertirARS';
import { registrarAuditoria } from '../lib/auditoria';

// ── Multer PDF ────────────────────────────────────────────────────────────────

export const uploadPDF = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Solo se aceptan archivos PDF'));
  },
});

// ── Validation ────────────────────────────────────────────────────────────────

const repartoSchema = z.object({
  razon_social: z.string().min(1),
  cuit:         z.string().nullable().optional(),
  porcentaje:   z.number().positive(),
  monto:        z.number().positive(),
  empresa_id:   z.number().int().positive().nullable().optional(),
});

const facturaEmitidaBaseSchema = z.object({
  tipo_comprobante:   z.enum([
    'FACTURA_A', 'FACTURA_B', 'FACTURA_C', 'FACTURA_MIPYMES_FCE_A', 'FACTURA_MIPYMES_FCE_B',
    'NOTA_CREDITO_A', 'NOTA_CREDITO_B', 'NOTA_CREDITO_C', 'NOTA_DEBITO_A', 'NOTA_DEBITO_B', 'RECIBO',
  ]),
  punto_venta:        z.number().int().positive().default(1),
  numero:             z.string().nullable().optional(),
  fecha_emision:      z.string().min(1),
  cliente_nombre:     z.string().min(1),
  cliente_cuit:       z.string().nullable().optional(),
  condicion_cliente:  z.enum(['RESPONSABLE_INSCRIPTO', 'MONOTRIBUTISTA', 'EXENTO', 'CONSUMIDOR_FINAL', 'EXTERIOR']).nullable().optional(),
  neto_gravado:       z.number().nullable().optional(),
  iva:                z.number().nullable().optional(),
  otros_impuestos:    z.number().nullable().optional(),
  total:              z.number().positive(),
  moneda:             z.enum(['ARS', 'USD', 'EUR']).default('ARS'),
  tasa_cambio:        z.number().positive().nullable().optional(),
  forma_pago:         z.string().nullable().optional(),
  fecha_vencimiento:  z.string().nullable().optional(),
  evento_id:          z.number().int().positive().nullable().optional(),
  concepto:           z.string().nullable().optional(),
  observaciones:      z.string().nullable().optional(),
  repartos:           z.array(repartoSchema).optional(),
});

const facturaEmitidaSchema = facturaEmitidaBaseSchema.refine(
  d => !d.repartos || d.repartos.length === 0 || Math.abs(d.repartos.reduce((s, r) => s + r.porcentaje, 0) - 100) < 0.01,
  { message: 'La suma de porcentajes del reparto debe ser 100', path: ['repartos'] },
);

const facturaEmitidaUpdateSchema = facturaEmitidaBaseSchema.omit({ repartos: true }).partial();

const cobroSchema = z.object({
  fecha:             z.string().min(1),
  monto:             z.number().positive(),
  forma_cobro:       z.string().nullable().optional(),
  cuenta_destino_id: z.number().int().positive().nullable().optional(),
  referencia:        z.string().nullable().optional(),
  notas:             z.string().nullable().optional(),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function mapFacturaEmitida(f: any) {
  const { cobros, repartos, pdf_data, ...rest } = f;
  const cobrosMapped = cobros?.map((c: any) => ({ ...c, monto: Number(c.monto) }));
  const totalCobrado = cobrosMapped ? cobrosMapped.reduce((s: number, c: any) => s + c.monto, 0) : undefined;
  return {
    ...rest,
    neto_gravado:    rest.neto_gravado    !== null && rest.neto_gravado    !== undefined ? Number(rest.neto_gravado)    : null,
    iva:             rest.iva             !== null && rest.iva             !== undefined ? Number(rest.iva)             : null,
    otros_impuestos: rest.otros_impuestos !== null && rest.otros_impuestos !== undefined ? Number(rest.otros_impuestos) : null,
    total:           Number(rest.total),
    tasa_cambio:     rest.tasa_cambio !== null ? Number(rest.tasa_cambio) : null,
    total_ars:       rest.total_ars   !== null ? Number(rest.total_ars)   : null,
    ...(cobrosMapped !== undefined && {
      cobros:            cobrosMapped,
      total_cobrado:     totalCobrado,
      saldo_pendiente:   Math.max(0, Number(rest.total) - totalCobrado),
      cantidad_cobros:   cobrosMapped.length,
    }),
    ...(repartos && { repartos: repartos.map((r: any) => ({ ...r, porcentaje: Number(r.porcentaje), monto: Number(r.monto) })) }),
  };
}

async function recalcularFacturaEmitida(id: number, tx: any) {
  const cobros = await tx.cobroFacturaEmitida.findMany({ where: { factura_emitida_id: id }, select: { monto: true } });
  const totalCobrado = cobros.reduce((s: number, c: any) => s + Number(c.monto), 0);

  const f = await tx.facturaEmitida.findUnique({ where: { id }, select: { total: true, estado: true } });
  const total = Number(f.total);

  // ANULADA/INCOBRABLE son estados terminales manuales — no se pisan por recálculo de cobros.
  let nuevoEstado = f.estado;
  if (f.estado !== EstadoFacturaEmitida.ANULADA && f.estado !== EstadoFacturaEmitida.INCOBRABLE) {
    nuevoEstado =
      totalCobrado <= 0    ? EstadoFacturaEmitida.EMITIDA
      : totalCobrado >= total ? EstadoFacturaEmitida.COBRADA
      : EstadoFacturaEmitida.COBRADA_PARCIAL;
  }

  await tx.facturaEmitida.update({ where: { id }, data: { estado: nuevoEstado } });
  return { totalCobrado, nuevoEstado };
}

// ── list ──────────────────────────────────────────────────────────────────────

export async function list(req: Request, res: Response) {
  const { estado, cliente_nombre, desde, hasta, evento_id, tipo_comprobante, moneda, page, limit } = req.query;

  const where: any = { deleted_at: null, ...withTenant(req.empresaId!) };
  if (estado)            where.estado           = estado;
  if (cliente_nombre)    where.cliente_nombre    = { contains: String(cliente_nombre), mode: 'insensitive' };
  if (evento_id)          where.evento_id         = Number(evento_id);
  if (tipo_comprobante)  where.tipo_comprobante  = tipo_comprobante;
  if (moneda)            where.moneda            = moneda;
  if (desde || hasta) {
    where.fecha_emision = {};
    if (desde) where.fecha_emision.gte = new Date(String(desde));
    if (hasta) where.fecha_emision.lte = new Date(String(hasta));
  }

  const pageNum  = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));

  const [total, facturas] = await Promise.all([
    prisma.facturaEmitida.count({ where }),
    prisma.facturaEmitida.findMany({
      where,
      include: {
        evento: { select: { id: true, nombre: true } },
        cobros: { select: { monto: true } },
      },
      orderBy: { fecha_emision: 'desc' },
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
    }),
  ]);

  res.json({
    items:      facturas.map(mapFacturaEmitida),
    total,
    page:       pageNum,
    limit:      limitNum,
    totalPages: Math.max(1, Math.ceil(total / limitNum)),
  });
}

// ── clientes (autocomplete "buscar en clientes anteriores") ─────────────────

export async function buscarClientes(req: Request, res: Response) {
  const q = String(req.query.q ?? '').trim();
  if (q.length < 2) { res.json([]); return; }

  const facturas = await prisma.facturaEmitida.findMany({
    where: { deleted_at: null, ...withTenant(req.empresaId!), cliente_nombre: { contains: q, mode: 'insensitive' } },
    select: { cliente_nombre: true, cliente_cuit: true, condicion_cliente: true },
    orderBy: { fecha_emision: 'desc' },
    take: 50,
  });

  const vistos = new Set<string>();
  const resultado: { cliente_nombre: string; cliente_cuit: string | null; condicion_cliente: string | null }[] = [];
  for (const f of facturas) {
    if (vistos.has(f.cliente_nombre)) continue;
    vistos.add(f.cliente_nombre);
    resultado.push(f);
    if (resultado.length >= 8) break;
  }
  res.json(resultado);
}

// ── resumen ───────────────────────────────────────────────────────────────────

export async function resumen(req: Request, res: Response) {
  const facturas = await prisma.facturaEmitida.findMany({
    where:   { deleted_at: null, ...withTenant(req.empresaId!) },
    include: { cobros: { select: { monto: true } } },
  });

  const hoy = new Date();
  let total_emitido = 0, total_cobrado = 0, total_pendiente = 0;
  let vencidas_sin_cobrar = 0, vencidas_sin_cobrar_monto = 0;
  const por_estado: Record<string, number> = { EMITIDA: 0, COBRADA_PARCIAL: 0, COBRADA: 0, INCOBRABLE: 0, ANULADA: 0 };
  const porMes = new Map<string, { mes: string; total_emitido: number; total_cobrado: number }>();

  for (const f of facturas) {
    por_estado[f.estado] = (por_estado[f.estado] ?? 0) + 1;
    if (f.estado === EstadoFacturaEmitida.ANULADA) continue;

    const total       = Number(f.total);
    // Convierte a ARS con la cotización de la propia factura (total_ars) para
    // poder sumar entre facturas de distinta moneda — mismo criterio que
    // Movimiento.monto_ars/CuentaCorriente.saldo_actual en el resto del sistema.
    const totalArs     = f.total_ars !== null ? Number(f.total_ars) : total;
    const cobrado      = f.cobros.reduce((s, c) => s + Number(c.monto), 0);
    const cobradoArs    = total > 0 ? cobrado * (totalArs / total) : cobrado;
    const pendienteArs  = Math.max(0, totalArs - cobradoArs);

    total_emitido   += totalArs;
    total_cobrado   += cobradoArs;
    total_pendiente += pendienteArs;

    const mesKey = `${f.fecha_emision.getUTCFullYear()}-${String(f.fecha_emision.getUTCMonth() + 1).padStart(2, '0')}`;
    const mes = porMes.get(mesKey) ?? { mes: mesKey, total_emitido: 0, total_cobrado: 0 };
    mes.total_emitido += totalArs;
    mes.total_cobrado += cobradoArs;
    porMes.set(mesKey, mes);

    if (
      (f.estado === EstadoFacturaEmitida.EMITIDA || f.estado === EstadoFacturaEmitida.COBRADA_PARCIAL)
      && f.fecha_vencimiento && f.fecha_vencimiento < hoy
    ) {
      vencidas_sin_cobrar++;
      vencidas_sin_cobrar_monto += pendienteArs;
    }
  }

  res.json({
    total_emitido:              parseFloat(total_emitido.toFixed(2)),
    total_cobrado:               parseFloat(total_cobrado.toFixed(2)),
    total_pendiente:              parseFloat(total_pendiente.toFixed(2)),
    vencidas_sin_cobrar,
    vencidas_sin_cobrar_monto:    parseFloat(vencidas_sin_cobrar_monto.toFixed(2)),
    por_estado,
    por_mes: [...porMes.values()]
      .sort((a, b) => a.mes.localeCompare(b.mes))
      .map(m => ({ ...m, total_emitido: parseFloat(m.total_emitido.toFixed(2)), total_cobrado: parseFloat(m.total_cobrado.toFixed(2)) })),
  });
}

// ── detail ────────────────────────────────────────────────────────────────────

export async function detail(req: Request, res: Response) {
  const id = Number(req.params.id);
  const f  = await prisma.facturaEmitida.findFirst({
    where:   { id, deleted_at: null, ...withTenant(req.empresaId!) },
    include: {
      evento:   { select: { id: true, nombre: true, estado: true } },
      cobros:   { include: { cuenta_destino: { select: { id: true, nombre: true } } }, orderBy: { fecha: 'desc' } },
      repartos: true,
    },
  });
  if (!f) { res.status(404).json({ error: 'Factura no encontrada' }); return; }
  res.json(mapFacturaEmitida(f));
}

// ── getPDF ────────────────────────────────────────────────────────────────────

export async function getPDF(req: Request, res: Response) {
  const id = Number(req.params.id);
  const f  = await prisma.facturaEmitida.findFirst({
    where:  { id, deleted_at: null, ...withTenant(req.empresaId!) },
    select: { pdf_data: true, pdf_mime_type: true, pdf_nombre: true },
  });
  if (!f)          { res.status(404).json({ error: 'Factura no encontrada' }); return; }
  if (!f.pdf_data) { res.status(404).json({ error: 'Esta factura no tiene PDF adjunto' }); return; }

  const buffer   = Buffer.from(f.pdf_data);
  const filename = encodeURIComponent(f.pdf_nombre ?? 'factura.pdf');

  res.setHeader('Content-Type',        f.pdf_mime_type ?? 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  res.setHeader('Content-Length',      buffer.length);
  res.end(buffer);
}

// ── create ────────────────────────────────────────────────────────────────────

export async function create(req: Request, res: Response) {
  const parsed = facturaEmitidaSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return;
  }
  const d = parsed.data;

  if (d.evento_id) {
    const evento = await prisma.evento.findFirst({ where: { id: d.evento_id, deleted_at: null, ...withTenant(req.empresaId!) } });
    if (!evento) { res.status(400).json({ error: 'Evento no encontrado' }); return; }
  }

  const totalArs = convertirARS(d.total, d.moneda as Moneda, d.tasa_cambio ?? null);

  const factura = await prisma.$transaction(async tx => {
    const nueva = await tx.facturaEmitida.create({
      data: {
        ...withTenant(req.empresaId!),
        tipo_comprobante:  d.tipo_comprobante,
        punto_venta:       d.punto_venta,
        numero:            d.numero ?? null,
        fecha_emision:     new Date(d.fecha_emision),
        cliente_nombre:    d.cliente_nombre,
        cliente_cuit:      d.cliente_cuit ?? null,
        condicion_cliente: d.condicion_cliente ?? null,
        neto_gravado:      d.neto_gravado ?? null,
        iva:               d.iva ?? null,
        otros_impuestos:   d.otros_impuestos ?? null,
        total:             d.total,
        moneda:            d.moneda as Moneda,
        tasa_cambio:       d.tasa_cambio ?? null,
        total_ars:         totalArs,
        forma_pago:        d.forma_pago ?? null,
        fecha_vencimiento: d.fecha_vencimiento ? new Date(d.fecha_vencimiento) : null,
        evento_id:         d.evento_id ?? null,
        concepto:          d.concepto ?? null,
        observaciones:     d.observaciones ?? null,
        created_by:        req.user!.id,
        updated_by:        req.user!.id,
      },
    });

    if (d.repartos && d.repartos.length > 0) {
      await tx.repartoFacturaEmitida.createMany({
        data: d.repartos.map(r => ({
          factura_emitida_id: nueva.id,
          razon_social:       r.razon_social,
          cuit:                r.cuit       ?? null,
          porcentaje:          r.porcentaje,
          monto:               r.monto,
          empresa_id:          r.empresa_id ?? null,
        })),
      });
    }

    await registrarAuditoria({
      usuarioId:    req.user!.id,
      empresaId:    req.empresaId,
      accion:       'CREATE',
      entidad:      'FacturaEmitida',
      entidadId:    nueva.id,
      eventoId:     d.evento_id ?? undefined,
      descripcion:  `Factura emitida a ${d.cliente_nombre} por $${d.total}`,
      datosDespues: { cliente_nombre: d.cliente_nombre, total: d.total, moneda: d.moneda },
      ip:           req.ip,
      tx:           tx as any,
    });

    return tx.facturaEmitida.findUniqueOrThrow({
      where:   { id: nueva.id },
      include: { evento: { select: { id: true, nombre: true } }, repartos: true, cobros: { select: { monto: true } } },
    });
  });

  res.status(201).json(mapFacturaEmitida(factura));
}

// ── update ────────────────────────────────────────────────────────────────────

export async function update(req: Request, res: Response) {
  const id = Number(req.params.id);
  const f  = await prisma.facturaEmitida.findFirst({
    where:   { id, deleted_at: null, ...withTenant(req.empresaId!) },
    include: { cobros: { select: { id: true } } },
  });
  if (!f) { res.status(404).json({ error: 'Factura no encontrada' }); return; }

  if (f.estado !== EstadoFacturaEmitida.EMITIDA) {
    res.status(400).json({ error: `No se puede editar una factura en estado ${f.estado}` }); return;
  }
  if (f.cobros.length > 0) {
    res.status(400).json({ error: 'No se puede editar una factura con cobros registrados' }); return;
  }

  const parsed = facturaEmitidaUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return;
  }
  const d = parsed.data;

  if (d.evento_id) {
    const evento = await prisma.evento.findFirst({ where: { id: d.evento_id, deleted_at: null, ...withTenant(req.empresaId!) } });
    if (!evento) { res.status(400).json({ error: 'Evento no encontrado' }); return; }
  }

  const totalFinal  = d.total  !== undefined ? d.total  : Number(f.total);
  const monedaFinal = (d.moneda ?? f.moneda) as Moneda;
  const tasaFinal   = d.tasa_cambio !== undefined ? d.tasa_cambio : (f.tasa_cambio !== null ? Number(f.tasa_cambio) : null);
  const recomputarArs = d.total !== undefined || d.moneda !== undefined || d.tasa_cambio !== undefined;
  const totalArsFinal = recomputarArs ? convertirARS(totalFinal, monedaFinal, tasaFinal) : undefined;

  const updated = await prisma.facturaEmitida.update({
    where: { id },
    data: {
      ...(d.tipo_comprobante  !== undefined && { tipo_comprobante:  d.tipo_comprobante }),
      ...(d.punto_venta       !== undefined && { punto_venta:       d.punto_venta }),
      ...(d.numero            !== undefined && { numero:            d.numero }),
      ...(d.fecha_emision     !== undefined && { fecha_emision:     new Date(d.fecha_emision) }),
      ...(d.cliente_nombre    !== undefined && { cliente_nombre:    d.cliente_nombre }),
      ...(d.cliente_cuit      !== undefined && { cliente_cuit:      d.cliente_cuit }),
      ...(d.condicion_cliente !== undefined && { condicion_cliente: d.condicion_cliente }),
      ...(d.neto_gravado      !== undefined && { neto_gravado:      d.neto_gravado }),
      ...(d.iva               !== undefined && { iva:               d.iva }),
      ...(d.otros_impuestos   !== undefined && { otros_impuestos:   d.otros_impuestos }),
      ...(d.total             !== undefined && { total:             d.total }),
      ...(d.moneda             !== undefined && { moneda:            d.moneda as Moneda }),
      ...(d.tasa_cambio       !== undefined && { tasa_cambio:       d.tasa_cambio }),
      ...(totalArsFinal        !== undefined && { total_ars:         totalArsFinal }),
      ...(d.forma_pago        !== undefined && { forma_pago:        d.forma_pago }),
      ...(d.fecha_vencimiento !== undefined && { fecha_vencimiento: d.fecha_vencimiento ? new Date(d.fecha_vencimiento) : null }),
      ...(d.evento_id         !== undefined && { evento_id:         d.evento_id }),
      ...(d.concepto          !== undefined && { concepto:          d.concepto }),
      ...(d.observaciones     !== undefined && { observaciones:     d.observaciones }),
      updated_by: req.user!.id,
    },
    include: { evento: { select: { id: true, nombre: true } }, repartos: true, cobros: { select: { monto: true } } },
  });
  res.json(mapFacturaEmitida(updated));
}

// ── remove ────────────────────────────────────────────────────────────────────

export async function remove(req: Request, res: Response) {
  const id = Number(req.params.id);
  const f  = await prisma.facturaEmitida.findFirst({ where: { id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!f) { res.status(404).json({ error: 'Factura no encontrada' }); return; }

  if (f.estado !== EstadoFacturaEmitida.EMITIDA && f.estado !== EstadoFacturaEmitida.ANULADA) {
    res.status(400).json({ error: `No se puede eliminar una factura en estado ${f.estado}` }); return;
  }

  await prisma.facturaEmitida.update({
    where: { id },
    data:  { deleted_at: new Date(), updated_by: req.user!.id },
  });
  res.json({ message: 'Factura eliminada correctamente' });
}

// ── anular ────────────────────────────────────────────────────────────────────

export async function anular(req: Request, res: Response) {
  const id = Number(req.params.id);
  const f  = await prisma.facturaEmitida.findFirst({
    where:   { id, deleted_at: null, ...withTenant(req.empresaId!) },
    include: { cobros: { select: { id: true } } },
  });
  if (!f) { res.status(404).json({ error: 'Factura no encontrada' }); return; }

  if (f.cobros.length > 0) {
    res.status(400).json({ error: 'No se puede anular una factura con cobros registrados' }); return;
  }
  if (f.estado === EstadoFacturaEmitida.ANULADA) {
    res.status(400).json({ error: 'La factura ya está ANULADA' }); return;
  }

  const updated = await prisma.facturaEmitida.update({
    where: { id },
    data:  { estado: EstadoFacturaEmitida.ANULADA, updated_by: req.user!.id },
  });
  res.json(mapFacturaEmitida(updated));
}

// ── marcarIncobrable ──────────────────────────────────────────────────────────
// No pedido explícitamente en el endpoint list, pero INCOBRABLE es un estado
// del enum sin ninguna vía para alcanzarlo salvo esta — mismo criterio que el
// campo `estado` opcional en PUT /afip/planes/:id (ver afipPrestamos.controller.ts):
// se agrega la acción mínima para que el estado no quede muerto.

export async function marcarIncobrable(req: Request, res: Response) {
  const id = Number(req.params.id);
  const f  = await prisma.facturaEmitida.findFirst({ where: { id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!f) { res.status(404).json({ error: 'Factura no encontrada' }); return; }

  if (f.estado === EstadoFacturaEmitida.COBRADA || f.estado === EstadoFacturaEmitida.ANULADA || f.estado === EstadoFacturaEmitida.INCOBRABLE) {
    res.status(400).json({ error: `No se puede marcar como incobrable una factura en estado ${f.estado}` }); return;
  }

  const updated = await prisma.facturaEmitida.update({
    where: { id },
    data:  { estado: EstadoFacturaEmitida.INCOBRABLE, updated_by: req.user!.id },
  });
  res.json(mapFacturaEmitida(updated));
}

// ── registrarCobro ────────────────────────────────────────────────────────────

export async function registrarCobro(req: Request, res: Response) {
  const facturaId = Number(req.params.id);
  const parsed    = cobroSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return;
  }
  const d = parsed.data;

  const factura = await prisma.facturaEmitida.findFirst({
    where:   { id: facturaId, deleted_at: null, ...withTenant(req.empresaId!) },
    include: { cobros: { select: { monto: true } } },
  });
  if (!factura) { res.status(404).json({ error: 'Factura no encontrada' }); return; }

  if (factura.estado === EstadoFacturaEmitida.ANULADA) {
    res.status(400).json({ error: 'No se puede cobrar una factura ANULADA' }); return;
  }
  if (factura.estado === EstadoFacturaEmitida.COBRADA) {
    res.status(400).json({ error: 'La factura ya está COBRADA' }); return;
  }

  const totalCobradoActual = factura.cobros.reduce((s, c) => s + Number(c.monto), 0);
  const saldoPendiente     = Number(factura.total) - totalCobradoActual;
  if (d.monto > saldoPendiente + 0.01) {
    res.status(400).json({ error: `El monto ($${d.monto}) supera el saldo pendiente ($${saldoPendiente.toFixed(2)})` }); return;
  }

  if (d.cuenta_destino_id) {
    const cuenta = await prisma.cuentaBancaria.findFirst({ where: { id: d.cuenta_destino_id, deleted_at: null, ...withTenant(req.empresaId!) } });
    if (!cuenta) { res.status(400).json({ error: 'Cuenta destino no encontrada' }); return; }
  }

  const result = await prisma.$transaction(async tx => {
    const cobro = await tx.cobroFacturaEmitida.create({
      data: {
        factura_emitida_id: facturaId,
        fecha:              new Date(d.fecha),
        monto:               d.monto,
        moneda:              factura.moneda,
        forma_cobro:         d.forma_cobro       ?? null,
        cuenta_destino_id:   d.cuenta_destino_id ?? null,
        referencia:          d.referencia        ?? null,
        notas:               d.notas             ?? null,
        created_by:          req.user!.id,
      },
    });

    const { nuevoEstado } = await recalcularFacturaEmitida(facturaId, tx);

    await registrarAuditoria({
      usuarioId:    req.user!.id,
      empresaId:    req.empresaId,
      accion:       'CREATE',
      entidad:      'CobroFacturaEmitida',
      entidadId:    cobro.id,
      descripcion:  `Cobro de $${d.monto} registrado en factura emitida #${facturaId} (${factura.cliente_nombre})`,
      datosDespues: { monto: d.monto, forma_cobro: d.forma_cobro, nuevoEstado },
      ip:           req.ip,
      tx:           tx as any,
    });

    return { ...cobro, monto: Number(cobro.monto) };
  });

  res.status(201).json(result);
}

// ── eliminarCobro ─────────────────────────────────────────────────────────────

export async function eliminarCobro(req: Request, res: Response) {
  const cobroId = Number(req.params.id);
  const cobro   = await prisma.cobroFacturaEmitida.findFirst({
    where:   { id: cobroId, factura_emitida: withTenant(req.empresaId!) },
    include: { factura_emitida: { select: { id: true, cliente_nombre: true } } },
  });
  if (!cobro) { res.status(404).json({ error: 'Cobro no encontrado' }); return; }

  await prisma.$transaction(async tx => {
    await tx.cobroFacturaEmitida.delete({ where: { id: cobroId } });
    await recalcularFacturaEmitida(cobro.factura_emitida_id, tx);

    await registrarAuditoria({
      usuarioId:   req.user!.id,
      empresaId:   req.empresaId,
      accion:      'DELETE',
      entidad:     'CobroFacturaEmitida',
      entidadId:   cobroId,
      descripcion: `Eliminación de cobro #${cobroId} de factura emitida #${cobro.factura_emitida_id} (${cobro.factura_emitida.cliente_nombre})`,
      ip:          req.ip,
      tx:          tx as any,
    });
  });

  res.json({ message: 'Cobro eliminado correctamente' });
}

// ── PDF upload ────────────────────────────────────────────────────────────────

export async function uploadPdfFactura(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (!req.file) { res.status(400).json({ error: 'Se requiere un archivo PDF' }); return; }

  const f = await prisma.facturaEmitida.findFirst({ where: { id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!f) { res.status(404).json({ error: 'Factura no encontrada' }); return; }

  await prisma.facturaEmitida.update({
    where: { id },
    data: {
      pdf_data:      req.file.buffer,
      pdf_nombre:    req.file.originalname,
      pdf_mime_type: req.file.mimetype,
      pdf_tamanio:   req.file.size,
      updated_by:    req.user!.id,
    },
  });
  res.json({ message: 'PDF adjuntado correctamente' });
}
