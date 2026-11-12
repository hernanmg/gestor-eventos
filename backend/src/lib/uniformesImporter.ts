import ExcelJS from 'exceljs';
import { prisma } from './prisma';
import { matchEmpleadoPorNombre } from './siniestrosVehiculoImporter';

// Importador de docs/dos57/lorena/DOS57- PERSONAL ENTREGA UNIFORME 2024.xlsx
// (Lorena, DOS57) → EntregaUniforme. Estructura real del libro (68 hojas):
//   - "PLANTA ESTABLE": bloques por empleado; el nombre va en col A de la
//     PRIMERA fila del bloque (que ya trae cantidades), fecha en col M, cierra
//     con una fila "TOTAL". Tiene columna BUZO (no está en las hojas nuevas).
//   - "ENJOY": entregas sin nombre de persona — NO se importa (no hay a quién
//     asignarlas; la spec la excluye explícitamente).
//   - "DOS57_ENTREGA_AAAA": resumen anual, una fila por persona (N°, nombre,
//     apodo, prendas). Sólo filas con N° (excluye TOTAL y filas de grupo como
//     "MORAS"/"BRUJAS").
//   - Resto: una hoja por empleado (nombre completo en E2, headers en la fila
//     con "FECHA" en col A). Columnas extra variables (CASCO, MARTILLO, ARNES,
//     GUANTES SOLDAR…) → `otros`. Pestaña roja = dado de baja.
// Es exceljs (no SheetJS) porque hace falta leer colores de pestaña y relleno
// de celdas, que la edición community de SheetJS no expone.

export type ModoImportUniformes = 'HISTORIAL' | 'RESUMEN' | 'TODO';

type Prenda =
  | 'borcegos' | 'remeras' | 'camperon' | 'chombas' | 'campera' | 'mochila'
  | 'buzo' | 'pantalon' | 'bermuda' | 'gorra' | 'prot_lumbar' | 'guantes';

export const PRENDAS: Prenda[] = [
  'borcegos', 'remeras', 'camperon', 'chombas', 'campera', 'mochila',
  'buzo', 'pantalon', 'bermuda', 'gorra', 'prot_lumbar', 'guantes',
];

interface EntregaParseada {
  empleado_nombre: string;
  // Texto extra para el matching (apodo entre paréntesis, col APODO del resumen)
  nombre_matching: string;
  fecha_entrega:   Date;
  cantidades:      Record<Prenda, number>;
  otros:           string[];
  origen_hoja:     string;
  anio_resumen:    number | null;
}

interface HojaIndividual { hoja: string; nombre: string; matching: string; roja: boolean }

export interface ErrorImport { hoja: string; motivo: string }

export interface ResultadoImportUniformes {
  preview:                  boolean;
  modo:                     ModoImportUniformes;
  hojas_procesadas:         string[];
  entregas_creadas:         number;
  entregas_actualizadas:    number;
  empleados_dados_baja:     { nombre: string; empleado_id: number; hoja: string }[];
  // Hoja roja pero el mismo empleado tiene otra hoja NO roja — no se da de baja
  bajas_ambiguas:           { nombre: string; hoja: string; motivo: string }[];
  empleados_no_encontrados: { nombre: string }[];
  errores:                  ErrorImport[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function norm(s: unknown): string {
  return String(s ?? '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(new RegExp('[\\u0300-\\u036f]', 'g'), '')
    .replace(/\s+/g, ' ');
}

function valorCelda(cell: ExcelJS.Cell): unknown {
  const v = cell.value as any;
  if (v && typeof v === 'object' && !(v instanceof Date)) {
    if ('result' in v) return v.result;           // fórmula
    if ('richText' in v) return v.richText.map((r: any) => r.text).join('');
    if ('text' in v) return v.text;               // hyperlink
  }
  return v;
}

function aFechaUTC(v: unknown): Date | null {
  if (v instanceof Date && !isNaN(v.getTime())) return new Date(Date.UTC(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate()));
  if (typeof v === 'string') {
    const m = v.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (m) {
      let anio = Number(m[3]);
      if (anio < 100) anio += 2000;
      return new Date(Date.UTC(anio, Number(m[2]) - 1, Number(m[1])));
    }
  }
  return null;
}

function aCantidad(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

function fmtFecha(d: Date): string {
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
}

// Rojo = R alto y G/B bajos (las pestañas reales usan FFFF0000 y FFEE0000).
function esRojo(color: any): boolean {
  const argb: string | undefined = color?.argb;
  if (!argb || argb.length < 6) return false;
  const hex = argb.slice(-6);
  const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
  return r >= 0xC0 && g < 0x50 && b < 0x50;
}

function celdaRoja(cell: ExcelJS.Cell): boolean {
  const fill = cell.fill as any;
  return fill?.type === 'pattern' && fill.pattern !== 'none' && esRojo(fill.fgColor);
}

function cantidadesVacias(): Record<Prenda, number> {
  return Object.fromEntries(PRENDAS.map(p => [p, 0])) as Record<Prenda, number>;
}

// Mapea el texto de un header a la prenda del modelo. null = columna "otros".
function prendaDeHeader(h: string): Prenda | null {
  const t = norm(h);
  if (!t) return null;
  if (t.startsWith('BORCEG')) return 'borcegos';
  if (t.startsWith('REMERA')) return 'remeras'; // incluye "REMERA ESTRUCTURAS"
  if (t.startsWith('CAMPERON')) return 'camperon';
  if (t.startsWith('CHOMBA')) return 'chombas';
  if (t.startsWith('CAMPERA')) return 'campera';
  if (t.startsWith('MOCHILA')) return 'mochila';
  if (t.startsWith('BUZO')) return 'buzo';
  if (t.startsWith('PANTALON')) return 'pantalon';
  if (t.startsWith('BERMUDA')) return 'bermuda';
  if (t.startsWith('GORRA')) return 'gorra';
  if (t.includes('LUMBAR')) return 'prot_lumbar';
  if (t === 'GUANTES' || t.includes('MULTIFLEX')) return 'guantes';
  return null;
}

// "FERNANDEZ RODRIGO (CHOLI)" → nombre "FERNANDEZ RODRIGO", matching incluye CHOLI.
// "AGUIRRE DAVID_ DEVOLVIO" → "AGUIRRE DAVID".
function limpiarNombre(raw: string): { nombre: string; matching: string } {
  const s = String(raw ?? '').trim();
  const parens = [...s.matchAll(/\(([^)]*)\)/g)].map(m => m[1]).join(' ');
  const nombre = s.replace(/\([^)]*\)/g, '').split('_')[0].replace(/\s+/g, ' ').trim().toUpperCase();
  return { nombre, matching: `${nombre} ${parens}`.trim() };
}

interface ColumnaHoja { col: number; prenda: Prenda | null; header: string }

// Lee una fila de datos a partir del mapa de columnas: cantidades por prenda,
// columnas extra numéricas → "HEADER xN", textos sueltos → nota.
function leerFila(row: ExcelJS.Row, columnas: ColumnaHoja[], colsNota: number[]): { cantidades: Record<Prenda, number>; otros: string[] } {
  const cantidades = cantidadesVacias();
  const otros: string[] = [];
  for (const c of columnas) {
    const v = valorCelda(row.getCell(c.col));
    if (v == null || v === '') continue;
    if (c.prenda) {
      cantidades[c.prenda] += aCantidad(v);
    } else if (typeof v === 'number') {
      if (v > 0) otros.push(`${c.header.trim()} x${v}`);
    } else if (v instanceof Date) {
      otros.push(`${c.header.trim() || 'Fecha'}: ${fmtFecha(aFechaUTC(v)!)}`);
    } else if (String(v).trim()) {
      otros.push(c.header.trim() ? `${c.header.trim()}: ${String(v).trim()}` : String(v).trim());
    }
  }
  for (const col of colsNota) {
    const v = valorCelda(row.getCell(col));
    if (v == null || v === '') continue;
    otros.push(v instanceof Date ? fmtFecha(aFechaUTC(v)!) : String(v).trim());
  }
  return { cantidades, otros: otros.filter(Boolean) };
}

function tieneAlgo(e: { cantidades: Record<Prenda, number>; otros: string[] }): boolean {
  return PRENDAS.some(p => e.cantidades[p] > 0) || e.otros.length > 0;
}

// ── Parsers por tipo de hoja ──────────────────────────────────────────────────

function parsearPlantaEstable(ws: ExcelJS.Worksheet, errores: ErrorImport[]): EntregaParseada[] {
  // Headers en la fila 4 (B..L prendas, M = FECHA). Col A de esa fila trae
  // basura ("ARIAS GONZALO") — se ignora.
  let headerRow = 0;
  ws.eachRow((row, n) => {
    if (!headerRow && norm(valorCelda(row.getCell(13))) === 'FECHA') headerRow = n;
  });
  if (!headerRow) { errores.push({ hoja: ws.name, motivo: 'No se encontró la fila de headers (FECHA en col M)' }); return []; }

  const columnas: ColumnaHoja[] = [];
  for (let c = 2; c <= 12; c++) {
    const h = String(valorCelda(ws.getRow(headerRow).getCell(c)) ?? '');
    if (h.trim()) columnas.push({ col: c, prenda: prendaDeHeader(h), header: h });
  }

  const out: EntregaParseada[] = [];
  let actual: { nombre: string; matching: string } | null = null;
  for (let n = headerRow + 1; n <= ws.rowCount; n++) {
    const row = ws.getRow(n);
    const a = String(valorCelda(row.getCell(1)) ?? '').trim();
    if (norm(a) === 'TOTAL') { actual = null; continue; }
    if (a) actual = limpiarNombre(a);
    if (!actual) continue;

    const rawFecha = valorCelda(row.getCell(13));
    const fila = leerFila(row, columnas, []);
    if (!tieneAlgo(fila)) continue;
    const fecha = aFechaUTC(rawFecha);
    if (!fecha) {
      errores.push({ hoja: ws.name, motivo: `Fila ${n} (${actual.nombre}): fecha "${rawFecha ?? ''}" inválida — se omite` });
      continue;
    }
    out.push({
      empleado_nombre: actual.nombre, nombre_matching: actual.matching, fecha_entrega: fecha,
      ...fila, origen_hoja: ws.name, anio_resumen: null,
    });
  }
  return out;
}

function parsearResumen(ws: ExcelJS.Worksheet, anio: number, errores: ErrorImport[], rojos: string[]): EntregaParseada[] {
  // Fila de headers: la que tiene "APELLIDO Y NOMBRE" en col B.
  let headerRow = 0;
  ws.eachRow((row, n) => {
    if (!headerRow && norm(valorCelda(row.getCell(2))).startsWith('APELLIDO')) headerRow = n;
  });
  if (!headerRow) { errores.push({ hoja: ws.name, motivo: 'No se encontró la fila de headers (APELLIDO Y NOMBRE)' }); return []; }

  const columnas: ColumnaHoja[] = [];
  ws.getRow(headerRow).eachCell((cell, c) => {
    if (c <= 3) return; // N°, nombre, apodo
    const h = String(valorCelda(cell) ?? '');
    if (h.trim()) columnas.push({ col: c, prenda: prendaDeHeader(h), header: h });
  });

  const fecha = new Date(Date.UTC(anio, 11, 31));
  const out: EntregaParseada[] = [];
  for (let n = headerRow + 1; n <= ws.rowCount; n++) {
    const row = ws.getRow(n);
    const numero = valorCelda(row.getCell(1));
    const nombreRaw = String(valorCelda(row.getCell(2)) ?? '').trim();
    if (!nombreRaw || norm(nombreRaw) === 'TOTAL') continue;
    if (numero == null || numero === '') {
      errores.push({ hoja: ws.name, motivo: `Fila ${n} "${nombreRaw}": sin N° — se omite (spec: sólo filas con N°)` });
      continue;
    }
    const { nombre, matching } = limpiarNombre(nombreRaw);
    const apodo = String(valorCelda(row.getCell(3)) ?? '').replace(/\(.*?\)/g, '').trim();
    // Filas de grupo/cliente ("ENJOY"/"ENJOY", "MORAS"/"MORAS", "BRUJAS"/"BRUJAS"):
    // apodo idéntico al nombre y de una sola palabra — no son personas.
    if (norm(apodo) === norm(nombre) && !nombre.includes(' ')) {
      errores.push({ hoja: ws.name, motivo: `Fila ${n} "${nombreRaw}": fila de grupo/cliente, no de un empleado — se omite` });
      continue;
    }
    if (celdaRoja(row.getCell(1))) rojos.push(nombre);

    const fila = leerFila(row, columnas, []);
    if (!tieneAlgo(fila)) continue; // fila del padrón sin entregas ese año
    out.push({
      empleado_nombre: nombre, nombre_matching: `${matching} ${apodo}`.trim(), fecha_entrega: fecha,
      ...fila, origen_hoja: ws.name, anio_resumen: anio,
    });
  }
  return out;
}

function parsearIndividual(ws: ExcelJS.Worksheet, errores: ErrorImport[]): { entregas: EntregaParseada[]; nombre: string; matching: string } {
  const e2 = String(valorCelda(ws.getCell('E2')) ?? '').trim();
  const { nombre, matching } = limpiarNombre(e2 || ws.name);

  let headerRow = 0;
  ws.eachRow((row, n) => {
    if (!headerRow && norm(valorCelda(row.getCell(1))) === 'FECHA') headerRow = n;
  });
  if (!headerRow) { errores.push({ hoja: ws.name, motivo: 'No se encontró la fila de headers (FECHA en col A)' }); return { entregas: [], nombre, matching }; }

  // Headers contiguos desde col B. Lo que viene después de un hueco es otra
  // tabla lateral (ej. "DETALLE PARA DEVOLUCION" / herramientas en MORA
  // GABRIEL) y no son entregas de uniforme.
  const columnas: ColumnaHoja[] = [];
  const hr = ws.getRow(headerRow);
  let c = 2;
  for (; ; c++) {
    const h = String(valorCelda(hr.getCell(c)) ?? '');
    if (!h.trim()) break;
    columnas.push({ col: c, prenda: prendaDeHeader(h), header: h });
  }
  // La columna inmediata a la derecha trae notas sueltas (marca "OMBU",
  // "ESTRUCTURA", "1 CINTA METRICA…").
  const colsNota = [c];

  // Suma por fecha: una misma fecha repetida en la hoja es una sola entrega
  // (la clave de upsert es empleado+fecha+hoja).
  const porFecha = new Map<number, EntregaParseada>();
  for (let n = headerRow + 1; n <= ws.rowCount; n++) {
    const row = ws.getRow(n);
    const a = valorCelda(row.getCell(1));
    if (norm(a) === 'TOTAL') break;
    // Fila de totales sin label (=SUM(...) en las prendas) → fin de la tabla.
    if (columnas.some(col => (row.getCell(col.col).value as any)?.formula || (row.getCell(col.col).value as any)?.sharedFormula)) break;
    // Col A vacía = fila de otra tabla o renglón en blanco — no es una entrega.
    if (a == null || String(a).trim() === '') continue;
    const fila = leerFila(row, columnas, colsNota);
    if (!tieneAlgo(fila)) continue;
    let fecha = aFechaUTC(a);
    // "X/3/2026", "/2/2026": día desconocido → día 1 del mes, con aviso en otros.
    if (!fecha && typeof a === 'string') {
      const m = a.trim().match(/^[xX]?\/(\d{1,2})\/(\d{2,4})$/);
      if (m) {
        let anio = Number(m[2]);
        if (anio < 100) anio += 2000;
        fecha = new Date(Date.UTC(anio, Number(m[1]) - 1, 1));
        fila.otros.push(`fecha aproximada (planilla: "${a.trim()}")`);
      }
    }
    if (!fecha) {
      errores.push({ hoja: ws.name, motivo: `Fila ${n}: fecha "${a}" inválida — se omite` });
      continue;
    }
    const prev = porFecha.get(fecha.getTime());
    if (prev) {
      for (const p of PRENDAS) prev.cantidades[p] += fila.cantidades[p];
      prev.otros.push(...fila.otros);
    } else {
      porFecha.set(fecha.getTime(), {
        empleado_nombre: nombre, nombre_matching: matching, fecha_entrega: fecha,
        ...fila, origen_hoja: ws.name, anio_resumen: null,
      });
    }
  }
  return { entregas: [...porFecha.values()], nombre, matching };
}

// ── Import ────────────────────────────────────────────────────────────────────

const HOJA_PLANTA = 'PLANTA ESTABLE';
const HOJAS_IGNORADAS = new Set(['ENJOY']);
const RE_RESUMEN = /^DOS57_ENTREGA_(\d{4})$/i;

export async function importarUniformes(
  buffer: Buffer,
  empresaId: number,
  modo: ModoImportUniformes,
  usuarioId: number,
  dryRun: boolean,
): Promise<ResultadoImportUniformes> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as any);

  const errores: ErrorImport[] = [];
  const entregas: EntregaParseada[] = [];
  const hojasProcesadas: string[] = [];
  const individuales: HojaIndividual[] = [];
  const rojosResumen: string[] = [];
  const incluyeHistorial = modo === 'HISTORIAL' || modo === 'TODO';
  const incluyeResumen   = modo === 'RESUMEN'   || modo === 'TODO';

  for (const ws of wb.worksheets) {
    const nombreHoja = ws.name.trim();
    if (HOJAS_IGNORADAS.has(norm(nombreHoja))) continue;
    const mRes = nombreHoja.match(RE_RESUMEN);

    if (norm(nombreHoja) === HOJA_PLANTA) {
      if (!incluyeHistorial) continue;
      entregas.push(...parsearPlantaEstable(ws, errores));
      hojasProcesadas.push(ws.name);
    } else if (mRes) {
      if (!incluyeResumen) continue;
      entregas.push(...parsearResumen(ws, Number(mRes[1]), errores, rojosResumen));
      hojasProcesadas.push(ws.name);
    } else {
      if (!incluyeHistorial) continue;
      const { entregas: ents, nombre, matching } = parsearIndividual(ws, errores);
      if (!nombre || ents.length === 0) continue; // plantilla vacía (ej. "FICHA BCO.")
      entregas.push(...ents);
      hojasProcesadas.push(ws.name);
      individuales.push({ hoja: ws.name, nombre, matching, roja: esRojo((ws.properties as any).tabColor) });
    }
  }

  // Misma clave de upsert repetida dentro del libro (ej. dos filas del mismo
  // bloque de PLANTA ESTABLE con igual fecha) → se suman en una sola entrega.
  const porClave = new Map<string, EntregaParseada>();
  for (const e of entregas) {
    const k = `${e.empleado_nombre}|${e.fecha_entrega.getTime()}|${e.origen_hoja}`;
    const prev = porClave.get(k);
    if (!prev) { porClave.set(k, e); continue; }
    for (const p of PRENDAS) prev.cantidades[p] += e.cantidades[p];
    prev.otros.push(...e.otros);
  }
  entregas.splice(0, entregas.length, ...porClave.values());

  // ── Matching contra Empleado ────────────────────────────────────────────────
  const empleados = await prisma.empleado.findMany({
    where:  { deleted_at: null, empresa_id: empresaId },
    select: { id: true, nombre: true, apellido: true, apodo: true, estado: true, notas: true },
  });
  const cacheMatch = new Map<string, number | null>();
  const matchear = (texto: string) => {
    if (!cacheMatch.has(texto)) cacheMatch.set(texto, matchEmpleadoPorNombre(texto, empleados)?.id ?? null);
    return cacheMatch.get(texto)!;
  };

  const noEncontrados = new Set<string>();
  for (const e of entregas) if (matchear(e.nombre_matching) === null) noEncontrados.add(e.empleado_nombre);

  // ── Bajas: pestaña roja (hojas individuales) o N° en rojo (resúmenes) ───────
  // Una persona con varias hojas (ej. "OCHOA ENZO" amarilla + "OCHOA ENZO_2025"
  // roja, "AGUIRRE DAVID" + "AGUIRRE DAVID X") NO se da de baja si alguna de
  // sus hojas no es roja — la roja suele ser un período anterior cerrado.
  const bajasAmbiguas: ResultadoImportUniformes['bajas_ambiguas'] = [];
  const candidatosBaja = new Map<number, { nombre: string; hoja: string }>();
  for (const h of individuales.filter(i => i.roja)) {
    const id = matchear(h.matching);
    if (id === null) continue; // ya figura en no encontrados
    const otraNoRoja = individuales.find(o => !o.roja && matchear(o.matching) === id);
    if (otraNoRoja) {
      bajasAmbiguas.push({ nombre: h.nombre, hoja: h.hoja, motivo: `tiene además la hoja "${otraNoRoja.hoja}" sin marcar en rojo` });
      continue;
    }
    candidatosBaja.set(id, { nombre: h.nombre, hoja: h.hoja });
  }
  for (const nombre of rojosResumen) {
    const id = matchear(nombre);
    if (id !== null && !candidatosBaja.has(id)) candidatosBaja.set(id, { nombre, hoja: 'resumen anual (N° en rojo)' });
  }

  const empleadosById = new Map(empleados.map(e => [e.id, e]));
  const bajas = [...candidatosBaja.entries()]
    .filter(([id]) => empleadosById.get(id)?.estado === 'ACTIVO')
    .map(([id, v]) => ({ empleado_id: id, ...v }));

  // ── Persistencia ────────────────────────────────────────────────────────────
  let creadas = 0, actualizadas = 0;
  const claveExistente = async (e: EntregaParseada) => prisma.entregaUniforme.findUnique({
    where: { empresa_id_empleado_nombre_fecha_entrega_origen_hoja: {
      empresa_id: empresaId, empleado_nombre: e.empleado_nombre, fecha_entrega: e.fecha_entrega, origen_hoja: e.origen_hoja,
    } },
    select: { id: true },
  });

  for (const e of entregas) {
    const existente = await claveExistente(e);
    if (dryRun) { existente ? actualizadas++ : creadas++; continue; }
    const data = {
      empleado_id:  matchear(e.nombre_matching),
      ...e.cantidades,
      otros:        e.otros.length ? [...new Set(e.otros)].join(' · ') : null,
      anio_resumen: e.anio_resumen,
    };
    try {
      if (existente) {
        await prisma.entregaUniforme.update({ where: { id: existente.id }, data });
        actualizadas++;
      } else {
        await prisma.entregaUniforme.create({
          data: {
            ...data, empresa_id: empresaId, empleado_nombre: e.empleado_nombre,
            fecha_entrega: e.fecha_entrega, origen_hoja: e.origen_hoja, created_by: usuarioId,
          },
        });
        creadas++;
      }
    } catch (err: any) {
      errores.push({ hoja: e.origen_hoja, motivo: `${e.empleado_nombre} ${fmtFecha(e.fecha_entrega)}: ${err.message}` });
    }
  }

  if (!dryRun) {
    for (const b of bajas) {
      const emp = empleadosById.get(b.empleado_id)!;
      const nota = 'Dado de baja según planilla uniformes';
      await prisma.empleado.update({
        where: { id: b.empleado_id },
        data:  { estado: 'INACTIVO', notas: emp.notas?.includes(nota) ? emp.notas : [emp.notas, nota].filter(Boolean).join('\n') },
      });
    }
  }

  return {
    preview:                  dryRun,
    modo,
    hojas_procesadas:         hojasProcesadas,
    entregas_creadas:         creadas,
    entregas_actualizadas:    actualizadas,
    empleados_dados_baja:     bajas.map(b => ({ nombre: b.nombre, empleado_id: b.empleado_id, hoja: b.hoja })),
    bajas_ambiguas:           bajasAmbiguas,
    empleados_no_encontrados: [...noEncontrados].sort().map(nombre => ({ nombre })),
    errores,
  };
}
