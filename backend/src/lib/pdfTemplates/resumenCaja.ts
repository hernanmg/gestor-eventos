import { CSS, esc, fmt, fmtDate, saldoClass, type EventoExportData } from './shared';

export function templateResumenCaja(data: EventoExportData): string {
  const { evento, cuentas, echeqs, conciliatoria, fecha_generacion } = data;
  const pendientes = echeqs.filter(e => e.estado === 'PENDIENTE');

  // Build posición consolidada por moneda from conciliatoria data (we have cuentas with saldo_actual)
  const posMap = new Map<string, { total: number; cuentas: typeof cuentas }>();
  for (const c of cuentas) {
    if (!posMap.has(c.moneda)) posMap.set(c.moneda, { total: 0, cuentas: [] });
    const entry = posMap.get(c.moneda)!;
    entry.total += c.saldo_actual;
    entry.cuentas.push(c);
  }

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <style>${CSS}</style>
</head>
<body>
  <div class="section">
    <h1 style="font-size:15pt;">${esc(evento.nombre)}</h1>
    <div class="muted" style="font-size:8pt; margin-bottom:0.8rem;">
      Generado el ${fmtDate(fecha_generacion)}
    </div>
    <h2>Resumen de Caja</h2>
  </div>

  <!-- Posición consolidada -->
  <div class="section">
    <h3 style="margin-bottom:0.5rem;">Posición consolidada</h3>
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
      ${[...posMap.entries()].map(([moneda, { total }]) => `
      <tfoot><tr>
        <td colspan="4">Saldo total ${moneda}</td>
        <td class="text-right ${saldoClass(total)}">${fmt(total)}</td>
      </tr></tfoot>`).join('')}
    </table>
  </div>

  <!-- Por cuenta -->
  ${cuentas.map(c => `
  <div class="section">
    <div style="page-break-inside: avoid;">
      <h3>${esc(c.nombre)}</h3>
      <div class="info-grid" style="margin-bottom:0.5rem;">
        <div><span>Tipo: </span><strong>${c.tipo}</strong></div>
        <div><span>Moneda: </span><strong>${c.moneda}</strong></div>
        <div><span>Saldo inicial: </span><strong>${fmt(c.saldo_inicial)}</strong></div>
        <div><span>Saldo actual: </span><strong class="${saldoClass(c.saldo_actual)}">${fmt(c.saldo_actual)}</strong></div>
      </div>
    </div>
    ${c.movimientos.length === 0
      ? `<p class="muted" style="font-size:9pt; font-style:italic;">Sin movimientos</p>`
      : `<table>
      <thead><tr>
        <th style="width:90px;">Fecha</th>
        <th>Descripción</th>
        <th class="text-right" style="width:90px;">Debe</th>
        <th class="text-right" style="width:90px;">Haber</th>
        <th class="text-right" style="width:90px;">Saldo</th>
      </tr></thead>
      <tbody>
        ${c.movimientos.map(m => `
        <tr>
          <td class="text-center muted">${fmtDate(m.fecha)}</td>
          <td>${m.is_transfer ? '<span class="transfer-icon">&#8596; </span>' : ''}${esc(m.descripcion)}</td>
          <td class="text-right muted">${m.debe > 0 ? fmt(m.debe) : '—'}</td>
          <td class="text-right muted">${m.haber > 0 ? fmt(m.haber) : '—'}</td>
          <td class="text-right ${saldoClass(m.saldo_corriente)}">${fmt(m.saldo_corriente)}</td>
        </tr>`).join('')}
      </tbody>
    </table>`}
  </div>`).join('<div style="margin: 0.5rem 0; border-top: 1px solid #e5e7eb;"></div>')}

  <!-- Echeqs pendientes -->
  ${pendientes.length > 0 ? `
  <div class="section" style="margin-top:1.5rem;">
    <h3 style="margin-bottom:0.5rem;">Echeqs pendientes (${pendientes.length})</h3>
    <div style="font-size:8.5pt; color:#92400e; background:#fffbeb; border:1px solid #fcd34d; border-radius:4px; padding:6px 10px; margin-bottom:0.5rem;">
      &#9888; Estos importes aún no impactaron en caja
    </div>
    <table>
      <thead><tr>
        <th>N°</th>
        <th>Razón social</th>
        <th class="text-right">Importe</th>
        <th>Moneda</th>
        <th>F. Cobro estimada</th>
      </tr></thead>
      <tbody>
        ${pendientes.map(e => `
        <tr>
          <td class="muted">${esc(e.numero)}</td>
          <td>${esc(e.razon_social)}</td>
          <td class="text-right">${fmt(e.importe)}</td>
          <td class="muted">${e.moneda}</td>
          <td class="text-center muted">${fmtDate(e.fecha_cobro_estimada)}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>` : ''}
</body>
</html>`;
}
