export interface HelpLink {
  label:  string;
  to:     string;
}

export interface HelpSection {
  title: string;
  body:  string;
  links?: HelpLink[];
}

export interface HelpContent {
  title:    string;
  sections: HelpSection[];
}

const help: Record<string, HelpContent> = {
  '/dashboard': {
    title: 'Dashboard',
    sections: [
      {
        title: '¿Qué muestra el dashboard?',
        body:  'Resumen financiero de todos los eventos activos: ingresos, egresos, saldo neto y alertas de echeqs próximos a vencer o rechazados.',
      },
      {
        title: 'Alertas',
        body:  'Las alertas de nivel ERROR (en rojo) requieren atención inmediata. Las WARNING (en amarillo) son avisos informativos.',
        links: [{ label: 'Ver echeqs', to: '/eventos' }],
      },
    ],
  },
  '/eventos': {
    title: 'Eventos',
    sections: [
      {
        title: '¿Qué es un evento?',
        body:  'Cada evento representa un proyecto con su propio flujo de caja: ingresos, egresos, caja, echeqs y conciliatoria.',
      },
      {
        title: 'Estados',
        body:  'ACTIVO: en curso. CERRADO: finalizado. IMPORTADO: cargado desde Excel.',
      },
      {
        title: 'Crear un evento',
        body:  'Usá el botón "Nuevo evento" arriba a la derecha. Podés configurar socios y porcentajes de distribución.',
      },
    ],
  },
  '/eventos/:id': {
    title: 'Detalle de evento',
    sections: [
      {
        title: 'Pestañas disponibles',
        body:  'Egresos (5 tabs), Ingresos (5 tabs), Caja, Conciliatoria, Echeqs, Stock y Facturas.',
      },
      {
        title: 'Egresos e ingresos',
        body:  'Cada fila representa un movimiento. Podés agregar, editar o eliminar filas. El saldo se recalcula automáticamente.',
      },
      {
        title: 'Conciliatoria',
        body:  'Resume el total de ingresos menos egresos y calcula el saldo final con la distribución entre socios configurada.',
      },
    ],
  },
  '/eventos/:id/vincular-proveedores': {
    title: 'Vincular proveedores',
    sections: [
      {
        title: '¿Qué hace esta pantalla?',
        body:  'Después de importar un Excel, los movimientos no tienen proveedor asignado. Acá podés vincular cada concepto a un proveedor existente o crear uno nuevo.',
      },
      {
        title: 'Cómo funciona',
        body:  'Cada tarjeta agrupa movimientos con el mismo concepto. Seleccioná un proveedor del buscador o marcá "Crear proveedor" para generarlo automáticamente.',
      },
    ],
  },
  '/facturas': {
    title: 'Cuentas a pagar',
    sections: [
      {
        title: '¿Qué es una factura?',
        body:  'Representa una obligación de pago con un proveedor. Puede tener un PDF adjunto y se puede aprobar, pagar y anular.',
      },
      {
        title: 'Estados',
        body:  'RECIBIDA → APROBADA → PAGADA. Una factura ANULADA no puede pagarse. Una PAGADA no puede anularse.',
      },
      {
        title: 'Egreso automático',
        body:  'Si la factura tiene un "Tab de egreso" configurado, al registrar un pago se crea automáticamente un movimiento de egreso en esa tab.',
        links: [{ label: 'Ver facturas', to: '/facturas' }],
      },
    ],
  },
  '/facturas/:id': {
    title: 'Detalle de factura',
    sections: [
      {
        title: 'Pagos',
        body:  'Podés registrar múltiples pagos parciales. Cada pago puede ser por transferencia, efectivo, cheque o echeq.',
      },
      {
        title: 'Pagos con Echeq',
        body:  'Si el medio de pago es ECHEQ, el sistema crea automáticamente un echeq vinculado. No podés anular un pago si el echeq ya fue cobrado.',
      },
      {
        title: 'PDF',
        body:  'El PDF se almacena en la base de datos. Podés visualizarlo en esta pantalla o abrirlo en una nueva pestaña.',
      },
    ],
  },
  '/proveedores': {
    title: 'Proveedores',
    sections: [
      {
        title: '¿Qué es un proveedor?',
        body:  'Entidad o persona con quien se tienen transacciones. Se puede vincular a movimientos, echeqs y facturas.',
      },
      {
        title: 'Búsqueda anti-duplicados',
        body:  'El sistema busca proveedores existentes por nombre (sin importar mayúsculas) para evitar duplicados.',
      },
    ],
  },
  '/stock': {
    title: 'Stock',
    sections: [
      {
        title: '¿Qué gestiona el stock?',
        body:  'Productos asignables a eventos. Controlá disponibilidad, movimientos y alertas de quiebre.',
      },
      {
        title: 'Alertas de quiebre',
        body:  'Un quiebre actual significa que el stock disponible ya está por debajo del mínimo. Un quiebre proyectado significa que lo estará en función de las asignaciones futuras.',
      },
    ],
  },
  '/importer': {
    title: 'Importar Excel',
    sections: [
      {
        title: '¿Cómo importar?',
        body:  'Seleccioná el archivo Excel (el mismo formato del template Flujo de Caja Genérico) y elegí el evento de destino.',
      },
      {
        title: 'Después de importar',
        body:  'Los movimientos se crean sin proveedor. El sistema te redirige a la pantalla de vinculación de proveedores.',
        links: [{ label: 'Ver eventos', to: '/eventos' }],
      },
    ],
  },
  '/auditoria': {
    title: 'Auditoría',
    sections: [
      {
        title: '¿Qué registra la auditoría?',
        body:  'Cada operación relevante (crear, editar, eliminar, aprobar, anular) queda registrada con fecha, usuario, entidad afectada y datos antes/después.',
      },
      {
        title: 'Filtros',
        body:  'Podés filtrar por usuario, tipo de acción, entidad o evento. El período máximo por consulta es de 90 días.',
      },
    ],
  },
  '/configuracion': {
    title: 'Configuración',
    sections: [
      {
        title: 'Tabs de egresos e ingresos',
        body:  'Configurá los nombres de las 5 pestañas de egreso (EG-TC, EG-SOC, etc.) y las 5 de ingreso. Los cambios afectan a todos los eventos.',
      },
      {
        title: 'Usuarios',
        body:  'Creá y gestioná usuarios. Roles disponibles: ADMIN (acceso total), OPERADOR (puede editar), VIEWER (solo lectura).',
      },
    ],
  },
};

export function getHelpContent(pathname: string): HelpContent | null {
  // Exact match
  if (help[pathname]) return help[pathname];

  // Pattern match: /eventos/:id and sub-routes
  if (/^\/eventos\/\d+\/vincular-proveedores/.test(pathname)) return help['/eventos/:id/vincular-proveedores'] ?? null;
  if (/^\/eventos\/\d+/.test(pathname))                        return help['/eventos/:id'] ?? null;
  if (/^\/facturas\/\d+/.test(pathname))                       return help['/facturas/:id'] ?? null;

  return null;
}
