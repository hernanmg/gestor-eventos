import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';

// ── Acceso ────────────────────────────────────────────────────────────────────
// Admin global (rol ADMIN sin empresa fija) o usuario con puede_ver_macro=true
// (ej. Mayra) — ninguno de los dos necesita tenantMiddleware, porque esta
// vista es intrínsecamente cross-empresa (no depende de la empresa activa de
// la sesión).

type UsuarioMacro = { id: number; rol: string; empresa_id: number | null; puede_ver_macro: boolean; areas_macro: string[] };

async function resolveUsuarioMacro(req: Request, res: Response): Promise<UsuarioMacro | null> {
  const usuario = await prisma.usuario.findFirst({
    where:  { id: req.user!.id, deleted_at: null },
    select: { id: true, rol: true, empresa_id: true, puede_ver_macro: true, areas_macro: true },
  });
  if (!usuario) { res.status(401).json({ error: 'Sesión inválida' }); return null; }

  const esAdminGlobal = usuario.rol === 'ADMIN' && usuario.empresa_id === null;
  if (!esAdminGlobal && !usuario.puede_ver_macro) {
    res.status(403).json({ error: 'Sin acceso a la vista Macro' });
    return null;
  }
  return usuario;
}

async function empresasDelUsuario(usuario: UsuarioMacro) {
  const esAdminGlobal = usuario.rol === 'ADMIN' && usuario.empresa_id === null;
  if (esAdminGlobal) {
    return prisma.empresa.findMany({ where: { activo: true }, orderBy: { id: 'asc' } });
  }
  const accesos = await prisma.usuarioEmpresaAcceso.findMany({
    where:   { usuario_id: usuario.id },
    include: { empresa: true },
    orderBy: { id: 'asc' },
  });
  return accesos.map(a => a.empresa).filter(e => e.activo);
}

// ── GET /macro/resumen-financiero ─────────────────────────────────────────────

const querySchema = z.object({
  mes:  z.coerce.number().int().min(1).max(12).optional(),
  anio: z.coerce.number().int().min(2000).max(2100).optional(),
});

// Totales de ingresos/egresos/saldo por moneda — ARS, USD, EUR y el
// equivalente consolidado en ARS (usando monto_ars de cada movimiento).
type TotalesMoneda = { ingresos: number; egresos: number; saldo: number };

function totalesVacios(): TotalesMoneda {
  return { ingresos: 0, egresos: 0, saldo: 0 };
}

async function movimientosPorMoneda(empresaId: number, desde: Date, hasta: Date) {
  const movs = await prisma.movimiento.findMany({
    where: {
      deleted_at: null, fecha: { gte: desde, lt: hasta },
      evento: { deleted_at: null, empresa_id: empresaId },
    },
    select: { tipo: true, moneda: true, debe: true, haber: true, monto_ars: true },
  });

  const porMoneda: Record<'ARS' | 'USD' | 'EUR', TotalesMoneda> = {
    ARS: totalesVacios(), USD: totalesVacios(), EUR: totalesVacios(),
  };
  const totalEnArs = totalesVacios();

  for (const m of movs) {
    const debe  = Number(m.debe);
    const haber = Number(m.haber);

    const bucket = porMoneda[m.moneda as 'ARS' | 'USD' | 'EUR'];
    if (bucket) {
      if (m.tipo === 'INGRESO') bucket.ingresos += haber - debe;
      else                      bucket.egresos  += debe - haber;
    }

    // Equivalente ARS — usa monto_ars cuando está disponible (ARS siempre lo
    // tiene equivalente a debe/haber; USD/EUR sólo si se cargó tasa_cambio;
    // si no hay tasa cargada todavía, el movimiento no suma al total en ARS).
    const montoArs = m.moneda === 'ARS' ? (debe || haber) : (m.monto_ars !== null ? Number(m.monto_ars) : null);
    if (montoArs !== null) {
      const debeArs  = debe  > 0 ? montoArs : 0;
      const haberArs = haber > 0 ? montoArs : 0;
      if (m.tipo === 'INGRESO') totalEnArs.ingresos += haberArs - debeArs;
      else                      totalEnArs.egresos  += debeArs  - haberArs;
    }
  }

  for (const key of ['ARS', 'USD', 'EUR'] as const) {
    const b = porMoneda[key];
    b.ingresos = parseFloat(b.ingresos.toFixed(2));
    b.egresos  = parseFloat(b.egresos.toFixed(2));
    b.saldo    = parseFloat((b.ingresos - b.egresos).toFixed(2));
  }
  totalEnArs.ingresos = parseFloat(totalEnArs.ingresos.toFixed(2));
  totalEnArs.egresos  = parseFloat(totalEnArs.egresos.toFixed(2));
  totalEnArs.saldo    = parseFloat((totalEnArs.ingresos - totalEnArs.egresos).toFixed(2));

  return { ...porMoneda, total_en_ars: totalEnArs };
}

async function resumenPorEmpresa(empresaId: number, desde: Date, hasta: Date) {
  const [
    movPorMoneda,
    facturasPendientes,
    facturasVencidas,
    echeqsPendientes,
    cuentasCorrientes,
    liquidacionesPendientes,
    anticiposPendientes,
    productos,
  ] = await Promise.all([
    movimientosPorMoneda(empresaId, desde, hasta),
    prisma.factura.count({
      where: { deleted_at: null, empresa_id: empresaId, estado: { notIn: ['PAGADA', 'ANULADA'] } },
    }),
    prisma.factura.count({
      where: {
        deleted_at: null, empresa_id: empresaId, estado: { notIn: ['PAGADA', 'ANULADA'] },
        fecha_vencimiento: { lt: new Date() },
      },
    }),
    // Idem simplificación de moneda que en movimientosMes.
    prisma.echeq.aggregate({
      where: {
        deleted_at: null, estado: 'PENDIENTE', moneda: 'ARS',
        evento: { deleted_at: null, empresa_id: empresaId },
      },
      _sum: { importe: true },
    }),
    prisma.cuentaCorriente.findMany({
      where:  { deleted_at: null, empresa_id: empresaId, activa: true },
      select: { nombre: true, saldo_actual: true, moneda: true },
      orderBy: { nombre: 'asc' },
    }),
    prisma.liquidacion.count({
      where: { empresa_id: empresaId, estado: 'BORRADOR' },
    }),
    prisma.anticipo.aggregate({
      where: { empresa_id: empresaId, descontado: false },
      _sum:  { monto: true },
    }),
    // Alertas de stock: comparación directa stock_total/stock_minimo — versión
    // liviana para un tile de resumen, sin recalcular disponibilidad real por
    // asignaciones solapadas (eso vive en stock.controller.ts#getAlertas, que
    // es mucho más costoso y está pensado para la vista dedicada de Stock).
    prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint as count FROM "Producto"
      WHERE deleted_at IS NULL AND activo = true AND empresa_id = ${empresaId}
        AND stock_total < stock_minimo
    `,
  ]);

  return {
    // Legado — alias de movPorMoneda.total_en_ars, mantenido para no romper
    // consumidores existentes del endpoint.
    total_ingresos_mes: movPorMoneda.total_en_ars.ingresos,
    total_egresos_mes:  movPorMoneda.total_en_ars.egresos,
    saldo_neto_mes:     movPorMoneda.total_en_ars.saldo,
    movimientos_por_moneda: movPorMoneda,
    facturas_pendientes: facturasPendientes,
    facturas_vencidas:   facturasVencidas,
    echeqs_pendientes:   Number(echeqsPendientes._sum.importe ?? 0),
    cuentas_corrientes:  cuentasCorrientes.map(c => ({ nombre: c.nombre, saldo: Number(c.saldo_actual), moneda: c.moneda })),
    liquidaciones_pendientes: liquidacionesPendientes,
    anticipos_pendientes:     Number(anticiposPendientes._sum.monto ?? 0),
    alertas_stock:            Number(productos[0]?.count ?? 0),
  };
}

export async function resumenFinanciero(req: Request, res: Response) {
  const usuario = await resolveUsuarioMacro(req, res);
  if (!usuario) return;

  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'Parámetros inválidos', detail: parsed.error.flatten().fieldErrors }); return;
  }

  const hoy  = new Date();
  const anio = parsed.data.anio ?? hoy.getUTCFullYear();
  const mes  = parsed.data.mes  ?? hoy.getUTCMonth() + 1; // 1-12
  const desde = new Date(Date.UTC(anio, mes - 1, 1));
  const hasta = new Date(Date.UTC(anio, mes, 1)); // exclusivo — primer día del mes siguiente

  const empresas = await empresasDelUsuario(usuario);

  const resultados = await Promise.all(empresas.map(async e => ({
    empresa_id:     e.id,
    empresa_nombre: e.nombre,
    ...(await resumenPorEmpresa(e.id, desde, hasta)),
  })));

  res.json(resultados);
}
