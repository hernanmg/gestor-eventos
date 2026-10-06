import type { Request, Response } from 'express';
import { z } from 'zod';
import { EstadoPresupuesto, OrigenMaterialRental, type Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { withTenant } from '../lib/tenant';
import { registrarAuditoria } from '../lib/auditoria';
import {
  parsePlanillaMaterialesRental, claveMaterial, calcularLinea, PORCENTAJES_ALQUILER,
  type PorcentajeAlquiler, type ParseoMateriales,
} from '../lib/materialesRentalImporter';

// Costo Real / Presupuestador — Nivel 1 (DOS57). Catálogo de materiales de
// rental + presupuestos por evento. Todo filtra por la empresa activa de la
// sesión (req.empresaId), no por un empresa_id del request.

const num  = (d: unknown) => (d !== null && d !== undefined ? Number(d) : null);
const round2 = (n: number) => Math.round(n * 100) / 100;

function mapMaterial<T extends Record<string, any>>(m: T) {
  return {
    ...m,
    peso_por_unidad:    num(m.peso_por_unidad),
    costo_unitario_ars: num(m.costo_unitario_ars),
    costo_unitario_usd: num(m.costo_unitario_usd),
    tipo_cambio:        num(m.tipo_cambio),
  };
}

// ══ Materiales ═══════════════════════════════════════════════════════════════

// POST /api/materiales-rental/importar?preview=true|false (multipart, campo `file`,
// opcional `tipo_cambio` para pesificar los IMP con otro TC que el de la planilla)
// Upsert por origen + nro_item + codigo_oficial. Los ítems que no vienen en la
// planilla no se tocan. preview=true no escribe: el frontend lo usa para leer el
// TC de la planilla y compararlo con el dólar oficial antes de importar.
export async function importarMaterialesRental(req: Request, res: Response) {
  if (!req.file) { res.status(400).json({ error: 'Se requiere un archivo .xlsx (campo file)' }); return; }
  const empresaId = req.empresaId!;
  const dryRun = req.query.preview === 'true';
  const tcRaw = req.body?.tipo_cambio;
  const tcForzado = tcRaw !== undefined && tcRaw !== '' ? Number(tcRaw) : null;
  if (tcForzado !== null && !(tcForzado > 0)) { res.status(400).json({ error: 'tipo_cambio inválido' }); return; }

  let parseo: ParseoMateriales;
  try {
    parseo = parsePlanillaMaterialesRental(req.file.buffer, tcForzado);
  } catch (err: any) {
    res.status(400).json({ error: 'Error al procesar el archivo', detail: err.message }); return;
  }
  if (parseo.hojas.length === 0) {
    res.status(400).json({ error: 'No se encontraron las hojas RENTAL COSTS (NAC.) / (IMP.)' }); return;
  }

  const errores = [...parseo.errores];
  // Claves repetidas dentro del archivo: gana la primera
  const vistos = new Set<string>();
  const materiales = parseo.materiales.filter(m => {
    const k = claveMaterial(m);
    if (vistos.has(k)) { errores.push({ hoja: m.hoja, fila: m.fila, mensaje: `Ítem ${m.nro_item} repetido en la hoja — se ignora` }); return false; }
    vistos.add(k);
    return true;
  });

  const existentes = await prisma.materialRental.findMany({
    where:  withTenant(empresaId),
    select: { id: true, origen: true, nro_item: true, codigo_oficial: true },
  });
  const porClave = new Map(existentes.map(e => [claveMaterial(e), e.id]));

  let creados = 0;
  let actualizados = 0;
  if (dryRun) {
    creados      = materiales.filter(m => !porClave.has(claveMaterial(m))).length;
    actualizados = materiales.length - creados;
  } else await prisma.$transaction(async tx => {
    for (const m of materiales) {
      const { hoja: _h, fila: _f, ...campos } = m;
      const data = { ...campos, origen: m.origen as OrigenMaterialRental };
      const id = porClave.get(claveMaterial(m));
      if (id) {
        await tx.materialRental.update({ where: { id }, data });
        actualizados++;
      } else {
        await tx.materialRental.create({ data: { ...data, empresa_id: empresaId, created_by: req.user!.id } });
        creados++;
      }
    }
    await registrarAuditoria({
      usuarioId: req.user!.id, empresaId, accion: 'IMPORT', entidad: 'MaterialRental',
      descripcion: `Importó catálogo de materiales de rental (${req.file!.originalname}) — ${creados} creados, ${actualizados} actualizados, TC ${parseo.tipo_cambio}`,
      ip: req.ip, tx: tx as any,
    });
  }, { timeout: 120_000, maxWait: 10_000 });

  res.json({
    preview: dryRun,
    creados,
    actualizados,
    errores,
    advertencias: parseo.advertencias,
    hojas:       parseo.hojas,
    tipo_cambio: parseo.tipo_cambio,
    tipo_cambio_planilla: parseo.tipo_cambio_planilla,
    sin_precio:  materiales.filter(m => m.costo_unitario_ars === null).map(m => ({ origen: m.origen, nro_item: m.nro_item, detalle: m.detalle })),
  });
}

// GET /api/materiales-rental?origen=NAC|IMP&buscar=&activo=true|false&page=&limit=
export async function listMaterialesRental(req: Request, res: Response) {
  const { origen, buscar, activo } = req.query as Record<string, string | undefined>;
  const page  = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(1000, Math.max(1, Number(req.query.limit) || 50));

  const where: Prisma.MaterialRentalWhereInput = { ...withTenant(req.empresaId!) };
  if (origen === 'NAC' || origen === 'IMP') where.origen = origen;
  if (activo === 'true' || activo === 'false') where.activo = activo === 'true';
  if (buscar?.trim()) {
    const q = buscar.trim();
    where.OR = [
      { detalle:        { contains: q, mode: 'insensitive' } },
      { codigo_oficial: { contains: q, mode: 'insensitive' } },
      ...(/^\d+$/.test(q) ? [{ nro_item: Number(q) }] : []),
    ];
  }

  const [items, total] = await Promise.all([
    prisma.materialRental.findMany({
      where,
      orderBy: [{ origen: 'desc' }, { nro_item: 'asc' }, { id: 'asc' }], // NAC primero
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.materialRental.count({ where }),
  ]);
  res.json({ items: items.map(mapMaterial), total, page, pages: Math.max(1, Math.ceil(total / limit)) });
}

const materialPatchSchema = z.object({
  costo_unitario_ars: z.number().nonnegative().nullable().optional(),
  costo_unitario_usd: z.number().nonnegative().nullable().optional(),
  tipo_cambio:        z.number().positive().nullable().optional(),
  activo:             z.boolean().optional(),
});

// PATCH /api/materiales-rental/:id
// IMP: si cambia USD o TC (y no viene el ARS explícito), el pesificado se recalcula.
export async function updateMaterialRental(req: Request, res: Response) {
  const id = Number(req.params.id);
  const parsed = materialPatchSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return; }
  const existing = await prisma.materialRental.findFirst({ where: { id, ...withTenant(req.empresaId!) } });
  if (!existing) { res.status(404).json({ error: 'Material no encontrado' }); return; }

  const d = parsed.data;
  const data: Prisma.MaterialRentalUpdateInput = { ...d };
  if (existing.origen === 'IMP' && d.costo_unitario_ars === undefined && (d.costo_unitario_usd !== undefined || d.tipo_cambio !== undefined)) {
    const usd = d.costo_unitario_usd !== undefined ? d.costo_unitario_usd : num(existing.costo_unitario_usd);
    const tc  = d.tipo_cambio !== undefined ? d.tipo_cambio : num(existing.tipo_cambio);
    data.costo_unitario_ars = usd !== null && tc !== null ? round2(usd * tc) : null;
  }

  const material = await prisma.materialRental.update({ where: { id }, data });
  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'UPDATE', entidad: 'MaterialRental', entidadId: id,
    descripcion: `Editó el material de rental ${existing.origen} #${existing.nro_item ?? id} (${existing.detalle})`,
    datosDespues: d, ip: req.ip, tx: prisma as any,
  });
  res.json(mapMaterial(material));
}

// ══ Presupuestos ═════════════════════════════════════════════════════════════

const ESTADOS_EDITABLES: EstadoPresupuesto[] = [EstadoPresupuesto.BORRADOR];

const MATERIAL_LINEA_SELECT = {
  id: true, origen: true, nro_item: true, codigo_oficial: true, detalle: true, medida: true,
  costo_unitario_ars: true, costo_unitario_usd: true, tipo_cambio: true,
  porc_2: true, porc_4: true, porc_6: true, porc_8: true, porc_10: true, porc_full: true, activo: true,
} as const;

const PRESUPUESTO_INCLUDE = {
  evento: { select: { id: true, nombre: true } },
  lineas: {
    include: { material: { select: MATERIAL_LINEA_SELECT } },
    orderBy: [{ orden: 'asc' }, { id: 'asc' }],
  },
} satisfies Prisma.PresupuestoEventoInclude;

type PresupuestoFull = Prisma.PresupuestoEventoGetPayload<{ include: typeof PRESUPUESTO_INCLUDE }>;

function totalesDe(lineas: { costo_total_material: unknown; valor_rental: unknown; valor_rental_full: unknown; material: { origen: string } }[]) {
  const t = { nac_material: 0, nac_rental: 0, imp_material: 0, imp_rental: 0 };
  let full: number | null = null; // null = ninguna línea tiene FULL cargado
  for (const l of lineas) {
    const pre = l.material.origen === 'IMP' ? 'imp' : 'nac';
    t[`${pre}_material`] += Number(l.costo_total_material);
    t[`${pre}_rental`]   += Number(l.valor_rental);
    if (l.valor_rental_full !== null) full = (full ?? 0) + Number(l.valor_rental_full);
  }
  return {
    nac_material:   round2(t.nac_material),
    nac_rental:     round2(t.nac_rental),
    imp_material:   round2(t.imp_material),
    imp_rental:     round2(t.imp_rental),
    total_material: round2(t.nac_material + t.imp_material),
    total_rental:   round2(t.nac_rental + t.imp_rental),
    total_full:     full !== null ? round2(full) : null,
  };
}

function mapPresupuesto(p: PresupuestoFull) {
  return {
    ...p,
    tipo_cambio_usd: Number(p.tipo_cambio_usd),
    lineas: p.lineas.map(l => ({
      ...l,
      cantidad:             Number(l.cantidad),
      costo_unitario_snap:  Number(l.costo_unitario_snap),
      tipo_cambio_snap:     num(l.tipo_cambio_snap),
      porcentaje_snap:      Number(l.porcentaje_snap),
      costo_total_material: Number(l.costo_total_material),
      valor_rental:         Number(l.valor_rental),
      valor_rental_full:    num(l.valor_rental_full),
      material:             mapMaterial(l.material),
    })),
    totales: totalesDe(p.lineas),
  };
}

const lineaSchema = z.object({
  material_id: z.number().int().positive(),
  cantidad:    z.number().positive('La cantidad tiene que ser mayor a 0'),
  // ALQUILER FULL negociado a mano; se ignora si la línea no admite FULL
  valor_rental_full: z.number().nonnegative().nullable().optional(),
});

const presupuestoSchema = z.object({
  evento_id:           z.number().int().positive().nullable().optional(),
  nombre:              z.string().trim().nullable().optional(),
  porcentaje_alquiler: z.enum(PORCENTAJES_ALQUILER),
  tipo_cambio_usd:     z.number().positive().optional(),
  notas:               z.string().nullable().optional(),
  lineas:              z.array(lineaSchema).default([]),
});

// Valida evento/materiales contra la empresa y calcula cada línea con los
// precios ACTUALES del catálogo (snapshot). Devuelve las líneas listas para createMany.
async function armarPresupuesto(d: z.infer<typeof presupuestoSchema>, empresaId: number) {
  let nombre = d.nombre?.trim() || null;
  if (d.evento_id) {
    const evento = await prisma.evento.findFirst({ where: { id: d.evento_id, deleted_at: null, ...withTenant(empresaId) }, select: { nombre: true } });
    if (!evento) return { error: 'Evento no encontrado' } as const;
    nombre ??= evento.nombre;
  }
  if (!nombre) return { error: 'Elegí un evento o escribí un nombre para el presupuesto' } as const;

  const ids = [...new Set(d.lineas.map(l => l.material_id))];
  const materiales = await prisma.materialRental.findMany({
    where:  { id: { in: ids }, ...withTenant(empresaId) },
    select: { id: true, origen: true, costo_unitario_ars: true, costo_unitario_usd: true, porc_full: true },
  });
  const porId = new Map(materiales.map(m => [m.id, m]));
  const faltantes = ids.filter(id => !porId.has(id));
  if (faltantes.length) return { error: `Materiales no encontrados: ${faltantes.join(', ')}` } as const;

  const tc = d.tipo_cambio_usd ?? 1700;
  const lineas = d.lineas.map((l, i) => {
    const m = porId.get(l.material_id)!;
    return {
      material_id: l.material_id,
      cantidad:    l.cantidad,
      orden:       i,
      ...calcularLinea(
        { origen: m.origen, costo_unitario_ars: num(m.costo_unitario_ars), costo_unitario_usd: num(m.costo_unitario_usd) },
        l.cantidad, d.porcentaje_alquiler, tc,
      ),
      // FULL no se calcula nunca: sólo NAC con porc_full, y tal cual vino (o null)
      valor_rental_full: m.origen === 'NAC' && m.porc_full ? (l.valor_rental_full ?? null) : null,
    };
  });
  return { nombre, tc, lineas } as const;
}

async function cargarPresupuesto(id: number, empresaId: number) {
  return prisma.presupuestoEvento.findFirst({
    where:   { id, deleted_at: null, ...withTenant(empresaId) },
    include: PRESUPUESTO_INCLUDE,
  });
}

// GET /api/presupuestos?evento_id=&estado=
export async function listPresupuestos(req: Request, res: Response) {
  const { evento_id, estado } = req.query as Record<string, string | undefined>;
  const where: Prisma.PresupuestoEventoWhereInput = { ...withTenant(req.empresaId!), deleted_at: null };
  if (evento_id) where.evento_id = Number(evento_id);
  if (estado && estado in EstadoPresupuesto) where.estado = estado as EstadoPresupuesto;

  const presupuestos = await prisma.presupuestoEvento.findMany({
    where,
    include: {
      evento: { select: { id: true, nombre: true } },
      lineas: { select: { costo_total_material: true, valor_rental: true, valor_rental_full: true, material: { select: { origen: true } } } },
    },
    orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
  });
  res.json(presupuestos.map(({ lineas, ...p }) => ({
    ...p,
    tipo_cambio_usd: Number(p.tipo_cambio_usd),
    cantidad_lineas: lineas.length,
    totales:         totalesDe(lineas),
  })));
}

// GET /api/presupuestos/:id
export async function getPresupuesto(req: Request, res: Response) {
  const p = await cargarPresupuesto(Number(req.params.id), req.empresaId!);
  if (!p) { res.status(404).json({ error: 'Presupuesto no encontrado' }); return; }
  res.json(mapPresupuesto(p));
}

// POST /api/presupuestos
export async function createPresupuesto(req: Request, res: Response) {
  const parsed = presupuestoSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return; }
  const r = await armarPresupuesto(parsed.data, req.empresaId!);
  if ('error' in r) { res.status(400).json({ error: r.error }); return; }

  const creado = await prisma.presupuestoEvento.create({
    data: {
      empresa_id:          req.empresaId!,
      evento_id:           parsed.data.evento_id ?? null,
      nombre:              r.nombre,
      porcentaje_alquiler: parsed.data.porcentaje_alquiler,
      tipo_cambio_usd:     r.tc,
      notas:               parsed.data.notas?.trim() || null,
      created_by:          req.user!.id,
      lineas:              { create: r.lineas },
    },
  });
  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'CREATE', entidad: 'PresupuestoEvento', entidadId: creado.id,
    descripcion: `Creó el presupuesto "${r.nombre}" (${r.lineas.length} ítems)`, ip: req.ip, tx: prisma as any,
  });
  res.status(201).json(mapPresupuesto((await cargarPresupuesto(creado.id, req.empresaId!))!));
}

// PUT /api/presupuestos/:id — reemplaza cabecera y TODAS las líneas (sólo BORRADOR)
export async function updatePresupuesto(req: Request, res: Response) {
  const id = Number(req.params.id);
  const parsed = presupuestoSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return; }
  const existing = await prisma.presupuestoEvento.findFirst({ where: { id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!existing) { res.status(404).json({ error: 'Presupuesto no encontrado' }); return; }
  if (!ESTADOS_EDITABLES.includes(existing.estado)) {
    res.status(409).json({ error: `El presupuesto está ${existing.estado} — creá una nueva versión para modificarlo` }); return;
  }
  const r = await armarPresupuesto({ ...parsed.data, tipo_cambio_usd: parsed.data.tipo_cambio_usd ?? Number(existing.tipo_cambio_usd) }, req.empresaId!);
  if ('error' in r) { res.status(400).json({ error: r.error }); return; }

  await prisma.$transaction(async tx => {
    await tx.presupuestoLinea.deleteMany({ where: { presupuesto_id: id } });
    await tx.presupuestoEvento.update({
      where: { id },
      data: {
        evento_id:           parsed.data.evento_id ?? null,
        nombre:              r.nombre,
        porcentaje_alquiler: parsed.data.porcentaje_alquiler,
        tipo_cambio_usd:     r.tc,
        notas:               parsed.data.notas?.trim() || null,
        lineas:              { create: r.lineas },
      },
    });
  });
  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'UPDATE', entidad: 'PresupuestoEvento', entidadId: id,
    descripcion: `Editó el presupuesto "${r.nombre}" (${r.lineas.length} ítems)`, ip: req.ip, tx: prisma as any,
  });
  res.json(mapPresupuesto((await cargarPresupuesto(id, req.empresaId!))!));
}

// PATCH /api/presupuestos/:id/estado  { estado }
export async function cambiarEstadoPresupuesto(req: Request, res: Response) {
  const id = Number(req.params.id);
  const parsed = z.object({ estado: z.nativeEnum(EstadoPresupuesto) }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Estado inválido' }); return; }
  const existing = await prisma.presupuestoEvento.findFirst({ where: { id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!existing) { res.status(404).json({ error: 'Presupuesto no encontrado' }); return; }

  await prisma.presupuestoEvento.update({ where: { id }, data: { estado: parsed.data.estado } });
  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'UPDATE', entidad: 'PresupuestoEvento', entidadId: id,
    descripcion: `Presupuesto "${existing.nombre}": ${existing.estado} → ${parsed.data.estado}`, ip: req.ip, tx: prisma as any,
  });
  res.json(mapPresupuesto((await cargarPresupuesto(id, req.empresaId!))!));
}

// PATCH /api/presupuestos/:id/tipo-cambio  { tipo_cambio_usd }
// Recalcula sólo las líneas IMP con el TC nuevo (USD actual del catálogo × TC);
// las NAC conservan su snapshot. Sólo en BORRADOR.
export async function cambiarTipoCambioPresupuesto(req: Request, res: Response) {
  const id = Number(req.params.id);
  const parsed = z.object({ tipo_cambio_usd: z.number().positive() }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Tipo de cambio inválido' }); return; }
  const p = await cargarPresupuesto(id, req.empresaId!);
  if (!p) { res.status(404).json({ error: 'Presupuesto no encontrado' }); return; }
  if (!ESTADOS_EDITABLES.includes(p.estado)) {
    res.status(409).json({ error: `El presupuesto está ${p.estado} — creá una nueva versión para recalcularlo` }); return;
  }

  const tc = parsed.data.tipo_cambio_usd;
  const imp = p.lineas.filter(l => l.material.origen === 'IMP');
  await prisma.$transaction(async tx => {
    await tx.presupuestoEvento.update({ where: { id }, data: { tipo_cambio_usd: tc } });
    for (const l of imp) {
      const calc = calcularLinea(
        { origen: 'IMP', costo_unitario_ars: num(l.material.costo_unitario_ars), costo_unitario_usd: num(l.material.costo_unitario_usd) },
        Number(l.cantidad), p.porcentaje_alquiler as PorcentajeAlquiler, tc,
      );
      await tx.presupuestoLinea.update({ where: { id: l.id }, data: calc });
    }
  });
  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'UPDATE', entidad: 'PresupuestoEvento', entidadId: id,
    descripcion: `Presupuesto "${p.nombre}": TC ${Number(p.tipo_cambio_usd)} → ${tc} (${imp.length} líneas IMP recalculadas)`, ip: req.ip, tx: prisma as any,
  });
  res.json(mapPresupuesto((await cargarPresupuesto(id, req.empresaId!))!));
}

// POST /api/presupuestos/:id/nueva-version — copia (con los mismos snapshots)
// en BORRADOR, para modificar un presupuesto ya enviado/aprobado/cerrado.
export async function nuevaVersionPresupuesto(req: Request, res: Response) {
  const id = Number(req.params.id);
  const p = await cargarPresupuesto(id, req.empresaId!);
  if (!p) { res.status(404).json({ error: 'Presupuesto no encontrado' }); return; }

  const raizId = p.version_de_id ?? p.id;
  const ultima = await prisma.presupuestoEvento.aggregate({
    where: { OR: [{ id: raizId }, { version_de_id: raizId }], deleted_at: null },
    _max:  { version: true },
  });
  const nueva = await prisma.presupuestoEvento.create({
    data: {
      empresa_id:          p.empresa_id,
      evento_id:           p.evento_id,
      nombre:              p.nombre,
      porcentaje_alquiler: p.porcentaje_alquiler,
      tipo_cambio_usd:     p.tipo_cambio_usd,
      notas:               p.notas,
      version:             (ultima._max.version ?? p.version) + 1,
      version_de_id:       raizId,
      created_by:          req.user!.id,
      lineas: {
        create: p.lineas.map(l => ({
          material_id: l.material_id, cantidad: l.cantidad, orden: l.orden,
          costo_unitario_snap: l.costo_unitario_snap, tipo_cambio_snap: l.tipo_cambio_snap, porcentaje_snap: l.porcentaje_snap,
          costo_total_material: l.costo_total_material, valor_rental: l.valor_rental, valor_rental_full: l.valor_rental_full,
        })),
      },
    },
  });
  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'CREATE', entidad: 'PresupuestoEvento', entidadId: nueva.id,
    descripcion: `Nueva versión (v${nueva.version}) del presupuesto "${p.nombre}"`, ip: req.ip, tx: prisma as any,
  });
  res.status(201).json(mapPresupuesto((await cargarPresupuesto(nueva.id, req.empresaId!))!));
}
