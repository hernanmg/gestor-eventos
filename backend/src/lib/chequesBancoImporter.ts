import * as XLSX from 'xlsx';
import type { EstadoEcheq, FormatoCheque, TipoCheque } from '@prisma/client';
import { prisma } from './prisma';
import { convertirARS } from './convertirARS';

// Importador de la planilla de cheques emitidos que lleva Mayra por banco:
//   docs/dos57/mayra/BANCOS/Cheques Pendientes - GALICIA - DOS57.xlsx
//
// Una hoja por año ("2021" … "2026"). Las hojas "RECIBIDOS <año>" son echeqs
// que les dieron los clientes (otra cosa: Finanzas punto 10) y no se leen.
// Cada hoja repite por mes un bloque con título y encabezado:
//   "DOS57- GALICIA - FLUJO DE CHEQUES - ENERO 2026"
//   FECHA DE PAGO | # CHEQUE | CONCEPTO | MONTO | ESTADO | FECHA DE ENTRADA | (G) | (H notas)
//   … filas … | TOTAL
// Desde 2025 hay además bloques "… - FINANCIAMIENTO - <MES> <AÑO>" (en verde):
// cheques propios para financiarse con una SGR. El banco y la empresa salen del
// título del bloque, no del nombre del archivo.
//
// Lo que tiene la planilla real y se resuelve acá:
// - El número a veces es sólo "ECHEQ" (2022): no sirve de clave. import_key =
//   banco|número|fecha|monto con ocurrencia, para no fusionar dos cheques
//   iguales del mismo día.
// - Números sólo con dígitos (27884151) son de chequera física; "ECHEQ 1393", echeq.
// - Filas sin fecha ni monto (2021: ANULADO, A RECUPERAR) son cheques de la
//   chequera que no salieron: se saltean con aviso.
// - Estado: PAGADO → debitado; ACEPTADO o vacío → pendiente; VENCIDO,
//   ANULADO, RECHAZADO… → rechazado con el texto como motivo.
//   "PAGADO $20.000.000 / RENOVADO $9.200.000" → debitado, y el monto que
//   falta sale del texto ($ del concepto o la suma de los $ del estado).
// - Columna F (fecha de entrada) a veces trae texto ("ACEPTADO"): se ignora.
// - En 2025 hay financiamiento dentro del flujo común: se reconoce también por
//   el concepto ("FINANCIERA …"). "CON AVAL" → avalado, si no → propio.
//
// Reimportar no duplica (upsert por import_key) y el estado sólo avanza: un
// cheque que en el sistema ya se marcó debitado o rechazado no vuelve a
// pendiente porque la planilla esté atrasada. Si un cheque ya estaba en el
// sistema (pago de factura o egreso del evento) con el mismo número, monto y
// fecha, se le completan banco y clave en vez de crear otro.

const MESES: Record<string, number> = {
  ENERO: 1, FEBRERO: 2, MARZO: 3, ABRIL: 4, MAYO: 5, JUNIO: 6, JULIO: 7,
  AGOSTO: 8, SEPTIEMBRE: 9, SETIEMBRE: 9, OCTUBRE: 10, NOVIEMBRE: 11, DICIEMBRE: 12,
};

function norm(s: unknown): string {
  return String(s ?? '')
    .normalize('NFD')
    .replace(new RegExp('[\\u0300-\\u036f]', 'g'), '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function excelDate(value: unknown): Date | null {
  if (value == null || value === '') return null;
  if (value instanceof Date) return new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));
  if (typeof value === 'number') {
    const p = XLSX.SSF.parse_date_code(value);
    if (!p || p.y < 2000 || p.y > 2100) return null;
    return new Date(Date.UTC(p.y, p.m - 1, p.d));
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
  const n = typeof value === 'number' ? value : Number(String(value).replace(/[$\s]/g, '').replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

// "$29.200.000" → 29200000 (todos los montos con $ de un texto)
function montosEnTexto(s: string): number[] {
  return [...s.matchAll(/\$\s?([\d.]+(?:,\d+)?)/g)].map(m => toMonto(m[1])).filter((n): n is number => n !== null);
}

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : '');

// ── Parseo ───────────────────────────────────────────────────────────────────

export interface FilaCheque {
  hoja:             string;
  fila:             number;           // 1-based, como la ve Mayra en Excel
  banco:            string;
  empresa_titulo:   string;           // "DOS57", "ENJOY"… tal como dice el título
  numero:           string;
  formato:          FormatoCheque;
  tipo:             TipoCheque;
  concepto:         string;
  sgr_texto:        string | null;    // "AVALES DEL CENTRO", "ARGENPYMES"…
  importe:          number;
  fecha_pago:       Date | null;
  fecha_entrada:    Date | null;
  estado:           EstadoEcheq;
  estado_texto:     string;
  notas:            string | null;
  import_key:       string;
}

export interface HojaCheques {
  hoja:         string;
  filas:        FilaCheque[];
  salteadas:    { fila: number; motivo: string }[];
  advertencias: string[];
}

function estadoDe(texto: string): { estado: EstadoEcheq; motivo: string | null } {
  const t = norm(texto);
  if (!t || t === 'ACEPTADO' || t === 'PENDIENTE') return { estado: 'PENDIENTE', motivo: null };
  if (t.startsWith('PAGADO') || t.endsWith('/PAGADO') || t === 'DEBITADO') return { estado: 'COBRADO', motivo: null };
  // VENCIDO, ANULADO, RECHAZADO POR CAUSAS TÉCNICAS, …
  return { estado: 'RECHAZADO', motivo: texto.trim() };
}

function sgrDeConcepto(concepto: string): string | null {
  const c = norm(concepto).replace(/\s*-?\s*\$.*$/, '').replace(/\bNO SE DESCUENTA\b.*$/, '').trim();
  const m = c.match(/CON AVAL\s+(.+)$/) ?? c.match(/COMPRA SGR\s+(.+)$/);
  return m ? m[1].replace(/\s+SGR$/, '').trim() || null : null;
}

export function parsearHojaCheques(ws: XLSX.WorkSheet, nombreHoja: string, ocurrencias: Map<string, number>): HojaCheques {
  const hoja = nombreHoja.trim();
  const out: HojaCheques = { hoja, filas: [], salteadas: [], advertencias: [] };
  const ref = ws['!ref'];
  if (!ref) return out;
  const range = XLSX.utils.decode_range(ref);
  const v = (r: number, c: number) => { const cell = ws[XLSX.utils.encode_cell({ r, c })]; return cell ? cell.v : null; };

  let banco: string | null = null;
  let empresaTitulo = '';
  let financiamiento = false;
  let col: { fecha: number; numero: number; concepto: number; monto: number; estado: number; entrada: number; notas: number[] } | null = null;

  for (let r = range.s.r; r <= range.e.r; r++) {
    const a = norm(v(r, 0));

    // Título de bloque: "DOS57- GALICIA - FLUJO DE CHEQUES - ENERO 2026"
    const partes = a.split(/\s*-\s*/).filter(Boolean);
    if (partes.length >= 3 && /FLUJO DE CHEQUES|FINANCIAMIENTO/.test(a)) {
      empresaTitulo = partes[0];
      banco = partes[1];
      financiamiento = a.includes('FINANCIAMIENTO');
      col = null;
      continue;
    }
    // Encabezado: se ubican las columnas por texto
    if (a.startsWith('FECHA DE PAGO')) {
      const c: Record<string, number> = {};
      const notas: number[] = [];
      for (let k = 0; k <= Math.min(range.e.c, 12); k++) {
        const h = norm(v(r, k));
        if (h.startsWith('FECHA DE PAGO')) c.fecha = k;
        else if (h.includes('CHEQUE')) c.numero = k;
        else if (h === 'CONCEPTO') c.concepto = k;
        else if (h.startsWith('MONTO')) c.monto = k;
        else if (h === 'ESTADO') c.estado = k;
        else if (h.startsWith('FECHA DE ENTRADA')) c.entrada = k;
      }
      if ([c.fecha, c.numero, c.concepto, c.monto, c.estado].some(x => x === undefined)) {
        out.advertencias.push(`Fila ${r + 1}: encabezado incompleto, se saltea el bloque`);
        col = null; continue;
      }
      const ultima = Math.max(c.fecha, c.numero, c.concepto, c.monto, c.estado, c.entrada ?? 0);
      for (let k = ultima + 1; k <= Math.min(range.e.c, ultima + 3); k++) notas.push(k);
      col = { fecha: c.fecha, numero: c.numero, concepto: c.concepto, monto: c.monto, estado: c.estado, entrada: c.entrada ?? -1, notas };
      continue;
    }
    if (!col || !banco) continue;

    const numeroRaw = String(v(r, col.numero) ?? '').trim();
    const concepto  = String(v(r, col.concepto) ?? '').trim();
    const estadoTxt = String(v(r, col.estado) ?? '').trim();
    const fechaPago = excelDate(v(r, col.fecha));
    let importe     = toMonto(v(r, col.monto));
    if (!numeroRaw && !concepto && importe === null && !fechaPago) continue;   // vacía
    if (norm(concepto) === 'TOTAL' || norm(numeroRaw) === 'TOTAL') continue;
    if (!numeroRaw && !concepto) continue;                                    // restos sueltos (",")

    if (importe === null) {
      const enConcepto = montosEnTexto(concepto);
      const enEstado   = montosEnTexto(estadoTxt);
      importe = enConcepto[0] ?? (enEstado.length ? enEstado.reduce((s, n) => s + n, 0) : null);
      if (importe === null) {
        out.salteadas.push({ fila: r + 1, motivo: `${numeroRaw || 'Sin número'} — ${concepto || 'sin concepto'}: sin monto` });
        continue;
      }
      out.advertencias.push(`Fila ${r + 1} (${numeroRaw}): sin monto en la columna, se tomó $${importe.toLocaleString('es-AR')} del texto`);
    }

    const entradaRaw = col.entrada >= 0 ? v(r, col.entrada) : null;
    const fechaEntrada = excelDate(entradaRaw);
    const notas = [
      // F a veces repite un estado ("ACEPTADO") en vez de la fecha: eso no es nota
      ...(col.entrada >= 0 && entradaRaw != null && !fechaEntrada && !['ACEPTADO', 'PAGADO', 'VENCIDO', 'PENDIENTE'].includes(norm(entradaRaw)) ? [String(entradaRaw).trim()] : []),
      ...col.notas.map(k => v(r, k)).filter(x => x != null && x !== '' && !(excelDate(x))).map(x => String(x).trim()),
    ].filter(Boolean);

    const esFin = financiamiento || norm(concepto).startsWith('FINANCIERA');
    const tipo: TipoCheque = !esFin ? 'PAGO' : norm(concepto).includes('AVAL') ? 'FINANCIAMIENTO_AVALADO' : 'FINANCIAMIENTO_PROPIO';
    const numero  = numeroRaw || 'S/N';
    const formato: FormatoCheque = /^\d+$/.test(numeroRaw) ? 'FISICO' : 'ECHEQ';
    const { estado } = estadoDe(estadoTxt);

    const base = [banco, norm(numero), iso(fechaPago) || iso(fechaEntrada) || `${hoja}#${r + 1}`, importe.toFixed(2)].join('|');
    const n = (ocurrencias.get(base) ?? 0) + 1;
    ocurrencias.set(base, n);

    out.filas.push({
      hoja, fila: r + 1, banco, empresa_titulo: empresaTitulo, numero, formato, tipo, concepto,
      sgr_texto: esFin ? sgrDeConcepto(concepto) : null,
      importe, fecha_pago: fechaPago, fecha_entrada: fechaEntrada,
      estado, estado_texto: estadoTxt, notas: notas.length ? notas.join(' · ') : null,
      import_key: `CHQ|${base}|${n}`,
    });
  }
  return out;
}

// ── Importación ──────────────────────────────────────────────────────────────

export interface ResumenHojaCheques {
  hoja: string; cheques: number; pendientes: number; debitados: number; rechazados: number;
  financiamiento: number; total: number; salteadas: { fila: number; motivo: string }[]; advertencias: string[];
}

export interface ResultadoImportCheques {
  preview:        boolean;
  bancos:         string[];
  hojas:          ResumenHojaCheques[];
  hojas_ignoradas: string[];
  total_cheques:  number;
  creados:        number;
  actualizados:   number;
  vinculados:     number;   // ya estaban en el sistema (evento / factura)
  sin_cambios:    number;
  sgr_sin_match:  string[];
  pendientes:     { hoja: string; fila: number; numero: string; concepto: string; importe: number; fecha_pago: string; estado_texto: string }[];
  errores:        string[];
}

const RANK: Record<EstadoEcheq, number> = { PENDIENTE: 0, COBRADO: 1, RECHAZADO: 1, VENDIDO: 1 };
const digitos = (s: string) => s.replace(/\D/g, '');

export async function importarChequesBanco(
  wb: XLSX.WorkBook,
  empresa: { id: number; nombre: string; nombre_corto: string | null },
  usuarioId: number,
  preview: boolean,
  hojasElegidas?: string[],
): Promise<ResultadoImportCheques> {
  const res: ResultadoImportCheques = {
    preview, bancos: [], hojas: [], hojas_ignoradas: [], total_cheques: 0,
    creados: 0, actualizados: 0, vinculados: 0, sin_cambios: 0, sgr_sin_match: [], pendientes: [], errores: [],
  };

  const ocurrencias = new Map<string, number>();
  const filas: FilaCheque[] = [];
  for (const nombre of wb.SheetNames) {
    if (/RECIBID/i.test(nombre)) { res.hojas_ignoradas.push(`${nombre} (cheques recibidos de clientes)`); continue; }
    const h = parsearHojaCheques(wb.Sheets[nombre], nombre, ocurrencias);
    if (!h.filas.length && !h.salteadas.length) { res.hojas_ignoradas.push(`${nombre} (sin bloques de cheques)`); continue; }
    if (hojasElegidas && !hojasElegidas.includes(h.hoja)) { res.hojas_ignoradas.push(`${nombre} (no elegida)`); continue; }
    filas.push(...h.filas);
    res.hojas.push({
      hoja: h.hoja, cheques: h.filas.length,
      pendientes: h.filas.filter(f => f.estado === 'PENDIENTE').length,
      debitados:  h.filas.filter(f => f.estado === 'COBRADO').length,
      rechazados: h.filas.filter(f => f.estado === 'RECHAZADO').length,
      financiamiento: h.filas.filter(f => f.tipo !== 'PAGO').length,
      total: Math.round(h.filas.reduce((s, f) => s + f.importe, 0) * 100) / 100,
      salteadas: h.salteadas, advertencias: h.advertencias,
    });
  }
  res.bancos = [...new Set(filas.map(f => f.banco))];
  res.total_cheques = filas.length;

  // La planilla dice de qué empresa es: no mezclar DOS57 en Enjoy.
  const nombresEmpresa = [empresa.nombre, empresa.nombre_corto].filter(Boolean).map(n => norm(n).replace(/\s/g, ''));
  const ajenas = [...new Set(filas.map(f => f.empresa_titulo))].filter(t => t && !nombresEmpresa.some(n => n.includes(t.replace(/\s/g, '')) || t.replace(/\s/g, '').includes(n)));
  if (ajenas.length) {
    res.errores.push(`La planilla es de ${ajenas.join(', ')} y la empresa activa es ${empresa.nombre_corto ?? empresa.nombre}. Cambiá de empresa antes de importar.`);
    return res;
  }

  // SGR por nombre (contiene, sin espacios ni "SGR")
  const sgrs = await prisma.sGR.findMany({ where: { empresa_id: empresa.id, deleted_at: null }, select: { id: true, nombre: true } });
  const clave = (s: string) => norm(s).replace(/\bSGR\b/g, '').replace(/[^A-Z0-9]/g, '');
  const sgrDe = (texto: string | null) => {
    if (!texto) return null;
    const k = clave(texto);
    return sgrs.find(s => { const n = clave(s.nombre); return n && (n === k || k.includes(n) || n.includes(k)); })?.id ?? null;
  };
  res.sgr_sin_match = [...new Set(filas.filter(f => f.sgr_texto && !sgrDe(f.sgr_texto)).map(f => f.sgr_texto!))];

  // Proveedor por nombre exacto (normalizado)
  const proveedores = await prisma.proveedor.findMany({ where: { empresa_id: empresa.id, deleted_at: null }, select: { id: true, nombre: true } });
  const provPorNombre = new Map(proveedores.map(p => [norm(p.nombre), p.id]));

  res.pendientes = filas.filter(f => f.estado === 'PENDIENTE').map(f => ({
    hoja: f.hoja, fila: f.fila, numero: f.numero, concepto: f.concepto, importe: f.importe,
    fecha_pago: iso(f.fecha_pago), estado_texto: f.estado_texto,
  }));

  // Existentes: por clave, y los cargados en el sistema sin clave (para vincular)
  const existentes = await prisma.echeq.findMany({
    where:  { empresa_id: empresa.id, deleted_at: null },
    select: { id: true, import_key: true, numero: true, importe: true, fecha_cobro_estimada: true, estado: true, banco: true, tipo: true, sgr_id: true, fecha_cobro_real: true, motivo_rechazo: true, detalle: true, formato: true },
  });
  const porClave = new Map(existentes.filter(e => e.import_key).map(e => [e.import_key!, e]));
  const sueltos = existentes.filter(e => !e.import_key);
  const usados = new Set<number>();

  for (const f of filas) {
    const sgr_id = f.tipo !== 'PAGO' ? sgrDe(f.sgr_texto) : null;
    let ex = porClave.get(f.import_key);
    let vincular = false;
    if (!ex && f.fecha_pago && digitos(f.numero)) {
      ex = sueltos.find(e => !usados.has(e.id) && digitos(e.numero) === digitos(f.numero)
        && Math.abs(Number(e.importe) - f.importe) < 0.01
        && e.fecha_cobro_estimada?.getTime() === f.fecha_pago!.getTime());
      if (ex) { vincular = true; usados.add(ex.id); }
    }

    // Estado: sólo avanza
    const avanza = !ex || RANK[f.estado] > RANK[ex.estado];
    const datosEstado = avanza ? {
      estado: f.estado,
      fecha_cobro_real: f.estado === 'COBRADO' ? (f.fecha_entrada ?? f.fecha_pago) : null,
      motivo_rechazo: f.estado === 'RECHAZADO' ? f.estado_texto : null,
    } : {};

    if (!ex) {
      res.creados++;
      if (!preview) {
        await prisma.echeq.create({
          data: {
            empresa_id: empresa.id, import_key: f.import_key, banco: f.banco, formato: f.formato, tipo: f.tipo, sgr_id,
            proveedor_id: f.tipo === 'PAGO' ? (provPorNombre.get(norm(f.concepto)) ?? null) : null,
            numero: f.numero, razon_social: f.concepto || f.numero, detalle: f.notas,
            importe: f.importe, moneda: 'ARS', monto_ars: convertirARS(f.importe, 'ARS', null),
            fecha_cobro_estimada: f.fecha_pago ?? f.fecha_entrada,
            estado: f.estado,
            fecha_cobro_real: f.estado === 'COBRADO' ? (f.fecha_entrada ?? f.fecha_pago) : null,
            motivo_rechazo: f.estado === 'RECHAZADO' ? f.estado_texto : null,
            created_by: usuarioId, updated_by: usuarioId,
          },
        });
      }
      continue;
    }

    const cambios: Record<string, unknown> = { ...datosEstado };
    if (vincular) Object.assign(cambios, { import_key: f.import_key });
    if (!ex.banco) cambios.banco = f.banco;
    if (ex.tipo !== f.tipo && ex.tipo === 'PAGO') cambios.tipo = f.tipo;
    if (sgr_id && !ex.sgr_id) cambios.sgr_id = sgr_id;
    if (f.notas && !ex.detalle) cambios.detalle = f.notas;
    // fecha de entrada que llegó después en la planilla
    if (!avanza && ex.estado === 'COBRADO' && f.estado === 'COBRADO' && f.fecha_entrada && ex.fecha_cobro_real?.getTime() !== f.fecha_entrada.getTime()) cambios.fecha_cobro_real = f.fecha_entrada;

    const hay = Object.keys(cambios).length > 0;
    if (vincular) res.vinculados++;
    else if (hay) res.actualizados++;
    else res.sin_cambios++;
    if (hay && !preview) await prisma.echeq.update({ where: { id: ex.id }, data: { ...cambios, updated_by: usuarioId } });
  }
  return res;
}
