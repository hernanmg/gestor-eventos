import type { Request, Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import type { Prisma, GravedadNovedad, EstadoNovedad } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { registrarAuditoria } from '../lib/auditoria';

// ── Libro de novedades (pilar 10) ─────────────────────────────────────────────
// Ver el comentario de Novedad en schema.prisma. Todos cargan (ADMIN, OPERADOR
// y el pañolero); VIEWER sólo mira. Los tipos son editables por empresa y la
// primera vez que una empresa entra se le crean los tipos de base.

export const GRAVEDADES: GravedadNovedad[] = ['BAJA', 'MEDIA', 'ALTA', 'CRITICA'];
const ESTADOS: EstadoNovedad[] = ['ABIERTA', 'EN_CURSO', 'RESUELTA'];
export const GRAVEDAD_RANK: Record<GravedadNovedad, number> = { CRITICA: 0, ALTA: 1, MEDIA: 2, BAJA: 3 };

const TIPOS_BASE: { nombre: string; color: string }[] = [
  { nombre: 'Flota',     color: '#0E7490' },
  { nombre: 'Material',  color: '#92400E' },
  { nombre: 'Personal',  color: '#7C3AED' },
  { nombre: 'Proveedor', color: '#3730A3' },
  { nombre: 'Cliente',   color: '#065F46' },
  { nombre: 'Clima',     color: '#0369A1' },
  { nombre: 'Otro',      color: '#6B7280' },
];

const MAX_ADJUNTOS = 10;

export const uploadAdjuntosNovedad = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024, files: MAX_ADJUNTOS },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Sólo se aceptan fotos o PDF'));
  },
});

// ── Validación ────────────────────────────────────────────────────────────────

const vacioANull = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : v);
const texto = (max: number) => z.preprocess(vacioANull, z.string().trim().max(max).nullable().optional());
const idOpc = z.preprocess(v => (v === '' || v === undefined ? null : v), z.number().int().positive().nullable().optional());
const fechaCal = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida').transform(s => new Date(`${s}T00:00:00Z`));

const novedadSchema = z.object({
  tipo_id:        z.number().int().positive({ message: 'Elegí el tipo' }),
  fecha:          fechaCal,
  hora:           z.preprocess(vacioANull, z.string().regex(/^\d{2}:\d{2}$/, 'Hora inválida').nullable().optional()),
  titulo:         z.string().trim().min(3, 'Contá en pocas palabras qué pasó').max(200),
  descripcion:    texto(4000),
  lugar:          texto(200),
  gravedad:       z.enum(GRAVEDADES as [GravedadNovedad, ...GravedadNovedad[]]).default('MEDIA'),
  estado:         z.enum(ESTADOS as [EstadoNovedad, ...EstadoNovedad[]]).default('ABIERTA'),
  reportado_por:  texto(200),
  responsable_id: idOpc,
  evento_id:      idOpc,
  camion_id:      idOpc,
  empleado_id:    idOpc,
  proveedor_id:   idOpc,
  resolucion:     texto(4000),
});

const tipoSchema = z.object({
  nombre:             z.string().trim().min(2).max(60),
  color:              z.preprocess(vacioANull, z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional()),
  orden:              z.number().int().optional(),
  activo:             z.boolean().optional(),
  avisar_usuario_ids: z.array(z.number().int().positive()).max(30).optional(),
});

function badRequest(res: Response, err: z.ZodError) {
  const f = err.flatten();
  const primero = Object.values(f.fieldErrors).flat()[0] ?? f.formErrors[0] ?? 'Datos inválidos';
  res.status(400).json({ error: primero, detail: f.fieldErrors });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export async function asegurarTiposBase(empresaId: number) {
  const hay = await prisma.tipoNovedad.count({ where: { empresa_id: empresaId } });
  if (hay > 0) return;
  await prisma.tipoNovedad.createMany({
    data: TIPOS_BASE.map((t, i) => ({ empresa_id: empresaId, nombre: t.nombre, color: t.color, orden: i })),
    skipDuplicates: true,
  });
}

async function esAdminGlobal(usuarioId: number): Promise<boolean> {
  const u = await prisma.usuario.findFirst({ where: { id: usuarioId, deleted_at: null }, select: { rol: true, empresa_id: true } });
  return !!u && u.rol === 'ADMIN' && u.empresa_id === null;
}

const includeNovedad = {
  tipo:      { select: { id: true, nombre: true, color: true } },
  evento:    { select: { id: true, nombre: true } },
  camion:    { select: { id: true, codigo: true, patente: true } },
  empleado:  { select: { id: true, nombre: true, apellido: true } },
  proveedor: { select: { id: true, nombre: true } },
  adjuntos:  { where: { deleted_at: null }, select: { id: true, nombre: true, mime: true, tamanio: true, created_at: true }, orderBy: { id: 'asc' as const } },
} satisfies Prisma.NovedadInclude;

type NovedadConRel = Prisma.NovedadGetPayload<{ include: typeof includeNovedad }>;

async function nombresUsuarios(ids: (number | null | undefined)[]): Promise<Map<number, string>> {
  const unicos = [...new Set(ids.filter((x): x is number => typeof x === 'number'))];
  if (!unicos.length) return new Map();
  const us = await prisma.usuario.findMany({ where: { id: { in: unicos } }, select: { id: true, nombre: true } });
  return new Map(us.map(u => [u.id, u.nombre]));
}

function serializar(n: NovedadConRel, nombres: Map<number, string>, usuarioId: number, rol: string) {
  return {
    ...n,
    responsable_nombre: n.responsable_id ? nombres.get(n.responsable_id) ?? null : null,
    creado_por_nombre:  n.created_by ? nombres.get(n.created_by) ?? null : null,
    resuelta_por_nombre: n.resuelta_por ? nombres.get(n.resuelta_por) ?? null : null,
    puede_editar: puedeEditar(n, usuarioId, rol),
  };
}

function puedeEditar(n: { created_by: number | null }, usuarioId: number, rol: string): boolean {
  if (rol === 'ADMIN' || rol === 'OPERADOR') return true;
  if (rol === 'PANOLERO') return n.created_by === usuarioId;
  return false;
}

const ordenarNovedades = <T extends { estado: EstadoNovedad; gravedad: GravedadNovedad; fecha: Date; id: number }>(a: T, b: T) =>
  Number(a.estado === 'RESUELTA') - Number(b.estado === 'RESUELTA')
  || GRAVEDAD_RANK[a.gravedad] - GRAVEDAD_RANK[b.gravedad]
  || b.fecha.getTime() - a.fecha.getTime()
  || b.id - a.id;

// Los vínculos tienen que ser de la misma empresa (los ids llegan del cliente).
async function validarVinculos(empresaId: number, d: Partial<z.infer<typeof novedadSchema>>): Promise<string | null> {
  const checks: [unknown, () => Promise<unknown>, string][] = [
    [d.tipo_id,      () => prisma.tipoNovedad.findFirst({ where: { id: d.tipo_id!, empresa_id: empresaId, deleted_at: null } }), 'El tipo no existe'],
    [d.evento_id,    () => prisma.evento.findFirst({ where: { id: d.evento_id!, empresa_id: empresaId, deleted_at: null } }), 'El evento no es de esta empresa'],
    [d.camion_id,    () => prisma.camion.findFirst({ where: { id: d.camion_id!, empresa_id: empresaId, deleted_at: null } }), 'El vehículo no es de esta empresa'],
    [d.empleado_id,  () => prisma.empleado.findFirst({ where: { id: d.empleado_id!, empresa_id: empresaId, deleted_at: null } }), 'La persona no es de esta empresa'],
    [d.proveedor_id, () => prisma.proveedor.findFirst({ where: { id: d.proveedor_id!, empresa_id: empresaId, deleted_at: null } }), 'El proveedor no es de esta empresa'],
    [d.responsable_id, () => prisma.usuario.findFirst({ where: { id: d.responsable_id!, deleted_at: null, activo: true, OR: [{ empresa_id: empresaId }, { empresa_id: null }] } }), 'El responsable no es un usuario de esta empresa'],
  ];
  for (const [valor, buscar, msg] of checks) {
    if (valor == null) continue;
    if (!(await buscar())) return msg;
  }
  return null;
}

async function cargar(id: number, empresaId: number) {
  return prisma.novedad.findFirst({ where: { id, empresa_id: empresaId, deleted_at: null }, include: includeNovedad });
}

async function responder(res: Response, req: Request, id: number, status = 200) {
  const n = await cargar(id, req.empresaId!);
  if (!n) { res.status(404).json({ error: 'Novedad no encontrada' }); return; }
  const nombres = await nombresUsuarios([n.responsable_id, n.created_by, n.resuelta_por]);
  res.status(status).json(serializar(n, nombres, req.user!.id, req.user!.rol));
}

// ── Tipos ─────────────────────────────────────────────────────────────────────

export async function listTipos(req: Request, res: Response) {
  await asegurarTiposBase(req.empresaId!);
  const tipos = await prisma.tipoNovedad.findMany({
    where: { empresa_id: req.empresaId!, deleted_at: null },
    orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
  });
  res.json(tipos);
}

export async function createTipo(req: Request, res: Response) {
  const p = tipoSchema.safeParse(req.body);
  if (!p.success) { badRequest(res, p.error); return; }
  const existe = await prisma.tipoNovedad.findFirst({ where: { empresa_id: req.empresaId!, nombre: { equals: p.data.nombre, mode: 'insensitive' } } });
  if (existe) { res.status(409).json({ error: `Ya existe el tipo "${existe.nombre}"` }); return; }
  const max = await prisma.tipoNovedad.aggregate({ where: { empresa_id: req.empresaId! }, _max: { orden: true } });
  const tipo = await prisma.tipoNovedad.create({
    data: { ...p.data, empresa_id: req.empresaId!, orden: p.data.orden ?? (max._max.orden ?? 0) + 1, created_by: req.user!.id },
  });
  await registrarAuditoria({ usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'CREATE', entidad: 'TipoNovedad', entidadId: tipo.id, descripcion: `Creó el tipo de novedad "${tipo.nombre}"`, ip: req.ip, tx: prisma });
  res.status(201).json(tipo);
}

export async function updateTipo(req: Request, res: Response) {
  const id = Number(req.params.id);
  const antes = await prisma.tipoNovedad.findFirst({ where: { id, empresa_id: req.empresaId!, deleted_at: null } });
  if (!antes) { res.status(404).json({ error: 'Tipo no encontrado' }); return; }
  const p = tipoSchema.partial().safeParse(req.body);
  if (!p.success) { badRequest(res, p.error); return; }
  if (p.data.nombre && p.data.nombre.toLowerCase() !== antes.nombre.toLowerCase()) {
    const choca = await prisma.tipoNovedad.findFirst({ where: { empresa_id: req.empresaId!, id: { not: id }, nombre: { equals: p.data.nombre, mode: 'insensitive' } } });
    if (choca) { res.status(409).json({ error: `Ya existe el tipo "${choca.nombre}"` }); return; }
  }
  const tipo = await prisma.tipoNovedad.update({ where: { id }, data: p.data });
  await registrarAuditoria({ usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'UPDATE', entidad: 'TipoNovedad', entidadId: id, descripcion: `Modificó el tipo de novedad "${tipo.nombre}"`, datosAntes: antes, datosDespues: tipo, ip: req.ip, tx: prisma });
  res.json(tipo);
}

// ── Opciones para el formulario ───────────────────────────────────────────────
// Un solo endpoint con lo que hace falta para ligar la novedad: así quien
// carga (operador, pañolero) no depende de tener acceso a Eventos, Flota o RRHH.

export async function opciones(req: Request, res: Response) {
  const empresaId = req.empresaId!;
  await asegurarTiposBase(empresaId);
  const haceUnAnio = new Date(Date.now() - 400 * 86_400_000);
  const [tipos, eventos, camiones, empleados, proveedores, usuarios] = await Promise.all([
    prisma.tipoNovedad.findMany({ where: { empresa_id: empresaId, deleted_at: null }, orderBy: [{ orden: 'asc' }, { nombre: 'asc' }] }),
    prisma.evento.findMany({
      where: { empresa_id: empresaId, deleted_at: null, OR: [{ fecha_inicio: null }, { fecha_inicio: { gte: haceUnAnio } }, { fecha_fin: { gte: haceUnAnio } }] },
      select: { id: true, nombre: true, fecha_inicio: true },
      orderBy: [{ fecha_inicio: 'desc' }, { id: 'desc' }],
      take: 400,
    }),
    prisma.camion.findMany({ where: { empresa_id: empresaId, deleted_at: null, activo: true }, select: { id: true, codigo: true, patente: true, tipo_vehiculo: true }, orderBy: { codigo: 'asc' } }),
    prisma.empleado.findMany({ where: { empresa_id: empresaId, deleted_at: null, estado: 'ACTIVO' }, select: { id: true, nombre: true, apellido: true }, orderBy: [{ apellido: 'asc' }, { nombre: 'asc' }] }),
    prisma.proveedor.findMany({ where: { empresa_id: empresaId, deleted_at: null, activo: true }, select: { id: true, nombre: true }, orderBy: { nombre: 'asc' } }),
    prisma.usuario.findMany({
      where: { deleted_at: null, activo: true, rol: { in: ['ADMIN', 'OPERADOR', 'PANOLERO'] }, OR: [{ empresa_id: empresaId }, { empresa_id: null }] },
      select: { id: true, nombre: true, rol: true, empresa_id: true },
      orderBy: { nombre: 'asc' },
    }),
  ]);
  res.json({ tipos, eventos, camiones, empleados, proveedores, usuarios });
}

// ── Novedades ─────────────────────────────────────────────────────────────────

const filtrosSchema = z.object({
  estado:      z.enum(['ABIERTAS', 'RESUELTAS', 'TODAS']).default('ABIERTAS'),
  tipo_id:     z.coerce.number().int().positive().optional(),
  gravedad:    z.enum(GRAVEDADES as [GravedadNovedad, ...GravedadNovedad[]]).optional(),
  evento_id:   z.coerce.number().int().positive().optional(),
  camion_id:   z.coerce.number().int().positive().optional(),
  empleado_id: z.coerce.number().int().positive().optional(),
  q:           z.string().trim().max(100).optional(),
  desde:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  hasta:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function listNovedades(req: Request, res: Response) {
  const p = filtrosSchema.safeParse(req.query);
  if (!p.success) { badRequest(res, p.error); return; }
  const f = p.data;
  const empresaId = req.empresaId!;

  const base: Prisma.NovedadWhereInput = {
    empresa_id: empresaId, deleted_at: null,
    ...(f.evento_id   && { evento_id: f.evento_id }),
    ...(f.camion_id   && { camion_id: f.camion_id }),
    ...(f.empleado_id && { empleado_id: f.empleado_id }),
    ...((f.desde || f.hasta) && { fecha: { ...(f.desde && { gte: new Date(`${f.desde}T00:00:00Z`) }), ...(f.hasta && { lte: new Date(`${f.hasta}T00:00:00Z`) }) } }),
    ...(f.q && { OR: [
      { titulo: { contains: f.q, mode: 'insensitive' } },
      { descripcion: { contains: f.q, mode: 'insensitive' } },
      { lugar: { contains: f.q, mode: 'insensitive' } },
      { reportado_por: { contains: f.q, mode: 'insensitive' } },
      { resolucion: { contains: f.q, mode: 'insensitive' } },
    ] }),
  };
  const porEstado: Prisma.NovedadWhereInput =
    f.estado === 'ABIERTAS' ? { estado: { not: 'RESUELTA' } } : f.estado === 'RESUELTAS' ? { estado: 'RESUELTA' } : {};

  // Conteos (para las tarjetas de gravedad y los chips de tipo) sobre el mismo
  // filtro de estado/vínculo/búsqueda, sin el filtro de tipo ni de gravedad.
  const [lista, porGravedad, porTipo] = await Promise.all([
    prisma.novedad.findMany({
      where: { ...base, ...porEstado, ...(f.tipo_id && { tipo_id: f.tipo_id }), ...(f.gravedad && { gravedad: f.gravedad }) },
      include: includeNovedad,
      orderBy: [{ fecha: 'desc' }, { id: 'desc' }],
      take: 500,
    }),
    prisma.novedad.groupBy({ by: ['gravedad'], where: { ...base, ...porEstado, ...(f.tipo_id && { tipo_id: f.tipo_id }) }, _count: true }),
    prisma.novedad.groupBy({ by: ['tipo_id'], where: { ...base, ...porEstado, ...(f.gravedad && { gravedad: f.gravedad }) }, _count: true }),
  ]);

  lista.sort(ordenarNovedades);
  const nombres = await nombresUsuarios(lista.flatMap(n => [n.responsable_id, n.created_by, n.resuelta_por]));
  res.json({
    items: lista.map(n => serializar(n, nombres, req.user!.id, req.user!.rol)),
    por_gravedad: Object.fromEntries(porGravedad.map(g => [g.gravedad, g._count])),
    por_tipo:     Object.fromEntries(porTipo.map(t => [t.tipo_id, t._count])),
    recortado:    lista.length === 500,
  });
}

export async function getNovedad(req: Request, res: Response) {
  await responder(res, req, Number(req.params.id));
}

export async function createNovedad(req: Request, res: Response) {
  const p = novedadSchema.safeParse(req.body);
  if (!p.success) { badRequest(res, p.error); return; }
  const d = p.data;
  const empresaId = req.empresaId!;
  const err = await validarVinculos(empresaId, d);
  if (err) { res.status(400).json({ error: err }); return; }
  const uid = req.user!.id;
  const resuelta = d.estado === 'RESUELTA';

  const n = await prisma.$transaction(async tx => {
    const creada = await tx.novedad.create({
      data: {
        ...d, empresa_id: empresaId, created_by: uid, updated_by: uid,
        ...(resuelta && { resuelta_at: new Date(), resuelta_por: uid }),
      },
    });
    await registrarAuditoria({
      usuarioId: uid, empresaId, eventoId: d.evento_id ?? undefined, accion: 'CREATE', entidad: 'Novedad', entidadId: creada.id,
      descripcion: `Cargó la novedad "${d.titulo}" (${d.gravedad.toLowerCase()})`, datosDespues: creada, ip: req.ip, tx,
    });
    return creada;
  });
  await responder(res, req, n.id, 201);
}

export async function updateNovedad(req: Request, res: Response) {
  const id = Number(req.params.id);
  const antes = await prisma.novedad.findFirst({ where: { id, empresa_id: req.empresaId!, deleted_at: null } });
  if (!antes) { res.status(404).json({ error: 'Novedad no encontrada' }); return; }
  if (!puedeEditar(antes, req.user!.id, req.user!.rol)) { res.status(403).json({ error: 'Sólo podés modificar las novedades que cargaste vos' }); return; }

  const p = novedadSchema.partial().safeParse(req.body);
  if (!p.success) { badRequest(res, p.error); return; }
  const d = p.data;
  const err = await validarVinculos(req.empresaId!, d);
  if (err) { res.status(400).json({ error: err }); return; }
  const uid = req.user!.id;

  // Resolver / reabrir: se anota quién y cuándo la dio por resuelta
  const pasaAResuelta = d.estado === 'RESUELTA' && antes.estado !== 'RESUELTA';
  const reabre = d.estado && d.estado !== 'RESUELTA' && antes.estado === 'RESUELTA';

  await prisma.$transaction(async tx => {
    const despues = await tx.novedad.update({
      where: { id },
      data: {
        ...d, updated_by: uid,
        ...(pasaAResuelta && { resuelta_at: new Date(), resuelta_por: uid }),
        ...(reabre && { resuelta_at: null, resuelta_por: null }),
      },
    });
    const accion = pasaAResuelta ? 'Resolvió' : reabre ? 'Reabrió' : 'Modificó';
    await registrarAuditoria({
      usuarioId: uid, empresaId: req.empresaId, eventoId: despues.evento_id ?? undefined, accion: 'UPDATE', entidad: 'Novedad', entidadId: id,
      descripcion: `${accion} la novedad "${despues.titulo}"`, datosAntes: antes, datosDespues: despues, ip: req.ip, tx,
    });
  });
  await responder(res, req, id);
}

export async function deleteNovedad(req: Request, res: Response) {
  const id = Number(req.params.id);
  const n = await prisma.novedad.findFirst({ where: { id, empresa_id: req.empresaId!, deleted_at: null } });
  if (!n) { res.status(404).json({ error: 'Novedad no encontrada' }); return; }
  if (req.user!.rol !== 'ADMIN' && n.created_by !== req.user!.id) {
    res.status(403).json({ error: 'Sólo quien la cargó o un administrador pueden borrarla' }); return;
  }
  await prisma.$transaction(async tx => {
    await tx.novedad.update({ where: { id }, data: { deleted_at: new Date(), updated_by: req.user!.id } });
    await registrarAuditoria({
      usuarioId: req.user!.id, empresaId: req.empresaId, eventoId: n.evento_id ?? undefined, accion: 'DELETE', entidad: 'Novedad', entidadId: id,
      descripcion: `Borró la novedad "${n.titulo}"`, datosAntes: n, ip: req.ip, tx,
    });
  });
  res.status(204).end();
}

// ── Fotos y archivos ──────────────────────────────────────────────────────────

export async function subirAdjuntos(req: Request, res: Response) {
  const id = Number(req.params.id);
  const n = await prisma.novedad.findFirst({ where: { id, empresa_id: req.empresaId!, deleted_at: null } });
  if (!n) { res.status(404).json({ error: 'Novedad no encontrada' }); return; }
  if (!puedeEditar(n, req.user!.id, req.user!.rol)) { res.status(403).json({ error: 'Sólo podés agregar fotos a las novedades que cargaste vos' }); return; }
  const archivos = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (!archivos.length) { res.status(400).json({ error: 'No llegó ningún archivo' }); return; }
  const actuales = await prisma.adjuntoNovedad.count({ where: { novedad_id: id, deleted_at: null } });
  if (actuales + archivos.length > MAX_ADJUNTOS) {
    res.status(400).json({ error: `Cada novedad admite hasta ${MAX_ADJUNTOS} archivos (ya tiene ${actuales})` }); return;
  }
  await prisma.$transaction(async tx => {
    for (const a of archivos) {
      await tx.adjuntoNovedad.create({
        data: { novedad_id: id, nombre: a.originalname, mime: a.mimetype, tamanio: a.size, data: a.buffer, created_by: req.user!.id },
      });
    }
    await registrarAuditoria({
      usuarioId: req.user!.id, empresaId: req.empresaId, eventoId: n.evento_id ?? undefined, accion: 'UPDATE', entidad: 'Novedad', entidadId: id,
      descripcion: `Agregó ${archivos.length} archivo(s) a la novedad "${n.titulo}"`, ip: req.ip, tx,
    });
  });
  await responder(res, req, id, 201);
}

async function buscarAdjunto(req: Request) {
  return prisma.adjuntoNovedad.findFirst({
    where: { id: Number(req.params.adjuntoId), deleted_at: null, novedad: { empresa_id: req.empresaId!, deleted_at: null } },
    include: { novedad: { select: { id: true, titulo: true, created_by: true, evento_id: true } } },
  });
}

export async function descargarAdjunto(req: Request, res: Response) {
  const a = await buscarAdjunto(req);
  if (!a) { res.status(404).json({ error: 'Archivo no encontrado' }); return; }
  const buffer = Buffer.from(a.data);
  res.setHeader('Content-Type', a.mime);
  // inline: las fotos se ven en el navegador; ?descargar=1 fuerza la descarga
  res.setHeader('Content-Disposition', `${req.query.descargar ? 'attachment' : 'inline'}; filename="${encodeURIComponent(a.nombre)}"`);
  res.setHeader('Content-Length', buffer.length);
  res.setHeader('Cache-Control', 'private, max-age=86400');
  res.end(buffer);
}

export async function borrarAdjunto(req: Request, res: Response) {
  const a = await buscarAdjunto(req);
  if (!a) { res.status(404).json({ error: 'Archivo no encontrado' }); return; }
  if (!puedeEditar(a.novedad, req.user!.id, req.user!.rol)) { res.status(403).json({ error: 'Sólo podés quitar fotos de las novedades que cargaste vos' }); return; }
  await prisma.$transaction(async tx => {
    await tx.adjuntoNovedad.update({ where: { id: a.id }, data: { deleted_at: new Date() } });
    await registrarAuditoria({
      usuarioId: req.user!.id, empresaId: req.empresaId, eventoId: a.novedad.evento_id ?? undefined, accion: 'UPDATE', entidad: 'Novedad', entidadId: a.novedad.id,
      descripcion: `Quitó el archivo "${a.nombre}" de la novedad "${a.novedad.titulo}"`, ip: req.ip, tx,
    });
  });
  await responder(res, req, a.novedad.id);
}

// Para el aviso de la campanita (notificaciones.controller): novedades graves
// sin resolver que le tocan a este usuario.
export async function novedadesParaAvisar(req: Request) {
  const uid = req.user!.id;
  const global = await esAdminGlobal(uid);
  const novedades = await prisma.novedad.findMany({
    where: { empresa_id: req.empresaId!, deleted_at: null, estado: { not: 'RESUELTA' } },
    include: { tipo: { select: { nombre: true, avisar_usuario_ids: true } }, evento: { select: { nombre: true } }, camion: { select: { codigo: true, patente: true } } },
  });
  return novedades.filter(n => {
    if (n.responsable_id === uid) return true;              // se la asignaron
    if (n.created_by === uid) return false;                 // la cargó él
    if (n.gravedad !== 'ALTA' && n.gravedad !== 'CRITICA') return false;
    return global || n.tipo.avisar_usuario_ids.includes(uid);
  });
}
