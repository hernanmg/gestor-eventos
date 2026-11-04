import type { Request, Response } from 'express';
import { z } from 'zod';
import { BloqueCostoReal } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { withTenant } from '../lib/tenant';
import { registrarAuditoria } from '../lib/auditoria';
import {
  BLOQUES, INFO_BLOQUE, PORCENTAJE_DEFAULT, GRUPO_SINCRONIZACION,
  calcularTotal, calcularDesdeSistema, reemplazarLineas, presupuestoDelEvento,
} from '../lib/costoReal';
import { parseMatrizCostoReal } from '../lib/costoRealImporter';
import { generateCostoRealExcel } from '../lib/costoRealExporter';

// Costo real del evento (DOS57) — la matriz de Flor. Ver lib/costoReal.ts.
// Acceso: ADMIN o quien tenga el permiso COSTO_REAL (Flor, OPERADOR).

const r2 = (n: number) => Math.round(n * 100) / 100;

async function buscarEvento(req: Request, res: Response) {
  const evento = await prisma.evento.findFirst({
    where:  { id: Number(req.params.id), deleted_at: null, ...withTenant(req.empresaId!) },
    select: { id: true, nombre: true, modalidad: true, fecha_inicio: true, fecha_fin: true, lugar: true },
  });
  if (!evento) res.status(404).json({ error: 'Evento no encontrado' });
  return evento;
}

function mapLinea(l: any) {
  return {
    ...l,
    cantidad:       Number(l.cantidad),
    valor_unitario: Number(l.valor_unitario),
    porcentaje:     l.porcentaje == null ? null : Number(l.porcentaje),
    total:          Number(l.total),
  };
}

function lineasDelEvento(eventoId: number) {
  return prisma.lineaCostoReal.findMany({
    where:   { evento_id: eventoId, deleted_at: null },
    orderBy: [{ bloque: 'asc' }, { orden: 'asc' }, { id: 'asc' }],
  });
}

function resumenPresupuesto(p: Awaited<ReturnType<typeof presupuestoDelEvento>>) {
  if (!p) return null;
  const total_rental = r2(p.lineas.reduce((a, l) => a + Number(l.valor_rental), 0));
  return { id: p.id, nombre: p.nombre, estado: p.estado, version: p.version, porcentaje_alquiler: p.porcentaje_alquiler, total_rental };
}

// GET /api/eventos/:id/costo-real
export async function getCostoReal(req: Request, res: Response) {
  const evento = await buscarEvento(req, res);
  if (!evento) return;
  const [lineas, presupuesto] = await Promise.all([
    lineasDelEvento(evento.id),
    presupuestoDelEvento(evento.id, req.empresaId!),
  ]);
  const bloques = BLOQUES.map(info => {
    const ls = lineas.filter(l => l.bloque === info.bloque).map(mapLinea);
    return { ...info, porcentaje_default: PORCENTAJE_DEFAULT[info.bloque] ?? null, total: r2(ls.reduce((a, l) => a + l.total, 0)), lineas: ls };
  });
  res.json({
    evento,
    bloques,
    total:       r2(bloques.reduce((a, b) => a + b.total, 0)),
    presupuesto: resumenPresupuesto(presupuesto),
    actualizado: lineas.reduce<Date | null>((max, l) => (!max || l.updated_at > max ? l.updated_at : max), null),
  });
}

// GET /api/costo-real — tablero de Flor: todos los eventos de la empresa con su costo real
export async function listCostoReal(req: Request, res: Response) {
  const eventos = await prisma.evento.findMany({
    where:   { deleted_at: null, es_informal: false, ...withTenant(req.empresaId!) },
    select:  { id: true, nombre: true, fecha_inicio: true, fecha_fin: true, lugar: true, estado: true, modalidad: true },
    orderBy: [{ fecha_inicio: 'desc' }, { id: 'desc' }],
  });
  const ids = eventos.map(e => e.id);
  const [totales, presupuestos] = await Promise.all([
    prisma.lineaCostoReal.groupBy({
      by: ['evento_id'], where: { evento_id: { in: ids }, deleted_at: null },
      _sum: { total: true }, _count: true, _max: { updated_at: true },
    }),
    prisma.presupuestoLinea.groupBy({
      by: ['presupuesto_id'], where: { presupuesto: { evento_id: { in: ids }, deleted_at: null } },
      _sum: { valor_rental: true },
    }),
  ]);
  // Presupuesto de referencia por evento (mismo criterio que presupuestoDelEvento)
  const cabeceras = await prisma.presupuestoEvento.findMany({
    where:  { evento_id: { in: ids }, deleted_at: null },
    select: { id: true, evento_id: true, estado: true, version: true },
  });
  const prioridad = { APROBADO: 0, ENVIADO: 1, CERRADO: 2, BORRADOR: 3 } as const;
  const sumaPres = new Map(presupuestos.map(p => [p.presupuesto_id, Number(p._sum.valor_rental ?? 0)]));
  const presPorEvento = new Map<number, { estado: string; total: number; orden: number; version: number }>();
  for (const c of cabeceras) {
    const prev = presPorEvento.get(c.evento_id!);
    const orden = prioridad[c.estado];
    if (!prev || orden < prev.orden || (orden === prev.orden && c.version > prev.version)) {
      presPorEvento.set(c.evento_id!, { estado: c.estado, total: r2(sumaPres.get(c.id) ?? 0), orden, version: c.version });
    }
  }
  const porEvento = new Map(totales.map(t => [t.evento_id, t]));
  res.json(eventos.map(e => {
    const t = porEvento.get(e.id);
    const p = presPorEvento.get(e.id);
    return {
      ...e,
      costo_real:  r2(Number(t?._sum.total ?? 0)),
      lineas:      t?._count ?? 0,
      actualizado: t?._max.updated_at ?? null,
      presupuesto: p ? { estado: p.estado, total_rental: p.total } : null,
    };
  }));
}

const lineaSchema = z.object({
  bloque:         z.nativeEnum(BloqueCostoReal),
  concepto:       z.string().trim().min(1, 'Concepto requerido').max(300),
  detalle:        z.string().trim().max(300).nullable().optional(),
  codigo:         z.string().trim().max(50).nullable().optional(),
  cantidad:       z.coerce.number().min(0).max(1e9),
  valor_unitario: z.coerce.number().min(0).max(1e12),
  porcentaje:     z.coerce.number().min(0).max(1000).nullable().optional(),
  fecha_desde:    z.string().regex(/^\d{4}-\d{2}-\d{2}/).nullable().optional(),
  fecha_hasta:    z.string().regex(/^\d{4}-\d{2}-\d{2}/).nullable().optional(),
  notas:          z.string().trim().max(1000).nullable().optional(),
});

const fecha = (s: string | null | undefined) => (s ? new Date(`${s.slice(0, 10)}T00:00:00.000Z`) : s === null ? null : undefined);
const vacio = (s: string | null | undefined) => (s === undefined ? undefined : s?.trim() ? s.trim() : null);

// POST /api/eventos/:id/costo-real/lineas
export async function createLinea(req: Request, res: Response) {
  const evento = await buscarEvento(req, res);
  if (!evento) return;
  const parsed = lineaSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }); return; }
  const d = parsed.data;
  const porcentaje = d.porcentaje === undefined ? (PORCENTAJE_DEFAULT[d.bloque] ?? null) : d.porcentaje;

  const linea = await prisma.$transaction(async tx => {
    const ultimo = await tx.lineaCostoReal.aggregate({
      where: { evento_id: evento.id, bloque: d.bloque, deleted_at: null }, _max: { orden: true },
    });
    const created = await tx.lineaCostoReal.create({
      data: {
        empresa_id: req.empresaId!, evento_id: evento.id, bloque: d.bloque, origen: 'MANUAL',
        orden: (ultimo._max.orden ?? -1) + 1,
        concepto: d.concepto, detalle: vacio(d.detalle) ?? null, codigo: vacio(d.codigo) ?? null,
        cantidad: d.cantidad, valor_unitario: d.valor_unitario, porcentaje,
        total: calcularTotal(d.cantidad, d.valor_unitario, porcentaje),
        fecha_desde: fecha(d.fecha_desde) ?? null, fecha_hasta: fecha(d.fecha_hasta) ?? null,
        notas: vacio(d.notas) ?? null,
        created_by: req.user!.id, updated_by: req.user!.id,
      },
    });
    await registrarAuditoria({
      usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'CREATE', entidad: 'LineaCostoReal',
      entidadId: created.id, eventoId: evento.id, tx: tx as any,
      descripcion: `Costo real · ${INFO_BLOQUE[d.bloque].label}: agregó "${created.concepto}"`,
    });
    return created;
  });
  res.status(201).json(mapLinea(linea));
}

async function buscarLinea(req: Request, res: Response) {
  const linea = await prisma.lineaCostoReal.findFirst({
    where: { id: Number(req.params.id), deleted_at: null, ...withTenant(req.empresaId!) },
  });
  if (!linea) res.status(404).json({ error: 'Línea no encontrada' });
  return linea;
}

// PUT /api/costo-real/lineas/:id — cualquier origen se puede corregir; las
// importadas o del sistema se reemplazan si se vuelve a importar/sincronizar.
export async function updateLinea(req: Request, res: Response) {
  const linea = await buscarLinea(req, res);
  if (!linea) return;
  const parsed = lineaSchema.partial().omit({ bloque: true }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }); return; }
  const d = parsed.data;
  const cantidad   = d.cantidad       ?? Number(linea.cantidad);
  const valor      = d.valor_unitario ?? Number(linea.valor_unitario);
  const porcentaje = d.porcentaje !== undefined ? d.porcentaje : (linea.porcentaje == null ? null : Number(linea.porcentaje));
  const cambiaMonto = d.cantidad !== undefined || d.valor_unitario !== undefined || d.porcentaje !== undefined;

  const updated = await prisma.$transaction(async tx => {
    const u = await tx.lineaCostoReal.update({
      where: { id: linea.id },
      data: {
        ...(d.concepto !== undefined && { concepto: d.concepto }),
        ...(d.detalle  !== undefined && { detalle: vacio(d.detalle) }),
        ...(d.codigo   !== undefined && { codigo: vacio(d.codigo) }),
        ...(d.notas    !== undefined && { notas: vacio(d.notas) }),
        ...(d.fecha_desde !== undefined && { fecha_desde: fecha(d.fecha_desde) }),
        ...(d.fecha_hasta !== undefined && { fecha_hasta: fecha(d.fecha_hasta) }),
        ...(cambiaMonto && { cantidad, valor_unitario: valor, porcentaje, total: calcularTotal(cantidad, valor, porcentaje) }),
        updated_by: req.user!.id,
      },
    });
    await registrarAuditoria({
      usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'UPDATE', entidad: 'LineaCostoReal',
      entidadId: linea.id, eventoId: linea.evento_id, tx: tx as any,
      descripcion: `Costo real · ${INFO_BLOQUE[linea.bloque].label}: editó "${u.concepto}"`,
      datosAntes: mapLinea(linea), datosDespues: mapLinea(u),
    });
    return u;
  });
  res.json(mapLinea(updated));
}

// DELETE /api/costo-real/lineas/:id
export async function deleteLinea(req: Request, res: Response) {
  const linea = await buscarLinea(req, res);
  if (!linea) return;
  await prisma.$transaction(async tx => {
    await tx.lineaCostoReal.update({ where: { id: linea.id }, data: { deleted_at: new Date(), updated_by: req.user!.id } });
    await registrarAuditoria({
      usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'DELETE', entidad: 'LineaCostoReal',
      entidadId: linea.id, eventoId: linea.evento_id, tx: tx as any,
      descripcion: `Costo real · ${INFO_BLOQUE[linea.bloque].label}: borró "${linea.concepto}"`,
    });
  });
  res.status(204).end();
}

// POST /api/eventos/:id/costo-real/sincronizar  { bloque }
// Trae el bloque desde lo que ya está cargado en el sistema (jornadas, comidas,
// combustible, remitos, pañol). Reemplaza sólo las líneas "del sistema".
export async function sincronizarBloque(req: Request, res: Response) {
  const evento = await buscarEvento(req, res);
  if (!evento) return;
  const parsed = z.object({ bloque: z.nativeEnum(BloqueCostoReal) }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Bloque inválido' }); return; }
  const { bloque } = parsed.data;
  if (!INFO_BLOQUE[bloque].fuente) {
    res.status(400).json({ error: `${INFO_BLOQUE[bloque].label} no tiene datos en el sistema: se carga a mano o desde la planilla` });
    return;
  }
  const calc = await calcularDesdeSistema(bloque, evento.id, req.empresaId!);
  if (!calc) { res.status(400).json({ error: 'Bloque no sincronizable' }); return; }
  // Los bloques que se resuelven juntos (combustible, rental) se reemplazan juntos
  for (const b of GRUPO_SINCRONIZACION[bloque] ?? [bloque]) calc.porBloque[b] ??= [];

  const r = await prisma.$transaction(async tx => {
    const out = await reemplazarLineas(tx, {
      eventoId: evento.id, empresaId: req.empresaId!, userId: req.user!.id, origen: 'SISTEMA', porBloque: calc.porBloque,
    });
    await registrarAuditoria({
      usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'UPDATE', entidad: 'LineaCostoReal',
      eventoId: evento.id, tx: tx as any,
      descripcion: `Costo real: trajo ${INFO_BLOQUE[bloque].label} del sistema (${out.creadas} líneas, reemplazó ${out.reemplazadas})`,
    });
    return out;
  });
  res.json({ ...r, avisos: calc.avisos, bloques: Object.keys(calc.porBloque) });
}

// POST /api/eventos/:id/costo-real/importar?preview=true|false  (multipart: archivo)
// Importa la matriz de Flor. Reemplaza las líneas importadas antes (origen
// PLANILLA) de los bloques que trae el archivo; las manuales y las del sistema quedan.
export async function importarMatriz(req: Request, res: Response) {
  const evento = await buscarEvento(req, res);
  if (!evento) return;
  if (!req.file) { res.status(400).json({ error: 'Se requiere un archivo .xlsx' }); return; }
  const esPreview = req.query.preview !== 'false';

  let m: Awaited<ReturnType<typeof parseMatrizCostoReal>>;
  try {
    m = await parseMatrizCostoReal(req.file.buffer);
  } catch (err: any) {
    res.status(400).json({ error: err.message ?? 'Error al procesar el archivo' }); return;
  }

  const existentes = await prisma.lineaCostoReal.groupBy({
    by: ['bloque', 'origen'], where: { evento_id: evento.id, deleted_at: null }, _count: true,
  });
  const contar = (b: BloqueCostoReal, o: string) => existentes.find(e => e.bloque === b && e.origen === o)?._count ?? 0;

  const bloques = BLOQUES.map(info => {
    const ls = m.porBloque[info.bloque] ?? [];
    return {
      bloque: info.bloque, label: info.label, lineas: ls.length, total: r2(ls.reduce((a, l) => a + l.total, 0)),
      reemplaza:     contar(info.bloque, 'PLANILLA'),
      otras_lineas:  contar(info.bloque, 'MANUAL') + contar(info.bloque, 'SISTEMA'),
      ...(esPreview && { detalle: ls.slice(0, 50) }),
    };
  });
  const total = r2(bloques.reduce((a, b) => a + b.total, 0));
  const avisos = [...m.avisos];
  if (m.total_planilla != null && Math.abs(m.total_planilla - total) > 1) {
    avisos.push(`El total importado ($${total.toLocaleString('es-AR')}) no coincide con el total de la hoja CC ($${m.total_planilla.toLocaleString('es-AR')}).`);
  }
  const conDuplicados = bloques.filter(b => b.lineas && b.otras_lineas);
  if (conDuplicados.length) {
    avisos.push(`Ojo: ${conDuplicados.map(b => b.label).join(', ')} ya tiene${conDuplicados.length > 1 ? 'n' : ''} líneas cargadas a mano o traídas del sistema; se suman a las importadas.`);
  }
  const resumen = { titulo: m.titulo, total_planilla: m.total_planilla, total, omitidas: m.omitidas, hojas: m.hojas, avisos, bloques };
  if (esPreview) { res.json({ preview: true, ...resumen }); return; }

  // Sólo los bloques que la planilla trae: una hoja ausente no borra lo importado antes
  const porBloque = Object.fromEntries(Object.entries(m.porBloque).filter(([, ls]) => ls && ls.length));
  const r = await prisma.$transaction(async tx => {
    const out = await reemplazarLineas(tx, {
      eventoId: evento.id, empresaId: req.empresaId!, userId: req.user!.id, origen: 'PLANILLA', porBloque,
    });
    await registrarAuditoria({
      usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'IMPORT', entidad: 'LineaCostoReal',
      eventoId: evento.id, tx: tx as any,
      descripcion: `Costo real: importó la matriz "${req.file!.originalname}" (${out.creadas} líneas, $${total.toLocaleString('es-AR')})`,
    });
    return out;
  }, { timeout: 30_000 });
  res.json({ preview: false, ...resumen, ...r });
}

// GET /api/eventos/:id/costo-real/exportar
export async function exportarCostoReal(req: Request, res: Response) {
  const evento = await buscarEvento(req, res);
  if (!evento) return;
  const lineas = (await lineasDelEvento(evento.id)).map(mapLinea);
  const buffer = await generateCostoRealExcel({ nombre: evento.nombre, lineas });
  const archivo = `${evento.nombre.replace(/[\\/:*?"<>|]/g, '-')} - Costo real.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(archivo)}"`);
  res.send(buffer);
}
