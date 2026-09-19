import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { registrarAuditoria } from '../lib/auditoria';

// Reporte de cierre contable — "foto financiera" a una fecha de corte fija
// (DOS57: 31/05 de cada año; Enjoy: a confirmar con el estudio contable, no
// hay default hardcodeado a propósito — fecha_corte siempre la elige quien
// genera). Mismo criterio de acceso cross-empresa que PlanAFIP/SGR — ver
// getAccesoEmpresas() en afipPrestamos.controller.ts.

interface AccesoEmpresas {
  esAdminGlobal: boolean;
  empresaIds:    number[] | undefined;
}

async function getAccesoEmpresas(req: Request, res: Response): Promise<{ ok: true; info: AccesoEmpresas } | { ok: false }> {
  const usuario = await prisma.usuario.findFirst({
    where:  { id: req.user!.id, deleted_at: null },
    select: { empresa_id: true, puede_ver_macro: true },
  });
  if (!usuario) { res.status(401).json({ error: 'Sesión inválida' }); return { ok: false }; }

  const esAdminGlobal = req.user!.rol === 'ADMIN' && usuario.empresa_id === null;
  if (esAdminGlobal) return { ok: true, info: { esAdminGlobal: true, empresaIds: undefined } };

  if (usuario.puede_ver_macro) {
    const accesos = await prisma.usuarioEmpresaAcceso.findMany({
      where:  { usuario_id: req.user!.id },
      select: { empresa_id: true },
    });
    return { ok: true, info: { esAdminGlobal: false, empresaIds: accesos.map(a => a.empresa_id) } };
  }

  return { ok: true, info: { esAdminGlobal: false, empresaIds: [req.empresaId!] } };
}

function scopeWhere(info: AccesoEmpresas): Record<string, unknown> {
  return info.empresaIds !== undefined ? { empresa_id: { in: info.empresaIds } } : {};
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ── Cálculo del snapshot ──────────────────────────────────────────────────────
// Todas las secciones que tienen historial propio (facturas, echeqs, cuotas,
// cuentas corrientes) se recomputan "a la fecha de corte" sumando sólo los
// movimientos/pagos/cobros anteriores o iguales a esa fecha, no el estado
// actual — un pago hecho DESPUÉS del corte no puede "limpiar" una deuda que
// seguía pendiente a esa fecha. Mercaderías es la excepción: es snapshot de
// stock actual (sin valorización, el estudio contable la hace — ver pedido).

interface SnapshotSeccionCuenta { cuenta: string; saldo: number; }
interface SnapshotTercero { cuit: string | null; nombre: string; importe: number; }
interface SnapshotCreditoDeuda { tipo: string; descripcion: string; importe: number; }

async function calcularCajasBancos(empresaId: number, fechaCorte: Date) {
  const cuentas = await prisma.cuentaBancaria.findMany({
    where: { empresa_id: empresaId, deleted_at: null },
  });

  const cajas: SnapshotSeccionCuenta[] = [];
  const bancos: SnapshotSeccionCuenta[] = [];
  const inversiones: SnapshotSeccionCuenta[] = [];

  for (const c of cuentas) {
    const ultimoMov = await prisma.movimientoCaja.findFirst({
      where:   { cuenta_id: c.id, deleted_at: null, fecha: { lte: fechaCorte } },
      orderBy: [{ fecha: 'desc' }, { orden: 'desc' }],
      select:  { saldo_corriente: true },
    });
    const saldo = round2(ultimoMov ? Number(ultimoMov.saldo_corriente) : Number(c.saldo_inicial));
    const item = { cuenta: c.nombre, saldo };
    if (c.tipo === 'EFECTIVO') cajas.push(item);
    else if (c.tipo === 'FIMA') inversiones.push(item);
    else bancos.push(item);
  }
  return { cajas, bancos, inversiones };
}

async function calcularDeudores(empresaId: number, fechaCorte: Date): Promise<SnapshotTercero[]> {
  const facturas = await prisma.facturaEmitida.findMany({
    where: {
      empresa_id: empresaId, deleted_at: null,
      estado: { not: 'ANULADA' },
      fecha_emision: { lte: fechaCorte },
    },
    include: { cobros: { where: { fecha: { lte: fechaCorte } }, select: { monto: true } } },
  });

  const porCliente = new Map<string, SnapshotTercero>();
  for (const f of facturas) {
    const cobrado   = f.cobros.reduce((s, c) => s + Number(c.monto), 0);
    const pendiente = Number(f.total_ars ?? f.total) - cobrado;
    if (pendiente <= 0.01) continue;

    const key = f.cliente_cuit ?? `sin-cuit:${f.cliente_nombre}`;
    const acc = porCliente.get(key) ?? { cuit: f.cliente_cuit, nombre: f.cliente_nombre, importe: 0 };
    acc.importe = round2(acc.importe + pendiente);
    porCliente.set(key, acc);
  }
  return [...porCliente.values()];
}

async function calcularAcreedores(empresaId: number, fechaCorte: Date): Promise<SnapshotTercero[]> {
  const facturas = await prisma.factura.findMany({
    where: {
      empresa_id: empresaId, deleted_at: null,
      estado: { not: 'ANULADA' },
      fecha_emision: { lte: fechaCorte },
    },
    include: { proveedor: { select: { nombre: true, cuit: true } }, pagos: { where: { fecha_pago: { lte: fechaCorte }, deleted_at: null }, select: { importe: true } } },
  });

  const porProveedor = new Map<string, SnapshotTercero>();
  for (const f of facturas) {
    const pagado    = f.pagos.reduce((s, p) => s + Number(p.importe), 0);
    const pendiente = Number(f.monto_ars ?? f.importe_total) - pagado;
    if (pendiente <= 0.01) continue;

    const key = f.proveedor.cuit ?? `sin-cuit:${f.proveedor.nombre}`;
    const acc = porProveedor.get(key) ?? { cuit: f.proveedor.cuit, nombre: f.proveedor.nombre, importe: 0 };
    acc.importe = round2(acc.importe + pendiente);
    porProveedor.set(key, acc);
  }
  return [...porProveedor.values()];
}

async function calcularMercaderias(empresaId: number) {
  const productos = await prisma.producto.findMany({
    where:  { empresa_id: empresaId, deleted_at: null, activo: true },
    select: { id: true, nombre: true, stock_total: true, unidad: true },
    orderBy: { nombre: 'asc' },
  });
  return {
    cantidad_items:  productos.length,
    total_unidades:  productos.reduce((s, p) => s + p.stock_total, 0),
    valor_estimado:  null as number | null, // sin valorización — lo hace el estudio contable
    productos:       productos.map(p => ({ producto_id: p.id, nombre: p.nombre, stock_total: p.stock_total, unidad: p.unidad })),
  };
}

async function calcularCreditos(empresaId: number, fechaCorte: Date): Promise<SnapshotCreditoDeuda[]> {
  const items: SnapshotCreditoDeuda[] = [];

  // Echeqs pendientes a la fecha de corte — emitido antes/igual al corte y
  // todavía no resuelto a esa fecha (si se cobró/vendió/rechazó DESPUÉS del
  // corte, seguía siendo un crédito pendiente a esa fecha).
  const echeqs = await prisma.echeq.findMany({
    where: {
      deleted_at: null,
      fecha_emision: { lte: fechaCorte },
      evento: { empresa_id: empresaId },
    },
    select: { razon_social: true, importe: true, monto_ars: true, moneda: true, estado: true, fecha_cobro_real: true, fecha_venta: true },
  });
  const porEmisor = new Map<string, number>();
  for (const e of echeqs) {
    const resueltoAntesDelCorte =
      (e.estado === 'COBRADO' && e.fecha_cobro_real !== null && e.fecha_cobro_real <= fechaCorte) ||
      (e.estado === 'VENDIDO' && e.fecha_venta !== null && e.fecha_venta <= fechaCorte) ||
      e.estado === 'RECHAZADO';
    if (resueltoAntesDelCorte) continue;
    const importe = Number(e.monto_ars ?? e.importe);
    const emisor = e.razon_social ?? 'Sin razón social';
    porEmisor.set(emisor, (porEmisor.get(emisor) ?? 0) + importe);
  }
  for (const [emisor, importe] of porEmisor) {
    items.push({ tipo: 'ECHEQ', descripcion: emisor, importe: round2(importe) });
  }

  // Préstamos a empleados a cobrar (DOS57 le prestó plata al empleado)
  const prestamos = await prisma.prestamoEmpleado.findMany({
    where: { empresa_id: empresaId, deleted_at: null, fecha: { lte: fechaCorte } },
    include: { empleado: { select: { nombre: true, apellido: true } }, pagos: { where: { fecha: { lte: fechaCorte } }, select: { monto: true } } },
  });
  for (const p of prestamos) {
    const pagado    = p.pagos.reduce((s, pago) => s + Number(pago.monto), 0);
    const pendiente = Number(p.monto_total) - pagado;
    if (pendiente <= 0.01) continue;
    items.push({ tipo: 'PRESTAMO_EMPLEADO', descripcion: `${p.empleado.apellido}, ${p.empleado.nombre} — ${p.detalle}`, importe: round2(pendiente) });
  }

  // Cuentas corrientes con saldo a favor nuestro a la fecha de corte
  const ccPositivas = await calcularCuentasCorrientesAlCorte(empresaId, fechaCorte, 'positivo');
  for (const cc of ccPositivas) items.push({ tipo: 'CUENTA_CORRIENTE', descripcion: cc.nombre, importe: cc.saldo });

  return items;
}

async function calcularDeudas(empresaId: number, fechaCorte: Date): Promise<SnapshotCreditoDeuda[]> {
  const items: SnapshotCreditoDeuda[] = [];

  const cuotasAfip = await prisma.cuotaPlanAFIP.findMany({
    where: { fecha_debito: { lte: fechaCorte }, plan: { empresa_id: empresaId, deleted_at: null } },
    include: { plan: { select: { descripcion: true } } },
  });
  const porPlan = new Map<string, number>();
  for (const c of cuotasAfip) {
    const pagadaAntesDelCorte = c.pagada && c.fecha_pago_real !== null && c.fecha_pago_real <= fechaCorte;
    if (pagadaAntesDelCorte) continue;
    porPlan.set(c.plan.descripcion, (porPlan.get(c.plan.descripcion) ?? 0) + Number(c.total_cuota));
  }
  for (const [descripcion, importe] of porPlan) items.push({ tipo: 'AFIP', descripcion, importe: round2(importe) });

  const cuotasPrestamo = await prisma.cuotaPrestamo.findMany({
    where: { fecha_vencimiento: { lte: fechaCorte }, prestamo: { empresa_id: empresaId, deleted_at: null } },
    include: { prestamo: { select: { entidad: true } } },
  });
  const porBanco = new Map<string, number>();
  for (const c of cuotasPrestamo) {
    const pagadaAntesDelCorte = c.pagada && c.fecha_pago_real !== null && c.fecha_pago_real <= fechaCorte;
    if (pagadaAntesDelCorte) continue;
    porBanco.set(c.prestamo.entidad, (porBanco.get(c.prestamo.entidad) ?? 0) + Number(c.total_cuota));
  }
  for (const [descripcion, importe] of porBanco) items.push({ tipo: 'PRESTAMO_BANCARIO', descripcion, importe: round2(importe) });

  const ccNegativas = await calcularCuentasCorrientesAlCorte(empresaId, fechaCorte, 'negativo');
  for (const cc of ccNegativas) items.push({ tipo: 'CUENTA_CORRIENTE', descripcion: cc.nombre, importe: cc.saldo });

  return items;
}

// Saldo de cada CuentaCorriente "a la fecha de corte" — último MovimientoCCC
// con fecha <= corte (mismo criterio que calcularCajasBancos), no el
// saldo_actual desnormalizado (que es SIEMPRE el valor de hoy).
async function calcularCuentasCorrientesAlCorte(empresaId: number, fechaCorte: Date, signo: 'positivo' | 'negativo'): Promise<{ nombre: string; saldo: number }[]> {
  const cuentas = await prisma.cuentaCorriente.findMany({ where: { empresa_id: empresaId, deleted_at: null } });

  const resultado: { nombre: string; saldo: number }[] = [];
  for (const c of cuentas) {
    const ultimoMov = await prisma.movimientoCCC.findFirst({
      where:   { cuenta_ccc_id: c.id, fecha: { lte: fechaCorte } },
      orderBy: { fecha: 'desc' },
      select:  { saldo: true },
    });
    if (!ultimoMov) continue; // sin movimientos antes del corte -> no participaba todavía
    const saldo = Number(ultimoMov.saldo);
    if (signo === 'positivo' && saldo > 0.01) resultado.push({ nombre: c.nombre, saldo: round2(saldo) });
    if (signo === 'negativo' && saldo < -0.01) resultado.push({ nombre: c.nombre, saldo: round2(Math.abs(saldo)) });
  }
  return resultado;
}

async function calcularSnapshot(empresaId: number, fechaCorte: Date) {
  const [{ cajas, bancos, inversiones }, deudores, acreedores, mercaderias, creditos, deudas] = await Promise.all([
    calcularCajasBancos(empresaId, fechaCorte),
    calcularDeudores(empresaId, fechaCorte),
    calcularAcreedores(empresaId, fechaCorte),
    calcularMercaderias(empresaId),
    calcularCreditos(empresaId, fechaCorte),
    calcularDeudas(empresaId, fechaCorte),
  ]);
  return { cajas, bancos, inversiones, deudores, acreedores, mercaderias, creditos, deudas, notas_por_seccion: {} as Record<string, string> };
}

// ── Endpoints ─────────────────────────────────────────────────────────────────

const generarSchema = z.object({
  empresa_id:  z.number().int().positive(),
  fecha_corte: z.string().min(1),
});

export async function generarCierreContable(req: Request, res: Response) {
  const parsed = generarSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detail: parsed.error.flatten().fieldErrors }); return;
  }
  const { empresa_id, fecha_corte } = parsed.data;

  const acceso = await getAccesoEmpresas(req, res);
  if (!acceso.ok) return;
  if (acceso.info.empresaIds !== undefined && !acceso.info.empresaIds.includes(empresa_id)) {
    res.status(403).json({ error: 'No tenés acceso a esa empresa' }); return;
  }

  const empresa = await prisma.empresa.findFirst({ where: { id: empresa_id, activo: true } });
  if (!empresa) { res.status(404).json({ error: 'Empresa no encontrada' }); return; }

  const fechaCorteDate = new Date(`${fecha_corte.slice(0, 10)}T23:59:59.999Z`);
  if (isNaN(fechaCorteDate.getTime())) { res.status(400).json({ error: 'Fecha de corte inválida' }); return; }

  const existente = await prisma.cierreContable.findUnique({
    where: { empresa_id_fecha_corte: { empresa_id, fecha_corte: fechaCorteDate } },
  });
  if (existente && existente.estado !== 'BORRADOR') {
    res.status(400).json({ error: `Este cierre ya está en estado ${existente.estado} — no se puede regenerar` }); return;
  }

  const snapshot = await calcularSnapshot(empresa_id, fechaCorteDate);
  // Conserva las notas por sección que Mayra ya haya escrito si se regenera un borrador.
  if (existente?.snapshot && typeof existente.snapshot === 'object') {
    snapshot.notas_por_seccion = (existente.snapshot as any).notas_por_seccion ?? {};
  }

  const cierre = await prisma.cierreContable.upsert({
    where:  { empresa_id_fecha_corte: { empresa_id, fecha_corte: fechaCorteDate } },
    update: { snapshot: snapshot as any },
    create: {
      empresa_id, fecha_corte: fechaCorteDate, periodo_anio: fechaCorteDate.getUTCFullYear(),
      snapshot: snapshot as any, created_by: req.user!.id,
    },
  });

  await registrarAuditoria({
    usuarioId:   req.user!.id,
    empresaId:   empresa_id,
    accion:      existente ? 'UPDATE' : 'CREATE',
    entidad:     'CierreContable',
    entidadId:   cierre.id,
    descripcion: `${existente ? 'Regeneró' : 'Generó'} el cierre contable de "${empresa.nombre}" al ${fecha_corte.slice(0, 10)}`,
    ip:          req.ip,
    tx:          prisma as any,
  });

  res.status(existente ? 200 : 201).json(cierre);
}

export async function listCierresContables(req: Request, res: Response) {
  const acceso = await getAccesoEmpresas(req, res);
  if (!acceso.ok) return;

  const cierres = await prisma.cierreContable.findMany({
    where:   scopeWhere(acceso.info),
    include: { empresa: { select: { id: true, nombre: true, nombre_corto: true } } },
    orderBy: [{ periodo_anio: 'desc' }, { fecha_corte: 'desc' }],
  });
  res.json(cierres);
}

export async function detalleCierreContable(req: Request, res: Response) {
  const id = Number(req.params.id);
  const acceso = await getAccesoEmpresas(req, res);
  if (!acceso.ok) return;

  const cierre = await prisma.cierreContable.findFirst({
    where:   { id, ...scopeWhere(acceso.info) },
    include: { empresa: { select: { id: true, nombre: true, nombre_corto: true } } },
  });
  if (!cierre) { res.status(404).json({ error: 'Cierre no encontrado' }); return; }
  res.json(cierre);
}

const updateEstadoSchema = z.object({ estado: z.enum(['BORRADOR', 'ENVIADO', 'APROBADO']) });

export async function updateEstadoCierreContable(req: Request, res: Response) {
  const id = Number(req.params.id);
  const parsed = updateEstadoSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Estado inválido' }); return; }

  const acceso = await getAccesoEmpresas(req, res);
  if (!acceso.ok) return;

  const existing = await prisma.cierreContable.findFirst({ where: { id, ...scopeWhere(acceso.info) } });
  if (!existing) { res.status(404).json({ error: 'Cierre no encontrado' }); return; }

  const cierre = await prisma.cierreContable.update({ where: { id }, data: { estado: parsed.data.estado } });

  await registrarAuditoria({
    usuarioId:   req.user!.id,
    empresaId:   existing.empresa_id,
    accion:      'UPDATE',
    entidad:     'CierreContable',
    entidadId:   id,
    descripcion: `Cambió el cierre contable #${id} a estado ${parsed.data.estado}`,
    datosAntes:  { estado: existing.estado },
    datosDespues: { estado: parsed.data.estado },
    ip:          req.ip,
    tx:          prisma as any,
  });

  res.json(cierre);
}

const notasSchema = z.object({ seccion: z.string().min(1), texto: z.string().nullable() });

// PATCH /:id/notas — aclaraciones libres por sección (Mayra), viven dentro
// del propio JSON de snapshot (snapshot.notas_por_seccion) porque el schema
// de CierreContable sólo tiene un campo `notas` general, no uno por sección.
export async function updateNotaSeccionCierreContable(req: Request, res: Response) {
  const id = Number(req.params.id);
  const parsed = notasSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Datos inválidos' }); return; }

  const acceso = await getAccesoEmpresas(req, res);
  if (!acceso.ok) return;

  const existing = await prisma.cierreContable.findFirst({ where: { id, ...scopeWhere(acceso.info) } });
  if (!existing) { res.status(404).json({ error: 'Cierre no encontrado' }); return; }

  const snapshot = (existing.snapshot ?? {}) as any;
  snapshot.notas_por_seccion = { ...(snapshot.notas_por_seccion ?? {}), [parsed.data.seccion]: parsed.data.texto };

  const cierre = await prisma.cierreContable.update({ where: { id }, data: { snapshot } });
  res.json(cierre);
}

export async function exportarCierreContable(req: Request, res: Response) {
  const id = Number(req.params.id);
  const acceso = await getAccesoEmpresas(req, res);
  if (!acceso.ok) return;

  const cierre = await prisma.cierreContable.findFirst({
    where:   { id, ...scopeWhere(acceso.info) },
    include: { empresa: { select: { nombre: true } } },
  });
  if (!cierre) { res.status(404).json({ error: 'Cierre no encontrado' }); return; }

  const { generateCierreContableExcel } = await import('../lib/excelExporter');
  const { buffer, filename } = await generateCierreContableExcel(cierre as any);

  await registrarAuditoria({
    usuarioId:   req.user!.id,
    empresaId:   cierre.empresa_id,
    accion:      'EXPORT',
    entidad:     'CierreContable',
    entidadId:   id,
    descripcion: `Exportó Excel del cierre contable de "${cierre.empresa.nombre}"`,
    ip:          req.ip,
    tx:          prisma as any,
  });

  res.set({
    'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Content-Length':      String(buffer.length),
  });
  res.end(buffer);
}
