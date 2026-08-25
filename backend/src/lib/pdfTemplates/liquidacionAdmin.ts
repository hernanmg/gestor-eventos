import { CSS } from './shared';

export interface LiquidacionAdminPdfData {
  empleado:            { nombre: string; apellido: string; dni: string | null };
  escalafon:           string | null;
  periodo_mes:         number;
  periodo_anio:        number;
  sueldo_basico:        number;
  horas_acordadas:      number;
  horas_trabajadas:     number;
  horas_extras:         number;
  valor_hora_extra:     number | null;
  importe_horas_extras: number;
  premio_incentivo:     number;
  viatico:              number;
  premio_presentismo:   number;
  antiguedad_anios:     number;
  importe_antiguedad:   number;
  telefono:             number;
  vacaciones_aguinaldo: number;
  vales_descuentos:     number;
  subtotal_bruto:       number;
  total_a_cobrar:       number;
  splits:               { empresa_nombre: string; porcentaje: number; monto: number }[] | null;
  estado:               string;
  fecha_generacion:     Date;
}

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function fmtMoneda(n: number): string {
  return `$${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function templateLiquidacionAdmin(d: LiquidacionAdminPdfData): string {
  const splitsRows = (d.splits ?? []).map(s => `
    <tr>
      <td>${s.empresa_nombre}</td>
      <td class="text-right">${s.porcentaje}%</td>
      <td class="text-right">${fmtMoneda(s.monto)}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><style>${CSS}</style></head>
<body>
  <h1>Liquidación de sueldo administrativo</h1>
  <div class="info-grid">
    <span>Empleado: <strong>${d.empleado.apellido}, ${d.empleado.nombre}</strong></span>
    <span>DNI: <strong>${d.empleado.dni ?? '-'}</strong></span>
    <span>Escalafón: <strong>${d.escalafon ?? '-'}</strong></span>
  </div>
  <div class="info-grid">
    <span>Período: <strong>${MESES[d.periodo_mes - 1]} ${d.periodo_anio}</strong></span>
    <span>Estado: <strong>${d.estado}</strong></span>
  </div>

  <div class="section">
    <h2>Conceptos</h2>
    <table>
      <tbody>
        <tr><td>Sueldo básico</td><td class="text-right">${fmtMoneda(d.sueldo_basico)}</td></tr>
        <tr><td>Horas trabajadas (acordadas: ${d.horas_acordadas})</td><td class="text-right">${d.horas_trabajadas}</td></tr>
        <tr><td>Horas extras (${d.horas_extras} hs × ${fmtMoneda(d.valor_hora_extra ?? 0)})</td><td class="text-right">${fmtMoneda(d.importe_horas_extras)}</td></tr>
        <tr><td>Premio incentivo</td><td class="text-right">${fmtMoneda(d.premio_incentivo)}</td></tr>
        <tr><td>Viático</td><td class="text-right">${fmtMoneda(d.viatico)}</td></tr>
        <tr><td>Premio presentismo</td><td class="text-right">${fmtMoneda(d.premio_presentismo)}</td></tr>
        <tr><td>Antigüedad (${d.antiguedad_anios} año${d.antiguedad_anios !== 1 ? 's' : ''})</td><td class="text-right">${fmtMoneda(d.importe_antiguedad)}</td></tr>
        <tr><td>Teléfono</td><td class="text-right">${fmtMoneda(d.telefono)}</td></tr>
        <tr><td>Vacaciones/Aguinaldo/Extras</td><td class="text-right">${fmtMoneda(d.vacaciones_aguinaldo)}</td></tr>
        <tr><td>Vales/Descuentos/Multas</td><td class="text-right negative">-${fmtMoneda(d.vales_descuentos)}</td></tr>
      </tbody>
      <tfoot>
        <tr><td>Subtotal bruto</td><td class="text-right">${fmtMoneda(d.subtotal_bruto)}</td></tr>
        <tr><td>Total a cobrar</td><td class="text-right">${fmtMoneda(d.total_a_cobrar)}</td></tr>
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

  <div class="section no-break" style="margin-top: 3rem;">
    <table>
      <tbody>
        <tr>
          <td style="border: none; padding-top: 3rem; width: 50%;">
            <div style="border-top: 1px solid #374151; padding-top: 4px;">Firma del empleado</div>
          </td>
          <td style="border: none; padding-top: 3rem; width: 50%;">
            <div style="border-top: 1px solid #374151; padding-top: 4px;">Recibí conforme</div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</body>
</html>`;
}
