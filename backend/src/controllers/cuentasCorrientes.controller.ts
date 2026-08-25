import type { Request, Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { TipoTercero, TipoMovCCC, MonedaCCC, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { recalcularSaldoCCC } from '../lib/recalcularSaldoCCC';
import { registrarAuditoria } from '../lib/auditoria';
import { withTenant } from '../lib/tenant';

// ── Multer (documento adjunto — PDF o foto de comprobante) ────────────────────

export const uploadDocumento = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    if (['application/pdf', 'image/jpeg', 'image/png'].includes(file.mimetype)) cb(null, true);
    else cb(new Error('Solo se aceptan archivos PDF, JPG o PNG'));
  },
});

// ── Validation ────────────────────────────────────────────────────────────────

const MONEDAS = ['ARS', 'USD', 'EUR'] as const;

const parteSchema = z.object({
  nombre:     z.string().min(1),
  porcentaje: z.number().positive(),
});

// Base sin refine (permite .partial() para el update) — las validaciones
// cruzadas de cuentaSchema se re-aplican a mano en update().
const cuentaBaseSchema = z.object({
  nombre:         z.string().min(1),
  tipo_tercero:   z.enum(['PROVEEDOR', 'CLIENTE', 'SOCIO', 'CLUB', 'OTRO']),
  proveedor_id:   z.number().int().positive().nullable().optional(),
  tercero_nombre: z.string().nullable().optional(),
  tercero_cuit:   z.string().nullable().optional(),
  moneda:         z.enum(MONEDAS).default('ARS'),
  descripcion:    z.string().nullable().optional(),
  tiene_reparto:  z.boolean().default(false),
  partes:         z.array(parteSchema).optional(),
});

const cuentaSchema = cuentaBaseSchema.refine(d => d.tipo_tercero !== 'PROVEEDOR' || !!d.proveedor_id, {
  message: 'proveedor_id es obligatorio cuando tipo_tercero es PROVEEDOR', path: ['proveedor_id'],
}).refine(d => d.tipo_tercero === 'PROVEEDOR' || !!d.tercero_nombre, {
  message: 'tercero_nombre es obligatorio cuando tipo_tercero no es PROVEEDOR', path: ['tercero_nombre'],
}).refine(d => !d.tiene_reparto || (d.partes && d.partes.length > 0), {
  message: 'Debe cargar al menos una parte cuando tiene_reparto está activo', path: ['partes'],
});

function validarSumaPartes(partes: { porcentaje: number }[] | undefined, tieneReparto: boolean): string | null {
  if (!tieneReparto) return null;
  const suma = (partes ?? []).reduce((s, p) => s + p.porcentaje, 0);
  if (Math.abs(suma - 100) > 0.01) return `La suma de porcentajes debe ser 100 (actual: ${suma})`;
  return null;
}

// Base sin refine (permite .partial() para el update de movimientos).
const movimientoBaseSchema = z.object({
  tipo:        z.enum(['DEBE', 'HABER', 'AJUSTE']),
  fecha:       z.string().min(1),
  concepto:    z.string().min(1),
  descripcion: z.string().nullable().optional(),
  monto:       z.number(),
  moneda:      z.enum(MONEDAS),
  tasa_cambio: z.number().positive().nullable().optional(),
  factura_id:  z.number().int().positive().nullable().optional(),
  evento_id:   z.number().int().positive().nullable().optional(),
});

const movimientoSchema = movimientoBaseSchema.refine(d => d.tipo === 'AJUSTE' || d.monto > 0, {
  message: 'El monto debe ser mayor a 0 para movimientos DEBE/HABER', path: ['monto'],
}).refine(d => d.tipo !== 'AJUSTE' || d.monto !== 0, {
  message: 'El monto de un AJUSTE no puede ser 0', path: ['monto'],
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function mapCuenta(c: any) {
  return {
    ...c,
    saldo_actual: Number(c.saldo_actual),
    partes: c.partes?.map((p: any) => ({ ...p, porcentaje: Number(p.porcentaje) })),
    movimientos: c.movimientos?.map(mapMovimiento),
  };
}

function mapMovimiento(m: any) {
  return {
    ...m,
    monto:       Number(m.monto),
    tasa_cambio: m.tasa_cambio !== null && m.tasa_cambio !== undefined ? Number(m.tasa_cambio) : null,
    monto_ars:   m.monto_ars   !== null && m.monto_ars   !== undefined ? Number(m.monto_ars)   : null,
    saldo:       Number(m.saldo),
    documento_data: undefined, // nunca mandar los bytes en list/detail
  };
}

function calcularMontoArs(moneda: MonedaCCC, monto: number, tasaCambio: number | null | undefined): number | null {
  if (moneda === MonedaCCC.ARS) return monto;
  if (tasaCambio) return parseFloat((monto * tasaCambio).toFixed(2));
  return null;
}

async function findCuenta(id: number, empresaId: number) {
  return prisma.cuentaCorriente.findFirst({ where: { id, deleted_at: null, ...withTenant(empresaId) } });
}

// ── list ──────────────────────────────────────────────────────────────────────

export async function list(req: Request, res: Response) {
  const { activa, tipo_tercero, moneda } = req.query;

  const where: any = { deleted_at: null, ...withTenant(req.empresaId!) };
  if (activa !== undefined) where.activa = activa === 'true';
  if (tipo_tercero) where.tipo_tercero = tipo_tercero;
  if (moneda) where.moneda = moneda;

  const cuentas = await prisma.cuentaCorriente.findMany({
    where,
    include: {
      proveedor:   { select: { id: true, nombre: true } },
      movimientos: {
        where:   { deleted_at: null },
        orderBy: [{ fecha: 'desc' }, { id: 'desc' }],
        take:    1,
        select:  { fecha: true, concepto: true, tipo: true, monto: true },
      },
    },
    orderBy: { nombre: 'asc' },
  });

  res.json(cuentas.map(c => ({
    ...mapCuenta(c),
    ultimo_movimiento: c.movimientos[0] ? { ...c.movimientos[0], monto: Number(c.movimientos[0].monto) } : null,
    movimientos: undefined,
  })));
}

// ── detail ────────────────────────────────────────────────────────────────────

export async function detail(req: Request, res: Response) {
  const id = Number(req.params.id);
  const c = await prisma.cuentaCorriente.findFirst({
    where:   { id, deleted_at: null, ...withTenant(req.empresaId!) },
    include: {
      proveedor: { select: { id: true, nombre: true, cuit: true } },
      partes:    true,
      movimientos: {
        where:   { deleted_at: null },
        orderBy: [{ fecha: 'desc' }, { id: 'desc' }],
        take:    20,
      },
    },
  });
  if (!c) { res.status(404).json({ error: 'Cuenta corriente no encontrada' }); return; }
  res.json(mapCuenta(c));
}

// ── create ────────────────────────────────────────────────────────────────────

export async function create(req: Request, res: Response) {
  const parsed = cuentaSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten() }); return;
  }
  const d = parsed.data;

  const errorPartes = validarSumaPartes(d.partes, d.tiene_reparto);
  if (errorPartes) { res.status(400).json({ error: errorPartes }); return; }

  if (d.tipo_tercero === 'PROVEEDOR') {
    const proveedor = await prisma.proveedor.findFirst({ where: { id: d.proveedor_id!, deleted_at: null, ...withTenant(req.empresaId!) } });
    if (!proveedor) { res.status(400).json({ error: 'Proveedor no encontrado' }); return; }
  }

  const cuenta = await prisma.cuentaCorriente.create({
    data: {
      ...withTenant(req.empresaId!),
      nombre:         d.nombre,
      tipo_tercero:   d.tipo_tercero as TipoTercero,
      proveedor_id:   d.tipo_tercero === 'PROVEEDOR' ? d.proveedor_id : null,
      tercero_nombre: d.tipo_tercero === 'PROVEEDOR' ? null : (d.tercero_nombre ?? null),
      tercero_cuit:   d.tercero_cuit ?? null,
      moneda:         d.moneda as MonedaCCC,
      descripcion:    d.descripcion ?? null,
      tiene_reparto:  d.tiene_reparto,
      created_by:     req.user!.id,
      updated_by:     req.user!.id,
      partes: d.tiene_reparto && d.partes
        ? { create: d.partes.map(p => ({ nombre: p.nombre, porcentaje: p.porcentaje })) }
        : undefined,
    },
    include: { proveedor: { select: { id: true, nombre: true } }, partes: true },
  });
  res.status(201).json(mapCuenta(cuenta));
}

// ── update ────────────────────────────────────────────────────────────────────

export async function update(req: Request, res: Response) {
  const id = Number(req.params.id);
  const c  = await findCuenta(id, req.empresaId!);
  if (!c) { res.status(404).json({ error: 'Cuenta corriente no encontrada' }); return; }

  const parsed = cuentaBaseSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten() }); return;
  }
  const d = parsed.data;

  const tieneReparto = d.tiene_reparto ?? c.tiene_reparto;
  if (d.partes !== undefined || d.tiene_reparto !== undefined) {
    const errorPartes = validarSumaPartes(d.partes, tieneReparto);
    if (errorPartes) { res.status(400).json({ error: errorPartes }); return; }
  }

  if (d.tipo_tercero === 'PROVEEDOR' && d.proveedor_id) {
    const proveedor = await prisma.proveedor.findFirst({ where: { id: d.proveedor_id, deleted_at: null, ...withTenant(req.empresaId!) } });
    if (!proveedor) { res.status(400).json({ error: 'Proveedor no encontrado' }); return; }
  }

  const cuenta = await prisma.$transaction(async tx => {
    if (d.partes !== undefined) {
      await tx.parteCCC.deleteMany({ where: { cuenta_ccc_id: id } });
    }
    return tx.cuentaCorriente.update({
      where: { id },
      data: {
        ...(d.nombre         !== undefined && { nombre: d.nombre }),
        ...(d.tipo_tercero   !== undefined && { tipo_tercero: d.tipo_tercero as TipoTercero }),
        ...(d.tipo_tercero   !== undefined && { proveedor_id: d.tipo_tercero === 'PROVEEDOR' ? d.proveedor_id ?? null : null }),
        ...(d.tipo_tercero   !== undefined && { tercero_nombre: d.tipo_tercero === 'PROVEEDOR' ? null : d.tercero_nombre ?? null }),
        ...(d.tercero_cuit   !== undefined && { tercero_cuit: d.tercero_cuit }),
        ...(d.moneda         !== undefined && { moneda: d.moneda as MonedaCCC }),
        ...(d.descripcion    !== undefined && { descripcion: d.descripcion }),
        ...(d.tiene_reparto  !== undefined && { tiene_reparto: d.tiene_reparto }),
        ...(d.partes         !== undefined && d.tiene_reparto !== false && {
          partes: { create: d.partes.map((p: { nombre: string; porcentaje: number }) => ({ nombre: p.nombre, porcentaje: p.porcentaje })) },
        }),
        updated_by: req.user!.id,
      },
      include: { proveedor: { select: { id: true, nombre: true } }, partes: true },
    });
  });
  res.json(mapCuenta(cuenta));
}

// ── remove ────────────────────────────────────────────────────────────────────

export async function remove(req: Request, res: Response) {
  const id = Number(req.params.id);
  const c  = await findCuenta(id, req.empresaId!);
  if (!c) { res.status(404).json({ error: 'Cuenta corriente no encontrada' }); return; }

  if (Number(c.saldo_actual) !== 0) {
    res.status(400).json({ error: `No se puede eliminar una cuenta con saldo distinto de 0 (actual: ${Number(c.saldo_actual)})` }); return;
  }

  await prisma.cuentaCorriente.update({
    where: { id },
    data:  { deleted_at: new Date(), updated_by: req.user!.id },
  });
  res.json({ message: 'Cuenta corriente eliminada correctamente' });
}

// ── listMovimientos ───────────────────────────────────────────────────────────

export async function listMovimientos(req: Request, res: Response) {
  const cuentaId = Number(req.params.id);
  const c = await findCuenta(cuentaId, req.empresaId!);
  if (!c) { res.status(404).json({ error: 'Cuenta corriente no encontrada' }); return; }

  const { desde, hasta, tipo, limit, offset } = req.query;
  const where: any = { cuenta_ccc_id: cuentaId, deleted_at: null };
  if (tipo) where.tipo = tipo;
  if (desde || hasta) {
    where.fecha = {};
    if (desde) where.fecha.gte = new Date(String(desde));
    if (hasta) where.fecha.lte = new Date(String(hasta));
  }

  const take = limit ? Math.min(Number(limit), 200) : 50;
  const skip = offset ? Number(offset) : 0;

  const [total, movimientos] = await Promise.all([
    prisma.movimientoCCC.count({ where }),
    prisma.movimientoCCC.findMany({
      where,
      include: {
        factura: { select: { id: true, numero_factura: true } },
        evento:  { select: { id: true, nombre: true } },
      },
      orderBy: [{ fecha: 'desc' }, { id: 'desc' }],
      take,
      skip,
    }),
  ]);

  res.json({ total, movimientos: movimientos.map(mapMovimiento) });
}

// ── createMovimiento ──────────────────────────────────────────────────────────

export async function createMovimiento(req: Request, res: Response) {
  const cuentaId = Number(req.params.id);
  const c = await findCuenta(cuentaId, req.empresaId!);
  if (!c) { res.status(404).json({ error: 'Cuenta corriente no encontrada' }); return; }

  // multipart/form-data → los valores llegan como strings
  const b = req.body;
  const body = {
    tipo:        b.tipo,
    fecha:       b.fecha,
    concepto:    b.concepto,
    descripcion: b.descripcion || null,
    monto:       b.monto       !== undefined ? parseFloat(b.monto)       : undefined,
    moneda:      b.moneda      || c.moneda,
    tasa_cambio: b.tasa_cambio ? parseFloat(b.tasa_cambio) : null,
    factura_id:  b.factura_id  ? parseInt(b.factura_id)    : null,
    evento_id:   b.evento_id   ? parseInt(b.evento_id)     : null,
  };

  const parsed = movimientoSchema.safeParse(body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten() }); return;
  }
  const d = parsed.data;

  if (d.factura_id) {
    const factura = await prisma.factura.findFirst({ where: { id: d.factura_id, deleted_at: null, ...withTenant(req.empresaId!) } });
    if (!factura) { res.status(400).json({ error: 'Factura no encontrada' }); return; }
  }
  if (d.evento_id) {
    const evento = await prisma.evento.findFirst({ where: { id: d.evento_id, deleted_at: null, ...withTenant(req.empresaId!) } });
    if (!evento) { res.status(400).json({ error: 'Evento no encontrado' }); return; }
  }

  const montoArs = calcularMontoArs(d.moneda as MonedaCCC, d.monto, d.tasa_cambio);

  const result = await prisma.$transaction(async tx => {
    const mov = await tx.movimientoCCC.create({
      data: {
        cuenta_ccc_id: cuentaId,
        ...withTenant(req.empresaId!),
        tipo:        d.tipo as TipoMovCCC,
        fecha:       new Date(d.fecha),
        concepto:    d.concepto,
        descripcion: d.descripcion ?? null,
        monto:       d.monto,
        moneda:      d.moneda as MonedaCCC,
        tasa_cambio: d.tasa_cambio ?? null,
        monto_ars:   montoArs,
        factura_id:  d.factura_id ?? null,
        evento_id:   d.evento_id  ?? null,
        documento_data:    req.file?.buffer       ?? null,
        documento_nombre:  req.file?.originalname ?? null,
        documento_mime:    req.file?.mimetype     ?? null,
        documento_tamanio: req.file?.size         ?? null,
        created_by: req.user!.id,
        updated_by: req.user!.id,
      },
    });

    await recalcularSaldoCCC(cuentaId, tx as unknown as Prisma.TransactionClient);

    await registrarAuditoria({
      usuarioId:    req.user!.id,
      empresaId:    req.empresaId,
      accion:       'CREATE',
      entidad:      'MovimientoCCC',
      entidadId:    mov.id,
      eventoId:     d.evento_id ?? undefined,
      descripcion:  `${d.tipo} ${d.monto} ${d.moneda} en cuenta corriente "${c.nombre}"`,
      datosDespues: { tipo: d.tipo, monto: d.monto, moneda: d.moneda },
      ip:           req.ip,
      tx:           tx as any,
    });

    return tx.movimientoCCC.findUniqueOrThrow({ where: { id: mov.id } });
  });

  res.status(201).json(mapMovimiento(result));
}

// ── updateMovimiento ──────────────────────────────────────────────────────────

export async function updateMovimiento(req: Request, res: Response) {
  const id  = Number(req.params.id);
  const mov = await prisma.movimientoCCC.findFirst({ where: { id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!mov) { res.status(404).json({ error: 'Movimiento no encontrado' }); return; }

  const parsed = movimientoBaseSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten() }); return;
  }
  const d = parsed.data;

  if (d.factura_id) {
    const factura = await prisma.factura.findFirst({ where: { id: d.factura_id, deleted_at: null, ...withTenant(req.empresaId!) } });
    if (!factura) { res.status(400).json({ error: 'Factura no encontrada' }); return; }
  }
  if (d.evento_id) {
    const evento = await prisma.evento.findFirst({ where: { id: d.evento_id, deleted_at: null, ...withTenant(req.empresaId!) } });
    if (!evento) { res.status(400).json({ error: 'Evento no encontrado' }); return; }
  }

  const nuevaMoneda = (d.moneda as MonedaCCC | undefined) ?? mov.moneda;
  const nuevoMonto  = d.monto ?? Number(mov.monto);
  const nuevaTasa   = d.tasa_cambio !== undefined ? d.tasa_cambio : (mov.tasa_cambio ? Number(mov.tasa_cambio) : null);
  const montoArs    = calcularMontoArs(nuevaMoneda, nuevoMonto, nuevaTasa);

  const result = await prisma.$transaction(async tx => {
    await tx.movimientoCCC.update({
      where: { id },
      data: {
        ...(d.tipo        !== undefined && { tipo: d.tipo as TipoMovCCC }),
        ...(d.fecha        !== undefined && { fecha: new Date(d.fecha) }),
        ...(d.concepto     !== undefined && { concepto: d.concepto }),
        ...(d.descripcion  !== undefined && { descripcion: d.descripcion }),
        ...(d.monto        !== undefined && { monto: d.monto }),
        ...(d.moneda       !== undefined && { moneda: d.moneda as MonedaCCC }),
        ...(d.tasa_cambio  !== undefined && { tasa_cambio: d.tasa_cambio }),
        ...(d.factura_id   !== undefined && { factura_id: d.factura_id }),
        ...(d.evento_id    !== undefined && { evento_id: d.evento_id }),
        monto_ars:  montoArs,
        updated_by: req.user!.id,
      },
    });

    await recalcularSaldoCCC(mov.cuenta_ccc_id, tx as unknown as Prisma.TransactionClient);

    await registrarAuditoria({
      usuarioId:   req.user!.id,
      empresaId:   req.empresaId,
      accion:      'UPDATE',
      entidad:     'MovimientoCCC',
      entidadId:   id,
      descripcion: `Edición de movimiento #${id}`,
      ip:          req.ip,
      tx:          tx as any,
    });

    return tx.movimientoCCC.findUniqueOrThrow({ where: { id } });
  });

  res.json(mapMovimiento(result));
}

// ── removeMovimiento ──────────────────────────────────────────────────────────

export async function removeMovimiento(req: Request, res: Response) {
  const id  = Number(req.params.id);
  const mov = await prisma.movimientoCCC.findFirst({ where: { id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!mov) { res.status(404).json({ error: 'Movimiento no encontrado' }); return; }

  await prisma.$transaction(async tx => {
    await tx.movimientoCCC.update({
      where: { id },
      data:  { deleted_at: new Date(), updated_by: req.user!.id },
    });
    await recalcularSaldoCCC(mov.cuenta_ccc_id, tx as unknown as Prisma.TransactionClient);

    await registrarAuditoria({
      usuarioId:   req.user!.id,
      empresaId:   req.empresaId,
      accion:      'DELETE',
      entidad:     'MovimientoCCC',
      entidadId:   id,
      descripcion: `Baja de movimiento #${id}`,
      ip:          req.ip,
      tx:          tx as any,
    });
  });

  res.json({ message: 'Movimiento eliminado correctamente' });
}

// ── documento (GET/PUT) ───────────────────────────────────────────────────────

export async function getDocumento(req: Request, res: Response) {
  const id  = Number(req.params.id);
  const mov = await prisma.movimientoCCC.findFirst({
    where:  { id, deleted_at: null, ...withTenant(req.empresaId!) },
    select: { documento_data: true, documento_mime: true, documento_nombre: true },
  });
  if (!mov)                  { res.status(404).json({ error: 'Movimiento no encontrado' }); return; }
  if (!mov.documento_data)   { res.status(404).json({ error: 'Este movimiento no tiene documento adjunto' }); return; }

  const buffer   = Buffer.from(mov.documento_data);
  const filename = encodeURIComponent(mov.documento_nombre ?? 'documento');

  res.setHeader('Content-Type',        mov.documento_mime ?? 'application/octet-stream');
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  res.setHeader('Content-Length',      buffer.length);
  res.end(buffer);
}

export async function updateDocumento(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (!req.file) { res.status(400).json({ error: 'Se requiere un archivo' }); return; }

  const mov = await prisma.movimientoCCC.findFirst({ where: { id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!mov) { res.status(404).json({ error: 'Movimiento no encontrado' }); return; }

  await prisma.movimientoCCC.update({
    where: { id },
    data: {
      documento_data:    req.file.buffer,
      documento_nombre:  req.file.originalname,
      documento_mime:    req.file.mimetype,
      documento_tamanio: req.file.size,
      updated_by:        req.user!.id,
    },
  });
  res.json({ message: 'Documento actualizado correctamente' });
}

// ── exportar ──────────────────────────────────────────────────────────────────

export async function exportar(req: Request, res: Response) {
  const id = Number(req.params.id);
  const c  = await findCuenta(id, req.empresaId!);
  if (!c) { res.status(404).json({ error: 'Cuenta corriente no encontrada' }); return; }

  const { generateCuentaCorrienteExcel } = await import('../lib/excelExporter');
  const { buffer, filename } = await generateCuentaCorrienteExcel(id);

  await registrarAuditoria({
    usuarioId:   req.user!.id,
    empresaId:   req.empresaId,
    accion:      'EXPORT',
    entidad:     'CuentaCorriente',
    entidadId:   id,
    descripcion: `Exportó Excel de la cuenta corriente "${c.nombre}"`,
    ip:          req.ip,
    tx:          prisma as any,
  });

  res.set({
    'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Content-Length':      String(buffer.length),
  });
  res.end(buffer);
}
