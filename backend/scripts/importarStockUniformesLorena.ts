// ═══════════════════════════════════════════════════════════════════════════
// Importa el stock de depósito de uniformes de Lorena desde
// docs/dos57/lorena/2026_STOCK Uniformes.xlsx como registros de Activo
// (categoria="UNIFORME", cantidad = stock disponible por talle).
//
// El Excel NO es un padrón por empleado — es un conteo de depósito por talle
// y tipo de prenda, con dos hojas (ABRIL, JULIO) que son dos fotos del mismo
// inventario en fechas distintas. JULIO es la más reciente: como el upsert es
// por [empresa_id, nombre, categoria, ubicacion], reprocesar JULIO después de
// ABRIL pisa el mismo registro (mismo nombre) con el valor más nuevo.
//
// Se procesa CADA celda de talle×prenda, incluida cantidad=0 — no se omite
// ninguna: un talle en 0 es información real (se acabó ese talle), y dispara
// la alerta de quiebre (cantidad_minima=1 para todo lo importado acá, ver
// notificaciones/calendario STOCK_UNIFORME_BAJO / ACTIVO_STOCK_BAJO).
//
// Cada hoja tiene 3 bloques de columnas:
//   Bloque 1 (fila 3, col A-G): TALLE | REMERA | CHOMBA | CAMPERA | CAMPERONES
//     | REMERA (CALIDAD 3) | REMERA ESTRUCTURAS — talles XS..4XL.
//   Bloque 2 (fila 16, col A-C): TALLE | BERMUDAS | PANTALON — talles 40..56.
//   Bloque 3 (fila 16, col E-G): TALLE | <prenda> | <prenda> — talles 38..45.
//     Los nombres de columna cambian entre hojas (OMBU/ATT en Abril,
//     DPS/OMBU en Julio) y la celda I16 dice "DEPOSITO POLLO" — por eso este
//     bloque va a ubicacion="DOS57 — Depósito Secundario", el resto a
//     "DOS57 — Depósito Principal" (confirmado con el usuario).
//
// Run: npx ts-node --files scripts/importarStockUniformesLorena.ts
// ═══════════════════════════════════════════════════════════════════════════

import 'dotenv/config';
import path from 'path';
import * as XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ARCHIVO   = path.join(__dirname, '..', '..', 'docs', 'dos57', 'lorena', '2026_STOCK Uniformes.xlsx');
const EMPRESA_ID = 2; // DOS57

const UBICACION_PRINCIPAL   = 'DOS57 — Depósito Principal';
const UBICACION_SECUNDARIA  = 'DOS57 — Depósito Secundario'; // ex "DEPOSITO POLLO"
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

// Normaliza headers de prenda: colapsa espacios raros, quita comillas, y
// corrige acentos conocidos que el Excel no tiene (ej. "PANTALON" -> "Pantalón").
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

interface FilaStock {
  prenda:    string;
  talle:     string;
  cantidad:  number;
  ubicacion: string;
}

// Lee un bloque TALLE|prenda1|prenda2|... a partir de filaHeader, parando en
// la primera fila cuyo talle sea "Total" (o esté vacío) — los 3 bloques de
// esta planilla no tienen la misma cantidad de filas de talle. Incluye las
// celdas en 0 — el 0 del Excel es información real (se acabó ese talle), no
// se omite (ver FIX 6 del pedido).
function leerBloque(rows: any[][], filaHeader: number, colTalle: number, colsPrenda: number[], ubicacion: string): FilaStock[] {
  const header = rows[filaHeader];
  const prendas = colsPrenda.map(c => tituloPrenda(cell(header, c) ?? ''));
  const salida: FilaStock[] = [];

  for (let i = filaHeader + 1; i < rows.length; i++) {
    const talle = cell(rows[i], colTalle);
    if (!talle || talle.toLowerCase() === 'total') break;

    colsPrenda.forEach((col, idx) => {
      const raw = cell(rows[i], col);
      const cantidad = raw !== null ? parseInt(raw, 10) : 0;
      salida.push({ prenda: prendas[idx], talle, cantidad: Number.isFinite(cantidad) ? cantidad : 0, ubicacion });
    });
  }
  return salida;
}

function leerHoja(rows: any[][]): { fechaRevision: string | null; filas: FilaStock[] } {
  const fechaRevision = cell(rows[FILA_FECHA_REVISION], COL_FECHA_REVISION);

  const bloque1 = leerBloque(rows, 2,  0, [1, 2, 3, 4, 5, 6], UBICACION_PRINCIPAL);
  const bloque2 = leerBloque(rows, 15, 0, [1, 2],             UBICACION_PRINCIPAL);
  const bloque3 = leerBloque(rows, 15, 4, [5, 6],             UBICACION_SECUNDARIA);

  return { fechaRevision, filas: [...bloque1, ...bloque2, ...bloque3] };
}

async function main() {
  const wb = XLSX.readFile(ARCHIVO);

  // ABRIL antes que JULIO — el upsert por [empresa_id, nombre, categoria,
  // ubicacion] hace que JULIO pise el mismo registro con el valor más nuevo.
  const HOJAS = ['ABRIL', 'JULIO'].filter(h => wb.SheetNames.includes(h));
  if (HOJAS.length === 0) throw new Error(`Ninguna de las hojas ABRIL/JULIO existe en ${ARCHIVO} (hojas: ${wb.SheetNames.join(', ')})`);

  let creados      = 0;
  let actualizados = 0;
  // Estado final por activo (después de procesar todas las hojas) — para
  // contar con_stock_cero/alertas_generadas sobre el resultado final, no
  // sobre cada fila de cada hoja (JULIO pisa a ABRIL, no se suman ambas).
  const estadoFinal = new Map<string, number>();

  for (const hoja of HOJAS) {
    const sheet = wb.Sheets[hoja];
    const rows  = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: null, raw: false });
    const { fechaRevision, filas } = leerHoja(rows);
    console.log(`\n── Hoja "${hoja}" (revisión ${fechaRevision ?? '?'}) — ${filas.length} celdas talle×prenda ──`);

    for (const f of filas) {
      const nombre = `${f.prenda} Talle ${f.talle}`;
      const data = {
        nombre,
        categoria:       CATEGORIA,
        cantidad:        f.cantidad,
        cantidad_minima: CANTIDAD_MINIMA,
        ubicacion:       f.ubicacion,
        observaciones:   `Stock al ${fechaRevision ?? hoja}`,
      };

      const existente = await prisma.activo.findFirst({
        where: { empresa_id: EMPRESA_ID, nombre, categoria: CATEGORIA, ubicacion: f.ubicacion, deleted_at: null },
      });

      if (existente) {
        await prisma.activo.update({ where: { id: existente.id }, data });
        actualizados++;
        console.log(`  actualizado: ${nombre} (${f.ubicacion}) -> ${f.cantidad}`);
      } else {
        await prisma.activo.create({ data: { ...data, empresa_id: EMPRESA_ID } });
        creados++;
        console.log(`  creado: ${nombre} (${f.ubicacion}) -> ${f.cantidad}`);
      }

      estadoFinal.set(`${nombre}|${f.ubicacion}`, f.cantidad);
    }
  }

  const con_stock_cero    = [...estadoFinal.values()].filter(c => c === 0).length;
  const alertas_generadas = [...estadoFinal.values()].filter(c => c <= CANTIDAD_MINIMA).length;

  console.log('\nResumen:', { creados, actualizados, con_stock_cero, alertas_generadas });
}

main()
  .catch((e) => {
    console.error('Error en importación:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
