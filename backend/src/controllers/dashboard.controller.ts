import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

// ── GET /dashboard/resumen ────────────────────────────────────────────────────

export async function getResumen(_req: Request, res: Response) {
  const today  = new Date(); today.setHours(0, 0, 0, 0);
  const in7    = new Date(today); in7.setDate(in7.getDate() + 7);

  const [eventos, movimientos, cuentas, echeqs, eventosRecientes] = await Promise.all([
    prisma.evento.findMany({
      where:  { deleted_at: null },
      select: { estado: true },
    }),
    prisma.movimiento.findMany({
      where:  { deleted_at: null, evento: { deleted_at: null, estado: 'ACTIVO' } },
      select: { tipo: true, moneda: true, debe: true, haber: true },
    }),
    prisma.cuentaBancaria.findMany({
      where:  { deleted_at: null, evento: { deleted_at: null } },
      select: {
        moneda: true,
        saldo_inicial: true,
        movimientos: {
          where:   { deleted_at: null },
          orderBy: { orden: 'asc' },
          select:  { saldo_corriente: true },
        },
      },
    }),
    prisma.echeq.findMany({
      where:  { deleted_at: null, estado: 'PENDIENTE' },
      select: { moneda: true, importe: true, fecha_cobro_estimada: true },
    }),
    prisma.evento.findMany({
      where:   { deleted_at: null },
      orderBy: { updated_at: 'desc' },
      take:    5,
      select:  { id: true, nombre: true, estado: true, moneda_base: true, updated_at: true },
    }),
  ]);

  // Event counts
  const eventoCounts = { total: 0, activos: 0, cerrados: 0, importados: 0 };
  for (const e of eventos) {
    eventoCounts.total++;
    if (e.estado === 'ACTIVO')    eventoCounts.activos++;
    if (e.estado === 'CERRADO')   eventoCounts.cerrados++;
    if (e.estado === 'IMPORTADO') eventoCounts.importados++;
  }

  // por_moneda from ACTIVO events
  const monedaMap = new Map<string, { total_ingresos: number; total_egresos: number }>();
  for (const m of movimientos) {
    if (!monedaMap.has(m.moneda)) monedaMap.set(m.moneda, { total_ingresos: 0, total_egresos: 0 });
    const e = monedaMap.get(m.moneda)!;
    if (m.tipo === 'INGRESO') e.total_ingresos += Number(m.haber) - Number(m.debe);
    else                      e.total_egresos  += Number(m.debe)  - Number(m.haber);
  }
  const por_moneda = [...monedaMap.entries()].map(([moneda, v]) => ({
    moneda,
    total_ingresos: parseFloat(v.total_ingresos.toFixed(2)),
    total_egresos:  parseFloat(v.total_egresos.toFixed(2)),
    saldo_neto:     parseFloat((v.total_ingresos - v.total_egresos).toFixed(2)),
  }));

  // Caja (all non-deleted events)
  let saldo_ars = 0, saldo_usd = 0;
  for (const c of cuentas) {
    const movs  = c.movimientos as { saldo_corriente: { valueOf(): string } }[];
    const last  = movs[movs.length - 1];
    const saldo = last ? Number(last.saldo_corriente) : Number(c.saldo_inicial);
    if (c.moneda === 'ARS') saldo_ars += saldo;
    else                    saldo_usd += saldo;
  }

  // Echeqs
  let ars = 0, usd = 0, vencidos = 0, proximos = 0;
  for (const e of echeqs) {
    if (e.moneda === 'ARS') ars += Number(e.importe);
    else                    usd += Number(e.importe);
    if (e.fecha_cobro_estimada) {
      const f = new Date(e.fecha_cobro_estimada); f.setHours(0, 0, 0, 0);
      if (f < today)      vencidos++;
      else if (f <= in7)  proximos++;
    }
  }

  res.json({
    eventos: eventoCounts,
    por_moneda,
    caja: {
      total_cuentas:   cuentas.length,
      saldo_total_ars: parseFloat(saldo_ars.toFixed(2)),
      saldo_total_usd: parseFloat(saldo_usd.toFixed(2)),
    },
    echeqs: {
      pendientes:         echeqs.length,
      vencidos,
      proximos_a_vencer:  proximos,
      total_expuesto_ars: parseFloat(ars.toFixed(2)),
      total_expuesto_usd: parseFloat(usd.toFixed(2)),
    },
    eventos_recientes: eventosRecientes,
  });
}

// ── GET /dashboard/evento/:id/kpis ───────────────────────────────────────────

export async function getKPIsEvento(req: Request, res: Response) {
  const eventoId = Number(req.params.id);

  const [evento, tabs, movimientos, cuentas, echeqs] = await Promise.all([
    prisma.evento.findFirstOrThrow({ where: { id: eventoId, deleted_at: null } }),
    prisma.tabConfig.findMany({ orderBy: [{ tipo: 'asc' }, { numero: 'asc' }] }),
    prisma.movimiento.findMany({
      where:   { evento_id: eventoId, deleted_at: null },
      orderBy: { orden: 'asc' },
      select:  { tipo: true, tab_numero: true, fecha: true, debe: true, haber: true, moneda: true },
    }),
    prisma.cuentaBancaria.findMany({
      where:  { evento_id: eventoId, deleted_at: null },
      select: {
        nombre: true, moneda: true, saldo_inicial: true,
        movimientos: {
          where:   { deleted_at: null },
          orderBy: { orden: 'asc' },
          select:  { saldo_corriente: true },
        },
      },
    }),
    prisma.echeq.findMany({
      where:  { evento_id: eventoId, deleted_at: null, estado: 'PENDIENTE' },
      select: { moneda: true, importe: true },
    }),
  ]);

  const ingresoTabs = tabs.filter(t => t.tipo === 'INGRESO');
  const egresoTabs  = tabs.filter(t => t.tipo === 'EGRESO');

  const monedasSet = new Set(movimientos.map(m => m.moneda as string));
  if (monedasSet.size === 0) monedasSet.add(evento.moneda_base);

  const por_moneda = [...monedasSet].map(moneda => {
    const fm = movimientos.filter(m => m.moneda === moneda);

    const buildRows = (tipo: 'INGRESO' | 'EGRESO', list: typeof ingresoTabs) =>
      list.map(t => {
        const ms    = fm.filter(m => m.tipo === tipo && m.tab_numero === t.numero);
        const debe  = ms.reduce((a, m) => a + Number(m.debe),  0);
        const haber = ms.reduce((a, m) => a + Number(m.haber), 0);
        const saldo = tipo === 'INGRESO' ? haber - debe : debe - haber;
        return { tab_numero: t.numero, nombre: t.nombre, saldo: parseFloat(saldo.toFixed(2)) };
      });

    const ingRows = buildRows('INGRESO', ingresoTabs);
    const egrRows = buildRows('EGRESO',  egresoTabs);

    const total_ingresos = parseFloat(ingRows.reduce((a, r) => a + r.saldo, 0).toFixed(2));
    const total_egresos  = parseFloat(egrRows.reduce((a, r) => a + r.saldo, 0).toFixed(2));
    const saldo_final    = parseFloat((total_ingresos - total_egresos).toFixed(2));

    const ingresos_por_tab = ingRows.map(r => ({
      ...r,
      porcentaje_del_total: total_ingresos !== 0
        ? parseFloat((r.saldo / total_ingresos * 100).toFixed(2))
        : 0,
    }));
    const egresos_por_tab = egrRows.map(r => ({
      ...r,
      porcentaje_del_total: total_egresos !== 0
        ? parseFloat((r.saldo / total_egresos * 100).toFixed(2))
        : 0,
    }));

    // evolucion_saldo: running sum of (debe − haber) grouped by date
    const conFecha = fm
      .filter(m => m.fecha !== null)
      .slice()
      .sort((a, b) => new Date(a.fecha!).getTime() - new Date(b.fecha!).getTime());

    const dateMap = new Map<string, number>();
    for (const m of conFecha) {
      const key = new Date(m.fecha!).toISOString().split('T')[0];
      dateMap.set(key, (dateMap.get(key) ?? 0) + (Number(m.debe) - Number(m.haber)));
    }
    let running = 0;
    const evolucion_saldo = [...dateMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([fecha, delta]) => {
        running += delta;
        return { fecha, saldo_acumulado: parseFloat(running.toFixed(2)) };
      });

    return { moneda, ingresos_por_tab, egresos_por_tab, total_ingresos, total_egresos, saldo_final, evolucion_saldo };
  });

  // Caja
  let saldo_ars = 0, saldo_usd = 0;
  const cuentasKPI = cuentas.map(c => {
    const movs  = c.movimientos as { saldo_corriente: { valueOf(): string } }[];
    const last  = movs[movs.length - 1];
    const saldo = last ? Number(last.saldo_corriente) : Number(c.saldo_inicial);
    if (c.moneda === 'ARS') saldo_ars += saldo;
    else                    saldo_usd += saldo;
    return { nombre: c.nombre, saldo_actual: parseFloat(saldo.toFixed(2)), moneda: c.moneda };
  });

  // Echeqs
  let eArs = 0, eUsd = 0;
  for (const e of echeqs) {
    if (e.moneda === 'ARS') eArs += Number(e.importe);
    else                    eUsd += Number(e.importe);
  }

  res.json({
    evento: {
      id:          evento.id,
      nombre:      evento.nombre,
      estado:      evento.estado,
      fecha_inicio: evento.fecha_inicio,
      fecha_fin:    evento.fecha_fin,
      moneda_base: evento.moneda_base,
      socios:      evento.socios,
    },
    por_moneda,
    caja: {
      saldo_total_ars: parseFloat(saldo_ars.toFixed(2)),
      saldo_total_usd: parseFloat(saldo_usd.toFixed(2)),
      cuentas:         cuentasKPI,
    },
    echeqs: {
      pendientes:         echeqs.length,
      total_expuesto_ars: parseFloat(eArs.toFixed(2)),
      total_expuesto_usd: parseFloat(eUsd.toFixed(2)),
    },
  });
}

// ── GET /dashboard/alertas ───────────────────────────────────────────────────

export async function getAlertas(_req: Request, res: Response) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const in7   = new Date(today); in7.setDate(in7.getDate() + 7);

  const [echeqsPendientes, eventosActivos, allMovimientos, allEventos] = await Promise.all([
    prisma.echeq.findMany({
      where:  { deleted_at: null, estado: 'PENDIENTE' },
      select: {
        id: true, numero: true, razon_social: true, importe: true, moneda: true,
        fecha_cobro_estimada: true, evento_id: true,
        evento: { select: { nombre: true } },
      },
    }),
    prisma.evento.findMany({
      where:  { deleted_at: null, estado: 'ACTIVO' },
      select: { id: true, nombre: true, fecha_fin: true },
    }),
    prisma.movimiento.findMany({
      where:  { deleted_at: null, evento: { deleted_at: null } },
      select: { evento_id: true, tipo: true, moneda: true, debe: true, haber: true },
    }),
    prisma.evento.findMany({
      where:  { deleted_at: null },
      select: { id: true, nombre: true },
    }),
  ]);

  type Sev = 'ERROR' | 'WARNING' | 'INFO';
  const alertas: {
    tipo: string; severidad: Sev; mensaje: string;
    evento_id: number; evento_nombre: string; metadata: object;
  }[] = [];

  // ECHEQ_VENCIDO (ERROR) + ECHEQ_POR_VENCER (WARNING)
  for (const e of echeqsPendientes) {
    if (!e.fecha_cobro_estimada) continue;
    const f = new Date(e.fecha_cobro_estimada); f.setHours(0, 0, 0, 0);
    if (f < today) {
      const dias = Math.floor((today.getTime() - f.getTime()) / 86400000);
      alertas.push({
        tipo: 'ECHEQ_VENCIDO', severidad: 'ERROR',
        mensaje: `Echeq ${e.numero} (${e.razon_social}) vencido hace ${dias} día${dias !== 1 ? 's' : ''}`,
        evento_id: e.evento_id, evento_nombre: e.evento.nombre,
        metadata: { echeq_id: e.id, numero: e.numero, razon_social: e.razon_social, importe: Number(e.importe), moneda: e.moneda, dias_vencido: dias },
      });
    } else if (f <= in7) {
      const dias = Math.ceil((f.getTime() - today.getTime()) / 86400000);
      alertas.push({
        tipo: 'ECHEQ_POR_VENCER', severidad: 'WARNING',
        mensaje: `Echeq ${e.numero} (${e.razon_social}) vence en ${dias} día${dias !== 1 ? 's' : ''}`,
        evento_id: e.evento_id, evento_nombre: e.evento.nombre,
        metadata: { echeq_id: e.id, numero: e.numero, razon_social: e.razon_social, importe: Number(e.importe), moneda: e.moneda, dias_para_vencer: dias },
      });
    }
  }

  // EVENTO_SIN_CERRAR (INFO)
  for (const e of eventosActivos) {
    if (!e.fecha_fin) continue;
    const f = new Date(e.fecha_fin); f.setHours(0, 0, 0, 0);
    if (f < today) {
      const dias = Math.floor((today.getTime() - f.getTime()) / 86400000);
      alertas.push({
        tipo: 'EVENTO_SIN_CERRAR', severidad: 'INFO',
        mensaje: `El evento "${e.nombre}" finalizó hace ${dias} día${dias !== 1 ? 's' : ''} y sigue activo`,
        evento_id: e.id, evento_nombre: e.nombre,
        metadata: { fecha_fin: e.fecha_fin, dias_pasados: dias },
      });
    }
  }

  // SALDO_NEGATIVO (WARNING)
  const eventoNameMap = new Map(allEventos.map(e => [e.id, e.nombre]));
  const movByEvento   = new Map<number, typeof allMovimientos>();
  for (const m of allMovimientos) {
    if (!movByEvento.has(m.evento_id)) movByEvento.set(m.evento_id, []);
    movByEvento.get(m.evento_id)!.push(m);
  }
  for (const [eId, movs] of movByEvento) {
    const monedas = new Set(movs.map(m => m.moneda as string));
    for (const moneda of monedas) {
      const fm  = movs.filter(m => m.moneda === moneda);
      const ing = fm.filter(m => m.tipo === 'INGRESO').reduce((a, m) => a + Number(m.haber) - Number(m.debe), 0);
      const egr = fm.filter(m => m.tipo === 'EGRESO').reduce((a, m)  => a + Number(m.debe)  - Number(m.haber), 0);
      const sf  = parseFloat((ing - egr).toFixed(2));
      if (sf < 0) {
        const nombre = eventoNameMap.get(eId) ?? `Evento ${eId}`;
        alertas.push({
          tipo: 'SALDO_NEGATIVO', severidad: 'WARNING',
          mensaje: `El evento "${nombre}" tiene saldo negativo en ${moneda}`,
          evento_id: eId, evento_nombre: nombre,
          metadata: { moneda, saldo_final: sf },
        });
      }
    }
  }

  const SEV: Record<Sev, number> = { ERROR: 0, WARNING: 1, INFO: 2 };
  alertas.sort((a, b) => SEV[a.severidad] - SEV[b.severidad]);

  res.json({ alertas });
}
