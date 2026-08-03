import ExcelJS from 'exceljs';
import { prisma } from './prisma';
import { applyHeaderStyle, fmtDate } from './excelExporter';

// Colores de sección tomados del PDF original DOS57_JULIO_TAREAS_PERSONAL_DIARIO
// (celeste/amarillo/verde/gris). Cualquier sección con nombre libre que no
// matchee cae en el gris por defecto.
const SECCION_COLOR: Record<string, string> = {
  'ADMINISTRACION':      'FFBEE3F8', // celeste
  'DEPOSITO':            'FFFEF08A', // amarillo
  'EVENTOS':             'FFBBF7D0', // verde
  'NO CITADOS':          'FFE5E7EB', // gris
};
const SECCION_COLOR_DEFAULT = 'FFE5E7EB';

function seccionKey(s: string | null): string {
  return (s ?? 'SIN SECCIÓN').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
}

const ESTADO_LABEL: Record<string, string> = {
  LIBRE:      'LIBRE',
  VACACIONES: 'VACACIONES',
  AUSENTE:    'AUSENTE',
  NO_CITADO:  'LIBRE',
};

export async function generateParteDiarioExcel(parteId: number, empresaId: number) {
  const parte = await prisma.parteDiario.findFirstOrThrow({
    where:   { id: parteId, empresa_id: empresaId, deleted_at: null },
    include: {
      asignaciones: {
        where:   { deleted_at: null },
        include: { empleado: true, camion: true },
        orderBy: [{ seccion: 'asc' }, { orden: 'asc' }],
      },
    },
  });

  const wb = new ExcelJS.Workbook();
  wb.creator  = 'Admin Portal';
  wb.created  = new Date();
  wb.modified = new Date();

  const ws = wb.addWorksheet('TAREAS PERSONAL DIARIO');
  ws.columns = [{ width: 28 }, { width: 14 }, { width: 18 }, { width: 46 }, { width: 14 }];

  const title = ws.addRow(['TAREAS PERSONAL DIARIO']);
  title.font = { bold: true, size: 14 };
  ws.mergeCells(title.number, 1, title.number, 5);
  title.alignment = { horizontal: 'center' };

  const fechaRow = ws.addRow([fmtDate(parte.fecha)]);
  fechaRow.font = { bold: true, size: 11 };
  ws.mergeCells(fechaRow.number, 1, fechaRow.number, 5);
  fechaRow.alignment = { horizontal: 'center' };
  ws.addRow([]);

  applyHeaderStyle(ws.addRow(['PERSONAL', 'HORA INGRESO', 'LUGAR', 'TAREA', 'HORA SALIDA']), 5);

  const asignados = parte.asignaciones.filter(a => a.estado === 'ASIGNADO');
  const noCitados = parte.asignaciones.filter(a => a.estado !== 'ASIGNADO');

  const bySeccion = new Map<string, typeof asignados>();
  for (const a of asignados) {
    const key = seccionKey(a.seccion);
    if (!bySeccion.has(key)) bySeccion.set(key, []);
    bySeccion.get(key)!.push(a);
  }

  // Orden fijo para las 3 secciones habituales; cualquier otra sección libre
  // se agrega después, en el orden en que aparece.
  const ORDEN_SECCIONES = ['ADMINISTRACION', 'DEPOSITO', 'EVENTOS'];
  const orderedKeys = [
    ...ORDEN_SECCIONES.filter(k => bySeccion.has(k)),
    ...[...bySeccion.keys()].filter(k => !ORDEN_SECCIONES.includes(k)),
  ];

  const addSectionHeader = (label: string) => {
    const row = ws.addRow([label]);
    ws.mergeCells(row.number, 1, row.number, 5);
    const fill = SECCION_COLOR[label] ?? SECCION_COLOR_DEFAULT;
    row.eachCell(c => {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
      c.font = { bold: true };
      c.alignment = { horizontal: 'center' };
    });
  };

  for (const key of orderedKeys) {
    addSectionHeader(key);
    for (const a of bySeccion.get(key)!) {
      const vehiculo = a.camion?.codigo ?? a.vehiculo_texto ?? null;
      ws.addRow([
        `${a.empleado.apellido}, ${a.empleado.nombre}`.trim(),
        a.hora_ingreso ?? '',
        a.lugar ?? '',
        [a.tarea, vehiculo ? `(${vehiculo})` : null].filter(Boolean).join(' '),
        a.hora_salida_fija ? (a.hora_salida ?? '') : '***',
      ]);
    }
  }

  if (noCitados.length > 0) {
    addSectionHeader('NO CITADOS');
    for (const a of noCitados) {
      ws.addRow([
        `${a.empleado.apellido}, ${a.empleado.nombre}`.trim(),
        '', '', ESTADO_LABEL[a.estado] ?? a.estado, '',
      ]);
    }
  }

  ws.addRow([]);
  const notaTexto = parte.notas
    ?? 'Las modificaciones de logística realizadas (tanto de personal como de eventos) en el día deben ser validadas y expuestas en el grupo "TODOS".';
  const nota = ws.addRow([notaTexto]);
  ws.mergeCells(nota.number, 1, nota.number, 5);
  nota.font = { italic: true, size: 9 };
  nota.alignment = { wrapText: true };

  const filename = `Parte-${parte.fecha.toISOString().slice(0, 10)}.xlsx`;

  return {
    buffer: Buffer.from(await wb.xlsx.writeBuffer()),
    filename,
  };
}
