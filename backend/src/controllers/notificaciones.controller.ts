import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { updateEstadoSeguros } from './flota.controller';
import { ubicarPeriodo, periodoAnterior, rangoSemanaFija } from './combustible.controller';
import { EMPRESAS } from '../lib/empresasConstants';

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
  // Acciones resolubles sin navegar (ver flujo de aprobación de tardanzas de
  // Presentismo) — el frontend las renderiza como botones inline en la campanita.
  acciones?: { label: string; endpoint: string; variant: 'default' | 'destructive' }[];
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

// SGR — seguimiento informativo de cupo/vinculación (Mayra: no afecta ningún
// cálculo, sólo alerta). Dos motivos independientes, pueden darse los dos a
// la vez para la misma SGR.
async function resolveSGRAlertas(empresaId: number, en30dias: Date): Promise<NotificacionItem[]> {
  const sgrs = await prisma.sGR.findMany({ where: { deleted_at: null, empresa_id: empresaId } });

  const items: NotificacionItem[] = [];
  for (const s of sgrs) {
    if (s.fecha_vencimiento && s.fecha_vencimiento <= en30dias) {
      items.push({
        id:          `sgr-vence-${s.id}`,
        tipo:        'SGR_VENCE',
        titulo:      `Vinculación SGR por vencer — ${s.nombre}`,
        descripcion: `Vence el ${s.fecha_vencimiento.toLocaleDateString('es-AR')}`,
        urgencia:    s.fecha_vencimiento < new Date() ? 'critical' : 'warning',
        link:        '/afip-prestamos?tab=sgr',
        fecha:       s.fecha_vencimiento,
      });
    }

    const cupoTotal      = s.cupo_total      !== null ? Number(s.cupo_total)      : null;
    const cupoDisponible = s.cupo_disponible !== null ? Number(s.cupo_disponible) : null;
    if (cupoTotal !== null && cupoTotal > 0 && cupoDisponible !== null && cupoDisponible < cupoTotal * 0.2) {
      items.push({
        id:          `sgr-cupo-bajo-${s.id}`,
        tipo:        'SGR_CUPO_BAJO',
        titulo:      `Cupo bajo en SGR — ${s.nombre}`,
        descripcion: `Disponible $${cupoDisponible.toLocaleString('es-AR')} de $${cupoTotal.toLocaleString('es-AR')}`,
        urgencia:    'warning',
        link:        '/afip-prestamos?tab=sgr',
        fecha:       new Date(),
      });
    }
  }
  return items;
}

// Uniformes con stock en o por debajo del mínimo (ver Activo.cantidad_minima
// — importador de stock de uniformes, Lorena). Mismo criterio de alerta
// vigente (no vencimiento futuro) que resolveSaldosMinimos.
async function resolveStockUniformeBajo(empresaId: number): Promise<NotificacionItem[]> {
  const activos = await prisma.activo.findMany({
    where: { deleted_at: null, empresa_id: empresaId, categoria: 'UNIFORME' },
  });

  const items: NotificacionItem[] = [];
  for (const a of activos) {
    const cantidad = a.cantidad ?? 0;
    const minima   = a.cantidad_minima ?? 0;
    if (cantidad > minima) continue;
    items.push({
      id:          `stock-uniforme-${a.id}`,
      tipo:        'STOCK_UNIFORME_BAJO',
      titulo:      `Stock bajo: ${a.nombre} (${a.ubicacion ?? 'sin depósito'})`,
      descripcion: `Quedan ${cantidad} unidad${cantidad !== 1 ? 'es' : ''}`,
      urgencia:    cantidad === 0 ? 'critical' : 'warning',
      link:        '/stock?tab=activos',
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

// Acceso multi-empresa para esta notificación puntual — mismo criterio que
// getAccesoEmpresas() en afipPrestamos.controller.ts / resolveEmpresaFiltro()
// en calendario.controller.ts: admin global (ADMIN sin empresa fija) ve todas
// las empresas activas; puede_ver_macro (ej. Mayra) ve las de su
// UsuarioEmpresaAcceso (DOS57 y Enjoy); cualquier otro ADMIN queda fijo a su
// empresa de sesión (ej. Chino/Male sólo Enjoy, Pollo/Veck sólo DOS57).
const MS_48H = 48 * 60 * 60 * 1000;

async function resolveEventosSinDecisionFacturacion(req: Request): Promise<NotificacionItem[]> {
  if (req.user!.rol !== 'ADMIN') return [];

  const usuario = await prisma.usuario.findFirst({
    where:  { id: req.user!.id, deleted_at: null },
    select: { empresa_id: true, puede_ver_macro: true },
  });
  if (!usuario) return [];

  const esAdminGlobal = usuario.empresa_id === null;
  let empresaIds: number[] | undefined;
  if (esAdminGlobal) {
    empresaIds = undefined; // sin restricción — todas las empresas activas
  } else if (usuario.puede_ver_macro) {
    const accesos = await prisma.usuarioEmpresaAcceso.findMany({
      where:  { usuario_id: req.user!.id },
      select: { empresa_id: true },
    });
    empresaIds = accesos.map(a => a.empresa_id);
  } else {
    empresaIds = [req.empresaId!];
  }

  const eventos = await prisma.evento.findMany({
    where: {
      deleted_at: null,
      facturar:   null,
      ...(empresaIds !== undefined && { empresa_id: { in: empresaIds } }),
    },
    select: { id: true, nombre: true, created_at: true, created_by: true },
    orderBy: { created_at: 'asc' },
  });
  if (eventos.length === 0) return [];

  const creadorIds = [...new Set(eventos.map(e => e.created_by).filter((id): id is number => id != null))];
  const creadores = creadorIds.length
    ? await prisma.usuario.findMany({ where: { id: { in: creadorIds } }, select: { id: true, nombre: true } })
    : [];
  const nombrePorCreador = new Map(creadores.map(c => [c.id, c.nombre]));

  const ahora = new Date();
  return eventos.map(e => {
    const vencido        = ahora.getTime() - e.created_at.getTime() > MS_48H;
    const nombreCreador  = e.created_by != null ? nombrePorCreador.get(e.created_by) : undefined;
    return {
      id:          `evento-sin-decision-${e.id}`,
      tipo:        'EVENTO_SIN_DECISION_FACTURACION',
      titulo:      vencido ? 'Evento pendiente de decisión de facturación' : 'Nuevo evento sin decisión de facturación',
      descripcion: nombreCreador ? `${e.nombre} — creado por ${nombreCreador}` : e.nombre,
      urgencia:    (vencido ? 'critical' : 'warning') as Urgencia,
      link:        `/eventos/${e.id}`,
      fecha:       e.created_at,
    };
  });
}

// Tardanzas cargadas por Lorena (Control de Presentismo) esperando que
// Matías las apruebe o rechace — sólo se muestran al admin global (mismo
// criterio que resolveEventosSinDecisionFacturacion): Andrea y Mayra también
// son ADMIN pero fijas a su empresa, y sólo tienen lectura de este flujo. Sin
// filtro de empresa activa a propósito — Matías tiene que verlas y poder
// aprobarlas desde la campanita esté en la empresa que esté (ver Sidebar.tsx,
// que muestra "Presentismo" para el admin global sin importar la empresa activa).
async function resolveTardanzasPendientes(req: Request): Promise<NotificacionItem[]> {
  if (req.user!.rol !== 'ADMIN') return [];
  const usuario = await prisma.usuario.findFirst({ where: { id: req.user!.id, deleted_at: null }, select: { empresa_id: true } });
  if (!usuario || usuario.empresa_id !== null) return [];

  const registros = await prisma.registroAsistencia.findMany({
    where: {
      deleted_at: null, estado: 'TARDE',
      tardanza_requiere_aprobacion: true, tardanza_aprobada: null,
    },
    include: { empleado: { select: { nombre: true, apellido: true } } },
    orderBy: { fecha: 'asc' },
  });

  return registros.map(r => ({
    id:          `tardanza-${r.id}`,
    tipo:        'TARDANZA_PENDIENTE',
    titulo:      `${r.empleado.apellido}, ${r.empleado.nombre} llegó tarde el ${r.fecha.toLocaleDateString('es-AR')}`,
    descripcion: `¿Aprobás la tardanza?${r.minutos_tardanza != null ? ` (${r.minutos_tardanza} min)` : ''}`,
    urgencia:    'warning' as Urgencia,
    link:        '/presentismo',
    fecha:       r.fecha,
    acciones: [
      { label: 'Aprobar',  endpoint: `/presentismo/${r.id}/aprobar-tardanza`,  variant: 'default' as const },
      { label: 'Rechazar', endpoint: `/presentismo/${r.id}/rechazar-tardanza`, variant: 'destructive' as const },
    ],
  }));
}

// Presentismo cerrado (Lorena) con liquidaciones administrativas todavía sin
// generar para ese período — avisa que falta el paso siguiente en Sueldos Admin.
async function resolvePresentismoCerradoPendiente(empresaId: number): Promise<NotificacionItem[]> {
  const hace14Dias = new Date(Date.now() - 14 * MS_DIA);
  const resumenes = await prisma.resumenPresentismo.findMany({
    where: { empresa_id: empresaId, created_at: { gte: hace14Dias } },
    select: { empleado_id: true, periodo_mes: true, periodo_anio: true, created_at: true },
  });
  if (resumenes.length === 0) return [];

  const porPeriodo = new Map<string, { mes: number; anio: number; empleadoIds: number[]; fecha: Date }>();
  for (const r of resumenes) {
    const key = `${r.periodo_anio}-${r.periodo_mes}`;
    if (!porPeriodo.has(key)) porPeriodo.set(key, { mes: r.periodo_mes, anio: r.periodo_anio, empleadoIds: [], fecha: r.created_at });
    porPeriodo.get(key)!.empleadoIds.push(r.empleado_id);
  }

  const items: NotificacionItem[] = [];
  for (const [key, p] of porPeriodo) {
    const liquidadas = await prisma.liquidacionAdmin.count({
      where: { empresa_id: empresaId, periodo_mes: p.mes, periodo_anio: p.anio, empleado_id: { in: p.empleadoIds } },
    });
    const pendientes = p.empleadoIds.length - liquidadas;
    if (pendientes <= 0) continue;
    items.push({
      id:          `presentismo-cerrado-${key}`,
      tipo:        'PRESENTISMO_CERRADO',
      titulo:      `Presentismo de ${p.mes}/${p.anio} cerrado por Lorena`,
      descripcion: `${pendientes} liquidación${pendientes !== 1 ? 'es' : ''} pendiente${pendientes !== 1 ? 's' : ''} de generar`,
      urgencia:    'info',
      link:        '/rrhh?tab=sueldos-admin',
      fecha:       p.fecha,
    });
  }
  return items;
}

async function resolveGastosEspacioVencidos(empresaId: number, hoy: Date): Promise<NotificacionItem[]> {
  const lineas = await prisma.lineaGastoEspacio.findMany({
    where: {
      deleted_at: null,
      estado: 'PENDIENTE',
      fecha_vencimiento: { not: null, lt: hoy },
      gasto_mes: { espacio: { deleted_at: null, empresa_id: empresaId } },
    },
    include: { gasto_mes: { include: { espacio: { select: { id: true, nombre: true } } } } },
    orderBy: { fecha_vencimiento: 'asc' },
  });
  return lineas.map(l => ({
    id:          `gasto-espacio-${l.id}`,
    tipo:        'GASTO_ESPACIO_VENCIDO',
    titulo:      `${l.gasto_mes.espacio.nombre} — ${l.nombre}`,
    descripcion: `Vencido el ${l.fecha_vencimiento!.toLocaleDateString('es-AR')} — $${Number(l.monto_real).toLocaleString('es-AR')}`,
    urgencia:    'critical',
    link:        `/espacios-compartidos/${l.gasto_mes.espacio.id}`,
    fecha:       l.fecha_vencimiento!,
  }));
}

// Cierre de semana de combustible (Santi/Nico, DOS57) — Flor (costo por
// evento), Mayra (finanzas) y Andrea (gastos del mes) piden verlo apenas se
// cierra cada semana (pedido explícito, ver [[combustible_flota_dos57]]).
// Placeholder por nombre — mismo criterio que esLorena/esSanti en App.tsx —
// hasta que exista un rol/flag dedicado. No se filtra por empresa activa a
// propósito: combustible es de DOS57 pero estas 3 personas deben verlo sea
// cual sea la empresa en la que estén paradas.
async function resolveCombustibleSemanaCerrada(req: Request): Promise<NotificacionItem[]> {
  if (req.user!.rol !== 'ADMIN') return [];
  const usuario = await prisma.usuario.findFirst({ where: { id: req.user!.id, deleted_at: null }, select: { nombre: true } });
  if (!usuario || !/flor|mayra|andrea/i.test(usuario.nombre)) return [];

  const hoy = new Date();
  const periodoActual   = ubicarPeriodo(hoy);
  const periodoCerrado  = periodoAnterior(periodoActual);
  const periodoPrevio   = periodoAnterior(periodoCerrado);
  const { desde: desdeCerrado, hasta: hastaCerrado } = rangoSemanaFija(periodoCerrado);
  const { desde: desdePrevio, hasta: hastaPrevio }   = rangoSemanaFija(periodoPrevio);
  const finCerrado = new Date(hastaCerrado.getTime() + 86_400_000); // exclusivo
  const finPrevio  = new Date(hastaPrevio.getTime() + 86_400_000);

  const [cargasCerrada, cargasAnterior] = await Promise.all([
    prisma.cargaCombustible.findMany({
      where: { deleted_at: null, empresa_id: EMPRESAS.DOS57, fecha: { gte: desdeCerrado, lt: finCerrado } },
      include: { camion: { select: { codigo: true } }, evento: { select: { nombre: true } } },
    }),
    prisma.cargaCombustible.findMany({
      where: { deleted_at: null, empresa_id: EMPRESAS.DOS57, fecha: { gte: desdePrevio, lt: finPrevio } },
      select: { litros: true },
    }),
  ]);
  if (cargasCerrada.length === 0) return [];

  const totalLitros = cargasCerrada.reduce((s, c) => s + Number(c.litros), 0);
  const totalAnterior = cargasAnterior.reduce((s, c) => s + Number(c.litros), 0);
  const variacion = totalAnterior > 0 ? Math.round(((totalLitros - totalAnterior) / totalAnterior) * 100) : null;

  const eventos = [...new Set(cargasCerrada.filter(c => c.evento).map(c => c.evento!.nombre))];
  const fmt = (d: Date) => `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`;

  return [{
    id:          `combustible-semana-${periodoCerrado.anio}-${periodoCerrado.mes}-${periodoCerrado.numero}`,
    tipo:        'COMBUSTIBLE_SEMANA_CERRADA',
    titulo:      `Combustible — semana ${periodoCerrado.numero} (${fmt(desdeCerrado)} al ${fmt(hastaCerrado)}) cerrada`,
    descripcion: `${totalLitros.toLocaleString('es-AR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} L en total`
      + (variacion !== null ? ` (${variacion >= 0 ? '+' : ''}${variacion}% vs. semana anterior)` : '')
      + (eventos.length ? ` — eventos: ${eventos.join(', ')}` : ''),
    urgencia:    'info',
    link:        '/combustible?tab=resumen',
    fecha:       finCerrado,
  }];
}

// Siniestros de empleados (ART) abiertos/en trámite sin avanzar hace más de 30
// días — pantalla de Andrea (ver [[calendario_controller]] SINIESTRO_PENDIENTE
// para el mismo dato en el calendario).
async function resolveSiniestrosSinNovedad(empresaId: number, hace30Dias: Date): Promise<NotificacionItem[]> {
  const siniestros = await prisma.siniestroEmpleado.findMany({
    where: { deleted_at: null, empresa_id: empresaId, estado: { in: ['ABIERTO', 'EN_TRAMITE'] }, updated_at: { lt: hace30Dias } },
    include: { empleado: { select: { nombre: true, apellido: true } } },
    orderBy: { updated_at: 'asc' },
  });
  return siniestros.map(s => ({
    id:          `siniestro-${s.id}`,
    tipo:        'SINIESTRO_SIN_NOVEDAD',
    titulo:      `${s.empleado ? `${s.empleado.apellido}, ${s.empleado.nombre}` : (s.empleado_nombre_manual ?? 'Sin empleado')} — siniestro sin novedad`,
    descripcion: `${s.estado === 'ABIERTO' ? 'Abierto' : 'En trámite'} desde el ${s.updated_at.toLocaleDateString('es-AR')}`,
    urgencia:    'warning' as Urgencia,
    link:        '/gastos-operativos?tab=siniestros',
    fecha:       s.updated_at,
  }));
}

// Excedentes de horas (Fofi/Nestoras) pendientes de pago hace más de 60 días.
async function resolveExcedentesAtrasados(empresaId: number, hace60Dias: Date): Promise<NotificacionItem[]> {
  const excedentes = await prisma.excedenteHoras.findMany({
    where: { empresa_id: empresaId, pagado: false, created_at: { lt: hace60Dias } },
    include: { empleado: { select: { nombre: true, apellido: true } } },
    orderBy: { created_at: 'asc' },
  });
  return excedentes.map(e => ({
    id:          `excedente-${e.id}`,
    tipo:        'EXCEDENTE_ATRASADO',
    titulo:      `${e.empleado.apellido}, ${e.empleado.nombre} — excedente sin pagar`,
    descripcion: `${e.periodo_mes}/${e.periodo_anio} — $${Number(e.monto_total).toLocaleString('es-AR')}`,
    urgencia:    'warning' as Urgencia,
    link:        '/gastos-operativos?tab=excedente-horas',
    fecha:       e.created_at,
  }));
}

// ── Endpoint principal ────────────────────────────────────────────────────────

export async function getNotificaciones(req: Request, res: Response) {
  const empresaId = req.empresaId!;
  const hoy = new Date();
  const hace3Dias  = new Date(hoy.getTime() - 3 * MS_DIA);
  const hace7Dias  = new Date(hoy.getTime() - 7 * MS_DIA);
  const hace30Dias = new Date(hoy.getTime() - 30 * MS_DIA);
  const hace60Dias = new Date(hoy.getTime() - 60 * MS_DIA);
  const en7Dias    = new Date(hoy.getTime() + 7 * MS_DIA);
  const en30Dias   = new Date(hoy.getTime() + 30 * MS_DIA);

  const resultados = await Promise.all([
    resolveSeguros(empresaId),
    resolvePatentesVencidas(empresaId, hoy),
    resolveTallerAtrasado(empresaId, hoy),
    resolveSaldosMinimos(empresaId),
    resolveStockUniformeBajo(empresaId),
    resolveSGRAlertas(empresaId, en30Dias),
    resolveRendicionesPendientes(empresaId, hoy),
    resolveLiquidacionesBorrador(empresaId, hace7Dias),
    resolveJornadasPendientes(empresaId, hace3Dias),
    resolvePrestamosVencidos(empresaId, hoy),
    resolveCuotasAFIP(empresaId, hoy, en7Dias),
    resolveCuotasPrestamo(empresaId, hoy, en7Dias),
    resolveFacturasEmitidasVencidas(empresaId, hoy),
    resolveEventosSinDecisionFacturacion(req),
    resolveGastosEspacioVencidos(empresaId, hoy),
    resolveTardanzasPendientes(req),
    resolvePresentismoCerradoPendiente(empresaId),
    resolveCombustibleSemanaCerrada(req),
    resolveSiniestrosSinNovedad(empresaId, hace30Dias),
    resolveExcedentesAtrasados(empresaId, hace60Dias),
  ]);

  const items = resultados
    .flat()
    .sort((a, b) => URGENCIA_RANK[a.urgencia] - URGENCIA_RANK[b.urgencia] || b.fecha.getTime() - a.fecha.getTime());

  const criticas = items.filter(i => i.urgencia === 'critical').length;

  res.json({ total: items.length, criticas, items });
}
