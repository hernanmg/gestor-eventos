import { esc, fmtDate } from './shared';

// Orden de compra — replica la hoja "Orden de compra - DOS57/ENJOY" de
// "Ordenes de Compra y Pago.xlsx" (Mayra): título, emisor con CUIT y dirección
// a la izquierda y Nº/FECHA a la derecha; bloque PROVEEDOR (domicilio, ciudad,
// contacto, teléfono) junto a ENTREGA / DIRECCIÓN / PLAZO / PAGO; tabla
// Nº · ARTÍCULO · CANTIDAD · PRECIO UNITARIO · PRECIO TOTAL; SUB-TOTAL, IVA, TOTAL.

export interface OrdenCompraPdfData {
  empresa: { nombre: string; cuit: string | null; domicilio: string | null; telefono: string | null; email: string | null; logo: string | null };
  numero:   string;
  borrador: boolean;
  anulada:  boolean;
  fecha:    Date;
  proveedor: { nombre: string; cuit: string | null; contacto: string | null; telefono: string | null; domicilio: string | null; ciudad: string | null };
  entrega: string | null; direccion_entrega: string | null; plazo_pago: string | null; forma_pago: string | null;
  referencia: string | null; evento: string | null; notas: string | null;
  moneda: string;
  items: { n: number; codigo: string | null; descripcion: string; cantidad: number; precio: number; total: number }[];
  subtotal: number; iva_porcentaje: number; iva: number; total: number;
}

const money = (n: number, moneda: string) =>
  `${moneda === 'ARS' ? '$' : moneda === 'USD' ? 'US$' : '€'} ${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const cant = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 2 });

const STYLE = `
@page { size: A4 portrait; margin: 12mm 12mm 14mm; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: Arial, Helvetica, sans-serif; font-size: 8.6pt; color: #111; line-height: 1.3; }
.titulo { text-align: center; font-size: 15pt; font-weight: 700; letter-spacing: 1.5px; border: 1.4px solid #111; padding: 6px; }
.cab { display: grid; grid-template-columns: 1fr 62mm; border: 1.4px solid #111; border-top: none; }
.emisor { padding: 7px 9px; display: flex; gap: 9px; align-items: center; border-right: 1.4px solid #111; }
.emisor img { max-height: 18mm; max-width: 32mm; object-fit: contain; }
.emisor .razon { font-size: 11pt; font-weight: 700; }
.emisor .linea { font-size: 8pt; color: #333; }
.nro { display: grid; grid-template-columns: auto 1fr; align-content: center; gap: 4px 8px; padding: 7px 9px; }
.nro .l { font-weight: 700; font-size: 8pt; }
.nro .v { font-size: 10pt; font-weight: 700; }
.bloques { display: grid; grid-template-columns: 1fr 1fr; gap: 0; border: 1.4px solid #111; border-top: none; }
.bloques > div { padding: 5px 9px; }
.bloques > div:first-child { border-right: 1.4px solid #111; }
.campo { display: grid; grid-template-columns: 26mm 1fr; padding: 2px 0; border-bottom: 1px solid #ddd; min-height: 16px; }
.campo:last-child { border-bottom: none; }
.campo .l { font-weight: 700; font-size: 7.8pt; }
table { width: 100%; border-collapse: collapse; margin-top: 6px; }
th { background: #111; color: #fff; font-size: 7.8pt; text-align: left; padding: 4px 6px; }
td { border-bottom: 1px solid #ddd; padding: 3.5px 6px; vertical-align: top; }
td.n, th.n { width: 9mm; text-align: center; }
td.num, th.num { text-align: right; white-space: nowrap; }
td .cod { font-family: 'Courier New', monospace; font-size: 7.4pt; color: #555; }
.totales { margin-top: 6px; margin-left: auto; width: 78mm; border: 1.4px solid #111; }
.totales div { display: grid; grid-template-columns: 1fr auto; padding: 3px 8px; border-bottom: 1px solid #ccc; }
.totales div:last-child { border-bottom: none; font-weight: 700; font-size: 10pt; background: #f1f1f1; }
.notas { margin-top: 8px; border: 1px solid #bbb; padding: 5px 8px; font-size: 8pt; white-space: pre-wrap; }
.pie { margin-top: 18mm; display: grid; grid-template-columns: 1fr 1fr; gap: 16mm; padding: 0 8mm; break-inside: avoid; }
.pie div { border-top: 1px solid #111; text-align: center; padding-top: 3px; font-weight: 700; font-size: 8pt; }
.marca { position: fixed; top: 40%; left: 0; right: 0; text-align: center; font-size: 70pt; font-weight: 700;
  color: rgba(0,0,0,.07); transform: rotate(-28deg); z-index: -1; }
`;

export function templateOrdenCompra(d: OrdenCompraPdfData): string {
  const e = d.empresa;
  const p = d.proveedor;
  const campo = (l: string, v: string | null) => `<div class="campo"><span class="l">${l}</span><span>${esc(v ?? '')}</span></div>`;
  const filas = d.items.map(i => `
    <tr>
      <td class="n">${i.n}</td>
      <td>${i.codigo ? `<span class="cod">${esc(i.codigo)}</span> ` : ''}${esc(i.descripcion)}</td>
      <td class="num">${cant(i.cantidad)}</td>
      <td class="num">${money(i.precio, d.moneda)}</td>
      <td class="num">${money(i.total, d.moneda)}</td>
    </tr>`).join('');
  const marca = d.anulada ? 'ANULADA' : d.borrador ? 'BORRADOR' : '';

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><style>${STYLE}</style></head>
<body>
  ${marca ? `<div class="marca">${marca}</div>` : ''}
  <div class="titulo">ORDEN DE COMPRA</div>
  <div class="cab">
    <div class="emisor">
      ${e.logo ? `<img src="${e.logo}" alt="">` : ''}
      <div>
        <div class="razon">${esc(e.nombre)}</div>
        ${e.cuit ? `<div class="linea">CUIT: ${esc(e.cuit)}</div>` : ''}
        ${e.domicilio ? `<div class="linea">Dirección: ${esc(e.domicilio)}</div>` : ''}
        ${e.telefono ? `<div class="linea">Tel: ${esc(e.telefono)}</div>` : ''}
        ${e.email ? `<div class="linea">${esc(e.email)}</div>` : ''}
      </div>
    </div>
    <div class="nro">
      <span class="l">Nº ORDEN</span><span class="v">${esc(d.numero.replace(/^OC /, ''))}</span>
      <span class="l">FECHA</span><span class="v">${fmtDate(d.fecha)}</span>
      ${d.referencia ? `<span class="l">REFERENCIA</span><span>${esc(d.referencia)}</span>` : ''}
    </div>
  </div>
  <div class="bloques">
    <div>
      ${campo('PROVEEDOR', p.nombre)}
      ${p.cuit ? campo('CUIT', p.cuit) : ''}
      ${campo('DOMICILIO', p.domicilio)}
      ${campo('CIUDAD', p.ciudad)}
      ${campo('CONTACTO', p.contacto)}
      ${campo('TELÉFONO', p.telefono)}
    </div>
    <div>
      ${campo('ENTREGA', d.entrega)}
      ${campo('DIRECCIÓN', d.direccion_entrega)}
      ${campo('PLAZO', d.plazo_pago)}
      ${campo('PAGO', d.forma_pago)}
      ${d.evento ? campo('EVENTO', d.evento) : ''}
    </div>
  </div>
  <table>
    <thead><tr><th class="n">Nº</th><th>ARTÍCULO</th><th class="num">CANTIDAD</th><th class="num">PRECIO UNITARIO</th><th class="num">PRECIO TOTAL</th></tr></thead>
    <tbody>${filas}</tbody>
  </table>
  <div class="totales">
    <div><span>SUB-TOTAL</span><span>${money(d.subtotal, d.moneda)}</span></div>
    <div><span>IVA ${cant(d.iva_porcentaje)}%</span><span>${money(d.iva, d.moneda)}</span></div>
    <div><span>TOTAL</span><span>${money(d.total, d.moneda)}</span></div>
  </div>
  ${d.notas ? `<div class="notas">${esc(d.notas)}</div>` : ''}
  <div class="pie"><div>AUTORIZADO POR</div><div>RECIBIDO POR EL PROVEEDOR</div></div>
</body>
</html>`;
}
