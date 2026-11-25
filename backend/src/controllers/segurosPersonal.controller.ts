import type { Request, Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { TipoSeguroPersonal } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { registrarAuditoria } from '../lib/auditoria';
import { withTenant } from '../lib/tenant';
import { estadoVencimiento, hoyUTC, parseFechaCalendario } from '../lib/vencimientos';
import { claveAseguradora } from '../lib/aseguradoras';

// ── Seguro del personal (ART / AP) ───────────────────────────────────────────
// Pólizas de cada empresa + en qué póliza está anotado cada empleado, con alta
// y baja. Andrea pide las altas y bajas al productor por mensaje: el pedido se
// arma desde acá con lo que todavía no se le informó.

export const uploadPolizaPersonal = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Solo se aceptan archivos PDF o imágenes'));
  },
});

function fmtUTC(d: Date): string {
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
}

function nombreEmpleado(e: { apellido: string; nombre: string }) {
  return `${e.apellido}, ${e.nombre}`;
}

// ── Pólizas ──────────────────────────────────────────────────────────────────

const polizaSchema = z.object({
  tipo:               z.nativeEnum(TipoSeguroPersonal),
  aseguradora:        z.string().trim().min(1, 'Indicá la aseguradora'),
  numero_poliza:      z.string().nullable().optional(),
  productor:          z.string().nullable().optional(),
  productor_contacto: z.string().nullable().optional(),
  fecha_inicio:       z.string().nullable().optional(),
  fecha_vencimiento:  z.string().nullable().optional(),
  notas:              z.string().nullable().optional(),
});

// multipart manda todo como string: '' → null
function limpiarBody(b: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(b)) out[k] = v === '' ? null : v;
  return out;
}

function fechasPoliza(d: { fecha_inicio?: string | null; fecha_vencimiento?: string | null }) {
  const inicio = d.fecha_inicio !== undefined ? parseFechaCalendario(d.fecha_inicio) : undefined;
  const venc   = d.fecha_vencimiento !== undefined ? parseFechaCalendario(d.fecha_vencimiento) : undefined;
  if (d.fecha_inicio && inicio === undefined) return { error: 'Fecha de inicio inválida' } as const;
  if (d.fecha_vencimiento && venc === undefined) return { error: 'Fecha de vencimiento inválida' } as const;
  return { inicio, venc } as const;
}

export async function listPolizasPersonal(req: Request, res: Response) {
  const polizas = await prisma.polizaPersonal.findMany({
    where:   { ...withTenant(req.empresaId!), deleted_at: null },
    orderBy: [{ tipo: 'asc' }, { aseguradora: 'asc' }],
    select: {
      id: true, tipo: true, aseguradora: true, numero_poliza: true, productor: true, productor_contacto: true,
      fecha_inicio: true, fecha_vencimiento: true, documento_nombre: true, notas: true, created_at: true,
      coberturas: { where: { deleted_at: null, fecha_baja: null }, select: { id: true } },
    },
  });
  res.json(polizas.map(({ coberturas, ...p }) => ({
    ...p,
    cubiertos: coberturas.length,
    estado_vencimiento: estadoVencimiento(p.fecha_vencimiento),
  })));
}

export async function createPolizaPersonal(req: Request, res: Response) {
  const parsed = polizaSchema.safeParse(limpiarBody(req.body));
  if (!parsed.success) { res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return; }
  const d = parsed.data;
  const f = fechasPoliza(d);
  if ('error' in f) { res.status(400).json({ error: f.error }); return; }

  const poliza = await prisma.polizaPersonal.create({
    data: {
      ...withTenant(req.empresaId!),
      tipo: d.tipo, aseguradora: d.aseguradora,
      numero_poliza: d.numero_poliza ?? null, productor: d.productor ?? null, productor_contacto: d.productor_contacto ?? null,
      fecha_inicio: f.inicio ?? null, fecha_vencimiento: f.venc ?? null, notas: d.notas ?? null,
      documento_data: req.file?.buffer ?? null, documento_nombre: req.file?.originalname ?? null, documento_mime: req.file?.mimetype ?? null,
      created_by: req.user!.id,
    },
  });
  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'CREATE', entidad: 'PolizaPersonal', entidadId: poliza.id,
    descripcion: `Cargó póliza ${d.tipo} de ${d.aseguradora}`, ip: req.ip, tx: prisma,
  });
  res.status(201).json({ ...poliza, documento_data: undefined });
}

export async function updatePolizaPersonal(req: Request, res: Response) {
  const id = Number(req.params.id);
  const existing = await prisma.polizaPersonal.findFirst({ where: { id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!existing) { res.status(404).json({ error: 'Póliza no encontrada' }); return; }

  const parsed = polizaSchema.partial().safeParse(limpiarBody(req.body));
  if (!parsed.success) { res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return; }
  const d = parsed.data;
  const f = fechasPoliza(d);
  if ('error' in f) { res.status(400).json({ error: f.error }); return; }

  const poliza = await prisma.polizaPersonal.update({
    where: { id },
    data: {
      ...(d.tipo               !== undefined && { tipo: d.tipo }),
      ...(d.aseguradora        !== undefined && { aseguradora: d.aseguradora }),
      ...(d.numero_poliza      !== undefined && { numero_poliza: d.numero_poliza }),
      ...(d.productor          !== undefined && { productor: d.productor }),
      ...(d.productor_contacto !== undefined && { productor_contacto: d.productor_contacto }),
      ...(f.inicio             !== undefined && { fecha_inicio: f.inicio }),
      ...(f.venc               !== undefined && { fecha_vencimiento: f.venc }),
      ...(d.notas              !== undefined && { notas: d.notas }),
      ...(req.file && { documento_data: req.file.buffer, documento_nombre: req.file.originalname, documento_mime: req.file.mimetype }),
    },
  });
  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'UPDATE', entidad: 'PolizaPersonal', entidadId: id,
    descripcion: `Actualizó póliza ${poliza.tipo} de ${poliza.aseguradora}`, ip: req.ip, tx: prisma,
  });
  res.json({ ...poliza, documento_data: undefined });
}

export async function deletePolizaPersonal(req: Request, res: Response) {
  const id = Number(req.params.id);
  const existing = await prisma.polizaPersonal.findFirst({ where: { id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!existing) { res.status(404).json({ error: 'Póliza no encontrada' }); return; }
  const activos = await prisma.coberturaEmpleado.count({ where: { poliza_id: id, deleted_at: null, fecha_baja: null } });
  if (activos > 0) {
    res.status(400).json({ error: `La póliza tiene ${activos} persona(s) anotadas. Dalas de baja o pasalas a otra póliza antes de eliminarla.` });
    return;
  }
  await prisma.polizaPersonal.update({ where: { id }, data: { deleted_at: new Date() } });
  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'DELETE', entidad: 'PolizaPersonal', entidadId: id,
    descripcion: `Eliminó póliza ${existing.tipo} de ${existing.aseguradora}`, ip: req.ip, tx: prisma,
  });
  res.json({ ok: true });
}

export async function getDocumentoPolizaPersonal(req: Request, res: Response) {
  const id = Number(req.params.id);
  const p = await prisma.polizaPersonal.findFirst({
    where:  { id, deleted_at: null, ...withTenant(req.empresaId!) },
    select: { documento_data: true, documento_mime: true, documento_nombre: true },
  });
  if (!p)                { res.status(404).json({ error: 'Póliza no encontrada' }); return; }
  if (!p.documento_data) { res.status(404).json({ error: 'Esta póliza no tiene archivo adjunto' }); return; }
  const buffer = Buffer.from(p.documento_data);
  res.setHeader('Content-Type',        p.documento_mime ?? 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(p.documento_nombre ?? 'poliza.pdf')}"`);
  res.setHeader('Content-Length',      buffer.length);
  res.end(buffer);
}

// ── Personal y su cobertura ──────────────────────────────────────────────────

const coberturaSelect = {
  id: true, empleado_id: true, poliza_id: true, fecha_alta: true, fecha_baja: true,
  alta_informada_at: true, baja_informada_at: true, notas: true,
  poliza: { select: { id: true, tipo: true, aseguradora: true, numero_poliza: true, fecha_vencimiento: true } },
} as const;

// GET /personal — activos (con o sin seguro) + inactivos que siguen anotados
// en una póliza (hay que darlos de baja con el productor).
export async function listPersonalSeguro(req: Request, res: Response) {
  const empleados = await prisma.empleado.findMany({
    where: {
      ...withTenant(req.empresaId!), deleted_at: null,
      OR: [
        { estado: 'ACTIVO' },
        { coberturas: { some: { deleted_at: null, fecha_baja: null } } },
      ],
    },
    orderBy: [{ apellido: 'asc' }, { nombre: 'asc' }],
    select: {
      id: true, nombre: true, apellido: true, apodo: true, cuit: true, dni: true, estado: true,
      categoria: true, tipo_contratacion: true, fecha_ingreso: true,
      coberturas: { where: { deleted_at: null }, orderBy: { fecha_alta: 'desc' }, select: coberturaSelect },
    },
  });
  res.json(empleados.map(({ coberturas, ...e }) => {
    const actual = coberturas.find(c => c.fecha_baja === null) ?? null;
    return {
      ...e,
      cobertura_actual: actual,
      ultima_cobertura: actual ? null : (coberturas[0] ?? null),
      historial: coberturas,
      estado_seguro: actual
        ? (estadoVencimiento(actual.poliza.fecha_vencimiento) ?? 'SIN_VENCIMIENTO')
        : 'SIN_SEGURO',
    };
  }));
}

const altaSchema = z.object({
  empleado_id: z.number().int(),
  poliza_id:   z.number().int(),
  fecha_alta:  z.string().min(1),
  notas:       z.string().nullable().optional(),
  // Para cargar lo que ya existe (no hay que pedirle el alta al productor)
  ya_informada: z.boolean().optional(),
});

// Anota al empleado en la póliza. Si estaba en otra, esa se cierra el mismo
// día (cambio de póliza: por ejemplo, un eventual que pasa a estar registrado).
async function darAlta(
  empresaId: number, usuarioId: number,
  d: { empleado_id: number; poliza_id: number; fecha_alta: Date; notas?: string | null; ya_informada?: boolean },
) {
  return prisma.$transaction(async tx => {
    const previa = await tx.coberturaEmpleado.findFirst({
      where: { empleado_id: d.empleado_id, deleted_at: null, fecha_baja: null },
    });
    if (previa && previa.poliza_id === d.poliza_id) return { cobertura: previa, cerrada: null, sinCambios: true };
    let cerrada = null;
    if (previa) {
      cerrada = await tx.coberturaEmpleado.update({
        where: { id: previa.id },
        data:  { fecha_baja: d.fecha_alta < previa.fecha_alta ? previa.fecha_alta : d.fecha_alta, baja_informada_at: d.ya_informada ? new Date() : null },
      });
    }
    const cobertura = await tx.coberturaEmpleado.create({
      data: {
        empresa_id: empresaId, empleado_id: d.empleado_id, poliza_id: d.poliza_id,
        fecha_alta: d.fecha_alta, notas: d.notas ?? null,
        alta_informada_at: d.ya_informada ? new Date() : null,
        created_by: usuarioId,
      },
    });
    return { cobertura, cerrada, sinCambios: false };
  });
}

async function validarEmpleadoYPoliza(empresaId: number, empleadoId: number, polizaId: number) {
  const [empleado, poliza] = await Promise.all([
    prisma.empleado.findFirst({ where: { id: empleadoId, empresa_id: empresaId, deleted_at: null }, select: { id: true, nombre: true, apellido: true } }),
    prisma.polizaPersonal.findFirst({ where: { id: polizaId, empresa_id: empresaId, deleted_at: null }, select: { id: true, tipo: true, aseguradora: true } }),
  ]);
  return { empleado, poliza };
}

export async function altaCobertura(req: Request, res: Response) {
  const parsed = altaSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return; }
  const d = parsed.data;
  const fecha = parseFechaCalendario(d.fecha_alta);
  if (!fecha) { res.status(400).json({ error: 'Fecha de alta inválida' }); return; }
  const { empleado, poliza } = await validarEmpleadoYPoliza(req.empresaId!, d.empleado_id, d.poliza_id);
  if (!empleado) { res.status(404).json({ error: 'Empleado no encontrado' }); return; }
  if (!poliza)   { res.status(404).json({ error: 'Póliza no encontrada' }); return; }

  const r = await darAlta(req.empresaId!, req.user!.id, { ...d, fecha_alta: fecha });
  if (r.sinCambios) { res.status(400).json({ error: `${nombreEmpleado(empleado)} ya está en esa póliza` }); return; }
  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'CREATE', entidad: 'CoberturaEmpleado', entidadId: r.cobertura.id,
    descripcion: `Alta de ${nombreEmpleado(empleado)} en ${poliza.tipo} ${poliza.aseguradora} desde ${fmtUTC(fecha)}${r.cerrada ? ' (cerró la póliza anterior)' : ''}`,
    ip: req.ip, tx: prisma,
  });
  res.status(201).json(r.cobertura);
}

const loteSchema = z.object({
  fecha_alta:   z.string().nullable().optional(), // null → fecha de ingreso del legajo, o hoy
  ya_informada: z.boolean().optional(),
  items: z.array(z.object({ empleado_id: z.number().int(), poliza_id: z.number().int() })).min(1),
});

// POST /coberturas/lote — para pasar en bloque lo que dice el legajo
export async function altaCoberturaLote(req: Request, res: Response) {
  const parsed = loteSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return; }
  const d = parsed.data;
  const fechaFija = d.fecha_alta ? parseFechaCalendario(d.fecha_alta) : null;
  if (d.fecha_alta && !fechaFija) { res.status(400).json({ error: 'Fecha de alta inválida' }); return; }

  const empresaId = req.empresaId!;
  const polizas = await prisma.polizaPersonal.findMany({ where: { empresa_id: empresaId, deleted_at: null }, select: { id: true } });
  const empleados = await prisma.empleado.findMany({
    where: { empresa_id: empresaId, deleted_at: null, id: { in: d.items.map(i => i.empleado_id) } },
    select: { id: true, fecha_ingreso: true },
  });
  const polizaOk = new Set(polizas.map(p => p.id));
  const empMap = new Map(empleados.map(e => [e.id, e]));

  let creadas = 0; let sinCambios = 0; const errores: string[] = [];
  for (const it of d.items) {
    const emp = empMap.get(it.empleado_id);
    if (!emp || !polizaOk.has(it.poliza_id)) { errores.push(`Empleado ${it.empleado_id}: empleado o póliza inexistente`); continue; }
    const fecha = fechaFija ?? emp.fecha_ingreso ?? hoyUTC();
    const r = await darAlta(empresaId, req.user!.id, { empleado_id: it.empleado_id, poliza_id: it.poliza_id, fecha_alta: fecha, ya_informada: d.ya_informada });
    if (r.sinCambios) sinCambios++; else creadas++;
  }
  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId, accion: 'CREATE', entidad: 'CoberturaEmpleado',
    descripcion: `Anotó ${creadas} persona(s) en pólizas del personal (carga en bloque)`, datosDespues: { creadas, sinCambios, errores },
    ip: req.ip, tx: prisma,
  });
  res.json({ creadas, sin_cambios: sinCambios, errores });
}

const bajaSchema = z.object({ fecha_baja: z.string().min(1), notas: z.string().nullable().optional() });

export async function bajaCobertura(req: Request, res: Response) {
  const id = Number(req.params.id);
  const parsed = bajaSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Indicá la fecha de baja' }); return; }
  const fecha = parseFechaCalendario(parsed.data.fecha_baja);
  if (!fecha) { res.status(400).json({ error: 'Fecha de baja inválida' }); return; }
  const c = await prisma.coberturaEmpleado.findFirst({
    where: { id, deleted_at: null, ...withTenant(req.empresaId!) },
    include: { empleado: { select: { nombre: true, apellido: true } }, poliza: { select: { tipo: true, aseguradora: true } } },
  });
  if (!c) { res.status(404).json({ error: 'Cobertura no encontrada' }); return; }
  if (c.fecha_baja) { res.status(400).json({ error: 'Ya estaba dada de baja' }); return; }
  if (fecha < c.fecha_alta) { res.status(400).json({ error: 'La baja no puede ser anterior al alta' }); return; }

  const upd = await prisma.coberturaEmpleado.update({
    where: { id },
    data:  { fecha_baja: fecha, ...(parsed.data.notas !== undefined && { notas: parsed.data.notas }) },
  });
  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'UPDATE', entidad: 'CoberturaEmpleado', entidadId: id,
    descripcion: `Baja de ${nombreEmpleado(c.empleado)} de ${c.poliza.tipo} ${c.poliza.aseguradora} desde ${fmtUTC(fecha)}`,
    ip: req.ip, tx: prisma,
  });
  res.json(upd);
}

const editCoberturaSchema = z.object({
  fecha_alta: z.string().optional(),
  fecha_baja: z.string().nullable().optional(),
  notas:      z.string().nullable().optional(),
});

// PUT /coberturas/:id — corregir fechas mal cargadas
export async function updateCobertura(req: Request, res: Response) {
  const id = Number(req.params.id);
  const parsed = editCoberturaSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Datos inválidos' }); return; }
  const c = await prisma.coberturaEmpleado.findFirst({ where: { id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!c) { res.status(404).json({ error: 'Cobertura no encontrada' }); return; }
  const d = parsed.data;
  const alta = d.fecha_alta !== undefined ? parseFechaCalendario(d.fecha_alta) : c.fecha_alta;
  const baja = d.fecha_baja !== undefined ? parseFechaCalendario(d.fecha_baja) : c.fecha_baja;
  if (!alta || baja === undefined) { res.status(400).json({ error: 'Fecha inválida' }); return; }
  if (baja && baja < alta) { res.status(400).json({ error: 'La baja no puede ser anterior al alta' }); return; }
  if (baja === null && c.fecha_baja !== null) {
    const otra = await prisma.coberturaEmpleado.findFirst({ where: { empleado_id: c.empleado_id, deleted_at: null, fecha_baja: null, id: { not: id } } });
    if (otra) { res.status(400).json({ error: 'La persona ya está anotada en otra póliza: no se puede reabrir esta' }); return; }
  }
  const upd = await prisma.coberturaEmpleado.update({
    where: { id },
    data: { fecha_alta: alta, fecha_baja: baja, ...(d.notas !== undefined && { notas: d.notas }) },
  });
  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'UPDATE', entidad: 'CoberturaEmpleado', entidadId: id,
    descripcion: `Corrigió fechas de cobertura #${id}`, datosAntes: { fecha_alta: c.fecha_alta, fecha_baja: c.fecha_baja },
    datosDespues: { fecha_alta: alta, fecha_baja: baja }, ip: req.ip, tx: prisma,
  });
  res.json(upd);
}

// DELETE /coberturas/:id — sólo para errores de carga (la baja normal es PATCH /baja)
export async function deleteCobertura(req: Request, res: Response) {
  const id = Number(req.params.id);
  const c = await prisma.coberturaEmpleado.findFirst({ where: { id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!c) { res.status(404).json({ error: 'Cobertura no encontrada' }); return; }
  await prisma.coberturaEmpleado.update({ where: { id }, data: { deleted_at: new Date() } });
  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'DELETE', entidad: 'CoberturaEmpleado', entidadId: id,
    descripcion: `Eliminó cobertura #${id} (error de carga)`, ip: req.ip, tx: prisma,
  });
  res.json({ ok: true });
}

// ── Pedido al productor ──────────────────────────────────────────────────────
// Altas y bajas que todavía no se le pidieron, agrupadas por póliza, con el
// texto listo para copiar al WhatsApp o al mail.

export async function pedidoProductor(req: Request, res: Response) {
  const empresaId = req.empresaId!;
  const pendientes = await prisma.coberturaEmpleado.findMany({
    where: {
      empresa_id: empresaId, deleted_at: null, poliza: { deleted_at: null },
      OR: [
        { alta_informada_at: null },
        { fecha_baja: { not: null }, baja_informada_at: null },
      ],
    },
    orderBy: [{ fecha_alta: 'asc' }],
    include: {
      empleado: { select: { id: true, nombre: true, apellido: true, cuit: true, dni: true, fecha_nacimiento: true } },
      poliza:   { select: { id: true, tipo: true, aseguradora: true, numero_poliza: true, productor: true, productor_contacto: true } },
      evento:   { select: { id: true, nombre: true } },
    },
  });

  const porPoliza = new Map<number, {
    poliza: typeof pendientes[number]['poliza'];
    altas: { cobertura_id: number; empleado: string; documento: string | null; fecha: Date; hasta: Date | null; evento: string | null }[];
    bajas: { cobertura_id: number; empleado: string; documento: string | null; fecha: Date }[];
  }>();
  for (const c of pendientes) {
    const g = porPoliza.get(c.poliza_id) ?? { poliza: c.poliza, altas: [], bajas: [] };
    const fila = { cobertura_id: c.id, empleado: nombreEmpleado(c.empleado), documento: c.empleado.cuit ?? c.empleado.dni ?? null };
    // Alta y baja pendientes en el mismo registro (un eventual que va a un
    // evento o un viaje, o alguien que entró y salió antes de pedirlo): se
    // piden juntas, como un alta "del … al …".
    if (!c.alta_informada_at) g.altas.push({ ...fila, fecha: c.fecha_alta, hasta: c.fecha_baja && !c.baja_informada_at ? c.fecha_baja : null, evento: c.evento?.nombre ?? null });
    else if (c.fecha_baja && !c.baja_informada_at) g.bajas.push({ ...fila, fecha: c.fecha_baja });
    porPoliza.set(c.poliza_id, g);
  }

  const empresa = await prisma.empresa.findUnique({ where: { id: empresaId }, select: { nombre: true } });
  const grupos = [...porPoliza.values()].map(g => {
    const lineas: string[] = [];
    lineas.push(`Hola${g.poliza.productor ? ` ${g.poliza.productor}` : ''}, te pido estos movimientos en la póliza ${g.poliza.tipo} de ${g.poliza.aseguradora}${g.poliza.numero_poliza ? ` (N° ${g.poliza.numero_poliza})` : ''} de ${empresa?.nombre ?? ''}:`);
    if (g.altas.length) {
      lineas.push('', 'ALTAS');
      for (const a of g.altas) lineas.push(`- ${a.empleado}${a.documento ? ` — ${a.documento}` : ''} — ${a.hasta ? `del ${fmtUTC(a.fecha)} al ${fmtUTC(a.hasta)}` : `desde el ${fmtUTC(a.fecha)}`}${a.evento ? ` (${a.evento})` : ''}`);
    }
    if (g.bajas.length) {
      lineas.push('', 'BAJAS');
      for (const b of g.bajas) lineas.push(`- ${b.empleado}${b.documento ? ` — ${b.documento}` : ''} — desde el ${fmtUTC(b.fecha)}`);
    }
    lineas.push('', 'Gracias.');
    return { ...g, texto: lineas.join('\n') };
  });

  res.json(grupos);
}

const marcarSchema = z.object({
  altas: z.array(z.number().int()).default([]),
  bajas: z.array(z.number().int()).default([]),
});

export async function marcarPedidoInformado(req: Request, res: Response) {
  const parsed = marcarSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Datos inválidos' }); return; }
  const { altas, bajas } = parsed.data;
  const ahora = new Date();
  const base = { ...withTenant(req.empresaId!), deleted_at: null };
  const [a, b] = await Promise.all([
    altas.length ? prisma.$transaction(async tx => {
      // Las altas con fecha de baja todavía sin pedir salieron como "del … al …":
      // esa baja también queda pedida.
      await tx.coberturaEmpleado.updateMany({ where: { ...base, id: { in: altas }, alta_informada_at: null, fecha_baja: { not: null }, baja_informada_at: null }, data: { baja_informada_at: ahora } });
      return tx.coberturaEmpleado.updateMany({ where: { ...base, id: { in: altas }, alta_informada_at: null }, data: { alta_informada_at: ahora } });
    }) : { count: 0 },
    bajas.length ? prisma.coberturaEmpleado.updateMany({ where: { ...base, id: { in: bajas }, fecha_baja: { not: null }, baja_informada_at: null }, data: { baja_informada_at: ahora } }) : { count: 0 },
  ]);
  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'UPDATE', entidad: 'CoberturaEmpleado',
    descripcion: `Marcó como pedidas al productor ${a.count} alta(s) y ${b.count} baja(s)`, ip: req.ip, tx: prisma,
  });
  res.json({ altas: a.count, bajas: b.count });
}

// ── Sugerencias desde el legajo ──────────────────────────────────────────────
// El padrón de Lorena trae "TIPO DE CONTRATACION" en texto libre: "ART",
// "SANCOR", "FEDERAL PATRONAL (AP)". Para el personal activo sin póliza, se
// propone en cuál anotarlo. Supuesto (confirmar con Andrea): lo que no dice
// "ART" es accidentes personales — en el informe de siniestros, Sancor
// aparece con jornaleros, fofis y extranjeros.

export function interpretarTipoContratacion(texto: string | null | undefined): { tipo: TipoSeguroPersonal; aseguradora: string | null } | null {
  const t = (texto ?? '').trim();
  if (!t) return null;
  const up = t.toUpperCase();
  if (/^ART$/.test(up)) return { tipo: 'ART', aseguradora: null };
  const tipo: TipoSeguroPersonal = /\bART\b/.test(up) && !/\bAP\b/.test(up) ? 'ART' : 'AP';
  const aseguradora = t.replace(/\((AP|ART)\)/gi, '').replace(/\b(AP|ART)\b/gi, '').replace(/\s+/g, ' ').trim();
  return { tipo, aseguradora: aseguradora || null };
}

export async function sugerenciasLegajo(req: Request, res: Response) {
  const empresaId = req.empresaId!;
  const [empleados, polizas] = await Promise.all([
    prisma.empleado.findMany({
      where: {
        empresa_id: empresaId, deleted_at: null, estado: 'ACTIVO',
        coberturas: { none: { deleted_at: null, fecha_baja: null } },
      },
      orderBy: [{ apellido: 'asc' }, { nombre: 'asc' }],
      select: { id: true, nombre: true, apellido: true, tipo_contratacion: true, art: true, fecha_ingreso: true },
    }),
    prisma.polizaPersonal.findMany({ where: { empresa_id: empresaId, deleted_at: null }, select: { id: true, tipo: true, aseguradora: true } }),
  ]);

  const aCrear = new Map<string, { tipo: TipoSeguroPersonal; aseguradora: string; empleados: number }>();
  const items = empleados.map(e => {
    const interp = interpretarTipoContratacion(e.tipo_contratacion) ?? (e.art ? { tipo: 'ART' as const, aseguradora: e.art } : null);
    if (!interp) return { empleado_id: e.id, empleado: nombreEmpleado(e), texto_legajo: null, tipo: null, aseguradora: null, poliza_id: null, fecha_ingreso: e.fecha_ingreso };
    const candidatas = polizas.filter(p => p.tipo === interp.tipo);
    const match = interp.aseguradora
      ? candidatas.find(p => claveAseguradora(p.aseguradora) === claveAseguradora(interp.aseguradora))
      : (candidatas.length === 1 ? candidatas[0] : undefined);
    if (!match && interp.aseguradora) {
      const k = `${interp.tipo}|${claveAseguradora(interp.aseguradora)}`;
      const prev = aCrear.get(k);
      aCrear.set(k, { tipo: interp.tipo, aseguradora: prev?.aseguradora ?? interp.aseguradora, empleados: (prev?.empleados ?? 0) + 1 });
    }
    return {
      empleado_id: e.id, empleado: nombreEmpleado(e), texto_legajo: e.tipo_contratacion ?? e.art,
      tipo: interp.tipo, aseguradora: interp.aseguradora, poliza_id: match?.id ?? null, fecha_ingreso: e.fecha_ingreso,
    };
  });
  // "ART" a secas sin póliza ART cargada → también hay que crearla
  if (items.some(i => i.tipo === 'ART' && !i.aseguradora && !i.poliza_id) && !polizas.some(p => p.tipo === 'ART')) {
    aCrear.set('ART|', { tipo: 'ART', aseguradora: '', empleados: items.filter(i => i.tipo === 'ART' && !i.aseguradora).length });
  }

  res.json({ items, polizas_a_crear: [...aCrear.values()] });
}

// ── Resumen (avisos y calendario) ────────────────────────────────────────────


// ── Altas por evento o viaje (AP de los eventuales) ──────────────────────────
// Andrea: "dar de alta a todos porque viajaban". Quién va a cada evento sale de
// lo que ya está cargado (parte diario, jornadas, bitácora de viajes) y se le
// pueden sumar personas a mano. Para cada uno se ve si está cubierto en esas
// fechas; a los que no, se los anota en una póliza AP del primer al último día,
// y el pedido al productor lo manda como un alta "del … al …".

const MS_DIA = 86_400_000;
const isoDia = (d: Date) => d.toISOString().slice(0, 10);

export async function personalEvento(req: Request, res: Response) {
  const empresaId = req.empresaId!;
  const eventoId = Number(req.params.eventoId);
  const evento = await prisma.evento.findFirst({
    where: { id: eventoId, deleted_at: null, ...withTenant(empresaId) },
    select: { id: true, nombre: true, fecha_inicio: true, fecha_fin: true, dias_montaje: true, dias_desmontaje: true, lugar: true },
  });
  if (!evento) { res.status(404).json({ error: 'Evento no encontrado' }); return; }

  // Días del evento, con montaje y desmontaje (fechas de calendario en UTC)
  const ini = evento.fecha_inicio ? hoyUTC(evento.fecha_inicio) : null;
  const fin = evento.fecha_fin ? hoyUTC(evento.fecha_fin) : ini;
  const evDesde = ini ? new Date(ini.getTime() - evento.dias_montaje * MS_DIA) : null;
  const evHasta = fin ? new Date(fin.getTime() + evento.dias_desmontaje * MS_DIA) : null;

  const [asig, jornadas, viajes, coberturasEv] = await Promise.all([
    prisma.asignacionDiaria.findMany({
      where: { evento_id: eventoId, deleted_at: null, empresa_id: empresaId, parte_diario: { deleted_at: null } },
      select: { empleado_id: true, parte_diario: { select: { fecha: true } } },
    }),
    prisma.jornada.findMany({ where: { evento_id: eventoId, deleted_at: null, empresa_id: empresaId }, select: { empleado_id: true, fecha: true } }),
    prisma.bitacoraViaje.findMany({ where: { evento_id: eventoId, deleted_at: null, empresa_id: empresaId, empleado_id: { not: null } }, select: { empleado_id: true, fecha: true } }),
    prisma.coberturaEmpleado.findMany({ where: { evento_id: eventoId, deleted_at: null, empresa_id: empresaId }, select: { empleado_id: true, fecha_alta: true, fecha_baja: true } }),
  ]);

  type Acum = { fuentes: Set<string>; dias: Set<string> };
  const porEmp = new Map<number, Acum>();
  const sumar = (id: number | null, fuente: string, fecha: Date | null) => {
    if (!id) return;
    const a = porEmp.get(id) ?? { fuentes: new Set<string>(), dias: new Set<string>() };
    a.fuentes.add(fuente);
    if (fecha) a.dias.add(isoDia(hoyUTC(fecha)));
    porEmp.set(id, a);
  };
  for (const a of asig) sumar(a.empleado_id, 'Parte diario', a.parte_diario.fecha);
  for (const j of jornadas) sumar(j.empleado_id, 'Jornadas', j.fecha);
  for (const v of viajes) sumar(v.empleado_id, 'Bitácora de viajes', v.fecha);
  for (const c of coberturasEv) sumar(c.empleado_id, 'Alta por el evento', null);

  const ids = [...porEmp.keys()];
  const empleados = ids.length ? await prisma.empleado.findMany({
    where: { id: { in: ids }, empresa_id: empresaId, deleted_at: null },
    select: {
      id: true, nombre: true, apellido: true, apodo: true, cuit: true, dni: true, categoria: true, estado: true,
      coberturas: { where: { deleted_at: null }, orderBy: { fecha_alta: 'desc' }, select: { id: true, fecha_alta: true, fecha_baja: true, evento_id: true, alta_informada_at: true, poliza: { select: { id: true, tipo: true, aseguradora: true } } } },
    },
  }) : [];

  const personas = empleados.map(e => {
    const a = porEmp.get(e.id)!;
    const dias = [...a.dias].sort();
    const desde = dias.length ? new Date(`${dias[0]}T00:00:00Z`) : evDesde;
    const hasta = dias.length ? new Date(`${dias[dias.length - 1]}T00:00:00Z`) : evHasta;
    // Cubierto si alguna cobertura abarca todo el rango; "en parte" si toca algún día
    const cubre = e.coberturas.find(c => desde && hasta && c.fecha_alta <= desde && (!c.fecha_baja || c.fecha_baja >= hasta));
    const toca = !cubre && e.coberturas.find(c => desde && hasta && c.fecha_alta <= hasta && (!c.fecha_baja || c.fecha_baja >= desde));
    const abierta = e.coberturas.find(c => !c.fecha_baja) ?? null;
    return {
      empleado_id: e.id, empleado: nombreEmpleado(e), apodo: e.apodo, documento: e.cuit ?? e.dni ?? null, categoria: e.categoria, estado: e.estado,
      fuentes: [...a.fuentes], dias: dias.length,
      desde: desde ? isoDia(desde) : null, hasta: hasta ? isoDia(hasta) : null,
      cobertura: cubre || toca || null,
      estado_seguro: cubre ? 'CUBIERTO' as const : toca ? 'EN_PARTE' as const : 'SIN_SEGURO' as const,
      tiene_abierta: !!abierta,
    };
  }).sort((x, y) => (x.estado_seguro === 'CUBIERTO' ? 1 : 0) - (y.estado_seguro === 'CUBIERTO' ? 1 : 0) || x.empleado.localeCompare(y.empleado));

  res.json({
    evento: { id: evento.id, nombre: evento.nombre, lugar: evento.lugar, desde: evDesde ? isoDia(evDesde) : null, hasta: evHasta ? isoDia(evHasta) : null },
    personas,
  });
}

const altasEventoSchema = z.object({
  poliza_id: z.number().int(),
  items: z.array(z.object({ empleado_id: z.number().int(), desde: z.string().min(1), hasta: z.string().min(1) })).min(1, 'Elegí al menos una persona'),
});

// POST /evento/:eventoId/altas — anota a cada uno en la póliza del primer al
// último día. No toca otras coberturas: si alguien tiene una abierta, ya está
// cubierto (o hay que corregirla a mano).
export async function altasEvento(req: Request, res: Response) {
  const empresaId = req.empresaId!;
  const eventoId = Number(req.params.eventoId);
  const parsed = altasEventoSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }); return; }
  const d = parsed.data;
  const [evento, poliza] = await Promise.all([
    prisma.evento.findFirst({ where: { id: eventoId, deleted_at: null, ...withTenant(empresaId) }, select: { id: true, nombre: true } }),
    prisma.polizaPersonal.findFirst({ where: { id: d.poliza_id, empresa_id: empresaId, deleted_at: null }, select: { id: true, tipo: true, aseguradora: true } }),
  ]);
  if (!evento) { res.status(404).json({ error: 'Evento no encontrado' }); return; }
  if (!poliza) { res.status(404).json({ error: 'Póliza no encontrada' }); return; }

  const empleados = await prisma.empleado.findMany({
    where: { id: { in: d.items.map(i => i.empleado_id) }, empresa_id: empresaId, deleted_at: null },
    select: { id: true, nombre: true, apellido: true, coberturas: { where: { deleted_at: null, fecha_baja: null }, select: { id: true } } },
  });
  const porId = new Map(empleados.map(e => [e.id, e]));
  let creadas = 0; const errores: string[] = [];
  for (const it of d.items) {
    const e = porId.get(it.empleado_id);
    if (!e) { errores.push(`Persona ${it.empleado_id}: no existe`); continue; }
    const desde = parseFechaCalendario(it.desde); const hasta = parseFechaCalendario(it.hasta);
    if (!desde || !hasta || hasta < desde) { errores.push(`${nombreEmpleado(e)}: revisá las fechas`); continue; }
    if (e.coberturas.length) { errores.push(`${nombreEmpleado(e)}: ya tiene un seguro abierto`); continue; }
    await prisma.coberturaEmpleado.create({
      data: { empresa_id: empresaId, empleado_id: e.id, poliza_id: poliza.id, fecha_alta: desde, fecha_baja: hasta, evento_id: evento.id, notas: `Por el evento ${evento.nombre}`, created_by: req.user!.id },
    });
    creadas++;
  }
  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId, accion: 'CREATE', entidad: 'CoberturaEmpleado', eventoId: evento.id,
    descripcion: `Anotó ${creadas} persona(s) en ${poliza.tipo} ${poliza.aseguradora} por el evento ${evento.nombre}`,
    datosDespues: { creadas, errores }, ip: req.ip, tx: prisma,
  });
  res.json({ creadas, errores });
}

export async function resumenSegurosPersonal(empresaId: number) {
  const [polizas, sinSeguro, inactivosCubiertos, pendientesPedido] = await Promise.all([
    prisma.polizaPersonal.findMany({
      where: { empresa_id: empresaId, deleted_at: null, fecha_vencimiento: { not: null } },
      select: { id: true, tipo: true, aseguradora: true, fecha_vencimiento: true },
    }),
    prisma.empleado.count({ where: { empresa_id: empresaId, deleted_at: null, estado: 'ACTIVO', coberturas: { none: { deleted_at: null, fecha_baja: null } } } }),
    prisma.empleado.count({ where: { empresa_id: empresaId, deleted_at: null, estado: { not: 'ACTIVO' }, coberturas: { some: { deleted_at: null, fecha_baja: null } } } }),
    prisma.coberturaEmpleado.count({
      where: { empresa_id: empresaId, deleted_at: null, OR: [{ alta_informada_at: null }, { fecha_baja: { not: null }, baja_informada_at: null }] },
    }),
  ]);
  return { polizas, sinSeguro, inactivosCubiertos, pendientesPedido };
}
