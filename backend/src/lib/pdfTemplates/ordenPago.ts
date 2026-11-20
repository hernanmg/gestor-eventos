import { esc, fmtDate } from './shared';

// Orden de pago — replica la hoja "ORDEN DE PAGO" de "Ordenes de Compra y
// Pago.xlsx" (Mayra): título, emisor, ORDEN Nº / FECHA / PROVEEDOR (con CUIT) /
// CONCEPTO; tabla FECHA DE FACTURA · Nº FACTURA · IMPORTE TOTAL · MEDIO DE PAGO ·
// IMPORTE · FECHA DE PAGO (facturas a la izquierda, medios a la derecha, en
// filas paralelas); TOTAL A PAGAR / TOTAL PAGADO; ELABORADO / REVISADO /
// AUTORIZADO POR con nombre y firma.

export interface OrdenPagoPdfData {
  empresa: { nombre: string; cuit: string | null; domicilio: string | null; telefono: string | null; email: string | null; logo: string | null };
  numero:    string;
  borrador:  boolean;
  anulada:   boolean;
  fecha:     Date;
  proveedor: { nombre: string; cuit: string | null };
  concepto:  string | null;
  moneda:    string;
  facturas:  { fecha: Date; numero: string; importe: number; total_factura: number }[];
  medios:    { medio: string; importe: number; fecha: Date }[];
  total_facturas: number;
  total_pagos:    number;
  elaborado:  string | null;
  revisado:   string | null;
  autorizado: string | null;
  notas:      string | null;
}

const money = (n: number, moneda: string) =>
  `${moneda === 'ARS' ? '$' : moneda === 'USD' ? 'US$' : '€'} ${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const STYLE = `
@page { size: A4 portrait; margin: 12mm 12mm 14mm; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: Arial, Helvetica, sans-serif; font-size: 8.6pt; color: #111; line-height: 1.3; }
.titulo { text-align: center; font-size: 15pt; font-weight: 700; letter-spacing: 1.5px; border: 1.4px solid #111; padding: 6px; }
.cab { border: 1.4px solid #111; border-top: none; padding: 7px 9px; display: flex; gap: 9px; align-items: center; }
.cab img { max-height: 18mm; max-width: 32mm; object-fit: contain; }
.cab .razon { font-size: 11pt; font-weight: 700; }
.cab .linea { font-size: 8pt; color: #333; }
.datos { display: grid; grid-template-columns: 24mm 34mm 24mm 1fr; border: 1.4px solid #111; border-top: none; }
.datos span { padding: 4px 7px; border-bottom: 1px solid #ccc; }
.datos .l { font-weight: 700; font-size: 7.8pt; background: #f1f1f1; }
.datos .ult { border-bottom: none; }
table { width: 100%; border-collapse: collapse; margin-top: 6px; }
th { background: #111; color: #fff; font-size: 7.6pt; text-align: left; padding: 4px 6px; }
td { border-bottom: 1px solid #ddd; padding: 3.5px 6px; vertical-align: top; }
td.num, th.num { text-align: right; white-space: nowrap; }
td.sep, th.sep { border-left: 1.4px solid #111; }
.sub { color: #666; font-size: 7.2pt; }
tr.tot td { border-top: 1.4px solid #111; border-bottom: none; font-weight: 700; font-size: 9.5pt; background: #f1f1f1; }
.notas { margin-top: 8px; border: 1px solid #bbb; padding: 5px 8px; font-size: 8pt; white-space: pre-wrap; }
.firmas { margin-top: 10mm; display: grid; grid-template-columns: 1fr 1fr 1fr; border: 1.4px solid #111; break-inside: avoid; }
.firmas > div { padding: 5px 8px; }
.firmas > div + div { border-left: 1.4px solid #111; }
.firmas .l { font-weight: 700; font-size: 7.8pt; }
.firmas .nom { min-height: 13px; margin-top: 3px; }
.firmas .firma { margin-top: 14mm; border-top: 1px solid #111; text-align: center; font-size: 7.6pt; padding-top: 2px; }
.marca { position: fixed; top: 40%; left: 0; right: 0; text-align: center; font-size: 70pt; font-weight: 700;
  color: rgba(0,0,0,.07); transform: rotate(-28deg); z-index: -1; }
`;

export function templateOrdenPago(d: OrdenPagoPdfData): string {
  const e = d.empresa;
  const n = Math.max(d.facturas.length, d.medios.length, 1);
  const filas = Array.from({ length: n }, (_, i) => {
    const f = d.facturas[i];
    const m = d.medios[i];
    const parcial = f && Math.abs(f.importe - f.total_factura) > 0.01;
    return `<tr>
      <td>${f ? fmtDate(f.fecha) : ''}</td>
      <td>${f ? esc(f.numero) : ''}</td>
      <td class="num">${f ? money(f.importe, d.moneda) + (parcial ? `<div class="sub">de ${money(f.total_factura, d.moneda)}</div>` : '') : ''}</td>
      <td class="sep">${m ? esc(m.medio) : ''}</td>
      <td class="num">${m ? money(m.importe, d.moneda) : ''}</td>
      <td>${m ? fmtDate(m.fecha) : ''}</td>
    </tr>`;
  }).join('');
  const marca = d.anulada ? 'ANULADA' : d.borrador ? 'BORRADOR' : '';
  const firma = (titulo: string, nombre: string | null) =>
    `<div><div class="l">${titulo}</div><div class="nom"><span class="l">Nombre y apellido:</span> ${esc(nombre ?? '')}</div><div class="firma">FIRMA</div></div>`;

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><style>${STYLE}</style></head>
<body>
  ${marca ? `<div class="marca">${marca}</div>` : ''}
  <div class="titulo">ORDEN DE PAGO</div>
  <div class="cab">
    ${e.logo ? `<img src="${e.logo}" alt="">` : ''}
    <div>
      <div class="razon">${esc(e.nombre)}</div>
      ${e.cuit ? `<div class="linea">CUIT: ${esc(e.cuit)}</div>` : ''}
      ${e.domicilio ? `<div class="linea">Dirección: ${esc(e.domicilio)}</div>` : ''}
      ${e.telefono ? `<div class="linea">Tel: ${esc(e.telefono)}</div>` : ''}
      ${e.email ? `<div class="linea">${esc(e.email)}</div>` : ''}
    </div>
  </div>
  <div class="datos">
    <span class="l">ORDEN Nº</span><span><b>${esc(d.numero.replace(/^OP /, ''))}</b></span>
    <span class="l">PROVEEDOR</span><span>${esc(d.proveedor.nombre)}${d.proveedor.cuit ? ` &nbsp; ${esc(d.proveedor.cuit)}` : ''}</span>
    <span class="l ult">FECHA</span><span class="ult">${fmtDate(d.fecha)}</span>
    <span class="l ult">CONCEPTO</span><span class="ult">${esc(d.concepto ?? '')}</span>
  </div>
  <table>
    <thead><tr>
      <th>FECHA DE FACTURA</th><th>Nº FACTURA</th><th class="num">IMPORTE</th>
      <th class="sep">MEDIO DE PAGO</th><th class="num">IMPORTE</th><th>FECHA DE PAGO</th>
    </tr></thead>
    <tbody>
      ${filas}
      <tr class="tot">
        <td colspan="2">TOTAL A PAGAR</td><td class="num">${money(d.total_facturas, d.moneda)}</td>
        <td class="sep">TOTAL PAGADO</td><td class="num">${money(d.total_pagos, d.moneda)}</td><td></td>
      </tr>
    </tbody>
  </table>
  ${d.notas ? `<div class="notas">${esc(d.notas)}</div>` : ''}
  <div class="firmas">
    ${firma('ELABORADO POR', d.elaborado)}
    ${firma('REVISADO POR', d.revisado)}
    ${firma('AUTORIZADO POR', d.autorizado)}
  </div>
</body>
</html>`;
}
