import { CSS } from './shared';

export interface LiquidacionAdminPdfData {
  empresa: { nombre: string; logo_data_url: string | null };
  empleado: { nombre: string; apellido: string; dni: string | null };
  escalafon: string | null;
  periodo_mes: number;
  periodo_anio: number;
  sueldo_basico: number;
  horas_acordadas: number;
  horas_trabajadas: number;
  horas_extras: number;
  valor_hora_extra: number | null;
  importe_horas_extras: number;
  premio_incentivo: number;
  viatico: number;
  premio_presentismo: number;
  antiguedad_anios: number;
  importe_antiguedad: number;
  telefono: number;
  vacaciones_aguinaldo: number;
  vales_descuentos: number;
  prestamos_descontados: number;
  subtotal_bruto: number;
  total_a_cobrar: number;
  splits: { empresa_nombre: string; porcentaje: number; monto: number }[] | null;
  estado: string;
  jornadas: { fecha: Date; horas: number }[];
  prestamos_pagos: { detalle: string; monto: number }[];
  fecha_generacion: Date;
}

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function fmtFecha(d: Date): string {
  const date = new Date(d);
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${date.getUTCFullYear()}`;
}

function fmtMoneda(n: number): string {
  return `$${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function templateLiquidacionAdmin(d: LiquidacionAdminPdfData): string {
  const conceptos: { label: string; monto: number }[] = [
    { label: 'Sueldo Básico', monto: d.sueldo_basico },
    { label: 'Premio incentivo', monto: d.premio_incentivo },
    { label: 'Viático', monto: d.viatico },
    { label: 'Premio Presentismo', monto: d.premio_presentismo },
    { label: `Antigüedad (${d.antiguedad_anios} año${d.antiguedad_anios !== 1 ? 's' : ''})`, monto: d.importe_antiguedad },
    { label: 'Teléfono', monto: d.telefono },
    { label: `Horas Extras (${d.horas_extras} hs)`, monto: d.importe_horas_extras },
    { label: 'Vacaciones/Aguinaldo/Extras', monto: d.vacaciones_aguinaldo },
  ].filter(c => c.monto !== 0 || c.label.startsWith('Sueldo Básico'));

  const conceptosRows = conceptos.map(c => `
    <tr><td>${c.label}</td><td class="text-right">${fmtMoneda(c.monto)}</td></tr>`).join('');

  const splitsRows = (d.splits ?? []).map(s => `
    <tr>
      <td>${s.empresa_nombre}</td>
      <td class="text-right">${s.porcentaje}%</td>
      <td class="text-right">${fmtMoneda(s.monto)}</td>
    </tr>`).join('');

  const jornadasRows = d.jornadas.map(j => `
    <tr><td>${fmtFecha(j.fecha)}</td><td class="text-right">${j.horas}</td></tr>`).join('');
  const totalHorasJornadas = d.jornadas.reduce((s, j) => s + j.horas, 0);

  const prestamosRows = d.prestamos_pagos.map(p => `
    <tr><td>${p.detalle}</td><td class="text-right">${fmtMoneda(p.monto)}</td></tr>`).join('');

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><style>${CSS}</style></head>
<body>
  <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 0.6rem;">
    ${d.empresa.logo_data_url ? `<img src="${d.empresa.logo_data_url}" style="max-height: 50px; max-width: 140px;" />` : ''}
    <h1 style="margin-bottom: 0;">RECIBO DE SUELDO — ${MESES[d.periodo_mes - 1]} ${d.periodo_anio}</h1>
  </div>
  <div class="info-grid">
    <span>Empleado: <strong>${d.empleado.apellido}, ${d.empleado.nombre}</strong></span>
    <span>DNI: <strong>${d.empleado.dni ?? '-'}</strong></span>
    <span>Escalafón: <strong>${d.escalafon ?? '-'}</strong></span>
    <span>Estado: <strong>${d.estado}</strong></span>
  </div>

  <div class="section">
    <h2>Conceptos</h2>
    <table>
      <tbody>${conceptosRows}</tbody>
      <tfoot>
        <tr><td>TOTAL BRUTO</td><td class="text-right">${fmtMoneda(d.subtotal_bruto)}</td></tr>
        ${(d.vales_descuentos > 0 || d.prestamos_descontados > 0) ? `
        <tr><td>Vales/Descuentos</td><td class="text-right negative">-${fmtMoneda(d.vales_descuentos)}</td></tr>
        <tr><td>Préstamos/Descuentos</td><td class="text-right negative">-${fmtMoneda(d.prestamos_descontados)}</td></tr>` : ''}
        <tr><td>TOTAL A COBRAR</td><td class="text-right">${fmtMoneda(d.total_a_cobrar)}</td></tr>
      </tfoot>
    </table>
  </div>

  ${(d.splits && d.splits.length > 0) ? `
  <div class="section">
    <h2>Reparto entre empresas</h2>
    <table>
      <thead><tr><th>Empresa</th><th class="text-right">%</th><th class="text-right">Monto</th></tr></thead>
      <tbody>${splitsRows}</tbody>
    </table>
  </div>` : ''}

  <div class="section">
    <h2>Detalle de horas del mes</h2>
    ${d.jornadas.length > 0 ? `
    <table>
      <thead><tr><th>Fecha</th><th class="text-right">Horas</th></tr></thead>
      <tbody>${jornadasRows}</tbody>
      <tfoot><tr><td>Total (${d.jornadas.length} jornadas)</td><td class="text-right">${totalHorasJornadas}</td></tr></tfoot>
    </table>` : `<p class="muted">Horas trabajadas: ${d.horas_trabajadas} (acordadas: ${d.horas_acordadas}) — sin jornadas individuales cargadas en el sistema para este período.</p>`}
  </div>

  ${d.prestamos_pagos.length > 0 ? `
  <div class="section">
    <h2>Préstamos descontados este mes</h2>
    <table>
      <thead><tr><th>Detalle</th><th class="text-right">Monto</th></tr></thead>
      <tbody>${prestamosRows}</tbody>
    </table>
  </div>` : ''}

  <div class="section no-break" style="margin-top: 3rem;">
    <p>Recibí conforme: ________________________________________</p>
    <p style="margin-top: 2rem;">Aclaración: ________________________________________</p>
    <p style="margin-top: 2rem;">Fecha: ________________________________________</p>
  </div>
</body>
</html>`;
}
