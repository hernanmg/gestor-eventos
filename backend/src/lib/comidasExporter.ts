import ExcelJS from 'exceljs';
import { prisma } from './prisma';
import { applyHeaderStyle, fmtDate, safeName, BOLD, NUM_FMT } from './excelExporter';

const TIPO_LABEL: Record<string, string> = {
  ALMUERZO:  'Almuerzo',
  CENA:      'Cena',
  DESAYUNO:  'Desayuno',
  MERIENDA:  'Merienda',
};

// ── Hoja "RESUMEN" — grilla fechas × área/tipo, igual a DOS57_RESUMEN_COMIDAS ──

function addResumenSheet(wb: ExcelJS.Workbook, pedidos: PedidoConLineas[]) {
  const ws = wb.addWorksheet('RESUMEN');

  const fechas = pedidos.map(p => p.fecha);
  const areas  = [...new Set(pedidos.flatMap(p => p.lineas.map(l => l.area)))].sort();

  ws.columns = [
    { width: 22 }, { width: 12 },
    ...fechas.map(() => ({ width: 12 })),
    { width: 12 },
  ];

  const headerRow = ['Área', 'Tipo', ...fechas.map(fmtDate), 'Total'];
  applyHeaderStyle(ws.addRow(headerRow), headerRow.length);

  const porFechaTotal = new Map<number, number>(); // índice de columna fecha → acumulado

  for (const area of areas) {
    for (const tipo of ['ALMUERZO', 'CENA'] as const) {
      const valores = fechas.map(fecha => {
        const pedido = pedidos.find(p => p.fecha.getTime() === fecha.getTime());
        const cant = pedido?.lineas
          .filter(l => l.area === area && l.tipo === tipo)
          .reduce((s, l) => s + l.cantidad, 0) ?? 0;
        return cant;
      });
      const totalFila = valores.reduce((s, v) => s + v, 0);
      if (totalFila === 0) continue; // no mostrar combinaciones vacías

      valores.forEach((v, i) => porFechaTotal.set(i, (porFechaTotal.get(i) ?? 0) + v));

      const row = ws.addRow([area, TIPO_LABEL[tipo], ...valores, totalFila]);
      row.getCell(headerRow.length).font = BOLD;
    }
  }

  const totalRow = ws.addRow([
    'TOTAL', '',
    ...fechas.map((_, i) => porFechaTotal.get(i) ?? 0),
    [...porFechaTotal.values()].reduce((s, v) => s + v, 0),
  ]);
  totalRow.font = BOLD;
  totalRow.eachCell(c => { c.border = { top: { style: 'thin' } }; });
}

// ── Una hoja por fecha — detalle completo del pedido ──────────────────────────

interface LineaRow {
  tipo:           string;
  area:           string;
  cantidad:       number;
  valor_unitario: number | null;
  detalle:        string | null;
}

interface PedidoConLineas {
  fecha:           Date;
  proveedor_nombre: string | null;
  forma_pago:      string | null;
  notas:           string | null;
  lineas:          LineaRow[];
}

function addDetalleSheet(wb: ExcelJS.Workbook, pedido: PedidoConLineas, usedNames: Set<string>) {
  let name = safeName(fmtDate(pedido.fecha).replace(/\//g, '-'));
  let suffix = 2;
  while (usedNames.has(name)) { name = safeName(`${fmtDate(pedido.fecha).replace(/\//g, '-')} (${suffix})`); suffix++; }
  usedNames.add(name);

  const ws = wb.addWorksheet(name);
  ws.columns = [{ width: 14 }, { width: 20 }, { width: 12 }, { width: 14 }, { width: 14 }, { width: 32 }];

  const title = ws.addRow([`COMIDAS — ${fmtDate(pedido.fecha)}`]);
  title.font = { bold: true, size: 12 };

  ws.addRow([`PROVEEDOR: ${pedido.proveedor_nombre ?? '(sin asignar)'}`]);
  ws.addRow([`FORMA DE PAGO: ${pedido.forma_pago ?? ''}`]);
  if (pedido.notas) ws.addRow([`NOTAS: ${pedido.notas}`]);
  ws.addRow([]);

  const headers = ['Tipo', 'Área', 'Cantidad', 'Valor unitario', 'Subtotal', 'Detalle'];
  applyHeaderStyle(ws.addRow(headers), headers.length);

  let totalDia = 0;
  for (const l of pedido.lineas) {
    const subtotal = l.cantidad * (l.valor_unitario ?? 0);
    totalDia += subtotal;
    const row = ws.addRow([
      TIPO_LABEL[l.tipo] ?? l.tipo, l.area, l.cantidad,
      l.valor_unitario ?? '', l.valor_unitario !== null ? subtotal : '', l.detalle ?? '',
    ]);
    row.getCell(3).numFmt = '#,##0';
    if (l.valor_unitario !== null) {
      row.getCell(4).numFmt = NUM_FMT;
      row.getCell(5).numFmt = NUM_FMT;
    }
  }

  if (pedido.lineas.length === 0) {
    const empty = ws.addRow(['Sin líneas cargadas']);
    empty.font = { italic: true, color: { argb: 'FF888888' } };
  } else if (totalDia > 0) {
    const totalRow = ws.addRow(['', '', '', 'TOTAL', totalDia, '']);
    totalRow.font = BOLD;
    totalRow.getCell(5).numFmt = NUM_FMT;
  }
}

// ── Export principal ──────────────────────────────────────────────────────────

export async function generateComidasExcel(eventoId: number, empresaId: number): Promise<{ buffer: Buffer; filename: string }> {
  const evento = await prisma.evento.findFirstOrThrow({ where: { id: eventoId, empresa_id: empresaId, deleted_at: null } });

  const pedidos = await prisma.pedidoComida.findMany({
    where:   { evento_id: eventoId, empresa_id: empresaId, deleted_at: null },
    include: {
      proveedor: { select: { nombre: true } },
      lineas:    { where: { deleted_at: null } },
    },
    orderBy: { fecha: 'asc' },
  });

  const data: PedidoConLineas[] = pedidos.map(p => ({
    fecha:            p.fecha,
    proveedor_nombre: p.proveedor?.nombre ?? p.proveedor_texto,
    forma_pago:       p.forma_pago,
    notas:            p.notas,
    lineas: p.lineas.map(l => ({
      tipo:           l.tipo,
      area:           l.area,
      cantidad:       l.cantidad,
      valor_unitario: l.valor_unitario !== null ? Number(l.valor_unitario) : null,
      detalle:        l.detalle,
    })),
  }));

  const wb = new ExcelJS.Workbook();
  wb.creator  = 'Admin Portal';
  wb.created  = new Date();
  wb.modified = new Date();

  addResumenSheet(wb, data);

  const usedNames = new Set<string>(['RESUMEN']);
  for (const pedido of data) addDetalleSheet(wb, pedido, usedNames);

  const nameSlug = evento.nombre.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').substring(0, 40);

  return {
    buffer:   Buffer.from(await wb.xlsx.writeBuffer()),
    filename: `Comidas-${nameSlug}.xlsx`,
  };
}
