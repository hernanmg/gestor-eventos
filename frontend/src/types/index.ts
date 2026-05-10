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

// ── Configuración de pestañas ─────────────────────────────────────────────────

export interface TabConfig {
  id:     number;
  tipo:   Tipo;
  numero: number;
  nombre: string; // editable
  codigo: string; // inmutable
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
  numero:                string;
  razon_social:          string;
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

// ── Auth ──────────────────────────────────────────────────────────────────────
// Subconjunto devuelto por GET /api/auth/me y POST /api/auth/login

export type MeResponse = {
  id:     number;
  nombre: string;
  email:  string;
  rol:    Rol;
  activo: boolean;
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
