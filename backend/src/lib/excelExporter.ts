import ExcelJS from 'exceljs';
import { prisma } from './prisma';

// ── Style constants ───────────────────────────────────────────────────────────

const BLUE_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0070C0' } };
const BOLD_WHITE: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
const BOLD: Partial<ExcelJS.Font>       = { bold: true };
const NUM_FMT = '#,##0.00';

function applyHeaderStyle(row: ExcelJS.Row, cols: number) {
  for (let c = 1; c <= cols; c++) {
    const cell = row.getCell(c);
    cell.fill = BLUE_FILL;
    cell.font = BOLD_WHITE;
    cell.alignment  = { horizontal: 'center', vertical: 'middle' };
    cell.border     = { bottom: { style: 'thin' } };
  }
  row.height = 18;
}

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return '';
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) return '';
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${date.getFullYear()}`;
}

function safeName(s: string): string {
  return s.replace(/[/\\?*[\]:]/g, '-').substring(0, 31);
}

// ── Movement sheet ────────────────────────────────────────────────────────────

interface MovRow {
  fecha:                 Date | null;
  concepto:              string | null;
  descripcion:           string | null;
  debe:                  number;
  haber:                 number;
  saldo:                 number;
  impuesto_subcategoria: string | null;
}

interface EcheqRow {
  numero:               string;
  razon_social:         string;
  detalle:              string | null;
  importe:              number;
  moneda:               string;
  fecha_emision:        Date | null;
  fecha_cobro_estimada: Date | null;
  fecha_cobro_real:     Date | null;
  estado:               string;
}

function addMovSheet(
  wb:      ExcelJS.Workbook,
  name:    string,
  rows:    MovRow[],
  isIMP:   boolean,
  isEXTRA: boolean,
  echeqs:  EcheqRow[],
) {
  const ws = wb.addWorksheet(safeName(name));

  if (isIMP) {
    ws.columns = [
      { width: 13 }, { width: 22 }, { width: 42 }, { width: 22 },
      { width: 18 }, { width: 18 }, { width: 18 },
    ];
    applyHeaderStyle(ws.addRow(['FECHA', 'CONCEPTO', 'DESCRIPCIÓN', 'SUBCATEGORÍA', 'DEBE', 'HABER', 'SALDO']), 7);
  } else {
    ws.columns = [
      { width: 13 }, { width: 22 }, { width: 55 },
      { width: 18 }, { width: 18 }, { width: 18 },
    ];
    applyHeaderStyle(ws.addRow(['FECHA', 'CONCEPTO', 'DESCRIPCIÓN', 'DEBE', 'HABER', 'SALDO']), 6);
  }

  const numStart = isIMP ? 5 : 4;
  const numEnd   = isIMP ? 7 : 6;
  let totalDebe = 0, totalHaber = 0, saldoFinal = 0;

  for (const m of rows) {
    totalDebe  += m.debe;
    totalHaber += m.haber;
    saldoFinal  = m.saldo;
    const vals = isIMP
      ? [fmtDate(m.fecha), m.concepto ?? '', m.descripcion ?? '', m.impuesto_subcategoria ?? '', m.debe, m.haber, m.saldo]
      : [fmtDate(m.fecha), m.concepto ?? '', m.descripcion ?? '', m.debe, m.haber, m.saldo];
    const row = ws.addRow(vals);
    for (let c = numStart; c <= numEnd; c++) row.getCell(c).numFmt = NUM_FMT;
  }

  // Total row
  const totals = isIMP
    ? ['TOTAL', '', '', '', totalDebe, totalHaber, saldoFinal]
    : ['TOTAL', '', '', totalDebe, totalHaber, saldoFinal];
  const tr = ws.addRow(totals);
  tr.font = BOLD;
  for (let c = numStart; c <= numEnd; c++) tr.getCell(c).numFmt = NUM_FMT;

  // EG-EXTRA: echeqs sub-table
  if (isEXTRA) {
    ws.addRow([]);
    const titleRow = ws.addRow(['ECHEQS']);
    titleRow.font = { bold: true, size: 11 };
    const hdrs = ['N°', 'RAZÓN SOCIAL', 'DETALLE', 'IMPORTE', 'MONEDA', 'F. EMISIÓN', 'F. COBRO EST.', 'F. COBRO REAL', 'ESTADO'];
    applyHeaderStyle(ws.addRow(hdrs), hdrs.length);
    for (const e of echeqs) {
      const row = ws.addRow([
        e.numero, e.razon_social, e.detalle ?? '', e.importe, e.moneda,
        fmtDate(e.fecha_emision), fmtDate(e.fecha_cobro_estimada), fmtDate(e.fecha_cobro_real), e.estado,
      ]);
      row.getCell(4).numFmt = NUM_FMT;
    }
  }
}

// ── Conciliatoria sheet ───────────────────────────────────────────────────────

interface ConcilData {
  socios: { nombre: string; porcentaje: number }[];
  por_moneda: Array<{
    moneda:    string;
    ingresos:  Array<{ nombre: string; total_debe: number; total_haber: number; saldo: number }>;
    egresos:   Array<{ nombre: string; total_debe: number; total_haber: number; saldo: number }>;
    total_ingresos: number;
    total_egresos:  number;
    saldo_final:    number;
    distribucion_socios: Array<{ nombre: string; porcentaje: number; monto: number }>;
  }>;
  caja: Array<{
    nombre: string; tipo: string; moneda: string;
    saldo_inicial: number; saldo_actual: number;
  }>;
  echeqs_pendientes: Array<{ moneda: string; total: number }>;
  echeqs_count: number;
}

function addConcilSheet(wb: ExcelJS.Workbook, data: ConcilData) {
  const ws = wb.addWorksheet('CONCILIATORIA');
  ws.columns = [
    { width: 32 }, { width: 14 }, { width: 14 }, { width: 18 }, { width: 18 },
  ];

  for (const pm of data.por_moneda) {
    const monRow = ws.addRow([`MONEDA: ${pm.moneda}`]);
    monRow.font  = { bold: true, size: 12 };
    ws.addRow([]);

    // Ingresos section
    const ingTitle = ws.addRow(['INGRESOS']);
    ingTitle.font = BOLD;
    applyHeaderStyle(ws.addRow(['TAB', 'DEBE', 'HABER', 'SALDO']), 4);
    for (const t of pm.ingresos) {
      const row = ws.addRow([t.nombre, t.total_debe, t.total_haber, t.saldo]);
      for (let c = 2; c <= 4; c++) row.getCell(c).numFmt = NUM_FMT;
    }
    const ingTot = ws.addRow(['TOTAL INGRESOS', '', '', pm.total_ingresos]);
    ingTot.font = BOLD;
    ingTot.getCell(4).numFmt = NUM_FMT;
    ws.addRow([]);

    // Egresos section
    const egTitle = ws.addRow(['EGRESOS']);
    egTitle.font = BOLD;
    applyHeaderStyle(ws.addRow(['TAB', 'DEBE', 'HABER', 'SALDO']), 4);
    for (const t of pm.egresos) {
      const row = ws.addRow([t.nombre, t.total_debe, t.total_haber, t.saldo]);
      for (let c = 2; c <= 4; c++) row.getCell(c).numFmt = NUM_FMT;
    }
    const egTot = ws.addRow(['TOTAL EGRESOS', '', '', pm.total_egresos]);
    egTot.font = BOLD;
    egTot.getCell(4).numFmt = NUM_FMT;
    ws.addRow([]);

    // Saldo final
    const sfRow = ws.addRow(['SALDO FINAL', '', '', pm.saldo_final]);
    sfRow.font = { bold: true, size: 12 };
    sfRow.getCell(4).numFmt = NUM_FMT;
    ws.addRow([]);

    // Socios
    if (data.socios.length > 0) {
      const socTitle = ws.addRow(['DISTRIBUCIÓN DE SOCIOS']);
      socTitle.font = BOLD;
      applyHeaderStyle(ws.addRow(['SOCIO', 'PORCENTAJE', 'MONTO']), 3);
      for (const s of pm.distribucion_socios) {
        const row = ws.addRow([s.nombre, `${s.porcentaje}%`, s.monto]);
        row.getCell(3).numFmt = NUM_FMT;
      }
      ws.addRow([]);
    }

    // Separator between monedas
    if (data.por_moneda.length > 1) {
      ws.addRow(['─────────────────────────────────']);
      ws.addRow([]);
    }
  }

  // Caja
  if (data.caja.length > 0) {
    const cajaTitle = ws.addRow(['CAJA']);
    cajaTitle.font = { bold: true, size: 12 };
    ws.addRow([]);
    applyHeaderStyle(ws.addRow(['CUENTA', 'TIPO', 'MONEDA', 'SALDO INICIAL', 'SALDO ACTUAL']), 5);
    for (const c of data.caja) {
      const row = ws.addRow([c.nombre, c.tipo, c.moneda, c.saldo_inicial, c.saldo_actual]);
      row.getCell(4).numFmt = NUM_FMT;
      row.getCell(5).numFmt = NUM_FMT;
    }
    ws.addRow([]);
  }

  // Echeqs pendientes
  if (data.echeqs_count > 0) {
    const ecTitle = ws.addRow([`ECHEQS PENDIENTES (${data.echeqs_count})`]);
    ecTitle.font = BOLD;
    for (const e of data.echeqs_pendientes) {
      const row = ws.addRow([`Total ${e.moneda}`, e.total]);
      row.getCell(2).numFmt = NUM_FMT;
    }
  }
}

// ── Main export function ──────────────────────────────────────────────────────

export async function generateExcel(
  eventoId:  number,
  tabCodigo: string | undefined,
): Promise<{ buffer: Buffer; filename: string }> {
  const [evento, tabs, movimientos, echeqs, cuentas] = await Promise.all([
    prisma.evento.findFirstOrThrow({ where: { id: eventoId, deleted_at: null } }),
    prisma.tabConfig.findMany({ orderBy: [{ tipo: 'asc' }, { numero: 'asc' }] }),
    prisma.movimiento.findMany({
      where:   { evento_id: eventoId, deleted_at: null },
      orderBy: { orden: 'asc' },
      select:  {
        tipo: true, tab_numero: true, fecha: true, concepto: true,
        descripcion: true, debe: true, haber: true, saldo: true,
        moneda: true, impuesto_subcategoria: true,
      },
    }),
    prisma.echeq.findMany({
      where:   { evento_id: eventoId, deleted_at: null },
      orderBy: { created_at: 'asc' },
    }),
    prisma.cuentaBancaria.findMany({
      where:   { evento_id: eventoId, deleted_at: null },
      include: {
        movimientos: {
          where:   { deleted_at: null },
          orderBy: { orden: 'asc' },
          select:  { saldo_corriente: true },
        },
      },
    }),
  ]);

  // Helpers
  const getMovs = (tipo: string, numero: number): MovRow[] =>
    movimientos
      .filter(m => m.tipo === tipo && m.tab_numero === numero)
      .map(m => ({
        fecha:                 m.fecha,
        concepto:              m.concepto,
        descripcion:           m.descripcion,
        debe:                  Number(m.debe),
        haber:                 Number(m.haber),
        saldo:                 Number(m.saldo),
        impuesto_subcategoria: m.impuesto_subcategoria,
      }));

  const echeqRows: EcheqRow[] = echeqs.map(e => ({
    numero:               e.numero,
    razon_social:         e.razon_social,
    detalle:              e.detalle,
    importe:              Number(e.importe),
    moneda:               e.moneda,
    fecha_emision:        e.fecha_emision,
    fecha_cobro_estimada: e.fecha_cobro_estimada,
    fecha_cobro_real:     e.fecha_cobro_real,
    estado:               e.estado,
  }));

  const buildConcilData = (): ConcilData => {
    const monedasSet = new Set(movimientos.map(m => m.moneda as string));
    if (monedasSet.size === 0) monedasSet.add(evento.moneda_base);
    const ingresoTabs = tabs.filter(t => t.tipo === 'INGRESO');
    const egresoTabs  = tabs.filter(t => t.tipo === 'EGRESO');
    const socios = (evento.socios as { nombre: string; porcentaje: number }[]);

    const por_moneda = [...monedasSet].map(moneda => {
      const forMoneda = movimientos.filter(m => m.moneda === moneda);
      const buildRows = (tipo: 'INGRESO' | 'EGRESO', list: typeof ingresoTabs) =>
        list.map(t => {
          const rows = forMoneda.filter(m => m.tipo === tipo && m.tab_numero === t.numero);
          const total_debe  = rows.reduce((a, m) => a + Number(m.debe),  0);
          const total_haber = rows.reduce((a, m) => a + Number(m.haber), 0);
          const saldo = tipo === 'INGRESO'
            ? parseFloat((total_haber - total_debe).toFixed(2))
            : parseFloat((total_debe  - total_haber).toFixed(2));
          return { nombre: t.nombre, total_debe, total_haber, saldo };
        });

      const ingresos       = buildRows('INGRESO', ingresoTabs);
      const egresos        = buildRows('EGRESO',  egresoTabs);
      const total_ingresos = parseFloat(ingresos.reduce((a, t) => a + t.saldo, 0).toFixed(2));
      const total_egresos  = parseFloat(egresos.reduce((a,  t) => a + t.saldo, 0).toFixed(2));
      const saldo_final    = parseFloat((total_ingresos - total_egresos).toFixed(2));
      const distribucion_socios = socios.map(s => ({
        nombre:     s.nombre,
        porcentaje: s.porcentaje,
        monto:      parseFloat((saldo_final * s.porcentaje / 100).toFixed(2)),
      }));
      return { moneda, ingresos, egresos, total_ingresos, total_egresos, saldo_final, distribucion_socios };
    });

    const caja = cuentas.map(c => {
      const last = c.movimientos[c.movimientos.length - 1];
      return {
        nombre:        c.nombre,
        tipo:          c.tipo,
        moneda:        c.moneda,
        saldo_inicial: Number(c.saldo_inicial),
        saldo_actual:  last ? Number(last.saldo_corriente) : Number(c.saldo_inicial),
      };
    });

    const totMap = new Map<string, number>();
    const pendientes = echeqs.filter(e => e.estado === 'PENDIENTE');
    for (const e of pendientes) {
      totMap.set(e.moneda, (totMap.get(e.moneda) ?? 0) + Number(e.importe));
    }

    return {
      socios,
      por_moneda,
      caja,
      echeqs_pendientes: [...totMap.entries()].map(([moneda, total]) => ({ moneda, total })),
      echeqs_count:      pendientes.length,
    };
  };

  // Filename
  const today    = new Date();
  const dateStr  = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
  const nameSlug = evento.nombre.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').substring(0, 40);

  // ── Build workbook ────────────────────────────────────────────────────────

  const wb = new ExcelJS.Workbook();
  wb.creator  = 'Admin Portal';
  wb.created  = new Date();
  wb.modified = new Date();

  // Single conciliatoria export
  if (tabCodigo === 'CONCILIATORIA') {
    addConcilSheet(wb, buildConcilData());
    return {
      buffer:   Buffer.from(await wb.xlsx.writeBuffer()),
      filename: `${nameSlug}-CONCILIATORIA-${dateStr}.xlsx`,
    };
  }

  // Single tab export
  if (tabCodigo) {
    const tab = tabs.find(t => t.codigo === tabCodigo);
    if (!tab) throw Object.assign(new Error(`Tab no encontrado: ${tabCodigo}`), { status: 400 });
    const isIMP   = tab.codigo === 'EG-IMP';
    const isEXTRA = tab.codigo === 'EG-EXTRA';
    addMovSheet(wb, tab.nombre, getMovs(tab.tipo, tab.numero), isIMP, isEXTRA, isEXTRA ? echeqRows : []);
    return {
      buffer:   Buffer.from(await wb.xlsx.writeBuffer()),
      filename: `${nameSlug}-${tab.codigo}-${dateStr}.xlsx`,
    };
  }

  // Full export: all 10 tabs + conciliatoria
  for (const tab of tabs) {
    const isIMP   = tab.codigo === 'EG-IMP';
    const isEXTRA = tab.codigo === 'EG-EXTRA';
    addMovSheet(wb, tab.nombre, getMovs(tab.tipo, tab.numero), isIMP, isEXTRA, isEXTRA ? echeqRows : []);
  }
  addConcilSheet(wb, buildConcilData());

  return {
    buffer:   Buffer.from(await wb.xlsx.writeBuffer()),
    filename: `${nameSlug}-${dateStr}.xlsx`,
  };
}
