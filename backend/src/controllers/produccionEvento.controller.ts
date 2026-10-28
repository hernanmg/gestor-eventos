import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { withTenant } from '../lib/tenant';
import { registrarAuditoria } from '../lib/auditoria';
import { normTexto } from '../lib/pedidosMaterialImporter';
import { parseProduccionEvento } from '../lib/produccionEventoImporter';

// Producción del evento: cronograma de montaje, espacios (y lo que lleva cada
// uno), puntos de internet, branding y compras. Las cinco listas comparten el
// mismo CRUD (ver TIPOS) y un importador de la planilla de producción de Dani.

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Fecha inválida (YYYY-MM-DD)');
const txt = z.string().trim().max(2000).nullable().optional();
const num = z.number().finite().nullable().optional();
const entero = z.number().int().nullable().optional();

const SCHEMAS = {
  cronograma: z.object({ fecha, hora: txt, actividad: z.string().trim().min(1, 'Falta la actividad'), proveedor: txt, responsable: txt, observaciones: txt, orden: entero }),
  espacios: z.object({ numero: entero, nombre: z.string().trim().min(1, 'Falta el nombre del espacio'), actividad: txt, observaciones: txt, orden: entero }),
  'espacio-items': z.object({ espacio_id: z.number().int().optional(), elemento: z.string().trim().min(1, 'Falta qué lleva'), estado: txt, responsable: txt, observaciones: txt, orden: entero }),
  internet: z.object({ numero: entero, zona: z.string().trim().min(1, 'Falta la zona'), uso: txt, tipo_conexion: txt, observaciones: txt, orden: entero }),
  branding: z.object({ tipo: z.string().trim().min(1, 'Falta el tipo'), marca: txt, cantidad: num, ubicacion: txt, estado: txt, observaciones: txt, orden: entero }),
  compras: z.object({
    numero: entero, fecha: fecha.nullable().optional(), pedido: z.string().trim().min(1, 'Falta qué se pide'), cantidad: num, valor: num,
    proveedor: txt, forma_pago: txt, solicita: txt, autoriza: txt, observaciones: txt, cancelada: z.boolean().optional(), orden: entero,
  }),
} as const;

type Tipo = keyof typeof SCHEMAS;

// Delegate de Prisma por tipo. Las cinco tablas de evento tienen evento_id +
// empresa_id; los ítems de espacio cuelgan del espacio.
const MODELO: Record<Tipo, string> = {
  cronograma: 'cronogramaEvento', espacios: 'espacioEvento', 'espacio-items': 'espacioEventoItem',
  internet: 'puntoInternetEvento', branding: 'brandingEvento', compras: 'compraEvento',
};
const delegate = (t: Tipo) => (prisma as any)[MODELO[t]];

const esTipo = (t: string): t is Tipo => t in SCHEMAS;
const fechaUTC = (s: string | null | undefined) => (s ? new Date(`${s.slice(0, 10)}T00:00:00.000Z`) : s === null ? null : undefined);

/** Decimal → number y fechas calendario → "YYYY-MM-DD". */
function serializar(row: any): any {
  if (!row) return row;
  const out: any = { ...row };
  for (const c of ['cantidad', 'valor']) if (out[c] !== undefined && out[c] !== null) out[c] = Number(out[c]);
  if (out.fecha instanceof Date) out.fecha = out.fecha.toISOString().slice(0, 10);
  if (Array.isArray(out.items)) out.items = out.items.map(serializar);
  return out;
}

function datosEscritura(tipo: Tipo, d: Record<string, any>) {
  const data: Record<string, any> = { ...d };
  delete data.espacio_id;
  if ('fecha' in data) data.fecha = fechaUTC(data.fecha);
  return data;
}

async function eventoDelTenant(req: Request) {
  return prisma.evento.findFirst({ where: { id: Number(req.params.id), deleted_at: null, ...withTenant(req.empresaId!) }, select: { id: true, fecha_inicio: true } });
}

async function cargarProduccion(eventoId: number, empresaId: number) {
  const base = { evento_id: eventoId, deleted_at: null, ...withTenant(empresaId) };
  const [cronograma, espacios, internet, branding, compras] = await Promise.all([
    prisma.cronogramaEvento.findMany({ where: base, orderBy: [{ fecha: 'asc' }, { hora: 'asc' }, { orden: 'asc' }] }),
    prisma.espacioEvento.findMany({
      where: base, orderBy: [{ orden: 'asc' }, { id: 'asc' }],
      include: { items: { where: { deleted_at: null }, orderBy: [{ orden: 'asc' }, { id: 'asc' }] } },
    }),
    prisma.puntoInternetEvento.findMany({ where: base, orderBy: [{ orden: 'asc' }, { id: 'asc' }] }),
    prisma.brandingEvento.findMany({ where: base, orderBy: [{ orden: 'asc' }, { id: 'asc' }] }),
    prisma.compraEvento.findMany({ where: base, orderBy: [{ orden: 'asc' }, { id: 'asc' }] }),
  ]);
  return {
    cronograma: cronograma.map(serializar),
    espacios:   espacios.map(serializar),
    internet:   internet.map(serializar),
    branding:   branding.map(serializar),
    compras:    compras.map(serializar),
  };
}

// GET /api/eventos/:id/produccion
export async function getProduccion(req: Request, res: Response) {
  const evento = await eventoDelTenant(req);
  if (!evento) { res.status(404).json({ error: 'Evento no encontrado' }); return; }
  res.json(await cargarProduccion(evento.id, req.empresaId!));
}

// POST /api/eventos/:id/produccion/:tipo
export async function crearItemProduccion(req: Request, res: Response) {
  const tipo = req.params.tipo;
  if (!esTipo(tipo)) { res.status(404).json({ error: 'Lista desconocida' }); return; }
  const evento = await eventoDelTenant(req);
  if (!evento) { res.status(404).json({ error: 'Evento no encontrado' }); return; }
  const parsed = SCHEMAS[tipo].safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return; }
  const d = parsed.data as Record<string, any>;

  let created;
  if (tipo === 'espacio-items') {
    const espacio = await prisma.espacioEvento.findFirst({ where: { id: Number(d.espacio_id), evento_id: evento.id, deleted_at: null, ...withTenant(req.empresaId!) } });
    if (!espacio) { res.status(404).json({ error: 'Espacio no encontrado' }); return; }
    const last = await prisma.espacioEventoItem.findFirst({ where: { espacio_id: espacio.id, deleted_at: null }, orderBy: { orden: 'desc' } });
    created = await prisma.espacioEventoItem.create({ data: { ...datosEscritura(tipo, d), espacio_id: espacio.id, orden: d.orden ?? (last?.orden ?? 0) + 1 } as any });
  } else {
    const last = await delegate(tipo).findFirst({ where: { evento_id: evento.id, deleted_at: null }, orderBy: { orden: 'desc' } });
    created = await delegate(tipo).create({
      data: { ...datosEscritura(tipo, d), evento_id: evento.id, empresa_id: req.empresaId!, created_by: req.user!.id, orden: d.orden ?? (last?.orden ?? 0) + 1 },
    });
  }
  res.status(201).json(serializar(created));
}

async function buscarItem(tipo: Tipo, id: number, empresaId: number) {
  if (tipo === 'espacio-items') {
    return prisma.espacioEventoItem.findFirst({ where: { id, deleted_at: null, espacio: { deleted_at: null, ...withTenant(empresaId) } } });
  }
  return delegate(tipo).findFirst({ where: { id, deleted_at: null, ...withTenant(empresaId) } });
}

// PUT /api/produccion/:tipo/:itemId
export async function actualizarItemProduccion(req: Request, res: Response) {
  const tipo = req.params.tipo;
  if (!esTipo(tipo)) { res.status(404).json({ error: 'Lista desconocida' }); return; }
  const item = await buscarItem(tipo, Number(req.params.itemId), req.empresaId!);
  if (!item) { res.status(404).json({ error: 'No encontrado' }); return; }
  const parsed = (SCHEMAS[tipo] as z.AnyZodObject).partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return; }
  const updated = await delegate(tipo).update({ where: { id: item.id }, data: datosEscritura(tipo, parsed.data) });
  res.json(serializar(updated));
}

// DELETE /api/produccion/:tipo/:itemId — baja lógica (un espacio se lleva sus ítems)
export async function eliminarItemProduccion(req: Request, res: Response) {
  const tipo = req.params.tipo;
  if (!esTipo(tipo)) { res.status(404).json({ error: 'Lista desconocida' }); return; }
  const item = await buscarItem(tipo, Number(req.params.itemId), req.empresaId!);
  if (!item) { res.status(404).json({ error: 'No encontrado' }); return; }
  const ahora = new Date();
  await prisma.$transaction(async tx => {
    if (tipo === 'espacios') await tx.espacioEventoItem.updateMany({ where: { espacio_id: item.id, deleted_at: null }, data: { deleted_at: ahora } });
    await (tx as any)[MODELO[tipo]].update({ where: { id: item.id }, data: { deleted_at: ahora } });
  });
  res.json({ message: 'Eliminado' });
}

// ── Importar la planilla de producción ────────────────────────────────────────

/** Claves de reimport: texto normalizado + n° de aparición (dos filas iguales no se pisan). */
function conOcurrencia(bases: string[]): string[] {
  const vistas = new Map<string, number>();
  return bases.map(b => { const n = (vistas.get(b) ?? 0) + 1; vistas.set(b, n); return `${b}|${n}`; });
}

const CLAVE = {
  cronograma: (r: { fecha: string | Date; hora: string | null; actividad: string }) =>
    `${typeof r.fecha === 'string' ? r.fecha : r.fecha.toISOString().slice(0, 10)}|${r.hora ?? ''}|${normTexto(r.actividad)}`,
  espacio:  (r: { nombre: string }) => normTexto(r.nombre),
  item:     (r: { elemento: string }) => normTexto(r.elemento),
  internet: (r: { zona: string; uso: string | null }) => `${normTexto(r.zona)}|${normTexto(r.uso)}`,
  branding: (r: { tipo: string; marca: string | null; ubicacion: string | null }) => `${normTexto(r.tipo)}|${normTexto(r.marca)}|${normTexto(r.ubicacion)}`,
  compra:   (r: { pedido: string; fecha: string | Date | null }) =>
    `${r.fecha ? (typeof r.fecha === 'string' ? r.fecha : r.fecha.toISOString().slice(0, 10)) : ''}|${normTexto(r.pedido)}`,
};

/** Cuántas filas del archivo ya están (se actualizan) y cuántas son nuevas. */
function contar<T>(filas: T[], existentes: string[], clave: (r: T) => string) {
  const ya = new Set(conOcurrencia(existentes));
  const claves = conOcurrencia(filas.map(clave));
  const nuevos = claves.filter(c => !ya.has(c)).length;
  return { total: filas.length, nuevos, actualizados: filas.length - nuevos };
}

// POST /api/eventos/:id/produccion/importar?preview=true|false
// Reimportar actualiza lo que ya estaba y agrega lo nuevo; nunca borra filas
// cargadas a mano.
export async function importarProduccion(req: Request, res: Response) {
  const evento = await eventoDelTenant(req);
  if (!evento) { res.status(404).json({ error: 'Evento no encontrado' }); return; }
  if (!req.file) { res.status(400).json({ error: 'Se requiere un archivo .xlsx' }); return; }
  const esPreview = req.query.preview !== 'false';

  let p;
  try {
    p = await parseProduccionEvento(req.file.buffer, evento.fecha_inicio);
  } catch (err: any) {
    res.status(400).json({ error: err.message ?? 'Error al procesar el archivo' }); return;
  }

  const actual = await cargarProduccion(evento.id, req.empresaId!);
  const itemsPrevios = actual.espacios.flatMap((e: any) => e.items.map((i: any) => `${CLAVE.espacio(e)}>${CLAVE.item(i)}`));
  const itemsArchivo = (p.espacios?.filas ?? []).flatMap(e => e.items.map(i => ({ ...i, _k: `${CLAVE.espacio(e)}>${CLAVE.item(i)}` })));

  const resumen = {
    hojas_omitidas: p.hojas_omitidas,
    cronograma: p.cronograma && { hoja: p.cronograma.hoja, ...contar(p.cronograma.filas, actual.cronograma.map(CLAVE.cronograma), CLAVE.cronograma) },
    espacios:   p.espacios && {
      hoja: p.espacios.hoja, ...contar(p.espacios.filas, actual.espacios.map(CLAVE.espacio), CLAVE.espacio),
      items: contar(itemsArchivo, itemsPrevios, i => i._k),
    },
    internet:   p.internet && { hoja: p.internet.hoja, ...contar(p.internet.filas, actual.internet.map(CLAVE.internet), CLAVE.internet) },
    branding:   p.branding && { hoja: p.branding.hoja, ...contar(p.branding.filas, actual.branding.map(CLAVE.branding), CLAVE.branding) },
    compras:    p.compras && {
      hoja: p.compras.hoja, ...contar(p.compras.filas, actual.compras.map(CLAVE.compra), CLAVE.compra),
      total_planilla: p.compras.total_planilla,
      total_importado: Math.round(p.compras.filas.reduce((a, c) => a + (c.valor ?? 0), 0) * 100) / 100,
      total_sin_canceladas: Math.round(p.compras.filas.filter(c => !c.cancelada).reduce((a, c) => a + (c.valor ?? 0), 0) * 100) / 100,
      pendientes_de_valor: p.compras.filas.filter(c => c.valor === null).length,
    },
  };

  if (esPreview) { res.json({ preview: true, ...resumen, datos: p }); return; }

  const userId = req.user!.id;
  const empresaId = req.empresaId!;
  const base = { evento_id: evento.id, empresa_id: empresaId };

  await prisma.$transaction(async tx => {
    // Upsert genérico de una lista plana por clave con ocurrencia
    async function sincronizar<F extends { fila_excel: number }>(
      modelo: string, previos: any[], filas: F[], clave: (r: any) => string, datos: (f: F) => Record<string, any>,
    ) {
      const idPorClave = new Map(conOcurrencia(previos.map(clave)).map((k, i) => [k, previos[i].id as number]));
      let orden = previos.reduce((m, r) => Math.max(m, r.orden ?? 0), 0);
      const claves = conOcurrencia(filas.map(clave));
      for (let i = 0; i < filas.length; i++) {
        const id = idPorClave.get(claves[i]);
        if (id) await (tx as any)[modelo].update({ where: { id }, data: datos(filas[i]) });
        else await (tx as any)[modelo].create({ data: { ...base, created_by: userId, orden: ++orden, ...datos(filas[i]) } });
      }
    }

    if (p.cronograma) {
      await sincronizar('cronogramaEvento', actual.cronograma, p.cronograma.filas, CLAVE.cronograma, f => ({
        fecha: fechaUTC(f.fecha), hora: f.hora, actividad: f.actividad, proveedor: f.proveedor, responsable: f.responsable, observaciones: f.observaciones,
      }));
    }
    if (p.internet) {
      await sincronizar('puntoInternetEvento', actual.internet, p.internet.filas, CLAVE.internet, f => ({
        numero: f.numero, zona: f.zona, uso: f.uso, tipo_conexion: f.tipo_conexion, observaciones: f.observaciones,
      }));
    }
    if (p.branding) {
      await sincronizar('brandingEvento', actual.branding, p.branding.filas, CLAVE.branding, f => ({
        tipo: f.tipo, marca: f.marca, cantidad: f.cantidad, ubicacion: f.ubicacion, estado: f.estado, observaciones: f.observaciones,
      }));
    }
    if (p.compras) {
      await sincronizar('compraEvento', actual.compras, p.compras.filas, CLAVE.compra, f => ({
        numero: f.numero, fecha: fechaUTC(f.fecha), pedido: f.pedido, cantidad: f.cantidad, valor: f.valor, proveedor: f.proveedor,
        forma_pago: f.forma_pago, solicita: f.solicita, autoriza: f.autoriza, observaciones: f.observaciones, cancelada: f.cancelada,
      }));
    }
    if (p.espacios) {
      const espPorClave = new Map(conOcurrencia(actual.espacios.map(CLAVE.espacio)).map((k, i) => [k, actual.espacios[i]]));
      let orden = actual.espacios.reduce((m: number, e: any) => Math.max(m, e.orden ?? 0), 0);
      const claves = conOcurrencia(p.espacios.filas.map(CLAVE.espacio));
      for (let i = 0; i < p.espacios.filas.length; i++) {
        const f = p.espacios.filas[i];
        const previo = espPorClave.get(claves[i]);
        const datos = { numero: f.numero, nombre: f.nombre, actividad: f.actividad, ...(f.observaciones ? { observaciones: f.observaciones } : {}) };
        const esp = previo
          ? await tx.espacioEvento.update({ where: { id: previo.id }, data: datos })
          : await tx.espacioEvento.create({ data: { ...base, created_by: userId, orden: ++orden, ...datos } });
        const itemsPrev = previo?.items ?? [];
        const idItem = new Map(conOcurrencia(itemsPrev.map(CLAVE.item)).map((k, j) => [k, itemsPrev[j].id as number]));
        let ordenItem = itemsPrev.reduce((m: number, it: any) => Math.max(m, it.orden ?? 0), 0);
        const clavesItems = conOcurrencia(f.items.map(CLAVE.item));
        for (let j = 0; j < f.items.length; j++) {
          const it = f.items[j];
          const d = { elemento: it.elemento, estado: it.estado, responsable: it.responsable, observaciones: it.observaciones };
          const id = idItem.get(clavesItems[j]);
          if (id) await tx.espacioEventoItem.update({ where: { id }, data: d });
          else await tx.espacioEventoItem.create({ data: { espacio_id: esp.id, orden: ++ordenItem, ...d } });
        }
      }
    }

    const partes = [
      resumen.cronograma && `${resumen.cronograma.total} actividades del cronograma`,
      resumen.espacios && `${resumen.espacios.total} espacios`,
      resumen.internet && `${resumen.internet.total} puntos de internet`,
      resumen.branding && `${resumen.branding.total} elementos de branding`,
      resumen.compras && `${resumen.compras.total} compras`,
    ].filter(Boolean).join(', ');
    await registrarAuditoria({
      usuarioId: userId, empresaId, accion: 'CREATE', entidad: 'ProduccionEvento', eventoId: evento.id,
      descripcion: `Importó la planilla de producción — ${partes}`, ip: req.ip, tx: tx as any,
    });
  });

  res.json({ preview: false, ...resumen });
}
