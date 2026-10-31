import ExcelJS from 'exceljs';
import type { Moneda } from '@prisma/client';

// Excel del centro de costos con el formato de la planilla de Male
// (docs/enjoy/KM - Centro de Costos.xlsx): fila 1 "EVENTO: <nombre>", fila 2
// encabezados, una fila por línea y el total abajo. Hojas Costos / RRHH / Extras
// (las hojas "Acciones" de KM eran algo aislado de ese evento, no se replican).
// Con soloExtras sale sólo la hoja Extras, para mandársela al cliente.

const NEGRO   = { argb: 'FF000000' };
const THIN: Partial<ExcelJS.Border> = { style: 'thin', color: NEGRO };
const GRIS    = 'FFD9D9D9';
const AMARILLO = 'FFFFF2CC';
const solid = (argb: string): ExcelJS.Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });

const FMT_MONTO = '#,##0.00';

type LineaMov = {
  concepto: string | null; descripcion: string | null; moneda: Moneda;
  debe: number; haber: number; iva: number | null; falta_pagar?: number;
  estado_movimiento: string; plazo_pago: string | null; fecha_pago: Date | string | null;
  avisado_proveedor: boolean;
  proveedor?: { nombre: string } | null; rubro?: { nombre: string } | null;
};
type LineaExtra = {
  descripcion: string; responsable: string | null; moneda: Moneda;
  neto: number; iva: number; total: number; falta_pagar: number; pagado: boolean;
  plazo_pago: string | null; datos_cuenta: string | null; factura: string | null;
  comprobante_nombre: string | null; a_cargo_cliente: boolean;
};

interface Datos { costos: LineaMov[]; rrhh: LineaMov[]; extras: LineaExtra[] }

function fechaCorta(d: Date | string | null): string {
  if (!d) return '';
  const f = new Date(d);
  return `${String(f.getUTCDate()).padStart(2, '0')}/${String(f.getUTCMonth() + 1).padStart(2, '0')}/${f.getUTCFullYear()}`;
}

function encabezado(ws: ExcelJS.Worksheet, titulo: string, headers: string[], anchos: number[]) {
  ws.getCell('B1').value = titulo;
  ws.getCell('B1').font  = { bold: true, size: 13 };
  const row = ws.getRow(2);
  headers.forEach((h, i) => {
    const c = row.getCell(i + 1);
    c.value = h;
    c.font = { bold: true };
    c.fill = solid(GRIS);
    c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    c.border = { top: THIN, bottom: THIN, left: THIN, right: THIN };
  });
  row.height = 30;
  anchos.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
  ws.views = [{ state: 'frozen', ySplit: 2 }];
}

function filaDatos(ws: ExcelJS.Worksheet, valores: (string | number | null)[], montoCols: number[]) {
  const row = ws.addRow(valores);
  row.eachCell({ includeEmpty: true }, (c, col) => {
    if (col > valores.length) return;
    c.border = { top: THIN, bottom: THIN, left: THIN, right: THIN };
    c.alignment = { vertical: 'top', wrapText: true };
    if (montoCols.includes(col)) c.numFmt = FMT_MONTO;
  });
  return row;
}

function filaTotal(ws: ExcelJS.Worksheet, desde: number, hasta: number, montoCols: number[], ancho: number) {
  const row = ws.addRow([]);
  row.getCell(2).value = 'TOTAL';
  for (const col of montoCols) {
    const letra = ws.getColumn(col).letter;
    row.getCell(col).value = hasta >= desde ? { formula: `SUM(${letra}${desde}:${letra}${hasta})` } : 0;
    row.getCell(col).numFmt = FMT_MONTO;
  }
  for (let col = 1; col <= ancho; col++) {
    const c = row.getCell(col);
    c.font = { bold: true };
    c.fill = solid(AMARILLO);
    c.border = { top: THIN, bottom: THIN, left: THIN, right: THIN };
  }
}

// "Fecha de pago a proveedores": la planilla mezcla plazo en texto y "PAGADO"
function fechaPagoTexto(m: LineaMov): string {
  if (m.plazo_pago) return m.plazo_pago;
  if (m.estado_movimiento === 'PAGADO') return m.fecha_pago ? `PAGADO ${fechaCorta(m.fecha_pago)}` : 'PAGADO';
  return fechaCorta(m.fecha_pago);
}

function hojaMovimientos(wb: ExcelJS.Workbook, nombre: string, titulo: string, lineas: LineaMov[]) {
  const ws = wb.addWorksheet(nombre);
  const headers = ['Item', 'Descripción', 'Responsable', 'Consumido en $', 'IVA', 'Consumido total', 'Falta pagar', 'Fecha de pago a proveedores', 'Se avisó al proveedor', 'Rubro', 'Moneda'];
  encabezado(ws, titulo, headers, [6, 38, 24, 16, 14, 16, 16, 22, 14, 22, 8]);
  const montos = [4, 5, 6, 7];
  lineas.forEach((m, i) => {
    const total = m.debe + m.haber;
    const iva   = m.iva ?? 0;
    filaDatos(ws, [
      i + 1,
      m.concepto ?? '',
      m.proveedor?.nombre ?? '',
      total - iva,
      iva,
      total,
      m.falta_pagar ?? 0,
      fechaPagoTexto(m),
      m.avisado_proveedor ? 'Sí' : '',
      m.rubro?.nombre ?? '',
      m.moneda,
    ], montos);
  });
  filaTotal(ws, 3, lineas.length + 2, montos, headers.length);
}

function hojaExtras(wb: ExcelJS.Workbook, titulo: string, extras: LineaExtra[]) {
  const ws = wb.addWorksheet('Extras');
  const headers = ['Item', 'Descripción', 'Responsable', 'Consumido en $', 'IVA', 'Consumido total', 'Falta pagar', 'Fecha de pago a proveedores', 'Datos cuenta', 'FC', 'COMPROBANTES', 'A cargo de', 'Moneda'];
  encabezado(ws, titulo, headers, [6, 36, 24, 16, 14, 16, 16, 22, 40, 16, 22, 12, 8]);
  const montos = [4, 5, 6, 7];
  extras.forEach((e, i) => {
    filaDatos(ws, [
      i + 1,
      e.descripcion,
      e.responsable ?? '',
      e.neto,
      e.iva,
      e.total,
      e.falta_pagar,
      e.plazo_pago ?? (e.pagado ? 'PAGADO' : ''),
      e.datos_cuenta ?? '',
      e.factura ?? '',
      e.comprobante_nombre ?? '',
      e.a_cargo_cliente ? 'Cliente' : 'Empresa',
      e.moneda,
    ], montos);
  });
  filaTotal(ws, 3, extras.length + 2, montos, headers.length);
}

export async function generateCentroCostosExcel(
  evento: { id: number; nombre: string },
  datos:  Datos,
  opts:   { soloExtras?: boolean } = {},
): Promise<{ buffer: Buffer; filename: string }> {
  const wb = new ExcelJS.Workbook();
  if (!opts.soloExtras) {
    hojaMovimientos(wb, 'Costos', `EVENTO: ${evento.nombre}`, datos.costos);
    hojaMovimientos(wb, 'RRHH', `EVENTO: ${evento.nombre} - RRHH`, datos.rrhh);
  }
  hojaExtras(wb, `EVENTO: EXTRAS ${evento.nombre}`, datos.extras);

  const buffer   = Buffer.from(await wb.xlsx.writeBuffer());
  const base     = opts.soloExtras ? 'Extras' : 'Centro de Costos';
  const filename = `${evento.nombre} - ${base}.xlsx`.replace(/[\\/:*?"<>|]/g, '-');
  return { buffer, filename };
}
