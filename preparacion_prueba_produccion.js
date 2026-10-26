// Genera docs/Preparacion_Prueba_Produccion.docx — lo que tiene que estar listo
// para la primera prueba en producción (Render, Enjoy y DOS57) y la guía de
// carga por persona. Mismo estilo que plan_desarrollo.js.
// Uso: node preparacion_prueba_produccion.js
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

// Ítem de checklist: "☐ Título: detalle"
function check(titulo, texto) {
  return new Paragraph({
    spacing: { before: 50, after: 50 },
    indent: { left: 360, hanging: 360 },
    children: [
      new TextRun({ text: "☐  ", font: "Arial", size: 21, color: BLUE_MID }),
      new TextRun({ text: texto ? `${titulo}: ` : titulo, font: "Arial", size: 21, bold: true, color: BLUE_DARK }),
      ...(texto ? [new TextRun({ text: texto, font: "Arial", size: 21, color: GRAY_DARK })] : []),
    ]
  });
}

// Ficha de una persona: datos de acceso + tabla de pasos
function persona(nombre, datos, pasos, notas = []) {
  return [
    h2(nombre),
    customColTable(["Acceso", "Detalle"], datos, [2600, 7480], BLUE_MID),
    ...sp(1),
    customColTable(["#", "Qué carga", "Archivo / origen", "Dónde", "Qué revisar"], pasos, [400, 2100, 2500, 2080, 3000]),
    ...notas,
  ];
}

const CONTENIDO = [

  // ── PORTADA ─────────────────────────────────────────────────────────────
  ...sp(3),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 100 },
    children: [new TextRun({ text: "PRIMERA PRUEBA EN PRODUCCIÓN", font: "Arial", size: 48, bold: true, color: BLUE_DARK })]
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 60 },
    children: [new TextRun({ text: "Enjoy y DOS57 · Lo que tiene que estar listo en Render y guía de carga por persona", font: "Arial", size: 28, color: BLUE_MID })]
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 300 },
    children: [new TextRun({ text: "Foco: Administración y RRHH · Base limpia con usuarios · Cada responsable carga lo suyo", font: "Arial", size: 22, color: "888888", italics: true })]
  }),
  colorBox("Objetivo de la prueba: cerrar un mes completo en el sistema (personal → presentismo y jornadas → sueldos → cierre), con un evento real y la caja conciliada contra los Excel, que siguen en paralelo.", BLUE_LIGHT, BLUE_DARK, false),
  ...sp(1),
  body("Se puede arrancar por Enjoy: son menos personas y el circuito es más directo. DOS57 entra después con el mismo esquema. Nadie carga datos de otro: cada uno sube los archivos que ya usa."),
  ...sp(1),
  customColTable(
    ["Orden", "Quién", "Qué carga"],
    [
      ["Enjoy 1", "Dani", "Catálogo del depósito (y uniformes, si los lleva él)."],
      ["Enjoy 2", "Male", "Proveedores y jornaleros del formulario de Google."],
      ["Enjoy 3", "Chino", "Un evento real, de punta a punta."],
      ["Enjoy 4", "Dani y Male", "Dentro del evento: ficha, seguridad y comidas (Dani); cortesías (Male)."],
      ["Enjoy 5", "May", "Facturas, AFIP, sueldos y cierre de Enjoy."],
      ["DOS57 1", "Lorena", "Padrón de empleados, uniformes, flota, presentismo y siniestros."],
      ["DOS57 2", "Santi y Nico", "Combustible, tarjeta corporativa y libro de compras."],
      ["DOS57 3", "Jazmín", "Catálogo de stock y parte diario."],
      ["DOS57 4", "Andrea", "Proveedores y jornaleros, cajas del mes."],
      ["DOS57 5", "Chino o Matías", "Un evento real. Después, Flor importa sus viajes."],
      ["DOS57 6", "Mayra", "AFIP, sueldos administrativos y cierre."],
    ],
    [1300, 2000, 6780]
  ),
  ...sp(1),
  body("En DOS57, Lorena va primero: su padrón de empleados es la base del presentismo, el parte diario y los sueldos, y su pizarra de flota tiene que estar antes que el combustible (el importador de combustible da de alta solo los vehículos que no encuentra, con la patente como código y sin tipo ni descripción).", { italics: true }),
  pageBreak(),

  // ── 1. RENDER ───────────────────────────────────────────────────────────
  h1("1. Cómo se arma en Render"),
  body("Tres servicios en la misma región (Render no tiene región en Sudamérica; la más cercana es EE.UU. este). Conviene plan pago en el backend y en la base: el plan gratis apaga el servidor cuando nadie lo usa (el primer ingreso tarda cerca de un minuto) y la base gratis no tiene backups."),
  ...sp(1),
  customColTable(
    ["Servicio", "Configuración"],
    [
      ["Base de datos", "PostgreSQL con backups diarios.\nEl backend se conecta con la URL interna."],
      ["Backend (Web Service)", "Carpeta raíz: backend.\nBuild: npm run build:render (compila y aplica migraciones; ya no corre el seed).\nStart: npm start."],
      ["Frontend (Static Site)", "Carpeta raíz: frontend.\nBuild: npm ci && npm run build. Carpeta a publicar: dist.\nRegla de reescritura: /* → /index.html (si no, al refrescar en /presentismo da 404)."],
    ],
    [2600, 7480]
  ),
  ...sp(1),
  h3("Dominios"),
  body("Los dominios de las páginas web que ya tienen sirven: no hace falta comprar otro. Alcanza con crear dos subdominios (por ejemplo app. para el sistema y api. para el backend) con un registro CNAME en el DNS del dominio, apuntando a Render. No es necesario para esta prueba: desde las computadoras, con Chrome o Edge, las direcciones de onrender.com funcionan. Donde sí hace falta es en el iPhone: Safari bloquea la sesión cuando el sistema y el backend están en direcciones distintas de onrender.com."),
  h3("PDFs"),
  body("Los PDF (recibos, sueldos administrativos, remitos, tarjeta corporativa, exportaciones) se generan con Chromium, que el entorno Node de Render no trae. Durante esta prueba esos botones van a dar error; el resto del sistema no depende de eso. Cuando haga falta, se despliega el backend como Docker con Chromium."),

  // ── 2. CHECKLIST ────────────────────────────────────────────────────────
  h1("2. Lo que tiene que estar listo antes de que entre nadie"),

  h2("2.1 Cómo queda el sistema para la prueba"),
  customColTable(
    ["Tema", "Cómo funciona"],
    [
      ["Seed", "No corre en cada deploy: se corre una sola vez a mano. Si se vuelve a correr en producción, solo crea lo que falta: no pisa roles, pantallas de inicio, permisos, escalafones con aumentos ni nombres de pestañas o rubros editados desde el sistema."],
      ["Contraseñas", "En producción el seed genera una contraseña inicial distinta para cada usuario y la muestra una sola vez al terminar. En el primer ingreso el sistema obliga a cambiarla. Lo mismo cuando un admin resetea la contraseña de alguien. Cada usuario puede cambiar la suya cuando quiera (\"Cambiar contraseña\", abajo en el menú)."],
      ["Permisos de carga", "Cada responsable importa lo suyo aunque sea operador. En Configuración → Usuarios se le tilda el permiso puntual (tarjeta corporativa, facturas, padrón de empleados, uniformes) y el módulo le aparece en el menú, sin darle el resto de lo que ve un admin."],
      ["Importadores en pantalla", "El padrón de empleados (planilla de datos personales) y el stock de uniformes del depósito se importan desde el sistema, con vista previa, como el resto. La planilla de viajes de camiones la puede importar Flor directamente."],
    ],
    [2400, 7680]
  ),

  h2("2.2 Variables de entorno"),
  customColTable(
    ["Variable", "Valor", "Por qué"],
    [
      ["NODE_ENV", "production", "También le indica al seed que genere contraseñas y no pise datos."],
      ["DATABASE_URL", "URL interna de la base de Render", ""],
      ["JWT_SECRET", "Nuevo, aleatorio (openssl rand -base64 32)", "Nunca el de desarrollo."],
      ["FRONTEND_URL", "URL del frontend, sin barra final", "CORS rechaza cualquier otro origen."],
      ["ADMIN_EMAIL / ADMIN_PASSWORD", "Admin del sistema, contraseña fuerte", "Lo crea el seed."],
      ["TZ", "America/Argentina/Buenos_Aires", "El servidor de Render está en UTC. Parte diario, el importador de RRHH y el \"hoy\" del dashboard usan la hora local: sin esto se corren 3 horas."],
      ["NODE_VERSION", "20", "La misma versión del setup on-premise."],
      ["VITE_API_URL (frontend)", "URL del backend, sin /api", "El frontend agrega /api solo."],
    ],
    [2600, 3300, 4180]
  ),

  h2("2.3 Instalación (día 0)"),
  body("Es lo único que se hace antes de que entren las personas, y no incluye cargar datos de nadie."),
  check("Base nueva", "no hay nada que borrar. No usar backend/prisma/reset-db.sql: está desactualizado y borra también los usuarios."),
  check("Migraciones", "las aplica el build (prisma migrate deploy)."),
  check("Seed, una sola vez", "desde la consola del backend en Render: npx prisma db seed. Crea empresas, pestañas, rubros, usuarios con sus empresas y pantalla de inicio, cajas de DOS57 en 0, escalafones administrativos (valores de julio 2026), espacios compartidos, cuentas personales de socios y el proveedor Polaco. Copiar la lista de contraseñas iniciales que muestra al final: no se vuelve a mostrar."),
  check("Escalafones", "confirmar con Mayra si los valores de julio 2026 siguen vigentes o hubo aumento."),
  check("Logos y colores", "Matías (admin del sistema) desde Configuración → Empresa."),

  h2("2.4 Usuarios y accesos"),
  check("Datos reales", "el email de Lorena, Florencia, Santi y Nico en el seed es provisorio: confirmarlo antes del seed o corregirlo después en Configuración → Usuarios."),
  check("Entregar las contraseñas", "a cada uno, en persona o por mensaje directo. Al entrar la cambian."),
  check("Pantalla de inicio", "Florencia no tiene una definida: entra al menú general de operador de DOS57, donde está Bitácora."),
  check("Permisos de carga", "asignarlos según la tabla:"),
  ...sp(1),
  customColTable(
    ["Persona", "Rol", "Permisos a tildar", "Para qué"],
    [
      ["Santi y Nico", "OPERADOR", "Tarjeta corporativa · Facturas a pagar", "Importar los resúmenes de la tarjeta y el libro de compras de AFIP."],
      ["Lorena", "OPERADOR", "Padrón de empleados", "Importar la planilla de datos personales desde Presentismo, sin ver sueldos. Uniformes ya lo tiene en su menú."],
      ["Dani", "OPERADOR", "Uniformes (si los lleva él)", "Entregas y stock del depósito de uniformes de Enjoy."],
      ["Flor, Jazmín", "OPERADOR", "Ninguno", "Lo que cargan ya está en su menú."],
      ["Male, Chino, May, Andrea", "ADMIN", "No hacen falta", "El rol ya incluye todo."],
    ],
    [1900, 1300, 2700, 4180]
  ),
  ...sp(1),
  body("La tarjeta corporativa de Enjoy la lleva Santi, que hoy solo tiene acceso a DOS57. Hay que darle acceso a Enjoy (Configuración → Usuarios → acceso a múltiples empresas) o que la importe Male.", { italics: true }),

  h2("2.5 Cuidado de los datos"),
  check("Backups", "los diarios del plan de Render, más un export manual antes de cada deploy que traiga una migración (el build migra solo)."),
  check("Restaurar una vez", "probar que un backup se puede restaurar antes de que haya datos reales."),
  check("Migraciones", "en producción solo prisma migrate deploy. Nunca migrate dev, db push ni una shadow DB contra la base real."),
  check("Cambios", "todo se prueba primero en local; a producción se sube desde main. Durante la prueba, solo arreglos."),

  h2("2.6 Prueba de humo después del deploy"),
  check("Login", "un ADMIN y un OPERADOR con pantalla de inicio, desde PC. Verificar que pida cambiar la contraseña."),
  check("Rutas internas", "refrescar el navegador estando en /presentismo: tiene que volver a cargar, no dar 404."),
  check("Importar", "subir un Excel y ver la vista previa (sin confirmar)."),
  check("Excel", "exportar un listado y verificar el nombre del archivo."),
  check("Notificaciones", "abrir la campanita y el calendario."),
  check("Dólar e IPC", "se actualizan al arrancar el servidor; si no aparecen, un admin los puede forzar."),

  pageBreak(),

  // ── 3. GUÍA POR PERSONA ─────────────────────────────────────────────────
  h1("3. Guía de carga por persona"),
  body("Cada uno carga su información importando el Excel que ya usa, no tipeando. Se hace en una sesión corta (30 a 45 minutos) con la persona y su archivo: sube el archivo, revisa la vista previa y recién ahí confirma. Ningún importador guarda nada hasta confirmar, y volver a importar el mismo archivo no duplica."),

  h1("Enjoy"),

  ...persona("Enjoy 1 — Dani (depósito y stock)",
    [
      ["Usuario", "danielyanello93@gmail.com · OPERADOR · entra a Eventos (menú: Eventos, Stock, Calendario)"],
      ["Depende de", "Nada: es el primero."],
    ],
    [
      ["1", "Catálogo del depósito", "STOCK DE DEPOSITO ENJOY - ENERO 2026.xlsx", "Stock → Importar catálogo", "Categorías, cantidades y ubicación."],
      ["2", "Uniformes (a confirmar si los lleva él)", "Su planilla de stock y de entregas", "Uniformes → Stock del depósito / Entregas", "Requiere el permiso Uniformes."],
    ],
    [body("La ficha del evento, el esquema de seguridad y las comidas los carga dentro del evento real, en el paso 4.")]
  ),

  ...persona("Enjoy 2 — Male (proveedores y jornaleros)",
    [
      ["Usuario", "envios.enjoyproducciones@gmail.com · ADMIN"],
      ["Depende de", "Nada."],
    ],
    [
      ["1", "Proveedores y jornaleros", "Proveedores - Datos (Respuestas).xlsx (formulario de Google)", "Proveedores → Importar desde formulario", "Duplicados por DNI o CUIT (se fusionan) y datos bancarios. Los jornaleros quedan como empleados."],
    ]
  ),

  ...persona("Enjoy 3 — Chino (un evento real)",
    [
      ["Usuario", "christianxinos@gmail.com · ADMIN"],
      ["Depende de", "Proveedores (paso 2) y stock (paso 1), para poder asignarlos."],
    ],
    [
      ["1", "Evento real", "Un evento que se haga durante la prueba", "Eventos → Nuevo evento (asistente Pre-Macro)", "Fechas, días de montaje y desmontaje, lugar, rubros y socios."],
      ["2", "Costos del evento", "A mano o con la ficha", "Evento → rubros", "Proveedores y stock asignados."],
    ]
  ),

  ...persona("Enjoy 4 — Dani y Male (dentro del evento)",
    [
      ["Depende de", "El evento real del paso 3."],
    ],
    [
      ["1", "Ficha de evento (Dani)", "Su ficha del evento (como Fiesta nacional de la pelota _ Ficha de evento.xlsx)", "Evento → Ficha → Importar desde Excel", "Rubros encontrados y cantidades."],
      ["2", "Esquema de seguridad (Dani)", "SEGURIDAD <evento>.xlsx", "Evento → Ficha → rubro Seguridad → Importar esquema desde Excel", "Turnos y horas por agente."],
      ["3", "Comidas (Dani)", "Planilla de control de comidas o viandas", "Evento → Comidas", "Totales por día."],
      ["4", "Cortesías (Male)", "Su planilla de cortesías", "Evento → Cortesías → Importar cortesías desde Excel", "Entradas por solicitante."],
    ]
  ),

  ...persona("Enjoy 5 — May (contable, sueldos y cierre)",
    [
      ["Usuario", "mayra.dos57@gmail.com · ADMIN en Enjoy y DOS57 · vista Macro"],
      ["Depende de", "El evento con sus costos y la caja."],
    ],
    [
      ["1", "Libro de compras AFIP", "Comprobantes de compras de Enjoy", "Facturas → Importar libro de compras", "Proveedores nuevos por CUIT; facturas sin PDF."],
      ["2", "Tarjeta corporativa de Enjoy", "ENJOY 2026.xlsx", "Tarjeta corporativa → Importar", "La importa Santi (con acceso a Enjoy) o Male; ver 2.4."],
      ["3", "Planes AFIP y créditos", "A mano", "AFIP / Créditos", "Cuotas y vencimientos."],
      ["4", "Personal fijo y sueldos", "Su liquidación", "RRHH → Empleados / Sueldos administrativos", "A definir con May qué personal fijo de Enjoy entra en la prueba."],
      ["5", "Cierre del mes", "", "Cierre contable", "Que cierre contra lo que lleva hoy en Excel."],
    ]
  ),

  pageBreak(),
  h1("DOS57"),

  ...persona("DOS57 1 — Lorena (RRHH operativo, flota y seguros)",
    [
      ["Usuario", "lorena.dos57@gmail.com · OPERADOR · entra a Presentismo · permiso Padrón de empleados"],
      ["Depende de", "Nada: es la primera de DOS57."],
    ],
    [
      ["1", "Padrón de empleados", "Datos DOS57_Datos Personales.xlsx (hoja DOS57 FIJOS)", "Presentismo → Importar padrón de empleados", "Cantidad de fijos, CUIL y talles. La vista previa lista a los que están en el sistema y no en la planilla."],
      ["2", "Stock de uniformes del depósito", "2026_STOCK Uniformes.xlsx (toma la última hoja)", "Uniformes → Stock del depósito → Importar stock", "Talles en 0 o con 5 o menos: avisan en la campanita."],
      ["3", "Entregas de uniformes", "DOS57- PERSONAL ENTREGA UNIFORME 2024.xlsx", "Uniformes → Entregas → Importar desde Excel", "Empleados no encontrados; hojas en rojo dan de baja."],
      ["4", "Vehículos, seguros y RTO", "Plantilla de la pizarra (se descarga desde la pantalla)", "Flota → Importar pizarra", "Patentes encontradas o nuevas; vencimiento de RTO/ITV como fecha."],
      ["5", "Carnets de los choferes", "A mano", "Flota → Carnets", "Categoría, número y vencimiento."],
      ["6", "Presentismo del mes", "Registro de faltas del mes en curso", "Presentismo → Importar planilla del mes", "Hojas en amarillo: personas que no están en el padrón. Saldo inicial de francos en la vista Francos."],
      ["7", "Siniestros de personal y de vehículos", "2026_Informe Siniestros Personal.xlsx · 2026_Informe siniestros vehiculos.xlsx", "Siniestros → Importar", "Empleado y vehículo encontrados en cada fila."],
    ],
    [body("Desde ahí en adelante, a mano: asistencia diaria, multas y control de salida de cada vehículo. Las correcciones de legajo que no vienen en la planilla (sueldo, categoría, bajas) las hace un admin desde RRHH.")]
  ),

  ...persona("DOS57 2 — Santi y Nico (combustible, tarjeta y compras)",
    [
      ["Usuarios", "santiago.dos57@gmail.com y nicolas.dos57@gmail.com · OPERADOR · entran a Combustible · permisos Tarjeta corporativa y Facturas a pagar"],
      ["Depende de", "La pizarra de flota de Lorena (paso 1)."],
    ],
    [
      ["1", "Cargas de combustible", "Planilla de Combustible.xlsx", "Combustible → Importar Excel", "Vehículos nuevos: si aparece alguno, es una patente que no está en la pizarra; revisarla con Lorena antes de confirmar."],
      ["2", "Tarjeta corporativa DOS57", "Tarjeta Corporativa DOS57 2026.xlsx", "Tarjeta Corp. → Importar", "Consumos marcados como \"no se descontó\"."],
      ["3", "Libro de compras AFIP", "Comprobantes de Compras - DOS57.xlsx", "Facturas a Pagar → Importar libro de compras AFIP", "Proveedores nuevos por CUIT; facturas sin PDF."],
    ],
    [body("El archivo de novedades y pendientes del parque automotor se revisa en la sesión con Lorena.")]
  ),

  ...persona("DOS57 3 — Jazmín (stock y parte diario)",
    [
      ["Usuario", "jazminvaldivia.dos57@gmail.com · OPERADOR · entra a Parte Diario"],
      ["Depende de", "El padrón de Lorena. Para asignar personal, comidas y remitos a un evento, el evento real del paso 5."],
    ],
    [
      ["1", "Catálogo de stock", "DOS57_STOCK_2026_GENERAL.xlsx · DOS57_STOCK_PAÑOL.xlsx", "Stock → Importar catálogo", "Categorías, cantidades y ubicación."],
      ["2", "Parte diario", "A mano, todos los días", "Parte Diario", "Personal por sector y horarios."],
      ["3", "Comidas y remitos", "A mano", "Dentro del evento (paso 5)", ""],
    ],
    [body("El stock dinámico (alquileres, saldo por evento) no es parte de esta prueba: acá solo se carga el catálogo para que los eventos tengan contra qué asignar.")]
  ),

  ...persona("DOS57 4 — Andrea (administración y cajas)",
    [
      ["Usuario", "administracion@grupodos57.com.ar · ADMIN · entra a Gastos Operativos"],
      ["Depende de", "El padrón de Lorena."],
    ],
    [
      ["1", "Proveedores y jornaleros", "Exportación del formulario de Google", "Proveedores → Importar desde formulario", "Duplicados por DNI o CUIT (se fusionan) y datos bancarios."],
      ["2", "Saldos iniciales de las cajas", "Su planilla de cajas", "Caja", "Las cajas de DOS57 salen del seed en 0: cargar el saldo con el que arranca el mes."],
      ["3", "Caja del mes", "CAJAS del mes en curso (formato CAJAS JULIO-2026.xlsx)", "Gastos Operativos → Caja del mes → Importar", "Que el saldo final coincida con su planilla: es el criterio de éxito."],
    ]
  ),

  ...persona("DOS57 5 — Chino o Matías (un evento real) y después Flor",
    [
      ["Usuarios", "christianxinos@gmail.com o matiaslorenzati@gmail.com · ADMIN; Florencia · OPERADOR"],
      ["Depende de", "Proveedores (paso 4) y stock (paso 3), para poder asignarlos."],
    ],
    [
      ["1", "Evento real", "Un evento que se haga durante la prueba", "Eventos → Nuevo evento (asistente Pre-Macro)", "Fechas, días de montaje y desmontaje, lugar, rubros y socios."],
      ["2", "Costos del evento", "A mano o con la ficha en Excel", "Evento → rubros / ficha", "Proveedores y stock asignados."],
      ["3", "Viajes de camiones (Flor)", "Su planilla de viajes", "Bitácora → Importar planilla", "Que cada evento de la planilla se vincule al evento real (por nombre y fechas). Lo que confirma queda recordado."],
    ],
    [body("Con el evento creado se enganchan el parte diario, las comidas, los remitos, el combustible y los viajes de camiones. Las fechas de montaje y desmontaje son las que usa la vinculación de los viajes.")]
  ),

  ...persona("DOS57 6 — Mayra (contable, sueldos y cierre)",
    [
      ["Usuario", "mayra.dos57@gmail.com · ADMIN en DOS57 y Enjoy · vista Macro"],
      ["Depende de", "Todo lo anterior: presentismo cerrado, cajas, compras y evento."],
    ],
    [
      ["1", "Planes AFIP y créditos", "A mano", "AFIP / Créditos", "Cuotas y vencimientos."],
      ["2", "Escalafones y acuerdos", "Valores vigentes", "RRHH → Sueldos administrativos", "Escalafón (valores de julio 2026 del seed) y acuerdo de cada empleado."],
      ["3", "Sueldos del mes", "Presentismo cerrado por Lorena", "RRHH → Sueldos administrativos", "Premio presentismo y viáticos de choferes."],
      ["4", "Pendientes del seed", "A mano", "Espacios compartidos · Proveedores", "Porcentaje de reparto de la Nave 7 y comisión de Polaco."],
      ["5", "Cierre del mes", "", "Cierre contable", "Que cierre contra lo que lleva hoy en Excel."],
    ]
  ),

  // ── 4. DECISIONES ───────────────────────────────────────────────────────
  h1("4. Decisiones antes de arrancar"),
  customColTable(
    ["Tema", "Propuesta"],
    [
      ["Por dónde empezar", "Enjoy primero (Dani, Male, Chino, May) y DOS57 después."],
      ["Uniformes de Enjoy", "Confirmar quién los lleva (¿Dani?) y darle el permiso Uniformes."],
      ["Tarjeta de Enjoy", "Darle a Santi acceso a Enjoy o que la importe Male."],
      ["Personal fijo de Enjoy", "Definir con May si entra en esta prueba y con qué archivo."],
      ["Emails provisorios", "Confirmar los de Lorena, Florencia, Santi y Nico."],
      ["Escalafones", "Confirmar con Mayra los valores vigentes."],
      ["Dominio y PDFs", "Para más adelante: subdominios del dominio actual (para usar desde el iPhone) y backend en Docker (para los PDF)."],
      ["Duración", "Dos a cuatro semanas en paralelo con los Excel, hasta que un cierre dé igual en los dos."],
      ["Reporte de problemas", "Un solo canal, revisado todos los días. Alcance congelado: solo arreglos."],
    ],
    [2800, 7280]
  ),
  ...sp(2),
  new Table({
    width: { size: 10080, type: WidthType.DXA },
    columnWidths: [10080],
    rows: [new TableRow({ children: [new TableCell({
      borders,
      shading: { fill: BLUE_LIGHT, type: ShadingType.CLEAR },
      margins: { top: 200, bottom: 200, left: 300, right: 300 },
      children: [
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Documento de trabajo: se ajusta con cada sesión de carga.", font: "Arial", size: 19, italics: true, color: BLUE_DARK })] }),
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
          children: [new TextRun({ text: "Primera prueba en producción  |  Enjoy y DOS57", font: "Arial", size: 18, color: "888888" })]
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
    children: CONTENIDO,
  }]
});

Packer.toBuffer(doc).then(buffer => {
  const outPath = path.join(__dirname, "docs", "Preparacion_Prueba_Produccion.docx");
  fs.writeFileSync(outPath, buffer);
  console.log("OK:", outPath);
});
