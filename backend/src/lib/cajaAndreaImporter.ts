import * as XLSX from 'xlsx';
import type { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { recalcularSaldosCaja } from './recalcularSaldos';

// ── Helpers ───────────────────────────────────────────────────────────────────
// Mismos helpers de normalización/fecha/número que combustibleImporter.ts —
// ver ese archivo para el precedente de estas convenciones.

function normalize(s: unknown): string {
  return String(s ?? '').trim().toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Clave de columna sin espacios/puntuación — "DEV.GASTOS" y "DEV GASTOS" caen
// en la misma clave "DEVGASTOS".
function normalizeKey(s: unknown): string {
  return normalize(s).replace(/[^A-Z0-9]/g, '');
}

function excelDateToJs(value: any): Date | null {
  if (value == null || value === '') return null;
  if (value instanceof Date) return new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
  }
  const s = String(value).trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    let anio = Number(m[3]);
    if (anio < 100) anio += 2000;
    return new Date(Date.UTC(anio, Number(m[1]) - 1, Number(m[2])));
  }
  return null;
}

function toNumber(value: any): number {
  if (value == null || value === '') return 0;
  if (typeof value === 'number') return value;
  const cleaned = String(value).replace(/[^\d.,-]/g, '').replace(/\.(?=\d{3},)/g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

// Fecha en texto libre "DD/MM/YYYY" (ej. "4° SEM. 24/07/2026", una fila-
// etiqueta de período) — distinto de excelDateToJs, que espera una celda de
// fecha real o un string que ES la fecha completa. Se usa como fallback para
// tablas sin columna FECHA propia (ver ADELANTOS-DOS57 más abajo). El día va
// primero (convención argentina) — "24/07/2026" no admite otra lectura
// porque 24 no es un mes válido, así que no hay ambigüedad real acá.
function extraerFechaDeTexto(s: unknown): Date | null {
  const m = String(s ?? '').match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (!m) return null;
  const dia = Number(m[1]);
  const mes = Number(m[2]);
  let anio = Number(m[3]);
  if (anio < 100) anio += 2000;
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  return new Date(Date.UTC(anio, mes - 1, dia));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ── Mapeo hoja → cuenta ────────────────────────────────────────────────────────
// Nombres reales del Excel de Andrea (CAJAS_JULIO-2026.xlsx) — se matchea por
// substring normalizado, no exacto, porque el nombre de la hoja lleva el mes
// ("CAJA-POLLO-JULIO") y varía de un archivo a otro. Los meses simples
// ("JULIO", "AGOSTO"...) son todos la misma cuenta continua — Andrea abre una
// hoja nueva por mes en el Excel, pero en el sistema es un único libro diario
// (ver [[caja_empresa_sin_evento]]).
const MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];

function resolverNombreCuenta(sheetName: string): string | null {
  const norm = normalize(sheetName);
  if (norm.includes('FORMATO')) return null; // plantilla en blanco, no se importa
  if (norm.includes('RESERVA'))   return 'Caja Reserva';
  if (norm.includes('GUARDADA'))  return 'Caja Guardada';
  if (norm.includes('ADELANTO'))  return 'Adelantos DOS57';
  if (norm.includes('POLLO'))     return 'Caja Pollo';
  if (norm.includes('JAZMIN'))    return 'Caja Jazmín';
  if (norm.includes('MIGUEL'))    return 'Caja Miguel';
  if (norm.includes('DAVID'))     return 'Caja David';
  if (MESES.some(m => norm.includes(m))) return 'Caja General DOS57';
  return null; // hoja no reconocida
}

// ── Categorías (columnas de egreso del libro diario "JULIO") ─────────────────

const CATEGORIA_POR_HEADER: Record<string, string> = {
  COMBUSTIBLE:  'COMBUSTIBLE',
  COMIDA:       'COMIDA',
  GASTOSVARIOS: 'GASTOS_VARIOS',
  SERVICIOS:    'SERVICIOS',
  DEVGASTOS:    'DEV_GASTOS',
  VALES:        'VALES',
};

interface ColumnMap {
  fecha:       number | null;
  concepto:    number | null; // CONCEPTO / DESCRPCION / NOMBRE
  ingreso:     number | null;
  egreso:      number | null; // sólo en formato simple (RESERVA, cajas por persona)
  importe:     number | null; // ADELANTOS (siempre egreso)
  observacion: number | null;
  tipoFactura: number | null; // "TIPO FACTURA" (Caja Miguel/David)
  comprobante: number | null; // "N° COMP."/"N° COMPROBANTE"/"COMP.N°"
  categorias:  { col: number; categoria: string }[]; // columnas de egreso categorizadas (libro diario)
}

// ADELANTOS-DOS57 no tiene columna FECHA (el período se indica en una fila-
// etiqueta suelta antes del header, ver extraerFechaDeTexto/fechaImplicita en
// parsearHoja) — por eso el header se reconoce igual sin FECHA siempre que
// haya al menos NOMBRE + (IMPORTE|INGRESO|EGRESO|una columna categorizada).
function detectarHeader(row: any[]): ColumnMap | null {
  const norm = row.map(normalizeKey);
  const idxFecha = norm.indexOf('FECHA');

  const map: ColumnMap = {
    fecha: idxFecha !== -1 ? idxFecha : null,
    concepto:    null,
    ingreso:     null,
    egreso:      null,
    importe:     null,
    observacion: null,
    tipoFactura: null,
    comprobante: null,
    categorias:  [],
  };

  norm.forEach((h, i) => {
    if (h === 'CONCEPTO' || h === 'DESCRPCION' || h === 'DESCRIPCION' || h === 'NOMBRE') map.concepto = i;
    else if (h === 'INGRESO') map.ingreso = i;
    else if (h === 'EGRESO')  map.egreso = i;
    else if (h === 'IMPORTE') map.importe = i;
    else if (h === 'OBSERVACION' || h === 'OBSERVACIONES') map.observacion = i;
    else if (h === 'TIPOFACTURA') map.tipoFactura = i;
    else if (h === 'NCOMP' || h === 'NCOMPROBANTE' || h === 'COMPN') map.comprobante = i;
    else if (CATEGORIA_POR_HEADER[h]) map.categorias.push({ col: i, categoria: CATEGORIA_POR_HEADER[h] });
  });

  const tieneDatos = map.concepto !== null && (map.importe !== null || map.ingreso !== null || map.egreso !== null || map.categorias.length > 0);
  if (idxFecha === -1 && !tieneDatos) return null; // no es un header reconocible
  return map;
}

interface FilaImportar {
  fecha:            Date;
  descripcion:      string;
  debe:             number;
  haber:            number;
  categoria_andrea: string | null;
  referencia:       string | null;
}

// Fila de cierre de bloque semanal — nunca es un movimiento real, en
// ninguna hoja.
function esFilaTotal(concepto: string): boolean {
  return /^TOTAL$|^SUBTOTAL$/i.test(concepto);
}

// "SALDO CAJA GUARDADO..."/"SALDO CAJA SEM....(GUARDADO)"/"SALDO CAJA
// ANTERIOR RENDIR" — carry-forward interno entre los propios bloques de UNA
// hoja (el cierre de un bloque reaparece como "ingreso" del bloque
// siguiente dentro de la misma cuenta; importarlo duplicaría esa plata en
// el libro continuo, que a diferencia del Excel no resetea por bloque).
// Verificado en CAJAS GUARDADAS (bloques semanales) y CAJA DAVID (bloques
// quincenales, fila "SALDO CAJA ANTERIOR RENDIR" con ingreso real). Sólo se
// aplica al formato simple (map.categorias.length === 0): en la hoja JULIO
// el mismo texto ("SALDO CAJA GUARDADA") son transferencias REALES entre
// Caja General y Caja Guardada — dos CuentaBancaria distintas acá — y esas
// sí deben importarse (ver relevamiento de esta corrección).
// \s+ (no un espacio literal) porque el texto real es inconsistente: CAJA
// DAVID trae tanto "SALDO CAJA ANTERIOR RENDIR" (un espacio) como
// "SALDO  CAJA A RENDIR" (doble espacio, mismo archivo).
function esSaldoCajaInterno(concepto: string): boolean {
  return /^SALDO\s+CAJA/i.test(concepto);
}

function parsearHoja(rows: any[][]): FilaImportar[] {
  const filas: FilaImportar[] = [];
  let map: ColumnMap | null = null;
  // Fallback de fecha para tablas sin columna FECHA propia (ADELANTOS-DOS57) —
  // se toma de la fila-etiqueta "N° SEM. DD/MM/YYYY" más reciente y se aplica
  // a todas las filas de datos siguientes hasta la próxima etiqueta.
  let fechaImplicita: Date | null = null;
  // Última fecha real vista — fallback para filas de cierre sin fecha propia
  // que sí representan un movimiento real (ver "descripción desplazada" más
  // abajo: CAJA-MIGUEL "DESCONTADO SUELDO...").
  let ultimaFechaValida: Date | null = null;

  for (const row of rows) {
    if (!row || row.every(c => c === '' || c == null)) continue;

    const posibleHeader = detectarHeader(row);
    if (posibleHeader) { map = posibleHeader; continue; }

    // Sólo se interpreta como fila-etiqueta de período cuando todavía no
    // tenemos una columna FECHA real — si el header actual ya trae FECHA
    // propia, un texto con pinta de fecha en otra columna no debe pisarla.
    if (map === null || map.fecha === null) {
      const fechaDeEtiqueta = extraerFechaDeTexto(row[0]);
      if (fechaDeEtiqueta) { fechaImplicita = fechaDeEtiqueta; continue; }
    }

    if (!map) continue; // filas de título antes del header

    const fecha = map.fecha != null ? excelDateToJs(row[map.fecha]) : fechaImplicita;
    const concepto = map.concepto != null ? String(row[map.concepto] ?? '').trim() : '';

    const tipoFactura = map.tipoFactura != null ? String(row[map.tipoFactura] ?? '').trim() : '';
    const numComp      = map.comprobante != null ? String(row[map.comprobante] ?? '').trim() : '';

    // "Descripción desplazada" — CAJA-MIGUEL tiene filas de cierre de
    // quincena (ej. "DESCONTADO SUELDO( SEM.16 AL 23-07)", "DEVOLUCION CAJA
    // MIGUEL") donde la celda de FECHA quedó vacía y el texto cayó fusionado
    // en la columna N° COMP. (D:E mergeadas) en vez de en CONCEPTO — se
    // pierden por completo si no se rescatan acá. Se detectan por: sin
    // fecha propia, sin CONCEPTO, pero con texto real en la columna de
    // comprobante y un importe cargado. Se importan usando ese texto como
    // descripción y la fecha del último movimiento real de la hoja (estas
    // filas de cierre no traen fecha propia en el Excel).
    if (!fecha && !concepto && numComp.length > 3 && map.categorias.length === 0) {
      const ingresoDesplazado = map.ingreso != null ? toNumber(row[map.ingreso]) : 0;
      const egresoDesplazado  = map.egreso  != null ? toNumber(row[map.egreso])  : 0;
      if ((ingresoDesplazado > 0 || egresoDesplazado > 0) && ultimaFechaValida) {
        filas.push({
          fecha: ultimaFechaValida, descripcion: numComp,
          debe: round2(ingresoDesplazado), haber: round2(egresoDesplazado),
          categoria_andrea: null, referencia: null,
        });
        continue;
      }
    }

    if (!fecha && !concepto) continue;
    if (esFilaTotal(concepto)) continue;
    if (map.categorias.length === 0 && esSaldoCajaInterno(concepto)) continue;
    if (fecha) ultimaFechaValida = fecha;

    const observacion = map.observacion != null ? String(row[map.observacion] ?? '').trim() : '';
    const descripcion = concepto || observacion || '(sin descripción)';

    const referencia = [tipoFactura, numComp].filter(Boolean).join(' ') || null;

    // Libro diario categorizado (hoja "JULIO"/mes): una columna de egreso por
    // fila, según la regla real de Andrea ("cada fila tiene valor en UNA SOLA
    // columna de egreso"). Si por algún motivo hay más de una con valor,
    // se generan varias filas — mejor que perder plata silenciosamente.
    if (map.categorias.length > 0) {
      const ingreso = map.ingreso != null ? toNumber(row[map.ingreso]) : 0;
      if (ingreso > 0 && fecha) {
        filas.push({ fecha, descripcion, debe: round2(ingreso), haber: 0, categoria_andrea: null, referencia });
      }
      for (const { col, categoria } of map.categorias) {
        const monto = toNumber(row[col]);
        if (monto > 0 && fecha) {
          filas.push({ fecha, descripcion, debe: 0, haber: round2(monto), categoria_andrea: categoria, referencia });
        }
      }
      continue;
    }

    // ADELANTOS-DOS57 (NOMBRE/IMPORTE/OBSERVACION, sin columna FECHA propia —
    // ver fechaImplicita) — siempre egreso, cae en Vales.
    if (map.importe != null) {
      const monto = toNumber(row[map.importe]);
      if (monto > 0 && fecha) {
        filas.push({ fecha, descripcion: `Adelanto: ${descripcion}`, debe: 0, haber: round2(monto), categoria_andrea: 'VALES', referencia });
      }
      continue;
    }

    // Formato simple INGRESO/EGRESO (RESERVA, CAJAS GUARDADAS, cajas por persona)
    if (fecha && (map.ingreso != null || map.egreso != null)) {
      const ingreso = map.ingreso != null ? toNumber(row[map.ingreso]) : 0;
      const egreso  = map.egreso  != null ? toNumber(row[map.egreso])  : 0;
      if (ingreso > 0 || egreso > 0) {
        filas.push({ fecha, descripcion, debe: round2(ingreso), haber: round2(egreso), categoria_andrea: null, referencia });
      }
    }
  }

  return filas;
}

// ── Import principal ──────────────────────────────────────────────────────────

export interface ImportAndreaResultado {
  hojas_procesadas: number;
  hojas_omitidas:   string[];
  cuentas_creadas:  string[];
  creados:          number;
  omitidos:         number;
  errores:          string[];
}

export async function importarCajaAndrea(
  workbook: XLSX.WorkBook,
  empresaId: number,
  usuarioId: number,
): Promise<ImportAndreaResultado> {
  const resultado: ImportAndreaResultado = {
    hojas_procesadas: 0, hojas_omitidas: [], cuentas_creadas: [], creados: 0, omitidos: 0, errores: [],
  };

  const cuentaIdPorNombre = new Map<string, number>();
  const cuentasTocadas = new Set<number>();

  for (const sheetName of workbook.SheetNames) {
    const nombreCuenta = resolverNombreCuenta(sheetName);
    if (!nombreCuenta) { resultado.hojas_omitidas.push(sheetName); continue; }

    try {
      let cuentaId = cuentaIdPorNombre.get(nombreCuenta);
      if (cuentaId === undefined) {
        const existente = await prisma.cuentaBancaria.findFirst({
          where: { nombre: nombreCuenta, empresa_id: empresaId },
          select: { id: true },
        });
        if (existente) {
          cuentaId = existente.id;
        } else {
          // CuentaBancaria no tiene columna created_by en el schema (a
          // diferencia de MovimientoCaja) — no incluirla acá.
          const creada = await prisma.cuentaBancaria.create({
            data: {
              empresa_id: empresaId,
              evento_id:  null,
              nombre:     nombreCuenta,
              tipo:       'EFECTIVO',
              moneda:     'ARS',
              saldo_inicial: 0,
              fecha_apertura: new Date(),
            },
            select: { id: true },
          });
          cuentaId = creada.id;
          resultado.cuentas_creadas.push(nombreCuenta);
        }
        cuentaIdPorNombre.set(nombreCuenta, cuentaId);
      }

      resultado.hojas_procesadas += 1;
      const ws = workbook.Sheets[sheetName];
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: false });
      const filas = parsearHoja(rows);

      for (const fila of filas) {
        // Upsert por [cuenta_id, fecha, descripcion, monto] — dedup pedido
        // explícitamente para que reimportar el mismo Excel no duplique.
        // debe/haber exactos (no un OR de cada uno contra 0 por separado):
        // con OR, una fila de egreso (debe=0) "matcheaba" trivialmente
        // cualquier otra fila egreso con la misma fecha+descripción sin
        // importar su monto real — descartaba filas nuevas como si ya
        // existieran. Bug encontrado corriendo el importer contra el Excel
        // real de Andrea (153/210 filas se perdían silenciosamente).
        const yaExiste = await prisma.movimientoCaja.findFirst({
          where: {
            cuenta_id: cuentaId, deleted_at: null,
            fecha: fila.fecha, descripcion: fila.descripcion,
            debe: fila.debe, haber: fila.haber,
          },
          select: { id: true },
        });
        if (yaExiste) { resultado.omitidos += 1; continue; }

        const last = await prisma.movimientoCaja.findFirst({
          where: { cuenta_id: cuentaId, deleted_at: null },
          orderBy: { orden: 'desc' },
          select: { orden: true },
        });
        await prisma.movimientoCaja.create({
          data: {
            cuenta_id:        cuentaId,
            fecha:            fila.fecha,
            descripcion:      fila.descripcion,
            debe:             fila.debe,
            haber:            fila.haber,
            categoria_andrea: fila.categoria_andrea,
            referencia:       fila.referencia,
            orden:            (last?.orden ?? 0) + 1,
            created_by:       usuarioId,
            updated_by:       usuarioId,
          },
        });
        resultado.creados += 1;
        cuentasTocadas.add(cuentaId);
      }
    } catch (err: any) {
      resultado.errores.push(`Hoja "${sheetName}": ${err?.message ?? 'error desconocido'}`);
    }
  }

  for (const cuentaId of cuentasTocadas) {
    await recalcularSaldosCaja(cuentaId, prisma as unknown as Prisma.TransactionClient);
  }

  return resultado;
}
