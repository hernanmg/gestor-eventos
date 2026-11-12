import * as XLSX from 'xlsx';

// ── Parseo de docs/enjoy/rubro por evento.xlsx ────────────────────────────────
// Cada hoja de evento tiene: A3="EVENTO", B3=<nombre>, y una tabla desde la
// fila con encabezados ITEM | RUBRO | SERVICIO | CORRESPONDE EN ESTE EVENTO |
// PROVEEDOR ASIGNADO | RESPONSABLE | COMENTARIO. La columna RUBRO sólo trae
// valor en la primera fila de cada grupo (hay que arrastrarlo hacia abajo).
// El grupo "RECURSOS HUMANOS - ENJOY" son nombres de personas del staff, no
// categorías de gasto — se excluyen del import (ver seed.ts RUBROS_ENJOY).

export const GRUPO_PERSONAL_EXCLUIDO = 'RECURSOS HUMANOS - ENJOY';

export interface HojaEventoInfo {
  nombre_hoja:         string;
  evento_nombre_excel: string | null;
}

export interface FichaEventoRowPreview {
  fila_excel:             number;
  grupo:                  string | null;
  servicio:               string;
  corresponde:            boolean;
  proveedor_nombre_excel: string | null;
  responsable:            string | null;
  comentario:             string | null;
}

export function normalizarNombreRubro(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[/\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function leerLibro(buffer: Buffer): XLSX.WorkBook {
  return XLSX.read(buffer, { type: 'buffer' });
}

// Heurística: una hoja de evento real trae "EVENTO" en A3 (fila índice 2).
// Descarta las hojas índice/plantilla ("Hoja 1", "Hoja 2") del archivo real.
export function listarHojasEvento(buffer: Buffer): HojaEventoInfo[] {
  const wb = leerLibro(buffer);
  const hojas: HojaEventoInfo[] = [];
  for (const nombre of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<any[]>(wb.Sheets[nombre], { header: 1, defval: '' });
    const fila = rows[2];
    if (fila && String(fila[0] ?? '').trim().toUpperCase() === 'EVENTO') {
      hojas.push({ nombre_hoja: nombre, evento_nombre_excel: String(fila[1] ?? '').trim() || null });
    }
  }
  return hojas;
}

function encontrarFilaHeader(rows: any[][]): number {
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const row = (rows[i] ?? []).map((c: any) => String(c ?? '').trim().toUpperCase());
    if (row.some(c => c.startsWith('SERVICIO')) && row.some(c => c.startsWith('CORRESPONDE'))) {
      return i;
    }
  }
  throw new Error('No se encontró la fila de encabezados (SERVICIO / CORRESPONDE EN ESTE EVENTO) en la hoja');
}

function esVerdadero(v: any): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  const s = String(v ?? '').trim().toLowerCase();
  return s === 'true' || s === 'verdadero' || s === 'si' || s === 'sí' || s === '1' || s === 'x';
}

export function parseHojaFichaEvento(buffer: Buffer, nombreHoja: string): FichaEventoRowPreview[] {
  const wb = leerLibro(buffer);
  const ws = wb.Sheets[nombreHoja];
  if (!ws) throw new Error(`No se encontró la hoja "${nombreHoja}" en el archivo`);

  const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' });
  const headerIdx = encontrarFilaHeader(rows);
  const header = (rows[headerIdx] ?? []).map((c: any) => String(c ?? '').trim().toUpperCase());

  const colGrupo       = header.findIndex(c => c.startsWith('RUBRO'));
  const colServicio    = header.findIndex(c => c.startsWith('SERVICIO'));
  const colCorresponde = header.findIndex(c => c.startsWith('CORRESPONDE'));
  const colProveedor   = header.findIndex(c => c.startsWith('PROVEEDOR'));
  const colResponsable = header.findIndex(c => c.startsWith('RESPONSABLE'));
  const colComentario  = header.findIndex(c => c.startsWith('COMENTARIO'));
  if (colServicio < 0 || colCorresponde < 0) {
    throw new Error('La hoja no tiene las columnas SERVICIO / CORRESPONDE EN ESTE EVENTO esperadas');
  }

  const out: FichaEventoRowPreview[] = [];
  let grupoActual: string | null = null;
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const grupoCelda = colGrupo >= 0 ? String(row[colGrupo] ?? '').trim() : '';
    if (grupoCelda) grupoActual = grupoCelda;

    const servicio = String(row[colServicio] ?? '').trim();
    if (!servicio) continue;
    if (grupoActual === GRUPO_PERSONAL_EXCLUIDO) continue;

    out.push({
      fila_excel:             i + 1,
      grupo:                  grupoActual,
      servicio,
      corresponde:            esVerdadero(row[colCorresponde]),
      proveedor_nombre_excel: colProveedor   >= 0 ? (String(row[colProveedor]   ?? '').trim() || null) : null,
      responsable:            colResponsable >= 0 ? (String(row[colResponsable] ?? '').trim() || null) : null,
      comentario:             colComentario  >= 0 ? (String(row[colComentario]  ?? '').trim() || null) : null,
    });
  }
  return out;
}
