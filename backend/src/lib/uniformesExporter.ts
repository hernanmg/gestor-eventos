import ExcelJS from 'exceljs';
import { prisma } from './prisma';
import { PRENDAS } from './uniformesImporter';
import { calcularResumenUniformes } from '../controllers/uniformes.controller';

// Excel de entregas de uniformes del año (Lorena, DOS57):
//   - "Resumen AAAA": la tabla general de /uniformes — una fila por empleado con
//     los totales del año (misma lógica que GET /api/uniformes/resumen).
//   - "Detalle AAAA": cada entrega del año con su hoja de origen y si suma al
//     total del empleado (las filas duplicadas / pisadas por el resumen anual
//     quedan en gris con "No").

const PRENDA_HEADER: Record<typeof PRENDAS[number], string> = {
  borcegos: 'Borcegos', remeras: 'Remeras', camperon: 'Camperón', chombas: 'Chombas', campera: 'Campera',
  mochila: 'Mochila', buzo: 'Buzo', pantalon: 'Pantalón', bermuda: 'Bermuda', gorra: 'Gorra',
  prot_lumbar: 'Protector lumbar', guantes: 'Guantes',
};

const AZUL = 'FF15233E'; // mismo azul del título de la planilla de Lorena
const GRIS = 'FFF2F2F2';
const THIN: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: 'FFBFBFBF' } };
const solid = (argb: string): ExcelJS.Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });

function fmtFecha(d: Date): string {
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
}

function titulo(ws: ExcelJS.Worksheet, texto: string, columnas: number) {
  ws.mergeCells(1, 1, 1, columnas);
  const c = ws.getCell(1, 1);
  c.value = texto;
  c.font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } };
  c.fill = solid(AZUL);
  c.alignment = { vertical: 'middle' };
  ws.getRow(1).height = 22;
}

function header(ws: ExcelJS.Worksheet, fila: number, headers: string[]) {
  const row = ws.getRow(fila);
  headers.forEach((h, i) => {
    const c = row.getCell(i + 1);
    c.value = h;
    c.font = { bold: true };
    c.fill = solid('FFD9E2F3');
    c.border = { top: THIN, bottom: THIN, left: THIN, right: THIN };
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });
  row.height = 30;
}

function bordes(row: ExcelJS.Row, columnas: number) {
  for (let i = 1; i <= columnas; i++) row.getCell(i).border = { top: THIN, bottom: THIN, left: THIN, right: THIN };
}

export async function generarExcelUniformes(empresaId: number, anio: number): Promise<{ buffer: Buffer; filename: string }> {
  const empresa = await prisma.empresa.findUnique({ where: { id: empresaId }, select: { nombre: true, nombre_corto: true } });
  const nombreEmpresa = empresa?.nombre_corto || empresa?.nombre || `Empresa ${empresaId}`;
  const { filas, totales, detalle } = await calcularResumenUniformes(empresaId, anio);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Admin Portal';

  // ── Resumen ───────────────────────────────────────────────────────────────
  const headersRes = ['Empleado', ...PRENDAS.map(p => PRENDA_HEADER[p]), 'Otros', 'Fuente', 'Estado'];
  const wsR = wb.addWorksheet(`Resumen ${anio}`, { views: [{ state: 'frozen', ySplit: 3, xSplit: 1 }] });
  titulo(wsR, `ENTREGA DE UNIFORMES ${anio} — ${nombreEmpresa.toUpperCase()}`, headersRes.length);
  header(wsR, 3, headersRes);
  filas.forEach((f, i) => {
    const row = wsR.getRow(4 + i);
    row.values = [
      f.empleado_nombre,
      ...PRENDAS.map(p => f[p] || null),
      f.otros ?? '',
      f.fuente === 'RESUMEN' ? 'Resumen anual de la planilla' : `${f.entregas} entrega${f.entregas !== 1 ? 's' : ''}`,
      f.empleado_id === null ? 'Sin RRHH' : (f.empleado_estado === 'INACTIVO' ? 'Baja' : ''),
    ];
    bordes(row, headersRes.length);
    if (f.empleado_estado === 'INACTIVO') row.font = { color: { argb: 'FF808080' } };
  });
  const filaTot = wsR.getRow(4 + filas.length);
  filaTot.values = ['TOTAL', ...PRENDAS.map(p => totales[p])];
  filaTot.font = { bold: true };
  for (let i = 1; i <= PRENDAS.length + 1; i++) filaTot.getCell(i).fill = solid('FFFFFF00');
  bordes(filaTot, headersRes.length);

  wsR.getColumn(1).width = 32;
  PRENDAS.forEach((_, i) => { const col = wsR.getColumn(i + 2); col.width = 10; col.alignment = { horizontal: 'center' }; });
  wsR.getColumn(PRENDAS.length + 2).width = 40;
  wsR.getColumn(PRENDAS.length + 3).width = 26;
  wsR.getColumn(PRENDAS.length + 4).width = 12;

  // ── Detalle ───────────────────────────────────────────────────────────────
  const headersDet = ['Empleado', 'Nombre en planilla', 'Fecha', ...PRENDAS.map(p => PRENDA_HEADER[p]), 'Otros', 'Hoja de origen', 'Suma al total'];
  const wsD = wb.addWorksheet(`Detalle ${anio}`, { views: [{ state: 'frozen', ySplit: 3, xSplit: 1 }] });
  titulo(wsD, `DETALLE DE ENTREGAS ${anio} — ${nombreEmpresa.toUpperCase()}`, headersDet.length);
  header(wsD, 3, headersDet);
  detalle.forEach((e, i) => {
    const row = wsD.getRow(4 + i);
    row.values = [
      e.empleado_label,
      e.empleado_nombre,
      e.anio_resumen ? `Resumen ${e.anio_resumen}` : fmtFecha(e.fecha_entrega),
      ...PRENDAS.map(p => e[p] || null),
      e.otros ?? '',
      e.origen_hoja,
      e.suma_al_total ? 'Sí' : 'No',
    ];
    bordes(row, headersDet.length);
    if (!e.suma_al_total) {
      for (let c = 1; c <= headersDet.length; c++) row.getCell(c).fill = solid(GRIS);
      row.font = { color: { argb: 'FF808080' } };
    }
  });
  if (detalle.length > 0) {
    const nota = wsD.getRow(5 + detalle.length);
    nota.getCell(1).value = '"Suma al total = No": entrega repetida en otra hoja con la misma fecha, o reemplazada por el resumen anual de la planilla.';
    nota.getCell(1).font = { italic: true, color: { argb: 'FF808080' } };
  }

  wsD.getColumn(1).width = 32;
  wsD.getColumn(2).width = 28;
  wsD.getColumn(3).width = 13;
  PRENDAS.forEach((_, i) => { const col = wsD.getColumn(i + 4); col.width = 10; col.alignment = { horizontal: 'center' }; });
  wsD.getColumn(PRENDAS.length + 4).width = 40;
  wsD.getColumn(PRENDAS.length + 5).width = 24;
  wsD.getColumn(PRENDAS.length + 6).width = 12;

  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  return { buffer, filename: `Uniformes_${nombreEmpresa.replace(/\s+/g, '_')}_${anio}.xlsx` };
}
