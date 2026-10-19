import ExcelJS from 'exceljs';
import { prisma } from './prisma';
import { applyHeaderStyle } from './excelExporter';
import { calcularConteo } from './presentismoCalculo';

const ESTADO_INICIAL: Record<string, string> = {
  PRESENTE: 'P', DEMORA: 'D', TARDE: 'T', MEDIA_JORNADA: 'M', AUSENTE: 'A',
  JUSTIFICADO: 'J', LIBRE: 'L', VACACIONES: 'V', LICENCIA: 'Li', FRANCO: 'F',
};

const ESTADO_COLOR: Record<string, string> = {
  PRESENTE: 'FFBBF7D0', DEMORA: 'FFFDE68A', TARDE: 'FFFDBA74', MEDIA_JORNADA: 'FFFED7AA', AUSENTE: 'FFFCA5A5',
  JUSTIFICADO: 'FFBEE3F8', LIBRE: 'FFE5E7EB', VACACIONES: 'FFBAE6FD', LICENCIA: 'FFE9D5FF', FRANCO: 'FFC7D2FE',
};

const SEMAFORO_LABEL: Record<string, string> = { EXCELENTE: 'Excelente', SEGUIMIENTO: 'Seguimiento', ATENCION: 'Atención' };
const SEMAFORO_COLOR: Record<string, string> = { EXCELENTE: 'FFBBF7D0', SEGUIMIENTO: 'FFFEF08A', ATENCION: 'FFFCA5A5' };

function diasEnMes(anio: number, mes: number): number {
  return new Date(Date.UTC(anio, mes, 0)).getUTCDate();
}

// Grilla mensual — misma forma que "SEPTIEMBRE_Registro de Faltas.xlsx" de
// Lorena: filas por empleado, columnas por día, y al final las mismas columnas
// de su hoja "Informe" (asistencia, demoras, llegadas tarde, libres, faltas,
// médica, vacaciones, franco) más el semáforo.
export async function generatePresentismoExcel(empresaId: number, mes: number, anio: number) {
  const totalDias = diasEnMes(anio, mes);
  const desde = new Date(Date.UTC(anio, mes - 1, 1));
  const hasta = new Date(Date.UTC(anio, mes - 1, totalDias, 23, 59, 59));

  const [empleados, registros] = await Promise.all([
    prisma.empleado.findMany({ where: { deleted_at: null, estado: 'ACTIVO', empresa_id: empresaId }, orderBy: { apellido: 'asc' } }),
    prisma.registroAsistencia.findMany({ where: { empresa_id: empresaId, deleted_at: null, fecha: { gte: desde, lte: hasta } } }),
  ]);

  const porEmpleado = new Map<number, (typeof registros)>();
  for (const r of registros) {
    if (!porEmpleado.has(r.empleado_id)) porEmpleado.set(r.empleado_id, []);
    porEmpleado.get(r.empleado_id)!.push(r);
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Admin Portal';
  wb.created = new Date();

  const ws = wb.addWorksheet(`Presentismo ${mes}-${anio}`);
  const resumenHeader = ['ASISTENCIA', 'DEMORAS', 'LLEGADA TARDE', 'LIBRE', 'FALTAS', 'MÉDICA', 'VACACIONES', 'FRANCO', 'TOTAL HS', 'PRESENTISMO', 'SEMÁFORO'];
  ws.columns = [
    { width: 26 },
    ...Array.from({ length: totalDias }, () => ({ width: 4 })),
    ...resumenHeader.map(h => ({ width: Math.max(10, h.length + 2) })),
  ];

  const header = ['EMPLEADO', ...Array.from({ length: totalDias }, (_, i) => String(i + 1)), ...resumenHeader];
  applyHeaderStyle(ws.addRow(header), header.length);

  for (const empleado of empleados) {
    const lista = porEmpleado.get(empleado.id) ?? [];
    const porFecha = new Map(lista.map(r => [r.fecha.toISOString().slice(0, 10), r]));
    const c = calcularConteo(lista);
    const row: (string | number)[] = [`${empleado.apellido}, ${empleado.nombre}`];

    for (let d = 1; d <= totalDias; d++) {
      const key = `${anio}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const r = porFecha.get(key);
      row.push(r ? ESTADO_INICIAL[r.estado] ?? '' : '');
    }

    row.push(
      c.dias_presente, c.dias_demora, c.dias_tarde, c.dias_libre, c.dias_ausente, c.dias_justificado,
      c.dias_vacaciones, c.dias_franco, c.total_horas, c.cobra_presentismo ? 'SÍ' : 'NO', SEMAFORO_LABEL[c.semaforo],
    );
    const excelRow = ws.addRow(row);

    for (let d = 0; d < totalDias; d++) {
      const key = `${anio}-${String(mes).padStart(2, '0')}-${String(d + 1).padStart(2, '0')}`;
      const r = porFecha.get(key);
      const dow = new Date(Date.UTC(anio, mes - 1, d + 1)).getUTCDay();
      const cell = excelRow.getCell(d + 2);
      cell.alignment = { horizontal: 'center' };
      const color = r ? ESTADO_COLOR[r.estado] : (dow === 0 || dow === 6) ? 'FFE5E7EB' : undefined;
      if (color) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
    }
    const semaforoCell = excelRow.getCell(header.length);
    semaforoCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SEMAFORO_COLOR[c.semaforo] } };
  }

  // Referencias del semáforo — igual al bloque REFERENCIAS de la planilla
  ws.addRow([]);
  ws.addRow(['REFERENCIAS', 'Demoras', 'Llegadas tarde', 'Faltas']).font = { bold: true };
  ws.addRow(['Excelente',   '0 a 2',   '0 a 1',   '0']).getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SEMAFORO_COLOR.EXCELENTE } };
  ws.addRow(['Seguimiento', '3 a 4',   '2 a 3',   '1']).getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SEMAFORO_COLOR.SEGUIMIENTO } };
  ws.addRow(['Atención',    '5 o más', '4 o más', '2 o más']).getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SEMAFORO_COLOR.ATENCION } };

  const buffer = await wb.xlsx.writeBuffer();
  return { buffer: Buffer.from(buffer), filename: `Presentismo_${mes}-${anio}.xlsx` };
}
