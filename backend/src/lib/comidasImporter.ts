import ExcelJS from 'exceljs';
import type { TipoComida } from '@prisma/client';
import { celdasFila, masterRaw, esVacio, aNumero, normTexto, parseFechaTexto } from './pedidosMaterialImporter';

// Parser de las planillas de control de comidas de Enjoy. Dos formatos:
//
//   docs/enjoy/dani/Fiesta Nacional de la Pelota _ Planilla Control de Viandas.xlsx
//     Una hoja por semana (y otra "(MATI)" con lo de Matías):
//     FECHA | MENÚ | HORA | [CANTIDAD] | TIPO MENU | VALOR | DETALLE | TOTAL UNIDADES | TOTAL
//     VALOR es por unidad y TOTAL el de la fila → área = tipo de menú (Plato / Vianda).
//
//   docs/enjoy/dani/L'ETAPE - Planilla control de comidas.xlsx
//     FECHA | MENÚ | CANTIDAD | DETALLE | PROVEEDOR | FORMA DE PAGO | COSTO | TOTAL
//     COSTO es el total de la línea y TOTAL el del día; hay varios proveedores por
//     día → área = proveedor, valor unitario = costo / cantidad.
//
// FECHA y MENÚ vienen combinadas por día / comida: se arrastran hacia abajo.

export interface LineaComidaParseada {
  hoja: string;
  fila_excel: number;
  fecha: string;            // YYYY-MM-DD
  tipo: TipoComida;
  area: string;
  cantidad: number;
  valor_unitario: number | null;
  total: number;            // cantidad × valor (o el costo de la línea)
  detalle: string | null;
  proveedor: string | null;
  forma_pago: string | null;
}

export interface HojaComidas {
  hoja: string;
  lugar: string | null;
  desde: string | null;
  hasta: string | null;
  lineas: LineaComidaParseada[];
  personas: number;
  total_calculado: number;
  total_planilla: number | null;
  /** Filas cuyo total en el Excel no coincide con cantidad × valor (fórmula rota, celda pisada). */
  diferencias: { fila_excel: number; fecha: string; detalle: string | null; calculado: number; planilla: number; formula: string | null }[];
  omitidas: { fila_excel: number; motivo: string }[];
  advertencias: string[];
}

const k = (s: string) => normTexto(s).replace(/ /g, '');
const red2 = (n: number) => Math.round(n * 100) / 100;

function tipoComida(t: string | null): TipoComida | null {
  const n = normTexto(t);
  if (n.startsWith('almuerzo')) return 'ALMUERZO';
  if (n.startsWith('cena')) return 'CENA';
  if (n.startsWith('desayuno')) return 'DESAYUNO';
  if (n.startsWith('merienda')) return 'MERIENDA';
  return null;
}

const titulo = (s: string) => s.trim().toLowerCase().replace(/(^|\s)\p{L}/gu, m => m.toUpperCase());

function parseHoja(ws: ExcelJS.Worksheet, ref: Date | null): HojaComidas | null {
  let fila = 0;
  let cols = new Map<string, number>();
  for (let r = 1; r <= Math.min(ws.rowCount, 15) && !fila; r++) {
    const m = new Map<string, number>();
    for (const { c, text } of celdasFila(ws, r)) { const key = k(text); if (key && !m.has(key)) m.set(key, c); }
    if (m.has('fecha') && m.has('menu') && (m.has('valor') || m.has('costo'))) { fila = r; cols = m; }
  }
  if (!fila) return null;

  // Lugar: "LUGAR: PREDIO FESTIVAL DE LA PELOTA" en el encabezado
  let lugar: string | null = null;
  for (let r = 1; r < fila && !lugar; r++) {
    const t = celdasFila(ws, r).find(x => /^lugar\s*:/i.test(x.text));
    if (t) lugar = t.text.replace(/^lugar\s*:\s*/i, '').trim() || null;
  }

  const cFecha = cols.get('fecha')!; const cMenu = cols.get('menu')!;
  const cTipoMenu = cols.get('tipomenu');
  const cCosto = cols.get('costo');                 // L'ETAPE: total de la línea
  const cValor = cCosto ? undefined : cols.get('valor');
  const cCant = cols.get('totalunidades') ?? cols.get('cantidad');
  const cTotal = cCosto ? undefined : cols.get('total');  // Pelota: total de la fila (para el control)
  const cTotalDia = cCosto ? cols.get('total') : undefined;
  const cDetalle = cols.get('detalle'); const cProv = cols.get('proveedor'); const cForma = cols.get('formadepago');

  // "(MATI)" en el nombre de la hoja: lo de Matías va en un área aparte
  const sufijo = /\(([^)]+)\)\s*$/.exec(ws.name)?.[1]?.trim() ?? null;

  const out: HojaComidas = {
    hoja: ws.name, lugar, desde: null, hasta: null, lineas: [], personas: 0, total_calculado: 0,
    total_planilla: null, diferencias: [], omitidas: [], advertencias: [],
  };
  const txt = (r: number, c?: number) => {
    if (!c) return null;
    const v = masterRaw(ws, r, c);
    if (esVacio(v)) return null;
    const t = String(v).trim();
    return t && t !== '-' ? t : null;
  };

  let fecha: string | null = null;
  let tipo: TipoComida | null = null;
  for (let r = fila + 1; r <= ws.rowCount; r++) {
    const fRaw = masterRaw(ws, r, cFecha);
    if (!esVacio(fRaw) && /^total/i.test(String(fRaw).trim())) {
      const tot = aNumero(masterRaw(ws, r, cTotal ?? cTotalDia ?? cCosto ?? 0));
      if (tot !== null) out.total_planilla = tot;
      break;
    }
    if (!esVacio(fRaw)) { fecha = parseFechaTexto(fRaw, ref) ?? fecha; tipo = null; }
    const menu = txt(r, cMenu);
    if (menu) tipo = tipoComida(menu) ?? tipo;
    const celdas = celdasFila(ws, r);
    if (celdas.length === 0) continue;
    if (!fecha || !tipo) continue;

    const cantRaw = cCant ? masterRaw(ws, r, cCant) : null;
    let cantidad = aNumero(cantRaw);
    const detalle = txt(r, cDetalle);
    const proveedor = txt(r, cProv);
    const forma_pago = txt(r, cForma);

    let valor_unitario: number | null;
    let total: number;
    if (cCosto) {
      const costo = aNumero(masterRaw(ws, r, cCosto));
      if (costo === null || costo === 0) {
        // Personas sin costo conocido ("N/S"): se cargan sin valor para que cuenten
        if (cantidad && cantidad > 0) {
          out.advertencias.push(`Fila ${r}: ${cantidad} ${proveedor ? `de ${proveedor} ` : ''}sin costo (${txt(r, cCosto) ?? 'vacío'}) — se cargan sin valor`);
          const area = sufijo ? `${proveedor ?? 'General'} — ${titulo(sufijo)}` : proveedor ?? 'General';
          out.lineas.push({
            hoja: ws.name, fila_excel: r, fecha, tipo, area, cantidad: Math.round(cantidad), valor_unitario: null, total: 0,
            detalle: [detalle, forma_pago ? `Pago: ${forma_pago.trim()}` : null].filter(Boolean).join(' · ') || null,
            proveedor, forma_pago: forma_pago?.trim() ?? null,
          });
        } else if (proveedor || detalle) {
          out.omitidas.push({ fila_excel: r, motivo: `Sin cantidad ni costo (${txt(r, cCosto) ?? txt(r, cForma) ?? 'vacío'})` });
        }
        continue;
      }
      if (!cantidad) {
        // CENA del 19/03 en L'ETAPE: costo sin cantidad → una línea con el costo completo
        out.advertencias.push(`Fila ${r}: ${proveedor ?? ''} $${costo} sin cantidad — se carga como 1`);
        cantidad = 1;
      }
      total = costo;
      valor_unitario = red2(costo / cantidad);
    } else {
      const valor = aNumero(masterRaw(ws, r, cValor!));
      if (!cantidad || !valor) continue; // filas en 0 (días sin comida de la hoja de Matías)
      valor_unitario = valor;
      total = red2(cantidad * valor);
      // Una fórmula sin valor guardado (SEMANA 1 fila 19: =E19*G26, apunta a una
      // celda vacía) en Excel da 0: se cuenta como 0 y se muestra la fórmula.
      const celdaTotal = cTotal ? ws.getCell(r, cTotal).value as any : null;
      const formula = celdaTotal && typeof celdaTotal === 'object' && celdaTotal.formula && celdaTotal.result === undefined ? `=${celdaTotal.formula}` : null;
      const totPlanilla = formula ? 0 : cTotal ? aNumero(masterRaw(ws, r, cTotal)) : null;
      if (totPlanilla !== null && Math.abs(totPlanilla - total) > 0.5) {
        out.diferencias.push({ fila_excel: r, fecha, detalle, calculado: total, planilla: totPlanilla, formula });
      }
    }

    const tipoMenu = cTipoMenu ? txt(r, cTipoMenu) : null;
    const base = tipoMenu ? titulo(tipoMenu) : proveedor ? proveedor.trim() : 'General';
    const area = sufijo ? `${base} — ${titulo(sufijo)}` : base;

    out.lineas.push({
      hoja: ws.name, fila_excel: r, fecha, tipo, area, cantidad: Math.round(cantidad), valor_unitario, total,
      detalle: [detalle, cCosto && forma_pago ? `Pago: ${forma_pago.trim()}` : null].filter(Boolean).join(' · ') || null,
      proveedor, forma_pago: forma_pago?.trim() ?? null,
    });
  }

  if (out.lineas.length === 0) return out;
  const fechas = out.lineas.map(l => l.fecha).sort();
  out.desde = fechas[0]; out.hasta = fechas[fechas.length - 1];
  out.personas = out.lineas.reduce((a, l) => a + l.cantidad, 0);
  out.total_calculado = red2(out.lineas.reduce((a, l) => a + l.total, 0));
  return out;
}

/**
 * Dos líneas del mismo día, comida y área (dos pedidos a HAKA el mismo almuerzo)
 * se suman en una: el modelo guarda una línea por (día, comida, área).
 */
export function unirLineas(lineas: LineaComidaParseada[]): LineaComidaParseada[] {
  const por = new Map<string, LineaComidaParseada>();
  for (const l of lineas) {
    const key = `${l.fecha}|${l.tipo}|${normTexto(l.area)}`;
    const prev = por.get(key);
    if (!prev) { por.set(key, { ...l }); continue; }
    prev.cantidad += l.cantidad;
    prev.total = red2(prev.total + l.total);
    prev.valor_unitario = prev.cantidad && prev.total ? red2(prev.total / prev.cantidad) : prev.valor_unitario ?? l.valor_unitario;
    prev.detalle = [prev.detalle, l.detalle].filter(Boolean).join(' + ') || null;
  }
  return [...por.values()];
}

export async function parseComidas(buffer: Buffer, fechaEvento: Date | null): Promise<HojaComidas[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as any);
  const hojas = wb.worksheets.map(ws => parseHoja(ws, fechaEvento)).filter((h): h is HojaComidas => !!h);
  if (hojas.length === 0) throw new Error('No se encontró la planilla de comidas (se esperan las columnas FECHA, MENÚ y VALOR o COSTO)');
  return hojas;
}
