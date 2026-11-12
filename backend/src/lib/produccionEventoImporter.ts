import ExcelJS from 'exceljs';
import {
  celdasFila, masterRaw, esVacio, horaTexto, aNumero, normTexto, parseFechaTexto,
} from './pedidosMaterialImporter';

// Parser de las hojas de producción de la planilla de Dani
// (docs/enjoy/dani/Planilla Produccion Expo Village.xlsx). Cada lista se
// reconoce por sus encabezados, no por el nombre de la hoja:
//
//   Cronograma de Montaje: Fecha | (día) | Hora | Actividad | Proveedor | Responsable | Observaciones
//   Operativo:             N° | ESPACIOS | ACTIVIDAD/FUNCION | LLEVA | ESTADO | RESPONSABLE | OBSERVACIONES
//   Puntos de internet:    N° | Zona | Uso | Tipo de conexion | Observaciones
//   Branding Enjoy:        N° | Tipo | Marca | Cantidad | Ubicacion | ESTADO | OBSERVACIONES
//   Compras Letape:        N° | Fecha | Pedido | Cantidad | Valor | Proveedor | Forma de pago | Solicita | Autoriza | Observaciones
//
// Fecha (cronograma) y Espacio (operativo) vienen combinadas por grupo: se lee
// el master y se arrastra hacia abajo.

export interface FilaCronograma { fila_excel: number; fecha: string; hora: string | null; actividad: string; proveedor: string | null; responsable: string | null; observaciones: string | null }
export interface FilaEspacioItem { fila_excel: number; elemento: string; estado: string | null; responsable: string | null; observaciones: string | null }
export interface FilaEspacio { fila_excel: number; numero: number | null; nombre: string; actividad: string | null; observaciones: string | null; items: FilaEspacioItem[] }
export interface FilaInternet { fila_excel: number; numero: number | null; zona: string; uso: string | null; tipo_conexion: string | null; observaciones: string | null }
export interface FilaBranding { fila_excel: number; tipo: string; marca: string | null; cantidad: number | null; ubicacion: string | null; estado: string | null; observaciones: string | null }
export interface FilaCompra {
  fila_excel: number; numero: number | null; fecha: string | null; pedido: string; cantidad: number | null; valor: number | null;
  proveedor: string | null; forma_pago: string | null; solicita: string | null; autoriza: string | null; observaciones: string | null; cancelada: boolean;
}

export interface ProduccionParseada {
  cronograma: { hoja: string; filas: FilaCronograma[] } | null;
  espacios:   { hoja: string; filas: FilaEspacio[] } | null;
  internet:   { hoja: string; filas: FilaInternet[] } | null;
  branding:   { hoja: string; filas: FilaBranding[] } | null;
  compras:    { hoja: string; filas: FilaCompra[]; total_planilla: number | null } | null;
  hojas_omitidas: string[];
}

const k = (s: string) => normTexto(s).replace(/ /g, '');

/** Fila de encabezado: mapa clave normalizada → columna (primera aparición). */
function buscarEncabezado(ws: ExcelJS.Worksheet, requeridas: string[][]): { fila: number; cols: Map<string, number> } | null {
  for (let r = 1; r <= Math.min(ws.rowCount, 15); r++) {
    const cols = new Map<string, number>();
    for (const { c, text } of celdasFila(ws, r)) { const key = k(text); if (key && !cols.has(key)) cols.set(key, c); }
    if (requeridas.every(alternativas => alternativas.some(a => cols.has(a)))) return { fila: r, cols };
  }
  return null;
}

const colDe = (cols: Map<string, number>, ...claves: string[]) => {
  for (const c of claves) if (cols.has(c)) return cols.get(c);
  for (const [key, c] of cols) if (claves.some(x => key.startsWith(x))) return c;
  return undefined;
};

function texto(ws: ExcelJS.Worksheet, r: number, c?: number): string | null {
  if (!c) return null;
  const v = masterRaw(ws, r, c);
  if (esVacio(v)) return null;
  const t = v instanceof Date ? horaTexto(v) : String(v).trim();
  return t && t !== '-' ? t : null;
}

function numero(ws: ExcelJS.Worksheet, r: number, c?: number): number | null {
  if (!c) return null;
  const n = aNumero(masterRaw(ws, r, c));
  return n !== null && Number.isFinite(n) ? n : null;
}

/** "08:00hs", 0.333 (fracción de día) o Date 1899 → "HH:mm"; otro texto queda como está. */
function hora(ws: ExcelJS.Worksheet, r: number, c?: number): string | null {
  if (!c) return null;
  const v = masterRaw(ws, r, c);
  if (esVacio(v)) return null;
  if (v instanceof Date || typeof v === 'number') return horaTexto(v);
  const m = /^(\d{1,2})[:.](\d{2})/.exec(String(v).trim());
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : String(v).trim();
}

function parseCronograma(ws: ExcelJS.Worksheet, ref: Date | null): FilaCronograma[] | null {
  const enc = buscarEncabezado(ws, [['fecha'], ['hora'], ['actividad']]);
  if (!enc) return null;
  const { cols } = enc;
  const cFecha = cols.get('fecha'); const cHora = cols.get('hora'); const cAct = cols.get('actividad');
  const cProv = colDe(cols, 'proveedor'); const cResp = colDe(cols, 'responsable'); const cObs = colDe(cols, 'observacion');
  const out: FilaCronograma[] = [];
  let fecha: string | null = null;
  for (let r = enc.fila + 1; r <= ws.rowCount; r++) {
    const f = masterRaw(ws, r, cFecha!);
    if (!esVacio(f)) fecha = parseFechaTexto(f, ref) ?? fecha;
    const actividad = texto(ws, r, cAct);
    if (!actividad || !fecha) continue;
    out.push({
      fila_excel: r, fecha, hora: hora(ws, r, cHora), actividad,
      proveedor: texto(ws, r, cProv), responsable: texto(ws, r, cResp), observaciones: texto(ws, r, cObs),
    });
  }
  return out;
}

function parseEspacios(ws: ExcelJS.Worksheet): FilaEspacio[] | null {
  const enc = buscarEncabezado(ws, [['espacios', 'espacio'], ['lleva']]);
  if (!enc) return null;
  const { cols } = enc;
  const cN = colDe(cols, 'n', 'no'); const cEsp = colDe(cols, 'espacios', 'espacio');
  const cAct = colDe(cols, 'actividad'); const cLleva = cols.get('lleva');
  const cEstado = colDe(cols, 'estado'); const cResp = colDe(cols, 'responsable'); const cObs = colDe(cols, 'observacion');
  const out: FilaEspacio[] = [];
  let actual: FilaEspacio | null = null;
  for (let r = enc.fila + 1; r <= ws.rowCount; r++) {
    const nombre = texto(ws, r, cEsp);
    if (nombre) {
      actual = { fila_excel: r, numero: numero(ws, r, cN), nombre, actividad: texto(ws, r, cAct), observaciones: null, items: [] };
      out.push(actual);
    }
    if (!actual) continue;
    const elemento = texto(ws, r, cLleva);
    const obs = texto(ws, r, cObs);
    if (!elemento) {
      // Espacio sin "lleva" (LOBBY ALA DERECHA | Baños | ... | Limpieza): la observación es del espacio
      if (obs && nombre) actual.observaciones = obs;
      continue;
    }
    actual.items.push({ fila_excel: r, elemento, estado: texto(ws, r, cEstado), responsable: texto(ws, r, cResp), observaciones: obs });
  }
  return out;
}

function parseInternet(ws: ExcelJS.Worksheet): FilaInternet[] | null {
  const enc = buscarEncabezado(ws, [['zona'], ['tipodeconexion', 'uso']]);
  if (!enc) return null;
  const { cols } = enc;
  const cN = colDe(cols, 'n', 'no'); const cZona = cols.get('zona'); const cUso = cols.get('uso');
  const cTipo = colDe(cols, 'tipodeconexion', 'tipo'); const cObs = colDe(cols, 'observacion');
  const out: FilaInternet[] = [];
  for (let r = enc.fila + 1; r <= ws.rowCount; r++) {
    const zona = texto(ws, r, cZona);
    if (!zona) continue;
    out.push({ fila_excel: r, numero: numero(ws, r, cN), zona, uso: texto(ws, r, cUso), tipo_conexion: texto(ws, r, cTipo), observaciones: texto(ws, r, cObs) });
  }
  return out;
}

function parseBranding(ws: ExcelJS.Worksheet): FilaBranding[] | null {
  const enc = buscarEncabezado(ws, [['tipo'], ['marca']]);
  if (!enc) return null;
  const { cols } = enc;
  const cTipo = cols.get('tipo'); const cMarca = cols.get('marca'); const cCant = colDe(cols, 'cantidad');
  const cUbic = colDe(cols, 'ubicacion'); const cEstado = colDe(cols, 'estado'); const cObs = colDe(cols, 'observacion');
  const out: FilaBranding[] = [];
  for (let r = enc.fila + 1; r <= ws.rowCount; r++) {
    const tipo = texto(ws, r, cTipo);
    if (!tipo) continue;
    out.push({
      fila_excel: r, tipo, marca: texto(ws, r, cMarca), cantidad: numero(ws, r, cCant),
      ubicacion: texto(ws, r, cUbic), estado: texto(ws, r, cEstado), observaciones: texto(ws, r, cObs),
    });
  }
  return out;
}

function parseCompras(ws: ExcelJS.Worksheet, ref: Date | null): { filas: FilaCompra[]; total_planilla: number | null } | null {
  const enc = buscarEncabezado(ws, [['pedido'], ['valor'], ['solicita', 'formadepago']]);
  if (!enc) return null;
  const { cols } = enc;
  const cN = colDe(cols, 'n', 'no'); const cFecha = cols.get('fecha'); const cPedido = cols.get('pedido');
  const cCant = colDe(cols, 'cantidad'); const cValor = cols.get('valor'); const cProv = colDe(cols, 'proveedor');
  const cForma = colDe(cols, 'formadepago'); const cSol = colDe(cols, 'solicita'); const cAut = colDe(cols, 'autoriza');
  const cObs = colDe(cols, 'observacion');
  const filas: FilaCompra[] = [];
  let total_planilla: number | null = null;
  for (let r = enc.fila + 1; r <= ws.rowCount; r++) {
    const pedido = texto(ws, r, cPedido);
    if (!pedido) {
      // Fila del total al pie: sólo el valor, sin pedido
      const v = numero(ws, r, cValor);
      if (v !== null) total_planilla = v;
      continue;
    }
    const valorRaw = masterRaw(ws, r, cValor!);
    const valor = aNumero(valorRaw);
    const notas = [texto(ws, r, cObs)];
    if (valor === null && !esVacio(valorRaw)) notas.unshift(`Valor: ${String(valorRaw).trim()}`);
    const proveedor = texto(ws, r, cProv);
    const obs = notas.filter(Boolean).join(' · ') || null;
    const fechaRaw = cFecha ? masterRaw(ws, r, cFecha) : null;
    filas.push({
      fila_excel: r, numero: numero(ws, r, cN), fecha: esVacio(fechaRaw) ? null : parseFechaTexto(fechaRaw, ref),
      pedido, cantidad: numero(ws, r, cCant), valor,
      proveedor: proveedor && normTexto(proveedor) !== 'pendiente' ? proveedor : null,
      forma_pago: texto(ws, r, cForma), solicita: texto(ws, r, cSol), autoriza: texto(ws, r, cAut),
      observaciones: obs, cancelada: /cancelad/i.test(obs ?? ''),
    });
  }
  return { filas, total_planilla };
}

export async function parseProduccionEvento(buffer: Buffer, fechaEvento: Date | null): Promise<ProduccionParseada> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as any);
  const out: ProduccionParseada = { cronograma: null, espacios: null, internet: null, branding: null, compras: null, hojas_omitidas: [] };
  for (const ws of wb.worksheets) {
    // El orden importa: una hoja de compras también tiene "Fecha", y una de branding "Tipo".
    const compras = !out.compras ? parseCompras(ws, fechaEvento) : null;
    if (compras && compras.filas.length) { out.compras = { hoja: ws.name, ...compras }; continue; }
    const crono = !out.cronograma ? parseCronograma(ws, fechaEvento) : null;
    if (crono && crono.length) { out.cronograma = { hoja: ws.name, filas: crono }; continue; }
    const esp = !out.espacios ? parseEspacios(ws) : null;
    if (esp && esp.length) { out.espacios = { hoja: ws.name, filas: esp }; continue; }
    const net = !out.internet ? parseInternet(ws) : null;
    if (net && net.length) { out.internet = { hoja: ws.name, filas: net }; continue; }
    const br = !out.branding ? parseBranding(ws) : null;
    if (br && br.length) { out.branding = { hoja: ws.name, filas: br }; continue; }
    out.hojas_omitidas.push(ws.name);
  }
  if (!out.cronograma && !out.espacios && !out.internet && !out.branding && !out.compras) {
    throw new Error('El archivo no tiene ninguna hoja de producción (cronograma, espacios, puntos de internet, branding o compras)');
  }
  return out;
}
