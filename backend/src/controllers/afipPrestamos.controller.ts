import type { Request, Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { EstadoPlanAFIP, EstadoPrestamo } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { withTenant } from '../lib/tenant';

// ── Multer (documentos) ──────────────────────────────────────────────────────

export const uploadDocumento = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Solo se aceptan archivos PDF o imágenes'));
  },
});

// ── Helpers de fecha ──────────────────────────────────────────────────────────
// Fechas de negocio en UTC (mismo criterio que fmtDate/excelExporter y
// calendario.controller — nunca componentes locales). Suma meses "clampeando"
// el día al último día del mes destino si el mes de origen tiene más días
// (ej: 31 ene + 1 mes -> 28/29 feb, no "rueda" a marzo).
function addMesesUTC(fecha: Date, meses: number): Date {
  const anio = fecha.getUTCFullYear();
  const mes  = fecha.getUTCMonth();
  const dia  = fecha.getUTCDate();
  const primerDiaDestino  = new Date(Date.UTC(anio, mes + meses, 1));
  const diasEnMesDestino  = new Date(Date.UTC(primerDiaDestino.getUTCFullYear(), primerDiaDestino.getUTCMonth() + 1, 0)).getUTCDate();
  const diaClamp          = Math.min(dia, diasEnMesDestino);
  return new Date(Date.UTC(primerDiaDestino.getUTCFullYear(), primerDiaDestino.getUTCMonth(), diaClamp));
}

function parseFechaUTC(s: string): Date {
  // Acepta 'YYYY-MM-DD' o un ISO completo — ambos se normalizan a medianoche UTC del día.
  const soloFecha = s.slice(0, 10);
  return new Date(`${soloFecha}T00:00:00.000Z`);
}

const num = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

// ── Acceso multi-empresa (admin global / puede_ver_macro) ───────────────────
// Mismo criterio que resolveEmpresaFiltro() en calendario.controller.ts y
// esAdminGlobal() en auth.controller.ts: un ADMIN sin empresa fija en su fila
// de Usuario ve todas las empresas activas; un usuario con puede_ver_macro
// (ej. Mayra) ve las de su UsuarioEmpresaAcceso aunque no sea admin global;
// cualquier otro usuario queda fijo a su empresa activa de sesión.

interface AccesoEmpresas {
  esAdminGlobal: boolean;
  // undefined = sin restricción (admin global ve todas las empresas activas)
  empresaIds:    number[] | undefined;
}

async function getAccesoEmpresas(req: Request, res: Response): Promise<{ ok: true; info: AccesoEmpresas } | { ok: false }> {
  const usuario = await prisma.usuario.findFirst({
    where:  { id: req.user!.id, deleted_at: null },
    select: { empresa_id: true, puede_ver_macro: true },
  });
  if (!usuario) { res.status(401).json({ error: 'Sesión inválida' }); return { ok: false }; }

  const esAdminGlobal = req.user!.rol === 'ADMIN' && usuario.empresa_id === null;
  if (esAdminGlobal) return { ok: true, info: { esAdminGlobal: true, empresaIds: undefined } };

  if (usuario.puede_ver_macro) {
    const accesos = await prisma.usuarioEmpresaAcceso.findMany({
      where:  { usuario_id: req.user!.id },
      select: { empresa_id: true },
    });
    return { ok: true, info: { esAdminGlobal: false, empresaIds: accesos.map(a => a.empresa_id) } };
  }

  return { ok: true, info: { esAdminGlobal: false, empresaIds: [req.empresaId!] } };
}

// Where-clause a nivel PlanAFIP/PrestamoBancario según el acceso resuelto —
// sin filtro para admin global (empresaIds undefined).
function scopeWhere(info: AccesoEmpresas): Record<string, unknown> {
  return info.empresaIds !== undefined ? { empresa_id: { in: info.empresaIds } } : {};
}

// Resuelve a qué empresa se crea un plan/préstamo nuevo: si el body no manda
// empresa_id, la empresa activa de la sesión (comportamiento de siempre). Si
// la manda, sólo se respeta cuando el usuario tiene acceso a esa empresa
// (admin global: cualquiera activa; puede_ver_macro: las de su acceso); un
// usuario común que manda una empresa_id distinta a la suya recibe 400.
async function resolveEmpresaDestino(req: Request, res: Response, bodyEmpresaId: number | null | undefined): Promise<{ ok: true; empresaId: number } | { ok: false }> {
  if (bodyEmpresaId == null) return { ok: true, empresaId: req.empresaId! };

  const acceso = await getAccesoEmpresas(req, res);
  if (!acceso.ok) return { ok: false };
  const { esAdminGlobal, empresaIds } = acceso.info;

  if (!esAdminGlobal && empresaIds !== undefined && !empresaIds.includes(bodyEmpresaId)) {
    res.status(400).json({ error: 'Sin permisos para esa empresa' });
    return { ok: false };
  }

  if (esAdminGlobal) {
    const empresa = await prisma.empresa.findFirst({ where: { id: bodyEmpresaId, activo: true } });
    if (!empresa) { res.status(400).json({ error: 'Empresa inválida' }); return { ok: false }; }
  }

  return { ok: true, empresaId: bodyEmpresaId };
}

const EMPRESA_SELECT = { select: { id: true, nombre: true, nombre_corto: true } } as const;

// ══════════════════════════════════════════════════════════════════════════════
// ── AFIP ──────────────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

const planAfipCreateSchema = z.object({
  empresa_id:           z.number().int().positive().nullable().optional(),
  descripcion:          z.string().min(1),
  numero_plan:          z.string().nullable().optional(),
  fecha_inicio:         z.string().min(1),
  capital_original:     z.number().positive(),
  cantidad_cuotas:      z.number().int().positive(),
  valor_cuota_aprox:    z.number().positive().nullable().optional(),
  interes_financiero:   z.number().nullable().optional(),
  interes_resarcitorio: z.number().nullable().optional(),
  titular_nombre:       z.string().nullable().optional(),
  titular_cuit:         z.string().nullable().optional(),
  notas:                z.string().nullable().optional(),
});

const planAfipUpdateSchema = planAfipCreateSchema.omit({ empresa_id: true }).partial().extend({
  estado: z.enum(['ACTIVO', 'CANCELADO', 'FINALIZADO', 'CADUCADO']).optional(),
});

function mapCuotaAfip(c: any) {
  return { ...c, capital: num(c.capital), interes: num(c.interes), total_cuota: num(c.total_cuota) };
}

function resumenCuotasAfip(cuotas: { pagada: boolean; total_cuota: any; fecha_debito: Date }[]) {
  const pagadas     = cuotas.filter(c => c.pagada);
  const pendientes  = cuotas.filter(c => !c.pagada).sort((a, b) => a.fecha_debito.getTime() - b.fecha_debito.getTime());
  return {
    cuotas_pagadas:    pagadas.length,
    cuotas_pendientes: pendientes.length,
    proxima_cuota:     pendientes[0] ? mapCuotaAfip(pendientes[0]) : null,
    total_pagado:      pagadas.reduce((s, c) => s + Number(c.total_cuota), 0),
    saldo_pendiente:   pendientes.reduce((s, c) => s + Number(c.total_cuota), 0),
  };
}

function mapPlanAfip(p: any) {
  const { cuotas, documentos, ...rest } = p;
  return {
    ...rest,
    capital_original:     num(rest.capital_original),
    valor_cuota_aprox:    num(rest.valor_cuota_aprox),
    interes_financiero:   num(rest.interes_financiero),
    interes_resarcitorio: num(rest.interes_resarcitorio),
    ...(cuotas ? resumenCuotasAfip(cuotas) : {}),
    ...(cuotas ? { cuotas: cuotas.map(mapCuotaAfip) } : {}),
    ...(documentos ? { documentos: documentos.map((d: any) => ({ ...d, archivo_data: undefined })) } : {}),
  };
}

// GET /api/afip/planes
export async function listPlanesAFIP(req: Request, res: Response) {
  const { estado, titular_cuit } = req.query as { estado?: string; titular_cuit?: string };

  const acceso = await getAccesoEmpresas(req, res);
  if (!acceso.ok) return;

  const planes = await prisma.planAFIP.findMany({
    where: {
      deleted_at: null,
      ...scopeWhere(acceso.info),
      ...(estado && { estado: estado as EstadoPlanAFIP }),
      ...(titular_cuit && { titular_cuit }),
    },
    include: { cuotas: true, empresa: EMPRESA_SELECT },
    orderBy: { fecha_inicio: 'desc' },
  });
  res.json(planes.map(mapPlanAfip));
}

// GET /api/afip/planes/:id
export async function detallePlanAFIP(req: Request, res: Response) {
  const id = Number(req.params.id);

  const acceso = await getAccesoEmpresas(req, res);
  if (!acceso.ok) return;

  const plan = await prisma.planAFIP.findFirst({
    where:   { id, deleted_at: null, ...scopeWhere(acceso.info) },
    include: {
      cuotas:     { orderBy: { numero_cuota: 'asc' } },
      documentos: { orderBy: { created_at: 'desc' } },
      empresa:    EMPRESA_SELECT,
    },
  });
  if (!plan) { res.status(404).json({ error: 'Plan no encontrado' }); return; }
  res.json(mapPlanAfip(plan));
}

// POST /api/afip/planes
export async function createPlanAFIP(req: Request, res: Response) {
  const parsed = planAfipCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return;
  }
  const d = parsed.data;
  const fechaInicio = parseFechaUTC(d.fecha_inicio);

  const destino = await resolveEmpresaDestino(req, res, d.empresa_id);
  if (!destino.ok) return;

  const plan = await prisma.$transaction(async tx => {
    const nuevo = await tx.planAFIP.create({
      data: {
        ...withTenant(destino.empresaId),
        descripcion:          d.descripcion,
        numero_plan:          d.numero_plan          ?? null,
        fecha_inicio:         fechaInicio,
        capital_original:     d.capital_original,
        cantidad_cuotas:      d.cantidad_cuotas,
        valor_cuota_aprox:    d.valor_cuota_aprox     ?? null,
        interes_financiero:   d.interes_financiero    ?? null,
        interes_resarcitorio: d.interes_resarcitorio  ?? null,
        titular_nombre:       d.titular_nombre        ?? null,
        titular_cuit:         d.titular_cuit          ?? null,
        notas:                d.notas                 ?? null,
        created_by:           req.user!.id,
      },
    });

    if (d.valor_cuota_aprox) {
      await tx.cuotaPlanAFIP.createMany({
        data: Array.from({ length: d.cantidad_cuotas }, (_, i) => ({
          plan_id:      nuevo.id,
          numero_cuota: i + 1,
          fecha_debito: addMesesUTC(fechaInicio, i),
          total_cuota:  d.valor_cuota_aprox!,
        })),
      });
    }

    return tx.planAFIP.findUniqueOrThrow({ where: { id: nuevo.id }, include: { cuotas: { orderBy: { numero_cuota: 'asc' } } } });
  });

  res.status(201).json(mapPlanAfip(plan));
}

// PUT /api/afip/planes/:id
export async function updatePlanAFIP(req: Request, res: Response) {
  const id = Number(req.params.id);

  const acceso = await getAccesoEmpresas(req, res);
  if (!acceso.ok) return;

  const plan = await prisma.planAFIP.findFirst({ where: { id, deleted_at: null, ...scopeWhere(acceso.info) } });
  if (!plan) { res.status(404).json({ error: 'Plan no encontrado' }); return; }

  const parsed = planAfipUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return;
  }
  const d = parsed.data;

  const updated = await prisma.planAFIP.update({
    where: { id },
    data: {
      ...(d.descripcion          !== undefined && { descripcion:          d.descripcion }),
      ...(d.numero_plan          !== undefined && { numero_plan:          d.numero_plan }),
      ...(d.fecha_inicio         !== undefined && { fecha_inicio:         parseFechaUTC(d.fecha_inicio) }),
      ...(d.capital_original     !== undefined && { capital_original:     d.capital_original }),
      ...(d.cantidad_cuotas      !== undefined && { cantidad_cuotas:      d.cantidad_cuotas }),
      ...(d.valor_cuota_aprox    !== undefined && { valor_cuota_aprox:    d.valor_cuota_aprox }),
      ...(d.interes_financiero   !== undefined && { interes_financiero:   d.interes_financiero }),
      ...(d.interes_resarcitorio !== undefined && { interes_resarcitorio: d.interes_resarcitorio }),
      ...(d.titular_nombre       !== undefined && { titular_nombre:       d.titular_nombre }),
      ...(d.titular_cuit         !== undefined && { titular_cuit:         d.titular_cuit }),
      ...(d.notas                !== undefined && { notas:                d.notas }),
      ...(d.estado               !== undefined && { estado:               d.estado as EstadoPlanAFIP }),
    },
    include: { cuotas: { orderBy: { numero_cuota: 'asc' } } },
  });
  res.json(mapPlanAfip(updated));
}

// PATCH /api/afip/cuotas/:id/pagar
const pagarCuotaSchema = z.object({ fecha_pago_real: z.string().min(1) });

export async function pagarCuotaAFIP(req: Request, res: Response) {
  const id = Number(req.params.id);
  const parsed = pagarCuotaSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return;
  }

  const acceso = await getAccesoEmpresas(req, res);
  if (!acceso.ok) return;

  const cuota = await prisma.cuotaPlanAFIP.findFirst({
    where: { id, plan: { deleted_at: null, ...scopeWhere(acceso.info) } },
  });
  if (!cuota) { res.status(404).json({ error: 'Cuota no encontrada' }); return; }

  await prisma.$transaction(async tx => {
    await tx.cuotaPlanAFIP.update({
      where: { id },
      data:  { pagada: true, fecha_pago_real: parseFechaUTC(parsed.data.fecha_pago_real) },
    });

    const pendientes = await tx.cuotaPlanAFIP.count({ where: { plan_id: cuota.plan_id, pagada: false } });
    if (pendientes === 0) {
      await tx.planAFIP.update({ where: { id: cuota.plan_id }, data: { estado: EstadoPlanAFIP.FINALIZADO } });
    }
  });

  const actualizado = await prisma.cuotaPlanAFIP.findUniqueOrThrow({ where: { id } });
  res.json(mapCuotaAfip(actualizado));
}

// ── Documentos de Plan AFIP ───────────────────────────────────────────────────

export async function subirDocumentoPlanAFIP(req: Request, res: Response) {
  const planId = Number(req.params.id);
  if (!req.file) { res.status(400).json({ error: 'Se requiere un archivo' }); return; }

  const acceso = await getAccesoEmpresas(req, res);
  if (!acceso.ok) return;

  const plan = await prisma.planAFIP.findFirst({ where: { id: planId, deleted_at: null, ...scopeWhere(acceso.info) } });
  if (!plan) { res.status(404).json({ error: 'Plan no encontrado' }); return; }

  const { nombre, descripcion } = req.body as { nombre?: string; descripcion?: string };

  const doc = await prisma.documentoPlanAFIP.create({
    data: {
      plan_id:      planId,
      nombre:       nombre?.trim() || req.file.originalname,
      descripcion:  descripcion || null,
      archivo_data: req.file.buffer,
      archivo_mime: req.file.mimetype,
      archivo_size: req.file.size,
      created_by:   req.user!.id,
    },
  });
  res.status(201).json({ ...doc, archivo_data: undefined });
}

export async function descargarDocumentoPlanAFIP(req: Request, res: Response) {
  const planId = Number(req.params.id);
  const docId  = Number(req.params.docId);

  const acceso = await getAccesoEmpresas(req, res);
  if (!acceso.ok) return;

  const doc = await prisma.documentoPlanAFIP.findFirst({
    where: { id: docId, plan_id: planId, plan: { deleted_at: null, ...scopeWhere(acceso.info) } },
  });
  if (!doc) { res.status(404).json({ error: 'Documento no encontrado' }); return; }

  const buffer   = Buffer.from(doc.archivo_data);
  const filename = encodeURIComponent(doc.nombre);
  res.setHeader('Content-Type',        doc.archivo_mime);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length',      buffer.length);
  res.end(buffer);
}

export async function eliminarDocumentoPlanAFIP(req: Request, res: Response) {
  const planId = Number(req.params.id);
  const docId  = Number(req.params.docId);

  const acceso = await getAccesoEmpresas(req, res);
  if (!acceso.ok) return;

  const doc = await prisma.documentoPlanAFIP.findFirst({
    where: { id: docId, plan_id: planId, plan: { deleted_at: null, ...scopeWhere(acceso.info) } },
  });
  if (!doc) { res.status(404).json({ error: 'Documento no encontrado' }); return; }

  await prisma.documentoPlanAFIP.delete({ where: { id: docId } });
  res.json({ message: 'Documento eliminado correctamente' });
}

// ══════════════════════════════════════════════════════════════════════════════
// ── PRÉSTAMOS BANCARIOS ───────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

const cuotaPrestamoInputSchema = z.object({
  numero_cuota:      z.number().int().positive(),
  fecha_vencimiento: z.string().min(1),
  capital:           z.number().nullable().optional(),
  interes:           z.number().nullable().optional(),
  iva_interes:       z.number().nullable().optional(),
  seguro:            z.number().nullable().optional(),
  otros_impuestos:   z.number().nullable().optional(),
  total_cuota:       z.number(),
});

const prestamoCreateSchema = z.object({
  empresa_id:          z.number().int().positive().nullable().optional(),
  entidad:             z.string().min(1),
  numero_operacion:    z.string().nullable().optional(),
  tipo:                z.string().nullable().optional(),
  fecha_otorgamiento:  z.string().min(1),
  capital_original:    z.number().positive(),
  moneda:              z.enum(['ARS', 'USD', 'EUR']).default('ARS'),
  tasa_nominal_anual:  z.number().nullable().optional(),
  tasa_efectiva_anual: z.number().nullable().optional(),
  cantidad_cuotas:     z.number().int().positive(),
  dia_debito:          z.number().int().min(1).max(31).nullable().optional(),
  notas:               z.string().nullable().optional(),
  cuotas:              z.array(cuotaPrestamoInputSchema).optional(),
});

const prestamoUpdateSchema = prestamoCreateSchema.omit({ cuotas: true, empresa_id: true }).partial().extend({
  estado: z.enum(['ACTIVO', 'CANCELADO_ANTICIPADO', 'FINALIZADO']).optional(),
});

const cuotaPrestamoUpdateSchema = z.object({
  fecha_vencimiento: z.string().min(1).optional(),
  capital:           z.number().nullable().optional(),
  interes:           z.number().nullable().optional(),
  iva_interes:       z.number().nullable().optional(),
  seguro:            z.number().nullable().optional(),
  otros_impuestos:   z.number().nullable().optional(),
  total_cuota:       z.number().optional(),
  notas:             z.string().nullable().optional(),
});

function mapCuotaPrestamo(c: any) {
  return {
    ...c,
    capital:         num(c.capital),
    interes:         num(c.interes),
    iva_interes:     num(c.iva_interes),
    seguro:          num(c.seguro),
    otros_impuestos: num(c.otros_impuestos),
    total_cuota:     num(c.total_cuota),
  };
}

function resumenCuotasPrestamo(cuotas: { pagada: boolean; total_cuota: any; capital: any; fecha_vencimiento: Date }[], capitalOriginal: number, cantidadCuotas: number) {
  const pagadas    = cuotas.filter(c => c.pagada);
  const pendientes = cuotas.filter(c => !c.pagada).sort((a, b) => a.fecha_vencimiento.getTime() - b.fecha_vencimiento.getTime());
  const capitalPorCuotaDefault = cantidadCuotas > 0 ? capitalOriginal / cantidadCuotas : 0;
  return {
    cuotas_pagadas:          pagadas.length,
    cuotas_pendientes:       pendientes.length,
    proxima_cuota:           pendientes[0] ? mapCuotaPrestamo(pendientes[0]) : null,
    saldo_capital_pendiente: pendientes.reduce((s, c) => s + (c.capital !== null ? Number(c.capital) : capitalPorCuotaDefault), 0),
  };
}

function mapPrestamo(p: any) {
  const { cuotas, documentos, ...rest } = p;
  return {
    ...rest,
    capital_original:    num(rest.capital_original),
    tasa_nominal_anual:  num(rest.tasa_nominal_anual),
    tasa_efectiva_anual: num(rest.tasa_efectiva_anual),
    ...(cuotas ? resumenCuotasPrestamo(cuotas, Number(rest.capital_original), rest.cantidad_cuotas) : {}),
    ...(cuotas ? { cuotas: cuotas.map(mapCuotaPrestamo) } : {}),
    ...(documentos ? { documentos: documentos.map((d: any) => ({ ...d, archivo_data: undefined })) } : {}),
  };
}

// GET /api/prestamos
export async function listPrestamos(req: Request, res: Response) {
  const { estado, entidad } = req.query as { estado?: string; entidad?: string };

  const acceso = await getAccesoEmpresas(req, res);
  if (!acceso.ok) return;

  const prestamos = await prisma.prestamoBancario.findMany({
    where: {
      deleted_at: null,
      ...scopeWhere(acceso.info),
      ...(estado && { estado: estado as EstadoPrestamo }),
      ...(entidad && { entidad: { contains: entidad, mode: 'insensitive' } }),
    },
    include: { cuotas: true, empresa: EMPRESA_SELECT },
    orderBy: { fecha_otorgamiento: 'desc' },
  });
  res.json(prestamos.map(mapPrestamo));
}

// GET /api/prestamos/:id
export async function detallePrestamo(req: Request, res: Response) {
  const id = Number(req.params.id);

  const acceso = await getAccesoEmpresas(req, res);
  if (!acceso.ok) return;

  const prestamo = await prisma.prestamoBancario.findFirst({
    where:   { id, deleted_at: null, ...scopeWhere(acceso.info) },
    include: {
      cuotas:     { orderBy: { numero_cuota: 'asc' } },
      documentos: { orderBy: { created_at: 'desc' } },
      empresa:    EMPRESA_SELECT,
    },
  });
  if (!prestamo) { res.status(404).json({ error: 'Préstamo no encontrado' }); return; }
  res.json(mapPrestamo(prestamo));
}

// POST /api/prestamos
export async function createPrestamo(req: Request, res: Response) {
  const parsed = prestamoCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return;
  }
  const d = parsed.data;
  const fechaOtorgamiento = parseFechaUTC(d.fecha_otorgamiento);

  if (d.cuotas && d.cuotas.length !== d.cantidad_cuotas) {
    res.status(400).json({ error: `Se esperaban ${d.cantidad_cuotas} cuotas y se recibieron ${d.cuotas.length}` }); return;
  }

  const destino = await resolveEmpresaDestino(req, res, d.empresa_id);
  if (!destino.ok) return;

  const prestamo = await prisma.$transaction(async tx => {
    const nuevo = await tx.prestamoBancario.create({
      data: {
        ...withTenant(destino.empresaId),
        entidad:             d.entidad,
        numero_operacion:    d.numero_operacion    ?? null,
        tipo:                d.tipo                ?? null,
        fecha_otorgamiento:  fechaOtorgamiento,
        capital_original:    d.capital_original,
        moneda:              d.moneda,
        tasa_nominal_anual:  d.tasa_nominal_anual   ?? null,
        tasa_efectiva_anual: d.tasa_efectiva_anual  ?? null,
        cantidad_cuotas:     d.cantidad_cuotas,
        dia_debito:          d.dia_debito           ?? null,
        notas:               d.notas                ?? null,
        created_by:          req.user!.id,
      },
    });

    if (d.cuotas && d.cuotas.length > 0) {
      await tx.cuotaPrestamo.createMany({
        data: d.cuotas.map(c => ({
          prestamo_id:       nuevo.id,
          numero_cuota:      c.numero_cuota,
          fecha_vencimiento: parseFechaUTC(c.fecha_vencimiento),
          capital:           c.capital         ?? null,
          interes:           c.interes         ?? null,
          iva_interes:       c.iva_interes     ?? null,
          seguro:            c.seguro          ?? null,
          otros_impuestos:   c.otros_impuestos ?? null,
          total_cuota:       c.total_cuota,
        })),
      });
    } else {
      const cuotaFija = d.capital_original / d.cantidad_cuotas;
      const diaBase   = d.dia_debito ?? fechaOtorgamiento.getUTCDate();
      const primerVencimientoBase = new Date(Date.UTC(fechaOtorgamiento.getUTCFullYear(), fechaOtorgamiento.getUTCMonth(), diaBase));
      await tx.cuotaPrestamo.createMany({
        data: Array.from({ length: d.cantidad_cuotas }, (_, i) => ({
          prestamo_id:       nuevo.id,
          numero_cuota:      i + 1,
          fecha_vencimiento: addMesesUTC(primerVencimientoBase, i + 1),
          capital:           cuotaFija,
          total_cuota:       cuotaFija,
        })),
      });
    }

    return tx.prestamoBancario.findUniqueOrThrow({ where: { id: nuevo.id }, include: { cuotas: { orderBy: { numero_cuota: 'asc' } } } });
  });

  res.status(201).json(mapPrestamo(prestamo));
}

// PUT /api/prestamos/:id
export async function updatePrestamo(req: Request, res: Response) {
  const id = Number(req.params.id);

  const acceso = await getAccesoEmpresas(req, res);
  if (!acceso.ok) return;

  const prestamo = await prisma.prestamoBancario.findFirst({ where: { id, deleted_at: null, ...scopeWhere(acceso.info) } });
  if (!prestamo) { res.status(404).json({ error: 'Préstamo no encontrado' }); return; }

  const parsed = prestamoUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return;
  }
  const d = parsed.data;

  const updated = await prisma.prestamoBancario.update({
    where: { id },
    data: {
      ...(d.entidad             !== undefined && { entidad:             d.entidad }),
      ...(d.numero_operacion    !== undefined && { numero_operacion:    d.numero_operacion }),
      ...(d.tipo                !== undefined && { tipo:                d.tipo }),
      ...(d.fecha_otorgamiento  !== undefined && { fecha_otorgamiento:  parseFechaUTC(d.fecha_otorgamiento) }),
      ...(d.capital_original    !== undefined && { capital_original:    d.capital_original }),
      ...(d.moneda              !== undefined && { moneda:              d.moneda }),
      ...(d.tasa_nominal_anual  !== undefined && { tasa_nominal_anual:  d.tasa_nominal_anual }),
      ...(d.tasa_efectiva_anual !== undefined && { tasa_efectiva_anual: d.tasa_efectiva_anual }),
      ...(d.cantidad_cuotas     !== undefined && { cantidad_cuotas:     d.cantidad_cuotas }),
      ...(d.dia_debito          !== undefined && { dia_debito:          d.dia_debito }),
      ...(d.notas               !== undefined && { notas:               d.notas }),
      ...(d.estado              !== undefined && { estado:              d.estado as EstadoPrestamo }),
    },
    include: { cuotas: { orderBy: { numero_cuota: 'asc' } } },
  });
  res.json(mapPrestamo(updated));
}

// PATCH /api/prestamos/cuotas/:id/pagar
export async function pagarCuotaPrestamo(req: Request, res: Response) {
  const id = Number(req.params.id);
  const parsed = pagarCuotaSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return;
  }

  const acceso = await getAccesoEmpresas(req, res);
  if (!acceso.ok) return;

  const cuota = await prisma.cuotaPrestamo.findFirst({
    where: { id, prestamo: { deleted_at: null, ...scopeWhere(acceso.info) } },
  });
  if (!cuota) { res.status(404).json({ error: 'Cuota no encontrada' }); return; }

  await prisma.$transaction(async tx => {
    await tx.cuotaPrestamo.update({
      where: { id },
      data:  { pagada: true, fecha_pago_real: parseFechaUTC(parsed.data.fecha_pago_real) },
    });

    const pendientes = await tx.cuotaPrestamo.count({ where: { prestamo_id: cuota.prestamo_id, pagada: false } });
    if (pendientes === 0) {
      await tx.prestamoBancario.update({ where: { id: cuota.prestamo_id }, data: { estado: EstadoPrestamo.FINALIZADO } });
    }
  });

  const actualizada = await prisma.cuotaPrestamo.findUniqueOrThrow({ where: { id } });
  res.json(mapCuotaPrestamo(actualizada));
}

// PUT /api/prestamos/cuotas/:id
export async function updateCuotaPrestamo(req: Request, res: Response) {
  const id = Number(req.params.id);

  const acceso = await getAccesoEmpresas(req, res);
  if (!acceso.ok) return;

  const cuota = await prisma.cuotaPrestamo.findFirst({
    where: { id, prestamo: { deleted_at: null, ...scopeWhere(acceso.info) } },
  });
  if (!cuota) { res.status(404).json({ error: 'Cuota no encontrada' }); return; }

  const parsed = cuotaPrestamoUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return;
  }
  const d = parsed.data;

  // Si se edita algún componente del importe, el total se recalcula como la
  // suma de los componentes (capital+interés+IVA+seguro+otros) — solo se
  // respeta un total_cuota explícito cuando no se tocó ningún componente
  // (ej: ajuste manual de redondeo bancario).
  const tocaComponentes = ['capital', 'interes', 'iva_interes', 'seguro', 'otros_impuestos'].some(k => (d as any)[k] !== undefined);
  const capitalFinal         = d.capital         !== undefined ? d.capital         : num(cuota.capital);
  const interesFinal         = d.interes         !== undefined ? d.interes         : num(cuota.interes);
  const ivaInteresFinal      = d.iva_interes     !== undefined ? d.iva_interes     : num(cuota.iva_interes);
  const seguroFinal          = d.seguro          !== undefined ? d.seguro          : num(cuota.seguro);
  const otrosImpuestosFinal  = d.otros_impuestos !== undefined ? d.otros_impuestos : num(cuota.otros_impuestos);
  const totalCalculado = (capitalFinal ?? 0) + (interesFinal ?? 0) + (ivaInteresFinal ?? 0) + (seguroFinal ?? 0) + (otrosImpuestosFinal ?? 0);
  const totalFinal = tocaComponentes ? totalCalculado : (d.total_cuota ?? Number(cuota.total_cuota));

  const updated = await prisma.cuotaPrestamo.update({
    where: { id },
    data: {
      ...(d.fecha_vencimiento !== undefined && { fecha_vencimiento: parseFechaUTC(d.fecha_vencimiento) }),
      capital:         capitalFinal,
      interes:         interesFinal,
      iva_interes:     ivaInteresFinal,
      seguro:          seguroFinal,
      otros_impuestos: otrosImpuestosFinal,
      total_cuota:     totalFinal,
      ...(d.notas !== undefined && { notas: d.notas }),
    },
  });
  res.json(mapCuotaPrestamo(updated));
}

// ── Documentos de Préstamo ────────────────────────────────────────────────────

export async function subirDocumentoPrestamo(req: Request, res: Response) {
  const prestamoId = Number(req.params.id);
  if (!req.file) { res.status(400).json({ error: 'Se requiere un archivo' }); return; }

  const acceso = await getAccesoEmpresas(req, res);
  if (!acceso.ok) return;

  const prestamo = await prisma.prestamoBancario.findFirst({ where: { id: prestamoId, deleted_at: null, ...scopeWhere(acceso.info) } });
  if (!prestamo) { res.status(404).json({ error: 'Préstamo no encontrado' }); return; }

  const { nombre, descripcion } = req.body as { nombre?: string; descripcion?: string };

  const doc = await prisma.documentoPrestamo.create({
    data: {
      prestamo_id:  prestamoId,
      nombre:       nombre?.trim() || req.file.originalname,
      descripcion:  descripcion || null,
      archivo_data: req.file.buffer,
      archivo_mime: req.file.mimetype,
      archivo_size: req.file.size,
      created_by:   req.user!.id,
    },
  });
  res.status(201).json({ ...doc, archivo_data: undefined });
}

export async function descargarDocumentoPrestamo(req: Request, res: Response) {
  const prestamoId = Number(req.params.id);
  const docId      = Number(req.params.docId);

  const acceso = await getAccesoEmpresas(req, res);
  if (!acceso.ok) return;

  const doc = await prisma.documentoPrestamo.findFirst({
    where: { id: docId, prestamo_id: prestamoId, prestamo: { deleted_at: null, ...scopeWhere(acceso.info) } },
  });
  if (!doc) { res.status(404).json({ error: 'Documento no encontrado' }); return; }

  const buffer   = Buffer.from(doc.archivo_data);
  const filename = encodeURIComponent(doc.nombre);
  res.setHeader('Content-Type',        doc.archivo_mime);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length',      buffer.length);
  res.end(buffer);
}

export async function eliminarDocumentoPrestamo(req: Request, res: Response) {
  const prestamoId = Number(req.params.id);
  const docId      = Number(req.params.docId);

  const acceso = await getAccesoEmpresas(req, res);
  if (!acceso.ok) return;

  const doc = await prisma.documentoPrestamo.findFirst({
    where: { id: docId, prestamo_id: prestamoId, prestamo: { deleted_at: null, ...scopeWhere(acceso.info) } },
  });
  if (!doc) { res.status(404).json({ error: 'Documento no encontrado' }); return; }

  await prisma.documentoPrestamo.delete({ where: { id: docId } });
  res.json({ message: 'Documento eliminado correctamente' });
}
