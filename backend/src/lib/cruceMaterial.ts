import * as XLSX from 'xlsx';
import type { Prisma, TipoCruceMaterial } from '@prisma/client';
import { prisma } from './prisma';

// ── Cruce de material con terceros (Depósito 5) ──────────────────────────────
// Alquileres y préstamos de material Layher con otras empresas (Zamora, Agesta,
// Airasca, Jofre…), y lo que se compra o vende entre ellas. Ver el modelo
// CruceMaterial en el schema.

export const TIPOS_DADOS:   TipoCruceMaterial[] = ['ALQUILER_DADO', 'PRESTAMO_DADO'];
export const TIPOS_TOMADOS: TipoCruceMaterial[] = ['ALQUILER_TOMADO', 'PRESTAMO_TOMADO'];
export const TIPOS_TEMPORALES: TipoCruceMaterial[] = [...TIPOS_DADOS, ...TIPOS_TOMADOS];
export const esTemporal = (t: TipoCruceMaterial) => TIPOS_TEMPORALES.includes(t);

export const TIPO_CRUCE_LABEL: Record<TipoCruceMaterial, string> = {
  ALQUILER_DADO:   'Alquiler a un tercero',
  PRESTAMO_DADO:   'Préstamo a un tercero',
  ALQUILER_TOMADO: 'Alquiler de un tercero',
  PRESTAMO_TOMADO: 'Préstamo de un tercero',
  VENTA:           'Venta',
  COMPRA:          'Compra',
};

// ── Efecto en la disponibilidad ──────────────────────────────────────────────
// Un alquiler o préstamo abierto cuenta en el rango consultado si empezó antes
// del fin del rango y (no tiene fecha de vuelta, vuelve dentro o después del
// rango, o ya tendría que haber vuelto y sigue afuera). Cuenta lo que falta
// devolver.
export async function efectoCruces(productoId: number, desde: Date, hasta: Date, hoy: Date = new Date()) {
  const items = await prisma.cruceMaterialItem.findMany({
    where: {
      producto_id: productoId,
      cruce: {
        deleted_at: null, estado: 'ABIERTO', tipo: { in: TIPOS_TEMPORALES },
        fecha_desde: { lte: hasta },
        OR: [{ fecha_hasta: null }, { fecha_hasta: { gte: desde } }, { fecha_hasta: { lt: hoy } }],
      },
    },
    include: { cruce: { select: { id: true, tercero: true, tipo: true, fecha_desde: true, fecha_hasta: true } } },
  });
  let dado = 0, tomado = 0;
  const cruces: { cruce_id: number; tercero: string; tipo: TipoCruceMaterial; cantidad: number; fecha_desde: Date; fecha_hasta: Date | null }[] = [];
  for (const it of items) {
    const pendiente = it.cantidad - it.cantidad_devuelta;
    if (pendiente <= 0) continue;
    if (TIPOS_DADOS.includes(it.cruce.tipo)) dado += pendiente; else tomado += pendiente;
    cruces.push({ cruce_id: it.cruce.id, tercero: it.cruce.tercero, tipo: it.cruce.tipo, cantidad: pendiente, fecha_desde: it.cruce.fecha_desde, fecha_hasta: it.cruce.fecha_hasta });
  }
  return { dado, tomado, cruces };
}

// Compra y venta: se aplican al stock del producto una vez (signo +1) y se
// revierten al anular (signo -1).
export class StockCruceNegativo extends Error {}
export async function aplicarStockCompraVenta(tx: Prisma.TransactionClient, cruceId: number, signo: 1 | -1) {
  const c = await tx.cruceMaterial.findUniqueOrThrow({ where: { id: cruceId }, include: { items: true } });
  if (esTemporal(c.tipo)) return;
  const base = c.tipo === 'COMPRA' ? 1 : -1;
  for (const it of c.items) {
    if (!it.producto_id) continue;
    const p = await tx.producto.update({ where: { id: it.producto_id }, data: { stock_total: { increment: base * signo * it.cantidad } }, select: { nombre: true, stock_total: true } });
    if (p.stock_total < 0) throw new StockCruceNegativo(`El stock de "${p.nombre}" quedaría en ${p.stock_total}`);
  }
}

// ── Valores ──────────────────────────────────────────────────────────────────
export function valoresCruce(c: { tasa_euro: Prisma.Decimal | number | null; porcentaje_alquiler: Prisma.Decimal | number | null; items: { cantidad: number; valor_unitario_eur: Prisma.Decimal | number | null }[] }) {
  const totalEur = c.items.reduce((a, i) => a + i.cantidad * Number(i.valor_unitario_eur ?? 0), 0);
  const tasa = c.tasa_euro != null ? Number(c.tasa_euro) : null;
  const pct = c.porcentaje_alquiler != null ? Number(c.porcentaje_alquiler) : null;
  const totalPesos = tasa ? totalEur * tasa : null;
  const alquilerMensual = totalPesos != null && pct != null ? totalPesos * pct / 100 : null;
  const r2 = (n: number | null) => n == null ? null : Math.round(n * 100) / 100;
  return { total_eur: r2(totalEur), total_pesos: r2(totalPesos), alquiler_mensual: r2(alquilerMensual) };
}

// ── Lectura de planillas (cuadros de cruce de Mayra) ─────────────────────────
// Cada hoja es una operación: "ALQ ENERO 2026 - ZAMORA", "REMITO MARZO 2024
// IACC", "COMPRA MATERIAL BB"… El encabezado tiene "Descripcion" y una columna
// de cantidad que cambia de nombre según la hoja; el valor en euros sale de
// "Valor Total en €" ÷ cantidad cuando existe (en las de Zamora la primera
// columna de valor unitario quedó con valores viejos de otra fila).

const norm = (s: unknown) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

const COLS_CANTIDAD: RegExp[] = [
  /total material en cami/, /material que debe/, /mar?terial final/, /material solicitado/, /^cantidad$/, /material contabilizado/, /material requerido/,
];

function numero(v: unknown): number | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return isFinite(v) ? v : null;
  const t = String(v).replace(/[€$\s]/g, '');
  if (!t || t === '-') return null;
  // "1.234,56" o "1,234.56" o "75.01"
  const limpio = /,\d{1,2}$/.test(t) ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '');
  const n = Number(limpio);
  return isFinite(n) ? n : null;
}

function fechaDeTexto(t: string): string | null {
  const m = t.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  if (!m || !m[3]) return null;
  const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  const d = new Date(Date.UTC(y, Number(m[2]) - 1, Number(m[1])));
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

export interface ItemPlanillaCruce {
  descripcion: string;
  cantidad: number;
  valor_unitario_eur: number | null;
  referencia: string | null;
  producto_id: number | null;
  producto_nombre: string | null;
  como: 'codigo' | 'nombre' | 'precio' | null;
}
export interface HojaPlanillaCruce {
  hoja: string;
  titulo: string | null;
  columna_cantidad: string;
  tasa_euro: number | null;
  fecha: string | null;
  porcentaje_alquiler: number | null;
  items: ItemPlanillaCruce[];
  sin_producto: number;
}

type ProdCatalogo = { id: number; nombre: string; nombre_interno: string | null; nombre_tecnico: string | null; codigo_externo: string | null; valor_unitario: Prisma.Decimal | null };

// medidas de la descripción: "2,57 x 2,00" → ["2.57", "2.00"]; "0,5" → "0.50"
function medidas(s: string): string[] {
  return (s.match(/\d+[.,]\d+/g) ?? []).map(x => Number(x.replace(',', '.')).toFixed(2));
}

export function buscarProducto(desc: string, ref: string | null, valorEur: number | null, productos: ProdCatalogo[]): { p: ProdCatalogo; como: 'codigo' | 'nombre' | 'precio' } | null {
  if (ref) {
    const p = productos.find(x => x.codigo_externo && x.codigo_externo.trim() === ref.trim());
    if (p) return { p, como: 'codigo' };
  }
  const n = norm(desc);
  const porNombre = productos.filter(x => [x.nombre, x.nombre_interno, x.nombre_tecnico].some(v => v && norm(v) === n));
  if (porNombre.length === 1) return { p: porNombre[0], como: 'nombre' };
  if (valorEur != null && valorEur > 0) {
    let cands = productos.filter(x => x.valor_unitario != null && Math.abs(Number(x.valor_unitario) - valorEur) < 0.006);
    if (cands.length > 1) {
      const ms = medidas(desc);
      if (ms.length) cands = cands.filter(x => ms.every(m => medidas(x.nombre).includes(m)));
    }
    if (cands.length === 1) return { p: cands[0], como: 'precio' };
  }
  // Por cómo se llama en el depósito + las medidas: "Verticales 2,00 c/e" es la
  // AR Vertical LW 2.00m, "Viga Puente 2,57" la U-Horizontal LW 2.57m, etc.
  const regla = REGLAS_NOMBRE.find(r => r.desc.test(desc.trim()));
  if (regla) {
    const ms = medidas(desc);
    const cands = productos.filter(x => regla.catalogo.test(x.nombre) && ms.every(m => medidas(x.nombre).includes(m)));
    if (cands.length === 1) return { p: cands[0], como: 'nombre' };
  }
  return null;
}

const REGLAS_NOMBRE: { desc: RegExp; catalogo: RegExp }[] = [
  { desc: /^verticales?\b.*s\/e/i,             catalogo: /^AR Vertical [\d.]+m s\/e/ },
  { desc: /^verticales?\b/i,                    catalogo: /^AR Vertical LW/ },
  { desc: /^horizontal(es)? (en |de )?planta/i,  catalogo: /Horizontal Diagonal Planta/ },
  { desc: /^horizont/i,                          catalogo: /^AR O-Horizontal LW/ },
  { desc: /^diagonal/i,                          catalogo: /^AR Diagonal LW/ },
  { desc: /^viga puente/i,                       catalogo: /^AR U-Horizontal LW/ },
  { desc: /^bases? regulables?/i,                catalogo: /^ZB Base Regulable/ },
  { desc: /^collar/i,                            catalogo: /^AR Base Collar/ },
  { desc: /^celos/i,                             catalogo: /^AR O-Viga Celos/ },
];

export async function leerPlanillaCruce(buffer: Buffer, empresaId: number): Promise<HojaPlanillaCruce[]> {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const productos = await prisma.producto.findMany({
    where: { empresa_id: empresaId, deleted_at: null },
    select: { id: true, nombre: true, nombre_interno: true, nombre_tecnico: true, codigo_externo: true, valor_unitario: true },
  });
  const out: HojaPlanillaCruce[] = [];
  for (const hoja of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[hoja], { header: 1, defval: null, raw: true });
    const iHead = rows.findIndex(r => (r ?? []).some(c => /^descripci[oó]n$/i.test(String(c ?? '').trim())));
    if (iHead < 0) continue;
    const head = (rows[iHead] ?? []).map(norm);
    const cDesc = head.findIndex(h => /^descripcion$/.test(h));
    let cCant = -1; let nombreCant = '';
    for (const re of COLS_CANTIDAD) {
      const i = head.findIndex((h, k) => k > cDesc && re.test(h));
      if (i >= 0) { cCant = i; nombreCant = String(rows[iHead]![i] ?? '').trim(); break; }
    }
    if (cCant < 0) continue;
    const cTotalEur = head.findIndex(h => /valor total en €|precio total en €|monto total en €/.test(h));
    const cUnit = head.findIndex(h => /(valor|precio) unitario en €|^precio en €|valor alq de referencia/.test(h));
    const cRef = head.findIndex(h => /^referencia$|^codigo/.test(h));
    const pctHead = head.map((h, i) => ({ h, i })).find(x => /valor alquiler [\d,.]+ ?%/.test(x.h));
    const porcentaje = pctHead ? numero(pctHead.h.match(/([\d,.]+) ?%/)![1]) : null;

    // "Tasa al 15/2/2025:  $ 1,125.00" en las filas de arriba
    let tasa: number | null = null; let fecha: string | null = null;
    for (const r of rows.slice(0, iHead)) {
      const cells = r ?? [];
      const k = cells.findIndex(c => /tasa al/i.test(String(c ?? '')));
      if (k < 0) continue;
      fecha = fechaDeTexto(String(cells[k]));
      for (const c of cells.slice(k + 1)) { const n = numero(c); if (n != null && n > 0) { tasa = n; break; } }
    }
    const titulo = rows.slice(0, iHead).map(r => (r ?? []).find(c => c != null && String(c).trim()) ?? null).filter(Boolean).map(String).join(' · ') || null;

    const items: ItemPlanillaCruce[] = [];
    for (const r of rows.slice(iHead + 1)) {
      const desc = String((r ?? [])[cDesc] ?? '').trim();
      if (!desc || /^(totales?|nota:?|falta agregar)/i.test(desc)) continue;
      const cant = numero((r ?? [])[cCant]);
      if (cant == null || cant <= 0) continue;
      let valor: number | null = null;
      const tot = cTotalEur >= 0 ? numero((r ?? [])[cTotalEur]) : null;
      if (tot != null && tot > 0) valor = Math.round(tot / cant * 100) / 100;
      else if (cUnit >= 0) valor = numero((r ?? [])[cUnit]);
      const ref = cRef >= 0 && (r ?? [])[cRef] != null ? String((r ?? [])[cRef]).trim() : null;
      const m = buscarProducto(desc, ref, valor, productos);
      items.push({ descripcion: desc, cantidad: Math.round(cant), valor_unitario_eur: valor, referencia: ref, producto_id: m?.p.id ?? null, producto_nombre: m?.p.nombre ?? null, como: m?.como ?? null });
    }
    if (!items.length) continue;
    out.push({ hoja, titulo, columna_cantidad: nombreCant, tasa_euro: tasa, fecha, porcentaje_alquiler: porcentaje, items, sin_producto: items.filter(i => !i.producto_id).length });
  }
  return out;
}
