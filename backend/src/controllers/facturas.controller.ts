import type { Request, Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { EstadoFactura, MedioPago, CondicionPago, Moneda, Tipo } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { recalcularSaldos } from '../lib/recalcularSaldos';
import { registrarAuditoria } from '../lib/auditoria';
import { withTenant } from '../lib/tenant';

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

const facturaSchema = z.object({
  numero_factura:    z.string().regex(/^\d{4}-\d{8}$/, 'Formato inválido. Debe ser XXXX-XXXXXXXX (ej: 0001-00001234)'),
  tipo_factura:      z.enum(['A', 'B', 'C', 'X']),
  fecha_emision:     z.string().min(1),
  fecha_vencimiento: z.string().nullable().optional(),
  proveedor_id:      z.number().int().positive(),
  tab_numero:        z.number().int().min(1).max(5).nullable().optional(),
  importe_total:     z.number().positive(),
  moneda:            z.enum(['ARS', 'USD']).default('ARS'),
  condicion_pago:    z.enum(['CONTADO', 'DIAS_30', 'DIAS_60', 'DIAS_90', 'ECHEQ', 'OTRO']).default('CONTADO'),
  notas:             z.string().nullable().optional(),
});

const pagoSchema = z.object({
  fecha_pago:                 z.string().min(1),
  importe:                    z.number().positive(),
  medio_pago:                 z.enum(['TRANSFERENCIA', 'ECHEQ', 'EFECTIVO', 'CHEQUE']),
  referencia:                 z.string().nullable().optional(),
  notas:                      z.string().nullable().optional(),
  echeq_numero:               z.string().optional(),
  echeq_fecha_cobro_estimada: z.string().nullable().optional(),
}).refine(
  d => d.medio_pago !== 'ECHEQ' || !!d.echeq_numero,
  { message: 'echeq_numero es obligatorio cuando medio_pago es ECHEQ', path: ['echeq_numero'] },
);

// ── Helpers ───────────────────────────────────────────────────────────────────

function mapFactura(f: any) {
  return {
    ...f,
    importe_total:     Number(f.importe_total),
    importe_pagado:    Number(f.importe_pagado),
    importe_pendiente: Number(f.importe_pendiente),
    pdf_data:          undefined, // never send raw bytes in list/detail
    pagos: f.pagos?.map((p: any) => ({
      ...p,
      importe: Number(p.importe),
    })),
  };
}

async function recalcularFactura(facturaId: number, tx: any) {
  const pagos = await tx.pagoFactura.findMany({
    where:  { factura_id: facturaId, deleted_at: null },
    select: { importe: true },
  });
  const importePagado    = pagos.reduce((s: number, p: any) => s + Number(p.importe), 0);
  const factura          = await tx.factura.findUnique({
    where: { id: facturaId }, select: { importe_total: true, estado: true },
  });
  const importeTotal     = Number(factura.importe_total);
  const importePendiente = Math.max(0, importeTotal - importePagado);
  const nuevoEstado      =
    factura.estado === EstadoFactura.ANULADA
      ? EstadoFactura.ANULADA
      : importePendiente <= 0
        ? EstadoFactura.PAGADA
        : factura.estado === EstadoFactura.PAGADA
          ? EstadoFactura.APROBADA  // volvió a tener pendiente
          : factura.estado;
  await tx.factura.update({
    where: { id: facturaId },
    data:  { importe_pagado: importePagado, importe_pendiente: importePendiente, estado: nuevoEstado },
  });
  return { importePagado, importePendiente, nuevoEstado };
}

// ── list (by evento) ─────────────────────────────────────────────────────────

export async function list(req: Request, res: Response) {
  const eventoId = Number(req.params.id);
  const { estado, moneda } = req.query;

  const where: any = { evento_id: eventoId, deleted_at: null, ...withTenant(req.empresaId!) };
  if (estado) where.estado = estado;
  if (moneda) where.moneda = moneda;

  const facturas = await prisma.factura.findMany({
    where,
    include: {
      proveedor: { select: { id: true, nombre: true, alias: true } },
    },
    orderBy: [{ fecha_vencimiento: 'asc' }, { created_at: 'desc' }],
  });
  res.json(facturas.map(mapFactura));
}

// ── listGlobal ───────────────────────────────────────────────────────────────

export async function listGlobal(req: Request, res: Response) {
  const { evento_id, proveedor_id, estado, desde, hasta, vencen_en_dias, moneda } = req.query;

  const where: any = { deleted_at: null, ...withTenant(req.empresaId!) };
  if (evento_id)    where.evento_id    = Number(evento_id);
  if (proveedor_id) where.proveedor_id = Number(proveedor_id);
  if (estado)       where.estado       = estado;
  if (moneda)       where.moneda       = moneda;

  if (desde || hasta) {
    where.fecha_vencimiento = {};
    if (desde) where.fecha_vencimiento.gte = new Date(String(desde));
    if (hasta) where.fecha_vencimiento.lte = new Date(String(hasta));
  }

  if (vencen_en_dias !== undefined) {
    const dias  = Number(vencen_en_dias);
    const ahora = new Date();
    const hasta = new Date(ahora.getTime() + dias * 86400000);
    where.fecha_vencimiento = { gte: ahora, lte: hasta };
    where.estado = { not: EstadoFactura.PAGADA };
  }

  const facturas = await prisma.factura.findMany({
    where,
    include: {
      proveedor: { select: { id: true, nombre: true, alias: true } },
      evento:    { select: { id: true, nombre: true } },
    },
    orderBy: [{ fecha_vencimiento: 'asc' }, { created_at: 'desc' }],
  });
  res.json(facturas.map(mapFactura));
}

// ── alertas ───────────────────────────────────────────────────────────────────

export async function alertas(req: Request, res: Response) {
  const ahora          = new Date();
  const en7dias        = new Date(ahora.getTime() + 7 * 86400000);
  const estadosActivos = [EstadoFactura.APROBADA];

  const [vencidas, vencen_pronto] = await Promise.all([
    prisma.factura.count({
      where: {
        ...withTenant(req.empresaId!),
        deleted_at:        null,
        estado:            { in: estadosActivos },
        fecha_vencimiento: { lt: ahora },
      },
    }),
    prisma.factura.count({
      where: {
        ...withTenant(req.empresaId!),
        deleted_at:        null,
        estado:            { in: estadosActivos },
        fecha_vencimiento: { gte: ahora, lte: en7dias },
      },
    }),
  ]);
  res.json({ vencidas, vencen_pronto });
}

// ── detail ────────────────────────────────────────────────────────────────────

export async function detail(req: Request, res: Response) {
  const id = Number(req.params.id);
  const f  = await prisma.factura.findFirst({
    where:   { id, deleted_at: null, ...withTenant(req.empresaId!) },
    include: {
      proveedor: { select: { id: true, nombre: true, alias: true, cuit: true } },
      evento:    { select: { id: true, nombre: true, estado: true } },
      pagos:     {
        where:   { deleted_at: null },
        include: {
          movimiento: { select: { id: true, tipo: true, tab_numero: true } },
          echeq:      { select: { id: true, estado: true, numero: true } },
        },
        orderBy: { fecha_pago: 'desc' },
      },
    },
  });
  if (!f) { res.status(404).json({ error: 'Factura no encontrada' }); return; }
  res.json(mapFactura(f));
}

// ── getPDF ────────────────────────────────────────────────────────────────────

export async function getPDF(req: Request, res: Response) {
  const id = Number(req.params.id);
  const f  = await prisma.factura.findFirst({
    where:  { id, deleted_at: null, ...withTenant(req.empresaId!) },
    select: { pdf_data: true, pdf_mime_type: true, pdf_nombre: true, pdf_tamanio: true },
  });
  if (!f)           { res.status(404).json({ error: 'Factura no encontrada' }); return; }
  if (!f.pdf_data)  { res.status(404).json({ error: 'Esta factura no tiene PDF adjunto' }); return; }

  const buffer   = Buffer.from(f.pdf_data);
  const filename = encodeURIComponent(f.pdf_nombre ?? 'factura.pdf');

  res.setHeader('Content-Type',        'application/pdf');
  // inline → el browser renderiza el PDF en su pestaña en lugar de descargarlo
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  res.setHeader('Content-Length',      buffer.length);
  res.end(buffer);
}

// ── create ────────────────────────────────────────────────────────────────────

export async function create(req: Request, res: Response) {
  const eventoId = Number(req.params.id);

  // Body comes as multipart/form-data strings — parse numbers explicitly
  const b = req.body;
  const body = {
    numero_factura:    b.numero_factura,
    tipo_factura:      b.tipo_factura,
    fecha_emision:     b.fecha_emision,
    fecha_vencimiento: b.fecha_vencimiento || null,
    proveedor_id:      b.proveedor_id  ? parseInt(b.proveedor_id)   : undefined,
    tab_numero:        b.tab_numero    ? parseInt(b.tab_numero)      : null,
    importe_total:     b.importe_total ? parseFloat(b.importe_total) : undefined,
    moneda:            b.moneda        || 'ARS',
    condicion_pago:    b.condicion_pago || 'CONTADO',
    notas:             b.notas         || null,
  };

  console.log('[Factura] create body:', body);
  console.log('[Factura] PDF recibido:', {
    tiene_pdf: !!req.file,
    nombre:    req.file?.originalname,
    tamanio:   req.file?.size,
    mime:      req.file?.mimetype,
  });

  const parsed = facturaSchema.safeParse(body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return;
  }
  const d = parsed.data;

  const proveedor = await prisma.proveedor.findFirst({ where: { id: d.proveedor_id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!proveedor) { res.status(400).json({ error: 'Proveedor no encontrado' }); return; }

  const evento = await prisma.evento.findFirst({ where: { id: eventoId, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!evento) { res.status(404).json({ error: 'Evento no encontrado' }); return; }

  const pdfData: Buffer | undefined  = req.file?.buffer;
  const pdfNombre: string | undefined = req.file?.originalname;
  const pdfMime: string | undefined   = req.file?.mimetype;
  const pdfSize: number | undefined   = req.file?.size;

  const factura = await prisma.factura.create({
    data: {
      ...withTenant(req.empresaId!),
      numero_factura:    d.numero_factura,
      tipo_factura:      d.tipo_factura,
      fecha_emision:     new Date(d.fecha_emision),
      fecha_vencimiento: d.fecha_vencimiento ? new Date(d.fecha_vencimiento) : null,
      proveedor_id:      d.proveedor_id,
      evento_id:         eventoId,
      tab_numero:        d.tab_numero ?? null,
      tipo_movimiento:   d.tab_numero ? Tipo.EGRESO : null,
      importe_total:     d.importe_total,
      importe_pendiente: d.importe_total,
      moneda:            d.moneda as Moneda,
      condicion_pago:    d.condicion_pago as CondicionPago,
      notas:             d.notas ?? null,
      pdf_data:          pdfData ?? null,
      pdf_nombre:        pdfNombre ?? null,
      pdf_mime_type:     pdfMime ?? null,
      pdf_tamanio:       pdfSize ?? null,
      created_by:        req.user!.id,
      updated_by:        req.user!.id,
    },
    include: { proveedor: { select: { id: true, nombre: true } }, evento: { select: { id: true, nombre: true } } },
  });
  res.status(201).json(mapFactura(factura));
}

// ── update ────────────────────────────────────────────────────────────────────

export async function update(req: Request, res: Response) {
  const id = Number(req.params.id);
  const f  = await prisma.factura.findFirst({ where: { id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!f) { res.status(404).json({ error: 'Factura no encontrada' }); return; }

  const parsed = facturaSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return;
  }
  const d = parsed.data;

  const updated = await prisma.factura.update({
    where: { id },
    data: {
      ...(d.numero_factura    !== undefined && { numero_factura:    d.numero_factura }),
      ...(d.tipo_factura      !== undefined && { tipo_factura:      d.tipo_factura }),
      ...(d.fecha_emision     !== undefined && { fecha_emision:     new Date(d.fecha_emision) }),
      ...(d.fecha_vencimiento !== undefined && { fecha_vencimiento: d.fecha_vencimiento ? new Date(d.fecha_vencimiento) : null }),
      ...(d.proveedor_id      !== undefined && { proveedor_id:      d.proveedor_id }),
      ...(d.tab_numero        !== undefined && { tab_numero:        d.tab_numero }),
      ...(d.importe_total     !== undefined && { importe_total:     d.importe_total }),
      ...(d.moneda            !== undefined && { moneda:            d.moneda as Moneda }),
      ...(d.condicion_pago    !== undefined && { condicion_pago:    d.condicion_pago as CondicionPago }),
      ...(d.notas             !== undefined && { notas:             d.notas }),
      updated_by: req.user!.id,
    },
    include: { proveedor: { select: { id: true, nombre: true } } },
  });
  res.json(mapFactura(updated));
}

// ── updatePDF ─────────────────────────────────────────────────────────────────

export async function updatePDF(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (!req.file) { res.status(400).json({ error: 'Se requiere un archivo PDF' }); return; }

  const f = await prisma.factura.findFirst({ where: { id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!f) { res.status(404).json({ error: 'Factura no encontrada' }); return; }

  await prisma.factura.update({
    where: { id },
    data: {
      pdf_data:      req.file.buffer,
      pdf_nombre:    req.file.originalname,
      pdf_mime_type: req.file.mimetype,
      pdf_tamanio:   req.file.size,
      updated_by:    req.user!.id,
    },
  });
  res.json({ message: 'PDF actualizado correctamente' });
}

// ── remove ────────────────────────────────────────────────────────────────────

export async function remove(req: Request, res: Response) {
  const id = Number(req.params.id);
  const f  = await prisma.factura.findFirst({ where: { id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!f) { res.status(404).json({ error: 'Factura no encontrada' }); return; }

  if (f.estado === EstadoFactura.PAGADA) {
    res.status(400).json({ error: 'No se puede eliminar una factura PAGADA' }); return;
  }

  await prisma.factura.update({
    where: { id },
    data:  { deleted_at: new Date(), updated_by: req.user!.id },
  });
  res.json({ message: 'Factura eliminada correctamente' });
}

// ── aprobar ───────────────────────────────────────────────────────────────────

export async function aprobar(req: Request, res: Response) {
  const id = Number(req.params.id);
  const f  = await prisma.factura.findFirst({ where: { id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!f) { res.status(404).json({ error: 'Factura no encontrada' }); return; }

  if (f.estado !== EstadoFactura.RECIBIDA) {
    res.status(400).json({ error: `No se puede aprobar una factura en estado ${f.estado}` }); return;
  }

  const updated = await prisma.factura.update({
    where: { id },
    data:  { estado: EstadoFactura.APROBADA, updated_by: req.user!.id },
  });
  res.json(mapFactura(updated));
}

// ── anular ────────────────────────────────────────────────────────────────────

export async function anular(req: Request, res: Response) {
  const id = Number(req.params.id);
  const f  = await prisma.factura.findFirst({ where: { id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!f) { res.status(404).json({ error: 'Factura no encontrada' }); return; }

  if (f.estado === EstadoFactura.PAGADA) {
    res.status(400).json({ error: 'No se puede anular una factura PAGADA' }); return;
  }

  const updated = await prisma.factura.update({
    where: { id },
    data:  { estado: EstadoFactura.ANULADA, updated_by: req.user!.id },
  });
  res.json(mapFactura(updated));
}

// ── pagarFactura ──────────────────────────────────────────────────────────────

export async function pagarFactura(req: Request, res: Response) {
  const facturaId = Number(req.params.id);
  const parsed    = pagoSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten() }); return;
  }

  const { fecha_pago, importe, medio_pago, referencia, notas, echeq_numero, echeq_fecha_cobro_estimada } = parsed.data;

  const factura = await prisma.factura.findFirst({
    where:   { id: facturaId, deleted_at: null, ...withTenant(req.empresaId!) },
    include: { proveedor: { select: { id: true, nombre: true } } },
  });
  if (!factura) { res.status(404).json({ error: 'Factura no encontrada' }); return; }

  if (factura.estado === EstadoFactura.ANULADA) {
    res.status(400).json({ error: 'No se puede pagar una factura ANULADA' }); return;
  }
  if (factura.estado === EstadoFactura.PAGADA) {
    res.status(400).json({ error: 'La factura ya está PAGADA' }); return;
  }
  if (importe > Number(factura.importe_pendiente)) {
    res.status(400).json({ error: `El importe (${importe}) supera el pendiente (${Number(factura.importe_pendiente)})` }); return;
  }

  const result = await prisma.$transaction(async tx => {
    // 1. Crear PagoFactura
    const pago = await tx.pagoFactura.create({
      data: {
        factura_id: facturaId,
        fecha_pago: new Date(fecha_pago),
        importe,
        moneda:     factura.moneda,
        medio_pago: medio_pago as MedioPago,
        referencia: referencia ?? null,
        notas:      notas      ?? null,
        created_by: req.user!.id,
      },
    });

    let movimientoId: number | null = null;
    let echeqId:      number | null = null;

    // 2. Crear Movimiento si hay tab configurada
    if (factura.tab_numero) {
      const lastOrder = await tx.movimiento.findFirst({
        where:   { evento_id: factura.evento_id, tipo: Tipo.EGRESO, tab_numero: factura.tab_numero, deleted_at: null },
        orderBy: { orden: 'desc' },
        select:  { orden: true },
      });
      const mov = await tx.movimiento.create({
        data: {
          evento_id:   factura.evento_id,
          tipo:        Tipo.EGRESO,
          tab_numero:  factura.tab_numero,
          fecha:       new Date(fecha_pago),
          concepto:    factura.proveedor.nombre,
          descripcion: `Pago Fact. ${factura.tipo_factura}${factura.numero_factura}`,
          haber:       importe,
          moneda:      factura.moneda,
          proveedor_id: factura.proveedor_id,
          orden:       (lastOrder?.orden ?? 0) + 1,
          saldo:       0,
          created_by:  req.user!.id,
          updated_by:  req.user!.id,
        },
      });
      movimientoId = mov.id;
      await recalcularSaldos(factura.evento_id, Tipo.EGRESO, factura.tab_numero, tx as any);
    }

    // 3. Crear Echeq si medio_pago = ECHEQ
    if (medio_pago === 'ECHEQ' && echeq_numero) {
      const echeq = await tx.echeq.create({
        data: {
          evento_id:            factura.evento_id,
          movimiento_id:        movimientoId,
          proveedor_id:         factura.proveedor_id,
          numero:               echeq_numero,
          razon_social:         factura.proveedor.nombre,
          importe,
          moneda:               factura.moneda,
          estado:               'PENDIENTE',
          fecha_emision:        new Date(fecha_pago),
          fecha_cobro_estimada: echeq_fecha_cobro_estimada ? new Date(echeq_fecha_cobro_estimada) : null,
          created_by:           req.user!.id,
          updated_by:           req.user!.id,
        },
      });
      echeqId = echeq.id;
    }

    // 4. Actualizar PagoFactura con ids generados
    await tx.pagoFactura.update({
      where: { id: pago.id },
      data:  { movimiento_id: movimientoId, echeq_id: echeqId },
    });

    // 5 & 6. Recalcular totales y estado de factura
    await recalcularFactura(facturaId, tx);

    await registrarAuditoria({
      usuarioId:    req.user!.id,
      empresaId:    req.empresaId,
      accion:       'CREATE',
      entidad:      'PagoFactura',
      entidadId:    pago.id,
      eventoId:     factura.evento_id,
      descripcion:  `Pago de $${importe} (${medio_pago}) registrado en factura ${factura.tipo_factura}${factura.numero_factura}`,
      datosDespues: { importe, medio_pago, movimientoId, echeqId },
      ip:           req.ip,
      tx:           tx as any,
    });

    return { ...pago, importe: Number(pago.importe), movimiento_id: movimientoId, echeq_id: echeqId };
  });

  res.status(201).json(result);
}

// ── anularPago ────────────────────────────────────────────────────────────────

export async function anularPago(req: Request, res: Response) {
  const pagoId = Number(req.params.id);
  const pago   = await prisma.pagoFactura.findFirst({
    where:   { id: pagoId, deleted_at: null, factura: withTenant(req.empresaId!) },
    include: { echeq: { select: { id: true, estado: true } } },
  });
  if (!pago) { res.status(404).json({ error: 'Pago no encontrado' }); return; }

  if (pago.echeq && pago.echeq.estado === 'COBRADO') {
    res.status(400).json({ error: 'No se puede anular un pago con echeq ya COBRADO' }); return;
  }

  await prisma.$transaction(async tx => {
    // 1. Soft delete pago
    await tx.pagoFactura.update({
      where: { id: pagoId },
      data:  { deleted_at: new Date() },
    });

    // 2. Soft delete movimiento si existe
    if (pago.movimiento_id) {
      const mov = await tx.movimiento.findUnique({
        where:  { id: pago.movimiento_id },
        select: { evento_id: true, tipo: true, tab_numero: true },
      });
      if (mov) {
        await tx.movimiento.update({
          where: { id: pago.movimiento_id },
          data:  { deleted_at: new Date(), updated_by: req.user!.id },
        });
        await recalcularSaldos(mov.evento_id, mov.tipo, mov.tab_numero, tx as any);
      }
    }

    // 3. Soft delete echeq si existe y no está COBRADO
    if (pago.echeq_id) {
      await tx.echeq.update({
        where: { id: pago.echeq_id },
        data:  { deleted_at: new Date(), updated_by: req.user!.id },
      });
    }

    // 4 & 5. Recalcular factura
    await recalcularFactura(pago.factura_id, tx);

    await registrarAuditoria({
      usuarioId:   req.user!.id,
      empresaId:   req.empresaId,
      accion:      'DELETE',
      entidad:     'PagoFactura',
      entidadId:   pagoId,
      descripcion: `Anulación de pago #${pagoId} de factura #${pago.factura_id}`,
      ip:          req.ip,
      tx:          tx as any,
    });
  });

  res.json({ message: 'Pago anulado correctamente' });
}
