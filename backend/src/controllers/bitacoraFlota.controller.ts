import type { Request, Response } from 'express';
import { z } from 'zod';
import { OrigenBitacoraViaje, type Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { withTenant } from '../lib/tenant';
import { registrarAuditoria } from '../lib/auditoria';
import { normalizarPatente } from '../lib/normalizarPatente';
import {
  parsePlanillaViajesFlota, consolidarViajes, claveViaje, RE_ALIAS_CARGA,
  type ParseoFlota, type ViajeFlotaConsolidado,
} from '../lib/bitacoraFlotaImporter';
import { parseFechaUTC, calcularDiaSemana } from './bitacoraViajes.controller';

// Bitácora de viajes de camiones (planillas de campo de Flor, DOS57).
// Comparte la tabla BitacoraViaje con la bitácora de viáticos de RRHH pero
// siempre con origen FLOTA — nunca entra en la liquidación de sueldos (ver
// comentario del enum OrigenBitacoraViaje en schema.prisma).

const FLOTA = { origen: OrigenBitacoraViaje.FLOTA } as const;

const sinAcentos = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();

const num = (d: unknown) => (d !== null && d !== undefined ? Number(d) : null);

function mapViaje(v: any) {
  return {
    ...v,
    monto_combustible:    num(v.monto_combustible),
    litros_cargados_ruta: num(v.litros_cargados_ruta),
    litros_consumidos:    num(v.litros_consumidos),
    km_por_litro:         num(v.km_por_litro),
    litros_iniciales_tanque: num(v.litros_iniciales_tanque),
    monto_caja_entregada: num(v.monto_caja_entregada),
  };
}

// ── Resolución de camión ──────────────────────────────────────────────────────

type CamionRef = { id: number; codigo: string; patente: string | null; tipo_vehiculo: string | null; descripcion: string | null };

function crearResolverCamion(camiones: CamionRef[]) {
  // Por patente (o código, que en los vehículos importados es la patente).
  // KJR926 existe como camioneta y como su acoplado (TRAILER): gana el no-trailer.
  const porPatente = new Map<string, CamionRef>();
  const ordenados = [...camiones].sort((a, b) => Number(a.tipo_vehiculo === 'TRAILER') - Number(b.tipo_vehiculo === 'TRAILER'));
  for (const c of ordenados) {
    for (const k of [normalizarPatente(c.patente), normalizarPatente(c.codigo)]) {
      if (k && !porPatente.has(k)) porPatente.set(k, c);
    }
  }

  return (patente: string | null, alias: string | null): CamionRef | null => {
    if (patente) return porPatente.get(patente) ?? null;
    // "C1", "C2"… = n° de carga del evento, no un vehículo: NO se busca por
    // Camion.codigo (en la DB hay vehículos de prueba con código "C1").
    if (!alias || RE_ALIAS_CARGA.test(alias)) return null;
    // "PLANCHA": tipo_vehiculo, código o descripción — sólo si hay uno solo
    const candidatos = camiones.filter(c =>
      sinAcentos(c.tipo_vehiculo ?? '') === alias ||
      normalizarPatente(c.codigo) === alias ||
      sinAcentos(c.descripcion ?? '') === alias,
    );
    return candidatos.length === 1 ? candidatos[0] : null;
  };
}

// ── Resolución de chofer ──────────────────────────────────────────────────────

type EmpleadoRef = { id: number; nombre: string; apellido: string; categoria: string };

function crearResolverChofer(empleados: EmpleadoRef[]) {
  const tokens = (e: EmpleadoRef) => `${e.nombre} ${e.apellido}`.split(/\s+/).map(sinAcentos).filter(Boolean);
  // Varios matches → primero los CHOFER, después el de menor id ("primer match")
  const elegir = (lista: EmpleadoRef[]) =>
    [...lista].sort((a, b) => Number(b.categoria === 'CHOFER') - Number(a.categoria === 'CHOFER') || a.id - b.id)[0] ?? null;

  return (raw: string | null): EmpleadoRef | null => {
    if (!raw) return null;
    const buscado = sinAcentos(raw).split(/\s+/).filter(Boolean);
    if (!buscado.length) return null;
    // Todas las palabras del nombre de la planilla tienen que ser una palabra
    // del nombre/apellido ("LUIS" → Luis Ledesma). Si no, prefijo ("MACHA" → Machado).
    const exactos = empleados.filter(e => buscado.every(p => tokens(e).includes(p)));
    if (exactos.length) return elegir(exactos);
    return elegir(empleados.filter(e => buscado.every(p => tokens(e).some(t => t.startsWith(p)))));
  };
}

// ── Importador ────────────────────────────────────────────────────────────────

// POST /api/importar/bitacora-viajes?preview=true|false
// preview=true (default): procesa todo sin escribir. preview=false: aplica.
export async function importarBitacoraViajesFlota(req: Request, res: Response) {
  if (!req.file) { res.status(400).json({ error: 'Se requiere un archivo .xlsx' }); return; }
  const dryRun    = req.query.preview !== 'false';
  const empresaId = req.empresaId!;
  const userId    = req.user!.id;

  let parseo: ParseoFlota;
  try {
    parseo = parsePlanillaViajesFlota(req.file.buffer);
  } catch (err: any) {
    res.status(400).json({ error: 'Error al procesar el archivo', detail: err.message }); return;
  }
  if (parseo.bloques.length === 0) {
    res.status(400).json({ error: 'No se encontró ninguna planilla de viajes reconocible (encabezado con CAMIÓN y CHOFER)' }); return;
  }

  const viajes = consolidarViajes(parseo.viajes, parseo.advertencias);

  const [camiones, empleados, existentes] = await Promise.all([
    prisma.camion.findMany({
      where:  { ...withTenant(empresaId), deleted_at: null },
      select: { id: true, codigo: true, patente: true, tipo_vehiculo: true, descripcion: true },
    }),
    prisma.empleado.findMany({
      where:  { ...withTenant(empresaId), deleted_at: null },
      select: { id: true, nombre: true, apellido: true, categoria: true },
    }),
    prisma.bitacoraViaje.findMany({
      where:  { ...withTenant(empresaId), ...FLOTA, deleted_at: null },
      select: { id: true, fecha: true, recorrido: true, km_iniciales: true, alias_camion: true, patente_camion: true, camion_id: true, empleado_id: true },
    }),
  ]);
  const resolverCamion = crearResolverCamion(camiones);
  const resolverChofer = crearResolverChofer(empleados);
  const existentePorClave = new Map(existentes.map(e => [
    claveViaje({ fecha: e.fecha, tramo: e.recorrido, km_iniciales: e.km_iniciales, alias: e.alias_camion, patente: e.patente_camion }),
    e,
  ]));

  // Reportes de resolución (agrupados por el texto tal cual vino en la planilla)
  const camionesReporte = new Map<string, { valor: string; patente: string | null; alias: string | null; camion: CamionRef | null; viajes: number }>();
  const choferesReporte = new Map<string, { nombre: string; empleado: EmpleadoRef | null; viajes: number }>();

  type Fila = { viaje: ViajeFlotaConsolidado; data: Prisma.BitacoraViajeUncheckedCreateInput; existenteId: number | null };
  const filas: Fila[] = viajes.map(v => {
    const camion = resolverCamion(v.patente, v.alias);
    if (v.camion_raw) {
      const r = camionesReporte.get(v.camion_raw) ?? { valor: v.camion_raw, patente: v.patente, alias: v.alias, camion, viajes: 0 };
      r.viajes++;
      camionesReporte.set(v.camion_raw, r);
    }
    const chofer = resolverChofer(v.chofer_raw);
    if (v.chofer_raw) {
      const k = sinAcentos(v.chofer_raw);
      const r = choferesReporte.get(k) ?? { nombre: v.chofer_raw, empleado: chofer, viajes: 0 };
      r.viajes++;
      choferesReporte.set(k, r);
    }

    const obs = [...v.observaciones];
    if (v.chofer_raw && !chofer) obs.push(`Chofer "${v.chofer_raw}" no encontrado en Empleados`);

    const existente = existentePorClave.get(v.clave) ?? null;
    const data: Prisma.BitacoraViajeUncheckedCreateInput = {
      origen:               OrigenBitacoraViaje.FLOTA,
      empresa_id:           empresaId,
      // Si alguien ya vinculó el camión/chofer a mano y la planilla sigue sin
      // poder resolverlo, no se pisa con null.
      empleado_id:          chofer?.id ?? existente?.empleado_id ?? null,
      camion_id:            camion?.id ?? existente?.camion_id ?? null,
      fecha:                v.fecha,
      dia_semana:           v.fecha ? calcularDiaSemana(v.fecha) : null,
      convocatoria:         v.convocatoria,
      recorrido:            v.tramo,
      cantidad_vueltas:     1,
      patente_camion:       v.patente ?? normalizarPatente(camion?.patente) ?? null,
      alias_camion:         v.alias,
      chofer_nombre:        v.chofer_raw,
      km_iniciales:         v.km_iniciales,
      km_finales:           v.km_finales,
      km_recorridos:        v.km_recorridos,
      monto_combustible:    v.monto_combustible,
      litros_cargados_ruta: v.litros_cargados_ruta,
      litros_consumidos:    v.litros_consumidos,
      km_por_litro:         v.km_por_litro,
      litros_iniciales_tanque: v.litros_iniciales_tanque,
      monto_caja_entregada: v.monto_caja_entregada,
      horario_salida:       v.horario_salida,
      horario_llegada:      v.horario_llegada,
      observaciones:        obs.length ? obs.join(' | ') : null,
      created_by:           userId,
    };
    return { viaje: v, data, existenteId: existente?.id ?? null };
  });

  const creados      = filas.filter(f => f.existenteId === null).length;
  const actualizados = filas.length - creados;

  if (!dryRun) {
    try {
      await prisma.$transaction(async tx => {
        for (const f of filas) {
          if (f.existenteId === null) {
            await tx.bitacoraViaje.create({ data: f.data });
          } else {
            const { created_by: _cb, origen: _o, empresa_id: _e, ...upd } = f.data;
            await tx.bitacoraViaje.update({ where: { id: f.existenteId }, data: upd });
          }
        }
        await registrarAuditoria({
          usuarioId: userId, empresaId, accion: 'CREATE', entidad: 'BitacoraViaje',
          descripcion: `Importó planilla de viajes de camiones (${req.file!.originalname}) — ${creados} creados, ${actualizados} actualizados`,
          ip: req.ip, tx: tx as any,
        });
      }, { timeout: 120_000, maxWait: 10_000 });
    } catch (err: any) {
      res.status(500).json({ error: 'Error al importar la planilla', detail: err.message }); return;
    }
  }

  const camionesLista = [...camionesReporte.values()];
  const choferesLista = [...choferesReporte.values()];
  const empleadoDTO = (e: EmpleadoRef) => ({ id: e.id, nombre: e.nombre, apellido: e.apellido, categoria: e.categoria });

  res.json({
    preview:               dryRun,
    bloques:               parseo.bloques,
    hojas_no_reconocidas:  parseo.hojas_no_reconocidas,
    filas_leidas:          parseo.viajes.length,
    viajes:                filas.length,
    creados,
    actualizados,
    // El mismo viaje en varias hojas (ej. LOGÍSTICA DIARIA + CAMION LUIS) se fusiona en uno
    fusionados: filas
      .filter(f => f.viaje.fuentes.length > 1)
      .map(f => ({ tramo: f.viaje.tramo, fecha: f.viaje.fecha, fuentes: f.viaje.fuentes })),
    sin_fecha: filas.filter(f => !f.viaje.fecha).length,
    camiones: {
      resueltos: camionesLista.filter(c => c.camion).map(c => ({
        valor: c.valor, viajes: c.viajes, camion: { id: c.camion!.id, codigo: c.camion!.codigo, patente: c.camion!.patente },
      })),
      no_encontrados: camionesLista.filter(c => !c.camion).map(c => ({
        valor: c.valor, patente: c.patente, alias: c.alias, viajes: c.viajes,
        motivo: c.patente ? `Patente ${c.patente} no está cargada en Flota` : 'Alias sin patente conocida',
      })),
    },
    choferes: {
      encontrados:    choferesLista.filter(c => c.empleado).map(c => ({ nombre: c.nombre, viajes: c.viajes, empleado: empleadoDTO(c.empleado!) })),
      no_encontrados: choferesLista.filter(c => !c.empleado).map(c => ({ nombre: c.nombre, viajes: c.viajes })),
    },
    saldos_iniciales: parseo.saldos_iniciales,
    ignoradas:    parseo.ignoradas,
    advertencias: parseo.advertencias,
    totales: {
      km:     filas.reduce((s, f) => s + (f.viaje.km_recorridos ?? 0), 0),
      litros: Math.round(filas.reduce((s, f) => s + (f.viaje.litros_cargados_ruta ?? 0), 0) * 100) / 100,
      litros_consumidos: Math.round(filas.reduce((s, f) => s + (f.viaje.litros_consumidos ?? 0), 0) * 100) / 100,
      combustible: Math.round(filas.reduce((s, f) => s + (f.viaje.monto_combustible ?? 0), 0) * 100) / 100,
      caja:   filas.reduce((s, f) => s + (f.viaje.monto_caja_entregada ?? 0), 0),
    },
  });
}

// ── Listado ───────────────────────────────────────────────────────────────────

// GET /api/flota/bitacora-viajes?evento=&camion=&chofer=&desde=&hasta=
//   camion: patente o alias (C1…) · chofer: id de empleado o nombre de la planilla
export async function listBitacoraFlota(req: Request, res: Response) {
  const { evento, camion, chofer, desde, hasta } = req.query as Record<string, string | undefined>;
  const where: Prisma.BitacoraViajeWhereInput = { ...withTenant(req.empresaId!), ...FLOTA, deleted_at: null };
  const and: Prisma.BitacoraViajeWhereInput[] = [];

  if (evento) where.convocatoria = evento;
  if (camion) and.push({ OR: [{ patente_camion: camion }, { patente_camion: null, alias_camion: camion }] });
  if (chofer) {
    if (/^\d+$/.test(chofer)) where.empleado_id = Number(chofer);
    else and.push({ empleado_id: null, chofer_nombre: { equals: chofer, mode: 'insensitive' } });
  }
  if (desde || hasta) {
    where.fecha = {
      ...(desde && { gte: parseFechaUTC(desde) }),
      ...(hasta && { lte: parseFechaUTC(hasta) }),
    };
  }
  if (and.length) where.AND = and;

  const viajes = await prisma.bitacoraViaje.findMany({
    where,
    include: {
      camion:   { select: { id: true, codigo: true, patente: true, descripcion: true } },
      empleado: { select: { id: true, nombre: true, apellido: true } },
    },
    orderBy: [{ fecha: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }],
  });
  res.json(viajes.map(mapViaje));
}

// GET /api/flota/bitacora-viajes/opciones — valores únicos para los filtros
export async function opcionesBitacoraFlota(req: Request, res: Response) {
  const viajes = await prisma.bitacoraViaje.findMany({
    where:  { ...withTenant(req.empresaId!), ...FLOTA, deleted_at: null },
    select: {
      convocatoria: true, patente_camion: true, alias_camion: true, chofer_nombre: true,
      camion:   { select: { descripcion: true } },
      empleado: { select: { id: true, nombre: true, apellido: true } },
    },
  });

  const eventos  = new Set<string>();
  const camiones = new Map<string, string>();
  const choferes = new Map<string, string>();
  for (const v of viajes) {
    if (v.convocatoria) eventos.add(v.convocatoria);
    if (v.patente_camion) camiones.set(v.patente_camion, v.camion?.descripcion ? `${v.patente_camion} — ${v.camion.descripcion}` : v.patente_camion);
    else if (v.alias_camion) camiones.set(v.alias_camion, `${v.alias_camion} (sin patente)`);
    if (v.empleado) choferes.set(String(v.empleado.id), `${v.empleado.nombre} ${v.empleado.apellido}`);
    else if (v.chofer_nombre) choferes.set(v.chofer_nombre.toUpperCase(), `${v.chofer_nombre.toUpperCase()} (no vinculado)`);
  }
  const ordenar = (m: Map<string, string>) =>
    [...m.entries()].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label, 'es'));

  res.json({
    eventos:  [...eventos].sort((a, b) => a.localeCompare(b, 'es')),
    camiones: ordenar(camiones),
    choferes: ordenar(choferes),
  });
}

// ── Alta / edición / baja manual (sólo ADMIN) ────────────────────────────────

const decimalOpt = z.number().nonnegative().nullable().optional();
const enteroOpt  = z.number().int().nonnegative().nullable().optional();

const viajeSchema = z.object({
  fecha:                z.string().min(1).nullable().optional(),
  convocatoria:         z.string().trim().nullable().optional(),
  recorrido:            z.string().trim().min(1, 'El tramo es obligatorio'),
  camion_id:            z.number().int().positive().nullable().optional(),
  patente_camion:       z.string().nullable().optional(),
  alias_camion:         z.string().trim().nullable().optional(),
  empleado_id:          z.number().int().positive().nullable().optional(),
  chofer_nombre:        z.string().trim().nullable().optional(),
  km_iniciales:         enteroOpt,
  km_finales:           enteroOpt,
  km_recorridos:        enteroOpt,
  litros_cargados_ruta: decimalOpt,
  litros_consumidos:    decimalOpt,
  km_por_litro:         decimalOpt,
  litros_iniciales_tanque: decimalOpt,
  monto_combustible:    decimalOpt,
  monto_caja_entregada: decimalOpt,
  horario_salida:       z.string().datetime({ offset: true }).nullable().optional(),
  horario_llegada:      z.string().datetime({ offset: true }).nullable().optional(),
  observaciones:        z.string().nullable().optional(),
});
type ViajePayload = z.infer<typeof viajeSchema>;

const VIAJE_INCLUDE = {
  camion:   { select: { id: true, codigo: true, patente: true, descripcion: true } },
  empleado: { select: { id: true, nombre: true, apellido: true } },
} as const;

const vacioANull = (s: string | null | undefined) => (s?.trim() ? s.trim() : null);

const CAMPOS_NUMERICOS = [
  'km_iniciales', 'km_finales', 'km_recorridos', 'litros_cargados_ruta', 'litros_consumidos',
  'km_por_litro', 'litros_iniciales_tanque', 'monto_combustible', 'monto_caja_entregada',
] as const;

// Valida camión/chofer contra la empresa y arma el data común de create/update.
// Sólo incluye los campos presentes en el payload (en update, lo ausente no se toca).
async function armarDataViaje(
  d: Partial<ViajePayload>, empresaId: number,
): Promise<{ data: Prisma.BitacoraViajeUncheckedUpdateInput } | { error: string }> {
  const data: Prisma.BitacoraViajeUncheckedUpdateInput = {};

  if (d.camion_id) {
    const camion = await prisma.camion.findFirst({ where: { id: d.camion_id, deleted_at: null, ...withTenant(empresaId) } });
    if (!camion) return { error: 'Camión no encontrado' };
    data.camion_id      = camion.id;
    data.patente_camion = normalizarPatente(camion.patente ?? camion.codigo);
  } else {
    if (d.camion_id === null) data.camion_id = null;
    if (d.patente_camion !== undefined) data.patente_camion = normalizarPatente(d.patente_camion);
  }

  if (d.empleado_id) {
    const empleado = await prisma.empleado.findFirst({ where: { id: d.empleado_id, deleted_at: null, ...withTenant(empresaId) } });
    if (!empleado) return { error: 'Chofer no encontrado' };
    data.empleado_id = empleado.id;
  } else if (d.empleado_id === null) {
    data.empleado_id = null;
  }

  if (d.fecha !== undefined) {
    const fecha = d.fecha ? parseFechaUTC(d.fecha) : null;
    data.fecha      = fecha;
    data.dia_semana = fecha ? calcularDiaSemana(fecha) : null;
  }
  if (d.convocatoria  !== undefined) data.convocatoria  = vacioANull(d.convocatoria);
  if (d.recorrido     !== undefined) data.recorrido     = d.recorrido.trim();
  if (d.alias_camion  !== undefined) data.alias_camion  = vacioANull(d.alias_camion)?.toUpperCase() ?? null;
  if (d.chofer_nombre !== undefined) data.chofer_nombre = vacioANull(d.chofer_nombre);
  if (d.observaciones !== undefined) data.observaciones = vacioANull(d.observaciones);
  for (const k of CAMPOS_NUMERICOS) {
    if (d[k] !== undefined) (data as Record<string, unknown>)[k] = d[k];
  }
  if (d.horario_salida  !== undefined) data.horario_salida  = d.horario_salida  ? new Date(d.horario_salida)  : null;
  if (d.horario_llegada !== undefined) data.horario_llegada = d.horario_llegada ? new Date(d.horario_llegada) : null;

  // km recorridos: si no vino explícito y están los dos odómetros, se calcula
  if (d.km_recorridos === undefined && d.km_iniciales != null && d.km_finales != null && d.km_finales >= d.km_iniciales) {
    data.km_recorridos = d.km_finales - d.km_iniciales;
  }
  return { data };
}

// POST /api/flota/bitacora-viajes
export async function createViajeFlota(req: Request, res: Response) {
  const parsed = viajeSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return; }
  const r = await armarDataViaje(parsed.data, req.empresaId!);
  if ('error' in r) { res.status(404).json({ error: r.error }); return; }

  const viaje = await prisma.bitacoraViaje.create({
    data: {
      ...(r.data as Prisma.BitacoraViajeUncheckedCreateInput),
      recorrido:  parsed.data.recorrido.trim(),
      origen:     OrigenBitacoraViaje.FLOTA,
      empresa_id: req.empresaId!,
      created_by: req.user!.id,
    },
    include: VIAJE_INCLUDE,
  });
  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'CREATE', entidad: 'BitacoraViaje', entidadId: viaje.id,
    descripcion: `Cargó a mano el viaje de camión ${viaje.recorrido}`, ip: req.ip, tx: prisma as any,
  });
  res.status(201).json(mapViaje(viaje));
}

// PUT /api/flota/bitacora-viajes/:id
export async function updateViajeFlota(req: Request, res: Response) {
  const id = Number(req.params.id);
  const parsed = viajeSchema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return; }
  const existing = await prisma.bitacoraViaje.findFirst({ where: { id, ...FLOTA, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!existing) { res.status(404).json({ error: 'Viaje no encontrado' }); return; }

  const r = await armarDataViaje(parsed.data, req.empresaId!);
  if ('error' in r) { res.status(404).json({ error: r.error }); return; }

  const viaje = await prisma.bitacoraViaje.update({ where: { id }, data: r.data, include: VIAJE_INCLUDE });
  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'UPDATE', entidad: 'BitacoraViaje', entidadId: id,
    descripcion: `Editó el viaje de camión #${id}`, datosDespues: parsed.data, ip: req.ip, tx: prisma as any,
  });
  res.json(mapViaje(viaje));
}

// DELETE /api/flota/bitacora-viajes/:id (soft delete)
export async function deleteViajeFlota(req: Request, res: Response) {
  const id = Number(req.params.id);
  const existing = await prisma.bitacoraViaje.findFirst({ where: { id, ...FLOTA, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!existing) { res.status(404).json({ error: 'Viaje no encontrado' }); return; }
  await prisma.bitacoraViaje.update({ where: { id }, data: { deleted_at: new Date() } });
  await registrarAuditoria({
    usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'DELETE', entidad: 'BitacoraViaje', entidadId: id,
    descripcion: `Eliminó el viaje de camión #${id} (${existing.recorrido ?? ''})`, ip: req.ip, tx: prisma as any,
  });
  res.json({ message: 'Viaje eliminado' });
}
