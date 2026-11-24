import type { Request, Response } from 'express';
import { z } from 'zod';
import { EstadoPagoFijo, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { registrarAuditoria } from '../lib/auditoria';
import { withTenant } from '../lib/tenant';
import { parseFechaCalendario } from '../lib/vencimientos';
import { recalcularSaldosCaja } from '../lib/recalcularSaldos';
import { procesarPagosFijos } from '../lib/pagosFijosImporter';

// ── Agenda de pagos fijos (Finanzas, punto 17) ───────────────────────────────
// Lo que se paga todos los meses. Un mes se arma con los conceptos activos (y
// los que tienen algo registrado en ese mes): si el mes no tiene fila propia se
// muestra PENDIENTE con el vencimiento y el monto habituales. Al registrar el
// pago se crea la fila del mes y, si se elige una cuenta, el gasto en Caja
// Global (al HABER). Las cuotas de AFIP, los créditos y los gastos de los
// espacios compartidos se suman a la agenda desde sus módulos.

const PERIODO_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const ESTADOS_PAGADOS: EstadoPagoFijo[] = ['PAGADO', 'DEBITADO'];

function hoyUTC(): Date {
  const h = new Date();
  return new Date(Date.UTC(h.getFullYear(), h.getMonth(), h.getDate()));
}
export function periodoActual(): string {
  const h = new Date();
  return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}`;
}
function limitesPeriodo(periodo: string): { desde: Date; hasta: Date } {
  const [a, m] = periodo.split('-').map(Number);
  return { desde: new Date(Date.UTC(a, m - 1, 1)), hasta: new Date(Date.UTC(a, m, 0, 23, 59, 59, 999)) };
}
// Vencimiento del concepto en ese mes: el día habitual, o el último día si el mes es más corto.
export function vencimientoDelMes(periodo: string, dia: number | null): Date | null {
  if (!dia) return null;
  const [a, m] = periodo.split('-').map(Number);
  const ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate();
  return new Date(Date.UTC(a, m - 1, Math.min(dia, ultimo)));
}
const n = (d: Prisma.Decimal | null | undefined) => (d == null ? null : Number(d));

// ── Agenda del mes (la usan la pantalla y el calendario) ─────────────────────

export interface FilaAgenda {
  pago_fijo_id: number;
  mes_id:       number | null;
  empresa_id:   number;
  grupo:        string;
  nombre:       string;
  referencia:   string | null;
  medio_pago:   string | null;
  cuenta_id:    number | null;
  cuenta_nombre: string | null;
  moneda:       string;
  vencimiento:  Date | null;
  monto:        number | null;
  monto_estimado: number | null;
  estado:       EstadoPagoFijo;
  vencido:      boolean;
  fecha_pago:   Date | null;
  notas:        string | null;
  movimiento_caja_id: number | null;
  activo:       boolean;
}

export async function agendaDelMes(empresaId: number | undefined, periodo: string): Promise<FilaAgenda[]> {
  const conceptos = await prisma.pagoFijo.findMany({
    where: {
      deleted_at: null,
      ...(empresaId !== undefined ? { empresa_id: empresaId } : {}),
      OR: [{ activo: true }, { meses: { some: { periodo } } }],
    },
    include: { meses: { where: { periodo } }, cuenta: { select: { nombre: true } } },
    orderBy: [{ grupo: 'asc' }, { orden: 'asc' }, { nombre: 'asc' }],
  });
  const hoy = hoyUTC();
  return conceptos.map(c => {
    const m = c.meses[0];
    const vencimiento = m ? m.vencimiento : vencimientoDelMes(periodo, c.dia_vencimiento);
    const estado = m?.estado ?? 'PENDIENTE';
    return {
      pago_fijo_id: c.id,
      mes_id:       m?.id ?? null,
      empresa_id:   c.empresa_id,
      grupo:        c.grupo,
      nombre:       c.nombre,
      referencia:   c.referencia,
      medio_pago:   m?.medio_pago ?? c.medio_pago,
      cuenta_id:    c.cuenta_id,
      cuenta_nombre: c.cuenta?.nombre ?? null,
      moneda:       c.moneda,
      vencimiento,
      monto:        m ? n(m.monto) : n(c.monto_estimado),
      monto_estimado: n(c.monto_estimado),
      estado,
      vencido:      estado === 'PENDIENTE' && !!vencimiento && vencimiento < hoy,
      fecha_pago:   m?.fecha_pago ?? null,
      notas:        m?.notas ?? null,
      movimiento_caja_id: m?.movimiento_caja_id ?? null,
      activo:       c.activo,
    };
  });
}

// GET /api/pagos-fijos?periodo=2026-11
export async function getAgenda(req: Request, res: Response) {
  const periodo = String(req.query.periodo ?? periodoActual());
  if (!PERIODO_RE.test(periodo)) { res.status(400).json({ error: 'Período inválido (AAAA-MM)' }); return; }
  const E = req.empresaId!;
  const { desde, hasta } = limitesPeriodo(periodo);
  const hoy = hoyUTC();

  const [filas, cuotasAfip, cuotasPrestamo, lineasEspacio] = await Promise.all([
    agendaDelMes(E, periodo),
    prisma.cuotaPlanAFIP.findMany({
      where: { fecha_debito: { gte: desde, lte: hasta }, plan: { deleted_at: null, empresa_id: E } },
      include: { plan: { select: { id: true, descripcion: true, numero_plan: true, cantidad_cuotas: true, titular_nombre: true } } },
      orderBy: { fecha_debito: 'asc' },
    }),
    prisma.cuotaPrestamo.findMany({
      where: { fecha_vencimiento: { gte: desde, lte: hasta }, prestamo: { deleted_at: null, empresa_id: E } },
      include: { prestamo: { select: { id: true, entidad: true, cantidad_cuotas: true } } },
      orderBy: { fecha_vencimiento: 'asc' },
    }),
    prisma.lineaGastoEspacio.findMany({
      where: {
        deleted_at: null, estado: { not: 'ANULADO' },
        gasto_mes: { periodo_anio: Number(periodo.slice(0, 4)), periodo_mes: Number(periodo.slice(5)), espacio: { deleted_at: null, empresa_id: E } },
      },
      include: { gasto_mes: { select: { espacio: { select: { id: true, nombre: true } } } } },
      orderBy: { fecha_vencimiento: 'asc' },
    }),
  ]);

  // De otros módulos: sólo se muestran, se pagan en su pantalla.
  const otros = [
    ...cuotasAfip.map(c => ({
      origen: 'AFIP' as const, id: c.id, nombre: `Plan AFIP ${c.plan.numero_plan ?? ''} ${c.plan.descripcion}`.replace(/\s+/g, ' ').trim(),
      detalle: `Cuota ${c.numero_cuota}/${c.plan.cantidad_cuotas}${c.plan.titular_nombre ? ` · ${c.plan.titular_nombre}` : ''}`,
      vencimiento: c.fecha_debito, monto: Number(c.total_cuota), pagado: c.pagada,
      vencido: !c.pagada && c.fecha_debito < hoy, ruta: '/afip-prestamos',
    })),
    ...cuotasPrestamo.map(c => ({
      origen: 'CREDITO' as const, id: c.id, nombre: `Crédito ${c.prestamo.entidad}`,
      detalle: `Cuota ${c.numero_cuota}/${c.prestamo.cantidad_cuotas}`,
      vencimiento: c.fecha_vencimiento, monto: Number(c.total_cuota), pagado: c.pagada,
      vencido: !c.pagada && c.fecha_vencimiento < hoy, ruta: '/afip-prestamos?tab=prestamos',
    })),
    ...lineasEspacio.map(l => ({
      origen: 'ESPACIO' as const, id: l.id, nombre: `${l.gasto_mes.espacio.nombre} — ${l.nombre}`,
      detalle: 'Espacio compartido',
      vencimiento: l.fecha_vencimiento, monto: Number(l.monto_real), pagado: l.estado === 'PAGADO',
      vencido: l.estado === 'PENDIENTE' && !!l.fecha_vencimiento && l.fecha_vencimiento < hoy,
      ruta: `/espacios-compartidos/${l.gasto_mes.espacio.id}`,
    })),
  ];

  // Totales en ARS (los conceptos en otra moneda se informan aparte)
  const ars = filas.filter(f => f.moneda === 'ARS' && f.estado !== 'NO_CORRESPONDE' && f.estado !== 'A_FAVOR');
  const sum = (xs: { monto: number | null }[]) => Math.round(xs.reduce((s, x) => s + (x.monto ?? 0), 0) * 100) / 100;
  const pagadosPropios = ars.filter(f => ESTADOS_PAGADOS.includes(f.estado));
  const pendPropios    = ars.filter(f => f.estado === 'PENDIENTE');
  const totales = {
    total:      sum(ars) + sum(otros),
    pagado:     sum(pagadosPropios) + sum(otros.filter(o => o.pagado)),
    pendiente:  sum(pendPropios) + sum(otros.filter(o => !o.pagado)),
    vencido:    sum(pendPropios.filter(f => f.vencido)) + sum(otros.filter(o => o.vencido)),
    sin_monto:  pendPropios.filter(f => f.monto == null).length,
    cantidad_pendientes: pendPropios.length + otros.filter(o => !o.pagado).length,
    cantidad_vencidos:   pendPropios.filter(f => f.vencido).length + otros.filter(o => o.vencido).length,
  };

  res.json({ periodo, filas, otros, totales });
}

// ── Conceptos ────────────────────────────────────────────────────────────────

const conceptoSchema = z.object({
  grupo:           z.string().trim().min(1).max(60).default('Empresa'),
  nombre:          z.string().trim().min(1, 'Poné qué se paga').max(120),
  referencia:      z.string().trim().max(200).nullable().optional(),
  medio_pago:      z.string().trim().max(80).nullable().optional(),
  cuenta_id:       z.number().int().nullable().optional(),
  dia_vencimiento: z.number().int().min(1).max(31).nullable().optional(),
  monto_estimado:  z.number().nonnegative().nullable().optional(),
  moneda:          z.enum(['ARS', 'USD']).default('ARS'),
  activo:          z.boolean().default(true),
  notas:           z.string().trim().max(500).nullable().optional(),
});

// Claves: el sistema no las guarda (la planilla de Mayra las tiene escritas).
const PARECE_CLAVE = /(clave|contraseña|contrasena|password|pass\b|usuario\s*:)/i;

async function validarCuenta(cuentaId: number | null | undefined, empresaId: number) {
  if (!cuentaId) return true;
  return !!(await prisma.cuentaBancaria.findFirst({ where: { id: cuentaId, deleted_at: null, empresa_id: empresaId } }));
}

export async function listConceptos(req: Request, res: Response) {
  const conceptos = await prisma.pagoFijo.findMany({
    where: { deleted_at: null, ...withTenant(req.empresaId!) },
    include: { cuenta: { select: { id: true, nombre: true } } },
    orderBy: [{ activo: 'desc' }, { grupo: 'asc' }, { orden: 'asc' }, { nombre: 'asc' }],
  });
  res.json(conceptos.map(c => ({ ...c, monto_estimado: n(c.monto_estimado) })));
}

export async function createConcepto(req: Request, res: Response) {
  const p = conceptoSchema.safeParse(req.body);
  if (!p.success) { res.status(400).json({ error: p.error.issues[0]?.message ?? 'Datos inválidos' }); return; }
  if (p.data.referencia && PARECE_CLAVE.test(p.data.referencia)) {
    res.status(400).json({ error: 'No guardes usuarios ni claves en la referencia: poné sólo el n° de cliente o de contrato' }); return;
  }
  if (!(await validarCuenta(p.data.cuenta_id, req.empresaId!))) { res.status(400).json({ error: 'La cuenta no es de esta empresa' }); return; }
  const c = await prisma.pagoFijo.create({ data: { ...p.data, empresa_id: req.empresaId!, created_by: req.user!.id } });
  await registrarAuditoria({ usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'CREATE', entidad: 'PagoFijo', entidadId: c.id, descripcion: `Agregó el pago fijo "${c.nombre}"`, ip: req.ip, tx: prisma as any });
  res.status(201).json(c);
}

export async function updateConcepto(req: Request, res: Response) {
  const id = Number(req.params.id);
  const actual = await prisma.pagoFijo.findFirst({ where: { id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!actual) { res.status(404).json({ error: 'Pago fijo no encontrado' }); return; }
  const p = conceptoSchema.partial().safeParse(req.body);
  if (!p.success) { res.status(400).json({ error: p.error.issues[0]?.message ?? 'Datos inválidos' }); return; }
  if (p.data.referencia && PARECE_CLAVE.test(p.data.referencia)) {
    res.status(400).json({ error: 'No guardes usuarios ni claves en la referencia: poné sólo el n° de cliente o de contrato' }); return;
  }
  if (!(await validarCuenta(p.data.cuenta_id, req.empresaId!))) { res.status(400).json({ error: 'La cuenta no es de esta empresa' }); return; }
  const c = await prisma.pagoFijo.update({ where: { id }, data: p.data });
  await registrarAuditoria({ usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'UPDATE', entidad: 'PagoFijo', entidadId: id, descripcion: `Modificó el pago fijo "${c.nombre}"`, datosAntes: actual, datosDespues: p.data, ip: req.ip, tx: prisma as any });
  res.json(c);
}

export async function deleteConcepto(req: Request, res: Response) {
  const id = Number(req.params.id);
  const actual = await prisma.pagoFijo.findFirst({ where: { id, deleted_at: null, ...withTenant(req.empresaId!) } });
  if (!actual) { res.status(404).json({ error: 'Pago fijo no encontrado' }); return; }
  // Lo ya registrado queda: con historial se desactiva en vez de borrarse.
  const conHistorial = await prisma.pagoFijoMes.count({ where: { pago_fijo_id: id, estado: { not: 'PENDIENTE' } } });
  if (conHistorial) {
    await prisma.pagoFijo.update({ where: { id }, data: { activo: false } });
    await registrarAuditoria({ usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'UPDATE', entidad: 'PagoFijo', entidadId: id, descripcion: `Dejó de usar el pago fijo "${actual.nombre}" (tiene pagos registrados)`, ip: req.ip, tx: prisma as any });
    res.json({ desactivado: true }); return;
  }
  await prisma.pagoFijo.update({ where: { id }, data: { deleted_at: new Date() } });
  await registrarAuditoria({ usuarioId: req.user!.id, empresaId: req.empresaId, accion: 'DELETE', entidad: 'PagoFijo', entidadId: id, descripcion: `Eliminó el pago fijo "${actual.nombre}"`, ip: req.ip, tx: prisma as any });
  res.json({ eliminado: true });
}

// ── Registrar el mes ─────────────────────────────────────────────────────────
// PUT /api/pagos-fijos/:id/mes/:periodo
// cuenta_id: si viene y el estado es pagado/debitado, se asienta el gasto en esa
// cuenta de Caja Global (o se corrige el que ya estaba). Al volver a pendiente
// (o no corresponde / a favor) el gasto asentado se borra.

const mesSchema = z.object({
  vencimiento: z.string().nullable().optional(),
  monto:       z.number().nonnegative().nullable().optional(),
  estado:      z.nativeEnum(EstadoPagoFijo),
  fecha_pago:  z.string().nullable().optional(),
  medio_pago:  z.string().trim().max(80).nullable().optional(),
  notas:       z.string().trim().max(500).nullable().optional(),
  cuenta_id:   z.number().int().nullable().optional(),
});

export class ErrorPagoFijo extends Error { constructor(public status: number, msg: string) { super(msg); } }

export async function registrarMes(
  pagoFijoId: number, periodo: string, input: z.infer<typeof mesSchema>, empresaId: number, usuarioId: number, ip?: string,
) {
  if (!PERIODO_RE.test(periodo)) throw new ErrorPagoFijo(400, 'Período inválido (AAAA-MM)');
  const concepto = await prisma.pagoFijo.findFirst({ where: { id: pagoFijoId, deleted_at: null, empresa_id: empresaId } });
  if (!concepto) throw new ErrorPagoFijo(404, 'Pago fijo no encontrado');
  const vencimiento = input.vencimiento === undefined ? undefined : parseFechaCalendario(input.vencimiento);
  const fechaPagoIn = input.fecha_pago === undefined ? undefined : parseFechaCalendario(input.fecha_pago);
  if (vencimiento === undefined && input.vencimiento !== undefined) throw new ErrorPagoFijo(400, 'Vencimiento inválido');
  if (fechaPagoIn === undefined && input.fecha_pago !== undefined) throw new ErrorPagoFijo(400, 'Fecha de pago inválida');

  const pagado = ESTADOS_PAGADOS.includes(input.estado);
  const existente = await prisma.pagoFijoMes.findUnique({
    where: { pago_fijo_id_periodo: { pago_fijo_id: pagoFijoId, periodo } },
    include: { movimiento_caja: { select: { id: true, cuenta_id: true, deleted_at: true } } },
  });
  const monto = input.monto !== undefined ? input.monto : (existente ? n(existente.monto) : n(concepto.monto_estimado));
  const fechaPago = pagado ? (fechaPagoIn ?? existente?.fecha_pago ?? hoyUTC()) : null;

  let cuentaDestino: { id: number; nombre: string } | null = null;
  if (pagado && input.cuenta_id) {
    const c = await prisma.cuentaBancaria.findFirst({ where: { id: input.cuenta_id, deleted_at: null, empresa_id: empresaId }, select: { id: true, nombre: true, moneda: true } });
    if (!c) throw new ErrorPagoFijo(400, 'La cuenta no es de esta empresa');
    if (c.moneda !== concepto.moneda) throw new ErrorPagoFijo(400, `La cuenta "${c.nombre}" es en ${c.moneda} y el pago en ${concepto.moneda}`);
    if (!monto) throw new ErrorPagoFijo(400, 'Para asentarlo en la caja hace falta el monto');
    cuentaDestino = c;
  }

  return prisma.$transaction(async tx => {
    const movPrevio = existente?.movimiento_caja && !existente.movimiento_caja.deleted_at ? existente.movimiento_caja : null;
    let movimientoId: number | null = movPrevio?.id ?? null;
    const recalcular = new Set<number>();
    const descripcion = `Pago fijo: ${concepto.nombre} (${periodo.slice(5)}/${periodo.slice(0, 4)})`;

    // Sacar el gasto asentado si ya no corresponde o cambió de cuenta
    if (movPrevio && (!cuentaDestino || movPrevio.cuenta_id !== cuentaDestino.id)) {
      await tx.movimientoCaja.update({ where: { id: movPrevio.id }, data: { deleted_at: new Date(), updated_by: usuarioId } });
      recalcular.add(movPrevio.cuenta_id);
      movimientoId = null;
    }
    if (cuentaDestino) {
      if (movimientoId) {
        await tx.movimientoCaja.update({ where: { id: movimientoId }, data: { fecha: fechaPago, haber: monto!, debe: 0, descripcion, updated_by: usuarioId } });
      } else {
        const last = await tx.movimientoCaja.findFirst({ where: { cuenta_id: cuentaDestino.id, deleted_at: null }, orderBy: { orden: 'desc' }, select: { orden: true } });
        const mov = await tx.movimientoCaja.create({
          data: {
            cuenta_id: cuentaDestino.id, fecha: fechaPago, descripcion, debe: 0, haber: monto!,
            orden: (last?.orden ?? 0) + 1, created_by: usuarioId, updated_by: usuarioId,
          },
        });
        movimientoId = mov.id;
      }
      recalcular.add(cuentaDestino.id);
    }

    const data = {
      ...(vencimiento !== undefined ? { vencimiento } : {}),
      monto,
      estado:     input.estado,
      fecha_pago: fechaPago,
      ...(input.medio_pago !== undefined ? { medio_pago: input.medio_pago || null } : {}),
      ...(input.notas !== undefined ? { notas: input.notas || null } : {}),
      movimiento_caja_id: movimientoId,
      updated_by: usuarioId,
    };
    const mes = existente
      ? await tx.pagoFijoMes.update({ where: { id: existente.id }, data })
      : await tx.pagoFijoMes.create({
          data: {
            ...data, pago_fijo_id: pagoFijoId, periodo, created_by: usuarioId,
            vencimiento: vencimiento !== undefined ? vencimiento : vencimientoDelMes(periodo, concepto.dia_vencimiento),
            medio_pago: input.medio_pago !== undefined ? (input.medio_pago || null) : concepto.medio_pago,
          },
        });
    for (const cid of recalcular) await recalcularSaldosCaja(cid, tx);
    await registrarAuditoria({
      usuarioId, empresaId, accion: existente ? 'UPDATE' : 'CREATE', entidad: 'PagoFijoMes', entidadId: mes.id,
      descripcion: `${concepto.nombre} ${periodo}: ${input.estado.toLowerCase().replace('_', ' ')}${cuentaDestino ? ` (asentado en ${cuentaDestino.nombre})` : ''}`,
      datosAntes: existente ?? undefined, datosDespues: data, ip, tx: tx as any,
    });
    return mes;
  });
}

export async function putMes(req: Request, res: Response) {
  const p = mesSchema.safeParse(req.body);
  if (!p.success) { res.status(400).json({ error: p.error.issues[0]?.message ?? 'Datos inválidos' }); return; }
  try {
    const mes = await registrarMes(Number(req.params.id), String(req.params.periodo), p.data, req.empresaId!, req.user!.id, req.ip);
    res.json(mes);
  } catch (e) {
    if (e instanceof ErrorPagoFijo) { res.status(e.status).json({ error: e.message }); return; }
    throw e;
  }
}

// ── Importar la planilla ─────────────────────────────────────────────────────
// POST /api/pagos-fijos/importar?preview=true|false  (archivo + secciones=JSON)
export async function importarPlanilla(req: Request, res: Response) {
  if (!req.file) { res.status(400).json({ error: 'Se requiere un archivo .xlsx' }); return; }
  const aplicar = req.query.preview === 'false';
  let secciones: string[] | undefined;
  try { secciones = req.body?.secciones ? JSON.parse(req.body.secciones) : undefined; } catch { secciones = undefined; }
  const empresa = await prisma.empresa.findUnique({ where: { id: req.empresaId! }, select: { id: true, nombre: true } });
  try {
    res.json(await procesarPagosFijos(req.file.buffer, empresa!, req.user!.id, aplicar, secciones));
  } catch (err: any) {
    res.status(400).json({ error: err.message ?? 'Error al procesar el archivo' });
  }
}
