import ExcelJS from 'exceljs';
import { normTexto } from './pedidosMaterialImporter';

// Importador de la planilla de Male "KM - Centro de Costos" (docs/enjoy/).
// Hojas: Costos, RRHH y Extras (oculta) con el mismo encabezado en la fila 2:
//   Item | Descripción | Responsable | Consumido en $ | IVA | Consumido total |
//   Falta pagar | Fecha de pago a proveedores | Se avisó al proveedor
// (Extras cambia "Se avisó" por Datos cuenta | FC | COMPROBANTES).
// Las hojas "Acciones KM - …" se ignoran: Male confirmó que son algo aparte.
//
// La planilla real mezcla texto en las columnas de montos ("Arregla Matias",
// "Vicky"), pone "PAGADO" en la de fecha o en la de aviso, y la fila TOTAL
// cierra cada hoja. Por eso: los montos que no son número quedan en 0 con una
// nota, "PAGADO"/"ABONADO" en cualquier columna marca la línea como pagada y el
// IVA se toma como parte del total (neto + IVA), igual que el resto del sistema.

export type HojaKM = 'COSTOS' | 'RRHH' | 'EXTRAS';

export interface FilaKM {
  clave:        string;        // hoja|descripción|responsable|n° de aparición
  hoja:         HojaKM;
  hoja_nombre:  string;
  fila:         number;
  descripcion:  string;
  responsable:  string | null;
  neto:         number;        // 0 si la celda no tiene un número
  iva:          number;
  total:        number;        // neto + iva
  falta_pagar:  number | null; // null = la celda vacía o con texto
  pagado:       boolean;
  pagado_parcial: number;      // seña: total − falta pagar, si la planilla lo deja ver
  fecha_pago:   string | null; // YYYY-MM-DD
  plazo_pago:   string | null; // texto de la columna de fecha
  avisado:      boolean;
  datos_cuenta: string | null; // Extras
  factura:      string | null; // Extras (FC)
  comprobante:  string | null; // Extras (nombre del archivo de la columna COMPROBANTES)
  notas:        string[];
  advertencias: string[];
}

export interface HojaResumenKM {
  nombre:       string;
  tipo:         HojaKM | 'IGNORADA';
  motivo?:      string;
  filas:        number;
  total_planilla: number | null; // TOTAL de la columna "Consumido en $"
  total_leido:  number;          // suma de los netos leídos
}

export interface ResultadoKM {
  evento_planilla: string | null; // "Festival KM", del título de la hoja Costos
  hojas: HojaResumenKM[];
  filas: FilaKM[];
}

// ── Celdas ────────────────────────────────────────────────────────────────────

/** Valor "visible" de la celda: resultado de la fórmula, texto del hipervínculo o del rich text. */
function valor(cell: ExcelJS.Cell): unknown {
  const v = cell.value as any;
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v;
  if (typeof v === 'object') {
    if ('result' in v) return v.result ?? null;
    if ('formula' in v || 'sharedFormula' in v) return null;
    if (Array.isArray(v.richText)) return v.richText.map((t: any) => t.text).join('');
    if ('text' in v) return v.text;
    if ('error' in v) return null;
  }
  return v;
}

function texto(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return null;
  const t = String(v).replace(/\s+/g, ' ').trim();
  return t === '' ? null : t;
}

function numero(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v !== 'string') return null;
  const t = v.replace(/[$\s]/g, '');
  if (!/^-?[\d.,]+$/.test(t)) return null;
  // "1.500.000" / "1.500.000,50" / "1500000.5"
  const normal = /,\d{1,2}$/.test(t) ? t.replace(/\./g, '').replace(',', '.') : /^\d{1,3}(\.\d{3})+$/.test(t) ? t.replace(/\./g, '') : t.replace(/,/g, '');
  const n = Number(normal);
  return Number.isFinite(n) ? n : null;
}

const r2 = (n: number) => parseFloat(n.toFixed(2));
const esPagado = (t: string | null) => !!t && /\b(pagad[oa]s?|abonad[oa]s?)\b/i.test(t);
const esArreglo = (t: string | null) => !!t && /^arregla\b/i.test(t);
const capitalizar = (t: string) => t.toLowerCase().replace(/(^|\s)\S/g, c => c.toUpperCase());

function fechaISO(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

// ── Encabezado ────────────────────────────────────────────────────────────────

type Col = 'item' | 'descripcion' | 'responsable' | 'neto' | 'iva' | 'total' | 'falta' | 'fecha' | 'aviso' | 'datos' | 'fc' | 'comprobantes';

function columnaDe(h: string): Col | null {
  if (h === 'item') return 'item';
  if (h.startsWith('descripcion')) return 'descripcion';
  if (h.startsWith('responsable')) return 'responsable';
  if (h.startsWith('consumido en')) return 'neto';
  if (h === 'iva') return 'iva';
  if (h.startsWith('consumido total')) return 'total';
  if (h.startsWith('falta pagar')) return 'falta';
  if (h.startsWith('fecha de pago') || h === 'fecha pago') return 'fecha';
  if (h.startsWith('se aviso')) return 'aviso';
  if (h.startsWith('datos cuenta') || h.startsWith('datos de cuenta')) return 'datos';
  if (h === 'fc' || h === 'factura') return 'fc';
  if (h.startsWith('comprobante')) return 'comprobantes';
  return null;
}

function buscarEncabezado(ws: ExcelJS.Worksheet): { fila: number; cols: Partial<Record<Col, number>> } | null {
  const limite = Math.min(ws.rowCount, 10);
  for (let r = 1; r <= limite; r++) {
    const cols: Partial<Record<Col, number>> = {};
    ws.getRow(r).eachCell({ includeEmpty: false }, (cell, c) => {
      const h = normTexto(texto(valor(cell)));
      const col = h ? columnaDe(h) : null;
      if (col && cols[col] === undefined) cols[col] = c;
    });
    if (cols.descripcion && cols.responsable && cols.neto) return { fila: r, cols };
  }
  return null;
}

function tipoHoja(nombre: string): HojaKM | null {
  const n = normTexto(nombre);
  if (n.startsWith('acciones') || n.startsWith('accion')) return null;
  if (n.includes('extra')) return 'EXTRAS';
  if (n.includes('rrhh') || n.includes('recursos humanos')) return 'RRHH';
  return 'COSTOS';
}

// ── Parser ────────────────────────────────────────────────────────────────────

export async function parseCentroCostosKM(buffer: Buffer): Promise<ResultadoKM> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer as any);
  } catch {
    throw new Error('No se pudo leer el archivo. Tiene que ser la planilla de centro de costos en formato .xlsx');
  }

  const hojas: HojaResumenKM[] = [];
  const filas: FilaKM[] = [];
  const apariciones = new Map<string, number>();
  let eventoPlanilla: string | null = null;

  for (const ws of wb.worksheets) {
    const tipo = tipoHoja(ws.name);
    if (!tipo) {
      hojas.push({ nombre: ws.name, tipo: 'IGNORADA', motivo: 'Acciones: no forman parte del centro de costos', filas: 0, total_planilla: null, total_leido: 0 });
      continue;
    }
    const enc = buscarEncabezado(ws);
    if (!enc) {
      hojas.push({ nombre: ws.name, tipo: 'IGNORADA', motivo: 'No tiene el encabezado del centro de costos', filas: 0, total_planilla: null, total_leido: 0 });
      continue;
    }

    // Título "EVENTO: Festival KM - RRHH" en la fila de arriba
    if (tipo === 'COSTOS' && !eventoPlanilla && enc.fila > 1) {
      ws.getRow(enc.fila - 1).eachCell({ includeEmpty: false }, cell => {
        const t = texto(valor(cell));
        const m = t && /^evento:\s*(.+)$/i.exec(t);
        if (m && !eventoPlanilla) eventoPlanilla = m[1].trim();
      });
    }

    const { cols } = enc;
    const leer = (r: number, col: Col) => (cols[col] ? valor(ws.getRow(r).getCell(cols[col]!)) : null);
    const resumen: HojaResumenKM = { nombre: ws.name, tipo, filas: 0, total_planilla: null, total_leido: 0 };

    for (let r = enc.fila + 1; r <= ws.rowCount; r++) {
      const descripcion = texto(leer(r, 'descripcion'));
      const responsable = texto(leer(r, 'responsable'));
      const item        = texto(leer(r, 'item'));
      const esTotal = [descripcion, responsable, item].some(t => /^totale?s?$/i.test(t ?? ''));
      if (esTotal) {
        resumen.total_planilla = numero(leer(r, 'neto'));
        break;
      }
      if (!descripcion && !responsable) continue;

      const notas: string[] = [];
      const advertencias: string[] = [];
      const agregarNota = (t: string) => { if (!notas.includes(t)) notas.push(t); };

      const netoRaw = leer(r, 'neto');
      let neto = numero(netoRaw);
      if (neto === null) {
        const t = texto(netoRaw);
        if (t) {
          agregarNota(esArreglo(t) ? capitalizar(t) : `Consumido: ${t}`);
          advertencias.push(`Sin monto ("${t}")`);
        } else {
          advertencias.push('Sin monto');
        }
        neto = 0;
      }
      const ivaRaw = leer(r, 'iva');
      let iva = numero(ivaRaw) ?? 0;
      if (numero(ivaRaw) === null && texto(ivaRaw) && esArreglo(texto(ivaRaw))) agregarNota(capitalizar(texto(ivaRaw)!));
      if (neto === 0) iva = 0;
      const total = r2(neto + iva);

      // "=D31+E31" en la fila 32: la fórmula del total apunta a otra fila (copia)
      if (cols.total) {
        const fv = ws.getRow(r).getCell(cols.total).value as any;
        const formula: string | undefined = fv && typeof fv === 'object' ? fv.formula : undefined;
        const filasRef = formula ? [...formula.matchAll(/[A-Z]{1,2}\$?(\d+)/g)].map(m => Number(m[1])) : [];
        if (filasRef.length > 0 && filasRef.every(f => f !== r)) {
          advertencias.push(`El total de la planilla usa la fila ${filasRef[0]}: puede ser una copia de esa línea`);
        }
      }

      const totalCelda = numero(leer(r, 'total'));
      if (totalCelda !== null && neto > 0 && Math.abs(totalCelda - total) > 1) {
        advertencias.push(`La planilla dice total ${totalCelda.toLocaleString('es-AR')}; se toma consumido + IVA = ${total.toLocaleString('es-AR')}`);
      }

      const faltaRaw = leer(r, 'falta');
      const falta = numero(faltaRaw);
      const faltaTexto = falta === null ? texto(faltaRaw) : null;
      if (faltaTexto && esArreglo(faltaTexto)) agregarNota(capitalizar(faltaTexto));

      let pagado = esPagado(faltaTexto);
      let fecha_pago: string | null = null;
      let plazo_pago: string | null = null;
      const fechaRaw = leer(r, 'fecha');
      if (fechaRaw instanceof Date) {
        fecha_pago = fechaISO(fechaRaw);
      } else {
        const t = texto(fechaRaw);
        if (esPagado(t)) pagado = true;
        else if (t && esArreglo(t)) agregarNota(capitalizar(t));
        else if (t) plazo_pago = t;
      }

      let avisado = false;
      const avisoT = texto(leer(r, 'aviso'));
      if (avisoT) {
        if (esPagado(avisoT) && avisoT.length <= 12) { pagado = true; avisado = true; }
        else if (/^(si|sí|x|ok|avisado|avisada)$/i.test(avisoT)) avisado = true;
        else if (esArreglo(avisoT)) agregarNota(capitalizar(avisoT));
        else agregarNota(avisoT);
      }

      let datos_cuenta: string | null = null;
      const datosT = texto(leer(r, 'datos'));
      if (datosT) {
        if (esPagado(datosT) && datosT.length <= 12) pagado = true;
        else datos_cuenta = datosT;
      }
      const factura     = texto(leer(r, 'fc'));
      const comprobante = texto(leer(r, 'comprobantes'));

      // Falta pagar en 0 con monto cargado = está pago; entre 0 y el total = seña
      let pagado_parcial = 0;
      if (!pagado && falta !== null && total > 0) {
        if (falta <= 0) pagado = true;
        else if (falta < total) pagado_parcial = r2(total - falta);
      }

      const desc = descripcion ?? responsable!;
      if (!descripcion) advertencias.push('Sin descripción: se usa el responsable');
      const base = `${tipo}|${normTexto(desc)}|${normTexto(responsable)}`;
      const n = (apariciones.get(base) ?? 0) + 1;
      apariciones.set(base, n);

      filas.push({
        clave: `${base}|${n}`, hoja: tipo, hoja_nombre: ws.name, fila: r,
        descripcion: desc, responsable,
        neto: r2(neto), iva: r2(iva), total, falta_pagar: falta, pagado, pagado_parcial,
        fecha_pago, plazo_pago, avisado, datos_cuenta, factura, comprobante,
        notas, advertencias,
      });
      resumen.filas++;
      resumen.total_leido = r2(resumen.total_leido + neto);
    }
    if (resumen.total_planilla !== null && Math.abs(resumen.total_planilla - resumen.total_leido) > 1) {
      resumen.motivo = `El TOTAL de la planilla (${resumen.total_planilla.toLocaleString('es-AR')}) no coincide con la suma de las filas (${resumen.total_leido.toLocaleString('es-AR')})`;
    }
    hojas.push(resumen);
  }

  if (filas.length === 0) {
    throw new Error('No se encontraron líneas. La planilla tiene que tener las columnas Descripción, Responsable y Consumido en $ (hojas Costos, RRHH o Extras).');
  }
  return { evento_planilla: eventoPlanilla, hojas, filas };
}
