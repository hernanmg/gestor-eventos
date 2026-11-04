import ExcelJS from 'exceljs';
import type { BloqueCostoReal } from '@prisma/client';
import { prisma } from './prisma';
import { withTenant } from './tenant';
import { limitesEvento, NOMBRE_CATEGORIA } from './fasesEvento';
import { calcularTotal, normalizarTexto, type LineaDraft } from './costoReal';

// Planillas de campo de Flor (DOS57) — las de docs/dos57/florencia/Planillas de
// Controles Varios en Giras.xlsx, que imprime y completa a mano en el evento
// porque no hay señal. El sistema las genera precargadas con lo que ya sabe
// (cuadrilla de cada día, vehículos, material de pañol, valores) y, una vez
// completas — en papel y pasadas al mismo Excel, o directo en la notebook sin
// conexión —, las importa al costo real del evento como líneas de origen CAMPO.
//
// Hojas: INSTRUCCIONES · HORAS dd-mm (una por día) · VIANDAS dd-mm (una por día)
// · ALOJAMIENTO · PAÑOL · COMBUSTIBLE. El importador las reconoce por el título
// de la celda A1, no por el nombre de la hoja.

const TITULO = {
  HORAS:       'CONTROL DE HORAS POR DÍA',
  VIANDAS:     'CONTROL DE VIANDAS POR DÍA',
  ALOJAMIENTO: 'CONTROL DE ALOJAMIENTO',
  PANOL:       'CONTROL DE PAÑOL',
  COMBUSTIBLE: 'CONTROL DE COMBUSTIBLE Y VIAJES',
} as const;

const RENGLONES_EXTRA = 8; // en blanco al final de cada lista, para lo que surja
const DIA = 86_400_000;
const r2 = (n: number) => Math.round(n * 100) / 100;
const ddmm = (d: Date) => `${String(d.getUTCDate()).padStart(2, '0')}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
const RE_CAMIONETA = /CAMIONETA|PICK ?UP|VAN|UTILITARIO|SPRINTER/i;

// ── Datos para precargar ──────────────────────────────────────────────────────

interface Persona { nombre: string; grupo: string }

export async function datosPlanillasCampo(eventoId: number, empresaId: number) {
  const evento = await prisma.evento.findFirst({
    where:  { id: eventoId, deleted_at: null, ...withTenant(empresaId) },
    select: { id: true, nombre: true, lugar: true, fecha_inicio: true, fecha_fin: true, dias_montaje: true, dias_desmontaje: true },
  });
  if (!evento) return null;
  const empleadoSel = { select: { id: true, nombre: true, apellido: true, categoria: true } } as const;
  const camionSel = { select: { id: true, descripcion: true, codigo: true, patente: true, tipo: true, tipo_vehiculo: true } } as const;
  const [jornadas, asignaciones, viajes, cargas, remitosPanol, salidasPanol, itemsPanol] = await Promise.all([
    prisma.jornada.findMany({ where: { evento_id: eventoId, deleted_at: null, estado: { not: 'RECHAZADA' }, ...withTenant(empresaId) }, select: { fecha: true, empleado: empleadoSel, camion: camionSel } }),
    prisma.asignacionDiaria.findMany({ where: { evento_id: eventoId, deleted_at: null, estado: 'ASIGNADO', ...withTenant(empresaId) }, select: { empleado: empleadoSel, parte_diario: { select: { fecha: true } }, camion: camionSel, vehiculo_texto: true } }),
    prisma.bitacoraViaje.findMany({ where: { evento_id: eventoId, deleted_at: null, ...withTenant(empresaId) }, select: { camion: camionSel, chofer_nombre: true, patente_camion: true } }),
    prisma.cargaCombustible.findMany({ where: { evento_id: eventoId, deleted_at: null, ...withTenant(empresaId) }, select: { camion: camionSel } }),
    prisma.remitoEvento.findMany({ where: { evento_id: eventoId, tipo: 'PANOL', ...withTenant(empresaId) }, select: { items: true, responsable_carga: true } }),
    prisma.movimientoPanol.findMany({ where: { evento_id: eventoId, tipo: 'SALIDA', ...withTenant(empresaId) }, select: { cantidad: true, responsable_nombre: true, panol_item: { select: { nombre: true } } } }),
    prisma.panolItem.findMany({ where: { deleted_at: null, ...withTenant(empresaId) }, select: { nombre: true, valor: true } }),
  ]);

  // Personas por día (jornadas + asignaciones del Parte diario)
  const nombre = (e: { nombre: string; apellido: string }) => `${e.apellido}, ${e.nombre}`.replace(/^, /, '');
  const todas = new Map<number, Persona>();
  const porDia = new Map<number, Map<number, Persona>>();
  const anotar = (e: { id: number; nombre: string; apellido: string; categoria: string }, f: Date) => {
    const p = { nombre: nombre(e), grupo: NOMBRE_CATEGORIA[e.categoria] ?? e.categoria };
    todas.set(e.id, p);
    const k = Math.floor(f.getTime() / DIA);
    if (!porDia.has(k)) porDia.set(k, new Map());
    porDia.get(k)!.set(e.id, p);
  };
  for (const j of jornadas) anotar(j.empleado, j.fecha);
  for (const a of asignaciones) anotar(a.empleado, a.parte_diario.fecha);

  // Días: del día anterior al montaje al posterior al desmontaje, más cualquier
  // día con gente asignada fuera de ese rango
  const l = limitesEvento(evento);
  const dias = new Set<number>(porDia.keys());
  if (l) for (let d = l.montaje - 1; d <= l.desmontaje + 1; d++) dias.add(d);
  const ordenar = (ps: Iterable<Persona>) => [...ps].sort((a, b) => a.grupo.localeCompare(b.grupo) || a.nombre.localeCompare(b.nombre));
  const listaDias = [...dias].sort((a, b) => a - b).map(d => ({
    fecha: new Date(d * DIA),
    // Día sin asignaciones cargadas: se imprime toda la cuadrilla para tildar
    personas: ordenar((porDia.get(d) ?? new Map(todas.entries())).values()),
  }));

  // Vehículos que ya figuran en el evento
  const vehiculos = new Map<string, { vehiculo: string; patente: string; tipo: string; chofer: string }>();
  const anotarCamion = (c: { descripcion: string | null; codigo: string; patente: string | null; tipo: string | null; tipo_vehiculo: string | null } | null, chofer = '') => {
    if (!c) return;
    const k = c.patente ?? c.codigo;
    if (vehiculos.has(k)) return;
    const tipo = RE_CAMIONETA.test(c.tipo_vehiculo ?? c.tipo ?? c.descripcion ?? '') ? 'CAMIONETA' : 'CAMIÓN';
    vehiculos.set(k, { vehiculo: c.descripcion ?? c.codigo, patente: c.patente ?? '', tipo, chofer });
  };
  for (const a of asignaciones) anotarCamion(a.camion);
  for (const j of jornadas) anotarCamion(j.camion);
  for (const v of viajes) anotarCamion(v.camion, v.chofer_nombre ?? '');
  for (const c of cargas) anotarCamion(c.camion);

  // Pañol: lo que sale al evento (remitos de pañol y salidas registradas), con su valor
  const valorPanol = new Map(itemsPanol.map(i => [normalizarTexto(i.nombre), i.valor == null ? null : Number(i.valor)]));
  const panol = new Map<string, { material: string; cantidad: number; quien: string; valor: number | null }>();
  const anotarPanol = (material: string, cantidad: number, quien: string | null) => {
    const k = normalizarTexto(material);
    const p = panol.get(k) ?? { material, cantidad: 0, quien: quien ?? '', valor: valorPanol.get(k) ?? null };
    p.cantidad += cantidad;
    panol.set(k, p);
  };
  for (const r of remitosPanol) for (const it of (r.items as { descripcion: string; cantidad: number }[]) ?? []) anotarPanol(it.descripcion, Number(it.cantidad), r.responsable_carga);
  for (const m of salidasPanol) anotarPanol(m.panol_item.nombre, m.cantidad, m.responsable_nombre);

  return {
    evento,
    dias: listaDias,
    cuadrilla: ordenar(todas.values()),
    vehiculos: [...vehiculos.values()],
    panol: [...panol.values()],
  };
}

// ── Generar el Excel imprimible ───────────────────────────────────────────────

const NEGRO = { argb: 'FF000000' };
const THIN: Partial<ExcelJS.Border> = { style: 'thin', color: NEGRO };
const BORDE = { top: THIN, bottom: THIN, left: THIN, right: THIN };
const GRIS = 'FFD9D9D9';

function hoja(wb: ExcelJS.Workbook, nombre: string, titulo: string, anchos: number[], horizontal = false) {
  const ws = wb.addWorksheet(nombre, {
    pageSetup: { paperSize: 9, orientation: horizontal ? 'landscape' : 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } },
  });
  ws.columns = anchos.map(width => ({ width }));
  ws.mergeCells(1, 1, 1, anchos.length);
  const t = ws.getCell('A1');
  t.value = titulo; t.font = { bold: true, size: 14 }; t.alignment = { horizontal: 'center' };
  return ws;
}

// Fila "ETIQUETA: valor" en celdas sueltas (los valores se leen al importar)
function dato(ws: ExcelJS.Worksheet, celda: string, etiqueta: string, valorCelda: string, valor: ExcelJS.CellValue, fmt?: string) {
  ws.getCell(celda).value = etiqueta;
  ws.getCell(celda).font = { bold: true };
  const v = ws.getCell(valorCelda);
  v.value = valor ?? null;
  if (fmt) v.numFmt = fmt;
  v.border = { bottom: THIN };
}

function tabla(ws: ExcelJS.Worksheet, filaHeader: number, headers: string[], filas: ExcelJS.CellValue[][], extra = RENGLONES_EXTRA) {
  const h = ws.getRow(filaHeader);
  headers.forEach((txt, i) => {
    const c = h.getCell(i + 1);
    c.value = txt; c.font = { bold: true }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRIS } };
    c.border = BORDE; c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });
  h.height = 30;
  const total = filas.length + extra;
  for (let i = 0; i < total; i++) {
    const row = ws.getRow(filaHeader + 1 + i);
    row.height = 22; // espacio para escribir a mano
    headers.forEach((_, j) => {
      const c = row.getCell(j + 1);
      c.value = filas[i]?.[j] ?? null;
      c.border = BORDE;
      c.alignment = { vertical: 'middle' };
    });
  }
  ws.pageSetup.printTitlesRow = `${filaHeader}:${filaHeader}`;
}

export async function generarPlanillasCampo(d: NonNullable<Awaited<ReturnType<typeof datosPlanillasCampo>>>): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Admin Portal';
  const { evento } = d;
  const lugar = evento.lugar ?? '';

  const inst = hoja(wb, 'INSTRUCCIONES', `PLANILLAS DE CAMPO — ${evento.nombre}`, [110]);
  [
    'Estas planillas salen precargadas con lo que el sistema ya sabe del evento: la cuadrilla de cada día (del Parte diario), los vehículos, el material de pañol y sus valores.',
    'Se pueden imprimir y completar a mano, o completar directo en este Excel en la notebook (no hace falta señal).',
    'Al volver, pasá lo anotado a este mismo archivo (sin cambiar los títulos ni las columnas) e importalo en Costo real → Planillas de campo.',
    '',
    '• HORAS (una hoja por día): Ingreso y Retiro de cada persona. Quien no fue, dejalo vacío o poné "A". Los que no figuran, en los renglones libres con su grupo.',
    '• VIANDAS (una hoja por día): una X (o la cantidad) en Almuerzo / Cena. Arriba, el valor de cada vianda.',
    '• ALOJAMIENTO: hotel, habitación, entrada, salida y valor por noche de cada uno.',
    '• PAÑOL: quién se lleva cada cosa, cuánto volvió y lo que faltó. Lo faltante se carga como pérdida (10% del valor).',
    '• COMBUSTIBLE: cada carga de cada vehículo — fecha, km, litros y monto.',
  ].forEach((txt, i) => {
    const c = inst.getCell(`A${3 + i}`);
    c.value = txt; c.alignment = { wrapText: true, vertical: 'top' };
  });

  for (const dia of d.dias) {
    const ws = hoja(wb, `HORAS ${ddmm(dia.fecha)}`, TITULO.HORAS, [34, 18, 12, 12, 30]);
    dato(ws, 'A2', 'EVENTO:', 'B2', `${evento.nombre}${lugar ? ` — ${lugar}` : ''}`);
    dato(ws, 'D2', 'FECHA:', 'E2', dia.fecha, 'dd/mm/yyyy');
    tabla(ws, 4, ['PERSONAL', 'GRUPO', 'INGRESO', 'RETIRO', 'OBSERVACIONES'], dia.personas.map(p => [p.nombre, p.grupo]));
  }

  for (const dia of d.dias) {
    const ws = hoja(wb, `VIANDAS ${ddmm(dia.fecha)}`, TITULO.VIANDAS, [34, 18, 12, 12, 30]);
    dato(ws, 'A2', 'EVENTO:', 'B2', evento.nombre);
    dato(ws, 'D2', 'FECHA:', 'E2', dia.fecha, 'dd/mm/yyyy');
    dato(ws, 'A3', 'VALOR ALMUERZO $:', 'B3', null, '#,##0');
    dato(ws, 'D3', 'VALOR CENA $:', 'E3', null, '#,##0');
    dato(ws, 'A4', 'PROVEEDOR:', 'B4', null);
    tabla(ws, 6, ['NOMBRE / APODO', 'GRUPO', 'ALMUERZO', 'CENA', 'OBSERVACIONES'], dia.personas.map(p => [p.nombre, p.grupo]));
  }

  const aloj = hoja(wb, 'ALOJAMIENTO', TITULO.ALOJAMIENTO, [30, 16, 20, 14, 10, 12, 12, 14], true);
  dato(aloj, 'A2', 'EVENTO:', 'B2', `${evento.nombre}${lugar ? ` — ${lugar}` : ''}`);
  tabla(aloj, 4, ['NOMBRE / APODO', 'GRUPO', 'HOTEL', 'TIPO HAB.', 'N° HAB.', 'ENTRADA', 'SALIDA', 'VALOR NOCHE $'], d.cuadrilla.map(p => [p.nombre, p.grupo]));
  for (let r = 5; r <= aloj.rowCount; r++) { aloj.getCell(`F${r}`).numFmt = 'dd/mm/yyyy'; aloj.getCell(`G${r}`).numFmt = 'dd/mm/yyyy'; aloj.getCell(`H${r}`).numFmt = '#,##0'; }

  const panol = hoja(wb, 'PAÑOL', TITULO.PANOL, [32, 10, 22, 14, 10, 10, 14, 13], true);
  dato(panol, 'A2', 'EVENTO:', 'B2', evento.nombre);
  tabla(panol, 4, ['MATERIAL', 'CANTIDAD', 'QUIÉN LO LLEVA', 'FIRMA RETIRO', 'VOLVIÓ', 'FALTÓ', 'FIRMA DEVOL.', 'VALOR UNIT. $'],
    d.panol.map(p => [p.material, p.cantidad, p.quien || null, null, null, null, null, p.valor]));
  for (let r = 5; r <= panol.rowCount; r++) panol.getCell(`H${r}`).numFmt = '#,##0';

  const comb = hoja(wb, 'COMBUSTIBLE', TITULO.COMBUSTIBLE, [12, 22, 12, 13, 18, 11, 11, 10, 13, 18], true);
  dato(comb, 'A2', 'EVENTO:', 'B2', evento.nombre);
  // Un renglón por vehículo conocido para la primera carga; el resto, libres
  tabla(comb, 4, ['FECHA', 'VEHÍCULO', 'PATENTE', 'TIPO', 'CHOFER', 'KM INICIO', 'KM FIN', 'LITROS', 'MONTO $', 'LUGAR DE CARGA'],
    d.vehiculos.map(v => [null, v.vehiculo, v.patente, v.tipo, v.chofer || null]), RENGLONES_EXTRA + 8);
  for (let r = 5; r <= comb.rowCount; r++) { comb.getCell(`A${r}`).numFmt = 'dd/mm'; comb.getCell(`I${r}`).numFmt = '#,##0'; }
  comb.getCell('D3').value = 'TIPO: CAMIÓN o CAMIONETA (las camionetas van a combustible del personal)';
  comb.getCell('D3').font = { italic: true, size: 9 };

  return Buffer.from(await wb.xlsx.writeBuffer());
}

// ── Leer las planillas completas ──────────────────────────────────────────────

function valor(c: ExcelJS.Cell): unknown {
  const v = c.value as any;
  if (v && typeof v === 'object' && !(v instanceof Date)) {
    if ('result' in v) return v.result;
    if ('richText' in v) return v.richText.map((t: any) => t.text).join('');
    if ('text' in v) return v.text;
  }
  return v;
}
const texto = (c: ExcelJS.Cell) => {
  const v = valor(c);
  return v == null || v instanceof Date ? '' : String(v).trim();
};
function numero(c: ExcelJS.Cell): number | null {
  const v = valor(c);
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = Number(v.replace(/\$|\s/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
    return Number.isFinite(n) && v.trim() !== '' ? n : null;
  }
  return null;
}
// Fecha: celda fecha o texto "07/03" / "07/03/2027". Sin año, el que deja la
// fecha más cerca del evento (un evento del 28/12 al 3/1 tiene "02/01" del año siguiente).
function fecha(c: ExcelJS.Cell, ref: Date): Date | null {
  const v = valor(c);
  if (v instanceof Date) return new Date(Date.UTC(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate()));
  const m = typeof v === 'string' ? v.trim().match(/^(\d{1,2})[/\-.](\d{1,2})(?:[/\-.](\d{2,4}))?$/) : null;
  if (!m) return null;
  const dia = Number(m[1]), mes = Number(m[2]) - 1;
  if (m[3]) return new Date(Date.UTC(m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]), mes, dia));
  const anio = ref.getUTCFullYear();
  return [anio - 1, anio, anio + 1]
    .map(y => new Date(Date.UTC(y, mes, dia)))
    .sort((a, b) => Math.abs(a.getTime() - ref.getTime()) - Math.abs(b.getTime() - ref.getTime()))[0];
}
// Ingreso / Retiro anotado: una hora ("08:00" llega como fecha u horario), un
// número o texto. "A", "AUSENTE", "NO" o "-" = no vino.
function presente(c: ExcelJS.Cell): boolean {
  const v = valor(c);
  if (v instanceof Date || typeof v === 'number') return true;
  const t = typeof v === 'string' ? v.trim() : '';
  return !!t && !/^(A|AUSENTE|NO|-)$/i.test(t);
}

// Una marca en Almuerzo/Cena: número = esa cantidad; X, ✓, SI = 1; vacío, 0, NO = 0
function marca(c: ExcelJS.Cell): number {
  const n = numero(c);
  if (n !== null) return Math.max(0, n);
  const t = normalizarTexto(texto(c));
  return !t || /^(NO|N|-|A|AUSENTE)$/.test(t) ? 0 : 1;
}

function encabezado(ws: ExcelJS.Worksheet, primera: RegExp): { fila: number; col: (re: RegExp) => number | undefined } | null {
  for (let r = 1; r <= Math.min(ws.rowCount, 15); r++) {
    if (primera.test(normalizarTexto(texto(ws.getRow(r).getCell(1))))) {
      const cols: [number, string][] = [];
      ws.getRow(r).eachCell((c, i) => cols.push([i, normalizarTexto(texto(c))]));
      return { fila: r, col: re => cols.find(([, t]) => re.test(t))?.[0] };
    }
  }
  return null;
}

// Valor de una etiqueta "XXX:" en las filas de arriba: la celda a su derecha
function datoArriba(ws: ExcelJS.Worksheet, etiqueta: RegExp): ExcelJS.Cell | null {
  for (let r = 1; r <= 5; r++) {
    const row = ws.getRow(r);
    for (let c = 1; c <= 8; c++) if (etiqueta.test(normalizarTexto(texto(row.getCell(c))))) return row.getCell(c + 1);
  }
  return null;
}

export interface PlanillasCampoLeidas {
  porBloque: Partial<Record<BloqueCostoReal, LineaDraft[]>>;
  hojas:     { hoja: string; tipo: string; filas: number }[];
  avisos:    string[];
}

export async function leerPlanillasCampo(buffer: Buffer, ref: Date, valorPanol: Map<string, number>): Promise<PlanillasCampoLeidas> {
  const wb = new ExcelJS.Workbook();
  try { await wb.xlsx.load(buffer as any); } catch { throw new Error('No se pudo leer el archivo. ¿Es un .xlsx?'); }
  const out: PlanillasCampoLeidas = { porBloque: {}, hojas: [], avisos: [] };

  const staff = new Map<string, { turnos: number; personas: Set<string> }>();
  const comidas = new Map<string, { cantidad: number; total: number; sinValor: number }>();
  const aloj: LineaDraft[] = [];
  const perdidas: LineaDraft[] = [];
  const comb = new Map<string, { bloque: BloqueCostoReal; concepto: string; litros: number; total: number; cargas: number }>();

  for (const ws of wb.worksheets) {
    const t = normalizarTexto(texto(ws.getCell('A1')));
    if (t.startsWith(normalizarTexto(TITULO.HORAS))) {
      const h = encabezado(ws, /^PERSONAL/);
      if (!h) continue;
      const cGrupo = h.col(/^GRUPO/), cIng = h.col(/^INGRESO/), cRet = h.col(/^RETIRO/);
      let n = 0;
      for (let r = h.fila + 1; r <= ws.rowCount; r++) {
        const row = ws.getRow(r);
        const nombre = texto(row.getCell(1));
        if (!nombre) continue;
        const vino = [cIng, cRet].some(col => col !== undefined && presente(row.getCell(col)));
        if (!vino) continue;
        const grupo = (cGrupo && texto(row.getCell(cGrupo))) || 'Sin grupo';
        const g = staff.get(grupo) ?? { turnos: 0, personas: new Set<string>() };
        g.turnos++; g.personas.add(normalizarTexto(nombre)); staff.set(grupo, g); n++;
      }
      out.hojas.push({ hoja: ws.name, tipo: 'Horas', filas: n });
    } else if (t.startsWith(normalizarTexto(TITULO.VIANDAS))) {
      const h = encabezado(ws, /^NOMBRE/);
      if (!h) continue;
      const cGrupo = h.col(/^GRUPO/), cAlm = h.col(/^ALMUERZO/), cCena = h.col(/^CENA/);
      const valorAlm = datoArriba(ws, /^VALOR ALMUERZO/), valorCena = datoArriba(ws, /^VALOR CENA/);
      const precio = { Almuerzo: valorAlm ? numero(valorAlm) : null, Cena: valorCena ? numero(valorCena) : null };
      let n = 0;
      for (let r = h.fila + 1; r <= ws.rowCount; r++) {
        const row = ws.getRow(r);
        if (!texto(row.getCell(1))) continue;
        const grupo = (cGrupo && texto(row.getCell(cGrupo))) || 'Sin grupo';
        for (const [tipo, col] of [['Almuerzo', cAlm], ['Cena', cCena]] as const) {
          const cant = col ? marca(row.getCell(col)) : 0;
          if (!cant) continue;
          const k = `${grupo} — ${tipo}`;
          const g = comidas.get(k) ?? { cantidad: 0, total: 0, sinValor: 0 };
          g.cantidad += cant;
          if (precio[tipo] != null) g.total += cant * precio[tipo]!; else g.sinValor += cant;
          comidas.set(k, g); n += cant;
        }
      }
      out.hojas.push({ hoja: ws.name, tipo: 'Viandas', filas: n });
    } else if (t.startsWith(normalizarTexto(TITULO.ALOJAMIENTO))) {
      const h = encabezado(ws, /^NOMBRE/);
      if (!h) continue;
      const c = { grupo: h.col(/^GRUPO/), hotel: h.col(/^HOTEL/), tipo: h.col(/^TIPO/), nro: h.col(/^N. ?HAB|^NRO/), in: h.col(/^ENTRADA/), out: h.col(/^SALIDA/), valor: h.col(/^VALOR/) };
      let n = 0;
      for (let r = h.fila + 1; r <= ws.rowCount; r++) {
        const row = ws.getRow(r);
        const nombre = texto(row.getCell(1));
        const desde = c.in ? fecha(row.getCell(c.in), ref) : null;
        const hasta = c.out ? fecha(row.getCell(c.out), ref) : null;
        if (!nombre || !desde || !hasta) continue;
        const noches = Math.round((hasta.getTime() - desde.getTime()) / DIA);
        if (noches <= 0) { out.avisos.push(`Alojamiento: ${nombre} tiene la salida antes o igual que la entrada — no se cargó.`); continue; }
        const v = c.valor ? numero(row.getCell(c.valor)) ?? 0 : 0;
        if (!v) out.avisos.push(`Alojamiento: ${nombre} sin valor por noche.`);
        const detalle = [c.hotel && texto(row.getCell(c.hotel)), c.tipo && texto(row.getCell(c.tipo)), c.nro && texto(row.getCell(c.nro)) && `hab. ${texto(row.getCell(c.nro))}`].filter(Boolean).join(' · ');
        aloj.push({ concepto: nombre, detalle: detalle || null, cantidad: noches, valor_unitario: v, total: calcularTotal(noches, v, null), fecha_desde: desde, fecha_hasta: hasta });
        n++;
      }
      out.hojas.push({ hoja: ws.name, tipo: 'Alojamiento', filas: n });
    } else if (t.startsWith(normalizarTexto(TITULO.PANOL))) {
      const h = encabezado(ws, /^MATERIAL/);
      if (!h) continue;
      const c = { cant: h.col(/^CANTIDAD/), volvio: h.col(/^VOLVIO/), falto: h.col(/^FALTO/), valor: h.col(/^VALOR/) };
      let n = 0;
      for (let r = h.fila + 1; r <= ws.rowCount; r++) {
        const row = ws.getRow(r);
        const material = texto(row.getCell(1));
        if (!material) continue;
        const falto = c.falto ? numero(row.getCell(c.falto)) : null;
        const cant = c.cant ? numero(row.getCell(c.cant)) : null;
        const volvio = c.volvio ? numero(row.getCell(c.volvio)) : null;
        const faltante = falto ?? (cant !== null && volvio !== null ? cant - volvio : 0);
        if (!(faltante > 0)) continue;
        const v = (c.valor ? numero(row.getCell(c.valor)) : null) ?? valorPanol.get(normalizarTexto(material)) ?? 0;
        if (!v) out.avisos.push(`Pañol: "${material}" sin valor — la pérdida queda en $0.`);
        perdidas.push({ concepto: material, cantidad: faltante, valor_unitario: v, porcentaje: 10, total: calcularTotal(faltante, v, 10) });
        n++;
      }
      out.hojas.push({ hoja: ws.name, tipo: 'Pañol', filas: n });
    } else if (t.startsWith(normalizarTexto(TITULO.COMBUSTIBLE))) {
      const h = encabezado(ws, /^FECHA/);
      if (!h) continue;
      const c = { veh: h.col(/^VEHICULO/), pat: h.col(/^PATENTE/), tipo: h.col(/^TIPO/), litros: h.col(/^LITROS/), monto: h.col(/^MONTO/) };
      let n = 0;
      for (let r = h.fila + 1; r <= ws.rowCount; r++) {
        const row = ws.getRow(r);
        const litros = c.litros ? numero(row.getCell(c.litros)) ?? 0 : 0;
        const monto = c.monto ? numero(row.getCell(c.monto)) ?? 0 : 0;
        if (!litros && !monto) continue; // renglón de vehículo precargado sin cargas
        const veh = [c.veh && texto(row.getCell(c.veh)), c.pat && texto(row.getCell(c.pat))].filter(Boolean).join(' ') || 'Sin vehículo';
        const tipo = c.tipo ? texto(row.getCell(c.tipo)) : '';
        const bloque: BloqueCostoReal = RE_CAMIONETA.test(tipo) || RE_CAMIONETA.test(veh) ? 'COMBUSTIBLE_PERSONAL' : 'COMBUSTIBLE_MATERIAL';
        const k = `${bloque}|${normalizarTexto(veh)}`;
        const g = comb.get(k) ?? { bloque, concepto: veh, litros: 0, total: 0, cargas: 0 };
        g.litros += litros; g.total += monto; g.cargas++; comb.set(k, g);
        if (!monto) out.avisos.push(`Combustible: carga de ${veh} sin monto.`);
        n++;
      }
      out.hojas.push({ hoja: ws.name, tipo: 'Combustible', filas: n });
    }
  }

  if (!out.hojas.length) throw new Error('El archivo no tiene planillas de campo (HORAS, VIANDAS, ALOJAMIENTO, PAÑOL o COMBUSTIBLE).');

  if (staff.size) {
    out.porBloque.STAFF = [...staff.entries()].map(([grupo, g]) => ({
      concepto: `Staff ${grupo}`, detalle: `${g.personas.size} persona${g.personas.size === 1 ? '' : 's'} (planillas de horas)`,
      cantidad: g.turnos, valor_unitario: 0, total: 0,
    }));
    out.avisos.push('Staff: se cargan los turnos por grupo; el valor del turno se completa en el costo real (se conserva si ya estaba cargado).');
  }
  if (comidas.size) {
    out.porBloque.COMIDAS = [...comidas.entries()].map(([concepto, g]) => ({
      concepto, cantidad: g.cantidad, valor_unitario: g.cantidad ? r2(g.total / g.cantidad) : 0, total: r2(g.total),
    }));
    const sinValor = [...comidas.values()].reduce((a, g) => a + g.sinValor, 0);
    if (sinValor) out.avisos.push(`Viandas: ${sinValor} menú(s) de días sin valor de vianda cargado.`);
  }
  if (aloj.length) out.porBloque.ALOJAMIENTO = aloj;
  if (perdidas.length) out.porBloque.PERDIDAS = perdidas;
  for (const g of comb.values()) {
    (out.porBloque[g.bloque] ??= []).push({
      concepto: g.concepto, detalle: `${g.cargas} carga${g.cargas === 1 ? '' : 's'}`,
      cantidad: r2(g.litros), valor_unitario: g.litros ? r2(g.total / g.litros) : 0, total: r2(g.total),
    });
  }
  return out;
}
