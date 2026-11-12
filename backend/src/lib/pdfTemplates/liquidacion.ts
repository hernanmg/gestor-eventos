import { CSS } from './shared';

export interface LiquidacionPdfData {
  empleado: { nombre: string; apellido: string; dni: string | null; categoria: string };
  evento_nombre: string | null;
  fecha_desde: Date;
  fecha_hasta: Date;
  jornadas: { fecha: Date; horas_normales: number; horas_extras: number; descripcion: string | null }[];
  anticipos: { tipo: string; monto: number; fecha: Date; motivo: string | null }[];
  valor_hora: number;
  valor_hora_extra: number;
  horas_normales: number;
  horas_extras: number;
  subtotal_horas: number;
  total_anticipos: number;
  total_descuentos: number;
  total_a_cobrar: number;
  estado: string;
  fecha_generacion: Date;
}

// Fechas de negocio guardadas como medianoche UTC — leer en UTC evita el
// corrimiento de un día en timezones negativas (ver excelExporter.ts).
function fmtFecha(d: Date): string {
  const date = new Date(d);
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${date.getUTCFullYear()}`;
}

function fmtMoneda(n: number): string {
  return `$${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function templateLiquidacion(d: LiquidacionPdfData): string {
  const jornadasRows = d.jornadas.map(j => `
    <tr>
      <td>${fmtFecha(j.fecha)}</td>
      <td>${j.descripcion ?? '-'}</td>
      <td class="text-right">${j.horas_normales}</td>
      <td class="text-right">${j.horas_extras}</td>
    </tr>`).join('');

  const anticiposRows = d.anticipos.map(a => `
    <tr>
      <td>${fmtFecha(a.fecha)}</td>
      <td>${a.tipo}</td>
      <td>${a.motivo ?? '-'}</td>
      <td class="text-right">${fmtMoneda(a.monto)}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><style>${CSS}</style></head>
<body>
  <h1>Liquidación de haberes</h1>
  <div class="info-grid">
    <span>Empleado: <strong>${d.empleado.apellido}, ${d.empleado.nombre}</strong></span>
    <span>DNI: <strong>${d.empleado.dni ?? '-'}</strong></span>
    <span>Categoría: <strong>${d.empleado.categoria}</strong></span>
  </div>
  <div class="info-grid">
    <span>Período: <strong>${fmtFecha(d.fecha_desde)} a ${fmtFecha(d.fecha_hasta)}</strong></span>
    ${d.evento_nombre ? `<span>Evento: <strong>${d.evento_nombre}</strong></span>` : ''}
    <span>Estado: <strong>${d.estado}</strong></span>
  </div>

  <div class="section">
    <h2>Jornadas del período</h2>
    <table>
      <thead><tr><th>Fecha</th><th>Descripción</th><th class="text-right">Hs. normales</th><th class="text-right">Hs. extras</th></tr></thead>
      <tbody>${jornadasRows || '<tr><td colspan="4" class="text-center muted">Sin jornadas aprobadas en el período</td></tr>'}</tbody>
      <tfoot><tr><td colspan="2">Total</td><td class="text-right">${d.horas_normales}</td><td class="text-right">${d.horas_extras}</td></tr></tfoot>
    </table>
  </div>

  ${d.anticipos.length > 0 ? `
  <div class="section">
    <h2>Anticipos aplicados</h2>
    <table>
      <thead><tr><th>Fecha</th><th>Tipo</th><th>Motivo</th><th class="text-right">Monto</th></tr></thead>
      <tbody>${anticiposRows}</tbody>
    </table>
  </div>` : ''}

  <div class="section">
    <h2>Resumen</h2>
    <table>
      <tbody>
        <tr><td>Valor hora normal</td><td class="text-right">${fmtMoneda(d.valor_hora)}</td></tr>
        <tr><td>Valor hora extra</td><td class="text-right">${fmtMoneda(d.valor_hora_extra)}</td></tr>
        <tr><td>Subtotal horas</td><td class="text-right">${fmtMoneda(d.subtotal_horas)}</td></tr>
        <tr><td>Anticipos descontados</td><td class="text-right negative">-${fmtMoneda(d.total_anticipos)}</td></tr>
        <tr><td>Otros descuentos</td><td class="text-right negative">-${fmtMoneda(d.total_descuentos)}</td></tr>
      </tbody>
      <tfoot><tr><td>Total a cobrar</td><td class="text-right">${fmtMoneda(d.total_a_cobrar)}</td></tr></tfoot>
    </table>
  </div>

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
