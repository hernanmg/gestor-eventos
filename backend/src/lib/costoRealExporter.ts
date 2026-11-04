import ExcelJS from 'exceljs';
import type { BloqueCostoReal } from '@prisma/client';
import { BLOQUES, INFO_BLOQUE, calcularTotal } from './costoReal';

// Excel del costo real con la estructura de la matriz de Flor
// (docs/dos57/jazmin/DOS57_NORTE ROCK_2026.xlsx): hoja CC con el resumen, OPEX
// con una sección por bloque operativo, RENTAL COSTS (NAC.) / (IMP.) y L&A COSTS.
// Se puede volver a importar con costoRealImporter (mismos títulos y columnas).

const NEGRO = { argb: 'FF000000' };
const THIN: Partial<ExcelJS.Border> = { style: 'thin', color: NEGRO };
const BORDE = { top: THIN, bottom: THIN, left: THIN, right: THIN };
const GRIS = 'FFD9D9D9';
const AMARILLO = 'FFFFF2CC';
const solid = (argb: string): ExcelJS.Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
const FMT = '#,##0.00';
const FMT_CANT = '#,##0.###';

export interface LineaExport {
  bloque: BloqueCostoReal; concepto: string; detalle: string | null; codigo: string | null;
  cantidad: number; valor_unitario: number; porcentaje: number | null; total: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

// Fórmula sólo si reproduce el total guardado (las líneas importadas conservan
// el valor del Excel original aunque su fórmula no fuera cantidad × valor).
function celdaTotal(cell: ExcelJS.Cell, formula: string, l: LineaExport) {
  const calc = calcularTotal(l.cantidad, l.valor_unitario, l.porcentaje);
  cell.value = Math.abs(calc - l.total) < 0.01 ? { formula, result: l.total } : l.total;
  cell.numFmt = FMT;
}

function titulo(ws: ExcelJS.Worksheet, fila: number, texto: string) {
  const c = ws.getCell(`A${fila}`);
  c.value = texto;
  c.font = { bold: true, size: 12 };
}

function headers(ws: ExcelJS.Worksheet, fila: number, hs: string[]) {
  const row = ws.getRow(fila);
  hs.forEach((h, i) => {
    const c = row.getCell(i + 1);
    c.value = h; c.font = { bold: true }; c.fill = solid(GRIS); c.border = BORDE;
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });
}

// `lineas`: el total sale de las líneas y no de leer las celdas — ExcelJS no
// guarda el result de una fórmula cuando vale 0.
function filaTotal(ws: ExcelJS.Worksheet, fila: number, colLabel: number, colTotal: number, desde: number, hasta: number, letra: string, lineas: LineaExport[]) {
  const row = ws.getRow(fila);
  row.getCell(colLabel).value = 'TOTAL';
  const c = row.getCell(colTotal);
  const result = r2(lineas.reduce((a, l) => a + l.total, 0));
  c.value = hasta >= desde ? { formula: `SUM(${letra}${desde}:${letra}${hasta})`, result } : 0;
  c.numFmt = FMT;
  for (const col of [colLabel, colTotal]) {
    row.getCell(col).font = { bold: true };
    row.getCell(col).fill = solid(AMARILLO);
    row.getCell(col).border = BORDE;
  }
  return { celda: `${letra}${fila}`, result };
}

const SECCION_OPEX: Partial<Record<BloqueCostoReal, string>> = {
  STAFF:                'STAFF COSTS (COSTOS DE PERSONAL)',
  ALOJAMIENTO:          'RO COSTS (COSTOS DE ALOJAMIENTO)',
  COMIDAS:              'REF. COSTS (COSTOS DE REFRIGERIOS)',
  COMBUSTIBLE_PERSONAL: 'FC (FUEL COSTS) TRANSPORTACION DEL PERSONAL',
  COMBUSTIBLE_MATERIAL: 'FC (FUEL COSTS) TRANSPORTACION DE MATERIALES',
  PANOL:                'TC COSTS (COSTOS DE PAÑOL DE HERRAMIENTAS)',
  VARIOS:               'CAJA GASTOS VARIOS',
};

export async function generateCostoRealExcel(p: { nombre: string; lineas: LineaExport[] }): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Admin Portal';
  const porBloque = (b: BloqueCostoReal) => p.lineas.filter(l => l.bloque === b);
  const totalSheet: Partial<Record<BloqueCostoReal, { hoja: string; celda: string; result: number }>> = {};

  const cc = wb.addWorksheet('CC (CENTRO DE COSTOS)');

  // ── OPEX ────────────────────────────────────────────────────────────────────
  const opex = wb.addWorksheet('OPEX (COSTOS OPERACIONALES)');
  opex.columns = [{ width: 46 }, { width: 22 }, { width: 12 }, { width: 18 }, { width: 16 }, { width: 18 }];
  titulo(opex, 1, 'OPEX (COSTOS OPERACIONALES)');
  let fila = 3;
  for (const bloque of Object.keys(SECCION_OPEX) as BloqueCostoReal[]) {
    const esAloj = bloque === 'ALOJAMIENTO';
    titulo(opex, fila++, SECCION_OPEX[bloque]!);
    const info = INFO_BLOQUE[bloque];
    headers(opex, fila++, esAloj
      ? ['CONCEPTO', 'NOCHES', 'DIAS', 'DETALLE', info.valor.toUpperCase(), 'VAL. TOT.']
      : ['CONCEPTO', 'DETALLE', info.unidad.toUpperCase(), '', info.valor.toUpperCase(), 'VAL. TOT.']);
    const desde = fila;
    for (const l of porBloque(bloque)) {
      const row = opex.getRow(fila);
      row.getCell(1).value = l.concepto;
      if (esAloj) {
        row.getCell(2).value = l.cantidad; row.getCell(3).value = 1; row.getCell(4).value = l.detalle ?? '';
        celdaTotal(row.getCell(6), `B${fila}*E${fila}`, l);
      } else {
        row.getCell(2).value = l.detalle ?? '';
        row.getCell(3).value = l.cantidad;
        celdaTotal(row.getCell(6), `C${fila}*E${fila}`, l);
      }
      row.getCell(esAloj ? 2 : 3).numFmt = FMT_CANT;
      row.getCell(5).value = l.valor_unitario; row.getCell(5).numFmt = FMT;
      fila++;
    }
    const t = filaTotal(opex, fila, 5, 6, desde, fila - 1, 'F', porBloque(bloque));
    totalSheet[bloque] = { hoja: opex.name, ...t };
    fila += 2;
  }

  // ── Rental nacional / importado / pérdidas ─────────────────────────────────
  const nacLineas = porBloque('RENTAL_NAC');
  // A1 = % de alquiler del evento (como en la matriz); el más usado en las líneas
  const conteo = new Map<number, number>();
  for (const l of nacLineas) conteo.set(l.porcentaje ?? 4, (conteo.get(l.porcentaje ?? 4) ?? 0) + 1);
  const pctNac = [...conteo.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 4;

  const hojasDetalle: { bloque: BloqueCostoReal; nombre: string; titulo: string; hs: string[] }[] = [
    { bloque: 'RENTAL_NAC', nombre: 'RENTAL COSTS (NAC.)', titulo: 'MAT. RENTAL COSTS ( NACIONALES)',
      hs: ['NRO ITEM', 'DETALLE', 'MEDIDA', 'CANTIDAD', 'COSTO UNITARIO', 'COSTO TOTAL MATERIAL DE RENTAL', `${pctNac}%`] },
    { bloque: 'RENTAL_IMP', nombre: 'RENTAL COSTS (IMP.)', titulo: 'MAT. RENTAL COSTS ( IMPORTADOS)',
      hs: ['NRO ITEM', 'CODIGO OFICIAL', 'DETALLE', 'CANTIDAD', 'COSTO UNITARIO PESIFICADO', 'COSTO TOTAL MATERIAL DE RENTAL', '4% VALOR RENTAL'] },
    { bloque: 'PERDIDAS', nombre: 'L&A COSTS', titulo: 'L&A COSTS (COSTOS POR PERDIDAS O DEPRECIACION)',
      hs: ['NRO ITEM', 'DETALLE', 'MEDIDA', 'CANTIDAD', 'COSTO UNITARIO', 'COSTO TOTAL MATERIAL DE RENTAL', '10% VALOR (D&A)'] },
  ];
  for (const h of hojasDetalle) {
    const ws = wb.addWorksheet(h.nombre);
    ws.columns = [{ width: 10 }, { width: 46 }, { width: 18 }, { width: 12 }, { width: 18 }, { width: 22 }, { width: 18 }];
    if (h.bloque === 'RENTAL_NAC') ws.getCell('A1').value = pctNac;
    titulo(ws, 2, h.titulo);
    headers(ws, 4, h.hs);
    let r = 5;
    porBloque(h.bloque).forEach((l, i) => {
      const row = ws.getRow(r);
      row.getCell(1).value = i + 1;
      if (h.bloque === 'RENTAL_IMP') { row.getCell(2).value = l.codigo ?? ''; row.getCell(3).value = l.concepto; }
      else { row.getCell(2).value = l.concepto; row.getCell(3).value = l.detalle ?? ''; }
      row.getCell(4).value = l.cantidad; row.getCell(4).numFmt = FMT_CANT;
      row.getCell(5).value = l.valor_unitario; row.getCell(5).numFmt = FMT;
      row.getCell(6).value = { formula: `D${r}*E${r}`, result: r2(l.cantidad * l.valor_unitario) }; row.getCell(6).numFmt = FMT;
      const pct = l.porcentaje ?? 100;
      celdaTotal(row.getCell(7), `F${r}*${pct}%`, l);
      r++;
    });
    const t = filaTotal(ws, r, 6, 7, 5, r - 1, 'G', porBloque(h.bloque));
    totalSheet[h.bloque] = { hoja: ws.name, ...t };
  }

  // ── CC (resumen) ────────────────────────────────────────────────────────────
  cc.columns = [{ width: 22 }, { width: 24 }, { width: 20 }];
  cc.getCell('A2').value = 'CC. (CENTRO DE COSTOS)';
  cc.getCell('A2').font = { bold: true, size: 13 };
  cc.getCell('A3').value = p.nombre;
  cc.getCell('A3').font = { bold: true };
  headers(cc, 5, ['GRUPO', 'BLOQUE', '$']);
  let r = 6;
  const grupo = (b: BloqueCostoReal) => (b.startsWith('RENTAL') ? 'Rental Mat. Costs' : b === 'PERDIDAS' ? 'L&A Costs' : 'Opex');
  let anterior = '';
  for (const info of BLOQUES) {
    const t = totalSheet[info.bloque]!;
    const row = cc.getRow(r);
    const g = grupo(info.bloque);
    row.getCell(1).value = g === anterior ? '' : g;
    anterior = g;
    row.getCell(2).value = info.cc;
    row.getCell(3).value = { formula: `'${t.hoja}'!${t.celda}`, result: t.result };
    row.getCell(3).numFmt = FMT;
    r++;
  }
  const total = r2(BLOQUES.reduce((a, b) => a + totalSheet[b.bloque]!.result, 0));
  const tRow = cc.getRow(r + 1);
  tRow.getCell(2).value = 'TOTAL COSTO REAL';
  tRow.getCell(3).value = { formula: `SUM(C6:C${r - 1})`, result: total };
  tRow.getCell(3).numFmt = FMT;
  for (const c of [2, 3]) { tRow.getCell(c).font = { bold: true }; tRow.getCell(c).fill = solid(AMARILLO); tRow.getCell(c).border = BORDE; }

  return Buffer.from(await wb.xlsx.writeBuffer());
}
