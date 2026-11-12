import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { withTenant } from '../lib/tenant';
import { registrarAuditoria } from '../lib/auditoria';
import {
  parseCortesias, vincularInscriptos, claveNombre, type CortesiaParseada, type Vinculo,
} from '../lib/cortesiasImporter';
import { generateCortesiasExcel, ordenTipoTicket } from '../lib/cortesiasExporter';

// Cortesías de eventos: tickets que se regalan a sponsors, VIPs, municipios, etc.
// Ver schema (CortesiaEvento / CortesiaItem) y lib/cortesiasImporter.ts.

const ITEMS_INCLUDE = { orderBy: { id: 'asc' as const } };

function mapCortesia<T extends { items: { cantidad: number }[] }>(c: T) {
  return { ...c, total: c.items.reduce((a, i) => a + i.cantidad, 0) };
}

async function buscarEvento(req: Request, res: Response) {
  const eventoId = Number(req.params.id);
  const evento = await prisma.evento.findFirst({ where: { id: eventoId, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!evento) { res.status(404).json({ error: 'Evento no encontrado' }); return null; }
  return evento;
}

async function buscarCortesia(req: Request, res: Response) {
  const id = Number(req.params.id);
  const cortesia = await prisma.cortesiaEvento.findFirst({
    where: { id, deleted_at: null, ...withTenant(req.empresaId!) },
    include: { items: ITEMS_INCLUDE },
  });
  if (!cortesia) { res.status(404).json({ error: 'Cortesía no encontrada' }); return null; }
  return cortesia;
}

// ═══════════════════════════════════════════════════════════════════════════
// LISTA + TOTALES
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/eventos/:id/cortesias
export async function listCortesias(req: Request, res: Response) {
  const evento = await buscarEvento(req, res);
  if (!evento) return;

  const cortesias = await prisma.cortesiaEvento.findMany({
    where:   { evento_id: evento.id, deleted_at: null, ...withTenant(req.empresaId!) },
    include: { items: ITEMS_INCLUDE },
    orderBy: { id: 'asc' },
  });

  const porTipo = new Map<string, number>();
  let total = 0;
  let conInscripto = 0;
  for (const c of cortesias) {
    for (const i of c.items) {
      porTipo.set(i.tipo_ticket, (porTipo.get(i.tipo_ticket) ?? 0) + i.cantidad);
      total += i.cantidad;
      if (i.bib_number || i.nombre_inscripto || i.apellido_inscripto || i.dni || i.email) conInscripto += i.cantidad;
    }
  }

  res.json({
    cortesias: cortesias.map(mapCortesia),
    totales: {
      por_tipo: [...porTipo.entries()].sort(([a], [b]) => ordenTipoTicket(a, b)).map(([tipo_ticket, cantidad]) => ({ tipo_ticket, cantidad })),
      total,
      asignaciones: cortesias.length,
      visadas:    cortesias.filter(c => c.visado).length,
      entregadas: cortesias.filter(c => c.entregado).length,
      con_inscripto: conInscripto,
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// ALTA / EDICIÓN / BAJA
// ═══════════════════════════════════════════════════════════════════════════

const vacioANull = (s: string | null | undefined) => (s && s.trim() ? s.trim() : null);

const itemSchema = z.object({
  id:                 z.number().int().positive().optional(), // sólo en PUT: ítem existente
  tipo_ticket:        z.string().trim().min(1, 'Tipo de ticket requerido'),
  cantidad:           z.number().int().positive('La cantidad debe ser mayor a 0'),
  bib_number:         z.string().nullable().optional(),
  nombre_inscripto:   z.string().nullable().optional(),
  apellido_inscripto: z.string().nullable().optional(),
  dni:                z.string().nullable().optional(),
  email:              z.string().nullable().optional(),
});

const cortesiaSchema = z.object({
  cliente_nombre:  z.string().trim().min(1, 'El cliente es requerido'),
  contacto_nombre: z.string().nullable().optional(),
  autorizado_por:  z.string().nullable().optional(),
  observacion:     z.string().nullable().optional(),
  items:           z.array(itemSchema).min(1, 'Cargá al menos un tipo de ticket'),
});

const datosItem = (i: z.infer<typeof itemSchema>) => ({
  tipo_ticket:        i.tipo_ticket,
  cantidad:           i.cantidad,
  bib_number:         vacioANull(i.bib_number),
  nombre_inscripto:   vacioANull(i.nombre_inscripto),
  apellido_inscripto: vacioANull(i.apellido_inscripto),
  dni:                vacioANull(i.dni),
  email:              vacioANull(i.email),
});

// POST /api/eventos/:id/cortesias
export async function createCortesia(req: Request, res: Response) {
  const evento = await buscarEvento(req, res);
  if (!evento) return;

  const parsed = cortesiaSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return; }
  const d = parsed.data;

  const created = await prisma.$transaction(async tx => {
    const c = await tx.cortesiaEvento.create({
      data: {
        evento_id: evento.id, empresa_id: req.empresaId!,
        cliente_nombre: d.cliente_nombre, contacto_nombre: vacioANull(d.contacto_nombre),
        autorizado_por: vacioANull(d.autorizado_por), observacion: vacioANull(d.observacion),
        created_by: req.user!.id,
        items: { create: d.items.map(datosItem) },
      },
      include: { items: ITEMS_INCLUDE },
    });
    await registrarAuditoria({
      usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'CREATE', entidad: 'CortesiaEvento', entidadId: c.id, eventoId: evento.id,
      descripcion: `Creó la cortesía de "${c.cliente_nombre}" (${c.items.reduce((a, i) => a + i.cantidad, 0)} tickets)`,
      datosDespues: d, ip: req.ip, tx: tx as any,
    });
    return c;
  });

  res.status(201).json(mapCortesia(created));
}

// PUT /api/eventos/cortesias/:id — los ítems se sincronizan: los que traen `id` se
// actualizan, los nuevos se crean y los que no vienen se eliminan.
export async function updateCortesia(req: Request, res: Response) {
  const existing = await buscarCortesia(req, res);
  if (!existing) return;

  const parsed = cortesiaSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return; }
  const d = parsed.data;

  const idsExistentes = new Set(existing.items.map(i => i.id));
  const ajeno = d.items.find(i => i.id !== undefined && !idsExistentes.has(i.id));
  if (ajeno) { res.status(400).json({ error: `El ítem #${ajeno.id} no pertenece a esta cortesía` }); return; }
  const idsConservados = new Set(d.items.filter(i => i.id !== undefined).map(i => i.id!));

  const updated = await prisma.$transaction(async tx => {
    await tx.cortesiaEvento.update({
      where: { id: existing.id },
      data: {
        cliente_nombre: d.cliente_nombre, contacto_nombre: vacioANull(d.contacto_nombre),
        autorizado_por: vacioANull(d.autorizado_por), observacion: vacioANull(d.observacion),
      },
    });
    const aBorrar = existing.items.filter(i => !idsConservados.has(i.id)).map(i => i.id);
    if (aBorrar.length > 0) await tx.cortesiaItem.deleteMany({ where: { id: { in: aBorrar } } });
    for (const i of d.items) {
      if (i.id !== undefined) await tx.cortesiaItem.update({ where: { id: i.id }, data: datosItem(i) });
      else await tx.cortesiaItem.create({ data: { cortesia_id: existing.id, ...datosItem(i) } });
    }
    await registrarAuditoria({
      usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'UPDATE', entidad: 'CortesiaEvento', entidadId: existing.id, eventoId: existing.evento_id,
      descripcion: `Editó la cortesía de "${d.cliente_nombre}"`,
      datosAntes: { cliente_nombre: existing.cliente_nombre, tickets: existing.items.reduce((a, i) => a + i.cantidad, 0) },
      datosDespues: { cliente_nombre: d.cliente_nombre, tickets: d.items.reduce((a, i) => a + i.cantidad, 0) },
      ip: req.ip, tx: tx as any,
    });
    return tx.cortesiaEvento.findUniqueOrThrow({ where: { id: existing.id }, include: { items: ITEMS_INCLUDE } });
  });

  res.json(mapCortesia(updated));
}

// PATCH /api/eventos/cortesias/:id/visar y /entregar — body opcional { valor: boolean }
// (por defecto true; con false se desmarca).
function marcar(campo: 'visado' | 'entregado', verbo: string) {
  return async (req: Request, res: Response) => {
    const existing = await buscarCortesia(req, res);
    if (!existing) return;
    const valor = z.object({ valor: z.boolean().optional() }).safeParse(req.body ?? {}).data?.valor ?? true;

    const updated = await prisma.$transaction(async tx => {
      const c = await tx.cortesiaEvento.update({ where: { id: existing.id }, data: { [campo]: valor }, include: { items: ITEMS_INCLUDE } });
      await registrarAuditoria({
        usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'UPDATE', entidad: 'CortesiaEvento', entidadId: existing.id, eventoId: existing.evento_id,
        descripcion: `${valor ? 'Marcó como' : 'Quitó la marca de'} ${verbo} la cortesía de "${existing.cliente_nombre}"`,
        datosAntes: { [campo]: existing[campo] }, datosDespues: { [campo]: valor }, ip: req.ip, tx: tx as any,
      });
      return c;
    });
    res.json(mapCortesia(updated));
  };
}
export const visarCortesia = marcar('visado', 'visado');
export const entregarCortesia = marcar('entregado', 'entregado');

// DELETE /api/eventos/cortesias/:id — soft delete
export async function deleteCortesia(req: Request, res: Response) {
  const existing = await buscarCortesia(req, res);
  if (!existing) return;
  await prisma.$transaction(async tx => {
    await tx.cortesiaEvento.update({ where: { id: existing.id }, data: { deleted_at: new Date() } });
    await registrarAuditoria({
      usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'DELETE', entidad: 'CortesiaEvento', entidadId: existing.id, eventoId: existing.evento_id,
      descripcion: `Eliminó la cortesía de "${existing.cliente_nombre}"`, ip: req.ip, tx: tx as any,
    });
  });
  res.json({ message: 'Cortesía eliminada correctamente' });
}

// ═══════════════════════════════════════════════════════════════════════════
// IMPORTAR (Cortesias-  Male.xlsx)
// ═══════════════════════════════════════════════════════════════════════════

// Una cortesía ya cargada es la misma que una fila del Excel si coinciden cliente y
// contacto (sin distinguir mayúsculas, acentos ni espacios). Así reimportar la planilla
// actualiza en vez de duplicar las ~200 asignaciones.
const claveCortesia = (cliente: string, contacto: string | null | undefined) => `${claveNombre(cliente)}|${claveNombre(contacto)}`;

// POST /api/eventos/:id/cortesias/importar?preview=true|false
// preview=true (default): sólo parsea y resuelve — no escribe nada.
// preview=false: crea las asignaciones nuevas y actualiza las que ya existen.
//   - Cantidades: para cada tipo de ticket de la fila se ajusta el total de esa cortesía.
//     Los tipos que ya no figuran en el Excel NO se borran (pueden ser altas manuales).
//   - VISADO / ENTREGADO sólo se marcan (nunca se desmarcan una cortesía ya visada).
//   - Inscriptos (hoja de Njuko): ver vincularInscriptos — sólo por nombre + kit.
export async function importarCortesias(req: Request, res: Response) {
  const evento = await buscarEvento(req, res);
  if (!evento) return;
  if (!req.file) { res.status(400).json({ error: 'Se requiere un archivo .xlsx' }); return; }
  const esPreview = req.query.preview !== 'false';

  let parsed;
  try {
    parsed = await parseCortesias(req.file.buffer);
  } catch (err: any) {
    res.status(400).json({ error: err.message ?? 'Error al procesar el archivo' }); return;
  }
  if (parsed.cortesias.length === 0) {
    res.status(400).json({ error: 'La planilla no tiene asignaciones con tickets', omitidas: parsed.omitidas }); return;
  }

  const existentes = await prisma.cortesiaEvento.findMany({
    where:   { evento_id: evento.id, deleted_at: null, ...withTenant(req.empresaId!) },
    include: { items: ITEMS_INCLUDE },
  });
  const porClave = new Map(existentes.map(c => [claveCortesia(c.cliente_nombre, c.contacto_nombre), c]));

  const vinculos = vincularInscriptos(parsed.cortesias, parsed.inscriptos);
  const vistas = new Set<string>();
  const filas = parsed.cortesias.map(c => {
    const clave = claveCortesia(c.cliente, c.contacto);
    const repetida = vistas.has(clave);
    vistas.add(clave);
    const vinculo: Vinculo = vinculos.get(c) ?? { estado: 'SIN_COINCIDENCIA' };
    return { c, clave, repetida, vinculo, accion: (porClave.has(clave) || repetida ? 'ACTUALIZAR' : 'CREAR') as 'CREAR' | 'ACTUALIZAR' };
  });

  const porTipo = new Map<string, number>();
  for (const f of filas) for (const i of f.c.items) porTipo.set(i.tipo_ticket, (porTipo.get(i.tipo_ticket) ?? 0) + i.cantidad);
  const conteoVinculos = filas.reduce<Record<string, number>>((acc, f) => { acc[f.vinculo.estado] = (acc[f.vinculo.estado] ?? 0) + 1; return acc; }, {});

  const resumen = {
    hoja: parsed.hoja,
    evento_excel: parsed.evento_excel,
    creadas:      filas.filter(f => f.accion === 'CREAR').length,
    actualizadas: filas.filter(f => f.accion === 'ACTUALIZAR').length,
    tickets:      filas.reduce((a, f) => a + f.c.total, 0),
    por_tipo:     [...porTipo.entries()].sort(([a], [b]) => ordenTipoTicket(a, b)).map(([tipo_ticket, cantidad]) => ({ tipo_ticket, cantidad })),
    omitidas:     parsed.omitidas,
    inscriptos: {
      hoja:      parsed.hoja_inscriptos,
      leidos:    parsed.inscriptos.length,
      vinculados: conteoVinculos.VINCULADO ?? 0,
      // Motivos por los que una cortesía NO se vinculó (SIN_COINCIDENCIA es lo normal: casi ninguna cortesía está en Njuko por nombre)
      no_vinculados: Object.fromEntries(Object.entries(conteoVinculos).filter(([k]) => k !== 'VINCULADO')),
    },
  };
  const filasSalida = filas.map(f => ({
    fila_excel: f.c.fila_excel, item: f.c.item, cliente: f.c.cliente, contacto: f.c.contacto, observacion: f.c.observacion,
    autoriza: f.c.autoriza, items: f.c.items, total: f.c.total, visado: f.c.visado, entregado: f.c.entregado,
    accion: f.accion, vinculo: f.vinculo.estado,
    inscripto: f.vinculo.estado === 'VINCULADO' ? f.vinculo.inscripto : undefined,
    advertencias: f.repetida ? ['Cliente y contacto repetidos en el archivo — se toma esta fila'] : [],
  }));

  if (esPreview) { res.json({ preview: true, ...resumen, filas: filasSalida }); return; }

  await prisma.$transaction(async tx => {
    for (const f of filas) {
      const { c, vinculo } = f;
      const inscripto = vinculo.estado === 'VINCULADO' ? vinculo.inscripto! : null;
      const datosInscripto = inscripto
        ? { bib_number: inscripto.bib, nombre_inscripto: inscripto.nombre, apellido_inscripto: inscripto.apellido, dni: inscripto.dni, email: inscripto.email }
        : {};
      const existente = porClave.get(f.clave);

      if (!existente) {
        const creada = await tx.cortesiaEvento.create({
          data: {
            evento_id: evento.id, empresa_id: req.empresaId!, created_by: req.user!.id,
            cliente_nombre: c.cliente, contacto_nombre: c.contacto, autorizado_por: c.autoriza, observacion: c.observacion,
            visado: c.visado, entregado: c.entregado,
            items: { create: c.items.map(i => ({ tipo_ticket: i.tipo_ticket, cantidad: i.cantidad, ...datosInscripto })) },
          },
          include: { items: ITEMS_INCLUDE },
        });
        porClave.set(f.clave, creada);
        continue;
      }

      await tx.cortesiaEvento.update({
        where: { id: existente.id },
        data: {
          contacto_nombre: c.contacto ?? existente.contacto_nombre,
          autorizado_por:  c.autoriza ?? existente.autorizado_por,
          observacion:     c.observacion ?? existente.observacion,
          ...(c.visado && { visado: true }),
          ...(c.entregado && { entregado: true }),
        },
      });
      for (const i of c.items) {
        const mismos = existente.items.filter(x => x.tipo_ticket === i.tipo_ticket);
        const suma = mismos.reduce((a, x) => a + x.cantidad, 0);
        if (mismos.length === 0) {
          const nuevo = await tx.cortesiaItem.create({ data: { cortesia_id: existente.id, tipo_ticket: i.tipo_ticket, cantidad: i.cantidad, ...datosInscripto } });
          existente.items.push(nuevo);
        } else if (suma !== i.cantidad) {
          // Se ajusta el ítem sin datos de inscripto (o el primero) para no perder un vínculo ya cargado
          const objetivo = mismos.find(x => !x.bib_number && !x.dni && !x.email && !x.nombre_inscripto) ?? mismos[0];
          const cantidad = objetivo.cantidad + (i.cantidad - suma);
          if (cantidad > 0) {
            const upd = await tx.cortesiaItem.update({ where: { id: objetivo.id }, data: { cantidad } });
            objetivo.cantidad = upd.cantidad;
          }
        }
      }
    }
    await registrarAuditoria({
      usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'CREATE', entidad: 'CortesiaEvento', eventoId: evento.id,
      descripcion: `Importó cortesías desde Excel (hoja "${parsed.hoja}") — ${resumen.creadas} creadas, ${resumen.actualizadas} actualizadas, ${resumen.tickets} tickets`,
      ip: req.ip, tx: tx as any,
    });
  }, { timeout: 60_000 });

  res.json({ preview: false, ...resumen, filas: filasSalida });
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTAR
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/eventos/:id/cortesias/exportar
export async function exportarCortesias(req: Request, res: Response) {
  const evento = await buscarEvento(req, res);
  if (!evento) return;
  const { buffer, filename } = await generateCortesiasExcel(evento.id, req.empresaId!);
  res.set({
    'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
    'Content-Length':      String(buffer.length),
  });
  res.end(buffer);
}

export type { CortesiaParseada };
