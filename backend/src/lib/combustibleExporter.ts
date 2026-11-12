import ExcelJS from 'exceljs';
import { prisma } from './prisma';
import { withTenant } from './tenant';
import { applyHeaderStyle, fmtDate, safeName, BOLD, NUM_FMT } from './excelExporter';

const MESES_LABEL = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];

const COLS = [
  'Fecha', 'N° FA/COMP', 'Tipo mov.', 'Vehículo', 'Combustible', 'Litros', '$/L', 'Pagos', 'Consumos (monto)', 'Saldo',
  'Km actual', 'Rendimiento (L/100km)', 'Estación', 'Evento', 'Estado', 'Responsable', 'Observaciones',
];

export async function generateCombustibleExcel(empresaId: number, anio: number): Promise<{ buffer: Buffer; filename: string }> {
  const cargas = await prisma.cargaCombustible.findMany({
    where: {
      deleted_at: null, ...withTenant(empresaId),
      fecha: { gte: new Date(Date.UTC(anio, 0, 1)), lt: new Date(Date.UTC(anio + 1, 0, 1)) },
    },
    include: { camion: { select: { codigo: true, patente: true } }, evento: { select: { nombre: true } } },
    orderBy: { fecha: 'asc' },
  });

  const wb = new ExcelJS.Workbook();

  const litrosPorMes = new Array(12).fill(0);
  const montoPorMes  = new Array(12).fill(0);

  for (let mes = 0; mes < 12; mes++) {
    const delMes = cargas.filter(c => c.fecha.getUTCMonth() === mes);
    const ws = wb.addWorksheet(safeName(`${MESES_LABEL[mes]}.${anio}`));
    ws.columns = COLS.map(() => ({ width: 16 }));
    const header = ws.addRow(COLS);
    applyHeaderStyle(header, COLS.length);

    let totalLitros = 0;
    let totalMonto  = 0;
    for (const c of delMes) {
      totalLitros += Number(c.litros);
      totalMonto  += Number(c.monto_total);
      ws.addRow([
        fmtDate(c.fecha),
        c.numero_comprobante ?? '',
        c.tipo_movimiento ?? '',
        c.camion ? `${c.camion.codigo}${c.camion.patente ? ` (${c.camion.patente})` : ''}` : '',
        c.tipo_combustible,
        Number(c.litros),
        c.precio_por_litro != null ? Number(c.precio_por_litro) : '',
        c.pagos != null ? Number(c.pagos) : '',
        Number(c.monto_total),
        c.saldo != null ? Number(c.saldo) : '',
        c.km_actual ?? '',
        c.rendimiento_lts_100km != null ? Number(c.rendimiento_lts_100km) : '',
        c.estacion_nombre ?? '',
        c.evento?.nombre ?? '',
        c.estado,
        c.responsable_nombre ?? '',
        c.notas ?? '',
      ]);
    }

    ws.getColumn(6).numFmt = NUM_FMT;
    ws.getColumn(9).numFmt = NUM_FMT;

    const totalRow = ws.addRow(['TOTAL', '', '', '', '', totalLitros, '', '', totalMonto, '', '', '', '', '', '', '', '']);
    totalRow.font = BOLD;

    litrosPorMes[mes] = totalLitros;
    montoPorMes[mes]  = totalMonto;
  }

  const resumen = wb.addWorksheet('RESUMEN ANUAL');
  resumen.columns = [{ width: 16 }, { width: 16 }, { width: 16 }, { width: 14 }];
  const resumenHeader = resumen.addRow(['Mes', 'Litros', 'Monto', '% Variación']);
  applyHeaderStyle(resumenHeader, 4);

  let totalAnualLitros = 0;
  let totalAnualMonto  = 0;
  for (let mes = 0; mes < 12; mes++) {
    const variacion = mes > 0 && litrosPorMes[mes - 1] > 0
      ? `${(((litrosPorMes[mes] - litrosPorMes[mes - 1]) / litrosPorMes[mes - 1]) * 100).toFixed(1)}%`
      : '';
    resumen.addRow([MESES_LABEL[mes], litrosPorMes[mes], montoPorMes[mes], variacion]);
    totalAnualLitros += litrosPorMes[mes];
    totalAnualMonto  += montoPorMes[mes];
  }
  const totalResumenRow = resumen.addRow(['TOTAL ANUAL', totalAnualLitros, totalAnualMonto, '']);
  totalResumenRow.font = BOLD;
  resumen.getColumn(2).numFmt = NUM_FMT;
  resumen.getColumn(3).numFmt = NUM_FMT;

  const buffer = await wb.xlsx.writeBuffer();
  return { buffer: Buffer.from(buffer), filename: `Combustible_${anio}.xlsx` };
}
