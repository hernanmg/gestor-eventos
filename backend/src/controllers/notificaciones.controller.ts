import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { updateEstadoSeguros } from './flota.controller';

// ── Tipos ─────────────────────────────────────────────────────────────────────

type Urgencia = 'critical' | 'warning' | 'info';

interface NotificacionItem {
  id:          string;
  tipo:        string;
  titulo:      string;
  descripcion: string;
  urgencia:    Urgencia;
  link:        string;
  fecha:       Date;
}

const MS_DIA = 86_400_000;
const URGENCIA_RANK: Record<Urgencia, number> = { critical: 0, warning: 1, info: 2 };

// ── Resolvers ─────────────────────────────────────────────────────────────────

async function resolveSeguros(empresaId: number): Promise<NotificacionItem[]> {
  await updateEstadoSeguros(empresaId);
  const seguros = await prisma.seguroVehiculo.findMany({
    where: { deleted_at: null, empresa_id: empresaId, estado: { in: ['VENCIDO', 'POR_VENCER'] } },
    include: { camion: { select: { codigo: true } } },
    orderBy: { fecha_vencimiento: 'asc' },
  });
  return seguros.map(s => ({
    id:          `seguro-${s.id}`,
    tipo:        'SEGURO_VENCE',
    titulo:      `Seguro de ${s.camion.codigo}`,
    descripcion: `${s.aseguradora} — ${s.estado === 'VENCIDO' ? 'vencido' : 'por vencer'} el ${s.fecha_vencimiento.toLocaleDateString('es-AR')}`,
    urgencia:    s.estado === 'VENCIDO' ? 'critical' : 'warning',
    link:        '/flota?tab=seguros',
    fecha:       s.fecha_vencimiento,
  }));
}

async function resolvePatentesVencidas(empresaId: number, hoy: Date): Promise<NotificacionItem[]> {
  const patentes = await prisma.patenteVehiculo.findMany({
    where: { deleted_at: null, empresa_id: empresaId, estado: 'PENDIENTE', fecha_vencimiento: { lt: hoy } },
    include: { camion: { select: { codigo: true } } },
    orderBy: { fecha_vencimiento: 'asc' },
  });
  return patentes.map(p => ({
    id:          `patente-${p.id}`,
    tipo:        'PATENTE_VENCIDA',
    titulo:      `Patente vencida — ${p.camion.codigo}`,
    descripcion: `${p.tipo} ${p.anio} venció el ${p.fecha_vencimiento.toLocaleDateString('es-AR')}`,
    urgencia:    'critical',
    link:        '/flota?tab=patentes',
    fecha:       p.fecha_vencimiento,
  }));
}

async function resolveTallerAtrasado(empresaId: number, hoy: Date): Promise<NotificacionItem[]> {
  const servicios = await prisma.servicioTaller.findMany({
    where: { deleted_at: null, empresa_id: empresaId, estado: 'EN_PROCESO', fecha_estimada: { lt: hoy } },
    include: { camion: { select: { codigo: true } } },
    orderBy: { fecha_estimada: 'asc' },
  });
  return servicios.map(s => ({
    id:          `taller-${s.id}`,
    tipo:        'TALLER_ATRASADO',
    titulo:      `${s.camion.codigo} atrasado en taller`,
    descripcion: `${s.descripcion} — retiro estimado ${s.fecha_estimada!.toLocaleDateString('es-AR')}`,
    urgencia:    'warning',
    link:        '/flota?tab=taller',
    fecha:       s.fecha_estimada!,
  }));
}

async function resolveSaldosMinimos(empresaId: number): Promise<NotificacionItem[]> {
  const cuentas = await prisma.cuentaBancaria.findMany({
    where: { deleted_at: null, empresa_id: empresaId, saldo_minimo: { not: null } },
    include: { movimientos: { where: { deleted_at: null }, orderBy: { orden: 'asc' }, select: { saldo_corriente: true } } },
  });
  const items: NotificacionItem[] = [];
  for (const c of cuentas) {
    const last = c.movimientos[c.movimientos.length - 1];
    const saldoActual = last ? Number(last.saldo_corriente) : Number(c.saldo_inicial);
    const saldoMinimo = Number(c.saldo_minimo);
    if (saldoActual >= saldoMinimo) continue;
    items.push({
      id:          `saldo-minimo-${c.id}`,
      tipo:        'SALDO_MINIMO',
      titulo:      `Saldo bajo en ${c.nombre}`,
      descripcion: `Saldo actual $${saldoActual.toLocaleString('es-AR')} — mínimo $${saldoMinimo.toLocaleString('es-AR')}`,
      urgencia:    'critical',
      link:        `/caja/${c.id}`,
      fecha:       new Date(),
    });
  }
  return items;
}

async function resolveRendicionesPendientes(empresaId: number, hoy: Date): Promise<NotificacionItem[]> {
  const cuentas = await prisma.cuentaBancaria.findMany({
    where: { deleted_at: null, empresa_id: empresaId, estado: 'PENDIENTE_RENDICION' },
    include: { responsable: { select: { nombre: true } } },
  });
  return cuentas.map(c => {
    const diasTranscurridos = Math.floor((hoy.getTime() - c.updated_at.getTime()) / MS_DIA);
    return {
      id:          `rendicion-${c.id}`,
      tipo:        'RENDICION_PENDIENTE',
      titulo:      `Rendición pendiente — ${c.nombre}`,
      descripcion: `${c.responsable?.nombre ?? 'Sin responsable'} · ${diasTranscurridos} día${diasTranscurridos !== 1 ? 's' : ''} pendiente`,
      urgencia:    (diasTranscurridos > 7 ? 'critical' : 'warning') as Urgencia,
      link:        `/caja/${c.id}`,
      fecha:       c.updated_at,
    };
  });
}

async function resolveLiquidacionesBorrador(empresaId: number, hace7Dias: Date): Promise<NotificacionItem[]> {
  const [liquidaciones, liquidacionesAdmin] = await Promise.all([
    prisma.liquidacion.findMany({
      where: { empresa_id: empresaId, estado: 'BORRADOR', created_at: { lt: hace7Dias } },
      include: { empleado: { select: { nombre: true, apellido: true } } },
    }),
    prisma.liquidacionAdmin.findMany({
      where: { empresa_id: empresaId, estado: 'BORRADOR', created_at: { lt: hace7Dias } },
      include: { empleado: { select: { nombre: true, apellido: true } } },
    }),
  ]);

  return [
    ...liquidaciones.map(l => ({
      id:          `liquidacion-${l.id}`,
      tipo:        'LIQUIDACION_BORRADOR',
      titulo:      `Liquidación sin aprobar — ${l.empleado.apellido}, ${l.empleado.nombre}`,
      descripcion: `En borrador desde el ${l.created_at.toLocaleDateString('es-AR')}`,
      urgencia:    'warning' as Urgencia,
      link:        '/rrhh?tab=liquidaciones',
      fecha:       l.created_at,
    })),
    ...liquidacionesAdmin.map(l => ({
      id:          `liquidacion-admin-${l.id}`,
      tipo:        'LIQUIDACION_BORRADOR',
      titulo:      `Liquidación admin sin aprobar — ${l.empleado.apellido}, ${l.empleado.nombre}`,
      descripcion: `En borrador desde el ${l.created_at.toLocaleDateString('es-AR')}`,
      urgencia:    'warning' as Urgencia,
      link:        '/rrhh?tab=sueldos-admin',
      fecha:       l.created_at,
    })),
  ];
}

async function resolveJornadasPendientes(empresaId: number, hace3Dias: Date): Promise<NotificacionItem[]> {
  const count = await prisma.jornada.count({
    where: { empresa_id: empresaId, deleted_at: null, estado: 'PENDIENTE', created_at: { lt: hace3Dias } },
  });
  if (count === 0) return [];
  return [{
    id:          'jornadas-pendientes',
    tipo:        'JORNADA_PENDIENTE',
    titulo:      `${count} jornada${count !== 1 ? 's' : ''} pendiente${count !== 1 ? 's' : ''} de aprobación`,
    descripcion: 'Hace más de 3 días sin resolver',
    urgencia:    'warning',
    link:        '/rrhh?tab=jornadas&estado=PENDIENTE',
    fecha:       hace3Dias,
  }];
}

// Sin fecha de vencimiento por cuota en el schema — se aproxima comparando
// cuotas_pagadas contra las cuotas que deberían llevarse pagadas según los
// meses transcurridos desde el alta del préstamo (1 cuota/mes esperada).
async function resolvePrestamosVencidos(empresaId: number, hoy: Date): Promise<NotificacionItem[]> {
  const prestamos = await prisma.prestamoEmpleado.findMany({
    where: { empresa_id: empresaId, deleted_at: null, saldado: false },
    include: { empleado: { select: { nombre: true, apellido: true } } },
  });

  const items: NotificacionItem[] = [];
  for (const p of prestamos) {
    const mesesTranscurridos = (hoy.getFullYear() - p.fecha.getFullYear()) * 12 + (hoy.getMonth() - p.fecha.getMonth()) + 1;
    const cuotasEsperadas = Math.min(p.cantidad_cuotas, Math.max(mesesTranscurridos, 0));
    if (p.cuotas_pagadas >= cuotasEsperadas) continue;
    items.push({
      id:          `prestamo-${p.id}`,
      tipo:        'PRESTAMO_ATRASADO',
      titulo:      `Cuota atrasada — ${p.empleado.apellido}, ${p.empleado.nombre}`,
      descripcion: `${p.cuotas_pagadas}/${p.cantidad_cuotas} cuotas pagadas de "${p.detalle}"`,
      urgencia:    'warning',
      link:        '/rrhh?tab=sueldos-admin',
      fecha:       p.fecha,
    });
  }
  return items;
}

async function resolveCuotasAFIP(empresaId: number, hoy: Date, en7dias: Date): Promise<NotificacionItem[]> {
  const cuotas = await prisma.cuotaPlanAFIP.findMany({
    where: {
      pagada:       false,
      fecha_debito: { lte: en7dias },
      plan:         { empresa_id: empresaId, deleted_at: null },
    },
    include: { plan: { select: { descripcion: true } } },
    orderBy: { fecha_debito: 'asc' },
  });
  return cuotas.map(c => ({
    id:          `cuota-afip-${c.id}`,
    tipo:        'CUOTA_AFIP',
    titulo:      `AFIP — ${c.plan.descripcion} (cuota ${c.numero_cuota})`,
    descripcion: `Vence el ${c.fecha_debito.toLocaleDateString('es-AR')} — $${Number(c.total_cuota).toLocaleString('es-AR')}`,
    urgencia:    (c.fecha_debito < hoy ? 'critical' : 'warning') as Urgencia,
    link:        '/afip-prestamos?tab=afip',
    fecha:       c.fecha_debito,
  }));
}

async function resolveCuotasPrestamo(empresaId: number, hoy: Date, en7dias: Date): Promise<NotificacionItem[]> {
  const cuotas = await prisma.cuotaPrestamo.findMany({
    where: {
      pagada:            false,
      fecha_vencimiento: { lte: en7dias },
      prestamo:          { empresa_id: empresaId, deleted_at: null },
    },
    include: { prestamo: { select: { entidad: true } } },
    orderBy: { fecha_vencimiento: 'asc' },
  });
  return cuotas.map(c => ({
    id:          `cuota-prestamo-${c.id}`,
    tipo:        'CUOTA_PRESTAMO',
    titulo:      `${c.prestamo.entidad} — cuota ${c.numero_cuota}`,
    descripcion: `Vence el ${c.fecha_vencimiento.toLocaleDateString('es-AR')} — $${Number(c.total_cuota).toLocaleString('es-AR')}`,
    urgencia:    (c.fecha_vencimiento < hoy ? 'critical' : 'warning') as Urgencia,
    link:        '/afip-prestamos?tab=prestamos',
    fecha:       c.fecha_vencimiento,
  }));
}

async function resolveFacturasEmitidasVencidas(empresaId: number, hoy: Date): Promise<NotificacionItem[]> {
  const facturas = await prisma.facturaEmitida.findMany({
    where: {
      empresa_id: empresaId,
      deleted_at: null,
      estado: { in: ['EMITIDA', 'COBRADA_PARCIAL'] },
      fecha_vencimiento: { lt: hoy },
    },
    include: { cobros: { select: { monto: true } } },
    orderBy: { fecha_vencimiento: 'asc' },
  });
  return facturas.map(f => {
    const cobrado        = f.cobros.reduce((s, c) => s + Number(c.monto), 0);
    const saldoPendiente = Math.max(0, Number(f.total) - cobrado);
    return {
      id:          `factura-emitida-${f.id}`,
      tipo:        'FACTURA_EMITIDA_VENCIDA',
      titulo:      `Sin cobrar — ${f.cliente_nombre}`,
      descripcion: `${f.tipo_comprobante} vencida el ${f.fecha_vencimiento!.toLocaleDateString('es-AR')} — $${saldoPendiente.toLocaleString('es-AR')}`,
      urgencia:    'critical' as Urgencia,
      link:        `/facturas-emitidas?abrir=${f.id}`,
      fecha:       f.fecha_vencimiento!,
    };
  });
}

// ── Endpoint principal ────────────────────────────────────────────────────────

export async function getNotificaciones(req: Request, res: Response) {
  const empresaId = req.empresaId!;
  const hoy = new Date();
  const hace3Dias = new Date(hoy.getTime() - 3 * MS_DIA);
  const hace7Dias = new Date(hoy.getTime() - 7 * MS_DIA);
  const en7Dias   = new Date(hoy.getTime() + 7 * MS_DIA);

  const resultados = await Promise.all([
    resolveSeguros(empresaId),
    resolvePatentesVencidas(empresaId, hoy),
    resolveTallerAtrasado(empresaId, hoy),
    resolveSaldosMinimos(empresaId),
    resolveRendicionesPendientes(empresaId, hoy),
    resolveLiquidacionesBorrador(empresaId, hace7Dias),
    resolveJornadasPendientes(empresaId, hace3Dias),
    resolvePrestamosVencidos(empresaId, hoy),
    resolveCuotasAFIP(empresaId, hoy, en7Dias),
    resolveCuotasPrestamo(empresaId, hoy, en7Dias),
    resolveFacturasEmitidasVencidas(empresaId, hoy),
  ]);

  const items = resultados
    .flat()
    .sort((a, b) => URGENCIA_RANK[a.urgencia] - URGENCIA_RANK[b.urgencia] || b.fecha.getTime() - a.fecha.getTime());

  const criticas = items.filter(i => i.urgencia === 'critical').length;

  res.json({ total: items.length, criticas, items });
}
