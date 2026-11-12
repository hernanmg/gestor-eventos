import * as XLSX from 'xlsx';
import { prisma } from './prisma';

// ── Stock de uniformes del depósito (planilla "STOCK Uniformes" de Lorena) ────
// Misma lectura que scripts/importarStockUniformesLorena.ts, ahora desde la
// pantalla de Uniformes para que lo cargue quien lleva el depósito. El Excel
// es un conteo por talle×prenda (no un padrón por empleado) y cada hoja es una
// foto del inventario en una fecha: se toma la ÚLTIMA hoja (la más reciente),
// o la que se pida. Cada celda es un Activo categoria=UNIFORME; un talle en 0
// también se guarda (se acabó ese talle) y dispara el aviso de stock bajo.
//
// Bloques de columnas de cada hoja:
//   Bloque 1 (fila 3, col A-G): TALLE | REMERA | CHOMBA | ... — talles XS..4XL.
//   Bloque 2 (fila 16, col A-C): TALLE | BERMUDAS | PANTALON — talles 40..56.
//   Bloque 3 (fila 16, col E-G): TALLE | <prenda> | <prenda> — depósito secundario.

const CATEGORIA = 'UNIFORME';
// Cualquier talle en <= 5 unidades dispara alerta de quiebre.
const CANTIDAD_MINIMA = 5;

// Fila (0-based) donde está la fecha de revisión de la hoja — ver "REVISION"/C1.
const FILA_FECHA_REVISION = 1;
const COL_FECHA_REVISION  = 2;

function cell(row: any[] | undefined, idx: number): string | null {
  const v = row?.[idx];
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

const ACENTOS: Record<string, string> = { PANTALON: 'Pantalón' };

function tituloPrenda(raw: string): string {
  const limpio = raw.replace(/["]/g, '').trim().replace(/\s+/g, ' ');
  if (ACENTOS[limpio.toUpperCase()]) return ACENTOS[limpio.toUpperCase()];
  return limpio
    .split(' ')
    .map(w => {
      const m = w.match(/^(\()?(.*)$/);
      const prefix = m?.[1] ?? '';
      const resto  = m?.[2] ?? w;
      return prefix + resto.charAt(0).toUpperCase() + resto.slice(1).toLowerCase();
    })
    .join(' ');
}

interface CeldaStock { prenda: string; talle: string; cantidad: number; ubicacion: string }

function leerBloque(rows: any[][], filaHeader: number, colTalle: number, colsPrenda: number[], ubicacion: string): CeldaStock[] {
  const header = rows[filaHeader];
  const prendas = colsPrenda.map(c => cell(header, c));
  const salida: CeldaStock[] = [];

  for (let i = filaHeader + 1; i < rows.length; i++) {
    const talle = cell(rows[i], colTalle);
    if (!talle || talle.toLowerCase() === 'total') break;

    colsPrenda.forEach((col, idx) => {
      if (!prendas[idx]) return; // columna sin prenda en el encabezado
      const raw = cell(rows[i], col);
      const cantidad = raw !== null ? parseInt(raw, 10) : 0;
      salida.push({ prenda: tituloPrenda(prendas[idx]!), talle, cantidad: Number.isFinite(cantidad) ? cantidad : 0, ubicacion });
    });
  }
  return salida;
}

export interface FilaStockUniforme {
  nombre:     string;
  ubicacion:  string;
  cantidad:   number;
  anterior:   number | null; // null = no existía
}

export interface ImportarStockUniformesResultado {
  hoja:            string;
  hojas:           string[];
  fecha_revision:  string | null;
  creados:         number;
  actualizados:    number;
  sin_cambios:     number;
  con_stock_bajo:  number;
  filas:           FilaStockUniforme[];
}

export async function importarStockUniformes(
  buffer: Buffer, empresaId: number, hojaPedida: string | null, dryRun: boolean,
): Promise<ImportarStockUniformesResultado> {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  if (wb.SheetNames.length === 0) throw new Error('El archivo no tiene hojas');
  const hoja = hojaPedida ?? wb.SheetNames[wb.SheetNames.length - 1];
  const sheet = wb.Sheets[hoja];
  if (!sheet) throw new Error(`No se encontró la hoja "${hoja}" (hojas: ${wb.SheetNames.join(', ')})`);

  const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: null, raw: false });
  const encabezado = cell(rows[2], 0);
  if (!encabezado || !/talle/i.test(encabezado)) {
    throw new Error(`La hoja "${hoja}" no tiene el formato de la planilla de stock de uniformes (se espera "TALLE" en la celda A3)`);
  }

  const empresa = await prisma.empresa.findUnique({ where: { id: empresaId }, select: { nombre_corto: true, nombre: true } });
  const prefijo = empresa?.nombre_corto ?? empresa?.nombre ?? 'Empresa';
  const UBICACION_PRINCIPAL  = `${prefijo} — Depósito Principal`;
  const UBICACION_SECUNDARIA = `${prefijo} — Depósito Secundario`;

  const fechaRevision = cell(rows[FILA_FECHA_REVISION], COL_FECHA_REVISION);
  const celdas = [
    ...leerBloque(rows, 2,  0, [1, 2, 3, 4, 5, 6], UBICACION_PRINCIPAL),
    ...leerBloque(rows, 15, 0, [1, 2],             UBICACION_PRINCIPAL),
    ...leerBloque(rows, 15, 4, [5, 6],             UBICACION_SECUNDARIA),
  ];
  if (celdas.length === 0) throw new Error(`No se encontraron talles en la hoja "${hoja}"`);

  const existentes = await prisma.activo.findMany({
    where:  { empresa_id: empresaId, categoria: CATEGORIA, deleted_at: null },
    select: { id: true, nombre: true, ubicacion: true, cantidad: true },
  });
  const porClave = new Map(existentes.map(a => [`${a.nombre}|${a.ubicacion}`, a]));

  const resultado: ImportarStockUniformesResultado = {
    hoja, hojas: wb.SheetNames, fecha_revision: fechaRevision,
    creados: 0, actualizados: 0, sin_cambios: 0, con_stock_bajo: 0, filas: [],
  };

  await prisma.$transaction(async tx => {
    for (const c of celdas) {
      const nombre = `${c.prenda} Talle ${c.talle}`;
      const existente = porClave.get(`${nombre}|${c.ubicacion}`);
      const data = {
        nombre, categoria: CATEGORIA, cantidad: c.cantidad, cantidad_minima: CANTIDAD_MINIMA,
        ubicacion: c.ubicacion, observaciones: `Stock al ${fechaRevision ?? hoja}`,
      };

      if (existente) {
        if (existente.cantidad === c.cantidad) resultado.sin_cambios++;
        else resultado.actualizados++;
        if (!dryRun) await tx.activo.update({ where: { id: existente.id }, data });
      } else {
        resultado.creados++;
        if (!dryRun) await tx.activo.create({ data: { ...data, empresa_id: empresaId } });
      }
      if (c.cantidad <= CANTIDAD_MINIMA) resultado.con_stock_bajo++;
      resultado.filas.push({ nombre, ubicacion: c.ubicacion, cantidad: c.cantidad, anterior: existente ? (existente.cantidad ?? 0) : null });
    }
  }, { timeout: 60_000 });

  return resultado;
}
