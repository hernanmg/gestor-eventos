import * as XLSX from 'xlsx';

// ── Parseo de las respuestas del Google Form de proveedores/jornaleros (Enjoy) ──
// Hoja "Respuestas de formulario 1", encabezado en la fila 1, columnas por posición:
//   A timestamp | B nombre y apellido | C DNI | D fecha nac. | E celular | F mail |
//   G dirección | H CUIT/CUIL | I banco | J alias | K CBU | L contacto de emergencia |
//   M ¿podés presentar factura? | N cuenta | O titular | P servicio
// (La col. Q "Columna 1" repite los datos bancarios como texto libre: se ignora.)
// SERVICIO = "jornalero" → Empleado; cualquier otro valor (o vacío) → Proveedor.

export type DestinoFormulario = 'EMPLEADO' | 'PROVEEDOR';

export interface FilaFormulario {
  fila_excel:          number;
  // Timestamp del formulario en ms. Una celda ilegible hereda el de la fila anterior
  // (el form agrega respuestas en orden cronológico).
  recencia:            number;
  destino:             DestinoFormulario;
  nombre:              string;
  dni:                 string | null;
  cuit:                string | null;  // sólo dígitos, exactamente 11
  cuit_original:       string | null;  // lo que se escribió en el form si no era un CUIT válido
  fecha_nacimiento:    Date | null;
  telefono:            string | null;
  email:               string | null;
  direccion:           string | null;
  banco:               string | null;
  alias:               string | null;
  cbu:                 string | null;
  numero_cuenta:       string | null;
  titular_cuenta:      string | null;
  servicio:            string | null;
  contacto_emergencia: string | null;
  puede_facturar:      boolean | null;
  tipo_factura:        'A' | 'C' | null;
  // "Tipo A o Tipo C dependiendo del evento": puede facturar pero no hay un único tipo.
  factura_ambigua:     boolean;
}

export interface ErrorFilaFormulario {
  fila:   number;
  motivo: string;
}

const COL = {
  timestamp: 0, nombre: 1, dni: 2, fechaNac: 3, celular: 4, mail: 5, direccion: 6,
  cuit: 7, banco: 8, alias: 9, cbu: 10, emergencia: 11, factura: 12, cuenta: 13,
  titular: 14, servicio: 15,
} as const;

const MAX_SERVICIO = 80;

const txt = (v: unknown): string | null => String(v ?? '').replace(/\s+/g, ' ').trim() || null;
const digitos = (v: unknown): string => String(v ?? '').replace(/\D/g, '');

function normHeader(s: unknown): string {
  return String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
}

// Serial de Excel → ms epoch. Texto → null (el form real los trae numéricos).
function parseTimestamp(v: unknown): number | null {
  if (v instanceof Date && !isNaN(v.getTime())) return v.getTime();
  if (typeof v === 'number' && v > 0) return Math.round((v - 25569) * 86400000);
  return null;
}

// Fecha de nacimiento: serial de Excel o texto "dd/mm/yyyy". Se guarda como día
// calendario a medianoche UTC (ver fecha_offset_utc_fix en la memoria del proyecto).
// El form trae basura como "1/1/0001": se descarta todo año fuera de 1900..hoy.
export function parseFechaNacimiento(v: unknown): Date | null {
  let d: Date | null = null;
  if (v instanceof Date && !isNaN(v.getTime())) {
    d = new Date(Date.UTC(v.getFullYear(), v.getMonth(), v.getDate()));
  } else if (typeof v === 'number' && v > 0) {
    d = new Date(Math.round((v - 25569) * 86400000));
  } else {
    const m = String(v ?? '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) {
      const x = new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])));
      if (x.getUTCDate() === Number(m[1])) d = x;
    }
  }
  if (!d || isNaN(d.getTime())) return null;
  const anio = d.getUTCFullYear();
  return anio >= 1900 && anio <= new Date().getFullYear() ? d : null;
}

// "No, no puedo." → false. "Si, Tipo C" → true + C. "Tipo A o Tipo C dependiendo
// del evento." → true, sin tipo único. Vacío → null (no respondió).
export function parseFacturacion(raw: string | null): { puede: boolean | null; tipo: 'A' | 'C' | null; ambigua: boolean } {
  if (!raw) return { puede: null, tipo: null, ambigua: false };
  if (/^no\b/i.test(normHeader(raw))) return { puede: false, tipo: null, ambigua: false };
  const tipos = new Set([...raw.matchAll(/\btipo\s*([AC])\b/gi)].map(m => m[1].toUpperCase()));
  if (tipos.size === 1) return { puede: true, tipo: [...tipos][0] as 'A' | 'C', ambigua: false };
  return { puede: true, tipo: null, ambigua: tipos.size > 1 };
}

const NOMBRES_BASURA = new Set(['yo', 'no', 'na', 'n/a', 'ninguno', 'ninguna']);

// Texto libre ("Mía Bedogni (hija) 3512223731", "+54 9 3513 42-6192", "PROPIETARIA")
// → nombre + teléfono. El teléfono es la primera secuencia de ≥7 dígitos; el resto es el nombre.
export function parseContactoEmergencia(raw: string | null): { nombre: string | null; tel: string | null } {
  if (!raw) return { nombre: null, tel: null };
  const m = raw.match(/\+?\d[\d\s().-]{6,}\d/);
  const tel = m && digitos(m[0]).length >= 7 ? m[0].replace(/\s+/g, ' ').trim() : null;

  const resto = (tel ? raw.replace(m![0], ' ') : raw)
    .replace(/\b(cel(ular)?|tel(éfono|efono)?|whatsapp)\b(\s+de)?\.?:?/gi, ' ')
    .replace(/\(\s+/g, '(').replace(/\s+\)/g, ')')
    .replace(/\s+/g, ' ')
    .replace(/^[\s\-–—:/,.|]+|[\s\-–—:/,.|]+$/g, '');
  const nombre = resto.length >= 2 && !NOMBRES_BASURA.has(resto.toLowerCase()) ? resto : null;
  return { nombre, tel };
}

export function dividirNombre(nombreApellido: string): { nombre: string; apellido: string } | null {
  const [nombre, ...resto] = nombreApellido.split(' ');
  return resto.length ? { nombre, apellido: resto.join(' ') } : null;
}

export interface ResultadoParseoFormulario {
  filas:       FilaFormulario[];
  errores:     ErrorFilaFormulario[];
  total_filas: number; // filas con datos (las vacías del final del Sheet no cuentan)
}

export function parseFormularioProveedores(buffer: Buffer): ResultadoParseoFormulario {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const nombreHoja = wb.SheetNames.find(n => normHeader(n).startsWith('respuestas')) ?? wb.SheetNames[0];
  if (!nombreHoja) throw new Error('El archivo no tiene hojas');

  const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[nombreHoja], { header: 1, defval: '', raw: true });
  const header = rows[0] ?? [];
  if (!normHeader(header[COL.nombre]).startsWith('nombre') || !normHeader(header[COL.cuit]).includes('cuit')) {
    throw new Error(`La hoja "${nombreHoja}" no parece ser el formulario de proveedores (se esperaba "Nombre y Apellido" en la columna B y "CUIT/CUIL" en la H)`);
  }

  const filas: FilaFormulario[] = [];
  const errores: ErrorFilaFormulario[] = [];
  let total_filas = 0;
  let ultimaRecencia = 0;

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const fila = i + 1;

    // Filas vacías al final del Sheet, o con basura suelta sólo en la col. A/Q.
    if (r.slice(COL.nombre, COL.servicio + 1).every(c => String(c ?? '').trim() === '')) continue;
    total_filas++;

    const ts = parseTimestamp(r[COL.timestamp]);
    if (ts !== null) ultimaRecencia = ts;
    const err = (motivo: string) => errores.push({ fila, motivo });

    const nombre = txt(r[COL.nombre]);
    if (!nombre || nombre.length < 2) { err('Falta nombre y apellido'); continue; }

    const servicioRaw = txt(r[COL.servicio]);
    const destino: DestinoFormulario = servicioRaw && /jornalero/i.test(servicioRaw) ? 'EMPLEADO' : 'PROVEEDOR';

    const dniDigitos = digitos(r[COL.dni]);
    const dni = dniDigitos.length >= 6 ? dniDigitos : null;
    const cuitDigitos = digitos(r[COL.cuit]);
    const cuit = cuitDigitos.length === 11 ? cuitDigitos : null;
    const cuit_original = !cuit ? txt(r[COL.cuit]) : null;

    if (destino === 'EMPLEADO') {
      if (!dni && !cuit) { err('Jornalero sin DNI ni CUIT válido'); continue; }
      if (!dividirNombre(nombre)) { err(`No se pudo separar nombre y apellido de "${nombre}"`); continue; }
    } else if (!cuit && !dni) {
      err('Sin CUIT válido ni DNI: no hay forma de identificar al proveedor'); continue;
    }

    const fact = parseFacturacion(txt(r[COL.factura]));
    filas.push({
      fila_excel: fila,
      recencia:   ultimaRecencia,
      destino,
      nombre,
      dni, cuit, cuit_original,
      fecha_nacimiento: parseFechaNacimiento(r[COL.fechaNac]),
      telefono:         txt(r[COL.celular]),
      email:            txt(r[COL.mail]),
      direccion:        txt(r[COL.direccion]),
      banco:            txt(r[COL.banco]),
      alias:            txt(r[COL.alias]),
      // El CBU es siempre numérico; si vino con espacios o guiones se normaliza.
      cbu:              /^[\d\s-]+$/.test(String(r[COL.cbu] ?? '').trim()) ? digitos(r[COL.cbu]) || null : txt(r[COL.cbu]),
      numero_cuenta:    txt(r[COL.cuenta]),
      titular_cuenta:   txt(r[COL.titular]),
      // Una fila del form trae pegado el bloque de datos bancarios en SERVICIO: no es un servicio.
      servicio:         servicioRaw && servicioRaw.length <= MAX_SERVICIO && !/\n/.test(String(r[COL.servicio])) ? servicioRaw : null,
      contacto_emergencia: txt(r[COL.emergencia]),
      puede_facturar:   fact.puede,
      tipo_factura:     fact.tipo,
      factura_ambigua:  fact.ambigua,
    });
  }

  return { filas, errores, total_filas };
}

// ── Consolidación de duplicados dentro del archivo ────────────────────────────
// Misma persona/proveedor respondiendo dos veces. La clave es el CUIT para los
// proveedores (o el DNI si no tienen uno válido) y el DNI para los jornaleros (una
// misma persona puede cargar dos CUIT distintos, ej. con un dígito mal tipeado).

export function claveFila(f: FilaFormulario): string {
  if (f.destino === 'EMPLEADO') return f.dni ? `E|dni|${f.dni}` : `E|cuit|${f.cuit}`;
  return f.cuit ? `P|cuit|${f.cuit}` : `P|dni|${f.dni}`;
}

// La respuesta más reciente gana campo por campo; lo que quedó vacío en la nueva se
// completa con la anterior (ej. la 2ª respuesta de UNICO no repite el servicio).
function fusionar(vieja: FilaFormulario, nueva: FilaFormulario): FilaFormulario {
  const tipo_factura = nueva.tipo_factura ?? vieja.tipo_factura;
  return {
    ...nueva,
    dni:              nueva.dni              ?? vieja.dni,
    cuit:             nueva.cuit             ?? vieja.cuit,
    cuit_original:    nueva.cuit             ? null : (nueva.cuit_original ?? vieja.cuit_original),
    fecha_nacimiento: nueva.fecha_nacimiento ?? vieja.fecha_nacimiento,
    telefono:         nueva.telefono         ?? vieja.telefono,
    email:            nueva.email            ?? vieja.email,
    direccion:        nueva.direccion        ?? vieja.direccion,
    banco:            nueva.banco            ?? vieja.banco,
    alias:            nueva.alias            ?? vieja.alias,
    cbu:              nueva.cbu              ?? vieja.cbu,
    numero_cuenta:    nueva.numero_cuenta    ?? vieja.numero_cuenta,
    titular_cuenta:   nueva.titular_cuenta   ?? vieja.titular_cuenta,
    servicio:         nueva.servicio         ?? vieja.servicio,
    contacto_emergencia: nueva.contacto_emergencia ?? vieja.contacto_emergencia,
    puede_facturar:   nueva.puede_facturar   ?? vieja.puede_facturar,
    tipo_factura,
    factura_ambigua:  tipo_factura === null && (nueva.factura_ambigua || vieja.factura_ambigua),
  };
}

export function consolidarFilas(filas: FilaFormulario[]): { registros: FilaFormulario[]; duplicados: number } {
  const grupos = new Map<string, FilaFormulario[]>();
  for (const f of filas) {
    const k = claveFila(f);
    const g = grupos.get(k);
    if (g) g.push(f); else grupos.set(k, [f]);
  }
  const registros: FilaFormulario[] = [];
  let duplicados = 0;
  for (const g of grupos.values()) {
    g.sort((a, b) => a.recencia - b.recencia || a.fila_excel - b.fila_excel);
    duplicados += g.length - 1;
    registros.push(g.reduce(fusionar));
  }
  return { registros: registros.sort((a, b) => a.fila_excel - b.fila_excel), duplicados };
}
