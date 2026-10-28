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
    children: [new TextRun({ text: "Enjoy y DOS57 · Lo que tiene que estar listo en Render y cómo se hace la prueba, por persona", font: "Arial", size: 28, color: BLUE_MID })]
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 300 },
    children: [new TextRun({ text: "Foco: Administración y RRHH · Base limpia con usuarios · Cada responsable carga lo suyo · Desde el día uno se trabaja en el sistema", font: "Arial", size: 22, color: "888888", italics: true })]
  }),
  colorBox("La prueba tiene dos partes. Parte 1: cada responsable importa sus planillas de eventos ya realizados, como histórico y para controlar que el sistema dé lo mismo que el Excel. Parte 2: un evento real se trabaja desde cero en el sistema, sin armar planillas para importar después.", BLUE_LIGHT, BLUE_DARK, false),
  ...sp(1),
  body("Se arranca por Enjoy: son menos personas y el circuito es más directo. DOS57 entra después con el mismo esquema. Nadie carga datos de otro: cada uno importa sus propios archivos y después trabaja lo suyo en el sistema."),
  ...sp(1),
  customColTable(
    ["Orden", "Quién", "Qué carga"],
    [
      ["Enjoy 1", "Dani", "Stock del depósito."],
      ["Enjoy 2", "Male", "Proveedores y jornaleros del formulario de Google."],
      ["Enjoy 3", "Chino y Dani", "Parte 1: los eventos ya realizados (pedidos, seguridad, producción y comidas)."],
      ["Enjoy 4", "Chino, Dani y Male", "Parte 2: un evento real en el sistema (ficha, producción, comidas, cortesías)."],
      ["Enjoy 5", "Santi y Nico", "Gastos de tarjeta y facturas de Enjoy, para May."],
      ["Enjoy 6", "May", "Revisión, AFIP, sueldos y cierre de Enjoy."],
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
      ["Importadores en pantalla", "Cada planilla se importa desde el sistema con vista previa: padrón de empleados, stock de uniformes, viajes de camiones (Flor), pedidos a proveedores de la ficha, planilla de producción (cronograma, espacios, internet, branding y compras) y control de comidas. Reimportar no duplica ni borra lo cargado a mano."],
      ["Producción del evento", "Nueva pestaña del evento con el cronograma de montaje, los espacios y lo que lleva cada uno, los puntos de internet, el branding y las compras del evento, que antes estaban solo en la planilla de producción."],
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
  check("Emails", "los del seed quedan como están; si alguno cambia, lo corrige un admin en Configuración → Usuarios."),
  check("Entregar las contraseñas", "a cada uno, en persona o por mensaje directo. Al entrar la cambian."),
  check("Pantalla de inicio", "Florencia no tiene una definida: entra al menú general de operador de DOS57, donde está Bitácora."),
  check("Permisos de carga", "ya vienen cargados desde el seed (tabla de abajo). Un admin los puede cambiar en Configuración → Usuarios."),
  ...sp(1),
  customColTable(
    ["Persona", "Rol", "Permisos a tildar", "Para qué"],
    [
      ["Santi y Nico", "OPERADOR en DOS57 y Enjoy", "Tarjeta corporativa · Facturas a pagar", "Tarjeta y libro de compras de DOS57, y la tarjeta y las facturas de Enjoy con las que ayudan a May."],
      ["Lorena", "OPERADOR", "Padrón de empleados · Uniformes", "Importar la planilla de datos personales desde Presentismo, sin ver sueldos, y los uniformes."],
      ["Dani", "OPERADOR", "Uniformes", "Uniformes de Enjoy cuando pasen la planilla. Depósito, ficha, producción y comidas ya están en su rol."],
      ["Flor, Jazmín", "OPERADOR", "Ninguno", "Lo que cargan ya está en su menú."],
      ["Male, Chino, May, Andrea", "ADMIN", "No hacen falta", "El rol ya incluye todo. Male tiene el mismo acceso que Chino."],
      ["Vicky", "OPERADOR, inactiva", "—", "Se crea sin contraseña hasta definir qué necesita."],
    ],
    [1900, 1300, 2700, 4180]
  ),
  ...sp(1),
  body("La tarjeta de Enjoy es de Mayra, pero hoy la arma Santi con los gastos que le mandan Male y Dani, y Nico carga facturas con Male: por eso los dos tienen acceso a Enjoy.", { italics: true }),

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

  // ── 3. PARTE 1: HISTÓRICOS ──────────────────────────────────────────────
  h1("3. Parte 1 — Importar los eventos ya realizados y controlarlos"),
  body("Cada responsable importa sus planillas de eventos que ya se hicieron, para que queden como histórico y para controlar que el sistema dé lo mismo que el Excel. Si los históricos cierran, quiere decir que el sistema guarda y calcula igual que las planillas. Lo que no prueba es el uso diario: eso es la parte 2."),
  ...sp(1),
  colorBox("Antes de que lo hagan ellos, las mismas planillas se importaron en una base local y se compararon contra cada Excel (tabla 3.2). Así llegan a producción sabiendo qué tiene que dar y qué diferencias son de la planilla y no del sistema.", GREEN_LIGHT, GREEN_DARK, false),

  h2("3.1 Quién importa qué"),
  customColTable(
    ["Evento", "Quién", "Archivo", "Dónde"],
    [
      ["Base (antes de los eventos)", "Dani", "STOCK DE DEPOSITO ENJOY - ENERO 2026.xlsx", "Stock → Importar catálogo"],
      ["Base", "Male", "Proveedores - Datos (Respuestas).xlsx", "Proveedores → Importar desde formulario"],
      ["Festival Kilómetro", "Chino crea el evento; Dani importa", "Festival KM - Pedidos de material.xlsx", "Evento → Ficha → Importar pedidos"],
      ["", "Dani", "SEGURIDAD FESTIVAL KM.xlsx", "Ficha → Seguridad privada → Importar esquema"],
      ["Fiesta Nacional de la Pelota", "Chino crea; Dani importa", "Fiesta nacional de la pelota _ Ficha de evento.xlsx", "Evento → Ficha → Importar pedidos"],
      ["", "Dani", "Fiesta Nacional de la Pelota _ Planilla Control de Viandas.xlsx", "Evento → Comidas → Importar planilla"],
      ["Expo Village / L'Etape", "Chino crea; Dani importa", "Planilla Produccion Expo Village.xlsx", "Ficha → Importar pedidos (rubros, estructuras y seguridad) y Producción → Importar planilla (cronograma, espacios, internet, branding y compras)"],
      ["", "Dani", "L'ETAPE - Planilla control de comidas.xlsx", "Evento → Comidas → Importar planilla"],
      ["Todos", "May (con Male)", "Flujo de caja de cada evento", "Pendiente: hay que pedirlos (ver 3.4)"],
    ],
    [2000, 2100, 3300, 2680]
  ),
  ...sp(1),
  body("Los proveedores conviene darlos de alta antes de importar los eventos: así la ficha queda vinculada a cada uno. Si falta alguno se importa igual y su nombre queda en las notas del rubro.", { italics: true }),

  h2("3.2 Lo que tiene que dar igual"),
  body("Resultado de la prueba local con las planillas reales. \"Sistema\" es lo que quedó cargado; \"Planilla\" es el total que trae el Excel, leído aparte."),
  ...sp(1),
  customColTable(
    ["Evento", "Control", "Sistema", "Planilla", "Resultado"],
    [
      ["Festival KM", "Servicios del resumen", "26", "26", "Igual"],
      ["", "Confirmados / pendientes / no van", "18 / 6 / 1", "19 / 6 / 1", "Igual: Seguridad 1 y 2 quedan en un solo rubro"],
      ["", "Ítems de pedido", "197", "197", "Igual"],
      ["", "Horas de seguridad (Squad)", "897", "897", "Igual"],
      ["", "Horas de limpieza", "168", "152", "Ver 3.3: la planilla tiene la limpieza en dos hojas"],
      ["Pelota", "Servicios de la ficha", "18", "18", "Igual (uno se asigna a mano, ver 3.3)"],
      ["", "Ítems de pedido", "127", "127", "Igual"],
      ["", "Comidas semana 1", "$ 1.672.800", "$ 1.506.400", "Error en la planilla (ver 3.3)"],
      ["", "Comidas semana 1 Mati / semana 2 / semana 2 Mati", "$ 81.800 / $ 1.135.200 / $ 5.200", "Iguales", "Igual"],
      ["Expo Village", "Rubros del control (84) y no van", "84 / 35", "84 / 35", "Igual"],
      ["", "Horas de seguridad (evento + ruta)", "865", "795 + 70", "Igual"],
      ["", "Cronograma / espacios / internet / branding", "71 / 21 / 10 / 24", "71 / 21 / 10 / 24", "Igual"],
      ["", "Compras", "$ 655.238,32", "$ 655.238,32", "Igual (sin la cancelada: $ 499.238,32)"],
      ["L'Etape", "Comidas", "$ 1.226.130,26", "$ 1.226.130", "Igual: 26 centavos de redondeo del valor por persona"],
      ["Depósito", "Unidades por espacio (conteo ene-26)", "Iguales en los 8 espacios", "", "Ver 3.3: hay espacios sin conteo de enero"],
    ],
    [1500, 2900, 1900, 1700, 2080]
  ),

  h2("3.3 Lo que encontró la prueba (para revisar con Dani)"),
  bulletB("Comidas de la Pelota, semana 1, fila 19 (14/11)", "la fórmula del total es =E19*G26 y apunta a una celda vacía: da $ 0 en vez de $ 166.400 (32 platos a $ 5.200). Por eso la planilla suma $ 166.400 menos que el sistema. La vista previa del importador lo marca."),
  bulletB("Hojas copiadas de otro evento", "en Festival KM, la hoja CCTV dice \"Evento: QLK FEST\" (con fechas de diciembre) y MOBILIARIO dice \"Fiesta Nacional de la Pelota\". La vista previa lo avisa; hay que confirmar con Dani si esos pedidos son de este evento."),
  bulletB("Viandas de la Pelota", "la semana 2 dice \"Predio Ferial Catamarca\" como lugar, pero sus fechas (16 al 20/11) son las del evento. Parece el lugar copiado de otra planilla."),
  bulletB("Limpieza de Festival KM", "está en dos hojas (LIMPIEZA y ESQUEMA DE LIMPIEZA) y no coinciden: LIMPIEZA tiene además el repaso final del 06/05 (4 personas × 4 horas). El sistema une las dos: 168 horas contra 152 del esquema."),
  bulletB("Depósito", "TANQUE (27 elementos) y DEPO ADMINISTRACIÓN (109) no tienen conteo en enero 2026, y ALTILLO (18) y SALA DE REUNIONES (4) tienen algunos elementos sin conteo: el sistema los toma en 0. Hay que decidir si se completa el conteo o se toma el último que tengan (ver decisiones). En DEPO 1 \"Tramos Truss 2m 30x30\" está dos veces: ahora se suman."),
  bulletB("Servicios sin rubro", "\"Soluciones varias\" (Integral, de la Pelota) y \"Colocación de branding\" (FOFI, de Expo) no tienen un rubro igual en el sistema: en la vista previa se elige a cuál van, o se crea el rubro antes."),
  bulletB("Comidas de L'Etape", "el almuerzo de Fortunato del 16/03 (6 personas) no tiene costo (\"N/S\"): se carga sin valor. La cena de HAKA del 19/03 no tiene cantidad: se carga como 1 con el costo completo. Los días con voucher no se importan."),
  bulletB("Proveedores con nombre de persona", "en Expo varios rubros tienen como proveedor a alguien del equipo (Vicky, Dani, Vecky): quedan como texto en las notas, no como proveedor."),

  h2("3.4 Lo que falta para controlar la plata"),
  body("Del lado económico solo está el flujo de caja genérico (la plantilla con datos de prueba). Sin el flujo de caja de cada evento realizado se controla lo operativo, pero no ingresos, egresos y resultado. Hay que pedírselos a May o a Male; el sistema ya tiene el importador de esa plantilla."),
  bulletB("Cajas chicas de Enjoy", "CAJAS 2026.xlsx (cajas de Dani, Male, Gus, Flor, Vicky y Mili por mes) no tiene importador todavía. Ver decisiones."),

  pageBreak(),

  // ── 4. PARTE 2: DESDE CERO ──────────────────────────────────────────────
  h1("4. Parte 2 — Un evento real desde cero"),
  body("Con la base cargada (proveedores, padrón, stock del depósito, cuentas y saldos iniciales), el evento se trabaja directamente en el sistema: no se arma ninguna planilla para después importarla. Lo que haya que mandarle a un proveedor se exporta desde el sistema, en el mismo formato de siempre."),
  ...sp(1),
  colorBox("Criterio de éxito: el evento se cierra en el sistema y lo que antes se armaba en Excel (pedidos, cronograma, comidas, gastos de tarjeta) sale del sistema.", BLUE_LIGHT, BLUE_DARK, false),
  ...sp(1),
  body("Cada uno arranca con una sesión corta (30 a 45 minutos): entra, cambia su contraseña y hace la primera carga acompañado."),

  h1("Enjoy"),

  ...persona("Dani — depósito, pedidos a proveedores y producción",
    [
      ["Usuario", "danielyanello93@gmail.com · OPERADOR · permiso Uniformes (cuando pasen la planilla)"],
      ["Antes del evento", "Importa el stock del depósito (parte 1)."],
    ],
    [
      ["1", "Pedidos a proveedores", "En el sistema", "Evento → Ficha", "Estado, proveedor, contacto y pedido de cada rubro. \"Exportar Excel\" genera la planilla de pedidos de material con una hoja por rubro confirmado."],
      ["2", "Esquema de seguridad y limpieza", "En el sistema", "Ficha → rubro → Esquema de personal", "Turnos por día; las horas se calculan solas."],
      ["3", "Cronograma, espacios, internet y branding", "En el sistema", "Evento → Producción", "Se edita en la tabla y se guarda al salir del campo."],
      ["4", "Compras del evento", "En el sistema", "Producción → Compras", "Quién pide, quién autoriza y forma de pago."],
      ["5", "Comidas", "Todos los días, en el sistema", "Evento → Comidas", "Almuerzos y cenas por área, con proveedor y costo."],
      ["6", "Stock propio al evento", "En el sistema", "Evento → Stock", "Lo que sale del depósito para este evento."],
    ]
  ),

  ...persona("Male — proveedores, cortesías y facturas",
    [
      ["Usuario", "envios.enjoyproducciones@gmail.com · ADMIN (mismo acceso que Chino)"],
      ["Antes del evento", "Importa proveedores y jornaleros (parte 1)."],
    ],
    [
      ["1", "Proveedores nuevos", "En el sistema", "Proveedores", "Los que pida Dani para el evento, antes de asignarlos en la ficha."],
      ["2", "Cortesías", "En el sistema", "Evento → Cortesías", "Entradas por solicitante."],
      ["3", "Facturas (con Nico)", "En el sistema", "Facturas a pagar", "Factura de cada proveedor, vinculada al evento."],
    ]
  ),

  ...persona("Chino — el evento",
    [
      ["Usuario", "christianxinos@gmail.com · ADMIN"],
    ],
    [
      ["1", "Crear el evento", "En el sistema", "Eventos → Nuevo evento (asistente Pre-Macro)", "Fechas, días de montaje y desmontaje, lugar, rubros y socios."],
      ["2", "Seguimiento", "En el sistema", "Evento → Resumen / Caja", "Ingresos, egresos y caja del evento."],
    ]
  ),

  ...persona("Santi y Nico — tarjeta y facturas de Enjoy (ayudan a May)",
    [
      ["Usuarios", "santiago.dos57@gmail.com y nicolas.dos57@gmail.com · OPERADOR con acceso a DOS57 y Enjoy · permisos Tarjeta corporativa y Facturas"],
    ],
    [
      ["1", "Gastos de tarjeta (Santi)", "En el sistema, a medida que llegan", "Tarjeta Corp. → consumos", "En vez de juntarlos por WhatsApp y armar la planilla: cada gasto se carga a medida que llega (Santi, o Male, que es admin) y Santi lo concilia contra el resumen del banco. Si Dani tiene que cargar los suyos, se le suma el permiso Tarjeta corporativa."],
      ["2", "Facturas (Nico, con Male)", "En el sistema", "Facturas a pagar", "Las de los proveedores del evento."],
    ],
    [body("Esto cambia la forma de trabajar de hoy: hay que acordarlo con Santi y Male antes de arrancar.", { italics: true })]
  ),

  ...persona("May — contable, sueldos y cierre",
    [
      ["Usuario", "mayra.dos57@gmail.com · ADMIN en Enjoy y DOS57 · vista Macro"],
    ],
    [
      ["1", "Revisión de facturas y tarjeta", "En el sistema", "Facturas / Tarjeta Corp.", "Lo que cargaron Nico, Male y Santi."],
      ["2", "Planes AFIP y créditos", "En el sistema", "AFIP / Créditos", "Cuotas y vencimientos."],
      ["3", "Sueldos", "En el sistema", "RRHH → Sueldos", "A definir con May qué personal fijo de Enjoy entra."],
      ["4", "Cierre del evento y del mes", "En el sistema", "Cierre contable", "Que cierre contra lo que lleva hoy en Excel."],
    ]
  ),

  body("Vicky (marketing, comunicación y dirección) queda creada pero inactiva hasta definir qué necesita.", { italics: true }),

  pageBreak(),
  h1("DOS57"),
  body("Mismo esquema: primero la base (parte 1) y después el día a día en el sistema. En DOS57 Lorena va primero, porque su padrón es la base del presentismo, el parte diario y los sueldos, y su pizarra de flota tiene que estar antes que el combustible."),

  ...persona("Lorena — RRHH operativo, flota y seguros",
    [
      ["Usuario", "lorena.dos57@gmail.com · OPERADOR · entra a Presentismo · permisos Padrón de empleados y Uniformes"],
    ],
    [
      ["1", "Padrón de empleados (base)", "Datos DOS57_Datos Personales.xlsx", "Presentismo → Importar padrón de empleados", "Cantidad de fijos, CUIL y talles."],
      ["2", "Stock y entregas de uniformes (base)", "2026_STOCK Uniformes.xlsx · DOS57- PERSONAL ENTREGA UNIFORME 2024.xlsx", "Uniformes", "Talles con poco stock avisan en la campanita."],
      ["3", "Vehículos, seguros y RTO (base)", "Plantilla de la pizarra", "Flota → Importar pizarra", "Patentes y vencimientos."],
      ["4", "Día a día", "En el sistema", "Presentismo · Flota · Siniestros", "Asistencia diaria, multas, carnets y control de salida."],
    ]
  ),

  ...persona("Santi y Nico — combustible, tarjeta y compras de DOS57",
    [
      ["Usuarios", "santiago.dos57@gmail.com y nicolas.dos57@gmail.com · OPERADOR · entran a Combustible"],
    ],
    [
      ["1", "Cargas de combustible", "En el sistema (o la planilla del mes mientras dure el paralelo)", "Combustible", "Vehículos de la pizarra de Lorena."],
      ["2", "Tarjeta corporativa", "En el sistema", "Tarjeta Corp.", "Consumos y conciliación con el resumen."],
      ["3", "Libro de compras AFIP", "Comprobantes de compras (lo emite AFIP)", "Facturas a Pagar → Importar libro de compras", "Este sí se importa: es el archivo que baja de AFIP."],
    ]
  ),

  ...persona("Jazmín — stock y parte diario",
    [
      ["Usuario", "jazminvaldivia.dos57@gmail.com · OPERADOR · entra a Parte Diario"],
    ],
    [
      ["1", "Catálogo de stock (base)", "DOS57_STOCK_2026_GENERAL.xlsx · DOS57_STOCK_PAÑOL.xlsx", "Stock → Importar catálogo", "Categorías, cantidades y ubicación."],
      ["2", "Parte diario, comidas y remitos", "Todos los días, en el sistema", "Parte Diario · Evento", "Personal por sector y horarios."],
    ]
  ),

  ...persona("Andrea — administración y cajas",
    [
      ["Usuario", "administracion@grupodos57.com.ar · ADMIN · entra a Gastos Operativos"],
    ],
    [
      ["1", "Proveedores y jornaleros (base)", "Exportación del formulario de Google", "Proveedores → Importar desde formulario", "Duplicados por DNI o CUIT."],
      ["2", "Saldos iniciales de las cajas (base)", "Su planilla de cajas", "Caja", "Las cajas salen del seed en 0."],
      ["3", "Caja del mes", "En el sistema", "Gastos Operativos", "Que el saldo final coincida con su planilla."],
    ]
  ),

  ...persona("Chino o Matías — el evento; Flor — los viajes",
    [
      ["Usuarios", "christianxinos@gmail.com o matiaslorenzati@gmail.com · ADMIN; Florencia · OPERADOR"],
    ],
    [
      ["1", "Evento real", "En el sistema", "Eventos → Nuevo evento", "Fechas, montaje y desmontaje: las usa la vinculación de los viajes."],
      ["2", "Viajes de camiones (Flor)", "En el sistema (Bitácora)", "Bitácora de viajes", "Cada viaje vinculado al evento."],
    ]
  ),

  ...persona("Mayra — contable, sueldos y cierre de DOS57",
    [
      ["Usuario", "mayra.dos57@gmail.com · ADMIN en DOS57 y Enjoy · vista Macro"],
    ],
    [
      ["1", "Escalafones y acuerdos", "Valores vigentes", "RRHH → Sueldos administrativos", "Escalafón (valores de julio 2026 del seed)."],
      ["2", "Sueldos del mes", "Presentismo cerrado por Lorena", "RRHH → Sueldos administrativos", "Premio presentismo y viáticos de choferes."],
      ["3", "Pendientes del seed", "A mano", "Espacios compartidos · Proveedores", "Reparto de la Nave 7 y comisión de Polaco."],
      ["4", "Cierre del mes", "En el sistema", "Cierre contable", "Que cierre contra lo que lleva hoy en Excel."],
    ]
  ),

  // ── 5. DECISIONES ───────────────────────────────────────────────────────
  h1("5. Decisiones antes de arrancar"),
  customColTable(
    ["Tema", "Propuesta"],
    [
      ["Flujos de caja", "Pedir a May o Male el flujo de caja de Festival KM, la Pelota y Expo Village para controlar la parte económica de los históricos (y los de DOS57 si entran)."],
      ["Depósito sin conteo de enero", "Que Dani complete el conteo de TANQUE y DEPO ADMINISTRACIÓN, o que el importador tome el último conteo que tenga cada elemento (marcándolo)."],
      ["Hojas dudosas de Festival KM", "Confirmar con Dani si CCTV y MOBILIARIO son de ese evento."],
      ["Cajas chicas de Enjoy", "CAJAS 2026.xlsx no tiene importador: decidir si las cajas chicas entran en la prueba."],
      ["Tarjeta de Enjoy", "Pasar a cargar los gastos en el sistema en vez de juntarlos por WhatsApp (acordarlo con Santi y Male)."],
      ["Uniformes de Enjoy", "Cuando pasen la planilla, se importa en Uniformes (Dani ya tiene el permiso)."],
      ["Personal fijo de Enjoy", "Definir con May si entra en esta prueba y con qué archivo."],
      ["Escalafones", "Confirmar con Mayra los valores vigentes."],
      ["Dominio y PDFs", "Para más adelante: subdominios del dominio actual (para usar desde el iPhone) y backend en Docker (para los PDF)."],
      ["Duración", "Parte 1: una semana. Parte 2: el evento real completo, en paralelo con los Excel."],
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
          children: [new TextRun({ text: "Primera prueba en producción  |  Enjoy y DOS57  |  Históricos y evento desde cero", font: "Arial", size: 18, color: "888888" })]
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
