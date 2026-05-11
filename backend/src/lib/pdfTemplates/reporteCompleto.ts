import { CSS, esc, fmt, fmtDate, saldoClass, saldoBoxClass, type EventoExportData, type TabData, type ConcilMoneda } from './shared';

function movTable(tab: TabData): string {
  const isIMP = tab.codigo === 'EG-IMP';
  const headers = isIMP
    ? `<th style="width:85px;">Fecha</th><th>Concepto</th><th>Descripción</th><th style="width:110px;">Subcategoría</th><th class="text-right" style="width:80px;">Debe</th><th class="text-right" style="width:80px;">Haber</th><th class="text-right" style="width:80px;">Saldo</th>`
    : `<th style="width:85px;">Fecha</th><th>Concepto</th><th>Descripción</th><th class="text-right" style="width:80px;">Debe</th><th class="text-right" style="width:80px;">Haber</th><th class="text-right" style="width:80px;">Saldo</th>`;

  const rows = tab.movimientos.map(m => {
    const cells = isIMP
      ? `<td class="text-center muted">${fmtDate(m.fecha)}</td><td>${esc(m.concepto)}</td><td>${esc(m.descripcion)}</td><td class="muted">${esc(m.impuesto_subcategoria)}</td><td class="text-right muted">${m.debe > 0 ? fmt(m.debe) : '—'}</td><td class="text-right muted">${m.haber > 0 ? fmt(m.haber) : '—'}</td><td class="text-right ${saldoClass(m.saldo)}">${fmt(m.saldo)}</td>`
      : `<td class="text-center muted">${fmtDate(m.fecha)}</td><td>${esc(m.concepto)}</td><td>${esc(m.descripcion)}</td><td class="text-right muted">${m.debe > 0 ? fmt(m.debe) : '—'}</td><td class="text-right muted">${m.haber > 0 ? fmt(m.haber) : '—'}</td><td class="text-right ${saldoClass(m.saldo)}">${fmt(m.saldo)}</td>`;
    return `<tr>${cells}</tr>`;
  }).join('');

  const totalCols = isIMP
    ? `<td></td><td></td><td></td><td class="text-right">${fmt(tab.total_debe)}</td><td class="text-right">${fmt(tab.total_haber)}</td><td class="text-right ${saldoClass(tab.saldo_final)}">${fmt(tab.saldo_final)}</td>`
    : `<td></td><td></td><td class="text-right">${fmt(tab.total_debe)}</td><td class="text-right">${fmt(tab.total_haber)}</td><td class="text-right ${saldoClass(tab.saldo_final)}">${fmt(tab.saldo_final)}</td>`;

  return `<table>
    <thead><tr>${headers}</tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr><td>TOTAL</td>${totalCols}</tr></tfoot>
  </table>`;
}

function concilSection(por_moneda: ConcilMoneda[]): string {
  return por_moneda.map(pm => {
    const buildRows = (rows: ConcilMoneda['ingresos']): string =>
      rows.map(t => `
      <tr>
        <td>${esc(t.nombre)}</td>
        <td class="text-right muted">${fmt(t.total_debe)}</td>
        <td class="text-right muted">${fmt(t.total_haber)}</td>
        <td class="text-right ${saldoClass(t.saldo)}">${fmt(t.saldo)}</td>
      </tr>`).join('');

    return `
    <h3 style="margin-bottom:0.4rem;">Moneda: ${esc(pm.moneda)}</h3>
    <h4 style="margin-bottom:0.2rem;">Ingresos</h4>
    <table>
      <thead><tr><th>Pestaña</th><th class="text-right">Debe</th><th class="text-right">Haber</th><th class="text-right">Saldo</th></tr></thead>
      <tbody>${buildRows(pm.ingresos)}</tbody>
      <tfoot><tr><td>Total</td><td class="text-right">${fmt(pm.ingresos.reduce((a, t) => a + t.total_debe, 0))}</td><td class="text-right">${fmt(pm.ingresos.reduce((a, t) => a + t.total_haber, 0))}</td><td class="text-right ${saldoClass(pm.total_ingresos)}">${fmt(pm.total_ingresos)}</td></tr></tfoot>
    </table>
    <h4 style="margin-bottom:0.2rem;">Egresos</h4>
    <table>
      <thead><tr><th>Pestaña</th><th class="text-right">Debe</th><th class="text-right">Haber</th><th class="text-right">Saldo</th></tr></thead>
      <tbody>${buildRows(pm.egresos)}</tbody>
      <tfoot><tr><td>Total</td><td class="text-right">${fmt(pm.egresos.reduce((a, t) => a + t.total_debe, 0))}</td><td class="text-right">${fmt(pm.egresos.reduce((a, t) => a + t.total_haber, 0))}</td><td class="text-right ${saldoClass(pm.total_egresos)}">${fmt(pm.total_egresos)}</td></tr></tfoot>
    </table>
    <div class="${saldoBoxClass(pm.saldo_final)}" style="margin-bottom:0.8rem;">
      <span>SALDO FINAL ${esc(pm.moneda)}</span>
      <span style="font-size:13pt;">${fmt(pm.saldo_final)}</span>
    </div>
    ${pm.distribucion_socios.length > 0 ? `
    <h4 style="margin-bottom:0.2rem;">Distribución de socios</h4>
    <table>
      <thead><tr><th>Socio</th><th class="text-right">%</th><th class="text-right">Monto</th></tr></thead>
      <tbody>${pm.distribucion_socios.map(s => `
        <tr><td>${esc(s.nombre)}</td><td class="text-right muted">${s.porcentaje}%</td><td class="text-right ${saldoClass(s.monto)}">${fmt(s.monto)}</td></tr>
      `).join('')}</tbody>
    </table>` : ''}
    `;
  }).join('<hr style="margin: 0.8rem 0; border-color:#e5e7eb;">');
}

export function templateReporteCompleto(data: EventoExportData): string {
  const { evento, tabs, echeqs, cuentas, conciliatoria, fecha_generacion } = data;

  const tabsConMov    = tabs.filter(t => t.movimientos.length > 0);
  const pendientes    = echeqs.filter(e => e.estado === 'PENDIENTE');
  const cobrados      = echeqs.filter(e => e.estado !== 'PENDIENTE');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <style>
    ${CSS}
    .cover { display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:85vh; text-align:center; }
    .cover h1 { font-size:24pt; margin-bottom:0.5rem; }
  </style>
</head>
<body>

  <!-- ── PORTADA ── -->
  <div class="cover page-break">
    <h1>${esc(evento.nombre)}</h1>
    <div style="margin:0.5rem 0;">
      <span class="badge badge-${evento.estado}">${evento.estado}</span>
    </div>
    ${evento.fecha_inicio || evento.fecha_fin ? `
    <div class="muted" style="font-size:10pt; margin:0.4rem 0;">
      ${evento.fecha_inicio ? `Inicio: ${fmtDate(evento.fecha_inicio)}` : ''}
      ${evento.fecha_inicio && evento.fecha_fin ? ' &nbsp;–&nbsp; ' : ''}
      ${evento.fecha_fin ? `Fin: ${fmtDate(evento.fecha_fin)}` : ''}
    </div>` : ''}
    ${evento.socios.length > 0 ? `
    <div style="margin-top:1rem; font-size:9.5pt;">
      <strong>Socios:</strong>&nbsp;
      ${evento.socios.map(s => `${esc(s.nombre)} (${s.porcentaje}%)`).join(' &nbsp;·&nbsp; ')}
    </div>` : ''}
    <div class="muted" style="margin-top:1.5rem; font-size:9pt;">
      Generado el ${fmtDate(fecha_generacion)}
    </div>
  </div>

  <!-- ── MOVIMIENTOS POR PESTAÑA ── -->
  ${tabsConMov.map((tab, i) => `
  <div class="${i < tabsConMov.length - 1 ? 'page-break' : ''} section">
    <h2>${esc(tab.nombre)}</h2>
    ${movTable(tab)}
  </div>`).join('')}

  <!-- ── ECHEQS ── -->
  ${echeqs.length > 0 ? `
  <div class="page-break section">
    <h2>Echeqs</h2>
    ${pendientes.length > 0 ? `
    <h3 style="margin-bottom:0.4rem;">Pendientes (${pendientes.length})</h3>
    <table>
      <thead><tr>
        <th>N°</th><th>Razón social</th><th>Detalle</th>
        <th class="text-right">Importe</th><th>Moneda</th>
        <th>F. Emisión</th><th>F. Cobro est.</th>
      </tr></thead>
      <tbody>${pendientes.map(e => `
        <tr>
          <td class="muted">${esc(e.numero)}</td>
          <td>${esc(e.razon_social)}</td>
          <td class="muted">${esc(e.detalle)}</td>
          <td class="text-right">${fmt(e.importe)}</td>
          <td class="muted">${e.moneda}</td>
          <td class="text-center muted">${fmtDate(e.fecha_emision)}</td>
          <td class="text-center muted">${fmtDate(e.fecha_cobro_estimada)}</td>
        </tr>`).join('')}
      </tbody>
    </table>` : ''}
    ${cobrados.length > 0 ? `
    <h3 style="margin-bottom:0.4rem;">Historial (${cobrados.length})</h3>
    <table>
      <thead><tr>
        <th>N°</th><th>Razón social</th>
        <th class="text-right">Importe</th><th>Moneda</th>
        <th>Estado</th><th>F. Cobro real</th>
      </tr></thead>
      <tbody>${cobrados.map(e => `
        <tr>
          <td class="muted">${esc(e.numero)}</td>
          <td>${esc(e.razon_social)}</td>
          <td class="text-right">${fmt(e.importe)}</td>
          <td class="muted">${e.moneda}</td>
          <td class="muted">${e.estado}</td>
          <td class="text-center muted">${fmtDate(e.fecha_cobro_real)}</td>
        </tr>`).join('')}
      </tbody>
    </table>` : ''}
  </div>` : ''}

  <!-- ── CAJA ── -->
  ${cuentas.length > 0 ? `
  <div class="page-break section">
    <h2>Caja</h2>
    ${cuentas.map(c => `
    <div style="margin-bottom:1.2rem; page-break-inside:avoid;">
      <h3 style="margin-bottom:0.3rem;">${esc(c.nombre)}</h3>
      <div class="info-grid" style="margin-bottom:0.4rem;">
        <div><span>Tipo: </span><strong>${c.tipo}</strong></div>
        <div><span>Moneda: </span><strong>${c.moneda}</strong></div>
        <div><span>Saldo inicial: </span><strong>${fmt(c.saldo_inicial)}</strong></div>
        <div><span>Saldo actual: </span><strong class="${saldoClass(c.saldo_actual)}">${fmt(c.saldo_actual)}</strong></div>
      </div>
      ${c.movimientos.length === 0
        ? `<p class="muted" style="font-size:9pt; font-style:italic;">Sin movimientos</p>`
        : `<table>
        <thead><tr>
          <th style="width:85px;">Fecha</th><th>Descripción</th>
          <th class="text-right" style="width:80px;">Debe</th>
          <th class="text-right" style="width:80px;">Haber</th>
          <th class="text-right" style="width:80px;">Saldo</th>
        </tr></thead>
        <tbody>${c.movimientos.map(m => `
          <tr>
            <td class="text-center muted">${fmtDate(m.fecha)}</td>
            <td>${m.is_transfer ? '<span class="transfer-icon">&#8596; </span>' : ''}${esc(m.descripcion)}</td>
            <td class="text-right muted">${m.debe > 0 ? fmt(m.debe) : '—'}</td>
            <td class="text-right muted">${m.haber > 0 ? fmt(m.haber) : '—'}</td>
            <td class="text-right ${saldoClass(m.saldo_corriente)}">${fmt(m.saldo_corriente)}</td>
          </tr>`).join('')}
        </tbody>
      </table>`}
    </div>`).join('')}
  </div>` : ''}

  <!-- ── CONCILIATORIA ── -->
  <div class="section">
    <h2>Conciliatoria</h2>
    ${concilSection(conciliatoria.por_moneda)}
  </div>

</body>
</html>`;
}
