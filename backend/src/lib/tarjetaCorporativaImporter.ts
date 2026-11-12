import * as XLSX from 'xlsx';
import { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { EMPRESAS } from './empresasConstants';

// Importador de las planillas de Tarjeta Corporativa Galicia que lleva Santi:
//   docs/dos57/santi-nico/Tarjeta Corporativa DOS57 2026 (1).xlsx
//   docs/dos57/santi-nico/Tarjeta Corporativa ENJOY 2026 (1).xlsx
//
// Una hoja por mes ("CONSUMOS ENERO 2026", a veces con espacios de más). Cada
// hoja tiene dos bloques:
//   1. Resumen (RESPONSABLES | TOTAL INDIVIDUAL | TOTAL PERÍODO) — NO se usa:
//      tiene valores tipeados a mano, responsables vacíos con datos en el
//      detalle (VECKY), filas corridas (Enjoy agosto) y un F8 que no cierra.
//      Sólo se lee para saber qué responsables se dividen PERSONAL/EMPRESA.
//   2. Detalle (RESPONSABLE | FECHA | MONTO $ | MONTO USD | DETALLE |
//      OBSERVACIONES | EMPRESA), un bloque por responsable cerrado con
//      "SUBTOTAL GASTOS"; el nombre sólo figura en la primera fila del bloque.
//
// La posición de ambos bloques varía entre hojas (resumen en fila 8 u 11,
// detalle entre 16 y 20) — se ubican por texto. El mes/año se toma del nombre
// de la hoja (las celdas MES/AÑO están vacías en DOS57 ago-dic).

const MESES: Record<string, number> = {
  ENERO: 1, FEBRERO: 2, MARZO: 3, ABRIL: 4, MAYO: 5, JUNIO: 6, JULIO: 7,
  AGOSTO: 8, SEPTIEMBRE: 9, SETIEMBRE: 9, OCTUBRE: 10, NOVIEMBRE: 11, DICIEMBRE: 12,
};

export const TIPO_PERSONAL = 'PERSONAL';
export const TIPO_EMPRESA  = 'EMPRESA';
export const MARCA_MIXTO   = '(MIXTO – revisar)';

function norm(s: unknown): string {
  return String(s ?? '')
    .normalize('NFD')
    .replace(new RegExp('[\\u0300-\\u036f]', 'g'), '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function excelDateToJs(value: unknown): Date | null {
  if (value == null || value === '') return null;
  if (value instanceof Date) return new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed || parsed.y < 2000 || parsed.y > 2100) return null;
    return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
  }
  const m = String(value).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    let anio = Number(m[3]);
    if (anio < 100) anio += 2000;
    return new Date(Date.UTC(anio, Number(m[2]) - 1, Number(m[1])));
  }
  return null;
}

function toMonto(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(String(value).replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

// "SE DESCONTO" está contenido en "NO SE DESCONTO" — el negativo va primero.
export function descontadoDesdeObservaciones(obs: string | null | undefined): boolean {
  const o = norm(obs);
  if (/NO SE DESCONT/.test(o)) return false;
  return /SE DESCONT/.test(o);
}

// "POLLO $" / "MATI USD" / "MALE " → "POLLO" / "MATI" / "MALE".
function nombreBase(label: string): string {
  return norm(label).replace(/\s*(\$|USD|U\$S)$/, '').trim();
}

// ── Parseo (sin DB) ───────────────────────────────────────────────────────────

export interface FilaTC {
  hoja:           string;
  fila:           number; // 1-based, como en Excel
  responsable:    string;
  tipo:           string;
  periodo_mes:    number;
  periodo_anio:   number;
  fecha:          Date;
  monto_ars:      number | null;
  monto_usd:      number | null;
  detalle:        string | null;
  observaciones:  string | null;
  empresa_imputa: string | null;
  descontado:     boolean;
  mixto:          boolean;
  import_key:     string;
}

export interface HojaTC {
  hoja:        string;
  mes:         number | null;
  anio:        number | null;
  filas:       FilaTC[];
  advertencias: string[];
}

function cellValue(ws: XLSX.WorkSheet, r: number, c: number): unknown {
  const cell = ws[XLSX.utils.encode_cell({ r, c })];
  return cell ? cell.v : null;
}

export function parsearHojaTC(ws: XLSX.WorkSheet, nombreHoja: string): HojaTC {
  const hoja = nombreHoja.trim();
  const advertencias: string[] = [];
  const mm = norm(hoja).match(/(ENERO|FEBRERO|MARZO|ABRIL|MAYO|JUNIO|JULIO|AGOSTO|SEPTIEMBRE|SETIEMBRE|OCTUBRE|NOVIEMBRE|DICIEMBRE)\s+(\d{4})/);
  if (!mm) return { hoja, mes: null, anio: null, filas: [], advertencias: ['No se pudo detectar mes/año del nombre de la hoja'] };
  const mes = MESES[mm[1]];
  const anio = Number(mm[2]);

  const ref = ws['!ref'];
  if (!ref) return { hoja, mes, anio, filas: [], advertencias };
  const range = XLSX.utils.decode_range(ref);
  const txt = (r: number, c: number) => norm(cellValue(ws, r, c));

  // Responsables divididos PERSONAL/EMPRESA: los que el resumen lista como
  // "X PERSONAL" y "X EMPRESA" (ANDRE y VECKY en DOS57).
  const personal = new Set<string>();
  const empresa  = new Set<string>();
  let detalleHdr = -1;
  for (let r = range.s.r; r <= range.e.r; r++) {
    const a = txt(r, 0);
    if (a === 'RESPONSABLE' && txt(r, 1) === 'FECHA') { detalleHdr = r; break; }
    const m = a.match(/^(.+?)\s+(PERSONAL|EMPRESA)$/);
    if (m) (m[2] === 'PERSONAL' ? personal : empresa).add(m[1]);
  }
  const divididos = new Set([...personal].filter(n => empresa.has(n)));

  if (detalleHdr < 0) {
    advertencias.push('No se encontró el encabezado del detalle (RESPONSABLE | FECHA)');
    return { hoja, mes, anio, filas: [], advertencias };
  }

  // Columnas por texto de encabezado (hoy siempre A-G, pero no lo asumimos).
  const col: Record<string, number> = {};
  for (let c = range.s.c; c <= Math.min(range.e.c, 15); c++) {
    const h = txt(detalleHdr, c);
    if (h === 'FECHA') col.fecha = c;
    else if (h === 'MONTO $') col.ars = c;
    else if (h === 'MONTO USD') col.usd = c;
    else if (h === 'DETALLE') col.detalle = c;
    else if (h === 'OBSERVACIONES') col.obs = c;
    else if (h === 'EMPRESA') col.empresa = c;
  }
  if (col.fecha == null || col.ars == null || col.usd == null) {
    advertencias.push('Encabezado del detalle incompleto (faltan FECHA / MONTO $ / MONTO USD)');
    return { hoja, mes, anio, filas: [], advertencias };
  }

  const filas: FilaTC[] = [];
  const ocurrencias = new Map<string, number>();
  let actual: string | null = null;

  for (let r = detalleHdr + 1; r <= range.e.r; r++) {
    const aRaw = cellValue(ws, r, 0);
    const a = norm(aRaw);
    if (a.startsWith('SUBTOTAL') || a.startsWith('TOTAL')) { actual = null; continue; }
    // Etiqueta de bloque: texto con letras. Ignora basura suelta de la planilla
    // (un número en una fila combinada en DOS57 feb, un "}" en Enjoy feb).
    if (a && /[A-Z]/.test(a)) actual = nombreBase(a);

    const fecha = excelDateToJs(cellValue(ws, r, col.fecha));
    if (!fecha) continue;
    if (!actual) { advertencias.push(`Fila ${r + 1}: consumo con fecha pero sin responsable — omitido`); continue; }

    const monto_ars = toMonto(cellValue(ws, r, col.ars));
    const monto_usd = toMonto(cellValue(ws, r, col.usd));
    const detalle   = col.detalle != null ? (String(cellValue(ws, r, col.detalle) ?? '').trim() || null) : null;
    let observaciones = col.obs != null ? (String(cellValue(ws, r, col.obs) ?? '').trim() || null) : null;
    const empresa_imputa = col.empresa != null ? (String(cellValue(ws, r, col.empresa) ?? '').trim() || null) : null;

    // PERSONAL vs EMPRESA según la columna EMPRESA: sólo "PERSONAL" → PERSONAL;
    // mixto ("PERSONAL Y DOS57") → EMPRESA marcado para revisar (Santi lo
    // repartió a mano y el reparto no está en el archivo); vacío u otra
    // empresa → EMPRESA (igual que el propio resumen de julio).
    let tipo = TIPO_PERSONAL;
    let mixto = false;
    if (divididos.has(actual)) {
      const g = norm(empresa_imputa);
      const tienePersonal = g.includes('PERSONAL');
      const tieneEmpresa  = /DOS57|DOS 57|ENJOY|EMPRESA/.test(g);
      if (tienePersonal && !tieneEmpresa) tipo = TIPO_PERSONAL;
      else {
        tipo = TIPO_EMPRESA;
        if (tienePersonal && tieneEmpresa) {
          mixto = true;
          if (!observaciones?.includes(MARCA_MIXTO)) observaciones = [observaciones, MARCA_MIXTO].filter(Boolean).join(' ');
        }
      }
    }

    // Clave de idempotencia: período + responsable + fecha + detalle + montos
    // + N° de aparición (la planilla repite cargos idénticos legítimos). No
    // incluye el tipo: si Santi reclasifica la columna EMPRESA, se actualiza.
    const base = [anio, mes, actual, fecha.toISOString().slice(0, 10), norm(detalle), monto_ars ?? '', monto_usd ?? ''].join('|');
    const n = (ocurrencias.get(base) ?? 0) + 1;
    ocurrencias.set(base, n);

    filas.push({
      hoja, fila: r + 1, responsable: actual, tipo, periodo_mes: mes, periodo_anio: anio, fecha, monto_ars, monto_usd, detalle,
      observaciones, empresa_imputa, descontado: descontadoDesdeObservaciones(observaciones), mixto,
      import_key: `${base}|${n}`,
    });
  }

  return { hoja, mes, anio, filas, advertencias };
}

// ── Importación (DB) ─────────────────────────────────────────────────────────

export function nombreTarjetaDefault(empresaId: number, empresaNombre: string): string {
  if (empresaId === EMPRESAS.DOS57) return 'TC DOS57 Galicia';
  if (empresaId === EMPRESAS.ENJOY) return 'TC Enjoy Galicia';
  return `TC ${empresaNombre} Galicia`;
}

export async function obtenerOCrearTarjeta(empresaId: number) {
  const existente = await prisma.tarjetaCorporativa.findFirst({
    where: { empresa_id: empresaId, activa: true },
    orderBy: { id: 'asc' },
  });
  if (existente) return existente;
  const empresa = await prisma.empresa.findUniqueOrThrow({ where: { id: empresaId } });
  return prisma.tarjetaCorporativa.create({
    data: { empresa_id: empresaId, nombre: nombreTarjetaDefault(empresaId, empresa.nombre_corto ?? empresa.nombre) },
  });
}

// "ANDRE" → Usuario "Andrea ...", "JAZ" → "Jazmín ...": el apodo tiene que ser
// el primer nombre o un prefijo (≥3 letras) de él, y el candidato único entre
// los usuarios con acceso a la empresa — si hay ambigüedad, no se vincula.
export async function buscarUsuarioPorApodo(apodo: string, empresaId: number): Promise<number | null> {
  const usuarios = await prisma.usuario.findMany({
    where: {
      deleted_at: null,
      OR: [{ empresa_id: empresaId }, { empresaAccesos: { some: { empresa_id: empresaId } } }],
    },
    select: { id: true, nombre: true },
  });
  const a = norm(apodo);
  if (a.length < 3) return null;
  const exactos = usuarios.filter(u => norm(u.nombre).split(' ')[0] === a);
  if (exactos.length === 1) return exactos[0].id;
  if (exactos.length > 1) return null;
  const prefijo = usuarios.filter(u => norm(u.nombre).split(' ')[0].startsWith(a));
  return prefijo.length === 1 ? prefijo[0].id : null;
}

export interface ResumenHojaImport {
  hoja:        string;
  mes:         number | null;
  anio:        number | null;
  consumos:    number;
  total_ars:   number;
  total_usd:   number;
  mixtos:      number;
  por_responsable: { responsable: string; tipo: string; consumos: number; total_ars: number; total_usd: number }[];
  advertencias: string[];
}

export interface ResultadoImportTC {
  tarjeta:       { id: number | null; nombre: string };
  hojas:         ResumenHojaImport[];
  meses_detectados: number;
  meses_con_datos:  number;
  total_consumos: number;
  creados:       number;
  actualizados:  number;
  eliminados:    number;
  responsables_nuevos: string[];
}

function resumirHoja(h: HojaTC): ResumenHojaImport {
  const porResp = new Map<string, { responsable: string; tipo: string; consumos: number; total_ars: number; total_usd: number }>();
  for (const f of h.filas) {
    const k = `${f.responsable}|${f.tipo}`;
    const acc = porResp.get(k) ?? { responsable: f.responsable, tipo: f.tipo, consumos: 0, total_ars: 0, total_usd: 0 };
    acc.consumos++;
    acc.total_ars += f.monto_ars ?? 0;
    acc.total_usd += f.monto_usd ?? 0;
    porResp.set(k, acc);
  }
  const r2 = (n: number) => Math.round(n * 100) / 100;
  return {
    hoja: h.hoja, mes: h.mes, anio: h.anio,
    consumos:  h.filas.length,
    total_ars: r2(h.filas.reduce((s, f) => s + (f.monto_ars ?? 0), 0)),
    total_usd: r2(h.filas.reduce((s, f) => s + (f.monto_usd ?? 0), 0)),
    mixtos:    h.filas.filter(f => f.mixto).length,
    por_responsable: [...porResp.values()].map(p => ({ ...p, total_ars: r2(p.total_ars), total_usd: r2(p.total_usd) })),
    advertencias: h.advertencias,
  };
}

// preview=true: parsea y calcula creados/actualizados contra la DB sin escribir.
// preview=false: upsert por [tarjeta_id, import_key]. Además, en cada mes con
// datos en el archivo, da de baja (soft delete) los consumos importados antes
// cuya clave ya no está — así una corrección de monto en el Excel no deja el
// consumo viejo duplicado. Los consumos cargados a mano (import_key null) no se tocan.
export async function importarTarjetaCorporativa(
  workbook: XLSX.WorkBook, empresaId: number, usuarioId: number, preview: boolean,
): Promise<ResultadoImportTC> {
  const hojas = workbook.SheetNames.map(n => parsearHojaTC(workbook.Sheets[n], n));
  const filas = hojas.flatMap(h => h.filas);
  const periodos = hojas.filter(h => h.filas.length > 0 && h.mes && h.anio).map(h => ({ mes: h.mes!, anio: h.anio! }));

  const tarjetaExistente = await prisma.tarjetaCorporativa.findFirst({ where: { empresa_id: empresaId, activa: true }, orderBy: { id: 'asc' } });
  const empresa = await prisma.empresa.findUniqueOrThrow({ where: { id: empresaId } });

  const existentes = tarjetaExistente
    ? await prisma.consumoTC.findMany({
        where: { tarjeta_id: tarjetaExistente.id, import_key: { not: null } },
        select: { id: true, import_key: true, deleted_at: true, periodo_mes: true, periodo_anio: true },
      })
    : [];
  const porClave = new Map(existentes.map(e => [e.import_key!, e]));
  const clavesArchivo = new Set(filas.map(f => f.import_key));

  const creados      = filas.filter(f => !porClave.has(f.import_key)).length;
  const actualizados = filas.length - creados;
  const aEliminar    = existentes.filter(e =>
    !e.deleted_at && !clavesArchivo.has(e.import_key!) &&
    periodos.some(p => p.mes === e.periodo_mes && p.anio === e.periodo_anio));

  const respClaves = [...new Set(filas.map(f => `${f.responsable}|${f.tipo}`))];
  const respExistentes = tarjetaExistente
    ? await prisma.responsableTC.findMany({ where: { tarjeta_id: tarjetaExistente.id } })
    : [];
  const responsablesNuevos = respClaves
    .filter(k => !respExistentes.some(r => `${r.nombre}|${r.tipo}` === k))
    .map(k => { const [n, t] = k.split('|'); return t === TIPO_PERSONAL && !respClaves.includes(`${n}|${TIPO_EMPRESA}`) ? n : `${n} ${t}`; });

  const resultado: ResultadoImportTC = {
    tarjeta: { id: tarjetaExistente?.id ?? null, nombre: tarjetaExistente?.nombre ?? nombreTarjetaDefault(empresaId, empresa.nombre_corto ?? empresa.nombre) },
    hojas: hojas.map(resumirHoja),
    meses_detectados: hojas.filter(h => h.mes && h.anio).length,
    meses_con_datos:  periodos.length,
    total_consumos:   filas.length,
    creados, actualizados, eliminados: aEliminar.length,
    responsables_nuevos: responsablesNuevos,
  };
  if (preview) return resultado;

  const tarjeta = tarjetaExistente ?? await obtenerOCrearTarjeta(empresaId);
  resultado.tarjeta = { id: tarjeta.id, nombre: tarjeta.nombre };

  // Responsables: upsert por [tarjeta, nombre, tipo]; vincula usuario sólo al crear.
  const respIds = new Map<string, number>();
  for (const k of respClaves) {
    const [nombre, tipo] = k.split('|');
    let r = respExistentes.find(x => x.nombre === nombre && x.tipo === tipo);
    if (!r) {
      r = await prisma.responsableTC.create({
        data: { tarjeta_id: tarjeta.id, nombre, tipo, usuario_id: await buscarUsuarioPorApodo(nombre, empresaId) },
      });
    }
    respIds.set(k, r.id);
  }

  const dataDe = (f: FilaTC) => ({
    responsable_id: respIds.get(`${f.responsable}|${f.tipo}`)!,
    fecha:          f.fecha,
    periodo_mes:    f.periodo_mes,
    periodo_anio:   f.periodo_anio,
    monto_ars:      f.monto_ars != null ? new Prisma.Decimal(f.monto_ars) : null,
    monto_usd:      f.monto_usd != null ? new Prisma.Decimal(f.monto_usd) : null,
    detalle:        f.detalle,
    observaciones:  f.observaciones,
    empresa_imputa: f.empresa_imputa,
    descontado:     f.descontado,
    deleted_at:     null,
  });

  const nuevos = filas.filter(f => !porClave.has(f.import_key));
  const viejos = filas.filter(f => porClave.has(f.import_key));

  await prisma.$transaction(async tx => {
    if (nuevos.length) {
      await tx.consumoTC.createMany({
        data: nuevos.map(f => ({ ...dataDe(f), tarjeta_id: tarjeta.id, import_key: f.import_key, created_by: usuarioId })),
      });
    }
    for (const f of viejos) {
      await tx.consumoTC.update({ where: { id: porClave.get(f.import_key)!.id }, data: dataDe(f) });
    }
    if (aEliminar.length) {
      await tx.consumoTC.updateMany({ where: { id: { in: aEliminar.map(e => e.id) } }, data: { deleted_at: new Date() } });
    }
  }, { timeout: 120_000 });

  return resultado;
}
