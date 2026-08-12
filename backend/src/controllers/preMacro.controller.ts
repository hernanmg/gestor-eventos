import type { Request, Response } from 'express';
import { z } from 'zod';
import type { Moneda } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { withTenant } from '../lib/tenant';
import { registrarAuditoria } from '../lib/auditoria';
import { sugerirRubros } from '../lib/sugerirRubros';

const INCLUDE_SOCIOS = { socios: true };

const socioSchema = z.object({
  nombre:     z.string().min(1, 'Nombre requerido'),
  porcentaje: z.number().positive('Debe ser positivo'),
});

function sociosSumOk(socios: { porcentaje: number }[]): boolean {
  if (socios.length === 0) return true;
  const sum = socios.reduce((acc, s) => acc + s.porcentaje, 0);
  return Math.abs(sum - 100) < 0.01;
}

function toDate(s: string | null | undefined): Date | null | undefined {
  if (s === null) return null;
  if (s === undefined) return undefined;
  return new Date(s);
}

function mapPreMacro(pm: any) {
  return {
    ...pm,
    presupuesto_total: pm.presupuesto_total != null ? Number(pm.presupuesto_total) : null,
    socios: Array.isArray(pm.socios)
      ? pm.socios.map((s: any) => ({ id: s.id, nombre: s.nombre, porcentaje: Number(s.porcentaje) }))
      : undefined,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// CREATE
// ═══════════════════════════════════════════════════════════════════════════

const createSchema = z.object({
  nombre_evento: z.string().optional(),
});

export async function create(req: Request, res: Response) {
  const parsed = createSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors });
    return;
  }

  const preMacro = await prisma.preMacro.create({
    data: {
      ...withTenant(req.empresaId!),
      nombre_evento: parsed.data.nombre_evento ?? null,
      created_by:    req.user!.id,
    },
    include: INCLUDE_SOCIOS,
  });

  res.status(201).json(mapPreMacro(preMacro));
}

// ═══════════════════════════════════════════════════════════════════════════
// BORRADOR — última pre-macro sin completar de la empresa activa (banner /eventos)
// ═══════════════════════════════════════════════════════════════════════════

export async function borrador(req: Request, res: Response) {
  const preMacro = await prisma.preMacro.findFirst({
    where:   { ...withTenant(req.empresaId!), completada: false, deleted_at: null },
    orderBy: { updated_at: 'desc' },
    select:  { id: true, nombre_evento: true, updated_at: true },
  });
  res.json(preMacro);
}

// ═══════════════════════════════════════════════════════════════════════════
// GET
// ═══════════════════════════════════════════════════════════════════════════

export async function getOne(req: Request, res: Response) {
  const id = Number(req.params.id);
  const preMacro = await prisma.preMacro.findFirst({
    where:   { id, ...withTenant(req.empresaId!), deleted_at: null },
    include: INCLUDE_SOCIOS,
  });
  if (!preMacro) { res.status(404).json({ error: 'Pre-macro no encontrada' }); return; }
  res.json(mapPreMacro(preMacro));
}

// ═══════════════════════════════════════════════════════════════════════════
// UPDATE — guarda campos del paso actual, avanza el paso y recalcula sugerencias
// ═══════════════════════════════════════════════════════════════════════════

const updateSchema = z.object({
  paso_actual: z.number().int().min(1).max(4).optional(),

  nombre_evento: z.string().nullable().optional(),
  tipo_evento:   z.string().nullable().optional(),
  descripcion:   z.string().nullable().optional(),
  para_que_es:   z.string().nullable().optional(),
  es_privado:    z.boolean().optional(),

  fecha_inicio:    z.string().nullable().optional(),
  fecha_fin:       z.string().nullable().optional(),
  hora_inicio:     z.string().nullable().optional(),
  hora_fin:        z.string().nullable().optional(),
  lugar_nombre:    z.string().nullable().optional(),
  lugar_ciudad:    z.string().nullable().optional(),
  lugar_provincia: z.string().nullable().optional(),
  lugar_direccion: z.string().nullable().optional(),
  dias_montaje:    z.number().int().nonnegative().nullable().optional(),
  dias_desmontaje: z.number().int().nonnegative().nullable().optional(),

  cliente_nombre:    z.string().nullable().optional(),
  razon_social:      z.string().nullable().optional(),
  cuit_pagador:      z.string().nullable().optional(),
  quien_lo_hace:     z.string().nullable().optional(),
  contacto_cliente:  z.string().nullable().optional(),
  telefono_cliente:  z.string().nullable().optional(),
  presupuesto_total: z.number().nonnegative().nullable().optional(),
  moneda:            z.enum(['ARS', 'USD']).optional(),
  socios:            z.array(socioSchema).optional(),

  lleva_empleados:         z.boolean().optional(),
  cantidad_estimada_staff: z.number().int().nonnegative().nullable().optional(),
  requiere_hospedaje:      z.boolean().optional(),
  ciudad_hospedaje:        z.string().nullable().optional(),
  requiere_traslado:       z.boolean().optional(),
  notas_traslado:          z.string().nullable().optional(),
  requiere_comidas:        z.boolean().optional(),
  cantidad_dias_comida:    z.number().int().nonnegative().nullable().optional(),
  observaciones_generales: z.string().nullable().optional(),
});

export async function update(req: Request, res: Response) {
  const id = Number(req.params.id);
  const existing = await prisma.preMacro.findFirst({ where: { id, ...withTenant(req.empresaId!), deleted_at: null } });
  if (!existing) { res.status(404).json({ error: 'Pre-macro no encontrada' }); return; }
  if (existing.completada) { res.status(400).json({ error: 'La pre-macro ya fue confirmada — no se puede editar' }); return; }

  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors });
    return;
  }
  const d = parsed.data;

  if (d.socios !== undefined && !sociosSumOk(d.socios)) {
    res.status(400).json({ error: 'Los porcentajes de socios deben sumar 100' });
    return;
  }

  const preMacro = await prisma.$transaction(async tx => {
    await tx.preMacro.update({
      where: { id },
      data: {
        ...(d.paso_actual   !== undefined && { paso_actual: d.paso_actual }),
        ...(d.nombre_evento !== undefined && { nombre_evento: d.nombre_evento }),
        ...(d.tipo_evento   !== undefined && { tipo_evento: d.tipo_evento }),
        ...(d.descripcion   !== undefined && { descripcion: d.descripcion }),
        ...(d.para_que_es   !== undefined && { para_que_es: d.para_que_es }),
        ...(d.es_privado    !== undefined && { es_privado: d.es_privado }),
        ...(d.fecha_inicio    !== undefined && { fecha_inicio: toDate(d.fecha_inicio) }),
        ...(d.fecha_fin       !== undefined && { fecha_fin: toDate(d.fecha_fin) }),
        ...(d.hora_inicio     !== undefined && { hora_inicio: d.hora_inicio }),
        ...(d.hora_fin        !== undefined && { hora_fin: d.hora_fin }),
        ...(d.lugar_nombre    !== undefined && { lugar_nombre: d.lugar_nombre }),
        ...(d.lugar_ciudad    !== undefined && { lugar_ciudad: d.lugar_ciudad }),
        ...(d.lugar_provincia !== undefined && { lugar_provincia: d.lugar_provincia }),
        ...(d.lugar_direccion !== undefined && { lugar_direccion: d.lugar_direccion }),
        ...(d.dias_montaje    !== undefined && { dias_montaje: d.dias_montaje }),
        ...(d.dias_desmontaje !== undefined && { dias_desmontaje: d.dias_desmontaje }),
        ...(d.cliente_nombre    !== undefined && { cliente_nombre: d.cliente_nombre }),
        ...(d.razon_social      !== undefined && { razon_social: d.razon_social }),
        ...(d.cuit_pagador      !== undefined && { cuit_pagador: d.cuit_pagador }),
        ...(d.quien_lo_hace     !== undefined && { quien_lo_hace: d.quien_lo_hace }),
        ...(d.contacto_cliente  !== undefined && { contacto_cliente: d.contacto_cliente }),
        ...(d.telefono_cliente  !== undefined && { telefono_cliente: d.telefono_cliente }),
        ...(d.presupuesto_total !== undefined && { presupuesto_total: d.presupuesto_total }),
        ...(d.moneda             !== undefined && { moneda: d.moneda as Moneda }),
        ...(d.lleva_empleados          !== undefined && { lleva_empleados: d.lleva_empleados }),
        ...(d.cantidad_estimada_staff  !== undefined && { cantidad_estimada_staff: d.cantidad_estimada_staff }),
        ...(d.requiere_hospedaje       !== undefined && { requiere_hospedaje: d.requiere_hospedaje }),
        ...(d.ciudad_hospedaje         !== undefined && { ciudad_hospedaje: d.ciudad_hospedaje }),
        ...(d.requiere_traslado        !== undefined && { requiere_traslado: d.requiere_traslado }),
        ...(d.notas_traslado           !== undefined && { notas_traslado: d.notas_traslado }),
        ...(d.requiere_comidas         !== undefined && { requiere_comidas: d.requiere_comidas }),
        ...(d.cantidad_dias_comida     !== undefined && { cantidad_dias_comida: d.cantidad_dias_comida }),
        ...(d.observaciones_generales  !== undefined && { observaciones_generales: d.observaciones_generales }),
      },
    });

    if (d.socios !== undefined) {
      await tx.socioPreMacro.deleteMany({ where: { pre_macro_id: id } });
      if (d.socios.length > 0) {
        await tx.socioPreMacro.createMany({
          data: d.socios.map(s => ({ pre_macro_id: id, nombre: s.nombre, porcentaje: s.porcentaje })),
        });
      }
    }

    // Recalcular sugerencias de rubros con el estado ya mergeado — se
    // recalcula en cada guardado (no solo al cerrar el paso 4) para que el
    // resumen y la pantalla de rubros siempre reflejen las últimas respuestas.
    const merged   = await tx.preMacro.findUniqueOrThrow({ where: { id } });
    const sugeridos = await sugerirRubros(merged, req.empresaId!);

    return tx.preMacro.update({
      where:   { id },
      data:    { rubros_sugeridos: sugeridos as any },
      include: INCLUDE_SOCIOS,
    });
  });

  res.json(mapPreMacro(preMacro));
}

// ═══════════════════════════════════════════════════════════════════════════
// UPDATE RUBROS — selección final del usuario en la pantalla de rubros
// ═══════════════════════════════════════════════════════════════════════════

const updateRubrosSchema = z.object({
  rubros: z.array(z.object({
    rubro_id:     z.number().int().positive(),
    seleccionado: z.boolean(),
  })),
});

export async function updateRubros(req: Request, res: Response) {
  const id = Number(req.params.id);
  const existing = await prisma.preMacro.findFirst({ where: { id, ...withTenant(req.empresaId!), deleted_at: null } });
  if (!existing) { res.status(404).json({ error: 'Pre-macro no encontrada' }); return; }
  if (existing.completada) { res.status(400).json({ error: 'La pre-macro ya fue confirmada' }); return; }

  const parsed = updateRubrosSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors });
    return;
  }

  const preMacro = await prisma.preMacro.update({
    where:   { id },
    data:    { rubros_confirmados: parsed.data.rubros as any },
    include: INCLUDE_SOCIOS,
  });

  res.json(mapPreMacro(preMacro));
}

// ═══════════════════════════════════════════════════════════════════════════
// DISCARD — descarta un borrador sin completar (banner de /eventos)
// ═══════════════════════════════════════════════════════════════════════════

export async function discard(req: Request, res: Response) {
  const id = Number(req.params.id);
  const existing = await prisma.preMacro.findFirst({ where: { id, ...withTenant(req.empresaId!), deleted_at: null } });
  if (!existing) { res.status(404).json({ error: 'Pre-macro no encontrada' }); return; }
  if (existing.completada) { res.status(400).json({ error: 'La pre-macro ya fue confirmada' }); return; }

  await prisma.preMacro.update({ where: { id }, data: { deleted_at: new Date() } });
  res.json({ message: 'Pre-macro descartada' });
}

// ═══════════════════════════════════════════════════════════════════════════
// CONFIRMAR — crea el Evento, sus socios, sus RubroEvento (PENDIENTE)
// ═══════════════════════════════════════════════════════════════════════════

export async function confirmar(req: Request, res: Response) {
  const id = Number(req.params.id);
  const preMacro = await prisma.preMacro.findFirst({
    where:   { id, ...withTenant(req.empresaId!), deleted_at: null },
    include: INCLUDE_SOCIOS,
  });
  if (!preMacro) { res.status(404).json({ error: 'Pre-macro no encontrada' }); return; }

  // Idempotente ante doble click: si ya se confirmó, devolver el evento ya creado.
  if (preMacro.completada) {
    if (preMacro.evento_id) { res.json({ evento_id: preMacro.evento_id }); return; }
    res.status(400).json({ error: 'La pre-macro ya fue confirmada' });
    return;
  }

  if (!preMacro.nombre_evento?.trim()) {
    res.status(400).json({ error: 'Falta el nombre del evento' });
    return;
  }

  const socios = preMacro.socios.map(s => ({ nombre: s.nombre, porcentaje: Number(s.porcentaje) }));
  if (!sociosSumOk(socios)) {
    res.status(400).json({ error: 'Los porcentajes de los socios deben sumar 100' });
    return;
  }

  const confirmados = Array.isArray(preMacro.rubros_confirmados) ? preMacro.rubros_confirmados as any[] : null;
  const sugeridos    = Array.isArray(preMacro.rubros_sugeridos)   ? preMacro.rubros_sugeridos   as any[] : [];
  const fuente = confirmados ?? sugeridos;
  const rubroIds = [...new Set(
    fuente
      .filter((r: any) => r?.seleccionado)
      .map((r: any) => Number(r.rubro_id))
      .filter((n: number) => Number.isFinite(n)),
  )];

  const evento = await prisma.$transaction(async tx => {
    const createdEvento = await tx.evento.create({
      data: {
        empresa_id:   req.empresaId!,
        nombre:       preMacro.nombre_evento!,
        fecha_inicio: preMacro.fecha_inicio,
        fecha_fin:    preMacro.fecha_fin,
        dias_montaje:    preMacro.dias_montaje ?? 0,
        dias_desmontaje: preMacro.dias_desmontaje ?? 0,
        socios,
        moneda_base:  preMacro.moneda,
        created_by:   req.user!.id,
        updated_by:   req.user!.id,
      },
    });

    for (const rubroId of rubroIds) {
      await tx.rubroEvento.create({
        data: {
          evento_id:  createdEvento.id,
          rubro_id:   rubroId,
          empresa_id: req.empresaId!,
          // El usuario ya eligió este rubro en la pre-macro — no tiene sentido
          // que llegue como PENDIENTE. Los rubros no seleccionados se agregan
          // después desde la Ficha, esos sí en PENDIENTE.
          estado: 'CONFIRMADO',
          // Pre-cargado desde la pre-macro. El presupuesto NO se divide entre
          // rubros — un promedio entre rubros heterogéneos (ej. "Seguridad
          // privada" vs. "Drone") sería un número inventado que ensuciaría el
          // resumen presupuesto-vs-real por rubro; se deja null y se carga a
          // mano por rubro en la Ficha. proveedor/contacto tampoco se
          // pre-cargan — son específicos de cada rubro.
          coordina_nombre: preMacro.quien_lo_hace || null,
          created_by: req.user!.id,
          updated_by: req.user!.id,
        },
      });
    }

    await tx.preMacro.update({
      where: { id },
      data:  { evento_id: createdEvento.id, completada: true },
    });

    await registrarAuditoria({
      usuarioId:    req.user!.id,
      empresaId:    req.empresaId,
      accion:       'CREATE',
      entidad:      'Evento',
      entidadId:    createdEvento.id,
      eventoId:     createdEvento.id,
      descripcion:  `Creó el evento "${preMacro.nombre_evento}" desde la pre-macro #${id} (${rubroIds.length} rubros preseleccionados)`,
      datosDespues: { id: createdEvento.id, nombre: preMacro.nombre_evento, rubros: rubroIds.length },
      ip: req.ip,
      tx: tx as any,
    });

    return createdEvento;
  });

  res.json({ evento_id: evento.id });
}
