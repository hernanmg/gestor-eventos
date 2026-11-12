import * as XLSX from 'xlsx';
import type { TipoComprobanteEmitido } from '@prisma/client';

// ── Parseo de "Mis Comprobantes Recibidos" de AFIP (libro de compras) ─────────
// Sheet1: encabezados en la fila 2 (la 1 es un título suelto):
//   Fecha | Tipo | Punto de Venta | Número Desde | Número Hasta | Tipo Doc. Vendedor |
//   Nro. Doc. Vendedor | Denominación Vendedor | Tipo Cambio | Moneda | Neto Gravado |
//   No Gravado | Exento | IVA | Total | FACTURA | EVENTO | FISICA | COMPROBANTES DE PAGO
// Hoja "Faltantes mas de $500-000": SIN encabezados, sólo 9 columnas:
//   Fecha | Tipo | Punto de Venta | Número Desde | Número Hasta | Tipo Doc. | CUIT | Denominación | Total

export type HojaLibro = 'PRINCIPAL' | 'FALTANTES';

export interface FilaLibroCompras {
  hoja:             HojaLibro;
  fila_excel:       number;
  fecha:            Date;
  tipo_texto:       string;
  tipo_comprobante: TipoComprobanteEmitido | null;
  tipo_factura:     'A' | 'B' | 'C' | 'X';
  numero_factura:   string;
  proveedor_cuit:   string | null; // sólo dígitos
  proveedor_nombre: string;
  moneda:           'ARS' | 'USD' | 'EUR';
  tipo_cambio:      number | null;
  neto_gravado:     number | null;
  no_gravado:       number | null;
  exento:           number | null;
  iva:              number | null;
  total:            number;
  pdf_texto:        string | null;
  evento_texto:     string | null;
  fisica:           string | null;
  comprobantes_pago: string | null;
}

export interface ErrorFilaLibro {
  hoja:       HojaLibro;
  fila_excel: number;
  motivo:     string;
}

// Código AFIP (el número antes del guion en "1 - Factura A") → enum.
const TIPO_POR_CODIGO: Record<number, TipoComprobanteEmitido> = {
  1: 'FACTURA_A', 2: 'NOTA_DEBITO_A', 3: 'NOTA_CREDITO_A', 4: 'RECIBO',
  6: 'FACTURA_B', 7: 'NOTA_DEBITO_B', 8: 'NOTA_CREDITO_B', 9: 'RECIBO_B',
  11: 'FACTURA_C', 12: 'NOTA_DEBITO_C', 13: 'NOTA_CREDITO_C',
  63: 'LIQUIDACION_A', 81: 'TIQUE_FACTURA_A',
  201: 'FACTURA_MIPYMES_FCE_A', 206: 'FACTURA_MIPYMES_FCE_B',
};

export function esNotaCredito(t: TipoComprobanteEmitido | null): boolean {
  return t === 'NOTA_CREDITO_A' || t === 'NOTA_CREDITO_B' || t === 'NOTA_CREDITO_C';
}

export function parseTipoComprobante(texto: string): { tipo: TipoComprobanteEmitido | null; letra: 'A' | 'B' | 'C' | 'X' } {
  const codigo = Number(texto.match(/^\s*(\d+)\s*-/)?.[1]);
  const tipo = Number.isFinite(codigo) ? (TIPO_POR_CODIGO[codigo] ?? null) : null;
  const letra = texto.split('-').slice(1).join('-').match(/\b([ABC])\b/)?.[1] as 'A' | 'B' | 'C' | undefined;
  return { tipo, letra: letra ?? 'X' };
}

// Fechas del Excel: texto "dd/mm/yyyy" o número de serie. Se guardan como día
// calendario a medianoche UTC (ver fecha_offset_utc_fix en memoria del proyecto).
export function parseFechaLibro(v: unknown): Date | null {
  if (v instanceof Date && !isNaN(v.getTime())) {
    return new Date(Date.UTC(v.getFullYear(), v.getMonth(), v.getDate()));
  }
  if (typeof v === 'number' && v > 0) {
    return new Date(Math.round((v - 25569) * 86400000));
  }
  const m = String(v ?? '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])));
  return isNaN(d.getTime()) || d.getUTCDate() !== Number(m[1]) ? null : d;
}

// Importes: número, o texto con coma decimal ("1500,00" / "1.500,00").
export function parseImporte(v: unknown): number | null {
  if (typeof v === 'number') return isFinite(v) ? v : null;
  const s = String(v ?? '').trim();
  if (!s) return null;
  const n = Number(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s);
  return isFinite(n) ? n : null;
}

function parseMoneda(v: unknown): 'ARS' | 'USD' | 'EUR' | null {
  const s = String(v ?? '').trim().toUpperCase();
  if (s === '$' || s === 'ARS' || s === 'PES') return 'ARS';
  if (s === 'USD' || s === 'DOL') return 'USD';
  if (s === 'EUR') return 'EUR';
  return null;
}

const txt = (v: unknown): string | null => String(v ?? '').trim() || null;
const digitos = (v: unknown): string | null => String(v ?? '').replace(/\D/g, '') || null;
// Un CUIT/CUIL válido tiene 11 dígitos; un DNI o un 0 (vendedor sin documento) no sirve para identificar un proveedor.
const cuitValido = (v: unknown): string | null => { const d = digitos(v); return d && d.length === 11 ? d : null; };

function normHeader(s: unknown): string {
  return String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
}

function armarNumero(pv: unknown, nro: unknown): string | null {
  const p = digitos(pv), n = digitos(nro);
  if (!p || !n) return null;
  return `${p.padStart(4, '0')}-${n.padStart(8, '0')}`;
}

// Índices por posición (letras A..S del Excel real) — la fila de encabezados se
// valida por nombre, pero las columnas se toman por posición.
const COL = {
  fecha: 0, tipo: 1, pv: 2, nroDesde: 3, tipoDoc: 5, cuit: 6, nombre: 7,
  tipoCambio: 8, moneda: 9, neto: 10, noGravado: 11, exento: 12, iva: 13, total: 14,
  pdf: 15, evento: 16, fisica: 17, comprobantesPago: 18,
} as const;

function buscarHoja(wb: XLSX.WorkBook, predicado: (nombreNorm: string) => boolean): string | undefined {
  return wb.SheetNames.find(n => predicado(normHeader(n)));
}

function filasDeHoja(wb: XLSX.WorkBook, nombre: string): unknown[][] {
  return XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[nombre], { header: 1, defval: '', raw: true });
}

export interface ResultadoParseoLibro {
  filas:   FilaLibroCompras[];
  errores: ErrorFilaLibro[];
}

export function parseLibroCompras(buffer: Buffer): ResultadoParseoLibro {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const filas: FilaLibroCompras[] = [];
  const errores: ErrorFilaLibro[] = [];

  const nombrePrincipal = buscarHoja(wb, n => n === 'sheet1') ?? wb.SheetNames[0];
  if (!nombrePrincipal) throw new Error('El archivo no tiene hojas');
  const nombreFaltantes = buscarHoja(wb, n => n.startsWith('faltantes') && n !== normHeader(nombrePrincipal));

  // ── Hoja principal ──────────────────────────────────────────────────────────
  const rows = filasDeHoja(wb, nombrePrincipal);
  const headerIdx = rows.findIndex(r => normHeader(r[COL.fecha]) === 'fecha' && normHeader(r[COL.nombre]).startsWith('denominacion'));
  if (headerIdx < 0) throw new Error('No se encontró la fila de encabezados (Fecha / Denominación Vendedor) en la hoja "' + nombrePrincipal + '"');

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i] ?? [];
    if (r[COL.fecha] === '' || r[COL.fecha] == null) continue; // fila vacía o con basura suelta
    const fila_excel = i + 1;
    const err = (motivo: string) => errores.push({ hoja: 'PRINCIPAL', fila_excel, motivo });

    const fecha = parseFechaLibro(r[COL.fecha]);
    if (!fecha) { err(`Fecha inválida: "${r[COL.fecha]}"`); continue; }
    const tipo_texto = String(r[COL.tipo] ?? '').trim();
    const numero = armarNumero(r[COL.pv], r[COL.nroDesde]);
    if (!numero) { err('Falta punto de venta o número de comprobante'); continue; }
    const total = parseImporte(r[COL.total]);
    if (total === null) { err(`Total inválido: "${r[COL.total]}"`); continue; }
    const moneda = parseMoneda(r[COL.moneda]);
    if (!moneda) { err(`Moneda no reconocida: "${r[COL.moneda]}"`); continue; }

    const { tipo, letra } = parseTipoComprobante(tipo_texto);
    filas.push({
      hoja: 'PRINCIPAL', fila_excel, fecha,
      tipo_texto, tipo_comprobante: tipo, tipo_factura: letra,
      numero_factura:   numero,
      proveedor_cuit:   cuitValido(r[COL.cuit]),
      proveedor_nombre: String(r[COL.nombre] ?? '').trim(),
      moneda,
      tipo_cambio:      moneda === 'ARS' ? null : parseImporte(r[COL.tipoCambio]),
      neto_gravado:     parseImporte(r[COL.neto]),
      no_gravado:       parseImporte(r[COL.noGravado]),
      exento:           parseImporte(r[COL.exento]),
      iva:              parseImporte(r[COL.iva]),
      total,
      pdf_texto:        txt(r[COL.pdf]),
      evento_texto:     txt(r[COL.evento]),
      fisica:           txt(r[COL.fisica]),
      comprobantes_pago: txt(r[COL.comprobantesPago]),
    });
  }

  // ── Faltantes (sin encabezados, 9 columnas; Total en la novena) ─────────────
  if (nombreFaltantes) {
    const rowsF = filasDeHoja(wb, nombreFaltantes);
    for (let i = 0; i < rowsF.length; i++) {
      const r = rowsF[i] ?? [];
      if (r[0] === '' || r[0] == null) continue;
      const fila_excel = i + 1;
      const err = (motivo: string) => errores.push({ hoja: 'FALTANTES', fila_excel, motivo });

      const fecha = parseFechaLibro(r[0]);
      if (!fecha) { err(`Fecha inválida: "${r[0]}"`); continue; }
      const tipo_texto = String(r[1] ?? '').trim();
      const numero = armarNumero(r[2], r[3]);
      if (!numero) { err('Falta punto de venta o número de comprobante'); continue; }
      const total = parseImporte(r[8]);
      if (total === null) { err(`Total inválido: "${r[8]}"`); continue; }

      const { tipo, letra } = parseTipoComprobante(tipo_texto);
      filas.push({
        hoja: 'FALTANTES', fila_excel, fecha,
        tipo_texto, tipo_comprobante: tipo, tipo_factura: letra,
        numero_factura:   numero,
        proveedor_cuit:   cuitValido(r[6]),
        proveedor_nombre: String(r[7] ?? '').trim(),
        moneda: 'ARS', tipo_cambio: null,
        neto_gravado: null, no_gravado: null, exento: null, iva: null,
        total,
        pdf_texto: null, evento_texto: null, fisica: null, comprobantes_pago: null,
      });
    }
  }

  return { filas, errores };
}

export function formatCuit(digits: string): string {
  return digits.length === 11 ? `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}` : digits;
}
