import { CSS, esc, fmt, fmtDate } from './shared';

export interface TarjetaCorporativaPdfData {
  tarjeta: string;
  empresa: string;
  mes:     number;
  anio:    number;
  resumen: {
    por_responsable: { nombre: string; tipo: string; consumos: number; total_ars: number; total_usd: number }[];
    total_ars: number;
    total_usd: number;
  };
  consumos: {
    responsable:    string;
    tipo:           string;
    fecha:          Date;
    monto_ars:      number | null;
    monto_usd:      number | null;
    detalle:        string | null;
    observaciones:  string | null;
    empresa_imputa: string | null;
    descontado:     boolean;
  }[];
}

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const EXTRA_CSS = `
.badge-desc   { background: #fee2e2; color: #b91c1c; }
.badge-nodesc { background: #f3f4f6; color: #4b5563; }
td.obs { font-size: 7.5pt; color: #4b5563; }
`;

export function templateTarjetaCorporativa(d: TarjetaCorporativaPdfData): string {
  // El tipo sólo se muestra para los responsables divididos (ANDRE PERSONAL / EMPRESA).
  const nombres = new Map<string, Set<string>>();
  for (const r of d.resumen.por_responsable) {
    if (!nombres.has(r.nombre)) nombres.set(r.nombre, new Set());
    nombres.get(r.nombre)!.add(r.tipo);
  }
  const etiqueta = (nombre: string, tipo: string) =>
    (nombres.get(nombre)?.size ?? 0) > 1 || tipo === 'EMPRESA' ? `${nombre} ${tipo}` : nombre;

  const resumenRows = d.resumen.por_responsable.map(r => `
    <tr>
      <td>${esc(etiqueta(r.nombre, r.tipo))}</td>
      <td class="text-right">${r.consumos}</td>
      <td class="text-right">$ ${fmt(r.total_ars)}</td>
      <td class="text-right">${r.total_usd ? `USD ${fmt(r.total_usd)}` : '—'}</td>
    </tr>`).join('');

  const detalleRows = d.consumos.map(c => {
    const noDesc = /NO SE DESCONT/i.test((c.observaciones ?? '').normalize('NFD').replace(/[̀-ͯ]/g, ''));
    const badge = noDesc ? '<span class="badge badge-nodesc">No descontado</span>'
      : c.descontado ? '<span class="badge badge-desc">Descontado</span>' : '';
    return `
    <tr>
      <td>${esc(etiqueta(c.responsable, c.tipo))}</td>
      <td>${fmtDate(c.fecha)}</td>
      <td class="text-right">${c.monto_ars != null ? fmt(c.monto_ars) : ''}</td>
      <td class="text-right">${c.monto_usd != null ? fmt(c.monto_usd) : ''}</td>
      <td>${esc(c.detalle)}</td>
      <td class="obs">${esc(c.observaciones)} ${badge}</td>
      <td>${esc(c.empresa_imputa)}</td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><style>${CSS}${EXTRA_CSS}</style></head>
<body>
  <h1>${esc(d.tarjeta)} — ${MESES[d.mes - 1]} ${d.anio}</h1>
  <div class="info-grid">
    <span>Empresa: <strong>${esc(d.empresa)}</strong></span>
    <span>Consumos: <strong>${d.consumos.length}</strong></span>
    <span>Total período: <strong>$ ${fmt(d.resumen.total_ars)}</strong></span>
    <span>Total USD: <strong>USD ${fmt(d.resumen.total_usd)}</strong></span>
  </div>

  <div class="section no-break">
    <h2>Resumen por responsable</h2>
    <table>
      <thead><tr><th>Responsable</th><th class="text-right">Consumos</th><th class="text-right">Total $</th><th class="text-right">Total USD</th></tr></thead>
      <tbody>${resumenRows}</tbody>
      <tfoot><tr><td>TOTAL</td><td class="text-right">${d.consumos.length}</td><td class="text-right">$ ${fmt(d.resumen.total_ars)}</td><td class="text-right">USD ${fmt(d.resumen.total_usd)}</td></tr></tfoot>
    </table>
  </div>

  <div class="section">
    <h2>Detalle de consumos</h2>
    ${d.consumos.length ? `
    <table>
      <thead><tr><th>Responsable</th><th>Fecha</th><th class="text-right">Monto $</th><th class="text-right">Monto USD</th><th>Detalle</th><th>Observaciones</th><th>Empresa</th></tr></thead>
      <tbody>${detalleRows}</tbody>
    </table>` : '<p class="muted">Sin consumos en el período.</p>'}
  </div>
</body>
</html>`;
}
