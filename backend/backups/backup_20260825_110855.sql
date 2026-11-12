--
-- PostgreSQL database dump
--

\restrict cOH5wnaEdtv79ywfsiMUOl3Bnsv4WOtZRJpnvVXMHPzC5YYy38fRQAouObDTVl2

-- Dumped from database version 16.13
-- Dumped by pg_dump version 16.13

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: admin_portal
--

-- *not* creating schema, since initdb creates it


ALTER SCHEMA public OWNER TO admin_portal;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: admin_portal
--

COMMENT ON SCHEMA public IS '';


--
-- Name: CategoriaEmpleado; Type: TYPE; Schema: public; Owner: admin_portal
--

CREATE TYPE public."CategoriaEmpleado" AS ENUM (
    'CAPITAN',
    'ARMADOR',
    'CHOFER',
    'ADMINISTRATIVO',
    'TECNICO',
    'OTRO',
    'JORNALERO',
    'FOFI',
    'NESTORAS',
    'EXTRANJERO',
    'SERENO'
);


ALTER TYPE public."CategoriaEmpleado" OWNER TO admin_portal;

--
-- Name: CondicionPago; Type: TYPE; Schema: public; Owner: admin_portal
--

CREATE TYPE public."CondicionPago" AS ENUM (
    'CONTADO',
    'DIAS_30',
    'DIAS_60',
    'DIAS_90',
    'ECHEQ',
    'OTRO'
);


ALTER TYPE public."CondicionPago" OWNER TO admin_portal;

--
-- Name: EstadoActivo; Type: TYPE; Schema: public; Owner: admin_portal
--

CREATE TYPE public."EstadoActivo" AS ENUM (
    'BUENO',
    'REGULAR',
    'DETERIORADO',
    'BAJA'
);


ALTER TYPE public."EstadoActivo" OWNER TO admin_portal;

--
-- Name: EstadoAsignacion; Type: TYPE; Schema: public; Owner: admin_portal
--

CREATE TYPE public."EstadoAsignacion" AS ENUM (
    'ACTIVA',
    'TRANSFERIDA',
    'DEVUELTA',
    'CANCELADA'
);


ALTER TYPE public."EstadoAsignacion" OWNER TO admin_portal;

--
-- Name: EstadoAsignacionDiaria; Type: TYPE; Schema: public; Owner: admin_portal
--

CREATE TYPE public."EstadoAsignacionDiaria" AS ENUM (
    'ASIGNADO',
    'LIBRE',
    'VACACIONES',
    'AUSENTE',
    'NO_CITADO'
);


ALTER TYPE public."EstadoAsignacionDiaria" OWNER TO admin_portal;

--
-- Name: EstadoCuenta; Type: TYPE; Schema: public; Owner: admin_portal
--

CREATE TYPE public."EstadoCuenta" AS ENUM (
    'ABIERTA',
    'PENDIENTE_RENDICION',
    'CERRADA'
);


ALTER TYPE public."EstadoCuenta" OWNER TO admin_portal;

--
-- Name: EstadoEcheq; Type: TYPE; Schema: public; Owner: admin_portal
--

CREATE TYPE public."EstadoEcheq" AS ENUM (
    'PENDIENTE',
    'COBRADO',
    'RECHAZADO'
);


ALTER TYPE public."EstadoEcheq" OWNER TO admin_portal;

--
-- Name: EstadoEmpleado; Type: TYPE; Schema: public; Owner: admin_portal
--

CREATE TYPE public."EstadoEmpleado" AS ENUM (
    'ACTIVO',
    'INACTIVO',
    'SUSPENDIDO'
);


ALTER TYPE public."EstadoEmpleado" OWNER TO admin_portal;

--
-- Name: EstadoEvento; Type: TYPE; Schema: public; Owner: admin_portal
--

CREATE TYPE public."EstadoEvento" AS ENUM (
    'ACTIVO',
    'CERRADO',
    'IMPORTADO'
);


ALTER TYPE public."EstadoEvento" OWNER TO admin_portal;

--
-- Name: EstadoFactura; Type: TYPE; Schema: public; Owner: admin_portal
--

CREATE TYPE public."EstadoFactura" AS ENUM (
    'RECIBIDA',
    'APROBADA',
    'PAGADA',
    'ANULADA'
);


ALTER TYPE public."EstadoFactura" OWNER TO admin_portal;

--
-- Name: EstadoJornada; Type: TYPE; Schema: public; Owner: admin_portal
--

CREATE TYPE public."EstadoJornada" AS ENUM (
    'PENDIENTE',
    'APROBADA',
    'RECHAZADA'
);


ALTER TYPE public."EstadoJornada" OWNER TO admin_portal;

--
-- Name: EstadoLiquidacion; Type: TYPE; Schema: public; Owner: admin_portal
--

CREATE TYPE public."EstadoLiquidacion" AS ENUM (
    'BORRADOR',
    'APROBADA',
    'PAGADA',
    'CANCELADA'
);


ALTER TYPE public."EstadoLiquidacion" OWNER TO admin_portal;

--
-- Name: EstadoMovimiento; Type: TYPE; Schema: public; Owner: admin_portal
--

CREATE TYPE public."EstadoMovimiento" AS ENUM (
    'PENDIENTE',
    'COTIZANDO',
    'CONFIRMADO',
    'PAGADO',
    'CANCELADO'
);


ALTER TYPE public."EstadoMovimiento" OWNER TO admin_portal;

--
-- Name: EstadoPanolItem; Type: TYPE; Schema: public; Owner: admin_portal
--

CREATE TYPE public."EstadoPanolItem" AS ENUM (
    'DISPONIBLE',
    'FUERA_DE_SERVICIO',
    'BAJA'
);


ALTER TYPE public."EstadoPanolItem" OWNER TO admin_portal;

--
-- Name: EstadoRubroEvento; Type: TYPE; Schema: public; Owner: admin_portal
--

CREATE TYPE public."EstadoRubroEvento" AS ENUM (
    'PENDIENTE',
    'COTIZANDO',
    'CONFIRMADO',
    'NO_VA',
    'CANCELADO'
);


ALTER TYPE public."EstadoRubroEvento" OWNER TO admin_portal;

--
-- Name: MedioPago; Type: TYPE; Schema: public; Owner: admin_portal
--

CREATE TYPE public."MedioPago" AS ENUM (
    'TRANSFERENCIA',
    'ECHEQ',
    'EFECTIVO',
    'CHEQUE'
);


ALTER TYPE public."MedioPago" OWNER TO admin_portal;

--
-- Name: Moneda; Type: TYPE; Schema: public; Owner: admin_portal
--

CREATE TYPE public."Moneda" AS ENUM (
    'ARS',
    'USD',
    'EUR'
);


ALTER TYPE public."Moneda" OWNER TO admin_portal;

--
-- Name: MonedaCCC; Type: TYPE; Schema: public; Owner: admin_portal
--

CREATE TYPE public."MonedaCCC" AS ENUM (
    'ARS',
    'USD',
    'EUR'
);


ALTER TYPE public."MonedaCCC" OWNER TO admin_portal;

--
-- Name: OrigenTransfer; Type: TYPE; Schema: public; Owner: admin_portal
--

CREATE TYPE public."OrigenTransfer" AS ENUM (
    'DEPOSITO',
    'EVENTO'
);


ALTER TYPE public."OrigenTransfer" OWNER TO admin_portal;

--
-- Name: Rol; Type: TYPE; Schema: public; Owner: admin_portal
--

CREATE TYPE public."Rol" AS ENUM (
    'ADMIN',
    'OPERADOR',
    'VIEWER',
    'JORNALERO',
    'PAÑOLERO'
);


ALTER TYPE public."Rol" OWNER TO admin_portal;

--
-- Name: Tipo; Type: TYPE; Schema: public; Owner: admin_portal
--

CREATE TYPE public."Tipo" AS ENUM (
    'EGRESO',
    'INGRESO'
);


ALTER TYPE public."Tipo" OWNER TO admin_portal;

--
-- Name: TipoAnticipo; Type: TYPE; Schema: public; Owner: admin_portal
--

CREATE TYPE public."TipoAnticipo" AS ENUM (
    'ADELANTO',
    'VALE',
    'DESCUENTO'
);


ALTER TYPE public."TipoAnticipo" OWNER TO admin_portal;

--
-- Name: TipoComida; Type: TYPE; Schema: public; Owner: admin_portal
--

CREATE TYPE public."TipoComida" AS ENUM (
    'ALMUERZO',
    'CENA',
    'DESAYUNO',
    'MERIENDA'
);


ALTER TYPE public."TipoComida" OWNER TO admin_portal;

--
-- Name: TipoCuenta; Type: TYPE; Schema: public; Owner: admin_portal
--

CREATE TYPE public."TipoCuenta" AS ENUM (
    'EFECTIVO',
    'BANCO'
);


ALTER TYPE public."TipoCuenta" OWNER TO admin_portal;

--
-- Name: TipoLiquidacion; Type: TYPE; Schema: public; Owner: admin_portal
--

CREATE TYPE public."TipoLiquidacion" AS ENUM (
    'LINEAL',
    'JORNADA'
);


ALTER TYPE public."TipoLiquidacion" OWNER TO admin_portal;

--
-- Name: TipoMovCCC; Type: TYPE; Schema: public; Owner: admin_portal
--

CREATE TYPE public."TipoMovCCC" AS ENUM (
    'DEBE',
    'HABER',
    'AJUSTE'
);


ALTER TYPE public."TipoMovCCC" OWNER TO admin_portal;

--
-- Name: TipoMovPanol; Type: TYPE; Schema: public; Owner: admin_portal
--

CREATE TYPE public."TipoMovPanol" AS ENUM (
    'SALIDA',
    'DEVOLUCION',
    'USO_INTERNO',
    'BAJA'
);


ALTER TYPE public."TipoMovPanol" OWNER TO admin_portal;

--
-- Name: TipoPanolItem; Type: TYPE; Schema: public; Owner: admin_portal
--

CREATE TYPE public."TipoPanolItem" AS ENUM (
    'HERRAMIENTA',
    'CONSUMIBLE'
);


ALTER TYPE public."TipoPanolItem" OWNER TO admin_portal;

--
-- Name: TipoRubro; Type: TYPE; Schema: public; Owner: admin_portal
--

CREATE TYPE public."TipoRubro" AS ENUM (
    'EGRESO',
    'INGRESO'
);


ALTER TYPE public."TipoRubro" OWNER TO admin_portal;

--
-- Name: TipoTercero; Type: TYPE; Schema: public; Owner: admin_portal
--

CREATE TYPE public."TipoTercero" AS ENUM (
    'PROVEEDOR',
    'CLIENTE',
    'SOCIO',
    'CLUB',
    'OTRO'
);


ALTER TYPE public."TipoTercero" OWNER TO admin_portal;

--
-- Name: UbicacionStock; Type: TYPE; Schema: public; Owner: admin_portal
--

CREATE TYPE public."UbicacionStock" AS ENUM (
    'DEPOSITO',
    'EN_EVENTO',
    'EN_TRANSITO',
    'BAJA',
    'EXCEDENTE',
    'ALQUILADO'
);


ALTER TYPE public."UbicacionStock" OWNER TO admin_portal;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: Activo; Type: TABLE; Schema: public; Owner: admin_portal
--

CREATE TABLE public."Activo" (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    nombre text NOT NULL,
    descripcion text,
    categoria text,
    numero_serie text,
    fecha_compra timestamp(3) without time zone,
    valor_compra numeric(12,2),
    estado public."EstadoActivo" DEFAULT 'BUENO'::public."EstadoActivo" NOT NULL,
    ubicacion text,
    observaciones text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    deleted_at timestamp(3) without time zone,
    created_by integer
);


ALTER TABLE public."Activo" OWNER TO admin_portal;

--
-- Name: Activo_id_seq; Type: SEQUENCE; Schema: public; Owner: admin_portal
--

CREATE SEQUENCE public."Activo_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Activo_id_seq" OWNER TO admin_portal;

--
-- Name: Activo_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin_portal
--

ALTER SEQUENCE public."Activo_id_seq" OWNED BY public."Activo".id;


--
-- Name: Anticipo; Type: TABLE; Schema: public; Owner: admin_portal
--

CREATE TABLE public."Anticipo" (
    id integer NOT NULL,
    empleado_id integer NOT NULL,
    empresa_id integer NOT NULL,
    tipo public."TipoAnticipo" DEFAULT 'ADELANTO'::public."TipoAnticipo" NOT NULL,
    monto numeric(10,2) NOT NULL,
    fecha timestamp(3) without time zone NOT NULL,
    motivo text,
    descontado boolean DEFAULT false NOT NULL,
    liquidacion_id integer,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by integer
);


ALTER TABLE public."Anticipo" OWNER TO admin_portal;

--
-- Name: Anticipo_id_seq; Type: SEQUENCE; Schema: public; Owner: admin_portal
--

CREATE SEQUENCE public."Anticipo_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Anticipo_id_seq" OWNER TO admin_portal;

--
-- Name: Anticipo_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin_portal
--

ALTER SEQUENCE public."Anticipo_id_seq" OWNED BY public."Anticipo".id;


--
-- Name: AsignacionDiaria; Type: TABLE; Schema: public; Owner: admin_portal
--

CREATE TABLE public."AsignacionDiaria" (
    id integer NOT NULL,
    parte_diario_id integer NOT NULL,
    empleado_id integer NOT NULL,
    empresa_id integer NOT NULL,
    estado public."EstadoAsignacionDiaria" DEFAULT 'ASIGNADO'::public."EstadoAsignacionDiaria" NOT NULL,
    hora_ingreso text,
    lugar text,
    tarea text,
    seccion text,
    orden integer DEFAULT 0 NOT NULL,
    camion_id integer,
    vehiculo_texto text,
    evento_id integer,
    hora_salida text,
    hora_salida_fija boolean DEFAULT false NOT NULL,
    jornada_id integer,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    deleted_at timestamp(3) without time zone
);


ALTER TABLE public."AsignacionDiaria" OWNER TO admin_portal;

--
-- Name: AsignacionDiaria_id_seq; Type: SEQUENCE; Schema: public; Owner: admin_portal
--

CREATE SEQUENCE public."AsignacionDiaria_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."AsignacionDiaria_id_seq" OWNER TO admin_portal;

--
-- Name: AsignacionDiaria_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin_portal
--

ALTER SEQUENCE public."AsignacionDiaria_id_seq" OWNED BY public."AsignacionDiaria".id;


--
-- Name: AsignacionStock; Type: TABLE; Schema: public; Owner: admin_portal
--

CREATE TABLE public."AsignacionStock" (
    id integer NOT NULL,
    producto_id integer NOT NULL,
    evento_id integer NOT NULL,
    cantidad integer NOT NULL,
    fecha_salida timestamp(3) without time zone NOT NULL,
    fecha_retorno timestamp(3) without time zone,
    ubicacion public."UbicacionStock" DEFAULT 'EN_EVENTO'::public."UbicacionStock" NOT NULL,
    estado public."EstadoAsignacion" DEFAULT 'ACTIVA'::public."EstadoAsignacion" NOT NULL,
    origen public."OrigenTransfer" DEFAULT 'DEPOSITO'::public."OrigenTransfer" NOT NULL,
    evento_origen_id integer,
    notas text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    deleted_at timestamp(3) without time zone,
    created_by integer,
    updated_by integer,
    camion_id integer,
    cantidad_excedente integer DEFAULT 0 NOT NULL,
    cuna_id integer,
    firmado_llegada boolean DEFAULT false NOT NULL,
    firmado_llegada_at timestamp(3) without time zone,
    firmado_llegada_por integer,
    firmado_retorno boolean DEFAULT false NOT NULL,
    firmado_retorno_at timestamp(3) without time zone,
    firmado_retorno_por integer,
    firmado_salida boolean DEFAULT false NOT NULL,
    firmado_salida_at timestamp(3) without time zone,
    firmado_salida_por integer,
    rubro_evento_id integer
);


ALTER TABLE public."AsignacionStock" OWNER TO admin_portal;

--
-- Name: AsignacionStock_id_seq; Type: SEQUENCE; Schema: public; Owner: admin_portal
--

CREATE SEQUENCE public."AsignacionStock_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."AsignacionStock_id_seq" OWNER TO admin_portal;

--
-- Name: AsignacionStock_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin_portal
--

ALTER SEQUENCE public."AsignacionStock_id_seq" OWNED BY public."AsignacionStock".id;


--
-- Name: AuditoriaLog; Type: TABLE; Schema: public; Owner: admin_portal
--

CREATE TABLE public."AuditoriaLog" (
    id integer NOT NULL,
    usuario_id integer,
    accion text NOT NULL,
    entidad text NOT NULL,
    entidad_id integer,
    evento_id integer,
    descripcion text NOT NULL,
    datos_antes jsonb,
    datos_despues jsonb,
    ip text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    empresa_id integer
);


ALTER TABLE public."AuditoriaLog" OWNER TO admin_portal;

--
-- Name: AuditoriaLog_id_seq; Type: SEQUENCE; Schema: public; Owner: admin_portal
--

CREATE SEQUENCE public."AuditoriaLog_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."AuditoriaLog_id_seq" OWNER TO admin_portal;

--
-- Name: AuditoriaLog_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin_portal
--

ALTER SEQUENCE public."AuditoriaLog_id_seq" OWNED BY public."AuditoriaLog".id;


--
-- Name: Camion; Type: TABLE; Schema: public; Owner: admin_portal
--

CREATE TABLE public."Camion" (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    codigo text NOT NULL,
    descripcion text,
    patente text,
    tipo text,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    deleted_at timestamp(3) without time zone
);


ALTER TABLE public."Camion" OWNER TO admin_portal;

--
-- Name: Camion_id_seq; Type: SEQUENCE; Schema: public; Owner: admin_portal
--

CREATE SEQUENCE public."Camion_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Camion_id_seq" OWNER TO admin_portal;

--
-- Name: Camion_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin_portal
--

ALTER SEQUENCE public."Camion_id_seq" OWNED BY public."Camion".id;


--
-- Name: CategoriaStock; Type: TABLE; Schema: public; Owner: admin_portal
--

CREATE TABLE public."CategoriaStock" (
    id integer NOT NULL,
    nombre text NOT NULL,
    descripcion text,
    color text,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    deleted_at timestamp(3) without time zone,
    created_by integer,
    empresa_id integer NOT NULL
);


ALTER TABLE public."CategoriaStock" OWNER TO admin_portal;

--
-- Name: CategoriaStock_id_seq; Type: SEQUENCE; Schema: public; Owner: admin_portal
--

CREATE SEQUENCE public."CategoriaStock_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."CategoriaStock_id_seq" OWNER TO admin_portal;

--
-- Name: CategoriaStock_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin_portal
--

ALTER SEQUENCE public."CategoriaStock_id_seq" OWNED BY public."CategoriaStock".id;


--
-- Name: CuentaBancaria; Type: TABLE; Schema: public; Owner: admin_portal
--

CREATE TABLE public."CuentaBancaria" (
    id integer NOT NULL,
    evento_id integer,
    nombre text NOT NULL,
    tipo public."TipoCuenta" NOT NULL,
    moneda public."Moneda" DEFAULT 'ARS'::public."Moneda" NOT NULL,
    saldo_inicial numeric(15,2) DEFAULT 0 NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    deleted_at timestamp(3) without time zone,
    empresa_id integer NOT NULL,
    estado public."EstadoCuenta" DEFAULT 'ABIERTA'::public."EstadoCuenta" NOT NULL,
    fecha_apertura timestamp(3) without time zone,
    fecha_cierre timestamp(3) without time zone,
    notas_rendicion text,
    responsable_id integer,
    saldo_minimo numeric(12,2)
);


ALTER TABLE public."CuentaBancaria" OWNER TO admin_portal;

--
-- Name: CuentaBancaria_id_seq; Type: SEQUENCE; Schema: public; Owner: admin_portal
--

CREATE SEQUENCE public."CuentaBancaria_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."CuentaBancaria_id_seq" OWNER TO admin_portal;

--
-- Name: CuentaBancaria_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin_portal
--

ALTER SEQUENCE public."CuentaBancaria_id_seq" OWNED BY public."CuentaBancaria".id;


--
-- Name: CuentaCorriente; Type: TABLE; Schema: public; Owner: admin_portal
--

CREATE TABLE public."CuentaCorriente" (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    tipo_tercero public."TipoTercero" NOT NULL,
    proveedor_id integer,
    tercero_nombre text,
    tercero_cuit text,
    nombre text NOT NULL,
    descripcion text,
    activa boolean DEFAULT true NOT NULL,
    saldo_actual numeric(15,2) DEFAULT 0 NOT NULL,
    tiene_reparto boolean DEFAULT false NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    deleted_at timestamp(3) without time zone,
    created_by integer,
    updated_by integer,
    moneda public."MonedaCCC" DEFAULT 'ARS'::public."MonedaCCC" NOT NULL
);


ALTER TABLE public."CuentaCorriente" OWNER TO admin_portal;

--
-- Name: CuentaCorriente_id_seq; Type: SEQUENCE; Schema: public; Owner: admin_portal
--

CREATE SEQUENCE public."CuentaCorriente_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."CuentaCorriente_id_seq" OWNER TO admin_portal;

--
-- Name: CuentaCorriente_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin_portal
--

ALTER SEQUENCE public."CuentaCorriente_id_seq" OWNED BY public."CuentaCorriente".id;


--
-- Name: Cuna; Type: TABLE; Schema: public; Owner: admin_portal
--

CREATE TABLE public."Cuna" (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    codigo text NOT NULL,
    descripcion text,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    deleted_at timestamp(3) without time zone
);


ALTER TABLE public."Cuna" OWNER TO admin_portal;

--
-- Name: CunaProducto; Type: TABLE; Schema: public; Owner: admin_portal
--

CREATE TABLE public."CunaProducto" (
    id integer NOT NULL,
    cuna_id integer NOT NULL,
    producto_id integer NOT NULL,
    cantidad integer NOT NULL
);


ALTER TABLE public."CunaProducto" OWNER TO admin_portal;

--
-- Name: CunaProducto_id_seq; Type: SEQUENCE; Schema: public; Owner: admin_portal
--

CREATE SEQUENCE public."CunaProducto_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."CunaProducto_id_seq" OWNER TO admin_portal;

--
-- Name: CunaProducto_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin_portal
--

ALTER SEQUENCE public."CunaProducto_id_seq" OWNED BY public."CunaProducto".id;


--
-- Name: Cuna_id_seq; Type: SEQUENCE; Schema: public; Owner: admin_portal
--

CREATE SEQUENCE public."Cuna_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Cuna_id_seq" OWNER TO admin_portal;

--
-- Name: Cuna_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin_portal
--

ALTER SEQUENCE public."Cuna_id_seq" OWNED BY public."Cuna".id;


--
-- Name: Echeq; Type: TABLE; Schema: public; Owner: admin_portal
--

CREATE TABLE public."Echeq" (
    id integer NOT NULL,
    evento_id integer NOT NULL,
    movimiento_id integer,
    movimiento_caja_id integer,
    numero text NOT NULL,
    razon_social text,
    detalle text,
    importe numeric(15,2) NOT NULL,
    moneda public."Moneda" DEFAULT 'ARS'::public."Moneda" NOT NULL,
    estado public."EstadoEcheq" DEFAULT 'PENDIENTE'::public."EstadoEcheq" NOT NULL,
    fecha_emision timestamp(3) without time zone,
    fecha_cobro_estimada timestamp(3) without time zone,
    fecha_cobro_real timestamp(3) without time zone,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    deleted_at timestamp(3) without time zone,
    created_by integer,
    updated_by integer,
    motivo_rechazo text,
    proveedor_id integer,
    monto_ars numeric(15,2),
    tasa_cambio numeric(10,4)
);


ALTER TABLE public."Echeq" OWNER TO admin_portal;

--
-- Name: Echeq_id_seq; Type: SEQUENCE; Schema: public; Owner: admin_portal
--

CREATE SEQUENCE public."Echeq_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Echeq_id_seq" OWNER TO admin_portal;

--
-- Name: Echeq_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin_portal
--

ALTER SEQUENCE public."Echeq_id_seq" OWNED BY public."Echeq".id;


--
-- Name: Empleado; Type: TABLE; Schema: public; Owner: admin_portal
--

CREATE TABLE public."Empleado" (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    nombre text NOT NULL,
    apellido text NOT NULL,
    dni text,
    cuit text,
    email text,
    telefono text,
    domicilio text,
    cbu text,
    alias text,
    banco text,
    categoria public."CategoriaEmpleado" DEFAULT 'OTRO'::public."CategoriaEmpleado" NOT NULL,
    valor_hora numeric(10,2) DEFAULT 0 NOT NULL,
    valor_hora_extra numeric(10,2) DEFAULT 0 NOT NULL,
    estado public."EstadoEmpleado" DEFAULT 'ACTIVO'::public."EstadoEmpleado" NOT NULL,
    notas text,
    usuario_id integer,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    deleted_at timestamp(3) without time zone,
    created_by integer,
    tipo_liquidacion public."TipoLiquidacion" DEFAULT 'LINEAL'::public."TipoLiquidacion" NOT NULL,
    valor_jornada_completa numeric(10,2),
    valor_media_jornada numeric(10,2),
    umbral_horas_jornada numeric(5,2),
    umbral_horas_media numeric(5,2),
    valor_hora_extra_jornada numeric(10,2),
    valor_viaje numeric(10,2),
    apodo text,
    fecha_nacimiento timestamp(3) without time zone,
    grupo_sanguineo text,
    contacto_emergencia_nombre text,
    contacto_emergencia_tel text,
    escalafon integer,
    art text,
    licencia_conducir boolean DEFAULT false NOT NULL,
    equipamiento_asignado text,
    talle_pantalon text,
    talle_remera text,
    talle_buzo text,
    talle_calzado text,
    contacto_emergencia_tel2 text,
    tipo_contratacion text
);


ALTER TABLE public."Empleado" OWNER TO admin_portal;

--
-- Name: Empleado_id_seq; Type: SEQUENCE; Schema: public; Owner: admin_portal
--

CREATE SEQUENCE public."Empleado_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Empleado_id_seq" OWNER TO admin_portal;

--
-- Name: Empleado_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin_portal
--

ALTER SEQUENCE public."Empleado_id_seq" OWNED BY public."Empleado".id;


--
-- Name: Empresa; Type: TABLE; Schema: public; Owner: admin_portal
--

CREATE TABLE public."Empresa" (
    id integer NOT NULL,
    nombre text NOT NULL,
    nombre_corto text,
    cuit text,
    domicilio text,
    logo_url text,
    color_primario text,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    color_secundario text,
    email text,
    logo_data bytea,
    logo_mime text,
    logo_nombre text,
    moneda_default public."Moneda" DEFAULT 'ARS'::public."Moneda" NOT NULL,
    razon_social text,
    telefono text,
    timezone text DEFAULT 'America/Argentina/Buenos_Aires'::text NOT NULL,
    updated_by integer,
    web text
);


ALTER TABLE public."Empresa" OWNER TO admin_portal;

--
-- Name: Empresa_id_seq; Type: SEQUENCE; Schema: public; Owner: admin_portal
--

CREATE SEQUENCE public."Empresa_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Empresa_id_seq" OWNER TO admin_portal;

--
-- Name: Empresa_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin_portal
--

ALTER SEQUENCE public."Empresa_id_seq" OWNED BY public."Empresa".id;


--
-- Name: Evento; Type: TABLE; Schema: public; Owner: admin_portal
--

CREATE TABLE public."Evento" (
    id integer NOT NULL,
    nombre text NOT NULL,
    fecha_inicio timestamp(3) without time zone,
    fecha_fin timestamp(3) without time zone,
    estado public."EstadoEvento" DEFAULT 'ACTIVO'::public."EstadoEvento" NOT NULL,
    socios jsonb DEFAULT '[]'::jsonb NOT NULL,
    moneda_base public."Moneda" DEFAULT 'ARS'::public."Moneda" NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    deleted_at timestamp(3) without time zone,
    created_by integer,
    updated_by integer,
    empresa_id integer NOT NULL,
    dias_desmontaje integer DEFAULT 0 NOT NULL,
    dias_montaje integer DEFAULT 0 NOT NULL
);


ALTER TABLE public."Evento" OWNER TO admin_portal;

--
-- Name: EventoAcceso; Type: TABLE; Schema: public; Owner: admin_portal
--

CREATE TABLE public."EventoAcceso" (
    id integer NOT NULL,
    usuario_id integer NOT NULL,
    evento_id integer NOT NULL,
    rol public."Rol" NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by integer
);


ALTER TABLE public."EventoAcceso" OWNER TO admin_portal;

--
-- Name: EventoAcceso_id_seq; Type: SEQUENCE; Schema: public; Owner: admin_portal
--

CREATE SEQUENCE public."EventoAcceso_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."EventoAcceso_id_seq" OWNER TO admin_portal;

--
-- Name: EventoAcceso_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin_portal
--

ALTER SEQUENCE public."EventoAcceso_id_seq" OWNED BY public."EventoAcceso".id;


--
-- Name: EventoCuenta; Type: TABLE; Schema: public; Owner: admin_portal
--

CREATE TABLE public."EventoCuenta" (
    id integer NOT NULL,
    evento_id integer NOT NULL,
    cuenta_id integer NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by integer
);


ALTER TABLE public."EventoCuenta" OWNER TO admin_portal;

--
-- Name: EventoCuenta_id_seq; Type: SEQUENCE; Schema: public; Owner: admin_portal
--

CREATE SEQUENCE public."EventoCuenta_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."EventoCuenta_id_seq" OWNER TO admin_portal;

--
-- Name: EventoCuenta_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin_portal
--

ALTER SEQUENCE public."EventoCuenta_id_seq" OWNED BY public."EventoCuenta".id;


--
-- Name: Evento_id_seq; Type: SEQUENCE; Schema: public; Owner: admin_portal
--

CREATE SEQUENCE public."Evento_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Evento_id_seq" OWNER TO admin_portal;

--
-- Name: Evento_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin_portal
--

ALTER SEQUENCE public."Evento_id_seq" OWNED BY public."Evento".id;


--
-- Name: Factura; Type: TABLE; Schema: public; Owner: admin_portal
--

CREATE TABLE public."Factura" (
    id integer NOT NULL,
    numero_factura text NOT NULL,
    tipo_factura text NOT NULL,
    fecha_emision timestamp(3) without time zone NOT NULL,
    fecha_vencimiento timestamp(3) without time zone,
    proveedor_id integer NOT NULL,
    evento_id integer NOT NULL,
    tab_numero integer,
    tipo_movimiento public."Tipo",
    importe_total numeric(15,2) NOT NULL,
    importe_pagado numeric(15,2) DEFAULT 0 NOT NULL,
    importe_pendiente numeric(15,2) DEFAULT 0 NOT NULL,
    moneda public."Moneda" DEFAULT 'ARS'::public."Moneda" NOT NULL,
    condicion_pago public."CondicionPago" DEFAULT 'CONTADO'::public."CondicionPago" NOT NULL,
    estado public."EstadoFactura" DEFAULT 'RECIBIDA'::public."EstadoFactura" NOT NULL,
    notas text,
    pdf_data bytea,
    pdf_nombre text,
    pdf_mime_type text,
    pdf_tamanio integer,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    deleted_at timestamp(3) without time zone,
    created_by integer,
    updated_by integer,
    empresa_id integer NOT NULL,
    rubro_id integer,
    monto_ars numeric(15,2),
    tasa_cambio numeric(10,4)
);


ALTER TABLE public."Factura" OWNER TO admin_portal;

--
-- Name: Factura_id_seq; Type: SEQUENCE; Schema: public; Owner: admin_portal
--

CREATE SEQUENCE public."Factura_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Factura_id_seq" OWNER TO admin_portal;

--
-- Name: Factura_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin_portal
--

ALTER SEQUENCE public."Factura_id_seq" OWNED BY public."Factura".id;


--
-- Name: Jornada; Type: TABLE; Schema: public; Owner: admin_portal
--

CREATE TABLE public."Jornada" (
    id integer NOT NULL,
    empleado_id integer NOT NULL,
    evento_id integer,
    empresa_id integer NOT NULL,
    fecha timestamp(3) without time zone NOT NULL,
    hora_convocatoria timestamp(3) without time zone,
    hora_ingreso timestamp(3) without time zone,
    hora_egreso timestamp(3) without time zone,
    horas_normales numeric(5,2) DEFAULT 0 NOT NULL,
    horas_extras numeric(5,2) DEFAULT 0 NOT NULL,
    descripcion text,
    estado public."EstadoJornada" DEFAULT 'PENDIENTE'::public."EstadoJornada" NOT NULL,
    motivo_rechazo text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    deleted_at timestamp(3) without time zone,
    created_by integer,
    aprobado_por integer,
    aprobado_at timestamp(3) without time zone,
    cantidad_viajes integer,
    convocatoria text,
    lugar_trabajo text,
    camion_id integer
);


ALTER TABLE public."Jornada" OWNER TO admin_portal;

--
-- Name: Jornada_id_seq; Type: SEQUENCE; Schema: public; Owner: admin_portal
--

CREATE SEQUENCE public."Jornada_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Jornada_id_seq" OWNER TO admin_portal;

--
-- Name: Jornada_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin_portal
--

ALTER SEQUENCE public."Jornada_id_seq" OWNED BY public."Jornada".id;


--
-- Name: LineaComida; Type: TABLE; Schema: public; Owner: admin_portal
--

CREATE TABLE public."LineaComida" (
    id integer NOT NULL,
    pedido_comida_id integer NOT NULL,
    tipo public."TipoComida" NOT NULL,
    area text NOT NULL,
    cantidad integer NOT NULL,
    valor_unitario numeric(10,2),
    detalle text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    deleted_at timestamp(3) without time zone
);


ALTER TABLE public."LineaComida" OWNER TO admin_portal;

--
-- Name: LineaComida_id_seq; Type: SEQUENCE; Schema: public; Owner: admin_portal
--

CREATE SEQUENCE public."LineaComida_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."LineaComida_id_seq" OWNER TO admin_portal;

--
-- Name: LineaComida_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin_portal
--

ALTER SEQUENCE public."LineaComida_id_seq" OWNED BY public."LineaComida".id;


--
-- Name: Liquidacion; Type: TABLE; Schema: public; Owner: admin_portal
--

CREATE TABLE public."Liquidacion" (
    id integer NOT NULL,
    empleado_id integer NOT NULL,
    empresa_id integer NOT NULL,
    evento_id integer,
    fecha_desde timestamp(3) without time zone NOT NULL,
    fecha_hasta timestamp(3) without time zone NOT NULL,
    horas_normales numeric(8,2) NOT NULL,
    horas_extras numeric(8,2) NOT NULL,
    valor_hora numeric(10,2) NOT NULL,
    valor_hora_extra numeric(10,2) NOT NULL,
    subtotal_horas numeric(10,2) NOT NULL,
    total_anticipos numeric(10,2) NOT NULL,
    total_descuentos numeric(10,2) NOT NULL,
    total_a_cobrar numeric(10,2) NOT NULL,
    estado public."EstadoLiquidacion" DEFAULT 'BORRADOR'::public."EstadoLiquidacion" NOT NULL,
    observaciones text,
    movimiento_id integer,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    aprobado_por integer,
    aprobado_at timestamp(3) without time zone,
    tipo_liquidacion public."TipoLiquidacion" DEFAULT 'LINEAL'::public."TipoLiquidacion" NOT NULL
);


ALTER TABLE public."Liquidacion" OWNER TO admin_portal;

--
-- Name: Liquidacion_id_seq; Type: SEQUENCE; Schema: public; Owner: admin_portal
--

CREATE SEQUENCE public."Liquidacion_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Liquidacion_id_seq" OWNER TO admin_portal;

--
-- Name: Liquidacion_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin_portal
--

ALTER SEQUENCE public."Liquidacion_id_seq" OWNED BY public."Liquidacion".id;


--
-- Name: Movimiento; Type: TABLE; Schema: public; Owner: admin_portal
--

CREATE TABLE public."Movimiento" (
    id integer NOT NULL,
    evento_id integer NOT NULL,
    tipo public."Tipo" NOT NULL,
    tab_numero integer,
    fecha timestamp(3) without time zone,
    concepto text,
    descripcion text,
    debe numeric(15,2) DEFAULT 0 NOT NULL,
    haber numeric(15,2) DEFAULT 0 NOT NULL,
    saldo numeric(15,2) DEFAULT 0 NOT NULL,
    moneda public."Moneda" DEFAULT 'ARS'::public."Moneda" NOT NULL,
    orden integer NOT NULL,
    impuesto_subcategoria text,
    movimiento_caja_id integer,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    deleted_at timestamp(3) without time zone,
    created_by integer,
    updated_by integer,
    proveedor_id integer,
    avisado_proveedor boolean DEFAULT false NOT NULL,
    costo_real numeric(15,2),
    estado_movimiento public."EstadoMovimiento" DEFAULT 'PENDIENTE'::public."EstadoMovimiento" NOT NULL,
    fecha_pago timestamp(3) without time zone,
    presupuesto numeric(15,2),
    responsable_id integer,
    rubro_id integer,
    monto_ars numeric(15,2),
    tasa_cambio numeric(10,4)
);


ALTER TABLE public."Movimiento" OWNER TO admin_portal;

--
-- Name: MovimientoCCC; Type: TABLE; Schema: public; Owner: admin_portal
--

CREATE TABLE public."MovimientoCCC" (
    id integer NOT NULL,
    cuenta_ccc_id integer NOT NULL,
    empresa_id integer NOT NULL,
    tipo public."TipoMovCCC" NOT NULL,
    fecha timestamp(3) without time zone NOT NULL,
    concepto text NOT NULL,
    descripcion text,
    monto numeric(15,2) NOT NULL,
    tasa_cambio numeric(10,4),
    monto_ars numeric(15,2),
    saldo numeric(15,2) DEFAULT 0 NOT NULL,
    factura_id integer,
    evento_id integer,
    documento_data bytea,
    documento_nombre text,
    documento_mime text,
    documento_tamanio integer,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    deleted_at timestamp(3) without time zone,
    created_by integer,
    updated_by integer,
    moneda public."MonedaCCC" NOT NULL
);


ALTER TABLE public."MovimientoCCC" OWNER TO admin_portal;

--
-- Name: MovimientoCCC_id_seq; Type: SEQUENCE; Schema: public; Owner: admin_portal
--

CREATE SEQUENCE public."MovimientoCCC_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."MovimientoCCC_id_seq" OWNER TO admin_portal;

--
-- Name: MovimientoCCC_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin_portal
--

ALTER SEQUENCE public."MovimientoCCC_id_seq" OWNED BY public."MovimientoCCC".id;


--
-- Name: MovimientoCaja; Type: TABLE; Schema: public; Owner: admin_portal
--

CREATE TABLE public."MovimientoCaja" (
    id integer NOT NULL,
    cuenta_id integer NOT NULL,
    fecha timestamp(3) without time zone,
    descripcion text,
    debe numeric(15,2) DEFAULT 0 NOT NULL,
    haber numeric(15,2) DEFAULT 0 NOT NULL,
    saldo_corriente numeric(15,2) DEFAULT 0 NOT NULL,
    orden integer NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    deleted_at timestamp(3) without time zone,
    created_by integer,
    updated_by integer,
    transferencia_par_id integer,
    evento_id integer,
    moneda public."Moneda",
    monto_ars numeric(15,2),
    tasa_cambio numeric(10,4)
);


ALTER TABLE public."MovimientoCaja" OWNER TO admin_portal;

--
-- Name: MovimientoCaja_id_seq; Type: SEQUENCE; Schema: public; Owner: admin_portal
--

CREATE SEQUENCE public."MovimientoCaja_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."MovimientoCaja_id_seq" OWNER TO admin_portal;

--
-- Name: MovimientoCaja_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin_portal
--

ALTER SEQUENCE public."MovimientoCaja_id_seq" OWNED BY public."MovimientoCaja".id;


--
-- Name: MovimientoPanol; Type: TABLE; Schema: public; Owner: admin_portal
--

CREATE TABLE public."MovimientoPanol" (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    panol_item_id integer NOT NULL,
    tipo public."TipoMovPanol" NOT NULL,
    cantidad integer NOT NULL,
    evento_id integer,
    responsable_id integer,
    responsable_nombre text,
    fecha timestamp(3) without time zone NOT NULL,
    descripcion text,
    cantidad_devuelta integer,
    cantidad_faltante integer,
    motivo_faltante text,
    devolucion_at timestamp(3) without time zone,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    created_by integer
);


ALTER TABLE public."MovimientoPanol" OWNER TO admin_portal;

--
-- Name: MovimientoPanol_id_seq; Type: SEQUENCE; Schema: public; Owner: admin_portal
--

CREATE SEQUENCE public."MovimientoPanol_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."MovimientoPanol_id_seq" OWNER TO admin_portal;

--
-- Name: MovimientoPanol_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin_portal
--

ALTER SEQUENCE public."MovimientoPanol_id_seq" OWNED BY public."MovimientoPanol".id;


--
-- Name: MovimientoStock; Type: TABLE; Schema: public; Owner: admin_portal
--

CREATE TABLE public."MovimientoStock" (
    id integer NOT NULL,
    producto_id integer NOT NULL,
    asignacion_id integer,
    tipo text NOT NULL,
    cantidad integer NOT NULL,
    evento_origen_id integer,
    evento_destino_id integer,
    fecha timestamp(3) without time zone NOT NULL,
    descripcion text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by integer
);


ALTER TABLE public."MovimientoStock" OWNER TO admin_portal;

--
-- Name: MovimientoStock_id_seq; Type: SEQUENCE; Schema: public; Owner: admin_portal
--

CREATE SEQUENCE public."MovimientoStock_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."MovimientoStock_id_seq" OWNER TO admin_portal;

--
-- Name: MovimientoStock_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin_portal
--

ALTER SEQUENCE public."MovimientoStock_id_seq" OWNED BY public."MovimientoStock".id;


--
-- Name: Movimiento_id_seq; Type: SEQUENCE; Schema: public; Owner: admin_portal
--

CREATE SEQUENCE public."Movimiento_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Movimiento_id_seq" OWNER TO admin_portal;

--
-- Name: Movimiento_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin_portal
--

ALTER SEQUENCE public."Movimiento_id_seq" OWNED BY public."Movimiento".id;


--
-- Name: PagoFactura; Type: TABLE; Schema: public; Owner: admin_portal
--

CREATE TABLE public."PagoFactura" (
    id integer NOT NULL,
    factura_id integer NOT NULL,
    fecha_pago timestamp(3) without time zone NOT NULL,
    importe numeric(15,2) NOT NULL,
    moneda public."Moneda" DEFAULT 'ARS'::public."Moneda" NOT NULL,
    medio_pago public."MedioPago" NOT NULL,
    referencia text,
    notas text,
    movimiento_id integer,
    echeq_id integer,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    deleted_at timestamp(3) without time zone,
    created_by integer
);


ALTER TABLE public."PagoFactura" OWNER TO admin_portal;

--
-- Name: PagoFactura_id_seq; Type: SEQUENCE; Schema: public; Owner: admin_portal
--

CREATE SEQUENCE public."PagoFactura_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."PagoFactura_id_seq" OWNER TO admin_portal;

--
-- Name: PagoFactura_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin_portal
--

ALTER SEQUENCE public."PagoFactura_id_seq" OWNED BY public."PagoFactura".id;


--
-- Name: PanolItem; Type: TABLE; Schema: public; Owner: admin_portal
--

CREATE TABLE public."PanolItem" (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    nombre text NOT NULL,
    descripcion text,
    tipo public."TipoPanolItem" NOT NULL,
    stock_total integer NOT NULL,
    stock_disponible integer NOT NULL,
    valor numeric(10,2),
    estado public."EstadoPanolItem" DEFAULT 'DISPONIBLE'::public."EstadoPanolItem" NOT NULL,
    notas text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    deleted_at timestamp(3) without time zone,
    created_by integer
);


ALTER TABLE public."PanolItem" OWNER TO admin_portal;

--
-- Name: PanolItem_id_seq; Type: SEQUENCE; Schema: public; Owner: admin_portal
--

CREATE SEQUENCE public."PanolItem_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."PanolItem_id_seq" OWNER TO admin_portal;

--
-- Name: PanolItem_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin_portal
--

ALTER SEQUENCE public."PanolItem_id_seq" OWNED BY public."PanolItem".id;


--
-- Name: ParteCCC; Type: TABLE; Schema: public; Owner: admin_portal
--

CREATE TABLE public."ParteCCC" (
    id integer NOT NULL,
    cuenta_ccc_id integer NOT NULL,
    nombre text NOT NULL,
    porcentaje numeric(5,2) NOT NULL
);


ALTER TABLE public."ParteCCC" OWNER TO admin_portal;

--
-- Name: ParteCCC_id_seq; Type: SEQUENCE; Schema: public; Owner: admin_portal
--

CREATE SEQUENCE public."ParteCCC_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."ParteCCC_id_seq" OWNER TO admin_portal;

--
-- Name: ParteCCC_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin_portal
--

ALTER SEQUENCE public."ParteCCC_id_seq" OWNED BY public."ParteCCC".id;


--
-- Name: ParteDiario; Type: TABLE; Schema: public; Owner: admin_portal
--

CREATE TABLE public."ParteDiario" (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    fecha timestamp(3) without time zone NOT NULL,
    titulo text,
    notas text,
    cerrado boolean DEFAULT false NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    deleted_at timestamp(3) without time zone,
    created_by integer
);


ALTER TABLE public."ParteDiario" OWNER TO admin_portal;

--
-- Name: ParteDiario_id_seq; Type: SEQUENCE; Schema: public; Owner: admin_portal
--

CREATE SEQUENCE public."ParteDiario_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."ParteDiario_id_seq" OWNER TO admin_portal;

--
-- Name: ParteDiario_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin_portal
--

ALTER SEQUENCE public."ParteDiario_id_seq" OWNED BY public."ParteDiario".id;


--
-- Name: PedidoComida; Type: TABLE; Schema: public; Owner: admin_portal
--

CREATE TABLE public."PedidoComida" (
    id integer NOT NULL,
    evento_id integer NOT NULL,
    empresa_id integer NOT NULL,
    fecha timestamp(3) without time zone NOT NULL,
    proveedor_id integer,
    proveedor_texto text,
    forma_pago text,
    notas text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    deleted_at timestamp(3) without time zone,
    created_by integer,
    updated_by integer
);


ALTER TABLE public."PedidoComida" OWNER TO admin_portal;

--
-- Name: PedidoComida_id_seq; Type: SEQUENCE; Schema: public; Owner: admin_portal
--

CREATE SEQUENCE public."PedidoComida_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."PedidoComida_id_seq" OWNER TO admin_portal;

--
-- Name: PedidoComida_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin_portal
--

ALTER SEQUENCE public."PedidoComida_id_seq" OWNED BY public."PedidoComida".id;


--
-- Name: PedidoItem; Type: TABLE; Schema: public; Owner: admin_portal
--

CREATE TABLE public."PedidoItem" (
    id integer NOT NULL,
    rubro_evento_id integer NOT NULL,
    cantidad numeric(10,2),
    descripcion text NOT NULL,
    dias_uso integer,
    horario_llegada text,
    horario_retiro text,
    observaciones text,
    orden integer DEFAULT 0 NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    deleted_at timestamp(3) without time zone
);


ALTER TABLE public."PedidoItem" OWNER TO admin_portal;

--
-- Name: PedidoItem_id_seq; Type: SEQUENCE; Schema: public; Owner: admin_portal
--

CREATE SEQUENCE public."PedidoItem_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."PedidoItem_id_seq" OWNER TO admin_portal;

--
-- Name: PedidoItem_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin_portal
--

ALTER SEQUENCE public."PedidoItem_id_seq" OWNED BY public."PedidoItem".id;


--
-- Name: PreMacro; Type: TABLE; Schema: public; Owner: admin_portal
--

CREATE TABLE public."PreMacro" (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    paso_actual integer DEFAULT 1 NOT NULL,
    completada boolean DEFAULT false NOT NULL,
    evento_id integer,
    nombre_evento text,
    tipo_evento text,
    descripcion text,
    para_que_es text,
    es_privado boolean DEFAULT false NOT NULL,
    fecha_inicio timestamp(3) without time zone,
    fecha_fin timestamp(3) without time zone,
    hora_inicio text,
    hora_fin text,
    lugar_nombre text,
    lugar_ciudad text,
    lugar_provincia text,
    lugar_direccion text,
    dias_montaje integer,
    dias_desmontaje integer,
    cliente_nombre text,
    razon_social text,
    cuit_pagador text,
    quien_lo_hace text,
    contacto_cliente text,
    telefono_cliente text,
    presupuesto_total numeric(12,2),
    moneda public."Moneda" DEFAULT 'ARS'::public."Moneda" NOT NULL,
    lleva_empleados boolean DEFAULT true NOT NULL,
    cantidad_estimada_staff integer,
    requiere_hospedaje boolean DEFAULT false NOT NULL,
    ciudad_hospedaje text,
    requiere_traslado boolean DEFAULT false NOT NULL,
    notas_traslado text,
    requiere_comidas boolean DEFAULT false NOT NULL,
    cantidad_dias_comida integer,
    observaciones_generales text,
    rubros_sugeridos jsonb,
    rubros_confirmados jsonb,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    deleted_at timestamp(3) without time zone,
    created_by integer
);


ALTER TABLE public."PreMacro" OWNER TO admin_portal;

--
-- Name: PreMacro_id_seq; Type: SEQUENCE; Schema: public; Owner: admin_portal
--

CREATE SEQUENCE public."PreMacro_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."PreMacro_id_seq" OWNER TO admin_portal;

--
-- Name: PreMacro_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin_portal
--

ALTER SEQUENCE public."PreMacro_id_seq" OWNED BY public."PreMacro".id;


--
-- Name: Producto; Type: TABLE; Schema: public; Owner: admin_portal
--

CREATE TABLE public."Producto" (
    id integer NOT NULL,
    nombre text NOT NULL,
    descripcion text,
    codigo_interno text,
    stock_total integer NOT NULL,
    stock_minimo integer DEFAULT 0 NOT NULL,
    unidad text DEFAULT 'unidad'::text NOT NULL,
    notas text,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    deleted_at timestamp(3) without time zone,
    created_by integer,
    updated_by integer,
    categoria_id integer,
    empresa_id integer NOT NULL,
    catalogo_origen text,
    codigo_externo text,
    es_critico boolean DEFAULT false NOT NULL,
    foto_data bytea,
    foto_mime text,
    foto_nombre text,
    nombre_interno text,
    nombre_tecnico text,
    valor_unitario numeric(10,2),
    peso_unitario numeric(8,3),
    espacio text,
    historial_stock jsonb,
    informe_situacion text
);


ALTER TABLE public."Producto" OWNER TO admin_portal;

--
-- Name: Producto_id_seq; Type: SEQUENCE; Schema: public; Owner: admin_portal
--

CREATE SEQUENCE public."Producto_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Producto_id_seq" OWNER TO admin_portal;

--
-- Name: Producto_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin_portal
--

ALTER SEQUENCE public."Producto_id_seq" OWNED BY public."Producto".id;


--
-- Name: Proveedor; Type: TABLE; Schema: public; Owner: admin_portal
--

CREATE TABLE public."Proveedor" (
    id integer NOT NULL,
    nombre text NOT NULL,
    alias text,
    cuit text,
    categoria text,
    notas text,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    deleted_at timestamp(3) without time zone,
    created_by integer,
    updated_by integer,
    empresa_id integer NOT NULL,
    telefono text
);


ALTER TABLE public."Proveedor" OWNER TO admin_portal;

--
-- Name: Proveedor_id_seq; Type: SEQUENCE; Schema: public; Owner: admin_portal
--

CREATE SEQUENCE public."Proveedor_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Proveedor_id_seq" OWNER TO admin_portal;

--
-- Name: Proveedor_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin_portal
--

ALTER SEQUENCE public."Proveedor_id_seq" OWNED BY public."Proveedor".id;


--
-- Name: Rubro; Type: TABLE; Schema: public; Owner: admin_portal
--

CREATE TABLE public."Rubro" (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    tipo public."TipoRubro" NOT NULL,
    nombre text NOT NULL,
    codigo text,
    descripcion text,
    orden integer NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    es_sistema boolean DEFAULT false NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    deleted_at timestamp(3) without time zone,
    created_by integer
);


ALTER TABLE public."Rubro" OWNER TO admin_portal;

--
-- Name: RubroEvento; Type: TABLE; Schema: public; Owner: admin_portal
--

CREATE TABLE public."RubroEvento" (
    id integer NOT NULL,
    evento_id integer NOT NULL,
    rubro_id integer NOT NULL,
    empresa_id integer NOT NULL,
    proveedor_id integer,
    estado public."EstadoRubroEvento" DEFAULT 'PENDIENTE'::public."EstadoRubroEvento" NOT NULL,
    contacto_nombre text,
    contacto_telefono text,
    contacto_cargo text,
    coordina_nombre text,
    fecha_ingreso timestamp(3) without time zone,
    fecha_retiro timestamp(3) without time zone,
    presupuesto numeric(12,2),
    moneda public."Moneda" DEFAULT 'ARS'::public."Moneda" NOT NULL,
    notas text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    deleted_at timestamp(3) without time zone,
    created_by integer,
    updated_by integer,
    cantidad_proveedor integer,
    cantidad_stock integer,
    usa_stock_propio boolean DEFAULT false NOT NULL
);


ALTER TABLE public."RubroEvento" OWNER TO admin_portal;

--
-- Name: RubroEvento_id_seq; Type: SEQUENCE; Schema: public; Owner: admin_portal
--

CREATE SEQUENCE public."RubroEvento_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."RubroEvento_id_seq" OWNER TO admin_portal;

--
-- Name: RubroEvento_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin_portal
--

ALTER SEQUENCE public."RubroEvento_id_seq" OWNED BY public."RubroEvento".id;


--
-- Name: Rubro_id_seq; Type: SEQUENCE; Schema: public; Owner: admin_portal
--

CREATE SEQUENCE public."Rubro_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Rubro_id_seq" OWNER TO admin_portal;

--
-- Name: Rubro_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin_portal
--

ALTER SEQUENCE public."Rubro_id_seq" OWNED BY public."Rubro".id;


--
-- Name: SocioPreMacro; Type: TABLE; Schema: public; Owner: admin_portal
--

CREATE TABLE public."SocioPreMacro" (
    id integer NOT NULL,
    pre_macro_id integer NOT NULL,
    nombre text NOT NULL,
    porcentaje numeric(5,2) NOT NULL
);


ALTER TABLE public."SocioPreMacro" OWNER TO admin_portal;

--
-- Name: SocioPreMacro_id_seq; Type: SEQUENCE; Schema: public; Owner: admin_portal
--

CREATE SEQUENCE public."SocioPreMacro_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."SocioPreMacro_id_seq" OWNER TO admin_portal;

--
-- Name: SocioPreMacro_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin_portal
--

ALTER SEQUENCE public."SocioPreMacro_id_seq" OWNED BY public."SocioPreMacro".id;


--
-- Name: TabConfig; Type: TABLE; Schema: public; Owner: admin_portal
--

CREATE TABLE public."TabConfig" (
    id integer NOT NULL,
    tipo public."Tipo" NOT NULL,
    numero integer NOT NULL,
    nombre text NOT NULL,
    codigo text NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    es_sistema boolean DEFAULT false NOT NULL,
    orden integer NOT NULL,
    empresa_id integer NOT NULL
);


ALTER TABLE public."TabConfig" OWNER TO admin_portal;

--
-- Name: TabConfig_id_seq; Type: SEQUENCE; Schema: public; Owner: admin_portal
--

CREATE SEQUENCE public."TabConfig_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."TabConfig_id_seq" OWNER TO admin_portal;

--
-- Name: TabConfig_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin_portal
--

ALTER SEQUENCE public."TabConfig_id_seq" OWNED BY public."TabConfig".id;


--
-- Name: Usuario; Type: TABLE; Schema: public; Owner: admin_portal
--

CREATE TABLE public."Usuario" (
    id integer NOT NULL,
    email text NOT NULL,
    nombre text NOT NULL,
    password_hash text NOT NULL,
    rol public."Rol" DEFAULT 'OPERADOR'::public."Rol" NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    deleted_at timestamp(3) without time zone,
    empresa_id integer,
    apodo text,
    telefono text,
    areas_macro text[],
    puede_ver_macro boolean DEFAULT false NOT NULL
);


ALTER TABLE public."Usuario" OWNER TO admin_portal;

--
-- Name: UsuarioEmpresaAcceso; Type: TABLE; Schema: public; Owner: admin_portal
--

CREATE TABLE public."UsuarioEmpresaAcceso" (
    id integer NOT NULL,
    usuario_id integer NOT NULL,
    empresa_id integer NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by integer
);


ALTER TABLE public."UsuarioEmpresaAcceso" OWNER TO admin_portal;

--
-- Name: UsuarioEmpresaAcceso_id_seq; Type: SEQUENCE; Schema: public; Owner: admin_portal
--

CREATE SEQUENCE public."UsuarioEmpresaAcceso_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."UsuarioEmpresaAcceso_id_seq" OWNER TO admin_portal;

--
-- Name: UsuarioEmpresaAcceso_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin_portal
--

ALTER SEQUENCE public."UsuarioEmpresaAcceso_id_seq" OWNED BY public."UsuarioEmpresaAcceso".id;


--
-- Name: Usuario_id_seq; Type: SEQUENCE; Schema: public; Owner: admin_portal
--

CREATE SEQUENCE public."Usuario_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Usuario_id_seq" OWNER TO admin_portal;

--
-- Name: Usuario_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin_portal
--

ALTER SEQUENCE public."Usuario_id_seq" OWNED BY public."Usuario".id;


--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: admin_portal
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public._prisma_migrations OWNER TO admin_portal;

--
-- Name: Activo id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."Activo" ALTER COLUMN id SET DEFAULT nextval('public."Activo_id_seq"'::regclass);


--
-- Name: Anticipo id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."Anticipo" ALTER COLUMN id SET DEFAULT nextval('public."Anticipo_id_seq"'::regclass);


--
-- Name: AsignacionDiaria id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."AsignacionDiaria" ALTER COLUMN id SET DEFAULT nextval('public."AsignacionDiaria_id_seq"'::regclass);


--
-- Name: AsignacionStock id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."AsignacionStock" ALTER COLUMN id SET DEFAULT nextval('public."AsignacionStock_id_seq"'::regclass);


--
-- Name: AuditoriaLog id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."AuditoriaLog" ALTER COLUMN id SET DEFAULT nextval('public."AuditoriaLog_id_seq"'::regclass);


--
-- Name: Camion id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."Camion" ALTER COLUMN id SET DEFAULT nextval('public."Camion_id_seq"'::regclass);


--
-- Name: CategoriaStock id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."CategoriaStock" ALTER COLUMN id SET DEFAULT nextval('public."CategoriaStock_id_seq"'::regclass);


--
-- Name: CuentaBancaria id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."CuentaBancaria" ALTER COLUMN id SET DEFAULT nextval('public."CuentaBancaria_id_seq"'::regclass);


--
-- Name: CuentaCorriente id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."CuentaCorriente" ALTER COLUMN id SET DEFAULT nextval('public."CuentaCorriente_id_seq"'::regclass);


--
-- Name: Cuna id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."Cuna" ALTER COLUMN id SET DEFAULT nextval('public."Cuna_id_seq"'::regclass);


--
-- Name: CunaProducto id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."CunaProducto" ALTER COLUMN id SET DEFAULT nextval('public."CunaProducto_id_seq"'::regclass);


--
-- Name: Echeq id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."Echeq" ALTER COLUMN id SET DEFAULT nextval('public."Echeq_id_seq"'::regclass);


--
-- Name: Empleado id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."Empleado" ALTER COLUMN id SET DEFAULT nextval('public."Empleado_id_seq"'::regclass);


--
-- Name: Empresa id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."Empresa" ALTER COLUMN id SET DEFAULT nextval('public."Empresa_id_seq"'::regclass);


--
-- Name: Evento id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."Evento" ALTER COLUMN id SET DEFAULT nextval('public."Evento_id_seq"'::regclass);


--
-- Name: EventoAcceso id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."EventoAcceso" ALTER COLUMN id SET DEFAULT nextval('public."EventoAcceso_id_seq"'::regclass);


--
-- Name: EventoCuenta id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."EventoCuenta" ALTER COLUMN id SET DEFAULT nextval('public."EventoCuenta_id_seq"'::regclass);


--
-- Name: Factura id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."Factura" ALTER COLUMN id SET DEFAULT nextval('public."Factura_id_seq"'::regclass);


--
-- Name: Jornada id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."Jornada" ALTER COLUMN id SET DEFAULT nextval('public."Jornada_id_seq"'::regclass);


--
-- Name: LineaComida id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."LineaComida" ALTER COLUMN id SET DEFAULT nextval('public."LineaComida_id_seq"'::regclass);


--
-- Name: Liquidacion id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."Liquidacion" ALTER COLUMN id SET DEFAULT nextval('public."Liquidacion_id_seq"'::regclass);


--
-- Name: Movimiento id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."Movimiento" ALTER COLUMN id SET DEFAULT nextval('public."Movimiento_id_seq"'::regclass);


--
-- Name: MovimientoCCC id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."MovimientoCCC" ALTER COLUMN id SET DEFAULT nextval('public."MovimientoCCC_id_seq"'::regclass);


--
-- Name: MovimientoCaja id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."MovimientoCaja" ALTER COLUMN id SET DEFAULT nextval('public."MovimientoCaja_id_seq"'::regclass);


--
-- Name: MovimientoPanol id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."MovimientoPanol" ALTER COLUMN id SET DEFAULT nextval('public."MovimientoPanol_id_seq"'::regclass);


--
-- Name: MovimientoStock id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."MovimientoStock" ALTER COLUMN id SET DEFAULT nextval('public."MovimientoStock_id_seq"'::regclass);


--
-- Name: PagoFactura id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."PagoFactura" ALTER COLUMN id SET DEFAULT nextval('public."PagoFactura_id_seq"'::regclass);


--
-- Name: PanolItem id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."PanolItem" ALTER COLUMN id SET DEFAULT nextval('public."PanolItem_id_seq"'::regclass);


--
-- Name: ParteCCC id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."ParteCCC" ALTER COLUMN id SET DEFAULT nextval('public."ParteCCC_id_seq"'::regclass);


--
-- Name: ParteDiario id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."ParteDiario" ALTER COLUMN id SET DEFAULT nextval('public."ParteDiario_id_seq"'::regclass);


--
-- Name: PedidoComida id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."PedidoComida" ALTER COLUMN id SET DEFAULT nextval('public."PedidoComida_id_seq"'::regclass);


--
-- Name: PedidoItem id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."PedidoItem" ALTER COLUMN id SET DEFAULT nextval('public."PedidoItem_id_seq"'::regclass);


--
-- Name: PreMacro id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."PreMacro" ALTER COLUMN id SET DEFAULT nextval('public."PreMacro_id_seq"'::regclass);


--
-- Name: Producto id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."Producto" ALTER COLUMN id SET DEFAULT nextval('public."Producto_id_seq"'::regclass);


--
-- Name: Proveedor id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."Proveedor" ALTER COLUMN id SET DEFAULT nextval('public."Proveedor_id_seq"'::regclass);


--
-- Name: Rubro id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."Rubro" ALTER COLUMN id SET DEFAULT nextval('public."Rubro_id_seq"'::regclass);


--
-- Name: RubroEvento id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."RubroEvento" ALTER COLUMN id SET DEFAULT nextval('public."RubroEvento_id_seq"'::regclass);


--
-- Name: SocioPreMacro id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."SocioPreMacro" ALTER COLUMN id SET DEFAULT nextval('public."SocioPreMacro_id_seq"'::regclass);


--
-- Name: TabConfig id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."TabConfig" ALTER COLUMN id SET DEFAULT nextval('public."TabConfig_id_seq"'::regclass);


--
-- Name: Usuario id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."Usuario" ALTER COLUMN id SET DEFAULT nextval('public."Usuario_id_seq"'::regclass);


--
-- Name: UsuarioEmpresaAcceso id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."UsuarioEmpresaAcceso" ALTER COLUMN id SET DEFAULT nextval('public."UsuarioEmpresaAcceso_id_seq"'::regclass);


--
-- Data for Name: Activo; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."Activo" (id, empresa_id, nombre, descripcion, categoria, numero_serie, fecha_compra, valor_compra, estado, ubicacion, observaciones, created_at, updated_at, deleted_at, created_by) FROM stdin;
\.


--
-- Data for Name: Anticipo; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."Anticipo" (id, empleado_id, empresa_id, tipo, monto, fecha, motivo, descontado, liquidacion_id, created_at, created_by) FROM stdin;
\.


--
-- Data for Name: AsignacionDiaria; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."AsignacionDiaria" (id, parte_diario_id, empleado_id, empresa_id, estado, hora_ingreso, lugar, tarea, seccion, orden, camion_id, vehiculo_texto, evento_id, hora_salida, hora_salida_fija, jornada_id, created_at, updated_at, deleted_at) FROM stdin;
\.


--
-- Data for Name: AsignacionStock; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."AsignacionStock" (id, producto_id, evento_id, cantidad, fecha_salida, fecha_retorno, ubicacion, estado, origen, evento_origen_id, notas, created_at, updated_at, deleted_at, created_by, updated_by, camion_id, cantidad_excedente, cuna_id, firmado_llegada, firmado_llegada_at, firmado_llegada_por, firmado_retorno, firmado_retorno_at, firmado_retorno_por, firmado_salida, firmado_salida_at, firmado_salida_por, rubro_evento_id) FROM stdin;
\.


--
-- Data for Name: AuditoriaLog; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."AuditoriaLog" (id, usuario_id, accion, entidad, entidad_id, evento_id, descripcion, datos_antes, datos_despues, ip, created_at, empresa_id) FROM stdin;
\.


--
-- Data for Name: Camion; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."Camion" (id, empresa_id, codigo, descripcion, patente, tipo, activo, created_at, updated_at, deleted_at) FROM stdin;
\.


--
-- Data for Name: CategoriaStock; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."CategoriaStock" (id, nombre, descripcion, color, activo, created_at, updated_at, deleted_at, created_by, empresa_id) FROM stdin;
1	Audio	\N	#3B82F6	t	2026-08-24 17:53:40.907	2026-08-24 17:53:40.907	\N	\N	1
2	Iluminación	\N	#F59E0B	t	2026-08-24 17:53:40.907	2026-08-24 17:53:40.907	\N	\N	1
3	Escenario	\N	#8B5CF6	t	2026-08-24 17:53:40.907	2026-08-24 17:53:40.907	\N	\N	1
4	Mobiliario	\N	#10B981	t	2026-08-24 17:53:40.907	2026-08-24 17:53:40.907	\N	\N	1
5	Transporte	\N	#6366F1	t	2026-08-24 17:53:40.907	2026-08-24 17:53:40.907	\N	\N	1
6	Energía	\N	#EF4444	t	2026-08-24 17:53:40.907	2026-08-24 17:53:40.907	\N	\N	1
7	Seguridad	\N	#64748B	t	2026-08-24 17:53:40.907	2026-08-24 17:53:40.907	\N	\N	1
8	Utilería	\N	#EC4899	t	2026-08-24 17:53:40.907	2026-08-24 17:53:40.907	\N	\N	1
\.


--
-- Data for Name: CuentaBancaria; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."CuentaBancaria" (id, evento_id, nombre, tipo, moneda, saldo_inicial, created_at, updated_at, deleted_at, empresa_id, estado, fecha_apertura, fecha_cierre, notas_rendicion, responsable_id, saldo_minimo) FROM stdin;
1	\N	Caja General DOS57	EFECTIVO	ARS	0.00	2026-08-25 01:47:41.111	2026-08-25 01:47:41.111	\N	2	ABIERTA	\N	\N	\N	\N	\N
2	\N	Caja Reserva	EFECTIVO	ARS	0.00	2026-08-25 01:47:41.121	2026-08-25 01:47:41.121	\N	2	ABIERTA	\N	\N	\N	\N	\N
3	\N	Caja Pollo	EFECTIVO	ARS	0.00	2026-08-25 01:47:41.127	2026-08-25 01:47:41.127	\N	2	ABIERTA	\N	\N	\N	\N	\N
4	\N	Caja Jazmín	EFECTIVO	ARS	0.00	2026-08-25 01:47:41.132	2026-08-25 01:47:41.132	\N	2	ABIERTA	\N	\N	\N	\N	\N
\.


--
-- Data for Name: CuentaCorriente; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."CuentaCorriente" (id, empresa_id, tipo_tercero, proveedor_id, tercero_nombre, tercero_cuit, nombre, descripcion, activa, saldo_actual, tiene_reparto, created_at, updated_at, deleted_at, created_by, updated_by, moneda) FROM stdin;
\.


--
-- Data for Name: Cuna; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."Cuna" (id, empresa_id, codigo, descripcion, activo, created_at, updated_at, deleted_at) FROM stdin;
\.


--
-- Data for Name: CunaProducto; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."CunaProducto" (id, cuna_id, producto_id, cantidad) FROM stdin;
\.


--
-- Data for Name: Echeq; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."Echeq" (id, evento_id, movimiento_id, movimiento_caja_id, numero, razon_social, detalle, importe, moneda, estado, fecha_emision, fecha_cobro_estimada, fecha_cobro_real, created_at, updated_at, deleted_at, created_by, updated_by, motivo_rechazo, proveedor_id, monto_ars, tasa_cambio) FROM stdin;
\.


--
-- Data for Name: Empleado; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."Empleado" (id, empresa_id, nombre, apellido, dni, cuit, email, telefono, domicilio, cbu, alias, banco, categoria, valor_hora, valor_hora_extra, estado, notas, usuario_id, created_at, updated_at, deleted_at, created_by, tipo_liquidacion, valor_jornada_completa, valor_media_jornada, umbral_horas_jornada, umbral_horas_media, valor_hora_extra_jornada, valor_viaje, apodo, fecha_nacimiento, grupo_sanguineo, contacto_emergencia_nombre, contacto_emergencia_tel, escalafon, art, licencia_conducir, equipamiento_asignado, talle_pantalon, talle_remera, talle_buzo, talle_calzado, contacto_emergencia_tel2, tipo_contratacion) FROM stdin;
1	2	Gonzalo Daniel	Arias	\N	20-38160996-1	\N	3541-288005	Dorrego 2281 Santa Maria Punilla	\N	\N	\N	OTRO	0.00	0.00	ACTIVO	\N	\N	2026-08-25 00:41:22.113	2026-08-25 00:41:22.113	\N	\N	LINEAL	\N	\N	\N	\N	\N	\N	Gonzalo	1994-09-07 00:00:00	A+	madre Flores Nora	3541-331614	\N	\N	f	\N	42	L	L	43	\N	FEDERAL PATRONAL (AP)
2	2	Rodrigo Agustin	Altamirano	\N	23-43695082-9	\N	351-4594693	Pedro Ferre 6114 B° San Javier	\N	\N	\N	OTRO	0.00	0.00	ACTIVO	\N	\N	2026-08-25 00:41:22.127	2026-08-25 00:41:22.127	\N	\N	LINEAL	\N	\N	\N	\N	\N	\N	Agustin	2001-10-27 00:00:00	A+	tia Soledad	351-2968709	\N	\N	f	\N	42	L	XL	39	\N	SANCOR
3	2	Denis Roger	Celiz	\N	20-36145011-7	\N	3513917181	Pje. Albert Sabin Lote 3 B° Las Acacias Complejo	\N	\N	\N	OTRO	0.00	0.00	ACTIVO	\N	\N	2026-08-25 00:41:22.14	2026-08-25 00:41:22.14	\N	\N	LINEAL	\N	\N	\N	\N	\N	\N	Fausto	1991-12-03 00:00:00	A+	Mamá Susana	3513923699	3	\N	f	\N	50	XL	XL	41	\N	ART
4	2	Jonathan	Checa	\N	\N	\N	\N	\N	\N	\N	\N	OTRO	0.00	0.00	ACTIVO	\N	\N	2026-08-25 00:41:22.152	2026-08-25 00:41:22.152	\N	\N	LINEAL	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	f	\N	\N	L	\N	\N	\N	\N
5	2	Mauricio	Destefanis	\N	20-44475677-3	\N	3516525371	Obispo Angeleli mza 18 lote 12	\N	\N	\N	OTRO	0.00	0.00	ACTIVO	\N	\N	2026-08-25 00:41:22.16	2026-08-25 00:41:22.16	\N	\N	LINEAL	\N	\N	\N	\N	\N	\N	Mauri	2002-09-05 00:00:00	0+	madre Ma. Celeste	3513504427	4	\N	f	\N	44	XL	XXL	43	\N	SANCOR
6	2	Milton Jonathan	Diaz	\N	20-45832853-7	\N	351-8659700	Doroteo Robles 5244	\N	\N	\N	OTRO	0.00	0.00	ACTIVO	\N	\N	2026-08-25 00:41:22.171	2026-08-25 00:41:22.171	\N	\N	LINEAL	\N	\N	\N	\N	\N	\N	\N	2004-07-20 00:00:00	\N	madre Emilse	351-5133323	5	\N	f	\N	44	M	L	40	\N	SANCOR
7	2	Nestor Ramon	Flores	\N	20-29841442-3	\N	3541-621850	Miguel de Vocos 50 B°Tillar Sta. Maria Punilla	\N	\N	\N	OTRO	0.00	0.00	ACTIVO	\N	\N	2026-08-25 00:41:22.187	2026-08-25 00:41:22.187	\N	\N	LINEAL	\N	\N	\N	\N	\N	\N	Nestor	1982-05-30 00:00:00	0+	esposa Laura	3541-685002	\N	\N	f	\N	44	L	L	39	\N	FEDERAL PATRONAL (AP)
8	2	Matias	Flores	\N	\N	\N	\N	\N	\N	\N	\N	OTRO	0.00	0.00	ACTIVO	\N	\N	2026-08-25 00:41:22.201	2026-08-25 00:41:22.201	\N	\N	LINEAL	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	f	\N	48	XXL	XXL	\N	\N	\N
9	2	Maldonado Roberto	Garcia	\N	20-32572934-2	\N	3515153712	Copacabana 485 B° San Martin	\N	\N	\N	OTRO	0.00	0.00	ACTIVO	\N	\N	2026-08-25 00:41:22.21	2026-08-25 00:41:22.21	\N	\N	LINEAL	\N	\N	\N	\N	\N	\N	Rober	1987-05-24 00:00:00	\N	Hna Leonela	3513118619	3	\N	f	\N	46	XL	XL	42	\N	ART
10	2	Lorena	Herrera	\N	27-30474212-2	\N	351-6172390	Manzana 90 casa 3 B°16 de Noviembre	\N	\N	\N	OTRO	0.00	0.00	ACTIVO	\N	\N	2026-08-25 00:41:22.223	2026-08-25 00:41:22.223	\N	\N	LINEAL	\N	\N	\N	\N	\N	\N	Lore	1983-11-10 00:00:00	0+	hija Agostina	351-8087194	3	\N	f	\N	44	L	L	37	\N	ART
11	2	Gerardo	Machado	\N	20-42473547-8	\N	351-7696816	Garcia de Sequeira 5715 B° Ferreyra	\N	\N	\N	OTRO	0.00	0.00	ACTIVO	\N	\N	2026-08-25 00:41:22.237	2026-08-25 00:41:22.237	\N	\N	LINEAL	\N	\N	\N	\N	\N	\N	\N	1986-01-04 00:00:00	\N	esposa Romina	351-5556660	3	\N	f	\N	48	XL	XXL	43	\N	SANCOR
12	2	Gabriel	Mora	\N	\N	\N	\N	\N	\N	\N	\N	OTRO	0.00	0.00	ACTIVO	\N	\N	2026-08-25 00:41:22.252	2026-08-25 00:41:22.252	\N	\N	LINEAL	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	f	\N	\N	L	L	\N	\N	\N
13	2	Ezequiel Leandro	Navarro	\N	20-39623762-9	\N	351-2096639	Mza 17 casa 3 B°Villa Boedo	\N	\N	\N	OTRO	0.00	0.00	ACTIVO	\N	\N	2026-08-25 00:41:22.266	2026-08-25 00:41:22.266	\N	\N	LINEAL	\N	\N	\N	\N	\N	\N	Leandro	1994-04-01 00:00:00	0+	madre Luisa	4500423	\N	\N	f	\N	50	XXXL	XXXL	41	\N	SANCOR
14	2	Enzo	Ochoa	\N	\N	\N	\N	\N	\N	\N	\N	OTRO	0.00	0.00	ACTIVO	\N	\N	2026-08-25 00:41:22.28	2026-08-25 00:41:22.28	\N	\N	LINEAL	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	f	\N	48	XXL	XXL	45	\N	\N
15	2	Cristina Andrea	Olivetto	\N	27-22793039-5	\N	3512213138	Los Talas 450 Comuna San Roque	\N	\N	\N	OTRO	0.00	0.00	ACTIVO	\N	\N	2026-08-25 00:41:22.295	2026-08-25 00:41:22.295	\N	\N	LINEAL	\N	\N	\N	\N	\N	\N	Andre	1972-09-21 00:00:00	A+	Hijo Ignacio	3516968711	3	\N	f	\N	44	L	L	37	\N	ART
16	2	Patricio	Ortolanis	\N	\N	\N	\N	\N	\N	\N	\N	OTRO	0.00	0.00	ACTIVO	\N	\N	2026-08-25 00:41:22.308	2026-08-25 00:41:22.308	\N	\N	LINEAL	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	f	\N	46	XXL	XXL	\N	\N	\N
17	2	Mayra	Ontivero	\N	\N	\N	\N	\N	\N	\N	\N	OTRO	0.00	0.00	ACTIVO	\N	\N	2026-08-25 00:41:22.323	2026-08-25 00:41:22.323	\N	\N	LINEAL	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	f	\N	S	XS	XS	\N	\N	\N
18	2	Manuel	Rodriguez	\N	20-23194091-0	\N	3513625859	Luna y Cardenas 3344 B° Alto Alberdi	\N	\N	\N	OTRO	0.00	0.00	ACTIVO	\N	\N	2026-08-25 00:41:22.339	2026-08-25 00:41:22.339	\N	\N	LINEAL	\N	\N	\N	\N	\N	\N	Manolo	1973-01-07 00:00:00	\N	esposa Romina	3516619042	\N	\N	f	\N	50	XXL	XXL	42	\N	SANCOR
19	2	Damian	Santillan	\N	20-36234439-6	\N	3515192452	De Los Catalanes 4248 B° Los Boulevares	\N	\N	\N	OTRO	0.00	0.00	ACTIVO	\N	\N	2026-08-25 00:41:22.352	2026-08-25 00:41:22.352	\N	\N	LINEAL	\N	\N	\N	\N	\N	\N	Pola	1992-04-12 00:00:00	\N	Papá Antonio	3515930162	3	\N	f	\N	46	XL	XL	41	\N	FEDERAL PATRONAL (AP)
20	2	Fabrizio	Sosa	\N	\N	\N	\N	\N	\N	\N	\N	OTRO	0.00	0.00	ACTIVO	\N	\N	2026-08-25 00:41:22.361	2026-08-25 00:41:22.361	\N	\N	LINEAL	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	f	\N	42	L	L	38	\N	\N
21	2	Antonio Javier	Velez	\N	20-34688648-0	\N	3516113507	Aviador Kingsley 2426	\N	\N	\N	OTRO	0.00	0.00	ACTIVO	\N	\N	2026-08-25 00:41:22.375	2026-08-25 00:41:22.375	\N	\N	LINEAL	\N	\N	\N	\N	\N	\N	Toni	1989-07-10 00:00:00	\N	Mamá Ana Maria	4667705	3	\N	f	\N	46	XL	XL	42	\N	ART
22	2	Jazmin	Valdivia	\N	27-41993007-0	\N	351-5946637	Santa Rosa 2010	\N	\N	\N	OTRO	0.00	0.00	ACTIVO	\N	\N	2026-08-25 00:41:22.384	2026-08-25 00:41:22.384	\N	\N	LINEAL	\N	\N	\N	\N	\N	\N	Jaz	1999-06-08 00:00:00	A+	madre Gabriela	351-5121623	\N	\N	f	\N	42/44	S	M	38	\N	SANCOR
23	2	Manuel	Valencia	\N	\N	\N	\N	\N	\N	\N	\N	OTRO	0.00	0.00	ACTIVO	\N	\N	2026-08-25 00:41:22.394	2026-08-25 00:41:22.394	\N	\N	LINEAL	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	f	\N	40	L	XL	\N	\N	\N
24	2	Juan Matias	Vessoni	\N	20-28654907-2	\N	3517068675	Paso de Uspallata 1313 Dpto 1	\N	\N	\N	OTRO	0.00	0.00	ACTIVO	\N	\N	2026-08-25 00:41:22.404	2026-08-25 00:41:22.404	\N	\N	LINEAL	\N	\N	\N	\N	\N	\N	Furia	1979-08-20 00:00:00	A+	Esposa Cintia	3517586085	2	\N	f	\N	48	XXL	XXL	41	\N	ART
\.


--
-- Data for Name: Empresa; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."Empresa" (id, nombre, nombre_corto, cuit, domicilio, logo_url, color_primario, activo, created_at, updated_at, color_secundario, email, logo_data, logo_mime, logo_nombre, moneda_default, razon_social, telefono, timezone, updated_by, web) FROM stdin;
1	Enjoy Producciones	Enjoy	\N	\N	\N	#1E3A5F	t	2026-08-24 17:53:40.985	2026-08-24 17:53:40.985	\N	\N	\N	\N	\N	ARS	\N	\N	America/Argentina/Buenos_Aires	\N	\N
2	DOS57 Estructuras	DOS57	\N	\N	\N	#065F46	t	2026-08-24 17:53:40.985	2026-08-24 17:53:40.985	\N	\N	\N	\N	\N	ARS	\N	\N	America/Argentina/Buenos_Aires	\N	\N
\.


--
-- Data for Name: Evento; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."Evento" (id, nombre, fecha_inicio, fecha_fin, estado, socios, moneda_base, created_at, updated_at, deleted_at, created_by, updated_by, empresa_id, dias_desmontaje, dias_montaje) FROM stdin;
\.


--
-- Data for Name: EventoAcceso; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."EventoAcceso" (id, usuario_id, evento_id, rol, created_at, created_by) FROM stdin;
\.


--
-- Data for Name: EventoCuenta; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."EventoCuenta" (id, evento_id, cuenta_id, created_at, created_by) FROM stdin;
\.


--
-- Data for Name: Factura; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."Factura" (id, numero_factura, tipo_factura, fecha_emision, fecha_vencimiento, proveedor_id, evento_id, tab_numero, tipo_movimiento, importe_total, importe_pagado, importe_pendiente, moneda, condicion_pago, estado, notas, pdf_data, pdf_nombre, pdf_mime_type, pdf_tamanio, created_at, updated_at, deleted_at, created_by, updated_by, empresa_id, rubro_id, monto_ars, tasa_cambio) FROM stdin;
\.


--
-- Data for Name: Jornada; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."Jornada" (id, empleado_id, evento_id, empresa_id, fecha, hora_convocatoria, hora_ingreso, hora_egreso, horas_normales, horas_extras, descripcion, estado, motivo_rechazo, created_at, updated_at, deleted_at, created_by, aprobado_por, aprobado_at, cantidad_viajes, convocatoria, lugar_trabajo, camion_id) FROM stdin;
\.


--
-- Data for Name: LineaComida; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."LineaComida" (id, pedido_comida_id, tipo, area, cantidad, valor_unitario, detalle, created_at, updated_at, deleted_at) FROM stdin;
\.


--
-- Data for Name: Liquidacion; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."Liquidacion" (id, empleado_id, empresa_id, evento_id, fecha_desde, fecha_hasta, horas_normales, horas_extras, valor_hora, valor_hora_extra, subtotal_horas, total_anticipos, total_descuentos, total_a_cobrar, estado, observaciones, movimiento_id, created_at, updated_at, aprobado_por, aprobado_at, tipo_liquidacion) FROM stdin;
\.


--
-- Data for Name: Movimiento; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."Movimiento" (id, evento_id, tipo, tab_numero, fecha, concepto, descripcion, debe, haber, saldo, moneda, orden, impuesto_subcategoria, movimiento_caja_id, created_at, updated_at, deleted_at, created_by, updated_by, proveedor_id, avisado_proveedor, costo_real, estado_movimiento, fecha_pago, presupuesto, responsable_id, rubro_id, monto_ars, tasa_cambio) FROM stdin;
\.


--
-- Data for Name: MovimientoCCC; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."MovimientoCCC" (id, cuenta_ccc_id, empresa_id, tipo, fecha, concepto, descripcion, monto, tasa_cambio, monto_ars, saldo, factura_id, evento_id, documento_data, documento_nombre, documento_mime, documento_tamanio, created_at, updated_at, deleted_at, created_by, updated_by, moneda) FROM stdin;
\.


--
-- Data for Name: MovimientoCaja; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."MovimientoCaja" (id, cuenta_id, fecha, descripcion, debe, haber, saldo_corriente, orden, created_at, updated_at, deleted_at, created_by, updated_by, transferencia_par_id, evento_id, moneda, monto_ars, tasa_cambio) FROM stdin;
\.


--
-- Data for Name: MovimientoPanol; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."MovimientoPanol" (id, empresa_id, panol_item_id, tipo, cantidad, evento_id, responsable_id, responsable_nombre, fecha, descripcion, cantidad_devuelta, cantidad_faltante, motivo_faltante, devolucion_at, created_at, updated_at, created_by) FROM stdin;
\.


--
-- Data for Name: MovimientoStock; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."MovimientoStock" (id, producto_id, asignacion_id, tipo, cantidad, evento_origen_id, evento_destino_id, fecha, descripcion, created_at, created_by) FROM stdin;
\.


--
-- Data for Name: PagoFactura; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."PagoFactura" (id, factura_id, fecha_pago, importe, moneda, medio_pago, referencia, notas, movimiento_id, echeq_id, created_at, updated_at, deleted_at, created_by) FROM stdin;
\.


--
-- Data for Name: PanolItem; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."PanolItem" (id, empresa_id, nombre, descripcion, tipo, stock_total, stock_disponible, valor, estado, notas, created_at, updated_at, deleted_at, created_by) FROM stdin;
\.


--
-- Data for Name: ParteCCC; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."ParteCCC" (id, cuenta_ccc_id, nombre, porcentaje) FROM stdin;
\.


--
-- Data for Name: ParteDiario; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."ParteDiario" (id, empresa_id, fecha, titulo, notas, cerrado, created_at, updated_at, deleted_at, created_by) FROM stdin;
\.


--
-- Data for Name: PedidoComida; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."PedidoComida" (id, evento_id, empresa_id, fecha, proveedor_id, proveedor_texto, forma_pago, notas, created_at, updated_at, deleted_at, created_by, updated_by) FROM stdin;
\.


--
-- Data for Name: PedidoItem; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."PedidoItem" (id, rubro_evento_id, cantidad, descripcion, dias_uso, horario_llegada, horario_retiro, observaciones, orden, created_at, updated_at, deleted_at) FROM stdin;
\.


--
-- Data for Name: PreMacro; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."PreMacro" (id, empresa_id, paso_actual, completada, evento_id, nombre_evento, tipo_evento, descripcion, para_que_es, es_privado, fecha_inicio, fecha_fin, hora_inicio, hora_fin, lugar_nombre, lugar_ciudad, lugar_provincia, lugar_direccion, dias_montaje, dias_desmontaje, cliente_nombre, razon_social, cuit_pagador, quien_lo_hace, contacto_cliente, telefono_cliente, presupuesto_total, moneda, lleva_empleados, cantidad_estimada_staff, requiere_hospedaje, ciudad_hospedaje, requiere_traslado, notas_traslado, requiere_comidas, cantidad_dias_comida, observaciones_generales, rubros_sugeridos, rubros_confirmados, created_at, updated_at, deleted_at, created_by) FROM stdin;
\.


--
-- Data for Name: Producto; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."Producto" (id, nombre, descripcion, codigo_interno, stock_total, stock_minimo, unidad, notas, activo, created_at, updated_at, deleted_at, created_by, updated_by, categoria_id, empresa_id, catalogo_origen, codigo_externo, es_critico, foto_data, foto_mime, foto_nombre, nombre_interno, nombre_tecnico, valor_unitario, peso_unitario, espacio, historial_stock, informe_situacion) FROM stdin;
\.


--
-- Data for Name: Proveedor; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."Proveedor" (id, nombre, alias, cuit, categoria, notas, activo, created_at, updated_at, deleted_at, created_by, updated_by, empresa_id, telefono) FROM stdin;
\.


--
-- Data for Name: Rubro; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."Rubro" (id, empresa_id, tipo, nombre, codigo, descripcion, orden, activo, es_sistema, created_at, updated_at, deleted_at, created_by) FROM stdin;
3	1	EGRESO	Cerramiento	\N	\N	3	t	t	2026-08-25 00:41:07.674	2026-08-25 01:47:50.792	\N	\N
4	1	EGRESO	Vallas	\N	\N	4	t	t	2026-08-25 00:41:07.679	2026-08-25 01:47:50.795	\N	\N
5	1	EGRESO	Sonido	\N	\N	5	t	t	2026-08-25 00:41:07.683	2026-08-25 01:47:50.799	\N	\N
6	1	EGRESO	Luces	\N	\N	6	t	t	2026-08-25 00:41:07.688	2026-08-25 01:47:50.803	\N	\N
7	1	EGRESO	Pantalla	\N	\N	7	t	t	2026-08-25 00:41:07.694	2026-08-25 01:47:50.807	\N	\N
8	1	EGRESO	FX	\N	\N	8	t	t	2026-08-25 00:41:07.698	2026-08-25 01:47:50.812	\N	\N
10	1	EGRESO	Baños químicos	\N	\N	10	t	t	2026-08-25 00:41:07.706	2026-08-25 01:47:50.82	\N	\N
11	1	EGRESO	Contenedor Oficina	\N	\N	11	t	t	2026-08-25 00:41:07.711	2026-08-25 01:47:50.824	\N	\N
12	1	EGRESO	Baños VIP	\N	\N	12	t	t	2026-08-25 00:41:07.716	2026-08-25 01:47:50.828	\N	\N
13	1	EGRESO	Backline	\N	\N	13	t	t	2026-08-25 00:41:07.72	2026-08-25 01:47:50.832	\N	\N
14	1	EGRESO	Mobiliario	\N	\N	14	t	t	2026-08-25 00:41:07.724	2026-08-25 01:47:50.836	\N	\N
15	1	EGRESO	Catering	\N	\N	15	t	t	2026-08-25 00:41:07.729	2026-08-25 01:47:50.841	\N	\N
16	1	EGRESO	Carpas	\N	\N	16	t	t	2026-08-25 00:41:07.737	2026-08-25 01:47:50.845	\N	\N
17	1	EGRESO	Puesto de hidratación	\N	\N	17	t	t	2026-08-25 00:41:07.744	2026-08-25 01:47:50.848	\N	\N
18	1	EGRESO	Seguridad privada	\N	\N	18	t	t	2026-08-25 00:41:07.754	2026-08-25 01:47:50.853	\N	\N
19	1	EGRESO	Sereno	\N	\N	19	t	t	2026-08-25 00:41:07.76	2026-08-25 01:47:50.857	\N	\N
20	1	EGRESO	Jefe de seguridad	\N	\N	20	t	t	2026-08-25 00:41:07.767	2026-08-25 01:47:50.862	\N	\N
21	1	EGRESO	Generador	\N	\N	21	t	t	2026-08-25 00:41:07.775	2026-08-25 01:47:50.867	\N	\N
22	1	EGRESO	Distribución de energía	\N	\N	22	t	t	2026-08-25 00:41:07.782	2026-08-25 01:47:50.871	\N	\N
23	1	EGRESO	Camiones/Logística	\N	\N	23	t	t	2026-08-25 00:41:07.791	2026-08-25 01:47:50.876	\N	\N
24	1	EGRESO	Transportación	\N	\N	24	t	t	2026-08-25 00:41:07.799	2026-08-25 01:47:50.883	\N	\N
25	1	EGRESO	Sillas plásticas	\N	\N	25	t	t	2026-08-25 00:41:07.805	2026-08-25 01:47:50.888	\N	\N
27	1	EGRESO	Cámaras de seguridad	\N	\N	27	t	t	2026-08-25 00:41:07.817	2026-08-25 01:47:50.895	\N	\N
28	1	EGRESO	Conectividad Starlink	\N	\N	28	t	t	2026-08-25 00:41:07.825	2026-08-25 01:47:50.899	\N	\N
29	1	EGRESO	Equipo Audiovisual	\N	\N	29	t	t	2026-08-25 00:41:07.832	2026-08-25 01:47:50.903	\N	\N
30	1	EGRESO	Drone	\N	\N	30	t	t	2026-08-25 00:41:07.84	2026-08-25 01:47:50.907	\N	\N
31	1	EGRESO	Viandas	\N	\N	31	t	t	2026-08-25 00:41:07.848	2026-08-25 01:47:50.911	\N	\N
32	1	EGRESO	Hielo	\N	\N	32	t	t	2026-08-25 00:41:07.858	2026-08-25 01:47:50.915	\N	\N
33	1	EGRESO	Dispenser con bidones	\N	\N	33	t	t	2026-08-25 00:41:07.869	2026-08-25 01:47:50.92	\N	\N
34	1	EGRESO	Agua para contrapeso	\N	\N	34	t	t	2026-08-25 00:41:07.878	2026-08-25 01:47:50.924	\N	\N
35	1	EGRESO	Ambulancias	\N	\N	35	t	t	2026-08-25 00:41:07.887	2026-08-25 01:47:50.928	\N	\N
36	1	EGRESO	Barras	\N	\N	36	t	t	2026-08-25 00:41:07.896	2026-08-25 01:47:50.932	\N	\N
37	1	EGRESO	Tablones con bancos	\N	\N	37	t	t	2026-08-25 00:41:07.903	2026-08-25 01:47:50.937	\N	\N
38	1	EGRESO	Inflables	\N	\N	38	t	t	2026-08-25 00:41:07.909	2026-08-25 01:47:50.94	\N	\N
39	1	EGRESO	Beduinas	\N	\N	39	t	t	2026-08-25 00:41:07.914	2026-08-25 01:47:50.944	\N	\N
40	1	EGRESO	Colectivo	\N	\N	40	t	t	2026-08-25 00:41:07.918	2026-08-25 01:47:50.948	\N	\N
41	1	EGRESO	Puesto Sanitario	\N	\N	41	t	t	2026-08-25 00:41:07.926	2026-08-25 01:47:50.953	\N	\N
42	1	EGRESO	Ambientación	\N	\N	42	t	t	2026-08-25 00:41:07.931	2026-08-25 01:47:50.957	\N	\N
43	1	EGRESO	Hotelería Party A	\N	\N	43	t	t	2026-08-25 00:41:07.935	2026-08-25 01:47:50.962	\N	\N
44	1	EGRESO	Hotelería Party B	\N	\N	44	t	t	2026-08-25 00:41:07.939	2026-08-25 01:47:50.965	\N	\N
45	1	EGRESO	Hotelería Party C	\N	\N	45	t	t	2026-08-25 00:41:07.944	2026-08-25 01:47:50.969	\N	\N
46	1	EGRESO	Zamping	\N	\N	46	t	t	2026-08-25 00:41:07.95	2026-08-25 01:47:50.973	\N	\N
47	1	EGRESO	Ticketera	\N	\N	47	t	t	2026-08-25 00:41:07.957	2026-08-25 01:47:50.977	\N	\N
48	1	EGRESO	Limpieza en evento	\N	\N	48	t	t	2026-08-25 00:41:07.964	2026-08-25 01:47:50.981	\N	\N
49	1	EGRESO	Limpieza pre y post	\N	\N	49	t	t	2026-08-25 00:41:07.97	2026-08-25 01:47:50.985	\N	\N
50	1	EGRESO	Limpieza baños químicos	\N	\N	50	t	t	2026-08-25 00:41:07.977	2026-08-25 01:47:50.989	\N	\N
52	1	EGRESO	Seguro RC	\N	\N	52	t	t	2026-08-25 00:41:07.985	2026-08-25 01:47:50.999	\N	\N
53	1	EGRESO	Panelería	\N	\N	53	t	t	2026-08-25 00:41:07.994	2026-08-25 01:47:51.003	\N	\N
54	1	EGRESO	Personal de cargas	\N	\N	54	t	t	2026-08-25 00:41:07.999	2026-08-25 01:47:51.007	\N	\N
55	1	EGRESO	Personal de boletería	\N	\N	55	t	t	2026-08-25 00:41:08.003	2026-08-25 01:47:51.018	\N	\N
56	1	EGRESO	Personal acomodadores	\N	\N	56	t	t	2026-08-25 00:41:08.009	2026-08-25 01:47:51.021	\N	\N
57	1	EGRESO	Personal estacionamiento	\N	\N	57	t	t	2026-08-25 00:41:08.013	2026-08-25 01:47:51.025	\N	\N
58	1	EGRESO	Policía	\N	\N	58	t	t	2026-08-25 00:41:08.018	2026-08-25 01:47:51.029	\N	\N
59	1	EGRESO	Adicionales de policía	\N	\N	59	t	t	2026-08-25 00:41:08.026	2026-08-25 01:47:51.034	\N	\N
60	1	EGRESO	Riggers	\N	\N	60	t	t	2026-08-25 00:41:08.032	2026-08-25 01:47:51.038	\N	\N
61	1	EGRESO	Entelado/Aforo	\N	\N	61	t	t	2026-08-25 00:41:08.038	2026-08-25 01:47:51.042	\N	\N
62	1	EGRESO	Op. Sonido	\N	\N	62	t	t	2026-08-25 00:41:08.046	2026-08-25 01:47:51.047	\N	\N
63	1	EGRESO	Op. Luces	\N	\N	63	t	t	2026-08-25 00:41:08.055	2026-08-25 01:47:51.051	\N	\N
64	1	EGRESO	Op. Pantalla	\N	\N	64	t	t	2026-08-25 00:41:08.062	2026-08-25 01:47:51.055	\N	\N
65	1	EGRESO	DJ	\N	\N	65	t	t	2026-08-25 00:41:08.068	2026-08-25 01:47:51.059	\N	\N
66	1	EGRESO	Host de redes	\N	\N	66	t	t	2026-08-25 00:41:08.078	2026-08-25 01:47:51.062	\N	\N
67	1	EGRESO	Choferes	\N	\N	67	t	t	2026-08-25 00:41:08.087	2026-08-25 01:47:51.066	\N	\N
68	1	EGRESO	Branding/Imprenta	\N	\N	68	t	t	2026-08-25 00:41:08.098	2026-08-25 01:47:51.069	\N	\N
69	1	EGRESO	Pañolero	\N	\N	69	t	t	2026-08-25 00:41:08.109	2026-08-25 01:47:51.073	\N	\N
70	1	EGRESO	Publicidad Vía pública	\N	\N	70	t	t	2026-08-25 00:41:08.121	2026-08-25 01:47:51.078	\N	\N
71	1	EGRESO	Activaciones/Juegos	\N	\N	71	t	t	2026-08-25 00:41:08.136	2026-08-25 01:47:51.081	\N	\N
72	1	EGRESO	Promotoras	\N	\N	72	t	t	2026-08-25 00:41:08.148	2026-08-25 01:47:51.086	\N	\N
73	1	EGRESO	Túnel / Tubos led	\N	\N	73	t	t	2026-08-25 00:41:08.16	2026-08-25 01:47:51.09	\N	\N
74	1	EGRESO	Laser	\N	\N	74	t	t	2026-08-25 00:41:08.168	2026-08-25 01:47:51.093	\N	\N
75	1	EGRESO	Fuegos Artificiales	\N	\N	75	t	t	2026-08-25 00:41:08.181	2026-08-25 01:47:51.097	\N	\N
77	1	EGRESO	Rescatistas	\N	\N	77	t	t	2026-08-25 00:41:08.2	2026-08-25 01:47:51.105	\N	\N
78	1	EGRESO	Domo	\N	\N	78	t	t	2026-08-25 00:41:08.211	2026-08-25 01:47:51.108	\N	\N
79	1	EGRESO	Chinitos/Calefactores	\N	\N	79	t	t	2026-08-25 00:41:08.221	2026-08-25 01:47:51.113	\N	\N
80	1	EGRESO	Climatización de carpas	\N	\N	80	t	t	2026-08-25 00:41:08.233	2026-08-25 01:47:51.117	\N	\N
81	1	EGRESO	Mapping	\N	\N	81	t	t	2026-08-25 00:41:08.242	2026-08-25 01:47:51.121	\N	\N
82	1	EGRESO	Amidas	\N	\N	82	t	t	2026-08-25 00:41:08.246	2026-08-25 01:47:51.124	\N	\N
83	1	EGRESO	Camión de caudales	\N	\N	83	t	t	2026-08-25 00:41:08.254	2026-08-25 01:47:51.129	\N	\N
84	1	EGRESO	Handyeman	\N	\N	84	t	t	2026-08-25 00:41:08.264	2026-08-25 01:47:51.134	\N	\N
85	1	EGRESO	RRHH	RRHH	\N	85	t	t	2026-08-25 00:41:08.27	2026-08-25 01:47:51.138	\N	\N
86	1	EGRESO	Impuestos	EG-IMP	\N	86	t	t	2026-08-25 00:41:08.277	2026-08-25 01:47:51.142	\N	\N
87	1	EGRESO	Gastos Extraordinarios	EG-EXTRA	\N	87	t	t	2026-08-25 00:41:08.283	2026-08-25 01:47:51.145	\N	\N
88	1	INGRESO	Tickets	\N	\N	1	t	t	2026-08-25 00:41:08.292	2026-08-25 01:47:51.149	\N	\N
89	1	INGRESO	Sponsors	\N	\N	2	t	t	2026-08-25 00:41:08.302	2026-08-25 01:47:51.154	\N	\N
90	1	INGRESO	Corporativo	\N	\N	3	t	t	2026-08-25 00:41:08.311	2026-08-25 01:47:51.158	\N	\N
91	1	INGRESO	Gastronomía	\N	\N	4	t	t	2026-08-25 00:41:08.321	2026-08-25 01:47:51.163	\N	\N
2	1	EGRESO	Estructuras	\N	\N	2	t	t	2026-08-25 00:41:07.669	2026-08-25 01:47:50.788	\N	\N
1	1	EGRESO	Directorio	\N	\N	1	t	t	2026-08-25 00:41:07.66	2026-08-25 01:47:50.781	\N	\N
9	1	EGRESO	CCTV	\N	\N	9	t	t	2026-08-25 00:41:07.702	2026-08-25 01:47:50.816	\N	\N
26	1	EGRESO	Conectividad distribución	\N	\N	26	t	t	2026-08-25 00:41:07.812	2026-08-25 01:47:50.891	\N	\N
51	1	EGRESO	Desagote baños químicos	\N	\N	51	t	t	2026-08-25 00:41:07.981	2026-08-25 01:47:50.995	\N	\N
76	1	EGRESO	Transmisión/Streaming	\N	\N	76	t	t	2026-08-25 00:41:08.191	2026-08-25 01:47:51.101	\N	\N
92	1	INGRESO	Service Charge	\N	\N	5	t	t	2026-08-25 00:41:08.33	2026-08-25 01:47:51.167	\N	\N
93	2	EGRESO	Layher	LAYHER	\N	1	t	t	2026-08-25 00:41:08.335	2026-08-25 01:47:51.171	\N	\N
94	2	EGRESO	Vallado	VALLADO	\N	2	t	t	2026-08-25 00:41:08.343	2026-08-25 01:47:51.175	\N	\N
95	2	EGRESO	Varios	VARIOS	Aforo, Sillas, Tablones	3	t	t	2026-08-25 00:41:08.35	2026-08-25 01:47:51.179	\N	\N
96	2	EGRESO	RRHH	RRHH	\N	4	t	t	2026-08-25 00:41:08.372	2026-08-25 01:47:51.185	\N	\N
97	2	EGRESO	Impuestos	EG-IMP	\N	5	t	t	2026-08-25 00:41:08.385	2026-08-25 01:47:51.19	\N	\N
98	2	INGRESO	Alquiler de Estructuras	\N	\N	1	t	t	2026-08-25 00:41:08.397	2026-08-25 01:47:51.195	\N	\N
99	2	INGRESO	Mano de Obra	\N	\N	2	t	t	2026-08-25 00:41:08.406	2026-08-25 01:47:51.198	\N	\N
100	2	INGRESO	Transporte	\N	\N	3	t	t	2026-08-25 00:41:08.412	2026-08-25 01:47:51.203	\N	\N
101	2	INGRESO	Otros Ingresos	\N	\N	4	t	t	2026-08-25 00:41:08.418	2026-08-25 01:47:51.207	\N	\N
\.


--
-- Data for Name: RubroEvento; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."RubroEvento" (id, evento_id, rubro_id, empresa_id, proveedor_id, estado, contacto_nombre, contacto_telefono, contacto_cargo, coordina_nombre, fecha_ingreso, fecha_retiro, presupuesto, moneda, notas, created_at, updated_at, deleted_at, created_by, updated_by, cantidad_proveedor, cantidad_stock, usa_stock_propio) FROM stdin;
\.


--
-- Data for Name: SocioPreMacro; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."SocioPreMacro" (id, pre_macro_id, nombre, porcentaje) FROM stdin;
\.


--
-- Data for Name: TabConfig; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."TabConfig" (id, tipo, numero, nombre, codigo, activo, es_sistema, orden, empresa_id) FROM stdin;
1	EGRESO	1	EG-TC	EG-TC	t	t	1	1
2	EGRESO	2	EG-RET SOC	EG-RET-SOC	t	t	2	1
3	EGRESO	3	EG-EXTRA	EG-EXTRA	t	t	3	1
4	EGRESO	4	EG-IMP	EG-IMP	t	t	4	1
5	EGRESO	5	EG-PREST	EG-PREST	t	t	5	1
6	INGRESO	1	ING TICKETS	ING-TICKETS	t	t	1	1
7	INGRESO	2	ING SPON	ING-SPON	t	t	2	1
8	INGRESO	3	ING CORP	ING-CORP	t	t	3	1
9	INGRESO	4	ING GASTRO	ING-GASTRO	t	t	4	1
10	INGRESO	5	ING SERV CHARGE	ING-SERV-CHARGE	t	t	5	1
11	EGRESO	1	EG-TC	EG-TC	t	t	1	2
12	EGRESO	2	EG-RET SOC	EG-RET-SOC	t	t	2	2
13	EGRESO	3	EG-EXTRA	EG-EXTRA	t	t	3	2
14	EGRESO	4	EG-IMP	EG-IMP	t	t	4	2
15	EGRESO	5	EG-PREST	EG-PREST	t	t	5	2
16	INGRESO	1	ING TICKETS	ING-TICKETS	t	t	1	2
17	INGRESO	2	ING SPON	ING-SPON	t	t	2	2
18	INGRESO	3	ING CORP	ING-CORP	t	t	3	2
19	INGRESO	4	ING GASTRO	ING-GASTRO	t	t	4	2
20	INGRESO	5	ING SERV CHARGE	ING-SERV-CHARGE	t	t	5	2
\.


--
-- Data for Name: Usuario; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."Usuario" (id, email, nombre, password_hash, rol, activo, created_at, updated_at, deleted_at, empresa_id, apodo, telefono, areas_macro, puede_ver_macro) FROM stdin;
1	admin@adminportal.com	Administrador	$2a$10$MicbbpZ48fRfVAcggOLYXO1V6./mV5CEiuM1j6gWOOHe0IDQGt9dS	ADMIN	t	2026-08-25 00:41:08.546	2026-08-25 01:47:51.298	\N	\N	\N	\N	\N	f
2	matiaslorenzati@gmail.com	Matías Lorenzati	$2a$10$RuWLEmE05WbgvbXDQAzNUeHOVIQezQZWzXuNI8FJ5MQ0S177fFpXO	ADMIN	t	2026-08-25 00:41:08.652	2026-08-25 01:47:51.362	\N	\N	\N	\N	{}	f
3	pollobibiloni@gmail.com	Sergio Bibiloni (Pollo)	$2a$10$RuWLEmE05WbgvbXDQAzNUeHOVIQezQZWzXuNI8FJ5MQ0S177fFpXO	ADMIN	t	2026-08-25 00:41:08.66	2026-08-25 01:47:51.368	\N	2	\N	351 295-6442	{}	f
4	veckisalerno.dos57@gmail.com	Verónica Salerno (Veck)	$2a$10$RuWLEmE05WbgvbXDQAzNUeHOVIQezQZWzXuNI8FJ5MQ0S177fFpXO	ADMIN	t	2026-08-25 00:41:08.686	2026-08-25 01:47:51.377	\N	2	\N	351 259-6633	{}	f
5	administracion@grupodos57.com.ar	Andrea Olivetto (Andre)	$2a$10$RuWLEmE05WbgvbXDQAzNUeHOVIQezQZWzXuNI8FJ5MQ0S177fFpXO	ADMIN	t	2026-08-25 00:41:08.698	2026-08-25 01:47:51.388	\N	2	\N	351 221-3138	{}	f
6	mayra.dos57@gmail.com	Mayra Ontivero	$2a$10$RuWLEmE05WbgvbXDQAzNUeHOVIQezQZWzXuNI8FJ5MQ0S177fFpXO	ADMIN	t	2026-08-25 00:41:08.713	2026-08-25 01:47:51.398	\N	2	\N	351 706-2733	{FINANZAS,ADMIN,RRHH,STOCK}	t
7	jazminvaldivia.dos57@gmail.com	Jazmín Valdivia (Jaz)	$2a$10$RuWLEmE05WbgvbXDQAzNUeHOVIQezQZWzXuNI8FJ5MQ0S177fFpXO	OPERADOR	t	2026-08-25 00:41:08.742	2026-08-25 01:47:51.411	\N	2	\N	351 594-6637	{}	f
8	christianxinos@gmail.com	Christian Xinos (Chino)	$2a$10$RuWLEmE05WbgvbXDQAzNUeHOVIQezQZWzXuNI8FJ5MQ0S177fFpXO	ADMIN	t	2026-08-25 00:41:08.76	2026-08-25 01:47:51.427	\N	1	\N	351 800-5952	{}	f
9	envios.enjoyproducciones@gmail.com	Malena Perez Estevez	$2a$10$RuWLEmE05WbgvbXDQAzNUeHOVIQezQZWzXuNI8FJ5MQ0S177fFpXO	ADMIN	t	2026-08-25 00:41:08.785	2026-08-25 01:47:51.435	\N	1	\N	351 386-3241	{}	f
10	victoriaalmada@gmail.com	Victoria Almada	$2a$10$RuWLEmE05WbgvbXDQAzNUeHOVIQezQZWzXuNI8FJ5MQ0S177fFpXO	OPERADOR	t	2026-08-25 00:41:08.808	2026-08-25 01:47:51.44	\N	1	\N	351 208-1470	{}	f
11	danielyanello93@gmail.com	Daniel Yanello	$2a$10$RuWLEmE05WbgvbXDQAzNUeHOVIQezQZWzXuNI8FJ5MQ0S177fFpXO	OPERADOR	t	2026-08-25 00:41:08.827	2026-08-25 01:47:51.447	\N	1	\N	351 398-0601	{}	f
\.


--
-- Data for Name: UsuarioEmpresaAcceso; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."UsuarioEmpresaAcceso" (id, usuario_id, empresa_id, created_at, created_by) FROM stdin;
1	3	2	2026-08-25 00:41:08.668	\N
2	4	2	2026-08-25 00:41:08.692	\N
3	5	2	2026-08-25 00:41:08.703	\N
4	6	2	2026-08-25 00:41:08.718	\N
5	6	1	2026-08-25 00:41:08.728	\N
6	7	2	2026-08-25 00:41:08.747	\N
7	8	1	2026-08-25 00:41:08.768	\N
8	9	1	2026-08-25 00:41:08.795	\N
9	10	1	2026-08-25 00:41:08.816	\N
10	11	1	2026-08-25 00:41:08.832	\N
\.


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
5bdd9509-c528-4213-ba74-60f4aa7bcc52	595e767c39eb53ac9d1eb8d94ae100ce52e52da149087022a78d75158111fa30	2026-08-25 00:35:13.025073+00	20260508004239_init		\N	2026-08-25 00:35:13.025073+00	0
0628dffc-0acc-414c-997c-509919652901	098a8410de4c58cb45a2a70c730f44d9abd64dd0d5deb888f7cf9abf22a6b1ed	2026-08-25 00:35:15.968219+00	20260508200519_add_echeq_motivo_rechazo		\N	2026-08-25 00:35:15.968219+00	0
b899dca0-d8f1-4f75-bb1a-4341bb146752	8d267e96bd73a4baa54e693101f07de89e5cd1a6b9219c4136747947c04ac0e4	2026-08-25 00:35:18.27342+00	20260510220753_add_transferencia_par_id		\N	2026-08-25 00:35:18.27342+00	0
0ed17484-d44f-4dd8-aa4b-07de448ff696	3ed127348925886571de8211fe6d2e435cc23ac202c436d64c0e09902c2ee3c5	2026-08-25 00:35:21.068449+00	20260512144721_add_tab_config_fields		\N	2026-08-25 00:35:21.068449+00	0
f511c1e2-2c06-4511-84ac-04ef13237c79	3d7f5ba7c71a69c423eb65a4c9c546970ae6c6ad348a69daf2e062253eacaa5b	2026-08-25 00:35:23.094522+00	20260512191642_add_proveedor		\N	2026-08-25 00:35:23.094522+00	0
a5585fd3-edbd-44c4-bdcb-4b1554f34757	d38e571f85f2c8aa9b02e9e6c9b27097140f4b829930324972cfc4546851b758	2026-08-25 00:35:25.621237+00	20260512203702_add_auditoria_accesos		\N	2026-08-25 00:35:25.621237+00	0
5be806ce-9c57-4134-b83c-0a712398a83b	69fc8ba414f0058df2280a21f014f6b9a51c983486cc409bc36106712864862a	2026-08-25 00:35:28.292056+00	20260514214858_add_stock_models		\N	2026-08-25 00:35:28.292056+00	0
a8d0c6cf-cfb7-41bc-b39b-05186f664939	c0987031078738a0f5b21078fa96d6c3b26c3cbb9e25f2eb0b3b7b6d43c24fb0	2026-08-25 00:35:31.026479+00	20260515191949_add_categoria_stock		\N	2026-08-25 00:35:31.026479+00	0
f0fd18c4-02f6-4a77-9763-d93ff18190bd	b50f81235f3aab69e33c72dc1eedd5eff66034a9fd6fdc7ec85f143852494b0c	2026-08-25 00:35:33.456269+00	20260515192753_fix_categoria_drift		\N	2026-08-25 00:35:33.456269+00	0
72ffad6b-b315-44c6-99ae-e8c26f1b9ee6	bc50bc6e94aaa4315c1d98a4dbe1a832cf5f115bfb819729a9699ae25c9fa90d	2026-08-25 00:35:35.678095+00	20260624000000_add_facturas		\N	2026-08-25 00:35:35.678095+00	0
16a971cd-ec21-44a8-b922-33247762aaf0	dfd8a0b94ba3dae508dbab95a5409fca74752bcc4895e6dffc15d306319eb63c	2026-08-25 00:35:38.527719+00	20260714210201_add_multitenancy_empresa_id		\N	2026-08-25 00:35:38.527719+00	0
471a92ed-950f-4a1c-9dfe-3342b0d859e1	1d8248ee46675ffbdf16584e2cccf56bf47db3717a64f9757c11a7e2d5c69822	2026-08-25 00:35:41.223692+00	20260717151645_empresa_config_fields		\N	2026-08-25 00:35:41.223692+00	0
c7ff3c24-d744-4b43-a6c5-51d6e0bbd16c	ce1a2c4b5dba06cf017bf4fe79c7f887b6212255a00075e69c49aefd2badd223	2026-08-25 00:35:44.224666+00	20260717151746_rrhh_empleados_jornadas_liquidaciones		\N	2026-08-25 00:35:44.224666+00	0
e363bad5-81c1-4c88-8ab6-d89e6a2a9a2b	0e015a43fb0af0d27fb76d4dd1b50cf887d0772dd7954a0b4d26ad9449c93303	2026-08-25 00:35:46.948478+00	20260720123748_stock_refactor_cunas_panol_activos		\N	2026-08-25 00:35:46.948478+00	0
7d4c852d-4271-4392-b9b3-1b478c6d64a0	20ed479d890a98666c16cc5bf97161336e74a4dd7bb577ff2134921baa392a16	2026-08-25 00:35:49.649294+00	20260723221416_rubros_estados_movimiento		\N	2026-08-25 00:35:49.649294+00	0
72eb45e2-867f-4fd3-b224-559541919739	14c259b9b0a85b3f4dab87e2baf4359c9c08c791199ca77cda26b614e1abba7f	2026-08-25 00:35:52.447459+00	20260724114341_factura_rubro_id		\N	2026-08-25 00:35:52.447459+00	0
e90d85bb-0e8a-4244-a863-1cb41fa9e215	ae4723842065e4709c8f9586362e464bb31aa6f8afbd7046afe566d6a688eb77	2026-08-25 00:35:55.552485+00	20260727152743_producto_peso_espacio		\N	2026-08-25 00:35:55.552485+00	0
bad57990-a9a0-43d5-8521-d629f60fa2d3	51feba5f1af4dc12318524a0dbcd43a945b9d1a9713bfe65e2c1457269f3227f	2026-08-25 00:35:57.84209+00	20260728180201_producto_historial_stock		\N	2026-08-25 00:35:57.84209+00	0
cb3693a7-d8db-4864-bdcd-2a70dda7ae32	f5847e45b5ed62ad38abeb11a0c68d4ad397d3e61e778645a534037f329a2e02	2026-08-25 00:36:01.125726+00	20260728180349_producto_informe_situacion		\N	2026-08-25 00:36:01.125726+00	0
ef8af070-521f-4031-be72-0f233c39dfe2	ba5e57d226b6e15794fcf739d020d533b4b0784b76e91a2070182e6ac6f78943	2026-08-25 00:36:04.170339+00	20260730213451_caja_evento_id_nullable		\N	2026-08-25 00:36:04.170339+00	0
b4974efa-5442-4bd9-b3ae-d28c2b7d4fb2	c0aaece2608d8817810cbf14ed37470f6f8b197e14aacf237fcebfaa6ff0e65c	2026-08-25 00:36:06.873001+00	20260730223115_empleado_liquidacion_jornada		\N	2026-08-25 00:36:06.873001+00	0
e5cee943-6bff-4b0d-b0af-7a9cc32959ee	2b5421c32de53929182f43254a6092367f2ae826debce83473d5aea5a8d85719	2026-08-25 00:36:09.484639+00	20260731114430_ficha_evento_rubro_proveedor		\N	2026-08-25 00:36:09.484639+00	0
a1f4158a-28f0-4d89-ae10-b25846dc92fc	7c4e395fbda36663546b23e08c82b62025cb33a8dbb4cd030a636b8122cc2192	2026-08-25 00:36:12.344531+00	20260731174043_parte_diario_personal		\N	2026-08-25 00:36:12.344531+00	0
f43bc05a-29d9-4f1d-afaf-7e91d0c65d0a	f1f5248e1acaa86fd8fcd0eced7eb9672ae326eedd7d092971396d689162dbac	2026-08-25 00:36:15.272538+00	20260803181522_modulo_comidas		\N	2026-08-25 00:36:15.272538+00	0
89e28750-bd3d-419a-a0d5-775f6d70dfdb	fc3d363d4dd2e0df592c1699a229af3ae653c141bd6830c2844901449822d04f	2026-08-25 00:36:19.219932+00	20260804144856_pre_macro_wizard		\N	2026-08-25 00:36:19.219932+00	0
3cac54c4-c50b-4d36-a9ee-8a093520469b	c4c864659c2609353303fd6facf071a3d04dfb7881bf495fc811579e7d4557b2	2026-08-25 00:36:23.130369+00	20260805112722_pedido_item_remove_unidad		\N	2026-08-25 00:36:23.130369+00	0
5749d570-f7e9-45ab-8caf-ef8aa67a191a	a04ef70cdf9d4a95c86aee5e79461d48a70c8f17020ba9db40d6c7060ed3e76a	2026-08-25 00:36:27.029642+00	20260806153404_rubro_evento_fuentes_mixtas		\N	2026-08-25 00:36:27.029642+00	0
d9df7e14-c2ea-44e9-b565-2a26d57c60f4	a29288226731c3743cf429dbba907f01622e95a88c8ffa3edf6eb2309133cbfc	2026-08-25 00:36:29.971106+00	20260810155549_roles_empleado_uniforme		\N	2026-08-25 00:36:29.971106+00	0
d327e354-04f9-485a-b625-43d1b360d3cc	30c941dd163dbfc38f6597d992cd588d148e908b1923935f7431ed7dad8de746	2026-08-25 00:36:32.990014+00	20260811203754_evento_cuenta		\N	2026-08-25 00:36:32.990014+00	0
2168a1c6-2294-4f62-85b9-4360b48259cc	455ce87ac90af309cc05c465a9710e9ec7a288b5e5d601355e1d2cf154c7ec64	2026-08-25 00:36:35.706995+00	20260811211401_movimiento_caja_evento_id		\N	2026-08-25 00:36:35.706995+00	0
eea0aabf-e657-4ecc-aa65-40e6f1576bea	1aa8af75ea6b274ee65da865d0c6b757b0689af5720cd2fb220f49e8048ae338	2026-08-25 00:36:38.762738+00	20260812124240_evento_dias_montaje		\N	2026-08-25 00:36:38.762738+00	0
52aafa7e-1779-48dc-88b2-60cd8255b65a	97a874a48f340a4010a95e540f29d09e3cfa0c993b76df904257caa5fa15c8f1	2026-08-25 00:36:42.265399+00	20260813033524_cuenta_estado_rendicion		\N	2026-08-25 00:36:42.265399+00	0
b95892b5-d2b7-443f-a5a2-c5a9455a8811	58937c15b769d281b75107f17ac194af7a271f3b6e02a01b0a23c18c60b38519	2026-08-25 00:36:45.79377+00	20260821114649_cuenta_corriente_generica		\N	2026-08-25 00:36:45.79377+00	0
d44d12e8-66cc-4955-9d87-3a69436f5b37	1f01e4a35ab0417a69be290a8f8bcaae80faa2dd85e8aac7b10a3e3a0b419a36	2026-08-25 00:36:49.890846+00	20260821115610_cuenta_corriente_moneda_ccc		\N	2026-08-25 00:36:49.890846+00	0
9428fd45-114b-4fc9-aaaf-1170847c3ff1	5d9a40e4969ac3d2473b454a9b0cc60b027024f16013f3402d102f672392512d	2026-08-25 00:36:55.522647+00	20260821164948_usuario_macro_areas		\N	2026-08-25 00:36:55.522647+00	0
158cc2d5-0143-4a26-844e-f43abbc19334	17513beeb7c5267d332f56a2a8abffe09a6cb293401543ba7727573f26af9339	2026-08-25 00:43:25.434876+00	20260824145325_multimoneda_ars_usd_eur	\N	\N	2026-08-25 00:43:25.414358+00	1
ddc25fa1-82b1-4345-ac1e-e57de06267f1	256027378c9244ba3013b7d81d832f92f2918c53f7ebeefdc267956451cb1c02	2026-08-25 01:47:11.580485+00	20260824224701_cuenta_unique_nombre_empresa	\N	\N	2026-08-25 01:47:11.545139+00	1
\.


--
-- Name: Activo_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."Activo_id_seq"', 1, false);


--
-- Name: Anticipo_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."Anticipo_id_seq"', 1, false);


--
-- Name: AsignacionDiaria_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."AsignacionDiaria_id_seq"', 1, false);


--
-- Name: AsignacionStock_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."AsignacionStock_id_seq"', 1, false);


--
-- Name: AuditoriaLog_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."AuditoriaLog_id_seq"', 1, false);


--
-- Name: Camion_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."Camion_id_seq"', 1, false);


--
-- Name: CategoriaStock_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."CategoriaStock_id_seq"', 8, true);


--
-- Name: CuentaBancaria_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."CuentaBancaria_id_seq"', 4, true);


--
-- Name: CuentaCorriente_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."CuentaCorriente_id_seq"', 1, false);


--
-- Name: CunaProducto_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."CunaProducto_id_seq"', 1, false);


--
-- Name: Cuna_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."Cuna_id_seq"', 1, false);


--
-- Name: Echeq_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."Echeq_id_seq"', 1, false);


--
-- Name: Empleado_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."Empleado_id_seq"', 24, true);


--
-- Name: Empresa_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."Empresa_id_seq"', 2, true);


--
-- Name: EventoAcceso_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."EventoAcceso_id_seq"', 1, false);


--
-- Name: EventoCuenta_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."EventoCuenta_id_seq"', 1, false);


--
-- Name: Evento_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."Evento_id_seq"', 1, false);


--
-- Name: Factura_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."Factura_id_seq"', 1, false);


--
-- Name: Jornada_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."Jornada_id_seq"', 1, false);


--
-- Name: LineaComida_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."LineaComida_id_seq"', 1, false);


--
-- Name: Liquidacion_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."Liquidacion_id_seq"', 1, false);


--
-- Name: MovimientoCCC_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."MovimientoCCC_id_seq"', 1, false);


--
-- Name: MovimientoCaja_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."MovimientoCaja_id_seq"', 1, false);


--
-- Name: MovimientoPanol_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."MovimientoPanol_id_seq"', 1, false);


--
-- Name: MovimientoStock_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."MovimientoStock_id_seq"', 1, false);


--
-- Name: Movimiento_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."Movimiento_id_seq"', 1, false);


--
-- Name: PagoFactura_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."PagoFactura_id_seq"', 1, false);


--
-- Name: PanolItem_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."PanolItem_id_seq"', 1, false);


--
-- Name: ParteCCC_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."ParteCCC_id_seq"', 1, false);


--
-- Name: ParteDiario_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."ParteDiario_id_seq"', 1, false);


--
-- Name: PedidoComida_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."PedidoComida_id_seq"', 1, false);


--
-- Name: PedidoItem_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."PedidoItem_id_seq"', 1, false);


--
-- Name: PreMacro_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."PreMacro_id_seq"', 1, false);


--
-- Name: Producto_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."Producto_id_seq"', 1, false);


--
-- Name: Proveedor_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."Proveedor_id_seq"', 1, false);


--
-- Name: RubroEvento_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."RubroEvento_id_seq"', 1, false);


--
-- Name: Rubro_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."Rubro_id_seq"', 303, true);


--
-- Name: SocioPreMacro_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."SocioPreMacro_id_seq"', 1, false);


--
-- Name: TabConfig_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."TabConfig_id_seq"', 60, true);


--
-- Name: UsuarioEmpresaAcceso_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."UsuarioEmpresaAcceso_id_seq"', 10, true);


--
-- Name: Usuario_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."Usuario_id_seq"', 33, true);


--
-- Name: Activo Activo_pkey; Type: CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."Activo"
    ADD CONSTRAINT "Activo_pkey" PRIMARY KEY (id);


--
-- Name: Anticipo Anticipo_pkey; Type: CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."Anticipo"
    ADD CONSTRAINT "Anticipo_pkey" PRIMARY KEY (id);


--
-- Name: AsignacionDiaria AsignacionDiaria_pkey; Type: CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."AsignacionDiaria"
    ADD CONSTRAINT "AsignacionDiaria_pkey" PRIMARY KEY (id);


--
-- Name: AsignacionStock AsignacionStock_pkey; Type: CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."AsignacionStock"
    ADD CONSTRAINT "AsignacionStock_pkey" PRIMARY KEY (id);


--
-- Name: AuditoriaLog AuditoriaLog_pkey; Type: CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."AuditoriaLog"
    ADD CONSTRAINT "AuditoriaLog_pkey" PRIMARY KEY (id);


--
-- Name: Camion Camion_pkey; Type: CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."Camion"
    ADD CONSTRAINT "Camion_pkey" PRIMARY KEY (id);


--
-- Name: CategoriaStock CategoriaStock_pkey; Type: CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."CategoriaStock"
    ADD CONSTRAINT "CategoriaStock_pkey" PRIMARY KEY (id);


--
-- Name: CuentaBancaria CuentaBancaria_pkey; Type: CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."CuentaBancaria"
    ADD CONSTRAINT "CuentaBancaria_pkey" PRIMARY KEY (id);


--
-- Name: CuentaCorriente CuentaCorriente_pkey; Type: CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."CuentaCorriente"
    ADD CONSTRAINT "CuentaCorriente_pkey" PRIMARY KEY (id);


--
-- Name: CunaProducto CunaProducto_pkey; Type: CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."CunaProducto"
    ADD CONSTRAINT "CunaProducto_pkey" PRIMARY KEY (id);


--
-- Name: Cuna Cuna_pkey; Type: CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."Cuna"
    ADD CONSTRAINT "Cuna_pkey" PRIMARY KEY (id);


--
-- Name: Echeq Echeq_pkey; Type: CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."Echeq"
    ADD CONSTRAINT "Echeq_pkey" PRIMARY KEY (id);


--
-- Name: Empleado Empleado_pkey; Type: CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."Empleado"
    ADD CONSTRAINT "Empleado_pkey" PRIMARY KEY (id);


--
-- Name: Empresa Empresa_pkey; Type: CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."Empresa"
    ADD CONSTRAINT "Empresa_pkey" PRIMARY KEY (id);


--
-- Name: EventoAcceso EventoAcceso_pkey; Type: CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."EventoAcceso"
    ADD CONSTRAINT "EventoAcceso_pkey" PRIMARY KEY (id);


--
-- Name: EventoCuenta EventoCuenta_pkey; Type: CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."EventoCuenta"
    ADD CONSTRAINT "EventoCuenta_pkey" PRIMARY KEY (id);


--
-- Name: Evento Evento_pkey; Type: CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."Evento"
    ADD CONSTRAINT "Evento_pkey" PRIMARY KEY (id);


--
-- Name: Factura Factura_pkey; Type: CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."Factura"
    ADD CONSTRAINT "Factura_pkey" PRIMARY KEY (id);


--
-- Name: Jornada Jornada_pkey; Type: CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."Jornada"
    ADD CONSTRAINT "Jornada_pkey" PRIMARY KEY (id);


--
-- Name: LineaComida LineaComida_pkey; Type: CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."LineaComida"
    ADD CONSTRAINT "LineaComida_pkey" PRIMARY KEY (id);


--
-- Name: Liquidacion Liquidacion_pkey; Type: CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."Liquidacion"
    ADD CONSTRAINT "Liquidacion_pkey" PRIMARY KEY (id);


--
-- Name: MovimientoCCC MovimientoCCC_pkey; Type: CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."MovimientoCCC"
    ADD CONSTRAINT "MovimientoCCC_pkey" PRIMARY KEY (id);


--
-- Name: MovimientoCaja MovimientoCaja_pkey; Type: CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."MovimientoCaja"
    ADD CONSTRAINT "MovimientoCaja_pkey" PRIMARY KEY (id);


--
-- Name: MovimientoPanol MovimientoPanol_pkey; Type: CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."MovimientoPanol"
    ADD CONSTRAINT "MovimientoPanol_pkey" PRIMARY KEY (id);


--
-- Name: MovimientoStock MovimientoStock_pkey; Type: CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."MovimientoStock"
    ADD CONSTRAINT "MovimientoStock_pkey" PRIMARY KEY (id);


--
-- Name: Movimiento Movimiento_pkey; Type: CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."Movimiento"
    ADD CONSTRAINT "Movimiento_pkey" PRIMARY KEY (id);


--
-- Name: PagoFactura PagoFactura_pkey; Type: CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."PagoFactura"
    ADD CONSTRAINT "PagoFactura_pkey" PRIMARY KEY (id);


--
-- Name: PanolItem PanolItem_pkey; Type: CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."PanolItem"
    ADD CONSTRAINT "PanolItem_pkey" PRIMARY KEY (id);


--
-- Name: ParteCCC ParteCCC_pkey; Type: CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."ParteCCC"
    ADD CONSTRAINT "ParteCCC_pkey" PRIMARY KEY (id);


--
-- Name: ParteDiario ParteDiario_pkey; Type: CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."ParteDiario"
    ADD CONSTRAINT "ParteDiario_pkey" PRIMARY KEY (id);


--
-- Name: PedidoComida PedidoComida_pkey; Type: CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."PedidoComida"
    ADD CONSTRAINT "PedidoComida_pkey" PRIMARY KEY (id);


--
-- Name: PedidoItem PedidoItem_pkey; Type: CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."PedidoItem"
    ADD CONSTRAINT "PedidoItem_pkey" PRIMARY KEY (id);


--
-- Name: PreMacro PreMacro_pkey; Type: CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."PreMacro"
    ADD CONSTRAINT "PreMacro_pkey" PRIMARY KEY (id);


--
-- Name: Producto Producto_pkey; Type: CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."Producto"
    ADD CONSTRAINT "Producto_pkey" PRIMARY KEY (id);


--
-- Name: Proveedor Proveedor_pkey; Type: CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."Proveedor"
    ADD CONSTRAINT "Proveedor_pkey" PRIMARY KEY (id);


--
-- Name: RubroEvento RubroEvento_pkey; Type: CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."RubroEvento"
    ADD CONSTRAINT "RubroEvento_pkey" PRIMARY KEY (id);


--
-- Name: Rubro Rubro_pkey; Type: CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."Rubro"
    ADD CONSTRAINT "Rubro_pkey" PRIMARY KEY (id);


--
-- Name: SocioPreMacro SocioPreMacro_pkey; Type: CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."SocioPreMacro"
    ADD CONSTRAINT "SocioPreMacro_pkey" PRIMARY KEY (id);


--
-- Name: TabConfig TabConfig_pkey; Type: CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."TabConfig"
    ADD CONSTRAINT "TabConfig_pkey" PRIMARY KEY (id);


--
-- Name: UsuarioEmpresaAcceso UsuarioEmpresaAcceso_pkey; Type: CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."UsuarioEmpresaAcceso"
    ADD CONSTRAINT "UsuarioEmpresaAcceso_pkey" PRIMARY KEY (id);


--
-- Name: Usuario Usuario_pkey; Type: CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."Usuario"
    ADD CONSTRAINT "Usuario_pkey" PRIMARY KEY (id);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: AsignacionDiaria_jornada_id_key; Type: INDEX; Schema: public; Owner: admin_portal
--

CREATE UNIQUE INDEX "AsignacionDiaria_jornada_id_key" ON public."AsignacionDiaria" USING btree (jornada_id);


--
-- Name: AsignacionDiaria_parte_diario_id_empleado_id_key; Type: INDEX; Schema: public; Owner: admin_portal
--

CREATE UNIQUE INDEX "AsignacionDiaria_parte_diario_id_empleado_id_key" ON public."AsignacionDiaria" USING btree (parte_diario_id, empleado_id);


--
-- Name: Camion_codigo_empresa_id_key; Type: INDEX; Schema: public; Owner: admin_portal
--

CREATE UNIQUE INDEX "Camion_codigo_empresa_id_key" ON public."Camion" USING btree (codigo, empresa_id);


--
-- Name: CategoriaStock_nombre_empresa_id_key; Type: INDEX; Schema: public; Owner: admin_portal
--

CREATE UNIQUE INDEX "CategoriaStock_nombre_empresa_id_key" ON public."CategoriaStock" USING btree (nombre, empresa_id);


--
-- Name: CuentaBancaria_nombre_empresa_id_key; Type: INDEX; Schema: public; Owner: admin_portal
--

CREATE UNIQUE INDEX "CuentaBancaria_nombre_empresa_id_key" ON public."CuentaBancaria" USING btree (nombre, empresa_id);


--
-- Name: CunaProducto_cuna_id_producto_id_key; Type: INDEX; Schema: public; Owner: admin_portal
--

CREATE UNIQUE INDEX "CunaProducto_cuna_id_producto_id_key" ON public."CunaProducto" USING btree (cuna_id, producto_id);


--
-- Name: Cuna_codigo_empresa_id_key; Type: INDEX; Schema: public; Owner: admin_portal
--

CREATE UNIQUE INDEX "Cuna_codigo_empresa_id_key" ON public."Cuna" USING btree (codigo, empresa_id);


--
-- Name: Echeq_movimiento_id_key; Type: INDEX; Schema: public; Owner: admin_portal
--

CREATE UNIQUE INDEX "Echeq_movimiento_id_key" ON public."Echeq" USING btree (movimiento_id);


--
-- Name: Empleado_usuario_id_key; Type: INDEX; Schema: public; Owner: admin_portal
--

CREATE UNIQUE INDEX "Empleado_usuario_id_key" ON public."Empleado" USING btree (usuario_id);


--
-- Name: Empresa_cuit_key; Type: INDEX; Schema: public; Owner: admin_portal
--

CREATE UNIQUE INDEX "Empresa_cuit_key" ON public."Empresa" USING btree (cuit);


--
-- Name: EventoAcceso_usuario_id_evento_id_key; Type: INDEX; Schema: public; Owner: admin_portal
--

CREATE UNIQUE INDEX "EventoAcceso_usuario_id_evento_id_key" ON public."EventoAcceso" USING btree (usuario_id, evento_id);


--
-- Name: EventoCuenta_evento_id_cuenta_id_key; Type: INDEX; Schema: public; Owner: admin_portal
--

CREATE UNIQUE INDEX "EventoCuenta_evento_id_cuenta_id_key" ON public."EventoCuenta" USING btree (evento_id, cuenta_id);


--
-- Name: Jornada_empleado_id_fecha_key; Type: INDEX; Schema: public; Owner: admin_portal
--

CREATE UNIQUE INDEX "Jornada_empleado_id_fecha_key" ON public."Jornada" USING btree (empleado_id, fecha);


--
-- Name: LineaComida_pedido_comida_id_tipo_area_key; Type: INDEX; Schema: public; Owner: admin_portal
--

CREATE UNIQUE INDEX "LineaComida_pedido_comida_id_tipo_area_key" ON public."LineaComida" USING btree (pedido_comida_id, tipo, area);


--
-- Name: Liquidacion_movimiento_id_key; Type: INDEX; Schema: public; Owner: admin_portal
--

CREATE UNIQUE INDEX "Liquidacion_movimiento_id_key" ON public."Liquidacion" USING btree (movimiento_id);


--
-- Name: PagoFactura_echeq_id_key; Type: INDEX; Schema: public; Owner: admin_portal
--

CREATE UNIQUE INDEX "PagoFactura_echeq_id_key" ON public."PagoFactura" USING btree (echeq_id);


--
-- Name: PagoFactura_movimiento_id_key; Type: INDEX; Schema: public; Owner: admin_portal
--

CREATE UNIQUE INDEX "PagoFactura_movimiento_id_key" ON public."PagoFactura" USING btree (movimiento_id);


--
-- Name: ParteDiario_empresa_id_fecha_key; Type: INDEX; Schema: public; Owner: admin_portal
--

CREATE UNIQUE INDEX "ParteDiario_empresa_id_fecha_key" ON public."ParteDiario" USING btree (empresa_id, fecha);


--
-- Name: PedidoComida_evento_id_fecha_key; Type: INDEX; Schema: public; Owner: admin_portal
--

CREATE UNIQUE INDEX "PedidoComida_evento_id_fecha_key" ON public."PedidoComida" USING btree (evento_id, fecha);


--
-- Name: PreMacro_evento_id_key; Type: INDEX; Schema: public; Owner: admin_portal
--

CREATE UNIQUE INDEX "PreMacro_evento_id_key" ON public."PreMacro" USING btree (evento_id);


--
-- Name: Producto_codigo_externo_empresa_id_key; Type: INDEX; Schema: public; Owner: admin_portal
--

CREATE UNIQUE INDEX "Producto_codigo_externo_empresa_id_key" ON public."Producto" USING btree (codigo_externo, empresa_id);


--
-- Name: Producto_codigo_interno_empresa_id_key; Type: INDEX; Schema: public; Owner: admin_portal
--

CREATE UNIQUE INDEX "Producto_codigo_interno_empresa_id_key" ON public."Producto" USING btree (codigo_interno, empresa_id);


--
-- Name: Producto_empresa_id_nombre_espacio_key; Type: INDEX; Schema: public; Owner: admin_portal
--

CREATE UNIQUE INDEX "Producto_empresa_id_nombre_espacio_key" ON public."Producto" USING btree (empresa_id, nombre, espacio);


--
-- Name: Proveedor_cuit_key; Type: INDEX; Schema: public; Owner: admin_portal
--

CREATE UNIQUE INDEX "Proveedor_cuit_key" ON public."Proveedor" USING btree (cuit);


--
-- Name: RubroEvento_evento_id_rubro_id_key; Type: INDEX; Schema: public; Owner: admin_portal
--

CREATE UNIQUE INDEX "RubroEvento_evento_id_rubro_id_key" ON public."RubroEvento" USING btree (evento_id, rubro_id);


--
-- Name: Rubro_empresa_id_tipo_nombre_key; Type: INDEX; Schema: public; Owner: admin_portal
--

CREATE UNIQUE INDEX "Rubro_empresa_id_tipo_nombre_key" ON public."Rubro" USING btree (empresa_id, tipo, nombre);


--
-- Name: TabConfig_codigo_empresa_id_key; Type: INDEX; Schema: public; Owner: admin_portal
--

CREATE UNIQUE INDEX "TabConfig_codigo_empresa_id_key" ON public."TabConfig" USING btree (codigo, empresa_id);


--
-- Name: TabConfig_tipo_numero_empresa_id_key; Type: INDEX; Schema: public; Owner: admin_portal
--

CREATE UNIQUE INDEX "TabConfig_tipo_numero_empresa_id_key" ON public."TabConfig" USING btree (tipo, numero, empresa_id);


--
-- Name: UsuarioEmpresaAcceso_usuario_id_empresa_id_key; Type: INDEX; Schema: public; Owner: admin_portal
--

CREATE UNIQUE INDEX "UsuarioEmpresaAcceso_usuario_id_empresa_id_key" ON public."UsuarioEmpresaAcceso" USING btree (usuario_id, empresa_id);


--
-- Name: Usuario_email_key; Type: INDEX; Schema: public; Owner: admin_portal
--

CREATE UNIQUE INDEX "Usuario_email_key" ON public."Usuario" USING btree (email);


--
-- Name: Activo Activo_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."Activo"
    ADD CONSTRAINT "Activo_empresa_id_fkey" FOREIGN KEY (empresa_id) REFERENCES public."Empresa"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Anticipo Anticipo_empleado_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."Anticipo"
    ADD CONSTRAINT "Anticipo_empleado_id_fkey" FOREIGN KEY (empleado_id) REFERENCES public."Empleado"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Anticipo Anticipo_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."Anticipo"
    ADD CONSTRAINT "Anticipo_empresa_id_fkey" FOREIGN KEY (empresa_id) REFERENCES public."Empresa"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Anticipo Anticipo_liquidacion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."Anticipo"
    ADD CONSTRAINT "Anticipo_liquidacion_id_fkey" FOREIGN KEY (liquidacion_id) REFERENCES public."Liquidacion"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: AsignacionDiaria AsignacionDiaria_camion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."AsignacionDiaria"
    ADD CONSTRAINT "AsignacionDiaria_camion_id_fkey" FOREIGN KEY (camion_id) REFERENCES public."Camion"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: AsignacionDiaria AsignacionDiaria_empleado_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."AsignacionDiaria"
    ADD CONSTRAINT "AsignacionDiaria_empleado_id_fkey" FOREIGN KEY (empleado_id) REFERENCES public."Empleado"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: AsignacionDiaria AsignacionDiaria_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."AsignacionDiaria"
    ADD CONSTRAINT "AsignacionDiaria_empresa_id_fkey" FOREIGN KEY (empresa_id) REFERENCES public."Empresa"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: AsignacionDiaria AsignacionDiaria_evento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."AsignacionDiaria"
    ADD CONSTRAINT "AsignacionDiaria_evento_id_fkey" FOREIGN KEY (evento_id) REFERENCES public."Evento"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: AsignacionDiaria AsignacionDiaria_jornada_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."AsignacionDiaria"
    ADD CONSTRAINT "AsignacionDiaria_jornada_id_fkey" FOREIGN KEY (jornada_id) REFERENCES public."Jornada"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: AsignacionDiaria AsignacionDiaria_parte_diario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."AsignacionDiaria"
    ADD CONSTRAINT "AsignacionDiaria_parte_diario_id_fkey" FOREIGN KEY (parte_diario_id) REFERENCES public."ParteDiario"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: AsignacionStock AsignacionStock_camion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."AsignacionStock"
    ADD CONSTRAINT "AsignacionStock_camion_id_fkey" FOREIGN KEY (camion_id) REFERENCES public."Camion"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: AsignacionStock AsignacionStock_cuna_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."AsignacionStock"
    ADD CONSTRAINT "AsignacionStock_cuna_id_fkey" FOREIGN KEY (cuna_id) REFERENCES public."Cuna"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: AsignacionStock AsignacionStock_evento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."AsignacionStock"
    ADD CONSTRAINT "AsignacionStock_evento_id_fkey" FOREIGN KEY (evento_id) REFERENCES public."Evento"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: AsignacionStock AsignacionStock_evento_origen_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."AsignacionStock"
    ADD CONSTRAINT "AsignacionStock_evento_origen_id_fkey" FOREIGN KEY (evento_origen_id) REFERENCES public."Evento"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: AsignacionStock AsignacionStock_producto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."AsignacionStock"
    ADD CONSTRAINT "AsignacionStock_producto_id_fkey" FOREIGN KEY (producto_id) REFERENCES public."Producto"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: AsignacionStock AsignacionStock_rubro_evento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."AsignacionStock"
    ADD CONSTRAINT "AsignacionStock_rubro_evento_id_fkey" FOREIGN KEY (rubro_evento_id) REFERENCES public."RubroEvento"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: AuditoriaLog AuditoriaLog_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."AuditoriaLog"
    ADD CONSTRAINT "AuditoriaLog_empresa_id_fkey" FOREIGN KEY (empresa_id) REFERENCES public."Empresa"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: AuditoriaLog AuditoriaLog_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."AuditoriaLog"
    ADD CONSTRAINT "AuditoriaLog_usuario_id_fkey" FOREIGN KEY (usuario_id) REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Camion Camion_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."Camion"
    ADD CONSTRAINT "Camion_empresa_id_fkey" FOREIGN KEY (empresa_id) REFERENCES public."Empresa"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: CategoriaStock CategoriaStock_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."CategoriaStock"
    ADD CONSTRAINT "CategoriaStock_empresa_id_fkey" FOREIGN KEY (empresa_id) REFERENCES public."Empresa"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: CuentaBancaria CuentaBancaria_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."CuentaBancaria"
    ADD CONSTRAINT "CuentaBancaria_empresa_id_fkey" FOREIGN KEY (empresa_id) REFERENCES public."Empresa"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: CuentaBancaria CuentaBancaria_evento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."CuentaBancaria"
    ADD CONSTRAINT "CuentaBancaria_evento_id_fkey" FOREIGN KEY (evento_id) REFERENCES public."Evento"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: CuentaBancaria CuentaBancaria_responsable_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."CuentaBancaria"
    ADD CONSTRAINT "CuentaBancaria_responsable_id_fkey" FOREIGN KEY (responsable_id) REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: CuentaCorriente CuentaCorriente_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."CuentaCorriente"
    ADD CONSTRAINT "CuentaCorriente_empresa_id_fkey" FOREIGN KEY (empresa_id) REFERENCES public."Empresa"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: CuentaCorriente CuentaCorriente_proveedor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."CuentaCorriente"
    ADD CONSTRAINT "CuentaCorriente_proveedor_id_fkey" FOREIGN KEY (proveedor_id) REFERENCES public."Proveedor"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: CunaProducto CunaProducto_cuna_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."CunaProducto"
    ADD CONSTRAINT "CunaProducto_cuna_id_fkey" FOREIGN KEY (cuna_id) REFERENCES public."Cuna"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: CunaProducto CunaProducto_producto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."CunaProducto"
    ADD CONSTRAINT "CunaProducto_producto_id_fkey" FOREIGN KEY (producto_id) REFERENCES public."Producto"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Cuna Cuna_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."Cuna"
    ADD CONSTRAINT "Cuna_empresa_id_fkey" FOREIGN KEY (empresa_id) REFERENCES public."Empresa"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Echeq Echeq_evento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."Echeq"
    ADD CONSTRAINT "Echeq_evento_id_fkey" FOREIGN KEY (evento_id) REFERENCES public."Evento"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Echeq Echeq_movimiento_caja_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."Echeq"
    ADD CONSTRAINT "Echeq_movimiento_caja_id_fkey" FOREIGN KEY (movimiento_caja_id) REFERENCES public."MovimientoCaja"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Echeq Echeq_movimiento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."Echeq"
    ADD CONSTRAINT "Echeq_movimiento_id_fkey" FOREIGN KEY (movimiento_id) REFERENCES public."Movimiento"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Echeq Echeq_proveedor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."Echeq"
    ADD CONSTRAINT "Echeq_proveedor_id_fkey" FOREIGN KEY (proveedor_id) REFERENCES public."Proveedor"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Empleado Empleado_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."Empleado"
    ADD CONSTRAINT "Empleado_empresa_id_fkey" FOREIGN KEY (empresa_id) REFERENCES public."Empresa"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Empleado Empleado_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."Empleado"
    ADD CONSTRAINT "Empleado_usuario_id_fkey" FOREIGN KEY (usuario_id) REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: EventoAcceso EventoAcceso_evento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."EventoAcceso"
    ADD CONSTRAINT "EventoAcceso_evento_id_fkey" FOREIGN KEY (evento_id) REFERENCES public."Evento"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: EventoAcceso EventoAcceso_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."EventoAcceso"
    ADD CONSTRAINT "EventoAcceso_usuario_id_fkey" FOREIGN KEY (usuario_id) REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: EventoCuenta EventoCuenta_cuenta_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."EventoCuenta"
    ADD CONSTRAINT "EventoCuenta_cuenta_id_fkey" FOREIGN KEY (cuenta_id) REFERENCES public."CuentaBancaria"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: EventoCuenta EventoCuenta_evento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."EventoCuenta"
    ADD CONSTRAINT "EventoCuenta_evento_id_fkey" FOREIGN KEY (evento_id) REFERENCES public."Evento"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Evento Evento_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."Evento"
    ADD CONSTRAINT "Evento_empresa_id_fkey" FOREIGN KEY (empresa_id) REFERENCES public."Empresa"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Factura Factura_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."Factura"
    ADD CONSTRAINT "Factura_empresa_id_fkey" FOREIGN KEY (empresa_id) REFERENCES public."Empresa"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Factura Factura_evento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."Factura"
    ADD CONSTRAINT "Factura_evento_id_fkey" FOREIGN KEY (evento_id) REFERENCES public."Evento"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Factura Factura_proveedor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."Factura"
    ADD CONSTRAINT "Factura_proveedor_id_fkey" FOREIGN KEY (proveedor_id) REFERENCES public."Proveedor"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Factura Factura_rubro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."Factura"
    ADD CONSTRAINT "Factura_rubro_id_fkey" FOREIGN KEY (rubro_id) REFERENCES public."Rubro"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Jornada Jornada_camion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."Jornada"
    ADD CONSTRAINT "Jornada_camion_id_fkey" FOREIGN KEY (camion_id) REFERENCES public."Camion"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Jornada Jornada_empleado_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."Jornada"
    ADD CONSTRAINT "Jornada_empleado_id_fkey" FOREIGN KEY (empleado_id) REFERENCES public."Empleado"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Jornada Jornada_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."Jornada"
    ADD CONSTRAINT "Jornada_empresa_id_fkey" FOREIGN KEY (empresa_id) REFERENCES public."Empresa"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Jornada Jornada_evento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."Jornada"
    ADD CONSTRAINT "Jornada_evento_id_fkey" FOREIGN KEY (evento_id) REFERENCES public."Evento"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: LineaComida LineaComida_pedido_comida_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."LineaComida"
    ADD CONSTRAINT "LineaComida_pedido_comida_id_fkey" FOREIGN KEY (pedido_comida_id) REFERENCES public."PedidoComida"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Liquidacion Liquidacion_empleado_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."Liquidacion"
    ADD CONSTRAINT "Liquidacion_empleado_id_fkey" FOREIGN KEY (empleado_id) REFERENCES public."Empleado"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Liquidacion Liquidacion_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."Liquidacion"
    ADD CONSTRAINT "Liquidacion_empresa_id_fkey" FOREIGN KEY (empresa_id) REFERENCES public."Empresa"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Liquidacion Liquidacion_evento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."Liquidacion"
    ADD CONSTRAINT "Liquidacion_evento_id_fkey" FOREIGN KEY (evento_id) REFERENCES public."Evento"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Liquidacion Liquidacion_movimiento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."Liquidacion"
    ADD CONSTRAINT "Liquidacion_movimiento_id_fkey" FOREIGN KEY (movimiento_id) REFERENCES public."Movimiento"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: MovimientoCCC MovimientoCCC_cuenta_ccc_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."MovimientoCCC"
    ADD CONSTRAINT "MovimientoCCC_cuenta_ccc_id_fkey" FOREIGN KEY (cuenta_ccc_id) REFERENCES public."CuentaCorriente"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: MovimientoCCC MovimientoCCC_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."MovimientoCCC"
    ADD CONSTRAINT "MovimientoCCC_empresa_id_fkey" FOREIGN KEY (empresa_id) REFERENCES public."Empresa"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: MovimientoCCC MovimientoCCC_evento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."MovimientoCCC"
    ADD CONSTRAINT "MovimientoCCC_evento_id_fkey" FOREIGN KEY (evento_id) REFERENCES public."Evento"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: MovimientoCCC MovimientoCCC_factura_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."MovimientoCCC"
    ADD CONSTRAINT "MovimientoCCC_factura_id_fkey" FOREIGN KEY (factura_id) REFERENCES public."Factura"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: MovimientoCaja MovimientoCaja_cuenta_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."MovimientoCaja"
    ADD CONSTRAINT "MovimientoCaja_cuenta_id_fkey" FOREIGN KEY (cuenta_id) REFERENCES public."CuentaBancaria"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: MovimientoCaja MovimientoCaja_evento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."MovimientoCaja"
    ADD CONSTRAINT "MovimientoCaja_evento_id_fkey" FOREIGN KEY (evento_id) REFERENCES public."Evento"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: MovimientoPanol MovimientoPanol_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."MovimientoPanol"
    ADD CONSTRAINT "MovimientoPanol_empresa_id_fkey" FOREIGN KEY (empresa_id) REFERENCES public."Empresa"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: MovimientoPanol MovimientoPanol_evento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."MovimientoPanol"
    ADD CONSTRAINT "MovimientoPanol_evento_id_fkey" FOREIGN KEY (evento_id) REFERENCES public."Evento"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: MovimientoPanol MovimientoPanol_panol_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."MovimientoPanol"
    ADD CONSTRAINT "MovimientoPanol_panol_item_id_fkey" FOREIGN KEY (panol_item_id) REFERENCES public."PanolItem"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: MovimientoStock MovimientoStock_asignacion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."MovimientoStock"
    ADD CONSTRAINT "MovimientoStock_asignacion_id_fkey" FOREIGN KEY (asignacion_id) REFERENCES public."AsignacionStock"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: MovimientoStock MovimientoStock_producto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."MovimientoStock"
    ADD CONSTRAINT "MovimientoStock_producto_id_fkey" FOREIGN KEY (producto_id) REFERENCES public."Producto"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Movimiento Movimiento_evento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."Movimiento"
    ADD CONSTRAINT "Movimiento_evento_id_fkey" FOREIGN KEY (evento_id) REFERENCES public."Evento"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Movimiento Movimiento_movimiento_caja_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."Movimiento"
    ADD CONSTRAINT "Movimiento_movimiento_caja_id_fkey" FOREIGN KEY (movimiento_caja_id) REFERENCES public."MovimientoCaja"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Movimiento Movimiento_proveedor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."Movimiento"
    ADD CONSTRAINT "Movimiento_proveedor_id_fkey" FOREIGN KEY (proveedor_id) REFERENCES public."Proveedor"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Movimiento Movimiento_responsable_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."Movimiento"
    ADD CONSTRAINT "Movimiento_responsable_id_fkey" FOREIGN KEY (responsable_id) REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Movimiento Movimiento_rubro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."Movimiento"
    ADD CONSTRAINT "Movimiento_rubro_id_fkey" FOREIGN KEY (rubro_id) REFERENCES public."Rubro"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: PagoFactura PagoFactura_echeq_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."PagoFactura"
    ADD CONSTRAINT "PagoFactura_echeq_id_fkey" FOREIGN KEY (echeq_id) REFERENCES public."Echeq"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: PagoFactura PagoFactura_factura_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."PagoFactura"
    ADD CONSTRAINT "PagoFactura_factura_id_fkey" FOREIGN KEY (factura_id) REFERENCES public."Factura"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: PagoFactura PagoFactura_movimiento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."PagoFactura"
    ADD CONSTRAINT "PagoFactura_movimiento_id_fkey" FOREIGN KEY (movimiento_id) REFERENCES public."Movimiento"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: PanolItem PanolItem_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."PanolItem"
    ADD CONSTRAINT "PanolItem_empresa_id_fkey" FOREIGN KEY (empresa_id) REFERENCES public."Empresa"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ParteCCC ParteCCC_cuenta_ccc_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."ParteCCC"
    ADD CONSTRAINT "ParteCCC_cuenta_ccc_id_fkey" FOREIGN KEY (cuenta_ccc_id) REFERENCES public."CuentaCorriente"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ParteDiario ParteDiario_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."ParteDiario"
    ADD CONSTRAINT "ParteDiario_empresa_id_fkey" FOREIGN KEY (empresa_id) REFERENCES public."Empresa"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: PedidoComida PedidoComida_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."PedidoComida"
    ADD CONSTRAINT "PedidoComida_empresa_id_fkey" FOREIGN KEY (empresa_id) REFERENCES public."Empresa"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: PedidoComida PedidoComida_evento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."PedidoComida"
    ADD CONSTRAINT "PedidoComida_evento_id_fkey" FOREIGN KEY (evento_id) REFERENCES public."Evento"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: PedidoComida PedidoComida_proveedor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."PedidoComida"
    ADD CONSTRAINT "PedidoComida_proveedor_id_fkey" FOREIGN KEY (proveedor_id) REFERENCES public."Proveedor"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: PedidoItem PedidoItem_rubro_evento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."PedidoItem"
    ADD CONSTRAINT "PedidoItem_rubro_evento_id_fkey" FOREIGN KEY (rubro_evento_id) REFERENCES public."RubroEvento"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: PreMacro PreMacro_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."PreMacro"
    ADD CONSTRAINT "PreMacro_empresa_id_fkey" FOREIGN KEY (empresa_id) REFERENCES public."Empresa"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: PreMacro PreMacro_evento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."PreMacro"
    ADD CONSTRAINT "PreMacro_evento_id_fkey" FOREIGN KEY (evento_id) REFERENCES public."Evento"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Producto Producto_categoria_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."Producto"
    ADD CONSTRAINT "Producto_categoria_id_fkey" FOREIGN KEY (categoria_id) REFERENCES public."CategoriaStock"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Producto Producto_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."Producto"
    ADD CONSTRAINT "Producto_empresa_id_fkey" FOREIGN KEY (empresa_id) REFERENCES public."Empresa"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Proveedor Proveedor_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."Proveedor"
    ADD CONSTRAINT "Proveedor_empresa_id_fkey" FOREIGN KEY (empresa_id) REFERENCES public."Empresa"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: RubroEvento RubroEvento_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."RubroEvento"
    ADD CONSTRAINT "RubroEvento_empresa_id_fkey" FOREIGN KEY (empresa_id) REFERENCES public."Empresa"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: RubroEvento RubroEvento_evento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."RubroEvento"
    ADD CONSTRAINT "RubroEvento_evento_id_fkey" FOREIGN KEY (evento_id) REFERENCES public."Evento"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: RubroEvento RubroEvento_proveedor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."RubroEvento"
    ADD CONSTRAINT "RubroEvento_proveedor_id_fkey" FOREIGN KEY (proveedor_id) REFERENCES public."Proveedor"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: RubroEvento RubroEvento_rubro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."RubroEvento"
    ADD CONSTRAINT "RubroEvento_rubro_id_fkey" FOREIGN KEY (rubro_id) REFERENCES public."Rubro"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Rubro Rubro_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."Rubro"
    ADD CONSTRAINT "Rubro_empresa_id_fkey" FOREIGN KEY (empresa_id) REFERENCES public."Empresa"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: SocioPreMacro SocioPreMacro_pre_macro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."SocioPreMacro"
    ADD CONSTRAINT "SocioPreMacro_pre_macro_id_fkey" FOREIGN KEY (pre_macro_id) REFERENCES public."PreMacro"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: TabConfig TabConfig_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."TabConfig"
    ADD CONSTRAINT "TabConfig_empresa_id_fkey" FOREIGN KEY (empresa_id) REFERENCES public."Empresa"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: UsuarioEmpresaAcceso UsuarioEmpresaAcceso_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."UsuarioEmpresaAcceso"
    ADD CONSTRAINT "UsuarioEmpresaAcceso_empresa_id_fkey" FOREIGN KEY (empresa_id) REFERENCES public."Empresa"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: UsuarioEmpresaAcceso UsuarioEmpresaAcceso_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."UsuarioEmpresaAcceso"
    ADD CONSTRAINT "UsuarioEmpresaAcceso_usuario_id_fkey" FOREIGN KEY (usuario_id) REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Usuario Usuario_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."Usuario"
    ADD CONSTRAINT "Usuario_empresa_id_fkey" FOREIGN KEY (empresa_id) REFERENCES public."Empresa"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: admin_portal
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;


--
-- PostgreSQL database dump complete
--

\unrestrict cOH5wnaEdtv79ywfsiMUOl3Bnsv4WOtZRJpnvVXMHPzC5YYy38fRQAouObDTVl2

