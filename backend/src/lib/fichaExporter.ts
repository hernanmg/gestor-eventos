import ExcelJS from 'exceljs';
import { prisma } from './prisma';
import { applyHeaderStyle, fmtDate, safeName, BOLD, NUM_FMT } from './excelExporter';
import type { EstadoRubroEvento } from '@prisma/client';

const ESTADO_LABEL: Record<EstadoRubroEvento, string> = {
  PENDIENTE:  'PENDIENTE',
  COTIZANDO:  'COTIZANDO',
  CONFIRMADO: 'CONFIRMADO',
  NO_VA:      'NO VA',
  CANCELADO:  'CANCELADO',
};

// ── Hoja "PROVEEDORES CONFIRMADOS" — vista ejecutiva de todos los rubros ──────

interface ResumenRow {
  servicio:      string;
  proveedor:     string | null;
  confirmado:    string;
  estado:        EstadoRubroEvento;
  presupuesto:   number | null;
  observaciones: string | null;
  contacto:      string | null;
  referente:     string | null;
}

// NO_VA/CANCELADO se listan igual (el cliente quiere saber qué NO va) pero
// tachados, para que salten a la vista sin perderse en la planilla.
const ESTADOS_TACHADOS = new Set<EstadoRubroEvento>(['NO_VA', 'CANCELADO']);

function addResumenSheet(wb: ExcelJS.Workbook, rows: ResumenRow[]) {
  const ws = wb.addWorksheet('PROVEEDORES CONFIRMADOS');
  ws.columns = [
    { width: 28 }, { width: 22 }, { width: 14 }, { width: 16 },
    { width: 32 }, { width: 20 }, { width: 18 },
  ];
  const headers = ['Servicio', 'Proveedor', 'Confirmado', 'Presupuesto', 'Observaciones', 'Número de contacto', 'Referente'];
  applyHeaderStyle(ws.addRow(headers), headers.length);

  for (const r of rows) {
    const row = ws.addRow([
      r.servicio, r.proveedor ?? '', r.confirmado,
      r.presupuesto ?? '', r.observaciones ?? '', r.contacto ?? '', r.referente ?? '',
    ]);
    if (r.presupuesto !== null) row.getCell(4).numFmt = NUM_FMT;
    if (ESTADOS_TACHADOS.has(r.estado)) {
      row.eachCell(cell => {
        cell.font = { ...cell.font, strike: true, color: { argb: 'FF999999' } };
      });
    }
  }
}

// ── Una hoja por rubro CONFIRMADO — pedido técnico detallado ──────────────────

interface PedidoItemRow {
  cantidad:        number | null;
  unidad:          string | null;
  descripcion:     string;
  dias_uso:        number | null;
  horario_llegada: string | null;
  horario_retiro:  string | null;
  observaciones:   string | null;
}

interface PedidoSheetData {
  rubro_nombre:      string;
  evento_nombre:     string;
  proveedor_nombre:  string | null;
  contacto_nombre:   string | null;
  contacto_telefono: string | null;
  contacto_cargo:    string | null;
  fecha_ingreso:     Date | null;
  fecha_retiro:      Date | null;
  items:             PedidoItemRow[];
}

function addPedidoSheet(wb: ExcelJS.Workbook, data: PedidoSheetData, usedNames: Set<string>) {
  let name = safeName(data.rubro_nombre);
  // Excel no permite hojas duplicadas — desambiguar si dos rubros comparten nombre truncado
  let suffix = 2;
  while (usedNames.has(name)) { name = safeName(`${data.rubro_nombre} (${suffix})`); suffix++; }
  usedNames.add(name);

  const ws = wb.addWorksheet(name);
  ws.columns = [
    { width: 12 }, { width: 12 }, { width: 42 }, { width: 12 }, { width: 16 }, { width: 16 }, { width: 30 },
  ];

  const title = ws.addRow(['FICHA DE PEDIDO']);
  title.font = { bold: true, size: 12 };

  ws.addRow([`SERVICIO: ${data.rubro_nombre}`, null, null, `PROVEEDOR: ${data.proveedor_nombre ?? '(sin asignar)'}`]);
  ws.addRow([`EVENTO: ${data.evento_nombre}`, null, null, `EJECUTIVO: ${data.contacto_nombre ?? ''}${data.contacto_cargo ? ` — ${data.contacto_cargo}` : ''}`]);
  ws.addRow([`FECHA INGRESO: ${fmtDate(data.fecha_ingreso)}`, null, null, `TELÉFONO: ${data.contacto_telefono ?? ''}`]);
  ws.addRow([`FECHA RETIRO: ${fmtDate(data.fecha_retiro)}`]);
  ws.addRow([]);

  const headers = ['Cantidad', 'Unidad', 'Material', 'Días de uso', 'Horario llegada', 'Horario retiro', 'Observaciones'];
  applyHeaderStyle(ws.addRow(headers), headers.length);

  for (const item of data.items) {
    const row = ws.addRow([
      item.cantidad ?? '', item.unidad ?? '', item.descripcion, item.dias_uso ?? '',
      item.horario_llegada ?? '', item.horario_retiro ?? '', item.observaciones ?? '',
    ]);
    if (item.cantidad !== null) row.getCell(1).numFmt = NUM_FMT;
  }

  if (data.items.length === 0) {
    const empty = ws.addRow(['Sin ítems de pedido cargados']);
    empty.font = { italic: true, color: { argb: 'FF888888' } };
  }
}

// ── Export principal ──────────────────────────────────────────────────────────

export async function generateFichaExcel(eventoId: number, empresaId: number): Promise<{ buffer: Buffer; filename: string }> {
  const evento = await prisma.evento.findFirstOrThrow({ where: { id: eventoId, empresa_id: empresaId, deleted_at: null } });

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

  const resumenRows: ResumenRow[] = rubrosEvento.map(re => ({
    servicio:      re.rubro.nombre,
    proveedor:     re.proveedor?.nombre ?? null,
    confirmado:    ESTADO_LABEL[re.estado],
    estado:        re.estado,
    presupuesto:   re.presupuesto !== null ? Number(re.presupuesto) : null,
    observaciones: re.notas,
    contacto:      re.contacto_telefono,
    referente:     re.coordina_nombre,
  }));
  addResumenSheet(wb, resumenRows);

  const usedNames = new Set<string>(['PROVEEDORES CONFIRMADOS']);
  const confirmados = rubrosEvento.filter(re => re.estado === 'CONFIRMADO');
  for (const re of confirmados) {
    addPedidoSheet(wb, {
      rubro_nombre:      re.rubro.nombre,
      evento_nombre:     evento.nombre,
      proveedor_nombre:  re.proveedor?.nombre ?? null,
      contacto_nombre:   re.contacto_nombre,
      contacto_telefono: re.contacto_telefono,
      contacto_cargo:    re.contacto_cargo,
      fecha_ingreso:     re.fecha_ingreso,
      fecha_retiro:      re.fecha_retiro,
      items: re.pedido_items.map(i => ({
        cantidad:        i.cantidad !== null ? Number(i.cantidad) : null,
        unidad:          i.unidad,
        descripcion:     i.descripcion,
        dias_uso:        i.dias_uso,
        horario_llegada: i.horario_llegada,
        horario_retiro:  i.horario_retiro,
        observaciones:   i.observaciones,
      })),
    }, usedNames);
  }

  const nameSlug = evento.nombre.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').substring(0, 40);

  return {
    buffer:   Buffer.from(await wb.xlsx.writeBuffer()),
    filename: `Ficha-${nameSlug}.xlsx`,
  };
}
