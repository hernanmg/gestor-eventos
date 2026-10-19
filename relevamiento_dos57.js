// Genera docs/dos57/Relevamiento_DOS57_Florencia_Lorena.docx — lo relevado con
// Florencia y Lorena (DOS57) y cómo lo cubre el sistema. Mismo estilo que
// plan_desarrollo.js.  Uso: node relevamiento_dos57.js
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, BorderStyle, WidthType, ShadingType,
  LevelFormat, PageNumber, Header, Footer, PageBreak,
} = require('docx');
const fs = require('fs');
const path = require('path');

// Colors
const BLUE_DARK = "1F4E79";
const BLUE_MID = "2E75B6";
const BLUE_LIGHT = "D6E4F0";
const BLUE_ACCENT = "E8F4FD";
const GREEN_DARK = "1E5631";
const GREEN_LIGHT = "E8F5E9";
const ORANGE_DARK = "BF360C";
const ORANGE_LIGHT = "FFF3E0";
const GRAY_DARK = "424242";
const GRAY_LIGHT = "F5F5F5";
const WHITE = "FFFFFF";
const YELLOW_LIGHT = "FFFDE7";
const RED_LIGHT = "FFEBEE";

const bd = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const borders = { top: bd, bottom: bd, left: bd, right: bd };

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    keepNext: true,
    spacing: { before: 400, after: 160 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: BLUE_MID, space: 4 } },
    children: [new TextRun({ text, font: "Arial", size: 34, bold: true, color: BLUE_DARK })]
  });
}

function h2(text, color = BLUE_MID) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    keepNext: true,
    spacing: { before: 300, after: 120 },
    children: [new TextRun({ text, font: "Arial", size: 26, bold: true, color })]
  });
}

function h3(text, color = BLUE_DARK) {
  return new Paragraph({
    keepNext: true,
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

// Bullet con un comienzo en negrita: "Título: resto del texto"
function bulletB(titulo, texto) {
  return new Paragraph({
    numbering: { reference: "bullets", level: 0 },
    spacing: { before: 40, after: 40 },
    children: [
      new TextRun({ text: `${titulo}: `, font: "Arial", size: 21, bold: true, color: BLUE_DARK }),
      new TextRun({ text: texto, font: "Arial", size: 21, color: GRAY_DARK }),
    ]
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

function colorBox(text, fill = BLUE_LIGHT, textColor = BLUE_DARK, bold = true) {
  return new Table({
    width: { size: 10080, type: WidthType.DXA },
    columnWidths: [10080],
    rows: [new TableRow({
      children: [new TableCell({
        borders,
        width: { size: 10080, type: WidthType.DXA },
        shading: { fill, type: ShadingType.CLEAR },
        margins: { top: 140, bottom: 140, left: 200, right: 200 },
        children: [new Paragraph({
          children: [new TextRun({ text, font: "Arial", size: 21, bold, color: textColor })]
        })]
      })]
    })]
  });
}

function customColTable(headers, rows, colWidths, headerFill = BLUE_DARK) {
  const headerRow = new TableRow({
    tableHeader: true,
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
      cantSplit: true,
      children: row.map((cell, ci) => {
        const isObj = typeof cell === 'object' && cell !== null;
        const cellText = isObj ? cell.text : cell;
        const cellFill = isObj ? (cell.fill || (ri % 2 === 0 ? GRAY_LIGHT : WHITE)) : (ri % 2 === 0 ? GRAY_LIGHT : WHITE);
        const cellBold = isObj ? (cell.bold || false) : ci === 0;
        const cellColor = isObj ? (cell.color || GRAY_DARK) : (ci === 0 ? BLUE_DARK : GRAY_DARK);
        return new TableCell({
          borders,
          width: { size: colWidths[ci], type: WidthType.DXA },
          shading: { fill: cellFill, type: ShadingType.CLEAR },
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: String(cellText).split('\n').map(linea =>
            new Paragraph({ children: [new TextRun({ text: linea, font: "Arial", size: 19, bold: cellBold, color: cellColor })] }))
        });
      })
    })
  );

  return new Table({
    width: { size: colWidths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths: colWidths,
    rows: [headerRow, ...dataRows]
  });
}

// Tabla de dos columnas "Necesidad / Cómo lo cubre el sistema"
const cobertura = (rows) => customColTable(["Lo que hace hoy", "Cómo lo cubre el sistema"], rows, [3600, 6480]);

// ─── DOCUMENTO ───────────────────────────────────────────────────────────────

const children = [

  // ── PORTADA ─────────────────────────────────────────────────────────────
  ...sp(3),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 100 },
    children: [new TextRun({ text: "RELEVAMIENTO OPERATIVO DOS57", font: "Arial", size: 52, bold: true, color: BLUE_DARK })]
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 60 },
    children: [new TextRun({ text: "Florencia y Lorena — lo relevado y cómo lo cubre el sistema", font: "Arial", size: 30, color: BLUE_MID })]
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 300 },
    children: [new TextRun({ text: "Logística y costo de eventos · Presentismo y francos · Flota, seguros, multas y siniestros", font: "Arial", size: 22, color: "888888", italics: true })]
  }),
  new Table({
    width: { size: 10080, type: WidthType.DXA },
    columnWidths: [10080],
    rows: [new TableRow({ children: [new TableCell({
      borders,
      shading: { fill: BLUE_LIGHT, type: ShadingType.CLEAR },
      margins: { top: 240, bottom: 240, left: 360, right: 360 },
      children: [
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Basado en las entrevistas de relevamiento y en las planillas reales de cada área", font: "Arial", size: 20, italics: true, color: BLUE_DARK })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 80 }, children: [new TextRun({ text: "Matriz de costos · Bitácora de camiones · Remitos · Registro de faltas · Pizarra de flota · Siniestros · Uniformes", font: "Arial", size: 19, color: GRAY_DARK })] }),
      ]
    })]})],
  }),
  ...sp(2),
  customColTable(
    ["Área", "Persona", "Foco del relevamiento"],
    [
      ["Operación y logística de eventos", "Florencia", "Costo real de cada evento: personal, combustible, material, pérdidas, cajas de choferes, camiones."],
      ["RRHH operativo, flota y seguros", "Lorena", "Presentismo diario, francos, multas, siniestros, papeles y vencimientos de vehículos, uniformes."],
    ],
    [3000, 1600, 5480]
  ),
  pageBreak(),

  // ── 1. FLORENCIA ────────────────────────────────────────────────────────
  h1("1. Florencia — Operación y logística de eventos"),
  body("Flor arma por cada evento una matriz de costo real. La empieza antes del evento con lo que se espera y la cierra cuando termina, con los datos reales. Esa matriz es la que usa Matías para comparar lo que se cobró con lo que realmente costó. No la alimenta un solo sistema: Flor junta información de todos lados y la completa a mano."),
  ...sp(1),

  h2("1.1 La matriz de costo real del evento"),
  customColTable(
    ["Componente", "Qué registra"],
    [
      ["Personal", "Fijos, jornaleros, extranjeros (los que trae Mayra), producción y choferes, con turnos y días de montaje, viaje y desarme."],
      ["Comidas, alojamiento y seguridad", "Cuántos menús y quién los paga (a veces DOS57, a veces no); alojamiento; seguridad contratada."],
      ["Combustible por vehículo", "Litros y monto por camión, camioneta y Sprinter. Sale de la planilla de Santi, porque el combustible se paga de caja y no por transferencia."],
      ["Cajas de los choferes", "\"Caja Luis, caja Tati…\": el número final de lo que gastó cada camionero en el evento, no el detalle."],
      ["Material (remitos)", "Layher (con códigos), Nacional (sin códigos), techos, lonas y aforo. Cada material tiene un valor y se le aplica un % que depende del evento (por ejemplo, el 4%)."],
      ["Pérdidas de pañol", "Lo que salió y no volvió (por ejemplo, un martillo) se valoriza y se suma como pérdida del evento."],
      ["Varios y consumibles", "Descartables, café, pintura, tornillos, botiquín."],
    ],
    [2800, 7280]
  ),
  ...sp(1),

  h2("1.2 Lo que lleva además de la matriz"),
  bulletB("Logística diaria por camión", "km al salir y al llegar, km consumidos, cargas, litros cargados y litros consumidos. Incluye los camiones chicos que no van al evento grande, porque necesita saber cuántas veces fue la plancha a cada lugar."),
  bulletB("Pañol", "el pañolero no usa compu. Flor le armó un remito de pañol impreso por rubros (equipamiento personal, herramientas, máquinas, pintura, energía, medición, hidratación) para que solo complete cantidades, con el evento y quién lo lleva. A la vuelta tacha lo que volvió."),
  bulletB("Carpeta por evento", "seguros del personal, remitos por camión, planos (propios y de servicios), logística, contenido audiovisual, bitácora diaria (qué se armó cada día, sacado de los grupos de WhatsApp) y cronograma por día (armado → evento → desarme)."),
  bulletB("Control en campo", "planillas impresas de horas, comidas, seguridad, retiros del mini pañol con firma, alojamiento y proveedores. Pidió poder trabajar offline: carga en la camioneta y después pasa todo."),
  ...sp(1),

  h2("1.3 Cómo lo cubre el sistema"),
  cobertura([
    ["Logística diaria por camión", "Bitácora de viajes: importa sus planillas de camiones a la misma tabla que la bitácora de choferes, marcada como origen FLOTA para no pagarle el viático dos veces a Luis."],
    ["Resumen del día", "Movimiento diario: camiones y camionetas separados, y desde ahí se salta a la bitácora."],
    ["Viajes y combustible por evento", "Tab Logística del evento: junta los viajes y las cargas de combustible vinculados. El importador sugiere a qué evento real corresponde cada convocatoria."],
    ["Remitos", "Remitos digitales de los 5 tipos (Layher, Nacional, Techos, Pañol, Lonas/Aforo), con catálogo, PDF y los datos fiscales de su planilla. Viven en el tab Logística."],
    ["Valorización de material", "Presupuestador rental: su base de matrices con % por ítem, nacional e importado, el tipo de cambio de la planilla y versiones."],
    ["Pañol, comidas y personal", "Pañol, comidas, parte diario y jornadas cubren la salida y vuelta de material y el personal por evento y por día."],
    ["Cronograma del evento", "Días de montaje y desmontaje en el evento, para el cronograma armado → evento → desarme."],
  ]),
  ...sp(1),

  h3("Lo que aprendimos de sus planillas"),
  bulletB("C1…C7 no son camiones", "son el número de carga del evento (un mismo camión aparece como C1, C3 y C4)."),
  bulletB("KM/L", "se calcula como km ÷ litros consumidos, igual que ella."),
  bulletB("Litros consumidos", "la fuente es la hoja de cada camión, no la de logística diaria."),
  bulletB("Tanque inicial", "va en el primer viaje de la gira."),
  bulletB("Filas sin fecha", "no se importan (son viajes de días posteriores sin completar)."),
  pageBreak(),

  // ── 2. LORENA ───────────────────────────────────────────────────────────
  h1("2. Lorena — RRHH operativo, flota y seguros"),
  body("Lore maneja el presentismo diario del personal y toda la papelería de los vehículos. Muchas planillas tienen la misma información vista desde distintos ángulos y terminan alimentando una sola: la planilla madre de sueldos de Mayra."),
  ...sp(1),

  h2("2.1 Presentismo: su planilla principal"),
  body("Lleva una planilla por mes, con una hoja por persona. Los fijos van con apodo (ANDRE, LORE, FURIA, CHARA…) y los jornaleros en prueba aparte (BENJA, LISANDRO, PATRICIO, BICHITO). Cada fila es un día:"),
  bulletB("Convocatoria", "la hora de citación de ese día, que no es fija (8:00, 9:00, medianoche si hay viaje en Sprinter), o una palabra: LIBRE, FRANCO, LICENCIA MATERNIDAD, FALTÓ."),
  bulletB("Horario", "la hora real de llegada."),
  bulletB("Una sola marca", "SI · DEMORA · LLEGADA TARDE · NO CONVOCADO · FALTÓ · MÉDICA · VACACIONES · FRANCO POR DOMINGO."),
  bulletB("Observación", "\"Permiso\", \"Viaje Sprinter\", \"Dio aviso que le entraron a robar\"."),
  body("Con eso arma un informe mensual por empleado y un semáforo, que va a Mati cada 15 días o por mes:"),
  customColTable(
    ["Semáforo", "Demoras", "Llegadas tarde", "Faltas"],
    [
      [{ text: "Excelente", bold: true, fill: GREEN_LIGHT, color: GREEN_DARK }, "0 a 2", "0 a 1", "0"],
      [{ text: "Seguimiento", bold: true, fill: YELLOW_LIGHT, color: "8D6E00" }, "3 a 4", "2 a 3", "1"],
      [{ text: "Atención", bold: true, fill: RED_LIGHT, color: ORANGE_DARK }, "5 o más", "4 o más", "2 o más"],
    ],
    [2520, 2520, 2520, 2520]
  ),
  body("Vale el peor de los tres.", { italics: true }),
  ...sp(1),
  h3("Cómo lo cubre el sistema"),
  bulletB("Registro diario", "un registro por persona y por día, con su propia hora de citación (si queda vacía se usa la habitual del empleado)."),
  bulletB("Clasificación automática", "al cargar la hora de llegada el estado se pone solo contra la citación del día; Lore lo puede cambiar a mano."),
  customColTable(
    ["Llegada respecto de la citación", "Estado"],
    [
      ["Hasta 6 minutos", "Presente"],
      ["De 7 a 15 minutos", "Demora (va al semáforo, no pide aprobación)"],
      ["16 minutos o más", "Llegada tarde (queda pendiente de que Matías la apruebe o la rechace)"],
    ],
    [4200, 5880]
  ),
  body("Los cortes salen de sus propias marcas: 9:03 lo marcó presente, 8:07 demora y 9:19 llegada tarde.", { italics: true }),
  ...sp(1),
  customColTable(
    ["Marca de su planilla", "Estado en el sistema"],
    [
      ["SI", "Presente"],
      ["DEMORA", "Demora"],
      ["LLEGADA TARDE", "Llegada tarde"],
      ["NO CONVOCADO", "Libre / no convocado"],
      ["FALTÓ", "Faltó (ausente)"],
      ["MÉDICA", "Justificado / médica"],
      ["VACACIONES", "Vacaciones"],
      ["LICENCIA (en convocatoria)", "Licencia"],
      ["FRANCO POR DOMINGO", "Franco"],
    ],
    [4200, 5880]
  ),
  ...sp(1),
  bulletB("Resumen del mes", "grilla día por día y, por persona, presentes, demoras, llegadas tarde, faltas, saldo de francos y el semáforo con sus mismos umbrales. Se exporta a Excel con las columnas de su informe."),
  bulletB("Importador de su planilla", "lee el Excel con una hoja por persona y muestra una vista previa antes de importar. Manda su marca de cada día; si un día no tiene marca, se usa lo que dice CONVOCATORIA (LIBRE, FRANCO, LICENCIA…) y, si tampoco, se clasifica la hora de llegada contra la citación. Reimportar el mismo archivo no duplica."),
  bulletB("Hacia sueldos", "al cerrar el mes, lo que corresponde al premio presentismo pasa a la liquidación de Sueldos Admin."),
  ...sp(1),

  h2("2.2 Francos"),
  body("Se dan francos compensatorios por domingos trabajados. Ella pasa el resumen a Mati para que sepa qué días le corresponden a cada uno."),
  cobertura([
    ["Llevar cuántos francos tiene cada uno", "Cada empleado tiene un saldo de francos: suma uno por cada domingo trabajado y resta uno cada día marcado como franco. La vista Francos muestra domingos trabajados, francos tomados y cuántos le corresponden."],
    ["Lo que venía de antes", "Saldo inicial por persona, editable, para arrancar con lo que traía su planilla."],
  ]),
  ...sp(1),

  h2("2.3 Multas"),
  body("De tránsito e internas (por ejemplo, vehículos sucios). Las lleva por patente con fecha, lugar, motivo, vencimiento, monto, fecha de pago, medio de pago y si se le descontó al empleado. Impactan en la liquidación."),
  cobertura([
    ["Planilla de multas por patente", "Cada multa se carga una vez, ligada al vehículo (o patente libre) y al empleado (o nombre libre), con todos esos datos."],
    ["Descontarla al empleado", "Al tildar \"descontar\", se carga como vale tipo MULTA y entra solo en la próxima liquidación de sueldos. Una vez descontada no se puede cambiar el monto ni borrarla (sí anularla)."],
    ["Vencimiento del pago", "Aparece en el calendario y en los avisos con el semáforo."],
    ["Informe para Mati", "Dos resúmenes: por empleado (cantidad, total, a descontar) y por vehículo (cantidad, total, sin pagar)."],
  ]),
  ...sp(1),

  h2("2.4 Siniestros de vehículos y de personas"),
  bulletB("Vehículos", "fecha, n° de siniestro, empleado, vehículo, seguro, lugar, detalle, daños, fecha de denuncia, datos del tercero, estado y observación."),
  bulletB("Personas", "fecha, n° de siniestro, empleado, póliza (Berkley, Federación, Sancor), condición laboral, tipo de incidente, diagnóstico, zona afectada, lugar, zona de riesgo, centro de atención y alta médica."),
  body("Cómo lo cubre el sistema: los dos con esos mismos campos, importables desde sus planillas. Los siniestros abiertos o en proceso aparecen en el calendario y en las notificaciones."),
  ...sp(1),

  h2("2.5 Flota: vencimientos y papeles"),
  body("La pizarra tiene, por vehículo: dominio, vehículo, titular, ITV/RTO, seguro, vencimiento del seguro y combustible, agrupados en camionetas, trailers, camiones y autoelevadores. Hoy marca con una crucecita lo que está por vencer. Tiene además una carpeta por vehículo (pólizas, tarjeta verde) y lleva los carnets de los choferes."),
  cobertura([
    ["Seguros", "Seguro por vehículo con aseguradora, póliza, cobertura, vigencia y monto, más la póliza adjunta en PDF."],
    ["RTO / ITV", "Tipo y fecha de vencimiento de la revisión técnica por vehículo; trailers y autoelevadores figuran como \"no lleva\". Se actualiza desde Flota o desde la pizarra (columna ITU / RTO, ej. \"RTO 27/09/2026\")."],
    ["Pizarra", "Se mantiene como planilla descargable y reimportable. La planilla que se descarga sale con los datos actuales del sistema, así reimportarla no pisa lo actualizado. Celdas con dato actualizan, celdas vacías no borran."],
    ["Carnets de conducir", "Categoría, número y vencimiento por empleado, cargados por ella desde Flota → Carnets (y también en el legajo de RRHH)."],
    ["La crucecita de la pizarra", "Semáforo en todo lo que vence: verde vigente, amarillo dentro de los próximos 30 días, rojo vencido. Todo va al calendario."],
    ["Que el aviso le llegue a quien corresponde", "Los avisos de RTO, carnets, multas y controles de salida pendientes llegan a la campanita solo de quien tiene la documentación de flota a cargo y de administración; el resto los ve en Flota y en el calendario."],
  ]),
  ...sp(1),

  h2("2.6 Revisión antes de cada viaje"),
  body("Cuando sale un camión, Lore revisa con David la papelería: tarjeta verde, seguro y RTO. Lo anota con colores (verde revisado, amarillo pendiente). Los vehículos sin seguro quedan de baja y no salen."),
  cobertura([
    ["Saber qué sale cada día", "El control de salida propone los vehículos que salen ese día según la bitácora de viajes y el parte diario, con chofer y destino precargados."],
    ["Revisar la papelería", "Muestra lo que dice el sistema: en rojo lo que impide salir (vehículo de baja, sin seguro vigente, RTO o carnet vencidos) y en amarillo lo que hay que mirar (vence pronto, dato sin cargar). Ella y David tildan lo que vieron en la carpeta: tarjeta verde, seguro, RTO/ITV y carnet."],
    ["Verde / amarillo / rojo", "Revisado (verde) solo con los 4 papeles y sin alertas rojas; si algo está vencido queda Observado (rojo) con la explicación. Al cerrarlo se guarda la foto de cómo estaba la documentación en ese momento."],
  ]),
  ...sp(1),

  h2("2.7 Uniformes"),
  body("El stock de depósito por talle es un inventario (Depósito Principal y Secundario) con mínimo y alerta de quiebre. Los talles por persona salen de Datos Personales. El historial de entregas lo administra ella."),
  ...sp(1),

  h2("2.8 Su escritorio"),
  body("Entra directo a Presentismo, que es su día a día (vistas Día, Mes y Francos). Desde el menú llega a siniestros, uniformes y Flota y Seguros (vehículos, seguros, control de salida, carnets y multas). El calendario le muestra sus vencimientos."),
  ...sp(1),

  h2("2.9 Lo que ajustamos al bajarlo a sus planillas reales"),
  customColTable(
    ["Tema", "Lo que se pensaba", "Lo que es en realidad"],
    [
      ["Uniformes", "Talles por empleado", "Stock de depósito por talle, sin nombres. Se cargó como inventario; los talles por persona salen de Datos Personales."],
      ["Historial de entregas", "Formato del spec", "PLANTA ESTABLE trae el nombre en la primera fila y tiene columna buzo; ENJOY, MORAS y BRUJAS son filas de grupo; los duplicados no suman al total."],
      ["Siniestros de vehículos", "10 filas", "9 filas; \"Reposición de cerradura\" no es un estado y va a observaciones; si tractor y acoplado comparten patente, se toma el tractor."],
      ["Pizarra de flota", "Una foto", "Una planilla Excel descargable y reimportable; el match por patente ya no confunde acoplado con tractor."],
      ["RTO / ITV", "Una nota de texto", "Una fecha con tipo, que alimenta calendario, avisos y control de salida."],
      ["Presentismo", "Un solo estado \"tarde\" y hora fija", "Demora y llegada tarde separadas, citación distinta cada día y semáforo mensual."],
      ["Planilla de presentismo", "Nombres iguales a RRHH", "Nombres en cualquier orden (\"FLORENCIA GOMEZ\") y apodos como nombre de hoja; una hoja con el mes mal escrito (JAZ dice AGOSTO con fechas de septiembre) — mandan las fechas."],
      ["Permisos", "Lore usa las pantallas de RRHH", "Lore es OPERADOR: sus pantallas usan listados de empleados propios de cada módulo."],
    ],
    [2200, 2600, 5280]
  ),
  pageBreak(),

  // ── 3. CÓMO SE CONECTA ──────────────────────────────────────────────────
  h1("3. Cómo se conecta todo"),
  body("La idea que surgió en el relevamiento: que cada una siga con su día a día en su pantalla, y que el sistema haga el cruce que hoy hacen a mano entre planillas."),
  customColTable(
    ["Lo que se carga", "Dónde impacta"],
    [
      ["Presentismo del mes (Lore)", "Premio presentismo en la liquidación de Sueldos Admin (Mayra)."],
      ["Multa con descuento (Lore)", "Vale tipo MULTA en la próxima liquidación del empleado."],
      ["Domingos trabajados / francos (Lore)", "Saldo de francos de cada persona, para que Mati sepa qué días darles."],
      ["Bitácora de viajes (Flor / choferes)", "Logística del evento, movimiento diario y control de salida del día."],
      ["Parte diario (Jazmín)", "Jornadas de RRHH y control de salida del día."],
      ["Remitos (Flor)", "Logística del evento y valorización de material."],
      ["Seguros, RTO, carnets, multas", "Calendario y avisos con semáforo; control de salida antes de cada viaje."],
      ["Siniestros", "Calendario y notificaciones mientras estén abiertos o en proceso."],
    ],
    [3600, 6480]
  ),
  ...sp(1),

  // ── 4. PUNTOS A VALIDAR ─────────────────────────────────────────────────
  h1("4. Puntos a validar con el equipo"),
  bulletB("Cortes de demora / llegada tarde", "6 y 15 minutos, tomados de las marcas de la planilla de Lore."),
  bulletB("Francos", "uno por cada domingo trabajado, sin importar las horas."),
  bulletB("Personas sin alta", "de las 26 hojas de la planilla de presentismo, 15 son de personas que todavía no están como empleados (entre otras David Aguirre, Florencia Gómez, Santiago Bibiloni, Luis Ledesma, Benjamín Gasco); sus días se importan cuando se den de alta en RRHH."),
  bulletB("Días sin marca", "si un día tiene hora de llegada pero no la marca de Lore, se clasifica solo por la hora (por ejemplo, 9:21 con citación 9:00 queda como llegada tarde)."),
  bulletB("Umbral del premio presentismo", "hoy lo pierde quien tiene alguna falta o una llegada tarde rechazada; confirmar con Lore y Mayra."),
  bulletB("Combustible en la matriz de Flor", "diferencias de litros consumidos entre la hoja de logística y la hoja de cada camión en algunos viajes."),
  ...sp(2),
  new Table({
    width: { size: 10080, type: WidthType.DXA },
    columnWidths: [10080],
    rows: [new TableRow({ children: [new TableCell({
      borders,
      shading: { fill: BLUE_LIGHT, type: ShadingType.CLEAR },
      margins: { top: 200, bottom: 200, left: 300, right: 300 },
      children: [
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Documento de trabajo sujeto a ajuste según el feedback de Florencia y Lorena.", font: "Arial", size: 19, italics: true, color: BLUE_DARK })] }),
      ]
    })]})],
  }),
];

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
          children: [new TextRun({ text: "Relevamiento DOS57  |  Florencia y Lorena", font: "Arial", size: 18, color: "888888" })]
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
    children,
  }]
});

Packer.toBuffer(doc).then(buffer => {
  const outPath = path.join(__dirname, "docs", "dos57", "Relevamiento_DOS57_Florencia_Lorena.docx");
  fs.writeFileSync(outPath, buffer);
  console.log("OK:", outPath);
});
