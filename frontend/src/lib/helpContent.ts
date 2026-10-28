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
        contenido: 'Elegí la pestaña del rubro correspondiente → click en + al final de la tabla → completar fecha, concepto, descripción → el monto va en la columna HABER → al salir de la celda se guarda automáticamente. El saldo se recalcula solo — no es editable.',
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
        titulo: 'Pedido técnico',
        contenido: 'Cada rubro puede tener uno o más ítems de pedido (cantidad, material, días de uso, horarios de llegada y retiro). Hacé clic en "Pedido" para expandir y cargar el detalle — se guarda automáticamente al salir de cada campo.',
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
        contenido: 'Resumen, Ficha, Producción, Egresos (por rubro), Ingresos, Caja, Stock, Comidas, Facturas a Pagar, Facturas a Cobrar, Auditoría. Para eventos informales: Resumen, Caja, Stock, Comidas.',
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
    ],
  },

  // ── Facturas a Cobrar (facturas emitidas a clientes) ───────────────────────
  '/facturas-emitidas': {
    titulo: 'Facturas a Cobrar',
    descripcion: 'Registrá todas las facturas que emitís a tus clientes y seguí el estado de cobro de cada una.',
    secciones: [
      {
        titulo: '¿Para qué sirve?',
        contenido: 'Registrá todas las facturas que emitís a tus clientes y seguí el estado de cobro de cada una. Podés registrar cobros parciales — el sistema actualiza el estado automáticamente (Emitida → Cobrada parcial → Cobrada). Si una factura corresponde a un evento, vinculala para tener todo centralizado.',
      },
      {
        titulo: 'Vencimientos',
        contenido: 'Las facturas vencidas sin cobrar aparecen en el Calendario y en las notificaciones.',
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
    ],
  },

  // ── Calendario ───────────────────────────────────────────────────────────────
  '/calendario': {
    titulo: 'Calendario',
    descripcion: 'Vista centralizada de todos los vencimientos y eventos del sistema.',
    secciones: [
      {
        titulo: '¿Qué muestra?',
        contenido: 'Vista centralizada de todos los vencimientos y eventos del sistema: seguros, RTO/ITV, carnets de conducir, multas, controles de salida pendientes, patentes, cuotas AFIP, créditos, facturas y más. Filtrá por tipo con los badges de colores. Lo vencido aparece en rojo y lo que vence pronto en amarillo.',
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
        contenido: 'Creá, renombrá, reordená (arrastrando) o desactivá los rubros de egresos e ingresos de tu empresa. Cada rubro activo aparece como una pestaña en todos los eventos. Los rubros del sistema no se pueden eliminar ni desactivar.',
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
