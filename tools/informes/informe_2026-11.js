// Arma el informe de avance para el cliente en Word: docs/avance/2026-11.docx.
// Uso (desde la raíz del repo): node tools/informes/informe_2026-11.js [salida.docx]
// Usa la librería `docx` del package.json de la raíz. El contenido sale de
// docs/avance/2026-11.md; si cambia uno, hay que cambiar el otro.
// Para un mes nuevo: copiar este archivo como informe_AAAA-MM.js y actualizar los datos.
const fs = require('fs');
const path = require('path');
const SALIDA = process.argv[2] || path.join(__dirname, '..', '..', 'docs', 'avance', '2026-11.docx');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType,
  ShadingType, AlignmentType, BorderStyle, LevelFormat, Footer, PageNumber,
  HeadingLevel, PageBreak, VerticalAlign,
} = require('docx');

const NAVY = '1E293B', ACCENT = '2563EB', MUTED = '64748B', LINE = 'CBD5E1';
const FONT = 'Calibri';
const W = 9026; // A4 con márgenes de 1"

const border = { style: BorderStyle.SINGLE, size: 4, color: LINE };
const borders = { top: border, bottom: border, left: border, right: border };
const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const noBorders = { top: none, bottom: none, left: none, right: none };

const b = (text) => new TextRun({ text, bold: true });
const t = (text) => new TextRun({ text });
const muted = (text, size) => new TextRun({ text, color: MUTED, size });
function p(children, para = {}) {
  return new Paragraph({ children: typeof children === 'string' ? [t(children)] : children, spacing: { after: 120 }, ...para });
}
function bullet(children, ref = 'bullets') {
  return new Paragraph({ children: typeof children === 'string' ? [t(children)] : children, numbering: { reference: ref, level: 0 }, spacing: { after: 80 } });
}
const numbered = (children) => new Paragraph({ children, numbering: { reference: 'nums', level: 0 }, spacing: { after: 80 }, keepNext: true, keepLines: true });
const h1 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(text)] });

function cell(content, width, o = {}) {
  const children = (Array.isArray(content) ? content : [content]).map(c =>
    typeof c === 'string'
      ? new Paragraph({ alignment: o.align, children: [new TextRun({ text: c, bold: o.bold, color: o.color, size: o.size })] })
      : c);
  return new TableCell({
    children, width: { size: width, type: WidthType.DXA }, borders: o.borders ?? borders,
    shading: o.fill ? { fill: o.fill, type: ShadingType.CLEAR, color: 'auto' } : undefined,
    margins: o.margins ?? { top: 80, bottom: 80, left: 120, right: 120 }, verticalAlign: o.valign ?? VerticalAlign.CENTER,
  });
}
function table(cols, header, rows, cellOpts = () => ({})) {
  return new Table({
    width: { size: W, type: WidthType.DXA }, columnWidths: cols,
    rows: [
      new TableRow({ tableHeader: true, children: header.map((h, i) => cell(h, cols[i], { bold: true, color: 'FFFFFF', fill: NAVY })) }),
      ...rows.map((r, ri) => new TableRow({ cantSplit: true, children: r.map((c, i) => cell(c, cols[i], cellOpts(ri, i, c))) })),
    ],
  });
}
// Recuadro destacado: tabla de una celda con fondo suave y borde izquierdo de acento
function callout(children) {
  const left = { style: BorderStyle.SINGLE, size: 24, color: ACCENT };
  return new Table({
    width: { size: W, type: WidthType.DXA }, columnWidths: [W],
    rows: [new TableRow({ cantSplit: true, children: [new TableCell({
      children, width: { size: W, type: WidthType.DXA },
      borders: { top: none, bottom: none, right: none, left },
      shading: { fill: 'EFF6FF', type: ShadingType.CLEAR, color: 'auto' },
      margins: { top: 160, bottom: 100, left: 240, right: 240 },
    })] })],
  });
}

// ── Colores por nivel ────────────────────────────────────────────────────────
function nivel(n) {
  if (n == null) return { bar: 'E2E8F0', fg: MUTED };
  if (n >= 80) return { bar: '22C55E', fg: '166534' };
  if (n >= 50) return { bar: 'F59E0B', fg: '92400E' };
  return { bar: 'EF4444', fg: '991B1B' };
}

// Celda con barra horizontal (tabla anidada de 2 celdas) y el % al lado
const BAR = 1900;
function barCell(valor, marca, width) {
  if (valor == null) {
    return cell([new Paragraph({ children: [muted('sin relevar', 20)] })], width);
  }
  const { bar, fg } = nivel(valor);
  const lleno = Math.max(40, Math.round(BAR * valor / 100));
  const resto = BAR - lleno;
  const fill = (w, color) => new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text: ' ', size: 8 })] })],
    width: { size: w, type: WidthType.DXA }, borders: noBorders,
    shading: { fill: color, type: ShadingType.CLEAR, color: 'auto' },
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
  });
  const barra = new Table({
    width: { size: BAR, type: WidthType.DXA }, columnWidths: resto > 0 ? [lleno, resto] : [lleno],
    rows: [new TableRow({ height: { value: 200, rule: 'exact' }, children: resto > 0 ? [fill(lleno, bar), fill(resto, 'F1F5F9')] : [fill(lleno, bar)] })],
  });
  return cell([
    new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: `${valor}%${marca ?? ''}`, bold: true, color: fg })] }),
    barra,
    new Paragraph({ children: [new TextRun({ text: '', size: 4 })] }),
  ], width);
}

// ── Datos ────────────────────────────────────────────────────────────────────
const pilares = [
  ['01', 'RRHH', 87, 83],
  ['02', 'Finanzas', 72, 74],
  ['03', 'Administración', 87, 82],
  ['04', 'Proveedores', 73, 71],
  ['05', 'Depósito', 78, 82, '*'],
  ['06', 'Logística', 86, 86],
  ['07', 'Seguros', 61, 50],
  ['08', 'Marketing', null, null],
  ['09', 'Comunicación', null, null],
  ['10', 'Novedades', 17, 17],
  ['11', 'Varios y módulos auxiliares', 90, 90],
  ['12', 'Calendario transversal (nuevo)', 80, 80],
];

const meses = [
  ['Julio', 'Kick-off y primeros relevamientos. Nuevo modelo y vista Macro, RRHH, stock completo con importador Layher, rubros, ficha de evento.'],
  ['Agosto', 'Parte diario, comidas, calendario, alta de eventos, roles y permisos, sueldos administrativos, flota, AFIP y créditos, facturas a cobrar, varias monedas.'],
  ['Septiembre', 'Bitácora de choferes, espacios compartidos, módulos de Lorena, Andrea y Santi y Nico, siniestros, cierre contable, SGR, uniformes, formulario de proveedores, tarjeta corporativa.'],
  ['Octubre', 'Marca de cada empresa, bitácora de Flor, logística del evento, presupuestos con tipo de cambio, remitos, nuevo diseño, ayuda, cajas chicas, centro de costos.'],
  ['Noviembre', 'Costo real del evento v2 y planillas de campo precargadas para trabajar sin señal.'],
];

// [pilar, general, enjoyMale, enjoyDani]
const desarrollado = [
  ['RRHH',
    'Empleados y jornadas por categoría (incluidos los extranjeros); liquidación por jornada en DOS57; sueldos administrativos con acuerdos, aumentos por IPC, banco de horas y reparto entre empresas; parte diario que genera las jornadas; presentismo, francos, multas y carnets (Lorena); entrega de uniformes.',
    null, null],
  ['Finanzas',
    'Caja global y cajas del mes; echeqs (pendientes, cobrados, vendidos, rechazados); cuentas corrientes de empresas y personales; planes de AFIP, créditos y SGR; facturas a cobrar con reparto; cierre contable para el contador; dólar e IPC actualizados; varias monedas.',
    'Cajas chicas por persona (Dani, Male, Gus, Flor, coworking) con rendición, cierre e importador de su planilla; tarjeta corporativa de Enjoy con sus consumos importados.',
    null],
  ['Administración',
    'Alta del evento paso a paso; vista Macro de las dos empresas; egresos e ingresos con rubros configurables; conciliatoria; costo real del evento con la matriz de Flor; presupuestador rental; espacios compartidos (coworking, naves); eventos informales con aviso de facturación.',
    'Flujo de caja del evento con sus 5 pestañas de egresos y 5 de ingresos; conciliatoria con reparto entre socios; centro de costos del Festival KM (presupuesto contra real, IVA, señas, extras y acciones); forma de llevar cada evento (flujo de caja o centro de costos); cortesías; importador de eventos históricos.',
    'Ficha de evento con una ficha por proveedor y sus fechas de ingreso, evento y retiro; pedidos de material de 16 rubros (estructuras, generadores, sonido, luces, baños, mobiliario…); un rubro cubierto con stock propio más un proveedor.'],
  ['Proveedores',
    'Padrón de proveedores; facturas a pagar con su PDF; pagos con transferencia o echeq; importador del libro de compras de AFIP con control de faltantes; alta de proveedores y jornaleros desde el formulario de Google.',
    'Facturas de Enjoy importadas desde AFIP, con el control de faltantes de más de $500.000; su formulario de proveedores.',
    null],
  ['Depósito',
    'Catálogo de stock con códigos Layher; cunas, camiones y pañol; activos; firmas digitales de salida y devolución; alertas de mínimos y proyección de la temporada; disponibilidad por fechas.',
    null,
    'Stock del depósito de Enjoy por espacio (8 espacios), con el historial de los 6 controles desde abril de 2023.'],
  ['Logística',
    'Flota con RTO, taller, patentes y control de salida; combustible; bitácora de choferes y de Flor; movimiento diario; remitos digitales; operación del evento por fase; planillas de campo; logística del evento (viajes y combustible); comidas por evento.',
    null,
    'Producción del evento: espacios y lo que lleva cada uno, puntos de internet, branding, cronograma de montaje y compras con quién pide y quién autoriza; esquemas de seguridad y de limpieza por turnos; comidas y viandas por día.'],
  ['Seguros', 'Pólizas de la flota; siniestros de vehículos y del personal.', null, null],
  ['Varios', 'Usuarios, roles y permisos; pantalla de inicio de cada persona; auditoría; marca de cada empresa y tema oscuro; nuevo diseño y versión para celular; ayuda dentro del sistema con buscador.', null, null],
  ['Calendario', 'Un solo calendario con eventos, jornadas, echeqs, cuotas de AFIP y créditos, facturas, seguros, RTO, carnets, multas, taller y stock; cada persona ve lo suyo.', null, null],
];

const falta = [
  ['RRHH', 'Avisar a cada persona su tarea del día; viático de los extranjeros; vacaciones, aguinaldo y extras por separado; separar transferencia y efectivo en el cierre de sueldos.'],
  ['Finanzas', 'Cheques de la empresa por banco (también los que no son de un evento) y el aviso de los jueves con lo que hay que cubrir el viernes; resumen semanal de pagos para Matías; importador de comprobantes emitidos de AFIP.'],
  ['Administración', 'Presupuesto comercial previo al evento en Enjoy; estados del evento; gráficos en el resumen del evento; centro de reportes.'],
  ['Proveedores', 'Órdenes de compra; comparativo de presupuestos; proveedor habitual por rubro.'],
  ['Depósito', 'Material Layher que se cruza con otros proveedores (alquilado, prestado, vendido); ingreso de compras; activos como bien de uso o de capital y a quién se entregó cada equipo.'],
  ['Logística', 'Service por km; neumáticos y baterías; combustible pagado de caja atado al vehículo.'],
  ['Seguros', 'ART/AP de cada empleado con vencimiento; alta y baja en AP por evento; cuotas de las pólizas.'],
  ['Novedades', 'El libro de novedades por evento: no existe todavía.'],
  ['Varios', 'Repositorio de archivos y de la documentación de la empresa.'],
  ['Calendario', 'Montaje y desmontaje; tareas del cronograma; 4 tipos de aviso que ya se calculan pero no se muestran; cumpleaños.'],
  ['Infraestructura', 'PDF desde el servidor y probar que un backup se restaura. Va al final, junto con el servidor definitivo.'],
];

// ── Secciones ────────────────────────────────────────────────────────────────
const colsPil = [700, 3326, 2500, 2500];
const tablaPilares = new Table({
  width: { size: W, type: WidthType.DXA }, columnWidths: colsPil,
  rows: [
    new TableRow({ tableHeader: true, children: ['#', 'Pilar', 'DOS57', 'Enjoy'].map((h, i) => cell(h, colsPil[i], { bold: true, color: 'FFFFFF', fill: NAVY })) }),
    ...pilares.map(([n, nombre, d, e, marca]) => new TableRow({ cantSplit: true, children: [
      cell(n, colsPil[0], { color: MUTED }), cell(nombre, colsPil[1]),
      barCell(d, marca, colsPil[2]), barCell(e, null, colsPil[3]),
    ] })),
    new TableRow({ children: [
      cell('', colsPil[0], { fill: 'E2E8F0' }), cell('En uso con datos reales', colsPil[1], { bold: true, fill: 'E2E8F0' }),
      cell('0%', colsPil[2], { bold: true, fill: 'E2E8F0' }), cell('0%', colsPil[3], { bold: true, fill: 'E2E8F0' }),
    ] }),
  ],
});

const colsMes = [1500, 7526];
const tablaMeses = table(colsMes, ['Mes', 'Lo principal'], meses, (ri, i) => i === 0 ? { bold: true, color: ACCENT } : {});

const colsDes = [1900, 7126];
const tablaDesarrollado = table(colsDes, ['Pilar', 'Lo que ya cubre el sistema'],
  desarrollado.map(([pilar, general, male, dani]) => [
    pilar,
    [
      new Paragraph({ spacing: { after: male || dani ? 80 : 0 }, children: [t(general)] }),
      ...(male ? [new Paragraph({ spacing: { after: dani ? 80 : 0 }, children: [new TextRun({ text: 'Enjoy, con Male: ', bold: true, color: ACCENT }), t(male)] })] : []),
      ...(dani ? [new Paragraph({ children: [new TextRun({ text: 'Enjoy, con Dani: ', bold: true, color: ACCENT }), t(dani)] })] : []),
    ],
  ]),
  (ri, i) => i === 0 ? { bold: true, valign: VerticalAlign.TOP } : { valign: VerticalAlign.TOP });

const children = [
  // Portada
  new Paragraph({ spacing: { before: 2400, after: 120 }, children: [new TextRun({ text: 'ENJOY · DOS57', color: ACCENT, bold: true, size: 24, characterSpacing: 40 })] }),
  new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: 'Sistema de Gestión Integral', color: NAVY, bold: true, size: 56 })] }),
  new Paragraph({ spacing: { after: 480 }, border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: ACCENT, space: 8 } }, children: [new TextRun({ text: 'Informe de avance — Noviembre 2026', color: NAVY, size: 36 })] }),
  p([muted('Fecha de corte: 4 de noviembre de 2026')]),
  p([muted('Primer informe mensual: queda como línea de base y los próximos informes se comparan contra estos números.')]),
  new Paragraph({ children: [new PageBreak()] }),

  h1('1. Resumen'),
  bullet([t('El sistema cubre '), b('10 de los 12 pilares'), t('. Marketing y Comunicación quedan para cuando se releve a Vicky.')]),
  bullet('Cada funcionalidad que se pidió en los relevamientos, en las planillas y en la especificación está listada con su estado. Los porcentajes salen de esa lista: muestran lo hecho y también lo que falta.'),
  bullet([t('Todavía '), b('nada está en uso con datos reales'), t('. El próximo paso es recorrer el sistema con cada responsable, con sus planillas cargadas.')]),

  h1('2. Avance por pilar'),
  tablaPilares,
  p([muted('Verde: 80% o más · Amarillo: entre 50% y 79% · Rojo: menos de 50%.', 18)], { spacing: { before: 80, after: 80 } }),
  p([new TextRun({ text: '* Falta relevar a Sergio y a Verónica, los responsables del depósito de DOS57.', size: 20 })], { spacing: { after: 200 } }),

  callout([
    new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: 'Cómo leer estos números', bold: true, color: NAVY, size: 26 })] }),
    p([t('El porcentaje es '), b('lo hecho sobre todo lo que se pidió hasta hoy'), t('. Lo hecho cuenta 1, lo parcial cuenta ½ y lo pendiente o a definir cuenta 0. Lo que no aplica a una empresa no se cuenta.')]),
    p([b('Los porcentajes van a bajar, y está bien que pase. '), t('Cuando cada responsable empiece a dar vueltas por el sistema van a surgir tareas nuevas: la lista de lo pedido crece y el porcentaje baja, aunque no se haya dejado de hacer nada. No es un retroceso; es que conocemos mejor el trabajo de cada área.')]),
    p([b('Un ejemplo: '), t('Depósito de DOS57 tiene hoy 14 de 18 tareas hechas, un 78%. Con Jaz y Pollo todavía no hablamos de cómo manejar las herramientas de cada equipo ni el stock dinámico de materiales. Si de esa charla salen 6 tareas nuevas, el pilar queda en 14 de 24, un 58%, con el mismo sistema.')]),
    new Paragraph({ spacing: { after: 60 }, children: [b('Dónde esperamos que baje:')] }),
    bullet([b('Depósito y Logística: '), t('herramientas por equipo y stock dinámico de materiales (Jaz y Pollo); el depósito de DOS57 con Sergio y Verónica.')]),
    bullet([b('Administración de Enjoy: '), t('la producción de los eventos con Vicky.')]),
    bullet([b('Marketing y Comunicación: '), t('todavía sin relevar; cuando se releven entran con su propia lista.')]),
    bullet([b('Novedades: '), t('qué tipos de novedad hay, su gravedad y quién se entera de cada una.')]),
    bullet([b('Todos los pilares: '), t('la pasada con cada responsable.')]),
  ]),
  p([b('Pilar nuevo, 12 · Calendario transversal: '), t('el calendario no es de un área. Junta en un solo lugar lo que pasa y lo que vence en todos los pilares, y cada persona ve lo suyo.')], { spacing: { before: 240, after: 120 } }),

  h1('3. Lo que ya cubre el sistema'),
  p([t('Desde el Kick-off y los primeros relevamientos, a mediados de julio de 2026.')]),
  tablaMeses,
  new Paragraph({ spacing: { before: 240, after: 120 }, keepNext: true, pageBreakBefore: true, children: [b('Por pilar')] }),
  tablaDesarrollado,

  h1('4. Lo que más falta, por pilar'),
  table([1900, 7126], ['Pilar', 'Lo principal que falta'], falta, (ri, i) => i === 0 ? { bold: true } : {}),

  h1('5. Lo que necesitamos del cliente'),
  p('Estas son las preguntas que más destraban; el resto las vemos con cada responsable.', { spacing: { after: 120 }, keepNext: true }),
  numbered([b('Relevar a Vicky'), t(' (Marketing, Comunicación, producción de Enjoy) y a '), b('Sergio y Verónica'), t(' (depósito DOS57).')]),
  numbered([b('Mayra: '), t('quién recibe el aviso de cheques de los jueves; si los cheques de Bancor (Chino) se llevan en el sistema; cuántos leasings hay.')]),
  numbered([b('Matías y Mayra: '), t('confirmar que la antigüedad se cuenta desde el ingreso y no desde el último acuerdo; cómo se elige el premio de producción 1 o 2.')]),
  numbered([b('Andrea: '), t('cómo quiere el viático de los extranjeros y la aprobación del resumen semanal de pagos.')]),
  numbered([b('Enjoy: '), t('quién lleva los papeles, el combustible y los viajes de su flota (4 vehículos).')]),
  numbered([b('Novedades: '), t('qué tipos de novedad hay, cuál es su gravedad y quién se entera de cada una.')]),

  h1('6. Próximos pasos'),
  numbered2([b('Pasada con cada responsable: '), t('recorrer el sistema con cada uno, con sus propias planillas cargadas, y anotar todo lo que surja. Es esperable que en esta etapa los porcentajes bajen.')]),
  numbered2([b('Ajustes de lo que salga de esas reuniones, '), t('empezando por lo que Mayra usa todos los días: cheques de la empresa por banco con el aviso de los jueves, y sueldos con conceptos separados y cierre por transferencia y efectivo. Además, los arreglos rápidos del calendario: los 4 avisos que faltan y los días de montaje y desmontaje.')]),
  numbered2([b('Primer evento real trabajado en el sistema: '), t('desde ahí empieza a moverse el "en uso".')]),
  numbered2([b('Infraestructura, al final: '), t('cuando las funcionalidades estén casi listas y sea necesario, se abre una cuenta en AWS para que el sistema trabaje tranquilo y escale sin problemas. Ahí entran los PDF desde el servidor y la prueba de restaurar un backup.')]),
];
function numbered2(children) { return bullet(children, 'pasos'); }

const doc = new Document({
  creator: 'Admin Portal', title: 'Informe de avance — Noviembre 2026',
  styles: {
    default: { document: { run: { font: FONT, size: 22, color: '1F2937' } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { font: FONT, size: 30, bold: true, color: NAVY },
        paragraph: { spacing: { before: 360, after: 160 }, keepNext: true, outlineLevel: 0 } },
    ],
  },
  numbering: { config: ['bullets', 'nums', 'pasos'].map(ref => ({
    reference: ref,
    levels: [{ level: 0, format: ref === 'bullets' ? LevelFormat.BULLET : LevelFormat.DECIMAL, text: ref === 'bullets' ? '•' : '%1.',
      alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }],
  })) },
  sections: [{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } }, titlePage: true },
    footers: {
      first: new Footer({ children: [new Paragraph('')] }),
      default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [
        new TextRun({ text: 'Enjoy · DOS57 — Informe de avance, noviembre 2026 · ', color: MUTED, size: 16 }),
        new TextRun({ children: [PageNumber.CURRENT], color: MUTED, size: 16 }),
      ] })] }),
    },
    children,
  }],
});

Packer.toBuffer(doc).then(buf => { fs.writeFileSync(SALIDA, buf); console.log('ok: ' + SALIDA); });
