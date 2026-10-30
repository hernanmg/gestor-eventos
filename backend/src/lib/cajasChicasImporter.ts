import ExcelJS from 'exceljs';
import { celdasFila, masterRaw, esVacio, aNumero, normTexto } from './pedidosMaterialImporter';

// Parser de la planilla de cajas chicas de Enjoy (docs/especificaciones/CAJAS  2026.xlsx).
//
// Cada hoja tiene uno o más bloques "rendición de caja", uno debajo del otro (y a
// veces al costado, como en la hoja Male):
//
//   NOMBRE: DANI MAYO                MES:MAYO
//   FECHA | DESCRIPCIÓN | [CAJA] | INGRESO | EGRESO | SALDO
//         | Ingreso Caja Chica |  1.000.000 |        | 1.000.000
//   01/05 | Comida Miguel Seguridad |      |  50.000 |   950.000
//   ...
//         | Totales:           |  1.000.000 | 1.652.518 | -652.518
//
// La hoja COWORKING usa CONCEPTO y su SALDO es el acumulado de gastos (con una
// fila TOTAL de un solo número). Hay hojas que repiten bloques de otras ("todas"
// junta las de Gus, Flor, Mili, Vicky y Male; "Dani" y "ENERO 2026" empiezan
// igual): un bloque con los mismos movimientos que otro ya leído de la misma
// persona se marca como duplicado.

export interface MovCajaChica {
  fila_excel:  number;
  fecha:       string | null;  // YYYY-MM-DD; null = apertura / ingreso sin fecha
  descripcion: string;
  ingreso:     number;
  egreso:      number;
}

export interface BloqueCajaChica {
  clave:          string;        // persona|mes|n — identifica la rendición
  hoja:           string;
  fila_inicio:    number;
  fila_fin:       number;
  persona_clave:  string;        // DANI, VICKY, FLOR...
  persona:        string;        // "Dani Yanello"
  nombre_planilla: string;       // "DANI MAYO"
  mes:            string;        // "Mayo 2026"
  nombre_cuenta:  string;        // "Caja chica Dani Yanello — Mayo 2026 (2)"
  movimientos:    MovCajaChica[];
  ingresos:       number;
  egresos:        number;
  saldo:          number;
  desde:          string | null;
  hasta:          string | null;
  /** Totales que trae la planilla en la fila TOTALES (null si el bloque no la tiene). */
  totales_planilla: { ingresos: number | null; egresos: number | null; saldo: number | null } | null;
  diferencias:    string[];
  duplicado_de:   string | null; // "Flor (fila 7)" si repite otro bloque
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const pad = (n: number) => String(n).padStart(2, '0');
const red2 = (n: number) => Math.round(n * 100) / 100;
const k = (s: string) => normTexto(s).replace(/ /g, '');
const titulo = (s: string) => s.toLowerCase().replace(/(^|[\s/])\p{L}/gu, m => m.toUpperCase());

// Nombre en la planilla → persona. La clave es la primera palabra sin el mes
// ("DANI MARZO" y "DANI YANELLO" son la misma persona).
const ALIAS_PERSONA: Record<string, string> = { victoria: 'vicky', florencia: 'flor' };
const NOMBRE_PERSONA: Record<string, string> = {
  dani: 'Dani Yanello', vicky: 'Vicky Almada', flor: 'Flor Gómez', marcos: 'Marcos Díaz',
  male: 'Male', mili: 'Mili', gus: 'Gus', pipa: 'Pipa', jaz: 'Jaz', mario: 'Mario', coworking: 'Coworking',
};

function persona(nombrePlanilla: string): { clave: string; nombre: string } {
  const palabras = normTexto(nombrePlanilla).split(' ')
    .filter(w => w && !MESES.includes(w) && !/^\d{2,4}$/.test(w) && w !== 'tc');
  const primera = palabras[0] ?? 'sin nombre';
  const clave = ALIAS_PERSONA[primera] ?? primera;
  return { clave, nombre: NOMBRE_PERSONA[clave] ?? titulo(palabras.join(' ') || primera) };
}

function fechaISO(v: unknown): string | null {
  if (v instanceof Date && !isNaN(v.getTime())) return `${v.getUTCFullYear()}-${pad(v.getUTCMonth() + 1)}-${pad(v.getUTCDate())}`;
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(String(v ?? '').trim());
  if (m) return `${m[3].length === 2 ? 2000 + Number(m[3]) : m[3]}-${pad(Number(m[2]))}-${pad(Number(m[1]))}`;
  return null;
}

const monto = (v: unknown): number => {
  if (esVacio(v)) return 0;
  const n = aNumero(typeof v === 'string' ? v.replace(/\$/g, '').trim() : v);
  return n !== null && Number.isFinite(n) ? n : 0;
};

interface Encabezado { fila: number; cFecha: number; cDesc: number; cIngreso: number; cEgreso: number; cSaldo: number | null }

/** Encabezados de bloque de la hoja (puede haber varios en la misma fila, uno al costado del otro). */
function encabezados(ws: ExcelJS.Worksheet): Encabezado[] {
  const out: Encabezado[] = [];
  for (let r = 1; r <= ws.rowCount; r++) {
    const celdas = celdasFila(ws, r);
    for (const f of celdas.filter(x => k(x.text) === 'fecha')) {
      const vecinas = celdas.filter(x => x.c > f.c && x.c <= f.c + 7);
      const col = (...claves: string[]) => vecinas.find(x => claves.some(c => k(x.text).startsWith(c)))?.c;
      const cDesc = col('descripcion', 'concepto'); const cIngreso = col('ingreso'); const cEgreso = col('egreso');
      if (cDesc && cIngreso && cEgreso) out.push({ fila: r, cFecha: f.c, cDesc, cIngreso, cEgreso, cSaldo: col('saldo') ?? null });
    }
  }
  return out;
}

/** "NOMBRE: …" y "MES: …" en las filas de arriba del encabezado, en sus columnas. */
function tituloBloque(ws: ExcelJS.Worksheet, h: Encabezado): { nombre: string | null; mes: string | null } {
  let nombre: string | null = null; let mes: string | null = null;
  for (let r = h.fila - 1; r >= Math.max(1, h.fila - 5) && (!nombre || !mes); r--) {
    for (const x of celdasFila(ws, r)) {
      if (x.c < h.cFecha || x.c > h.cFecha + 7) continue;
      const m1 = /^nombre\s*:\s*(.*)$/i.exec(x.text); if (m1 && !nombre) nombre = m1[1].trim();
      const m2 = /^mes\s*:\s*(.*)$/i.exec(x.text); if (m2 && !mes) mes = m2[1].trim();
    }
  }
  return { nombre, mes };
}

function leerBloque(ws: ExcelJS.Worksheet, h: Encabezado, finHoja: number) {
  const movs: MovCajaChica[] = [];
  let totales: BloqueCajaChica['totales_planilla'] = null;
  let fin = h.fila;
  for (let r = h.fila + 1; r <= finHoja; r++) {
    const desc = masterRaw(ws, r, h.cDesc);
    const textoDesc = esVacio(desc) ? '' : String(desc).trim();
    const textoFecha = String(masterRaw(ws, r, h.cFecha) ?? '').trim();
    // Fin del bloque: la fila de totales, o el título del bloque siguiente
    if (/^total(es)?\s*:?$/i.test(textoDesc) || /^total(es)?\s*:?$/i.test(textoFecha)) {
      const ing = masterRaw(ws, r, h.cIngreso); const egr = masterRaw(ws, r, h.cEgreso);
      const sal = h.cSaldo ? masterRaw(ws, r, h.cSaldo) : null;
      totales = {
        ingresos: esVacio(ing) ? null : monto(ing),
        egresos:  esVacio(egr) ? null : monto(egr),
        saldo:    esVacio(sal) ? null : monto(sal),
      };
      fin = r;
      break;
    }
    if (/^nombre\s*:/i.test(textoFecha)) break;
    fin = r;
    if (!textoDesc) continue;
    const ingreso = monto(masterRaw(ws, r, h.cIngreso));
    const egreso = monto(masterRaw(ws, r, h.cEgreso));
    if (!ingreso && !egreso) continue;
    movs.push({ fila_excel: r, fecha: fechaISO(masterRaw(ws, r, h.cFecha)), descripcion: textoDesc, ingreso: red2(ingreso), egreso: red2(egreso) });
  }
  return { movs, totales, fin };
}

/** Movimientos como claves "fecha|ingreso|egreso" (para comparar bloques). */
const clavesMov = (movs: MovCajaChica[]) => movs.map(m => `${m.fecha ?? ''}|${m.ingreso}|${m.egreso}`);

/** Parte de los movimientos que comparten dos bloques (sobre el más largo), y los que no. */
function parecido(a: MovCajaChica[], b: MovCajaChica[]): { ratio: number; soloEnB: number; soloEnA: number } {
  const resto = new Map<string, number>();
  for (const x of clavesMov(a)) resto.set(x, (resto.get(x) ?? 0) + 1);
  let comunes = 0;
  for (const x of clavesMov(b)) { const n = resto.get(x) ?? 0; if (n > 0) { comunes++; resto.set(x, n - 1); } }
  return { ratio: comunes / Math.max(a.length, b.length), soloEnB: b.length - comunes, soloEnA: a.length - comunes };
}

interface BloqueCrudo {
  ws: ExcelJS.Worksheet; h: Encabezado; nombre: string | null; mes: string | null;
  movs: MovCajaChica[]; totales: BloqueCajaChica['totales_planilla']; fin: number;
}

export async function parseCajasChicas(buffer: Buffer): Promise<{ bloques: BloqueCajaChica[]; hojas_omitidas: string[] }> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as any);

  // Las hojas de una persona primero; "todas" (la que junta las demás) al final,
  // así un bloque repetido queda en su hoja original.
  const hojas = [...wb.worksheets].sort((a, b) => Number(/^todas$/i.test(a.name.trim())) - Number(/^todas$/i.test(b.name.trim())));
  const hojas_omitidas: string[] = [];
  const crudos: BloqueCrudo[] = [];
  for (const ws of hojas) {
    const encs = encabezados(ws);
    if (encs.length === 0) { hojas_omitidas.push(ws.name); continue; }
    for (const h of encs) {
      // El bloque termina antes del siguiente encabezado en las mismas columnas
      const siguiente = encs.find(o => o.fila > h.fila && Math.abs(o.cFecha - h.cFecha) <= 2);
      const { nombre, mes } = tituloBloque(ws, h);
      const { movs, totales, fin } = leerBloque(ws, h, siguiente ? siguiente.fila - 1 : ws.rowCount);
      if (movs.length) crudos.push({ ws, h, nombre, mes, movs, totales, fin });
    }
  }

  // Año de cada mes, según las fechas de los bloques que las tienen (la caja de
  // Vicky dice "MES: DICIEMBRE" y no tiene ninguna fecha)
  const anioDeMes = new Map<string, Map<string, number>>();
  for (const c of crudos) for (const m of c.movs) {
    if (!m.fecha) continue;
    const mes = MESES[Number(m.fecha.slice(5, 7)) - 1];
    const por = anioDeMes.get(mes) ?? new Map<string, number>();
    por.set(m.fecha.slice(0, 4), (por.get(m.fecha.slice(0, 4)) ?? 0) + 1);
    anioDeMes.set(mes, por);
  }
  const anioPara = (mesTexto: string) => {
    const primero = normTexto(mesTexto).split(/[ /]/)[0];
    const por = anioDeMes.get(primero);
    return por ? [...por.entries()].sort((a, b) => b[1] - a[1])[0][0] : '';
  };

  const bloques: BloqueCajaChica[] = [];
  const ordinal = new Map<string, number>();
  for (const c of crudos) {
    const { ws, h, movs, totales, fin } = c;
    const p = c.nombre ? persona(c.nombre) : { clave: `sin nombre ${ws.name} ${h.fila}`, nombre: `sin nombre (hoja ${ws.name}, fila ${h.fila})` };
    const fechas = movs.map(m => m.fecha).filter((f): f is string => !!f).sort();
    const ultima = fechas[fechas.length - 1] ?? null;
    // Mes: el que dice la planilla ("MAYO/JUNIO", "ENERO 2026"); año, el de las fechas
    const mesTexto = c.mes ? titulo(c.mes.replace(/\d{4}/, '').trim()) : (ultima ? titulo(MESES[Number(ultima.slice(5, 7)) - 1]) : null);
    const anio = /\d{4}/.exec(c.mes ?? '')?.[0] ?? ultima?.slice(0, 4) ?? (mesTexto ? anioPara(mesTexto) : '');
    const mesLabel = [mesTexto ?? ws.name, anio].filter(Boolean).join(' ');

    // Fecha de los ingresos sin fecha (apertura): la primera del bloque
    for (const m of movs) if (!m.fecha) m.fecha = fechas[0] ?? null;

    const ingresos = red2(movs.reduce((a, m) => a + m.ingreso, 0));
    const egresos = red2(movs.reduce((a, m) => a + m.egreso, 0));
    const saldo = red2(ingresos - egresos);
    const diferencias: string[] = [];
    if (totales) {
      const soloUno = [totales.ingresos, totales.egresos, totales.saldo].filter(v => v !== null).length === 1;
      if (soloUno) {
        // COWORKING: "TOTAL" con un solo número = el acumulado de gastos
        const t = totales.saldo ?? totales.egresos ?? totales.ingresos!;
        if (Math.abs(t - egresos) > 0.5) diferencias.push(`Total de la planilla $${t} y gastos sumados $${egresos}`);
      } else {
        if (totales.ingresos !== null && Math.abs(totales.ingresos - ingresos) > 0.5) diferencias.push(`Ingresos: la planilla dice $${totales.ingresos} y las filas suman $${ingresos}`);
        if (totales.egresos !== null && Math.abs(totales.egresos - egresos) > 0.5) diferencias.push(`Egresos: la planilla dice $${totales.egresos} y las filas suman $${egresos}`);
        if (totales.saldo !== null && Math.abs(totales.saldo - saldo) > 0.5) diferencias.push(`Saldo: la planilla dice $${totales.saldo} y da $${saldo}`);
      }
    }

    // Repetido: otro bloque de la misma persona con el 80% o más de los mismos
    // movimientos. La hoja "todas" es una copia de las demás, a veces de otra
    // versión (a la caja de Dani de diciembre le faltan filas): ahí alcanza el 50%.
    let original: BloqueCajaChica | null = null;
    let detalleDup = '';
    for (const o of bloques) {
      if (o.duplicado_de || o.persona_clave !== p.clave) continue;
      const pr = parecido(o.movimientos, movs);
      if (pr.ratio >= (/^todas$/i.test(ws.name.trim()) ? 0.5 : 0.8)) {
        original = o;
        detalleDup = pr.soloEnA || pr.soloEnB ? ` — con diferencias: ${pr.soloEnB} filas que no están en el original y ${pr.soloEnA} que faltan` : '';
        break;
      }
    }
    const base = `${p.clave}|${normTexto(mesLabel)}`;
    const n = original ? 0 : (ordinal.get(base) ?? 0) + 1;
    if (!original) ordinal.set(base, n);

    bloques.push({
      clave: original ? `${base}|dup|${ws.name}|${h.fila}` : `${base}|${n}`,
      hoja: ws.name, fila_inicio: h.fila, fila_fin: fin,
      persona_clave: p.clave, persona: p.nombre, nombre_planilla: c.nombre ?? '', mes: mesLabel,
      // Una copia exacta cae en la caja del original (no suma nada); una con
      // diferencias, si se elige importarla, va aparte para poder compararlas.
      nombre_cuenta: original ? (detalleDup ? `${original.nombre_cuenta} — versión hoja ${ws.name}` : original.nombre_cuenta) : `Caja chica ${p.nombre} — ${mesLabel}${n > 1 ? ` (${n})` : ''}`,
      movimientos: movs, ingresos, egresos, saldo,
      desde: fechas[0] ?? null, hasta: ultima,
      totales_planilla: totales, diferencias,
      duplicado_de: original ? `hoja ${original.hoja}, fila ${original.fila_inicio}${detalleDup}` : null,
    });
  }
  if (bloques.length === 0) throw new Error('No se encontró ninguna caja (se esperan las columnas FECHA, DESCRIPCIÓN, INGRESO, EGRESO y SALDO)');
  return { bloques, hojas_omitidas };
}
