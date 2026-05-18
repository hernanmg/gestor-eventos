// Espejo de los enums del schema Prisma

export type Rol          = 'ADMIN' | 'OPERADOR' | 'VIEWER';
export type Tipo         = 'EGRESO' | 'INGRESO';
export type EstadoEvento = 'ACTIVO' | 'CERRADO' | 'IMPORTADO';
export type TipoCuenta   = 'EFECTIVO' | 'BANCO';
export type EstadoEcheq  = 'PENDIENTE' | 'COBRADO' | 'RECHAZADO';
export type Moneda       = 'ARS' | 'USD';

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
  tab_numero:            number;
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
  id:         number;
  tipo:       Tipo;
  tab_numero: number;
  tab_codigo: string | null;
  concepto:   string | null;
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

export type UbicacionStock   = 'DEPOSITO' | 'EN_EVENTO' | 'EN_TRANSITO' | 'BAJA';
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
  id:           number;
  nombre:       string;
  descripcion:  string | null;
  categoria_id: number | null;
  categoria:    CategoriaStock | null;
  codigo:       string | null;
  stock_total:  number;
  stock_minimo: number;
  unidad:       string;
  notas:        string | null;
  activo:       boolean;
  created_at:   string;
  updated_at:   string;
  deleted_at:   string | null;
  // augmented by listProductos
  comprometido_hoy?: number;
  disponible_hoy?:   number;
}

export interface AsignacionStock {
  id:               number;
  producto_id:      number;
  evento_id:        number;
  cantidad:         number;
  fecha_salida:     string;
  fecha_retorno:    string | null;
  ubicacion:        UbicacionStock;
  estado:           EstadoAsignacion;
  origen:           OrigenTransfer;
  evento_origen_id: number | null;
  notas:            string | null;
  created_at:       string;
  updated_at:       string;
  deleted_at:       string | null;
  // joined
  producto?:      { id: number; nombre: string; codigo: string | null; categoria: CategoriaStock | null; unidad: string };
  evento_origen?: { id: number; nombre: string } | null;
  evento?:        { id: number; nombre: string; fecha_inicio: string | null; fecha_fin: string | null };
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

// ── Auth ──────────────────────────────────────────────────────────────────────
// Subconjunto devuelto por GET /api/auth/me y POST /api/auth/login

export type MeResponse = {
  id:      number;
  nombre:  string;
  email:   string;
  rol:     Rol;
  activo:  boolean;
  accesos: { evento_id: number; rol: Rol }[];
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
