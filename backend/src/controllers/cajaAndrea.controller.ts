import type { Request, Response } from 'express';
import multer from 'multer';
import * as XLSX from 'xlsx';
import { prisma } from '../lib/prisma';
import { withTenant } from '../lib/tenant';
import { importarCajaAndrea } from '../lib/cajaAndreaImporter';

export const uploadExcelAndrea = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/\.(xlsx|xls)$/i.test(file.originalname)) cb(null, true);
    else cb(new Error('Solo se aceptan archivos Excel (.xlsx, .xls)'));
  },
});

const CATEGORIAS_ANDREA = ['COMBUSTIBLE', 'COMIDA', 'GASTOS_VARIOS', 'SERVICIOS', 'DEV_GASTOS', 'VALES'] as const;

function totalesVacios() {
  return { ingreso: 0, combustible: 0, comida: 0, gastos_varios: 0, servicios: 0, dev_gastos: 0, vales: 0 };
}

const CATEGORIA_A_CAMPO: Record<(typeof CATEGORIAS_ANDREA)[number], keyof ReturnType<typeof totalesVacios>> = {
  COMBUSTIBLE:   'combustible',
  COMIDA:        'comida',
  GASTOS_VARIOS: 'gastos_varios',
  SERVICIOS:     'servicios',
  DEV_GASTOS:    'dev_gastos',
  VALES:         'vales',
};

// GET /api/caja/resumen-andrea?mes=&anio=&cuenta_id= — la tabla estilo Excel
// (CAJAS_JULIO-2026.xlsx, hoja JULIO) de la pantalla principal de Andrea.
// Reusa CuentaBancaria/MovimientoCaja tal cual existen (ver [[caja_empresa_sin_evento]]) —
// el "saldo_acumulado" por fila es directamente el saldo_corriente ya
// calculado por recalcularSaldosCaja (el libro de una cuenta es continuo,
// no se reinicia cada mes; "SALDO ANTERIOR" es el saldo antes del 1° del mes).
export async function resumenAndrea(req: Request, res: Response) {
  const mes  = Number(req.query.mes);
  const anio = Number(req.query.anio);
  const cuentaId = Number(req.query.cuenta_id);

  if (!mes || mes < 1 || mes > 12 || !anio || !cuentaId) {
    res.status(400).json({ error: 'mes, anio y cuenta_id son requeridos' });
    return;
  }

  const cuenta = await prisma.cuentaBancaria.findFirst({
    where: { id: cuentaId, deleted_at: null, ...withTenant(req.empresaId!) },
  });
  if (!cuenta) { res.status(404).json({ error: 'Cuenta no encontrada' }); return; }

  const desde = new Date(Date.UTC(anio, mes - 1, 1));
  const hasta = new Date(Date.UTC(anio, mes, 1));

  const [movimientosDelMes, ultimoAnterior] = await Promise.all([
    prisma.movimientoCaja.findMany({
      where: { cuenta_id: cuentaId, deleted_at: null, fecha: { gte: desde, lt: hasta } },
      orderBy: [{ fecha: 'asc' }, { orden: 'asc' }],
    }),
    prisma.movimientoCaja.findFirst({
      where: { cuenta_id: cuentaId, deleted_at: null, fecha: { lt: desde } },
      orderBy: [{ fecha: 'desc' }, { orden: 'desc' }],
      select: { saldo_corriente: true },
    }),
  ]);

  const saldoAnterior = ultimoAnterior ? Number(ultimoAnterior.saldo_corriente) : Number(cuenta.saldo_inicial);

  // Un egreso sin categoria_andrea (importado de una hoja sin columnas
  // categorizadas — Reserva, Cajas Guardadas, cajas por persona — o cargado
  // a mano sin tipo) cae en Gastos Varios como fallback. Tiene que ser
  // EXACTAMENTE el mismo criterio que columnaDe() en el frontend
  // (CajaDelMesTab.tsx) — si no, la fila se ve en una columna pero el total
  // de esa columna no la suma (bug real: para las hojas sin categorías
  // (formato INGRESO/EGRESO simple), categoria_andrea es siempre null, así
  // que sin este fallback esas cajas mostraban $0 en todas las columnas de
  // egreso del total, aunque las filas individuales sí tuvieran monto).
  const totales = totalesVacios();
  for (const m of movimientosDelMes) {
    const debe  = Number(m.debe);
    const haber = Number(m.haber);
    if (debe > 0) totales.ingreso += debe;
    if (haber > 0) {
      const categoria = m.categoria_andrea as (typeof CATEGORIAS_ANDREA)[number] | null;
      const campo = (categoria && CATEGORIA_A_CAMPO[categoria]) || 'gastos_varios';
      totales[campo] += haber;
    }
  }
  for (const k of Object.keys(totales) as (keyof typeof totales)[]) {
    totales[k] = parseFloat(totales[k].toFixed(2));
  }

  const saldoFinal = movimientosDelMes.length > 0
    ? Number(movimientosDelMes[movimientosDelMes.length - 1].saldo_corriente)
    : saldoAnterior;

  res.json({
    cuenta: { id: cuenta.id, nombre: cuenta.nombre, moneda: cuenta.moneda, saldo_actual: Number(cuenta.saldo_inicial) },
    saldo_anterior: saldoAnterior,
    movimientos: movimientosDelMes.map(m => ({
      ...m,
      debe:              Number(m.debe),
      haber:             Number(m.haber),
      saldo_corriente:   Number(m.saldo_corriente),
      saldo_acumulado:   Number(m.saldo_corriente),
      comprobante_data:  undefined,
      tiene_comprobante: m.comprobante_data != null,
    })),
    totales: { ...totales, saldo_final: parseFloat(saldoFinal.toFixed(2)) },
  });
}

// POST /api/caja/importar-andrea — procesa CAJAS_JULIO-2026.xlsx completo
// (multi-hoja: JULIO/RESERVA/CAJAS GUARDADAS/ADELANTOS-DOS57/CAJA-POLLO-.../
// CAJA-JAZMIN/CAJA-MIGUEL/CAJA DAVID) — ver cajaAndreaImporter.ts.
export async function importarAndrea(req: Request, res: Response) {
  if (!req.file) { res.status(400).json({ error: 'Se requiere un archivo Excel' }); return; }

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
  } catch {
    res.status(400).json({ error: 'No se pudo leer el archivo Excel' });
    return;
  }

  const resultado = await importarCajaAndrea(workbook, req.empresaId!, req.user!.id);
  res.json(resultado);
}
