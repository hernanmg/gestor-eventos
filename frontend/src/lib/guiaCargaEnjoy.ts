// Guía de carga de datos de Enjoy: en qué orden se suben las planillas al
// sistema. La ve la página /guia-carga y es el primer ítem del panel de Ayuda.
// Mantener en sincronía con el documento "Carga de datos de Enjoy — paso a paso".

export interface FilaGuia {
  id:        string;  // estable: se usa para guardar el tilde en el navegador
  que:       string;
  planilla?: string;
  donde:     string;
  ruta?:     string;  // pantalla a la que lleva el link
  revisar:   string;
}

export interface PasoGuia {
  id:      string;
  titulo:  string;
  intro?:  string;
  filas?:  FilaGuia[];      // tabla de carga
  tareas?: FilaGuia[];      // lista de chequeo sin planilla
  nota?:   string;
}

export const GUIA_INTRO =
  'Las planillas de Enjoy se cargan en este orden: base, eventos, operativo de cada evento y plata. ' +
  'Cada paso necesita lo anterior: la ficha, las facturas y el libro de compras buscan a los proveedores por nombre o por CUIT, ' +
  'y la ficha, las comidas, las cortesías y las facturas se cuelgan de un evento que ya tiene que existir. ' +
  'Cada planilla se importa con vista previa (primero se ve qué entra y después se confirma) y reimportar el mismo archivo no duplica nada.';

export const GUIA_PASOS: PasoGuia[] = [
  {
    id: 'p0',
    titulo: 'Paso 0 — Antes de empezar',
    tareas: [
      { id: '0.1', que: 'Usuario propio, con la contraseña ya cambiada', donde: 'Configuración → Usuarios', ruta: '/configuracion', revisar: 'Male es ADMIN en Enjoy: puede cargar todo.' },
      { id: '0.2', que: 'Datos de la empresa: logo, razón social y CUIT', donde: 'Configuración de la empresa', ruta: '/configuracion/empresa', revisar: '' },
      { id: '0.3', que: 'Cuentas bancarias: Galicia, Francés, Nación, Rebanking y Bancor', donde: 'Caja Global', ruta: '/caja', revisar: 'Bancor la lleva Chino.' },
      { id: '0.4', que: 'Saldo inicial de cada cuenta a una fecha de corte', donde: 'Caja Global', ruta: '/caja', revisar: 'Pedirlo a Male o a May.' },
      { id: '0.5', que: 'Copia de seguridad de la base antes de importar', donde: 'Soporte técnico', revisar: '' },
    ],
  },
  {
    id: 'p1',
    titulo: 'Paso 1 — Datos base',
    intro: 'Lo primero son los proveedores: si faltan, la ficha y las facturas se importan igual, pero el nombre del proveedor queda solo en las notas.',
    filas: [
      { id: '1.1', que: 'Proveedores y jornaleros', planilla: 'Exportación actualizada del formulario de Google (Proveedores - Datos)', donde: 'Proveedores → Importar desde formulario', ruta: '/proveedores', revisar: 'Duplicados por DNI o CUIT, proveedores sin CUIT válido, los "A o C según el evento".' },
      { id: '1.2', que: 'Proveedores que no llenaron el formulario', donde: 'Proveedores → Nuevo', ruta: '/proveedores', revisar: 'Los que se usan siempre. "ENJOY", "CANJE" y "DOS 57" aparecen en la ficha como proveedor y no lo son.' },
      { id: '1.3', que: 'Stock del depósito', planilla: 'STOCK DE DEPOSITO ENJOY (último conteo)', donde: 'Stock → Importar catálogo', ruta: '/stock', revisar: 'Un producto por espacio (Depo 1, Depo 2, Altillo…). Tanque y Depo Administración no tienen conteo de enero.' },
      { id: '1.4', que: 'Horas y vales (histórico)', planilla: 'HORAS Y VALES de cada mes', donde: 'RRHH → Importar', ruta: '/rrhh/importar', revisar: 'Pedir los meses que haya además de marzo.' },
      { id: '1.5', que: 'Personal fijo', planilla: 'A definir', donde: 'RRHH → Empleados', ruta: '/rrhh', revisar: 'Si entra en esta prueba y con qué archivo.' },
      { id: '1.6', que: 'Uniformes', planilla: 'Planilla de uniformes de Enjoy', donde: 'Uniformes → Importar', ruta: '/uniformes', revisar: 'Todavía no la pasaron.' },
    ],
  },
  {
    id: 'p2',
    titulo: 'Paso 2 — Eventos',
    intro: 'Los eventos grandes (TC, Lecap, Monster) se llevan con flujo de caja completo; el resto, con centro de costos. Los eventos que ya estaban en el sistema quedaron como flujo de caja: los chicos hay que pasarlos a centro de costos a mano.',
    filas: [
      { id: '2.1', que: 'Lista de eventos', donde: '—', revisar: 'Armarla con Male: realizados y próximos, y cuál es grande.' },
      { id: '2.2', que: 'Eventos grandes', planilla: 'Flujo de caja de cada evento', donde: 'Importar eventos históricos', ruta: '/importer', revisar: 'Pedir los flujos reales: hoy solo está la plantilla genérica.' },
      { id: '2.3', que: 'Eventos chicos', donde: 'Eventos → Nuevo (Pre-Macro)', ruta: '/eventos', revisar: 'Nombre, fechas, lugar, cliente, días de montaje y desmontaje.' },
      { id: '2.4', que: 'Ficha de rubros', planilla: 'rubro por evento v2 · Control de Rubros Enjoy', donde: 'Evento → Ficha → Importar', ruta: '/eventos', revisar: 'Genera las líneas del centro de costos. Ver rubros sin proveedor.' },
      { id: '2.5', que: 'Centro de costos', planilla: 'KM - Centro de Costos', donde: 'Evento → Centro de costos → Importar planilla KM', ruta: '/eventos', revisar: 'Costos, RRHH y Extras con vista previa; las hojas de Acciones no se importan. Elegir rubro para las líneas que no se reconocen. En la de KM el TOTAL de Costos no coincide con las filas (Basani repetido en 3 líneas).' },
      { id: '2.6', que: 'Extras (los paga el cliente)', planilla: 'Hoja Extras del KM', donde: 'Centro de costos → Extras', ruta: '/eventos', revisar: 'Entran con el importador del punto 2.5.' },
      { id: '2.7', que: 'Cortesías', planilla: 'Cortesías - Male', donde: 'Evento → Cortesías → Importar', ruta: '/eventos', revisar: 'Casi todas quedan sin vincular a Njuko: se asocian a mano.' },
      { id: '2.8', que: 'Proveedores faltantes', donde: 'Evento → Vincular proveedores', ruta: '/eventos', revisar: 'Movimientos que llegaron sin proveedor.' },
    ],
  },
  {
    id: 'p3',
    titulo: 'Paso 3 — Parte operativa de cada evento',
    intro: 'Toda la parte operativa se carga dentro de cada evento, así que el evento tiene que estar creado (paso 2).',
    filas: [
      { id: '3.1', que: 'Pedidos a proveedores', planilla: 'Festival KM - Pedidos de material · Fiesta de la Pelota - Ficha de evento · Control de Rubros de Expo', donde: 'Evento → Ficha → Importar pedidos', ruta: '/eventos', revisar: 'Lee los tres formatos. Rubros con nombre parecido se unen ("Handieman" = "Handyeman").' },
      { id: '3.2', que: 'Seguridad por turnos', planilla: 'SEGURIDAD FESTIVAL KM', donde: 'Ficha → Seguridad privada → Importar esquema', ruta: '/eventos', revisar: 'Turnos y personas por día.' },
      { id: '3.3', que: 'Producción', planilla: 'Planilla Producción Expo Village', donde: 'Evento → Producción → Importar planilla', ruta: '/eventos', revisar: 'Cronograma, espacios, internet, branding y compras. Las compras no generan gasto: entran por tarjeta o factura.' },
      { id: '3.4', que: 'Rubros, estructuras y seguridad de Producción', planilla: 'La misma planilla de Producción', donde: 'Ficha → Importar pedidos', ruta: '/eventos', revisar: 'Mismo archivo que 3.3, cargado desde la ficha.' },
      { id: '3.5', que: 'Comidas y viandas', planilla: "Fiesta de la Pelota - Control de Viandas · L'ETAPE - Control de comidas", donde: 'Evento → Comidas → Importar planilla', ruta: '/eventos', revisar: 'Los días con voucher no entran. Las fórmulas rotas se marcan en la vista previa.' },
      { id: '3.6', que: 'Limpieza', planilla: 'Hojas LIMPIEZA y ESQUEMA DE LIMPIEZA (Festival KM)', donde: 'Con la ficha (3.1)', ruta: '/eventos', revisar: 'Las dos hojas no coinciden: el sistema da 168 h y el esquema 152 h.' },
      { id: '3.7', que: 'Novedades del evento', donde: 'Evento → Novedades', ruta: '/novedades', revisar: 'Se cargan a mano, con foto, desde el celular.' },
    ],
    nota: "Diferencias conocidas, que son de la planilla y no del sistema: en las comidas de la Pelota (semana 1, fila 19) la fórmula apunta a una celda vacía y la planilla suma $ 166.400 menos. En L'Etape, el almuerzo de Fortunato del 16/03 no tiene costo y la cena de HAKA del 19/03 no tiene cantidad.",
  },
  {
    id: 'p4',
    titulo: 'Paso 4 — Plata',
    intro: 'La plata va al final, porque las facturas y las cajas se vinculan a proveedores y eventos que ya tienen que estar cargados.',
    filas: [
      { id: '4.1', que: 'Cajas chicas (histórico)', planilla: 'CAJAS 2026, versión actualizada', donde: 'Caja Global → Importar cajas chicas', ruta: '/caja', revisar: 'Cada rendición queda como una caja cerrada. La de Dani de abril (3) no cierra por $ 39.000.' },
      { id: '4.2', que: 'Cajas chicas nuevas', donde: 'Caja Global → Nueva caja', ruta: '/caja', revisar: 'Quién la rinde y quién la cierra.' },
      { id: '4.3', que: 'Libro de compras de AFIP', planilla: 'FACTURAS <MES> ENJOY, todos los meses', donde: 'Facturas a pagar → Importar libro de compras', ruta: '/facturas', revisar: 'Facturas sin evento o sin proveedor, y las de más de $ 500.000 sin PDF.' },
      { id: '4.4', que: 'Facturas a clientes', donde: 'Facturas emitidas', ruta: '/facturas-emitidas', revisar: 'A mano: todavía no hay importador de comprobantes emitidos.' },
      { id: '4.5', que: 'Tarjeta corporativa', planilla: 'Tarjeta Corporativa ENJOY 2026 (la arma Santi)', donde: 'Tarjeta Corp. → Importar', ruta: '/tarjeta-corporativa', revisar: 'Acordar que los gastos se carguen a medida que llegan, no por WhatsApp.' },
      { id: '4.6', que: 'Resumen semanal de pagos', planilla: 'A confirmar', donde: 'Gastos del mes → Pagos semanales', ruta: '/gastos-operativos', revisar: 'Si lo arma Male y si Matías lo aprueba línea por línea.' },
    ],
  },
  {
    id: 'p5',
    titulo: 'Paso 5 — Preguntas abiertas',
    tareas: [
      { id: '5.1', que: 'Flujos de caja reales de Festival KM, la Pelota y Expo Village', donde: '', revisar: '' },
      { id: '5.2', que: 'Planilla KM - Centro de Costos de otros eventos, además de KM', donde: '', revisar: '' },
      { id: '5.3', que: '¿Quién arma el resumen semanal de pagos?', donde: '', revisar: '' },
      { id: '5.4', que: 'Planilla de uniformes de Enjoy', donde: '', revisar: '' },
      { id: '5.5', que: 'Los 4 vehículos de Enjoy (papeles de May): ¿ahora o más adelante?', donde: '', revisar: '' },
      { id: '5.6', que: 'Fecha de corte para los saldos iniciales', donde: '', revisar: '' },
      { id: '5.7', que: '¿Hay algún Excel o grupo de WhatsApp que no esté en esta lista?', donde: '', revisar: '' },
    ],
  },
  {
    id: 'p6',
    titulo: 'Paso 6 — Al terminar',
    tareas: [
      { id: '6.1', que: 'Anotar lo que no cerró contra el Excel y si la diferencia es de la planilla o del sistema', donde: '', revisar: '' },
      { id: '6.2', que: 'Sumar lo que haya surgido como pedido nuevo', donde: '', revisar: '' },
      { id: '6.3', que: 'Elegir el evento real que se trabaja desde cero en el sistema', donde: '', revisar: '' },
    ],
  },
];
