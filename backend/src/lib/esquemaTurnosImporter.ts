import ExcelJS from 'exceljs';
import { calcHorasPorAgente, derivarTurno, normalizarHora } from './esquemaTurnos';

// Parser de la grilla de esquema de personal (docs/enjoy/dani/SEGURIDAD FESTIVAL KM.xlsx):
//   N° | Fecha | Tipo de seguridad | Cantidad | Ubicacion | Ingreso | Salida | Total hs x seguridad | Total de hs
// La grilla de Limpieza usa "Sector" en lugar de Tipo/Ubicación — se acepta también.
//
// Ojo con las celdas combinadas: N°, Fecha, Tipo y "Total de hs" vienen combinadas
// por día/grupo. ExcelJS repite el valor del master en cada celda del rango, que
// es justo lo que queremos para Fecha/Tipo. "Total de hs" (subtotal por día) se
// IGNORA: se recalcula siempre — sumarla fila a fila duplicaría los subtotales.

export interface FilaEsquemaParseada {
  fila_excel:       number;
  dia_numero:       number | null; // "N°" del Excel = día del evento, no número de fila
  fecha:            string;        // YYYY-MM-DD
  tipo_turno:       string | null;
  cantidad:         number;
  ubicacion_turno:  string | null;
  hora_inicio:      string | null; // HH:mm
  hora_fin:         string | null;
  horas_por_agente: number | null;
  total_horas:      number | null;
  advertencias:     string[];
}

export interface FilaEsquemaOmitida {
  fila_excel: number;
  motivo:     string;
}

export interface EsquemaParseado {
  hoja:     string;
  filas:    FilaEsquemaParseada[];
  omitidas: FilaEsquemaOmitida[];
}

function norm(s: unknown): string {
  return String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function cellText(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') {
    const o = v as any;
    if (o instanceof Date) return '';
    if (o.richText) return o.richText.map((t: any) => t.text).join('');
    if (o.result !== undefined) return cellText(o.result);
    if (o.text !== undefined) return String(o.text);
    return '';
  }
  return String(v).trim();
}

function cellRaw(v: ExcelJS.CellValue): unknown {
  if (v && typeof v === 'object' && !(v instanceof Date)) {
    const o = v as any;
    if (o.result !== undefined) return o.result;
    if (o.richText) return o.richText.map((t: any) => t.text).join('');
  }
  return v;
}

const pad = (n: number) => String(n).padStart(2, '0');

// Fecha calendario → YYYY-MM-DD. Excel entrega las fechas como medianoche UTC —
// se leen los componentes en UTC (ver fecha_offset_utc_fix), nunca en hora local.
function parseFecha(v: unknown): string | null {
  if (v instanceof Date && !isNaN(v.getTime())) {
    return `${v.getUTCFullYear()}-${pad(v.getUTCMonth() + 1)}-${pad(v.getUTCDate())}`;
  }
  if (typeof v === 'number' && v > 20000 && v < 80000) { // serial de Excel
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }
  if (typeof v === 'string') {
    const s = v.trim();
    let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/.exec(s);
    if (m) {
      const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
      return `${y}-${pad(Number(m[2]))}-${pad(Number(m[1]))}`;
    }
  }
  return null;
}

// Hora → "HH:mm". Excel guarda las horas como fracción de día: ExcelJS la entrega
// como Date en 1899-12-30 (UTC). Se redondea al minuto para absorber el ruido de
// punto flotante (07:59:59.999 → 08:00).
function parseHora(v: unknown): string | null {
  const desdeMinutos = (min: number) => `${pad(Math.floor(min / 60) % 24)}:${pad(min % 60)}`;
  if (v instanceof Date && !isNaN(v.getTime())) {
    const msDelDia = ((v.getTime() % 86400000) + 86400000) % 86400000;
    return desdeMinutos(Math.round(msDelDia / 60000) % 1440);
  }
  if (typeof v === 'number' && v >= 0 && v < 1) return desdeMinutos(Math.round(v * 1440) % 1440);
  if (typeof v === 'string') {
    const m = /^(\d{1,2})(?:[:.](\d{2}))?\s*(?:hs?\.?)?$/i.exec(v.trim());
    if (m) return normalizarHora(`${m[1]}:${m[2] ?? '00'}`);
  }
  return null;
}

interface Cols {
  n?: number; fecha: number; tipo?: number; cantidad: number; ubicacion?: number;
  ingreso: number; salida: number; hsPorAgente?: number;
}

function detectarEncabezado(ws: ExcelJS.Worksheet): { fila: number; cols: Cols } | null {
  const limite = Math.min(ws.rowCount, 25);
  for (let r = 1; r <= limite; r++) {
    const row = ws.getRow(r);
    const map = new Map<string, number>();
    row.eachCell({ includeEmpty: false }, (cell, c) => { map.set(norm(cellText(cell.value)), c); });
    const fecha = map.get('fecha');
    const cantidad = map.get('cantidad');
    const ingreso = map.get('ingreso');
    const salida = map.get('salida');
    if (!fecha || !cantidad || !ingreso || !salida) continue;

    const find = (pred: (k: string) => boolean): number | undefined => {
      for (const [k, c] of map) if (pred(k)) return c;
      return undefined;
    };
    return {
      fila: r,
      cols: {
        n: map.get('n') ?? map.get('no') ?? map.get('nro'),
        fecha, cantidad, ingreso, salida,
        tipo:        find(k => k.startsWith('tipo')),
        ubicacion:   find(k => k === 'ubicacion' || k === 'sector'),
        hsPorAgente: find(k => k.startsWith('totalhsx')),
      },
    };
  }
  return null;
}

/**
 * Parsea la grilla de esquema de personal. Busca la primera hoja (o la indicada)
 * que tenga los encabezados Fecha / Cantidad / Ingreso / Salida.
 * Lanza Error si no encuentra la grilla.
 */
export async function parseEsquemaTurnos(buffer: Buffer, hoja?: string): Promise<EsquemaParseado> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as any);

  const candidatas = hoja ? wb.worksheets.filter(w => w.name === hoja) : wb.worksheets;
  let ws: ExcelJS.Worksheet | null = null;
  let enc: { fila: number; cols: Cols } | null = null;
  for (const w of candidatas) {
    enc = detectarEncabezado(w);
    if (enc) { ws = w; break; }
  }
  if (!ws || !enc) {
    throw new Error('No se encontró la grilla del esquema (se esperan las columnas Fecha, Cantidad, Ingreso y Salida)');
  }
  const { cols } = enc;

  const filas: FilaEsquemaParseada[] = [];
  const omitidas: FilaEsquemaOmitida[] = [];

  for (let r = enc.fila + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const val = (c?: number) => (c ? cellRaw(row.getCell(c).value) : null);

    // Fila de cierre "TOTAL HORAS:" (en cualquier columna) — fin de la grilla
    let esTotal = false;
    let vacia = true;
    row.eachCell({ includeEmpty: false }, cell => {
      const t = norm(cellText(cell.value));
      if (t) vacia = false;
      if (t.startsWith('totalhoras')) esTotal = true;
    });
    if (esTotal) break;
    if (vacia) continue;

    const fecha = parseFecha(val(cols.fecha));
    if (!fecha) { omitidas.push({ fila_excel: r, motivo: 'Sin fecha' }); continue; }

    const cantidadRaw = val(cols.cantidad);
    const cantidad = typeof cantidadRaw === 'number' ? cantidadRaw : Number(String(cantidadRaw ?? '').replace(',', '.'));
    if (!Number.isFinite(cantidad) || cantidad <= 0) { omitidas.push({ fila_excel: r, motivo: 'Sin cantidad' }); continue; }

    const advertencias: string[] = [];
    const hora_inicio = parseHora(val(cols.ingreso));
    const hora_fin    = parseHora(val(cols.salida));
    if (!hora_inicio || !hora_fin) advertencias.push('Sin horario completo — no se calculan las horas');

    const txt = (c?: number) => { const t = c ? cellText(row.getCell(c).value) : ''; return t || null; };
    const nRaw = val(cols.n);

    // Horas: calculadas desde ingreso/salida. Si el Excel trae "Total hs x seguridad"
    // y no coincide, se avisa (pero prevalece el cálculo).
    const calc = calcHorasPorAgente(hora_inicio, hora_fin);
    const hsExcelRaw = val(cols.hsPorAgente);
    const hsExcel = typeof hsExcelRaw === 'number' ? hsExcelRaw : null;
    if (calc !== null && hsExcel !== null && Math.abs(calc - hsExcel) > 0.01) {
      advertencias.push(`Total hs x seguridad del Excel (${hsExcel}) no coincide con lo calculado (${calc})`);
    }
    const { horas_por_agente, total_horas_turno } = derivarTurno({
      cantidad, horaInicio: hora_inicio, horaFin: hora_fin, horasManual: hsExcel,
    });

    filas.push({
      fila_excel:      r,
      dia_numero:      typeof nRaw === 'number' ? nRaw : null,
      fecha,
      tipo_turno:      txt(cols.tipo),
      cantidad,
      ubicacion_turno: txt(cols.ubicacion),
      hora_inicio,
      hora_fin,
      horas_por_agente,
      total_horas:     total_horas_turno,
      advertencias,
    });
  }

  return { hoja: ws.name, filas, omitidas };
}
