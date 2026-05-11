import puppeteer from 'puppeteer-core';
import { prisma } from './prisma';
import {
  type EventoExportData, type MovRow, type EcheqRow, type TabData, type CajaMovRow, type CuentaData, type ConcilMoneda,
} from './pdfTemplates/shared';
import { templateReporteCompleto } from './pdfTemplates/reporteCompleto';
import { templateConciliatoria }  from './pdfTemplates/conciliatoria';
import { templateResumenCaja }    from './pdfTemplates/resumenCaja';

// ── Browser path resolution ───────────────────────────────────────────────────

function getExecutablePath(): string {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH;
  if (process.platform === 'win32') {
    const paths = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    ];
    for (const p of paths) {
      try { require('fs').accessSync(p); return p; } catch { /* continue */ }
    }
  }
  return '/usr/bin/chromium-browser';
}

// ── Puppeteer render ──────────────────────────────────────────────────────────

async function renderPDF(html: string, eventoNombre: string, seccionNombre: string): Promise<Buffer> {
  const fechaStr = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const headerTemplate = `
    <div style="font-size:7px;font-family:Arial,sans-serif;color:#9ca3af;width:100%;padding:0 15mm;display:flex;justify-content:space-between;align-items:center;">
      <span>${eventoNombre.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>
      <span>${seccionNombre}</span>
    </div>`;

  const footerTemplate = `
    <div style="font-size:7px;font-family:Arial,sans-serif;color:#9ca3af;width:100%;padding:0 15mm;display:flex;justify-content:space-between;align-items:center;">
      <span>Generado el ${fechaStr}</span>
      <span>P&aacute;gina <span class="pageNumber"></span> de <span class="totalPages"></span></span>
    </div>`;

  const browser = await puppeteer.launch({
    executablePath: getExecutablePath(),
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    const pdf = await page.pdf({
      format:               'A4',
      margin:               { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
      printBackground:      true,
      displayHeaderFooter:  true,
      headerTemplate,
      footerTemplate,
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

// ── Data fetching ─────────────────────────────────────────────────────────────

async function buildExportData(eventoId: number): Promise<EventoExportData> {
  const [evento, tabs, movimientos, echeqs, cuentas] = await Promise.all([
    prisma.evento.findFirstOrThrow({ where: { id: eventoId, deleted_at: null } }),
    prisma.tabConfig.findMany({ orderBy: [{ tipo: 'asc' }, { numero: 'asc' }] }),
    prisma.movimiento.findMany({
      where:   { evento_id: eventoId, deleted_at: null },
      orderBy: { orden: 'asc' },
      select: {
        tipo: true, tab_numero: true, fecha: true, concepto: true,
        descripcion: true, debe: true, haber: true, saldo: true,
        moneda: true, impuesto_subcategoria: true,
      },
    }),
    prisma.echeq.findMany({
      where: { evento_id: eventoId, deleted_at: null },
      orderBy: { created_at: 'asc' },
    }),
    prisma.cuentaBancaria.findMany({
      where: { evento_id: eventoId, deleted_at: null },
      include: {
        movimientos: {
          where:   { deleted_at: null },
          orderBy: { orden: 'asc' },
          select: { fecha: true, descripcion: true, debe: true, haber: true, saldo_corriente: true, transferencia_par_id: true },
        },
      },
    }),
  ]);

  // Build tab data
  const tabsData: TabData[] = tabs.map(t => {
    const rows: MovRow[] = movimientos
      .filter(m => m.tipo === t.tipo && m.tab_numero === t.numero)
      .map(m => ({
        fecha:                 m.fecha,
        concepto:              m.concepto,
        descripcion:           m.descripcion,
        debe:                  Number(m.debe),
        haber:                 Number(m.haber),
        saldo:                 Number(m.saldo),
        impuesto_subcategoria: m.impuesto_subcategoria,
      }));
    const total_debe  = rows.reduce((a, m) => a + m.debe, 0);
    const total_haber = rows.reduce((a, m) => a + m.haber, 0);
    const saldo_final = rows.length > 0 ? rows[rows.length - 1].saldo : 0;
    return { nombre: t.nombre, codigo: t.codigo, tipo: t.tipo, movimientos: rows, total_debe, total_haber, saldo_final };
  });

  // Build echeq rows
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

  // Build cuenta data
  const cuentaData: CuentaData[] = cuentas.map(c => {
    const movs = c.movimientos;
    const last  = movs[movs.length - 1];
    const cajaMovs: CajaMovRow[] = movs.map(m => ({
      fecha:           m.fecha,
      descripcion:     m.descripcion,
      debe:            Number(m.debe),
      haber:           Number(m.haber),
      saldo_corriente: Number(m.saldo_corriente),
      is_transfer:     m.transferencia_par_id !== null,
    }));
    return {
      nombre:        c.nombre,
      tipo:          c.tipo,
      moneda:        c.moneda,
      saldo_inicial: Number(c.saldo_inicial),
      saldo_actual:  last ? Number(last.saldo_corriente) : Number(c.saldo_inicial),
      movimientos:   cajaMovs,
    };
  });

  // Build conciliatoria data
  const monedasSet = new Set(movimientos.map(m => m.moneda as string));
  if (monedasSet.size === 0) monedasSet.add(evento.moneda_base);
  const ingresoTabs = tabs.filter(t => t.tipo === 'INGRESO');
  const egresoTabs  = tabs.filter(t => t.tipo === 'EGRESO');
  const socios = (evento.socios as { nombre: string; porcentaje: number }[]);

  const por_moneda: ConcilMoneda[] = [...monedasSet].map(moneda => {
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
    const ingresos = buildRows('INGRESO', ingresoTabs);
    const egresos  = buildRows('EGRESO',  egresoTabs);
    const total_ingresos = parseFloat(ingresos.reduce((a, t) => a + t.saldo, 0).toFixed(2));
    const total_egresos  = parseFloat(egresos.reduce((a, t)  => a + t.saldo, 0).toFixed(2));
    const saldo_final    = parseFloat((total_ingresos - total_egresos).toFixed(2));
    const distribucion_socios = socios.map(s => ({
      nombre: s.nombre, porcentaje: s.porcentaje,
      monto:  parseFloat((saldo_final * s.porcentaje / 100).toFixed(2)),
    }));
    return { moneda, ingresos, egresos, total_ingresos, total_egresos, saldo_final, distribucion_socios };
  });

  return {
    evento: {
      nombre:       evento.nombre,
      estado:       evento.estado,
      fecha_inicio: evento.fecha_inicio,
      fecha_fin:    evento.fecha_fin,
      socios,
      moneda_base:  evento.moneda_base,
    },
    tabs:        tabsData,
    echeqs:      echeqRows,
    cuentas:     cuentaData,
    conciliatoria: { por_moneda },
    fecha_generacion: new Date(),
  };
}

// ── Main export function ──────────────────────────────────────────────────────

export async function generatePDF(
  eventoId: number,
  seccion:  string | undefined,
): Promise<{ buffer: Buffer; filename: string }> {
  const data = await buildExportData(eventoId);

  const today    = new Date();
  const dateStr  = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
  const nameSlug = data.evento.nombre.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').substring(0, 40);

  let html:         string;
  let seccionLabel: string;
  let fileTag:      string;

  switch (seccion) {
    case 'conciliatoria':
      html         = templateConciliatoria(data);
      seccionLabel = 'Conciliatoria';
      fileTag      = 'Conciliatoria';
      break;
    case 'caja':
      html         = templateResumenCaja(data);
      seccionLabel = 'Caja';
      fileTag      = 'Caja';
      break;
    default:
      html         = templateReporteCompleto(data);
      seccionLabel = 'Reporte completo';
      fileTag      = 'Reporte';
      break;
  }

  const buffer = await renderPDF(html, data.evento.nombre, seccionLabel);
  return { buffer, filename: `${nameSlug}-${fileTag}-${dateStr}.pdf` };
}
