import ExcelJS from 'exceljs';
import { prisma } from './prisma';
import { applyHeaderStyle } from './excelExporter';

const ESTADO_INICIAL: Record<string, string> = {
  PRESENTE: 'P', TARDE: 'T', MEDIA_JORNADA: 'M', AUSENTE: 'A',
  JUSTIFICADO: 'J', LIBRE: 'L', VACACIONES: 'V', LICENCIA: 'Li',
};

const ESTADO_COLOR: Record<string, string> = {
  PRESENTE: 'FFBBF7D0', TARDE: 'FFFEF08A', MEDIA_JORNADA: 'FFFED7AA', AUSENTE: 'FFFCA5A5',
  JUSTIFICADO: 'FFBEE3F8', LIBRE: 'FFE5E7EB', VACACIONES: 'FFBAE6FD', LICENCIA: 'FFE9D5FF',
};

function diasEnMes(anio: number, mes: number): number {
  return new Date(Date.UTC(anio, mes, 0)).getUTCDate();
}

// Grilla mensual — misma forma que "SEPTIEMBRE_Registro de Faltas.xlsx" de
// Lorena: filas por empleado, columnas por día, con el resumen de presentismo
// al final de cada fila.
export async function generatePresentismoExcel(empresaId: number, mes: number, anio: number) {
  const totalDias = diasEnMes(anio, mes);
  const desde = new Date(Date.UTC(anio, mes - 1, 1));
  const hasta = new Date(Date.UTC(anio, mes - 1, totalDias, 23, 59, 59));

  const [empleados, registros] = await Promise.all([
    prisma.empleado.findMany({ where: { deleted_at: null, estado: 'ACTIVO', empresa_id: empresaId }, orderBy: { apellido: 'asc' } }),
    prisma.registroAsistencia.findMany({ where: { empresa_id: empresaId, deleted_at: null, fecha: { gte: desde, lte: hasta } } }),
  ]);

  const porEmpleado = new Map<number, Map<string, (typeof registros)[number]>>();
  for (const r of registros) {
    const key = r.fecha.toISOString().slice(0, 10);
    if (!porEmpleado.has(r.empleado_id)) porEmpleado.set(r.empleado_id, new Map());
    porEmpleado.get(r.empleado_id)!.set(key, r);
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Admin Portal';
  wb.created = new Date();

  const ws = wb.addWorksheet(`Presentismo ${mes}-${anio}`);
  ws.columns = [
    { width: 26 },
    ...Array.from({ length: totalDias }, () => ({ width: 4 })),
    { width: 10 }, { width: 10 }, { width: 10 }, { width: 10 }, { width: 12 },
  ];

  const header = ['EMPLEADO', ...Array.from({ length: totalDias }, (_, i) => String(i + 1)), 'PRES.', 'AUS.', 'TARDE', 'TOTAL HS', 'PRESENTISMO'];
  applyHeaderStyle(ws.addRow(header), header.length);

  for (const empleado of empleados) {
    const registrosEmpleado = porEmpleado.get(empleado.id) ?? new Map();
    const row: (string | number)[] = [`${empleado.apellido}, ${empleado.nombre}`];
    let presentes = 0, ausentes = 0, tardes = 0, horas = 0;

    for (let d = 1; d <= totalDias; d++) {
      const key = `${anio}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const r = registrosEmpleado.get(key);
      row.push(r ? ESTADO_INICIAL[r.estado] ?? '' : '');
      if (r?.estado === 'PRESENTE') presentes++;
      if (r?.estado === 'AUSENTE')  ausentes++;
      if (r?.estado === 'TARDE') { presentes++; tardes++; }
      if (r?.horas_trabajadas != null) horas += Number(r.horas_trabajadas);
    }

    const cobraPresentismo = ausentes === 0;
    row.push(presentes, ausentes, tardes, Math.round(horas * 100) / 100, cobraPresentismo ? 'SÍ' : 'NO');
    const excelRow = ws.addRow(row);

    for (let d = 0; d < totalDias; d++) {
      const key = `${anio}-${String(mes).padStart(2, '0')}-${String(d + 1).padStart(2, '0')}`;
      const r = registrosEmpleado.get(key);
      const dow = new Date(Date.UTC(anio, mes - 1, d + 1)).getUTCDay();
      const cell = excelRow.getCell(d + 2);
      cell.alignment = { horizontal: 'center' };
      const color = r ? ESTADO_COLOR[r.estado] : (dow === 0 || dow === 6) ? 'FFE5E7EB' : undefined;
      if (color) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
    }
  }

  const buffer = await wb.xlsx.writeBuffer();
  return { buffer: Buffer.from(buffer), filename: `Presentismo_${mes}-${anio}.xlsx` };
}
