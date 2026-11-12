import ExcelJS from 'exceljs';
import { prisma } from './prisma';
import { safeName, NUM_FMT } from './excelExporter';
import { horaAMinutos, esRubroSeguridad, derivarTurno } from './esquemaTurnos';
import type { EstadoRubroEvento } from '@prisma/client';

// Replica de la planilla de Daniel (docs/enjoy/dani/Festival KM - Pedidos de material.xlsx):
// blanco y negro, bordes negros (grueso afuera / fino adentro), texto centrado, y color
// sólo en la celda de estado del resumen y en la fila del evento de la grilla de personal.

const ESTADO_LABEL: Record<EstadoRubroEvento, string> = {
  PENDIENTE:  'PENDIENTE',
  COTIZANDO:  'COTIZANDO',
  CONFIRMADO: 'CONFIRMADO',
  NO_VA:      'NO VA',
  CANCELADO:  'CANCELADO',
};

// Colores de la celda "Confirmado" del original (verde/amarillo/gris/rojo)
const ESTADO_FILL: Record<EstadoRubroEvento, string> = {
  CONFIRMADO: 'FF70AD47',
  COTIZANDO:  'FFFFFF00',
  PENDIENTE:  'FFAEABAB',
  NO_VA:      'FFFF0000',
  CANCELADO:  'FFFF0000',
};

// La hoja "PROVEEDORES CONFIRMADOS" sólo lista lo que va o puede ir: los rubros
// NO_VA y CANCELADO no se incluyen (ni el resumen ni su hoja de pedido).
const ESTADOS_EXCLUIDOS_RESUMEN = new Set<EstadoRubroEvento>(['NO_VA', 'CANCELADO']);

const BLACK = { argb: 'FF000000' };
const THIN:   Partial<ExcelJS.Border> = { style: 'thin',   color: BLACK };
const MEDIUM: Partial<ExcelJS.Border> = { style: 'medium', color: BLACK };

const fillSolid = (argb: string): ExcelJS.Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });

// ── Helpers de fechas (calendario puro: siempre componentes UTC) ─────────────

const pad2 = (n: number) => String(n).padStart(2, '0');

/** dd/MM, sin año, como en el original ("28/04"). */
function fmtDM(d: Date | null | undefined): string {
  return d ? `${pad2(d.getUTCDate())}/${pad2(d.getUTCMonth() + 1)}` : '';
}

/** "01/05", "31/10 y 01/11" (días consecutivos) o "28/04 al 01/05". */
function fmtRangoEvento(ini: Date | null, fin: Date | null): string {
  if (!ini && !fin) return '';
  if (!ini || !fin) return fmtDM(ini ?? fin);
  const dias = Math.round((fin.getTime() - ini.getTime()) / 86400000);
  if (dias <= 0) return fmtDM(ini);
  return dias === 1 ? `${fmtDM(ini)} y ${fmtDM(fin)}` : `${fmtDM(ini)} al ${fmtDM(fin)}`;
}

// ── Helpers de estilo ─────────────────────────────────────────────────────────

function eachCellIn(ws: ExcelJS.Worksheet, r1: number, c1: number, r2: number, c2: number, fn: (cell: ExcelJS.Cell, r: number, c: number) => void) {
  for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) fn(ws.getCell(r, c), r, c);
}

/** Borde fino en todas las celdas del bloque y grueso en su contorno. */
function boxRange(ws: ExcelJS.Worksheet, r1: number, c1: number, r2: number, c2: number) {
  eachCellIn(ws, r1, c1, r2, c2, (cell, r, c) => {
    cell.border = {
      top:    r === r1 ? MEDIUM : THIN,
      bottom: r === r2 ? MEDIUM : THIN,
      left:   c === c1 ? MEDIUM : THIN,
      right:  c === c2 ? MEDIUM : THIN,
    };
  });
}

function fillRange(ws: ExcelJS.Worksheet, r1: number, c1: number, r2: number, c2: number, argb: string) {
  eachCellIn(ws, r1, c1, r2, c2, cell => { cell.fill = fillSolid(argb); });
}

/** Escribe `value` en la celda master de un rango combinado y lo estila. */
function mergedCell(
  ws: ExcelJS.Worksheet, r1: number, c1: number, r2: number, c2: number, value: ExcelJS.CellValue,
  style: { font?: Partial<ExcelJS.Font>; align?: Partial<ExcelJS.Alignment>; numFmt?: string } = {},
) {
  if (r1 !== r2 || c1 !== c2) ws.mergeCells(r1, c1, r2, c2);
  const cell = ws.getCell(r1, c1);
  cell.value = value;
  cell.font = { name: 'Calibri', size: 11, ...style.font };
  cell.alignment = { vertical: 'middle', wrapText: true, ...style.align };
  if (style.numFmt) cell.numFmt = style.numFmt;
  return cell;
}

/** Líneas estimadas de un texto que ocupa `anchoChars` caracteres de ancho. */
function estLineas(texto: string | null | undefined, anchoChars: number): number {
  if (!texto) return 1;
  return texto.split('\n').reduce((acc, p) => acc + Math.max(1, Math.ceil(p.length / Math.max(anchoChars, 1))), 0);
}

const alturaFila = (lineas: number, base = 15) => Math.max(15, lineas * base);

// ── Logo de la empresa ────────────────────────────────────────────────────────

export interface Logo { imageId: number; w: number; h: number }

function tamanoImagen(buf: Buffer): { w: number; h: number } | null {
  if (buf.length > 24 && buf.toString('ascii', 1, 4) === 'PNG') {
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  }
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) { // JPEG: buscar el marcador SOFn
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) { i++; continue; }
      const marker = buf[i + 1];
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
      }
      i += 2 + buf.readUInt16BE(i + 2);
    }
  }
  return null;
}

export function cargarLogo(wb: ExcelJS.Workbook, data: Uint8Array | null, mime: string | null): Logo | null {
  if (!data || !mime) return null;
  const extension = mime.includes('png') ? 'png' : (mime.includes('jpeg') || mime.includes('jpg')) ? 'jpeg' : null;
  if (!extension) return null; // svg/webp no los soporta ExcelJS — se cae al nombre de la empresa
  const buffer = Buffer.from(data);
  const dim = tamanoImagen(buffer);
  if (!dim || !dim.w || !dim.h) return null;
  return { imageId: wb.addImage({ buffer: buffer as any, extension }), w: dim.w, h: dim.h };
}

const FILA_LOGO_ALTO_PT = 58.5; // igual que el original (≈ 78 px)

/** Fila 1: logo de la empresa (o su nombre si no tiene logo cargado). */
function addFilaLogo(ws: ExcelJS.Worksheet, ncols: number, anchoPx: number, logo: Logo | null, empresaNombre: string) {
  ws.getRow(1).height = FILA_LOGO_ALTO_PT;
  ws.mergeCells(1, 1, 1, ncols);
  if (logo) {
    const altoPx = 74;
    const anchoImg = Math.min(anchoPx - 8, Math.round((logo.w / logo.h) * altoPx));
    const altoImg  = Math.round((anchoImg / logo.w) * logo.h);
    ws.addImage(logo.imageId, { tl: { col: 0.05, row: 0.05 }, ext: { width: anchoImg, height: altoImg } });
  } else {
    const c = ws.getCell(1, 1);
    c.value = empresaNombre;
    c.font = { name: 'Calibri', size: 16, bold: true };
    c.alignment = { horizontal: 'center', vertical: 'middle' };
  }
}

function configurarImpresion(ws: ExcelJS.Worksheet) {
  // Daniel imprime la hoja para pegarla en la oficina — una hoja A4 de ancho, sin cortar columnas
  ws.pageSetup = {
    paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0,
    horizontalCentered: true, margins: { left: 0.4, right: 0.4, top: 0.4, bottom: 0.5, header: 0.2, footer: 0.2 },
  };
}

// ── Hoja "PROVEEDORES CONFIRMADOS" — vista ejecutiva de todos los rubros ──────

interface ResumenRow {
  servicio:      string;
  proveedor:     string | null;
  estado:        EstadoRubroEvento;
  presupuesto:   number | null;
  observaciones: string | null;
  contacto:      string | null;
  referente:     string | null;
}

function addResumenSheet(wb: ExcelJS.Workbook, rows: ResumenRow[], logo: Logo | null, empresaNombre: string) {
  const ws = wb.addWorksheet('PROVEEDORES CONFIRMADOS');
  const widths = [26, 20, 15, 16, 34, 22, 26];
  ws.columns = widths.map(width => ({ width }));
  const N = widths.length;
  configurarImpresion(ws);

  addFilaLogo(ws, N, widths.reduce((a, b) => a + b, 0) * 7, logo, empresaNombre);
  mergedCell(ws, 2, 1, 2, N, 'PROVEEDORES CONFIRMADOS', { font: { bold: true, size: 14 }, align: { horizontal: 'center' } });
  ws.getRow(2).height = 22;

  const headers = ['Servicio', 'Proveedor', 'Confirmado', 'Presupuesto', 'Observaciones', 'Número de contacto', 'Referente'];
  headers.forEach((h, i) => {
    const c = ws.getCell(3, i + 1);
    c.value = h;
    c.font = { name: 'Calibri', size: 11, bold: true };
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });
  ws.getRow(3).height = 20;

  rows.forEach((r, idx) => {
    const rowNum = 4 + idx;
    const vals: ExcelJS.CellValue[] = [
      r.servicio, r.proveedor ?? '', ESTADO_LABEL[r.estado],
      r.presupuesto ?? '-', r.observaciones ?? '', r.contacto ?? '', r.referente ?? '',
    ];
    vals.forEach((v, i) => {
      const c = ws.getCell(rowNum, i + 1);
      c.value = v;
      c.font = { name: 'Calibri', size: 11 };
      c.alignment = { horizontal: i === 0 || i === 4 ? 'left' : 'center', vertical: 'middle', wrapText: true };
    });
    if (r.presupuesto !== null) ws.getCell(rowNum, 4).numFmt = NUM_FMT;
    ws.getCell(rowNum, 3).fill = fillSolid(ESTADO_FILL[r.estado]);
    ws.getCell(rowNum, 3).font = { name: 'Calibri', size: 11, bold: true };
    ws.getRow(rowNum).height = alturaFila(Math.max(estLineas(r.observaciones, 32), estLineas(r.servicio, 24), estLineas(r.referente, 24)));
  });

  boxRange(ws, 2, 1, 3 + Math.max(rows.length, 0), N);
  // línea gruesa también bajo los encabezados, como en el original
  for (let c = 1; c <= N; c++) ws.getCell(3, c).border = { ...ws.getCell(3, c).border, bottom: MEDIUM };
}

// ── Una hoja por rubro CONFIRMADO — "PEDIDO DE MATERIAL" ──────────────────────

interface PedidoItemRow {
  cantidad:        number | null;
  descripcion:     string;
  dias_uso:        number | null;
  horario_llegada: string | null;
  horario_retiro:  string | null;
  observaciones:   string | null;
}

interface PedidoSheetData {
  rubro_nombre:      string;
  evento_nombre:     string;
  evento_fechas:     string;
  evento_lugar:      string | null;
  proveedor_nombre:  string | null;
  contacto_nombre:   string | null;
  contacto_telefono: string | null;
  contacto_cargo:    string | null;
  fecha_ingreso:     Date | null;
  fecha_retiro:      Date | null;
  items:             PedidoItemRow[];
  /** Nombre de la hoja del esquema de personal, si el rubro tiene una. */
  hoja_esquema:      string | null;
  resumen_esquema:   string | null;
}

/** Nombre de hoja único (Excel no admite duplicados) y truncado a 31 caracteres. */
function nombreHojaUnico(base: string, usados: Set<string>): string {
  let name = safeName(base);
  let suffix = 2;
  while (usados.has(name.toLowerCase())) { name = safeName(`${base} (${suffix})`); suffix++; }
  usados.add(name.toLowerCase());
  return name;
}

function ejecutivoTexto(d: PedidoSheetData): string {
  const partes = [
    d.contacto_nombre   && `Ejecutivo de cuenta: ${d.contacto_nombre}`,
    d.contacto_telefono && `Telefono: ${d.contacto_telefono}`,
    d.contacto_cargo    && `Cargo: ${d.contacto_cargo}`,
  ].filter(Boolean) as string[];
  return partes.length > 0 ? partes.join(' // ') : 'Ejecutivo de cuenta: -';
}

function addPedidoSheet(wb: ExcelJS.Workbook, data: PedidoSheetData, nombreHoja: string, logo: Logo | null, empresaNombre: string) {
  const ws = wb.addWorksheet(nombreHoja);
  configurarImpresion(ws);

  // Días / horarios (GENERADORES, CARPAS en el original) sólo si algún ítem los usa
  const conExtras = data.items.some(i => i.dias_uso !== null || i.horario_llegada || i.horario_retiro);
  //   base:   A Cantidad | B:D Material | E:F Observaciones
  //   extras: A Cantidad | B:D Material | E Días | F Llegada | G Retiro | H:I Observaciones
  const widths = conExtras ? [12, 22, 14, 12, 8, 14, 14, 20, 20] : [12, 22, 14, 12, 20, 20];
  ws.columns = widths.map(width => ({ width }));
  const N = widths.length;
  const colObs = conExtras ? 8 : 5;
  const anchoMaterial = widths[1] + widths[2] + widths[3];
  const anchoObs = widths.slice(colObs - 1).reduce((a, b) => a + b, 0);
  const anchoMitad = widths[0] + widths[1] + widths[2];
  const anchoTotal = widths.reduce((a, b) => a + b, 0);

  addFilaLogo(ws, N, anchoTotal * 7, logo, empresaNombre);

  mergedCell(ws, 2, 1, 2, N, 'PEDIDO DE MATERIAL', { font: { bold: true, size: 14 }, align: { horizontal: 'center' } });
  mergedCell(ws, 3, 1, 3, N, data.rubro_nombre.toUpperCase(), { font: { bold: true, italic: true, size: 14 }, align: { horizontal: 'center' } });

  // Encabezado en dos mitades (A:C | D:último), en el orden del original
  const mitades: [string, string][] = [
    [`Evento: ${data.evento_nombre}`,                       `Fecha de evento: ${data.evento_fechas}`],
    [`Ubicación: ${data.evento_lugar ?? ''}`,               `Fecha de entrega: ${fmtDM(data.fecha_ingreso)}`],
    [`Fecha de desarme: ${fmtDM(data.fecha_retiro)}`,       `Empresa: ${data.proveedor_nombre ?? '(sin asignar)'}`],
  ];
  mitades.forEach(([izq, der], i) => {
    const r = 4 + i;
    mergedCell(ws, r, 1, r, 3, izq, { align: { horizontal: 'left' } });
    mergedCell(ws, r, 4, r, N, der, { align: { horizontal: 'left' } });
    ws.getRow(r).height = alturaFila(Math.max(estLineas(izq, anchoMitad), estLineas(der, anchoTotal - anchoMitad)));
  });
  const ejecutivo = ejecutivoTexto(data);
  mergedCell(ws, 7, 1, 7, N, ejecutivo, { align: { horizontal: 'left' } });
  ws.getRow(7).height = alturaFila(estLineas(ejecutivo, anchoTotal));

  mergedCell(ws, 8, 1, 8, N, 'PEDIDO', { font: { bold: true, size: 14 }, align: { horizontal: 'center' } });

  // Encabezados de tabla
  const head: { c1: number; c2: number; text: string }[] = [
    { c1: 1, c2: 1, text: 'Cantidad' },
    { c1: 2, c2: 4, text: 'Material' },
    ...(conExtras ? [
      { c1: 5, c2: 5, text: 'Días' },
      { c1: 6, c2: 6, text: 'Horario llegada' },
      { c1: 7, c2: 7, text: 'Horario retiro' },
    ] : []),
    { c1: colObs, c2: N, text: 'Observaciones' },
  ];
  head.forEach(h => mergedCell(ws, 9, h.c1, 9, h.c2, h.text, { font: { bold: true }, align: { horizontal: 'center' } }));
  ws.getRow(9).height = conExtras ? 30 : 18;

  // Ítems — sin filas vacías: la altura de cada fila se ajusta al texto (como las
  // filas de 36–48 pt del original para los ítems largos)
  let r = 10;
  const centro: Partial<ExcelJS.Alignment> = { horizontal: 'center' };
  const agregarFila = (it: PedidoItemRow) => {
    const cant = it.cantidad;
    mergedCell(ws, r, 1, r, 1, cant ?? '', { align: centro, numFmt: cant !== null && !Number.isInteger(cant) ? '0.00' : '0' });
    mergedCell(ws, r, 2, r, 4, it.descripcion, { align: centro });
    if (conExtras) {
      mergedCell(ws, r, 5, r, 5, it.dias_uso ?? '-', { align: centro });
      mergedCell(ws, r, 6, r, 6, it.horario_llegada ?? '-', { align: centro });
      mergedCell(ws, r, 7, r, 7, it.horario_retiro ?? '-', { align: centro });
    }
    mergedCell(ws, r, colObs, r, N, it.observaciones ?? '', { align: centro });
    ws.getRow(r).height = alturaFila(Math.max(estLineas(it.descripcion, anchoMaterial), estLineas(it.observaciones, anchoObs)));
    r++;
  };
  data.items.forEach(agregarFila);

  if (data.items.length === 0) {
    const texto = data.resumen_esquema
      ? `Personal según esquema — ${data.resumen_esquema} (ver hoja "${data.hoja_esquema}")`
      : 'Sin ítems de pedido cargados';
    mergedCell(ws, r, 1, r, N, texto, { font: { italic: true, color: { argb: 'FF666666' } }, align: centro });
    r++;
  } else if (data.hoja_esquema && data.resumen_esquema) {
    mergedCell(ws, r, 1, r, N, `Personal según esquema — ${data.resumen_esquema} (ver hoja "${data.hoja_esquema}")`,
      { font: { italic: true, color: { argb: 'FF666666' } }, align: centro });
    r++;
  }

  boxRange(ws, 2, 1, r - 1, N);
  // separadores gruesos, como el original: bajo el título, bajo el bloque de datos y bajo los encabezados
  for (const fila of [3, 7, 8, 9]) {
    for (let c = 1; c <= N; c++) ws.getCell(fila, c).border = { ...ws.getCell(fila, c).border, bottom: MEDIUM };
  }
}

// ── Grilla de esquema de personal por turno ("ESQUEMA DE SEGURIDAD") ─────────

interface TurnoRow {
  fecha:            Date;
  tipo:             string | null;
  cantidad:         number;
  ubicacion:        string | null;
  hora_inicio:      string | null;
  hora_fin:         string | null;
  horas_por_agente: number | null;
  total_horas:      number;
}

const FILL_ZEBRA = 'FFEFEFEF';
const FILL_EVENTO = 'FFFFFF00';

function minutosAFraccionDia(hhmm: string | null): number | null {
  const m = horaAMinutos(hhmm);
  return m === null ? null : m / 1440;
}

function addEsquemaSheet(
  wb: ExcelJS.Workbook, nombreHoja: string, rubroNombre: string, eventoNombre: string,
  proveedorNombre: string | null, turnos: TurnoRow[], logo: Logo | null, empresaNombre: string,
) {
  const ws = wb.addWorksheet(nombreHoja);
  configurarImpresion(ws);
  const seg = esRubroSeguridad(rubroNombre);
  const sujeto = seg ? 'seguridad' : 'colaborador';

  const widths = [6, 13, 24, 10, 28, 10, 10, 18, 14];
  ws.columns = widths.map(width => ({ width }));
  const N = widths.length;

  addFilaLogo(ws, N, widths.reduce((a, b) => a + b, 0) * 7, logo, empresaNombre);

  const titulo = `ESQUEMA DE ${rubroNombre.toUpperCase()}${proveedorNombre ? ` - ${proveedorNombre.toUpperCase()}` : ''}`;
  mergedCell(ws, 2, 1, 2, N, titulo, { font: { bold: true, size: 14 }, align: { horizontal: 'center' } });
  mergedCell(ws, 3, 1, 3, N, eventoNombre.toUpperCase(), { font: { bold: true, size: 12 }, align: { horizontal: 'center' } });
  fillRange(ws, 3, 1, 3, N, FILL_EVENTO);

  const headers = ['N°', 'Fecha', seg ? 'Tipo de seguridad' : 'Tipo de turno', 'Cantidad', 'Ubicación', 'Ingreso', 'Salida', `Total hs x ${sujeto}`, 'Total de hs'];
  headers.forEach((h, i) => {
    const c = ws.getCell(4, i + 1);
    c.value = h;
    c.font = { name: 'Calibri', size: 11, bold: true };
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });
  ws.getRow(4).height = 32;

  // Agrupado por día: N°, Fecha y Total de hs se combinan verticalmente por día.
  // N° = número de día del evento (1, 2, 3…), no de fila. El total del día se
  // recalcula acá: nunca se toma de un valor guardado.
  const ordenados = [...turnos].sort((a, b) => a.fecha.getTime() - b.fecha.getTime()); // sort estable: respeta el orden cargado dentro del día
  const dias = new Map<number, TurnoRow[]>();
  for (const t of ordenados) {
    const k = t.fecha.getTime();
    if (!dias.has(k)) dias.set(k, []);
    dias.get(k)!.push(t);
  }

  let r = 5;
  let diaNum = 0;
  let totalGeneral = 0;
  for (const grupo of dias.values()) {
    diaNum++;
    const r1 = r;
    const r2 = r + grupo.length - 1;
    const totalDia = Math.round(grupo.reduce((a, t) => a + t.total_horas, 0) * 100) / 100;
    totalGeneral += totalDia;

    grupo.forEach((t, i) => {
      const row = r1 + i;
      const set = (col: number, v: ExcelJS.CellValue, numFmt?: string, align: ExcelJS.Alignment['horizontal'] = 'center') => {
        const c = ws.getCell(row, col);
        c.value = v;
        c.font = { name: 'Calibri', size: 11 };
        c.alignment = { horizontal: align, vertical: 'middle', wrapText: true };
        if (numFmt) c.numFmt = numFmt;
      };
      set(3, t.tipo ?? '');
      set(4, t.cantidad, Number.isInteger(t.cantidad) ? '0' : '0.00');
      set(5, t.ubicacion ?? '');
      set(6, minutosAFraccionDia(t.hora_inicio) ?? '', 'hh:mm');
      set(7, minutosAFraccionDia(t.hora_fin) ?? '', 'hh:mm');
      set(8, t.horas_por_agente ?? '');
      ws.getRow(row).height = alturaFila(Math.max(estLineas(t.ubicacion, widths[4]), estLineas(t.tipo, widths[2])));
    });

    // combinadas por día
    mergedCell(ws, r1, 1, r2, 1, diaNum, { font: { bold: true }, align: { horizontal: 'center' } });
    mergedCell(ws, r1, 2, r2, 2, grupo[0].fecha, { align: { horizontal: 'center' }, numFmt: 'dd/mm/yyyy' });
    mergedCell(ws, r1, 9, r2, 9, totalDia, { font: { bold: true }, align: { horizontal: 'center' } });

    if (diaNum % 2 === 0) fillRange(ws, r1, 1, r2, N, FILL_ZEBRA);
    r = r2 + 1;
  }

  // Total al pie
  const pie = r;
  ws.getCell(pie, 8).value = 'TOTAL HORAS:';
  ws.getCell(pie, 8).font = { name: 'Calibri', size: 11, bold: true };
  ws.getCell(pie, 8).alignment = { horizontal: 'right', vertical: 'middle' };
  ws.getCell(pie, 9).value = Math.round(totalGeneral * 100) / 100;
  ws.getCell(pie, 9).font = { name: 'Calibri', size: 11, bold: true };
  ws.getCell(pie, 9).alignment = { horizontal: 'center', vertical: 'middle' };

  boxRange(ws, 2, 1, pie - 1, N);
  for (let c = 1; c <= N; c++) ws.getCell(4, c).border = { ...ws.getCell(4, c).border, bottom: MEDIUM };
  eachCellIn(ws, pie, 8, pie, 9, cell => { cell.border = { top: MEDIUM, bottom: MEDIUM, left: THIN, right: THIN }; });
  ws.getCell(pie, 9).border = { top: MEDIUM, bottom: MEDIUM, left: THIN, right: MEDIUM };
  ws.getCell(pie, 8).border = { top: MEDIUM, bottom: MEDIUM, left: MEDIUM, right: THIN };

  ws.views = [{ state: 'frozen', ySplit: 4 }];
}

// ── Export principal ──────────────────────────────────────────────────────────

export async function generateFichaExcel(eventoId: number, empresaId: number): Promise<{ buffer: Buffer; filename: string }> {
  const evento = await prisma.evento.findFirstOrThrow({ where: { id: eventoId, empresa_id: empresaId, deleted_at: null } });
  const empresa = await prisma.empresa.findUnique({
    where:  { id: empresaId },
    select: { nombre: true, nombre_corto: true, logo_data: true, logo_mime: true },
  });

  const rubrosEvento = await prisma.rubroEvento.findMany({
    where:   { evento_id: eventoId, empresa_id: empresaId, deleted_at: null },
    include: {
      rubro:     { select: { nombre: true, orden: true } },
      proveedor: { select: { nombre: true } },
      pedido_items: {
        where:   { deleted_at: null },
        orderBy: { orden: 'asc' },
      },
    },
    orderBy: { rubro: { orden: 'asc' } },
  });

  const wb = new ExcelJS.Workbook();
  wb.creator  = 'Admin Portal';
  wb.created  = new Date();
  wb.modified = new Date();

  const empresaNombre = empresa?.nombre_corto || empresa?.nombre || '';
  const logo = cargarLogo(wb, empresa?.logo_data ?? null, empresa?.logo_mime ?? null);

  const resumenRows: ResumenRow[] = rubrosEvento.filter(re => !ESTADOS_EXCLUIDOS_RESUMEN.has(re.estado)).map(re => ({
    servicio:      re.rubro.nombre,
    proveedor:     re.proveedor?.nombre ?? null,
    estado:        re.estado,
    presupuesto:   re.presupuesto !== null ? Number(re.presupuesto) : null,
    observaciones: re.notas,
    contacto:      re.contacto_telefono,
    // El referente es la persona de contacto del proveedor (misma que el teléfono
    // de al lado), no quien coordina por Enjoy.
    referente:     re.contacto_nombre ?? re.coordina_nombre,
  }));
  addResumenSheet(wb, resumenRows, logo, empresaNombre);

  const usados = new Set<string>(['proveedores confirmados']);
  const fechasEvento = fmtRangoEvento(evento.fecha_inicio, evento.fecha_fin);

  for (const re of rubrosEvento.filter(x => x.estado === 'CONFIRMADO')) {
    const turnosDb  = re.pedido_items.filter(i => i.fecha_turno !== null);
    const materiales = re.pedido_items.filter(i => i.fecha_turno === null);

    const turnos: TurnoRow[] = turnosDb.map(i => {
      const cantidad = i.cantidad !== null ? Number(i.cantidad) : 0;
      const horas = i.horas_por_agente !== null ? Number(i.horas_por_agente) : null;
      // total guardado; si falta (ítem sin horario completo) queda en 0
      const total = i.total_horas_turno !== null
        ? Number(i.total_horas_turno)
        : (derivarTurno({ cantidad, horaInicio: i.hora_inicio_turno, horaFin: i.hora_fin_turno, horasManual: horas }).total_horas_turno ?? 0);
      return {
        fecha: i.fecha_turno!, tipo: i.tipo_turno, cantidad, ubicacion: i.ubicacion_turno,
        hora_inicio: i.hora_inicio_turno, hora_fin: i.hora_fin_turno, horas_por_agente: horas, total_horas: total,
      };
    });

    const nombreHoja = nombreHojaUnico(re.rubro.nombre.toUpperCase(), usados);
    const hojaEsquema = turnos.length > 0 ? nombreHojaUnico(`ESQUEMA DE ${re.rubro.nombre.toUpperCase()}`, usados) : null;
    const totalHs = turnos.reduce((a, t) => a + t.total_horas, 0);

    addPedidoSheet(wb, {
      rubro_nombre:      re.rubro.nombre,
      evento_nombre:     evento.nombre,
      evento_fechas:     fechasEvento,
      evento_lugar:      evento.lugar,
      proveedor_nombre:  re.proveedor?.nombre ?? null,
      contacto_nombre:   re.contacto_nombre,
      contacto_telefono: re.contacto_telefono,
      contacto_cargo:    re.contacto_cargo,
      fecha_ingreso:     re.fecha_ingreso,
      fecha_retiro:      re.fecha_retiro,
      items: materiales.map(i => ({
        cantidad:        i.cantidad !== null ? Number(i.cantidad) : null,
        descripcion:     i.descripcion,
        dias_uso:        i.dias_uso,
        horario_llegada: i.horario_llegada,
        horario_retiro:  i.horario_retiro,
        observaciones:   i.observaciones,
      })),
      hoja_esquema:    hojaEsquema,
      resumen_esquema: turnos.length > 0 ? `${Math.round(totalHs * 100) / 100} hs en total` : null,
    }, nombreHoja, logo, empresaNombre);

    if (hojaEsquema) {
      addEsquemaSheet(wb, hojaEsquema, re.rubro.nombre, evento.nombre, re.proveedor?.nombre ?? null, turnos, logo, empresaNombre);
    }
  }

  const nameSlug = evento.nombre.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').substring(0, 40);

  return {
    buffer:   Buffer.from(await wb.xlsx.writeBuffer()),
    filename: `Ficha-${nameSlug}.xlsx`,
  };
}
