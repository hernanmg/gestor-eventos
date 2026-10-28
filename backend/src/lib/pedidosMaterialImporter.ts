import ExcelJS from 'exceljs';
import type { EstadoRubroEvento } from '@prisma/client';
import { parseEsquemaHoja, type FilaEsquemaParseada } from './esquemaTurnosImporter';

// Parser de las planillas de pedidos a proveedores de Dani. Cubre dos variantes
// del mismo concepto (una hoja resumen + una hoja de pedido por rubro):
//
//   docs/enjoy/dani/Festival KM - Pedidos de material.xlsx
//     "PROVEEDORES CONFIRMADOS": Servicio | Proveedor | Confirmado | Presupuesto |
//       Observaciones | Número de contacto | Referente
//     Una hoja "PEDIDO DE MATERIAL" / "PEDIDO DE SERVICIO" por rubro: título en la
//     fila siguiente, encabezado "Clave: valor" (Evento, Fecha de entrega, Empresa,
//     Ejecutivo de cuenta...) y la tabla Cantidad | Material | ... | Observaciones.
//
//   docs/enjoy/dani/Fiesta nacional de la pelota _ Ficha de evento.xlsx
//     "FICHA EVENTO": LISTADO | PROVEEDOR | CONFIRMADO (SI/NO) | CONTACTO
//       ("POLLO: +54 9 ...") | COORDINA
//     Una hoja "FICHA DE PROVEEDOR" por rubro: SERVICIO: / PROVEEDOR: / FECHA
//       INGRESO: en una fila, y la tabla con columnas que cambian por rubro.
//
// Las columnas de la tabla cambian de un rubro a otro (Piso, Entelado, Uso, M2, PX,
// Vestimenta...): lo que no es Cantidad / Material / Días / Llegada / Retiro va a
// Observaciones como "Columna: valor". Las filas de sección ("ESCENARIO PRINCIPAL",
// "BACKSTAGE ARTISTAS") se arrastran como prefijo de las observaciones.
//
// Ojo con las celdas combinadas: ExcelJS repite el valor del master en todo el
// rango. Acá se lee sólo el master (si no, "Escenario Layher" combinado en 4 filas
// sale 4 veces); las columnas de sección se arrastran a mano.

export interface ItemPedidoParseado {
  fila_excel:      number;
  cantidad:        number | null;
  descripcion:     string;
  dias_uso:        number | null;
  horario_llegada: string | null;
  horario_retiro:  string | null;
  observaciones:   string | null;
}

export interface BloquePedido {
  /** Identifica el bloque en la vista previa (para elegir otro rubro). */
  clave:             string;
  servicio:          string;
  hojas:             string[];
  estado:            EstadoRubroEvento;
  estado_excel:      string | null;
  proveedor_excel:   string | null;
  contacto_nombre:   string | null;
  contacto_telefono: string | null;
  contacto_cargo:    string | null;
  coordina:          string | null;
  presupuesto:       number | null;
  fecha_ingreso:     string | null; // YYYY-MM-DD
  fecha_retiro:      string | null;
  notas:             string[];
  items:             ItemPedidoParseado[];
  turnos:            FilaEsquemaParseada[];
  advertencias:      string[];
}

export interface PedidosParseados {
  formato:       'PEDIDOS_MATERIAL' | 'FICHA_EVENTO';
  hoja_resumen:  string | null;
  evento_excel:  string | null;
  lugar_excel:   string | null;
  bloques:       BloquePedido[];
  hojas_omitidas: { hoja: string; motivo: string }[];
}

// ── Texto ─────────────────────────────────────────────────────────────────────

/** minúsculas, sin tildes, sin signos: "Baños Químicos" → "banos quimicos". */
export function normTexto(s: unknown): string {
  return String(s ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const normClave = (s: unknown) => normTexto(s).replace(/ /g, '');

function cellText(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return '';
  if (typeof v === 'object') {
    const o = v as any;
    if (o.richText) return o.richText.map((t: any) => t.text).join('').trim();
    if (o.result !== undefined) return o.result instanceof Date ? '' : String(o.result ?? '').trim();
    if (o.text !== undefined) return String(o.text).trim();
    return '';
  }
  return String(v).trim();
}

function cellRaw(v: ExcelJS.CellValue): unknown {
  if (v && typeof v === 'object' && !(v instanceof Date)) {
    const o = v as any;
    if (o.result !== undefined) return o.result;
    if (o.richText) return o.richText.map((t: any) => t.text).join('');
    if (o.text !== undefined) return o.text;
  }
  return v;
}

/** Valor de la celda sólo si es el master de su rango combinado (o no está combinada). */
export function masterRaw(ws: ExcelJS.Worksheet, r: number, c: number): unknown {
  const cell = ws.getCell(r, c);
  if (cell.isMerged && cell.master && cell.master.address !== cell.address) return null;
  const raw = cellRaw(cell.value);
  return typeof raw === 'string' ? raw.trim() : raw;
}

export function esVacio(v: unknown): boolean {
  return v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
}

/** Celdas master con valor de una fila, en orden de columna. */
export function celdasFila(ws: ExcelJS.Worksheet, r: number): { c: number; raw: unknown; text: string }[] {
  const out: { c: number; raw: unknown; text: string }[] = [];
  const row = ws.getRow(r);
  row.eachCell({ includeEmpty: false }, (_cell, c) => {
    const raw = masterRaw(ws, r, c);
    if (esVacio(raw)) return;
    out.push({ c, raw, text: raw instanceof Date ? fmtDM(raw) : String(raw).trim() });
  });
  return out;
}

// ── Fechas ────────────────────────────────────────────────────────────────────

const pad2 = (n: number) => String(n).padStart(2, '0');
const fmtDM = (d: Date) => `${pad2(d.getUTCDate())}/${pad2(d.getUTCMonth() + 1)}`;
const iso = (y: number, m: number, d: number) => `${y}-${pad2(m)}-${pad2(d)}`;

/**
 * Primera fecha "dd/mm" (o dd/mm/aa) del texto → YYYY-MM-DD. Sin año, toma el
 * año que deja la fecha más cerca del evento (un montaje de diciembre para un
 * evento de enero cae en el año anterior). Texto sin fecha ("POS EVENTO") → null.
 */
export function parseFechaTexto(texto: unknown, referencia: Date | null): string | null {
  if (texto instanceof Date) return iso(texto.getUTCFullYear(), texto.getUTCMonth() + 1, texto.getUTCDate());
  // El año va pegado ("16/11/24"): "29/04 / 30/04" o "14/11 - 09.00hs" no lo tienen.
  const m = /(\d{1,2})[/-](\d{1,2})(?:[/-](\d{4}|\d{2})(?!\d))?/.exec(String(texto ?? ''));
  if (!m) return null;
  const d = Number(m[1]); const mes = Number(m[2]);
  if (d < 1 || d > 31 || mes < 1 || mes > 12) return null;
  if (m[3]) return iso(m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]), mes, d);
  const ref = referencia ?? new Date();
  const y0 = ref.getUTCFullYear();
  let mejor = y0; let dist = Infinity;
  for (const y of [y0 - 1, y0, y0 + 1]) {
    const dd = Math.abs(Date.UTC(y, mes - 1, d) - ref.getTime());
    if (dd < dist) { dist = dd; mejor = y; }
  }
  return iso(mejor, mes, d);
}

export function horaTexto(v: unknown): string | null {
  if (v instanceof Date) {
    if (v.getUTCFullYear() < 1901) return `${pad2(v.getUTCHours())}:${pad2(v.getUTCMinutes())}`;
    return fmtDM(v);
  }
  if (typeof v === 'number' && v >= 0 && v < 1) {
    const min = Math.round(v * 1440) % 1440;
    return `${pad2(Math.floor(min / 60))}:${pad2(min % 60)}`;
  }
  const t = String(v ?? '').trim();
  return t && t !== '-' ? t : null;
}

// ── Estado ────────────────────────────────────────────────────────────────────

export function estadoDesdeTexto(texto: string | null): EstadoRubroEvento | null {
  const t = normTexto(texto);
  if (!t) return null;
  if (t === 'si' || t.startsWith('confirm') || t === 'ok') return 'CONFIRMADO';
  if (t === 'no' || t === 'no va') return 'NO_VA';
  if (t.startsWith('cancel')) return 'CANCELADO';
  if (t.startsWith('cotiz')) return 'COTIZANDO';
  if (t.startsWith('pend') || t === 'ver' || t.startsWith('ver ') || t.startsWith('a definir') || t.startsWith('a confirmar')) return 'PENDIENTE';
  return null;
}

/** Proveedor "VER", "A DEFINIR", "-" → no hay proveedor todavía. */
export function proveedorReal(texto: string | null): string | null {
  const t = normTexto(texto);
  // "VER", "VER DANI" (lo resuelve Dani), "A DEFINIR", "NO VA": todavía no hay proveedor
  if (!t || t === 'ver' || t.startsWith('ver ') || t.startsWith('a definir') || t.startsWith('a confirmar') || t === 'pendiente' || t === 'no va') return null;
  return (texto ?? '').trim();
}

// ── Contactos ─────────────────────────────────────────────────────────────────

const RE_TEL = /\+?\d[\d\s-]{6,}\d/;

/** "POLLO: +54 9 3512 95-6442" → { nombre: POLLO, telefono }; "54 9 3537..." → sólo teléfono. */
function parseContacto(texto: string | null): { nombre: string | null; telefono: string | null } {
  const t = (texto ?? '').trim();
  if (!t || t === '-') return { nombre: null, telefono: null };
  const tel = RE_TEL.exec(t)?.[0].trim() ?? null;
  const resto = (tel ? t.replace(tel, '') : t).replace(/[:/]+\s*$/, '').replace(/:\s*$/, '').trim();
  return { nombre: resto && resto !== '-' ? resto : null, telefono: tel };
}

/** "Pollo Bibiloni // Telefono: +54 9 ... // Cargo: x" */
function parseEjecutivo(valor: string): { nombre: string | null; telefono: string | null; cargo: string | null } {
  let nombre: string | null = null; let telefono: string | null = null; let cargo: string | null = null;
  for (const parte of valor.split('//').map(p => p.trim()).filter(Boolean)) {
    const m = /^([^:]+):\s*(.*)$/.exec(parte);
    const k = m ? normClave(m[1]) : '';
    const v = (m ? m[2] : parte).trim();
    if (!v) continue;
    if (m && (k.startsWith('tel') || k === 'cel' || k === 'celular')) telefono = telefono ?? v;
    else if (m && k === 'cargo') cargo = cargo ?? v;
    else if (!nombre) {
      const c = parseContacto(v);
      nombre = c.nombre; telefono = telefono ?? c.telefono;
    }
  }
  return { nombre, telefono, cargo };
}

export function aNumero(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const t = String(v ?? '').replace(/[$\s.]/g, '').replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  return Number(t);
}

// ── Hoja resumen ──────────────────────────────────────────────────────────────

interface FilaResumen {
  fila: number; servicio: string; proveedor: string | null; confirmado: string | null;
  presupuesto: unknown; observaciones: string | null; contacto: string | null; referente: string | null; coordina: string | null;
  ingreso: unknown;
}

type ColsResumen = Record<string, number>;

/**
 * Encabezado de la hoja resumen. Tres variantes:
 *   PROVEEDORES CONFIRMADOS: Servicio | Proveedor | Confirmado | ...
 *   FICHA EVENTO (Pelota):   LISTADO | PROVEEDOR | CONFIRMADO | CONTACTO | COORDINA
 *   Control Rubros (Expo):   N° | Rubro | Proveedor | Ingreso — dos tablas lado a lado
 *     y sin columna de estado (el estado sale del proveedor: "NO VA", "VER").
 * Devuelve una tabla por cada columna de servicio/rubro de la fila.
 */
function buscarResumen(ws: ExcelJS.Worksheet): { headerRow: number; tablas: ColsResumen[] } | null {
  for (let r = 1; r <= Math.min(ws.rowCount, 20); r++) {
    const tablas: ColsResumen[] = [];
    let actual: ColsResumen | null = null;
    for (const { c, text } of celdasFila(ws, r)) {
      const k = normClave(text);
      if (k === 'servicio' || k === 'listado' || k === 'rubro') { actual = { servicio: c }; tablas.push(actual); continue; }
      if (!actual) continue;
      if (k === 'proveedor' && !actual.proveedor) actual.proveedor = c;
      else if (k.startsWith('confirmado') && !actual.confirmado) actual.confirmado = c;
      else if (k.startsWith('presupuesto')) actual.presupuesto = c;
      else if (k.startsWith('observacion')) actual.observaciones = c;
      else if (k.includes('contacto') || k.startsWith('telefono')) actual.contacto = c;
      else if (k.startsWith('referente')) actual.referente = c;
      else if (k.startsWith('coordina')) actual.coordina = c;
      else if (k === 'ingreso') actual.ingreso = c;
    }
    const validas = tablas.filter(t => t.proveedor && (t.confirmado || t.ingreso));
    if (validas.length > 0) return { headerRow: r, tablas: validas };
  }
  return null;
}

function leerResumen(ws: ExcelJS.Worksheet, headerRow: number, tablas: ColsResumen[]): FilaResumen[] {
  const out: FilaResumen[] = [];
  const txt = (r: number, c?: number) => {
    if (!c) return null;
    const raw = masterRaw(ws, r, c);
    return esVacio(raw) ? null : String(raw).trim();
  };
  for (const cols of tablas) {
    let leidas = 0;
    for (let r = headerRow + 1; r <= ws.rowCount; r++) {
      const servicio = txt(r, cols.servicio);
      if (!servicio) {
        if (leidas > 0) break; // fin de la tabla (más abajo viene otra cosa: equipos, etc.)
        continue;
      }
      leidas++;
      out.push({
        fila: r, servicio,
        proveedor:     txt(r, cols.proveedor),
        confirmado:    txt(r, cols.confirmado),
        presupuesto:   cols.presupuesto ? masterRaw(ws, r, cols.presupuesto) : null,
        observaciones: txt(r, cols.observaciones),
        contacto:      txt(r, cols.contacto),
        referente:     txt(r, cols.referente),
        coordina:      txt(r, cols.coordina),
        ingreso:       cols.ingreso ? masterRaw(ws, r, cols.ingreso) : null,
      });
    }
  }
  return out;
}

// ── Hojas de pedido ───────────────────────────────────────────────────────────

const RE_TITULO_PEDIDO = /^(pedidodematerial|pedidodeservicio|fichadeproveedor)/;

interface HojaPedido {
  hoja:        string;
  titulo:      string | null;
  kv:          Map<string, string>;   // clave normalizada → valor
  ejecutivos:  string[];
  items:       ItemPedidoParseado[];
  turnos:      FilaEsquemaParseada[];
  advertencias: string[];
}

type RolColumna =
  | { rol: 'cantidad' } | { rol: 'descripcion' } | { rol: 'grupo'; label: string }
  | { rol: 'dias' } | { rol: 'llegada' } | { rol: 'retiro' } | { rol: 'hora_llegada' } | { rol: 'hora_retiro' }
  | { rol: 'observaciones' } | { rol: 'extra'; label: string } | { rol: 'ignorar' };

const PALABRAS_ENCABEZADO = new Set([
  'cantidad', 'material', 'pedido', 'personal', 'observaciones', 'dias', 'diasdeuso', 'llegada', 'salida',
  'horario', 'ingreso', 'retiro', 'uso', 'n', 'no', 'tipo', 'medida', 'm2', 'px', 'estado', 'ubicacion',
  'piso', 'entelado', 'vestimenta', 'accesorios', 'laterales', 'iluminacion', 'color', 'operador',
  'tamanotubo', 'rubro', 'fechadecarga', 'logistica', 'areasistema', 'tipodepantalla',
]);

function detectarTabla(ws: ExcelJS.Worksheet, desde: number): { fila: number; roles: Map<number, RolColumna> } | null {
  for (let r = desde; r <= Math.min(ws.rowCount, desde + 15); r++) {
    const celdas = celdasFila(ws, r);
    const conocidas = celdas.filter(x => PALABRAS_ENCABEZADO.has(normClave(x.text)));
    if (conocidas.length < 2) continue;
    const claves = new Set(conocidas.map(x => normClave(x.text)));
    const descClave = ['material', 'pedido', 'personal', 'tipo', 'uso'].find(k => claves.has(k));
    if (!descClave && !claves.has('cantidad')) continue;

    const roles = new Map<number, RolColumna>();
    let ultimo: 'llegada' | 'retiro' | null = null;
    for (const { c, text } of celdas) {
      const k = normClave(text);
      if (k === 'cantidad') roles.set(c, { rol: 'cantidad' });
      else if (k === descClave) roles.set(c, { rol: 'descripcion' });
      else if (k === 'pedido' || k === 'ubicacion' || k === 'areasistema' || k === 'rubro') roles.set(c, { rol: 'grupo', label: text });
      else if (k === 'dias' || k === 'diasdeuso') roles.set(c, { rol: 'dias' });
      else if (k === 'llegada' || k === 'ingreso') { roles.set(c, { rol: 'llegada' }); ultimo = 'llegada'; }
      else if (k === 'salida' || k === 'retiro') { roles.set(c, { rol: 'retiro' }); ultimo = 'retiro'; }
      else if (k === 'horario') roles.set(c, ultimo === 'retiro' ? { rol: 'hora_retiro' } : { rol: 'hora_llegada' });
      else if (k.startsWith('observacion')) roles.set(c, { rol: 'observaciones' });
      else if (k === 'n' || k === 'no') roles.set(c, { rol: 'ignorar' });
      else roles.set(c, { rol: 'extra', label: text.charAt(0).toUpperCase() + text.slice(1).toLowerCase() });
    }
    // Una columna sin encabezado a la izquierda de todo (ESTRUCTURAS / VALLADO /
    // CERRAMIENTO en la ficha de la Pelota) es una sección.
    const primera = Math.min(...roles.keys());
    for (let c = 1; c < primera; c++) roles.set(c, { rol: 'grupo', label: '' });
    return { fila: r, roles };
  }
  return null;
}

/** "24 (12 x lado)" → 24 + "(12 x lado)"; "150mts" → 150 + "mts"; "TBC" → null + "TBC". */
function parseCantidad(v: unknown): { cantidad: number | null; resto: string | null } {
  if (typeof v === 'number') return { cantidad: v, resto: null };
  const t = String(v ?? '').trim();
  if (!t || t === '-') return { cantidad: null, resto: null };
  const m = /^(\d+(?:[.,]\d+)?)\s*(.*)$/.exec(t);
  if (m) return { cantidad: Number(m[1].replace(',', '.')), resto: m[2].trim() || null };
  return { cantidad: null, resto: t };
}

function parseHojaPedido(ws: ExcelJS.Worksheet): HojaPedido | null {
  // Título "PEDIDO DE MATERIAL" / "FICHA DE PROVEEDOR" en las primeras filas
  let filaTitulo = 0;
  for (let r = 1; r <= Math.min(ws.rowCount, 12) && !filaTitulo; r++) {
    if (celdasFila(ws, r).some(x => RE_TITULO_PEDIDO.test(normClave(x.text)))) filaTitulo = r;
  }

  if (!filaTitulo) {
    // Sin título: puede ser una grilla de turnos suelta ("ESQUEMA DE LIMPIEZA")
    const esquema = parseEsquemaHoja(ws);
    if (!esquema) return null;
    let titulo: string | null = null;
    for (let r = 1; r <= 5 && !titulo; r++) {
      const t = celdasFila(ws, r).find(x => /^esquema de /i.test(normTexto(x.text)));
      if (t) titulo = t.text.replace(/^\s*esquema de\s*(personal\s*-?\s*)?/i, '').trim();
    }
    return { hoja: ws.name, titulo: titulo ?? ws.name, kv: new Map(), ejecutivos: [], items: [], turnos: esquema.filas, advertencias: [] };
  }

  const tabla = detectarTabla(ws, filaTitulo + 1);
  const finEncabezado = tabla ? tabla.fila : Math.min(ws.rowCount, filaTitulo + 8);

  const kv = new Map<string, string>();
  const ejecutivos: string[] = [];
  let titulo: string | null = null;
  for (let r = filaTitulo + 1; r < finEncabezado; r++) {
    for (const { text } of celdasFila(ws, r)) {
      const m = /^([^:]{2,40}):\s*(.*)$/s.exec(text);
      if (!m) {
        const k = normClave(text);
        if (!titulo && k && k !== 'pedido' && !RE_TITULO_PEDIDO.test(k)) titulo = text;
        continue;
      }
      const k = normClave(m[1]);
      const v = m[2].trim();
      if (k.startsWith('ejecutivodecuenta')) { if (v) ejecutivos.push(v); continue; }
      if (v && !kv.has(k)) kv.set(k, v);
    }
  }
  if (kv.has('servicio')) titulo = kv.get('servicio')!;

  const hoja: HojaPedido = { hoja: ws.name, titulo, kv, ejecutivos, items: [], turnos: [], advertencias: [] };
  if (!tabla) {
    hoja.advertencias.push('No se encontró la tabla del pedido (Cantidad / Material)');
    return hoja;
  }

  // Grilla de turnos dentro de una hoja de pedido (LIMPIEZA: Fecha | Cantidad | Sector | Ingreso | Salida)
  const encabezados = new Set(celdasFila(ws, tabla.fila).map(x => normClave(x.text)));
  if (encabezados.has('fecha') && encabezados.has('ingreso') && encabezados.has('salida')) {
    const esquema = parseEsquemaHoja(ws);
    if (esquema) hoja.turnos = esquema.filas;
    return hoja;
  }

  const grupos = new Map<number, string>();     // arrastre de columnas de sección
  let seccion: string | null = null;            // fila de sección suelta ("BACKSTAGE ARTISTAS")
  let ultimaDescripcion: string | null = null;
  const roles = tabla.roles;
  const colDe = (rol: RolColumna['rol']) => [...roles.entries()].find(([, v]) => v.rol === rol)?.[0];
  const cCant = colDe('cantidad');
  const cDesc = colDe('descripcion');
  const cN = colDe('ignorar');

  for (let r = tabla.fila + 1; r <= ws.rowCount; r++) {
    const celdas = celdasFila(ws, r);
    if (celdas.length === 0) continue;
    if (celdas.some(x => normTexto(x.text).startsWith('total'))) continue;

    // Fila de sección: un solo texto no numérico en la columna de cantidad (o
    // en la primera columna), sin nada más.
    if (celdas.length === 1) {
      const unico = celdas[0];
      const rol = roles.get(unico.c)?.rol;
      const esPrimera = unico.c <= Math.min(...roles.keys());
      if ((rol === 'cantidad' || rol === 'grupo' || esPrimera || !rol) && aNumero(unico.raw) === null && rol !== 'descripcion') {
        if (rol === 'grupo') {
          for (const k of [...grupos.keys()]) if (k > unico.c) grupos.delete(k);
          grupos.set(unico.c, unico.text);
        } else seccion = unico.text;
        continue;
      }
    }

    // Columnas de sección (se arrastran hasta el próximo valor). Un valor nuevo en
    // una sección de la izquierda (UBICACIÓN = FOH) limpia las de su derecha
    // (AREA/SISTEMA = MONITOREO venía del escenario anterior).
    for (const [c, rolCol] of [...roles.entries()].sort((a, b) => a[0] - b[0])) {
      if (rolCol.rol !== 'grupo') continue;
      const raw = masterRaw(ws, r, c);
      if (esVacio(raw)) continue;
      for (const k of [...grupos.keys()]) if (k > c) grupos.delete(k);
      grupos.set(c, String(raw).trim());
    }

    const raw = (c?: number) => (c ? masterRaw(ws, r, c) : null);
    let { cantidad, resto } = parseCantidad(raw(cCant));
    // Sin columna Cantidad pero numeradas (CARPAS de la Pelota: N° | USO | MEDIDA): una por fila
    if (!cCant && cN && aNumero(raw(cN)) !== null) cantidad = 1;
    let descripcion = esVacio(raw(cDesc)) ? '' : String(raw(cDesc)).trim();

    // "01 - Generadores 250KVA + jabalina" (ficha de la Pelota)
    const mNum = /^(\d{1,3})\s*-\s*(.+)$/.exec(descripcion);
    if (cantidad === null && mNum) { cantidad = Number(mNum[1]); descripcion = mNum[2].trim(); }

    const extras: string[] = [];
    let dias_uso: number | null = null;
    let llegada: string | null = null; let horaLlegada: string | null = null;
    let retiro: string | null = null;  let horaRetiro: string | null = null;
    let obs: string | null = null;
    for (const [c, rolCol] of roles) {
      const v = masterRaw(ws, r, c);
      if (esVacio(v)) continue;
      const texto = horaTexto(v);
      if (!texto) continue;
      switch (rolCol.rol) {
        case 'dias': {
          const n = aNumero(v);
          if (n !== null && Number.isInteger(n)) dias_uso = n; else extras.push(`Días de uso: ${texto}`);
          break;
        }
        case 'llegada':      llegada = texto; break;
        case 'hora_llegada': horaLlegada = texto; break;
        case 'retiro':       retiro = texto; break;
        case 'hora_retiro':  horaRetiro = texto; break;
        case 'observaciones': obs = texto; break;
        case 'extra':        extras.push(`${rolCol.label}: ${texto}`); break;
        default: break;
      }
    }

    const hayAlgo = descripcion || cantidad !== null || extras.length > 0 || obs;
    if (!hayAlgo) continue;
    if (!descripcion) {
      // Fila que continúa la anterior (AGUA + DISPENSER: "1 | | Comedor")
      if (ultimaDescripcion && cantidad !== null) descripcion = ultimaDescripcion;
      else if (extras.length > 0 && cantidad !== null) descripcion = extras.shift()!.replace(/^[^:]+:\s*/, '');
      else continue; // un número suelto en una columna (total de M2, etc.)
    }
    ultimaDescripcion = descripcion;

    const partes = [
      ...[...grupos.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v),
      seccion,
      resto ? `Cantidad: ${resto}` : null,
      ...extras,
      obs,
    ].filter((p): p is string => !!p && p !== '-');

    hoja.items.push({
      fila_excel: r,
      cantidad,
      descripcion,
      dias_uso,
      horario_llegada: [llegada, horaLlegada].filter(Boolean).join(' ') || null,
      horario_retiro:  [retiro, horaRetiro].filter(Boolean).join(' ') || null,
      observaciones:   partes.length > 0 ? [...new Set(partes)].join(' · ') : null,
    });
  }
  return hoja;
}

// ── Canonización de nombres de servicio ───────────────────────────────────────

/** Singular simple por palabra, aplicado igual a ambos lados de la comparación. */
function singular(w: string): string {
  if (w.length > 4 && /[rlnd]es$/.test(w)) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s')) return w.slice(0, -1);
  return w;
}

function canonBase(s: string): string {
  return normTexto(s)
    .replace(/\b\d+\b/g, ' ')          // "Seguridad 1" / "Seguridad 2"
    .split(' ').filter(Boolean).map(singular).join(' ');
}

// Cómo los nombra la planilla → cómo se llama el rubro en el sistema. Sólo los
// que no se resuelven por nombre parecido.
const ALIAS_RAW: [string, string][] = [
  ['Seguridad', 'Seguridad privada'],
  ['Efectos especiales', 'FX'],
  ['Agua', 'Dispenser con bidones'],
  ['Agua + dispenser', 'Dispenser con bidones'],
  ['Electrico', 'Distribución de energía'],
  ['Conectividad', 'Conectividad distribución'],
  ['Limpieza', 'Limpieza en evento'],
  ['Limpieza evento', 'Limpieza en evento'],
  ['Limpieza post-evento', 'Limpieza pre y post'],
  ['Streaming', 'Transmisión/Streaming'],
  ['CCTV y streaming', 'CCTV'],
  ['Baño VIP', 'Baños VIP'],
  ['Baño químico VIP', 'Baños VIP'],
  ['Contenedores y baño químicos', 'Baños químicos'],
  ['Baños químicos y latas', 'Baños químicos'],
  ['Contenedores/latas', 'Contenedor Oficina'],
  ['Logística/transporte', 'Camiones/Logística'],
  ['Barras + tablones foodtruck', 'Barras'],
  ['Cobertura audiovisual', 'Equipo Audiovisual'],
  ['Generadores', 'Generador'],
];
const ALIAS = new Map(ALIAS_RAW.map(([a, b]) => [canonBase(a), canonBase(b)]));

export function canonServicio(s: string): string {
  const base = canonBase(s);
  return ALIAS.get(base) ?? base;
}

/**
 * Busca el rubro del sistema para un nombre de la planilla: igual (tras canonizar),
 * o el rubro de nombre más largo contenido en el texto ("Seguridad privada Squad").
 */
export function matchRubro<T extends { id: number; nombre: string }>(nombres: (string | null)[], rubros: T[]): T | null {
  const canonRubros = rubros.map(r => ({ r, c: canonServicio(r.nombre) }));
  for (const n of nombres) {
    if (!n) continue;
    const c = canonServicio(n);
    const exacto = canonRubros.find(x => x.c === c);
    if (exacto) return exacto.r;
  }
  for (const n of nombres) {
    if (!n) continue;
    const c = ` ${canonServicio(n)} `;
    const contenidos = canonRubros.filter(x => x.c.length >= 3 && c.includes(` ${x.c} `)).sort((a, b) => b.c.length - a.c.length);
    if (contenidos[0]) return contenidos[0].r;
  }
  // Errores de tipeo ("Handieman" / "Handyeman"): hasta 2 letras de diferencia en
  // nombres largos, y sólo si hay un único rubro así de cerca.
  for (const n of nombres) {
    if (!n) continue;
    const c = canonServicio(n);
    if (c.length < 7) continue;
    const cerca = canonRubros.filter(x => Math.abs(x.c.length - c.length) <= 2 && distancia(x.c, c) <= 2);
    if (cerca.length === 1) return cerca[0].r;
  }
  return null;
}

/** Distancia de edición (Levenshtein). */
function distancia(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

// ── Armado de bloques ─────────────────────────────────────────────────────────

const ORDEN_ESTADO: EstadoRubroEvento[] = ['CONFIRMADO', 'COTIZANDO', 'PENDIENTE', 'CANCELADO', 'NO_VA'];
export const mejorEstado = (a: EstadoRubroEvento, b: EstadoRubroEvento) =>
  ORDEN_ESTADO.indexOf(a) <= ORDEN_ESTADO.indexOf(b) ? a : b;

function bloqueVacio(clave: string, servicio: string): BloquePedido {
  return {
    clave, servicio, hojas: [], estado: 'PENDIENTE', estado_excel: null, proveedor_excel: null,
    contacto_nombre: null, contacto_telefono: null, contacto_cargo: null, coordina: null,
    presupuesto: null, fecha_ingreso: null, fecha_retiro: null, notas: [], items: [], turnos: [], advertencias: [],
  };
}

const primero = (kv: Map<string, string>, prefijos: string[]) => {
  for (const p of prefijos) for (const [k, v] of kv) if (k.startsWith(p)) return v;
  return null;
};

export async function parsePedidosMaterial(buffer: Buffer, fechaEvento: Date | null): Promise<PedidosParseados> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as any);

  let hojaResumen: ExcelJS.Worksheet | null = null;
  let resumen: FilaResumen[] = [];
  for (const ws of wb.worksheets) {
    const enc = buscarResumen(ws);
    if (enc) { hojaResumen = ws; resumen = leerResumen(ws, enc.headerRow, enc.tablas); break; }
  }

  const hojas: HojaPedido[] = [];
  const hojas_omitidas: { hoja: string; motivo: string }[] = [];
  for (const ws of wb.worksheets) {
    if (ws === hojaResumen) continue;
    const h = parseHojaPedido(ws);
    if (h) hojas.push(h);
    else hojas_omitidas.push({ hoja: ws.name, motivo: 'No es una hoja de pedido ni una grilla de turnos' });
  }
  if (!hojaResumen && hojas.length === 0) {
    throw new Error('El archivo no tiene la hoja de proveedores confirmados ni hojas de "PEDIDO DE MATERIAL" / "FICHA DE PROVEEDOR"');
  }

  // Datos del evento: de la hoja resumen (ficha de la Pelota) o del encabezado más repetido
  const kvResumen = new Map<string, string>();
  if (hojaResumen) {
    for (let r = 1; r <= Math.min(hojaResumen.rowCount, 15); r++) {
      for (const { text } of celdasFila(hojaResumen, r)) {
        const m = /^([^:]{2,30}):\s*(.+)$/s.exec(text);
        if (m) kvResumen.set(normClave(m[1]), m[2].trim());
      }
    }
  }
  const conteoEvento = new Map<string, { n: number; texto: string }>();
  for (const h of hojas) {
    const ev = h.kv.get('evento');
    if (!ev) continue;
    const k = normTexto(ev);
    conteoEvento.set(k, { n: (conteoEvento.get(k)?.n ?? 0) + 1, texto: ev });
  }
  const eventoMayoria = [...conteoEvento.values()].sort((a, b) => b.n - a.n)[0]?.texto ?? null;
  const evento_excel = kvResumen.get('evento') ?? eventoMayoria;
  const lugar_excel = kvResumen.get('lugar') ?? hojas.map(h => h.kv.get('ubicacion')).find(Boolean) ?? null;

  // Un bloque por fila del resumen
  const bloques: BloquePedido[] = [];
  const usadas = new Set<string>();
  for (const f of resumen) {
    let clave = canonServicio(f.servicio) || normTexto(f.servicio);
    let i = 2;
    while (usadas.has(clave)) clave = `${canonServicio(f.servicio)} ${i++}`;
    usadas.add(clave);

    const b = bloqueVacio(clave, f.servicio);
    b.estado_excel = f.confirmado;
    b.proveedor_excel = proveedorReal(f.proveedor);
    // Sin columna de estado (Control Rubros): el proveedor dice "NO VA" / "VER"
    b.estado = estadoDesdeTexto(f.confirmado) ?? estadoDesdeTexto(f.proveedor) ?? (b.proveedor_excel ? 'CONFIRMADO' : 'PENDIENTE');
    if (b.estado === 'NO_VA' && !f.confirmado) b.proveedor_excel = null;
    if (f.ingreso instanceof Date) b.fecha_ingreso = parseFechaTexto(f.ingreso, fechaEvento);
    else if (!esVacio(f.ingreso) && String(f.ingreso).trim() !== '-') {
      b.fecha_ingreso = parseFechaTexto(f.ingreso, fechaEvento);
      if (!/^\s*\d{1,2}\/\d{1,2}\s*$/.test(String(f.ingreso))) b.notas.push(`Ingreso: ${String(f.ingreso).trim()}`);
    }
    const contacto = parseContacto(f.contacto);
    b.contacto_nombre = f.referente ?? contacto.nombre;
    b.contacto_telefono = contacto.telefono;
    b.coordina = f.coordina;
    const pres = aNumero(f.presupuesto);
    if (pres !== null && pres > 0) b.presupuesto = pres;
    else if (!esVacio(f.presupuesto) && String(f.presupuesto).trim() !== '-') b.notas.push(`Presupuesto: ${String(f.presupuesto).trim()}`);
    if (f.observaciones && f.observaciones !== '-') b.notas.push(f.observaciones);
    if (f.proveedor && !b.proveedor_excel && !['pendiente', 'no va', 'ver', 'a definir'].includes(normTexto(f.proveedor))) b.notas.push(`Proveedor: ${f.proveedor}`);
    bloques.push(b);
  }

  // Cada hoja de pedido se engancha a su fila del resumen: por nombre del servicio,
  // si no por proveedor (BASANI → "Baños Quimicos"); si no, es un bloque nuevo.
  for (const h of hojas) {
    const nombres = [h.titulo, h.hoja];
    const canons = nombres.filter(Boolean).map(n => canonServicio(n!));
    let b = bloques.find(x => canons.includes(canonServicio(x.servicio)));
    if (!b) {
      const contenido = bloques.find(x => {
        const c = canonServicio(x.servicio);
        return c.length >= 3 && canons.some(cn => ` ${cn} `.includes(` ${c} `));
      });
      b = contenido;
    }
    const empresa = proveedorReal(primero(h.kv, ['empresa', 'proveedor']));
    if (!b && empresa) {
      const porProveedor = bloques.filter(x => x.proveedor_excel && normTexto(x.proveedor_excel) === normTexto(empresa));
      if (porProveedor.length === 1) b = porProveedor[0];
    }
    if (!b) {
      const servicio = h.titulo ?? h.hoja;
      let clave = canonServicio(servicio) || normTexto(h.hoja);
      let i = 2;
      while (usadas.has(clave)) clave = `${canonServicio(servicio)} ${i++}`;
      usadas.add(clave);
      b = bloqueVacio(clave, servicio);
      b.proveedor_excel = empresa;
      b.estado = empresa ? 'CONFIRMADO' : 'PENDIENTE';
      bloques.push(b);
    }

    b.hojas.push(h.hoja);
    b.items.push(...h.items);
    b.turnos.push(...h.turnos);
    b.advertencias.push(...h.advertencias.map(a => `${h.hoja}: ${a}`));
    if (!b.proveedor_excel && empresa) b.proveedor_excel = empresa;
    else if (empresa && b.proveedor_excel && normTexto(empresa) !== normTexto(b.proveedor_excel)) {
      b.notas.push(`Empresa en la hoja ${h.hoja}: ${empresa}`);
    }

    const ingresoTxt = primero(h.kv, ['fechadeentrega', 'fechademontaje', 'fechaingreso', 'fechamontaje', 'fechadeingreso']);
    const retiroTxt  = primero(h.kv, ['fechadedesarme', 'fechaderetiro', 'fecharetiro', 'fechadesarme']);
    const ingreso = parseFechaTexto(ingresoTxt, fechaEvento);
    const retiro  = parseFechaTexto(retiroTxt, fechaEvento);
    if (ingreso && !b.fecha_ingreso) b.fecha_ingreso = ingreso;
    if (retiro && !b.fecha_retiro) b.fecha_retiro = retiro;
    // Lo que trae más que una fecha ("14/11 - 09.00hs", "POS EVENTO") queda en notas
    if (ingresoTxt && !/^\s*\d{1,2}\/\d{1,2}\s*$/.test(ingresoTxt)) b.notas.push(`Ingreso: ${ingresoTxt}`);
    if (retiroTxt && !/^\s*\d{1,2}\/\d{1,2}\s*$/.test(retiroTxt)) b.notas.push(`Retiro: ${retiroTxt}`);
    const pruebas = primero(h.kv, ['fechapruebas', 'fechadepruebas']);
    if (pruebas) b.notas.push(`Pruebas: ${pruebas}`);

    // Ejecutivo de cuenta (puede haber uno por empresa: "Ejecutivo de cuenta Squad: ...")
    h.ejecutivos.forEach((e, idx) => {
      const ej = parseEjecutivo(e);
      if (idx === 0 && ej.nombre) {
        // El ejecutivo de la hoja es más preciso que el referente del resumen
        // (Basani: referente "Cobranzas", ejecutivo Juan Pigino)
        if (b!.contacto_nombre && normTexto(b!.contacto_nombre) !== normTexto(ej.nombre)) {
          b!.notas.push(`Referente: ${[b!.contacto_nombre, b!.contacto_telefono].filter(Boolean).join(' — ')}`);
          b!.contacto_telefono = null;
        }
        b!.contacto_nombre = ej.nombre;
        b!.contacto_telefono = ej.telefono ?? b!.contacto_telefono;
        b!.contacto_cargo = ej.cargo;
      } else if (ej.nombre || ej.telefono) {
        b!.notas.push(`Otro contacto: ${[ej.nombre, ej.telefono].filter(Boolean).join(' — ')}`);
      }
    });

    // Hoja copiada de otro evento (CCTV dice "QLK FEST" en el Festival KM)
    const ev = h.kv.get('evento');
    if (ev && evento_excel && normTexto(ev) !== normTexto(evento_excel)) {
      b.advertencias.push(`La hoja ${h.hoja} dice "Evento: ${ev}" — puede ser una hoja copiada de otro evento`);
    }
  }

  for (const b of bloques) b.notas = [...new Set(b.notas)];

  return {
    formato: hojaResumen && /ficha/i.test(hojaResumen.name) ? 'FICHA_EVENTO' : 'PEDIDOS_MATERIAL',
    hoja_resumen: hojaResumen?.name ?? null,
    evento_excel, lugar_excel, bloques, hojas_omitidas,
  };
}
