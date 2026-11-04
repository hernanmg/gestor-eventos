import type { Request, Response } from 'express';
import { z } from 'zod';
import ExcelJS from 'exceljs';
import { EstadoTarea, FaseEvento } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { withTenant } from '../lib/tenant';
import { registrarAuditoria } from '../lib/auditoria';
import { RUBROS_SISTEMA } from '../lib/rubrosConstants';
import { FASES, NOMBRE_CATEGORIA, PLANTILLA_DEFAULT, faseDeFecha, fechaDeFase, rangosFases } from '../lib/fasesEvento';

// Pestaña "Operación" (DOS57, eventos en modalidad OPERATIVA): el evento visto
// desde los rubros elegidos — la cuadrilla por fase (sale del Parte diario y las
// jornadas), y por rubro el material (stock propio / proveedor, de la Ficha) y
// sus tareas (CronogramaEvento con rubro, fase y estado).

const EVENTO_SELECT = {
  id: true, nombre: true, lugar: true, fecha_inicio: true, fecha_fin: true, dias_montaje: true, dias_desmontaje: true,
} as const;

async function buscarEvento(req: Request, res: Response) {
  const evento = await prisma.evento.findFirst({
    where:  { id: Number(req.params.id), deleted_at: null, ...withTenant(req.empresaId!) },
    select: EVENTO_SELECT,
  });
  if (!evento) res.status(404).json({ error: 'Evento no encontrado' });
  return evento;
}


const vacioFases = () => Object.fromEntries(FASES.map(f => [f.fase, 0])) as Record<FaseEvento, number>;
const claveDia = (d: Date) => d.toISOString().slice(0, 10);

// Cuadrilla: una fila por persona con los días en cada fase. Los días
// trabajados salen de las jornadas del evento; los planificados, de las
// asignaciones del Parte diario que todavía no se cerraron (sin jornada).
async function calcularCuadrilla(evento: Awaited<ReturnType<typeof buscarEvento>> & {}, empresaId: number) {
  const empleadoSel = { select: { id: true, nombre: true, apellido: true, categoria: true } } as const;
  const [jornadas, asignaciones] = await Promise.all([
    prisma.jornada.findMany({
      where:  { evento_id: evento.id, deleted_at: null, estado: { not: 'RECHAZADA' }, ...withTenant(empresaId) },
      select: { fecha: true, empleado: empleadoSel },
    }),
    prisma.asignacionDiaria.findMany({
      where:  { evento_id: evento.id, deleted_at: null, estado: 'ASIGNADO', jornada_id: null, ...withTenant(empresaId) },
      select: { empleado: empleadoSel, parte_diario: { select: { fecha: true } } },
    }),
  ]);

  type Persona = {
    empleado_id: number; nombre: string; categoria: string;
    dias: Record<FaseEvento, number>; total: number; trabajados: number; planificados: number; vistos: Set<string>;
  };
  const personas = new Map<number, Persona>();
  let sinFase = 0;
  const sumar = (emp: { id: number; nombre: string; apellido: string; categoria: string }, f: Date, tipo: 'trabajados' | 'planificados') => {
    const p = personas.get(emp.id) ?? {
      empleado_id: emp.id, nombre: `${emp.apellido}, ${emp.nombre}`.replace(/^, /, ''), categoria: emp.categoria,
      dias: vacioFases(), total: 0, trabajados: 0, planificados: 0, vistos: new Set<string>(),
    };
    personas.set(emp.id, p);
    if (p.vistos.has(claveDia(f))) return; // mismo día en jornada y parte: cuenta una vez
    p.vistos.add(claveDia(f));
    const fase = faseDeFecha(evento, f);
    if (!fase) { sinFase++; return; }
    p.dias[fase]++; p.total++; p[tipo]++;
  };
  for (const j of jornadas) sumar(j.empleado, j.fecha, 'trabajados');
  for (const a of asignaciones) sumar(a.empleado, a.parte_diario.fecha, 'planificados');

  const lista = [...personas.values()]
    .map(({ vistos: _v, ...p }) => p)
    .sort((a, b) => a.categoria.localeCompare(b.categoria) || a.nombre.localeCompare(b.nombre));
  const porCategoria = new Map<string, { categoria: string; label: string; personas: number; dias: Record<FaseEvento, number>; total: number }>();
  for (const p of lista) {
    const c = porCategoria.get(p.categoria) ?? { categoria: p.categoria, label: NOMBRE_CATEGORIA[p.categoria] ?? p.categoria, personas: 0, dias: vacioFases(), total: 0 };
    c.personas++; c.total += p.total;
    for (const f of FASES) c.dias[f.fase] += p.dias[f.fase];
    porCategoria.set(p.categoria, c);
  }
  return {
    personas: lista.map(p => ({ ...p, categoria_label: NOMBRE_CATEGORIA[p.categoria] ?? p.categoria })),
    por_categoria: [...porCategoria.values()],
    sin_fechas: sinFase > 0,
  };
}

function mapTarea(t: any) {
  return {
    id: t.id, rubro_evento_id: t.rubro_evento_id, fecha: t.fecha, hora: t.hora, actividad: t.actividad,
    responsable: t.responsable, observaciones: t.observaciones, fase: t.fase, estado: t.estado, orden: t.orden,
  };
}

const ORDEN_TAREAS = [{ fecha: 'asc' as const }, { hora: 'asc' as const }, { orden: 'asc' as const }, { id: 'asc' as const }];

// GET /api/eventos/:id/operacion
export async function getOperacion(req: Request, res: Response) {
  const evento = await buscarEvento(req, res);
  if (!evento) return;
  const [cuadrilla, rubros, generales, remitos] = await Promise.all([
    calcularCuadrilla(evento, req.empresaId!),
    prisma.rubroEvento.findMany({
      where: {
        evento_id: evento.id, deleted_at: null, estado: { notIn: ['NO_VA', 'CANCELADO'] },
        // Sin los rubros técnicos (RRHH, Impuestos, Gastos extra). Los operativos
        // de DOS57 también tienen código (LAYHER, VALLADO, VARIOS): no alcanza con codigo null.
        rubro: { OR: [{ codigo: null }, { codigo: { notIn: Object.values(RUBROS_SISTEMA) } }] },
      },
      include: {
        rubro:     { select: { id: true, nombre: true } },
        proveedor: { select: { id: true, nombre: true } },
        asignaciones_stock: {
          where:  { deleted_at: null, estado: { not: 'CANCELADA' } },
          select: { id: true, cantidad: true, ubicacion: true, producto: { select: { nombre: true } } },
        },
        tareas: { where: { deleted_at: null }, orderBy: ORDEN_TAREAS },
      },
      orderBy: [{ rubro: { orden: 'asc' } }, { id: 'asc' }],
    }),
    prisma.cronogramaEvento.findMany({
      where:   { evento_id: evento.id, deleted_at: null, rubro_evento_id: null },
      orderBy: ORDEN_TAREAS,
    }),
    prisma.remitoEvento.findMany({
      where:   { evento_id: evento.id, ...withTenant(req.empresaId!) },
      select:  { id: true, tipo: true, numero: true, estado: true, fecha: true, chofer: true, items: true },
      orderBy: [{ fecha: 'asc' }, { tipo: 'asc' }, { numero: 'asc' }],
    }),
  ]);

  res.json({
    evento,
    fases: rangosFases(evento),
    cuadrilla,
    rubros: rubros.map(r => {
      const tareas = r.tareas.map(mapTarea);
      return {
        id: r.id, rubro: r.rubro, estado: r.estado, proveedor: r.proveedor,
        usa_stock_propio: r.usa_stock_propio, cantidad_stock: r.cantidad_stock, cantidad_proveedor: r.cantidad_proveedor,
        coordina_nombre: r.coordina_nombre,
        material: r.asignaciones_stock.map(a => ({ id: a.id, producto: a.producto.nombre, cantidad: a.cantidad, ubicacion: a.ubicacion })),
        tareas,
        hechas: tareas.filter(t => t.estado === 'HECHA').length,
      };
    }),
    generales: generales.map(mapTarea),
    remitos: remitos.map(({ items, ...r }) => {
      const its = (items as { cantidad: number }[]) ?? [];
      return { ...r, items: its.length, unidades: its.reduce((a, i) => a + Number(i.cantidad), 0) };
    }),
  });
}

const fechaSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Fecha inválida');
const txt = z.string().trim().max(300).nullable().optional();
const tareaSchema = z.object({
  rubro_evento_id: z.coerce.number().int().positive().nullable().optional(),
  actividad:       z.string().trim().min(1, 'Falta la actividad').max(300),
  fecha:           fechaSchema.optional(),
  hora:            txt,
  responsable:     txt,
  observaciones:   z.string().trim().max(1000).nullable().optional(),
  fase:            z.nativeEnum(FaseEvento).nullable().optional(),
  estado:          z.nativeEnum(EstadoTarea).optional(),
});
const aFecha = (s: string) => new Date(`${s.slice(0, 10)}T00:00:00.000Z`);
const limpio = (s: string | null | undefined) => (s === undefined ? undefined : s?.trim() ? s.trim() : null);

async function rubroDelEvento(eventoId: number, rubroEventoId: number | null | undefined) {
  if (!rubroEventoId) return true;
  return !!(await prisma.rubroEvento.findFirst({ where: { id: rubroEventoId, evento_id: eventoId, deleted_at: null } }));
}

// POST /api/eventos/:id/operacion/tareas
export async function createTarea(req: Request, res: Response) {
  const evento = await buscarEvento(req, res);
  if (!evento) return;
  const parsed = tareaSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }); return; }
  const d = parsed.data;
  if (!(await rubroDelEvento(evento.id, d.rubro_evento_id))) { res.status(400).json({ error: 'El rubro no es de este evento' }); return; }
  // Sin fecha: el primer día de la fase (o de la fase que le corresponde)
  const fecha = d.fecha ? aFecha(d.fecha) : d.fase ? fechaDeFase(evento, d.fase) : evento.fecha_inicio;
  if (!fecha) { res.status(400).json({ error: 'Indicá la fecha (el evento no tiene fecha de inicio)' }); return; }
  const fase = d.fase !== undefined ? d.fase : faseDeFecha(evento, fecha);

  const tarea = await prisma.$transaction(async tx => {
    const t = await tx.cronogramaEvento.create({
      data: {
        evento_id: evento.id, empresa_id: req.empresaId!, rubro_evento_id: d.rubro_evento_id ?? null,
        actividad: d.actividad, fecha, hora: limpio(d.hora) ?? null, responsable: limpio(d.responsable) ?? null,
        observaciones: limpio(d.observaciones) ?? null, fase, estado: d.estado ?? 'PENDIENTE', created_by: req.user!.id,
      },
    });
    await registrarAuditoria({
      usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'CREATE', entidad: 'CronogramaEvento',
      entidadId: t.id, eventoId: evento.id, tx: tx as any, descripcion: `Operación: agregó la tarea "${t.actividad}"`,
    });
    return t;
  });
  res.status(201).json(mapTarea(tarea));
}

async function buscarTarea(req: Request, res: Response) {
  const t = await prisma.cronogramaEvento.findFirst({
    where:   { id: Number(req.params.id), deleted_at: null, ...withTenant(req.empresaId!) },
    include: { evento: { select: EVENTO_SELECT } },
  });
  if (!t) res.status(404).json({ error: 'Tarea no encontrada' });
  return t;
}

// PUT /api/tareas-evento/:id
export async function updateTarea(req: Request, res: Response) {
  const t = await buscarTarea(req, res);
  if (!t) return;
  const parsed = tareaSchema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }); return; }
  const d = parsed.data;
  if (d.rubro_evento_id !== undefined && !(await rubroDelEvento(t.evento_id, d.rubro_evento_id))) {
    res.status(400).json({ error: 'El rubro no es de este evento' }); return;
  }
  const fecha = d.fecha ? aFecha(d.fecha) : undefined;
  // Si cambia la fecha y no se indicó la fase, se recalcula
  const fase = d.fase !== undefined ? d.fase : fecha ? faseDeFecha(t.evento, fecha) : undefined;
  const u = await prisma.cronogramaEvento.update({
    where: { id: t.id },
    data: {
      ...(d.actividad !== undefined && { actividad: d.actividad }),
      ...(d.rubro_evento_id !== undefined && { rubro_evento_id: d.rubro_evento_id }),
      ...(fecha && { fecha }),
      ...(fase !== undefined && { fase }),
      ...(d.hora !== undefined && { hora: limpio(d.hora) }),
      ...(d.responsable !== undefined && { responsable: limpio(d.responsable) }),
      ...(d.observaciones !== undefined && { observaciones: limpio(d.observaciones) }),
      ...(d.estado !== undefined && { estado: d.estado }),
    },
  });
  if (d.estado !== undefined && d.estado !== t.estado) {
    await registrarAuditoria({
      usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'UPDATE', entidad: 'CronogramaEvento',
      entidadId: t.id, eventoId: t.evento_id, tx: prisma, descripcion: `Operación: "${u.actividad}" → ${d.estado}`,
    });
  }
  res.json(mapTarea(u));
}

// DELETE /api/tareas-evento/:id
export async function deleteTarea(req: Request, res: Response) {
  const t = await buscarTarea(req, res);
  if (!t) return;
  await prisma.cronogramaEvento.update({ where: { id: t.id }, data: { deleted_at: new Date() } });
  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'DELETE', entidad: 'CronogramaEvento',
    entidadId: t.id, eventoId: t.evento_id, tx: prisma, descripcion: `Operación: borró la tarea "${t.actividad}"`,
  });
  res.status(204).end();
}

async function plantillaDe(rubroId: number) {
  const propias = await prisma.plantillaTarea.findMany({ where: { rubro_id: rubroId }, orderBy: [{ orden: 'asc' }, { id: 'asc' }] });
  return propias.length
    ? { es_default: false, tareas: propias.map(p => ({ actividad: p.actividad, fase: p.fase })) }
    : { es_default: true, tareas: PLANTILLA_DEFAULT };
}

// POST /api/rubros-evento/:id/cargar-tareas — crea las tareas tipo del rubro con
// la fecha de su fase. No duplica las que ya están (misma actividad).
export async function cargarTareasTipo(req: Request, res: Response) {
  const re = await prisma.rubroEvento.findFirst({
    where:   { id: Number(req.params.id), deleted_at: null, ...withTenant(req.empresaId!) },
    include: { evento: { select: EVENTO_SELECT }, rubro: { select: { nombre: true } }, tareas: { where: { deleted_at: null }, select: { actividad: true } } },
  });
  if (!re) { res.status(404).json({ error: 'Rubro no encontrado' }); return; }
  if (!re.evento.fecha_inicio) { res.status(400).json({ error: 'Cargá la fecha de inicio del evento para ubicar las tareas' }); return; }
  const { tareas } = await plantillaDe(re.rubro_id);
  const existentes = new Set(re.tareas.map(t => t.actividad.trim().toLowerCase()));
  const nuevas = tareas.filter(t => !existentes.has(t.actividad.trim().toLowerCase()));
  await prisma.$transaction(async tx => {
    if (nuevas.length) {
      await tx.cronogramaEvento.createMany({
        data: nuevas.map((t, i) => ({
          evento_id: re.evento_id, empresa_id: req.empresaId!, rubro_evento_id: re.id,
          actividad: t.actividad, fase: t.fase, fecha: fechaDeFase(re.evento, t.fase)!, orden: i, created_by: req.user!.id,
        })),
      });
    }
    await registrarAuditoria({
      usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'CREATE', entidad: 'CronogramaEvento',
      eventoId: re.evento_id, tx: tx as any, descripcion: `Operación: cargó ${nuevas.length} tareas tipo de ${re.rubro.nombre}`,
    });
  });
  res.json({ creadas: nuevas.length, ya_estaban: tareas.length - nuevas.length });
}

async function buscarRubro(req: Request, res: Response) {
  const rubro = await prisma.rubro.findFirst({
    where:  { id: Number(req.params.id), ...withTenant(req.empresaId!) },
    select: { id: true, nombre: true },
  });
  if (!rubro) res.status(404).json({ error: 'Rubro no encontrado' });
  return rubro;
}

// GET /api/rubros/:id/plantilla-tareas
export async function getPlantillaTareas(req: Request, res: Response) {
  const rubro = await buscarRubro(req, res);
  if (!rubro) return;
  res.json({ rubro, ...(await plantillaDe(rubro.id)) });
}

// PUT /api/rubros/:id/plantilla-tareas  { tareas: [{ actividad, fase }] } — reemplaza la lista
export async function putPlantillaTareas(req: Request, res: Response) {
  const rubro = await buscarRubro(req, res);
  if (!rubro) return;
  const parsed = z.object({
    tareas: z.array(z.object({ actividad: z.string().trim().min(1).max(300), fase: z.nativeEnum(FaseEvento) })).max(50),
  }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }); return; }
  await prisma.$transaction(async tx => {
    await tx.plantillaTarea.deleteMany({ where: { rubro_id: rubro.id } });
    await tx.plantillaTarea.createMany({
      data: parsed.data.tareas.map((t, i) => ({ empresa_id: req.empresaId!, rubro_id: rubro.id, orden: i, actividad: t.actividad, fase: t.fase, created_by: req.user!.id })),
    });
    await registrarAuditoria({
      usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'UPDATE', entidad: 'PlantillaTarea', entidadId: rubro.id,
      tx: tx as any, descripcion: `Editó las tareas tipo de ${rubro.nombre} (${parsed.data.tareas.length})`,
    });
  });
  res.json({ rubro, ...(await plantillaDe(rubro.id)) });
}

// GET /api/eventos/:id/operacion/cuadrilla-excel — formato de la hoja STAFF COSTS
export async function exportarCuadrilla(req: Request, res: Response) {
  const evento = await buscarEvento(req, res);
  if (!evento) return;
  const { personas, por_categoria } = await calcularCuadrilla(evento, req.empresaId!);
  const rangos = rangosFases(evento);
  const fmt = (d: Date | null) => (d ? `${d.getUTCDate()}/${d.getUTCMonth() + 1}` : '');
  const encabezadoFase = (r: (typeof rangos)[number]) =>
    r.desde && r.hasta ? `${r.label.toUpperCase()} (${fmt(r.desde)} AL ${fmt(r.hasta)})`
      : r.hasta ? `${r.label.toUpperCase()} (HASTA ${fmt(r.hasta)})`
      : r.desde ? `${r.label.toUpperCase()} (DESDE ${fmt(r.desde)})` : r.label.toUpperCase();

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('STAFF COSTS (COSTOS RRHH)');
  ws.columns = [{ width: 18 }, { width: 30 }, ...FASES.map(() => ({ width: 18 })), { width: 12 }];
  ws.getCell('A1').value = 'STAFF COSTS (COSTOS DE PERSONAL)';
  ws.getCell('A1').font = { bold: true, size: 13 };
  ws.getCell('A2').value = `${evento.nombre}${evento.lugar ? ` — ${evento.lugar}` : ''}`;
  const head = ws.getRow(4);
  ['CATEGORÍA', 'PERSONAL', ...rangos.map(encabezadoFase), 'TOTAL DÍAS'].forEach((h, i) => {
    const c = head.getCell(i + 1);
    c.value = h; c.font = { bold: true }; c.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };
  });
  head.height = 32;
  let r = 5;
  for (const cat of por_categoria) {
    for (const p of personas.filter(x => x.categoria === cat.categoria)) {
      const row = ws.getRow(r++);
      row.getCell(1).value = cat.label; row.getCell(2).value = p.nombre;
      FASES.forEach((f, i) => { row.getCell(3 + i).value = p.dias[f.fase] || null; });
      row.getCell(3 + FASES.length).value = p.total;
    }
    const sub = ws.getRow(r++);
    sub.getCell(2).value = `Subtotal ${cat.label} (${cat.personas})`;
    FASES.forEach((f, i) => { sub.getCell(3 + i).value = cat.dias[f.fase]; });
    sub.getCell(3 + FASES.length).value = cat.total;
    sub.font = { bold: true };
    sub.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } }; });
  }
  const tot = ws.getRow(r + 1);
  tot.getCell(2).value = `TOTAL TURNOS (${personas.length} personas)`;
  FASES.forEach((f, i) => { tot.getCell(3 + i).value = por_categoria.reduce((a, c) => a + c.dias[f.fase], 0); });
  tot.getCell(3 + FASES.length).value = por_categoria.reduce((a, c) => a + c.total, 0);
  tot.font = { bold: true };

  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  const archivo = `${evento.nombre.replace(/[\\/:*?"<>|]/g, '-')} - Cuadrilla.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(archivo)}"`);
  res.send(buffer);
}
