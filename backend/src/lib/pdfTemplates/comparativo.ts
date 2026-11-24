import { esc, fmtDate } from './shared';

// Comparativo de presupuestos: los artículos en filas y un proveedor por
// columna (precio unitario y total de la línea). El precio más bajo de cada
// artículo va resaltado; abajo, subtotal, IVA, total y condiciones de cada uno.

export interface ComparativoPdfData {
  empresa: { nombre: string; cuit: string | null; logo: string | null };
  numero: string; fecha: Date; titulo: string; evento: string | null; moneda: string; notas: string | null; anulado: boolean;
  items: { n: number; codigo: string | null; descripcion: string; cantidad: number }[];
  cotizaciones: {
    id: number; proveedor: string; referencia: string | null; plazo_entrega: string | null; plazo_pago: string | null; forma_pago: string | null; validez: string | null;
    precios: (number | null)[]; subtotal: number; iva_porcentaje: number; total: number;
  }[];
  minimos: (number | null)[];
  mas_baratas: number[];
  elegida_id: number | null;
  motivo: string | null;
}

const money = (n: number, moneda: string) =>
  `${moneda === 'ARS' ? '$' : moneda === 'USD' ? 'US$' : '€'} ${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const cant = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 2 });

const STYLE = `
@page { size: A4 landscape; margin: 10mm 10mm 12mm; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: Arial, Helvetica, sans-serif; font-size: 8pt; color: #111; line-height: 1.3; }
.cab { display: flex; justify-content: space-between; align-items: center; border: 1.4px solid #111; padding: 6px 9px; gap: 10px; }
.cab .emisor { display: flex; align-items: center; gap: 9px; }
.cab img { max-height: 14mm; max-width: 30mm; object-fit: contain; }
.cab .razon { font-size: 10.5pt; font-weight: 700; }
.cab .titulo { font-size: 13pt; font-weight: 700; letter-spacing: 1px; text-align: center; }
.cab .nro { text-align: right; font-size: 8.5pt; }
.cab .nro b { font-size: 10pt; }
.sub { border: 1.4px solid #111; border-top: none; padding: 4px 9px; display: flex; gap: 18px; font-size: 8.5pt; }
.sub b { font-weight: 700; }
table { width: 100%; border-collapse: collapse; margin-top: 6px; table-layout: fixed; }
th { background: #111; color: #fff; font-size: 7.6pt; padding: 4px 5px; text-align: center; vertical-align: bottom; }
th.izq { text-align: left; }
th.elegida { background: #1f6f3f; }
td { border-bottom: 1px solid #ddd; padding: 3px 5px; vertical-align: top; }
td.n { text-align: center; width: 8mm; }
td.num { text-align: right; white-space: nowrap; }
td .cod { font-family: 'Courier New', monospace; font-size: 7pt; color: #555; }
td.p { text-align: right; white-space: nowrap; }
td.p .u { display: block; }
td.p .t { display: block; color: #555; font-size: 7pt; }
td.min { background: #e3f4e8; font-weight: 700; }
td.nc { text-align: center; color: #999; }
tr.tot td { border-bottom: 1px solid #bbb; background: #f6f6f6; }
tr.tot td.l { text-align: right; font-weight: 700; }
tr.total td { font-weight: 700; font-size: 9pt; background: #ececec; }
tr.total td.barata { background: #cdeed8; }
tr.cond td { font-size: 7.4pt; color: #333; text-align: right; }
.badge { display: inline-block; font-size: 6.8pt; font-weight: 700; padding: 1px 4px; border-radius: 3px; margin-top: 2px; }
.badge.b { background: #cdeed8; color: #145c2e; }
.badge.e { background: #fff; color: #1f6f3f; }
.decision { margin-top: 8px; border: 1.4px solid #1f6f3f; padding: 5px 8px; font-size: 8.5pt; }
.notas { margin-top: 6px; border: 1px solid #bbb; padding: 4px 8px; white-space: pre-wrap; }
.ref { margin-top: 6px; font-size: 7.4pt; color: #444; }
.marca { position: fixed; top: 35%; left: 0; right: 0; text-align: center; font-size: 70pt; font-weight: 700;
  color: rgba(0,0,0,.07); transform: rotate(-20deg); z-index: -1; }
`;

export function templateComparativo(d: ComparativoPdfData): string {
  const e = d.empresa;
  const m = d.moneda;
  const cols = d.cotizaciones;
  const head = cols.map(q => {
    const eleg = q.id === d.elegida_id;
    return `<th class="${eleg ? 'elegida' : ''}">${esc(q.proveedor)}${q.referencia ? `<br><span style="font-weight:400">Ref. ${esc(q.referencia)}</span>` : ''}${eleg ? '<br><span class="badge e">ELEGIDO</span>' : ''}</th>`;
  }).join('');
  const filas = d.items.map((it, i) => {
    const celdas = cols.map(q => {
      const p = q.precios[i];
      if (p == null) return '<td class="nc">no cotizó</td>';
      const esMin = d.minimos[i] != null && Math.abs(p - d.minimos[i]!) < 0.005 && cols.length > 1;
      return `<td class="p${esMin ? ' min' : ''}"><span class="u">${money(p, m)}</span><span class="t">${money(p * it.cantidad, m)}</span></td>`;
    }).join('');
    return `<tr><td class="n">${it.n}</td><td>${it.codigo ? `<span class="cod">${esc(it.codigo)}</span> ` : ''}${esc(it.descripcion)}</td><td class="num">${cant(it.cantidad)}</td>${celdas}</tr>`;
  }).join('');
  const fila = (clase: string, label: string, f: (q: ComparativoPdfData['cotizaciones'][number]) => string, extra?: (q: ComparativoPdfData['cotizaciones'][number]) => string) =>
    `<tr class="${clase}"><td colspan="3" class="l" style="text-align:right">${label}</td>${cols.map(q => `<td class="num ${extra ? extra(q) : ''}">${f(q)}</td>`).join('')}</tr>`;
  const cond = (label: string, f: (q: ComparativoPdfData['cotizaciones'][number]) => string | null) =>
    cols.some(q => f(q)) ? `<tr class="cond"><td colspan="3" style="text-align:right;font-weight:700">${label}</td>${cols.map(q => `<td>${esc(f(q) ?? '—')}</td>`).join('')}</tr>` : '';
  const elegida = cols.find(q => q.id === d.elegida_id);
  const anchoArt = Math.max(55, 120 - cols.length * 14);

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><style>${STYLE}</style></head>
<body>
  ${d.anulado ? '<div class="marca">ANULADO</div>' : ''}
  <div class="cab">
    <div class="emisor">
      ${e.logo ? `<img src="${e.logo}">` : ''}
      <div><div class="razon">${esc(e.nombre)}</div>${e.cuit ? `<div>CUIT ${esc(e.cuit)}</div>` : ''}</div>
    </div>
    <div class="titulo">COMPARATIVO DE PRESUPUESTOS</div>
    <div class="nro"><b>${esc(d.numero)}</b><br>${fmtDate(d.fecha)}</div>
  </div>
  <div class="sub"><span><b>Compra:</b> ${esc(d.titulo)}</span>${d.evento ? `<span><b>Evento:</b> ${esc(d.evento)}</span>` : ''}<span><b>Moneda:</b> ${esc(m)}</span></div>
  <table>
    <colgroup><col style="width:8mm"><col style="width:${anchoArt}mm"><col style="width:16mm">${cols.map(() => '<col>').join('')}</colgroup>
    <thead><tr><th>Nº</th><th class="izq">ARTÍCULO</th><th>CANT.</th>${head}</tr></thead>
    <tbody>
      ${filas}
      ${fila('tot', 'SUBTOTAL', q => money(q.subtotal, m))}
      ${fila('tot', 'IVA', q => `${cant(q.iva_porcentaje)}% · ${money(q.total - q.subtotal, m)}`)}
      ${fila('total', 'TOTAL', q => `${money(q.total, m)}${d.mas_baratas.includes(q.id) && cols.length > 1 ? '<br><span class="badge b">MÁS BARATO</span>' : ''}`, q => d.mas_baratas.includes(q.id) && cols.length > 1 ? 'barata' : '')}
      ${cond('Entrega', q => q.plazo_entrega)}
      ${cond('Plazo de pago', q => q.plazo_pago)}
      ${cond('Forma de pago', q => q.forma_pago)}
      ${cond('Validez', q => q.validez)}
    </tbody>
  </table>
  <p class="ref">En verde, el precio más bajo de cada artículo. "No cotizó" no suma al total de ese proveedor.</p>
  ${elegida ? `<div class="decision"><b>Elegido:</b> ${esc(elegida.proveedor)} por ${money(elegida.total, m)}${d.motivo ? ` — ${esc(d.motivo)}` : ''}</div>` : ''}
  ${d.notas ? `<div class="notas">${esc(d.notas)}</div>` : ''}
</body>
</html>`;
}
