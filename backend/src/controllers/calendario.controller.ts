import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { fmtDate } from '../lib/excelExporter';

// ── Tipos ─────────────────────────────────────────────────────────────────────
// No hay tabla propia — el calendario solo agrega fechas de modelos existentes,
// así que TipoCalendario es un tipo puramente de respuesta (no un enum de Prisma).

export type TipoCalendario =
  | 'EVENTO' | 'FACTURA_VENCE' | 'ECHEQ_COBRO' | 'JORNADA'
  | 'PARTE_DIARIO' | 'STOCK_RETORNO' | 'LIQUIDACION'
  | 'RENDICION_PENDIENTE' | 'SALDO_MINIMO' | 'CTA_CORRIENTE_INACTIVA'
  | 'SEGURO_VENCE' | 'PATENTE_VENCE' | 'TALLER_RETIRO'
  | 'CUOTA_AFIP' | 'CUOTA_PRESTAMO' | 'FACTURA_EMITIDA_VENCE' | 'GASTO_ESPACIO_VENCE';

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
  EVENTO:               '#1E3A5F',
  FACTURA_VENCE:        '#DC2626',
  ECHEQ_COBRO:          '#F59E0B',
  JORNADA:              '#065F46',
  PARTE_DIARIO:         '#4C1D95',
  STOCK_RETORNO:        '#92400E',
  LIQUIDACION:          '#374151',
  RENDICION_PENDIENTE:  '#7C3AED',
  SALDO_MINIMO:         '#DC2626',
  CTA_CORRIENTE_INACTIVA: '#F59E0B',
  SEGURO_VENCE:         '#F59E0B',
  PATENTE_VENCE:        '#F59E0B',
  TALLER_RETIRO:        '#4C1D95',
  CUOTA_AFIP:           '#DC2626',
  CUOTA_PRESTAMO:       '#92400E',
  FACTURA_EMITIDA_VENCE: '#065F46',
  GASTO_ESPACIO_VENCE:  '#3730A3',
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
  rendiciones:   'RENDICION_PENDIENTE',
  saldos_bajos:  'SALDO_MINIMO',
  cuentas_corrientes: 'CTA_CORRIENTE_INACTIVA',
  seguros:       'SEGURO_VENCE',
  patentes_flota: 'PATENTE_VENCE',
  taller:        'TALLER_RETIRO',
  cuotas_afip:   'CUOTA_AFIP',
  cuotas_prestamo: 'CUOTA_PRESTAMO',
  facturas_emitidas: 'FACTURA_EMITIDA_VENCE',
  gastos_espacios: 'GASTO_ESPACIO_VENCE',
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

// Cuentas pendientes de rendición y cuentas con saldo por debajo del mínimo no
// tienen una fecha de negocio propia (no son un vencimiento puntual) — se
// anclan al día de hoy, así aparecen mientras la condición siga vigente en
// vez de fijarse a una fecha pasada que se pierde al navegar el calendario.
// Por eso sólo se resuelven si "hoy" cae dentro del rango [desde, hasta]
// pedido — fuera de ese rango no hay ninguna fecha en la que deban aparecer.

async function resolveRendicionesPendientes(empresaFiltro: number | undefined, desde: Date, hasta: Date, hoy: Date): Promise<CalendarioItem[]> {
  if (hoy < desde || hoy > hasta) return [];

  const cuentas = await prisma.cuentaBancaria.findMany({
    where: {
      deleted_at: null,
      estado: 'PENDIENTE_RENDICION',
      ...(empresaFiltro !== undefined ? { empresa_id: empresaFiltro } : {}),
    },
    include: {
      empresa:     { select: { nombre: true } },
      responsable: { select: { nombre: true } },
    },
  });

  return cuentas.map(c => {
    // updated_at queda fijo en el momento del PATCH /estado que marcó
    // PENDIENTE_RENDICION (ninguna otra escritura toca la cuenta mientras
    // está en este estado), así que sirve como "desde cuándo está pendiente".
    const diasTranscurridos = Math.floor((hoy.getTime() - c.updated_at.getTime()) / 86_400_000);
    const urgencia: Urgencia = diasTranscurridos > 7 ? 'critical' : diasTranscurridos > 3 ? 'warning' : 'normal';
    return {
      id:             `rendicion-${c.id}`,
      tipo:           'RENDICION_PENDIENTE' as const,
      titulo:         `Rendición pendiente — ${c.nombre}`,
      fecha:          hoy,
      empresa_id:     c.empresa_id,
      empresa_nombre: c.empresa.nombre,
      color:          COLORES.RENDICION_PENDIENTE,
      urgencia,
      metadata:       { cuenta_id: c.id, responsable: c.responsable?.nombre ?? null, dias_transcurridos: diasTranscurridos },
    };
  });
}

async function resolveSaldosMinimos(empresaFiltro: number | undefined, desde: Date, hasta: Date, hoy: Date): Promise<CalendarioItem[]> {
  if (hoy < desde || hoy > hasta) return [];

  const cuentas = await prisma.cuentaBancaria.findMany({
    where: {
      deleted_at:   null,
      saldo_minimo: { not: null },
      ...(empresaFiltro !== undefined ? { empresa_id: empresaFiltro } : {}),
    },
    include: {
      empresa: { select: { nombre: true } },
      movimientos: {
        where:   { deleted_at: null },
        orderBy: { orden: 'asc' },
        select:  { saldo_corriente: true },
      },
    },
  });

  const items: CalendarioItem[] = [];
  for (const c of cuentas) {
    const movs        = c.movimientos;
    const last         = movs[movs.length - 1];
    const saldoActual  = last ? Number(last.saldo_corriente) : Number(c.saldo_inicial);
    const saldoMinimo  = Number(c.saldo_minimo);
    if (saldoActual >= saldoMinimo) continue;

    items.push({
      id:             `saldo-minimo-${c.id}`,
      tipo:           'SALDO_MINIMO' as const,
      titulo:         `Saldo bajo en ${c.nombre}`,
      fecha:          hoy,
      empresa_id:     c.empresa_id,
      empresa_nombre: c.empresa.nombre,
      color:          COLORES.SALDO_MINIMO,
      urgencia:       'critical' as const,
      metadata:       { cuenta_id: c.id, saldo_actual: saldoActual, saldo_minimo: saldoMinimo, diferencia: parseFloat((saldoMinimo - saldoActual).toFixed(2)) },
    });
  }
  return items;
}

// Cuentas corrientes con saldo negativo (a favor del tercero) y sin
// movimientos hace más de 30 días — mismo criterio de anclaje a "hoy" que
// resolveRendicionesPendientes/resolveSaldosMinimos: no es un vencimiento de
// negocio puntual, sino una condición vigente.
async function resolveCuentasCorrientesInactivas(empresaFiltro: number | undefined, desde: Date, hasta: Date, hoy: Date): Promise<CalendarioItem[]> {
  if (hoy < desde || hoy > hasta) return [];

  const cuentas = await prisma.cuentaCorriente.findMany({
    where: {
      deleted_at: null,
      activa:     true,
      saldo_actual: { lt: 0 },
      ...(empresaFiltro !== undefined ? { empresa_id: empresaFiltro } : {}),
    },
    include: {
      empresa: { select: { nombre: true } },
      movimientos: {
        where:   { deleted_at: null },
        orderBy: { fecha: 'desc' },
        take:    1,
        select:  { fecha: true },
      },
    },
  });

  const items: CalendarioItem[] = [];
  for (const c of cuentas) {
    const ultimoMovimiento = c.movimientos[0]?.fecha;
    if (!ultimoMovimiento) continue;
    const diasSinActividad = Math.floor((hoy.getTime() - ultimoMovimiento.getTime()) / 86_400_000);
    if (diasSinActividad <= 30) continue;

    items.push({
      id:             `cta-corriente-${c.id}`,
      tipo:           'CTA_CORRIENTE_INACTIVA' as const,
      titulo:         `Sin actividad: ${c.nombre}`,
      fecha:          hoy,
      empresa_id:     c.empresa_id,
      empresa_nombre: c.empresa.nombre,
      color:          COLORES.CTA_CORRIENTE_INACTIVA,
      urgencia:       'warning' as const,
      metadata:       { cuenta_id: c.id, saldo_actual: Number(c.saldo_actual), moneda: c.moneda, dias_sin_actividad: diasSinActividad },
    });
  }
  return items;
}

// Seguros y patentes de Flota — vencimientos dentro del rango pedido, mismo
// criterio de color/urgencia que el módulo Flota (ver flota.controller.ts
// updateEstadoSeguros/computeEstadoSeguro): vencido = crítico/rojo, por vencer
// (<=30 días) = warning/amarillo.
async function resolveSegurosVence(empresaFiltro: number | undefined, desde: Date, hasta: Date, hoy: Date): Promise<CalendarioItem[]> {
  const seguros = await prisma.seguroVehiculo.findMany({
    where: {
      deleted_at: null,
      estado: { not: 'CANCELADO' },
      fecha_vencimiento: { gte: desde, lte: hasta },
      ...(empresaFiltro !== undefined ? { empresa_id: empresaFiltro } : {}),
    },
    include: { camion: { select: { codigo: true } }, empresa: { select: { nombre: true } } },
  });

  return seguros.map(s => {
    const vencido = s.fecha_vencimiento < hoy;
    return {
      id:             `seguro-${s.id}`,
      tipo:           'SEGURO_VENCE' as const,
      titulo:         `Seguro de ${s.camion.codigo} — ${s.aseguradora}`,
      fecha:          s.fecha_vencimiento,
      empresa_id:     s.empresa_id,
      empresa_nombre: s.empresa.nombre,
      color:          vencido ? '#DC2626' : '#F59E0B',
      urgencia:       vencido ? 'critical' as const : computeUrgencia(s.fecha_vencimiento, hoy),
      metadata:       { camion_id: s.camion_id, estado: s.estado },
    };
  });
}

async function resolvePatentesVence(empresaFiltro: number | undefined, desde: Date, hasta: Date, hoy: Date): Promise<CalendarioItem[]> {
  const patentes = await prisma.patenteVehiculo.findMany({
    where: {
      deleted_at: null,
      estado: 'PENDIENTE',
      fecha_vencimiento: { gte: desde, lte: hasta },
      ...(empresaFiltro !== undefined ? { empresa_id: empresaFiltro } : {}),
    },
    include: { camion: { select: { codigo: true } }, empresa: { select: { nombre: true } } },
  });

  return patentes.map(p => ({
    id:             `patente-${p.id}`,
    tipo:           'PATENTE_VENCE' as const,
    titulo:         `Patente ${p.tipo} ${p.anio} — ${p.camion.codigo}`,
    fecha:          p.fecha_vencimiento,
    empresa_id:     p.empresa_id,
    empresa_nombre: p.empresa.nombre,
    color:          '#F59E0B',
    urgencia:       computeUrgencia(p.fecha_vencimiento, hoy),
    metadata:       { camion_id: p.camion_id },
  }));
}

// Servicios de taller EN_PROCESO con retiro estimado dentro del rango pedido —
// mismo criterio de urgencia que FIX 5 del módulo Flota: atrasado (fecha_estimada
// < hoy) es crítico, dentro de los próximos 3 días es warning, el resto normal.
async function resolveTallerRetiro(empresaFiltro: number | undefined, desde: Date, hasta: Date, hoy: Date): Promise<CalendarioItem[]> {
  const servicios = await prisma.servicioTaller.findMany({
    where: {
      deleted_at: null,
      estado: 'EN_PROCESO',
      fecha_estimada: { not: null, gte: desde, lte: hasta },
      ...(empresaFiltro !== undefined ? { empresa_id: empresaFiltro } : {}),
    },
    include: { camion: { select: { codigo: true } }, empresa: { select: { nombre: true } } },
  });

  const en3Dias = new Date(hoy.getTime() + 3 * 86_400_000);

  return servicios.map(s => {
    const atrasado = s.fecha_estimada! < hoy;
    return {
      id:             `taller-${s.id}`,
      tipo:           'TALLER_RETIRO' as const,
      titulo:         `${s.camion.codigo} — ${s.descripcion} (retiro estimado)`,
      fecha:          s.fecha_estimada!,
      empresa_id:     s.empresa_id,
      empresa_nombre: s.empresa.nombre,
      color:          COLORES.TALLER_RETIRO,
      urgencia:       atrasado ? 'critical' as const : s.fecha_estimada! <= en3Dias ? 'warning' as const : 'normal' as const,
      metadata:       { camion_id: s.camion_id, servicio_id: s.id, taller_nombre: s.taller_nombre, estado: s.estado },
    };
  });
}

async function resolveCuotasAFIP(empresaFiltro: number | undefined, desde: Date, hasta: Date, hoy: Date): Promise<CalendarioItem[]> {
  const cuotas = await prisma.cuotaPlanAFIP.findMany({
    where: {
      pagada:       false,
      fecha_debito: { gte: desde, lte: hasta },
      plan: { deleted_at: null, ...(empresaFiltro !== undefined ? { empresa_id: empresaFiltro } : {}) },
    },
    include: { plan: { select: { descripcion: true, cantidad_cuotas: true, empresa_id: true, empresa: { select: { nombre: true } } } } },
  });

  return cuotas.map(c => ({
    id:             `cuota-afip-${c.id}`,
    tipo:           'CUOTA_AFIP' as const,
    titulo:         `AFIP — ${c.plan.descripcion} (cuota ${c.numero_cuota}/${c.plan.cantidad_cuotas})`,
    fecha:          c.fecha_debito,
    empresa_id:     c.plan.empresa_id,
    empresa_nombre: c.plan.empresa.nombre,
    color:          COLORES.CUOTA_AFIP,
    urgencia:       computeUrgencia(c.fecha_debito, hoy),
    metadata:       { plan_id: c.plan_id, total_cuota: Number(c.total_cuota) },
  }));
}

async function resolveCuotasPrestamo(empresaFiltro: number | undefined, desde: Date, hasta: Date, hoy: Date): Promise<CalendarioItem[]> {
  const cuotas = await prisma.cuotaPrestamo.findMany({
    where: {
      pagada:            false,
      fecha_vencimiento: { gte: desde, lte: hasta },
      prestamo: { deleted_at: null, ...(empresaFiltro !== undefined ? { empresa_id: empresaFiltro } : {}) },
    },
    include: { prestamo: { select: { entidad: true, cantidad_cuotas: true, empresa_id: true, empresa: { select: { nombre: true } } } } },
  });

  return cuotas.map(c => ({
    id:             `cuota-prestamo-${c.id}`,
    tipo:           'CUOTA_PRESTAMO' as const,
    titulo:         `${c.prestamo.entidad} — cuota ${c.numero_cuota}/${c.prestamo.cantidad_cuotas} ($${Number(c.total_cuota).toLocaleString('es-AR')})`,
    fecha:          c.fecha_vencimiento,
    empresa_id:     c.prestamo.empresa_id,
    empresa_nombre: c.prestamo.empresa.nombre,
    color:          COLORES.CUOTA_PRESTAMO,
    urgencia:       computeUrgencia(c.fecha_vencimiento, hoy),
    metadata:       { prestamo_id: c.prestamo_id, total_cuota: Number(c.total_cuota) },
  }));
}

async function resolveFacturasEmitidas(empresaFiltro: number | undefined, desde: Date, hasta: Date, hoy: Date): Promise<CalendarioItem[]> {
  const facturas = await prisma.facturaEmitida.findMany({
    where: {
      deleted_at: null,
      ...(empresaFiltro !== undefined ? { empresa_id: empresaFiltro } : {}),
      fecha_vencimiento: { gte: desde, lte: hasta },
      estado: { in: ['EMITIDA', 'COBRADA_PARCIAL'] },
    },
    include: {
      cobros:  { select: { monto: true } },
      empresa: { select: { nombre: true } },
    },
  });

  return facturas.map(f => {
    const cobrado         = f.cobros.reduce((s, c) => s + Number(c.monto), 0);
    const saldoPendiente  = Math.max(0, Number(f.total) - cobrado);
    return {
      id:             `factura-emitida-${f.id}`,
      tipo:           'FACTURA_EMITIDA_VENCE' as const,
      titulo:         `${f.cliente_nombre} — ${f.tipo_comprobante} $${saldoPendiente.toLocaleString('es-AR')}`,
      fecha:          f.fecha_vencimiento!,
      empresa_id:     f.empresa_id,
      empresa_nombre: f.empresa.nombre,
      color:          COLORES.FACTURA_EMITIDA_VENCE,
      urgencia:       computeUrgencia(f.fecha_vencimiento!, hoy),
      metadata:       { factura_id: f.id, saldo_pendiente: saldoPendiente, moneda: f.moneda, evento_id: f.evento_id },
    };
  });
}

async function resolveGastosEspacio(empresaFiltro: number | undefined, desde: Date, hasta: Date, hoy: Date): Promise<CalendarioItem[]> {
  const lineas = await prisma.lineaGastoEspacio.findMany({
    where: {
      deleted_at: null,
      estado: 'PENDIENTE',
      fecha_vencimiento: { not: null, gte: desde, lte: hasta },
      gasto_mes: { espacio: { deleted_at: null, ...(empresaFiltro !== undefined ? { empresa_id: empresaFiltro } : {}) } },
    },
    include: { gasto_mes: { include: { espacio: { include: { empresa: { select: { nombre: true } } } } } } },
  });

  return lineas.map(l => ({
    id:             `gasto-espacio-${l.id}`,
    tipo:           'GASTO_ESPACIO_VENCE' as const,
    titulo:         `${l.gasto_mes.espacio.nombre} — ${l.nombre}`,
    fecha:          l.fecha_vencimiento!,
    empresa_id:     l.gasto_mes.espacio.empresa_id,
    empresa_nombre: l.gasto_mes.espacio.empresa.nombre,
    color:          COLORES.GASTO_ESPACIO_VENCE,
    urgencia:       computeUrgencia(l.fecha_vencimiento!, hoy),
    metadata:       { espacio_id: l.gasto_mes.espacio_id, linea_id: l.id, monto: Number(l.monto_real) },
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

  // JORNADA y LIQUIDACION enlazan a /rrhh, exclusivo de ADMIN (matriz de
  // permisos) — no tiene sentido mostrárselos a OPERADOR/VIEWER: verían un
  // item "accionable" que al hacer click los rebota (RRHHPage → /dashboard →
  // /eventos) sin explicación. Se filtran acá, en el origen.
  const isAdmin = req.user!.rol === 'ADMIN';

  const tareas: Promise<CalendarioItem[]>[] = [];
  if (tiposActivos.has('EVENTO'))        tareas.push(resolveEventos(empresaFiltro, desde, hasta));
  if (tiposActivos.has('FACTURA_VENCE')) tareas.push(resolveFacturas(empresaFiltro, desde, hasta, hoyUTC));
  if (tiposActivos.has('ECHEQ_COBRO'))   tareas.push(resolveEcheqs(empresaFiltro, desde, hasta, hoyUTC));
  if (tiposActivos.has('JORNADA') && isAdmin)       tareas.push(resolveJornadas(empresaFiltro, desde, hasta));
  if (tiposActivos.has('PARTE_DIARIO'))  tareas.push(resolvePartesDiario(empresaFiltro, desde, hasta));
  if (tiposActivos.has('STOCK_RETORNO')) tareas.push(resolveStockRetornos(empresaFiltro, desde, hasta));
  if (tiposActivos.has('LIQUIDACION') && isAdmin)   tareas.push(resolveLiquidaciones(empresaFiltro, desde, hasta));
  if (tiposActivos.has('RENDICION_PENDIENTE') && isAdmin) tareas.push(resolveRendicionesPendientes(empresaFiltro, desde, hasta, hoyUTC));
  if (tiposActivos.has('SALDO_MINIMO') && isAdmin)         tareas.push(resolveSaldosMinimos(empresaFiltro, desde, hasta, hoyUTC));
  if (tiposActivos.has('CTA_CORRIENTE_INACTIVA') && isAdmin) tareas.push(resolveCuentasCorrientesInactivas(empresaFiltro, desde, hasta, hoyUTC));
  if (tiposActivos.has('SEGURO_VENCE'))  tareas.push(resolveSegurosVence(empresaFiltro, desde, hasta, hoyUTC));
  if (tiposActivos.has('PATENTE_VENCE')) tareas.push(resolvePatentesVence(empresaFiltro, desde, hasta, hoyUTC));
  if (tiposActivos.has('TALLER_RETIRO')) tareas.push(resolveTallerRetiro(empresaFiltro, desde, hasta, hoyUTC));
  // CUOTA_AFIP/CUOTA_PRESTAMO enlazan a /afip-prestamos, exclusivo de ADMIN
  // (matriz de permisos) — mismo criterio que JORNADA/LIQUIDACION más arriba.
  if (tiposActivos.has('CUOTA_AFIP') && isAdmin)     tareas.push(resolveCuotasAFIP(empresaFiltro, desde, hasta, hoyUTC));
  if (tiposActivos.has('CUOTA_PRESTAMO') && isAdmin) tareas.push(resolveCuotasPrestamo(empresaFiltro, desde, hasta, hoyUTC));
  // FACTURA_EMITIDA_VENCE enlaza a /facturas-emitidas, exclusivo de ADMIN.
  if (tiposActivos.has('FACTURA_EMITIDA_VENCE') && isAdmin) tareas.push(resolveFacturasEmitidas(empresaFiltro, desde, hasta, hoyUTC));
  // GASTO_ESPACIO_VENCE enlaza a /espacios-compartidos, exclusivo de ADMIN.
  if (tiposActivos.has('GASTO_ESPACIO_VENCE') && isAdmin) tareas.push(resolveGastosEspacio(empresaFiltro, desde, hasta, hoyUTC));

  const resultados = await Promise.all(tareas);
  const items = resultados.flat().sort((a, b) => a.fecha.getTime() - b.fecha.getTime());

  const totales_por_tipo: Record<string, number> = {};
  for (const item of items) totales_por_tipo[item.tipo] = (totales_por_tipo[item.tipo] ?? 0) + 1;

  res.json({ items, totales_por_tipo });
}
