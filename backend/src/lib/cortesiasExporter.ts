import ExcelJS from 'exceljs';
import { prisma } from './prisma';
import { cargarLogo } from './fichaExporter';
import { claveNombre } from './cortesiasImporter';

// Excel de cortesías con el formato de la planilla de Male
// (docs/especificaciones/Cortesias-  Male.xlsx): hoja "Tickets Cortesia General" con el
// encabezado del evento, el título azul, los grupos de ticket con su color, TOTALES
// combinado por grupo de contacto, VISADO y ENTREGADO; más una hoja con el detalle
// de inscriptos vinculados. El importador lee este mismo formato de vuelta.

const AZUL_TITULO = 'FF2F5597';   // accent1 con tint -25% (como la planilla)
const AMARILLO    = 'FFFFFF00';
const GRUPO_FILLS = ['FFD9E2F3', 'FFFFF2CC', 'FFE2EFDA', 'FFFCE4D6']; // azul, amarillo, verde, naranja claros
const NEGRO       = { argb: 'FF000000' };
const THIN:   Partial<ExcelJS.Border> = { style: 'thin',   color: NEGRO };
const MEDIUM: Partial<ExcelJS.Border> = { style: 'medium', color: NEGRO };

const solid = (argb: string): ExcelJS.Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });

const MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];

/** "22 DE MARZO DE 2026", "22 AL 23 DE MARZO DE 2026" o "31 DE OCTUBRE AL 1 DE NOVIEMBRE DE 2026" (fechas de calendario: UTC). */
export function fechaLarga(ini: Date | null, fin: Date | null): string {
  if (!ini) return '';
  const d1 = ini.getUTCDate(), m1 = ini.getUTCMonth(), y1 = ini.getUTCFullYear();
  if (!fin || (fin.getUTCDate() === d1 && fin.getUTCMonth() === m1 && fin.getUTCFullYear() === y1)) return `${d1} DE ${MESES[m1]} DE ${y1}`;
  const d2 = fin.getUTCDate(), m2 = fin.getUTCMonth(), y2 = fin.getUTCFullYear();
  if (m1 === m2 && y1 === y2) return `${d1} AL ${d2} DE ${MESES[m1]} DE ${y1}`;
  return `${d1} DE ${MESES[m1]} AL ${d2} DE ${MESES[m2]} DE ${y2}`;
}

/** Orden natural de los tipos: Ruta Larga antes que Corta; Estándar, Full, Tourmalet. */
export function ordenTipoTicket(a: string, b: string): number {
  const rank = (t: string) => {
    const k = t.toLowerCase();
    const ruta = k.includes('larga') ? 0 : k.includes('corta') ? 1 : 2;
    const kit = k.includes('est') ? 0 : k.includes('full') ? 1 : k.includes('tourmalet') ? 2 : 3;
    return ruta * 10 + kit;
  };
  return rank(a) - rank(b) || a.localeCompare(b);
}

function borde(cell: ExcelJS.Cell, medio = false) {
  const b = medio ? MEDIUM : THIN;
  cell.border = { top: b, bottom: b, left: b, right: b };
}

export async function generateCortesiasExcel(eventoId: number, empresaId: number): Promise<{ buffer: Buffer; filename: string }> {
  const evento = await prisma.evento.findFirstOrThrow({ where: { id: eventoId, empresa_id: empresaId, deleted_at: null } });
  const empresa = await prisma.empresa.findUnique({
    where: { id: empresaId }, select: { logo_data: true, logo_mime: true },
  });
  const cortesias = await prisma.cortesiaEvento.findMany({
    where:   { evento_id: eventoId, empresa_id: empresaId, deleted_at: null },
    include: { items: { orderBy: { id: 'asc' } } },
    orderBy: { id: 'asc' },
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Admin Portal';
  wb.created = new Date();

  // Columnas de ticket: todos los tipos usados, agrupados por ruta ("Ruta Larga - Kit Full" → grupo "Ruta Larga", kit "Kit Full")
  const tipos = Array.from(new Set(cortesias.flatMap(c => c.items.map(i => i.tipo_ticket)))).sort(ordenTipoTicket);
  const partes = tipos.map(t => {
    const idx = t.indexOf(' - ');
    return idx >= 0 ? { tipo: t, grupo: t.slice(0, idx), kit: t.slice(idx + 3) } : { tipo: t, grupo: '', kit: t };
  });
  const grupos: { nombre: string; desde: number; hasta: number; fill: string }[] = [];
  const COL_TICKET0 = 6;
  partes.forEach((p, i) => {
    const col = COL_TICKET0 + i;
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.nombre === p.grupo) ultimo.hasta = col;
    else grupos.push({ nombre: p.grupo, desde: col, hasta: col, fill: GRUPO_FILLS[grupos.length % GRUPO_FILLS.length] });
  });
  const fillDeCol = (col: number) => grupos.find(g => col >= g.desde && col <= g.hasta)?.fill ?? GRUPO_FILLS[0];

  const COL_TOTAL   = COL_TICKET0 + Math.max(partes.length, 1);
  const COL_VISADO  = COL_TOTAL + 1;
  const COL_ENTREG  = COL_TOTAL + 2;
  const N = COL_ENTREG;

  const ws = wb.addWorksheet('Tickets Cortesia General');
  ws.columns = [
    { width: 8 }, { width: 44 }, { width: 34 }, { width: 40 }, { width: 14 },
    ...partes.map(() => ({ width: 16 })), ...(partes.length === 0 ? [{ width: 16 }] : []),
    { width: 12 }, { width: 11 }, { width: 13 },
  ];

  const logo = cargarLogo(wb, empresa?.logo_data ?? null, empresa?.logo_mime ?? null);
  if (logo) {
    const alto = 70;
    const ancho = Math.min(300, Math.round((logo.w / logo.h) * alto));
    ws.addImage(logo.imageId, { tl: { col: 0.1, row: 0.2 }, ext: { width: ancho, height: Math.round((ancho / logo.w) * logo.h) } });
  }

  // Encabezado del evento (F3:G5 en la planilla original)
  const cabecera: [string, string][] = [
    ['EVENTO:', evento.nombre.toUpperCase()],
    ['LUGAR:', (evento.lugar ?? '').toUpperCase()],
    ['FECHA:', fechaLarga(evento.fecha_inicio, evento.fecha_fin)],
  ];
  const cFin = Math.max(COL_TICKET0 + 4, 10);
  cabecera.forEach(([k, v], i) => {
    const r = 3 + i;
    ws.getRow(r).height = 20;
    const c1 = ws.getCell(r, 5);
    c1.value = k; c1.font = { bold: true, size: 14 }; c1.alignment = { horizontal: 'center', vertical: 'middle' }; c1.fill = solid(AMARILLO);
    ws.mergeCells(r, 6, r, cFin);
    const c2 = ws.getCell(r, 6);
    c2.value = v; c2.font = { bold: true, size: 14 }; c2.alignment = { horizontal: 'left', vertical: 'middle' };
    for (let c = 5; c <= cFin; c++) { ws.getCell(r, c).fill = solid(AMARILLO); borde(ws.getCell(r, c), true); }
  });

  // Título
  ws.getRow(8).height = 28;
  ws.mergeCells(8, 1, 8, N);
  const titulo = ws.getCell(8, 1);
  titulo.value = 'DETALLE DE TICKETS DE CORTESIA';
  titulo.font = { bold: true, size: 20, color: { argb: 'FFFFFFFF' } };
  titulo.alignment = { horizontal: 'center', vertical: 'middle' };
  for (let c = 1; c <= N; c++) { ws.getCell(8, c).fill = solid(AZUL_TITULO); borde(ws.getCell(8, c), true); }

  // Encabezados (filas 9 y 10). Las columnas fijas y TOTALES/VISADO/ENTREGADO se combinan en vertical.
  const fijas: [number, string][] = [[1, 'ITEM'], [2, 'Cliente'], [3, 'Persona Contacto'], [4, 'Observación'], [5, 'Autoriza'],
    [COL_TOTAL, 'TOTALES'], [COL_VISADO, 'VISADO'], [COL_ENTREG, 'ENTREGADO']];
  for (const [col, label] of fijas) {
    ws.mergeCells(9, col, 10, col);
    const c = ws.getCell(9, col);
    c.value = label; c.font = { bold: true, size: 12 }; c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    borde(c); borde(ws.getCell(10, col));
  }
  grupos.forEach(g => {
    if (g.hasta > g.desde) ws.mergeCells(9, g.desde, 9, g.hasta);
    const c = ws.getCell(9, g.desde);
    c.value = g.nombre.toUpperCase(); c.font = { bold: true, size: 12 }; c.alignment = { horizontal: 'center', vertical: 'middle' };
    for (let col = g.desde; col <= g.hasta; col++) borde(ws.getCell(9, col));
  });
  partes.forEach((p, i) => {
    const c = ws.getCell(10, COL_TICKET0 + i);
    c.value = p.kit.toUpperCase(); c.font = { bold: true, size: 12 };
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    c.fill = solid(fillDeCol(COL_TICKET0 + i)); borde(c);
  });
  ws.getRow(9).height = 20; ws.getRow(10).height = 22;

  // Filas de datos
  const FILA0 = 11;
  const totalDe = (c: (typeof cortesias)[number]) => c.items.reduce((a, i) => a + i.cantidad, 0);
  cortesias.forEach((c, idx) => {
    const r = FILA0 + idx;
    const vals: [number, ExcelJS.CellValue][] = [
      [1, idx + 1], [2, c.cliente_nombre], [3, c.contacto_nombre ?? ''], [4, c.observacion ?? ''], [5, c.autorizado_por ?? ''],
      [COL_VISADO, c.visado ? 'SI' : ''], [COL_ENTREG, c.entregado ? 'SI' : ''],
    ];
    for (const [col, v] of vals) {
      const cell = ws.getCell(r, col);
      cell.value = v; cell.font = { size: 12 };
      cell.alignment = { horizontal: 'center', vertical: 'top', wrapText: true };
    }
    partes.forEach((p, i) => {
      const cant = c.items.filter(it => it.tipo_ticket === p.tipo).reduce((a, it) => a + it.cantidad, 0);
      const cell = ws.getCell(r, COL_TICKET0 + i);
      cell.value = cant > 0 ? cant : null;
      cell.font = { bold: true, size: 12 };
      cell.alignment = { horizontal: 'center', vertical: 'top' };
      cell.fill = solid(fillDeCol(COL_TICKET0 + i));
    });
    for (let col = 1; col <= N; col++) borde(ws.getCell(r, col));
    ws.getRow(r).height = c.observacion && c.observacion.length > 45 ? 34 : 21.6;
  });

  // TOTALES: subtotal por corrida de filas consecutivas con el mismo contacto (como la planilla);
  // Persona Contacto y Observación se combinan en la misma corrida cuando el valor es idéntico.
  const runs = <T,>(claveFn: (c: (typeof cortesias)[number]) => T) => {
    const out: { desde: number; hasta: number }[] = [];
    cortesias.forEach((c, i) => {
      const ult = out[out.length - 1];
      if (ult && claveFn(cortesias[ult.hasta]) === claveFn(c)) ult.hasta = i;
      else out.push({ desde: i, hasta: i });
    });
    return out;
  };
  const claveContacto = (c: (typeof cortesias)[number]) => (c.contacto_nombre ? claveNombre(c.contacto_nombre) : `#${c.id}`);
  for (const run of runs(claveContacto)) {
    const r1 = FILA0 + run.desde, r2 = FILA0 + run.hasta;
    const suma = cortesias.slice(run.desde, run.hasta + 1).reduce((a, c) => a + totalDe(c), 0);
    if (r2 > r1) { ws.mergeCells(r1, COL_TOTAL, r2, COL_TOTAL); ws.mergeCells(r1, 3, r2, 3); }
    const t = ws.getCell(r1, COL_TOTAL);
    t.value = suma; t.font = { bold: true, size: 12 }; t.alignment = { horizontal: 'center', vertical: 'middle' };
    for (let r = r1; r <= r2; r++) { borde(ws.getCell(r, COL_TOTAL)); borde(ws.getCell(r, 3)); }
    ws.getCell(r1, 3).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  }
  const claveContObs = (c: (typeof cortesias)[number]) => `${claveContacto(c)}|${claveNombre(c.observacion)}`;
  for (const run of runs(claveContObs)) {
    const r1 = FILA0 + run.desde, r2 = FILA0 + run.hasta;
    if (r2 > r1) ws.mergeCells(r1, 4, r2, 4);
    ws.getCell(r1, 4).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    for (let r = r1; r <= r2; r++) borde(ws.getCell(r, 4));
  }

  ws.views = [{ state: 'frozen', ySplit: 10, zoomScale: 85 }];
  ws.pageSetup = { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };

  // Hoja 2: detalle de inscriptos vinculados
  const wd = wb.addWorksheet('Detalle de inscriptos');
  const head = ['Cliente', 'Persona Contacto', 'Tipo de ticket', 'Bib number', 'Apellido', 'Nombre', 'DNI', 'Email'];
  wd.columns = [{ width: 38 }, { width: 30 }, { width: 28 }, { width: 13 }, { width: 24 }, { width: 24 }, { width: 14 }, { width: 34 }];
  head.forEach((h, i) => {
    const c = wd.getCell(1, i + 1);
    c.value = h; c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = solid(AZUL_TITULO);
    c.alignment = { horizontal: 'center', vertical: 'middle' }; borde(c);
  });
  wd.getRow(1).height = 22;
  let fila = 2;
  for (const c of cortesias) {
    for (const it of c.items.filter(x => x.bib_number || x.nombre_inscripto || x.apellido_inscripto || x.dni || x.email)) {
      [c.cliente_nombre, c.contacto_nombre ?? '', it.tipo_ticket, it.bib_number ?? '', it.apellido_inscripto ?? '', it.nombre_inscripto ?? '', it.dni ?? '', it.email ?? '']
        .forEach((v, i) => { const cell = wd.getCell(fila, i + 1); cell.value = v; borde(cell); });
      fila++;
    }
  }
  if (fila === 2) {
    wd.mergeCells(2, 1, 2, head.length);
    const c = wd.getCell(2, 1);
    c.value = 'Todavía no hay inscriptos vinculados a las cortesías de este evento.';
    c.font = { italic: true, color: { argb: 'FF666666' } }; c.alignment = { horizontal: 'center' };
  }
  wd.views = [{ state: 'frozen', ySplit: 1 }];

  const slug = evento.nombre.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').substring(0, 40);
  return { buffer: Buffer.from(await wb.xlsx.writeBuffer()), filename: `Cortesias-${slug}.xlsx` };
}
