import { CSS, esc, fmt, fmtDate, saldoClass, saldoBoxClass, type EventoExportData, type ConcilMoneda } from './shared';

function concilMonedaHtml(pm: ConcilMoneda): string {
  const buildTabRows = (rows: ConcilMoneda['ingresos']): string =>
    rows.map(t => `
      <tr>
        <td>${esc(t.nombre)}</td>
        <td class="text-right muted">${fmt(t.total_debe)}</td>
        <td class="text-right muted">${fmt(t.total_haber)}</td>
        <td class="text-right ${saldoClass(t.saldo)}">${fmt(t.saldo)}</td>
      </tr>`).join('');

  const ingTotalSaldo = pm.ingresos.reduce((a, t) => a + t.saldo, 0);
  const egTotalSaldo  = pm.egresos.reduce((a, t) => a + t.saldo, 0);

  return `
    <h3>Moneda: ${esc(pm.moneda)}</h3>

    <h4 style="margin-top:0.8rem; margin-bottom:0.3rem;">Ingresos</h4>
    <table>
      <thead><tr>
        <th>Pestaña</th>
        <th class="text-right">Debe</th>
        <th class="text-right">Haber</th>
        <th class="text-right">Saldo</th>
      </tr></thead>
      <tbody>${buildTabRows(pm.ingresos)}</tbody>
      <tfoot><tr>
        <td>Total ingresos</td>
        <td class="text-right">${fmt(pm.ingresos.reduce((a, t) => a + t.total_debe, 0))}</td>
        <td class="text-right">${fmt(pm.ingresos.reduce((a, t) => a + t.total_haber, 0))}</td>
        <td class="text-right ${saldoClass(ingTotalSaldo)}">${fmt(ingTotalSaldo)}</td>
      </tr></tfoot>
    </table>

    <h4 style="margin-bottom:0.3rem;">Egresos</h4>
    <table>
      <thead><tr>
        <th>Pestaña</th>
        <th class="text-right">Debe</th>
        <th class="text-right">Haber</th>
        <th class="text-right">Saldo</th>
      </tr></thead>
      <tbody>${buildTabRows(pm.egresos)}</tbody>
      <tfoot><tr>
        <td>Total egresos</td>
        <td class="text-right">${fmt(pm.egresos.reduce((a, t) => a + t.total_debe, 0))}</td>
        <td class="text-right">${fmt(pm.egresos.reduce((a, t) => a + t.total_haber, 0))}</td>
        <td class="text-right ${saldoClass(egTotalSaldo)}">${fmt(egTotalSaldo)}</td>
      </tr></tfoot>
    </table>

    <div class="${saldoBoxClass(pm.saldo_final)}">
      <div>
        <div style="font-size:8pt; font-weight:400; margin-bottom:2px;">
          Ingresos: ${fmt(pm.total_ingresos)} &nbsp;|&nbsp; Egresos: ${fmt(pm.total_egresos)}
        </div>
        <span style="font-size:10pt;">SALDO FINAL</span>
      </div>
      <span style="font-size:14pt;">${fmt(pm.saldo_final)}</span>
    </div>

    ${pm.distribucion_socios.length > 0 ? `
    <h4 style="margin-top:0.8rem; margin-bottom:0.3rem;">Distribución de socios</h4>
    <table>
      <thead><tr>
        <th>Socio</th>
        <th class="text-right">Porcentaje</th>
        <th class="text-right">Monto</th>
      </tr></thead>
      <tbody>
        ${pm.distribucion_socios.map(s => `
        <tr>
          <td>${esc(s.nombre)}</td>
          <td class="text-right muted">${s.porcentaje}%</td>
          <td class="text-right ${saldoClass(s.monto)}">${fmt(s.monto)}</td>
        </tr>`).join('')}
      </tbody>
    </table>` : ''}
  `;
}

export function templateConciliatoria(data: EventoExportData): string {
  const { evento, conciliatoria, cuentas, echeqs, fecha_generacion } = data;
  const pendientes = echeqs.filter(e => e.estado === 'PENDIENTE');

  const totMap = new Map<string, number>();
  for (const e of pendientes) totMap.set(e.moneda, (totMap.get(e.moneda) ?? 0) + e.importe);

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <style>${CSS}</style>
</head>
<body>
  <div class="section">
    <div style="margin-bottom:1rem;">
      <h1 style="font-size:15pt;">${esc(evento.nombre)}</h1>
      <span class="badge badge-${evento.estado}">${evento.estado}</span>
      <span class="muted" style="font-size:8pt; margin-left:8px;">
        Generado el ${fmtDate(fecha_generacion)}
      </span>
    </div>
    <h2>Conciliatoria</h2>
  </div>

  ${conciliatoria.por_moneda.map(pm => `
  <div class="section no-break">
    ${concilMonedaHtml(pm)}
  </div>`).join('<hr style="margin:1rem 0; border-color:#e5e7eb;">')}

  ${cuentas.length > 0 ? `
  <div class="section" style="margin-top:1.5rem;">
    <h2>Caja — Posición actual</h2>
    <table>
      <thead><tr>
        <th>Cuenta</th>
        <th>Tipo</th>
        <th>Moneda</th>
        <th class="text-right">Saldo inicial</th>
        <th class="text-right">Saldo actual</th>
      </tr></thead>
      <tbody>
        ${cuentas.map(c => `
        <tr>
          <td>${esc(c.nombre)}</td>
          <td class="muted">${c.tipo}</td>
          <td class="muted">${c.moneda}</td>
          <td class="text-right muted">${fmt(c.saldo_inicial)}</td>
          <td class="text-right ${saldoClass(c.saldo_actual)}">${fmt(c.saldo_actual)}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>` : ''}

  ${pendientes.length > 0 ? `
  <div class="section no-break" style="margin-top:1rem; padding:10px 14px; background:#fffbeb; border:1px solid #fcd34d; border-radius:6px;">
    <div style="font-weight:700; margin-bottom:4px; font-size:9pt; color:#92400e;">
      &#9888; ${pendientes.length} echeq${pendientes.length !== 1 ? 's' : ''} pendiente${pendientes.length !== 1 ? 's' : ''} — aún no impactaron en caja
    </div>
    ${[...totMap.entries()].map(([m, t]) => `
    <div style="font-size:9pt; color:#92400e;">
      Total ${m}: <strong>${fmt(t)}</strong>
    </div>`).join('')}
  </div>` : ''}
</body>
</html>`;
}
