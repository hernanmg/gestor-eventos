import { GUIA_INTRO, GUIA_PASOS } from './guiaCargaEnjoy';

export interface HelpLink {
  label:   string;
  ruta?:   string;   // navegar con useNavigate
  accion?: string;   // disparar window.dispatchEvent('help:<accion>')
}

// Link embebido dentro del texto de una sección — HelpPanel lo renderiza como
// un <Link> de React Router inline, en vez de un botón aparte en "Links
// rápidos". Ej: "Podés crear la factura desde " + {texto:"Facturas a
// Cobrar", ruta:"/facturas-emitidas"} + "."
export interface HelpInlineLink {
  texto: string;
  ruta:  string;
}

export interface HelpSection {
  titulo:    string;
  // String simple (como siempre) o un array mezclando texto plano con
  // HelpInlineLink para insertar links navegables en medio del párrafo.
  contenido: string | (string | HelpInlineLink)[];
  // "Ver también: [link] · [link]" al pie de esta sección.
  veTambien?: HelpInlineLink[];
}

export interface HelpContent {
  titulo:      string;
  descripcion?: string;
  secciones:   HelpSection[];
  links?:      HelpLink[];
}

const help: Record<string, HelpContent> = {

  // ── Macro ───────────────────────────────────────────────────────────────────
  '/macro': {
    titulo: 'Macro',
    descripcion: 'Visibilidad global del negocio — KPIs consolidados y movimientos cross-evento.',
    secciones: [
      {
        titulo: 'KPIs y Alertas',
        contenido: 'Resumen financiero de todos los eventos activos: ingresos, egresos, saldo neto y alertas de echeqs próximos a vencer o rechazados. Las alertas de nivel ERROR (en rojo) requieren atención inmediata; las de tipo WARNING (en amarillo) son avisos informativos.',
      },
      {
        titulo: 'Movimientos',
        contenido: 'Tabla de movimientos de todos los eventos con filtros cross-evento (empresa, evento, rubro, estado, fechas). Permite editar estado y aviso a proveedor en línea, y exportar a Excel.',
      },
    ],
    links: [
      { label: 'Ver eventos', ruta: '/eventos' },
    ],
  },

  // ── Eventos (lista) ─────────────────────────────────────────────────────────
  '/eventos': {
    titulo: 'Eventos',
    descripcion: 'Cada evento representa un proyecto financiero completo — un recital, festival o show — con su propio flujo de caja, egresos, ingresos, echeqs y conciliatoria.',
    secciones: [
      {
        titulo: '¿Por dónde empezar?',
        contenido: 'Antes de crear un evento te recomendamos cargar primero tus proveedores habituales (Sonido, Iluminación, Transporte, etc.) desde el menú Proveedores. Así podés vincularlos a los movimientos directamente al cargarlos.',
      },
      {
        titulo: 'Crear un evento',
        contenido: 'Click en "Nuevo evento" → completá nombre y fechas → configurá los socios con sus porcentajes (deben sumar exactamente 100%) → Guardar. Los movimientos del evento se organizan en los rubros de egresos e ingresos configurados para tu empresa (ver Configuración > Rubros).',
      },
      {
        titulo: 'Estados del evento',
        contenido: '• ACTIVO: evento en preparación o en curso. Podés editar todo.\n• CERRADO: evento finalizado. Solo lectura, ideal para historial.\n• IMPORTADO: cargado desde un Excel existente. Funciona igual que ACTIVO.',
      },
      {
        titulo: 'Flujo de trabajo recomendado',
        contenido: '1. Creá el evento con sus socios\n2. Cargá los egresos por rubro (Producción General, Impuestos, etc.)\n3. Cargá los ingresos (Tickets, Sponsors, etc.)\n4. Configurá las cuentas de Caja\n5. Registrá los echeqs desde el rubro de Gastos Extraordinarios\n6. Mirá el Resumen o la Conciliatoria para ver el resultado final\n7. Exportá a Excel para compartir',
      },
      {
        titulo: 'Importar desde Excel',
        contenido: 'Si ya tenés eventos cargados en el Excel original, podés importarlos directamente desde el menú "Importar Excel". El sistema mapea automáticamente las 10 hojas del formato histórico a los rubros configurados y crea todos los movimientos.',
      },
      {
        titulo: 'Carga rápida de evento',
        contenido: 'Para eventos pequeños o informales que no necesitan ficha técnica completa. Cargá el trabajo con los datos mínimos y decidí si se factura o no. Los eventos sin decisión de facturación aparecen como alertas en las notificaciones para que administración pueda actuar a tiempo.',
      },
    ],
    links: [
      { label: 'Nuevo evento',            accion: 'abrir_modal_nuevo_evento' },
      { label: 'Ir a Proveedores',         ruta:   '/proveedores' },
      { label: 'Importar Excel',           ruta:   '/importer' },
      { label: 'Ver evento de ejemplo',    accion: 'abrir_evento_ejemplo' },
    ],
  },

  // ── Evento > Egresos ────────────────────────────────────────────────────────
  '/eventos/:id/egresos': {
    titulo: 'Egresos',
    descripcion: 'Registrá todos los gastos del evento organizados en rubros configurables.',
    secciones: [
      {
        titulo: '¿Cómo cargar un egreso?',
        contenido: 'Elegí la pestaña del rubro correspondiente → click en + al final de la tabla → completar fecha, concepto, descripción → el monto va en la columna DEBE → al salir de la celda se guarda automáticamente. El saldo se recalcula solo — no es editable.',
      },
      {
        titulo: 'Rubros de egresos',
        contenido: 'Cada pestaña de Egresos es un rubro configurable desde Configuración > Rubros (ej: Producción General, Sonido, Impuestos, Gastos Extraordinarios). El rubro de Impuestos requiere elegir una subcategoría fija (PAYWAY, IIBB, IVA, etc.) en cada fila. Los echeqs solo se pueden crear desde el rubro de Gastos Extraordinarios.',
      },
      {
        titulo: 'Estado y presupuesto',
        contenido: 'Cada movimiento tiene un estado (Pendiente → Cotizando → Confirmado → Pagado, o Cancelado) y un presupuesto opcional. La columna Diferencia compara el presupuesto contra el monto real cargado — en rojo si el real superó lo presupuestado.',
      },
      {
        titulo: 'Vincular proveedor',
        contenido: 'En la columna Proveedor podés buscar y vincular el proveedor de cada gasto. Escribí 2 letras para ver las sugerencias.',
      },
      {
        titulo: 'Impactar en Caja',
        contenido: 'Al cargar un egreso podés marcar si impacta en caja y en qué cuenta bancaria — se crea automáticamente el movimiento de caja.',
      },
      {
        titulo: 'Líneas que vienen de la Ficha',
        contenido: 'Cuando un rubro se confirma en la Ficha (a mano, con el importador o desde la Pre-Macro) aparece solo como línea en Egresos, con la etiqueta "Ficha", el proveedor y el presupuesto de la Ficha y el monto real en 0. Cargá el monto real cuando lo tengas. Si cambiás el proveedor o el presupuesto en la Ficha, la línea se actualiza. Si el rubro pasa a "No va" o "Cancelado", la línea se cancela, salvo que ya tenga un monto o pagos cargados.\nSi el rubro ya tenía egresos cargados a mano no se agrega otra línea.',
      },
      {
        titulo: 'IVA',
        contenido: 'Hacé clic en la celda IVA para cargar el neto y el IVA (botones 10,5% / 21% / 27%). El Debe queda como total = neto + IVA. Los totales, saldos y la conciliatoria siguen tomando el total, así que el IVA es un desglose. Al agregar una fila podés elegir la alícuota: el monto que escribís se toma como neto y se le suma el IVA.',
      },
      {
        titulo: 'Falta pagar y señas',
        contenido: 'La columna Falta pagar muestra el total menos lo que ya se le pagó al proveedor. Mientras no hay monto real se calcula sobre el presupuesto (en cursiva). Hacé clic para registrar una seña o un pago parcial con fecha y nota. Cuando los pagos cubren el total, la línea pasa a Pagado.\nRegistrar un pago acá no mueve la Caja: el movimiento de dinero se sigue cargando en Caja o en Facturas a Pagar.',
      },
    ],
    links: [
      { label: 'Ver Resumen',              ruta:   '/eventos/:id/resumen' },
      { label: 'Ver Conciliatoria',        ruta:   '/eventos/:id/conciliatoria' },
      { label: 'Ver Caja',                 ruta:   '/eventos/:id/caja' },
    ],
  },

  // ── Evento > Ingresos ───────────────────────────────────────────────────────
  '/eventos/:id/ingresos': {
    titulo: 'Ingresos',
    descripcion: 'Registrá todas las fuentes de ingreso del evento en rubros configurables.',
    secciones: [
      {
        titulo: '¿Cómo cargar un ingreso?',
        contenido: 'Mismo proceso que egresos — elegí la pestaña del rubro, click en +, completar fecha y concepto, monto en columna HABER.',
      },
      {
        titulo: 'Rubros de ingresos',
        contenido: 'Cada pestaña de Ingresos es un rubro configurable desde Configuración > Rubros (ej: Tickets, Sponsors, Corporativo, Gastronomía, Service Charge). Podés renombrarlos, reordenarlos o agregar rubros nuevos según necesites.',
      },
    ],
    links: [
      { label: 'Ver Resumen',       ruta: '/eventos/:id/resumen' },
      { label: 'Ver Conciliatoria', ruta: '/eventos/:id/conciliatoria' },
    ],
  },

  // ── Evento > Resumen ────────────────────────────────────────────────────────
  '/eventos/:id/resumen': {
    titulo: 'Resumen',
    descripcion: 'Vista rápida de presupuesto vs. costo real por rubro.',
    secciones: [
      {
        titulo: '¿Qué muestra?',
        contenido: 'Por cada rubro con movimientos cargados: el presupuesto total, el monto real (debe/haber según corresponda), la diferencia en pesos y en porcentaje, y un estado general calculado a partir del estado de sus movimientos.',
      },
      {
        titulo: 'Estado general del rubro',
        contenido: 'Si todos los movimientos del rubro están Pagados → Pagado. Si hay alguno Pendiente → Pendiente. Si no hay movimientos activos (todos Cancelados) → Cancelado.',
      },
    ],
    links: [
      { label: 'Ver Conciliatoria', ruta: '/eventos/:id/conciliatoria' },
    ],
  },

  // ── Evento > Ficha ──────────────────────────────────────────────────────────
  '/eventos/:id/ficha': {
    titulo: 'Ficha de Evento',
    descripcion: 'La Ficha de Evento centraliza todos los proveedores y pedidos del evento. Inicializá la ficha para ver los 84 rubros y asignales proveedor, estado y detalle del pedido. Al exportar generás el documento que antes se hacía a mano.',
    secciones: [
      {
        titulo: '¿Ficha o Stock?',
        contenido: 'La Ficha gestiona los PROVEEDORES EXTERNOS de cada rubro — empresas a las que Enjoy contrata servicios (sonido, luces, seguridad, etc.). El stock propio de Enjoy (equipos del depósito) se gestiona desde la tab Stock del evento, no desde la Ficha. Si un rubro lo cubre material propio del depósito, asignalo desde Stock. Si lo cubre un proveedor externo, cargalo en la Ficha.',
      },
      {
        titulo: '¿Cómo empiezo?',
        contenido: 'Hacé clic en "Inicializar ficha" — se crean automáticamente todos los rubros de egresos configurados para tu empresa, en estado Pendiente. A partir de ahí asignales proveedor, estado, contacto y quién coordina cada uno.',
      },
      {
        titulo: 'Proveedor sugerido',
        contenido: [
          'Debajo del proveedor de cada rubro vacío aparecen sugerencias: con ★ el proveedor habitual del rubro y con + los que más se usaron en ese rubro en otros eventos (al pasar el mouse se ve en cuántos y el último). Al tocar uno se asigna con su contacto y, si el presupuesto está vacío, con el costo estimado del rubro o lo último que costó. El habitual y el costo estimado se cargan en ',
          { texto: 'Configuración → Rubros', ruta: '/configuracion' },
          '.',
        ],
      },
      {
        titulo: 'Pedido técnico',
        contenido: 'Cada rubro puede tener uno o más ítems de pedido (cantidad, material, días de uso, horarios de llegada y retiro). Hacé clic en "Pedido" para expandir y cargar el detalle — se guarda automáticamente al salir de cada campo.',
      },
      {
        titulo: 'Ficha y Egresos (centro de costos)',
        contenido: 'Cada rubro confirmado genera su línea de costo en Egresos, con proveedor y presupuesto. La columna "En egresos" muestra el monto real cargado y cuánto falta pagar. Arriba de la tabla están los totales del evento.\nPara eventos armados antes de esta función usá "Sincronizar con Egresos": crea las líneas de los rubros confirmados que todavía no tienen ninguna. Después de eso los cambios se sincronizan solos.',
      },
      {
        titulo: 'Exportar',
        contenido: 'El botón "Exportar Excel" genera un archivo con una hoja resumen de todos los proveedores y una hoja adicional por cada rubro Confirmado con su pedido técnico completo.',
      },
      {
        titulo: 'Importar la planilla de pedidos',
        contenido: '"Importar pedidos" lee la planilla de pedidos de material (hoja PROVEEDORES CONFIRMADOS + una hoja "PEDIDO DE MATERIAL" por rubro) o la ficha de evento con sus "FICHA DE PROVEEDOR". De cada servicio toma el estado, el proveedor, el contacto, quién coordina, las fechas de entrega y retiro y el pedido completo; las columnas propias de cada rubro (Piso, Uso, Medida, M2...) y las secciones como "ESCENARIO PRINCIPAL" quedan en las observaciones de cada ítem. Las grillas de limpieza o seguridad se cargan como turnos.\nEn la vista previa revisá el rubro de cada servicio: si no es el correcto elegí otro, o "No importar". Si dos servicios van al mismo rubro (Seguridad 1 y Seguridad 2) se suman en uno y el segundo proveedor queda en las notas. Un proveedor que no está dado de alta se importa igual con su nombre en las notas; si lo das de alta antes, queda vinculado.\nReimportar no duplica: actualiza lo que ya estaba y no borra ítems ni notas cargados a mano. Si una hoja dice otro evento (una hoja copiada de otro evento), la vista previa lo avisa.',
      },
    ],
    links: [
      { label: 'Ver Resumen', ruta: '/eventos/:id/resumen' },
    ],
  },

  // ── Evento > Caja ───────────────────────────────────────────────────────────
  '/eventos/:id/caja': {
    titulo: 'Caja',
    descripcion: 'Controlá el dinero real en cada cuenta bancaria o efectivo.',
    secciones: [
      {
        titulo: '¿Cómo funciona la Caja?',
        contenido: 'Registrá los movimientos reales de dinero en cada cuenta bancaria o efectivo. La caja es independiente de los egresos e ingresos — podés vincularlos o cargarlos por separado.',
      },
      {
        titulo: 'Agregar una cuenta',
        contenido: 'Click en "Agregar cuenta" → nombre (ej: Banco Galicia), tipo (Banco o Efectivo), moneda y saldo inicial.',
      },
      {
        titulo: 'Registrar movimientos',
        contenido: 'En la tabla de cada cuenta, click en + → completar fecha, descripción y monto en Debe (entrada) o Haber (salida).',
      },
      {
        titulo: 'Transferencias entre cuentas',
        contenido: 'Usá "Nueva transferencia" para mover fondos entre cuentas del mismo evento — se registra en ambas automáticamente.',
      },
      {
        titulo: 'Echeqs pendientes',
        contenido: 'Abajo de cada cuenta ves los echeqs pendientes de pago. Al registrar el pago, el dinero sale de la cuenta seleccionada.',
      },
    ],
    links: [
      { label: 'Nueva transferencia', accion: 'abrir_modal_transferencia' },
      { label: 'Ver echeqs',          ruta:   '/eventos/:id/echeqs' },
    ],
  },

  // ── Evento > Conciliatoria ──────────────────────────────────────────────────
  '/eventos/:id/conciliatoria': {
    titulo: 'Conciliatoria',
    descripcion: 'Resumen financiero final automático del evento.',
    secciones: [
      {
        titulo: '¿Qué muestra?',
        contenido: 'El resumen financiero final del evento. Total ingresos − Total egresos = Saldo final. La distribución entre socios se calcula automáticamente según los porcentajes configurados.',
      },
      {
        titulo: '¿Es editable?',
        contenido: 'No — es una vista de solo lectura calculada en tiempo real. Cualquier cambio en egresos o ingresos se refleja acá inmediatamente.',
      },
      {
        titulo: 'Multi-moneda',
        contenido: 'Si el evento tiene movimientos en ARS y USD, la conciliatoria muestra un resumen separado por moneda sin convertir.',
      },
      {
        titulo: 'Exportar',
        contenido: 'Podés exportar la conciliatoria a Excel o PDF desde los botones del header.',
      },
    ],
    links: [
      { label: 'Exportar a Excel', accion: 'exportar_excel' },
      { label: 'Exportar PDF',     accion: 'exportar_pdf' },
    ],
  },

  // ── Evento > Detalle (genérico para tabs no mapeadas) ──────────────────────
  '/eventos/:id': {
    titulo: 'Detalle de evento',
    descripcion: 'Gestión completa del evento: egresos, ingresos, caja, echeqs, conciliatoria y facturas.',
    secciones: [
      {
        titulo: 'Pestañas disponibles',
        contenido: 'Resumen, Ficha, Producción, Egresos (por rubro), Ingresos, Caja, Stock, Comidas, Facturas a Pagar, Facturas a Cobrar, Auditoría. Los eventos en modalidad centro de costos muestran la pestaña Centro de costos en lugar de Egresos, Ingresos, Caja, Conciliatoria y Echeqs. Los de DOS57 en modalidad operativa muestran Operación y Costo real, y no muestran Ingresos, Conciliatoria ni Echeqs. Para eventos informales: Resumen, Caja, Stock, Comidas.',
      },
      {
        titulo: 'Centro de costos o flujo de caja completo',
        contenido: 'En Enjoy cada evento se lleva de una de dos formas. El flujo de caja completo (egresos, ingresos, caja, echeqs y conciliatoria) es para los eventos grandes, como TC, Lecap o Monster. El resto se lleva con el centro de costos, como la planilla de centro de costos: sólo lo que se gasta, sin caja ni ingresos.\nLos eventos nuevos arrancan en centro de costos; se elige en la Pre-Macro o al crear el evento, y se cambia desde Editar evento. Por debajo son los mismos movimientos, así que cambiar de modalidad no pierde nada.',
      },
      {
        titulo: 'Centro de costos: Costos, RRHH y Extras',
        contenido: 'Costos tiene una línea por cada rubro confirmado en la Ficha (aparecen solas), más las que agregues a mano: descripción, responsable, consumido, IVA, total, falta pagar, fecha de pago y si se le avisó al proveedor. Hacé clic en el IVA para cargar neto + IVA, y en Falta pagar para registrar señas o pagos parciales. RRHH muestra las líneas de personal del evento.\nExtras es lo que surge fuera de lo presupuestado. Por defecto lo paga el cliente y no suma al costo del evento; si lo paga la empresa, editalo y elegí "La empresa": pasa a sumar como Gastos Extra. Cada extra puede llevar los datos de cuenta, el estado de la factura y el comprobante adjunto.\n"Exportar Excel" baja la planilla con las hojas Costos, RRHH y Extras; "Exportar extras" baja sólo la hoja Extras, para mandársela al cliente.',
      },
      {
        titulo: 'Importar la planilla de centro de costos',
        contenido: '"Importar planilla" sube la planilla de centro de costos del evento (formato KM) con vista previa. Se leen las hojas Costos, RRHH y Extras; las de Acciones no se importan.\nCada línea de Costos va al rubro que se reconoce por la descripción (Sonido, Luces, Carpas…). Las que no se reconocen hay que asignarlas: una por una o todas a un mismo rubro, o marcarlas para no importar. Si la Ficha ya había generado la línea de ese rubro, se completa esa misma línea.\n"PAGADO" en cualquier columna deja la línea pagada; si falta pagar menos que el total, la diferencia entra como seña. Los montos con texto ("Arregla Matías") entran en 0 con una nota, y el responsable que no está dado de alta como proveedor queda en la descripción. Reimportar el mismo archivo actualiza las mismas líneas, no las duplica.',
      },
      {
        titulo: 'Operación (DOS57)',
        contenido: 'En los eventos de DOS57 en modalidad operativa, la pestaña Operación arma el evento desde los rubros elegidos. Arriba están las fases (viaje, montaje, evento, desmontaje y regreso), que salen de las fechas del evento y de los días de montaje y desmontaje: si faltan, cargalos en Editar evento.\nCada rubro muestra su material (lo asignado desde el stock propio y el proveedor, que se carga en la Ficha) y sus tareas. "Cargar tareas tipo" agrega la lista de base del rubro, cada tarea en el primer día de su fase, sin repetir las que ya están; "Tareas tipo" permite ajustar esa lista para todos los eventos. Hacé clic en el círculo de una tarea para pasarla de pendiente a en curso y a hecha.\nLa cuadrilla sale del Parte diario: cada persona asignada al evento con sus días por fase, agrupada por categoría. Lo marcado "plan." son días asignados en un parte que todavía no se cerró. "Exportar cuadrilla" baja la hoja con el formato de STAFF COSTS. Al final están los remitos del evento con lo que salió.',
      },
      {
        titulo: 'Costo real (DOS57)',
        contenido: [
          'Los eventos de DOS57 se llevan en modalidad operativa: la pestaña Costo real es la matriz que arma Flor por evento, con los mismos bloques que la hoja CC (staff, alojamiento, comidas, combustible personal y material, pañol, gastos varios, rental nacional e importado, y pérdidas). Esos eventos no muestran Ingresos, Conciliatoria ni Echeqs; Caja, Facturas y A cobrar siguen igual.\nCada bloque se completa de tres formas: "Importar matriz" lee la planilla de siempre (hojas CC, OPEX, RENTAL COSTS y L&A COSTS) y avisa si el total no coincide con la hoja CC; "Traer del sistema" arma el bloque con lo que ya está cargado (jornadas del Parte diario, comidas, cargas de combustible y bitácora del evento, remitos por la matriz de rental, faltantes del pañol); y "Agregar línea" para lo demás. Volver a importar o a traer reemplaza sólo esas líneas: lo cargado a mano no se toca. "Exportar matriz" baja el Excel con el mismo formato, para Matías y Pollo. El tablero de todos los eventos está en ',
          { texto: 'Costo real', ruta: '/costo-real' },
          '.',
        ],
      },
      {
        titulo: 'Producción',
        contenido: 'La pestaña Producción reúne lo que antes estaba en la planilla de producción: el cronograma de montaje, evento y desarme (por día y hora, con proveedor y responsable), los espacios del evento con lo que lleva cada uno y su estado, los puntos de internet, el branding (tipo, marca, cantidad y ubicación) y las compras del evento (quién pide, quién autoriza y cómo se paga).\nCada fila se edita en el lugar y se guarda al salir del campo; la última fila de cada tabla sirve para agregar. "Importar planilla de producción" lee esas hojas del Excel (se reconocen por sus columnas); reimportar actualiza lo que ya estaba y no borra lo cargado a mano.\nLas compras no generan movimientos: lo que se paga con tarjeta o en cuenta corriente entra por la tarjeta corporativa o las facturas. El total no cuenta las canceladas.',
      },
      {
        titulo: 'Comidas',
        contenido: 'Cada día del evento tiene sus almuerzos y cenas por área, con la cantidad, el valor por persona y el detalle (quiénes comieron). "Importar planilla" lee la planilla de control de viandas (valor por unidad y tipo de menú: el área es Plato o Vianda) o la de control de comidas (costo por línea y proveedor: el área es el proveedor y el valor por persona sale del costo).\nLa vista previa muestra, por hoja, el total que da el sistema contra el total de la planilla, y lista las filas que no cierran (por ejemplo una fórmula que apunta a una celda vacía). Si una hoja cae fuera de las fechas del evento queda destildada: revisala antes de importarla. Reimportar no duplica y no borra lo cargado a mano.',
      },
      {
        titulo: 'Egresos e ingresos',
        contenido: 'Cada fila representa un movimiento. Podés agregar, editar o eliminar filas. El saldo se recalcula automáticamente.',
      },
      {
        titulo: 'Conciliatoria',
        contenido: 'Resume el total de ingresos menos egresos y calcula el saldo final con la distribución entre socios configurada.',
      },
      {
        titulo: '¿Se factura este evento?',
        contenido: [
          'Cada evento tiene una decisión de facturación que debe tomarse a tiempo. Si marcás "Sí se factura", podés crear la factura directamente desde ',
          { texto: 'Facturas a Cobrar', ruta: '/facturas-emitidas' },
          ' vinculada a este evento.',
        ],
        veTambien: [
          { texto: 'Facturas a Cobrar', ruta: '/facturas-emitidas' },
          { texto: 'Caja Global',       ruta: '/caja' },
          { texto: 'Calendario',        ruta: '/calendario' },
        ],
      },
    ],
  },

  // ── Vincular proveedores ────────────────────────────────────────────────────
  '/eventos/:id/vincular-proveedores': {
    titulo: 'Vincular proveedores',
    descripcion: 'Asigná proveedores a los movimientos importados en forma masiva.',
    secciones: [
      {
        titulo: '¿Qué hace esta pantalla?',
        contenido: 'Después de importar un Excel, los movimientos no tienen proveedor asignado. Acá podés vincular cada concepto a un proveedor existente o crear uno nuevo.',
      },
      {
        titulo: 'Cómo funciona',
        contenido: 'Cada tarjeta agrupa movimientos con el mismo concepto. Seleccioná un proveedor del buscador o marcá "Crear proveedor" para generarlo automáticamente.',
      },
    ],
  },

  // ── Facturas (lista global) ─────────────────────────────────────────────────
  '/facturas': {
    titulo: 'Cuentas a Pagar',
    descripcion: 'Registrá y gestioná las facturas recibidas de proveedores.',
    secciones: [
      {
        titulo: '¿Para qué sirve?',
        contenido: 'Registrá las facturas recibidas de proveedores antes de pagarlas. El egreso se crea automáticamente cuando registrás el pago.',
      },
      {
        titulo: 'Flujo de una factura',
        contenido: '1. Recibís la factura → la cargás con el PDF adjunto\n2. La aprobás cuando está lista para pagar\n3. Registrás el pago (transferencia, echeq, efectivo)\n4. El sistema crea el egreso automáticamente en la tab configurada\n5. Si pagás con echeq → el echeq se crea y vincula automáticamente',
      },
      {
        titulo: 'Pagos parciales',
        contenido: 'Una factura puede pagarse en cuotas — el sistema lleva el control de cuánto queda pendiente.',
      },
      {
        titulo: 'PDF adjunto',
        contenido: 'Al cargar la factura podés adjuntar el PDF original. Quedará guardado en el sistema para consulta y auditoría.',
      },
      {
        titulo: 'Importar el libro de compras de AFIP',
        contenido: '"Importar libro de compras" carga las facturas del Excel de "Mis Comprobantes Recibidos". Si el proveedor no existe se crea con su CUIT, y las de más de $ 500.000 sin PDF quedan marcadas. Reimportar no duplica.',
      },
      {
        titulo: 'Orden de compra y orden de pago',
        contenido: [
          'Si la compra tuvo ',
          { texto: 'orden de compra', ruta: '/ordenes-compra' },
          ', vinculá la factura para cotejar lo pedido con lo facturado antes de pagar. Para pagar varias facturas de un proveedor juntas, con su echeq y las firmas de quién la revisó y autorizó, armá una ',
          { texto: 'orden de pago', ruta: '/ordenes-pago' },
          ': al registrarla, el pago queda en cada factura.',
        ],
      },
    ],
    links: [
      { label: 'Nueva factura',         accion: 'abrir_modal_nueva_factura' },
      { label: 'Ver facturas vencidas',  accion: 'filtrar_vencidas' },
    ],
  },

  // ── Factura detalle ─────────────────────────────────────────────────────────
  '/facturas/:id': {
    titulo: 'Detalle de factura',
    descripcion: 'Historial de pagos y gestión completa de una factura.',
    secciones: [
      {
        titulo: 'Pagos',
        contenido: 'Podés registrar múltiples pagos parciales. Cada pago puede ser por transferencia, efectivo, cheque o echeq.',
      },
      {
        titulo: 'Pagos con Echeq',
        contenido: 'Si el medio de pago es ECHEQ, el sistema crea automáticamente un echeq vinculado. No podés anular un pago si el echeq ya fue cobrado.',
      },
      {
        titulo: 'PDF',
        contenido: 'El PDF se almacena en la base de datos. Podés verlo en una nueva pestaña o descargarlo con su nombre original.',
      },
      {
        titulo: 'Orden de compra',
        contenido: [
          'Si está vinculada a una ',
          { texto: 'orden de compra', ruta: '/ordenes-compra' },
          ', se ve el total pedido contra lo facturado (sumando todas las facturas de la orden) y si coincide. Si no está vinculada y el proveedor tiene órdenes abiertas, se puede vincular desde acá.',
        ],
      },
      {
        titulo: 'Orden de pago',
        contenido: [
          'Si la factura está en una ',
          { texto: 'orden de pago', ruta: '/ordenes-pago' },
          ', se ve cuál, en qué estado y por cuánto. Los pagos que genera la orden aparecen en la lista de pagos con su número de orden.',
        ],
      },
    ],
  },

  // ── Facturas a Cobrar (facturas emitidas a clientes) ───────────────────────
  '/facturas-emitidas': {
    titulo: 'Facturas a Cobrar',
    descripcion: 'Registrá todas las facturas que emitís a tus clientes y seguí el estado de cobro de cada una.',
    secciones: [
      {
        titulo: '¿Para qué sirve?',
        contenido: 'Registrá todas las facturas que emitís a tus clientes y seguí el estado de cobro de cada una. Podés registrar cobros parciales — el sistema actualiza el estado automáticamente (Emitida → Cobrada parcial → Cobrada). Si una factura corresponde a un evento, vinculala para tener todo centralizado. Si el cliente paga con echeqs o cheques, cargalos en el cobro: quedan en Cheques → Recibidos con su fecha de pago y el aviso para depositarlos o ponerlos en custodia.',
      },
      {
        titulo: 'Vencimientos',
        contenido: 'Las facturas vencidas sin cobrar aparecen en el Calendario y en las notificaciones.',
      },
      {
        titulo: 'Importar de AFIP',
        contenido: '"Importar de AFIP" carga las facturas desde el Excel de "Mis Comprobantes Emitidos", o desde la planilla de ventas con una hoja por mes. Si la planilla trae la fecha de ingreso del pago, la factura queda cobrada; lo que ingresó al banco se anota en el cobro (la diferencia suele ser retenciones). Las que figuran en la hoja de conciliación como pendientes quedan sin cobrar, o con cobro parcial si las observaciones dicen "pago parcial $…". Si dice "NC" y no tiene cobro, queda anulada. Las notas de crédito del export de AFIP no se cargan solas: se listan para que las apliques en la factura que corresponde. El archivo tiene que ser del CUIT de la empresa activa, y volver a subirlo no duplica nada: sólo completa lo que falte.',
      },
    ],
  },

  // ── Proveedores ─────────────────────────────────────────────────────────────
  '/proveedores': {
    titulo: 'Proveedores',
    descripcion: 'Registro centralizado de todos tus proveedores y clientes.',
    secciones: [
      {
        titulo: '¿Para qué sirve?',
        contenido: 'Mantené un registro de todos tus proveedores y clientes. Al vincularlos a los movimientos podés ver el historial completo de operaciones por proveedor.',
      },
      {
        titulo: '¿Cuándo conviene cargarlos?',
        contenido: 'Antes de empezar a cargar movimientos — así podés vincularlos directamente al cargar cada gasto.',
      },
      {
        titulo: 'Historial por proveedor',
        contenido: 'Click en un proveedor para ver todos sus movimientos, echeqs y facturas en todos los eventos.',
      },
      {
        titulo: 'Importar Excel',
        contenido: 'Al importar un Excel, si los conceptos coinciden con nombres de proveedores, el sistema te sugiere vincularlos en forma masiva.',
      },
      {
        titulo: 'Pedidos y pagos al proveedor',
        contenido: [
          'Los presupuestos de varios proveedores se comparan en ',
          { texto: 'Comparativos de compra', ruta: '/comparativos' },
          '. Lo que se le pide va en ',
          { texto: 'Órdenes de compra', ruta: '/ordenes-compra' },
          ' (con PDF para mandarle), sus facturas en ',
          { texto: 'Facturas a Pagar', ruta: '/facturas' },
          ' y los pagos agrupados en ',
          { texto: 'Órdenes de pago', ruta: '/ordenes-pago' },
          '. Cargá el CBU y el alias en el proveedor: la orden de pago los muestra. En la ficha de cada proveedor está todo junto: cuánto se le debe, sus facturas, pagos y órdenes.',
        ],
      },
    ],
    links: [
      { label: 'Nuevo proveedor', accion: 'abrir_modal_nuevo_proveedor' },
    ],
  },

  // ── Cuentas corrientes ───────────────────────────────────────────────────────
  '/cuentas-corrientes': {
    titulo: 'Cuentas Corrientes',
    descripcion: 'Registrá cuentas corrientes con clientes, proveedores o socios.',
    secciones: [
      {
        titulo: '¿Para qué sirve?',
        contenido: 'Registrá cuentas corrientes con clientes, proveedores o socios. Cada cuenta tiene movimientos Debe/Haber con saldo acumulado. Soporta ARS, USD y EUR con tasa de cambio por movimiento.',
      },
    ],
  },

  // ── Flota ────────────────────────────────────────────────────────────────────
  '/flota': {
    titulo: 'Flota',
    descripcion: 'Gestioná la flota de vehículos con seguros, revisión técnica, patentes, peajes, taller, carnets, multas y el control de salida.',
    secciones: [
      {
        titulo: '¿Para qué sirve?',
        contenido: [
          'Gestioná la flota de vehículos con seguros, patentes, peajes y servicios de taller. Las alertas de vencimiento aparecen en el ',
          { texto: 'Calendario', ruta: '/calendario' },
          '.',
        ],
        veTambien: [{ texto: 'Calendario', ruta: '/calendario' }],
      },
      {
        titulo: 'Semáforo de vencimientos',
        contenido: 'Seguros, RTO/ITV, carnets y multas usan el mismo semáforo: verde = vigente, amarillo = vence dentro de los próximos 30 días, rojo = vencido. Los vencimientos de RTO, carnets, multas y los controles de salida sin revisar llegan a la campanita sólo de quien tiene la documentación de flota a cargo (y de administración); el resto los ve en Flota y en el Calendario.',
      },
      {
        titulo: 'RTO / ITV',
        contenido: 'En la pestaña Vehículos, la columna "RTO / ITV" muestra el tipo y el vencimiento de la revisión técnica. Hacé click en la celda para actualizarla. Trailers y autoelevadores figuran como "No lleva". La pizarra (Importar pizarra) también la carga desde la columna ITU / RTO, con el formato "RTO 27/09/2026"; la plantilla que descargás sale con los datos actuales del sistema, así no se pisa nada al reimportarla.',
      },
      {
        titulo: 'Carnets de conducir',
        contenido: 'En la pestaña Carnets cargás categoría, número y vencimiento del carnet de cada empleado. Por defecto se ven sólo los que tienen carnet; destildá el filtro para cargar uno nuevo. El vencimiento aparece en el Calendario y se usa en el control de salida para avisar si el chofer tiene el carnet vencido.',
      },
      {
        titulo: 'Control de salida',
        contenido: [
          'Antes de cada viaje se revisa la papelería del vehículo. Arriba de la pestaña aparecen los vehículos que salen ese día según la ',
          { texto: 'Bitácora de viajes', ruta: '/bitacora-viajes' },
          ' y el ',
          { texto: 'Parte diario', ruta: '/parte-diario' },
          ' y todavía no tienen control: un click lo crea con el chofer y el destino precargados. El sistema muestra en rojo lo que impide salir (vehículo de baja, sin seguro vigente, RTO o carnet vencidos) y en amarillo lo que hay que mirar (vence pronto, dato sin cargar). Tildá lo que viste en la carpeta (tarjeta verde, seguro, RTO/ITV, carnet) y "Dar por revisado". Con alertas en rojo no se puede dar por revisado: marcalo como observado y contá qué pasó.',
        ],
      },
      {
        titulo: 'Multas',
        contenido: 'Cargá multas de tránsito (con vehículo o patente) e internas (ej. vehículo sucio) con fecha, lugar, motivo, vencimiento, monto, pago y medio de pago. Si tildás "Descontarla al empleado", se crea un vale tipo MULTA que entra solo en la próxima liquidación de sueldos; una vez descontada ya no se puede cambiar el monto ni borrarla (sí anularla). En "Informe por empleado / vehículo" tenés el resumen para pasarle a Mati.',
      },
      {
        titulo: 'Cuadro de seguros y cuotas',
        contenido: 'En Seguros, "Importar cuadro de seguros" lee el cuadro de Mayra (SEGUROS PARQUE AUTOMOTOR o Cuadro Seguros Flota). Completa en cada póliza ya cargada la cobertura, si es individual o de flota, la suma asegurada, la forma de pago y la cuota, y trae las cuotas mes a mes de la hoja de pagos (botón del calendario en cada fila). El cuadro no tiene vencimientos: esos siguen saliendo de la pizarra. Si el cuadro dice otra aseguradora que la cargada, o el vehículo no está en Flota, la vista previa lo avisa y no cambia nada. Reimportar no duplica.',
        veTambien: [{ texto: 'Seguro del personal (ART / AP)', ruta: '/seguros-personal' }],
      },
    ],
  },

  // ── Órdenes de compra ───────────────────────────────────────────────────────
  '/ordenes-compra': {
    titulo: 'Órdenes de compra',
    descripcion: 'Lo que se le pide a cada proveedor, con su PDF, el control de lo que llegó y el cotejo con la factura antes de pagar.',
    secciones: [
      {
        titulo: 'Armar la orden',
        contenido: '"Nueva orden" la crea en borrador con el próximo número de la empresa. Elegí el proveedor: se completan contacto, teléfono, entrega y plazo de su última orden. Cargá los artículos con cantidad y precio; el subtotal, el IVA y el total se calculan solos. Mientras es borrador se puede corregir (por ejemplo, cuando el depósito cambia un material o agrega la referencia del proveedor).',
      },
      {
        titulo: 'Desde un comparativo',
        contenido: [
          'Si se pidieron presupuestos a varios proveedores, cargalos en un ',
          { texto: 'comparativo de compra', ruta: '/comparativos' },
          ': al elegir uno, "Armar orden de compra" la crea en borrador con sus precios y condiciones.',
        ],
      },
      {
        titulo: 'Emitir y mandar',
        contenido: '"Emitir" la deja fija y el PDF sale sin la marca de borrador, listo para mandarle al proveedor. Si hay que cambiar algo, "Volver a borrador" (mientras no tenga facturas). Anular deja la orden en el historial con su número.',
      },
      {
        titulo: 'Recepción',
        contenido: '"Registrar recepción" anota cuánto llegó de cada artículo. Lo que llegó de menos queda marcado en la orden y en el cotejo. Se puede registrar más de una vez si llega en partes.',
      },
      {
        titulo: 'Sumar al stock lo que llega',
        contenido: 'Al registrar la recepción, en "Suma al stock" elegí el producto del depósito de cada artículo (si el código o el nombre coinciden, ya viene elegido). Lo recibido se suma al stock de ese producto y queda en su historial como "Compra recibida", con el número de orden. Si después corregís la cantidad o el producto, se ajusta sólo la diferencia. Los artículos que no son de stock (fletes, servicios, consumibles) dejalos en "No va al stock". Para anular una orden cuya mercadería ya se sumó, primero poné la recepción en cero.',
      },
      {
        titulo: 'Cotejo con la factura',
        contenido: 'Cuando llega la factura del proveedor, vinculala a la orden (desde la orden o desde la factura en Facturas a Pagar). El cotejo compara lo pedido con lo facturado, sumando todas las facturas de la orden. Si coincide, "Cotejada: cerrar la orden"; si hay diferencia, se cierra igual anotando el motivo. En la factura también se ve si coincide con su orden antes de aprobarla o pagarla.',
        veTambien: [{ texto: 'Facturas a Pagar', ruta: '/facturas' }, { texto: 'Órdenes de pago', ruta: '/ordenes-pago' }],
      },
    ],
  },

  // ── Pagos fijos ─────────────────────────────────────────────────────────────
  '/pagos-fijos': {
    titulo: 'Pagos fijos',
    descripcion: 'La agenda de lo que se paga todos los meses (servicios, expensas, impuestos, VEP, débitos automáticos, tarjeta): cuándo vence, cómo se paga y si ya se pagó.',
    secciones: [
      {
        titulo: 'Cargar los pagos fijos',
        contenido: '"+ Pago fijo": qué se paga, el grupo (Empresa, Coworking…), el n° de cliente o contrato, el día del mes en que vence, el monto habitual (vacío si cambia cada mes) y cómo se paga. Se cargan una vez y aparecen solos en todos los meses. Si la planilla de pagos mensuales ya existe, "Importar planilla" los trae con lo registrado en cada mes. No anotes usuarios ni claves: el sistema no los guarda.',
      },
      {
        titulo: 'Registrar el pago del mes',
        contenido: [
          'Con las flechas se cambia de mes. "Registrar pago" en cada fila: pagado, debitado, a favor (por ejemplo, el IVA con saldo a favor) o no corresponde ese mes; el monto real y la fecha. Si se marca "Asentar el gasto en Caja Global", queda como gasto en esa cuenta de ',
          { texto: 'Caja Global', ruta: '/caja' },
          '; si después se corrige el monto o se vuelve a pendiente, el gasto se corrige o se borra solo. Lo que pasó la fecha sin registrar aparece como vencido.',
        ],
      },
      {
        titulo: 'Lo que vence desde otros módulos',
        contenido: [
          'Abajo, "También vence este mes" muestra las cuotas de los planes de AFIP y de los créditos y los gastos de los espacios compartidos, para ver todo junto; se pagan en ',
          { texto: 'AFIP / Créditos', ruta: '/afip-prestamos' },
          ' y en ',
          { texto: 'Espacios compartidos', ruta: '/espacios-compartidos' },
          '. Los pagos fijos pendientes también aparecen en el Calendario.',
        ],
        veTambien: [{ texto: 'Calendario', ruta: '/calendario' }, { texto: 'Cheques', ruta: '/cheques' }],
      },
    ],
  },

  // ── Comparativos de compra ──────────────────────────────────────────────────
  '/comparativos': {
    titulo: 'Comparativos de compra',
    descripcion: 'Los presupuestos de varios proveedores para una misma compra, en un cuadro para decidir a quién comprarle. Lo que se elige pasa a ser la orden de compra.',
    secciones: [
      {
        titulo: 'Armar el cuadro',
        contenido: '"Nuevo comparativo": poné qué se compra y cargá los artículos con su cantidad, uno por fila. Cada proveedor es una columna: elegilo arriba y cargá el precio unitario de cada artículo; si no lo cotizó, dejalo vacío. Abajo van el IVA, el número de presupuesto, la entrega, el plazo y la forma de pago y la validez. Se puede guardar con un solo proveedor y sumar los demás a medida que mandan el presupuesto.',
      },
      {
        titulo: 'Leer el cuadro',
        contenido: 'En verde, el precio más bajo de cada artículo y el total más barato. El más barato se busca entre los que cotizaron todo; el que cotizó sólo una parte lo dice ("Cotizó 2 de 3") porque su total no es comparable. Abajo se ve cuánto saldría comprando cada artículo al que lo cotizó más barato. El PDF sale con el mismo cuadro para presentarlo.',
      },
      {
        titulo: 'Elegir y armar la orden de compra',
        contenido: [
          '"Elegir" en la columna del proveedor (lo hace un administrador). Si no es el más barato o no cotizó todo, hay que anotar por qué; queda en el comparativo, en el PDF y en la orden. Después, "Armar orden de compra" crea la ',
          { texto: 'orden de compra', ruta: '/ordenes-compra' },
          ' en borrador con esos precios, el número de presupuesto y las condiciones, y los datos del proveedor de su última orden. Los artículos que ese proveedor no cotizó no se pasan. Para cambiar de opinión: anulá la orden y "Reabrir" el comparativo.',
        ],
        veTambien: [{ texto: 'Órdenes de compra', ruta: '/ordenes-compra' }, { texto: 'Proveedores', ruta: '/proveedores' }],
      },
    ],
  },

  // ── Órdenes de pago ─────────────────────────────────────────────────────────
  '/ordenes-pago': {
    titulo: 'Órdenes de pago',
    descripcion: 'Las facturas de un proveedor que se pagan juntas, con el echeq o la transferencia de cada parte y quién la elaboró, revisó y autorizó. Reemplaza la hoja "Orden de pago" de la planilla de compras y pagos.',
    secciones: [
      {
        titulo: 'Armar la orden',
        contenido: [
          '"Nueva orden": elegí el proveedor y aparecen sus facturas pendientes de ',
          { texto: 'Facturas a Pagar', ruta: '/facturas' },
          ' (las que ya están en otra orden abierta no se muestran). Tildá las que se pagan; si una se paga en parte, cambiá el importe. Abajo cargá cómo se paga: echeq o cheque con su número y banco, transferencia o efectivo, con la fecha de pago y el importe de cada uno. "Completar lo que falta" pone la diferencia en el último pago. El borrador se puede guardar aunque los totales no cierren.',
        ],
      },
      {
        titulo: 'Revisar y autorizar',
        contenido: '"Marcar revisada" pide que el total pagado coincida con el total a pagar y deja anotado quién la revisó. "Autorizar" lo hace el administrador general (Matías) o quien tenga el permiso de aprobar pagos (Configuración → Usuarios). Si hay que cambiar algo, "Volver a borrador": se borran las firmas y se edita de nuevo. El PDF sale con el formato de la planilla, con los nombres de quien elaboró, revisó y autorizó; en borrador lleva la marca de agua.',
      },
      {
        titulo: 'Registrar el pago',
        contenido: [
          'Con la orden autorizada, "Registrar el pago" anota el pago en cada factura, repartiendo los medios en orden: si un echeq cubre dos facturas, queda un pago en cada una y un solo echeq. Los echeqs aparecen en ',
          { texto: 'Cheques', ruta: '/cheques' },
          ' con su banco y fecha de pago. Si la factura tiene evento y pestaña o rubro, el egreso del evento se crea como en un pago normal. Una orden pagada ya no se anula: si hay que corregir un pago, se anula desde la factura.',
        ],
        veTambien: [{ texto: 'Órdenes de compra', ruta: '/ordenes-compra' }, { texto: 'Facturas a Pagar', ruta: '/facturas' }],
      },
    ],
  },

  // ── Seguro del personal (ART / AP) ──────────────────────────────────────────
  '/seguros-personal': {
    titulo: 'Seguro del personal',
    descripcion: 'Qué póliza cubre a cada persona (ART o accidentes personales), desde cuándo, y qué altas y bajas hay que pedirle al productor.',
    secciones: [
      {
        titulo: 'Pólizas',
        contenido: 'Cargá las pólizas de la empresa: la ART del personal registrado y las de accidentes personales (AP) de jornaleros, eventuales y extranjeros. Con el vencimiento cargado, la póliza aparece en el Calendario y avisa en la campanita 30 días antes. Se puede adjuntar el PDF y anotar el productor con su teléfono o mail.',
      },
      {
        titulo: 'Alta, cambio y baja',
        contenido: '"Alta" anota a la persona en una póliza desde una fecha. "Cambiar" la pasa a otra póliza (por ejemplo, un eventual que queda registrado): la anterior se cierra el mismo día. "Baja" la saca del seguro desde una fecha. Todo queda en el historial; si algo se cargó mal, desde el historial se corrigen las fechas o se elimina el registro.',
      },
      {
        titulo: 'Pedido al productor',
        contenido: 'Cada alta y baja queda pendiente de pedir. "Pedido al productor" arma, por póliza, el mensaje con nombre, CUIL y fecha de cada movimiento: copialo, mandalo por WhatsApp o mail y marcalo como pedido.',
      },
      {
        titulo: 'Tomar del legajo',
        contenido: 'Para la primera carga: propone en qué póliza anotar a cada persona activa según el "tipo de contratación" del legajo (ART, SANCOR, FEDERAL PATRONAL (AP)…). Lo que no dice ART se propone como accidentes personales; revisalo antes de confirmar. Como es la cobertura que ya existe, no entra en el pedido al productor.',
      },
      {
        titulo: 'Avisos',
        contenido: 'Una vez cargada la primera póliza, la campanita avisa: pólizas por vencer o vencidas, personas activas sin seguro, personas inactivas que siguen en una póliza (hay que darlas de baja) y movimientos sin pedir al productor.',
      },
    ],
  },

  // ── Presentismo (Lorena, DOS57) ──────────────────────────────────────────────
  '/presentismo': {
    titulo: 'Control de Presentismo',
    descripcion: 'Asistencia diaria del personal de DOS57: citación, llegada, demoras, llegadas tarde, faltas y francos. Alimenta el premio presentismo de Sueldos Admin.',
    secciones: [
      {
        titulo: 'Día: cargar la asistencia',
        contenido: 'Elegí la fecha y cargá para cada persona la hora de citación de ese día y la hora en que llegó. Si dejás la citación vacía se usa la habitual del empleado. Al cargar la llegada el estado se pone solo: hasta 6 minutos tarde es Presente, de 7 a 15 es Demora y desde 16 es Llegada tarde. Podés cambiarlo a mano (Faltó, Justificado / médica, Libre / no convocado, Vacaciones, Licencia, Franco). "Marcar todos presentes" precarga a los que todavía no tienen registro.',
      },
      {
        titulo: 'Llegadas tarde y Matías',
        contenido: 'Cada Llegada tarde queda pendiente de que Matías la apruebe o la rechace (desde acá o desde la campanita). Aprobada no afecta el premio; rechazada lo hace perder. Las Demoras no piden aprobación: cuentan para el semáforo.',
      },
      {
        titulo: 'Mes: resumen y semáforo',
        contenido: 'La vista Mes muestra la grilla día por día (click en una celda para corregirla) y, por persona, presentes, demoras, llegadas tarde, faltas, saldo de francos y el semáforo:\n• Excelente: hasta 2 demoras, 1 llegada tarde y ninguna falta.\n• Seguimiento: 3-4 demoras, 2-3 llegadas tarde o 1 falta.\n• Atención: 5 o más demoras, 4 o más llegadas tarde o 2 o más faltas.\nVale el peor de los tres. "Exportar Excel" baja la grilla con el mismo informe; "Cerrar mes" guarda el resumen que usa Sueldos Admin para el premio presentismo.',
        veTambien: [{ texto: 'Sueldos Administrativos', ruta: '/rrhh/sueldos-admin' }],
      },
      {
        titulo: 'Francos',
        contenido: 'Cada domingo trabajado suma un franco; cada día marcado como "Franco (por domingo)" lo descuenta. En la vista Francos ves cuántos le corresponden a cada uno. El saldo inicial es lo que traían de antes de cargar en el sistema y lo podés corregir ahí mismo.',
      },
      {
        titulo: 'Importar la planilla del mes',
        contenido: 'Desde la vista Día, "Importar planilla del mes" lee tu Excel con una hoja por persona (MES y NOMBRE arriba, y la tabla CONVOCATORIA · FECHA · HORARIO · SI · DEMORA · LLEGADA TARDE · NO CONVOCADO · FALTO · MÉDICA · VACACIONES · FRANCO POR DOMINGO · OBSERVACIÓN). Manda tu marca de cada día; si un día no tiene marca, se usa lo que dice CONVOCATORIA (LIBRE, FRANCO, LICENCIA…) y, si tampoco, se clasifica la hora de llegada contra la citación. Antes de importar ves una vista previa por hoja: las personas que no están cargadas en RRHH aparecen en amarillo y no se importan. Reimportar el mismo archivo no duplica.',
      },
      {
        titulo: 'Importar el padrón de empleados',
        contenido: 'Quien lleva el padrón (con el permiso "Padrón de empleados") ve arriba "Importar padrón de empleados": lee la planilla de datos personales (hoja de fijos) y da de alta a los que faltan, con CUIL, contacto, escalafón, licencia y talles. Los que ya están se reconocen por CUIL (o por apellido y nombre) y se actualizan con lo que trae la planilla: una celda vacía no borra nada. Nadie se da de baja: la vista previa lista a los activos que no aparecen en la planilla para que los revises. Importá el padrón antes que la planilla del mes, así no quedan personas en amarillo.',
      },
    ],
    links: [
      { label: 'Ver Calendario', ruta: '/calendario' },
    ],
  },

  '/costo-real': {
    titulo: 'Costo real de eventos',
    descripcion: 'El tablero de la matriz de costo real de DOS57: cuánto salió de verdad cada evento, para comparar con lo que se cobra.',
    secciones: [
      {
        titulo: 'Qué muestra',
        contenido: 'Una fila por evento con el rental presupuestado (del presupuesto vinculado al evento), el costo real cargado y la fecha de la última carga. Los que dicen "Sin cargar" todavía no tienen matriz. Filtrá por año o buscá por nombre o lugar; hacé clic en un evento para abrir su pestaña Costo real.',
      },
      {
        titulo: 'Importar y exportar',
        contenido: '"Importar" lee la planilla de costo real del evento, la misma que se arma hoy (hojas CC, OPEX, RENTAL COSTS y L&A COSTS): primero muestra qué trae cada bloque y si el total coincide con la hoja CC, y recién al confirmar lo guarda. Reimportar reemplaza lo importado antes y no toca lo cargado a mano. "Exportar" baja el Excel con el mismo formato, que se puede volver a importar.',
      },
      {
        titulo: 'Planillas de campo (sin señal)',
        contenido: '"Planillas" baja un Excel con las planillas de control del evento ya precargadas: horas y viandas de cada día con la cuadrilla asignada (del Parte diario), alojamiento, pañol (con lo que sale y su valor) y combustible (con los vehículos del evento). Se imprimen para completar a mano o se completan directo en la notebook, sin conexión.\nA la vuelta, pasá lo anotado al mismo Excel y elegí "Planillas" → "Elegir planillas completas": primero ves qué entra en cada bloque y después se carga al costo real con la etiqueta "Campo". Las horas dan los turnos por grupo (el valor del turno se completa en el costo real y se conserva al reimportar), las viandas las comidas, lo que faltó del pañol las pérdidas, y las cargas el combustible. Reimportar reemplaza sólo lo de campo; si un bloque ya tiene líneas de la matriz o del sistema te avisa, para no contarlo dos veces.',
      },
      {
        titulo: 'Quién lo ve',
        contenido: 'Los administradores y quien tenga el permiso "Costo real de eventos" (se asigna en Configuración → Usuarios).',
      },
    ],
    links: [
      { label: 'Ver Bitácora', ruta: '/bitacora-viajes' },
      { label: 'Ver Movimiento diario', ruta: '/movimiento-diario' },
    ],
  },

  '/bitacora-viajes': {
    titulo: 'Bitácora de viajes de camiones',
    descripcion: 'Los viajes de los camiones de DOS57 (planillas de Flor): tramo, chofer, km, litros, combustible y caja entregada. Vinculados a un evento, aparecen en el tab Logística de ese evento.',
    secciones: [
      {
        titulo: 'Importar la planilla',
        contenido: '"Importar planilla" lee el Excel de Flor (la puede importar quien la lleva, aunque sea Operador): las hojas por evento, la de logística diaria (con sus bloques) y las de viajes con horario. Primero ves una vista previa y no se guarda nada hasta confirmar. Reimportar el mismo archivo actualiza los viajes, no los duplica.',
      },
      {
        titulo: 'Cómo encuentra el evento',
        contenido: 'El nombre del evento sale de la columna EVENTO, del título del bloque ("PLANILLA DE VIAJES CAMIONES - …") o del nombre de la hoja. No hace falta escribirlo igual que en el sistema: se comparan sin tildes, mayúsculas ni signos, y por palabras ("JUJUY - LA RENGA" encuentra "La Renga Jujuy 2026"). Si el mismo evento aparece escrito de dos formas, se agrupa en uno solo.\nPara elegir el evento se usan también las fechas: si hay dos ediciones del mismo evento, se propone la que coincide con las fechas de los viajes (contando el montaje y el desmontaje). Si el evento propuesto tiene fechas que no coinciden, lo vas a ver en amarillo.',
      },
      {
        titulo: 'Confirmar la vinculación',
        contenido: 'Para cada evento de la planilla respondés Sí o No a la sugerencia, o elegís otro evento de la lista. Si no hay sugerencia, podés elegir uno o dejarlo como texto libre. Lo que confirmás queda recordado: la próxima vez que aparezca ese nombre se propone directo, aunque no se parezca al del sistema (por ejemplo "SGO" para "Aniversario Santiago del Estero"). Si respondés No, se olvida.\nResponder No nunca desvincula viajes que ya estaban vinculados. Un viaje suelto también se puede vincular a mano desde su ficha.',
      },
    ],
    links: [
      { label: 'Ver Eventos', ruta: '/eventos' },
    ],
  },

  // ── Caja Global ─────────────────────────────────────────────────────────────
  '/caja': {
    titulo: 'Caja Global',
    descripcion: 'Todas las cuentas de la empresa: las cajas de cada evento y las cajas sin evento (cajas chicas por persona, reserva, etc.).',
    secciones: [
      {
        titulo: 'Rendición de una caja',
        contenido: 'Una caja abierta recibe movimientos. Cuando el responsable vuelve se marca "pendiente de rendición" y un admin confirma la rendición, que la cierra. Las cajas cerradas ya están rendidas: no suman en el saldo consolidado.',
      },
      {
        titulo: 'Importar cajas chicas',
        contenido: '"Importar cajas chicas" (admin) lee la planilla de cajas chicas: cada bloque NOMBRE / MES con su fila de totales pasa a ser una caja de efectivo sin evento, ya cerrada, a nombre de la persona y el mes ("Caja chica Dani Yanello — Mayo 2026 (2)" si ese mes rindió más de una vez). Los ingresos (apertura, sobrante, reposiciones) van al debe y los gastos al haber.\nLa vista previa compara cada caja contra la fila de totales de la planilla y avisa cuando las filas no suman lo mismo. Los bloques repetidos (la hoja que junta las de todos, o una hoja copiada de otra) quedan destildados; si una copia tiene filas distintas y la importás, va a una caja aparte para compararla. Se puede abrir cada caja para ver sus movimientos antes de confirmar. Reimportar no duplica y no borra lo cargado a mano.',
      },
    ],
  },

  // ── Gastos del mes (Andrea, DOS57) ──────────────────────────────────────────
  '/gastos-operativos': {
    titulo: 'Gastos del mes',
    descripcion: 'La caja general de DOS57 con sus columnas, el resumen semanal de pagos para aprobar, los siniestros de empleados y el excedente de horas.',
    secciones: [
      {
        titulo: 'Caja del mes',
        contenido: 'El libro diario de cada caja de la empresa, con una columna por tipo de gasto: combustible, comida, gastos varios, servicios, devolución de gastos, vales y viático de extranjeros. El viático de extranjeros es la cena y el desayuno que se les paga cada semana: va como gasto de la caja, no en la liquidación, y se carga sólo cuando corresponde (si el evento ya les da la cena, no se carga).',
      },
      {
        titulo: 'Pagos semanales: armar la semana',
        contenido: '"Nueva semana" crea el resumen (de lunes a domingo) y puede copiar las líneas de la semana anterior con el importe en cero, porque los grupos se repiten. "Traer del sistema" sugiere lo que ya está cargado: liquidaciones de jornaleros agrupadas por equipo, adelantos, viáticos de extranjeros y los gastos de cada caja para reponerla. Lo que ya entró en otro resumen no se vuelve a sugerir.\nDebajo del total está "Cómo se cubre": las entregas de efectivo, transferencias o saldo anterior con que se paga la semana. Es informativo y no se aprueba. Cuando está completo, "Enviar a revisar" le manda el aviso a quien aprueba.',
      },
      {
        titulo: 'Pagos semanales: aprobar línea por línea',
        contenido: 'Aprueba el administrador general, o quien tenga el permiso "Aprobar pagos semanales" (Configuración → Usuarios). Con el tilde se aprueba la línea. Con el globito se pide un cambio (con un comentario y, si hace falta, el importe que debería ser), se aprueba por otro importe o se marca que no se paga. "Aprobar las pendientes" tilda de una vez lo que quedó sin revisar.\nSi quien armó el resumen corrige una línea que ya se había revisado, esa línea vuelve a pendiente para que la vuelvan a mirar, y el comentario queda a la vista. El total aprobado suma sólo las líneas aprobadas.',
      },
      {
        titulo: 'Importar la planilla de pagos',
        contenido: '"Importar planilla" lee la planilla PAGOS+CAJAS (una hoja por mes, varios bloques semanales por hoja). Cada semana entra como "De la planilla": se aprobó fuera del sistema, así que no tiene revisión por línea. La vista previa compara cada semana contra el TOTAL CAJA SEMANAL de la planilla y avisa si no coincide. Reimportar no duplica y no toca las semanas que ya se trabajan en el sistema.',
      },
    ],
  },

  // ── Ficha del proveedor ─────────────────────────────────────────────────────
  '/proveedores/:id': {
    titulo: 'Ficha del proveedor',
    descripcion: 'Sus datos, lo que se le debe y todo lo que se le compró y pagó, en una sola pantalla.',
    secciones: [
      {
        titulo: 'Cuenta del proveedor',
        contenido: [
          'Arriba, cuánto se le debe (lo pendiente de sus facturas), cuánto está vencido, lo facturado y lo pagado, por moneda. Las anuladas no cuentan. Debajo, sus ',
          { texto: 'facturas', ruta: '/facturas' },
          ' (tildá "Sólo las pendientes" para ver qué falta pagar), los pagos hechos con su medio y la orden de pago que los generó, y sus ',
          { texto: 'órdenes de compra', ruta: '/ordenes-compra' },
          ' y ',
          { texto: 'órdenes de pago', ruta: '/ordenes-pago' },
          '. Cada número abre su detalle. Lo ve quien tiene acceso a Facturas a Pagar.',
        ],
      },
      {
        titulo: 'En los eventos',
        contenido: 'Los egresos de los eventos cargados a este proveedor y los echeqs que se le dieron. Un echeq sin evento lleva a Cheques.',
      },
    ],
  },

  // ── Uniformes ───────────────────────────────────────────────────────────────
  '/uniformes': {
    titulo: 'Uniformes',
    descripcion: 'Entregas de uniformes por empleado y stock del depósito por talle.',
    secciones: [
      {
        titulo: 'Entregas',
        contenido: 'Totales del año por empleado. Hacé click en una fila para ver su historial, cargar una entrega o corregirla. "Importar desde Excel" lee el libro de entregas (hoja PLANTA ESTABLE, hojas por empleado y resúmenes anuales); revisá la vista previa antes de confirmar, porque una hoja marcada en rojo da de baja al empleado.',
      },
      {
        titulo: 'Stock del depósito',
        contenido: 'Lo que hay por prenda y talle en cada depósito. "Importar stock" lee la planilla de stock de uniformes: cada hoja es un conteo en una fecha y se toma la última (podés elegir otra en la vista previa). Los talles en 0 también se guardan: en rojo los que no tienen stock y en ámbar los que tienen 5 o menos, que además avisan en la campanita.',
      },
    ],
  },

  // ── AFIP y Créditos Bancarios ────────────────────────────────────────────────
  '/cheques': {
    titulo: 'Cheques',
    descripcion: 'Dos pestañas: "Emitidos", los cheques que emite la empresa por banco (pagos a proveedores y financiamiento con SGR, sean de un evento o no), y "Recibidos", la cartera de cheques y echeqs con los que pagan los clientes. Reemplaza las planillas de cheques pendientes y la hoja RECIBIDOS de cada banco.',
    secciones: [
      {
        titulo: 'Cargar un cheque',
        contenido: '"Nuevo cheque": banco, número, a quién va (proveedor o concepto), monto y fecha de pago. Si es de un evento, elegilo; si es de la empresa (financiamiento, gastos generales), dejalo sin evento. Los cheques que se generan al pagar una factura con echeq, al registrar una orden de pago (ya con su banco) o desde Gastos Extraordinarios del evento aparecen acá solos: a los que no traen banco, completáselo desde "Editar".',
      },
      {
        titulo: 'Importar la planilla del banco',
        contenido: '"Importar planilla" lee la planilla de cheques de cada banco (una hoja por año, con sus bloques por mes de flujo de cheques y de financiamiento). Primero muestra cuántos cheques hay por año y qué se va a hacer; elegís los años y confirmás. PAGADO entra como debitado con su fecha de entrada, ACEPTADO o vacío como pendiente, y VENCIDO o ANULADO como rechazado con ese texto. Se puede volver a importar la misma planilla actualizada: no duplica, y lo que ya marcaste en el sistema no vuelve atrás. Si un cheque ya estaba cargado desde un evento o un pago de factura, se le completa el banco. Para que los de financiamiento queden ligados a su SGR, cargá antes las SGR en AFIP / Créditos.',
      },
      {
        titulo: 'Financiamiento con SGR',
        contenido: 'Elegí el tipo "Financiamiento": propio (sin aval, se puede cubrir con la misma SGR) o avalado (entra al banco sí o sí y hay que cubrirlo). Se ven en verde, como en la planilla, y se pueden filtrar aparte.',
      },
      {
        titulo: 'Debitado',
        contenido: 'Cuando el cheque entra al banco, "Debitado" y la fecha en que entró: es el "PAGADO" y la "fecha de entrada" de la planilla. Si te equivocaste, se vuelve a pendiente con la flecha. Los que tienen fecha pasada y siguen pendientes se marcan en rojo en la tarjeta del banco.',
      },
      {
        titulo: 'Aviso de los jueves',
        contenido: 'Jueves y viernes la campanita avisa cuánto hay que cubrir por los cheques que caen ese viernes o el fin de semana, separado por banco y contando los avalados. La tarjeta "A cubrir el viernes" muestra lo mismo todos los días; al tocarla, filtra esos cheques.',
      },
      {
        titulo: 'Recibidos: la cartera de cheques de clientes',
        contenido: [
          'Cuando un cliente paga con echeqs o cheques, cargalos al registrar el cobro en ',
          { texto: 'Facturas a Cobrar', ruta: '/facturas-emitidas' },
          ' (forma de cobro Echeq o Cheque físico → "Agregar" cada uno con número, banco, importe y fecha de pago): quedan en la cartera ligados a esa factura. Los que no pagan una factura se cargan con "Cheque recibido". La hoja RECIBIDOS de la planilla del banco se importa con "Importar planilla".',
        ],
      },
      {
        titulo: 'Custodia, depósito, venta y endoso',
        contenido: 'El día anterior a la fecha de pago la campanita avisa los que siguen en cartera: "Custodia" (se acredita solo ese día) o "Cambiar… → Depositado". Cuando entra la plata, "Acreditado" con la cuenta: el ingreso queda asentado en Caja Global. También se pueden vender (con lo que entró neto y la tasa), endosar a un proveedor o marcar rechazados; "Volver a cartera" deshace y borra el ingreso de la caja. Un echeq se puede depositar hasta 30 días después de la fecha de pago: pasado eso se marca en rojo. Si se rechaza un cheque de una factura, la factura sigue cobrada hasta que se elimine ese cobro.',
      },
    ],
    links: [{ label: 'SGR (AFIP / Créditos)', ruta: '/afip-prestamos?tab=sgr' }, { label: 'Ver el calendario', ruta: '/calendario' }],
  },

  '/afip-prestamos': {
    titulo: 'AFIP y Créditos Bancarios',
    descripcion: 'Seguimiento de planes de pago AFIP y créditos bancarios con cronograma de cuotas.',
    secciones: [
      {
        titulo: '¿Para qué sirve?',
        contenido: [
          'Seguimiento de planes de pago AFIP y créditos bancarios con cronograma de cuotas. Las cuotas próximas a vencer aparecen en el ',
          { texto: 'Calendario', ruta: '/calendario' },
          ' y en las ',
          { texto: 'notificaciones', ruta: '/notificaciones' },
          '.',
        ],
        veTambien: [{ texto: 'Calendario', ruta: '/calendario' }],
      },
    ],
  },

  // ── Tarjeta Corporativa ──────────────────────────────────────────────────────
  '/tarjeta-corporativa': {
    titulo: 'Tarjeta Corporativa',
    descripcion: 'Consumos mensuales de las tarjetas Galicia de DOS57 y Enjoy por responsable, en $ y USD.',
    secciones: [
      {
        titulo: '¿Para qué sirve?',
        contenido: 'Reemplaza la planilla mensual de tarjeta corporativa: arriba el resumen por responsable (igual al bloque del Excel) y abajo el detalle de cada consumo. Hacé click en un responsable o en los chips para ver sólo sus consumos.',
      },
      {
        titulo: 'Importar desde Excel',
        contenido: 'Subí la planilla anual (una hoja por mes). Los totales se recalculan desde el detalle — el bloque resumen del Excel no se usa. Reimportar el mismo archivo no duplica: actualiza los consumos existentes. Los consumos de ANDRE marcados "PERSONAL Y DOS57" quedan en la parte Empresa con la observación "(MIXTO – revisar)" para repartirlos a mano.',
      },
      {
        titulo: 'Descontado',
        contenido: 'Si la observación dice "SE DESCONTO" (ej. multas descontadas al chofer) el consumo muestra el badge rojo "Descontado"; si dice "NO SE DESCONTO", el gris "No descontado". También se puede marcar a mano al editar.',
      },
    ],
  },

  // ── RRHH: jornadas y liquidaciones de jornaleros ────────────────────────────
  '/rrhh': {
    titulo: 'RRHH',
    descripcion: 'Empleados, jornadas, anticipos y liquidaciones de jornaleros.',
    secciones: [
      {
        titulo: 'Cargar las horas desde la planilla',
        contenido: 'En Importar → "Horas y vales" subí la planilla HORAS Y VALES del mes (una hoja por persona). Se toman las horas trabajadas de cada día, también las que pasan la medianoche, y los vales de abajo entran como anticipos. Las jornadas quedan aprobadas. Si alguien no está en RRHH, se da de alta como jornalero y hay que cargarle el valor hora. Reimportar el mismo archivo no duplica.',
      },
      {
        titulo: 'Corregir una jornada aprobada o rechazada',
        contenido: 'En Jornadas, el botón de la flecha vuelve una jornada aprobada o rechazada a pendiente, para corregirla y aprobarla de nuevo. El tacho la elimina aunque esté aprobada. Si la jornada ya entró en una liquidación (en borrador, pre-aprobada, aprobada o pagada), el sistema no deja hacer ninguna de las dos cosas: primero hay que cancelar esa liquidación.',
      },
      {
        titulo: 'Cómo se calcula',
        contenido: 'Por hora: las primeras 10 horas de cada día se pagan al valor hora y el resto al valor de la hora extra. A eso se le descuentan los adelantos y vales pendientes.',
      },
      {
        titulo: 'Liquidaciones pendientes y fecha de pago',
        contenido: '"Generar pendientes" arma una liquidación por persona con las jornadas aprobadas que todavía no se liquidaron, con fecha de pago el viernes más próximo (se puede cambiar). El listado se filtra por fecha de pago, y en el Calendario cada día de pago aparece una sola vez con el total; al abrirlo te lleva a ese listado.',
      },
      {
        titulo: 'Pre-aprobación, aprobación y pago',
        contenido: 'Tildá las liquidaciones y usá "Pedido de transferencias": el sistema arma el mensaje con titular, CUIT, CBU, alias, importe y concepto, listo para copiar y mandarle a Matías por WhatsApp; al copiarlo quedan pre-aprobadas. Cuando Matías aprueba, "Aprobar" (de a una o todas las tildadas). Al pagar, "Registrar pago": elegís la cuenta de la que sale, la fecha y el comprobante; queda como gasto en esa cuenta y la liquidación pasa a Pagada. El PDF individual sigue en cada fila.',
      },
    ],
    links: [
      { label: 'Seguro del personal (ART / AP)', ruta: '/seguros-personal' },
      { label: 'Importar horas y vales', ruta: '/rrhh/importar' },
      { label: 'Ver el calendario', ruta: '/calendario' },
    ],
  },

  // ── Sueldos administrativos ──────────────────────────────────────────────────
  '/rrhh/sueldos-admin': {
    titulo: 'Sueldos Administrativos',
    descripcion: 'Liquidación mensual de personal administrativo con conceptos configurables por escalafón.',
    secciones: [
      {
        titulo: '¿Para qué sirve?',
        contenido: 'Liquidación mensual de personal administrativo con conceptos configurables por escalafón. Si el empleado trabaja para más de una empresa, el costo se divide automáticamente según el porcentaje acordado.',
      },
      {
        titulo: 'Bitácora de Viajes (choferes)',
        contenido: 'Para choferes con viático variable por recorrido (Provincial/Nacional/Nacional +1000km), cargá cada viaje en la Bitácora de Viajes — el viático del mes se calcula solo y reemplaza el monto fijo del acuerdo al generar la liquidación.',
      },
      {
        titulo: 'Premio de producción 1 o 2',
        contenido: 'En el acuerdo se cargan los dos montos: Premio 1 (evento de hasta 7 días) y Premio 2 (más de 7 días). Al agregar cada evento del mes se elige cuál corresponde, como lo decide Matías evento por evento; el monto se puede retocar a mano.',
      },
      {
        titulo: 'Antigüedad',
        contenido: 'Se cuenta desde la fecha de ingreso del empleado (RRHH → Empleados), no desde el inicio del acuerdo, que cambia con cada aumento. Si el empleado no tiene la fecha de ingreso cargada, se usa la del acuerdo.',
      },
      {
        titulo: 'Vacaciones, aguinaldo y extras',
        contenido: 'Al generar o editar una liquidación, vacaciones, aguinaldo y extras se cargan por separado, y los extras llevan su aclaración (por ejemplo "Premio productividad"). Así, si un mes se paga el aguinaldo y además un premio, cada uno queda con su monto y sale por separado en el recibo, sin sumarlos a mano. Las liquidaciones anteriores a este cambio tenían un solo monto: quedaron como extras.',
      },
      {
        titulo: 'Calcular el aguinaldo',
        contenido: '"Calcular", al lado de Aguinaldo, hace la misma cuenta que la planilla: suma los sueldos de los seis meses del semestre (enero a junio o julio a diciembre), divide por 6 y después por 2. Cada sueldo se toma sin vacaciones, aguinaldo ni extras. El mes que estás generando entra con lo que muestra la vista previa. Si algún mes no tiene sueldo en el sistema, lo avisa: si la persona trabajó ese mes, el monto queda bajo y conviene corregirlo a mano.',
      },
      {
        titulo: 'Premios de Matías por un tiempo',
        contenido: 'Para los premios que Matías da durante algunos meses (por ejemplo, un "premio casa"): en Generar liquidación → Premios de Matías → "agregar", con el monto por mes, desde cuándo y, si se sabe, hasta cuándo. Mientras esté vigente se suma solo en cada liquidación. Se puede destildar en un mes puntual, y "terminar" lo corta desde el mes que estás liquidando. Las liquidaciones ya generadas no cambian.',
      },
      {
        titulo: 'Cierre de sueldos: efectivo y transferencia',
        contenido: 'Con un mes y un año elegidos en Liquidaciones, abajo aparece el cierre: cuánto cobra cada uno, cuánto va en efectivo, cuánto por transferencia y lo que falta asignar, con los totales que hay que pedirle a Matías. Cada persona tiene una forma de pago habitual (transferencia, efectivo o "a definir cada mes"). Si un mes es distinto, tocá la fila y repartilo; "Volver a la habitual" deshace el cambio. Se puede completar aunque la liquidación ya esté aprobada.',
      },
    ],
  },

  // ── Calendario ───────────────────────────────────────────────────────────────
  // ── Libro de novedades (pilar 10) ───────────────────────────────────────────
  '/novedades': {
    titulo: 'Novedades',
    descripcion: 'El libro de todo lo que pasa y hay que dejar asentado: un choque, algo que faltó, un camión que se rompió, una goma pinchada. Reemplaza los avisos sueltos por WhatsApp.',
    secciones: [
      {
        titulo: 'Cargar una novedad',
        contenido: '"Nueva novedad": elegí el tipo, la gravedad y contá en pocas palabras qué pasó. Se puede sacar la foto en el momento desde el celular (se achica sola antes de subirla). Si tiene que ver con un evento o un vehículo, elegilo: así aparece también en la pestaña Novedades del evento. "Más datos" agrega el lugar, quién avisó, la persona o el proveedor involucrado y quién se ocupa.',
      },
      {
        titulo: 'Gravedad',
        contenido: 'Crítica: frena el trabajo o pone en riesgo a alguien, hay que atenderla ya. Alta: se resuelve hoy o mañana. Media: hay que resolverla, pero puede esperar unos días. Baja: para dejar asentado.\nLa lista se ordena sola: primero lo que está sin resolver, y dentro de eso, lo más grave arriba. Las tarjetas de arriba cuentan cuántas hay de cada gravedad y, al tocarlas, filtran.',
      },
      {
        titulo: 'Quién se entera',
        contenido: 'Las novedades altas y críticas sin resolver le aparecen en la campanita al administrador general y a quienes figuren en "Tipos y avisos" para ese tipo. Quien se ocupa (el responsable) recibe el aviso de cualquier gravedad. El aviso desaparece cuando la novedad se marca resuelta.',
      },
      {
        titulo: 'Resolver',
        contenido: 'Desde el detalle: "En curso" cuando alguien ya la está atendiendo, y "Resolver" cuando quedó solucionada, contando qué se hizo. Queda registrado quién la resolvió y cuándo. Una novedad resuelta se puede reabrir.',
      },
      {
        titulo: 'Tipos y avisos',
        contenido: 'El administrador define los tipos (flota, material, personal, proveedor, cliente, clima, otro, o los que hagan falta), su color y a quién avisar de las graves de cada uno. Un tipo que ya no se usa se desactiva: deja de ofrecerse al cargar, pero las novedades viejas lo conservan.',
      },
    ],
  },

  '/calendario': {
    titulo: 'Calendario',
    descripcion: 'Vista centralizada de todos los vencimientos y eventos del sistema.',
    secciones: [
      {
        titulo: '¿Qué muestra?',
        contenido: 'Vista centralizada de todos los vencimientos y eventos del sistema: seguros, RTO/ITV, carnets de conducir, multas, controles de salida pendientes, patentes, cuotas AFIP, créditos, facturas y más. Filtrá por tipo con los badges de colores. Lo vencido aparece en rojo y lo que vence pronto en amarillo.',
      },
      {
        titulo: 'Montaje, desmontaje y cumpleaños',
        contenido: 'Si el evento tiene cargados días de montaje o desmontaje, cada uno aparece en su día, antes del inicio y después del fin, con el número de día (por ejemplo "Montaje (2/3)"). Los cumpleaños del personal activo salen de la fecha de nacimiento del legajo y los ve administración.',
      },
    ],
  },

  // ── Importar Excel ──────────────────────────────────────────────────────────
  '/importer': {
    titulo: 'Importar Excel',
    descripcion: 'Cargá eventos históricos desde el Excel original sin cargar cada movimiento a mano.',
    secciones: [
      {
        titulo: '¿Para qué sirve?',
        contenido: 'Cargá eventos históricos desde el Excel original sin tener que cargar cada movimiento a mano.',
      },
      {
        titulo: '¿Cómo funciona?',
        contenido: '1. Subís el archivo Excel (.xlsx)\n2. El sistema analiza las 10 hojas y muestra un preview\n3. Revisás los datos y completás la info del evento (nombre, socios, fechas)\n4. Confirmás la importación\n5. El sistema crea el evento con todos sus movimientos y saldos calculados',
      },
      {
        titulo: 'Vincular proveedores',
        contenido: 'Después de importar, el sistema te ofrece vincular proveedores a los movimientos en forma masiva agrupados por concepto.',
      },
      {
        titulo: '¿Qué pasa con los saldos del Excel?',
        contenido: 'Se ignoran — el sistema los recalcula desde cero para garantizar exactitud.',
      },
    ],
    links: [
      { label: 'Importar ahora', ruta: '/importer' },
    ],
  },

  // ── Auditoría ───────────────────────────────────────────────────────────────
  '/auditoria': {
    titulo: 'Auditoría',
    descripcion: 'Registro completo de todas las operaciones del sistema.',
    secciones: [
      {
        titulo: '¿Qué registra la auditoría?',
        contenido: 'Cada operación relevante (crear, editar, eliminar, aprobar, anular) queda registrada con fecha, usuario, entidad afectada y datos antes/después.',
      },
      {
        titulo: 'Filtros',
        contenido: 'Podés filtrar por usuario, tipo de acción, entidad o evento. El período máximo por consulta es de 90 días.',
      },
    ],
  },

  // ── Configuración ───────────────────────────────────────────────────────────
  '/configuracion': {
    titulo: 'Configuración',
    descripcion: 'Ajustes globales del sistema.',
    secciones: [
      {
        titulo: 'Rubros de egresos e ingresos',
        contenido: 'Creá, renombrá, reordená (arrastrando) o desactivá los rubros de egresos e ingresos de tu empresa. Cada rubro activo aparece como una pestaña en todos los eventos. Los rubros del sistema no se pueden eliminar ni desactivar. En los de egresos se puede cargar el proveedor habitual y el costo estimado: la Ficha de cada evento los sugiere al elegir el proveedor de ese rubro.',
      },
      {
        titulo: 'Usuarios',
        contenido: 'Creá y gestioná usuarios. Cada usuario tiene un rol que define qué puede ver y hacer en el sistema — ver la sección "Roles y permisos" para el detalle de cada uno.',
      },
      {
        titulo: 'Contraseñas',
        contenido: 'Al crear un usuario le ponés una contraseña inicial y se la pasás. En su primer ingreso el sistema le pide elegir una propia antes de seguir. Si alguien se olvida la suya, editás el usuario y le cargás una nueva: también la va a tener que cambiar al entrar. Cada uno puede cambiar la suya cuando quiera desde "Cambiar contraseña", abajo en el menú.',
      },
      {
        titulo: 'Permisos de carga',
        contenido: 'Para que el responsable de un archivo lo cargue sin esperar a un admin, al editar un usuario que no es Admin podés tildarle permisos puntuales: Tarjeta corporativa (ver e importar los resúmenes), Facturas a pagar (incluye importar el libro de compras de AFIP), Padrón de empleados (importar la planilla de datos personales, sin ver sueldos) y Uniformes. El módulo le aparece en el menú y el cambio rige enseguida.',
      },
      {
        titulo: 'Roles y permisos',
        contenido: 'ADMIN — Acceso total. Puede crear eventos, gestionar usuarios, ver todas las áreas.\n\n'
          + 'OPERADOR — Acceso operativo. Puede ver eventos y cargar datos en Caja, Ficha, Stock y Parte Diario. No puede crear eventos ni acceder a RRHH, Facturas o Proveedores, salvo lo que le habiliten los permisos de carga.\n\n'
          + 'VIEWER — Solo lectura. Ve todo lo que ve el Operador pero no puede cargar ni modificar nada.\n\n'
          + 'JORNALERO — Acceso mínimo. Solo puede cargar sus propias jornadas y ver su asignación en el Parte Diario del día.\n\n'
          + 'PAÑOLERO — Acceso al pañol. Solo puede gestionar las salidas y devoluciones del pañol.',
      },
    ],
  },

  // ── Parte Diario (DOS57) ────────────────────────────────────────────────────
  '/parte-diario': {
    titulo: 'Parte Diario de Personal',
    descripcion: 'Planilla diaria que reemplaza el armado manual en Excel: quién trabaja, en qué horario, dónde y con qué vehículo.',
    secciones: [
      {
        titulo: '¿Cómo se arma?',
        contenido: 'Elegí la fecha con el navegador de días y creá el parte si todavía no existe. Agregá personas en cada sección (Administración, Depósito, Eventos) con su horario, lugar, tarea y vehículo. Las personas sin asignación van a "No citados".',
      },
      {
        titulo: 'Orden y secciones',
        contenido: 'Podés reordenar arrastrando las filas dentro de cada sección. El orden se guarda automáticamente.',
      },
      {
        titulo: 'Cerrar el parte',
        contenido: 'Al cerrar el parte, el sistema crea automáticamente las Jornadas de RRHH para cada persona asignada que tenga hora de ingreso y hora de salida fija cargadas. Un parte cerrado ya no se puede editar.',
      },
      {
        titulo: 'Hora de salida "***"',
        contenido: 'Si alguien se queda más tiempo por su propia voluntad, no marques "Hora fija": esa hora no se usa para calcular horas trabajadas.',
      },
    ],
    links: [
      { label: 'Ver historial de partes', ruta: '/parte-diario/historial' },
      { label: 'Ver RRHH', ruta: '/rrhh' },
    ],
  },

  // ── Notificaciones (campanita) ──────────────────────────────────────────────
  '/notificaciones': {
    titulo: 'Notificaciones',
    descripcion: 'Alertas del sistema que requieren tu atención — vencimientos, pendientes y decisiones sin tomar.',
    secciones: [
      {
        titulo: 'Evento sin decisión de facturación',
        contenido: 'Eventos nuevos sin decisión de facturación — hacé click para ir al evento y decidir.',
      },
    ],
  },

};

// ── Guía de carga de datos (Enjoy) ──────────────────────────────────────────
// Se arma desde lib/guiaCargaEnjoy.ts para que el buscador encuentre cada paso
// ("cajas chicas", "comidas"…) y lleve a la guía.
help['/guia-carga'] = {
  titulo: 'Guía de carga de datos',
  descripcion: GUIA_INTRO,
  secciones: GUIA_PASOS.map(p => ({
    titulo: p.titulo,
    contenido: [p.intro, ...[...(p.filas ?? []), ...(p.tareas ?? [])].map(f =>
      `• ${f.que}${f.planilla ? ` (${f.planilla})` : ''}${f.donde && f.donde !== '—' ? ` → ${f.donde}` : ''}`,
    )].filter(Boolean).join('\n'),
  })),
};

// ── Routing ──────────────────────────────────────────────────────────────────

export function getHelpContent(pathname: string): HelpContent | null {
  if (help[pathname]) return help[pathname];

  // Event sub-paths — orden de más específico a menos
  if (/^\/eventos\/\d+\/vincular-proveedores/.test(pathname)) return help['/eventos/:id/vincular-proveedores'] ?? null;
  if (/^\/eventos\/\d+\/ficha/.test(pathname))                return help['/eventos/:id/ficha']                ?? null;
  if (/^\/eventos\/\d+\/egresos/.test(pathname))              return help['/eventos/:id/egresos']              ?? null;
  if (/^\/eventos\/\d+\/ingresos/.test(pathname))             return help['/eventos/:id/ingresos']             ?? null;
  if (/^\/eventos\/\d+\/caja/.test(pathname))                 return help['/eventos/:id/caja']                 ?? null;
  if (/^\/eventos\/\d+\/conciliatoria/.test(pathname))        return help['/eventos/:id/conciliatoria']        ?? null;
  if (/^\/eventos\/\d+/.test(pathname))                       return help['/eventos/:id']                      ?? null;
  if (/^\/facturas\/\d+/.test(pathname))                      return help['/facturas/:id']                     ?? null;
  if (/^\/proveedores\/\d+/.test(pathname))                   return help['/proveedores/:id']                  ?? null;

  return null;
}

// ── Búsqueda ─────────────────────────────────────────────────────────────────

export interface HelpSearchResult {
  ruta:       string; // clave de `help` — puede tener ":id", se resuelve en HelpPanel
  pageTitulo: string;
  section:    HelpSection;
}

function contenidoATexto(contenido: HelpSection['contenido']): string {
  if (typeof contenido === 'string') return contenido;
  return contenido.map(t => (typeof t === 'string' ? t : t.texto)).join('');
}

function normalizar(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(new RegExp('[\\u0300-\\u036f]', 'g'), '');
}

// Busca en título/contenido de TODAS las secciones de TODAS las páginas
// (no sólo la página actual) — el buscador del panel de ayuda es global,
// como un mini-helpdesk, no un filtro de la página en la que estás parado.
export function searchHelp(query: string): HelpSearchResult[] {
  const q = normalizar(query.trim());
  if (!q) return [];

  const resultados: HelpSearchResult[] = [];
  for (const [ruta, content] of Object.entries(help)) {
    for (const section of content.secciones) {
      const haystack = normalizar(`${content.titulo} ${section.titulo} ${contenidoATexto(section.contenido)}`);
      if (haystack.includes(q)) resultados.push({ ruta, pageTitulo: content.titulo, section });
    }
  }
  return resultados;
}
