import type { Request, Response } from 'express';
import { z } from 'zod';
import type { EntregaUniforme, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { withTenant } from '../lib/tenant';
import { registrarAuditoria } from '../lib/auditoria';
import { importarUniformes, PRENDAS, type ModoImportUniformes } from '../lib/uniformesImporter';
import { generarExcelUniformes } from '../lib/uniformesExporter';

// Entregas de uniformes por empleado (Lorena, DOS57) — ver EntregaUniforme en
// schema.prisma y lib/uniformesImporter.ts.

type Prenda = typeof PRENDAS[number];
type Totales = Record<Prenda, number>;

function totalesVacios(): Totales {
  return Object.fromEntries(PRENDAS.map(p => [p, 0])) as Totales;
}

function sumar(t: Totales, e: Pick<EntregaUniforme, Prenda>) {
  for (const p of PRENDAS) t[p] += e[p];
}

// El libro de Lorena repite la misma entrega en más de un lugar: la hoja
// PLANTA ESTABLE (2022-2024) se superpone con las hojas individuales, y los
// resúmenes anuales DOS57_ENTREGA_AAAA son totales del año. Para no contar
// dos veces:
//   - las filas de resumen (anio_resumen != null) no suman al acumulado del
//     historial (se muestran aparte);
//   - una fila de PLANTA ESTABLE no suma si el mismo empleado tiene una fila
//     de hoja individual con la misma fecha.
function marcarCuentaEnTotal(entregas: EntregaUniforme[]): (EntregaUniforme & { cuenta_en_total: boolean })[] {
  const clave = (e: EntregaUniforme) => `${e.empleado_id ?? e.empleado_nombre}|${e.fecha_entrega.getTime()}`;
  const fechasIndividuales = new Set(
    entregas.filter(e => e.anio_resumen === null && e.origen_hoja !== 'PLANTA ESTABLE').map(clave),
  );
  return entregas.map(e => ({
    ...e,
    cuenta_en_total: e.anio_resumen === null && !(e.origen_hoja === 'PLANTA ESTABLE' && fechasIndividuales.has(clave(e))),
  }));
}

// ?empresa_id= distinto de la empresa activa sólo para admin global (Usuario
// sin empresa fija) — mismo criterio que requireAdminGlobal.
async function resolverEmpresa(req: Request, res: Response): Promise<number | null> {
  const raw = req.query.empresa_id;
  if (raw === undefined || raw === '') return req.empresaId!;
  const empresaId = Number(raw);
  if (!Number.isInteger(empresaId) || empresaId <= 0) { res.status(400).json({ error: 'empresa_id inválido' }); return null; }
  if (empresaId === req.empresaId) return empresaId;
  const usuario = await prisma.usuario.findFirst({ where: { id: req.user!.id, deleted_at: null }, select: { empresa_id: true } });
  if (req.user!.rol !== 'ADMIN' || usuario?.empresa_id !== null) {
    res.status(403).json({ error: 'No tenés acceso a esa empresa' }); return null;
  }
  return empresaId;
}

const importQuerySchema = z.object({
  modo:    z.enum(['HISTORIAL', 'RESUMEN', 'TODO']).default('TODO'),
  dry_run: z.enum(['true', 'false']).optional(),
});

export async function importarUniformesExcel(req: Request, res: Response) {
  if (!req.file) { res.status(400).json({ error: 'Se requiere un archivo .xlsx' }); return; }
  const parsed = importQuerySchema.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: 'modo inválido (HISTORIAL | RESUMEN | TODO)' }); return; }

  const empresaId = await resolverEmpresa(req, res);
  if (empresaId === null) return;

  const dryRun = parsed.data.dry_run === 'true';
  let resultado;
  try {
    resultado = await importarUniformes(req.file.buffer, empresaId, parsed.data.modo as ModoImportUniformes, req.user!.id, dryRun);
  } catch (err: any) {
    res.status(400).json({ error: 'Error al procesar el archivo', detail: err.message }); return;
  }

  if (!dryRun) {
    await registrarAuditoria({
      usuarioId: req.user!.id, empresaId, accion: 'IMPORT', entidad: 'EntregaUniforme',
      descripcion: `Importó planilla de uniformes (${parsed.data.modo}) — ${resultado.entregas_creadas} creadas, ${resultado.entregas_actualizadas} actualizadas, ${resultado.empleados_dados_baja.length} dados de baja`,
      datosDespues: { ...resultado, errores: resultado.errores.length }, ip: req.ip, tx: prisma,
    });
  }

  res.json(resultado);
}

async function responderHistorial(res: Response, where: Prisma.EntregaUniformeWhereInput, empleado: { id: number; nombre: string; apellido: string } | null, empleadoNombre: string) {
  const entregas = await prisma.entregaUniforme.findMany({
    where,
    orderBy: [{ fecha_entrega: 'desc' }, { origen_hoja: 'asc' }],
  });
  const marcadas = marcarCuentaEnTotal(entregas);

  const totales = totalesVacios();
  for (const e of marcadas) if (e.cuenta_en_total) sumar(totales, e);

  res.json({ empleado, empleado_nombre: empleadoNombre, entregas: marcadas, totales });
}

export async function historialUniformesEmpleado(req: Request, res: Response) {
  const empleadoId = Number(req.params.empleadoId);
  const empleado = await prisma.empleado.findFirst({
    where:  { id: empleadoId, deleted_at: null, ...withTenant(req.empresaId!) },
    select: { id: true, nombre: true, apellido: true },
  });
  if (!empleado) { res.status(404).json({ error: 'Empleado no encontrado' }); return; }

  await responderHistorial(res, { empleado_id: empleadoId }, empleado, `${empleado.apellido}, ${empleado.nombre}`);
}

// GET /historial?empleado_nombre=&empresa_id= — personas de la planilla que no
// están cargadas en RRHH (EntregaUniforme.empleado_id = null).
export async function historialUniformesPorNombre(req: Request, res: Response) {
  const nombre = typeof req.query.empleado_nombre === 'string' ? req.query.empleado_nombre.trim() : '';
  if (!nombre) { res.status(400).json({ error: 'Se requiere empleado_nombre' }); return; }
  const empresaId = await resolverEmpresa(req, res);
  if (empresaId === null) return;

  await responderHistorial(res, { empresa_id: empresaId, empleado_id: null, empleado_nombre: nombre }, null, nombre);
}

// GET /empleados — listado liviano para el selector de "Nueva entrega". Lorena
// (OPERADOR) no tiene acceso a /api/rrhh/empleados (RRHH es sólo ADMIN).
export async function listEmpleadosUniformes(req: Request, res: Response) {
  const empleados = await prisma.empleado.findMany({
    where:   { deleted_at: null, ...withTenant(req.empresaId!) },
    select:  { id: true, nombre: true, apellido: true, estado: true },
    orderBy: [{ apellido: 'asc' }, { nombre: 'asc' }],
  });
  res.json(empleados);
}

// ── ABM de entregas (carga manual de Lorena) ─────────────────────────────────

const cantidad = z.number().int().min(0).max(999).default(0);
const entregaSchema = z.object({
  empleado_id:     z.number().int().positive().nullable().optional(),
  empleado_nombre: z.string().trim().min(1).nullable().optional(), // si no está en RRHH
  fecha_entrega:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  otros:           z.string().trim().nullable().optional(),
  ...Object.fromEntries(PRENDAS.map(p => [p, cantidad])) as Record<Prenda, typeof cantidad>,
});
const crearEntregaSchema = entregaSchema.refine(d => d.empleado_id || d.empleado_nombre, {
  message: 'Indicá el empleado', path: ['empleado_id'],
});
const editarEntregaSchema = entregaSchema.partial();

function algunaPrenda(d: Partial<Record<Prenda, number>> & { otros?: string | null }): boolean {
  return PRENDAS.some(p => (d[p] ?? 0) > 0) || !!d.otros?.trim();
}

async function resolverEmpleadoEntrega(req: Request, empleadoId?: number | null, nombreLibre?: string | null) {
  if (empleadoId) {
    const emp = await prisma.empleado.findFirst({
      where:  { id: empleadoId, deleted_at: null, ...withTenant(req.empresaId!) },
      select: { id: true, nombre: true, apellido: true },
    });
    if (!emp) return null;
    // Mismo formato que el importador ("APELLIDO NOMBRE") — es parte de la clave única.
    return { empleado_id: emp.id, empleado_nombre: `${emp.apellido} ${emp.nombre}`.toUpperCase() };
  }
  return { empleado_id: null, empleado_nombre: nombreLibre!.trim().toUpperCase() };
}

const fechaUTC = (s: string) => new Date(`${s}T00:00:00.000Z`);

function erroresZod(err: z.ZodError) {
  return { error: 'Datos inválidos', detail: err.flatten().fieldErrors };
}

export async function crearEntregaUniforme(req: Request, res: Response) {
  const parsed = crearEntregaSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json(erroresZod(parsed.error)); return; }
  const d = parsed.data;
  if (!algunaPrenda(d)) { res.status(400).json({ error: 'Cargá al menos una prenda u "otros"' }); return; }

  const emp = await resolverEmpleadoEntrega(req, d.empleado_id, d.empleado_nombre);
  if (!emp) { res.status(404).json({ error: 'Empleado no encontrado' }); return; }

  try {
    const creada = await prisma.entregaUniforme.create({
      data: {
        empresa_id:    req.empresaId!,
        ...emp,
        fecha_entrega: fechaUTC(d.fecha_entrega),
        ...Object.fromEntries(PRENDAS.map(p => [p, d[p]])),
        otros:         d.otros?.trim() || null,
        origen_hoja:   'MANUAL',
        created_by:    req.user!.id,
      },
    });
    await registrarAuditoria({
      usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'CREATE', entidad: 'EntregaUniforme', entidadId: creada.id,
      descripcion: `Cargó entrega de uniforme a ${emp.empleado_nombre} (${d.fecha_entrega})`, datosDespues: creada, ip: req.ip, tx: prisma,
    });
    res.status(201).json(creada);
  } catch (err: any) {
    if (err.code === 'P2002') { res.status(400).json({ error: 'Ya hay una entrega manual para ese empleado en esa fecha — editala en vez de crear otra' }); return; }
    throw err;
  }
}

async function buscarEntrega(req: Request, res: Response) {
  const entrega = await prisma.entregaUniforme.findFirst({ where: { id: Number(req.params.id), ...withTenant(req.empresaId!) } });
  if (!entrega) res.status(404).json({ error: 'Entrega no encontrada' });
  return entrega;
}

// Editar sirve también para filas importadas del Excel (corregir un error de
// la planilla). Ojo: reimportar el mismo Excel vuelve a pisar esa fila.
export async function editarEntregaUniforme(req: Request, res: Response) {
  const parsed = editarEntregaSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json(erroresZod(parsed.error)); return; }
  const existente = await buscarEntrega(req, res);
  if (!existente) return;
  const d = parsed.data;

  const resultante = { ...existente, ...Object.fromEntries(PRENDAS.filter(p => d[p] !== undefined).map(p => [p, d[p]])), otros: d.otros !== undefined ? d.otros : existente.otros };
  if (!algunaPrenda(resultante)) { res.status(400).json({ error: 'La entrega tiene que tener al menos una prenda u "otros" — si no, eliminala' }); return; }

  let emp: { empleado_id: number | null; empleado_nombre: string } | null = null;
  if (d.empleado_id !== undefined || d.empleado_nombre !== undefined) {
    emp = await resolverEmpleadoEntrega(req, d.empleado_id, d.empleado_nombre ?? existente.empleado_nombre);
    if (!emp) { res.status(404).json({ error: 'Empleado no encontrado' }); return; }
  }

  try {
    const actualizada = await prisma.entregaUniforme.update({
      where: { id: existente.id },
      data: {
        ...(emp ?? {}),
        ...(d.fecha_entrega !== undefined && { fecha_entrega: fechaUTC(d.fecha_entrega) }),
        ...Object.fromEntries(PRENDAS.filter(p => d[p] !== undefined).map(p => [p, d[p]])),
        ...(d.otros !== undefined && { otros: d.otros?.trim() || null }),
      },
    });
    await registrarAuditoria({
      usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'UPDATE', entidad: 'EntregaUniforme', entidadId: existente.id,
      descripcion: `Editó entrega de uniforme de ${actualizada.empleado_nombre}`, datosAntes: existente, datosDespues: actualizada, ip: req.ip, tx: prisma,
    });
    res.json(actualizada);
  } catch (err: any) {
    if (err.code === 'P2002') { res.status(400).json({ error: 'Ya existe otra entrega de ese empleado en esa fecha (misma hoja)' }); return; }
    throw err;
  }
}

export async function eliminarEntregaUniforme(req: Request, res: Response) {
  const existente = await buscarEntrega(req, res);
  if (!existente) return;
  await prisma.entregaUniforme.delete({ where: { id: existente.id } });
  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'DELETE', entidad: 'EntregaUniforme', entidadId: existente.id,
    descripcion: `Eliminó entrega de uniforme de ${existente.empleado_nombre} (${existente.fecha_entrega.toISOString().slice(0, 10)}, hoja ${existente.origen_hoja})`,
    datosAntes: existente, ip: req.ip, tx: prisma,
  });
  res.json({ message: 'Entrega eliminada' });
}

const resumenQuerySchema = z.object({ anio: z.coerce.number().int().min(2000).max(2100) });

// Una fila por empleado con los totales del año. Si hay fila de resumen anual
// (DOS57_ENTREGA_AAAA) para ese año se usa esa — es el dato consolidado de
// Lorena; si no, se suma el historial detallado del año (deduplicado).
// Compartido por GET /resumen y GET /exportar: el Excel exporta exactamente lo
// que muestra la tabla, más el detalle de cada entrega del año con la marca de
// si suma al total de su empleado.
export async function calcularResumenUniformes(empresaId: number, anio: number) {
  const desde = new Date(Date.UTC(anio, 0, 1));
  const hasta = new Date(Date.UTC(anio + 1, 0, 1));
  const entregas = await prisma.entregaUniforme.findMany({
    where: {
      empresa_id: empresaId,
      OR: [{ anio_resumen: anio }, { anio_resumen: null, fecha_entrega: { gte: desde, lt: hasta } }],
    },
    include: { empleado: { select: { id: true, nombre: true, apellido: true, estado: true } } },
    orderBy: [{ fecha_entrega: 'asc' }, { origen_hoja: 'asc' }],
  });

  const grupos = new Map<string, typeof entregas>();
  for (const e of entregas) {
    const k = e.empleado_id !== null ? `id:${e.empleado_id}` : `nombre:${e.empleado_nombre}`;
    grupos.set(k, [...(grupos.get(k) ?? []), e]);
  }

  const detalle: (typeof entregas[number] & { empleado_label: string; suma_al_total: boolean })[] = [];
  const filas = [...grupos.values()].map(grupo => {
    const resumenes = grupo.filter(e => e.anio_resumen === anio);
    const usar = resumenes.length > 0 ? resumenes : marcarCuentaEnTotal(grupo).filter(e => e.cuenta_en_total);
    const usados = new Set(usar.map(e => e.id));
    const totales = totalesVacios();
    for (const e of usar) sumar(totales, e);
    const emp = grupo[0].empleado;
    const label = emp ? `${emp.apellido}, ${emp.nombre}` : grupo[0].empleado_nombre;
    for (const e of grupo) detalle.push({ ...e, empleado_label: label, suma_al_total: usados.has(e.id) });
    return {
      empleado_id:     emp?.id ?? null,
      empleado_nombre: label,
      empleado_estado: emp?.estado ?? null,
      fuente:          resumenes.length > 0 ? 'RESUMEN' as const : 'DETALLE' as const,
      entregas:        usar.length,
      otros:           [...new Set(usar.map(e => e.otros).filter(Boolean))].join(' · ') || null,
      ...totales,
    };
  }).sort((a, b) => a.empleado_nombre.localeCompare(b.empleado_nombre, 'es'));

  detalle.sort((a, b) => a.empleado_label.localeCompare(b.empleado_label, 'es') || a.fecha_entrega.getTime() - b.fecha_entrega.getTime());

  const totales = totalesVacios();
  for (const f of filas) for (const p of PRENDAS) totales[p] += f[p];

  return { filas, totales, detalle };
}

export async function resumenUniformes(req: Request, res: Response) {
  const parsed = resumenQuerySchema.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: 'Se requiere anio' }); return; }
  const { anio } = parsed.data;
  const empresaId = await resolverEmpresa(req, res);
  if (empresaId === null) return;

  const { filas, totales } = await calcularResumenUniformes(empresaId, anio);

  const aniosRaw = await prisma.entregaUniforme.findMany({
    where:  { empresa_id: empresaId },
    select: { fecha_entrega: true, anio_resumen: true },
  });
  const anios = [...new Set(aniosRaw.map(a => a.anio_resumen ?? a.fecha_entrega.getUTCFullYear()))].sort((a, b) => b - a);

  res.json({ anio, empresa_id: empresaId, filas, totales, anios_disponibles: anios });
}

// GET /api/uniformes/exportar?anio=&empresa_id= — Excel con 2 hojas:
// "Resumen AAAA" (la tabla general) y "Detalle AAAA" (cada entrega del año).
export async function exportarUniformes(req: Request, res: Response) {
  const parsed = resumenQuerySchema.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: 'Se requiere anio' }); return; }
  const { anio } = parsed.data;
  const empresaId = await resolverEmpresa(req, res);
  if (empresaId === null) return;

  const { buffer, filename } = await generarExcelUniformes(empresaId, anio);
  res.set({
    'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
    'Content-Length':      String(buffer.length),
  });
  res.end(buffer);
}
