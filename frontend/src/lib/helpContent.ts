export interface HelpLink {
  label:   string;
  ruta?:   string;   // navegar con useNavigate
  accion?: string;   // disparar window.dispatchEvent('help:<accion>')
}

export interface HelpSection {
  titulo:    string;
  contenido: string;
}

export interface HelpContent {
  titulo:      string;
  descripcion?: string;
  secciones:   HelpSection[];
  links?:      HelpLink[];
}

const help: Record<string, HelpContent> = {

  // ── Dashboard ───────────────────────────────────────────────────────────────
  '/dashboard': {
    titulo: 'Dashboard',
    descripcion: 'Vista consolidada de todos los eventos activos.',
    secciones: [
      {
        titulo: '¿Qué muestra el dashboard?',
        contenido: 'Resumen financiero de todos los eventos activos: ingresos, egresos, saldo neto y alertas de echeqs próximos a vencer o rechazados.',
      },
      {
        titulo: 'Alertas',
        contenido: 'Las alertas de nivel ERROR (en rojo) requieren atención inmediata. Las de tipo WARNING (en amarillo) son avisos informativos.',
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
        contenido: 'Egresos (5 tabs), Ingresos (5 tabs), Caja, Conciliatoria, Echeqs y Facturas.',
      },
      {
        titulo: 'Egresos e ingresos',
        contenido: 'Cada fila representa un movimiento. Podés agregar, editar o eliminar filas. El saldo se recalcula automáticamente.',
      },
      {
        titulo: 'Conciliatoria',
        contenido: 'Resume el total de ingresos menos egresos y calcula el saldo final con la distribución entre socios configurada.',
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
        contenido: 'Creá y gestioná usuarios. Roles disponibles: ADMIN (acceso total), OPERADOR (puede editar), VIEWER (solo lectura).',
      },
    ],
  },

};

// ── Routing ──────────────────────────────────────────────────────────────────

export function getHelpContent(pathname: string): HelpContent | null {
  if (help[pathname]) return help[pathname];

  // Event sub-paths — orden de más específico a menos
  if (/^\/eventos\/\d+\/vincular-proveedores/.test(pathname)) return help['/eventos/:id/vincular-proveedores'] ?? null;
  if (/^\/eventos\/\d+\/egresos/.test(pathname))              return help['/eventos/:id/egresos']              ?? null;
  if (/^\/eventos\/\d+\/ingresos/.test(pathname))             return help['/eventos/:id/ingresos']             ?? null;
  if (/^\/eventos\/\d+\/caja/.test(pathname))                 return help['/eventos/:id/caja']                 ?? null;
  if (/^\/eventos\/\d+\/conciliatoria/.test(pathname))        return help['/eventos/:id/conciliatoria']        ?? null;
  if (/^\/eventos\/\d+/.test(pathname))                       return help['/eventos/:id']                      ?? null;
  if (/^\/facturas\/\d+/.test(pathname))                      return help['/facturas/:id']                     ?? null;

  return null;
}
