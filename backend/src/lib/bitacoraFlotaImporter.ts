import * as XLSX from 'xlsx';
import { normalizarPatente } from './normalizarPatente';

// Parser de las planillas de viajes de camiones que Flor lleva en campo
// (docs/dos57/florencia/Planilla_Viajes_Camiones_Movimientos Eventos.xlsx).
// Puro: no toca la DB — la resolución de camión/chofer y el upsert viven en
// bitacoraFlota.controller.ts.
//
// Cada hoja puede tener uno o más bloques "título + encabezado + filas". El
// tipo de bloque sale del encabezado:
//   A — hoja por evento (FECHA | CAMIÓN | CHOFER | TRAMO | KM… | CARGAS DE COMBUSTIBLE | CANT.DE L. CARGADOS…)
//   B — logística diaria (igual que A + EVENTO, OBSERVACIONES, MONTO DE CAJA ENTREGADA)
//   C — viajes con horario (VIAJE | CAMION | CHOFER | FECHA DE VIAJE | HORARIO SALIDA | HORARIO LLEGADA | …), sin km
//
// Datos sucios reales que se contemplan (todos vistos en la planilla):
//   - Odómetros con punto de miles: como texto "898.919" y como número 899.912
//     (Excel tomó el punto como decimal) → 898919 / 899912. Por eso la columna
//     KM CONSUMIDOS de LOGÍSTICA DIARIA viene en -898019 / 0,937: se recalcula.
//   - Importes "$1.117.003", "SIN CARGA"; litros "354,64" y "340.660" (= 340,66).
//   - En el bloque tipo C la columna "CANT. DE LITROS CARGADOS" trae casi
//     siempre pesos (363252), no litros → se mueve a monto_combustible.
//   - "C1", "C2"… NO son camiones: son el n° de carga del evento (la misma
//     patente HKQ258 aparece como C1, C3 y C4). Se guardan como alias_camion.

export type TipoBloqueFlota = 'A' | 'B' | 'C';

export interface ViajeFlotaParseado {
  hoja:                 string;
  fila:                 number; // fila de Excel (1-based)
  tipo:                 TipoBloqueFlota;
  bloque:               string | null;
  fecha:                Date | null;
  convocatoria:         string | null;
  camion_raw:           string | null;
  patente:              string | null;
  alias:                string | null;
  chofer_raw:           string | null;
  tramo:                string;
  km_iniciales:         number | null;
  km_finales:           number | null;
  km_recorridos:        number | null;
  monto_combustible:    number | null;
  litros_cargados_ruta: number | null;
  litros_consumidos:    number | null;
  km_por_litro:         number | null; // sólo el valor de la planilla; el calculado se completa al consolidar
  litros_iniciales_tanque: number | null; // sólo en el 1er viaje de una hoja por camión (fila COMB.INICIAL)
  monto_caja_entregada: number | null;
  horario_salida:       Date | null;
  horario_llegada:      Date | null;
  observaciones:        string[];
}

export interface FilaIgnoradaFlota { hoja: string; fila: number; motivo: string }
export interface AdvertenciaFlota  { hoja: string; fila: number; mensaje: string }
export interface BloqueFlota       { hoja: string; titulo: string | null; tipo: TipoBloqueFlota; fila_encabezado: number; viajes: number }
// Fila "COMB.INICIAL" de las hojas por camión: litros en tanque y odómetro al arrancar la gira
export interface SaldoInicialTanque { hoja: string; fila: number; litros: number | null; km_inicial: number | null; chofer: string | null }

export interface ParseoFlota {
  viajes:               ViajeFlotaParseado[];
  ignoradas:            FilaIgnoradaFlota[];
  advertencias:         AdvertenciaFlota[];
  bloques:              BloqueFlota[];
  hojas_no_reconocidas: string[];
  saldos_iniciales:     SaldoInicialTanque[];
}

// ── Normalización ─────────────────────────────────────────────────────────────

const sinAcentos = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

// "CANT.DE L. CARGADOS" / "CANT. DE L. CARGADOS" → "CANT DE L CARGADOS"
function normHeader(v: unknown): string {
  return sinAcentos(String(v ?? '')).toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

// Comparación de tramos: "COR - TUCUMAN" ≡ "Cor -Tucumán"
export function normTramo(s: string): string {
  return sinAcentos(s).toUpperCase().replace(/\s+/g, '');
}

const vacio = (v: unknown) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '');

function texto(v: unknown): string | null {
  if (vacio(v)) return null;
  return String(v).trim().replace(/\s+/g, ' ');
}

const esNumeroTexto = (s: string) => /^[$\s]*-?[\d.,]+$/.test(s.trim());

// ── Columnas ──────────────────────────────────────────────────────────────────

interface Columnas {
  fecha: number; evento: number; camion: number; chofer: number; tramo: number;
  kmIni: number; kmFin: number; kmCons: number; kmExtra: number;
  combustible: number; litros: number; litrosCons: number; kmPorL: number; obs: number; caja: number; salida: number; llegada: number;
}

function mapearColumnas(h: string[]): Columnas {
  const idx = (pred: (x: string) => boolean) => h.findIndex(pred);
  return {
    fecha:       idx(x => x === 'FECHA' || x === 'FECHA DE VIAJE'),
    evento:      idx(x => x === 'EVENTO'),
    camion:      idx(x => x === 'CAMION'),
    chofer:      idx(x => x === 'CHOFER'),
    tramo:       idx(x => x === 'TRAMO' || x === 'VIAJE'),
    kmIni:       idx(x => x === 'KM INICIALES'),
    kmFin:       idx(x => x === 'KM FINALES'),
    kmCons:      idx(x => x === 'KM CONSUMIDOS'),
    kmExtra:     idx(x => x.startsWith('KM CONSUMIDOS ')), // "KM CONSUMIDOS TUCUMAN ROCK" (desarme)
    combustible: idx(x => /^CARGAS? DE COMBUSTIBLE$/.test(x)),
    litros:      idx(x => x.includes('CARGADOS') && /\b(L|LITROS)\b/.test(x)),
    // Primera ocurrencia: en las hojas por camión hay una 2ª "CANT. DE L. CONSUMIDOS"
    // que en realidad trae la caja entregada (100000) — se ignora.
    litrosCons:  idx(x => x.includes('CONSUMI') && /\b(L|LITROS)\b/.test(x)),
    kmPorL:      idx(x => /\bKM X L\b/.test(x)),
    obs:         idx(x => x === 'OBSERVACIONES'),
    caja:        idx(x => x.startsWith('MONTO DE CAJA')),
    salida:      idx(x => x === 'HORARIO SALIDA'),
    llegada:     idx(x => x === 'HORARIO LLEGADA'),
  };
}

function esEncabezado(row: unknown[]): boolean {
  const h = row.map(normHeader);
  return h.includes('CAMION') && h.includes('CHOFER') && (h.includes('FECHA') || h.includes('FECHA DE VIAJE') || h.includes('VIAJE'));
}

function tipoDeBloque(c: Columnas): TipoBloqueFlota {
  if (c.evento >= 0) return 'B';
  if (c.salida >= 0 || c.llegada >= 0 || c.kmIni < 0) return 'C';
  return 'A';
}

// ── Parsers de celdas ─────────────────────────────────────────────────────────

const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);
const DIA_MS = 86_400_000;

const round2 = (n: number) => Math.round(n * 100) / 100;

const fmtFecha = (d: Date) => d.toISOString().slice(0, 10);

// Fecha de negocio en UTC (mismo criterio que parseFechaUTC del sistema).
function parseFecha(v: unknown, anterior: Date | null): { fecha: Date | null; aviso?: string } {
  if (vacio(v)) return { fecha: null };
  if (typeof v === 'number') {
    if (v >= 20000) return { fecha: new Date(EXCEL_EPOCH_MS + Math.floor(v) * DIA_MS) };
    // "27" suelto entre fechas de julio (planilla de Santiago): día del mes de la fila anterior
    if (Number.isInteger(v) && v >= 1 && v <= 31 && anterior) {
      const f = new Date(Date.UTC(anterior.getUTCFullYear(), anterior.getUTCMonth(), v));
      return { fecha: f, aviso: `FECHA "${v}" interpretada como ${fmtFecha(f)} (día del mes de la fila anterior)` };
    }
    return { fecha: null, aviso: `FECHA "${v}" no reconocida` };
  }
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (m) {
    const anio = Number(m[3]) < 100 ? 2000 + Number(m[3]) : Number(m[3]);
    return { fecha: new Date(Date.UTC(anio, Number(m[2]) - 1, Number(m[1]))) };
  }
  return { fecha: null, aviso: `FECHA "${s}" no reconocida` };
}

// Odómetro: siempre entero. "898.919" (texto) y 899.912 (número) son miles.
export function parseKm(v: unknown): number | null {
  if (vacio(v)) return null;
  let n: number;
  if (typeof v === 'number') n = v;
  else {
    const s = String(v).trim().replace(/\s/g, '');
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) return Number(s.replace(/\./g, ''));
    n = Number(s.replace(',', '.'));
    if (!Number.isFinite(n)) return null;
  }
  if (Number.isInteger(n)) return n;
  // < 1000 con hasta 3 decimales = punto de miles que Excel tomó como decimal
  // (899.912 → 899912, 63.465 → 63465). Un odómetro real ≥ 1000 con decimales
  // sólo se redondea.
  const miles = n * 1000;
  if (n < 1000 && Math.abs(miles - Math.round(miles)) < 1e-6) return Math.round(miles);
  return Math.round(n);
}

// Importe en $: 823375 / 1887925.95 / "$1.117.003" / "1.234,50"
export function parseImporte(v: unknown): number | null {
  if (vacio(v)) return null;
  if (typeof v === 'number') return v;
  const s = String(v).replace(/[$\s]/g, '');
  if (!/^-?[\d.,]+$/.test(s)) return null;
  if (s.includes(',')) return Number(s.replace(/\./g, '').replace(',', '.'));
  if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) return Number(s.replace(/\./g, ''));
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// Litros: 440.24 / "354,64" / "340.660" (= 340,66 — acá el punto es decimal)
export function parseLitros(v: unknown): number | null {
  if (vacio(v)) return null;
  if (typeof v === 'number') return v;
  const s = String(v).trim().replace(/\s/g, '');
  if (!/^-?[\d.,]+$/.test(s)) return null;
  const n = s.includes(',') ? Number(s.replace(/\./g, '').replace(',', '.')) : Number(s);
  return Number.isFinite(n) ? n : null;
}

// Hora: fracción de día de Excel (0.6458 = 15:30) o "HH:MM" → minutos.
function parseHora(v: unknown): number | null {
  if (vacio(v)) return null;
  if (typeof v === 'number') {
    const frac = v - Math.floor(v);
    return Math.round(frac * 1440) % 1440;
  }
  const m = String(v).trim().match(/^(\d{1,2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

const fmtHora = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

// Horario real (timestamp, no fecha de negocio): hora local de Argentina (UTC-3).
function combinarHorario(fecha: Date, minutos: number, diasExtra = 0): Date {
  return new Date(fecha.getTime() + diasExtra * DIA_MS + (minutos + 180) * 60_000);
}

// ── Camión ────────────────────────────────────────────────────────────────────

const RE_PATENTE = /^([A-Z]{3}\d{3}|[A-Z]{2}\d{3}[A-Z]{2})$/;
export const RE_ALIAS_CARGA = /^C\d{1,2}$/;

// "HKQ 258 / P.N / C1" → HKQ258 + C1 · "FTL 303 / Volvo" → FTL303 · "C2" → alias · "PLANCHA" → alias
export function parseCamion(raw: string): { patente: string | null; alias: string | null } {
  const partes = raw.split('/').map(p => normalizarPatente(p)).filter((p): p is string => !!p);
  let patente: string | null = null;
  let alias: string | null = null;
  for (const p of partes) {
    if (!patente && RE_PATENTE.test(p)) patente = p;
    else if (!alias && RE_ALIAS_CARGA.test(p)) alias = p;
  }
  if (!patente && !alias && partes.length) alias = partes[0];
  return { patente, alias };
}

// ── Evento ────────────────────────────────────────────────────────────────────

// "CAMIONES TUCUMAN ROCK" → "TUCUMAN ROCK"
function eventoDesdeHoja(hoja: string): string {
  return hoja.replace(/^\s*CAMI[OÓ]N(ES)?\s+/i, '').trim() || hoja.trim();
}

// "PLANILLA DE VIAJES CAMIONES - ANIVERSARIO SGO DEL ESTERO" → "ANIVERSARIO SGO DEL ESTERO"
function eventoDesdeTitulo(titulo: string | null): string | null {
  if (!titulo) return null;
  const limpio = titulo.replace(/^\s*PLANILLA DE VIAJES CAMIONES\s*-?\s*/i, '').trim();
  return limpio || null;
}

function faseDesdeTitulo(titulo: string | null): string | null {
  if (!titulo) return null;
  const t = normHeader(titulo);
  if (t.includes('DESARME')) return 'Desarme';
  if (t.includes('ARMADO')) return 'Armado';
  return null;
}

// ── Parseo ────────────────────────────────────────────────────────────────────

interface BloqueActual {
  cols:      Columnas;
  headers:   string[]; // texto original del encabezado
  tipo:      TipoBloqueFlota;
  titulo:    string | null;
  resumen:   BloqueFlota;
  prevFecha: Date | null;
  prevChofer: string | null;
  ultimo:    ViajeFlotaParseado | null;
  saldoPendiente: SaldoInicialTanque | null; // se asigna al próximo viaje del bloque
}

export function parsePlanillaViajesFlota(buffer: Buffer): ParseoFlota {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: false });
  const out: ParseoFlota = { viajes: [], ignoradas: [], advertencias: [], bloques: [], hojas_no_reconocidas: [], saldos_iniciales: [] };

  for (const hoja of wb.SheetNames) {
    const ws = wb.Sheets[hoja];
    if (!ws['!ref']) { out.hojas_no_reconocidas.push(hoja); continue; }
    const filaBase = XLSX.utils.decode_range(ws['!ref']).s.r + 1; // fila Excel de rows[0]
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, raw: true, blankrows: true });
    const noVacias = (r: unknown[] | undefined) => (r ?? []).filter(c => !vacio(c));

    let bloque: BloqueActual | null = null;
    let ultimoTexto: { texto: string; i: number } | null = null;
    const bloquesAntes = out.bloques.length;

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i] ?? [];
      const celdas = noVacias(r);
      if (celdas.length === 0) continue;
      const fila = filaBase + i;

      if (esEncabezado(r)) {
        const headers = r.map(c => texto(c) ?? '');
        const cols = mapearColumnas(r.map(normHeader));
        const titulo = ultimoTexto && i - ultimoTexto.i <= 2 ? ultimoTexto.texto : null;
        const resumen: BloqueFlota = { hoja, titulo, tipo: tipoDeBloque(cols), fila_encabezado: fila, viajes: 0 };
        out.bloques.push(resumen);
        bloque = { cols, headers, tipo: resumen.tipo, titulo, resumen, prevFecha: null, prevChofer: null, ultimo: null, saldoPendiente: null };
        ultimoTexto = null;
        continue;
      }

      // Fila de un solo texto seguida de un encabezado = título del bloque siguiente
      if (celdas.length === 1 && typeof celdas[0] === 'string' && !esNumeroTexto(celdas[0])) {
        let j = i + 1;
        while (j < rows.length && noVacias(rows[j]).length === 0) j++;
        if (j < rows.length && esEncabezado(rows[j] ?? [])) { ultimoTexto = { texto: texto(celdas[0])!, i }; continue; }
      }

      if (!bloque) continue; // texto suelto antes de cualquier encabezado
      procesarFila(out, hoja, fila, r, bloque);
    }

    if (out.bloques.length === bloquesAntes) out.hojas_no_reconocidas.push(hoja);
  }

  return out;
}

function procesarFila(out: ParseoFlota, hoja: string, fila: number, r: unknown[], b: BloqueActual) {
  const { cols } = b;
  const get = (k: keyof Columnas) => (cols[k] >= 0 ? r[cols[k]] : null);
  const avisar = (mensaje: string) => out.advertencias.push({ hoja, fila, mensaje });
  const ignorar = (motivo: string) => out.ignoradas.push({ hoja, fila, motivo });

  const textosFila = r.map(texto).filter((t): t is string => !!t);
  if (textosFila.some(t => /^(TOTAL|COMBUSTIBLE ACTUAL)/.test(normHeader(t)))) {
    ignorar('Fila de totales / saldo de la planilla');
    return;
  }

  const tramo = texto(get('tramo'));
  if (!tramo) {
    if (b.tipo === 'C' && b.ultimo) {
      // Nota suelta debajo de un viaje ("Quedó en Sgo", "Transf. Pollo, Carga Sgo")
      const partes = r.map((c, idx) => {
        if (vacio(c)) return null;
        if ((idx === cols.salida || idx === cols.llegada) && typeof c === 'number') return `${b.headers[idx]}: ${fmtHora(parseHora(c)!)}`;
        return texto(c);
      }).filter((t): t is string => !!t);
      const unicas = [...new Set(partes)];
      b.ultimo.observaciones.push(`Nota fila ${fila}: ${unicas.join(' · ')}`);
      ignorar(`Sin VIAJE — se anexó como observación del viaje de la fila ${b.ultimo.fila}`);
      return;
    }
    if (textosFila.some(t => normHeader(t).startsWith('COMB'))) {
      // Los litros vienen en "CANT.DE L. CARGADOS"; se guardan en el primer viaje de la hoja
      const saldo: SaldoInicialTanque = { hoja, fila, litros: parseLitros(get('litros')), km_inicial: parseKm(get('kmIni')), chofer: null };
      out.saldos_iniciales.push(saldo);
      b.saldoPendiente = saldo;
      ignorar(`Combustible inicial del camión (no es un viaje)${saldo.litros !== null ? ` — saldo inicial de tanque ${saldo.litros} L, se guarda en el primer viaje` : ''}`);
      return;
    }
    const caja = parseImporte(get('caja'));
    if (caja !== null && textosFila.length === 1) {
      ignorar(`Sin fecha ni tramo — sólo MONTO DE CAJA ENTREGADA $${caja.toLocaleString('es-AR')} (no se asigna a ningún viaje)`);
      return;
    }
    ignorar('Sin TRAMO');
    return;
  }

  const obs: string[] = [];

  // Camión / chofer — en C, la vuelta ("Santiago - Cordoba") no repite camión ni chofer
  let camionRaw = texto(get('camion'));
  let choferRaw = texto(get('chofer'));
  if (b.tipo === 'C' && !camionRaw && !choferRaw && b.ultimo) {
    camionRaw = b.ultimo.camion_raw;
    choferRaw = b.ultimo.chofer_raw;
  }
  if (!choferRaw && b.prevChofer) {
    choferRaw = b.prevChofer;
    avisar(`CHOFER vacío — se tomó "${choferRaw}" de la fila anterior`);
  }
  if (choferRaw) b.prevChofer = choferRaw;
  const { patente, alias } = camionRaw ? parseCamion(camionRaw) : { patente: null, alias: null };

  // Fecha — columna FECHA (bloques A/B) o FECHA DE VIAJE (C). Sin fecha
  // válida el viaje NO se importa (antes quedaba con fecha NULL): no se hereda
  // la de la fila anterior porque en las giras las filas sin fecha son viajes
  // de días posteriores (ej. CAMIONES TUCUMAN ROCK, 16 filas con la celda
  // vacía en la planilla real). Se avisa para que Flor complete la planilla.
  const pf = parseFecha(get('fecha'), b.prevFecha);
  if (!pf.fecha) {
    const detalle = [camionRaw, choferRaw, tramo].filter(Boolean).join(' · ');
    avisar(`${pf.aviso ?? 'FECHA vacía'} — viaje NO importado (${detalle}). Completá la fecha en la planilla y volvé a importar.`);
    return;
  }
  if (pf.aviso) avisar(pf.aviso);
  if (pf.fecha && b.prevFecha && Math.abs(pf.fecha.getTime() - b.prevFecha.getTime()) > 20 * DIA_MS) {
    avisar(`FECHA ${fmtFecha(pf.fecha)} fuera de secuencia (fila anterior: ${fmtFecha(b.prevFecha)}) — revisar si es un error de tipeo`);
  }
  if (pf.fecha) b.prevFecha = pf.fecha;
  const fecha = pf.fecha;

  // Km
  const kmIni = parseKm(get('kmIni'));
  const kmFin = parseKm(get('kmFin'));
  const kmConsRaw = get('kmCons');
  const kmCons = typeof kmConsRaw === 'number' ? kmConsRaw : parseKm(kmConsRaw);
  let kmRec: number | null = null;
  if (kmIni !== null && kmFin !== null) {
    if (kmFin >= kmIni) kmRec = kmFin - kmIni;
    else avisar(`KM FINALES (${kmFin}) menor que KM INICIALES (${kmIni}) — km recorridos sin calcular`);
    if (kmRec !== null && kmCons !== null && Number.isInteger(kmCons) && kmCons >= 0 && kmCons < 5000 && Math.abs(kmCons - kmRec) > 1) {
      avisar(`KM CONSUMIDOS de la planilla (${kmCons}) no coincide con finales − iniciales (${kmRec}); se usó ${kmRec}`);
    }
  } else if (kmCons !== null && kmCons >= 0 && kmCons < 5000) {
    kmRec = Math.round(kmCons);
  }
  if (kmRec !== null && kmRec > 3000) avisar(`${kmRec} km en un solo tramo — revisar odómetro`);
  const kmExtra = get('kmExtra');
  if (typeof kmExtra === 'number') obs.push(`${b.headers[cols.kmExtra]}: ${kmExtra}`);

  // Combustible ($), litros, caja
  const combRaw = get('combustible');
  let montoComb = parseImporte(combRaw);
  if (montoComb === null && texto(combRaw)) obs.push(`Combustible: ${texto(combRaw)}`);

  const litrosRaw = get('litros');
  let litros = parseLitros(litrosRaw);
  if (litros === null && texto(litrosRaw)) obs.push(texto(litrosRaw)!);
  if (litros !== null && litros > 2000) {
    avisar(`${b.headers[cols.litros]} = ${litros.toLocaleString('es-AR')} no es un volumen posible — se tomó como monto $ de combustible`);
    if (montoComb === null) montoComb = litros;
    litros = null;
  }

  const litrosConsRaw = get('litrosCons');
  const litrosCons = parseLitros(litrosConsRaw);
  if (litrosCons === null && texto(litrosConsRaw)) obs.push(`L. consumidos: ${texto(litrosConsRaw)}`);
  const kmPorL = parseLitros(get('kmPorL'));

  const montoCaja = parseImporte(get('caja'));

  const obsCol = texto(get('obs'));
  if (obsCol) obs.push(obsCol);
  const fase = faseDesdeTitulo(b.titulo);
  if (fase) obs.unshift(fase);

  // Horarios (tipo C)
  let salida: Date | null = null;
  let llegada: Date | null = null;
  if (cols.salida >= 0 || cols.llegada >= 0) {
    const rawS = get('salida');
    const rawL = get('llegada');
    const minS = parseHora(rawS);
    const minL = parseHora(rawL);
    if (minS === null && texto(rawS)) obs.push(`Salida: ${texto(rawS)}`);
    if (minL === null && texto(rawL) && texto(rawL) !== texto(rawS)) obs.push(`Llegada: ${texto(rawL)}`);
    if (fecha) {
      if (minS !== null) salida = combinarHorario(fecha, minS);
      // Llegada antes que la salida → llegó al día siguiente
      if (minL !== null) llegada = combinarHorario(fecha, minL, minS !== null && minL < minS ? 1 : 0);
    } else if (minS !== null || minL !== null) {
      avisar('Horario sin fecha de viaje — no se guardó');
    }
  }

  const convocatoria =
    b.tipo === 'B' ? texto(get('evento')) ?? eventoDesdeTitulo(b.titulo) :
    b.tipo === 'C' ? eventoDesdeTitulo(b.titulo) ?? eventoDesdeHoja(hoja) :
                     eventoDesdeHoja(hoja);

  const viaje: ViajeFlotaParseado = {
    hoja, fila, tipo: b.tipo, bloque: b.titulo,
    fecha, convocatoria,
    camion_raw: camionRaw, patente, alias,
    chofer_raw: choferRaw,
    tramo,
    km_iniciales: kmIni, km_finales: kmFin, km_recorridos: kmRec,
    monto_combustible: montoComb, litros_cargados_ruta: litros, monto_caja_entregada: montoCaja,
    litros_consumidos: litrosCons !== null ? round2(litrosCons) : null,
    km_por_litro:      kmPorL !== null ? round2(kmPorL) : null,
    litros_iniciales_tanque: b.saldoPendiente?.litros ?? null,
    horario_salida: salida, horario_llegada: llegada,
    observaciones: obs,
  };
  out.viajes.push(viaje);
  if (b.saldoPendiente) {
    b.saldoPendiente.chofer = choferRaw;
    b.saldoPendiente = null;
  }
  b.ultimo = viaje;
  b.resumen.viajes++;
}

// ── Consolidación ─────────────────────────────────────────────────────────────

// Clave de upsert. Con km iniciales, el odómetro + fecha + tramo identifica el
// viaje físico sin importar cómo se haya escrito el camión — así el mismo
// viaje cargado en "LOGÍSTICA DIARIA" (HKQ 258 / P.N / C1) y en
// "CAMION LUIS - LA RENGA" (C1) no se duplica. Sin km: alias/patente + fecha + tramo.
export function claveViaje(v: {
  fecha: Date | null; tramo: string | null; km_iniciales: number | null; alias: string | null; patente: string | null;
}): string {
  const f = v.fecha ? fmtFecha(v.fecha) : 'sin-fecha';
  const t = normTramo(v.tramo ?? '');
  return v.km_iniciales !== null
    ? `km|${f}|${t}|${v.km_iniciales}`
    : `cam|${v.alias ?? v.patente ?? '-'}|${f}|${t}`;
}

// Prioridad al fusionar el mismo viaje visto en varias hojas: la logística
// diaria (B) trae patente, evento explícito y caja; después C; después A.
const PRIORIDAD: Record<TipoBloqueFlota, number> = { B: 3, C: 2, A: 1 };

export interface ViajeFlotaConsolidado extends ViajeFlotaParseado {
  clave:   string;
  fuentes: { hoja: string; fila: number }[];
}

// litros_consumidos y km_por_litro van de a par (Flor calcula KM x L = km / L
// consumidos de SU hoja): se toman juntos de una sola fuente, para no mezclar
// el consumo de una hoja con el rendimiento de otra. Si esa fuente no trae
// KM x L, se calcula. Acá la prioridad se invierte: manda la hoja por camión
// (A: "CAMION MIGUEL - LA RENGA") sobre LOGÍSTICA DIARIA (B) — el mismo viaje
// tiene consumos distintos en las dos y el de referencia es el de la hoja del
// camión (345,18 vs 345,93; 284,49 vs 332,96…), confirmado por el usuario.
const CAMPOS_PAR_CONSUMO = new Set(['litros_consumidos', 'km_por_litro']);
const PRIORIDAD_CONSUMO: Record<TipoBloqueFlota, number> = { A: 3, B: 2, C: 1 };

export function consolidarViajes(viajes: ViajeFlotaParseado[], advertencias: AdvertenciaFlota[] = []): ViajeFlotaConsolidado[] {
  const grupos = new Map<string, ViajeFlotaParseado[]>();
  for (const v of viajes) {
    const k = claveViaje(v);
    grupos.set(k, [...(grupos.get(k) ?? []), v]);
  }
  const out: ViajeFlotaConsolidado[] = [];
  for (const [clave, grupo] of grupos) {
    const orden = [...grupo].sort((a, b) => PRIORIDAD[b.tipo] - PRIORIDAD[a.tipo]);
    const base: any = { ...orden[0] };
    for (const otro of orden.slice(1)) {
      for (const [campo, valor] of Object.entries(otro)) {
        if (CAMPOS_PAR_CONSUMO.has(campo)) continue;
        if ((base[campo] === null || base[campo] === undefined) && valor !== null && valor !== undefined) base[campo] = valor;
      }
    }
    base.observaciones = [...new Set(orden.flatMap(v => v.observaciones))];

    const conConsumo = orden
      .filter(v => v.litros_consumidos !== null)
      .sort((a, b) => PRIORIDAD_CONSUMO[b.tipo] - PRIORIDAD_CONSUMO[a.tipo]);
    const fuenteConsumo = conConsumo[0] ?? null;
    base.litros_consumidos = fuenteConsumo?.litros_consumidos ?? null;
    base.km_por_litro      = fuenteConsumo ? fuenteConsumo.km_por_litro : (orden.find(v => v.km_por_litro !== null)?.km_por_litro ?? null);
    if (base.km_por_litro === null && base.km_recorridos && base.litros_consumidos) {
      base.km_por_litro = round2(base.km_recorridos / base.litros_consumidos);
    }
    for (const otro of conConsumo.slice(1)) {
      const a = fuenteConsumo!.litros_consumidos!;
      const b = otro.litros_consumidos!;
      if (Math.abs(a - b) > Math.max(a, b) * 0.05) {
        advertencias.push({
          hoja: otro.hoja, fila: otro.fila,
          mensaje: `L. consumidos difieren entre hojas: ${fuenteConsumo!.hoja} fila ${fuenteConsumo!.fila} = ${a} vs ${b} acá — se usó ${fuenteConsumo!.hoja}`,
        });
      }
    }
    out.push({ ...base, clave, fuentes: grupo.map(v => ({ hoja: v.hoja, fila: v.fila })) });
  }
  return out;
}
