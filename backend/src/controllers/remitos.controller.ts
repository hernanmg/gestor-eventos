import type { Request, Response } from 'express';
import { z } from 'zod';
import { Prisma, TipoRemito, EstadoRemito } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { withTenant } from '../lib/tenant';
import { registrarAuditoria } from '../lib/auditoria';
import { renderRemitoPDF } from '../lib/pdfExporter';
import { templateRemito } from '../lib/pdfTemplates/remito';
import { CATALOGO_REMITOS, claveItemRemito } from '../data/remitosItemsCatalog';
import { parseFechaUTC } from './bitacoraViajes.controller';
import { EMPRESAS } from '../lib/empresasConstants';

// Remitos digitales (DOS57) — los 5 remitos físicos que acompañan cada viaje
// al evento. Todo filtra por la empresa activa de la sesión (req.empresaId),
// nunca por un empresa_id del body. EMITIDO no se edita: para un segundo viaje
// o una corrección se clona (mismo criterio que presupuesto aprobado).

// Datos fiscales impresos en la planilla original (DOS57_REMITOS_2026.xlsx).
// Empresa no tiene campos para IIBB / inicio de actividades / condición IVA, y
// el CUIT se usa sólo si no está cargado en Configuración.
const CUIT_DOS57_FALLBACK = '30-71617506-1';
const FISCAL_DOS57 = [
  'Córdoba Capital Argentina',
  'IVA RESPONSABLE INSCRIPTO',
  'INGRESOS BRUTOS: 294623991',
  'INICIO DE ACTIVIDADES: 12-06-2018',
];

export interface ItemRemito { codigo?: string; descripcion: string; cantidad: number }

export const formatearNumeroRemito = (numero: number, tipo: TipoRemito) =>
  `Nº ${String(numero).padStart(4, '0')} - ${CATALOGO_REMITOS[tipo].titulo}`;

const texto = z.string().trim().max(200).optional().nullable();

const itemSchema = z.object({
  codigo:      z.string().trim().optional().nullable(),
  descripcion: z.string().trim().min(1),
  cantidad:    z.coerce.number().min(0).max(1_000_000),
});

const encabezadoSchema = z.object({
  fecha:             z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Fecha inválida (YYYY-MM-DD)').optional(),
  cliente:           texto,
  domicilio:         texto,
  localidad:         texto,
  telefono:          texto,
  chofer:            texto,
  chasis_acoplado:   texto,
  responsable_carga: texto,
  items:             z.array(itemSchema).max(500).default([]),
});

const createSchema = encabezadoSchema.extend({
  evento_id: z.coerce.number().int().positive(),
  tipo:      z.nativeEnum(TipoRemito),
});

const limpio = (s: string | null | undefined) => (s && s.trim() ? s.trim() : null);

// Normaliza los ítems contra el catálogo del tipo: descarta cantidad 0, une
// duplicados y rechaza ítems que no están en el catálogo (el formulario sólo
// ofrece ítems del catálogo, así que uno desconocido es un error del cliente).
function normalizarItems(tipo: TipoRemito, items: z.infer<typeof itemSchema>[]): { items: ItemRemito[] } | { error: string } {
  const catalogo = new Map<string, { codigo?: string; descripcion: string; orden: number }>();
  let orden = 0;
  for (const cat of CATALOGO_REMITOS[tipo].categorias) {
    for (const it of cat.items) catalogo.set(claveItemRemito(it), { ...it, orden: orden++ });
  }

  const porClave = new Map<string, ItemRemito & { orden: number }>();
  for (const it of items) {
    if (!(it.cantidad > 0)) continue;
    const clave = claveItemRemito({ codigo: limpio(it.codigo), descripcion: it.descripcion });
    const cat = catalogo.get(clave);
    if (!cat) return { error: `El ítem "${it.descripcion}" no pertenece al remito ${CATALOGO_REMITOS[tipo].nombre}` };
    const cantidad = Math.round(it.cantidad * 100) / 100;
    const prev = porClave.get(clave);
    if (prev) prev.cantidad += cantidad;
    else porClave.set(clave, { ...(cat.codigo ? { codigo: cat.codigo } : {}), descripcion: cat.descripcion, cantidad, orden: cat.orden });
  }
  return {
    items: [...porClave.values()].sort((a, b) => a.orden - b.orden).map(({ orden: _o, ...i }) => i),
  };
}

function encabezadoData(d: z.infer<typeof encabezadoSchema>) {
  return {
    ...(d.fecha ? { fecha: parseFechaUTC(d.fecha) } : {}),
    cliente:           limpio(d.cliente),
    domicilio:         limpio(d.domicilio),
    localidad:         limpio(d.localidad),
    telefono:          limpio(d.telefono),
    chofer:            limpio(d.chofer),
    chasis_acoplado:   limpio(d.chasis_acoplado),
    responsable_carga: limpio(d.responsable_carga),
  };
}

const REMITO_INCLUDE = { evento: { select: { id: true, nombre: true } } } as const;

function cargarRemito(id: number, empresaId: number) {
  return prisma.remitoEvento.findFirst({ where: { id, ...withTenant(empresaId) }, include: REMITO_INCLUDE });
}

// Numeración MAX+1 por evento+tipo. Dos altas simultáneas pueden calcular el
// mismo número: el @@unique([evento_id, tipo, numero]) rechaza la segunda y se
// reintenta con el número siguiente.
async function crearConNumero(data: Omit<Prisma.RemitoEventoUncheckedCreateInput, 'numero'>) {
  for (let intento = 0; ; intento++) {
    const max = await prisma.remitoEvento.aggregate({
      where: { evento_id: data.evento_id, tipo: data.tipo },
      _max:  { numero: true },
    });
    try {
      return await prisma.remitoEvento.create({ data: { ...data, numero: (max._max.numero ?? 0) + 1 } });
    } catch (e) {
      if (intento < 4 && e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') continue;
      throw e;
    }
  }
}

// GET /api/remitos/catalogo — catálogo completo de ítems por tipo (el form lo usa)
export async function catalogoRemitos(_req: Request, res: Response) {
  res.json(Object.values(CATALOGO_REMITOS));
}

// GET /api/remitos/sugerencias?evento_id= — valores para precompletar el
// encabezado de un remito nuevo: datos del cliente/lugar de la Pre-Macro y, si
// ya hay remitos del evento, chofer/chasis/responsable del último.
export async function sugerenciasRemito(req: Request, res: Response) {
  const eventoId = Number(req.query.evento_id);
  const evento = await prisma.evento.findFirst({
    where:  { id: eventoId, deleted_at: null, ...withTenant(req.empresaId!) },
    select: {
      id: true, nombre: true, lugar: true,
      pre_macro: { select: { cliente_nombre: true, lugar_direccion: true, lugar_nombre: true, lugar_ciudad: true, telefono_cliente: true } },
    },
  });
  if (!evento) { res.status(404).json({ error: 'Evento no encontrado' }); return; }

  const ultimo = await prisma.remitoEvento.findFirst({
    where:   { evento_id: eventoId, ...withTenant(req.empresaId!) },
    orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
  });
  const pm = evento.pre_macro;
  res.json({
    evento:            evento.nombre,
    cliente:           ultimo?.cliente   ?? pm?.cliente_nombre ?? null,
    domicilio:         ultimo?.domicilio ?? pm?.lugar_direccion ?? pm?.lugar_nombre ?? evento.lugar ?? null,
    localidad:         ultimo?.localidad ?? pm?.lugar_ciudad ?? null,
    telefono:          ultimo?.telefono  ?? pm?.telefono_cliente ?? null,
    chofer:            ultimo?.chofer ?? null,
    chasis_acoplado:   ultimo?.chasis_acoplado ?? null,
    responsable_carga: ultimo?.responsable_carga ?? null,
  });
}

// GET /api/remitos?evento_id=&tipo=
export async function listRemitos(req: Request, res: Response) {
  const { evento_id, tipo } = req.query as Record<string, string | undefined>;
  const where: Prisma.RemitoEventoWhereInput = { ...withTenant(req.empresaId!) };
  if (evento_id) where.evento_id = Number(evento_id);
  if (tipo && tipo in TipoRemito) where.tipo = tipo as TipoRemito;

  const remitos = await prisma.remitoEvento.findMany({
    where,
    include: REMITO_INCLUDE,
    orderBy: [{ fecha: 'desc' }, { tipo: 'asc' }, { numero: 'desc' }],
  });
  res.json(remitos);
}

// GET /api/remitos/:id
export async function getRemito(req: Request, res: Response) {
  const r = await cargarRemito(Number(req.params.id), req.empresaId!);
  if (!r) { res.status(404).json({ error: 'Remito no encontrado' }); return; }
  res.json(r);
}

// POST /api/remitos — asigna `numero` automáticamente
export async function createRemito(req: Request, res: Response) {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return; }
  const d = parsed.data;
  const empresaId = req.empresaId!;

  const evento = await prisma.evento.findFirst({ where: { id: d.evento_id, deleted_at: null, ...withTenant(empresaId) }, select: { id: true } });
  if (!evento) { res.status(404).json({ error: 'Evento no encontrado' }); return; }
  const n = normalizarItems(d.tipo, d.items);
  if ('error' in n) { res.status(400).json({ error: n.error }); return; }

  const creado = await crearConNumero({
    empresa_id: empresaId,
    evento_id:  d.evento_id,
    tipo:       d.tipo,
    ...encabezadoData(d),
    items:      n.items as unknown as Prisma.InputJsonValue,
    created_by: req.user!.id,
  });
  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId, eventoId: d.evento_id, accion: 'CREATE', entidad: 'RemitoEvento', entidadId: creado.id,
    descripcion: `Creó el remito ${formatearNumeroRemito(creado.numero, creado.tipo)} (${n.items.length} ítems)`, ip: req.ip, tx: prisma as any,
  });
  res.status(201).json(await cargarRemito(creado.id, empresaId));
}

// PUT /api/remitos/:id — reemplaza encabezado e ítems (sólo BORRADOR)
export async function updateRemito(req: Request, res: Response) {
  const id = Number(req.params.id);
  const parsed = encabezadoSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return; }
  const existing = await prisma.remitoEvento.findFirst({ where: { id, ...withTenant(req.empresaId!) } });
  if (!existing) { res.status(404).json({ error: 'Remito no encontrado' }); return; }
  if (existing.estado !== EstadoRemito.BORRADOR) {
    res.status(409).json({ error: 'El remito ya fue emitido — clonalo para hacer cambios' }); return;
  }
  const n = normalizarItems(existing.tipo, parsed.data.items);
  if ('error' in n) { res.status(400).json({ error: n.error }); return; }

  await prisma.remitoEvento.update({
    where: { id },
    data:  { ...encabezadoData(parsed.data), items: n.items as unknown as Prisma.InputJsonValue },
  });
  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId: req.empresaId, eventoId: existing.evento_id, accion: 'UPDATE', entidad: 'RemitoEvento', entidadId: id,
    descripcion: `Editó el remito ${formatearNumeroRemito(existing.numero, existing.tipo)} (${n.items.length} ítems)`, ip: req.ip, tx: prisma as any,
  });
  res.json(await cargarRemito(id, req.empresaId!));
}

// PATCH /api/remitos/:id/emitir
export async function emitirRemito(req: Request, res: Response) {
  const id = Number(req.params.id);
  const existing = await prisma.remitoEvento.findFirst({ where: { id, ...withTenant(req.empresaId!) } });
  if (!existing) { res.status(404).json({ error: 'Remito no encontrado' }); return; }
  if (existing.estado === EstadoRemito.EMITIDO) { res.status(409).json({ error: 'El remito ya fue emitido' }); return; }

  await prisma.remitoEvento.update({ where: { id }, data: { estado: EstadoRemito.EMITIDO } });
  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId: req.empresaId, eventoId: existing.evento_id, accion: 'UPDATE', entidad: 'RemitoEvento', entidadId: id,
    descripcion: `Emitió el remito ${formatearNumeroRemito(existing.numero, existing.tipo)}`, ip: req.ip, tx: prisma as any,
  });
  res.json(await cargarRemito(id, req.empresaId!));
}

// POST /api/remitos/:id/clonar — mismo tipo y evento, copia encabezado e
// ítems, número correlativo siguiente, en BORRADOR y con fecha de hoy.
export async function clonarRemito(req: Request, res: Response) {
  const id = Number(req.params.id);
  const o = await prisma.remitoEvento.findFirst({ where: { id, ...withTenant(req.empresaId!) } });
  if (!o) { res.status(404).json({ error: 'Remito no encontrado' }); return; }

  const creado = await crearConNumero({
    empresa_id:        o.empresa_id,
    evento_id:         o.evento_id,
    tipo:              o.tipo,
    cliente:           o.cliente,
    domicilio:         o.domicilio,
    localidad:         o.localidad,
    telefono:          o.telefono,
    chofer:            o.chofer,
    chasis_acoplado:   o.chasis_acoplado,
    responsable_carga: o.responsable_carga,
    items:             o.items as Prisma.InputJsonValue,
    created_by:        req.user!.id,
  });
  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId: req.empresaId, eventoId: o.evento_id, accion: 'CREATE', entidad: 'RemitoEvento', entidadId: creado.id,
    descripcion: `Clonó el remito ${formatearNumeroRemito(o.numero, o.tipo)} como ${formatearNumeroRemito(creado.numero, creado.tipo)}`, ip: req.ip, tx: prisma as any,
  });
  res.status(201).json(await cargarRemito(creado.id, req.empresaId!));
}

// DELETE /api/remitos/:id — sólo BORRADOR (un emitido ya salió impreso con su número)
export async function deleteRemito(req: Request, res: Response) {
  const id = Number(req.params.id);
  const existing = await prisma.remitoEvento.findFirst({ where: { id, ...withTenant(req.empresaId!) } });
  if (!existing) { res.status(404).json({ error: 'Remito no encontrado' }); return; }
  if (existing.estado !== EstadoRemito.BORRADOR) { res.status(409).json({ error: 'No se puede eliminar un remito emitido' }); return; }

  await prisma.remitoEvento.delete({ where: { id } });
  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId: req.empresaId, eventoId: existing.evento_id, accion: 'DELETE', entidad: 'RemitoEvento', entidadId: id,
    descripcion: `Eliminó el borrador de remito ${formatearNumeroRemito(existing.numero, existing.tipo)}`, ip: req.ip, tx: prisma as any,
  });
  res.status(204).end();
}

// GET /api/remitos/:id/pdf — cualquier estado
export async function pdfRemito(req: Request, res: Response) {
  const r = await cargarRemito(Number(req.params.id), req.empresaId!);
  if (!r) { res.status(404).json({ error: 'Remito no encontrado' }); return; }
  const empresa = await prisma.empresa.findUniqueOrThrow({
    where:  { id: r.empresa_id },
    select: { id: true, nombre: true, razon_social: true, cuit: true, domicilio: true, telefono: true, email: true, web: true, logo_data: true, logo_mime: true },
  });

  const html = templateRemito({
    empresa: {
      nombre:    empresa.razon_social ?? empresa.nombre,
      cuit:      empresa.cuit ?? (empresa.id === EMPRESAS.DOS57 ? CUIT_DOS57_FALLBACK : null),
      domicilio: empresa.domicilio,
      telefono:  empresa.telefono,
      email:     empresa.email,
      web:       empresa.web,
      logo:      empresa.logo_data && empresa.logo_mime
        ? `data:${empresa.logo_mime};base64,${Buffer.from(empresa.logo_data).toString('base64')}`
        : null,
      fiscal:    empresa.id === EMPRESAS.DOS57 ? FISCAL_DOS57 : [],
    },
    tipo:        CATALOGO_REMITOS[r.tipo],
    numero:      formatearNumeroRemito(r.numero, r.tipo),
    borrador:    r.estado === EstadoRemito.BORRADOR,
    fecha:       r.fecha,
    evento:      r.evento.nombre,
    cliente:     r.cliente,
    domicilio:   r.domicilio,
    localidad:   r.localidad,
    telefono:    r.telefono,
    chofer:      r.chofer,
    chasis_acoplado:   r.chasis_acoplado,
    responsable_carga: r.responsable_carga,
    items:       (r.items as unknown as ItemRemito[]) ?? [],
  });

  const buffer = await renderRemitoPDF(html, `${formatearNumeroRemito(r.numero, r.tipo)} · ${r.evento.nombre}`);
  const slug = r.evento.nombre.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').substring(0, 40);
  const filename = `Remito-${r.tipo}-${String(r.numero).padStart(4, '0')}-${slug}.pdf`;
  res.set({
    'Content-Type':        'application/pdf',
    'Content-Disposition': `inline; filename="${filename}"`,
    'Content-Length':      String(buffer.length),
  });
  res.end(buffer);
}
