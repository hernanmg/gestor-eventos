import ExcelJS from 'exceljs';

// Parser de la planilla de cortesías (docs/especificaciones/Cortesias-  Male.xlsx).
//
// Hoja de asignaciones ("Tickets Cortesia General"):
//   ITEM | Cliente | Persona Contacto | Observación | Autoriza | [RUTA LARGA: KIT ESTANDAR, KIT FULL, TOURMALET]
//        | [RUTA CORTA: KIT ESTANDAR, KIT FULL, TOURMALET] | TOTALES | VISADO | ENTREGADO
// Los tipos de ticket son las columnas entre "Autoriza" y "TOTALES": se detectan
// dinámicamente y su nombre es "<grupo de la fila de arriba> - <kit>".
//
// Ojo con las celdas combinadas: Persona Contacto y Observación (y TOTALES) vienen
// combinadas por grupo de filas. ExcelJS repite el valor del master en cada celda,
// lo que sirve para contacto/observación. "TOTALES" es un subtotal por grupo de
// contacto (no por fila): se IGNORA y se recalcula sumando las cantidades.
//
// Hoja de inscriptos (export de Njuko, suele estar oculta): Bib number, Last name,
// First name, ID Number, Email, Competition ("RUTA LARGA - KIT STANDARD"), …

export interface ItemParseado {
  tipo_ticket: string;
  cantidad:    number;
}

export interface CortesiaParseada {
  fila_excel:  number;
  item:        number | null; // "ITEM" del Excel
  cliente:     string;
  contacto:    string | null;
  observacion: string | null;
  autoriza:    string | null;
  items:       ItemParseado[];
  total:       number;
  visado:      boolean;
  entregado:   boolean;
}

export interface InscriptoNjuko {
  bib:         string | null;
  apellido:    string | null;
  nombre:      string | null;
  dni:         string | null;
  email:       string | null;
  competition: string | null; // "RUTA LARGA - KIT STANDARD"
  quien:       string | null; // "¿Quién lo pidió?" (mayormente "Compra")
}

export interface CortesiasParseadas {
  hoja:            string;
  evento_excel:    { evento: string | null; lugar: string | null; fecha: string | null };
  cortesias:       CortesiaParseada[];
  omitidas:        { fila_excel: number; motivo: string }[];
  hoja_inscriptos: string | null;
  inscriptos:      InscriptoNjuko[];
}

// ── Normalización ─────────────────────────────────────────────────────────────

const sinAcentos = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Clave de columna/encabezado: sin acentos, minúsculas y sólo letras/números. */
export const normClave = (s: unknown): string => sinAcentos(String(s ?? '')).toLowerCase().replace(/[^a-z0-9]/g, '');

/** Clave de nombre de persona, insensible a acentos, mayúsculas y ORDEN de las palabras. */
export function claveNombre(s: string | null | undefined): string {
  return sinAcentos(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean).sort().join(' ');
}

/** Clave para comparar tipos de ticket entre la planilla ("KIT ESTANDAR") y Njuko ("KIT STANDARD"). */
export const claveTipoTicket = (s: string | null | undefined): string =>
  normClave(s).replace(/standard/g, 'estandar');

const titulo = (s: string) =>
  s.trim().toLowerCase().split(/\s+/).filter(Boolean)
    .map(w => (w === 'estandar' || w === 'standard' ? 'Estándar' : w.charAt(0).toUpperCase() + w.slice(1))).join(' ');

/** "RUTA LARGA " + " KIT ESTANDAR" → "Ruta Larga - Kit Estándar". */
export function nombreTipoTicket(grupo: string | null | undefined, kit: string): string {
  const g = (grupo ?? '').trim();
  const k = titulo(kit);
  return g ? `${titulo(g)} - ${k}` : k;
}

// ── Lectura de celdas ─────────────────────────────────────────────────────────

function cellRaw(v: ExcelJS.CellValue): unknown {
  if (v && typeof v === 'object' && !(v instanceof Date)) {
    const o = v as any;
    if (o.result !== undefined) return o.result;
    if (o.richText) return o.richText.map((t: any) => t.text).join('');
    if (o.text !== undefined) return o.text;
    return null;
  }
  return v;
}

const texto = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return null;
  const t = String(v).trim();
  return t === '' ? null : t;
};

const numero = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v.trim().replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

/** VISADO / ENTREGADO: tildes, "SI", "X", 1, true… */
function esMarca(v: unknown): boolean {
  if (v === true) return true;
  if (typeof v === 'number') return v > 0;
  if (typeof v === 'string') return /^(si|sí|x|ok|✓|✔|visado|entregado|true|1|yes)$/i.test(v.trim());
  return false;
}

// ── Hoja de asignaciones ──────────────────────────────────────────────────────

interface EncabezadoAsignaciones {
  fila:      number;
  colCliente: number;
  colItem?:   number;
  colContacto?: number;
  colObs?:    number;
  colAutoriza: number;
  colVisado?:  number;
  colEntregado?: number;
  tickets:   { col: number; tipo: string }[];
}

function detectarAsignaciones(ws: ExcelJS.Worksheet): EncabezadoAsignaciones | null {
  const limite = Math.min(ws.rowCount, 30);
  for (let r = 1; r <= limite; r++) {
    const row = ws.getRow(r);
    const map = new Map<string, number>();
    row.eachCell({ includeEmpty: false }, (cell, c) => { const k = normClave(cellRaw(cell.value)); if (k) map.set(k, c); });
    const colCliente = map.get('cliente');
    const colAutoriza = map.get('autoriza');
    if (!colCliente || !colAutoriza) continue;

    // Cliente/Autoriza suelen estar combinadas en vertical sobre dos filas de encabezado (grupo
    // Ruta Larga/Corta arriba, kits abajo): ExcelJS las repite en ambas. El encabezado real, el que
    // tiene los nombres de kit, es la última fila de esa pila.
    const repiteEncabezado = (fila: number) => {
      const claves = new Set<string>();
      ws.getRow(fila).eachCell({ includeEmpty: false }, cell => { claves.add(normClave(cellRaw(cell.value))); });
      return claves.has('cliente') && claves.has('autoriza');
    };
    if (r + 1 <= ws.rowCount && repiteEncabezado(r + 1)) continue;

    // TOTALES / VISADO / ENTREGADO pueden estar en esta fila o en la de arriba (combinadas en vertical)
    const arriba = new Map<string, number>();
    if (r > 1) ws.getRow(r - 1).eachCell({ includeEmpty: false }, (cell, c) => { const k = normClave(cellRaw(cell.value)); if (k) arriba.set(k, c); });
    const col = (k: string) => map.get(k) ?? arriba.get(k);
    const colTotales = col('totales') ?? col('total');
    const colVisado = col('visado');
    const colEntregado = col('entregado');
    const fin = Math.min(...[colTotales, colVisado, colEntregado].filter((c): c is number => !!c), ws.columnCount + 1);

    const tickets: { col: number; tipo: string }[] = [];
    for (let c = colAutoriza + 1; c < fin; c++) {
      const kit = texto(cellRaw(ws.getRow(r).getCell(c).value));
      if (!kit) continue;
      const grupo = r > 1 ? texto(cellRaw(ws.getRow(r - 1).getCell(c).value)) : null;
      tickets.push({ col: c, tipo: nombreTipoTicket(grupo, kit) });
    }
    if (tickets.length === 0) continue;

    return {
      fila: r, colCliente, colAutoriza, tickets, colVisado, colEntregado,
      colItem:     map.get('item'),
      colContacto: map.get('personacontacto') ?? map.get('contacto'),
      colObs:      [...map.entries()].find(([k]) => k.startsWith('observacion'))?.[1],
    };
  }
  return null;
}

function leerEventoExcel(ws: ExcelJS.Worksheet): CortesiasParseadas['evento_excel'] {
  const out = { evento: null as string | null, lugar: null as string | null, fecha: null as string | null };
  for (let r = 1; r <= 8; r++) {
    const row = ws.getRow(r);
    row.eachCell({ includeEmpty: false }, (cell, c) => {
      const k = normClave(cellRaw(cell.value));
      if (k !== 'evento' && k !== 'lugar' && k !== 'fecha') return;
      for (let n = c + 1; n <= c + 4; n++) {
        const t = texto(cellRaw(row.getCell(n).value));
        if (t) { out[k] = t; break; }
      }
    });
  }
  return out;
}

// ── Hoja de inscriptos (Njuko) ────────────────────────────────────────────────

function leerInscriptos(ws: ExcelJS.Worksheet): InscriptoNjuko[] | null {
  for (let r = 1; r <= Math.min(ws.rowCount, 5); r++) {
    const map = new Map<string, number>();
    ws.getRow(r).eachCell({ includeEmpty: false }, (cell, c) => { const k = normClave(cellRaw(cell.value)); if (k && !map.has(k)) map.set(k, c); });
    const bib = map.get('bibnumber');
    const apellido = map.get('lastname') ?? map.get('apellido');
    const nombre = map.get('firstname') ?? map.get('nombre');
    if (!bib || !apellido || !nombre) continue;

    const dni = map.get('idnumber') ?? map.get('dni');
    const email = map.get('email');
    const comp = map.get('competition');
    const quien = [...map.entries()].find(([k]) => k.startsWith('quienlopidio'))?.[1];

    const out: InscriptoNjuko[] = [];
    for (let i = r + 1; i <= ws.rowCount; i++) {
      const row = ws.getRow(i);
      const val = (c?: number) => (c ? texto(cellRaw(row.getCell(c).value)) : null);
      const ins: InscriptoNjuko = {
        bib: val(bib), apellido: val(apellido), nombre: val(nombre), dni: val(dni), email: val(email),
        competition: val(comp), quien: val(quien),
      };
      if (!ins.bib && !ins.apellido && !ins.nombre) continue;
      out.push(ins);
    }
    return out;
  }
  return null;
}

// ── Parser principal ──────────────────────────────────────────────────────────

/** Lanza Error si el archivo no tiene una hoja de asignaciones reconocible. */
export async function parseCortesias(buffer: Buffer): Promise<CortesiasParseadas> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as any);

  let ws: ExcelJS.Worksheet | null = null;
  let enc: EncabezadoAsignaciones | null = null;
  for (const w of wb.worksheets) {
    const e = detectarAsignaciones(w);
    if (e) { ws = w; enc = e; break; }
  }
  if (!ws || !enc) {
    throw new Error('No se encontró la hoja de asignaciones (se esperan las columnas Cliente, Autoriza y los tipos de ticket)');
  }

  const cortesias: CortesiaParseada[] = [];
  const omitidas: CortesiasParseadas['omitidas'] = [];

  for (let r = enc.fila + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const val = (c?: number) => (c ? cellRaw(row.getCell(c).value) : null);
    const cliente = texto(val(enc.colCliente));

    if (!cliente) {
      // Fila vacía o de totales (sin ITEM ni contacto, ej. =SUM(F11:F207)) → se ignora en silencio.
      // Con ITEM o contacto pero sin cliente es una asignación incompleta → se avisa.
      const hayDatos = enc.tickets.some(t => (numero(val(t.col)) ?? 0) > 0);
      const esAsignacion = numero(val(enc.colItem)) !== null || !!texto(val(enc.colContacto));
      if (hayDatos && esAsignacion) omitidas.push({ fila_excel: r, motivo: 'Sin cliente' });
      continue;
    }
    if (normClave(cliente).startsWith('total')) break;

    const items: ItemParseado[] = [];
    for (const t of enc.tickets) {
      const n = numero(val(t.col));
      if (n !== null && n > 0) items.push({ tipo_ticket: t.tipo, cantidad: Math.round(n) });
    }
    if (items.length === 0) { omitidas.push({ fila_excel: r, motivo: 'Sin tickets (cantidad 0)' }); continue; }

    cortesias.push({
      fila_excel:  r,
      item:        numero(val(enc.colItem)),
      cliente,
      contacto:    texto(val(enc.colContacto)),
      observacion: texto(val(enc.colObs)),
      autoriza:    texto(val(enc.colAutoriza)),
      items,
      total:       items.reduce((a, i) => a + i.cantidad, 0),
      visado:      esMarca(val(enc.colVisado)),
      entregado:   esMarca(val(enc.colEntregado)),
    });
  }

  let inscriptos: InscriptoNjuko[] = [];
  let hoja_inscriptos: string | null = null;
  for (const w of wb.worksheets) {
    if (w === ws) continue;
    const ins = leerInscriptos(w);
    if (ins) { inscriptos = ins; hoja_inscriptos = w.name; break; }
  }

  return { hoja: ws.name, evento_excel: leerEventoExcel(ws), cortesias, omitidas, hoja_inscriptos, inscriptos };
}

// ── Vinculación con inscriptos ────────────────────────────────────────────────
//
// La hoja de Njuko NO está relacionada con las cortesías por tipo de ticket: es el
// listado completo de inscriptos (miles, casi todos "Compra"), y un mismo tipo de
// kit tiene cientos de corredores. Vincular "por tipo" le asignaría a cada cortesía
// el DNI y el email de un corredor cualquiera. Por eso sólo se vincula cuando el
// NOMBRE de la cortesía coincide con un único inscripto (sin importar acentos,
// mayúsculas ni orden de apellido/nombre) Y su kit coincide con el tipo de ticket.
// Todo lo demás se informa como "sin vincular", con el motivo.

export type EstadoVinculo =
  | 'VINCULADO'
  | 'SIN_COINCIDENCIA'   // ningún inscripto con ese nombre
  | 'TIPO_DISTINTO'      // el inscripto existe pero con otro kit
  | 'AMBIGUO'            // varios inscriptos con ese nombre y ese kit
  | 'CANTIDAD_MAYOR_A_1' // un único inscripto no puede cubrir varios tickets
  | 'YA_ASIGNADO';       // el inscripto ya se vinculó a otra cortesía

export interface Vinculo {
  estado:    EstadoVinculo;
  inscripto?: InscriptoNjuko;
}

export function vincularInscriptos(cortesias: CortesiaParseada[], inscriptos: InscriptoNjuko[]): Map<CortesiaParseada, Vinculo> {
  const porNombre = new Map<string, InscriptoNjuko[]>();
  for (const i of inscriptos) {
    const k = claveNombre(`${i.apellido ?? ''} ${i.nombre ?? ''}`);
    if (!k) continue;
    if (!porNombre.has(k)) porNombre.set(k, []);
    porNombre.get(k)!.push(i);
  }

  const usados = new Set<InscriptoNjuko>();
  const out = new Map<CortesiaParseada, Vinculo>();

  for (const c of cortesias) {
    const candidatos = porNombre.get(claveNombre(c.cliente)) ?? [];
    if (candidatos.length === 0) { out.set(c, { estado: 'SIN_COINCIDENCIA' }); continue; }
    if (c.total !== 1) { out.set(c, { estado: 'CANTIDAD_MAYOR_A_1' }); continue; }

    const tipo = claveTipoTicket(c.items[0].tipo_ticket);
    const mismos = candidatos.filter(i => claveTipoTicket(i.competition) === tipo);
    if (mismos.length === 0) { out.set(c, { estado: 'TIPO_DISTINTO', inscripto: candidatos[0] }); continue; }
    if (mismos.length > 1) { out.set(c, { estado: 'AMBIGUO' }); continue; }
    if (usados.has(mismos[0])) { out.set(c, { estado: 'YA_ASIGNADO', inscripto: mismos[0] }); continue; }

    usados.add(mismos[0]);
    out.set(c, { estado: 'VINCULADO', inscripto: mismos[0] });
  }
  return out;
}
