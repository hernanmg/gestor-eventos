const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, BorderStyle, WidthType, ShadingType,
  LevelFormat, PageNumber, Header, Footer, PageBreak
} = require('docx');
const fs = require('fs');
const path = require('path');

// Colors
const BLUE_DARK = "1F4E79";
const BLUE_MID = "2E75B6";
const BLUE_LIGHT = "D6E4F0";
const BLUE_ACCENT = "E8F4FD";
const GREEN_DARK = "1E5631";
const GREEN_MID = "2E7D32";
const GREEN_LIGHT = "E8F5E9";
const ORANGE_DARK = "BF360C";
const ORANGE_LIGHT = "FFF3E0";
const GRAY_DARK = "424242";
const GRAY_LIGHT = "F5F5F5";
const WHITE = "FFFFFF";
const YELLOW_LIGHT = "FFFDE7";
const RED_LIGHT = "FFEBEE";
const PURPLE_LIGHT = "F3E5F5";
const PURPLE_MID = "6A1B9A";

const bd = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const borders = { top: bd, bottom: bd, left: bd, right: bd };
const noBd = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: noBd, bottom: noBd, left: noBd, right: noBd };

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 400, after: 160 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: BLUE_MID, space: 4 } },
    children: [new TextRun({ text, font: "Arial", size: 34, bold: true, color: BLUE_DARK })]
  });
}

function h2(text, color = BLUE_MID) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 300, after: 120 },
    children: [new TextRun({ text, font: "Arial", size: 26, bold: true, color })]
  });
}

function h3(text, color = BLUE_DARK) {
  return new Paragraph({
    spacing: { before: 200, after: 80 },
    children: [new TextRun({ text, font: "Arial", size: 22, bold: true, color })]
  });
}

function body(text, opts = {}) {
  return new Paragraph({
    spacing: { before: 60, after: 60 },
    children: [new TextRun({ text, font: "Arial", size: 21, color: GRAY_DARK, ...opts })]
  });
}

function bullet(text, bold = false, color = GRAY_DARK) {
  return new Paragraph({
    numbering: { reference: "bullets", level: 0 },
    spacing: { before: 40, after: 40 },
    children: [new TextRun({ text, font: "Arial", size: 21, bold, color })]
  });
}

function sp(n = 1) {
  return Array.from({ length: n }, () =>
    new Paragraph({ children: [new TextRun({ text: "", size: 20 })] })
  );
}

function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}

function colorBox(text, fill = BLUE_LIGHT, textColor = BLUE_DARK) {
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [9360],
    rows: [new TableRow({
      children: [new TableCell({
        borders,
        width: { size: 9360, type: WidthType.DXA },
        shading: { fill, type: ShadingType.CLEAR },
        margins: { top: 140, bottom: 140, left: 200, right: 200 },
        children: [new Paragraph({
          children: [new TextRun({ text, font: "Arial", size: 21, bold: true, color: textColor })]
        })]
      })]
    })]
  });
}

function twoColBox(left, right, leftFill = BLUE_LIGHT, rightFill = GREEN_LIGHT) {
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [4620, 4620] ,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            borders,
            width: { size: 4620, type: WidthType.DXA },
            shading: { fill: BLUE_MID, type: ShadingType.CLEAR },
            margins: { top: 100, bottom: 100, left: 160, right: 160 },
            children: [new Paragraph({ children: [new TextRun({ text: left, font: "Arial", size: 21, bold: true, color: WHITE })] })]
          }),
          new TableCell({
            borders,
            width: { size: 4620, type: WidthType.DXA },
            shading: { fill: GREEN_MID, type: ShadingType.CLEAR },
            margins: { top: 100, bottom: 100, left: 160, right: 160 },
            children: [new Paragraph({ children: [new TextRun({ text: right, font: "Arial", size: 21, bold: true, color: WHITE })] })]
          })
        ]
      })
    ]
  });
}

function stdTable(headers, rows, headerFill = BLUE_DARK) {
  const colCount = headers.length;
  const totalWidth = 9360;
  const colWidth = Math.floor(totalWidth / colCount);
  const colWidths = Array(colCount).fill(colWidth);

  const headerRow = new TableRow({
    children: headers.map((h, i) => new TableCell({
      borders,
      width: { size: colWidths[i], type: WidthType.DXA },
      shading: { fill: headerFill, type: ShadingType.CLEAR },
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
      children: [new Paragraph({ children: [new TextRun({ text: h, font: "Arial", size: 19, bold: true, color: WHITE })] })]
    }))
  });

  const dataRows = rows.map((row, ri) =>
    new TableRow({
      children: row.map((cell, ci) => {
        const isObj = typeof cell === 'object' && cell !== null;
        const cellText = isObj ? cell.text : cell;
        const cellFill = isObj ? cell.fill : (ri % 2 === 0 ? GRAY_LIGHT : WHITE);
        const cellBold = isObj ? (cell.bold || false) : false;
        const cellColor = isObj ? (cell.color || GRAY_DARK) : GRAY_DARK;
        return new TableCell({
          borders,
          width: { size: colWidths[ci], type: WidthType.DXA },
          shading: { fill: cellFill, type: ShadingType.CLEAR },
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [new Paragraph({ children: [new TextRun({ text: cellText, font: "Arial", size: 19, bold: cellBold, color: cellColor })] })]
        });
      })
    })
  );

  return new Table({
    width: { size: totalWidth, type: WidthType.DXA },
    columnWidths: colWidths,
    rows: [headerRow, ...dataRows]
  });
}

function customColTable(headers, rows, colWidths, headerFill = BLUE_DARK) {
  const headerRow = new TableRow({
    children: headers.map((h, i) => new TableCell({
      borders,
      width: { size: colWidths[i], type: WidthType.DXA },
      shading: { fill: headerFill, type: ShadingType.CLEAR },
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
      children: [new Paragraph({ children: [new TextRun({ text: h, font: "Arial", size: 19, bold: true, color: WHITE })] })]
    }))
  });

  const dataRows = rows.map((row, ri) =>
    new TableRow({
      children: row.map((cell, ci) => {
        const isObj = typeof cell === 'object' && cell !== null;
        const cellText = isObj ? cell.text : cell;
        const cellFill = isObj ? (cell.fill || (ri % 2 === 0 ? GRAY_LIGHT : WHITE)) : (ri % 2 === 0 ? GRAY_LIGHT : WHITE);
        const cellBold = isObj ? (cell.bold || false) : false;
        const cellColor = isObj ? (cell.color || GRAY_DARK) : GRAY_DARK;
        return new TableCell({
          borders,
          width: { size: colWidths[ci], type: WidthType.DXA },
          shading: { fill: cellFill, type: ShadingType.CLEAR },
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [new Paragraph({ children: [new TextRun({ text: cellText, font: "Arial", size: 19, bold: cellBold, color: cellColor })] })]
        });
      })
    })
  );

  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: colWidths,
    rows: [headerRow, ...dataRows]
  });
}

// ─── DOCUMENT ───────────────────────────────────────────────────────────────

const doc = new Document({
  numbering: {
    config: [
      {
        reference: "bullets",
        levels: [{
          level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } }
        }]
      },
      {
        reference: "numbers",
        levels: [{
          level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } }
        }]
      }
    ]
  },
  styles: {
    default: { document: { run: { font: "Arial", size: 21 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 34, bold: true, font: "Arial", color: BLUE_DARK },
        paragraph: { spacing: { before: 400, after: 160 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 26, bold: true, font: "Arial", color: BLUE_MID },
        paragraph: { spacing: { before: 300, after: 120 }, outlineLevel: 1 } }
    ]
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 }
      }
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: BLUE_MID, space: 4 } },
          children: [new TextRun({ text: "Plan de Desarrollo  |  Sistema de Gestión Financiera para Eventos", font: "Arial", size: 18, color: "888888" })]
        })]
      })
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          border: { top: { style: BorderStyle.SINGLE, size: 4, color: BLUE_MID, space: 4 } },
          alignment: AlignmentType.RIGHT,
          children: [
            new TextRun({ text: "Página ", font: "Arial", size: 17, color: "888888" }),
            new TextRun({ children: [PageNumber.CURRENT], font: "Arial", size: 17, color: "888888" }),
            new TextRun({ text: " de ", font: "Arial", size: 17, color: "888888" }),
            new TextRun({ children: [PageNumber.TOTAL_PAGES], font: "Arial", size: 17, color: "888888" })
          ]
        })]
      })
    },
    children: [

      // ── PORTADA ─────────────────────────────────────────────────────────
      ...sp(3),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 100 },
        children: [new TextRun({ text: "PLAN DE DESARROLLO", font: "Arial", size: 52, bold: true, color: BLUE_DARK })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 60 },
        children: [new TextRun({ text: "Sistema de Gestión Financiera para Eventos", font: "Arial", size: 30, color: BLUE_MID })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 300 },
        children: [new TextRun({ text: "Entregas por fases · Infraestructura · Modelo de cobro", font: "Arial", size: 22, color: "888888", italics: true })]
      }),
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [9360],
        rows: [new TableRow({ children: [new TableCell({
          borders,
          shading: { fill: BLUE_LIGHT, type: ShadingType.CLEAR },
          margins: { top: 240, bottom: 240, left: 360, right: 360 },
          children: [
            new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Basado en análisis del template Excel real del cliente (Flujo_de_Caja_Generico.xlsx)", font: "Arial", size: 20, italics: true, color: BLUE_DARK })] }),
            new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 80 }, children: [new TextRun({ text: "10 hojas · 5 categorías de egreso · 5 categorías de ingreso · Caja con echeqs", font: "Arial", size: 19, color: GRAY_DARK })] })
          ]
        })]})],
      }),
      ...sp(2),
      pageBreak(),

      // ── SECCIÓN 1: ANÁLISIS DEL EXCEL ───────────────────────────────────
      h1("1. Análisis del Template Excel del Cliente"),
      body("El archivo Flujo_de_Caja_Generico.xlsx es el template base que el cliente usa actualmente para todos sus eventos. Tiene una estructura clara y consistente de 10 hojas, lo que simplifica enormemente el diseño del importador."),
      ...sp(1),

      h2("1.1 Estructura de hojas identificadas"),
      customColTable(
        ["Hoja", "Nombre en Excel", "Tipo", "Campos clave"],
        [
          ["RESUMEN", "Hoja de Conciliación", {text:"Conciliatoria", fill: BLUE_ACCENT, bold:true, color: BLUE_DARK}, "Categorías 1-10, Debe/Haber/Saldo, Distribución socios"],
          ["EG-TC 1", "Egresos del Evento", {text:"Egreso", fill: RED_LIGHT, bold:true, color: ORANGE_DARK}, "Fecha, Concepto, Descripción, Debe, Haber, Saldo"],
          ["EG-RET SOC 2", "Egresos Societarios", {text:"Egreso", fill: RED_LIGHT, bold:true, color: ORANGE_DARK}, "Fecha, Concepto, Descripción, Debe, Haber, Saldo"],
          ["EG-EXTRA 3", "Egresos Extraordinarios", {text:"Egreso", fill: RED_LIGHT, bold:true, color: ORANGE_DARK}, "Fecha, Concepto, Desc. + tabla de echeqs con N°, razón social, importes, fecha"],
          ["EG-IMP 4", "Egresos Impuestos", {text:"Egreso", fill: RED_LIGHT, bold:true, color: ORANGE_DARK}, "PAYWAY, REBA, AUTOENTRADA, IVA, IIBB, Municipalidad, Ganancias"],
          ["EG-PREST 5", "Préstamos", {text:"Egreso", fill: RED_LIGHT, bold:true, color: ORANGE_DARK}, "Fecha, Concepto, Descripción, Debe, Haber, Saldo"],
          ["ING TICKETS 6", "Ingresos por Tickets", {text:"Ingreso", fill: GREEN_LIGHT, bold:true, color: GREEN_DARK}, "Fecha, Descripción, Debe, Haber, Saldo"],
          ["ING SPON 7", "Ingresos por Sponsors", {text:"Ingreso", fill: GREEN_LIGHT, bold:true, color: GREEN_DARK}, "Fecha, Descripción, Debe, Haber, Saldo"],
          ["ING CORP 8", "Ingresos Corporativos", {text:"Ingreso", fill: GREEN_LIGHT, bold:true, color: GREEN_DARK}, "Fecha, Descripción, Debe, Haber, Saldo"],
          ["ING GASTRO 9", "Ingresos Gastronomía", {text:"Ingreso", fill: GREEN_LIGHT, bold:true, color: GREEN_DARK}, "Fecha, Descripción, Debe, Haber, Saldo"],
          ["ING SERV CHARGE 10", "Service Charge", {text:"Ingreso", fill: GREEN_LIGHT, bold:true, color: GREEN_DARK}, "Fecha, Descripción, Debe, Haber, Saldo"],
          ["xxx", "Caja / Movimientos", {text:"Caja", fill: YELLOW_LIGHT, bold:true, color: "7B5800"}, "Fecha, Saldo inicial, movimientos acumulados con saldo corriente"],
        ],
        [2200, 2300, 1400, 3460]
      ),
      ...sp(1),
      h2("1.2 Hallazgos clave para el desarrollo"),
      bullet("La hoja RESUMEN es la conciliatoria automática: toma totales de las 10 categorías y calcula saldo final + distribución entre socios (50%/50%)."),
      bullet("La hoja EG-EXTRA 3 tiene dos zonas: la tabla estándar de movimientos y una sección separada de echeqs (cheques electrónicos) con N°, razón social, pagado/pendiente y fecha. Esto confirma el módulo de cheques."),
      bullet("La hoja EG-IMP 4 tiene subcategorías predefinidas de impuestos: PAYWAY, REBA, AUTOENTRADA, IVA, IIBB, Municipalidad, Ganancias. Esto hay que replicarlo exactamente en el sistema."),
      bullet("La hoja xxx (caja) tiene saldo inicial y acumula saldo corriente por fila. Es la base del módulo de caja."),
      bullet("La estructura es idéntica en todos los eventos (mismo template), lo que hace el importador muy directo de implementar."),
      ...sp(1),
      pageBreak(),

      // ── SECCIÓN 2: PLAN DE DESARROLLO ───────────────────────────────────
      h1("2. Plan de Desarrollo por Fases"),
      body("El desarrollo se divide en 4 fases entregables, cada una funcional por sí sola. El cliente puede empezar a usar el sistema desde la Fase 1 mientras se desarrollan las siguientes."),
      ...sp(1),

      // FASE 1
      h2("FASE 1 — Core del sistema (MVP)", GREEN_MID),
      colorBox("Duración estimada: 4 a 6 semanas  |  Entrega funcional y usable desde el día 1", GREEN_LIGHT, GREEN_DARK),
      ...sp(1),
      body("Incluye todo lo necesario para gestionar un evento completo de forma básica, replicando fielmente la estructura del Excel."),
      ...sp(1),
      customColTable(
        ["Módulo", "Descripción"],
        [
          ["Alta de eventos", "Crear, editar y listar eventos con nombre, fecha y estado (activo/cerrado)."],
          ["Egresos (5 categorías)", "EG-TC, EG-SOC, EG-EXTRA, EG-IMP (con subcats de PAYWAY/REBA/etc.), EG-PREST. Campos: fecha, concepto, descripción, debe, haber, saldo acumulado."],
          ["Ingresos (5 categorías)", "Tickets, Sponsors, Corporativo, Gastronomía, Service Charge. Campos: fecha, descripción, debe, haber, saldo."],
          ["Módulo de Caja", "Saldo inicial, movimientos diarios con saldo corriente. Vista de estado actual."],
          ["Conciliatoria (RESUMEN)", "Pantalla automática: total ingresos - total egresos = saldo final. Distribución por socios configurable."],
          ["Autenticación", "Login simple con usuarios y contraseñas. Hasta 4 usuarios."],
        ],
        [2600, 6760]
      ),
      ...sp(1),

      // FASE 2
      h2("FASE 2 — Cheques e importación Excel", BLUE_MID),
      colorBox("Duración estimada: 3 a 4 semanas  |  Agrega el historial y la gestión de echeqs", BLUE_LIGHT, BLUE_DARK),
      ...sp(1),
      customColTable(
        ["Módulo", "Descripción"],
        [
          ["Gestión de echeqs", "Registro de cheques electrónicos: N°, razón social, detalle, importe pagado/pendiente, fecha de emisión/cobro, estado. Vista de cheques pendientes de cobro."],
          ["Importador Excel", "Subida del template Flujo_de_Caja_Generico.xlsx. El sistema lee las 10 hojas y crea el evento con todos sus movimientos. Vista previa antes de confirmar importación."],
          ["Historial de eventos", "Listado de todos los eventos (nativos e importados) con filtros por fecha, estado y resultado neto."],
          ["Múltiples bancos", "Soporte para 2-3 cuentas bancarias por evento con saldos independientes."],
        ],
        [2600, 6760]
      ),
      ...sp(1),

      // FASE 3
      h2("FASE 3 — Reportes y exportación", PURPLE_MID),
      colorBox("Duración estimada: 3 a 4 semanas  |  Inteligencia sobre los datos históricos", PURPLE_LIGHT, PURPLE_MID),
      ...sp(1),
      customColTable(
        ["Módulo", "Descripción"],
        [
          ["Reportes comparativos", "Comparar resultados entre eventos: ingresos por categoría, egresos por tipo, resultado neto, distribución socios."],
          ["Exportación a Excel/PDF", "Generar el Flujo_de_Caja del evento en formato Excel (mismo template) y PDF para compartir."],
          ["Dashboard resumen", "Vista principal con KPIs: eventos activos, último resultado, categoría de mayor gasto/ingreso."],
          ["Filtros y búsqueda", "Buscar movimientos por concepto, proveedor o monto en cualquier hoja."],
        ],
        [2600, 6760]
      ),
      ...sp(1),

      // FASE 4
      h2("FASE 4 — Configuración avanzada y otras unidades", "7B3F00"),
      colorBox("Duración estimada: variable según unidades  |  Expansión a otros negocios del cliente", ORANGE_LIGHT, ORANGE_DARK),
      ...sp(1),
      customColTable(
        ["Módulo", "Descripción"],
        [
          ["Pestañas renombrables", "Permitir cambiar los nombres de las categorías de ingreso y egreso por evento o globalmente."],
          ["Gestión de proveedores", "ABM de proveedores reutilizables entre eventos (CUIT, razón social, datos de contacto, historial de pagos)."],
          ["Nuevas unidades de negocio", "Adaptar el sistema para otras unidades del cliente con sus propias categorías de ingreso/egreso."],
          ["Roles y permisos", "Acceso diferenciado por usuario: administrador, visualizador, carga de datos."],
        ],
        [2600, 6760]
      ),
      ...sp(1),
      pageBreak(),

      // ── SECCIÓN 3: INFRAESTRUCTURA ───────────────────────────────────────
      h1("3. Infraestructura: Nube (AWS) vs. Servidor Propio"),
      body("El cliente tiene dudas sobre usar la nube. A continuación se presenta un análisis honesto de pros y contras de cada opción, con costos reales para 3-4 usuarios."),
      ...sp(1),

      h2("3.1 Opción A — Deploy en AWS (nube)"),
      ...sp(1),

      customColTable(
        ["✅ PROS", "❌ CONTRAS"],
        [
          [
            {text: "Sin gestión de hardware: AWS maneja actualizaciones, seguridad física y disponibilidad.", fill: GREEN_LIGHT, color: GREEN_DARK},
            {text: "Costo mensual fijo aunque pequeño (aprox. USD 25-60/mes para 3-4 usuarios).", fill: RED_LIGHT, color: ORANGE_DARK}
          ],
          [
            {text: "Backups automáticos diarios configurables. Los datos nunca se pierden.", fill: GREEN_LIGHT, color: GREEN_DARK},
            {text: "Requiere conexión a internet en todo momento para acceder.", fill: RED_LIGHT, color: ORANGE_DARK}
          ],
          [
            {text: "Acceso desde cualquier lugar: oficina, celular, viaje.", fill: GREEN_LIGHT, color: GREEN_DARK},
            {text: "Los datos están en servidores de terceros (aunque encriptados y privados).", fill: RED_LIGHT, color: ORANGE_DARK}
          ],
          [
            {text: "Escalable: si el negocio crece y hay 20 usuarios, se ajusta sin cambiar nada.", fill: GREEN_LIGHT, color: GREEN_DARK},
            {text: "Dependencia del proveedor (aunque los datos siempre son exportables).", fill: RED_LIGHT, color: ORANGE_DARK}
          ],
          [
            {text: "SSL/HTTPS incluido, actualizaciones de seguridad automáticas.", fill: GREEN_LIGHT, color: GREEN_DARK},
            {text: "Para volumen bajo, puede ser un costo \"innecesario\" si el servidor propio funciona bien.", fill: RED_LIGHT, color: ORANGE_DARK}
          ],
        ],
        [4680, 4680]
      ),
      ...sp(1),

      h3("Costos mensuales estimados en AWS (3-4 usuarios, uso moderado)"),
      customColTable(
        ["Servicio AWS", "Descripción", "Costo mensual (USD)"],
        [
          ["EC2 t3.micro", "Servidor de aplicación (Node.js/Python backend)", "~$8-12"],
          ["RDS db.t3.micro", "Base de datos PostgreSQL administrada", "~$13-18"],
          ["S3 Standard", "Almacenamiento de archivos Excel importados", "~$1-3"],
          ["Route 53", "DNS para dominio propio (ej: gestion.cliente.com)", "~$0.50"],
          ["ACM (SSL)", "Certificado HTTPS gratuito", "$0"],
          ["Data transfer", "Tráfico saliente (uso moderado)", "~$1-3"],
          [{text:"TOTAL ESTIMADO", bold:true, fill:BLUE_ACCENT, color:BLUE_DARK}, {text:"Para 3-4 usuarios con uso normal", bold:true, fill:BLUE_ACCENT, color:BLUE_DARK}, {text:"~$25-40 / mes", bold:true, fill:BLUE_ACCENT, color:BLUE_DARK}],
        ],
        [3200, 3800, 2360]
      ),
      ...sp(1),

      h2("3.2 Opción B — Servidor propio del cliente"),
      ...sp(1),
      customColTable(
        ["✅ PROS", "❌ CONTRAS"],
        [
          [
            {text: "Costo mensual cercano a $0 si ya tiene el servidor.", fill: GREEN_LIGHT, color: GREEN_DARK},
            {text: "Alguien tiene que administrarlo: actualizaciones, seguridad, espacio.", fill: RED_LIGHT, color: ORANGE_DARK}
          ],
          [
            {text: "Los datos quedan en su propio hardware, mayor sensación de control.", fill: GREEN_LIGHT, color: GREEN_DARK},
            {text: "No sabemos las características del servidor: puede ser insuficiente.", fill: RED_LIGHT, color: ORANGE_DARK}
          ],
          [
            {text: "Sin dependencia de terceros para la infraestructura.", fill: GREEN_LIGHT, color: GREEN_DARK},
            {text: "Si el servidor falla o se cae, el sistema no está disponible.", fill: RED_LIGHT, color: ORANGE_DARK}
          ],
          [
            {text: "Sin costo adicional mensual por el hardware.", fill: GREEN_LIGHT, color: GREEN_DARK},
            {text: "Backups manuales o configurados por nosotros. Riesgo de pérdida de datos.", fill: RED_LIGHT, color: ORANGE_DARK}
          ],
          [
            {text: "Puede ser suficiente para 3-4 usuarios con bajo volumen.", fill: GREEN_LIGHT, color: GREEN_DARK},
            {text: "Acceso remoto requiere configurar VPN o IP pública fija, que puede tener costo.", fill: RED_LIGHT, color: ORANGE_DARK}
          ],
        ],
        [4680, 4680]
      ),
      ...sp(1),
      colorBox("⚠️  ACCIÓN PENDIENTE: Antes de decidir, el cliente debe informar marca/modelo del servidor, sistema operativo, RAM, disco, y si tiene IP pública o acceso remoto configurado.", YELLOW_LIGHT, "7B5800"),
      ...sp(1),

      h2("3.3 Recomendación"),
      body("Para 3-4 usuarios y un sistema de esta escala, la recomendación es empezar en AWS por las siguientes razones:"),
      bullet("El costo de USD 30-40/mes es marginal comparado con el valor que genera el sistema."),
      bullet("Zero administración de infraestructura: el cliente no necesita saber nada de servidores."),
      bullet("Backups automáticos diarios: si alguien borra datos sin querer, se recuperan."),
      bullet("Si en el futuro el cliente quiere migrar a su servidor propio, se puede hacer sin perder datos."),
      bullet("Si el servidor propio resulta ser adecuado (una vez que lo evalúen), se puede desplegar ahí y el costo baja a cero."),
      ...sp(1),
      body("Propuesta intermedia:", { bold: true }),
      body("Arrancar en AWS durante la Fase 1 y 2 (desarrollo y prueba). Una vez que el cliente ve el sistema funcionando y confía en él, evalúan si migrar al servidor propio o seguir en AWS. Esto elimina el riesgo de setup inicial en hardware desconocido."),
      ...sp(1),
      pageBreak(),

      // ── SECCIÓN 4: MODELO DE COBRO ───────────────────────────────────────
      h1("4. Modelo de Cobro Recomendado"),
      body("La estrategia propuesta es de bajo costo de entrada + ingreso recurrente, pensando en que el cliente tiene varias unidades de negocio y el objetivo es construir una relación a largo plazo."),
      ...sp(1),

      h2("4.1 Estructura por fases + mantenimiento"),
      ...sp(1),
      customColTable(
        ["Concepto", "Descripción", "Monto sugerido (USD)"],
        [
          [{text:"FASE 1 — MVP Core", bold:true, fill:GREEN_LIGHT, color:GREEN_DARK}, "Eventos, egresos, ingresos, caja, conciliatoria, login. Sistema funcional.", {text:"$800 - $1.200", bold:true, fill:GREEN_LIGHT, color:GREEN_DARK}],
          [{text:"FASE 2 — Cheques + Importación", bold:true, fill:BLUE_ACCENT, color:BLUE_DARK}, "Módulo de echeqs, importador Excel, historial, múltiples bancos.", {text:"$500 - $800", bold:true, fill:BLUE_ACCENT, color:BLUE_DARK}],
          [{text:"FASE 3 — Reportes", bold:true, fill:PURPLE_LIGHT, color:PURPLE_MID}, "Dashboard, comparativos, exportación Excel/PDF, filtros.", {text:"$400 - $600", bold:true, fill:PURPLE_LIGHT, color:PURPLE_MID}],
          [{text:"FASE 4 — Expansión", bold:true, fill:ORANGE_LIGHT, color:ORANGE_DARK}, "Otras unidades de negocio, proveedores, roles. A cotizar según alcance.", {text:"A definir", bold:true, fill:ORANGE_LIGHT, color:ORANGE_DARK}],
          [{text:"Mantenimiento mensual", bold:true, fill:YELLOW_LIGHT, color:"7B5800"}, "Soporte, corrección de bugs, actualizaciones menores, gestión de infra AWS.", {text:"$80 - $150 / mes", bold:true, fill:YELLOW_LIGHT, color:"7B5800"}],
          [{text:"TOTAL FASES 1-3", bold:true, fill:BLUE_DARK, color:WHITE}, "Sistema completo con importación y reportes.", {text:"$1.700 - $2.600", bold:true, fill:BLUE_DARK, color:WHITE}],
        ],
        [2800, 4400, 2160]
      ),
      ...sp(1),

      h2("4.2 Esquema de pagos sugerido"),
      body("Para bajar la barrera de entrada y generar confianza, se recomienda dividir el pago de cada fase en dos cuotas:"),
      ...sp(1),
      customColTable(
        ["Momento del pago", "Porcentaje", "Justificación"],
        [
          ["Al inicio de cada fase (anticipo)", "50%", "Cubre horas de desarrollo iniciales y compromiso mutuo."],
          ["Al entregar la fase funcionando", "50%", "El cliente paga cuando ve y aprueba el resultado."],
          ["Mantenimiento", "100% por mes adelantado", "Se factura al inicio de cada mes."],
        ],
        [3400, 2200, 3760]
      ),
      ...sp(1),

      h2("4.3 Por qué este modelo funciona para ambas partes"),
      ...sp(1),
      customColTable(
        ["Para el cliente", "Para vos (el desarrollador)"],
        [
          [
            {text: "Inversión inicial baja: empieza usando el sistema desde la Fase 1 sin pagar todo junto.", fill: GREEN_LIGHT, color: GREEN_DARK},
            {text: "Ingresos sostenidos: el mantenimiento mensual genera flujo constante.", fill: BLUE_ACCENT, color: BLUE_DARK}
          ],
          [
            {text: "Paga por valor entregado: si una fase no le convence, puede pausar sin perder todo.", fill: GREEN_LIGHT, color: GREEN_DARK},
            {text: "Relación a largo plazo: cada unidad de negocio nueva es una Fase 4 adicional.", fill: BLUE_ACCENT, color: BLUE_DARK}
          ],
          [
            {text: "Ve resultados rápido: en 4-6 semanas ya tiene algo funcionando que reemplaza el Excel.", fill: GREEN_LIGHT, color: GREEN_DARK},
            {text: "El sistema es reusable: si aparece otro cliente del rubro, el 80% ya está hecho.", fill: BLUE_ACCENT, color: BLUE_DARK}
          ],
          [
            {text: "El mantenimiento incluye soporte, no queda solo con el sistema.", fill: GREEN_LIGHT, color: GREEN_DARK},
            {text: "Posibilidad de monetizar como SaaS en el futuro si hay más clientes similares.", fill: BLUE_ACCENT, color: BLUE_DARK}
          ],
        ],
        [4680, 4680]
      ),
      ...sp(1),
      pageBreak(),

      // ── SECCIÓN 5: RESUMEN ───────────────────────────────────────────────
      h1("5. Resumen Ejecutivo y Próximos Pasos"),
      ...sp(1),
      customColTable(
        ["Pregunta clave", "Respuesta / Decisión pendiente"],
        [
          ["¿Qué se construye?", "Sistema web que digitaliza exactamente el template Excel del cliente (10 hojas) con mejoras: búsqueda, reportes, cheques, multi-banco."],
          ["¿En cuánto tiempo?", "Fase 1 en 4-6 semanas. Sistema completo (Fases 1-3) en aprox. 3-4 meses."],
          ["¿Dónde se despliega?", "Recomendado: AWS (~$30-40/mes). Alternativa: servidor propio del cliente (requiere evaluación técnica previa)."],
          ["¿Cuánto cuesta?", "Fases 1-3: USD $1.700 a $2.600 en cuotas por entrega. Mantenimiento: $80-150/mes."],
          ["¿Qué pasa con el historial?", "Se importa desde los Excel existentes en Fase 2. El cliente migra sus eventos anteriores usando el mismo template."],
          ["¿Y las otras unidades?", "Fase 4 se cotiza según alcance una vez que el cliente esté conforme con el sistema base."],
        ],
        [3000, 6360]
      ),
      ...sp(1),

      h2("Próximos pasos inmediatos"),
      new Paragraph({
        numbering: { reference: "numbers", level: 0 },
        spacing: { before: 60, after: 60 },
        children: [new TextRun({ text: "El cliente comparte características del servidor propio (o decide usar AWS directamente).", font: "Arial", size: 21, color: GRAY_DARK })]
      }),
      new Paragraph({
        numbering: { reference: "numbers", level: 0 },
        spacing: { before: 60, after: 60 },
        children: [new TextRun({ text: "Se acuerda el monto de la Fase 1 y se firma un acuerdo simple de trabajo.", font: "Arial", size: 21, color: GRAY_DARK })]
      }),
      new Paragraph({
        numbering: { reference: "numbers", level: 0 },
        spacing: { before: 60, after: 60 },
        children: [new TextRun({ text: "Se paga el 50% de anticipo de Fase 1 y arranca el desarrollo.", font: "Arial", size: 21, color: GRAY_DARK })]
      }),
      new Paragraph({
        numbering: { reference: "numbers", level: 0 },
        spacing: { before: 60, after: 60 },
        children: [new TextRun({ text: "En 4-6 semanas el cliente tiene el sistema funcionando con su primer evento de prueba.", font: "Arial", size: 21, color: GRAY_DARK })]
      }),
      new Paragraph({
        numbering: { reference: "numbers", level: 0 },
        spacing: { before: 60, after: 60 },
        children: [new TextRun({ text: "Feedback, ajustes y arranque de Fase 2.", font: "Arial", size: 21, color: GRAY_DARK })]
      }),
      ...sp(2),
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [9360],
        rows: [new TableRow({ children: [new TableCell({
          borders,
          shading: { fill: BLUE_LIGHT, type: ShadingType.CLEAR },
          margins: { top: 200, bottom: 200, left: 300, right: 300 },
          children: [
            new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Este documento es una propuesta sujeta a ajuste según el feedback del cliente.", font: "Arial", size: 19, italics: true, color: BLUE_DARK })] }),
            new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 80 }, children: [new TextRun({ text: "Los montos son estimaciones en USD. Se pueden acordar en ARS con ajuste por inflación.", font: "Arial", size: 19, italics: true, color: GRAY_DARK })] })
          ]
        })]})],
      }),
    ]
  }]
});

Packer.toBuffer(doc).then(buffer => {
  const outPath = path.join(__dirname, "Plan_Desarrollo_Sistema_Eventos.docx");
  fs.writeFileSync(outPath, buffer);
  console.log("OK:", outPath);
});
