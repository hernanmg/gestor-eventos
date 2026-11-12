import ExcelJS from 'exceljs';
import type { BloqueCostoReal } from '@prisma/client';
import { normalizarCodigo, normalizarTexto, type LineaDraft } from './costoReal';

// Importador de la matriz de costo real de Flor (formato de
// docs/dos57/jazmin/DOS57_NORTE ROCK_2026.xlsx). Lee los valores que calculó el
// Excel (no recalcula las fórmulas): así el total importado coincide con el de
// la hoja CC aunque alguna fórmula de la planilla no sea cantidad × valor.
//
// - OPEX: secciones por título en la columna A (STAFF COSTS, REF. COSTS, RO
//   COSTS, FC … PERSONAL, FC … MATERIALES, TC COSTS, CAJA GASTOS VARIOS). Cada
//   fila con concepto en A y total en F es una línea; las filas sin total se omiten.
// - RENTAL COSTS (NAC.) / (IMP.) / L&A COSTS: filas con CANTIDAD > 0.
// - CC: título del evento y total ("RENTAL PROYECTO" → SUM) para controlar.
// Las hojas de detalle (STAFF COSTS, REF. COSTS, ALOJAMIENTO, COMBUSTIBLE
// DINERO) alimentan a OPEX dentro del Excel, así que no se importan aparte.

export interface MatrizImportada {
  titulo:          string | null;
  total_planilla:  number | null;
  porBloque:       Partial<Record<BloqueCostoReal, LineaDraft[]>>;
  omitidas:        number;
  hojas:           string[];
  avisos:          string[];
}

function valor(c: ExcelJS.Cell): unknown {
  const v = c.value as any;
  if (v && typeof v === 'object') {
    if ('result' in v) return v.result;
    if ('richText' in v) return v.richText.map((t: any) => t.text).join('');
    if ('text' in v) return v.text;
    if ('error' in v) return null;
  }
  return v;
}

function num(c: ExcelJS.Cell): number | null {
  const v = valor(c);
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  return null;
}

function texto(c: ExcelJS.Cell): string {
  const v = valor(c);
  if (v == null) return '';
  if (v instanceof Date) return '';
  return String(v).replace(/\s+/g, ' ').trim();
}

const r2 = (n: number) => Math.round(n * 100) / 100;

function hoja(wb: ExcelJS.Workbook, prefijo: RegExp) {
  return wb.worksheets.find(ws => prefijo.test(normalizarTexto(ws.name)));
}

// Fila de encabezados: la primera que tiene una celda "CANTIDAD"
function encabezados(ws: ExcelJS.Worksheet): { fila: number; col: Map<string, number>; textos: [number, string][] } | null {
  for (let r = 1; r <= Math.min(ws.rowCount, 30); r++) {
    const row = ws.getRow(r);
    const textos: [number, string][] = [];
    row.eachCell((c, col) => { const t = normalizarTexto(texto(c)); if (t) textos.push([col, t]); });
    if (textos.some(([, t]) => t === 'CANTIDAD')) {
      return { fila: r, col: new Map(textos.map(([c, t]) => [t, c])), textos };
    }
  }
  return null;
}

const SECCIONES_OPEX: [RegExp, BloqueCostoReal][] = [
  [/^STAFF COSTS/, 'STAFF'],
  [/^REF\.? COSTS/, 'COMIDAS'],
  [/^RO COSTS/, 'ALOJAMIENTO'],
  [/^FC .*PERSONAL/, 'COMBUSTIBLE_PERSONAL'],
  [/^FC .*MATERIAL/, 'COMBUSTIBLE_MATERIAL'],
  [/^TC COSTS/, 'PANOL'],
  [/^CAJA GASTOS VARIOS/, 'VARIOS'],
];

function leerOpex(ws: ExcelJS.Worksheet, out: MatrizImportada) {
  let seccion: BloqueCostoReal | null = null;
  for (let r = 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const a = texto(row.getCell(1));
    if (!a) continue;
    const titulo = SECCIONES_OPEX.find(([re]) => re.test(normalizarTexto(a)));
    if (titulo) { seccion = titulo[1]; continue; }
    if (!seccion) continue;

    const total = num(row.getCell(6));
    // Sin total: fila sin valores (ej. PLANCHA PARA DESCARGA). Total con texto: encabezado.
    if (!total) { if (!texto(row.getCell(6))) out.omitidas++; continue; }

    // Alojamiento: B = noches, C = días, D = texto "26.500 x pax"
    const esAloj = seccion === 'ALOJAMIENTO';
    const b = num(row.getCell(2));
    const c = num(row.getCell(3));
    let cantidad = esAloj ? (b && b > 0 ? b : c) : c;
    // Staff: D = valor turno fijo, E = valor turno eventual (uno de los dos)
    let valorUnit = [num(row.getCell(5)), num(row.getCell(4))].find(v => v != null && v > 0) ?? null;
    if (!cantidad || cantidad <= 0) { cantidad = 1; valorUnit = total; }
    if (valorUnit == null || Math.abs(cantidad * valorUnit - total) > 1) valorUnit = r2(total / cantidad);

    const detalle = esAloj ? texto(row.getCell(4)) : (b == null ? texto(row.getCell(2)) : '');
    (out.porBloque[seccion] ??= []).push({
      concepto: a, detalle: detalle || null, cantidad, valor_unitario: valorUnit, total: r2(total),
    });
  }
}

function leerRental(ws: ExcelJS.Worksheet, bloque: 'RENTAL_NAC' | 'RENTAL_IMP', out: MatrizImportada) {
  const h = encabezados(ws);
  if (!h) { out.avisos.push(`La hoja "${ws.name}" no tiene la fila de encabezados (CANTIDAD).`); return; }
  const col = (re: RegExp) => h.textos.find(([, t]) => re.test(t))?.[0];
  const cDetalle  = col(/^DETALLE$/);
  const cCantidad = h.col.get('CANTIDAD')!;
  const cCodigo   = col(/^CODIGO/);
  const cMedida   = col(/^MEDIDA$/);
  let pct = 4;
  let cValor: number | undefined;
  let cTotal: number | undefined;
  if (bloque === 'RENTAL_NAC') {
    // El % del evento está en A1 (la planilla base trae 4)
    const a1 = num(ws.getCell('A1'));
    if (a1 && a1 > 0) pct = a1;
    cValor = col(/^COSTO UNITARIO$/);
    cTotal = col(new RegExp(`^${pct}\\s*%$`));
    if (!cTotal) {
      out.avisos.push(`Rental nacional: no se encontró la columna ${pct}% — se usó la de 4%.`);
      pct = 4; cTotal = col(/^4\s*%$/);
    }
  } else {
    cValor = col(/PESIFICADO/);
    cTotal = col(/%/);
  }
  if (!cDetalle || !cTotal) { out.avisos.push(`La hoja "${ws.name}" no tiene las columnas esperadas.`); return; }

  for (let r = h.fila + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const cantidad = num(row.getCell(cCantidad));
    const detalle = texto(row.getCell(cDetalle));
    if (!cantidad || cantidad <= 0 || !detalle) continue;
    const medida = cMedida ? texto(row.getCell(cMedida)) : '';
    (out.porBloque[bloque] ??= []).push({
      concepto:       detalle,
      detalle:        medida || null,
      codigo:         cCodigo ? normalizarCodigo(texto(row.getCell(cCodigo))) || null : null,
      cantidad,
      valor_unitario: (cValor ? num(row.getCell(cValor)) : null) ?? 0,
      porcentaje:     pct,
      total:          r2(num(row.getCell(cTotal)) ?? 0),
    });
  }
}

function leerPerdidas(ws: ExcelJS.Worksheet, out: MatrizImportada) {
  const h = encabezados(ws);
  if (!h) { out.avisos.push(`La hoja "${ws.name}" no tiene la fila de encabezados (CANTIDAD).`); return; }
  const pctCol = h.textos.find(([, t]) => /%/.test(t));
  const cDetalle = h.textos.find(([, t]) => t === 'DETALLE')?.[0];
  const cValor = h.textos.find(([, t]) => t === 'COSTO UNITARIO')?.[0];
  if (!pctCol || !cDetalle) { out.avisos.push(`La hoja "${ws.name}" no tiene las columnas esperadas.`); return; }
  const pct = Number(pctCol[1].match(/(\d+(?:[.,]\d+)?)\s*%/)?.[1]?.replace(',', '.')) || 10;
  const cCantidad = h.col.get('CANTIDAD')!;
  for (let r = h.fila + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const cantidad = num(row.getCell(cCantidad));
    const detalle = texto(row.getCell(cDetalle));
    if (!cantidad || cantidad <= 0 || !detalle) continue;
    (out.porBloque.PERDIDAS ??= []).push({
      concepto: detalle, cantidad,
      valor_unitario: (cValor ? num(row.getCell(cValor)) : null) ?? 0,
      porcentaje: pct,
      total: r2(num(row.getCell(pctCol[0])) ?? 0),
    });
  }
}

function leerCC(ws: ExcelJS.Worksheet, out: MatrizImportada) {
  for (let r = 1; r <= Math.min(ws.rowCount, 10) && !out.titulo; r++) {
    const t = texto(ws.getRow(r).getCell(1));
    if (t && /_/.test(t)) out.titulo = t;
  }
  for (let r = 1; r <= Math.min(ws.rowCount, 60); r++) {
    const row = ws.getRow(r);
    let esTotal = false;
    row.eachCell(c => { if (/RENTAL PROYECTO|^TOTAL/.test(normalizarTexto(texto(c)))) esTotal = true; });
    if (!esTotal) continue;
    row.eachCell(c => {
      const v = c.value as any;
      if (out.total_planilla == null && v && typeof v === 'object' && /SUM\(/i.test(v.formula ?? '') && typeof v.result === 'number') {
        out.total_planilla = r2(v.result);
      }
    });
    if (out.total_planilla != null) break;
  }
}

export async function parseMatrizCostoReal(buffer: Buffer): Promise<MatrizImportada> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer as any);
  } catch {
    throw new Error('No se pudo leer el archivo. ¿Es un .xlsx?');
  }
  const out: MatrizImportada = { titulo: null, total_planilla: null, porBloque: {}, omitidas: 0, hojas: [], avisos: [] };

  const opex = hoja(wb, /^OPEX/);
  const nac  = hoja(wb, /^RENTAL COSTS \(NAC/);
  const imp  = hoja(wb, /^RENTAL COSTS \(IMP/);
  const la   = hoja(wb, /^L&A/);
  const cc   = hoja(wb, /^CC/);
  if (!opex && !nac && !imp && !la) {
    throw new Error('El archivo no tiene las hojas de la matriz de costo real (OPEX, RENTAL COSTS, L&A COSTS).');
  }
  if (opex) { leerOpex(opex, out); out.hojas.push(opex.name); }
  if (nac)  { leerRental(nac, 'RENTAL_NAC', out); out.hojas.push(nac.name); }
  if (imp)  { leerRental(imp, 'RENTAL_IMP', out); out.hojas.push(imp.name); }
  if (la)   { leerPerdidas(la, out); out.hojas.push(la.name); }
  if (cc)   leerCC(cc, out);
  for (const [nombre, ws] of [['OPEX', opex], ['RENTAL COSTS (NAC.)', nac], ['RENTAL COSTS (IMP.)', imp], ['L&A COSTS', la]] as const) {
    if (!ws) out.avisos.push(`Falta la hoja ${nombre}: esos bloques no se importan.`);
  }
  return out;
}
