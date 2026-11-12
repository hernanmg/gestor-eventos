import * as XLSX from 'xlsx';

// Parser de la planilla DOS57_BASE MATRICES_RENTAL COST (Florencia):
//   RENTAL COSTS (NAC.) — NRO ITEM | DETALLE | MEDIDA | CANTIDAD | COSTO UNITARIO |
//     COSTO TOTAL MATERIAL DE RENTAL | 2% | 4% | 6% | 8% | 10% | ALQUILER FULL
//   RENTAL COSTS (IMP.) — NRO ITEM | CODIGO OFICIAL | DETALLE | PESO X UNID | CANTIDAD |
//     COSTO UNITARIO | COSTO UNITARIO PESIFICADO | COSTO TOTAL MATERIAL DE RENTAL | 4% VALOR RENTAL
//
// Verificado contra la planilla real:
//  - CANTIDAD está en 0 en todas las filas, así que las columnas de % valen 0
//    siempre. Un % está "habilitado" si la celda tiene fórmula (=F8*2%); las
//    filas sin ese % tienen un 0 escrito a mano. Por eso se lee con cellFormula.
//  - El TC de la pesificación está en la celda arriba del encabezado de
//    PESIFICADO (H5 = 1700) y las fórmulas lo referencian (=G7*$H$5).
//  - La hoja IMP arranca en la columna B; el mapeo es siempre por encabezado.
//  - El pesificado de IMP se recalcula siempre como USD × TC: en la planilla
//    real el ítem 10 (AR O-Horizontal LW 0.86m) tiene =G16+H5 en vez de
//    =G16*H5 ($ 1.745,89 en lugar de $ 78.013). Si difiere, va a advertencias.

export type OrigenMaterial = 'NAC' | 'IMP';

export interface MaterialParseado {
  origen:             OrigenMaterial;
  hoja:               string;
  fila:               number; // fila de Excel (1-based)
  nro_item:           number;
  codigo_oficial:     string | null;
  detalle:            string;
  medida:             string | null;
  peso_por_unidad:    number | null;
  costo_unitario_ars: number | null;
  costo_unitario_usd: number | null;
  tipo_cambio:        number | null;
  porc_2: boolean; porc_4: boolean; porc_6: boolean; porc_8: boolean; porc_10: boolean; porc_full: boolean;
}

export interface ErrorImportMaterial { hoja: string; fila: number; mensaje: string }

export interface ParseoMateriales {
  materiales:  MaterialParseado[];
  errores:     ErrorImportMaterial[];
  advertencias: ErrorImportMaterial[];
  hojas:       { hoja: string; origen: OrigenMaterial; items: number }[];
  tipo_cambio: number | null;          // TC con el que se pesificaron los IMP
  tipo_cambio_planilla: number | null; // TC escrito en la planilla (H5)
}

export const TIPO_CAMBIO_DEFAULT = 1700;

const norm = (v: unknown) =>
  String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();

const round2 = (n: number) => Math.round(n * 100) / 100;

function numero(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const t = v.trim();
    if (!t) return null;
    // "1.234,56" (es-AR) o "1234.56"
    const n = Number(/,\d{1,2}$/.test(t) ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, ''));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function texto(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const t = String(v).replace(/\s+/g, ' ').trim();
  return t || null;
}

type Celda = XLSX.CellObject | undefined;

function leerHoja(ws: XLSX.WorkSheet) {
  const rango = XLSX.utils.decode_range(ws['!ref'] ?? 'A1:A1');
  const celda = (r: number, c: number): Celda => ws[XLSX.utils.encode_cell({ r, c })];
  return { rango, celda };
}

// Fila (0-based) cuyo primer valor no vacío es "NRO ITEM", y mapa encabezado → columna
function buscarEncabezado(ws: XLSX.WorkSheet): { fila: number; cols: Map<string, number> } | null {
  const { rango, celda } = leerHoja(ws);
  for (let r = rango.s.r; r <= Math.min(rango.e.r, rango.s.r + 30); r++) {
    for (let c = rango.s.c; c <= rango.e.c; c++) {
      const v = celda(r, c)?.v;
      if (v === undefined || v === null || v === '') continue;
      if (norm(v) !== 'NRO ITEM') break;
      const cols = new Map<string, number>();
      for (let c2 = rango.s.c; c2 <= rango.e.c; c2++) {
        const h = norm(celda(r, c2)?.v);
        if (h && !cols.has(h)) cols.set(h, c2);
      }
      return { fila: r, cols };
    }
  }
  return null;
}

const col = (cols: Map<string, number>, ...nombres: string[]) => {
  for (const n of nombres) { const c = cols.get(n); if (c !== undefined) return c; }
  return undefined;
};

// % habilitado: la celda tiene fórmula, o un valor > 0 (planilla con cantidades cargadas)
function porcHabilitado(c: Celda): boolean {
  if (!c) return false;
  if (c.f) return true;
  const n = numero(c.v);
  return n !== null && n > 0;
}

function esFilaDescartable(detalle: string | null): boolean {
  if (!detalle) return true;
  const d = norm(detalle);
  return d.startsWith('TOTAL') || d.startsWith('SUBTOTAL');
}

function parseNac(ws: XLSX.WorkSheet, hoja: string, out: ParseoMateriales) {
  const enc = buscarEncabezado(ws);
  if (!enc) { out.errores.push({ hoja, fila: 0, mensaje: 'No se encontró el encabezado "NRO ITEM"' }); return 0; }
  const { rango, celda } = leerHoja(ws);
  const c = {
    nro:     col(enc.cols, 'NRO ITEM'),
    detalle: col(enc.cols, 'DETALLE'),
    medida:  col(enc.cols, 'MEDIDA'),
    costo:   col(enc.cols, 'COSTO UNITARIO'),
    p2:      col(enc.cols, '2%'),
    p4:      col(enc.cols, '4%'),
    p6:      col(enc.cols, '6%'),
    p8:      col(enc.cols, '8%'),
    p10:     col(enc.cols, '10%'),
    full:    col(enc.cols, 'ALQUILER FULL', 'FULL'),
  };
  const faltan = Object.entries(c).filter(([, v]) => v === undefined).map(([k]) => k);
  if (faltan.length) { out.errores.push({ hoja, fila: enc.fila + 1, mensaje: `Faltan columnas: ${faltan.join(', ')}` }); return 0; }

  let items = 0;
  for (let r = enc.fila + 1; r <= rango.e.r; r++) {
    const detalle = texto(celda(r, c.detalle!)?.v);
    if (esFilaDescartable(detalle)) continue;
    const fila = r + 1;
    const nro = numero(celda(r, c.nro!)?.v);
    if (nro === null || !Number.isInteger(nro)) { out.errores.push({ hoja, fila, mensaje: `"${detalle}" sin NRO ITEM válido` }); continue; }
    const costo = numero(celda(r, c.costo!)?.v);
    out.materiales.push({
      origen: 'NAC', hoja, fila,
      nro_item:           nro,
      codigo_oficial:     null,
      detalle:            detalle!,
      medida:             texto(celda(r, c.medida!)?.v),
      peso_por_unidad:    null,
      costo_unitario_ars: costo !== null ? round2(costo) : null,
      costo_unitario_usd: null,
      tipo_cambio:        null,
      porc_2:    porcHabilitado(celda(r, c.p2!)),
      porc_4:    porcHabilitado(celda(r, c.p4!)),
      porc_6:    porcHabilitado(celda(r, c.p6!)),
      porc_8:    porcHabilitado(celda(r, c.p8!)),
      porc_10:   porcHabilitado(celda(r, c.p10!)),
      porc_full: porcHabilitado(celda(r, c.full!)),
    });
    items++;
  }
  return items;
}

function parseImp(ws: XLSX.WorkSheet, hoja: string, out: ParseoMateriales, tcForzado: number | null) {
  const enc = buscarEncabezado(ws);
  if (!enc) { out.errores.push({ hoja, fila: 0, mensaje: 'No se encontró el encabezado "NRO ITEM"' }); return 0; }
  const { rango, celda } = leerHoja(ws);
  const c = {
    nro:     col(enc.cols, 'NRO ITEM'),
    codigo:  col(enc.cols, 'CODIGO OFICIAL'),
    detalle: col(enc.cols, 'DETALLE'),
    peso:    col(enc.cols, 'PESO X UNID'),
    usd:     col(enc.cols, 'COSTO UNITARIO (USD)', 'COSTO UNITARIO'),
    ars:     col(enc.cols, 'COSTO UNITARIO PESIFICADO'),
  };
  const faltan = Object.entries(c).filter(([, v]) => v === undefined).map(([k]) => k);
  if (faltan.length) { out.errores.push({ hoja, fila: enc.fila + 1, mensaje: `Faltan columnas: ${faltan.join(', ')}` }); return 0; }

  // TC: número en la columna PESIFICADO por encima del encabezado (H5)
  let tc: number | null = null;
  for (let r = enc.fila - 1; r >= rango.s.r && tc === null; r--) {
    const n = numero(celda(r, c.ars!)?.v);
    if (n !== null && n > 0) tc = n;
  }
  out.tipo_cambio_planilla = tc;
  // TC forzado = el usuario eligió el del sistema (dólar oficial) en vez del de la planilla
  out.tipo_cambio = tcForzado ?? tc ?? TIPO_CAMBIO_DEFAULT;
  if (tc === null && tcForzado === null) out.errores.push({ hoja, fila: enc.fila, mensaje: `No se encontró el tipo de cambio arriba del encabezado — se usa ${TIPO_CAMBIO_DEFAULT}` });

  let items = 0;
  for (let r = enc.fila + 1; r <= rango.e.r; r++) {
    const detalle = texto(celda(r, c.detalle!)?.v);
    if (esFilaDescartable(detalle)) continue;
    const fila = r + 1;
    const nro = numero(celda(r, c.nro!)?.v);
    if (nro === null || !Number.isInteger(nro)) { out.errores.push({ hoja, fila, mensaje: `"${detalle}" sin NRO ITEM válido` }); continue; }
    const usd = numero(celda(r, c.usd!)?.v);
    const arsPlanilla = numero(celda(r, c.ars!)?.v);
    const ars = usd !== null ? round2(usd * out.tipo_cambio) : arsPlanilla;
    // Control de la fórmula de la planilla contra su propio TC (no el forzado)
    const arsEsperado = usd !== null && tc !== null ? round2(usd * tc) : null;
    if (arsEsperado !== null && arsPlanilla !== null && Math.abs(arsPlanilla - arsEsperado) > 1) {
      out.advertencias.push({ hoja, fila, mensaje: `Ítem ${nro} "${detalle}": la planilla pesifica US$ ${usd} a $ ${arsPlanilla} (fórmula ${celda(r, c.ars!)?.f ?? 'sin fórmula'}); se usa US$ × TC = $ ${ars}` });
    }
    out.materiales.push({
      origen: 'IMP', hoja, fila,
      nro_item:           nro,
      codigo_oficial:     texto(celda(r, c.codigo!)?.v),
      detalle:            detalle!,
      medida:             null,
      peso_por_unidad:    numero(celda(r, c.peso!)?.v),
      costo_unitario_usd: usd !== null ? round2(usd) : null,
      costo_unitario_ars: ars !== null ? round2(ars) : null,
      tipo_cambio:        out.tipo_cambio,
      porc_2: false, porc_4: true, porc_6: false, porc_8: false, porc_10: false, porc_full: false,
    });
    items++;
  }
  return items;
}

export function parsePlanillaMaterialesRental(buffer: Buffer, tcForzado: number | null = null): ParseoMateriales {
  const wb = XLSX.read(buffer, { type: 'buffer', cellFormula: true });
  const out: ParseoMateriales = { materiales: [], errores: [], advertencias: [], hojas: [], tipo_cambio: null, tipo_cambio_planilla: null };
  for (const hoja of wb.SheetNames) {
    const n = norm(hoja);
    if (!n.includes('RENTAL')) continue;
    if (/\bNAC\b/.test(n)) out.hojas.push({ hoja, origen: 'NAC', items: parseNac(wb.Sheets[hoja], hoja, out) });
    else if (/\bIMP\b/.test(n)) out.hojas.push({ hoja, origen: 'IMP', items: parseImp(wb.Sheets[hoja], hoja, out, tcForzado) });
  }
  return out;
}

// Clave de upsert: origen + nro_item + codigo_oficial
export const claveMaterial = (m: { origen: string; nro_item: number | null; codigo_oficial: string | null }) =>
  `${m.origen}|${m.nro_item ?? ''}|${m.codigo_oficial ?? ''}`;

// ── Cálculo de presupuesto (compartido por los endpoints) ─────────────────────

export const PORCENTAJES_ALQUILER = ['2', '4', '6', '8', '10', 'FULL'] as const;
export type PorcentajeAlquiler = typeof PORCENTAJES_ALQUILER[number];

// IMP: siempre 4%. NAC: el del presupuesto; FULL = 100% (en la planilla FULL
// es un valor negociado por ítem, ver nota en el reporte de la feature).
export function porcentajeLinea(origen: OrigenMaterial, porcentaje: PorcentajeAlquiler): number {
  if (origen === 'IMP') return 4;
  return porcentaje === 'FULL' ? 100 : Number(porcentaje);
}

// Precio unitario en ARS para el snapshot: IMP = USD × TC del presupuesto
// (si el ítem no tiene USD, su precio pesificado); NAC = costo_unitario_ars.
// Ítem sin precio → 0 (el usuario lo carga en el catálogo).
export function costoUnitarioLinea(
  m: { origen: OrigenMaterial; costo_unitario_ars: number | null; costo_unitario_usd: number | null },
  tipoCambio: number,
): number {
  if (m.origen === 'IMP' && m.costo_unitario_usd !== null) return round2(m.costo_unitario_usd * tipoCambio);
  return m.costo_unitario_ars ?? 0;
}

export function calcularLinea(
  m: { origen: OrigenMaterial; costo_unitario_ars: number | null; costo_unitario_usd: number | null },
  cantidad: number, porcentaje: PorcentajeAlquiler, tipoCambio: number,
) {
  const unitario = costoUnitarioLinea(m, tipoCambio);
  const pct = porcentajeLinea(m.origen, porcentaje);
  const total = round2(cantidad * unitario);
  return {
    costo_unitario_snap:  unitario,
    tipo_cambio_snap:     m.origen === 'IMP' ? tipoCambio : null,
    porcentaje_snap:      pct,
    costo_total_material: total,
    valor_rental:         round2(total * pct / 100),
  };
}
