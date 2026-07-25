// Espejo de los enums del schema Prisma

export type Rol           = 'ADMIN' | 'OPERADOR' | 'VIEWER';
export type EstadoFactura = 'RECIBIDA' | 'APROBADA' | 'PAGADA' | 'ANULADA';
export type MedioPago     = 'TRANSFERENCIA' | 'ECHEQ' | 'EFECTIVO' | 'CHEQUE';
export type CondicionPago = 'CONTADO' | 'DIAS_30' | 'DIAS_60' | 'DIAS_90' | 'ECHEQ' | 'OTRO';
export type Tipo         = 'EGRESO' | 'INGRESO';
export type EstadoEvento = 'ACTIVO' | 'CERRADO' | 'IMPORTADO';
export type TipoCuenta   = 'EFECTIVO' | 'BANCO';
export type EstadoEcheq  = 'PENDIENTE' | 'COBRADO' | 'RECHAZADO';
export type Moneda       = 'ARS' | 'USD';
export type CategoriaEmpleado = 'CAPITAN' | 'ARMADOR' | 'CHOFER' | 'ADMINISTRATIVO' | 'TECNICO' | 'OTRO';
export type EstadoEmpleado    = 'ACTIVO' | 'INACTIVO' | 'SUSPENDIDO';
export type EstadoJornada     = 'PENDIENTE' | 'APROBADA' | 'RECHAZADA';
export type EstadoLiquidacion = 'BORRADOR' | 'APROBADA' | 'PAGADA' | 'CANCELADA';
export type TipoAnticipo      = 'ADELANTO' | 'VALE' | 'DESCUENTO';
export type EstadoMovimiento  = 'PENDIENTE' | 'COTIZANDO' | 'CONFIRMADO' | 'PAGADO' | 'CANCELADO';

// ── Usuarios ──────────────────────────────────────────────────────────────────

export interface Usuario {
  id:         number;
  email:      string;
  nombre:     string;
  rol:        Rol;
  activo:     boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

// ── Proveedores ───────────────────────────────────────────────────────────────

export interface Proveedor {
  id:         number;
  nombre:     string;
  alias:      string | null;
  cuit:       string | null;
  categoria:  string | null;
  notas:      string | null;
  activo:     boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  created_by: number | null;
  updated_by: number | null;
}

export interface ProveedorBusqueda {
  id:        number;
  nombre:    string;
  alias:     string | null;
  cuit:      string | null;
  categoria: string | null;
}

// ── Configuración de pestañas ─────────────────────────────────────────────────

export interface TabConfig {
  id:         number;
  tipo:       Tipo;
  numero:     number;
  nombre:     string;
  codigo:     string;
  orden:      number;
  activo:     boolean;
  es_sistema: boolean;
}

// ── Rubros (categorías configurables de egresos/ingresos) ─────────────────────

export interface Rubro {
  id:          number;
  tipo:        Tipo;
  nombre:      string;
  codigo:      string | null;
  descripcion: string | null;
  orden:       number;
  activo:      boolean;
  es_sistema:  boolean;
  created_at:  string;
  updated_at:  string;
}

// ── Eventos ───────────────────────────────────────────────────────────────────

export interface Socio {
  nombre:     string;
  porcentaje: number;
}

export interface Evento {
  id:           number;
  nombre:       string;
  fecha_inicio: string | null;
  fecha_fin:    string | null;
  estado:       EstadoEvento;
  socios:       Socio[];
  moneda_base:  Moneda;
  created_at:   string;
  updated_at:   string;
  deleted_at:   string | null;
  created_by:   number | null;
  updated_by:   number | null;
}

export interface EventoWithCount extends Evento {
  movimiento_count: number;
}

export interface EventoPayload {
  nombre:       string;
  fecha_inicio: string | null;
  fecha_fin:    string | null;
  socios:       Socio[];
  moneda_base:  Moneda;
}

// ── Movimientos ───────────────────────────────────────────────────────────────

export interface Movimiento {
  id:                    number;
  evento_id:             number;
  tipo:                  Tipo;
  tab_numero:            number | null; // legado — RRHH / Facturas
  rubro_id:              number | null;
  rubro:                 { id: number; nombre: string; tipo: Tipo; codigo: string | null } | null;
  estado_movimiento:     EstadoMovimiento;
  presupuesto:           number | null;
  costo_real:            number | null;
  responsable_id:        number | null;
  responsable:           { id: number; nombre: string; email: string } | null;
  fecha_pago:            string | null;
  avisado_proveedor:     boolean;
  fecha:                 string | null;
  concepto:              string | null;
  descripcion:           string | null;
  debe:                  number;
  haber:                 number;
  saldo:                 number; // calculado por el backend
  moneda:                Moneda;
  orden:                 number;
  impuesto_subcategoria: string | null;
  proveedor_id:          number | null;
  proveedor:             ProveedorBusqueda | null;
  movimiento_caja_id:    number | null;
  created_at:            string;
  updated_at:            string;
  deleted_at:            string | null;
  created_by:            number | null;
  updated_by:            number | null;
}

export interface ResumenRubro {
  rubro_id:             number;
  rubro_nombre:         string;
  tipo:                 Tipo;
  presupuesto_total:    number;
  costo_real_total:     number;
  diferencia:           number;
  diferencia_pct:       number;
  cantidad_movimientos: number;
  estados:              Record<EstadoMovimiento, number>;
}

export interface ResumenMovimientos {
  por_rubro:      ResumenRubro[];
  total_ingresos: number;
  total_egresos:  number;
  saldo:          number;
}

// ── Vista Macro (cross-evento, cross-empresa) ──────────────────────────────────

export interface MovimientoMacro {
  id:                 number;
  evento_id:          number;
  evento_nombre:      string | null;
  evento_estado:      EstadoEvento | null;
  empresa_id:         number | null;
  empresa_nombre:     string | null;
  tipo:               Tipo;
  rubro_id:           number | null;
  rubro_nombre:       string | null;
  fecha:              string | null;
  concepto:           string | null;
  descripcion:        string | null;
  debe:               number;
  haber:              number;
  saldo:              number;
  presupuesto:        number | null;
  costo_real:         number | null;
  estado_movimiento:  EstadoMovimiento;
  responsable_id:     number | null;
  responsable_nombre: string | null;
  proveedor_id:       number | null;
  proveedor_nombre:   string | null;
  avisado_proveedor:  boolean;
  fecha_pago:         string | null;
  moneda:             Moneda;
  created_at:         string;
}

export interface MacroTotalPorEmpresa {
  empresa_id:         number;
  empresa_nombre:     string;
  total_debe:         number;
  total_haber:        number;
  total_egresos:      number;
  total_ingresos:     number;
  total_presupuesto:  number;
  saldo:              number;
}

export interface MacroTotalPorRubro {
  rubro_id:     number;
  rubro_nombre: string;
  total_debe:   number;
  total_haber:  number;
}

export interface MacroTotales {
  total_debe:        number;
  total_haber:       number;
  total_egresos:     number;
  total_ingresos:    number;
  saldo:             number;
  total_presupuesto: number;
  total_costo_real:  number;
  por_empresa:       MacroTotalPorEmpresa[];
  por_rubro:         MacroTotalPorRubro[];
  por_estado:        Record<EstadoMovimiento, number>;
}

export interface MacroResponse {
  data:       MovimientoMacro[];
  pagination: { total: number; page: number; limit: number; totalPages: number };
  totales:    MacroTotales;
}

export interface MacroFiltros {
  empresa_id?:         number;
  evento_id?:          number;
  rubro_id?:           number;
  tipo?:               Tipo;
  estado?:             EstadoMovimiento;
  responsable_id?:     number;
  proveedor_id?:       number;
  desde?:              string;
  hasta?:              string;
  con_presupuesto?:    boolean;
  avisado_proveedor?:  boolean;
  page?:               number;
  limit?:              number;
  sort?:               'fecha' | 'monto' | 'rubro';
  order?:              'asc' | 'desc';
}

// ── Caja ──────────────────────────────────────────────────────────────────────

export interface CuentaBancaria {
  id:            number;
  evento_id:     number;
  nombre:        string;
  tipo:          TipoCuenta;
  moneda:        Moneda;
  saldo_inicial: number;
  created_at:    string;
  updated_at:    string;
  deleted_at:    string | null;
}

export interface MovimientoOrigen {
  id:                number;
  tipo:              Tipo;
  tab_numero:        number | null;
  tab_codigo:        string | null;
  concepto:          string | null;
  rubro_id:          number | null;
  rubro_nombre:      string | null;
  estado_movimiento: EstadoMovimiento | null;
}

export interface MovimientoCaja {
  id:                   number;
  cuenta_id:            number;
  fecha:                string | null;
  descripcion:          string | null;
  debe:                 number;
  haber:                number;
  saldo_corriente:      number; // calculado por el backend
  orden:                number;
  transferencia_par_id: number | null;
  movimiento_origen:    MovimientoOrigen | null;
  created_at:           string;
  updated_at:           string;
  deleted_at:           string | null;
  created_by:           number | null;
  updated_by:           number | null;
}

export interface PosicionCuenta {
  cuenta_id:            number;
  nombre:               string;
  tipo:                 TipoCuenta;
  saldo_inicial:        number;
  saldo_actual:         number;
  total_debe:           number;
  total_haber:          number;
  cantidad_movimientos: number;
}

export interface PosicionMoneda {
  moneda:               Moneda;
  cuentas:              PosicionCuenta[];
  saldo_total:          number;
  total_transferencias: number;
}

export interface PosicionConsolidada {
  evento_id:  number;
  por_moneda: PosicionMoneda[];
}

// ── Echeqs ────────────────────────────────────────────────────────────────────

export interface Echeq {
  id:                    number;
  evento_id:             number;
  movimiento_id:         number | null;
  movimiento_caja_id:    number | null;
  proveedor_id:          number | null;
  numero:                string;
  razon_social:          string | null;
  detalle:               string | null;
  importe:               number;
  moneda:                Moneda;
  estado:                EstadoEcheq;
  motivo_rechazo:        string | null;
  fecha_emision:         string | null;
  fecha_cobro_estimada:  string | null;
  fecha_cobro_real:      string | null;
  dias_para_vencimiento: number | null;
  created_at:            string;
  updated_at:            string;
  deleted_at:            string | null;
  created_by:            number | null;
  updated_by:            number | null;
}

export interface AlertasEcheqs {
  vencidos:      Echeq[];
  vencen_pronto: Echeq[];
}

// ── Stock ─────────────────────────────────────────────────────────────────────

export type UbicacionStock   = 'DEPOSITO' | 'EN_TRANSITO' | 'EN_EVENTO' | 'EXCEDENTE' | 'ALQUILADO' | 'BAJA';
export type EstadoAsignacion = 'ACTIVA' | 'TRANSFERIDA' | 'DEVUELTA' | 'CANCELADA';
export type OrigenTransfer   = 'DEPOSITO' | 'EVENTO';
export type TipoAlertaStock  = 'QUIEBRE_ACTUAL' | 'QUIEBRE_PROYECTADO';
export type RiesgoSugerencia = 'BAJO' | 'MEDIO' | 'ALTO';

export interface CategoriaStock {
  id:              number;
  nombre:          string;
  descripcion:     string | null;
  color:           string | null;
  activo:          boolean;
  created_at:      string;
  updated_at:      string;
  deleted_at:      string | null;
  productos_count?: number;
}

export interface Producto {
  id:              number;
  nombre:          string;
  descripcion:     string | null;
  categoria_id:    number | null;
  categoria:       CategoriaStock | null;
  codigo_interno:  string | null;
  codigo_externo:  string | null;
  nombre_tecnico:  string | null;
  nombre_interno:  string | null;
  tiene_foto:      boolean;
  valor_unitario:  string | null;
  es_critico:      boolean;
  catalogo_origen: string | null;
  stock_total:     number;
  stock_minimo:    number;
  unidad:          string;
  notas:           string | null;
  activo:          boolean;
  created_at:      string;
  updated_at:      string;
  deleted_at:      string | null;
  // augmented by listProductos
  comprometido_hoy?: number;
  disponible_hoy?:   number;
  // included in getProducto detail
  asignaciones?: AsignacionStock[];
  movimientos?:  MovimientoStock[];
  cunas?:        { cantidad: number; cuna: { id: number; codigo: string; descripcion: string | null } }[];
}

export interface AsignacionStock {
  id:                  number;
  producto_id:         number;
  evento_id:           number;
  cantidad:            number;
  fecha_salida:        string;
  fecha_retorno:       string | null;
  ubicacion:           UbicacionStock;
  estado:              EstadoAsignacion;
  origen:              OrigenTransfer;
  evento_origen_id:    number | null;
  notas:               string | null;
  camion_id:           number | null;
  cuna_id:             number | null;
  cantidad_excedente:  number;
  firmado_salida:      boolean;
  firmado_salida_at:   string | null;
  firmado_llegada:     boolean;
  firmado_llegada_at:  string | null;
  firmado_retorno:     boolean;
  firmado_retorno_at:  string | null;
  created_at:          string;
  updated_at:          string;
  deleted_at:          string | null;
  // joined
  producto?:      { id: number; nombre: string; codigo_interno: string | null; codigo_externo?: string | null; categoria: CategoriaStock | null; unidad: string };
  evento_origen?: { id: number; nombre: string } | null;
  evento?:        { id: number; nombre: string; fecha_inicio: string | null; fecha_fin: string | null };
  camion?:        { id: number; codigo: string; descripcion: string | null } | null;
  cuna?:          { id: number; codigo: string; descripcion: string | null } | null;
}

// ── Camiones / Cunas (logística DOS57) ────────────────────────────────────────

export interface Camion {
  id:          number;
  empresa_id:  number;
  codigo:      string;
  descripcion: string | null;
  patente:     string | null;
  tipo:        string | null;
  activo:      boolean;
  created_at:  string;
  updated_at:  string;
}

export interface CunaProducto {
  id:          number;
  cuna_id:     number;
  producto_id: number;
  cantidad:    number;
  producto?:   { id: number; nombre: string; unidad: string; codigo_interno?: string | null };
}

export interface Cuna {
  id:                  number;
  empresa_id:          number;
  codigo:              string;
  descripcion:         string | null;
  activo:              boolean;
  created_at:          string;
  updated_at:          string;
  productos?:          CunaProducto[];
  productos_distintos?: number;
  total_unidades?:     number;
}

// ── Pañol ─────────────────────────────────────────────────────────────────────

export type TipoPanolItem   = 'HERRAMIENTA' | 'CONSUMIBLE';
export type EstadoPanolItem = 'DISPONIBLE' | 'FUERA_DE_SERVICIO' | 'BAJA';
export type TipoMovPanol    = 'SALIDA' | 'DEVOLUCION' | 'USO_INTERNO' | 'BAJA';

export interface PanolItem {
  id:               number;
  empresa_id:       number;
  nombre:           string;
  descripcion:      string | null;
  tipo:             TipoPanolItem;
  stock_total:      number;
  stock_disponible: number;
  valor:            string | null;
  estado:           EstadoPanolItem;
  notas:            string | null;
  created_at:       string;
  updated_at:       string;
  movimientos?:     MovimientoPanol[];
}

export interface MovimientoPanol {
  id:                  number;
  empresa_id:          number;
  panol_item_id:       number;
  tipo:                TipoMovPanol;
  cantidad:            number;
  evento_id:           number | null;
  responsable_id:      number | null;
  responsable_nombre:  string | null;
  fecha:               string;
  descripcion:         string | null;
  cantidad_devuelta:   number | null;
  cantidad_faltante:   number | null;
  motivo_faltante:     string | null;
  devolucion_at:       string | null;
  created_at:          string;
  updated_at:          string;
  // joined
  panol_item?: { id: number; nombre: string; tipo: TipoPanolItem };
  evento?:     { id: number; nombre: string; estado: EstadoEvento } | null;
}

export interface AlertaPanol {
  movimiento_id:      number;
  panol_item_id:      number;
  panol_item_nombre:  string;
  evento_id:          number | null;
  evento_nombre?:     string;
  dias_finalizado:    number | null;
  responsable_id:     number | null;
  responsable_nombre: string | null;
  cantidad_pendiente: number;
  fecha_salida:       string;
}

// ── Activos ───────────────────────────────────────────────────────────────────

export type EstadoActivo = 'BUENO' | 'REGULAR' | 'DETERIORADO' | 'BAJA';

export interface Activo {
  id:            number;
  empresa_id:    number;
  nombre:        string;
  descripcion:   string | null;
  categoria:     string | null;
  numero_serie:  string | null;
  fecha_compra:  string | null;
  valor_compra:  string | null;
  estado:        EstadoActivo;
  ubicacion:     string | null;
  observaciones: string | null;
  created_at:    string;
  updated_at:    string;
}

export interface MovimientoStock {
  id:                number;
  producto_id:       number;
  asignacion_id:     number | null;
  tipo:              string;
  cantidad:          number;
  evento_origen_id:  number | null;
  evento_destino_id: number | null;
  fecha:             string;
  descripcion:       string | null;
  created_at:        string;
}

export interface Disponibilidad {
  producto_id:           number;
  nombre:                string;
  stock_total:           number;
  stock_minimo:          number;
  cantidad_comprometida: number;
  disponible:            number;
  asignaciones_solapadas: {
    asignacion_id: number;
    evento_id:     number;
    evento_nombre: string;
    cantidad:      number;
    fecha_salida:  string;
    fecha_retorno: string | null;
    estado:        EstadoAsignacion;
  }[];
  en_quiebre: boolean;
}

export interface SugerenciaStock {
  asignacion_id:           number;
  evento_origen_id:        number;
  evento_origen_nombre:    string;
  fecha_fin_evento_origen: string | null;
  cantidad_disponible:     number;
  dias_de_margen:          number;
  riesgo:                  RiesgoSugerencia;
}

export interface AlertaStock {
  tipo:                    TipoAlertaStock;
  producto_id:             number;
  producto_nombre:         string;
  categoria:               CategoriaStock | null;
  stock_total:             number;
  stock_minimo:            number;
  disponible_actual:       number;
  fecha_quiebre_proyectado?: string;
  eventos_comprometidos:   {
    evento_id:     number;
    evento_nombre: string;
    cantidad:      number;
    fecha_salida:  string;
    fecha_retorno: string | null;
  }[];
  sugerencias_disponibles: boolean;
}

export interface EventoStockResponse {
  asignaciones: AsignacionStock[];
  prestadas:    AsignacionStock[];
}

// ── EventoAcceso ──────────────────────────────────────────────────────────────

export interface EventoAcceso {
  id:         number;
  usuario_id: number;
  evento_id:  number;
  rol:        Rol;
  created_at: string;
  evento?: {
    id:     number;
    nombre: string;
    estado: EstadoEvento;
  };
}

// ── AuditoriaLog ──────────────────────────────────────────────────────────────

export interface AuditoriaLog {
  id:            number;
  usuario_id:    number | null;
  accion:        string;
  entidad:       string;
  entidad_id:    number | null;
  evento_id:     number | null;
  descripcion:   string;
  datos_antes:   Record<string, unknown> | null;
  datos_despues: Record<string, unknown> | null;
  ip:            string | null;
  created_at:    string;
  usuario?: {
    id:     number;
    nombre: string;
    email:  string;
  } | null;
}

export interface AuditoriaPage {
  total: number;
  page:  number;
  limit: number;
  pages: number;
  data:  AuditoriaLog[];
}

// ── Facturas ──────────────────────────────────────────────────────────────────

export interface Factura {
  id:                number;
  numero_factura:    string;
  tipo_factura:      string;
  fecha_emision:     string;
  fecha_vencimiento: string | null;
  proveedor_id:      number;
  proveedor?:        { id: number; nombre: string; alias: string | null; cuit?: string | null };
  evento_id:         number;
  evento?:           { id: number; nombre: string };
  tab_numero:        number | null;
  rubro_id:          number | null;
  rubro?:            { id: number; nombre: string } | null;
  importe_total:     number;
  importe_pagado:    number;
  importe_pendiente: number;
  moneda:            Moneda;
  condicion_pago:    CondicionPago;
  estado:            EstadoFactura;
  notas:             string | null;
  pdf_nombre:        string | null;
  pdf_tamanio:       number | null;
  created_at:        string;
  updated_at:        string;
  deleted_at:        string | null;
  pagos?:            PagoFactura[];
}

export interface PagoFactura {
  id:            number;
  factura_id:    number;
  fecha_pago:    string;
  importe:       number;
  moneda:        Moneda;
  medio_pago:    MedioPago;
  referencia:    string | null;
  notas:         string | null;
  movimiento_id: number | null;
  echeq_id:      number | null;
  created_at:    string;
  deleted_at:    string | null;
  movimiento?:   { id: number; tipo: Tipo; tab_numero: number; rubro_id: number | null; rubro?: { id: number; nombre: string } | null } | null;
  echeq?:        { id: number; estado: EstadoEcheq; numero: string } | null;
}

// ── Auth ──────────────────────────────────────────────────────────────────────
// Subconjunto devuelto por GET /api/auth/me y POST /api/auth/login

export type EmpresaResumen = {
  id:             number;
  nombre:         string;
  nombre_corto:   string | null;
  color_primario: string | null;
  logo_url:       string | null;
  tiene_logo:     boolean;
};

export type MeResponse = {
  id:      number;
  nombre:  string;
  email:   string;
  rol:     Rol;
  activo:  boolean;
  accesos: { evento_id: number; rol: Rol }[];
  // Multitenancy — empresaId es null mientras hay una selección de empresa
  // pendiente (usuario con acceso a 2+ empresas que todavía no eligió).
  empresaId:            number | null;
  empresa:              EmpresaResumen | null;
  empresasDisponibles?: EmpresaResumen[];
  puedeCambiarEmpresa:  boolean;
  // Empleado de RRHH vinculado a este usuario (rol VIEWER + empleado ⇒
  // autoservicio: sólo ve/carga sus propias jornadas).
  empleadoId:           number | null;
};

// ── Respuestas API ────────────────────────────────────────────────────────────

export interface ApiError {
  error:   string;
  detail?: Record<string, string[]>;
}

export interface PaginatedResponse<T> {
  data:  T[];
  total: number;
  page:  number;
  limit: number;
}

// ── Empresa (Configuración de empresa) ────────────────────────────────────────

export interface Empresa {
  id:               number;
  nombre:           string;
  nombre_corto:     string | null;
  razon_social:     string | null;
  cuit:             string | null;
  domicilio:        string | null;
  telefono:         string | null;
  email:            string | null;
  web:              string | null;
  logo_nombre:      string | null;
  logo_mime:        string | null;
  color_primario:   string | null;
  color_secundario: string | null;
  moneda_default:   Moneda;
  timezone:         string;
  activo:           boolean;
  created_at:       string;
  updated_at:       string;
}

export interface EmpresaActual extends Empresa {
  usuarios_activos_count: number;
  eventos_count:          number;
}

export interface EmpresaUpdatePayload {
  nombre?:           string;
  nombre_corto?:     string | null;
  razon_social?:     string | null;
  cuit?:             string | null;
  domicilio?:        string | null;
  telefono?:         string | null;
  email?:            string | null;
  web?:              string | null;
  color_primario?:   string | null;
  color_secundario?: string | null;
  moneda_default?:   Moneda;
  timezone?:         string;
}

// ── RRHH ──────────────────────────────────────────────────────────────────────

export interface Empleado {
  id:               number;
  nombre:           string;
  apellido:         string;
  dni:              string;
  cuit:             string | null;
  email:            string | null;
  telefono:         string | null;
  domicilio:        string | null;
  cbu:              string | null;
  alias:            string | null;
  banco:            string | null;
  categoria:        CategoriaEmpleado;
  valor_hora:       number;
  valor_hora_extra: number;
  estado:           EstadoEmpleado;
  notas:            string | null;
  usuario_id:       number | null;
  created_at:       string;
  updated_at:       string;
  deleted_at:       string | null;
}

export interface EmpleadoConStats extends Empleado {
  stats: {
    horas_normales_totales:     number;
    horas_extras_totales:       number;
    anticipos_pendientes:       number;
    anticipos_pendientes_count: number;
    ultima_jornada:             Jornada | null;
  };
}

export interface Jornada {
  id:                number;
  empleado_id:       number;
  evento_id:         number | null;
  fecha:             string;
  hora_convocatoria: string | null;
  hora_ingreso:      string | null;
  hora_egreso:       string | null;
  horas_normales:    number;
  horas_extras:      number;
  descripcion:       string | null;
  estado:            EstadoJornada;
  motivo_rechazo:    string | null;
  aprobado_por:      number | null;
  aprobado_at:       string | null;
  empleado?: { id: number; nombre: string; apellido: string };
  evento?:   { id: number; nombre: string } | null;
}

export interface Anticipo {
  id:             number;
  empleado_id:    number;
  tipo:           TipoAnticipo;
  monto:          number;
  fecha:          string;
  motivo:         string | null;
  descontado:     boolean;
  liquidacion_id: number | null;
  created_at:     string;
}

export interface Liquidacion {
  id:               number;
  empleado_id:      number;
  evento_id:        number | null;
  fecha_desde:      string;
  fecha_hasta:      string;
  horas_normales:   number;
  horas_extras:     number;
  valor_hora:       number;
  valor_hora_extra: number;
  subtotal_horas:   number;
  total_anticipos:  number;
  total_descuentos: number;
  total_a_cobrar:   number;
  estado:           EstadoLiquidacion;
  observaciones:    string | null;
  movimiento_id:    number | null;
  aprobado_por:     number | null;
  aprobado_at:      string | null;
  created_at:       string;
  empleado?: { id: number; nombre: string; apellido: string };
  evento?:   { id: number; nombre: string } | null;
}

export interface LiquidacionDetalle extends Liquidacion {
  empleado:  Empleado;
  anticipos: Anticipo[];
  jornadas:  Jornada[];
  movimiento?: { id: number; tipo: Tipo; tab_numero: number; evento_id: number } | null;
}
