import type { Request, Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { EstadoLineaGasto, TipoMovCCC } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { withTenant } from '../lib/tenant';
import { recalcularSaldoCCC } from '../lib/recalcularSaldoCCC';
import { registrarAuditoria } from '../lib/auditoria';

// ── Multer (comprobante de pago) ─────────────────────────────────────────────

export const uploadComprobante = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Solo se aceptan archivos PDF o imágenes'));
  },
});

// ── Helpers de fecha ──────────────────────────────────────────────────────────
// Fechas de negocio en UTC — mismo criterio que el resto del sistema (ver
// fmtDate/excelExporter, calendario.controller, afipPrestamos.controller).

function parseFechaUTC(s: string): Date {
  const soloFecha = s.slice(0, 10);
  return new Date(`${soloFecha}T00:00:00.000Z`);
}

// dia es 1-based (día del mes); si se pasa null no hay vencimiento. Clampea al
// último día del mes destino, mismo criterio que addMesesUTC en afipPrestamos.
function fechaVencimientoUTC(anio: number, mes: number, dia: number | null): Date | null {
  if (dia == null) return null;
  const diasEnMes = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  const diaClamp  = Math.min(dia, diasEnMes);
  return new Date(Date.UTC(anio, mes - 1, diaClamp));
}

const num = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

// ── Validation ────────────────────────────────────────────────────────────────

const parteSchema = z.object({
  nombre:              z.string().min(1),
  porcentaje:          z.number().positive(),
  empresa_id:          z.number().int().positive().nullable().optional(),
  cuenta_corriente_id: z.number().int().positive().nullable().optional(),
});

const espacioCreateSchema = z.object({
  nombre:         z.string().min(1),
  descripcion:    z.string().nullable().optional(),
  direccion:      z.string().nullable().optional(),
  dia_generacion: z.number().int().min(1).max(28).default(1),
  partes:         z.array(parteSchema).min(1),
}).refine(d => Math.abs(d.partes.reduce((s, p) => s + p.porcentaje, 0) - 100) <= 0.01, {
  message: 'La suma de porcentajes debe ser 100', path: ['partes'],
});

const espacioUpdateSchema = z.object({
  nombre:         z.string().min(1).optional(),
  descripcion:    z.string().nullable().optional(),
  direccion:      z.string().nullable().optional(),
  dia_generacion: z.number().int().min(1).max(28).optional(),
  activo:         z.boolean().optional(),
});

const gastoTipoSchema = z.object({
  nombre:          z.string().min(1),
  monto_estimado:  z.number().nonnegative(),
  dia_vencimiento: z.number().int().min(1).max(31).nullable().optional(),
  es_fijo:         z.boolean().default(true),
});

const gastoTipoUpdateSchema = gastoTipoSchema.partial().extend({
  activo: z.boolean().optional(),
});

const lineaManualSchema = z.object({
  nombre:            z.string().min(1),
  monto_real:        z.number().positive(),
  fecha_vencimiento: z.string().nullable().optional(),
});

const lineaUpdateSchema = z.object({
  nombre:            z.string().min(1).optional(),
  monto_real:        z.number().positive().optional(),
  fecha_vencimiento: z.string().nullable().optional(),
  notas:             z.string().nullable().optional(),
});

const generarMesSchema = z.object({
  mes:  z.number().int().min(1).max(12),
  anio: z.number().int().min(2000).max(2100),
});

// ── Mappers ───────────────────────────────────────────────────────────────────

function mapParte(p: any) {
  return { ...p, porcentaje: Number(p.porcentaje) };
}

function mapGastoTipo(g: any) {
  return { ...g, monto_estimado: Number(g.monto_estimado) };
}

function mapReparto(r: any) {
  return { ...r, porcentaje: Number(r.porcentaje), monto: Number(r.monto) };
}

function mapLinea(l: any) {
  return {
    ...l,
    monto_real:       Number(l.monto_real),
    comprobante_data: undefined,
    tiene_comprobante: l.comprobante_data != null,
    repartos:         l.repartos?.map(mapReparto),
  };
}

function mapGastoMes(g: any) {
  return {
    ...g,
    total_gastos: Number(g.total_gastos),
    lineas:       g.lineas?.map(mapLinea),
  };
}

function mapEspacio(e: any) {
  const { partes, gastosTipo, ...rest } = e;
  return {
    ...rest,
    partes:     partes?.map(mapParte),
    gastosTipo: gastosTipo?.map(mapGastoTipo),
  };
}

// ── Helpers de negocio ────────────────────────────────────────────────────────

async function findEspacio(id: number, empresaId: number) {
  return prisma.espacioCompartido.findFirst({ where: { id, deleted_at: null, ...withTenant(empresaId) } });
}

function validarSumaPartesFinal(partes: { porcentaje: number }[]): string | null {
  const suma = partes.reduce((s, p) => s + p.porcentaje, 0);
  if (Math.abs(suma - 100) > 0.01) return `La suma de porcentajes debe ser 100 (actual: ${suma})`;
  return null;
}

// Reparte montoReal entre las partes según su porcentaje; ajusta la última
// parte para que la suma cierre exacto al centavo (evita drift de redondeo).
function calcularRepartos(montoReal: number, partes: { id: number; porcentaje: number }[]): { parte_id: number; porcentaje: number; monto: number }[] {
  const resultado: { parte_id: number; porcentaje: number; monto: number }[] = [];
  let acumulado = 0;
  partes.forEach((p, i) => {
    const esUltima = i === partes.length - 1;
    const monto = esUltima ? parseFloat((montoReal - acumulado).toFixed(2)) : parseFloat((montoReal * (p.porcentaje / 100)).toFixed(2));
    acumulado = parseFloat((acumulado + monto).toFixed(2));
    resultado.push({ parte_id: p.id, porcentaje: p.porcentaje, monto });
  });
  return resultado;
}

// Crea la línea + sus repartos, y si una parte tiene cuenta corriente vinculada
// crea el MovimientoCCC (DEBE) correspondiente y recalcula el saldo.
async function crearLineaConRepartos(
  tx: Prisma.TransactionClient,
  params: {
    gastoMesId: number; gastoTipoId: number | null; nombre: string; montoReal: number;
    fechaVencimiento: Date | null; espacioNombre: string; createdBy: number;
    partes: { id: number; porcentaje: number; cuenta_corriente_id: number | null }[];
  },
) {
  const linea = await tx.lineaGastoEspacio.create({
    data: {
      gasto_mes_id:      params.gastoMesId,
      gasto_tipo_id:     params.gastoTipoId,
      nombre:            params.nombre,
      monto_real:        params.montoReal,
      fecha_vencimiento: params.fechaVencimiento,
      created_by:        params.createdBy,
    },
  });

  const repartos = calcularRepartos(params.montoReal, params.partes);
  for (const r of repartos) {
    const parte = params.partes.find(p => p.id === r.parte_id)!;
    let movimientoId: number | null = null;

    if (parte.cuenta_corriente_id) {
      const cuenta = await tx.cuentaCorriente.findFirst({ where: { id: parte.cuenta_corriente_id, deleted_at: null } });
      if (cuenta) {
        const mov = await tx.movimientoCCC.create({
          data: {
            cuenta_ccc_id: cuenta.id,
            empresa_id:    cuenta.empresa_id,
            tipo:          TipoMovCCC.DEBE,
            fecha:         params.fechaVencimiento ?? new Date(),
            concepto:      `${params.espacioNombre} — ${params.nombre}`,
            monto:         r.monto,
            moneda:        cuenta.moneda,
            created_by:    params.createdBy,
            updated_by:    params.createdBy,
          },
        });
        await recalcularSaldoCCC(cuenta.id, tx);
        movimientoId = mov.id;
      }
    }

    await tx.repartoLineaGasto.create({
      data: {
        linea_id:          linea.id,
        parte_id:          r.parte_id,
        porcentaje:        r.porcentaje,
        monto:             r.monto,
        movimiento_ccc_id: movimientoId,
      },
    });
  }

  return linea;
}

// Reversa (soft-delete) los MovimientoCCC generados por los repartos de una
// línea y borra los repartos — usado al editar o eliminar una línea.
async function reversarRepartosDeLinea(tx: Prisma.TransactionClient, lineaId: number, updatedBy: number) {
  const repartos = await tx.repartoLineaGasto.findMany({ where: { linea_id: lineaId } });
  for (const r of repartos) {
    if (r.movimiento_ccc_id) {
      const mov = await tx.movimientoCCC.update({
        where: { id: r.movimiento_ccc_id },
        data:  { deleted_at: new Date(), updated_by: updatedBy },
      });
      await recalcularSaldoCCC(mov.cuenta_ccc_id, tx);
    }
  }
  await tx.repartoLineaGasto.deleteMany({ where: { linea_id: lineaId } });
}

async function recalcularTotalMes(tx: Prisma.TransactionClient, gastoMesId: number) {
  const lineas = await tx.lineaGastoEspacio.findMany({
    where:  { gasto_mes_id: gastoMesId, deleted_at: null, estado: { not: EstadoLineaGasto.ANULADO } },
    select: { monto_real: true },
  });
  const total = lineas.reduce((s, l) => s + Number(l.monto_real), 0);
  await tx.gastoMesEspacio.update({ where: { id: gastoMesId }, data: { total_gastos: total } });
}

async function generarMesInterno(tx: Prisma.TransactionClient, espacioId: number, mes: number, anio: number, createdBy: number) {
  const espacio = await tx.espacioCompartido.findFirst({
    where:   { id: espacioId, deleted_at: null },
    include: { partes: true, gastosTipo: { where: { activo: true, es_fijo: true } } },
  });
  if (!espacio) throw new Error('Espacio no encontrado');

  const existente = await tx.gastoMesEspacio.findFirst({ where: { espacio_id: espacioId, periodo_mes: mes, periodo_anio: anio } });
  if (existente) throw new Error('El mes ya fue generado');

  const gastoMes = await tx.gastoMesEspacio.create({
    data: { espacio_id: espacioId, periodo_mes: mes, periodo_anio: anio, generado_auto: true },
  });

  for (const tipo of espacio.gastosTipo) {
    await crearLineaConRepartos(tx, {
      gastoMesId:       gastoMes.id,
      gastoTipoId:      tipo.id,
      nombre:           tipo.nombre,
      montoReal:        Number(tipo.monto_estimado),
      fechaVencimiento: fechaVencimientoUTC(anio, mes, tipo.dia_vencimiento),
      espacioNombre:    espacio.nombre,
      createdBy,
      partes:           espacio.partes.map(p => ({ id: p.id, porcentaje: Number(p.porcentaje), cuenta_corriente_id: p.cuenta_corriente_id })),
    });
  }

  await recalcularTotalMes(tx, gastoMes.id);
  return gastoMes.id;
}

// ── Espacios ──────────────────────────────────────────────────────────────────

export async function listEspacios(req: Request, res: Response) {
  const espacios = await prisma.espacioCompartido.findMany({
    where:   { deleted_at: null, ...withTenant(req.empresaId!) },
    include: { partes: true },
    orderBy: { nombre: 'asc' },
  });

  const hoy = new Date();
  const mesActual = hoy.getUTCMonth() + 1;
  const anioActual = hoy.getUTCFullYear();

  const conResumen = await Promise.all(espacios.map(async e => {
    const gastoMes = await prisma.gastoMesEspacio.findFirst({
      where:   { espacio_id: e.id, periodo_mes: mesActual, periodo_anio: anioActual },
      include: { lineas: { where: { deleted_at: null } } },
    });
    const resumenMesActual = gastoMes ? {
      id:            gastoMes.id,
      total_gastos:  Number(gastoMes.total_gastos),
      cerrado:       gastoMes.cerrado,
      pagados:       gastoMes.lineas.filter(l => l.estado === 'PAGADO').length,
      pendientes:    gastoMes.lineas.filter(l => l.estado === 'PENDIENTE').length,
    } : null;

    return { ...mapEspacio(e), mes_actual: resumenMesActual };
  }));

  res.json(conResumen);
}

export async function detalleEspacio(req: Request, res: Response) {
  const id = Number(req.params.id);
  const e = await prisma.espacioCompartido.findFirst({
    where:   { id, deleted_at: null, ...withTenant(req.empresaId!) },
    include: { partes: true, gastosTipo: { orderBy: { nombre: 'asc' } } },
  });
  if (!e) { res.status(404).json({ error: 'Espacio no encontrado' }); return; }
  res.json(mapEspacio(e));
}

export async function createEspacio(req: Request, res: Response) {
  const parsed = espacioCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten() }); return;
  }
  const d = parsed.data;

  const espacio = await prisma.espacioCompartido.create({
    data: {
      ...withTenant(req.empresaId!),
      nombre:         d.nombre,
      descripcion:    d.descripcion ?? null,
      direccion:      d.direccion ?? null,
      dia_generacion: d.dia_generacion,
      partes: {
        create: d.partes.map(p => ({
          nombre:              p.nombre,
          porcentaje:          p.porcentaje,
          empresa_id:          p.empresa_id ?? null,
          cuenta_corriente_id: p.cuenta_corriente_id ?? null,
        })),
      },
    },
    include: { partes: true },
  });
  res.status(201).json(mapEspacio(espacio));
}

export async function updateEspacio(req: Request, res: Response) {
  const id = Number(req.params.id);
  const e = await findEspacio(id, req.empresaId!);
  if (!e) { res.status(404).json({ error: 'Espacio no encontrado' }); return; }

  const parsed = espacioUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten() }); return;
  }
  const d = parsed.data;

  const updated = await prisma.espacioCompartido.update({
    where: { id },
    data: {
      ...(d.nombre         !== undefined && { nombre: d.nombre }),
      ...(d.descripcion    !== undefined && { descripcion: d.descripcion }),
      ...(d.direccion      !== undefined && { direccion: d.direccion }),
      ...(d.dia_generacion !== undefined && { dia_generacion: d.dia_generacion }),
      ...(d.activo         !== undefined && { activo: d.activo }),
    },
    include: { partes: true },
  });
  res.json(mapEspacio(updated));
}

export async function removeEspacio(req: Request, res: Response) {
  const id = Number(req.params.id);
  const e = await findEspacio(id, req.empresaId!);
  if (!e) { res.status(404).json({ error: 'Espacio no encontrado' }); return; }

  await prisma.espacioCompartido.update({ where: { id }, data: { deleted_at: new Date() } });
  res.json({ message: 'Espacio eliminado correctamente' });
}

// ── Partes ────────────────────────────────────────────────────────────────────

export async function createParte(req: Request, res: Response) {
  const espacioId = Number(req.params.id);
  const e = await findEspacio(espacioId, req.empresaId!);
  if (!e) { res.status(404).json({ error: 'Espacio no encontrado' }); return; }

  const parsed = parteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten() }); return;
  }
  const d = parsed.data;

  const existentes = await prisma.parteEspacio.findMany({ where: { espacio_id: espacioId }, select: { porcentaje: true } });
  const errorSuma = validarSumaPartesFinal([...existentes.map(p => ({ porcentaje: Number(p.porcentaje) })), { porcentaje: d.porcentaje }]);
  if (errorSuma) { res.status(400).json({ error: errorSuma }); return; }

  const parte = await prisma.parteEspacio.create({
    data: {
      espacio_id:          espacioId,
      nombre:              d.nombre,
      porcentaje:          d.porcentaje,
      empresa_id:          d.empresa_id ?? null,
      cuenta_corriente_id: d.cuenta_corriente_id ?? null,
    },
  });
  res.status(201).json(mapParte(parte));
}

export async function updateParte(req: Request, res: Response) {
  const id = Number(req.params.id);
  const parte = await prisma.parteEspacio.findFirst({
    where: { id, espacio: { deleted_at: null, ...withTenant(req.empresaId!) } },
  });
  if (!parte) { res.status(404).json({ error: 'Parte no encontrada' }); return; }

  const parsed = parteSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten() }); return;
  }
  const d = parsed.data;

  if (d.porcentaje !== undefined) {
    const otras = await prisma.parteEspacio.findMany({ where: { espacio_id: parte.espacio_id, id: { not: id } }, select: { porcentaje: true } });
    const errorSuma = validarSumaPartesFinal([...otras.map(p => ({ porcentaje: Number(p.porcentaje) })), { porcentaje: d.porcentaje }]);
    if (errorSuma) { res.status(400).json({ error: errorSuma }); return; }
  }

  const updated = await prisma.parteEspacio.update({
    where: { id },
    data: {
      ...(d.nombre              !== undefined && { nombre: d.nombre }),
      ...(d.porcentaje          !== undefined && { porcentaje: d.porcentaje }),
      ...(d.empresa_id          !== undefined && { empresa_id: d.empresa_id }),
      ...(d.cuenta_corriente_id !== undefined && { cuenta_corriente_id: d.cuenta_corriente_id }),
    },
  });
  res.json(mapParte(updated));
}

export async function removeParte(req: Request, res: Response) {
  const id = Number(req.params.id);
  const parte = await prisma.parteEspacio.findFirst({
    where: { id, espacio: { deleted_at: null, ...withTenant(req.empresaId!) } },
  });
  if (!parte) { res.status(404).json({ error: 'Parte no encontrada' }); return; }

  const tieneRepartos = await prisma.repartoLineaGasto.count({ where: { parte_id: id } });
  if (tieneRepartos > 0) {
    res.status(400).json({ error: 'No se puede eliminar una parte con gastos ya repartidos a su nombre' }); return;
  }

  await prisma.parteEspacio.delete({ where: { id } });
  res.json({ message: 'Parte eliminada correctamente' });
}

// ── Tipos de gasto fijo ───────────────────────────────────────────────────────

export async function createGastoTipo(req: Request, res: Response) {
  const espacioId = Number(req.params.id);
  const e = await findEspacio(espacioId, req.empresaId!);
  if (!e) { res.status(404).json({ error: 'Espacio no encontrado' }); return; }

  const parsed = gastoTipoSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten() }); return;
  }
  const d = parsed.data;

  const tipo = await prisma.gastoTipoEspacio.create({
    data: {
      espacio_id:      espacioId,
      nombre:          d.nombre,
      monto_estimado:  d.monto_estimado,
      dia_vencimiento: d.dia_vencimiento ?? null,
      es_fijo:         d.es_fijo,
    },
  });
  res.status(201).json(mapGastoTipo(tipo));
}

export async function updateGastoTipo(req: Request, res: Response) {
  const id = Number(req.params.id);
  const tipo = await prisma.gastoTipoEspacio.findFirst({
    where: { id, espacio: { deleted_at: null, ...withTenant(req.empresaId!) } },
  });
  if (!tipo) { res.status(404).json({ error: 'Tipo de gasto no encontrado' }); return; }

  const parsed = gastoTipoUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten() }); return;
  }
  const d = parsed.data;

  const updated = await prisma.gastoTipoEspacio.update({
    where: { id },
    data: {
      ...(d.nombre          !== undefined && { nombre: d.nombre }),
      ...(d.monto_estimado  !== undefined && { monto_estimado: d.monto_estimado }),
      ...(d.dia_vencimiento !== undefined && { dia_vencimiento: d.dia_vencimiento }),
      ...(d.es_fijo         !== undefined && { es_fijo: d.es_fijo }),
      ...(d.activo          !== undefined && { activo: d.activo }),
    },
  });
  res.json(mapGastoTipo(updated));
}

// No hay deleted_at en GastoTipoEspacio (las líneas ya generadas quedan con su
// gasto_tipo_id histórico) — "eliminar" desactiva el tipo para que no vuelva a
// generarse el mes que viene, mismo espíritu que Producto.activo en Stock.
export async function removeGastoTipo(req: Request, res: Response) {
  const id = Number(req.params.id);
  const tipo = await prisma.gastoTipoEspacio.findFirst({
    where: { id, espacio: { deleted_at: null, ...withTenant(req.empresaId!) } },
  });
  if (!tipo) { res.status(404).json({ error: 'Tipo de gasto no encontrado' }); return; }

  await prisma.gastoTipoEspacio.update({ where: { id }, data: { activo: false } });
  res.json({ message: 'Tipo de gasto desactivado correctamente' });
}

// ── Meses ─────────────────────────────────────────────────────────────────────

export async function listMeses(req: Request, res: Response) {
  const espacioId = Number(req.params.id);
  const e = await findEspacio(espacioId, req.empresaId!);
  if (!e) { res.status(404).json({ error: 'Espacio no encontrado' }); return; }

  const { anio } = req.query as { anio?: string };

  const meses = await prisma.gastoMesEspacio.findMany({
    where: { espacio_id: espacioId, ...(anio && { periodo_anio: Number(anio) }) },
    include: { lineas: { where: { deleted_at: null } } },
    orderBy: [{ periodo_anio: 'desc' }, { periodo_mes: 'desc' }],
  });

  res.json(meses.map(m => ({
    id:            m.id,
    periodo_mes:   m.periodo_mes,
    periodo_anio:  m.periodo_anio,
    cerrado:       m.cerrado,
    generado_auto: m.generado_auto,
    total_gastos:  Number(m.total_gastos),
    pagados:       m.lineas.filter(l => l.estado === 'PAGADO').length,
    pendientes:    m.lineas.filter(l => l.estado === 'PENDIENTE').length,
  })));
}

export async function detalleMes(req: Request, res: Response) {
  const espacioId = Number(req.params.id);
  const mes  = Number(req.params.mes);
  const anio = Number(req.params.anio);
  const e = await findEspacio(espacioId, req.empresaId!);
  if (!e) { res.status(404).json({ error: 'Espacio no encontrado' }); return; }

  const gastoMes = await prisma.gastoMesEspacio.findFirst({
    where:   { espacio_id: espacioId, periodo_mes: mes, periodo_anio: anio },
    include: {
      lineas: {
        where:   { deleted_at: null },
        include: { repartos: { include: { parte: { select: { id: true, nombre: true } } } } },
        orderBy: [{ fecha_vencimiento: 'asc' }, { id: 'asc' }],
      },
    },
  });
  if (!gastoMes) { res.json(null); return; }

  res.json(mapGastoMes(gastoMes));
}

export async function generarMes(req: Request, res: Response) {
  const espacioId = Number(req.params.id);
  const e = await findEspacio(espacioId, req.empresaId!);
  if (!e) { res.status(404).json({ error: 'Espacio no encontrado' }); return; }

  const parsed = generarMesSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten() }); return;
  }
  const { mes, anio } = parsed.data;

  try {
    const gastoMesId = await prisma.$transaction(tx => generarMesInterno(tx, espacioId, mes, anio, req.user!.id));

    await registrarAuditoria({
      usuarioId:   req.user!.id,
      empresaId:   req.empresaId,
      accion:      'CREATE',
      entidad:     'GastoMesEspacio',
      entidadId:   gastoMesId,
      descripcion: `Generación de gastos ${mes}/${anio} — ${e.nombre}`,
      tx:          prisma,
      ip:          req.ip,
    });

    const gastoMes = await prisma.gastoMesEspacio.findUniqueOrThrow({
      where:   { id: gastoMesId },
      include: { lineas: { include: { repartos: true } } },
    });
    res.status(201).json(mapGastoMes(gastoMes));
  } catch (err: any) {
    if (err.message === 'El mes ya fue generado') { res.status(400).json({ error: err.message }); return; }
    throw err;
  }
}

export async function generarMesActual(req: Request, res: Response) {
  const hoy = new Date();
  const mes  = hoy.getUTCMonth() + 1;
  const anio = hoy.getUTCFullYear();

  const espacios = await prisma.espacioCompartido.findMany({
    where: { deleted_at: null, activo: true, ...withTenant(req.empresaId!) },
  });

  const generados: string[] = [];
  for (const espacio of espacios) {
    const existente = await prisma.gastoMesEspacio.findFirst({ where: { espacio_id: espacio.id, periodo_mes: mes, periodo_anio: anio } });
    if (existente) continue;

    await prisma.$transaction(tx => generarMesInterno(tx, espacio.id, mes, anio, req.user!.id));
    generados.push(espacio.nombre);
  }

  res.json({ generados, mes, anio });
}

// ── Líneas ────────────────────────────────────────────────────────────────────

export async function agregarLineaManual(req: Request, res: Response) {
  const espacioId = Number(req.params.id);
  const mes  = Number(req.params.mes);
  const anio = Number(req.params.anio);
  const e = await prisma.espacioCompartido.findFirst({
    where:   { id: espacioId, deleted_at: null, ...withTenant(req.empresaId!) },
    include: { partes: true },
  });
  if (!e) { res.status(404).json({ error: 'Espacio no encontrado' }); return; }

  const gastoMes = await prisma.gastoMesEspacio.findFirst({ where: { espacio_id: espacioId, periodo_mes: mes, periodo_anio: anio } });
  if (!gastoMes) { res.status(404).json({ error: 'El mes todavía no fue generado' }); return; }
  if (gastoMes.cerrado) { res.status(400).json({ error: 'El mes ya está cerrado' }); return; }

  const parsed = lineaManualSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten() }); return;
  }
  const d = parsed.data;

  const linea = await prisma.$transaction(async tx => {
    const nueva = await crearLineaConRepartos(tx, {
      gastoMesId:       gastoMes.id,
      gastoTipoId:      null,
      nombre:           d.nombre,
      montoReal:        d.monto_real,
      fechaVencimiento: d.fecha_vencimiento ? parseFechaUTC(d.fecha_vencimiento) : null,
      espacioNombre:    e.nombre,
      createdBy:        req.user!.id,
      partes:           e.partes.map(p => ({ id: p.id, porcentaje: Number(p.porcentaje), cuenta_corriente_id: p.cuenta_corriente_id })),
    });
    await recalcularTotalMes(tx, gastoMes.id);
    return tx.lineaGastoEspacio.findUniqueOrThrow({ where: { id: nueva.id }, include: { repartos: true } });
  });

  res.status(201).json(mapLinea(linea));
}

async function findLineaConEspacio(id: number, empresaId: number) {
  return prisma.lineaGastoEspacio.findFirst({
    where:   { id, deleted_at: null, gasto_mes: { espacio: { deleted_at: null, ...withTenant(empresaId) } } },
    include: { gasto_mes: { include: { espacio: { include: { partes: true } } } } },
  });
}

export async function updateLinea(req: Request, res: Response) {
  const id = Number(req.params.id);
  const linea = await findLineaConEspacio(id, req.empresaId!);
  if (!linea) { res.status(404).json({ error: 'Línea no encontrada' }); return; }
  if (linea.gasto_mes.cerrado) { res.status(400).json({ error: 'El mes ya está cerrado' }); return; }

  const parsed = lineaUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten() }); return;
  }
  const d = parsed.data;

  const actualizada = await prisma.$transaction(async tx => {
    // Si cambia el monto, se recalculan repartos y movimientos de CCC desde cero.
    if (d.monto_real !== undefined) {
      await reversarRepartosDeLinea(tx, id, req.user!.id);
    }
    const updated = await tx.lineaGastoEspacio.update({
      where: { id },
      data: {
        ...(d.nombre            !== undefined && { nombre: d.nombre }),
        ...(d.monto_real        !== undefined && { monto_real: d.monto_real }),
        ...(d.fecha_vencimiento !== undefined && { fecha_vencimiento: d.fecha_vencimiento ? parseFechaUTC(d.fecha_vencimiento) : null }),
        ...(d.notas             !== undefined && { notas: d.notas }),
      },
    });

    if (d.monto_real !== undefined) {
      const espacio = linea.gasto_mes.espacio;
      const repartos = calcularRepartos(Number(updated.monto_real), espacio.partes.map(p => ({ id: p.id, porcentaje: Number(p.porcentaje) })));
      for (const r of repartos) {
        const parte = espacio.partes.find(p => p.id === r.parte_id)!;
        let movimientoId: number | null = null;
        if (parte.cuenta_corriente_id) {
          const cuenta = await tx.cuentaCorriente.findFirst({ where: { id: parte.cuenta_corriente_id, deleted_at: null } });
          if (cuenta) {
            const mov = await tx.movimientoCCC.create({
              data: {
                cuenta_ccc_id: cuenta.id,
                empresa_id:    cuenta.empresa_id,
                tipo:          TipoMovCCC.DEBE,
                fecha:         updated.fecha_vencimiento ?? new Date(),
                concepto:      `${espacio.nombre} — ${updated.nombre}`,
                monto:         r.monto,
                moneda:        cuenta.moneda,
                created_by:    req.user!.id,
                updated_by:    req.user!.id,
              },
            });
            await recalcularSaldoCCC(cuenta.id, tx);
            movimientoId = mov.id;
          }
        }
        await tx.repartoLineaGasto.create({
          data: { linea_id: id, parte_id: r.parte_id, porcentaje: r.porcentaje, monto: r.monto, movimiento_ccc_id: movimientoId },
        });
      }
    }

    await recalcularTotalMes(tx, linea.gasto_mes_id);
    return tx.lineaGastoEspacio.findUniqueOrThrow({ where: { id }, include: { repartos: true } });
  });

  res.json(mapLinea(actualizada));
}

const pagarLineaSchema = z.object({ fecha_pago: z.string().min(1) });

function comprobanteMiddleware(req: any, res: any, next: any) {
  uploadComprobante.single('comprobante')(req, res, (err: any) => {
    if (err) { res.status(400).json({ error: err.message ?? 'Error al subir el comprobante' }); return; }
    next();
  });
}

export async function pagarLinea(req: Request, res: Response) {
  const id = Number(req.params.id);
  const linea = await findLineaConEspacio(id, req.empresaId!);
  if (!linea) { res.status(404).json({ error: 'Línea no encontrada' }); return; }

  const parsed = pagarLineaSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten() }); return;
  }

  const updated = await prisma.lineaGastoEspacio.update({
    where: { id },
    data: {
      estado:             EstadoLineaGasto.PAGADO,
      fecha_pago:         parseFechaUTC(parsed.data.fecha_pago),
      ...(req.file && {
        comprobante_data:   req.file.buffer,
        comprobante_nombre: req.file.originalname,
        comprobante_mime:   req.file.mimetype,
      }),
    },
  });
  res.json(mapLinea(updated));
}

export async function removeLinea(req: Request, res: Response) {
  const id = Number(req.params.id);
  const linea = await findLineaConEspacio(id, req.empresaId!);
  if (!linea) { res.status(404).json({ error: 'Línea no encontrada' }); return; }
  if (linea.gasto_mes.cerrado) { res.status(400).json({ error: 'El mes ya está cerrado' }); return; }

  await prisma.$transaction(async tx => {
    await reversarRepartosDeLinea(tx, id, req.user!.id);
    await tx.lineaGastoEspacio.update({ where: { id }, data: { deleted_at: new Date(), estado: EstadoLineaGasto.ANULADO } });
    await recalcularTotalMes(tx, linea.gasto_mes_id);
  });

  res.json({ message: 'Línea eliminada correctamente' });
}

export async function descargarComprobante(req: Request, res: Response) {
  const id = Number(req.params.id);
  const linea = await findLineaConEspacio(id, req.empresaId!);
  if (!linea || !linea.comprobante_data) { res.status(404).json({ error: 'Comprobante no encontrado' }); return; }

  const buffer   = Buffer.from(linea.comprobante_data);
  const filename = encodeURIComponent(linea.comprobante_nombre ?? `comprobante-${id}`);
  res.setHeader('Content-Type',        linea.comprobante_mime ?? 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length',      buffer.length);
  res.end(buffer);
}

// ── Cierre de mes ─────────────────────────────────────────────────────────────

export async function cerrarMes(req: Request, res: Response) {
  const espacioId = Number(req.params.id);
  const mes  = Number(req.params.mes);
  const anio = Number(req.params.anio);
  const e = await findEspacio(espacioId, req.empresaId!);
  if (!e) { res.status(404).json({ error: 'Espacio no encontrado' }); return; }

  const gastoMes = await prisma.gastoMesEspacio.findFirst({
    where:   { espacio_id: espacioId, periodo_mes: mes, periodo_anio: anio },
    include: { lineas: { where: { deleted_at: null } } },
  });
  if (!gastoMes) { res.status(404).json({ error: 'Mes no encontrado' }); return; }
  if (gastoMes.cerrado) { res.status(400).json({ error: 'El mes ya está cerrado' }); return; }

  const pendientes = gastoMes.lineas.filter(l => l.estado === EstadoLineaGasto.PENDIENTE);
  if (pendientes.length > 0) {
    res.status(400).json({ error: `Hay ${pendientes.length} línea(s) pendiente(s) de pago` }); return;
  }

  const cerrado = await prisma.gastoMesEspacio.update({ where: { id: gastoMes.id }, data: { cerrado: true } });

  await registrarAuditoria({
    usuarioId:   req.user!.id,
    empresaId:   req.empresaId,
    accion:      'UPDATE',
    entidad:     'GastoMesEspacio',
    entidadId:   cerrado.id,
    descripcion: `Cierre de mes ${mes}/${anio} — ${e.nombre}`,
    tx:          prisma,
    ip:          req.ip,
  });

  res.json(mapGastoMes(cerrado));
}
