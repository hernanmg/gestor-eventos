import { esc, fmtDate } from './shared';
import { claveItemRemito, type TipoRemitoInfo } from '../../data/remitosItemsCatalog';

// Remito DOS57 — replica la planilla DOS57_REMITOS_2026.xlsx: caja "R" al
// centro, Nº + tipo + fecha a la derecha, datos fiscales, encabezado de 4
// renglones y la tabla de ítems en DOS columnas paralelas. Se imprimen TODOS
// los ítems del catálogo del tipo: los cargados con su cantidad, el resto con
// la casilla vacía para completar a mano. Pie: FIRMA / ACLARACIÓN.

export interface RemitoPdfData {
  empresa: {
    nombre:    string;
    cuit:      string | null;
    domicilio: string | null;
    telefono:  string | null;
    email:     string | null;
    web:       string | null;
    logo:      string | null; // data URI
    fiscal:    string[];      // renglones fijos: condición IVA, IIBB, inicio de actividades...
  };
  tipo:              TipoRemitoInfo;
  numero:            string; // "Nº 0001 - LAYHER"
  borrador:          boolean;
  fecha:             Date;
  evento:            string;
  cliente:           string | null;
  domicilio:         string | null;
  localidad:         string | null;
  telefono:          string | null;
  chofer:            string | null;
  chasis_acoplado:   string | null;
  responsable_carga: string | null;
  items:             { codigo?: string; descripcion: string; cantidad: number }[];
}

// El catálogo guarda los códigos como "2604050.0" (artefacto del float del
// Excel); la planilla impresa los muestra enteros.
const fmtCodigo = (c: string | undefined) => (c ?? '').replace(/\.0$/, '');
const fmtCant = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 2 });

const STYLE = `
@page { size: A4 portrait; margin: 9mm 9mm 12mm; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: Arial, Helvetica, sans-serif; font-size: 7.6pt; color: #111; line-height: 1.25; }

.top { display: grid; grid-template-columns: 1fr 16mm 1fr; border: 1.2px solid #111; }
.top .emisor { padding: 6px 8px; display: flex; gap: 8px; align-items: center; border-right: 1.2px solid #111; }
.top .emisor img { max-height: 20mm; max-width: 34mm; object-fit: contain; }
.top .emisor .razon { font-size: 11pt; font-weight: 700; }
.top .emisor .linea { font-size: 7pt; color: #333; }
.top .letra { display: flex; flex-direction: column; align-items: center; justify-content: flex-start; border-right: 1.2px solid #111; }
.top .letra .r { font-size: 24pt; font-weight: 700; line-height: 1; padding: 5px 0 2px; }
.top .letra .cod { font-size: 5.5pt; color: #444; text-align: center; }
.top .comp { padding: 6px 8px; }
.top .comp .titulo { font-size: 8pt; font-weight: 700; letter-spacing: .5px; }
.top .comp .nro { font-size: 13pt; font-weight: 700; margin: 2px 0; }
.top .comp .fecha { font-size: 9pt; margin-bottom: 3px; }
.top .comp .fiscal { font-size: 7pt; color: #333; }
.top .comp .nvf { margin-top: 4px; font-size: 7.5pt; font-weight: 700; border: 1px solid #111; display: inline-block; padding: 1px 5px; }

.enc { display: grid; grid-template-columns: 1fr 1fr; border: 1.2px solid #111; border-top: none; }
.enc div { padding: 3.5px 8px; border-bottom: 1px solid #bbb; font-size: 8pt; min-height: 17px; }
.enc div:nth-child(odd) { border-right: 1px solid #bbb; }
.enc div:nth-last-child(-n+2) { border-bottom: none; }
.enc .lbl { font-weight: 700; margin-right: 4px; }

.hdrs { margin-top: 5px; display: grid; grid-template-columns: 1fr 1fr; column-gap: 5mm; }
.items { column-count: 2; column-gap: 5mm; column-fill: balance; }
.hdr, .cat, .row { display: grid; break-inside: avoid; }
.con-codigo .hdr, .con-codigo .cat, .con-codigo .row { grid-template-columns: 15mm 1fr 12mm; }
.sin-codigo .hdr, .sin-codigo .cat, .sin-codigo .row { grid-template-columns: 1fr 12mm; }
.hdr { background: #111; color: #fff; font-weight: 700; font-size: 7pt; }
.hdr span { padding: 2px 4px; }
.cat { background: #e5e5e5; font-weight: 700; font-size: 7.4pt; margin-top: 2px; border: 1px solid #999; break-after: avoid; }
.cat span { padding: 1.5px 4px; grid-column: 1 / -1; }
.row { border-bottom: 1px solid #ddd; border-left: 1px solid #ddd; border-right: 1px solid #ddd; }
.row span { padding: 1.6px 4px; }
.row .codigo { font-family: 'Courier New', monospace; font-size: 6.8pt; color: #444; }
.row .cant { border-left: 1px solid #999; text-align: right; }
.row.cargado { background: #f3f3f3; }
.row.cargado .desc { font-weight: 700; }
.row.cargado .cant { font-weight: 700; font-size: 8.4pt; }
.row.fuera .desc { font-style: italic; }
.c-r { text-align: right; }

.pie { margin-top: 10mm; display: grid; grid-template-columns: 1fr 1fr; gap: 14mm; padding: 0 6mm; break-inside: avoid; }
.pie div { border-top: 1px solid #111; text-align: center; padding-top: 3px; font-weight: 700; font-size: 8pt; }
.resumen { margin-top: 4px; font-size: 7pt; color: #444; }

.marca-borrador { position: fixed; top: 42%; left: 0; right: 0; text-align: center; font-size: 72pt; font-weight: 700;
  color: rgba(0,0,0,.06); transform: rotate(-28deg); pointer-events: none; z-index: -1; }
`;

export function templateRemito(d: RemitoPdfData): string {
  const conCodigo = d.tipo.conCodigo;
  const cantidades = new Map(d.items.map(i => [claveItemRemito(i), i.cantidad]));
  const enCatalogo = new Set<string>();

  const fila = (codigo: string | undefined, descripcion: string, cantidad: number | undefined, extra = '') => `
    <div class="row${cantidad ? ' cargado' : ''}${extra}">
      ${conCodigo ? `<span class="codigo">${esc(fmtCodigo(codigo))}</span>` : ''}
      <span class="desc">${esc(descripcion)}</span>
      <span class="cant">${cantidad ? fmtCant(cantidad) : ''}</span>
    </div>`;

  let cuerpo = d.tipo.categorias.map(cat => `
    <div class="cat"><span>${esc(cat.categoria)}</span></div>
    ${cat.items.map(it => {
      const clave = claveItemRemito(it);
      enCatalogo.add(clave);
      return fila(it.codigo, it.descripcion, cantidades.get(clave));
    }).join('')}`).join('');

  // Ítems guardados que ya no están en el catálogo (si el catálogo cambia
  // después de cargar el remito): se imprimen igual, al final.
  const fuera = d.items.filter(i => !enCatalogo.has(claveItemRemito(i)));
  if (fuera.length) {
    cuerpo += `<div class="cat"><span>OTROS (fuera de catálogo)</span></div>${fuera.map(i => fila(i.codigo, i.descripcion, i.cantidad, ' fuera')).join('')}`;
  }

  const clsCodigo = conCodigo ? 'con-codigo' : 'sin-codigo';
  const hdr = `<div class="hdr">${conCodigo ? '<span>CÓDIGO</span>' : ''}<span>DESCRIPCIÓN</span><span class="c-r">CANT.</span></div>`;
  const totalUnidades = d.items.reduce((s, i) => s + i.cantidad, 0);
  const campo = (lbl: string, v: string | null) => `<div><span class="lbl">${lbl}:</span>${esc(v ?? '')}</div>`;
  const e = d.empresa;
  const contacto = [e.telefono && `Tel. ${e.telefono}`, e.email, e.web].filter(Boolean).join(' · ');

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><style>${STYLE}</style></head>
<body>
  ${d.borrador ? '<div class="marca-borrador">BORRADOR</div>' : ''}
  <div class="top">
    <div class="emisor">
      ${e.logo ? `<img src="${e.logo}" alt="">` : ''}
      <div>
        <div class="razon">${esc(e.nombre)}</div>
        ${e.domicilio ? `<div class="linea">${esc(e.domicilio)}</div>` : ''}
        ${contacto ? `<div class="linea">${esc(contacto)}</div>` : ''}
        ${e.fiscal.slice(0, 2).map(l => `<div class="linea">${esc(l)}</div>`).join('')}
      </div>
    </div>
    <div class="letra"><div class="r">R</div><div class="cod">REMITO</div></div>
    <div class="comp">
      <div class="titulo">REMITO</div>
      <div class="nro">${esc(d.numero)}</div>
      <div class="fecha"><strong>FECHA:</strong> ${fmtDate(d.fecha)}</div>
      ${e.cuit ? `<div class="fiscal">CUIT: ${esc(e.cuit)}</div>` : ''}
      ${e.fiscal.slice(2).map(l => `<div class="fiscal">${esc(l)}</div>`).join('')}
      <div class="nvf">DOCUMENTO NO VÁLIDO COMO FACTURA</div>
    </div>
  </div>

  <div class="enc">
    ${campo('CLIENTE', d.cliente)}
    ${campo('EVENTO', d.evento)}
    ${campo('DOMICILIO', d.domicilio)}
    ${campo('LOCALIDAD', d.localidad)}
    ${campo('TELÉFONO DE CONTACTO', d.telefono)}
    ${campo('CHOFER', d.chofer)}
    ${campo('CHASIS / ACOPLADO', d.chasis_acoplado)}
    ${campo('RESPONSABLE DE CARGA', d.responsable_carga)}
  </div>

  <div class="hdrs ${clsCodigo}">${hdr}${hdr}</div>
  <div class="items ${clsCodigo}">${cuerpo}</div>
  <div class="resumen">${d.items.length} ítem(s) cargado(s) · ${fmtCant(totalUnidades)} unidad(es)</div>

  <div class="pie"><div>FIRMA</div><div>ACLARACIÓN</div></div>
</body>
</html>`;
}
