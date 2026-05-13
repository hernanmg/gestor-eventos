import * as XLSX from 'xlsx';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MovimientoPreview {
  fila_excel:              number;
  fecha:                   string | null;
  concepto:                string | null;
  descripcion:             string | null;
  debe:                    number;
  haber:                   number;
  impuesto_subcategoria?:  string | null;
  advertencias:            string[];
  errores:                 string[];
}

export interface EcheqPreview {
  fila_excel:           number;
  numero:               string;
  razon_social:         string;
  detalle:              string | null;
  importe:              number;
  fecha_emision:        string | null;
  fecha_cobro_estimada: string | null;
}

export interface HojaPreview {
  codigo:               string;
  nombre_hoja_original: string;
  tipo:                 'EGRESO' | 'INGRESO';
  tab_numero:           number;
  movimientos:          MovimientoPreview[];
  echeqs?:              EcheqPreview[];
  stats: {
    total_filas:  number;
    importables:  number;
    omitidas:     number;
    advertencias: number;
  };
}

export interface PreviewResult {
  resumen: {
    total_hojas:       number;
    total_movimientos: number;
    total_echeqs:      number;
    advertencias:      number;
    errores:           number;
  };
  hojas:                HojaPreview[];
  configuracion_evento: {
    nombre_sugerido: string;
    moneda_base:     'ARS';
  };
}

// ── Sheet map — position 0-9 within the 10 data sheets ────────────────────────

type SheetMapEntry = { codigo: string; tipo: 'EGRESO' | 'INGRESO'; tab_numero: number };

// Callers can pass active DB tabs (ordered by tipo+orden) to override this default.
export type TabMapEntry = { codigo: string; tipo: string; numero: number };

const SHEET_MAP: SheetMapEntry[] = [
  { codigo: 'EG-TC',           tipo: 'EGRESO',  tab_numero: 1 },
  { codigo: 'EG-RET-SOC',      tipo: 'EGRESO',  tab_numero: 2 },
  { codigo: 'EG-EXTRA',        tipo: 'EGRESO',  tab_numero: 3 },
  { codigo: 'EG-IMP',          tipo: 'EGRESO',  tab_numero: 4 },
  { codigo: 'EG-PREST',        tipo: 'EGRESO',  tab_numero: 5 },
  { codigo: 'ING-TICKETS',     tipo: 'INGRESO', tab_numero: 1 },
  { codigo: 'ING-SPON',        tipo: 'INGRESO', tab_numero: 2 },
  { codigo: 'ING-CORP',        tipo: 'INGRESO', tab_numero: 3 },
  { codigo: 'ING-GASTRO',      tipo: 'INGRESO', tab_numero: 4 },
  { codigo: 'ING-SERV-CHARGE', tipo: 'INGRESO', tab_numero: 5 },
];

function buildSheetMap(tabs?: TabMapEntry[]): SheetMapEntry[] {
  if (!tabs || tabs.length === 0) return SHEET_MAP;
  const egresos  = tabs.filter(t => t.tipo === 'EGRESO');
  const ingresos = tabs.filter(t => t.tipo === 'INGRESO');
  return [
    ...egresos.map(t  => ({ codigo: t.codigo, tipo: 'EGRESO'  as const, tab_numero: t.numero })),
    ...ingresos.map(t => ({ codigo: t.codigo, tipo: 'INGRESO' as const, tab_numero: t.numero })),
  ];
}

const SUBCATEGORIAS = ['PAYWAY', 'REBA', 'AUTOENTRADA', 'IVA', 'IIBB', 'MUNICIPALIDAD', 'GANANCIAS'];

// Common alternate names → canonical subcategoria
const SUB_ALIASES: Record<string, string> = {
  'IIBB':            'IIBB',
  'INGRESOS BRUTOS': 'IIBB',
  'ING. BRUTOS':     'IIBB',
  'IIBB ':           'IIBB',
  'MUNICIPALIDAD':   'MUNICIPALIDAD',
  'MUNICIPAL':       'MUNICIPALIDAD',
  'GANANCIAS':       'GANANCIAS',
  'GANANCIA':        'GANANCIAS',
  'PAYWAY':          'PAYWAY',
  'REBA':            'REBA',
  'AUTOENTRADA':     'AUTOENTRADA',
  'IVA':             'IVA',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function norm(v: any): string {
  return String(v ?? '').toUpperCase().trim().replace(/\s+/g, ' ');
}

function toStr(v: any): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s || null;
}

function toNum(v: any): number {
  if (v === null || v === undefined || v === '') return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^0-9.-]/g, ''));
  return isNaN(n) ? 0 : Math.abs(n); // take absolute value for amounts
}

function toNumSigned(v: any): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^0-9.-]/g, ''));
  return isNaN(n) ? null : n;
}

function toDate(v: any): string | null {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return null;
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, '0');
    const d = String(v.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (typeof v === 'number') {
    try {
      const parsed = (XLSX as any).SSF?.parse_date_code(v);
      if (parsed) return `${parsed.y}-${String(parsed.m).padStart(2,'0')}-${String(parsed.d).padStart(2,'0')}`;
    } catch {}
    return null;
  }
  const s = String(v).trim();
  const dm = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dm) return `${dm[3]}-${dm[2].padStart(2,'0')}-${dm[1].padStart(2,'0')}`;
  const im = s.match(/^(\d{4})[\/\-](\d{2})[\/\-](\d{2})/);
  if (im) return `${im[1]}-${im[2]}-${im[3]}`;
  return null;
}

// ── Header detection ──────────────────────────────────────────────────────────
// Scans rows looking for the row that contains FECHA + DEBE + HABER labels.
// The actual Excel has them at variable row positions (not always row 1).

function findHeaderRow(rows: any[][]): { rowIdx: number; cols: Record<string, number> } | null {
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const normed = r.map(norm);
    const fechaIdx = normed.indexOf('FECHA');
    const debeIdx  = normed.findIndex(s => s.startsWith('DEBE'));
    const haberIdx = normed.findIndex(s => s.startsWith('HABER'));
    if (fechaIdx >= 0 && debeIdx >= 0 && haberIdx >= 0) {
      const conceptoIdx    = normed.indexOf('CONCEPTO');
      const descripcionIdx = normed.findIndex(s => s.startsWith('DESCRIPCION') || s === 'DESCRIPCIÓN');
      return {
        rowIdx: i,
        cols: {
          fecha:       fechaIdx,
          concepto:    conceptoIdx >= 0 ? conceptoIdx : -1,
          descripcion: descripcionIdx >= 0 ? descripcionIdx : (conceptoIdx >= 0 ? conceptoIdx + 1 : fechaIdx + 1),
          debe:        debeIdx,
          haber:       haberIdx,
        },
      };
    }
  }
  return null;
}

// Skip sheets without a valid data header (e.g. RESUMEN, xxx)
function findDataSheets(wb: XLSX.WorkBook): Array<{ name: string; mapIdx: number }> {
  const result: Array<{ name: string; mapIdx: number }> = [];
  let mapIdx = 0;
  for (const name of wb.SheetNames) {
    if (mapIdx >= 10) break;
    const ws  = wb.Sheets[name];
    const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: null, raw: true }) as any[][];
    if (findHeaderRow(rows) !== null) {
      result.push({ name, mapIdx });
      mapIdx++;
    }
  }
  return result;
}

// ── EG-IMP subcategoria detection ─────────────────────────────────────────────

function detectSubcategoria(row: any[], cols: Record<string, number>): { value: string | null; warn: boolean } {
  // Gather candidate strings from concepto + descripcion + entire row
  const candidates: string[] = [];

  if (cols.concepto >= 0) {
    const c = toStr(row[cols.concepto]);
    if (c) candidates.push(c.toUpperCase().trim());
  }
  if (cols.descripcion >= 0) {
    const d = toStr(row[cols.descripcion]);
    if (d) candidates.push(d.toUpperCase().trim());
  }
  for (const cell of row) {
    if (typeof cell === 'string' && cell.trim()) {
      candidates.push(cell.toUpperCase().trim());
    }
  }

  for (const candidate of candidates) {
    // Exact alias match
    if (SUB_ALIASES[candidate]) return { value: SUB_ALIASES[candidate], warn: false };
    // Starts-with match (e.g. "PAYWAY - COSTOS FINANCIEROS" → PAYWAY)
    for (const sub of SUBCATEGORIAS) {
      if (candidate === sub || candidate.startsWith(sub + ' ') || candidate.startsWith(sub + '-')) {
        return { value: sub, warn: false };
      }
    }
    // Partial alias match
    for (const [alias, canonical] of Object.entries(SUB_ALIASES)) {
      if (candidate.startsWith(alias)) return { value: canonical, warn: false };
    }
  }

  return { value: null, warn: true };
}

// ── EG-EXTRA echeq parsing ────────────────────────────────────────────────────

function parseEcheqs(rows: any[][], afterRowIdx: number): EcheqPreview[] {
  const echeqs: EcheqPreview[] = [];

  // Find echeq header row: look for a row with "RAZON SOCIAL" and "IMPORTE" after the totals
  let echeqHeaderIdx = -1;
  for (let i = afterRowIdx + 1; i < rows.length; i++) {
    const normed = rows[i].map(norm);
    const hasRazon   = normed.some(s => s.includes('RAZON') || s.includes('RAZÓN'));
    const hasImporte = normed.some(s => s.includes('IMPORTE'));
    const hasNumero  = normed.some(s => s.includes('N°') || s.includes('NUMERO') || s.includes('NÚMERO') || s.includes('NRO'));
    if ((hasRazon && hasImporte) || (hasNumero && hasRazon)) {
      echeqHeaderIdx = i;
      break;
    }
  }
  if (echeqHeaderIdx < 0) return echeqs;

  // Map column indices from echeq header
  const headerRow   = rows[echeqHeaderIdx];
  const normedH     = headerRow.map(norm);
  const numCol      = normedH.findIndex(s => s.includes('N°') || s.includes('NUMERO') || s.includes('NÚMERO') || s.includes('NRO'));
  const razonCol    = normedH.findIndex(s => s.includes('RAZON') || s.includes('RAZÓN'));
  const detalleCol  = normedH.findIndex(s => s.includes('DETALLE'));
  const importePagCol  = normedH.findIndex(s => s.includes('PAGADO'));
  const importePendCol = normedH.findIndex(s => s.includes('PENDIENTE'));
  // If no separate pagado/pendiente columns, look for a generic IMPORTE
  const importeGenCol  = importePagCol < 0 ? normedH.findIndex(s => s.includes('IMPORTE')) : -1;
  const fechaEmisCol   = normedH.findIndex(s => s.includes('EMISION') || s.includes('EMISIÓN'));
  const fechaCobroCol  = normedH.findIndex(s => s.includes('COBRO') && !s.includes('EMISION'));

  if (razonCol < 0) return echeqs;

  let consecutiveEmpty = 0;
  for (let i = echeqHeaderIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    const rowNorm = r.map(norm);
    // Stop at TOTAL or TOTALES
    if (rowNorm.some(s => s === 'TOTAL' || s === 'TOTALES' || s === 'TOTAL GRAL.')) break;

    const razonSocial = toStr(r[razonCol]);
    const numero = numCol >= 0 ? toStr(r[numCol]) : null;

    if (!razonSocial && !numero) {
      consecutiveEmpty++;
      if (consecutiveEmpty >= 3) break;
      continue;
    }
    consecutiveEmpty = 0;
    if (!razonSocial) continue;

    let importe: number;
    if (importePagCol >= 0 || importePendCol >= 0) {
      const pag  = importePagCol  >= 0 ? Math.abs(toNumSigned(r[importePagCol])  ?? 0) : 0;
      const pend = importePendCol >= 0 ? Math.abs(toNumSigned(r[importePendCol]) ?? 0) : 0;
      importe = pag + pend;
    } else {
      importe = toNum(r[importeGenCol >= 0 ? importeGenCol : razonCol + 1]);
    }
    if (importe === 0) continue;

    echeqs.push({
      fila_excel:           i + 1,
      numero:               numero ?? String(echeqs.length + 1),
      razon_social:         razonSocial,
      detalle:              detalleCol  >= 0 ? toStr(r[detalleCol])  : null,
      importe,
      fecha_emision:        fechaEmisCol >= 0 ? toDate(r[fechaEmisCol]) : null,
      fecha_cobro_estimada: fechaCobroCol >= 0 ? toDate(r[fechaCobroCol]) : null,
    });
  }

  return echeqs;
}

// ── Sheet parser ──────────────────────────────────────────────────────────────

function parseHoja(
  sheetName: string,
  ws: XLSX.WorkSheet,
  map: SheetMapEntry,
): HojaPreview {
  const rows = XLSX.utils.sheet_to_json<any[]>(ws, {
    header: 1,
    defval: null,
    raw:    true,
  }) as any[][];

  const header = findHeaderRow(rows);
  if (!header) {
    return {
      codigo:               map.codigo,
      nombre_hoja_original: sheetName,
      tipo:                 map.tipo,
      tab_numero:           map.tab_numero,
      movimientos:          [],
      stats: { total_filas: 0, importables: 0, omitidas: 0, advertencias: 0 },
    };
  }

  const { rowIdx: headerRowIdx, cols } = header;
  const isEgImp   = map.codigo === 'EG-IMP';
  const isEgExtra = map.codigo === 'EG-EXTRA';

  const movimientos: MovimientoPreview[] = [];
  let consecutiveEmpty = 0;
  let totalesRowIdx    = rows.length;

  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const r       = rows[i];
    const rowNorm = r.map(norm);

    // Stop at TOTALES
    if (rowNorm.some(s => s === 'TOTALES')) {
      totalesRowIdx = i;
      break;
    }

    const fecha       = toDate(r[cols.fecha]);
    const concepto    = cols.concepto >= 0    ? toStr(r[cols.concepto])    : null;
    const descripcion = cols.descripcion >= 0 ? toStr(r[cols.descripcion]) : null;
    const debeRaw     = r[cols.debe];
    const haberRaw    = r[cols.haber];

    // Signed raw values for negative detection
    const debeNum  = toNumSigned(debeRaw);
    const haberNum = toNumSigned(haberRaw);
    const debe  = Math.max(0, debeNum  ?? 0);
    const haber = Math.max(0, haberNum ?? 0);

    // Empty row check (spec: debe=0 AND haber=0 AND concepto=null AND descripcion=null)
    const isEmpty = !fecha && !concepto && !descripcion && debe === 0 && haber === 0;
    if (isEmpty) {
      consecutiveEmpty++;
      if (consecutiveEmpty >= 100) break;
      continue;
    }
    consecutiveEmpty = 0;

    const advertencias: string[] = [];
    const errores:      string[] = [];

    // Invalid date warning
    if (r[cols.fecha] !== null && r[cols.fecha] !== undefined && fecha === null) {
      advertencias.push('Fecha inválida — se importará como null');
    }

    // Negative amounts → error (row will be omitted)
    if (debeNum !== null && debeNum < 0) {
      errores.push('Debe negativo — fila será omitida');
    }
    if (haberNum !== null && haberNum < 0) {
      errores.push('Haber negativo — fila será omitida');
    }

    const mov: MovimientoPreview = {
      fila_excel:   i + 1,
      fecha,
      concepto,
      descripcion,
      debe,
      haber,
      advertencias,
      errores,
    };

    // EG-IMP subcategoria
    if (isEgImp) {
      const { value, warn } = detectSubcategoria(r, cols);
      mov.impuesto_subcategoria = value;
      if (warn && (concepto || descripcion)) {
        advertencias.push('Subcategoría no reconocida — se importará como null');
      }
    }

    movimientos.push(mov);
  }

  // EG-EXTRA: parse echeqs sub-table
  let echeqs: EcheqPreview[] | undefined;
  if (isEgExtra) {
    echeqs = parseEcheqs(rows, totalesRowIdx);
  }

  const importables  = movimientos.filter(m => m.errores.length === 0).length;
  const omitidas     = movimientos.filter(m => m.errores.length > 0).length;
  const advertencias = movimientos.filter(m => m.advertencias.length > 0).length;

  return {
    codigo:               map.codigo,
    nombre_hoja_original: sheetName,
    tipo:                 map.tipo,
    tab_numero:           map.tab_numero,
    movimientos,
    ...(echeqs !== undefined && { echeqs }),
    stats: { total_filas: movimientos.length, importables, omitidas, advertencias },
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

export function parseExcelFile(buffer: Buffer, filename: string, tabs?: TabMapEntry[]): PreviewResult {
  const sheetMap = buildSheetMap(tabs);
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });

  const dataSheets = findDataSheets(wb);
  const hojas = dataSheets.map(({ name, mapIdx }) =>
    parseHoja(name, wb.Sheets[name], sheetMap[mapIdx]),
  );

  const totalMovimientos  = hojas.reduce((a, h) => a + h.stats.importables,  0);
  const totalEcheqs       = hojas.reduce((a, h) => a + (h.echeqs?.length ?? 0), 0);
  const totalAdvertencias = hojas.reduce((a, h) => a + h.stats.advertencias, 0);
  const totalErrores      = hojas.reduce((a, h) => a + h.stats.omitidas,     0);

  const nombreSugerido = filename
    .replace(/\.xlsx$/i, '')
    .replace(/[-_]/g, ' ')
    .trim();

  return {
    resumen: {
      total_hojas:       hojas.length,
      total_movimientos: totalMovimientos,
      total_echeqs:      totalEcheqs,
      advertencias:      totalAdvertencias,
      errores:           totalErrores,
    },
    hojas,
    configuracion_evento: {
      nombre_sugerido: nombreSugerido,
      moneda_base:     'ARS',
    },
  };
}
