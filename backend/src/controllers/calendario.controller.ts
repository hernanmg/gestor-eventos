import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { fmtDate } from '../lib/excelExporter';

// ── Tipos ─────────────────────────────────────────────────────────────────────
// No hay tabla propia — el calendario solo agrega fechas de modelos existentes,
// así que TipoCalendario es un tipo puramente de respuesta (no un enum de Prisma).

export type TipoCalendario =
  | 'EVENTO' | 'FACTURA_VENCE' | 'ECHEQ_COBRO' | 'JORNADA'
  | 'PARTE_DIARIO' | 'STOCK_RETORNO' | 'LIQUIDACION';

type Urgencia = 'normal' | 'warning' | 'critical';

interface CalendarioItem {
  id:              string;
  tipo:            TipoCalendario;
  titulo:          string;
  fecha:           Date;
  fecha_fin?:      Date | null;
  empresa_id:      number;
  empresa_nombre:  string;
  color:           string;
  urgencia:        Urgencia;
  metadata:        Record<string, unknown>;
}

const COLORES: Record<TipoCalendario, string> = {
  EVENTO:          '#1E3A5F',
  FACTURA_VENCE:   '#DC2626',
  ECHEQ_COBRO:     '#F59E0B',
  JORNADA:         '#065F46',
  PARTE_DIARIO:    '#4C1D95',
  STOCK_RETORNO:   '#92400E',
  LIQUIDACION:     '#374151',
};

// Claves aceptadas por ?tipos= — plural/legible en la URL, mapeado al tipo interno.
const TIPO_QUERY_MAP: Record<string, TipoCalendario> = {
  eventos:       'EVENTO',
  facturas:      'FACTURA_VENCE',
  echeqs:        'ECHEQ_COBRO',
  jornadas:      'JORNADA',
  partes:        'PARTE_DIARIO',
  stock:         'STOCK_RETORNO',
  liquidaciones: 'LIQUIDACION',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// Fechas de negocio (calendario) en UTC — mismo criterio que el resto del
// sistema (ver fmtDate en excelExporter.ts): nunca usar componentes locales.
function parseFechaDesde(s: string): Date {
  return new Date(`${s}T00:00:00.000Z`);
}
function parseFechaHasta(s: string): Date {
  return new Date(`${s}T23:59:59.999Z`);
}

function computeUrgencia(fecha: Date, hoy: Date): Urgencia {
  const diffDias = Math.floor((fecha.getTime() - hoy.getTime()) / 86_400_000);
  if (diffDias <= 0) return 'critical';
  if (diffDias <= 7) return 'warning';
  return 'normal';
}

// Resuelve el alcance de empresa: admin global (Usuario.empresa_id === null)
// puede ver todas las empresas o filtrar por una puntual vía ?empresa_id;
// cualquier otro usuario queda fijo a su empresa activa de sesión, sin
// importar qué mande en el query — mismo criterio que resolveMacroWhere() en
// movimientos.controller.ts.
async function resolveEmpresaFiltro(
  req: Request, res: Response, queryEmpresaId: number | undefined,
): Promise<{ ok: true; empresaFiltro: number | undefined } | { ok: false }> {
  const usuario = await prisma.usuario.findFirst({
    where:  { id: req.user!.id, deleted_at: null },
    select: { empresa_id: true },
  });
  if (!usuario) { res.status(401).json({ error: 'Sesión inválida' }); return { ok: false }; }

  const esAdminGlobal = req.user!.rol === 'ADMIN' && usuario.empresa_id === null;
  if (esAdminGlobal) return { ok: true, empresaFiltro: queryEmpresaId };

  if (req.user!.empresaId == null) {
    res.status(401).json({ error: 'Sin empresa activa. Seleccioná una empresa.' });
    return { ok: false };
  }
  return { ok: true, empresaFiltro: req.user!.empresaId };
}

// ── Resolvers por tipo ────────────────────────────────────────────────────────

async function resolveEventos(empresaFiltro: number | undefined, desde: Date, hasta: Date): Promise<CalendarioItem[]> {
  const eventos = await prisma.evento.findMany({
    where: {
      deleted_at: null,
      ...(empresaFiltro !== undefined ? { empresa_id: empresaFiltro } : {}),
      OR: [
        { fecha_inicio: { gte: desde, lte: hasta } },
        { fecha_fin:    { gte: desde, lte: hasta } },
        { AND: [{ fecha_inicio: { lte: desde } }, { fecha_fin: { gte: hasta } }] },
      ],
    },
    include: { empresa: { select: { nombre: true } } },
  });

  return eventos.map(e => ({
    id:             `evento-${e.id}`,
    tipo:           'EVENTO' as const,
    titulo:         e.nombre,
    fecha:          e.fecha_inicio ?? e.fecha_fin!,
    fecha_fin:      e.fecha_fin,
    empresa_id:     e.empresa_id,
    empresa_nombre: e.empresa.nombre,
    color:          COLORES.EVENTO,
    urgencia:       'normal' as const,
    metadata:       { estado: e.estado },
  }));
}

async function resolveFacturas(empresaFiltro: number | undefined, desde: Date, hasta: Date, hoy: Date): Promise<CalendarioItem[]> {
  const facturas = await prisma.factura.findMany({
    where: {
      deleted_at: null,
      ...(empresaFiltro !== undefined ? { empresa_id: empresaFiltro } : {}),
      fecha_vencimiento: { gte: desde, lte: hasta },
      estado: { notIn: ['PAGADA', 'ANULADA'] },
    },
    include: {
      proveedor: { select: { nombre: true } },
      evento:    { select: { id: true, nombre: true } },
      empresa:   { select: { nombre: true } },
    },
  });

  return facturas.map(f => ({
    id:             `factura-${f.id}`,
    tipo:           'FACTURA_VENCE' as const,
    titulo:         `Vence factura ${f.numero_factura} — ${f.proveedor.nombre}`,
    fecha:          f.fecha_vencimiento!,
    empresa_id:     f.empresa_id,
    empresa_nombre: f.empresa.nombre,
    color:          COLORES.FACTURA_VENCE,
    urgencia:       computeUrgencia(f.fecha_vencimiento!, hoy),
    metadata:       { importe_pendiente: Number(f.importe_pendiente), evento_id: f.evento_id, evento_nombre: f.evento?.nombre ?? null },
  }));
}

async function resolveEcheqs(empresaFiltro: number | undefined, desde: Date, hasta: Date, hoy: Date): Promise<CalendarioItem[]> {
  const echeqs = await prisma.echeq.findMany({
    where: {
      deleted_at: null,
      fecha_cobro_estimada: { gte: desde, lte: hasta },
      estado: 'PENDIENTE',
      evento: { deleted_at: null, ...(empresaFiltro !== undefined ? { empresa_id: empresaFiltro } : {}) },
    },
    include: {
      proveedor: { select: { nombre: true } },
      evento:    { select: { id: true, empresa_id: true, empresa: { select: { nombre: true } } } },
    },
  });

  return echeqs.map(e => ({
    id:             `echeq-${e.id}`,
    tipo:           'ECHEQ_COBRO' as const,
    titulo:         `Echeq #${e.numero} — ${e.razon_social ?? e.proveedor?.nombre ?? 'Sin proveedor'}`,
    fecha:          e.fecha_cobro_estimada!,
    empresa_id:     e.evento.empresa_id,
    empresa_nombre: e.evento.empresa.nombre,
    color:          COLORES.ECHEQ_COBRO,
    urgencia:       computeUrgencia(e.fecha_cobro_estimada!, hoy),
    metadata:       { importe: Number(e.importe), moneda: e.moneda, evento_id: e.evento_id },
  }));
}

async function resolveJornadas(empresaFiltro: number | undefined, desde: Date, hasta: Date): Promise<CalendarioItem[]> {
  const jornadas = await prisma.jornada.findMany({
    where: {
      deleted_at: null,
      fecha: { gte: desde, lte: hasta },
      estado: 'PENDIENTE',
      ...(empresaFiltro !== undefined ? { empresa_id: empresaFiltro } : {}),
    },
    include: { empleado: { select: { nombre: true, apellido: true } }, empresa: { select: { nombre: true } } },
  });

  // Agrupar por (fecha, empresa) — un solo chip por día en vez de N jornadas sueltas.
  const grupos = new Map<string, { fecha: Date; empresa_id: number; empresa_nombre: string; jornadas: typeof jornadas }>();
  for (const j of jornadas) {
    const key = `${j.fecha.toISOString().slice(0, 10)}|${j.empresa_id}`;
    const grupo = grupos.get(key) ?? { fecha: j.fecha, empresa_id: j.empresa_id, empresa_nombre: j.empresa.nombre, jornadas: [] };
    grupo.jornadas.push(j);
    grupos.set(key, grupo);
  }

  return [...grupos.values()].map(g => {
    if (g.jornadas.length === 1) {
      const j = g.jornadas[0];
      return {
        id:             `jornada-${j.id}`,
        tipo:           'JORNADA' as const,
        titulo:         `${j.empleado.apellido}, ${j.empleado.nombre} — pendiente de aprobación`,
        fecha:          g.fecha,
        empresa_id:     g.empresa_id,
        empresa_nombre: g.empresa_nombre,
        color:          COLORES.JORNADA,
        urgencia:       'normal' as const,
        metadata:       { evento_id: j.evento_id, convocatoria: j.convocatoria },
      };
    }
    return {
      id:             `jornada-${g.fecha.toISOString().slice(0, 10)}-${g.empresa_id}`,
      tipo:           'JORNADA' as const,
      titulo:         `${g.jornadas.length} jornadas pendientes de aprobación`,
      fecha:          g.fecha,
      empresa_id:     g.empresa_id,
      empresa_nombre: g.empresa_nombre,
      color:          COLORES.JORNADA,
      urgencia:       'normal' as const,
      metadata:       { cantidad: g.jornadas.length, jornada_ids: g.jornadas.map(j => j.id) },
    };
  });
}

async function resolvePartesDiario(empresaFiltro: number | undefined, desde: Date, hasta: Date): Promise<CalendarioItem[]> {
  const partes = await prisma.parteDiario.findMany({
    where: {
      deleted_at: null,
      fecha: { gte: desde, lte: hasta },
      cerrado: false,
      ...(empresaFiltro !== undefined ? { empresa_id: empresaFiltro } : {}),
    },
    include: { empresa: { select: { nombre: true } } },
  });

  return partes.map(p => ({
    id:             `parte-${p.id}`,
    tipo:           'PARTE_DIARIO' as const,
    titulo:         `Parte diario — ${fmtDate(p.fecha)}`,
    fecha:          p.fecha,
    empresa_id:     p.empresa_id,
    empresa_nombre: p.empresa.nombre,
    color:          COLORES.PARTE_DIARIO,
    urgencia:       'normal' as const,
    metadata:       { cerrado: p.cerrado },
  }));
}

async function resolveStockRetornos(empresaFiltro: number | undefined, desde: Date, hasta: Date): Promise<CalendarioItem[]> {
  const asignaciones = await prisma.asignacionStock.findMany({
    where: {
      deleted_at: null,
      fecha_retorno: { gte: desde, lte: hasta },
      estado: 'ACTIVA',
      evento: { deleted_at: null, ...(empresaFiltro !== undefined ? { empresa_id: empresaFiltro } : {}) },
    },
    include: {
      producto: { select: { nombre: true } },
      evento:   { select: { nombre: true, empresa_id: true, empresa: { select: { nombre: true } } } },
    },
  });

  return asignaciones.map(a => ({
    id:             `stock-${a.id}`,
    tipo:           'STOCK_RETORNO' as const,
    titulo:         `${a.producto.nombre} × ${a.cantidad} — retorno esperado`,
    fecha:          a.fecha_retorno!,
    empresa_id:     a.evento.empresa_id,
    empresa_nombre: a.evento.empresa.nombre,
    color:          COLORES.STOCK_RETORNO,
    urgencia:       'normal' as const,
    metadata:       { evento_id: a.evento_id, evento_nombre: a.evento.nombre, ubicacion: a.ubicacion },
  }));
}

async function resolveLiquidaciones(empresaFiltro: number | undefined, desde: Date, hasta: Date): Promise<CalendarioItem[]> {
  // Liquidacion no tiene soft-delete (sin columna deleted_at).
  const liquidaciones = await prisma.liquidacion.findMany({
    where: {
      fecha_hasta: { gte: desde, lte: hasta },
      estado: 'BORRADOR',
      ...(empresaFiltro !== undefined ? { empresa_id: empresaFiltro } : {}),
    },
    include: { empleado: { select: { nombre: true, apellido: true } }, empresa: { select: { nombre: true } } },
  });

  return liquidaciones.map(l => ({
    id:             `liquidacion-${l.id}`,
    tipo:           'LIQUIDACION' as const,
    titulo:         `Liquidación pendiente — ${l.empleado.apellido}, ${l.empleado.nombre}`,
    fecha:          l.fecha_hasta,
    empresa_id:     l.empresa_id,
    empresa_nombre: l.empresa.nombre,
    color:          COLORES.LIQUIDACION,
    urgencia:       'normal' as const,
    metadata:       { total_a_cobrar: Number(l.total_a_cobrar), evento_id: l.evento_id },
  }));
}

// ── Endpoint principal ────────────────────────────────────────────────────────

const calendarioQuerySchema = z.object({
  desde:      z.string().regex(FECHA_REGEX, "Formato de fecha inválido, usar YYYY-MM-DD"),
  hasta:      z.string().regex(FECHA_REGEX, "Formato de fecha inválido, usar YYYY-MM-DD"),
  empresa_id: z.coerce.number().int().positive().optional(),
  tipos:      z.string().optional(),
});

export async function getCalendario(req: Request, res: Response) {
  const parsed = calendarioQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'Parámetros inválidos', detail: parsed.error.flatten().fieldErrors }); return;
  }
  const q = parsed.data;

  const desde = parseFechaDesde(q.desde);
  const hasta = parseFechaHasta(q.hasta);
  if (isNaN(desde.getTime()) || isNaN(hasta.getTime())) {
    res.status(400).json({ error: 'Fechas inválidas' }); return;
  }
  if (hasta < desde) {
    res.status(400).json({ error: "'hasta' debe ser posterior o igual a 'desde'" }); return;
  }
  const maxHasta = new Date(desde);
  maxHasta.setUTCMonth(maxHasta.getUTCMonth() + 3);
  if (hasta > maxHasta) {
    res.status(400).json({ error: 'El rango máximo es de 3 meses' }); return;
  }

  let tiposActivos: Set<TipoCalendario>;
  if (q.tipos) {
    tiposActivos = new Set();
    for (const raw of q.tipos.split(',').map(s => s.trim()).filter(Boolean)) {
      const tipo = TIPO_QUERY_MAP[raw];
      if (!tipo) { res.status(400).json({ error: `Tipo inválido: ${raw}` }); return; }
      tiposActivos.add(tipo);
    }
  } else {
    tiposActivos = new Set(Object.values(TIPO_QUERY_MAP));
  }

  const resolved = await resolveEmpresaFiltro(req, res, q.empresa_id);
  if (!resolved.ok) return;
  const { empresaFiltro } = resolved;

  const hoy = new Date();
  const hoyUTC = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate()));

  const tareas: Promise<CalendarioItem[]>[] = [];
  if (tiposActivos.has('EVENTO'))        tareas.push(resolveEventos(empresaFiltro, desde, hasta));
  if (tiposActivos.has('FACTURA_VENCE')) tareas.push(resolveFacturas(empresaFiltro, desde, hasta, hoyUTC));
  if (tiposActivos.has('ECHEQ_COBRO'))   tareas.push(resolveEcheqs(empresaFiltro, desde, hasta, hoyUTC));
  if (tiposActivos.has('JORNADA'))       tareas.push(resolveJornadas(empresaFiltro, desde, hasta));
  if (tiposActivos.has('PARTE_DIARIO'))  tareas.push(resolvePartesDiario(empresaFiltro, desde, hasta));
  if (tiposActivos.has('STOCK_RETORNO')) tareas.push(resolveStockRetornos(empresaFiltro, desde, hasta));
  if (tiposActivos.has('LIQUIDACION'))   tareas.push(resolveLiquidaciones(empresaFiltro, desde, hasta));

  const resultados = await Promise.all(tareas);
  const items = resultados.flat().sort((a, b) => a.fecha.getTime() - b.fecha.getTime());

  const totales_por_tipo: Record<string, number> = {};
  for (const item of items) totales_por_tipo[item.tipo] = (totales_por_tipo[item.tipo] ?? 0) + 1;

  res.json({ items, totales_por_tipo });
}
