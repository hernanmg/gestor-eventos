--
-- PostgreSQL database dump
--

\restrict zuRF0ikY1SRJ5YxmVugE3vVRVhHtgw3hdwE5yuG1sZSTsI6AvyT4RQIi2ovnz3s

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
-- Name: CategoriaAcuerdo; Type: TYPE; Schema: public; Owner: admin_portal
--

CREATE TYPE public."CategoriaAcuerdo" AS ENUM (
    'GENERAL',
    'CHOFER'
);


ALTER TYPE public."CategoriaAcuerdo" OWNER TO admin_portal;

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
-- Name: CondicionCliente; Type: TYPE; Schema: public; Owner: admin_portal
--

CREATE TYPE public."CondicionCliente" AS ENUM (
    'RESPONSABLE_INSCRIPTO',
    'MONOTRIBUTISTA',
    'EXENTO',
    'CONSUMIDOR_FINAL',
    'EXTERIOR'
);


ALTER TYPE public."CondicionCliente" OWNER TO admin_portal;

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
-- Name: EstadoAsistencia; Type: TYPE; Schema: public; Owner: admin_portal
--

CREATE TYPE public."EstadoAsistencia" AS ENUM (
    'PRESENTE',
    'TARDE',
    'MEDIA_JORNADA',
    'AUSENTE',
    'JUSTIFICADO',
    'LIBRE',
    'VACACIONES',
    'LICENCIA'
);


ALTER TYPE public."EstadoAsistencia" OWNER TO admin_portal;

--
-- Name: EstadoCargaCombustible; Type: TYPE; Schema: public; Owner: admin_portal
--

CREATE TYPE public."EstadoCargaCombustible" AS ENUM (
    'AUTORIZADA',
    'PENDIENTE_AUTORIZACION',
    'RECHAZADA'
);


ALTER TYPE public."EstadoCargaCombustible" OWNER TO admin_portal;

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
    'RECHAZADO',
    'VENDIDO'
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
-- Name: EstadoFacturaEmitida; Type: TYPE; Schema: public; Owner: admin_portal
--

CREATE TYPE public."EstadoFacturaEmitida" AS ENUM (
    'EMITIDA',
    'COBRADA_PARCIAL',
    'COBRADA',
    'INCOBRABLE',
    'ANULADA'
);


ALTER TYPE public."EstadoFacturaEmitida" OWNER TO admin_portal;

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
-- Name: EstadoLineaGasto; Type: TYPE; Schema: public; Owner: admin_portal
--

CREATE TYPE public."EstadoLineaGasto" AS ENUM (
    'PENDIENTE',
    'PAGADO',
    'ANULADO'
);


ALTER TYPE public."EstadoLineaGasto" OWNER TO admin_portal;

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
-- Name: EstadoLiquidacionAdmin; Type: TYPE; Schema: public; Owner: admin_portal
--

CREATE TYPE public."EstadoLiquidacionAdmin" AS ENUM (
    'BORRADOR',
    'APROBADA',
    'PAGADA',
    'CANCELADA'
);


ALTER TYPE public."EstadoLiquidacionAdmin" OWNER TO admin_portal;

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
-- Name: EstadoPatente; Type: TYPE; Schema: public; Owner: admin_portal
--

CREATE TYPE public."EstadoPatente" AS ENUM (
    'PAGADA',
    'PENDIENTE',
    'VENCIDA'
);


ALTER TYPE public."EstadoPatente" OWNER TO admin_portal;

--
-- Name: EstadoPlanAFIP; Type: TYPE; Schema: public; Owner: admin_portal
--

CREATE TYPE public."EstadoPlanAFIP" AS ENUM (
    'ACTIVO',
    'CANCELADO',
    'FINALIZADO',
    'CADUCADO'
);


ALTER TYPE public."EstadoPlanAFIP" OWNER TO admin_portal;

--
-- Name: EstadoPrestamo; Type: TYPE; Schema: public; Owner: admin_portal
--

CREATE TYPE public."EstadoPrestamo" AS ENUM (
    'ACTIVO',
    'CANCELADO_ANTICIPADO',
    'FINALIZADO'
);


ALTER TYPE public."EstadoPrestamo" OWNER TO admin_portal;

--
-- Name: EstadoPresupuesto; Type: TYPE; Schema: public; Owner: admin_portal
--

CREATE TYPE public."EstadoPresupuesto" AS ENUM (
    'BORRADOR',
    'ENVIADO',
    'APROBADO',
    'CERRADO'
);


ALTER TYPE public."EstadoPresupuesto" OWNER TO admin_portal;

--
-- Name: EstadoRemito; Type: TYPE; Schema: public; Owner: admin_portal
--

CREATE TYPE public."EstadoRemito" AS ENUM (
    'BORRADOR',
    'EMITIDO'
);


ALTER TYPE public."EstadoRemito" OWNER TO admin_portal;

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
-- Name: EstadoSeguro; Type: TYPE; Schema: public; Owner: admin_portal
--

CREATE TYPE public."EstadoSeguro" AS ENUM (
    'VIGENTE',
    'POR_VENCER',
    'VENCIDO',
    'CANCELADO'
);


ALTER TYPE public."EstadoSeguro" OWNER TO admin_portal;

--
-- Name: EstadoServicioTaller; Type: TYPE; Schema: public; Owner: admin_portal
--

CREATE TYPE public."EstadoServicioTaller" AS ENUM (
    'PRESUPUESTADO',
    'EN_PROCESO',
    'FINALIZADO',
    'CANCELADO'
);


ALTER TYPE public."EstadoServicioTaller" OWNER TO admin_portal;

--
-- Name: EstadoSiniestro; Type: TYPE; Schema: public; Owner: admin_portal
--

CREATE TYPE public."EstadoSiniestro" AS ENUM (
    'ABIERTO',
    'EN_TRAMITE',
    'CERRADO',
    'RECHAZADO'
);


ALTER TYPE public."EstadoSiniestro" OWNER TO admin_portal;

--
-- Name: EstadoSiniestroVehiculo; Type: TYPE; Schema: public; Owner: admin_portal
--

CREATE TYPE public."EstadoSiniestroVehiculo" AS ENUM (
    'ABIERTO',
    'EN_PROCESO',
    'RESUELTO',
    'SIN_NOVEDAD'
);


ALTER TYPE public."EstadoSiniestroVehiculo" OWNER TO admin_portal;

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
-- Name: OrigenBitacoraViaje; Type: TYPE; Schema: public; Owner: admin_portal
--

CREATE TYPE public."OrigenBitacoraViaje" AS ENUM (
    'RRHH',
    'FLOTA'
);


ALTER TYPE public."OrigenBitacoraViaje" OWNER TO admin_portal;

--
-- Name: OrigenMaterialRental; Type: TYPE; Schema: public; Owner: admin_portal
--

CREATE TYPE public."OrigenMaterialRental" AS ENUM (
    'NAC',
    'IMP'
);


ALTER TYPE public."OrigenMaterialRental" OWNER TO admin_portal;

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
    'DESCUENTO',
    'MULTA'
);


ALTER TYPE public."TipoAnticipo" OWNER TO admin_portal;

--
-- Name: TipoAumento; Type: TYPE; Schema: public; Owner: admin_portal
--

CREATE TYPE public."TipoAumento" AS ENUM (
    'MANUAL',
    'IPC',
    'SIN_AUMENTO'
);


ALTER TYPE public."TipoAumento" OWNER TO admin_portal;

--
-- Name: TipoCombustible; Type: TYPE; Schema: public; Owner: admin_portal
--

CREATE TYPE public."TipoCombustible" AS ENUM (
    'NAFTA_SUPER',
    'NAFTA_PREMIUM',
    'DIESEL',
    'GNC'
);


ALTER TYPE public."TipoCombustible" OWNER TO admin_portal;

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
-- Name: TipoComprobanteEmitido; Type: TYPE; Schema: public; Owner: admin_portal
--

CREATE TYPE public."TipoComprobanteEmitido" AS ENUM (
    'FACTURA_A',
    'FACTURA_B',
    'FACTURA_C',
    'FACTURA_MIPYMES_FCE_A',
    'FACTURA_MIPYMES_FCE_B',
    'NOTA_CREDITO_A',
    'NOTA_CREDITO_B',
    'NOTA_CREDITO_C',
    'NOTA_DEBITO_A',
    'NOTA_DEBITO_B',
    'RECIBO',
    'NOTA_DEBITO_C',
    'RECIBO_B',
    'LIQUIDACION_A',
    'TIQUE_FACTURA_A'
);


ALTER TYPE public."TipoComprobanteEmitido" OWNER TO admin_portal;

--
-- Name: TipoCuenta; Type: TYPE; Schema: public; Owner: admin_portal
--

CREATE TYPE public."TipoCuenta" AS ENUM (
    'EFECTIVO',
    'BANCO',
    'FIMA'
);


ALTER TYPE public."TipoCuenta" OWNER TO admin_portal;

--
-- Name: TipoIndicador; Type: TYPE; Schema: public; Owner: admin_portal
--

CREATE TYPE public."TipoIndicador" AS ENUM (
    'DOLAR_OFICIAL',
    'DOLAR_BLUE',
    'IPC'
);


ALTER TYPE public."TipoIndicador" OWNER TO admin_portal;

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
-- Name: TipoPatente; Type: TYPE; Schema: public; Owner: admin_portal
--

CREATE TYPE public."TipoPatente" AS ENUM (
    'MUNICIPAL',
    'PROVINCIAL',
    'NACIONAL'
);


ALTER TYPE public."TipoPatente" OWNER TO admin_portal;

--
-- Name: TipoRecorrido; Type: TYPE; Schema: public; Owner: admin_portal
--

CREATE TYPE public."TipoRecorrido" AS ENUM (
    'PROVINCIAL',
    'NACIONAL',
    'NACIONAL_1000'
);


ALTER TYPE public."TipoRecorrido" OWNER TO admin_portal;

--
-- Name: TipoRemito; Type: TYPE; Schema: public; Owner: admin_portal
--

CREATE TYPE public."TipoRemito" AS ENUM (
    'LAYHER',
    'NACIONAL',
    'TECHOS',
    'PANOL',
    'LONAS_AFORO'
);


ALTER TYPE public."TipoRemito" OWNER TO admin_portal;

--
-- Name: TipoRubro; Type: TYPE; Schema: public; Owner: admin_portal
--

CREATE TYPE public."TipoRubro" AS ENUM (
    'EGRESO',
    'INGRESO'
);


ALTER TYPE public."TipoRubro" OWNER TO admin_portal;

--
-- Name: TipoServicioTaller; Type: TYPE; Schema: public; Owner: admin_portal
--

CREATE TYPE public."TipoServicioTaller" AS ENUM (
    'MANTENIMIENTO',
    'REPARACION',
    'NEUMATICOS',
    'CHAPERIA_PINTURA',
    'ELECTRICIDAD',
    'OTROS'
);


ALTER TYPE public."TipoServicioTaller" OWNER TO admin_portal;

--
-- Name: TipoSiniestro; Type: TYPE; Schema: public; Owner: admin_portal
--

CREATE TYPE public."TipoSiniestro" AS ENUM (
    'ACCIDENTE_TRABAJO',
    'ENFERMEDAD_LABORAL',
    'ACCIDENTE_IN_ITINERE',
    'OTRO'
);


ALTER TYPE public."TipoSiniestro" OWNER TO admin_portal;

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
    created_by integer,
    cantidad integer DEFAULT 0,
    responsable_deposito text,
    cantidad_minima integer DEFAULT 0
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
-- Name: AcuerdoSueldo; Type: TABLE; Schema: public; Owner: admin_portal
--

CREATE TABLE public."AcuerdoSueldo" (
    id integer NOT NULL,
    empleado_id integer NOT NULL,
    empresa_id integer NOT NULL,
    fecha_inicio timestamp(3) without time zone NOT NULL,
    vigencia_meses integer,
    escalafon text,
    tipo_seguro text,
    sueldo_basico numeric(12,2) NOT NULL,
    horas_acordadas_mes integer DEFAULT 200 NOT NULL,
    premio_incentivo numeric(12,2),
    viatico numeric(12,2),
    premio_presentismo numeric(12,2),
    valor_hora_extra numeric(10,2),
    telefono numeric(10,2),
    activo boolean DEFAULT true NOT NULL,
    notas text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    created_by integer,
    deleted_at timestamp(3) without time zone,
    viatico_nacional numeric(10,2),
    viatico_nacional_1000 numeric(10,2),
    viatico_provincial numeric(10,2),
    categoria_acuerdo public."CategoriaAcuerdo" DEFAULT 'GENERAL'::public."CategoriaAcuerdo" NOT NULL,
    horas_pendientes_acum numeric(8,2),
    porcentaje_acuerdo numeric(5,2),
    cobra_premio_produccion boolean DEFAULT false NOT NULL,
    valor_premio_produccion numeric(10,2)
);


ALTER TABLE public."AcuerdoSueldo" OWNER TO admin_portal;

--
-- Name: AcuerdoSueldo_id_seq; Type: SEQUENCE; Schema: public; Owner: admin_portal
--

CREATE SEQUENCE public."AcuerdoSueldo_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."AcuerdoSueldo_id_seq" OWNER TO admin_portal;

--
-- Name: AcuerdoSueldo_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin_portal
--

ALTER SEQUENCE public."AcuerdoSueldo_id_seq" OWNED BY public."AcuerdoSueldo".id;


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
    created_by integer,
    liquidacion_admin_id integer
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
-- Name: BitacoraViaje; Type: TABLE; Schema: public; Owner: admin_portal
--

CREATE TABLE public."BitacoraViaje" (
    id integer NOT NULL,
    empleado_id integer,
    empresa_id integer NOT NULL,
    fecha timestamp(3) without time zone,
    convocatoria text,
    dia_semana text,
    hora_inicio text,
    hora_fin text,
    horas_trabajadas numeric(5,2),
    ejido text,
    recorrido text,
    tipo_recorrido public."TipoRecorrido",
    cantidad_vueltas integer DEFAULT 1 NOT NULL,
    valor_por_vuelta numeric(10,2),
    viatico_calculado numeric(10,2),
    observaciones text,
    liquidacion_admin_id integer,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    deleted_at timestamp(3) without time zone,
    created_by integer,
    alias_camion text,
    camion_id integer,
    chofer_nombre text,
    horario_llegada timestamp(3) without time zone,
    horario_salida timestamp(3) without time zone,
    km_finales integer,
    km_iniciales integer,
    km_recorridos integer,
    litros_cargados_ruta numeric(10,2),
    monto_caja_entregada numeric(14,2),
    monto_combustible numeric(14,2),
    origen public."OrigenBitacoraViaje" DEFAULT 'RRHH'::public."OrigenBitacoraViaje" NOT NULL,
    patente_camion text,
    km_por_litro numeric(6,2),
    litros_consumidos numeric(10,2),
    litros_iniciales_tanque numeric(10,2),
    evento_id integer
);


ALTER TABLE public."BitacoraViaje" OWNER TO admin_portal;

--
-- Name: BitacoraViaje_id_seq; Type: SEQUENCE; Schema: public; Owner: admin_portal
--

CREATE SEQUENCE public."BitacoraViaje_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."BitacoraViaje_id_seq" OWNER TO admin_portal;

--
-- Name: BitacoraViaje_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin_portal
--

ALTER SEQUENCE public."BitacoraViaje_id_seq" OWNED BY public."BitacoraViaje".id;


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
    deleted_at timestamp(3) without time zone,
    anio integer,
    color text,
    en_servicio boolean DEFAULT true NOT NULL,
    fecha_baja timestamp(3) without time zone,
    marca text,
    modelo text,
    motivo_baja text,
    numero_telepase text,
    titular text,
    km_actual integer,
    limite_mensual_combustible numeric(12,2),
    capacidad_combustible text,
    tipo_vehiculo text,
    notas text
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
-- Name: CargaCombustible; Type: TABLE; Schema: public; Owner: admin_portal
--

CREATE TABLE public."CargaCombustible" (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    camion_id integer,
    fecha timestamp(3) without time zone NOT NULL,
    tipo_combustible public."TipoCombustible" DEFAULT 'DIESEL'::public."TipoCombustible" NOT NULL,
    litros numeric(10,3) NOT NULL,
    precio_por_litro numeric(10,2),
    monto_total numeric(12,2) NOT NULL,
    estacion_nombre text,
    estacion_ciudad text,
    km_actual integer,
    km_anterior integer,
    km_recorridos integer,
    rendimiento_lts_100km numeric(6,2),
    estado public."EstadoCargaCombustible" DEFAULT 'AUTORIZADA'::public."EstadoCargaCombustible" NOT NULL,
    autorizado_por integer,
    autorizado_at timestamp(3) without time zone,
    evento_id integer,
    cuenta_corriente_id integer,
    responsable_nombre text,
    comprobante_data bytea,
    comprobante_nombre text,
    comprobante_mime text,
    notas text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    deleted_at timestamp(3) without time zone,
    created_by integer,
    numero_comprobante text,
    pagos numeric(12,2),
    saldo numeric(15,2),
    tipo_movimiento text,
    orden integer
);


ALTER TABLE public."CargaCombustible" OWNER TO admin_portal;

--
-- Name: CargaCombustible_id_seq; Type: SEQUENCE; Schema: public; Owner: admin_portal
--

CREATE SEQUENCE public."CargaCombustible_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."CargaCombustible_id_seq" OWNER TO admin_portal;

--
-- Name: CargaCombustible_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin_portal
--

ALTER SEQUENCE public."CargaCombustible_id_seq" OWNED BY public."CargaCombustible".id;


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
-- Name: CierreContable; Type: TABLE; Schema: public; Owner: admin_portal
--

CREATE TABLE public."CierreContable" (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    fecha_corte timestamp(3) without time zone NOT NULL,
    periodo_anio integer NOT NULL,
    estado text DEFAULT 'BORRADOR'::text NOT NULL,
    snapshot jsonb NOT NULL,
    notas text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    created_by integer
);


ALTER TABLE public."CierreContable" OWNER TO admin_portal;

--
-- Name: CierreContable_id_seq; Type: SEQUENCE; Schema: public; Owner: admin_portal
--

CREATE SEQUENCE public."CierreContable_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."CierreContable_id_seq" OWNER TO admin_portal;

--
-- Name: CierreContable_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin_portal
--

ALTER SEQUENCE public."CierreContable_id_seq" OWNED BY public."CierreContable".id;


--
-- Name: CobroFacturaEmitida; Type: TABLE; Schema: public; Owner: admin_portal
--

CREATE TABLE public."CobroFacturaEmitida" (
    id integer NOT NULL,
    factura_emitida_id integer NOT NULL,
    fecha timestamp(3) without time zone NOT NULL,
    monto numeric(15,2) NOT NULL,
    moneda public."Moneda" DEFAULT 'ARS'::public."Moneda" NOT NULL,
    forma_cobro text,
    cuenta_destino_id integer,
    referencia text,
    notas text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by integer
);


ALTER TABLE public."CobroFacturaEmitida" OWNER TO admin_portal;

--
-- Name: CobroFacturaEmitida_id_seq; Type: SEQUENCE; Schema: public; Owner: admin_portal
--

CREATE SEQUENCE public."CobroFacturaEmitida_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."CobroFacturaEmitida_id_seq" OWNER TO admin_portal;

--
-- Name: CobroFacturaEmitida_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin_portal
--

ALTER SEQUENCE public."CobroFacturaEmitida_id_seq" OWNED BY public."CobroFacturaEmitida".id;


--
-- Name: ConsumoTC; Type: TABLE; Schema: public; Owner: admin_portal
--

CREATE TABLE public."ConsumoTC" (
    id integer NOT NULL,
    tarjeta_id integer NOT NULL,
    responsable_id integer NOT NULL,
    fecha timestamp(3) without time zone NOT NULL,
    periodo_mes integer NOT NULL,
    periodo_anio integer NOT NULL,
    monto_ars numeric(15,2),
    monto_usd numeric(15,2),
    detalle text,
    observaciones text,
    empresa_imputa text,
    descontado boolean DEFAULT false NOT NULL,
    nota_descuento text,
    import_key text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    created_by integer,
    deleted_at timestamp(3) without time zone
);


ALTER TABLE public."ConsumoTC" OWNER TO admin_portal;

--
-- Name: ConsumoTC_id_seq; Type: SEQUENCE; Schema: public; Owner: admin_portal
--

CREATE SEQUENCE public."ConsumoTC_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."ConsumoTC_id_seq" OWNER TO admin_portal;

--
-- Name: ConsumoTC_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin_portal
--

ALTER SEQUENCE public."ConsumoTC_id_seq" OWNED BY public."ConsumoTC".id;


--
-- Name: CortesiaEvento; Type: TABLE; Schema: public; Owner: admin_portal
--

CREATE TABLE public."CortesiaEvento" (
    id integer NOT NULL,
    evento_id integer NOT NULL,
    empresa_id integer NOT NULL,
    cliente_nombre text NOT NULL,
    contacto_nombre text,
    autorizado_por text,
    observacion text,
    visado boolean DEFAULT false NOT NULL,
    entregado boolean DEFAULT false NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    deleted_at timestamp(3) without time zone,
    created_by integer
);


ALTER TABLE public."CortesiaEvento" OWNER TO admin_portal;

--
-- Name: CortesiaEvento_id_seq; Type: SEQUENCE; Schema: public; Owner: admin_portal
--

CREATE SEQUENCE public."CortesiaEvento_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."CortesiaEvento_id_seq" OWNER TO admin_portal;

--
-- Name: CortesiaEvento_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin_portal
--

ALTER SEQUENCE public."CortesiaEvento_id_seq" OWNED BY public."CortesiaEvento".id;


--
-- Name: CortesiaItem; Type: TABLE; Schema: public; Owner: admin_portal
--

CREATE TABLE public."CortesiaItem" (
    id integer NOT NULL,
    cortesia_id integer NOT NULL,
    tipo_ticket text NOT NULL,
    cantidad integer NOT NULL,
    bib_number text,
    nombre_inscripto text,
    apellido_inscripto text,
    dni text,
    email text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."CortesiaItem" OWNER TO admin_portal;

--
-- Name: CortesiaItem_id_seq; Type: SEQUENCE; Schema: public; Owner: admin_portal
--

CREATE SEQUENCE public."CortesiaItem_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."CortesiaItem_id_seq" OWNER TO admin_portal;

--
-- Name: CortesiaItem_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin_portal
--

ALTER SEQUENCE public."CortesiaItem_id_seq" OWNED BY public."CortesiaItem".id;


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
-- Name: CuotaPlanAFIP; Type: TABLE; Schema: public; Owner: admin_portal
--

CREATE TABLE public."CuotaPlanAFIP" (
    id integer NOT NULL,
    plan_id integer NOT NULL,
    numero_cuota integer NOT NULL,
    fecha_debito timestamp(3) without time zone NOT NULL,
    capital numeric(12,2),
    interes numeric(12,2),
    total_cuota numeric(12,2) NOT NULL,
    fecha_pago_real timestamp(3) without time zone,
    pagada boolean DEFAULT false NOT NULL,
    notas text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."CuotaPlanAFIP" OWNER TO admin_portal;

--
-- Name: CuotaPlanAFIP_id_seq; Type: SEQUENCE; Schema: public; Owner: admin_portal
--

CREATE SEQUENCE public."CuotaPlanAFIP_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."CuotaPlanAFIP_id_seq" OWNER TO admin_portal;

--
-- Name: CuotaPlanAFIP_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin_portal
--

ALTER SEQUENCE public."CuotaPlanAFIP_id_seq" OWNED BY public."CuotaPlanAFIP".id;


--
-- Name: CuotaPrestamo; Type: TABLE; Schema: public; Owner: admin_portal
--

CREATE TABLE public."CuotaPrestamo" (
    id integer NOT NULL,
    prestamo_id integer NOT NULL,
    numero_cuota integer NOT NULL,
    fecha_vencimiento timestamp(3) without time zone NOT NULL,
    capital numeric(12,2),
    interes numeric(12,2),
    iva_interes numeric(12,2),
    seguro numeric(12,2),
    otros_impuestos numeric(12,2),
    total_cuota numeric(12,2) NOT NULL,
    fecha_pago_real timestamp(3) without time zone,
    pagada boolean DEFAULT false NOT NULL,
    notas text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."CuotaPrestamo" OWNER TO admin_portal;

--
-- Name: CuotaPrestamo_id_seq; Type: SEQUENCE; Schema: public; Owner: admin_portal
--

CREATE SEQUENCE public."CuotaPrestamo_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."CuotaPrestamo_id_seq" OWNER TO admin_portal;

--
-- Name: CuotaPrestamo_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin_portal
--

ALTER SEQUENCE public."CuotaPrestamo_id_seq" OWNED BY public."CuotaPrestamo".id;


--
-- Name: DocumentoPlanAFIP; Type: TABLE; Schema: public; Owner: admin_portal
--

CREATE TABLE public."DocumentoPlanAFIP" (
    id integer NOT NULL,
    plan_id integer NOT NULL,
    nombre text NOT NULL,
    descripcion text,
    archivo_data bytea NOT NULL,
    archivo_mime text NOT NULL,
    archivo_size integer NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by integer
);


ALTER TABLE public."DocumentoPlanAFIP" OWNER TO admin_portal;

--
-- Name: DocumentoPlanAFIP_id_seq; Type: SEQUENCE; Schema: public; Owner: admin_portal
--

CREATE SEQUENCE public."DocumentoPlanAFIP_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."DocumentoPlanAFIP_id_seq" OWNER TO admin_portal;

--
-- Name: DocumentoPlanAFIP_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin_portal
--

ALTER SEQUENCE public."DocumentoPlanAFIP_id_seq" OWNED BY public."DocumentoPlanAFIP".id;


--
-- Name: DocumentoPrestamo; Type: TABLE; Schema: public; Owner: admin_portal
--

CREATE TABLE public."DocumentoPrestamo" (
    id integer NOT NULL,
    prestamo_id integer NOT NULL,
    nombre text NOT NULL,
    descripcion text,
    archivo_data bytea NOT NULL,
    archivo_mime text NOT NULL,
    archivo_size integer NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by integer
);


ALTER TABLE public."DocumentoPrestamo" OWNER TO admin_portal;

--
-- Name: DocumentoPrestamo_id_seq; Type: SEQUENCE; Schema: public; Owner: admin_portal
--

CREATE SEQUENCE public."DocumentoPrestamo_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."DocumentoPrestamo_id_seq" OWNER TO admin_portal;

--
-- Name: DocumentoPrestamo_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin_portal
--

ALTER SEQUENCE public."DocumentoPrestamo_id_seq" OWNED BY public."DocumentoPrestamo".id;


--
-- Name: DocumentoSiniestro; Type: TABLE; Schema: public; Owner: admin_portal
--

CREATE TABLE public."DocumentoSiniestro" (
    id integer NOT NULL,
    siniestro_id integer NOT NULL,
    nombre text NOT NULL,
    descripcion text,
    archivo_data bytea NOT NULL,
    archivo_mime text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by integer
);


ALTER TABLE public."DocumentoSiniestro" OWNER TO admin_portal;

--
-- Name: DocumentoSiniestro_id_seq; Type: SEQUENCE; Schema: public; Owner: admin_portal
--

CREATE SEQUENCE public."DocumentoSiniestro_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."DocumentoSiniestro_id_seq" OWNER TO admin_portal;

--
-- Name: DocumentoSiniestro_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin_portal
--

ALTER SEQUENCE public."DocumentoSiniestro_id_seq" OWNED BY public."DocumentoSiniestro".id;


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
    tasa_cambio numeric(10,4),
    banco_descuento text,
    fecha_venta timestamp(3) without time zone,
    monto_neto_recibido numeric(15,2),
    tasa_descuento numeric(5,2)
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
    tipo_contratacion text,
    hora_convocatoria_default text
);


ALTER TABLE public."Empleado" OWNER TO admin_portal;

--
-- Name: EmpleadoEmpresaSplit; Type: TABLE; Schema: public; Owner: admin_portal
--

CREATE TABLE public."EmpleadoEmpresaSplit" (
    id integer NOT NULL,
    empleado_id integer NOT NULL,
    empresa_id integer NOT NULL,
    porcentaje numeric(5,2) NOT NULL
);


ALTER TABLE public."EmpleadoEmpresaSplit" OWNER TO admin_portal;

--
-- Name: EmpleadoEmpresaSplit_id_seq; Type: SEQUENCE; Schema: public; Owner: admin_portal
--

CREATE SEQUENCE public."EmpleadoEmpresaSplit_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."EmpleadoEmpresaSplit_id_seq" OWNER TO admin_portal;

--
-- Name: EmpleadoEmpresaSplit_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin_portal
--

ALTER SEQUENCE public."EmpleadoEmpresaSplit_id_seq" OWNED BY public."EmpleadoEmpresaSplit".id;


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
-- Name: EntregaUniforme; Type: TABLE; Schema: public; Owner: admin_portal
--

CREATE TABLE public."EntregaUniforme" (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    empleado_id integer,
    empleado_nombre text NOT NULL,
    fecha_entrega timestamp(3) without time zone NOT NULL,
    borcegos integer DEFAULT 0 NOT NULL,
    remeras integer DEFAULT 0 NOT NULL,
    camperon integer DEFAULT 0 NOT NULL,
    chombas integer DEFAULT 0 NOT NULL,
    campera integer DEFAULT 0 NOT NULL,
    mochila integer DEFAULT 0 NOT NULL,
    buzo integer DEFAULT 0 NOT NULL,
    pantalon integer DEFAULT 0 NOT NULL,
    bermuda integer DEFAULT 0 NOT NULL,
    gorra integer DEFAULT 0 NOT NULL,
    prot_lumbar integer DEFAULT 0 NOT NULL,
    guantes integer DEFAULT 0 NOT NULL,
    otros text,
    origen_hoja text DEFAULT 'MANUAL'::text NOT NULL,
    anio_resumen integer,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by integer
);


ALTER TABLE public."EntregaUniforme" OWNER TO admin_portal;

--
-- Name: EntregaUniforme_id_seq; Type: SEQUENCE; Schema: public; Owner: admin_portal
--

CREATE SEQUENCE public."EntregaUniforme_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."EntregaUniforme_id_seq" OWNER TO admin_portal;

--
-- Name: EntregaUniforme_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin_portal
--

ALTER SEQUENCE public."EntregaUniforme_id_seq" OWNED BY public."EntregaUniforme".id;


--
-- Name: EscalafonAdmin; Type: TABLE; Schema: public; Owner: admin_portal
--

CREATE TABLE public."EscalafonAdmin" (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    nombre text NOT NULL,
    orden integer NOT NULL,
    viatico numeric(12,2),
    premio_presentismo numeric(12,2),
    telefono numeric(12,2),
    premio_incentivo numeric(12,2),
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    deleted_at timestamp(3) without time zone,
    created_by integer,
    premio_viaje_nacional numeric(10,2),
    premio_viaje_nacional_1000 numeric(10,2),
    premio_viaje_provincial numeric(10,2)
);


ALTER TABLE public."EscalafonAdmin" OWNER TO admin_portal;

--
-- Name: EscalafonAdmin_id_seq; Type: SEQUENCE; Schema: public; Owner: admin_portal
--

CREATE SEQUENCE public."EscalafonAdmin_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."EscalafonAdmin_id_seq" OWNER TO admin_portal;

--
-- Name: EscalafonAdmin_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin_portal
--

ALTER SEQUENCE public."EscalafonAdmin_id_seq" OWNED BY public."EscalafonAdmin".id;


--
-- Name: EspacioCompartido; Type: TABLE; Schema: public; Owner: admin_portal
--

CREATE TABLE public."EspacioCompartido" (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    nombre text NOT NULL,
    descripcion text,
    direccion text,
    activo boolean DEFAULT true NOT NULL,
    dia_generacion integer DEFAULT 1 NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    deleted_at timestamp(3) without time zone
);


ALTER TABLE public."EspacioCompartido" OWNER TO admin_portal;

--
-- Name: EspacioCompartido_id_seq; Type: SEQUENCE; Schema: public; Owner: admin_portal
--

CREATE SEQUENCE public."EspacioCompartido_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."EspacioCompartido_id_seq" OWNER TO admin_portal;

--
-- Name: EspacioCompartido_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin_portal
--

ALTER SEQUENCE public."EspacioCompartido_id_seq" OWNED BY public."EspacioCompartido".id;


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
    dias_montaje integer DEFAULT 0 NOT NULL,
    es_informal boolean DEFAULT false NOT NULL,
    facturar boolean,
    facturar_notas text,
    lugar text
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
-- Name: EventoEmpleadoMes; Type: TABLE; Schema: public; Owner: admin_portal
--

CREATE TABLE public."EventoEmpleadoMes" (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    empleado_id integer NOT NULL,
    evento_id integer,
    evento_nombre text,
    periodo_mes integer NOT NULL,
    periodo_anio integer NOT NULL,
    cobra_premio boolean DEFAULT true NOT NULL,
    monto_premio numeric(10,2),
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by integer,
    cantidad_pax integer,
    dias_trabajados integer DEFAULT 1,
    premio_pax_total numeric(12,2),
    valor_por_pax numeric(10,2)
);


ALTER TABLE public."EventoEmpleadoMes" OWNER TO admin_portal;

--
-- Name: EventoEmpleadoMes_id_seq; Type: SEQUENCE; Schema: public; Owner: admin_portal
--

CREATE SEQUENCE public."EventoEmpleadoMes_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."EventoEmpleadoMes_id_seq" OWNER TO admin_portal;

--
-- Name: EventoEmpleadoMes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin_portal
--

ALTER SEQUENCE public."EventoEmpleadoMes_id_seq" OWNED BY public."EventoEmpleadoMes".id;


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
-- Name: ExcedenteHoras; Type: TABLE; Schema: public; Owner: admin_portal
--

CREATE TABLE public."ExcedenteHoras" (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    empleado_id integer NOT NULL,
    periodo_mes integer NOT NULL,
    periodo_anio integer NOT NULL,
    horas_excedente numeric(8,2) NOT NULL,
    valor_hora numeric(10,2) NOT NULL,
    monto_total numeric(12,2) NOT NULL,
    pagado boolean DEFAULT false NOT NULL,
    fecha_pago timestamp(3) without time zone,
    liquidacion_admin_id integer,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    created_by integer
);


ALTER TABLE public."ExcedenteHoras" OWNER TO admin_portal;

--
-- Name: ExcedenteHoras_id_seq; Type: SEQUENCE; Schema: public; Owner: admin_portal
--

CREATE SEQUENCE public."ExcedenteHoras_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."ExcedenteHoras_id_seq" OWNER TO admin_portal;

--
-- Name: ExcedenteHoras_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin_portal
--

ALTER SEQUENCE public."ExcedenteHoras_id_seq" OWNED BY public."ExcedenteHoras".id;


--
-- Name: Factura; Type: TABLE; Schema: public; Owner: admin_portal
--

CREATE TABLE public."Factura" (
    id integer NOT NULL,
    numero_factura text NOT NULL,
    tipo_factura text NOT NULL,
    fecha_emision timestamp(3) without time zone NOT NULL,
    fecha_vencimiento timestamp(3) without time zone,
    proveedor_id integer,
    evento_id integer,
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
    tasa_cambio numeric(10,4),
    exento numeric(15,2),
    iva_importe numeric(15,2),
    neto_gravado numeric(15,2),
    no_gravado numeric(15,2),
    origen_import text,
    pdf_nombre_afip text,
    tiene_comprobante_fisico boolean DEFAULT false NOT NULL,
    tiene_pdf boolean DEFAULT false NOT NULL,
    tipo_comprobante public."TipoComprobanteEmitido"
);


ALTER TABLE public."Factura" OWNER TO admin_portal;

--
-- Name: FacturaEmitida; Type: TABLE; Schema: public; Owner: admin_portal
--

CREATE TABLE public."FacturaEmitida" (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    tipo_comprobante public."TipoComprobanteEmitido" NOT NULL,
    punto_venta integer DEFAULT 1 NOT NULL,
    numero text,
    fecha_emision timestamp(3) without time zone NOT NULL,
    cliente_nombre text NOT NULL,
    cliente_cuit text,
    condicion_cliente public."CondicionCliente",
    neto_gravado numeric(15,2),
    iva numeric(15,2),
    otros_impuestos numeric(15,2),
    total numeric(15,2) NOT NULL,
    moneda public."Moneda" DEFAULT 'ARS'::public."Moneda" NOT NULL,
    tasa_cambio numeric(10,4),
    total_ars numeric(15,2),
    forma_pago text,
    fecha_vencimiento timestamp(3) without time zone,
    estado public."EstadoFacturaEmitida" DEFAULT 'EMITIDA'::public."EstadoFacturaEmitida" NOT NULL,
    evento_id integer,
    concepto text,
    observaciones text,
    pdf_data bytea,
    pdf_nombre text,
    pdf_mime_type text,
    pdf_tamanio integer,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    deleted_at timestamp(3) without time zone,
    created_by integer,
    updated_by integer
);


ALTER TABLE public."FacturaEmitida" OWNER TO admin_portal;

--
-- Name: FacturaEmitida_id_seq; Type: SEQUENCE; Schema: public; Owner: admin_portal
--

CREATE SEQUENCE public."FacturaEmitida_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."FacturaEmitida_id_seq" OWNER TO admin_portal;

--
-- Name: FacturaEmitida_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin_portal
--

ALTER SEQUENCE public."FacturaEmitida_id_seq" OWNED BY public."FacturaEmitida".id;


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
-- Name: GastoMesEspacio; Type: TABLE; Schema: public; Owner: admin_portal
--

CREATE TABLE public."GastoMesEspacio" (
    id integer NOT NULL,
    espacio_id integer NOT NULL,
    periodo_mes integer NOT NULL,
    periodo_anio integer NOT NULL,
    generado_auto boolean DEFAULT false NOT NULL,
    cerrado boolean DEFAULT false NOT NULL,
    total_gastos numeric(15,2) DEFAULT 0 NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."GastoMesEspacio" OWNER TO admin_portal;

--
-- Name: GastoMesEspacio_id_seq; Type: SEQUENCE; Schema: public; Owner: admin_portal
--

CREATE SEQUENCE public."GastoMesEspacio_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."GastoMesEspacio_id_seq" OWNER TO admin_portal;

--
-- Name: GastoMesEspacio_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin_portal
--

ALTER SEQUENCE public."GastoMesEspacio_id_seq" OWNED BY public."GastoMesEspacio".id;


--
-- Name: GastoPeaje; Type: TABLE; Schema: public; Owner: admin_portal
--

CREATE TABLE public."GastoPeaje" (
    id integer NOT NULL,
    camion_id integer NOT NULL,
    empresa_id integer NOT NULL,
    fecha timestamp(3) without time zone NOT NULL,
    ruta text,
    importe numeric(10,2) NOT NULL,
    evento_id integer,
    es_carga_telepase boolean DEFAULT false NOT NULL,
    saldo_telepase_post numeric(10,2),
    notas text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    deleted_at timestamp(3) without time zone,
    created_by integer
);


ALTER TABLE public."GastoPeaje" OWNER TO admin_portal;

--
-- Name: GastoPeaje_id_seq; Type: SEQUENCE; Schema: public; Owner: admin_portal
--

CREATE SEQUENCE public."GastoPeaje_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."GastoPeaje_id_seq" OWNER TO admin_portal;

--
-- Name: GastoPeaje_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin_portal
--

ALTER SEQUENCE public."GastoPeaje_id_seq" OWNED BY public."GastoPeaje".id;


--
-- Name: GastoSiniestro; Type: TABLE; Schema: public; Owner: admin_portal
--

CREATE TABLE public."GastoSiniestro" (
    id integer NOT NULL,
    siniestro_id integer NOT NULL,
    fecha timestamp(3) without time zone NOT NULL,
    descripcion text NOT NULL,
    monto numeric(12,2) NOT NULL,
    cubierto_art boolean DEFAULT false NOT NULL,
    monto_cubierto numeric(12,2),
    monto_empresa numeric(12,2),
    comprobante_data bytea,
    comprobante_nombre text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by integer
);


ALTER TABLE public."GastoSiniestro" OWNER TO admin_portal;

--
-- Name: GastoSiniestro_id_seq; Type: SEQUENCE; Schema: public; Owner: admin_portal
--

CREATE SEQUENCE public."GastoSiniestro_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."GastoSiniestro_id_seq" OWNER TO admin_portal;

--
-- Name: GastoSiniestro_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin_portal
--

ALTER SEQUENCE public."GastoSiniestro_id_seq" OWNED BY public."GastoSiniestro".id;


--
-- Name: GastoTipoEspacio; Type: TABLE; Schema: public; Owner: admin_portal
--

CREATE TABLE public."GastoTipoEspacio" (
    id integer NOT NULL,
    espacio_id integer NOT NULL,
    nombre text NOT NULL,
    monto_estimado numeric(12,2) NOT NULL,
    dia_vencimiento integer,
    activo boolean DEFAULT true NOT NULL,
    es_fijo boolean DEFAULT true NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."GastoTipoEspacio" OWNER TO admin_portal;

--
-- Name: GastoTipoEspacio_id_seq; Type: SEQUENCE; Schema: public; Owner: admin_portal
--

CREATE SEQUENCE public."GastoTipoEspacio_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."GastoTipoEspacio_id_seq" OWNER TO admin_portal;

--
-- Name: GastoTipoEspacio_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin_portal
--

ALTER SEQUENCE public."GastoTipoEspacio_id_seq" OWNED BY public."GastoTipoEspacio".id;


--
-- Name: IndicadorEconomico; Type: TABLE; Schema: public; Owner: admin_portal
--

CREATE TABLE public."IndicadorEconomico" (
    id integer NOT NULL,
    tipo public."TipoIndicador" NOT NULL,
    valor numeric(12,4) NOT NULL,
    compra numeric(12,2),
    venta numeric(12,2),
    periodo text,
    fuente_fecha timestamp(3) without time zone,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."IndicadorEconomico" OWNER TO admin_portal;

--
-- Name: IndicadorEconomico_id_seq; Type: SEQUENCE; Schema: public; Owner: admin_portal
--

CREATE SEQUENCE public."IndicadorEconomico_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."IndicadorEconomico_id_seq" OWNER TO admin_portal;

--
-- Name: IndicadorEconomico_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin_portal
--

ALTER SEQUENCE public."IndicadorEconomico_id_seq" OWNED BY public."IndicadorEconomico".id;


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
-- Name: LineaGastoEspacio; Type: TABLE; Schema: public; Owner: admin_portal
--

CREATE TABLE public."LineaGastoEspacio" (
    id integer NOT NULL,
    gasto_mes_id integer NOT NULL,
    gasto_tipo_id integer,
    nombre text NOT NULL,
    monto_real numeric(12,2) NOT NULL,
    fecha_vencimiento timestamp(3) without time zone,
    estado public."EstadoLineaGasto" DEFAULT 'PENDIENTE'::public."EstadoLineaGasto" NOT NULL,
    fecha_pago timestamp(3) without time zone,
    comprobante_data bytea,
    comprobante_nombre text,
    comprobante_mime text,
    notas text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    deleted_at timestamp(3) without time zone,
    created_by integer
);


ALTER TABLE public."LineaGastoEspacio" OWNER TO admin_portal;

--
-- Name: LineaGastoEspacio_id_seq; Type: SEQUENCE; Schema: public; Owner: admin_portal
--

CREATE SEQUENCE public."LineaGastoEspacio_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."LineaGastoEspacio_id_seq" OWNER TO admin_portal;

--
-- Name: LineaGastoEspacio_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin_portal
--

ALTER SEQUENCE public."LineaGastoEspacio_id_seq" OWNED BY public."LineaGastoEspacio".id;


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
-- Name: LiquidacionAdmin; Type: TABLE; Schema: public; Owner: admin_portal
--

CREATE TABLE public."LiquidacionAdmin" (
    id integer NOT NULL,
    empleado_id integer NOT NULL,
    empresa_id integer NOT NULL,
    acuerdo_id integer NOT NULL,
    periodo_mes integer NOT NULL,
    periodo_anio integer NOT NULL,
    sueldo_basico numeric(12,2) NOT NULL,
    horas_acordadas integer NOT NULL,
    escalafon text,
    horas_trabajadas numeric(8,2) NOT NULL,
    horas_extras numeric(8,2) NOT NULL,
    valor_hora_extra numeric(10,2),
    importe_horas_extras numeric(12,2) DEFAULT 0 NOT NULL,
    premio_incentivo numeric(12,2) DEFAULT 0 NOT NULL,
    viatico numeric(12,2) DEFAULT 0 NOT NULL,
    premio_presentismo numeric(12,2) DEFAULT 0 NOT NULL,
    antiguedad_anios integer DEFAULT 0 NOT NULL,
    importe_antiguedad numeric(12,2) DEFAULT 0 NOT NULL,
    telefono numeric(12,2) DEFAULT 0 NOT NULL,
    vacaciones_aguinaldo numeric(12,2) DEFAULT 0 NOT NULL,
    vales_descuentos numeric(12,2) DEFAULT 0 NOT NULL,
    subtotal_bruto numeric(12,2) NOT NULL,
    total_a_cobrar numeric(12,2) NOT NULL,
    splits jsonb,
    estado public."EstadoLiquidacionAdmin" DEFAULT 'BORRADOR'::public."EstadoLiquidacionAdmin" NOT NULL,
    observaciones text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    aprobado_por integer,
    aprobado_at timestamp(3) without time zone,
    prestamos_descontados numeric(12,2) DEFAULT 0 NOT NULL,
    horas_pendientes_anterior numeric(8,2),
    horas_pendientes_nuevo numeric(8,2),
    ipc_mes_referencia text,
    ipc_valor_aplicado numeric(5,2),
    porcentaje_aumento_aplicado numeric(5,2),
    tipo_aumento public."TipoAumento",
    eventos_mes jsonb,
    premio_produccion_total numeric(12,2) DEFAULT 0 NOT NULL,
    premio_viaje numeric(12,2) DEFAULT 0 NOT NULL
);


ALTER TABLE public."LiquidacionAdmin" OWNER TO admin_portal;

--
-- Name: LiquidacionAdmin_id_seq; Type: SEQUENCE; Schema: public; Owner: admin_portal
--

CREATE SEQUENCE public."LiquidacionAdmin_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."LiquidacionAdmin_id_seq" OWNER TO admin_portal;

--
-- Name: LiquidacionAdmin_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin_portal
--

ALTER SEQUENCE public."LiquidacionAdmin_id_seq" OWNED BY public."LiquidacionAdmin".id;


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
-- Name: MaterialRental; Type: TABLE; Schema: public; Owner: admin_portal
--

CREATE TABLE public."MaterialRental" (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    origen public."OrigenMaterialRental" NOT NULL,
    nro_item integer,
    codigo_oficial text,
    detalle text NOT NULL,
    medida text,
    peso_por_unidad numeric(10,3),
    costo_unitario_ars numeric(14,2),
    costo_unitario_usd numeric(12,2),
    tipo_cambio numeric(10,2),
    porc_2 boolean DEFAULT false NOT NULL,
    porc_4 boolean DEFAULT false NOT NULL,
    porc_6 boolean DEFAULT false NOT NULL,
    porc_8 boolean DEFAULT false NOT NULL,
    porc_10 boolean DEFAULT false NOT NULL,
    porc_full boolean DEFAULT false NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    created_by integer
);


ALTER TABLE public."MaterialRental" OWNER TO admin_portal;

--
-- Name: MaterialRental_id_seq; Type: SEQUENCE; Schema: public; Owner: admin_portal
--

CREATE SEQUENCE public."MaterialRental_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."MaterialRental_id_seq" OWNER TO admin_portal;

--
-- Name: MaterialRental_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin_portal
--

ALTER SEQUENCE public."MaterialRental_id_seq" OWNED BY public."MaterialRental".id;


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
    tasa_cambio numeric(10,4),
    liquidacion_admin_id integer,
    categoria_andrea text,
    comprobante_data bytea,
    comprobante_mime text,
    comprobante_nombre text,
    responsable_nombre text,
    referencia text
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
-- Name: PagoPrestamoEmpleado; Type: TABLE; Schema: public; Owner: admin_portal
--

CREATE TABLE public."PagoPrestamoEmpleado" (
    id integer NOT NULL,
    prestamo_id integer NOT NULL,
    liquidacion_admin_id integer,
    monto numeric(12,2) NOT NULL,
    fecha timestamp(3) without time zone NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."PagoPrestamoEmpleado" OWNER TO admin_portal;

--
-- Name: PagoPrestamoEmpleado_id_seq; Type: SEQUENCE; Schema: public; Owner: admin_portal
--

CREATE SEQUENCE public."PagoPrestamoEmpleado_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."PagoPrestamoEmpleado_id_seq" OWNER TO admin_portal;

--
-- Name: PagoPrestamoEmpleado_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin_portal
--

ALTER SEQUENCE public."PagoPrestamoEmpleado_id_seq" OWNED BY public."PagoPrestamoEmpleado".id;


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
-- Name: ParteEspacio; Type: TABLE; Schema: public; Owner: admin_portal
--

CREATE TABLE public."ParteEspacio" (
    id integer NOT NULL,
    espacio_id integer NOT NULL,
    nombre text NOT NULL,
    porcentaje numeric(5,2) NOT NULL,
    empresa_id integer,
    cuenta_corriente_id integer
);


ALTER TABLE public."ParteEspacio" OWNER TO admin_portal;

--
-- Name: ParteEspacio_id_seq; Type: SEQUENCE; Schema: public; Owner: admin_portal
--

CREATE SEQUENCE public."ParteEspacio_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."ParteEspacio_id_seq" OWNER TO admin_portal;

--
-- Name: ParteEspacio_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin_portal
--

ALTER SEQUENCE public."ParteEspacio_id_seq" OWNED BY public."ParteEspacio".id;


--
-- Name: PatenteVehiculo; Type: TABLE; Schema: public; Owner: admin_portal
--

CREATE TABLE public."PatenteVehiculo" (
    id integer NOT NULL,
    camion_id integer NOT NULL,
    empresa_id integer NOT NULL,
    tipo public."TipoPatente" NOT NULL,
    anio integer NOT NULL,
    cuota integer,
    importe numeric(12,2) NOT NULL,
    fecha_vencimiento timestamp(3) without time zone NOT NULL,
    fecha_pago timestamp(3) without time zone,
    estado public."EstadoPatente" DEFAULT 'PENDIENTE'::public."EstadoPatente" NOT NULL,
    comprobante_data bytea,
    comprobante_nombre text,
    comprobante_mime text,
    notas text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    deleted_at timestamp(3) without time zone,
    created_by integer
);


ALTER TABLE public."PatenteVehiculo" OWNER TO admin_portal;

--
-- Name: PatenteVehiculo_id_seq; Type: SEQUENCE; Schema: public; Owner: admin_portal
--

CREATE SEQUENCE public."PatenteVehiculo_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."PatenteVehiculo_id_seq" OWNER TO admin_portal;

--
-- Name: PatenteVehiculo_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin_portal
--

ALTER SEQUENCE public."PatenteVehiculo_id_seq" OWNED BY public."PatenteVehiculo".id;


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
    deleted_at timestamp(3) without time zone,
    fecha_turno timestamp(3) without time zone,
    hora_fin_turno text,
    hora_inicio_turno text,
    horas_por_agente numeric(5,2),
    tipo_turno text,
    total_horas_turno numeric(8,2),
    ubicacion_turno text
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
-- Name: PlanAFIP; Type: TABLE; Schema: public; Owner: admin_portal
--

CREATE TABLE public."PlanAFIP" (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    numero_plan text,
    descripcion text NOT NULL,
    fecha_inicio timestamp(3) without time zone NOT NULL,
    capital_original numeric(15,2) NOT NULL,
    cantidad_cuotas integer NOT NULL,
    valor_cuota_aprox numeric(12,2),
    interes_financiero numeric(5,2),
    interes_resarcitorio numeric(5,2),
    estado public."EstadoPlanAFIP" DEFAULT 'ACTIVO'::public."EstadoPlanAFIP" NOT NULL,
    notas text,
    titular_nombre text,
    titular_cuit text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    deleted_at timestamp(3) without time zone,
    created_by integer
);


ALTER TABLE public."PlanAFIP" OWNER TO admin_portal;

--
-- Name: PlanAFIP_id_seq; Type: SEQUENCE; Schema: public; Owner: admin_portal
--

CREATE SEQUENCE public."PlanAFIP_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."PlanAFIP_id_seq" OWNER TO admin_portal;

--
-- Name: PlanAFIP_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin_portal
--

ALTER SEQUENCE public."PlanAFIP_id_seq" OWNED BY public."PlanAFIP".id;


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
-- Name: PrestamoBancario; Type: TABLE; Schema: public; Owner: admin_portal
--

CREATE TABLE public."PrestamoBancario" (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    entidad text NOT NULL,
    numero_operacion text,
    tipo text,
    fecha_otorgamiento timestamp(3) without time zone NOT NULL,
    capital_original numeric(15,2) NOT NULL,
    moneda public."Moneda" DEFAULT 'ARS'::public."Moneda" NOT NULL,
    tasa_nominal_anual numeric(5,2),
    tasa_efectiva_anual numeric(5,2),
    cantidad_cuotas integer NOT NULL,
    dia_debito integer,
    estado public."EstadoPrestamo" DEFAULT 'ACTIVO'::public."EstadoPrestamo" NOT NULL,
    notas text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    deleted_at timestamp(3) without time zone,
    created_by integer
);


ALTER TABLE public."PrestamoBancario" OWNER TO admin_portal;

--
-- Name: PrestamoBancario_id_seq; Type: SEQUENCE; Schema: public; Owner: admin_portal
--

CREATE SEQUENCE public."PrestamoBancario_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."PrestamoBancario_id_seq" OWNER TO admin_portal;

--
-- Name: PrestamoBancario_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin_portal
--

ALTER SEQUENCE public."PrestamoBancario_id_seq" OWNED BY public."PrestamoBancario".id;


--
-- Name: PrestamoEmpleado; Type: TABLE; Schema: public; Owner: admin_portal
--

CREATE TABLE public."PrestamoEmpleado" (
    id integer NOT NULL,
    empleado_id integer NOT NULL,
    empresa_id integer NOT NULL,
    fecha timestamp(3) without time zone NOT NULL,
    detalle text NOT NULL,
    monto_total numeric(12,2) NOT NULL,
    cantidad_cuotas integer DEFAULT 1 NOT NULL,
    cuotas_pagadas integer DEFAULT 0 NOT NULL,
    monto_cuota numeric(12,2) NOT NULL,
    saldado boolean DEFAULT false NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    deleted_at timestamp(3) without time zone,
    created_by integer
);


ALTER TABLE public."PrestamoEmpleado" OWNER TO admin_portal;

--
-- Name: PrestamoEmpleado_id_seq; Type: SEQUENCE; Schema: public; Owner: admin_portal
--

CREATE SEQUENCE public."PrestamoEmpleado_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."PrestamoEmpleado_id_seq" OWNER TO admin_portal;

--
-- Name: PrestamoEmpleado_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin_portal
--

ALTER SEQUENCE public."PrestamoEmpleado_id_seq" OWNED BY public."PrestamoEmpleado".id;


--
-- Name: PresupuestoEvento; Type: TABLE; Schema: public; Owner: admin_portal
--

CREATE TABLE public."PresupuestoEvento" (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    evento_id integer,
    nombre text NOT NULL,
    estado public."EstadoPresupuesto" DEFAULT 'BORRADOR'::public."EstadoPresupuesto" NOT NULL,
    porcentaje_alquiler text NOT NULL,
    tipo_cambio_usd numeric(10,2) DEFAULT 1700 NOT NULL,
    notas text,
    version integer DEFAULT 1 NOT NULL,
    version_de_id integer,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    deleted_at timestamp(3) without time zone,
    created_by integer
);


ALTER TABLE public."PresupuestoEvento" OWNER TO admin_portal;

--
-- Name: PresupuestoEvento_id_seq; Type: SEQUENCE; Schema: public; Owner: admin_portal
--

CREATE SEQUENCE public."PresupuestoEvento_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."PresupuestoEvento_id_seq" OWNER TO admin_portal;

--
-- Name: PresupuestoEvento_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin_portal
--

ALTER SEQUENCE public."PresupuestoEvento_id_seq" OWNED BY public."PresupuestoEvento".id;


--
-- Name: PresupuestoLinea; Type: TABLE; Schema: public; Owner: admin_portal
--

CREATE TABLE public."PresupuestoLinea" (
    id integer NOT NULL,
    presupuesto_id integer NOT NULL,
    material_id integer NOT NULL,
    cantidad numeric(12,2) NOT NULL,
    costo_unitario_snap numeric(14,2) NOT NULL,
    tipo_cambio_snap numeric(10,2),
    porcentaje_snap numeric(5,2) NOT NULL,
    costo_total_material numeric(16,2) NOT NULL,
    valor_rental numeric(16,2) NOT NULL,
    orden integer DEFAULT 0 NOT NULL,
    valor_rental_full numeric(16,2)
);


ALTER TABLE public."PresupuestoLinea" OWNER TO admin_portal;

--
-- Name: PresupuestoLinea_id_seq; Type: SEQUENCE; Schema: public; Owner: admin_portal
--

CREATE SEQUENCE public."PresupuestoLinea_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."PresupuestoLinea_id_seq" OWNER TO admin_portal;

--
-- Name: PresupuestoLinea_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin_portal
--

ALTER SEQUENCE public."PresupuestoLinea_id_seq" OWNED BY public."PresupuestoLinea".id;


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
    telefono text,
    es_comisionista boolean DEFAULT false NOT NULL,
    porcentaje_comision numeric(5,2),
    alias_bancario text,
    banco text,
    cbu text,
    dni text,
    email text,
    numero_cuenta text,
    puede_facturar boolean,
    servicio text,
    tipo_factura text,
    titular_cuenta text
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
-- Name: RegistroAsistencia; Type: TABLE; Schema: public; Owner: admin_portal
--

CREATE TABLE public."RegistroAsistencia" (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    empleado_id integer NOT NULL,
    fecha timestamp(3) without time zone NOT NULL,
    estado public."EstadoAsistencia" DEFAULT 'PRESENTE'::public."EstadoAsistencia" NOT NULL,
    hora_ingreso text,
    hora_egreso text,
    horas_trabajadas numeric(5,2),
    minutos_tardanza integer,
    motivo text,
    descuenta_presentismo boolean DEFAULT false NOT NULL,
    jornada_id integer,
    origen text,
    tardanza_requiere_aprobacion boolean DEFAULT false NOT NULL,
    tardanza_aprobada boolean,
    tardanza_aprobada_por integer,
    tardanza_aprobada_at timestamp(3) without time zone,
    tardanza_nota text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    deleted_at timestamp(3) without time zone,
    created_by integer
);


ALTER TABLE public."RegistroAsistencia" OWNER TO admin_portal;

--
-- Name: RegistroAsistencia_id_seq; Type: SEQUENCE; Schema: public; Owner: admin_portal
--

CREATE SEQUENCE public."RegistroAsistencia_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."RegistroAsistencia_id_seq" OWNER TO admin_portal;

--
-- Name: RegistroAsistencia_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin_portal
--

ALTER SEQUENCE public."RegistroAsistencia_id_seq" OWNED BY public."RegistroAsistencia".id;


--
-- Name: RemitoEvento; Type: TABLE; Schema: public; Owner: admin_portal
--

CREATE TABLE public."RemitoEvento" (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    evento_id integer NOT NULL,
    tipo public."TipoRemito" NOT NULL,
    numero integer NOT NULL,
    fecha timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    cliente text,
    domicilio text,
    localidad text,
    telefono text,
    chofer text,
    chasis_acoplado text,
    responsable_carga text,
    items jsonb DEFAULT '[]'::jsonb NOT NULL,
    estado public."EstadoRemito" DEFAULT 'BORRADOR'::public."EstadoRemito" NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    created_by integer
);


ALTER TABLE public."RemitoEvento" OWNER TO admin_portal;

--
-- Name: RemitoEvento_id_seq; Type: SEQUENCE; Schema: public; Owner: admin_portal
--

CREATE SEQUENCE public."RemitoEvento_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."RemitoEvento_id_seq" OWNER TO admin_portal;

--
-- Name: RemitoEvento_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin_portal
--

ALTER SEQUENCE public."RemitoEvento_id_seq" OWNED BY public."RemitoEvento".id;


--
-- Name: RepartoFacturaEmitida; Type: TABLE; Schema: public; Owner: admin_portal
--

CREATE TABLE public."RepartoFacturaEmitida" (
    id integer NOT NULL,
    factura_emitida_id integer NOT NULL,
    razon_social text NOT NULL,
    cuit text,
    porcentaje numeric(5,2) NOT NULL,
    monto numeric(15,2) NOT NULL,
    empresa_id integer
);


ALTER TABLE public."RepartoFacturaEmitida" OWNER TO admin_portal;

--
-- Name: RepartoFacturaEmitida_id_seq; Type: SEQUENCE; Schema: public; Owner: admin_portal
--

CREATE SEQUENCE public."RepartoFacturaEmitida_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."RepartoFacturaEmitida_id_seq" OWNER TO admin_portal;

--
-- Name: RepartoFacturaEmitida_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin_portal
--

ALTER SEQUENCE public."RepartoFacturaEmitida_id_seq" OWNED BY public."RepartoFacturaEmitida".id;


--
-- Name: RepartoLineaGasto; Type: TABLE; Schema: public; Owner: admin_portal
--

CREATE TABLE public."RepartoLineaGasto" (
    id integer NOT NULL,
    linea_id integer NOT NULL,
    parte_id integer NOT NULL,
    porcentaje numeric(5,2) NOT NULL,
    monto numeric(12,2) NOT NULL,
    movimiento_ccc_id integer
);


ALTER TABLE public."RepartoLineaGasto" OWNER TO admin_portal;

--
-- Name: RepartoLineaGasto_id_seq; Type: SEQUENCE; Schema: public; Owner: admin_portal
--

CREATE SEQUENCE public."RepartoLineaGasto_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."RepartoLineaGasto_id_seq" OWNER TO admin_portal;

--
-- Name: RepartoLineaGasto_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin_portal
--

ALTER SEQUENCE public."RepartoLineaGasto_id_seq" OWNED BY public."RepartoLineaGasto".id;


--
-- Name: ResponsableTC; Type: TABLE; Schema: public; Owner: admin_portal
--

CREATE TABLE public."ResponsableTC" (
    id integer NOT NULL,
    tarjeta_id integer NOT NULL,
    nombre text NOT NULL,
    tipo text DEFAULT 'PERSONAL'::text NOT NULL,
    usuario_id integer,
    activo boolean DEFAULT true NOT NULL
);


ALTER TABLE public."ResponsableTC" OWNER TO admin_portal;

--
-- Name: ResponsableTC_id_seq; Type: SEQUENCE; Schema: public; Owner: admin_portal
--

CREATE SEQUENCE public."ResponsableTC_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."ResponsableTC_id_seq" OWNER TO admin_portal;

--
-- Name: ResponsableTC_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin_portal
--

ALTER SEQUENCE public."ResponsableTC_id_seq" OWNED BY public."ResponsableTC".id;


--
-- Name: ResumenPresentismo; Type: TABLE; Schema: public; Owner: admin_portal
--

CREATE TABLE public."ResumenPresentismo" (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    empleado_id integer NOT NULL,
    periodo_mes integer NOT NULL,
    periodo_anio integer NOT NULL,
    dias_habiles integer DEFAULT 0 NOT NULL,
    dias_presente integer DEFAULT 0 NOT NULL,
    dias_tarde integer DEFAULT 0 NOT NULL,
    dias_media_jornada integer DEFAULT 0 NOT NULL,
    dias_ausente integer DEFAULT 0 NOT NULL,
    dias_justificado integer DEFAULT 0 NOT NULL,
    dias_libre integer DEFAULT 0 NOT NULL,
    dias_vacaciones integer DEFAULT 0 NOT NULL,
    total_horas numeric(8,2) DEFAULT 0 NOT NULL,
    total_tardanzas_min integer DEFAULT 0 NOT NULL,
    cobra_presentismo boolean DEFAULT true NOT NULL,
    motivo_sin_presentismo text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."ResumenPresentismo" OWNER TO admin_portal;

--
-- Name: ResumenPresentismo_id_seq; Type: SEQUENCE; Schema: public; Owner: admin_portal
--

CREATE SEQUENCE public."ResumenPresentismo_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."ResumenPresentismo_id_seq" OWNER TO admin_portal;

--
-- Name: ResumenPresentismo_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin_portal
--

ALTER SEQUENCE public."ResumenPresentismo_id_seq" OWNED BY public."ResumenPresentismo".id;


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
    created_by integer,
    grupo text
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
-- Name: SGR; Type: TABLE; Schema: public; Owner: admin_portal
--

CREATE TABLE public."SGR" (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    nombre text NOT NULL,
    estado_vinculacion text DEFAULT 'ACTIVO'::text NOT NULL,
    fecha_vinculacion timestamp(3) without time zone,
    fecha_vencimiento timestamp(3) without time zone,
    cupo_total numeric(15,2),
    cupo_utilizado numeric(15,2),
    cupo_disponible numeric(15,2),
    moneda public."Moneda" DEFAULT 'ARS'::public."Moneda" NOT NULL,
    contacto_nombre text,
    contacto_tel text,
    notas text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    deleted_at timestamp(3) without time zone
);


ALTER TABLE public."SGR" OWNER TO admin_portal;

--
-- Name: SGR_id_seq; Type: SEQUENCE; Schema: public; Owner: admin_portal
--

CREATE SEQUENCE public."SGR_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."SGR_id_seq" OWNER TO admin_portal;

--
-- Name: SGR_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin_portal
--

ALTER SEQUENCE public."SGR_id_seq" OWNED BY public."SGR".id;


--
-- Name: SeguroVehiculo; Type: TABLE; Schema: public; Owner: admin_portal
--

CREATE TABLE public."SeguroVehiculo" (
    id integer NOT NULL,
    camion_id integer NOT NULL,
    empresa_id integer NOT NULL,
    aseguradora text NOT NULL,
    numero_poliza text,
    tipo_cobertura text,
    fecha_inicio timestamp(3) without time zone NOT NULL,
    fecha_vencimiento timestamp(3) without time zone NOT NULL,
    importe_anual numeric(12,2),
    moneda public."Moneda" DEFAULT 'ARS'::public."Moneda" NOT NULL,
    estado public."EstadoSeguro" DEFAULT 'VIGENTE'::public."EstadoSeguro" NOT NULL,
    documento_data bytea,
    documento_nombre text,
    documento_mime text,
    notas text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    deleted_at timestamp(3) without time zone,
    created_by integer
);


ALTER TABLE public."SeguroVehiculo" OWNER TO admin_portal;

--
-- Name: SeguroVehiculo_id_seq; Type: SEQUENCE; Schema: public; Owner: admin_portal
--

CREATE SEQUENCE public."SeguroVehiculo_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."SeguroVehiculo_id_seq" OWNER TO admin_portal;

--
-- Name: SeguroVehiculo_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin_portal
--

ALTER SEQUENCE public."SeguroVehiculo_id_seq" OWNED BY public."SeguroVehiculo".id;


--
-- Name: ServicioTaller; Type: TABLE; Schema: public; Owner: admin_portal
--

CREATE TABLE public."ServicioTaller" (
    id integer NOT NULL,
    camion_id integer NOT NULL,
    empresa_id integer NOT NULL,
    taller_nombre text,
    tipo public."TipoServicioTaller" NOT NULL,
    descripcion text NOT NULL,
    fecha_ingreso timestamp(3) without time zone NOT NULL,
    fecha_estimada timestamp(3) without time zone,
    fecha_retiro timestamp(3) without time zone,
    estado public."EstadoServicioTaller" DEFAULT 'PRESUPUESTADO'::public."EstadoServicioTaller" NOT NULL,
    presupuesto numeric(12,2),
    importe_final numeric(12,2),
    saldo_pendiente numeric(12,2),
    cuenta_corriente_id integer,
    notas text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    deleted_at timestamp(3) without time zone,
    created_by integer
);


ALTER TABLE public."ServicioTaller" OWNER TO admin_portal;

--
-- Name: ServicioTaller_id_seq; Type: SEQUENCE; Schema: public; Owner: admin_portal
--

CREATE SEQUENCE public."ServicioTaller_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."ServicioTaller_id_seq" OWNER TO admin_portal;

--
-- Name: ServicioTaller_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin_portal
--

ALTER SEQUENCE public."ServicioTaller_id_seq" OWNED BY public."ServicioTaller".id;


--
-- Name: SiniestroEmpleado; Type: TABLE; Schema: public; Owner: admin_portal
--

CREATE TABLE public."SiniestroEmpleado" (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    empleado_id integer,
    tipo public."TipoSiniestro" NOT NULL,
    fecha_ocurrencia timestamp(3) without time zone NOT NULL,
    descripcion text NOT NULL,
    lugar text,
    evento_id integer,
    art_nombre text,
    art_numero_siniestro text,
    fecha_denuncia_art timestamp(3) without time zone,
    estado public."EstadoSiniestro" DEFAULT 'ABIERTO'::public."EstadoSiniestro" NOT NULL,
    dias_baja integer,
    fecha_alta_medica timestamp(3) without time zone,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    deleted_at timestamp(3) without time zone,
    created_by integer,
    condicion_laboral text,
    diagnostico text,
    empleado_nombre_manual text,
    plan_accion text,
    zona_afectada text,
    zona_riesgo text
);


ALTER TABLE public."SiniestroEmpleado" OWNER TO admin_portal;

--
-- Name: SiniestroEmpleado_id_seq; Type: SEQUENCE; Schema: public; Owner: admin_portal
--

CREATE SEQUENCE public."SiniestroEmpleado_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."SiniestroEmpleado_id_seq" OWNER TO admin_portal;

--
-- Name: SiniestroEmpleado_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin_portal
--

ALTER SEQUENCE public."SiniestroEmpleado_id_seq" OWNED BY public."SiniestroEmpleado".id;


--
-- Name: SiniestroVehiculo; Type: TABLE; Schema: public; Owner: admin_portal
--

CREATE TABLE public."SiniestroVehiculo" (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    camion_id integer,
    patente_texto text,
    empleado_id integer,
    empleado_nombre_manual text,
    aseguradora text,
    numero_siniestro text,
    fecha_denuncia timestamp(3) without time zone,
    fecha_ocurrencia timestamp(3) without time zone NOT NULL,
    lugar text,
    descripcion text,
    danios text,
    tercero_nombre text,
    tercero_vehiculo text,
    tercero_seguro text,
    estado public."EstadoSiniestroVehiculo" DEFAULT 'ABIERTO'::public."EstadoSiniestroVehiculo" NOT NULL,
    observaciones text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    deleted_at timestamp(3) without time zone,
    created_by integer
);


ALTER TABLE public."SiniestroVehiculo" OWNER TO admin_portal;

--
-- Name: SiniestroVehiculo_id_seq; Type: SEQUENCE; Schema: public; Owner: admin_portal
--

CREATE SEQUENCE public."SiniestroVehiculo_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."SiniestroVehiculo_id_seq" OWNER TO admin_portal;

--
-- Name: SiniestroVehiculo_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin_portal
--

ALTER SEQUENCE public."SiniestroVehiculo_id_seq" OWNED BY public."SiniestroVehiculo".id;


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
-- Name: TarjetaCorporativa; Type: TABLE; Schema: public; Owner: admin_portal
--

CREATE TABLE public."TarjetaCorporativa" (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    nombre text NOT NULL,
    banco text DEFAULT 'Galicia'::text NOT NULL,
    moneda_base public."Moneda" DEFAULT 'ARS'::public."Moneda" NOT NULL,
    activa boolean DEFAULT true NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."TarjetaCorporativa" OWNER TO admin_portal;

--
-- Name: TarjetaCorporativa_id_seq; Type: SEQUENCE; Schema: public; Owner: admin_portal
--

CREATE SEQUENCE public."TarjetaCorporativa_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."TarjetaCorporativa_id_seq" OWNER TO admin_portal;

--
-- Name: TarjetaCorporativa_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin_portal
--

ALTER SEQUENCE public."TarjetaCorporativa_id_seq" OWNED BY public."TarjetaCorporativa".id;


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
    puede_ver_macro boolean DEFAULT false NOT NULL,
    home_route text
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
-- Name: AcuerdoSueldo id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."AcuerdoSueldo" ALTER COLUMN id SET DEFAULT nextval('public."AcuerdoSueldo_id_seq"'::regclass);


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
-- Name: BitacoraViaje id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."BitacoraViaje" ALTER COLUMN id SET DEFAULT nextval('public."BitacoraViaje_id_seq"'::regclass);


--
-- Name: Camion id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."Camion" ALTER COLUMN id SET DEFAULT nextval('public."Camion_id_seq"'::regclass);


--
-- Name: CargaCombustible id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."CargaCombustible" ALTER COLUMN id SET DEFAULT nextval('public."CargaCombustible_id_seq"'::regclass);


--
-- Name: CategoriaStock id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."CategoriaStock" ALTER COLUMN id SET DEFAULT nextval('public."CategoriaStock_id_seq"'::regclass);


--
-- Name: CierreContable id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."CierreContable" ALTER COLUMN id SET DEFAULT nextval('public."CierreContable_id_seq"'::regclass);


--
-- Name: CobroFacturaEmitida id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."CobroFacturaEmitida" ALTER COLUMN id SET DEFAULT nextval('public."CobroFacturaEmitida_id_seq"'::regclass);


--
-- Name: ConsumoTC id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."ConsumoTC" ALTER COLUMN id SET DEFAULT nextval('public."ConsumoTC_id_seq"'::regclass);


--
-- Name: CortesiaEvento id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."CortesiaEvento" ALTER COLUMN id SET DEFAULT nextval('public."CortesiaEvento_id_seq"'::regclass);


--
-- Name: CortesiaItem id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."CortesiaItem" ALTER COLUMN id SET DEFAULT nextval('public."CortesiaItem_id_seq"'::regclass);


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
-- Name: CuotaPlanAFIP id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."CuotaPlanAFIP" ALTER COLUMN id SET DEFAULT nextval('public."CuotaPlanAFIP_id_seq"'::regclass);


--
-- Name: CuotaPrestamo id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."CuotaPrestamo" ALTER COLUMN id SET DEFAULT nextval('public."CuotaPrestamo_id_seq"'::regclass);


--
-- Name: DocumentoPlanAFIP id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."DocumentoPlanAFIP" ALTER COLUMN id SET DEFAULT nextval('public."DocumentoPlanAFIP_id_seq"'::regclass);


--
-- Name: DocumentoPrestamo id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."DocumentoPrestamo" ALTER COLUMN id SET DEFAULT nextval('public."DocumentoPrestamo_id_seq"'::regclass);


--
-- Name: DocumentoSiniestro id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."DocumentoSiniestro" ALTER COLUMN id SET DEFAULT nextval('public."DocumentoSiniestro_id_seq"'::regclass);


--
-- Name: Echeq id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."Echeq" ALTER COLUMN id SET DEFAULT nextval('public."Echeq_id_seq"'::regclass);


--
-- Name: Empleado id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."Empleado" ALTER COLUMN id SET DEFAULT nextval('public."Empleado_id_seq"'::regclass);


--
-- Name: EmpleadoEmpresaSplit id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."EmpleadoEmpresaSplit" ALTER COLUMN id SET DEFAULT nextval('public."EmpleadoEmpresaSplit_id_seq"'::regclass);


--
-- Name: Empresa id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."Empresa" ALTER COLUMN id SET DEFAULT nextval('public."Empresa_id_seq"'::regclass);


--
-- Name: EntregaUniforme id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."EntregaUniforme" ALTER COLUMN id SET DEFAULT nextval('public."EntregaUniforme_id_seq"'::regclass);


--
-- Name: EscalafonAdmin id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."EscalafonAdmin" ALTER COLUMN id SET DEFAULT nextval('public."EscalafonAdmin_id_seq"'::regclass);


--
-- Name: EspacioCompartido id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."EspacioCompartido" ALTER COLUMN id SET DEFAULT nextval('public."EspacioCompartido_id_seq"'::regclass);


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
-- Name: EventoEmpleadoMes id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."EventoEmpleadoMes" ALTER COLUMN id SET DEFAULT nextval('public."EventoEmpleadoMes_id_seq"'::regclass);


--
-- Name: ExcedenteHoras id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."ExcedenteHoras" ALTER COLUMN id SET DEFAULT nextval('public."ExcedenteHoras_id_seq"'::regclass);


--
-- Name: Factura id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."Factura" ALTER COLUMN id SET DEFAULT nextval('public."Factura_id_seq"'::regclass);


--
-- Name: FacturaEmitida id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."FacturaEmitida" ALTER COLUMN id SET DEFAULT nextval('public."FacturaEmitida_id_seq"'::regclass);


--
-- Name: GastoMesEspacio id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."GastoMesEspacio" ALTER COLUMN id SET DEFAULT nextval('public."GastoMesEspacio_id_seq"'::regclass);


--
-- Name: GastoPeaje id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."GastoPeaje" ALTER COLUMN id SET DEFAULT nextval('public."GastoPeaje_id_seq"'::regclass);


--
-- Name: GastoSiniestro id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."GastoSiniestro" ALTER COLUMN id SET DEFAULT nextval('public."GastoSiniestro_id_seq"'::regclass);


--
-- Name: GastoTipoEspacio id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."GastoTipoEspacio" ALTER COLUMN id SET DEFAULT nextval('public."GastoTipoEspacio_id_seq"'::regclass);


--
-- Name: IndicadorEconomico id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."IndicadorEconomico" ALTER COLUMN id SET DEFAULT nextval('public."IndicadorEconomico_id_seq"'::regclass);


--
-- Name: Jornada id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."Jornada" ALTER COLUMN id SET DEFAULT nextval('public."Jornada_id_seq"'::regclass);


--
-- Name: LineaComida id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."LineaComida" ALTER COLUMN id SET DEFAULT nextval('public."LineaComida_id_seq"'::regclass);


--
-- Name: LineaGastoEspacio id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."LineaGastoEspacio" ALTER COLUMN id SET DEFAULT nextval('public."LineaGastoEspacio_id_seq"'::regclass);


--
-- Name: Liquidacion id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."Liquidacion" ALTER COLUMN id SET DEFAULT nextval('public."Liquidacion_id_seq"'::regclass);


--
-- Name: LiquidacionAdmin id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."LiquidacionAdmin" ALTER COLUMN id SET DEFAULT nextval('public."LiquidacionAdmin_id_seq"'::regclass);


--
-- Name: MaterialRental id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."MaterialRental" ALTER COLUMN id SET DEFAULT nextval('public."MaterialRental_id_seq"'::regclass);


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
-- Name: PagoPrestamoEmpleado id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."PagoPrestamoEmpleado" ALTER COLUMN id SET DEFAULT nextval('public."PagoPrestamoEmpleado_id_seq"'::regclass);


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
-- Name: ParteEspacio id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."ParteEspacio" ALTER COLUMN id SET DEFAULT nextval('public."ParteEspacio_id_seq"'::regclass);


--
-- Name: PatenteVehiculo id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."PatenteVehiculo" ALTER COLUMN id SET DEFAULT nextval('public."PatenteVehiculo_id_seq"'::regclass);


--
-- Name: PedidoComida id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."PedidoComida" ALTER COLUMN id SET DEFAULT nextval('public."PedidoComida_id_seq"'::regclass);


--
-- Name: PedidoItem id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."PedidoItem" ALTER COLUMN id SET DEFAULT nextval('public."PedidoItem_id_seq"'::regclass);


--
-- Name: PlanAFIP id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."PlanAFIP" ALTER COLUMN id SET DEFAULT nextval('public."PlanAFIP_id_seq"'::regclass);


--
-- Name: PreMacro id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."PreMacro" ALTER COLUMN id SET DEFAULT nextval('public."PreMacro_id_seq"'::regclass);


--
-- Name: PrestamoBancario id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."PrestamoBancario" ALTER COLUMN id SET DEFAULT nextval('public."PrestamoBancario_id_seq"'::regclass);


--
-- Name: PrestamoEmpleado id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."PrestamoEmpleado" ALTER COLUMN id SET DEFAULT nextval('public."PrestamoEmpleado_id_seq"'::regclass);


--
-- Name: PresupuestoEvento id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."PresupuestoEvento" ALTER COLUMN id SET DEFAULT nextval('public."PresupuestoEvento_id_seq"'::regclass);


--
-- Name: PresupuestoLinea id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."PresupuestoLinea" ALTER COLUMN id SET DEFAULT nextval('public."PresupuestoLinea_id_seq"'::regclass);


--
-- Name: Producto id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."Producto" ALTER COLUMN id SET DEFAULT nextval('public."Producto_id_seq"'::regclass);


--
-- Name: Proveedor id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."Proveedor" ALTER COLUMN id SET DEFAULT nextval('public."Proveedor_id_seq"'::regclass);


--
-- Name: RegistroAsistencia id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."RegistroAsistencia" ALTER COLUMN id SET DEFAULT nextval('public."RegistroAsistencia_id_seq"'::regclass);


--
-- Name: RemitoEvento id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."RemitoEvento" ALTER COLUMN id SET DEFAULT nextval('public."RemitoEvento_id_seq"'::regclass);


--
-- Name: RepartoFacturaEmitida id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."RepartoFacturaEmitida" ALTER COLUMN id SET DEFAULT nextval('public."RepartoFacturaEmitida_id_seq"'::regclass);


--
-- Name: RepartoLineaGasto id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."RepartoLineaGasto" ALTER COLUMN id SET DEFAULT nextval('public."RepartoLineaGasto_id_seq"'::regclass);


--
-- Name: ResponsableTC id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."ResponsableTC" ALTER COLUMN id SET DEFAULT nextval('public."ResponsableTC_id_seq"'::regclass);


--
-- Name: ResumenPresentismo id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."ResumenPresentismo" ALTER COLUMN id SET DEFAULT nextval('public."ResumenPresentismo_id_seq"'::regclass);


--
-- Name: Rubro id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."Rubro" ALTER COLUMN id SET DEFAULT nextval('public."Rubro_id_seq"'::regclass);


--
-- Name: RubroEvento id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."RubroEvento" ALTER COLUMN id SET DEFAULT nextval('public."RubroEvento_id_seq"'::regclass);


--
-- Name: SGR id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."SGR" ALTER COLUMN id SET DEFAULT nextval('public."SGR_id_seq"'::regclass);


--
-- Name: SeguroVehiculo id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."SeguroVehiculo" ALTER COLUMN id SET DEFAULT nextval('public."SeguroVehiculo_id_seq"'::regclass);


--
-- Name: ServicioTaller id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."ServicioTaller" ALTER COLUMN id SET DEFAULT nextval('public."ServicioTaller_id_seq"'::regclass);


--
-- Name: SiniestroEmpleado id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."SiniestroEmpleado" ALTER COLUMN id SET DEFAULT nextval('public."SiniestroEmpleado_id_seq"'::regclass);


--
-- Name: SiniestroVehiculo id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."SiniestroVehiculo" ALTER COLUMN id SET DEFAULT nextval('public."SiniestroVehiculo_id_seq"'::regclass);


--
-- Name: SocioPreMacro id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."SocioPreMacro" ALTER COLUMN id SET DEFAULT nextval('public."SocioPreMacro_id_seq"'::regclass);


--
-- Name: TabConfig id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."TabConfig" ALTER COLUMN id SET DEFAULT nextval('public."TabConfig_id_seq"'::regclass);


--
-- Name: TarjetaCorporativa id; Type: DEFAULT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."TarjetaCorporativa" ALTER COLUMN id SET DEFAULT nextval('public."TarjetaCorporativa_id_seq"'::regclass);


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

COPY public."Activo" (id, empresa_id, nombre, descripcion, categoria, numero_serie, fecha_compra, valor_compra, estado, ubicacion, observaciones, created_at, updated_at, deleted_at, created_by, cantidad, responsable_deposito, cantidad_minima) FROM stdin;
\.


--
-- Data for Name: AcuerdoSueldo; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."AcuerdoSueldo" (id, empleado_id, empresa_id, fecha_inicio, vigencia_meses, escalafon, tipo_seguro, sueldo_basico, horas_acordadas_mes, premio_incentivo, viatico, premio_presentismo, valor_hora_extra, telefono, activo, notas, created_at, updated_at, created_by, deleted_at, viatico_nacional, viatico_nacional_1000, viatico_provincial, categoria_acuerdo, horas_pendientes_acum, porcentaje_acuerdo, cobra_premio_produccion, valor_premio_produccion) FROM stdin;
1	17	2	2024-02-01 00:00:00	9	ADM 1	ART	2669251.00	200	154806.00	87734.72	154806.63	\N	43867.37	t	\N	2026-08-25 18:19:25.568	2026-08-25 21:19:00.373	6	\N	\N	\N	\N	GENERAL	\N	\N	f	\N
\.


--
-- Data for Name: Anticipo; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."Anticipo" (id, empleado_id, empresa_id, tipo, monto, fecha, motivo, descontado, liquidacion_id, created_at, created_by, liquidacion_admin_id) FROM stdin;
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
1	6	LOGIN	Usuario	6	\N	Login exitoso: mayra.dos57@gmail.com	\N	{"id": 6, "rol": "ADMIN", "email": "mayra.dos57@gmail.com", "nombre": "Mayra Ontivero"}	::1	2026-08-25 15:10:49.293	\N
2	6	SWITCH_EMPRESA	Usuario	6	\N	Cambió a la empresa "DOS57 Estructuras"	\N	\N	::1	2026-08-25 15:10:53.226	2
3	6	CREATE	AcuerdoSueldo	1	\N	Creó acuerdo de sueldo para Ontivero, Mayra	\N	{"escalafon": "ADM 1", "sueldo_basico": 2669251}	::1	2026-08-25 18:19:25.592	2
4	6	UPDATE	EmpleadoEmpresaSplit	\N	\N	Actualizó el split de empresas de Ontivero, Mayra	\N	{"splits": [{"empresa_id": 1, "porcentaje": 32}, {"empresa_id": 2, "porcentaje": 68}]}	::1	2026-08-25 18:19:25.65	2
5	\N	LOGOUT	Usuario	\N	\N	Logout de usuario #desconocido	\N	\N	::1	2026-08-25 18:23:39.056	\N
6	2	LOGIN	Usuario	2	\N	Login exitoso: matiaslorenzati@gmail.com	\N	{"id": 2, "rol": "ADMIN", "email": "matiaslorenzati@gmail.com", "nombre": "Matías Lorenzati"}	::1	2026-08-25 18:23:43.611	\N
7	2	SWITCH_EMPRESA	Usuario	2	\N	Cambió a la empresa "DOS57 Estructuras"	\N	\N	::1	2026-08-25 18:23:45.242	2
8	\N	LOGOUT	Usuario	\N	\N	Logout de usuario #desconocido	\N	\N	::1	2026-08-25 18:24:00.965	\N
9	6	LOGIN	Usuario	6	\N	Login exitoso: mayra.dos57@gmail.com	\N	{"id": 6, "rol": "ADMIN", "email": "mayra.dos57@gmail.com", "nombre": "Mayra Ontivero"}	::1	2026-08-25 18:26:32.618	\N
10	6	SWITCH_EMPRESA	Usuario	6	\N	Cambió a la empresa "DOS57 Estructuras"	\N	\N	::1	2026-08-25 18:26:35.365	2
11	6	UPDATE	AcuerdoSueldo	1	\N	Actualizó acuerdo de sueldo #1	{"sueldo_basico": 2669251}	{"activo": false}	::1	2026-08-25 21:19:00.428	2
12	6	LOGIN	Usuario	6	\N	Login exitoso: mayra.dos57@gmail.com	\N	{"id": 6, "rol": "ADMIN", "email": "mayra.dos57@gmail.com", "nombre": "Mayra Ontivero"}	::1	2026-08-26 01:55:53.999	\N
13	6	SWITCH_EMPRESA	Usuario	6	\N	Cambió a la empresa "DOS57 Estructuras"	\N	\N	::1	2026-08-26 01:56:01.915	2
14	6	CREATE	PrestamoEmpleado	1	\N	Registró préstamo "TEST curl verificacion" de $12000 para Ontivero, Mayra	\N	{"monto_cuota": 12000, "monto_total": 12000, "cantidad_cuotas": 1}	::1	2026-08-26 01:56:17.053	2
15	6	DELETE	PrestamoEmpleado	1	\N	Eliminó préstamo "TEST curl verificacion"	\N	\N	::1	2026-08-26 01:56:30.851	2
16	1	LOGIN	Usuario	1	\N	Login exitoso: admin@adminportal.com	\N	{"id": 1, "rol": "ADMIN", "email": "admin@adminportal.com", "nombre": "Administrador"}	::1	2026-10-07 15:39:03.426	\N
17	1	SWITCH_EMPRESA	Usuario	1	\N	Cambió a la empresa "DOS57 Estructuras"	\N	\N	::1	2026-10-07 15:39:04.682	2
18	1	IMPORT	Camion	\N	\N	Importó pizarra de flota — 24 vehículo(s) creados, 0 actualizados, 20 seguro(s) cargados	\N	{"errores": ["WNO918: vencimiento de seguro inválido en la pizarra (\\"61/7/26\\") — se omitió el seguro, confirmar con Lorena"], "seguros_creados": ["AG337MY (Fed.Patronal)", "AA183PK (Experta)", "HLW156 (Experta)", "KJR926 (Experta)", "LVX455 (Experta)", "AE919JA (Experta)", "KEX251 (San Cristobal)", "PFG964 (Experta)", "AF728AT (San Cristobal)", "HLW156-ACOPLADO (Rivadavia)", "KJR926-ACOPLADO (Rivadavia)", "WNO918-ACOPLADO (Rivadavia)", "AG768OI (Allianz)", "AD737FN (Experta)", "FTL303 (San Cristobal)", "AA830GU (Experta)", "HKQ258 (Experta)", "IBO355 (San Cristobal)", "AG958JV (San Cristobal)", "AUTOELEV-1 (Sancor)"], "seguros_omitidos": 0, "vehiculos_creados": ["AG337MY", "AA183PK", "HLW156", "KJR926", "LVX455", "AE919JA", "KEX251", "PFG964", "AF728AT", "HLW156-ACOPLADO", "KJR926-ACOPLADO", "WNO918-ACOPLADO", "AG768OI", "AD737FN", "FTL303", "AA830GU", "HKQ258", "IBO355", "AG958JV", "WNO918", "AUTOELEV-1", "AUTOELEV-2", "AUTOELEV-3", "AUTOELEV-4"], "vehiculos_actualizados": []}	::1	2026-10-07 15:39:44.264	2
19	1	CREATE	BitacoraViaje	\N	\N	Importó planilla de viajes de camiones (Planilla_Viajes_Camiones_Movimientos Eventos.xlsx) — 56 creados, 0 actualizados	\N	\N	::1	2026-10-07 15:41:28.122	2
20	1	IMPORT	Camion	\N	\N	Importó pizarra de flota — 0 vehículo(s) creados, 24 actualizados, 0 seguro(s) cargados	\N	{"errores": ["WNO918: vencimiento de seguro inválido en la pizarra (\\"61/7/26\\") — se omitió el seguro, confirmar con Lorena"], "seguros_creados": [], "seguros_omitidos": 20, "vehiculos_creados": [], "vehiculos_actualizados": ["AG337MY", "AA183PK", "HLW156", "KJR926", "LVX455", "AE919JA", "KEX251", "PFG964", "AF728AT", "HLW156-ACOPLADO", "KJR926-ACOPLADO", "WNO918-ACOPLADO", "AG768OI", "AD737FN", "FTL303", "AA830GU", "HKQ258", "IBO355", "AG958JV", "WNO918-ACOPLADO", "AUTOELEV-1", "AUTOELEV-2", "AUTOELEV-3", "AUTOELEV-4"]}	::1	2026-10-07 17:41:12.895	2
\.


--
-- Data for Name: BitacoraViaje; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."BitacoraViaje" (id, empleado_id, empresa_id, fecha, convocatoria, dia_semana, hora_inicio, hora_fin, horas_trabajadas, ejido, recorrido, tipo_recorrido, cantidad_vueltas, valor_por_vuelta, viatico_calculado, observaciones, liquidacion_admin_id, created_at, updated_at, deleted_at, created_by, alias_camion, camion_id, chofer_nombre, horario_llegada, horario_salida, km_finales, km_iniciales, km_recorridos, litros_cargados_ruta, monto_caja_entregada, monto_combustible, origen, patente_camion, km_por_litro, litros_consumidos, litros_iniciales_tanque, evento_id) FROM stdin;
9	\N	2	2026-09-02 00:00:00	TUCUMAN ROCK	Miércoles	\N	\N	\N	\N	COR - TUCUMAN	\N	1	\N	\N	Armado | Chofer "LUIS" no encontrado en Empleados	\N	2026-10-07 15:41:27.879	2026-10-07 15:41:27.879	\N	1	C1	\N	LUIS	\N	\N	905462	904868	594	\N	\N	\N	FLOTA	\N	2.80	212.14	\N	\N
10	\N	2	2026-09-02 00:00:00	TUCUMAN ROCK	Miércoles	\N	\N	\N	\N	COR - TUCUMAN	\N	1	\N	\N	Armado | Chofer "TATI" no encontrado en Empleados	\N	2026-10-07 15:41:27.884	2026-10-07 15:41:27.884	\N	1	C2	\N	TATI	\N	\N	160997	160412	585	\N	\N	\N	FLOTA	\N	2.70	216.67	\N	\N
11	\N	2	2026-09-02 00:00:00	TUCUMAN ROCK	Miércoles	\N	\N	\N	\N	COR - TUCUMAN	\N	1	\N	\N	Armado | Chofer "CARLOS" no encontrado en Empleados	\N	2026-10-07 15:41:27.888	2026-10-07 15:41:27.888	\N	1	C3	\N	CARLOS	\N	\N	1295540	1294909	631	\N	\N	\N	FLOTA	\N	2.80	225.36	\N	\N
12	\N	2	2026-09-03 00:00:00	TUCUMAN ROCK	Jueves	\N	\N	\N	\N	TUCUMAN - COR	\N	1	\N	\N	Armado | Chofer "LUIS" no encontrado en Empleados	\N	2026-10-07 15:41:27.892	2026-10-07 15:41:27.892	\N	1	C1	\N	LUIS	\N	\N	906058	905462	596	\N	\N	\N	FLOTA	\N	3.70	161.08	\N	\N
13	\N	2	2026-09-03 00:00:00	TUCUMAN ROCK	Jueves	\N	\N	\N	\N	TUCUMAN - COR	\N	1	\N	\N	Armado | Chofer "TATI" no encontrado en Empleados	\N	2026-10-07 15:41:27.894	2026-10-07 15:41:27.894	\N	1	C2	\N	TATI	\N	\N	161581	160997	584	\N	\N	\N	FLOTA	\N	3.16	184.81	\N	\N
14	\N	2	2026-09-03 00:00:00	TUCUMAN ROCK	Jueves	\N	\N	\N	\N	TUCUMAN - COR	\N	1	\N	\N	Armado | Chofer "CARLOS" no encontrado en Empleados	\N	2026-10-07 15:41:27.897	2026-10-07 15:41:27.897	\N	1	C3	\N	CARLOS	\N	\N	1296123	1295540	583	\N	\N	\N	FLOTA	\N	3.50	166.57	\N	\N
15	\N	2	\N	TUCUMAN ROCK	\N	\N	\N	\N	\N	COR - TUCUMAN	\N	1	\N	\N	Armado | Chofer "LUIS" no encontrado en Empleados	\N	2026-10-07 15:41:27.9	2026-10-07 15:41:27.9	\N	1	C4	\N	LUIS	\N	\N	906652	906060	592	\N	\N	\N	FLOTA	\N	2.80	211.43	\N	\N
16	\N	2	\N	TUCUMAN ROCK	\N	\N	\N	\N	\N	COR - TUCUMAN	\N	1	\N	\N	Armado | Chofer "TATI" no encontrado en Empleados	\N	2026-10-07 15:41:27.902	2026-10-07 15:41:27.902	\N	1	C5	\N	TATI	\N	\N	162201	161581	620	\N	\N	\N	FLOTA	\N	2.70	229.63	\N	\N
17	\N	2	\N	TUCUMAN ROCK	\N	\N	\N	\N	\N	COR - TUCUMAN	\N	1	\N	\N	Armado | Chofer "CARLOS" no encontrado en Empleados	\N	2026-10-07 15:41:27.904	2026-10-07 15:41:27.904	\N	1	C6	\N	CARLOS	\N	\N	1296710	1296128	582	\N	\N	\N	FLOTA	\N	2.80	207.86	\N	\N
18	\N	2	\N	TUCUMAN ROCK	\N	\N	\N	\N	\N	TUCUMAN - COR	\N	1	\N	\N	Armado | Chofer "LUIS" no encontrado en Empleados	\N	2026-10-07 15:41:27.906	2026-10-07 15:41:27.906	\N	1	C4	\N	LUIS	\N	\N	907249	906652	597	\N	\N	\N	FLOTA	\N	3.70	161.35	\N	\N
19	\N	2	\N	TUCUMAN ROCK	\N	\N	\N	\N	\N	TUCUMAN - COR	\N	1	\N	\N	Armado | Chofer "TATI" no encontrado en Empleados	\N	2026-10-07 15:41:27.908	2026-10-07 15:41:27.908	\N	1	C5	\N	TATI	\N	\N	162806	162201	605	\N	\N	\N	FLOTA	\N	3.16	191.46	\N	\N
20	\N	2	\N	TUCUMAN ROCK	\N	\N	\N	\N	\N	TUCUMAN - COR	\N	1	\N	\N	Armado | Chofer "CARLOS" no encontrado en Empleados	\N	2026-10-07 15:41:27.91	2026-10-07 15:41:27.91	\N	1	C6	\N	CARLOS	\N	\N	1297293	1296710	583	\N	\N	\N	FLOTA	\N	3.50	166.57	\N	\N
21	\N	2	\N	TUCUMAN ROCK	\N	\N	\N	\N	\N	COR - TUCUMAN	\N	1	\N	\N	Armado | Chofer "CARLOS" no encontrado en Empleados	\N	2026-10-07 15:41:27.912	2026-10-07 15:41:27.912	\N	1	C7	\N	CARLOS	\N	\N	163706	163093	613	\N	\N	\N	FLOTA	\N	2.70	227.04	\N	\N
22	\N	2	2026-09-13 00:00:00	TUCUMAN ROCK	Domingo	\N	\N	\N	\N	TUCUMAN - COR	\N	1	\N	\N	Desarme | KM CONSUMIDOS TUCUMAN ROCK: 595 | Chofer "CARLOS" no encontrado en Empleados	\N	2026-10-07 15:41:27.913	2026-10-07 15:41:27.913	\N	1	C1	\N	CARLOS	\N	\N	164421	163706	715	\N	\N	\N	FLOTA	\N	2.70	220.37	\N	\N
23	\N	2	2026-09-14 00:00:00	TUCUMAN ROCK	Lunes	\N	\N	\N	\N	COR - TUCUMAN	\N	1	\N	\N	Desarme | KM CONSUMIDOS TUCUMAN ROCK: 611 | Chofer "TATI" no encontrado en Empleados	\N	2026-10-07 15:41:27.915	2026-10-07 15:41:27.915	\N	1	C2	\N	TATI	\N	\N	1299970	1299139	831	\N	\N	\N	FLOTA	\N	3.50	174.57	\N	\N
24	\N	2	2026-09-14 00:00:00	TUCUMAN ROCK	Lunes	\N	\N	\N	\N	TUCUMAN - COR	\N	1	\N	\N	Desarme | Chofer "LANCIONI" no encontrado en Empleados	\N	2026-10-07 15:41:27.917	2026-10-07 15:41:27.917	\N	1	C3	\N	LANCIONI	\N	\N	\N	\N	0	\N	\N	\N	FLOTA	\N	\N	0.00	\N	\N
25	\N	2	\N	TUCUMAN ROCK	\N	\N	\N	\N	\N	COR - TUCUMAN	\N	1	\N	\N	Desarme | KM CONSUMIDOS TUCUMAN ROCK: 599 | Chofer "CARLOS" no encontrado en Empleados	\N	2026-10-07 15:41:27.919	2026-10-07 15:41:27.919	\N	1	C4	\N	CARLOS	\N	\N	165190	164421	769	\N	\N	\N	FLOTA	\N	3.16	189.56	\N	\N
26	\N	2	\N	TUCUMAN ROCK	\N	\N	\N	\N	\N	TUCUMAN - COR	\N	1	\N	\N	Desarme | Chofer "TATI" no encontrado en Empleados	\N	2026-10-07 15:41:27.922	2026-10-07 15:41:27.922	\N	1	C2	\N	TATI	\N	\N	1300560	1299970	590	\N	\N	\N	FLOTA	\N	2.80	210.71	\N	\N
27	\N	2	\N	TUCUMAN ROCK	\N	\N	\N	\N	\N	TUCUMAN - COR	\N	1	\N	\N	Desarme | Chofer "CARLOS" no encontrado en Empleados	\N	2026-10-07 15:41:27.925	2026-10-07 15:41:27.925	\N	1	C4	\N	CARLOS	\N	\N	165782	165190	592	\N	\N	\N	FLOTA	\N	2.70	219.26	\N	\N
28	\N	2	\N	TUCUMAN ROCK	\N	\N	\N	\N	\N	COR - TUCUMAN	\N	1	\N	\N	Desarme | KM CONSUMIDOS TUCUMAN ROCK: 606 | Chofer "TATI" no encontrado en Empleados	\N	2026-10-07 15:41:27.927	2026-10-07 15:41:27.927	\N	1	C5	\N	TATI	\N	\N	1301406	1300560	846	\N	\N	\N	FLOTA	\N	3.50	173.14	\N	\N
29	\N	2	\N	TUCUMAN ROCK	\N	\N	\N	\N	\N	TUCUMAN - COR	\N	1	\N	\N	Desarme | KM CONSUMIDOS TUCUMAN ROCK: 623 | Chofer "TATI" no encontrado en Empleados	\N	2026-10-07 15:41:27.929	2026-10-07 15:41:27.929	\N	1	C5	\N	TATI	\N	\N	1302149	1301406	743	\N	\N	\N	FLOTA	\N	2.80	222.50	\N	\N
30	\N	2	\N	TUCUMAN ROCK	\N	\N	\N	\N	\N	COR - TUCUMAN	\N	1	\N	\N	Desarme | Chofer "LUIS" no encontrado en Empleados	\N	2026-10-07 15:41:27.931	2026-10-07 15:41:27.931	\N	1	C6	\N	LUIS	\N	\N	909781	909184	597	\N	\N	\N	FLOTA	\N	3.70	161.35	\N	\N
31	\N	2	\N	TUCUMAN ROCK	\N	\N	\N	\N	\N	TUCUMAN - COR	\N	1	\N	\N	Desarme | Chofer "LUIS" no encontrado en Empleados	\N	2026-10-07 15:41:27.933	2026-10-07 15:41:27.933	\N	1	C6	\N	LUIS	\N	\N	910401	909781	620	\N	\N	\N	FLOTA	\N	2.80	221.43	\N	\N
32	\N	2	\N	TUCUMAN ROCK	\N	\N	\N	\N	\N	COR - TUCUMAN	\N	1	\N	\N	Desarme | Chofer "CARLOS" no encontrado en Empleados	\N	2026-10-07 15:41:27.935	2026-10-07 15:41:27.935	\N	1	C7	\N	CARLOS	\N	\N	166359	165781	578	\N	\N	\N	FLOTA	\N	3.16	182.91	\N	\N
33	\N	2	\N	TUCUMAN ROCK	\N	\N	\N	\N	\N	TUCUMAN - COR	\N	1	\N	\N	Desarme | Chofer "CARLOS" no encontrado en Empleados	\N	2026-10-07 15:41:27.937	2026-10-07 15:41:27.937	\N	1	C7	\N	CARLOS	\N	\N	166938	166359	579	\N	\N	\N	FLOTA	\N	2.70	214.44	\N	\N
34	\N	2	2026-08-07 00:00:00	JUJUY - LA RENGA	Viernes	\N	\N	\N	\N	COR - JUJUY	\N	1	\N	\N	Chofer "LUIS" no encontrado en Empleados	\N	2026-10-07 15:41:27.94	2026-10-07 15:41:27.94	\N	1	C1	20	LUIS	\N	\N	899912	898919	993	340.66	\N	823375.00	FLOTA	HKQ258	2.25	440.24	139.34	\N
35	\N	2	2026-08-07 00:00:00	JUJUY - LA RENGA	Viernes	\N	\N	\N	\N	COR - JUJUY	\N	1	\N	\N	Se Quedó en Jujuy | Chofer "MIGUEL" no encontrado en Empleados	\N	2026-10-07 15:41:27.943	2026-10-07 15:41:27.943	\N	1	C2	16	MIGUEL	\N	\N	156787	155855	932	781.09	100000.00	1887925.95	FLOTA	AG768OI	2.70	345.18	83.91	\N
36	\N	2	2026-08-08 00:00:00	JUJUY - LA RENGA	Sábado	\N	\N	\N	\N	JUJUY - COR	\N	1	\N	\N	Chofer "LUIS" no encontrado en Empleados	\N	2026-10-07 15:41:27.946	2026-10-07 15:41:27.946	\N	1	C1	20	LUIS	\N	\N	900849	899912	937	440.24	\N	1116009.00	FLOTA	HKQ258	3.15	297.38	\N	\N
37	\N	2	2026-08-10 00:00:00	JUJUY - LA RENGA	Lunes	\N	\N	\N	\N	COR - JUJUY	\N	1	\N	\N	Se Quedó en Jujuy | Chofer "LUIS" no encontrado en Empleados	\N	2026-10-07 15:41:27.952	2026-10-07 15:41:27.952	\N	1	C4	20	LUIS	\N	\N	901846	900849	997	297.38	100000.00	724120.00	FLOTA	HKQ258	2.30	432.44	\N	\N
38	\N	2	2026-08-16 00:00:00	JUJUY - LA RENGA	Domingo	\N	\N	\N	\N	JUJUY - COR	\N	1	\N	\N	Chofer "LUIS" no encontrado en Empleados	\N	2026-10-07 15:41:27.959	2026-10-07 15:41:27.959	\N	1	C1	20	LUIS	\N	\N	902821	901865	956	432.44	100000.00	1117003.00	FLOTA	HKQ258	2.30	406.73	\N	\N
39	\N	2	2026-08-17 00:00:00	JUJUY - LA RENGA	Lunes	\N	\N	\N	\N	COR - JUJUY	\N	1	\N	\N	Chofer "LUIS" no encontrado en Empleados	\N	2026-10-07 15:41:27.966	2026-10-07 15:41:27.966	\N	1	C3	20	LUIS	\N	\N	903847	902821	1026	294.71	\N	990000.00	FLOTA	HKQ258	3.48	294.71	\N	\N
40	\N	2	2026-08-18 00:00:00	JUJUY - LA RENGA	Martes	\N	\N	\N	\N	JUJUY - COR	\N	1	\N	\N	Chofer "LUIS" no encontrado en Empleados	\N	2026-10-07 15:41:27.971	2026-10-07 15:41:27.971	\N	1	C3	20	LUIS	\N	\N	904774	903847	927	294.71	100000.00	755051.00	FLOTA	HKQ258	2.30	402.00	\N	\N
41	\N	2	2026-08-17 00:00:00	JUJUY - LA RENGA	Lunes	\N	\N	\N	\N	JUJUY - COR	\N	1	\N	\N	Combustible: SIN CARGA | Chofer "MIGUEL" no encontrado en Empleados	\N	2026-10-07 15:41:27.979	2026-10-07 15:41:27.979	\N	1	C2	16	MIGUEL	\N	\N	157744	156788	956	0.00	\N	\N	FLOTA	AG768OI	2.70	354.07	\N	\N
42	\N	2	2026-08-18 00:00:00	JUJUY - LA RENGA	Martes	\N	\N	\N	\N	COR - JUJUY	\N	1	\N	\N	Chofer "MIGUEL" no encontrado en Empleados	\N	2026-10-07 15:41:27.987	2026-10-07 15:41:27.987	\N	1	C4	16	MIGUEL	\N	\N	158694	157795	899	406.57	100000.00	990000.00	FLOTA	AG768OI	3.16	284.49	\N	\N
43	\N	2	2026-08-20 00:00:00	JUJUY - LA RENGA	Jueves	\N	\N	\N	\N	JUJUY - COR	\N	1	\N	\N	Chofer "MIGUEL" no encontrado en Empleados	\N	2026-10-07 15:41:27.995	2026-10-07 15:41:27.995	\N	1	C4	16	MIGUEL	\N	\N	159621	158694	927	161.64	\N	400000.00	FLOTA	AG768OI	2.30	403.33	\N	\N
44	\N	2	2026-08-11 00:00:00	RESCOLDO	Martes	\N	\N	\N	\N	RESCOLDO	\N	1	\N	\N	Hizo 2 Viajes | Chofer "MIGUEL" no encontrado en Empleados	\N	2026-10-07 15:41:28.002	2026-10-07 15:41:28.002	\N	1	\N	18	MIGUEL	\N	\N	1294806	1294691	115	\N	\N	\N	FLOTA	FTL303	\N	\N	\N	\N
45	11	2	2026-08-12 00:00:00	RESCOLDO/KEMPES	Miércoles	\N	\N	\N	\N	RESCOLDO / KEMPES	\N	1	\N	\N	3 Viajes a Rescoldo - 1 Kempes	\N	2026-10-07 15:41:28.007	2026-10-07 15:41:28.007	\N	1	PLANCHA	22	MACHADO	\N	\N	63465	63320	145	\N	\N	\N	FLOTA	AG958JV	\N	\N	\N	\N
46	11	2	2026-08-13 00:00:00	RESCOLDO/KEMPES	Jueves	\N	\N	\N	\N	RESCOLDO / KEMPES	\N	1	\N	\N	\N	\N	2026-10-07 15:41:28.018	2026-10-07 15:41:28.018	\N	1	PLANCHA	22	MACHADO	\N	\N	\N	63465	\N	\N	\N	\N	FLOTA	AG958JV	\N	\N	\N	\N
47	\N	2	2026-07-17 00:00:00	ANIVERSARIO SGO DEL ESTERO	Viernes	\N	\N	\N	\N	Cordoba - Santiago	\N	1	\N	\N	Chofer "Luis" no encontrado en Empleados	\N	2026-10-07 15:41:28.028	2026-10-07 15:41:28.028	\N	1	C1	\N	Luis	2026-07-18 04:00:00	2026-07-17 18:30:00	\N	\N	\N	\N	100000.00	363252.00	FLOTA	\N	\N	\N	\N	\N
48	\N	2	2026-07-17 00:00:00	ANIVERSARIO SGO DEL ESTERO	Viernes	\N	\N	\N	\N	Santiago - Cordoba	\N	1	\N	\N	Chofer "Luis" no encontrado en Empleados	\N	2026-10-07 15:41:28.039	2026-10-07 15:41:28.039	\N	1	C1	\N	Luis	2026-07-17 21:00:00	2026-07-17 13:00:00	\N	\N	\N	\N	\N	\N	FLOTA	\N	\N	\N	\N	\N
49	\N	2	2026-07-17 00:00:00	ANIVERSARIO SGO DEL ESTERO	Viernes	\N	\N	\N	\N	Cordoba - Santiago	\N	1	\N	\N	Chofer "Miguel" no encontrado en Empleados	\N	2026-10-07 15:41:28.048	2026-10-07 15:41:28.048	\N	1	C2	\N	Miguel	2026-07-18 06:00:00	2026-07-17 21:00:00	\N	\N	\N	\N	100000.00	505145.00	FLOTA	\N	\N	\N	\N	\N
50	\N	2	2026-07-18 00:00:00	ANIVERSARIO SGO DEL ESTERO	Sábado	\N	\N	\N	\N	Santiago - Cordoba	\N	1	\N	\N	Chofer "Miguel" no encontrado en Empleados	\N	2026-10-07 15:41:28.058	2026-10-07 15:41:28.058	\N	1	C2	\N	Miguel	2026-07-18 21:00:00	2026-07-18 13:00:00	\N	\N	\N	\N	\N	\N	FLOTA	\N	\N	\N	\N	\N
51	\N	2	2026-07-19 00:00:00	ANIVERSARIO SGO DEL ESTERO	Domingo	\N	\N	\N	\N	Cordoba - Santiago	\N	1	\N	\N	Chofer "Luis" no encontrado en Empleados	\N	2026-10-07 15:41:28.067	2026-10-07 15:41:28.067	\N	1	C3	\N	Luis	2026-07-20 06:35:00	2026-07-19 23:10:00	\N	\N	\N	\N	100000.00	124172.00	FLOTA	\N	\N	\N	\N	\N
52	\N	2	2026-07-20 00:00:00	ANIVERSARIO SGO DEL ESTERO	Lunes	\N	\N	\N	\N	Santiago - Cordoba	\N	1	\N	\N	Chofer "Luis" no encontrado en Empleados	\N	2026-10-07 15:41:28.07	2026-10-07 15:41:28.07	\N	1	C3	\N	Luis	2026-07-20 21:01:00	2026-07-20 10:30:00	\N	\N	\N	\N	\N	\N	FLOTA	\N	\N	\N	\N	\N
53	\N	2	2026-07-21 00:00:00	ANIVERSARIO SGO DEL ESTERO	Martes	\N	\N	\N	\N	Cordoba - Santiago	\N	1	\N	\N	Chofer "Miguel" no encontrado en Empleados	\N	2026-10-07 15:41:28.073	2026-10-07 15:41:28.073	\N	1	C4	\N	Miguel	2026-07-22 08:00:00	2026-07-21 22:30:00	\N	\N	\N	\N	100000.00	348045.00	FLOTA	\N	\N	\N	\N	\N
54	\N	2	2026-07-21 00:00:00	ANIVERSARIO SGO DEL ESTERO	Martes	\N	\N	\N	\N	Santiago - Cordoba	\N	1	\N	\N	Chofer "Miguel" no encontrado en Empleados	\N	2026-10-07 15:41:28.079	2026-10-07 15:41:28.079	\N	1	C4	\N	Miguel	2026-07-21 19:42:00	2026-07-21 12:40:00	\N	\N	\N	\N	\N	\N	FLOTA	\N	\N	\N	\N	\N
55	\N	2	2026-07-22 00:00:00	ANIVERSARIO SGO DEL ESTERO	Miércoles	\N	\N	\N	\N	Cordoba - Santiago	\N	1	\N	\N	Nota fila 13: Quedó en Sgo | Chofer "Luis" no encontrado en Empleados	\N	2026-10-07 15:41:28.086	2026-10-07 15:41:28.086	\N	1	C5	\N	Luis	2026-07-22 23:00:00	2026-07-22 16:00:00	\N	\N	\N	\N	100000.00	391107.00	FLOTA	\N	\N	\N	\N	\N
56	\N	2	2026-07-26 00:00:00	ANIVERSARIO SGO DEL ESTERO	Domingo	\N	\N	\N	\N	Cordoba - Santiago	\N	1	\N	\N	Chofer "Miguel" no encontrado en Empleados	\N	2026-10-07 15:41:28.091	2026-10-07 15:41:28.091	\N	1	C1	\N	Miguel	2026-07-26 17:00:00	2026-07-26 09:00:00	\N	\N	\N	\N	100000.00	207383.00	FLOTA	\N	\N	\N	\N	\N
57	\N	2	2026-07-26 00:00:00	ANIVERSARIO SGO DEL ESTERO	Domingo	\N	\N	\N	\N	Santiago - Cordoba	\N	1	\N	\N	Chofer "Miguel" no encontrado en Empleados	\N	2026-10-07 15:41:28.095	2026-10-07 15:41:28.095	\N	1	C1	\N	Miguel	2026-07-26 21:00:00	2026-07-26 13:40:00	\N	\N	\N	\N	\N	262000.00	FLOTA	\N	\N	\N	\N	\N
58	\N	2	2026-07-26 00:00:00	ANIVERSARIO SGO DEL ESTERO	Domingo	\N	\N	\N	\N	Santiago - Cordoba	\N	1	\N	\N	Salida: Estaba en Sgo | Nota fila 17: HORARIO SALIDA: 06:27 · HORARIO LLEGADA: 15:00 · Transf. Pollo, Carga Sgo | Chofer "Luis" no encontrado en Empleados	\N	2026-10-07 15:41:28.1	2026-10-07 15:41:28.1	\N	1	C2	\N	Luis	\N	\N	\N	\N	\N	66.33	100000.00	\N	FLOTA	\N	\N	\N	\N	\N
59	\N	2	2026-07-27 00:00:00	ANIVERSARIO SGO DEL ESTERO	Lunes	\N	\N	\N	\N	Cordoba - Santiago	\N	1	\N	\N	Chofer "Luis" no encontrado en Empleados	\N	2026-10-07 15:41:28.104	2026-10-07 15:41:28.104	\N	1	C3	\N	Luis	2026-07-27 19:00:00	2026-07-27 10:47:00	\N	\N	\N	\N	\N	322477.00	FLOTA	\N	\N	\N	\N	\N
60	\N	2	2026-07-27 00:00:00	ANIVERSARIO SGO DEL ESTERO	Lunes	\N	\N	\N	\N	Santiago - Cordoba	\N	1	\N	\N	Chofer "Luis" no encontrado en Empleados	\N	2026-10-07 15:41:28.107	2026-10-07 15:41:28.107	\N	1	C3	\N	Luis	2026-07-28 04:34:00	2026-07-27 21:27:00	\N	\N	\N	\N	\N	\N	FLOTA	\N	\N	\N	\N	\N
61	\N	2	2026-07-27 00:00:00	ANIVERSARIO SGO DEL ESTERO	Lunes	\N	\N	\N	\N	Cordoba - Santiago	\N	1	\N	\N	Chofer "Miguel" no encontrado en Empleados	\N	2026-10-07 15:41:28.11	2026-10-07 15:41:28.11	\N	1	C4	\N	Miguel	2026-07-28 05:54:00	2026-07-27 22:58:00	\N	\N	\N	200.00	50000.00	\N	FLOTA	\N	\N	\N	\N	\N
62	\N	2	2026-07-28 00:00:00	ANIVERSARIO SGO DEL ESTERO	Martes	\N	\N	\N	\N	Santiago - Cordoba	\N	1	\N	\N	Chofer "Miguel" no encontrado en Empleados	\N	2026-10-07 15:41:28.113	2026-10-07 15:41:28.113	\N	1	C4	\N	Miguel	2026-07-29 01:53:00	2026-07-28 16:25:00	\N	\N	\N	\N	\N	\N	FLOTA	\N	\N	\N	\N	\N
63	\N	2	2026-07-28 00:00:00	ANIVERSARIO SGO DEL ESTERO	Martes	\N	\N	\N	\N	Cordoba - Santiago	\N	1	\N	\N	Chofer "Luis" no encontrado en Empleados	\N	2026-10-07 15:41:28.116	2026-10-07 15:41:28.116	\N	1	C5	\N	Luis	2026-07-28 20:30:00	2026-07-28 11:37:00	\N	\N	\N	\N	50000.00	314531.00	FLOTA	\N	\N	\N	\N	\N
64	\N	2	2026-08-29 00:00:00	ANIVERSARIO SGO DEL ESTERO	Sábado	\N	\N	\N	\N	Santiago - Cordoba	\N	1	\N	\N	Chofer "Luis" no encontrado en Empleados	\N	2026-10-07 15:41:28.118	2026-10-07 15:41:28.118	\N	1	C5	\N	Luis	2026-08-30 03:40:00	2026-08-29 20:00:00	\N	\N	\N	\N	\N	\N	FLOTA	\N	\N	\N	\N	\N
\.


--
-- Data for Name: Camion; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."Camion" (id, empresa_id, codigo, descripcion, patente, tipo, activo, created_at, updated_at, deleted_at, anio, color, en_servicio, fecha_baja, marca, modelo, motivo_baja, numero_telepase, titular, km_actual, limite_mensual_combustible, capacidad_combustible, tipo_vehiculo, notas) FROM stdin;
16	2	AG768OI	Mercedes Bco	AG768OI	CAMION	t	2026-10-07 15:39:44.124	2026-10-07 18:25:06.324	\N	\N	\N	t	\N	\N	\N	\N	\N	DOS57	\N	\N	315 lts + 35 UREA	CAMION	RTO 05/08/27
17	2	AD737FN	Semi Negro	AD737FN	CAMION	t	2026-10-07 15:39:44.14	2026-10-07 18:25:06.334	\N	\N	\N	t	\N	\N	\N	\N	\N	DOS57	\N	\N	\N	CAMION	RTO 31/08/27
18	2	FTL303	Volvo	FTL303	CAMION	t	2026-10-07 15:39:44.15	2026-10-07 18:25:06.343	\N	\N	\N	t	\N	\N	\N	\N	\N	DOS57	\N	\N	\N	CAMION	RTO 31/08/27
19	2	AA830GU	Semi Bco	AA830GU	CAMION	t	2026-10-07 15:39:44.167	2026-10-07 18:25:06.35	\N	\N	\N	t	\N	\N	\N	\N	\N	DOS57	\N	\N	610 lts (2 tanques)	CAMION	RTO 17/07/27
20	2	HKQ258	Camion Negro	HKQ258	CAMION	t	2026-10-07 15:39:44.181	2026-10-07 18:25:06.359	\N	\N	\N	t	\N	\N	\N	\N	\N	DOS57	\N	\N	\N	CAMION	RTO 05/8/27
21	2	IBO355	Semi Naranja	IBO355	CAMION	t	2026-10-07 15:39:44.191	2026-10-07 18:25:06.368	\N	\N	\N	t	\N	\N	\N	\N	\N	DOS57	\N	\N	500 lts	CAMION	RTO 11/02/27
22	2	AG958JV	Plancha	AG958JV	CAMION	t	2026-10-07 15:39:44.205	2026-10-07 18:25:06.377	\N	\N	\N	t	\N	\N	\N	\N	\N	DOS57	\N	\N	\N	CAMION	RTO 04/08/27
15	2	WNO918-ACOPLADO	Mercedes	WNO918	CAMION	t	2026-10-07 15:39:44.099	2026-10-07 18:25:06.389	\N	\N	\N	t	\N	\N	\N	\N	\N	DOS57	\N	\N	210 lts + 35 UREA	CAMION	\N
24	2	AUTOELEV-1	Polo (ex Ranvl)	\N	AUTOELEVADOR	t	2026-10-07 15:39:44.225	2026-10-07 18:25:06.397	\N	\N	\N	t	\N	\N	\N	\N	\N	DOS57	\N	\N	\N	AUTOELEVADOR	\N
25	2	AUTOELEV-2	Polo	\N	AUTOELEVADOR	t	2026-10-07 15:39:44.242	2026-10-07 18:25:06.406	\N	\N	\N	t	\N	\N	\N	\N	\N	DOS57	\N	\N	\N	AUTOELEVADOR	\N
26	2	AUTOELEV-3	Kempes	\N	AUTOELEVADOR	t	2026-10-07 15:39:44.253	2026-10-07 18:25:06.412	\N	\N	\N	t	\N	\N	\N	\N	\N	DOS57	\N	\N	\N	AUTOELEVADOR	\N
27	2	AUTOELEV-4	4x4	\N	AUTOELEVADOR	t	2026-10-07 15:39:44.258	2026-10-07 18:25:06.417	\N	\N	\N	t	\N	\N	\N	\N	\N	DOS57	\N	\N	\N	AUTOELEVADOR	\N
6	2	HLW156	Ranger	HLW156	CAMIONETA	t	2026-10-07 15:39:43.928	2026-10-07 18:25:05.617	\N	\N	\N	t	\N	\N	\N	\N	\N	DOS57	\N	\N	60/65 lts	CAMIONETA	\N
7	2	KJR926	Toyota Plateada	KJR926	CAMIONETA	t	2026-10-07 15:39:43.942	2026-10-07 18:25:05.636	\N	\N	\N	t	\N	\N	\N	\N	\N	DOS57	\N	\N	60/65 lts	CAMIONETA	RTO 25/9/2026
23	2	WNO918	Mercedes	WNO918	CAMION	t	2026-10-07 15:39:44.217	2026-10-07 18:25:05.817	\N	\N	\N	t	\N	\N	\N	\N	\N	DOS57	\N	\N	210 lts + 35 UREA	CAMION	\N
4	2	AG337MY	Ranger Pollo	AG337MY	CAMIONETA	t	2026-10-07 15:39:43.895	2026-10-07 18:25:06.168	\N	\N	\N	t	\N	\N	\N	\N	\N	DOS57	\N	\N	75 lts	CAMIONETA	ITV 16/07/27
5	2	AA183PK	Toyota	AA183PK	CAMIONETA	t	2026-10-07 15:39:43.916	2026-10-07 18:25:06.178	\N	\N	\N	t	\N	\N	\N	\N	\N	DOS57	\N	\N	60/65 lts	CAMIONETA	RTO 27/9/2026
8	2	LVX455	Toyota	LVX455	CAMIONETA	t	2026-10-07 15:39:43.951	2026-10-07 18:25:06.225	\N	\N	\N	t	\N	\N	\N	\N	\N	DOS57	\N	\N	60/65 lts	CAMIONETA	RTO 23/7/2027
9	2	AE919JA	Toyota Roja	AE919JA	CAMIONETA	t	2026-10-07 15:39:43.963	2026-10-07 18:25:06.234	\N	\N	\N	t	\N	\N	\N	\N	\N	DOS57	\N	\N	60/65 lts	CAMIONETA	RTO 19/05/28
10	2	KEX251	Toyota	KEX251	CAMIONETA	t	2026-10-07 15:39:43.985	2026-10-07 18:25:06.242	\N	\N	\N	t	\N	\N	\N	\N	\N	DOS57	\N	\N	80 lts	CAMIONETA	RTO 20/02/28
11	2	PFG964	Ranger	PFG964	CAMIONETA	t	2026-10-07 15:39:44.004	2026-10-07 18:25:06.268	\N	\N	\N	t	\N	\N	\N	\N	\N	DOS57	\N	\N	60/65 lts	CAMIONETA	RTO 22/07/2027
12	2	AF728AT	Sprinter	AF728AT	CAMIONETA	t	2026-10-07 15:39:44.029	2026-10-07 18:25:06.285	\N	\N	\N	t	\N	\N	\N	\N	\N	DOS57	\N	\N	71/75 lts (100ltr/100km)	CAMIONETA	ITV 16/11/2026
13	2	HLW156-ACOPLADO	Trailer	HLW156	TRAILER	t	2026-10-07 15:39:44.053	2026-10-07 18:25:06.298	\N	\N	\N	t	\N	\N	\N	\N	\N	DOS57	\N	\N	\N	TRAILER	\N
14	2	KJR926-ACOPLADO	Trailer	KJR926	TRAILER	t	2026-10-07 15:39:44.076	2026-10-07 18:25:06.308	\N	\N	\N	t	\N	\N	\N	\N	\N	DOS57	\N	\N	\N	TRAILER	\N
\.


--
-- Data for Name: CargaCombustible; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."CargaCombustible" (id, empresa_id, camion_id, fecha, tipo_combustible, litros, precio_por_litro, monto_total, estacion_nombre, estacion_ciudad, km_actual, km_anterior, km_recorridos, rendimiento_lts_100km, estado, autorizado_por, autorizado_at, evento_id, cuenta_corriente_id, responsable_nombre, comprobante_data, comprobante_nombre, comprobante_mime, notas, created_at, updated_at, deleted_at, created_by, numero_comprobante, pagos, saldo, tipo_movimiento, orden) FROM stdin;
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
-- Data for Name: CierreContable; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."CierreContable" (id, empresa_id, fecha_corte, periodo_anio, estado, snapshot, notas, created_at, updated_at, created_by) FROM stdin;
\.


--
-- Data for Name: CobroFacturaEmitida; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."CobroFacturaEmitida" (id, factura_emitida_id, fecha, monto, moneda, forma_cobro, cuenta_destino_id, referencia, notas, created_at, created_by) FROM stdin;
\.


--
-- Data for Name: ConsumoTC; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."ConsumoTC" (id, tarjeta_id, responsable_id, fecha, periodo_mes, periodo_anio, monto_ars, monto_usd, detalle, observaciones, empresa_imputa, descontado, nota_descuento, import_key, created_at, updated_at, created_by, deleted_at) FROM stdin;
\.


--
-- Data for Name: CortesiaEvento; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."CortesiaEvento" (id, evento_id, empresa_id, cliente_nombre, contacto_nombre, autorizado_por, observacion, visado, entregado, created_at, updated_at, deleted_at, created_by) FROM stdin;
\.


--
-- Data for Name: CortesiaItem; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."CortesiaItem" (id, cortesia_id, tipo_ticket, cantidad, bib_number, nombre_inscripto, apellido_inscripto, dni, email, created_at) FROM stdin;
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
-- Data for Name: CuotaPlanAFIP; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."CuotaPlanAFIP" (id, plan_id, numero_cuota, fecha_debito, capital, interes, total_cuota, fecha_pago_real, pagada, notas, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: CuotaPrestamo; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."CuotaPrestamo" (id, prestamo_id, numero_cuota, fecha_vencimiento, capital, interes, iva_interes, seguro, otros_impuestos, total_cuota, fecha_pago_real, pagada, notas, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: DocumentoPlanAFIP; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."DocumentoPlanAFIP" (id, plan_id, nombre, descripcion, archivo_data, archivo_mime, archivo_size, created_at, created_by) FROM stdin;
\.


--
-- Data for Name: DocumentoPrestamo; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."DocumentoPrestamo" (id, prestamo_id, nombre, descripcion, archivo_data, archivo_mime, archivo_size, created_at, created_by) FROM stdin;
\.


--
-- Data for Name: DocumentoSiniestro; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."DocumentoSiniestro" (id, siniestro_id, nombre, descripcion, archivo_data, archivo_mime, created_at, created_by) FROM stdin;
\.


--
-- Data for Name: Echeq; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."Echeq" (id, evento_id, movimiento_id, movimiento_caja_id, numero, razon_social, detalle, importe, moneda, estado, fecha_emision, fecha_cobro_estimada, fecha_cobro_real, created_at, updated_at, deleted_at, created_by, updated_by, motivo_rechazo, proveedor_id, monto_ars, tasa_cambio, banco_descuento, fecha_venta, monto_neto_recibido, tasa_descuento) FROM stdin;
\.


--
-- Data for Name: Empleado; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."Empleado" (id, empresa_id, nombre, apellido, dni, cuit, email, telefono, domicilio, cbu, alias, banco, categoria, valor_hora, valor_hora_extra, estado, notas, usuario_id, created_at, updated_at, deleted_at, created_by, tipo_liquidacion, valor_jornada_completa, valor_media_jornada, umbral_horas_jornada, umbral_horas_media, valor_hora_extra_jornada, valor_viaje, apodo, fecha_nacimiento, grupo_sanguineo, contacto_emergencia_nombre, contacto_emergencia_tel, escalafon, art, licencia_conducir, equipamiento_asignado, talle_pantalon, talle_remera, talle_buzo, talle_calzado, contacto_emergencia_tel2, tipo_contratacion, hora_convocatoria_default) FROM stdin;
1	2	Gonzalo Daniel	Arias	\N	20-38160996-1	\N	3541-288005	Dorrego 2281 Santa Maria Punilla	\N	\N	\N	OTRO	0.00	0.00	ACTIVO	\N	\N	2026-08-25 00:41:22.113	2026-08-25 00:41:22.113	\N	\N	LINEAL	\N	\N	\N	\N	\N	\N	Gonzalo	1994-09-07 00:00:00	A+	madre Flores Nora	3541-331614	\N	\N	f	\N	42	L	L	43	\N	FEDERAL PATRONAL (AP)	\N
2	2	Rodrigo Agustin	Altamirano	\N	23-43695082-9	\N	351-4594693	Pedro Ferre 6114 B° San Javier	\N	\N	\N	OTRO	0.00	0.00	ACTIVO	\N	\N	2026-08-25 00:41:22.127	2026-08-25 00:41:22.127	\N	\N	LINEAL	\N	\N	\N	\N	\N	\N	Agustin	2001-10-27 00:00:00	A+	tia Soledad	351-2968709	\N	\N	f	\N	42	L	XL	39	\N	SANCOR	\N
3	2	Denis Roger	Celiz	\N	20-36145011-7	\N	3513917181	Pje. Albert Sabin Lote 3 B° Las Acacias Complejo	\N	\N	\N	OTRO	0.00	0.00	ACTIVO	\N	\N	2026-08-25 00:41:22.14	2026-08-25 00:41:22.14	\N	\N	LINEAL	\N	\N	\N	\N	\N	\N	Fausto	1991-12-03 00:00:00	A+	Mamá Susana	3513923699	3	\N	f	\N	50	XL	XL	41	\N	ART	\N
4	2	Jonathan	Checa	\N	\N	\N	\N	\N	\N	\N	\N	OTRO	0.00	0.00	ACTIVO	\N	\N	2026-08-25 00:41:22.152	2026-08-25 00:41:22.152	\N	\N	LINEAL	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	f	\N	\N	L	\N	\N	\N	\N	\N
5	2	Mauricio	Destefanis	\N	20-44475677-3	\N	3516525371	Obispo Angeleli mza 18 lote 12	\N	\N	\N	OTRO	0.00	0.00	ACTIVO	\N	\N	2026-08-25 00:41:22.16	2026-08-25 00:41:22.16	\N	\N	LINEAL	\N	\N	\N	\N	\N	\N	Mauri	2002-09-05 00:00:00	0+	madre Ma. Celeste	3513504427	4	\N	f	\N	44	XL	XXL	43	\N	SANCOR	\N
6	2	Milton Jonathan	Diaz	\N	20-45832853-7	\N	351-8659700	Doroteo Robles 5244	\N	\N	\N	OTRO	0.00	0.00	ACTIVO	\N	\N	2026-08-25 00:41:22.171	2026-08-25 00:41:22.171	\N	\N	LINEAL	\N	\N	\N	\N	\N	\N	\N	2004-07-20 00:00:00	\N	madre Emilse	351-5133323	5	\N	f	\N	44	M	L	40	\N	SANCOR	\N
7	2	Nestor Ramon	Flores	\N	20-29841442-3	\N	3541-621850	Miguel de Vocos 50 B°Tillar Sta. Maria Punilla	\N	\N	\N	OTRO	0.00	0.00	ACTIVO	\N	\N	2026-08-25 00:41:22.187	2026-08-25 00:41:22.187	\N	\N	LINEAL	\N	\N	\N	\N	\N	\N	Nestor	1982-05-30 00:00:00	0+	esposa Laura	3541-685002	\N	\N	f	\N	44	L	L	39	\N	FEDERAL PATRONAL (AP)	\N
8	2	Matias	Flores	\N	\N	\N	\N	\N	\N	\N	\N	OTRO	0.00	0.00	ACTIVO	\N	\N	2026-08-25 00:41:22.201	2026-08-25 00:41:22.201	\N	\N	LINEAL	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	f	\N	48	XXL	XXL	\N	\N	\N	\N
9	2	Maldonado Roberto	Garcia	\N	20-32572934-2	\N	3515153712	Copacabana 485 B° San Martin	\N	\N	\N	OTRO	0.00	0.00	ACTIVO	\N	\N	2026-08-25 00:41:22.21	2026-08-25 00:41:22.21	\N	\N	LINEAL	\N	\N	\N	\N	\N	\N	Rober	1987-05-24 00:00:00	\N	Hna Leonela	3513118619	3	\N	f	\N	46	XL	XL	42	\N	ART	\N
10	2	Lorena	Herrera	\N	27-30474212-2	\N	351-6172390	Manzana 90 casa 3 B°16 de Noviembre	\N	\N	\N	OTRO	0.00	0.00	ACTIVO	\N	\N	2026-08-25 00:41:22.223	2026-08-25 00:41:22.223	\N	\N	LINEAL	\N	\N	\N	\N	\N	\N	Lore	1983-11-10 00:00:00	0+	hija Agostina	351-8087194	3	\N	f	\N	44	L	L	37	\N	ART	\N
11	2	Gerardo	Machado	\N	20-42473547-8	\N	351-7696816	Garcia de Sequeira 5715 B° Ferreyra	\N	\N	\N	OTRO	0.00	0.00	ACTIVO	\N	\N	2026-08-25 00:41:22.237	2026-08-25 00:41:22.237	\N	\N	LINEAL	\N	\N	\N	\N	\N	\N	\N	1986-01-04 00:00:00	\N	esposa Romina	351-5556660	3	\N	f	\N	48	XL	XXL	43	\N	SANCOR	\N
12	2	Gabriel	Mora	\N	\N	\N	\N	\N	\N	\N	\N	OTRO	0.00	0.00	ACTIVO	\N	\N	2026-08-25 00:41:22.252	2026-08-25 00:41:22.252	\N	\N	LINEAL	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	f	\N	\N	L	L	\N	\N	\N	\N
13	2	Ezequiel Leandro	Navarro	\N	20-39623762-9	\N	351-2096639	Mza 17 casa 3 B°Villa Boedo	\N	\N	\N	OTRO	0.00	0.00	ACTIVO	\N	\N	2026-08-25 00:41:22.266	2026-08-25 00:41:22.266	\N	\N	LINEAL	\N	\N	\N	\N	\N	\N	Leandro	1994-04-01 00:00:00	0+	madre Luisa	4500423	\N	\N	f	\N	50	XXXL	XXXL	41	\N	SANCOR	\N
14	2	Enzo	Ochoa	\N	\N	\N	\N	\N	\N	\N	\N	OTRO	0.00	0.00	ACTIVO	\N	\N	2026-08-25 00:41:22.28	2026-08-25 00:41:22.28	\N	\N	LINEAL	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	f	\N	48	XXL	XXL	45	\N	\N	\N
15	2	Cristina Andrea	Olivetto	\N	27-22793039-5	\N	3512213138	Los Talas 450 Comuna San Roque	\N	\N	\N	OTRO	0.00	0.00	ACTIVO	\N	\N	2026-08-25 00:41:22.295	2026-08-25 00:41:22.295	\N	\N	LINEAL	\N	\N	\N	\N	\N	\N	Andre	1972-09-21 00:00:00	A+	Hijo Ignacio	3516968711	3	\N	f	\N	44	L	L	37	\N	ART	\N
16	2	Patricio	Ortolanis	\N	\N	\N	\N	\N	\N	\N	\N	OTRO	0.00	0.00	ACTIVO	\N	\N	2026-08-25 00:41:22.308	2026-08-25 00:41:22.308	\N	\N	LINEAL	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	f	\N	46	XXL	XXL	\N	\N	\N	\N
17	2	Mayra	Ontivero	\N	\N	\N	\N	\N	\N	\N	\N	OTRO	0.00	0.00	ACTIVO	\N	\N	2026-08-25 00:41:22.323	2026-08-25 00:41:22.323	\N	\N	LINEAL	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	f	\N	S	XS	XS	\N	\N	\N	\N
18	2	Manuel	Rodriguez	\N	20-23194091-0	\N	3513625859	Luna y Cardenas 3344 B° Alto Alberdi	\N	\N	\N	OTRO	0.00	0.00	ACTIVO	\N	\N	2026-08-25 00:41:22.339	2026-08-25 00:41:22.339	\N	\N	LINEAL	\N	\N	\N	\N	\N	\N	Manolo	1973-01-07 00:00:00	\N	esposa Romina	3516619042	\N	\N	f	\N	50	XXL	XXL	42	\N	SANCOR	\N
19	2	Damian	Santillan	\N	20-36234439-6	\N	3515192452	De Los Catalanes 4248 B° Los Boulevares	\N	\N	\N	OTRO	0.00	0.00	ACTIVO	\N	\N	2026-08-25 00:41:22.352	2026-08-25 00:41:22.352	\N	\N	LINEAL	\N	\N	\N	\N	\N	\N	Pola	1992-04-12 00:00:00	\N	Papá Antonio	3515930162	3	\N	f	\N	46	XL	XL	41	\N	FEDERAL PATRONAL (AP)	\N
20	2	Fabrizio	Sosa	\N	\N	\N	\N	\N	\N	\N	\N	OTRO	0.00	0.00	ACTIVO	\N	\N	2026-08-25 00:41:22.361	2026-08-25 00:41:22.361	\N	\N	LINEAL	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	f	\N	42	L	L	38	\N	\N	\N
21	2	Antonio Javier	Velez	\N	20-34688648-0	\N	3516113507	Aviador Kingsley 2426	\N	\N	\N	OTRO	0.00	0.00	ACTIVO	\N	\N	2026-08-25 00:41:22.375	2026-08-25 00:41:22.375	\N	\N	LINEAL	\N	\N	\N	\N	\N	\N	Toni	1989-07-10 00:00:00	\N	Mamá Ana Maria	4667705	3	\N	f	\N	46	XL	XL	42	\N	ART	\N
22	2	Jazmin	Valdivia	\N	27-41993007-0	\N	351-5946637	Santa Rosa 2010	\N	\N	\N	OTRO	0.00	0.00	ACTIVO	\N	\N	2026-08-25 00:41:22.384	2026-08-25 00:41:22.384	\N	\N	LINEAL	\N	\N	\N	\N	\N	\N	Jaz	1999-06-08 00:00:00	A+	madre Gabriela	351-5121623	\N	\N	f	\N	42/44	S	M	38	\N	SANCOR	\N
23	2	Manuel	Valencia	\N	\N	\N	\N	\N	\N	\N	\N	OTRO	0.00	0.00	ACTIVO	\N	\N	2026-08-25 00:41:22.394	2026-08-25 00:41:22.394	\N	\N	LINEAL	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	f	\N	40	L	XL	\N	\N	\N	\N
24	2	Juan Matias	Vessoni	\N	20-28654907-2	\N	3517068675	Paso de Uspallata 1313 Dpto 1	\N	\N	\N	OTRO	0.00	0.00	ACTIVO	\N	\N	2026-08-25 00:41:22.404	2026-08-25 00:41:22.404	\N	\N	LINEAL	\N	\N	\N	\N	\N	\N	Furia	1979-08-20 00:00:00	A+	Esposa Cintia	3517586085	2	\N	f	\N	48	XXL	XXL	41	\N	ART	\N
\.


--
-- Data for Name: EmpleadoEmpresaSplit; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."EmpleadoEmpresaSplit" (id, empleado_id, empresa_id, porcentaje) FROM stdin;
1	17	1	32.00
2	17	2	68.00
\.


--
-- Data for Name: Empresa; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."Empresa" (id, nombre, nombre_corto, cuit, domicilio, logo_url, color_primario, activo, created_at, updated_at, color_secundario, email, logo_data, logo_mime, logo_nombre, moneda_default, razon_social, telefono, timezone, updated_by, web) FROM stdin;
1	Enjoy Producciones	Enjoy	\N	\N	\N	#1E3A5F	t	2026-08-24 17:53:40.985	2026-08-24 17:53:40.985	\N	\N	\N	\N	\N	ARS	\N	\N	America/Argentina/Buenos_Aires	\N	\N
2	DOS57 Estructuras	DOS57	\N	\N	\N	#065F46	t	2026-08-24 17:53:40.985	2026-08-24 17:53:40.985	\N	\N	\N	\N	\N	ARS	\N	\N	America/Argentina/Buenos_Aires	\N	\N
\.


--
-- Data for Name: EntregaUniforme; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."EntregaUniforme" (id, empresa_id, empleado_id, empleado_nombre, fecha_entrega, borcegos, remeras, camperon, chombas, campera, mochila, buzo, pantalon, bermuda, gorra, prot_lumbar, guantes, otros, origen_hoja, anio_resumen, created_at, created_by) FROM stdin;
\.


--
-- Data for Name: EscalafonAdmin; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."EscalafonAdmin" (id, empresa_id, nombre, orden, viatico, premio_presentismo, telefono, premio_incentivo, created_at, updated_at, deleted_at, created_by, premio_viaje_nacional, premio_viaje_nacional_1000, premio_viaje_provincial) FROM stdin;
1	2	ADM 1	1	87734.72	154806.63	43867.37	\N	2026-08-25 17:13:12.445	2026-08-25 17:13:12.445	\N	\N	\N	\N	\N
2	2	ADM 2	2	236219.85	127587.89	\N	67983.24	2026-08-25 17:13:12.45	2026-08-25 17:13:12.45	\N	\N	\N	\N	\N
3	2	ADM 3	3	106774.16	122484.36	\N	47455.17	2026-08-25 17:13:12.454	2026-08-25 17:13:12.454	\N	\N	\N	\N	\N
\.


--
-- Data for Name: EspacioCompartido; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."EspacioCompartido" (id, empresa_id, nombre, descripcion, direccion, activo, dia_generacion, created_at, updated_at, deleted_at) FROM stdin;
\.


--
-- Data for Name: Evento; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."Evento" (id, nombre, fecha_inicio, fecha_fin, estado, socios, moneda_base, created_at, updated_at, deleted_at, created_by, updated_by, empresa_id, dias_desmontaje, dias_montaje, es_informal, facturar, facturar_notas, lugar) FROM stdin;
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
-- Data for Name: EventoEmpleadoMes; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."EventoEmpleadoMes" (id, empresa_id, empleado_id, evento_id, evento_nombre, periodo_mes, periodo_anio, cobra_premio, monto_premio, created_at, created_by, cantidad_pax, dias_trabajados, premio_pax_total, valor_por_pax) FROM stdin;
\.


--
-- Data for Name: ExcedenteHoras; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."ExcedenteHoras" (id, empresa_id, empleado_id, periodo_mes, periodo_anio, horas_excedente, valor_hora, monto_total, pagado, fecha_pago, liquidacion_admin_id, created_at, updated_at, created_by) FROM stdin;
\.


--
-- Data for Name: Factura; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."Factura" (id, numero_factura, tipo_factura, fecha_emision, fecha_vencimiento, proveedor_id, evento_id, tab_numero, tipo_movimiento, importe_total, importe_pagado, importe_pendiente, moneda, condicion_pago, estado, notas, pdf_data, pdf_nombre, pdf_mime_type, pdf_tamanio, created_at, updated_at, deleted_at, created_by, updated_by, empresa_id, rubro_id, monto_ars, tasa_cambio, exento, iva_importe, neto_gravado, no_gravado, origen_import, pdf_nombre_afip, tiene_comprobante_fisico, tiene_pdf, tipo_comprobante) FROM stdin;
\.


--
-- Data for Name: FacturaEmitida; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."FacturaEmitida" (id, empresa_id, tipo_comprobante, punto_venta, numero, fecha_emision, cliente_nombre, cliente_cuit, condicion_cliente, neto_gravado, iva, otros_impuestos, total, moneda, tasa_cambio, total_ars, forma_pago, fecha_vencimiento, estado, evento_id, concepto, observaciones, pdf_data, pdf_nombre, pdf_mime_type, pdf_tamanio, created_at, updated_at, deleted_at, created_by, updated_by) FROM stdin;
\.


--
-- Data for Name: GastoMesEspacio; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."GastoMesEspacio" (id, espacio_id, periodo_mes, periodo_anio, generado_auto, cerrado, total_gastos, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: GastoPeaje; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."GastoPeaje" (id, camion_id, empresa_id, fecha, ruta, importe, evento_id, es_carga_telepase, saldo_telepase_post, notas, created_at, deleted_at, created_by) FROM stdin;
\.


--
-- Data for Name: GastoSiniestro; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."GastoSiniestro" (id, siniestro_id, fecha, descripcion, monto, cubierto_art, monto_cubierto, monto_empresa, comprobante_data, comprobante_nombre, created_at, created_by) FROM stdin;
\.


--
-- Data for Name: GastoTipoEspacio; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."GastoTipoEspacio" (id, espacio_id, nombre, monto_estimado, dia_vencimiento, activo, es_fijo, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: IndicadorEconomico; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."IndicadorEconomico" (id, tipo, valor, compra, venta, periodo, fuente_fecha, created_at) FROM stdin;
1	DOLAR_BLUE	1555.0000	1535.00	1555.00	\N	2026-10-07 14:58:00	2026-10-07 15:37:23.692
2	DOLAR_OFICIAL	1545.0000	1495.00	1545.00	\N	2026-10-07 12:00:00	2026-10-07 15:37:23.694
3	IPC	1.6600	\N	\N	2026-08	2026-08-01 00:00:00	2026-10-07 15:37:24.388
4	DOLAR_BLUE	1555.0000	1535.00	1555.00	\N	2026-10-07 15:58:00	2026-10-07 17:59:48.179
5	DOLAR_OFICIAL	1545.0000	1495.00	1545.00	\N	2026-10-07 13:00:00	2026-10-07 17:59:48.398
6	IPC	1.6600	\N	\N	2026-08	2026-08-01 00:00:00	2026-10-07 17:59:48.928
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
-- Data for Name: LineaGastoEspacio; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."LineaGastoEspacio" (id, gasto_mes_id, gasto_tipo_id, nombre, monto_real, fecha_vencimiento, estado, fecha_pago, comprobante_data, comprobante_nombre, comprobante_mime, notas, created_at, updated_at, deleted_at, created_by) FROM stdin;
\.


--
-- Data for Name: Liquidacion; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."Liquidacion" (id, empleado_id, empresa_id, evento_id, fecha_desde, fecha_hasta, horas_normales, horas_extras, valor_hora, valor_hora_extra, subtotal_horas, total_anticipos, total_descuentos, total_a_cobrar, estado, observaciones, movimiento_id, created_at, updated_at, aprobado_por, aprobado_at, tipo_liquidacion) FROM stdin;
\.


--
-- Data for Name: LiquidacionAdmin; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."LiquidacionAdmin" (id, empleado_id, empresa_id, acuerdo_id, periodo_mes, periodo_anio, sueldo_basico, horas_acordadas, escalafon, horas_trabajadas, horas_extras, valor_hora_extra, importe_horas_extras, premio_incentivo, viatico, premio_presentismo, antiguedad_anios, importe_antiguedad, telefono, vacaciones_aguinaldo, vales_descuentos, subtotal_bruto, total_a_cobrar, splits, estado, observaciones, created_at, updated_at, aprobado_por, aprobado_at, prestamos_descontados, horas_pendientes_anterior, horas_pendientes_nuevo, ipc_mes_referencia, ipc_valor_aplicado, porcentaje_aumento_aplicado, tipo_aumento, eventos_mes, premio_produccion_total, premio_viaje) FROM stdin;
\.


--
-- Data for Name: MaterialRental; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."MaterialRental" (id, empresa_id, origen, nro_item, codigo_oficial, detalle, medida, peso_por_unidad, costo_unitario_ars, costo_unitario_usd, tipo_cambio, porc_2, porc_4, porc_6, porc_8, porc_10, porc_full, activo, created_at, updated_at, created_by) FROM stdin;
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

COPY public."MovimientoCaja" (id, cuenta_id, fecha, descripcion, debe, haber, saldo_corriente, orden, created_at, updated_at, deleted_at, created_by, updated_by, transferencia_par_id, evento_id, moneda, monto_ars, tasa_cambio, liquidacion_admin_id, categoria_andrea, comprobante_data, comprobante_mime, comprobante_nombre, responsable_nombre, referencia) FROM stdin;
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
-- Data for Name: PagoPrestamoEmpleado; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."PagoPrestamoEmpleado" (id, prestamo_id, liquidacion_admin_id, monto, fecha, created_at) FROM stdin;
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
-- Data for Name: ParteEspacio; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."ParteEspacio" (id, espacio_id, nombre, porcentaje, empresa_id, cuenta_corriente_id) FROM stdin;
\.


--
-- Data for Name: PatenteVehiculo; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."PatenteVehiculo" (id, camion_id, empresa_id, tipo, anio, cuota, importe, fecha_vencimiento, fecha_pago, estado, comprobante_data, comprobante_nombre, comprobante_mime, notas, created_at, updated_at, deleted_at, created_by) FROM stdin;
\.


--
-- Data for Name: PedidoComida; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."PedidoComida" (id, evento_id, empresa_id, fecha, proveedor_id, proveedor_texto, forma_pago, notas, created_at, updated_at, deleted_at, created_by, updated_by) FROM stdin;
\.


--
-- Data for Name: PedidoItem; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."PedidoItem" (id, rubro_evento_id, cantidad, descripcion, dias_uso, horario_llegada, horario_retiro, observaciones, orden, created_at, updated_at, deleted_at, fecha_turno, hora_fin_turno, hora_inicio_turno, horas_por_agente, tipo_turno, total_horas_turno, ubicacion_turno) FROM stdin;
\.


--
-- Data for Name: PlanAFIP; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."PlanAFIP" (id, empresa_id, numero_plan, descripcion, fecha_inicio, capital_original, cantidad_cuotas, valor_cuota_aprox, interes_financiero, interes_resarcitorio, estado, notas, titular_nombre, titular_cuit, created_at, updated_at, deleted_at, created_by) FROM stdin;
\.


--
-- Data for Name: PreMacro; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."PreMacro" (id, empresa_id, paso_actual, completada, evento_id, nombre_evento, tipo_evento, descripcion, para_que_es, es_privado, fecha_inicio, fecha_fin, hora_inicio, hora_fin, lugar_nombre, lugar_ciudad, lugar_provincia, lugar_direccion, dias_montaje, dias_desmontaje, cliente_nombre, razon_social, cuit_pagador, quien_lo_hace, contacto_cliente, telefono_cliente, presupuesto_total, moneda, lleva_empleados, cantidad_estimada_staff, requiere_hospedaje, ciudad_hospedaje, requiere_traslado, notas_traslado, requiere_comidas, cantidad_dias_comida, observaciones_generales, rubros_sugeridos, rubros_confirmados, created_at, updated_at, deleted_at, created_by) FROM stdin;
\.


--
-- Data for Name: PrestamoBancario; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."PrestamoBancario" (id, empresa_id, entidad, numero_operacion, tipo, fecha_otorgamiento, capital_original, moneda, tasa_nominal_anual, tasa_efectiva_anual, cantidad_cuotas, dia_debito, estado, notas, created_at, updated_at, deleted_at, created_by) FROM stdin;
\.


--
-- Data for Name: PrestamoEmpleado; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."PrestamoEmpleado" (id, empleado_id, empresa_id, fecha, detalle, monto_total, cantidad_cuotas, cuotas_pagadas, monto_cuota, saldado, created_at, updated_at, deleted_at, created_by) FROM stdin;
1	17	2	2026-08-01 00:00:00	TEST curl verificacion	12000.00	1	0	12000.00	f	2026-08-26 01:56:17.043	2026-08-26 01:56:30.837	2026-08-26 01:56:30.836	6
\.


--
-- Data for Name: PresupuestoEvento; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."PresupuestoEvento" (id, empresa_id, evento_id, nombre, estado, porcentaje_alquiler, tipo_cambio_usd, notas, version, version_de_id, created_at, updated_at, deleted_at, created_by) FROM stdin;
\.


--
-- Data for Name: PresupuestoLinea; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."PresupuestoLinea" (id, presupuesto_id, material_id, cantidad, costo_unitario_snap, tipo_cambio_snap, porcentaje_snap, costo_total_material, valor_rental, orden, valor_rental_full) FROM stdin;
\.


--
-- Data for Name: Producto; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."Producto" (id, nombre, descripcion, codigo_interno, stock_total, stock_minimo, unidad, notas, activo, created_at, updated_at, deleted_at, created_by, updated_by, categoria_id, empresa_id, catalogo_origen, codigo_externo, es_critico, foto_data, foto_mime, foto_nombre, nombre_interno, nombre_tecnico, valor_unitario, peso_unitario, espacio, historial_stock, informe_situacion) FROM stdin;
\.


--
-- Data for Name: Proveedor; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."Proveedor" (id, nombre, alias, cuit, categoria, notas, activo, created_at, updated_at, deleted_at, created_by, updated_by, empresa_id, telefono, es_comisionista, porcentaje_comision, alias_bancario, banco, cbu, dni, email, numero_cuenta, puede_facturar, servicio, tipo_factura, titular_cuenta) FROM stdin;
\.


--
-- Data for Name: RegistroAsistencia; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."RegistroAsistencia" (id, empresa_id, empleado_id, fecha, estado, hora_ingreso, hora_egreso, horas_trabajadas, minutos_tardanza, motivo, descuenta_presentismo, jornada_id, origen, tardanza_requiere_aprobacion, tardanza_aprobada, tardanza_aprobada_por, tardanza_aprobada_at, tardanza_nota, created_at, updated_at, deleted_at, created_by) FROM stdin;
\.


--
-- Data for Name: RemitoEvento; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."RemitoEvento" (id, empresa_id, evento_id, tipo, numero, fecha, cliente, domicilio, localidad, telefono, chofer, chasis_acoplado, responsable_carga, items, estado, created_at, updated_at, created_by) FROM stdin;
\.


--
-- Data for Name: RepartoFacturaEmitida; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."RepartoFacturaEmitida" (id, factura_emitida_id, razon_social, cuit, porcentaje, monto, empresa_id) FROM stdin;
\.


--
-- Data for Name: RepartoLineaGasto; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."RepartoLineaGasto" (id, linea_id, parte_id, porcentaje, monto, movimiento_ccc_id) FROM stdin;
\.


--
-- Data for Name: ResponsableTC; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."ResponsableTC" (id, tarjeta_id, nombre, tipo, usuario_id, activo) FROM stdin;
\.


--
-- Data for Name: ResumenPresentismo; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."ResumenPresentismo" (id, empresa_id, empleado_id, periodo_mes, periodo_anio, dias_habiles, dias_presente, dias_tarde, dias_media_jornada, dias_ausente, dias_justificado, dias_libre, dias_vacaciones, total_horas, total_tardanzas_min, cobra_presentismo, motivo_sin_presentismo, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: Rubro; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."Rubro" (id, empresa_id, tipo, nombre, codigo, descripcion, orden, activo, es_sistema, created_at, updated_at, deleted_at, created_by, grupo) FROM stdin;
4	1	EGRESO	Vallas	\N	\N	4	t	t	2026-08-25 00:41:07.679	2026-08-25 17:13:11.709	\N	\N	\N
5	1	EGRESO	Sonido	\N	\N	5	t	t	2026-08-25 00:41:07.683	2026-08-25 17:13:11.713	\N	\N	\N
6	1	EGRESO	Luces	\N	\N	6	t	t	2026-08-25 00:41:07.688	2026-08-25 17:13:11.717	\N	\N	\N
7	1	EGRESO	Pantalla	\N	\N	7	t	t	2026-08-25 00:41:07.694	2026-08-25 17:13:11.721	\N	\N	\N
8	1	EGRESO	FX	\N	\N	8	t	t	2026-08-25 00:41:07.698	2026-08-25 17:13:11.725	\N	\N	\N
10	1	EGRESO	Baños químicos	\N	\N	10	t	t	2026-08-25 00:41:07.706	2026-08-25 17:13:11.733	\N	\N	\N
11	1	EGRESO	Contenedor Oficina	\N	\N	11	t	t	2026-08-25 00:41:07.711	2026-08-25 17:13:11.738	\N	\N	\N
12	1	EGRESO	Baños VIP	\N	\N	12	t	t	2026-08-25 00:41:07.716	2026-08-25 17:13:11.741	\N	\N	\N
13	1	EGRESO	Backline	\N	\N	13	t	t	2026-08-25 00:41:07.72	2026-08-25 17:13:11.743	\N	\N	\N
14	1	EGRESO	Mobiliario	\N	\N	14	t	t	2026-08-25 00:41:07.724	2026-08-25 17:13:11.746	\N	\N	\N
15	1	EGRESO	Catering	\N	\N	15	t	t	2026-08-25 00:41:07.729	2026-08-25 17:13:11.749	\N	\N	\N
16	1	EGRESO	Carpas	\N	\N	16	t	t	2026-08-25 00:41:07.737	2026-08-25 17:13:11.752	\N	\N	\N
17	1	EGRESO	Puesto de hidratación	\N	\N	17	t	t	2026-08-25 00:41:07.744	2026-08-25 17:13:11.755	\N	\N	\N
18	1	EGRESO	Seguridad privada	\N	\N	18	t	t	2026-08-25 00:41:07.754	2026-08-25 17:13:11.758	\N	\N	\N
19	1	EGRESO	Sereno	\N	\N	19	t	t	2026-08-25 00:41:07.76	2026-08-25 17:13:11.761	\N	\N	\N
20	1	EGRESO	Jefe de seguridad	\N	\N	20	t	t	2026-08-25 00:41:07.767	2026-08-25 17:13:11.764	\N	\N	\N
21	1	EGRESO	Generador	\N	\N	21	t	t	2026-08-25 00:41:07.775	2026-08-25 17:13:11.768	\N	\N	\N
22	1	EGRESO	Distribución de energía	\N	\N	22	t	t	2026-08-25 00:41:07.782	2026-08-25 17:13:11.771	\N	\N	\N
23	1	EGRESO	Camiones/Logística	\N	\N	23	t	t	2026-08-25 00:41:07.791	2026-08-25 17:13:11.774	\N	\N	\N
24	1	EGRESO	Transportación	\N	\N	24	t	t	2026-08-25 00:41:07.799	2026-08-25 17:13:11.776	\N	\N	\N
25	1	EGRESO	Sillas plásticas	\N	\N	25	t	t	2026-08-25 00:41:07.805	2026-08-25 17:13:11.779	\N	\N	\N
27	1	EGRESO	Cámaras de seguridad	\N	\N	27	t	t	2026-08-25 00:41:07.817	2026-08-25 17:13:11.786	\N	\N	\N
28	1	EGRESO	Conectividad Starlink	\N	\N	28	t	t	2026-08-25 00:41:07.825	2026-08-25 17:13:11.791	\N	\N	\N
29	1	EGRESO	Equipo Audiovisual	\N	\N	29	t	t	2026-08-25 00:41:07.832	2026-08-25 17:13:11.794	\N	\N	\N
30	1	EGRESO	Drone	\N	\N	30	t	t	2026-08-25 00:41:07.84	2026-08-25 17:13:11.797	\N	\N	\N
31	1	EGRESO	Viandas	\N	\N	31	t	t	2026-08-25 00:41:07.848	2026-08-25 17:13:11.8	\N	\N	\N
32	1	EGRESO	Hielo	\N	\N	32	t	t	2026-08-25 00:41:07.858	2026-08-25 17:13:11.803	\N	\N	\N
33	1	EGRESO	Dispenser con bidones	\N	\N	33	t	t	2026-08-25 00:41:07.869	2026-08-25 17:13:11.807	\N	\N	\N
34	1	EGRESO	Agua para contrapeso	\N	\N	34	t	t	2026-08-25 00:41:07.878	2026-08-25 17:13:11.81	\N	\N	\N
35	1	EGRESO	Ambulancias	\N	\N	35	t	t	2026-08-25 00:41:07.887	2026-08-25 17:13:11.816	\N	\N	\N
36	1	EGRESO	Barras	\N	\N	36	t	t	2026-08-25 00:41:07.896	2026-08-25 17:13:11.822	\N	\N	\N
37	1	EGRESO	Tablones con bancos	\N	\N	37	t	t	2026-08-25 00:41:07.903	2026-08-25 17:13:11.831	\N	\N	\N
38	1	EGRESO	Inflables	\N	\N	38	t	t	2026-08-25 00:41:07.909	2026-08-25 17:13:11.842	\N	\N	\N
39	1	EGRESO	Beduinas	\N	\N	39	t	t	2026-08-25 00:41:07.914	2026-08-25 17:13:11.85	\N	\N	\N
40	1	EGRESO	Colectivo	\N	\N	40	t	t	2026-08-25 00:41:07.918	2026-08-25 17:13:11.858	\N	\N	\N
41	1	EGRESO	Puesto Sanitario	\N	\N	41	t	t	2026-08-25 00:41:07.926	2026-08-25 17:13:11.866	\N	\N	\N
42	1	EGRESO	Ambientación	\N	\N	42	t	t	2026-08-25 00:41:07.931	2026-08-25 17:13:11.871	\N	\N	\N
43	1	EGRESO	Hotelería Party A	\N	\N	43	t	t	2026-08-25 00:41:07.935	2026-08-25 17:13:11.876	\N	\N	\N
44	1	EGRESO	Hotelería Party B	\N	\N	44	t	t	2026-08-25 00:41:07.939	2026-08-25 17:13:11.881	\N	\N	\N
45	1	EGRESO	Hotelería Party C	\N	\N	45	t	t	2026-08-25 00:41:07.944	2026-08-25 17:13:11.886	\N	\N	\N
46	1	EGRESO	Zamping	\N	\N	46	t	t	2026-08-25 00:41:07.95	2026-08-25 17:13:11.893	\N	\N	\N
47	1	EGRESO	Ticketera	\N	\N	47	t	t	2026-08-25 00:41:07.957	2026-08-25 17:13:11.898	\N	\N	\N
48	1	EGRESO	Limpieza en evento	\N	\N	48	t	t	2026-08-25 00:41:07.964	2026-08-25 17:13:11.902	\N	\N	\N
49	1	EGRESO	Limpieza pre y post	\N	\N	49	t	t	2026-08-25 00:41:07.97	2026-08-25 17:13:11.907	\N	\N	\N
50	1	EGRESO	Limpieza baños químicos	\N	\N	50	t	t	2026-08-25 00:41:07.977	2026-08-25 17:13:11.913	\N	\N	\N
52	1	EGRESO	Seguro RC	\N	\N	52	t	t	2026-08-25 00:41:07.985	2026-08-25 17:13:11.925	\N	\N	\N
53	1	EGRESO	Panelería	\N	\N	53	t	t	2026-08-25 00:41:07.994	2026-08-25 17:13:11.931	\N	\N	\N
54	1	EGRESO	Personal de cargas	\N	\N	54	t	t	2026-08-25 00:41:07.999	2026-08-25 17:13:11.938	\N	\N	\N
55	1	EGRESO	Personal de boletería	\N	\N	55	t	t	2026-08-25 00:41:08.003	2026-08-25 17:13:11.945	\N	\N	\N
56	1	EGRESO	Personal acomodadores	\N	\N	56	t	t	2026-08-25 00:41:08.009	2026-08-25 17:13:11.948	\N	\N	\N
57	1	EGRESO	Personal estacionamiento	\N	\N	57	t	t	2026-08-25 00:41:08.013	2026-08-25 17:13:11.952	\N	\N	\N
58	1	EGRESO	Policía	\N	\N	58	t	t	2026-08-25 00:41:08.018	2026-08-25 17:13:11.958	\N	\N	\N
59	1	EGRESO	Adicionales de policía	\N	\N	59	t	t	2026-08-25 00:41:08.026	2026-08-25 17:13:11.965	\N	\N	\N
60	1	EGRESO	Riggers	\N	\N	60	t	t	2026-08-25 00:41:08.032	2026-08-25 17:13:11.974	\N	\N	\N
61	1	EGRESO	Entelado/Aforo	\N	\N	61	t	t	2026-08-25 00:41:08.038	2026-08-25 17:13:11.98	\N	\N	\N
62	1	EGRESO	Op. Sonido	\N	\N	62	t	t	2026-08-25 00:41:08.046	2026-08-25 17:13:11.985	\N	\N	\N
63	1	EGRESO	Op. Luces	\N	\N	63	t	t	2026-08-25 00:41:08.055	2026-08-25 17:13:11.989	\N	\N	\N
64	1	EGRESO	Op. Pantalla	\N	\N	64	t	t	2026-08-25 00:41:08.062	2026-08-25 17:13:11.994	\N	\N	\N
65	1	EGRESO	DJ	\N	\N	65	t	t	2026-08-25 00:41:08.068	2026-08-25 17:13:11.999	\N	\N	\N
66	1	EGRESO	Host de redes	\N	\N	66	t	t	2026-08-25 00:41:08.078	2026-08-25 17:13:12.005	\N	\N	\N
67	1	EGRESO	Choferes	\N	\N	67	t	t	2026-08-25 00:41:08.087	2026-08-25 17:13:12.014	\N	\N	\N
68	1	EGRESO	Branding/Imprenta	\N	\N	68	t	t	2026-08-25 00:41:08.098	2026-08-25 17:13:12.024	\N	\N	\N
69	1	EGRESO	Pañolero	\N	\N	69	t	t	2026-08-25 00:41:08.109	2026-08-25 17:13:12.033	\N	\N	\N
70	1	EGRESO	Publicidad Vía pública	\N	\N	70	t	t	2026-08-25 00:41:08.121	2026-08-25 17:13:12.039	\N	\N	\N
71	1	EGRESO	Activaciones/Juegos	\N	\N	71	t	t	2026-08-25 00:41:08.136	2026-08-25 17:13:12.047	\N	\N	\N
72	1	EGRESO	Promotoras	\N	\N	72	t	t	2026-08-25 00:41:08.148	2026-08-25 17:13:12.053	\N	\N	\N
73	1	EGRESO	Túnel / Tubos led	\N	\N	73	t	t	2026-08-25 00:41:08.16	2026-08-25 17:13:12.06	\N	\N	\N
74	1	EGRESO	Laser	\N	\N	74	t	t	2026-08-25 00:41:08.168	2026-08-25 17:13:12.066	\N	\N	\N
75	1	EGRESO	Fuegos Artificiales	\N	\N	75	t	t	2026-08-25 00:41:08.181	2026-08-25 17:13:12.074	\N	\N	\N
77	1	EGRESO	Rescatistas	\N	\N	77	t	t	2026-08-25 00:41:08.2	2026-08-25 17:13:12.087	\N	\N	\N
78	1	EGRESO	Domo	\N	\N	78	t	t	2026-08-25 00:41:08.211	2026-08-25 17:13:12.094	\N	\N	\N
79	1	EGRESO	Chinitos/Calefactores	\N	\N	79	t	t	2026-08-25 00:41:08.221	2026-08-25 17:13:12.102	\N	\N	\N
80	1	EGRESO	Climatización de carpas	\N	\N	80	t	t	2026-08-25 00:41:08.233	2026-08-25 17:13:12.108	\N	\N	\N
81	1	EGRESO	Mapping	\N	\N	81	t	t	2026-08-25 00:41:08.242	2026-08-25 17:13:12.112	\N	\N	\N
82	1	EGRESO	Amidas	\N	\N	82	t	t	2026-08-25 00:41:08.246	2026-08-25 17:13:12.117	\N	\N	\N
83	1	EGRESO	Camión de caudales	\N	\N	83	t	t	2026-08-25 00:41:08.254	2026-08-25 17:13:12.121	\N	\N	\N
84	1	EGRESO	Handyeman	\N	\N	84	t	t	2026-08-25 00:41:08.264	2026-08-25 17:13:12.124	\N	\N	\N
85	1	EGRESO	RRHH	RRHH	\N	85	t	t	2026-08-25 00:41:08.27	2026-08-25 17:13:12.127	\N	\N	\N
86	1	EGRESO	Impuestos	EG-IMP	\N	86	t	t	2026-08-25 00:41:08.277	2026-08-25 17:13:12.132	\N	\N	\N
87	1	EGRESO	Gastos Extraordinarios	EG-EXTRA	\N	87	t	t	2026-08-25 00:41:08.283	2026-08-25 17:13:12.137	\N	\N	\N
88	1	INGRESO	Tickets	\N	\N	1	t	t	2026-08-25 00:41:08.292	2026-08-25 17:13:12.141	\N	\N	\N
89	1	INGRESO	Sponsors	\N	\N	2	t	t	2026-08-25 00:41:08.302	2026-08-25 17:13:12.145	\N	\N	\N
90	1	INGRESO	Corporativo	\N	\N	3	t	t	2026-08-25 00:41:08.311	2026-08-25 17:13:12.149	\N	\N	\N
91	1	INGRESO	Gastronomía	\N	\N	4	t	t	2026-08-25 00:41:08.321	2026-08-25 17:13:12.154	\N	\N	\N
2	1	EGRESO	Estructuras	\N	\N	2	t	t	2026-08-25 00:41:07.669	2026-08-25 17:13:11.702	\N	\N	\N
3	1	EGRESO	Cerramiento	\N	\N	3	t	t	2026-08-25 00:41:07.674	2026-08-25 17:13:11.706	\N	\N	\N
1	1	EGRESO	Directorio	\N	\N	1	t	t	2026-08-25 00:41:07.66	2026-08-25 17:13:11.696	\N	\N	\N
9	1	EGRESO	CCTV	\N	\N	9	t	t	2026-08-25 00:41:07.702	2026-08-25 17:13:11.729	\N	\N	\N
26	1	EGRESO	Conectividad distribución	\N	\N	26	t	t	2026-08-25 00:41:07.812	2026-08-25 17:13:11.782	\N	\N	\N
51	1	EGRESO	Desagote baños químicos	\N	\N	51	t	t	2026-08-25 00:41:07.981	2026-08-25 17:13:11.921	\N	\N	\N
76	1	EGRESO	Transmisión/Streaming	\N	\N	76	t	t	2026-08-25 00:41:08.191	2026-08-25 17:13:12.08	\N	\N	\N
92	1	INGRESO	Service Charge	\N	\N	5	t	t	2026-08-25 00:41:08.33	2026-08-25 17:13:12.157	\N	\N	\N
93	2	EGRESO	Layher	LAYHER	\N	1	t	t	2026-08-25 00:41:08.335	2026-08-25 17:13:12.161	\N	\N	\N
94	2	EGRESO	Vallado	VALLADO	\N	2	t	t	2026-08-25 00:41:08.343	2026-08-25 17:13:12.165	\N	\N	\N
95	2	EGRESO	Varios	VARIOS	Aforo, Sillas, Tablones	3	t	t	2026-08-25 00:41:08.35	2026-08-25 17:13:12.169	\N	\N	\N
96	2	EGRESO	RRHH	RRHH	\N	4	t	t	2026-08-25 00:41:08.372	2026-08-25 17:13:12.174	\N	\N	\N
97	2	EGRESO	Impuestos	EG-IMP	\N	5	t	t	2026-08-25 00:41:08.385	2026-08-25 17:13:12.177	\N	\N	\N
98	2	INGRESO	Alquiler de Estructuras	\N	\N	1	t	t	2026-08-25 00:41:08.397	2026-08-25 17:13:12.181	\N	\N	\N
99	2	INGRESO	Mano de Obra	\N	\N	2	t	t	2026-08-25 00:41:08.406	2026-08-25 17:13:12.184	\N	\N	\N
100	2	INGRESO	Transporte	\N	\N	3	t	t	2026-08-25 00:41:08.412	2026-08-25 17:13:12.188	\N	\N	\N
101	2	INGRESO	Otros Ingresos	\N	\N	4	t	t	2026-08-25 00:41:08.418	2026-08-25 17:13:12.191	\N	\N	\N
\.


--
-- Data for Name: RubroEvento; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."RubroEvento" (id, evento_id, rubro_id, empresa_id, proveedor_id, estado, contacto_nombre, contacto_telefono, contacto_cargo, coordina_nombre, fecha_ingreso, fecha_retiro, presupuesto, moneda, notas, created_at, updated_at, deleted_at, created_by, updated_by, cantidad_proveedor, cantidad_stock, usa_stock_propio) FROM stdin;
\.


--
-- Data for Name: SGR; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."SGR" (id, empresa_id, nombre, estado_vinculacion, fecha_vinculacion, fecha_vencimiento, cupo_total, cupo_utilizado, cupo_disponible, moneda, contacto_nombre, contacto_tel, notas, created_at, updated_at, deleted_at) FROM stdin;
\.


--
-- Data for Name: SeguroVehiculo; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."SeguroVehiculo" (id, camion_id, empresa_id, aseguradora, numero_poliza, tipo_cobertura, fecha_inicio, fecha_vencimiento, importe_anual, moneda, estado, documento_data, documento_nombre, documento_mime, notas, created_at, updated_at, deleted_at, created_by) FROM stdin;
3	6	2	Experta	\N	\N	2025-09-07 00:00:00	2026-09-07 00:00:00	\N	ARS	VENCIDO	\N	\N	\N	Importado desde la pizarra física de DOS57	2026-10-07 15:39:43.936	2026-10-07 18:16:32.717	\N	1
4	7	2	Experta	\N	\N	2025-09-30 00:00:00	2026-09-30 00:00:00	\N	ARS	VENCIDO	\N	\N	\N	Importado desde la pizarra física de DOS57	2026-10-07 15:39:43.947	2026-10-07 18:16:32.717	\N	1
10	13	2	Rivadavia	\N	\N	2025-09-07 00:00:00	2026-09-07 00:00:00	\N	ARS	VENCIDO	\N	\N	\N	Importado desde la pizarra física de DOS57	2026-10-07 15:39:44.069	2026-10-07 18:16:32.717	\N	1
11	14	2	Rivadavia	\N	\N	2025-10-02 00:00:00	2026-10-02 00:00:00	\N	ARS	VENCIDO	\N	\N	\N	Importado desde la pizarra física de DOS57	2026-10-07 15:39:44.089	2026-10-07 18:16:32.717	\N	1
12	15	2	Rivadavia	\N	\N	2025-10-02 00:00:00	2026-10-02 00:00:00	\N	ARS	VENCIDO	\N	\N	\N	Importado desde la pizarra física de DOS57	2026-10-07 15:39:44.114	2026-10-07 18:16:32.717	\N	1
1	4	2	Fed.Patronal	\N	\N	2025-12-12 00:00:00	2026-12-12 00:00:00	\N	ARS	VIGENTE	\N	\N	\N	Importado desde la pizarra física de DOS57	2026-10-07 15:39:43.909	2026-10-07 18:16:32.748	\N	1
2	5	2	Experta	\N	\N	2025-11-27 00:00:00	2026-11-27 00:00:00	\N	ARS	VIGENTE	\N	\N	\N	Importado desde la pizarra física de DOS57	2026-10-07 15:39:43.923	2026-10-07 18:16:32.748	\N	1
5	8	2	Experta	\N	\N	2025-11-27 00:00:00	2026-11-27 00:00:00	\N	ARS	VIGENTE	\N	\N	\N	Importado desde la pizarra física de DOS57	2026-10-07 15:39:43.957	2026-10-07 18:16:32.748	\N	1
6	9	2	Experta	\N	\N	2025-11-27 00:00:00	2026-11-27 00:00:00	\N	ARS	VIGENTE	\N	\N	\N	Importado desde la pizarra física de DOS57	2026-10-07 15:39:43.974	2026-10-07 18:16:32.748	\N	1
7	10	2	San Cristobal	\N	\N	2026-08-12 00:00:00	2027-08-12 00:00:00	\N	ARS	VIGENTE	\N	\N	\N	Importado desde la pizarra física de DOS57	2026-10-07 15:39:43.995	2026-10-07 18:16:32.748	\N	1
8	11	2	Experta	\N	\N	2025-11-27 00:00:00	2026-11-27 00:00:00	\N	ARS	VIGENTE	\N	\N	\N	Importado desde la pizarra física de DOS57	2026-10-07 15:39:44.019	2026-10-07 18:16:32.748	\N	1
9	12	2	San Cristobal	\N	\N	2026-07-16 00:00:00	2027-07-16 00:00:00	\N	ARS	VIGENTE	\N	\N	\N	Importado desde la pizarra física de DOS57	2026-10-07 15:39:44.043	2026-10-07 18:16:32.748	\N	1
13	16	2	Allianz	\N	\N	2026-07-31 00:00:00	2027-07-31 00:00:00	\N	ARS	VIGENTE	\N	\N	\N	Importado desde la pizarra física de DOS57	2026-10-07 15:39:44.136	2026-10-07 18:16:32.748	\N	1
14	17	2	Experta	\N	\N	2025-11-27 00:00:00	2026-11-27 00:00:00	\N	ARS	VIGENTE	\N	\N	\N	Importado desde la pizarra física de DOS57	2026-10-07 15:39:44.146	2026-10-07 18:16:32.748	\N	1
15	18	2	San Cristobal	\N	\N	2025-11-30 00:00:00	2026-11-30 00:00:00	\N	ARS	VIGENTE	\N	\N	\N	Importado desde la pizarra física de DOS57	2026-10-07 15:39:44.159	2026-10-07 18:16:32.748	\N	1
16	19	2	Experta	\N	\N	2025-11-27 00:00:00	2026-11-27 00:00:00	\N	ARS	VIGENTE	\N	\N	\N	Importado desde la pizarra física de DOS57	2026-10-07 15:39:44.177	2026-10-07 18:16:32.748	\N	1
17	20	2	Experta	\N	\N	2025-11-27 00:00:00	2026-11-27 00:00:00	\N	ARS	VIGENTE	\N	\N	\N	Importado desde la pizarra física de DOS57	2026-10-07 15:39:44.187	2026-10-07 18:16:32.748	\N	1
18	21	2	San Cristobal	\N	\N	2025-12-04 00:00:00	2026-12-04 00:00:00	\N	ARS	VIGENTE	\N	\N	\N	Importado desde la pizarra física de DOS57	2026-10-07 15:39:44.202	2026-10-07 18:16:32.748	\N	1
19	22	2	San Cristobal	\N	\N	2025-12-01 00:00:00	2026-12-01 00:00:00	\N	ARS	VIGENTE	\N	\N	\N	Importado desde la pizarra física de DOS57	2026-10-07 15:39:44.211	2026-10-07 18:16:32.748	\N	1
20	24	2	Sancor	\N	\N	2026-02-16 00:00:00	2027-02-16 00:00:00	\N	ARS	VIGENTE	\N	\N	\N	Importado desde la pizarra física de DOS57	2026-10-07 15:39:44.236	2026-10-07 18:16:32.748	\N	1
21	13	2	Experta	\N	\N	2025-09-07 00:00:00	2026-09-07 00:00:00	\N	ARS	VENCIDO	\N	\N	\N	Importado desde la planilla de flota (pizarra) de DOS57	2026-10-07 18:25:06.196	2026-10-07 18:25:06.196	\N	4
22	14	2	Experta	\N	\N	2025-09-30 00:00:00	2026-09-30 00:00:00	\N	ARS	VENCIDO	\N	\N	\N	Importado desde la planilla de flota (pizarra) de DOS57	2026-10-07 18:25:06.218	2026-10-07 18:25:06.218	\N	4
23	10	2	San Cristobal	\N	\N	2027-08-12 00:00:00	2028-08-12 00:00:00	\N	ARS	VIGENTE	\N	\N	\N	Importado desde la planilla de flota (pizarra) de DOS57	2026-10-07 18:25:06.258	2026-10-07 18:25:06.258	\N	4
\.


--
-- Data for Name: ServicioTaller; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."ServicioTaller" (id, camion_id, empresa_id, taller_nombre, tipo, descripcion, fecha_ingreso, fecha_estimada, fecha_retiro, estado, presupuesto, importe_final, saldo_pendiente, cuenta_corriente_id, notas, created_at, updated_at, deleted_at, created_by) FROM stdin;
\.


--
-- Data for Name: SiniestroEmpleado; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."SiniestroEmpleado" (id, empresa_id, empleado_id, tipo, fecha_ocurrencia, descripcion, lugar, evento_id, art_nombre, art_numero_siniestro, fecha_denuncia_art, estado, dias_baja, fecha_alta_medica, created_at, updated_at, deleted_at, created_by, condicion_laboral, diagnostico, empleado_nombre_manual, plan_accion, zona_afectada, zona_riesgo) FROM stdin;
\.


--
-- Data for Name: SiniestroVehiculo; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."SiniestroVehiculo" (id, empresa_id, camion_id, patente_texto, empleado_id, empleado_nombre_manual, aseguradora, numero_siniestro, fecha_denuncia, fecha_ocurrencia, lugar, descripcion, danios, tercero_nombre, tercero_vehiculo, tercero_seguro, estado, observaciones, created_at, updated_at, deleted_at, created_by) FROM stdin;
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
-- Data for Name: TarjetaCorporativa; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."TarjetaCorporativa" (id, empresa_id, nombre, banco, moneda_base, activa, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: Usuario; Type: TABLE DATA; Schema: public; Owner: admin_portal
--

COPY public."Usuario" (id, email, nombre, password_hash, rol, activo, created_at, updated_at, deleted_at, empresa_id, apodo, telefono, areas_macro, puede_ver_macro, home_route) FROM stdin;
4	veckisalerno.dos57@gmail.com	Verónica Salerno (Veck)	$2a$10$RuWLEmE05WbgvbXDQAzNUeHOVIQezQZWzXuNI8FJ5MQ0S177fFpXO	ADMIN	t	2026-08-25 00:41:08.686	2026-08-25 17:13:12.34	\N	2	\N	351 259-6633	{}	f	\N
5	administracion@grupodos57.com.ar	Andrea Olivetto (Andre)	$2a$10$RuWLEmE05WbgvbXDQAzNUeHOVIQezQZWzXuNI8FJ5MQ0S177fFpXO	ADMIN	t	2026-08-25 00:41:08.698	2026-08-25 17:13:12.347	\N	2	\N	351 221-3138	{}	f	\N
6	mayra.dos57@gmail.com	Mayra Ontivero	$2a$10$RuWLEmE05WbgvbXDQAzNUeHOVIQezQZWzXuNI8FJ5MQ0S177fFpXO	ADMIN	t	2026-08-25 00:41:08.713	2026-08-25 17:13:12.358	\N	2	\N	351 706-2733	{FINANZAS,ADMIN,RRHH,STOCK}	t	\N
7	jazminvaldivia.dos57@gmail.com	Jazmín Valdivia (Jaz)	$2a$10$RuWLEmE05WbgvbXDQAzNUeHOVIQezQZWzXuNI8FJ5MQ0S177fFpXO	OPERADOR	t	2026-08-25 00:41:08.742	2026-08-25 17:13:12.366	\N	2	\N	351 594-6637	{}	f	\N
8	christianxinos@gmail.com	Christian Xinos (Chino)	$2a$10$RuWLEmE05WbgvbXDQAzNUeHOVIQezQZWzXuNI8FJ5MQ0S177fFpXO	ADMIN	t	2026-08-25 00:41:08.76	2026-08-25 17:13:12.381	\N	1	\N	351 800-5952	{}	f	\N
9	envios.enjoyproducciones@gmail.com	Malena Perez Estevez	$2a$10$RuWLEmE05WbgvbXDQAzNUeHOVIQezQZWzXuNI8FJ5MQ0S177fFpXO	ADMIN	t	2026-08-25 00:41:08.785	2026-08-25 17:13:12.392	\N	1	\N	351 386-3241	{}	f	\N
10	victoriaalmada@gmail.com	Victoria Almada	$2a$10$RuWLEmE05WbgvbXDQAzNUeHOVIQezQZWzXuNI8FJ5MQ0S177fFpXO	OPERADOR	t	2026-08-25 00:41:08.808	2026-08-25 17:13:12.41	\N	1	\N	351 208-1470	{}	f	\N
11	danielyanello93@gmail.com	Daniel Yanello	$2a$10$RuWLEmE05WbgvbXDQAzNUeHOVIQezQZWzXuNI8FJ5MQ0S177fFpXO	OPERADOR	t	2026-08-25 00:41:08.827	2026-08-25 17:13:12.424	\N	1	\N	351 398-0601	{}	f	\N
1	admin@adminportal.com	Administrador	$2a$10$MicbbpZ48fRfVAcggOLYXO1V6./mV5CEiuM1j6gWOOHe0IDQGt9dS	ADMIN	t	2026-08-25 00:41:08.546	2026-08-25 17:13:12.264	\N	\N	\N	\N	\N	f	\N
2	matiaslorenzati@gmail.com	Matías Lorenzati	$2a$10$RuWLEmE05WbgvbXDQAzNUeHOVIQezQZWzXuNI8FJ5MQ0S177fFpXO	ADMIN	t	2026-08-25 00:41:08.652	2026-08-25 17:13:12.326	\N	\N	\N	\N	{}	f	\N
3	pollobibiloni@gmail.com	Sergio Bibiloni (Pollo)	$2a$10$RuWLEmE05WbgvbXDQAzNUeHOVIQezQZWzXuNI8FJ5MQ0S177fFpXO	ADMIN	t	2026-08-25 00:41:08.66	2026-08-25 17:13:12.332	\N	2	\N	351 295-6442	{}	f	\N
45	admin@demo.com	Administrador	$2a$10$yzA/LYD1miGQpVduXkw.yO.f0p49c24mKGignKvf2i8.uj9adtYO2	ADMIN	t	2026-05-28 18:36:53.552	2026-05-28 18:36:53.552	\N	\N	\N	\N	\N	f	\N
46	operador@demo.com	Laura Gómez	$2a$10$ZOJdTA7S1Ad.RPgsMznwXOOxniVkAiv3.KEBq0S8kZMCgyoj0Bxx6	OPERADOR	t	2026-05-28 22:46:37.008	2026-05-28 22:46:37.008	\N	\N	\N	\N	\N	f	\N
47	viewer@demo.com	Martín Sosa	$2a$10$ZOJdTA7S1Ad.RPgsMznwXOOxniVkAiv3.KEBq0S8kZMCgyoj0Bxx6	VIEWER	t	2026-05-28 22:46:37.043	2026-05-28 22:46:37.043	\N	\N	\N	\N	\N	f	\N
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
8c5331d9-e86b-4428-b46d-82c035c6d918	82264677f01a982ea1cc30e6bbd547b5ef172ecfe45ebec65d76d2342197bf32	2026-08-25 14:09:31.609465+00	20260825110922_sueldos_administrativos	\N	\N	2026-08-25 14:09:31.497861+00	1
ebfdc73e-65bc-4d31-b4e5-2b510fa9c328	777dfb9d78a30c4408dc2d9a7712c4180dbd3e54b87d8d5579278b86b2d46dd1	2026-08-25 17:12:35.237291+00	20260825141228_escalafon_admin_prestamos	\N	\N	2026-08-25 17:12:35.139919+00	1
c7a1c36a-77c3-4122-9fd5-6f169d76389c	ee27e7bf8a8d278d23a75e414bdd250455619b34c5f658a25b55ec173e39e396	2026-08-26 00:47:11.050012+00	20260825214702_acuerdo_sueldo_deleted_at	\N	\N	2026-08-26 00:47:11.032207+00	1
f8188c04-6a01-4377-b724-f98cab44c9da	3584761574ef5d91bc4532ed8389aeba96ecef99e900fc7eb482a3125e64cfe4	2026-10-07 12:11:53.220445+00	20260826114446_flota_seguros_patentes_peajes_taller	\N	\N	2026-10-07 12:11:53.07877+00	1
28a3b30c-b647-4c18-95e1-c3ba089c4c5c	0e542d79786d61de8e18402f28a5d56bd5969c230e21c3753d0d830ae8e9b0cf	2026-10-07 12:11:54.758083+00	20260922003525_proveedor_datos_formulario	\N	\N	2026-10-07 12:11:54.74733+00	1
1af2657f-8d16-4b7f-a9ec-d0e931dd8e52	0d21b746c2f46c2de9be5bfdffbcea3b5cf2f175ed26c2b5daa8059033f41e52	2026-10-07 12:11:53.38238+00	20260827134415_afip_prestamos_bancarios	\N	\N	2026-10-07 12:11:53.24621+00	1
802c6f3f-67c4-4baf-beb7-9ad6c0de70e9	eb43d30f2e9f5c4d2b2eb586c8755ab97a4f50ec145526303a90b49b11af6cf2	2026-10-07 12:11:54.088044+00	20260912000000_combustible_orden_ledger	\N	\N	2026-10-07 12:11:54.069178+00	1
52a18f35-0dc4-4deb-b428-d25b2a654764	a7863f131758aa5d7eff392476dfca6de85003b077cc44403e8d5bdcc2c63961	2026-10-07 12:11:53.488607+00	20260827223528_facturacion_emitida_clientes	\N	\N	2026-10-07 12:11:53.398401+00	1
28662877-bc2c-4c90-8cd3-48e340156281	f382bd5fa36eeaf2fbfb3cc3491c5717dee1a5e12a7549741f713acf6e534fb5	2026-10-07 12:11:53.51929+00	20260831182144_evento_informal_facturar	\N	\N	2026-10-07 12:11:53.504132+00	1
2495e2b1-1916-4b6a-bee5-b67af3bdfb9a	6a68230e4de9cecabef9266ac6dacb99991b95cbaa21318cefa3c5f18064e3fe	2026-10-07 12:11:54.457364+00	20260918211847_espacio_compartido_unique_nombre	\N	\N	2026-10-07 12:11:54.439999+00	1
5d5d3403-0f2a-4897-9084-734a43896868	3f2cb1600acd843a8cd9406f7ec97fe954a4373931613991ff4cf1e7fc41c2c4	2026-10-07 12:11:53.568553+00	20260901011449_bitacora_viajes_chofer	\N	\N	2026-10-07 12:11:53.530719+00	1
8516cb29-7e37-4d91-ace3-17755e39c89f	22326d8a064ad530a1d177e50858a83bfae7fa00ed7d8ad45b557d222ca686bb	2026-10-07 12:11:54.21485+00	20260913021726_gastos_operativos_andrea	\N	\N	2026-10-07 12:11:54.108916+00	1
466ac73d-b4c3-4f27-beef-f94f9e6db19c	6b1b8d53c547a17d015d2b0620ae71666cad14721e1daa51a0251025b34699f6	2026-10-07 12:11:53.613119+00	20260901171547_acuerdo_categoria_chofer_ipc	\N	\N	2026-10-07 12:11:53.582306+00	1
fc035c15-550c-4597-9924-a2e06bd3220d	9a00afc1e0c5481087b05a42bb4bf5f3d37400199ca72a4829377b9a3cbb391f	2026-10-07 12:11:53.775648+00	20260902182402_espacios_compartidos	\N	\N	2026-10-07 12:11:53.634071+00	1
964f5a36-6b5b-4fe7-a735-992425cae479	68d2d56959492d370fba3a3bc685563556066ff61c945ea4c15cc1143e5bd4b8	2026-10-07 12:11:53.79681+00	20260904213329_sueldos_premios_viaje_y_vales	\N	\N	2026-10-07 12:11:53.785158+00	1
77b0ba68-0b18-4fdd-b2b1-4db0daffb6ad	bcb16c59f271152a6146c467b73db7a59b8c81d8ef20556b482f6a83f358f4c9	2026-10-07 12:11:54.245452+00	20260913022817_movimiento_caja_responsable_comprobante	\N	\N	2026-10-07 12:11:54.228953+00	1
886a119f-d911-4bda-b7b0-985e31f48c94	5b4036821449a9dc710f47edae145a7f22dc00ef7b9258d930d97f16b53ddda5	2026-10-07 12:11:53.889506+00	20260909173329_presentismo_lorena	\N	\N	2026-10-07 12:11:53.806617+00	1
0c0c8661-d86f-4d14-a5e2-4ad4a3685cd4	47d364bcc50fa2699bb22f8584b0bea6573eccbdca48df61255895bf857a4341	2026-10-07 12:11:53.934817+00	20260911015348_combustible_flota	\N	\N	2026-10-07 12:11:53.899108+00	1
33cf6f51-7c9c-44e3-9042-ea81c65e6179	b625d0b6b4da0b17ad8e82aa27a76934eaf35336d76df8172d5e6d75a86cb045	2026-10-07 12:11:54.618002+00	20260921132542_factura_campos_afip_nullable	\N	\N	2026-10-07 12:11:54.595242+00	1
2518d3da-cb1d-45b0-ba2f-81f10a68dfcf	ec8c3fae28a5c8c1b3faa6783799e4146178212c9b60456332744f2af9f819c0	2026-10-07 12:11:53.955167+00	20260911015521_combustible_limite_mensual	\N	\N	2026-10-07 12:11:53.946171+00	1
0f6271f4-27b9-4bd6-b182-ff3e2edf3d58	47baeab714ed186f2345cd4d38f05891d905a45ac237ff057553ee29d9027a1d	2026-10-07 12:11:54.271509+00	20260917124316_movimiento_caja_referencia	\N	\N	2026-10-07 12:11:54.259785+00	1
01e3562a-9077-4dd7-8c2d-b3ede80114d3	b4c5fe7a6d36024abb385e8d4dee7cceb6c39f0901e49cbd75308413ea8f1e72	2026-10-07 12:11:54.01054+00	20260911144837_combustible_comprobante_ledger	\N	\N	2026-10-07 12:11:53.963934+00	1
144b3dc0-baef-431a-a626-30d7a40f8705	0f0da66daeefb910b791cd67f345de52670476221c530c9960a0fd1700078a5a	2026-10-07 12:11:54.054525+00	20260911160000_combustible_camion_nullable	\N	\N	2026-10-07 12:11:54.030448+00	1
d3542032-90cb-460b-b526-ffd81398846c	2159c5e54c440a0ab1102f25c4f0d414793a2e39333d6f9cdd8c82ec44d41aa1	2026-10-07 12:11:54.481619+00	20260919015349_activo_cantidad_responsable_deposito	\N	\N	2026-10-07 12:11:54.465834+00	1
c4198296-7b37-41b1-8efc-1a9cf7f4b4cc	ee2b621ab134f8091dc1b71bda32a18fb36a7179595a82f303b5cc66a3c15d2d	2026-10-07 12:11:54.302404+00	20260917145307_siniestro_campos_lorena	\N	\N	2026-10-07 12:11:54.287423+00	1
72765a53-8d83-471f-8afc-4c517a268ce1	2401a9985ae0a702acc815c054d2a9986d713e232272be098c93f79f4f362298	2026-10-07 12:11:54.335926+00	20260917205827_camion_notas_pizarra	\N	\N	2026-10-07 12:11:54.317528+00	1
61d5a054-0e54-4382-a9f5-85e79d43b002	1759919ac3842385fc544012f153ec791f171ae9d0c8bae66e54f393eff42058	2026-10-07 12:11:54.3678+00	20260918172858_usuario_home_route	\N	\N	2026-10-07 12:11:54.350801+00	1
223f6203-079d-4a98-8d25-2810f2863d1e	de75a3f1679b20035e21aa73e1ef4ec815842a9e90f3cf48f70eba37fe373ec6	2026-10-07 12:11:54.508733+00	20260919020618_activo_cantidad_minima	\N	\N	2026-10-07 12:11:54.489979+00	1
6b12c4b2-743d-4f3b-bc59-4bf050570bad	120a79bc9ff9097e8ea290a98f1cbae651d3b1ca39d38c2d308b7222236ea6fe	2026-10-07 12:11:54.427722+00	20260918205821_echeq_vendido_fima_premio_produccion	\N	\N	2026-10-07 12:11:54.384421+00	1
6f106c59-1081-49f4-a3aa-e1348fd0e815	59c55509b59046ad9e09fbd778bddaa94c8d96a01e1070946d3b50546e0051b3	2026-10-07 12:11:54.569267+00	20260919023349_cierre_contable_blueteam_sgr	\N	\N	2026-10-07 12:11:54.52557+00	1
d385fed2-3308-4380-9615-e73448131840	ab2acebfcf8ab47f7da8c7f68bc1d725de1cc924290287f72a63a7d4ce1c799c	2026-10-07 12:11:54.656584+00	20260921175000_pedido_item_esquema_seguridad	\N	\N	2026-10-07 12:11:54.629938+00	1
01425e48-8203-4628-8373-f3bf8bfbf218	e74b364d5f7ea48ef734c4cb7dc8b04fc35dcf39eb510a4c75b979f84bb4debf	2026-10-07 12:11:54.586751+00	20260919151211_rubro_grupo	\N	\N	2026-10-07 12:11:54.577965+00	1
b3b50247-0fe0-47ae-8b21-c04d4e4a0138	8be4be176bf6fe8858ae9ec2cd80c82cda33210dd5811d1835b25eb9b2f4f16b	2026-10-07 12:11:55.061879+00	20261005000001_bitacora_viajes_litros_consumidos	\N	\N	2026-10-07 12:11:55.04412+00	1
dce45aea-0115-48e8-9e5f-155d89349b03	3e00878a1fb8ca75e3cb585e84412d47258e21be6ab72775b60606a666d42fa6	2026-10-07 12:11:54.734607+00	20260921191638_cortesias_evento	\N	\N	2026-10-07 12:11:54.668171+00	1
965490a1-8bbf-4284-a87c-9ce87a27fc6e	4c11470e97a9af75f70a1ea77a6a441d08b4f19ef4b91e587aec1f5216a136dc	2026-10-07 12:11:55.027937+00	20261005000000_bitacora_viajes_campos_flor	\N	\N	2026-10-07 12:11:55.000579+00	1
57e91bbc-6cc9-41da-9c7e-c745a985198b	683806ee10617bbcbba93b58f4ace1f533e22ef8a429e40e52f8e99757b61d24	2026-10-07 12:11:54.84587+00	20260924132940_premio_pax_fofi_nestoras	\N	\N	2026-10-07 12:11:54.776091+00	1
02ed6479-4750-47c3-bc4d-5ab6b67473fa	c7c421443bde9cd6b7194384c4d833861ee50aa2f4c9951bff994b22e57c237e	2026-10-07 12:11:54.991093+00	20260925133158_tarjeta_corporativa	\N	\N	2026-10-07 12:11:54.874214+00	1
c7b0a683-f97c-4181-9072-69e3ca6d53b1	07570648954948ae86786dcba5f9123327e05aa4de826f64af917fcd4ec5c31d	2026-10-07 12:11:55.093039+00	20261005000002_bitacora_viajes_litros_iniciales_tanque	\N	\N	2026-10-07 12:11:55.077402+00	1
5ffe90df-4c31-4aca-b7da-01ea4cd6b1fc	fb80c90155530d9f27420c40712d02706360830376a22fa748fd554d4b4b27ea	2026-10-07 12:11:55.132299+00	20261006000000_evento_id_logistica	\N	\N	2026-10-07 12:11:55.110217+00	1
67f76096-287a-41d8-a3ec-e93aed205a0a	da5ce7d610272cd52edddb24af5c9fa7d43085fd4c77ae9640e553e3dc872d9b	2026-10-07 12:11:55.256935+00	20261007000000_presupuesto_materiales	\N	\N	2026-10-07 12:11:55.149005+00	1
6e41c636-32f2-4f01-86cd-346479de43a5	7547ac6f52c5daf8cff007c77c9b585b7850258184938876c10b5ebf258f097d	2026-10-07 12:11:55.29215+00	20261007000001_indicadores_economicos	\N	\N	2026-10-07 12:11:55.266957+00	1
0fe6ea3b-f7da-45ac-8e51-55418798174b	97c7e276102123faa6679f786a7de3cd0c296c00490026dc7198164156bb3333	2026-10-07 12:11:55.310879+00	20261007000002_presupuesto_linea_full_editable	\N	\N	2026-10-07 12:11:55.301798+00	1
1d0fd050-96af-4884-a4d4-d994c20103b2	f2c32042b491396a636f3b59aaca7145b9255076832ac97300a5cbe2b5372e93	2026-10-07 12:11:55.352487+00	20261007000003_remitos_evento	\N	\N	2026-10-07 12:11:55.319236+00	1
\.


--
-- Name: Activo_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."Activo_id_seq"', 1, false);


--
-- Name: AcuerdoSueldo_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."AcuerdoSueldo_id_seq"', 1, true);


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

SELECT pg_catalog.setval('public."AuditoriaLog_id_seq"', 20, true);


--
-- Name: BitacoraViaje_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."BitacoraViaje_id_seq"', 64, true);


--
-- Name: Camion_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."Camion_id_seq"', 27, true);


--
-- Name: CargaCombustible_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."CargaCombustible_id_seq"', 1, false);


--
-- Name: CategoriaStock_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."CategoriaStock_id_seq"', 8, true);


--
-- Name: CierreContable_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."CierreContable_id_seq"', 1, false);


--
-- Name: CobroFacturaEmitida_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."CobroFacturaEmitida_id_seq"', 1, false);


--
-- Name: ConsumoTC_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."ConsumoTC_id_seq"', 1, false);


--
-- Name: CortesiaEvento_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."CortesiaEvento_id_seq"', 1, false);


--
-- Name: CortesiaItem_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."CortesiaItem_id_seq"', 1, false);


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
-- Name: CuotaPlanAFIP_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."CuotaPlanAFIP_id_seq"', 1, false);


--
-- Name: CuotaPrestamo_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."CuotaPrestamo_id_seq"', 1, false);


--
-- Name: DocumentoPlanAFIP_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."DocumentoPlanAFIP_id_seq"', 1, false);


--
-- Name: DocumentoPrestamo_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."DocumentoPrestamo_id_seq"', 1, false);


--
-- Name: DocumentoSiniestro_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."DocumentoSiniestro_id_seq"', 1, false);


--
-- Name: Echeq_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."Echeq_id_seq"', 1, false);


--
-- Name: EmpleadoEmpresaSplit_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."EmpleadoEmpresaSplit_id_seq"', 2, true);


--
-- Name: Empleado_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."Empleado_id_seq"', 24, true);


--
-- Name: Empresa_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."Empresa_id_seq"', 2, true);


--
-- Name: EntregaUniforme_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."EntregaUniforme_id_seq"', 1, false);


--
-- Name: EscalafonAdmin_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."EscalafonAdmin_id_seq"', 3, true);


--
-- Name: EspacioCompartido_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."EspacioCompartido_id_seq"', 1, false);


--
-- Name: EventoAcceso_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."EventoAcceso_id_seq"', 1, false);


--
-- Name: EventoCuenta_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."EventoCuenta_id_seq"', 1, false);


--
-- Name: EventoEmpleadoMes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."EventoEmpleadoMes_id_seq"', 1, false);


--
-- Name: Evento_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."Evento_id_seq"', 1, true);


--
-- Name: ExcedenteHoras_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."ExcedenteHoras_id_seq"', 1, false);


--
-- Name: FacturaEmitida_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."FacturaEmitida_id_seq"', 1, false);


--
-- Name: Factura_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."Factura_id_seq"', 1, false);


--
-- Name: GastoMesEspacio_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."GastoMesEspacio_id_seq"', 1, false);


--
-- Name: GastoPeaje_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."GastoPeaje_id_seq"', 1, false);


--
-- Name: GastoSiniestro_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."GastoSiniestro_id_seq"', 1, false);


--
-- Name: GastoTipoEspacio_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."GastoTipoEspacio_id_seq"', 1, false);


--
-- Name: IndicadorEconomico_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."IndicadorEconomico_id_seq"', 6, true);


--
-- Name: Jornada_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."Jornada_id_seq"', 1, false);


--
-- Name: LineaComida_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."LineaComida_id_seq"', 1, false);


--
-- Name: LineaGastoEspacio_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."LineaGastoEspacio_id_seq"', 1, false);


--
-- Name: LiquidacionAdmin_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."LiquidacionAdmin_id_seq"', 1, false);


--
-- Name: Liquidacion_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."Liquidacion_id_seq"', 1, false);


--
-- Name: MaterialRental_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."MaterialRental_id_seq"', 1, false);


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
-- Name: PagoPrestamoEmpleado_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."PagoPrestamoEmpleado_id_seq"', 1, false);


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
-- Name: ParteEspacio_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."ParteEspacio_id_seq"', 1, false);


--
-- Name: PatenteVehiculo_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."PatenteVehiculo_id_seq"', 1, false);


--
-- Name: PedidoComida_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."PedidoComida_id_seq"', 1, false);


--
-- Name: PedidoItem_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."PedidoItem_id_seq"', 1, false);


--
-- Name: PlanAFIP_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."PlanAFIP_id_seq"', 1, false);


--
-- Name: PreMacro_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."PreMacro_id_seq"', 1, false);


--
-- Name: PrestamoBancario_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."PrestamoBancario_id_seq"', 1, false);


--
-- Name: PrestamoEmpleado_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."PrestamoEmpleado_id_seq"', 1, true);


--
-- Name: PresupuestoEvento_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."PresupuestoEvento_id_seq"', 1, false);


--
-- Name: PresupuestoLinea_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."PresupuestoLinea_id_seq"', 1, false);


--
-- Name: Producto_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."Producto_id_seq"', 1, false);


--
-- Name: Proveedor_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."Proveedor_id_seq"', 1, false);


--
-- Name: RegistroAsistencia_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."RegistroAsistencia_id_seq"', 1, false);


--
-- Name: RemitoEvento_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."RemitoEvento_id_seq"', 1, false);


--
-- Name: RepartoFacturaEmitida_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."RepartoFacturaEmitida_id_seq"', 1, false);


--
-- Name: RepartoLineaGasto_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."RepartoLineaGasto_id_seq"', 1, false);


--
-- Name: ResponsableTC_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."ResponsableTC_id_seq"', 1, false);


--
-- Name: ResumenPresentismo_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."ResumenPresentismo_id_seq"', 1, false);


--
-- Name: RubroEvento_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."RubroEvento_id_seq"', 1, false);


--
-- Name: Rubro_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."Rubro_id_seq"', 404, true);


--
-- Name: SGR_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."SGR_id_seq"', 1, false);


--
-- Name: SeguroVehiculo_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."SeguroVehiculo_id_seq"', 23, true);


--
-- Name: ServicioTaller_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."ServicioTaller_id_seq"', 1, false);


--
-- Name: SiniestroEmpleado_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."SiniestroEmpleado_id_seq"', 1, false);


--
-- Name: SiniestroVehiculo_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."SiniestroVehiculo_id_seq"', 1, false);


--
-- Name: SocioPreMacro_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."SocioPreMacro_id_seq"', 1, false);


--
-- Name: TabConfig_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."TabConfig_id_seq"', 80, true);


--
-- Name: TarjetaCorporativa_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."TarjetaCorporativa_id_seq"', 1, false);


--
-- Name: UsuarioEmpresaAcceso_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."UsuarioEmpresaAcceso_id_seq"', 10, true);


--
-- Name: Usuario_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin_portal
--

SELECT pg_catalog.setval('public."Usuario_id_seq"', 47, true);


--
-- Name: Activo Activo_pkey; Type: CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."Activo"
    ADD CONSTRAINT "Activo_pkey" PRIMARY KEY (id);


--
-- Name: AcuerdoSueldo AcuerdoSueldo_pkey; Type: CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."AcuerdoSueldo"
    ADD CONSTRAINT "AcuerdoSueldo_pkey" PRIMARY KEY (id);


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
-- Name: BitacoraViaje BitacoraViaje_pkey; Type: CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."BitacoraViaje"
    ADD CONSTRAINT "BitacoraViaje_pkey" PRIMARY KEY (id);


--
-- Name: Camion Camion_pkey; Type: CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."Camion"
    ADD CONSTRAINT "Camion_pkey" PRIMARY KEY (id);


--
-- Name: CargaCombustible CargaCombustible_pkey; Type: CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."CargaCombustible"
    ADD CONSTRAINT "CargaCombustible_pkey" PRIMARY KEY (id);


--
-- Name: CategoriaStock CategoriaStock_pkey; Type: CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."CategoriaStock"
    ADD CONSTRAINT "CategoriaStock_pkey" PRIMARY KEY (id);


--
-- Name: CierreContable CierreContable_pkey; Type: CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."CierreContable"
    ADD CONSTRAINT "CierreContable_pkey" PRIMARY KEY (id);


--
-- Name: CobroFacturaEmitida CobroFacturaEmitida_pkey; Type: CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."CobroFacturaEmitida"
    ADD CONSTRAINT "CobroFacturaEmitida_pkey" PRIMARY KEY (id);


--
-- Name: ConsumoTC ConsumoTC_pkey; Type: CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."ConsumoTC"
    ADD CONSTRAINT "ConsumoTC_pkey" PRIMARY KEY (id);


--
-- Name: CortesiaEvento CortesiaEvento_pkey; Type: CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."CortesiaEvento"
    ADD CONSTRAINT "CortesiaEvento_pkey" PRIMARY KEY (id);


--
-- Name: CortesiaItem CortesiaItem_pkey; Type: CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."CortesiaItem"
    ADD CONSTRAINT "CortesiaItem_pkey" PRIMARY KEY (id);


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
-- Name: CuotaPlanAFIP CuotaPlanAFIP_pkey; Type: CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."CuotaPlanAFIP"
    ADD CONSTRAINT "CuotaPlanAFIP_pkey" PRIMARY KEY (id);


--
-- Name: CuotaPrestamo CuotaPrestamo_pkey; Type: CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."CuotaPrestamo"
    ADD CONSTRAINT "CuotaPrestamo_pkey" PRIMARY KEY (id);


--
-- Name: DocumentoPlanAFIP DocumentoPlanAFIP_pkey; Type: CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."DocumentoPlanAFIP"
    ADD CONSTRAINT "DocumentoPlanAFIP_pkey" PRIMARY KEY (id);


--
-- Name: DocumentoPrestamo DocumentoPrestamo_pkey; Type: CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."DocumentoPrestamo"
    ADD CONSTRAINT "DocumentoPrestamo_pkey" PRIMARY KEY (id);


--
-- Name: DocumentoSiniestro DocumentoSiniestro_pkey; Type: CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."DocumentoSiniestro"
    ADD CONSTRAINT "DocumentoSiniestro_pkey" PRIMARY KEY (id);


--
-- Name: Echeq Echeq_pkey; Type: CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."Echeq"
    ADD CONSTRAINT "Echeq_pkey" PRIMARY KEY (id);


--
-- Name: EmpleadoEmpresaSplit EmpleadoEmpresaSplit_pkey; Type: CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."EmpleadoEmpresaSplit"
    ADD CONSTRAINT "EmpleadoEmpresaSplit_pkey" PRIMARY KEY (id);


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
-- Name: EntregaUniforme EntregaUniforme_pkey; Type: CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."EntregaUniforme"
    ADD CONSTRAINT "EntregaUniforme_pkey" PRIMARY KEY (id);


--
-- Name: EscalafonAdmin EscalafonAdmin_pkey; Type: CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."EscalafonAdmin"
    ADD CONSTRAINT "EscalafonAdmin_pkey" PRIMARY KEY (id);


--
-- Name: EspacioCompartido EspacioCompartido_pkey; Type: CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."EspacioCompartido"
    ADD CONSTRAINT "EspacioCompartido_pkey" PRIMARY KEY (id);


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
-- Name: EventoEmpleadoMes EventoEmpleadoMes_pkey; Type: CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."EventoEmpleadoMes"
    ADD CONSTRAINT "EventoEmpleadoMes_pkey" PRIMARY KEY (id);


--
-- Name: Evento Evento_pkey; Type: CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."Evento"
    ADD CONSTRAINT "Evento_pkey" PRIMARY KEY (id);


--
-- Name: ExcedenteHoras ExcedenteHoras_pkey; Type: CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."ExcedenteHoras"
    ADD CONSTRAINT "ExcedenteHoras_pkey" PRIMARY KEY (id);


--
-- Name: FacturaEmitida FacturaEmitida_pkey; Type: CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."FacturaEmitida"
    ADD CONSTRAINT "FacturaEmitida_pkey" PRIMARY KEY (id);


--
-- Name: Factura Factura_pkey; Type: CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."Factura"
    ADD CONSTRAINT "Factura_pkey" PRIMARY KEY (id);


--
-- Name: GastoMesEspacio GastoMesEspacio_pkey; Type: CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."GastoMesEspacio"
    ADD CONSTRAINT "GastoMesEspacio_pkey" PRIMARY KEY (id);


--
-- Name: GastoPeaje GastoPeaje_pkey; Type: CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."GastoPeaje"
    ADD CONSTRAINT "GastoPeaje_pkey" PRIMARY KEY (id);


--
-- Name: GastoSiniestro GastoSiniestro_pkey; Type: CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."GastoSiniestro"
    ADD CONSTRAINT "GastoSiniestro_pkey" PRIMARY KEY (id);


--
-- Name: GastoTipoEspacio GastoTipoEspacio_pkey; Type: CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."GastoTipoEspacio"
    ADD CONSTRAINT "GastoTipoEspacio_pkey" PRIMARY KEY (id);


--
-- Name: IndicadorEconomico IndicadorEconomico_pkey; Type: CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."IndicadorEconomico"
    ADD CONSTRAINT "IndicadorEconomico_pkey" PRIMARY KEY (id);


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
-- Name: LineaGastoEspacio LineaGastoEspacio_pkey; Type: CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."LineaGastoEspacio"
    ADD CONSTRAINT "LineaGastoEspacio_pkey" PRIMARY KEY (id);


--
-- Name: LiquidacionAdmin LiquidacionAdmin_pkey; Type: CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."LiquidacionAdmin"
    ADD CONSTRAINT "LiquidacionAdmin_pkey" PRIMARY KEY (id);


--
-- Name: Liquidacion Liquidacion_pkey; Type: CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."Liquidacion"
    ADD CONSTRAINT "Liquidacion_pkey" PRIMARY KEY (id);


--
-- Name: MaterialRental MaterialRental_pkey; Type: CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."MaterialRental"
    ADD CONSTRAINT "MaterialRental_pkey" PRIMARY KEY (id);


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
-- Name: PagoPrestamoEmpleado PagoPrestamoEmpleado_pkey; Type: CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."PagoPrestamoEmpleado"
    ADD CONSTRAINT "PagoPrestamoEmpleado_pkey" PRIMARY KEY (id);


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
-- Name: ParteEspacio ParteEspacio_pkey; Type: CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."ParteEspacio"
    ADD CONSTRAINT "ParteEspacio_pkey" PRIMARY KEY (id);


--
-- Name: PatenteVehiculo PatenteVehiculo_pkey; Type: CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."PatenteVehiculo"
    ADD CONSTRAINT "PatenteVehiculo_pkey" PRIMARY KEY (id);


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
-- Name: PlanAFIP PlanAFIP_pkey; Type: CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."PlanAFIP"
    ADD CONSTRAINT "PlanAFIP_pkey" PRIMARY KEY (id);


--
-- Name: PreMacro PreMacro_pkey; Type: CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."PreMacro"
    ADD CONSTRAINT "PreMacro_pkey" PRIMARY KEY (id);


--
-- Name: PrestamoBancario PrestamoBancario_pkey; Type: CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."PrestamoBancario"
    ADD CONSTRAINT "PrestamoBancario_pkey" PRIMARY KEY (id);


--
-- Name: PrestamoEmpleado PrestamoEmpleado_pkey; Type: CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."PrestamoEmpleado"
    ADD CONSTRAINT "PrestamoEmpleado_pkey" PRIMARY KEY (id);


--
-- Name: PresupuestoEvento PresupuestoEvento_pkey; Type: CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."PresupuestoEvento"
    ADD CONSTRAINT "PresupuestoEvento_pkey" PRIMARY KEY (id);


--
-- Name: PresupuestoLinea PresupuestoLinea_pkey; Type: CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."PresupuestoLinea"
    ADD CONSTRAINT "PresupuestoLinea_pkey" PRIMARY KEY (id);


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
-- Name: RegistroAsistencia RegistroAsistencia_pkey; Type: CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."RegistroAsistencia"
    ADD CONSTRAINT "RegistroAsistencia_pkey" PRIMARY KEY (id);


--
-- Name: RemitoEvento RemitoEvento_pkey; Type: CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."RemitoEvento"
    ADD CONSTRAINT "RemitoEvento_pkey" PRIMARY KEY (id);


--
-- Name: RepartoFacturaEmitida RepartoFacturaEmitida_pkey; Type: CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."RepartoFacturaEmitida"
    ADD CONSTRAINT "RepartoFacturaEmitida_pkey" PRIMARY KEY (id);


--
-- Name: RepartoLineaGasto RepartoLineaGasto_pkey; Type: CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."RepartoLineaGasto"
    ADD CONSTRAINT "RepartoLineaGasto_pkey" PRIMARY KEY (id);


--
-- Name: ResponsableTC ResponsableTC_pkey; Type: CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."ResponsableTC"
    ADD CONSTRAINT "ResponsableTC_pkey" PRIMARY KEY (id);


--
-- Name: ResumenPresentismo ResumenPresentismo_pkey; Type: CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."ResumenPresentismo"
    ADD CONSTRAINT "ResumenPresentismo_pkey" PRIMARY KEY (id);


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
-- Name: SGR SGR_pkey; Type: CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."SGR"
    ADD CONSTRAINT "SGR_pkey" PRIMARY KEY (id);


--
-- Name: SeguroVehiculo SeguroVehiculo_pkey; Type: CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."SeguroVehiculo"
    ADD CONSTRAINT "SeguroVehiculo_pkey" PRIMARY KEY (id);


--
-- Name: ServicioTaller ServicioTaller_pkey; Type: CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."ServicioTaller"
    ADD CONSTRAINT "ServicioTaller_pkey" PRIMARY KEY (id);


--
-- Name: SiniestroEmpleado SiniestroEmpleado_pkey; Type: CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."SiniestroEmpleado"
    ADD CONSTRAINT "SiniestroEmpleado_pkey" PRIMARY KEY (id);


--
-- Name: SiniestroVehiculo SiniestroVehiculo_pkey; Type: CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."SiniestroVehiculo"
    ADD CONSTRAINT "SiniestroVehiculo_pkey" PRIMARY KEY (id);


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
-- Name: TarjetaCorporativa TarjetaCorporativa_pkey; Type: CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."TarjetaCorporativa"
    ADD CONSTRAINT "TarjetaCorporativa_pkey" PRIMARY KEY (id);


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
-- Name: Activo_empresa_id_nombre_categoria_ubicacion_key; Type: INDEX; Schema: public; Owner: admin_portal
--

CREATE UNIQUE INDEX "Activo_empresa_id_nombre_categoria_ubicacion_key" ON public."Activo" USING btree (empresa_id, nombre, categoria, ubicacion);


--
-- Name: AcuerdoSueldo_empleado_id_key; Type: INDEX; Schema: public; Owner: admin_portal
--

CREATE UNIQUE INDEX "AcuerdoSueldo_empleado_id_key" ON public."AcuerdoSueldo" USING btree (empleado_id);


--
-- Name: AsignacionDiaria_jornada_id_key; Type: INDEX; Schema: public; Owner: admin_portal
--

CREATE UNIQUE INDEX "AsignacionDiaria_jornada_id_key" ON public."AsignacionDiaria" USING btree (jornada_id);


--
-- Name: AsignacionDiaria_parte_diario_id_empleado_id_key; Type: INDEX; Schema: public; Owner: admin_portal
--

CREATE UNIQUE INDEX "AsignacionDiaria_parte_diario_id_empleado_id_key" ON public."AsignacionDiaria" USING btree (parte_diario_id, empleado_id);


--
-- Name: BitacoraViaje_empresa_id_origen_idx; Type: INDEX; Schema: public; Owner: admin_portal
--

CREATE INDEX "BitacoraViaje_empresa_id_origen_idx" ON public."BitacoraViaje" USING btree (empresa_id, origen);


--
-- Name: BitacoraViaje_evento_id_idx; Type: INDEX; Schema: public; Owner: admin_portal
--

CREATE INDEX "BitacoraViaje_evento_id_idx" ON public."BitacoraViaje" USING btree (evento_id);


--
-- Name: Camion_codigo_empresa_id_key; Type: INDEX; Schema: public; Owner: admin_portal
--

CREATE UNIQUE INDEX "Camion_codigo_empresa_id_key" ON public."Camion" USING btree (codigo, empresa_id);


--
-- Name: CargaCombustible_empresa_id_numero_comprobante_idx; Type: INDEX; Schema: public; Owner: admin_portal
--

CREATE INDEX "CargaCombustible_empresa_id_numero_comprobante_idx" ON public."CargaCombustible" USING btree (empresa_id, numero_comprobante);


--
-- Name: CategoriaStock_nombre_empresa_id_key; Type: INDEX; Schema: public; Owner: admin_portal
--

CREATE UNIQUE INDEX "CategoriaStock_nombre_empresa_id_key" ON public."CategoriaStock" USING btree (nombre, empresa_id);


--
-- Name: CierreContable_empresa_id_fecha_corte_key; Type: INDEX; Schema: public; Owner: admin_portal
--

CREATE UNIQUE INDEX "CierreContable_empresa_id_fecha_corte_key" ON public."CierreContable" USING btree (empresa_id, fecha_corte);


--
-- Name: ConsumoTC_tarjeta_id_import_key_key; Type: INDEX; Schema: public; Owner: admin_portal
--

CREATE UNIQUE INDEX "ConsumoTC_tarjeta_id_import_key_key" ON public."ConsumoTC" USING btree (tarjeta_id, import_key);


--
-- Name: ConsumoTC_tarjeta_id_periodo_anio_periodo_mes_idx; Type: INDEX; Schema: public; Owner: admin_portal
--

CREATE INDEX "ConsumoTC_tarjeta_id_periodo_anio_periodo_mes_idx" ON public."ConsumoTC" USING btree (tarjeta_id, periodo_anio, periodo_mes);


--
-- Name: CortesiaEvento_evento_id_deleted_at_idx; Type: INDEX; Schema: public; Owner: admin_portal
--

CREATE INDEX "CortesiaEvento_evento_id_deleted_at_idx" ON public."CortesiaEvento" USING btree (evento_id, deleted_at);


--
-- Name: CortesiaItem_cortesia_id_idx; Type: INDEX; Schema: public; Owner: admin_portal
--

CREATE INDEX "CortesiaItem_cortesia_id_idx" ON public."CortesiaItem" USING btree (cortesia_id);


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
-- Name: EmpleadoEmpresaSplit_empleado_id_empresa_id_key; Type: INDEX; Schema: public; Owner: admin_portal
--

CREATE UNIQUE INDEX "EmpleadoEmpresaSplit_empleado_id_empresa_id_key" ON public."EmpleadoEmpresaSplit" USING btree (empleado_id, empresa_id);


--
-- Name: Empleado_usuario_id_key; Type: INDEX; Schema: public; Owner: admin_portal
--

CREATE UNIQUE INDEX "Empleado_usuario_id_key" ON public."Empleado" USING btree (usuario_id);


--
-- Name: Empresa_cuit_key; Type: INDEX; Schema: public; Owner: admin_portal
--

CREATE UNIQUE INDEX "Empresa_cuit_key" ON public."Empresa" USING btree (cuit);


--
-- Name: EntregaUniforme_empleado_id_idx; Type: INDEX; Schema: public; Owner: admin_portal
--

CREATE INDEX "EntregaUniforme_empleado_id_idx" ON public."EntregaUniforme" USING btree (empleado_id);


--
-- Name: EntregaUniforme_empresa_id_empleado_nombre_fecha_entrega_or_key; Type: INDEX; Schema: public; Owner: admin_portal
--

CREATE UNIQUE INDEX "EntregaUniforme_empresa_id_empleado_nombre_fecha_entrega_or_key" ON public."EntregaUniforme" USING btree (empresa_id, empleado_nombre, fecha_entrega, origen_hoja);


--
-- Name: EscalafonAdmin_empresa_id_nombre_key; Type: INDEX; Schema: public; Owner: admin_portal
--

CREATE UNIQUE INDEX "EscalafonAdmin_empresa_id_nombre_key" ON public."EscalafonAdmin" USING btree (empresa_id, nombre);


--
-- Name: EspacioCompartido_empresa_id_nombre_key; Type: INDEX; Schema: public; Owner: admin_portal
--

CREATE UNIQUE INDEX "EspacioCompartido_empresa_id_nombre_key" ON public."EspacioCompartido" USING btree (empresa_id, nombre);


--
-- Name: EventoAcceso_usuario_id_evento_id_key; Type: INDEX; Schema: public; Owner: admin_portal
--

CREATE UNIQUE INDEX "EventoAcceso_usuario_id_evento_id_key" ON public."EventoAcceso" USING btree (usuario_id, evento_id);


--
-- Name: EventoCuenta_evento_id_cuenta_id_key; Type: INDEX; Schema: public; Owner: admin_portal
--

CREATE UNIQUE INDEX "EventoCuenta_evento_id_cuenta_id_key" ON public."EventoCuenta" USING btree (evento_id, cuenta_id);


--
-- Name: EventoEmpleadoMes_empleado_id_evento_id_periodo_mes_periodo_key; Type: INDEX; Schema: public; Owner: admin_portal
--

CREATE UNIQUE INDEX "EventoEmpleadoMes_empleado_id_evento_id_periodo_mes_periodo_key" ON public."EventoEmpleadoMes" USING btree (empleado_id, evento_id, periodo_mes, periodo_anio);


--
-- Name: ExcedenteHoras_empresa_id_empleado_id_periodo_mes_periodo_a_key; Type: INDEX; Schema: public; Owner: admin_portal
--

CREATE UNIQUE INDEX "ExcedenteHoras_empresa_id_empleado_id_periodo_mes_periodo_a_key" ON public."ExcedenteHoras" USING btree (empresa_id, empleado_id, periodo_mes, periodo_anio);


--
-- Name: GastoMesEspacio_espacio_id_periodo_mes_periodo_anio_key; Type: INDEX; Schema: public; Owner: admin_portal
--

CREATE UNIQUE INDEX "GastoMesEspacio_espacio_id_periodo_mes_periodo_anio_key" ON public."GastoMesEspacio" USING btree (espacio_id, periodo_mes, periodo_anio);


--
-- Name: IndicadorEconomico_tipo_created_at_idx; Type: INDEX; Schema: public; Owner: admin_portal
--

CREATE INDEX "IndicadorEconomico_tipo_created_at_idx" ON public."IndicadorEconomico" USING btree (tipo, created_at);


--
-- Name: Jornada_empleado_id_fecha_key; Type: INDEX; Schema: public; Owner: admin_portal
--

CREATE UNIQUE INDEX "Jornada_empleado_id_fecha_key" ON public."Jornada" USING btree (empleado_id, fecha);


--
-- Name: LineaComida_pedido_comida_id_tipo_area_key; Type: INDEX; Schema: public; Owner: admin_portal
--

CREATE UNIQUE INDEX "LineaComida_pedido_comida_id_tipo_area_key" ON public."LineaComida" USING btree (pedido_comida_id, tipo, area);


--
-- Name: LiquidacionAdmin_empleado_id_periodo_mes_periodo_anio_key; Type: INDEX; Schema: public; Owner: admin_portal
--

CREATE UNIQUE INDEX "LiquidacionAdmin_empleado_id_periodo_mes_periodo_anio_key" ON public."LiquidacionAdmin" USING btree (empleado_id, periodo_mes, periodo_anio);


--
-- Name: Liquidacion_movimiento_id_key; Type: INDEX; Schema: public; Owner: admin_portal
--

CREATE UNIQUE INDEX "Liquidacion_movimiento_id_key" ON public."Liquidacion" USING btree (movimiento_id);


--
-- Name: MaterialRental_empresa_id_origen_idx; Type: INDEX; Schema: public; Owner: admin_portal
--

CREATE INDEX "MaterialRental_empresa_id_origen_idx" ON public."MaterialRental" USING btree (empresa_id, origen);


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
-- Name: ParteEspacio_espacio_id_nombre_key; Type: INDEX; Schema: public; Owner: admin_portal
--

CREATE UNIQUE INDEX "ParteEspacio_espacio_id_nombre_key" ON public."ParteEspacio" USING btree (espacio_id, nombre);


--
-- Name: PedidoComida_evento_id_fecha_key; Type: INDEX; Schema: public; Owner: admin_portal
--

CREATE UNIQUE INDEX "PedidoComida_evento_id_fecha_key" ON public."PedidoComida" USING btree (evento_id, fecha);


--
-- Name: PedidoItem_rubro_evento_id_fecha_turno_idx; Type: INDEX; Schema: public; Owner: admin_portal
--

CREATE INDEX "PedidoItem_rubro_evento_id_fecha_turno_idx" ON public."PedidoItem" USING btree (rubro_evento_id, fecha_turno);


--
-- Name: PreMacro_evento_id_key; Type: INDEX; Schema: public; Owner: admin_portal
--

CREATE UNIQUE INDEX "PreMacro_evento_id_key" ON public."PreMacro" USING btree (evento_id);


--
-- Name: PresupuestoEvento_empresa_id_estado_idx; Type: INDEX; Schema: public; Owner: admin_portal
--

CREATE INDEX "PresupuestoEvento_empresa_id_estado_idx" ON public."PresupuestoEvento" USING btree (empresa_id, estado);


--
-- Name: PresupuestoEvento_evento_id_idx; Type: INDEX; Schema: public; Owner: admin_portal
--

CREATE INDEX "PresupuestoEvento_evento_id_idx" ON public."PresupuestoEvento" USING btree (evento_id);


--
-- Name: PresupuestoLinea_material_id_idx; Type: INDEX; Schema: public; Owner: admin_portal
--

CREATE INDEX "PresupuestoLinea_material_id_idx" ON public."PresupuestoLinea" USING btree (material_id);


--
-- Name: PresupuestoLinea_presupuesto_id_idx; Type: INDEX; Schema: public; Owner: admin_portal
--

CREATE INDEX "PresupuestoLinea_presupuesto_id_idx" ON public."PresupuestoLinea" USING btree (presupuesto_id);


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
-- Name: RegistroAsistencia_empresa_id_empleado_id_fecha_key; Type: INDEX; Schema: public; Owner: admin_portal
--

CREATE UNIQUE INDEX "RegistroAsistencia_empresa_id_empleado_id_fecha_key" ON public."RegistroAsistencia" USING btree (empresa_id, empleado_id, fecha);


--
-- Name: RegistroAsistencia_jornada_id_key; Type: INDEX; Schema: public; Owner: admin_portal
--

CREATE UNIQUE INDEX "RegistroAsistencia_jornada_id_key" ON public."RegistroAsistencia" USING btree (jornada_id);


--
-- Name: RemitoEvento_empresa_id_evento_id_idx; Type: INDEX; Schema: public; Owner: admin_portal
--

CREATE INDEX "RemitoEvento_empresa_id_evento_id_idx" ON public."RemitoEvento" USING btree (empresa_id, evento_id);


--
-- Name: RemitoEvento_evento_id_tipo_numero_key; Type: INDEX; Schema: public; Owner: admin_portal
--

CREATE UNIQUE INDEX "RemitoEvento_evento_id_tipo_numero_key" ON public."RemitoEvento" USING btree (evento_id, tipo, numero);


--
-- Name: ResponsableTC_tarjeta_id_nombre_tipo_key; Type: INDEX; Schema: public; Owner: admin_portal
--

CREATE UNIQUE INDEX "ResponsableTC_tarjeta_id_nombre_tipo_key" ON public."ResponsableTC" USING btree (tarjeta_id, nombre, tipo);


--
-- Name: ResumenPresentismo_empresa_id_empleado_id_periodo_mes_perio_key; Type: INDEX; Schema: public; Owner: admin_portal
--

CREATE UNIQUE INDEX "ResumenPresentismo_empresa_id_empleado_id_periodo_mes_perio_key" ON public."ResumenPresentismo" USING btree (empresa_id, empleado_id, periodo_mes, periodo_anio);


--
-- Name: RubroEvento_evento_id_rubro_id_key; Type: INDEX; Schema: public; Owner: admin_portal
--

CREATE UNIQUE INDEX "RubroEvento_evento_id_rubro_id_key" ON public."RubroEvento" USING btree (evento_id, rubro_id);


--
-- Name: Rubro_empresa_id_tipo_nombre_key; Type: INDEX; Schema: public; Owner: admin_portal
--

CREATE UNIQUE INDEX "Rubro_empresa_id_tipo_nombre_key" ON public."Rubro" USING btree (empresa_id, tipo, nombre);


--
-- Name: SiniestroVehiculo_empresa_id_numero_siniestro_key; Type: INDEX; Schema: public; Owner: admin_portal
--

CREATE UNIQUE INDEX "SiniestroVehiculo_empresa_id_numero_siniestro_key" ON public."SiniestroVehiculo" USING btree (empresa_id, numero_siniestro);


--
-- Name: TabConfig_codigo_empresa_id_key; Type: INDEX; Schema: public; Owner: admin_portal
--

CREATE UNIQUE INDEX "TabConfig_codigo_empresa_id_key" ON public."TabConfig" USING btree (codigo, empresa_id);


--
-- Name: TabConfig_tipo_numero_empresa_id_key; Type: INDEX; Schema: public; Owner: admin_portal
--

CREATE UNIQUE INDEX "TabConfig_tipo_numero_empresa_id_key" ON public."TabConfig" USING btree (tipo, numero, empresa_id);


--
-- Name: TarjetaCorporativa_empresa_id_nombre_key; Type: INDEX; Schema: public; Owner: admin_portal
--

CREATE UNIQUE INDEX "TarjetaCorporativa_empresa_id_nombre_key" ON public."TarjetaCorporativa" USING btree (empresa_id, nombre);


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
-- Name: AcuerdoSueldo AcuerdoSueldo_empleado_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."AcuerdoSueldo"
    ADD CONSTRAINT "AcuerdoSueldo_empleado_id_fkey" FOREIGN KEY (empleado_id) REFERENCES public."Empleado"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: AcuerdoSueldo AcuerdoSueldo_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."AcuerdoSueldo"
    ADD CONSTRAINT "AcuerdoSueldo_empresa_id_fkey" FOREIGN KEY (empresa_id) REFERENCES public."Empresa"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


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
-- Name: Anticipo Anticipo_liquidacion_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."Anticipo"
    ADD CONSTRAINT "Anticipo_liquidacion_admin_id_fkey" FOREIGN KEY (liquidacion_admin_id) REFERENCES public."LiquidacionAdmin"(id) ON UPDATE CASCADE ON DELETE SET NULL;


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
-- Name: BitacoraViaje BitacoraViaje_camion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."BitacoraViaje"
    ADD CONSTRAINT "BitacoraViaje_camion_id_fkey" FOREIGN KEY (camion_id) REFERENCES public."Camion"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: BitacoraViaje BitacoraViaje_empleado_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."BitacoraViaje"
    ADD CONSTRAINT "BitacoraViaje_empleado_id_fkey" FOREIGN KEY (empleado_id) REFERENCES public."Empleado"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: BitacoraViaje BitacoraViaje_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."BitacoraViaje"
    ADD CONSTRAINT "BitacoraViaje_empresa_id_fkey" FOREIGN KEY (empresa_id) REFERENCES public."Empresa"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: BitacoraViaje BitacoraViaje_evento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."BitacoraViaje"
    ADD CONSTRAINT "BitacoraViaje_evento_id_fkey" FOREIGN KEY (evento_id) REFERENCES public."Evento"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: BitacoraViaje BitacoraViaje_liquidacion_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."BitacoraViaje"
    ADD CONSTRAINT "BitacoraViaje_liquidacion_admin_id_fkey" FOREIGN KEY (liquidacion_admin_id) REFERENCES public."LiquidacionAdmin"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Camion Camion_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."Camion"
    ADD CONSTRAINT "Camion_empresa_id_fkey" FOREIGN KEY (empresa_id) REFERENCES public."Empresa"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: CargaCombustible CargaCombustible_camion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."CargaCombustible"
    ADD CONSTRAINT "CargaCombustible_camion_id_fkey" FOREIGN KEY (camion_id) REFERENCES public."Camion"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: CargaCombustible CargaCombustible_cuenta_corriente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."CargaCombustible"
    ADD CONSTRAINT "CargaCombustible_cuenta_corriente_id_fkey" FOREIGN KEY (cuenta_corriente_id) REFERENCES public."CuentaCorriente"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: CargaCombustible CargaCombustible_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."CargaCombustible"
    ADD CONSTRAINT "CargaCombustible_empresa_id_fkey" FOREIGN KEY (empresa_id) REFERENCES public."Empresa"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: CargaCombustible CargaCombustible_evento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."CargaCombustible"
    ADD CONSTRAINT "CargaCombustible_evento_id_fkey" FOREIGN KEY (evento_id) REFERENCES public."Evento"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: CategoriaStock CategoriaStock_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."CategoriaStock"
    ADD CONSTRAINT "CategoriaStock_empresa_id_fkey" FOREIGN KEY (empresa_id) REFERENCES public."Empresa"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: CierreContable CierreContable_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."CierreContable"
    ADD CONSTRAINT "CierreContable_empresa_id_fkey" FOREIGN KEY (empresa_id) REFERENCES public."Empresa"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: CobroFacturaEmitida CobroFacturaEmitida_cuenta_destino_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."CobroFacturaEmitida"
    ADD CONSTRAINT "CobroFacturaEmitida_cuenta_destino_id_fkey" FOREIGN KEY (cuenta_destino_id) REFERENCES public."CuentaBancaria"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: CobroFacturaEmitida CobroFacturaEmitida_factura_emitida_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."CobroFacturaEmitida"
    ADD CONSTRAINT "CobroFacturaEmitida_factura_emitida_id_fkey" FOREIGN KEY (factura_emitida_id) REFERENCES public."FacturaEmitida"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ConsumoTC ConsumoTC_responsable_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."ConsumoTC"
    ADD CONSTRAINT "ConsumoTC_responsable_id_fkey" FOREIGN KEY (responsable_id) REFERENCES public."ResponsableTC"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ConsumoTC ConsumoTC_tarjeta_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."ConsumoTC"
    ADD CONSTRAINT "ConsumoTC_tarjeta_id_fkey" FOREIGN KEY (tarjeta_id) REFERENCES public."TarjetaCorporativa"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: CortesiaEvento CortesiaEvento_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."CortesiaEvento"
    ADD CONSTRAINT "CortesiaEvento_empresa_id_fkey" FOREIGN KEY (empresa_id) REFERENCES public."Empresa"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: CortesiaEvento CortesiaEvento_evento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."CortesiaEvento"
    ADD CONSTRAINT "CortesiaEvento_evento_id_fkey" FOREIGN KEY (evento_id) REFERENCES public."Evento"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: CortesiaItem CortesiaItem_cortesia_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."CortesiaItem"
    ADD CONSTRAINT "CortesiaItem_cortesia_id_fkey" FOREIGN KEY (cortesia_id) REFERENCES public."CortesiaEvento"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


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
-- Name: CuotaPlanAFIP CuotaPlanAFIP_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."CuotaPlanAFIP"
    ADD CONSTRAINT "CuotaPlanAFIP_plan_id_fkey" FOREIGN KEY (plan_id) REFERENCES public."PlanAFIP"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: CuotaPrestamo CuotaPrestamo_prestamo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."CuotaPrestamo"
    ADD CONSTRAINT "CuotaPrestamo_prestamo_id_fkey" FOREIGN KEY (prestamo_id) REFERENCES public."PrestamoBancario"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: DocumentoPlanAFIP DocumentoPlanAFIP_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."DocumentoPlanAFIP"
    ADD CONSTRAINT "DocumentoPlanAFIP_plan_id_fkey" FOREIGN KEY (plan_id) REFERENCES public."PlanAFIP"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: DocumentoPrestamo DocumentoPrestamo_prestamo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."DocumentoPrestamo"
    ADD CONSTRAINT "DocumentoPrestamo_prestamo_id_fkey" FOREIGN KEY (prestamo_id) REFERENCES public."PrestamoBancario"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: DocumentoSiniestro DocumentoSiniestro_siniestro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."DocumentoSiniestro"
    ADD CONSTRAINT "DocumentoSiniestro_siniestro_id_fkey" FOREIGN KEY (siniestro_id) REFERENCES public."SiniestroEmpleado"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


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
-- Name: EmpleadoEmpresaSplit EmpleadoEmpresaSplit_empleado_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."EmpleadoEmpresaSplit"
    ADD CONSTRAINT "EmpleadoEmpresaSplit_empleado_id_fkey" FOREIGN KEY (empleado_id) REFERENCES public."Empleado"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: EmpleadoEmpresaSplit EmpleadoEmpresaSplit_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."EmpleadoEmpresaSplit"
    ADD CONSTRAINT "EmpleadoEmpresaSplit_empresa_id_fkey" FOREIGN KEY (empresa_id) REFERENCES public."Empresa"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


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
-- Name: EntregaUniforme EntregaUniforme_empleado_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."EntregaUniforme"
    ADD CONSTRAINT "EntregaUniforme_empleado_id_fkey" FOREIGN KEY (empleado_id) REFERENCES public."Empleado"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: EntregaUniforme EntregaUniforme_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."EntregaUniforme"
    ADD CONSTRAINT "EntregaUniforme_empresa_id_fkey" FOREIGN KEY (empresa_id) REFERENCES public."Empresa"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: EscalafonAdmin EscalafonAdmin_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."EscalafonAdmin"
    ADD CONSTRAINT "EscalafonAdmin_empresa_id_fkey" FOREIGN KEY (empresa_id) REFERENCES public."Empresa"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: EspacioCompartido EspacioCompartido_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."EspacioCompartido"
    ADD CONSTRAINT "EspacioCompartido_empresa_id_fkey" FOREIGN KEY (empresa_id) REFERENCES public."Empresa"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


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
-- Name: EventoEmpleadoMes EventoEmpleadoMes_empleado_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."EventoEmpleadoMes"
    ADD CONSTRAINT "EventoEmpleadoMes_empleado_id_fkey" FOREIGN KEY (empleado_id) REFERENCES public."Empleado"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: EventoEmpleadoMes EventoEmpleadoMes_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."EventoEmpleadoMes"
    ADD CONSTRAINT "EventoEmpleadoMes_empresa_id_fkey" FOREIGN KEY (empresa_id) REFERENCES public."Empresa"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: EventoEmpleadoMes EventoEmpleadoMes_evento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."EventoEmpleadoMes"
    ADD CONSTRAINT "EventoEmpleadoMes_evento_id_fkey" FOREIGN KEY (evento_id) REFERENCES public."Evento"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Evento Evento_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."Evento"
    ADD CONSTRAINT "Evento_empresa_id_fkey" FOREIGN KEY (empresa_id) REFERENCES public."Empresa"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ExcedenteHoras ExcedenteHoras_empleado_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."ExcedenteHoras"
    ADD CONSTRAINT "ExcedenteHoras_empleado_id_fkey" FOREIGN KEY (empleado_id) REFERENCES public."Empleado"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ExcedenteHoras ExcedenteHoras_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."ExcedenteHoras"
    ADD CONSTRAINT "ExcedenteHoras_empresa_id_fkey" FOREIGN KEY (empresa_id) REFERENCES public."Empresa"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ExcedenteHoras ExcedenteHoras_liquidacion_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."ExcedenteHoras"
    ADD CONSTRAINT "ExcedenteHoras_liquidacion_admin_id_fkey" FOREIGN KEY (liquidacion_admin_id) REFERENCES public."LiquidacionAdmin"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: FacturaEmitida FacturaEmitida_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."FacturaEmitida"
    ADD CONSTRAINT "FacturaEmitida_empresa_id_fkey" FOREIGN KEY (empresa_id) REFERENCES public."Empresa"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: FacturaEmitida FacturaEmitida_evento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."FacturaEmitida"
    ADD CONSTRAINT "FacturaEmitida_evento_id_fkey" FOREIGN KEY (evento_id) REFERENCES public."Evento"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Factura Factura_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."Factura"
    ADD CONSTRAINT "Factura_empresa_id_fkey" FOREIGN KEY (empresa_id) REFERENCES public."Empresa"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Factura Factura_evento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."Factura"
    ADD CONSTRAINT "Factura_evento_id_fkey" FOREIGN KEY (evento_id) REFERENCES public."Evento"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Factura Factura_proveedor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."Factura"
    ADD CONSTRAINT "Factura_proveedor_id_fkey" FOREIGN KEY (proveedor_id) REFERENCES public."Proveedor"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Factura Factura_rubro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."Factura"
    ADD CONSTRAINT "Factura_rubro_id_fkey" FOREIGN KEY (rubro_id) REFERENCES public."Rubro"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: GastoMesEspacio GastoMesEspacio_espacio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."GastoMesEspacio"
    ADD CONSTRAINT "GastoMesEspacio_espacio_id_fkey" FOREIGN KEY (espacio_id) REFERENCES public."EspacioCompartido"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: GastoPeaje GastoPeaje_camion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."GastoPeaje"
    ADD CONSTRAINT "GastoPeaje_camion_id_fkey" FOREIGN KEY (camion_id) REFERENCES public."Camion"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: GastoPeaje GastoPeaje_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."GastoPeaje"
    ADD CONSTRAINT "GastoPeaje_empresa_id_fkey" FOREIGN KEY (empresa_id) REFERENCES public."Empresa"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: GastoPeaje GastoPeaje_evento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."GastoPeaje"
    ADD CONSTRAINT "GastoPeaje_evento_id_fkey" FOREIGN KEY (evento_id) REFERENCES public."Evento"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: GastoSiniestro GastoSiniestro_siniestro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."GastoSiniestro"
    ADD CONSTRAINT "GastoSiniestro_siniestro_id_fkey" FOREIGN KEY (siniestro_id) REFERENCES public."SiniestroEmpleado"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: GastoTipoEspacio GastoTipoEspacio_espacio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."GastoTipoEspacio"
    ADD CONSTRAINT "GastoTipoEspacio_espacio_id_fkey" FOREIGN KEY (espacio_id) REFERENCES public."EspacioCompartido"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


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
-- Name: LineaGastoEspacio LineaGastoEspacio_gasto_mes_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."LineaGastoEspacio"
    ADD CONSTRAINT "LineaGastoEspacio_gasto_mes_id_fkey" FOREIGN KEY (gasto_mes_id) REFERENCES public."GastoMesEspacio"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: LineaGastoEspacio LineaGastoEspacio_gasto_tipo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."LineaGastoEspacio"
    ADD CONSTRAINT "LineaGastoEspacio_gasto_tipo_id_fkey" FOREIGN KEY (gasto_tipo_id) REFERENCES public."GastoTipoEspacio"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: LiquidacionAdmin LiquidacionAdmin_acuerdo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."LiquidacionAdmin"
    ADD CONSTRAINT "LiquidacionAdmin_acuerdo_id_fkey" FOREIGN KEY (acuerdo_id) REFERENCES public."AcuerdoSueldo"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: LiquidacionAdmin LiquidacionAdmin_empleado_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."LiquidacionAdmin"
    ADD CONSTRAINT "LiquidacionAdmin_empleado_id_fkey" FOREIGN KEY (empleado_id) REFERENCES public."Empleado"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: LiquidacionAdmin LiquidacionAdmin_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."LiquidacionAdmin"
    ADD CONSTRAINT "LiquidacionAdmin_empresa_id_fkey" FOREIGN KEY (empresa_id) REFERENCES public."Empresa"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


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
-- Name: MaterialRental MaterialRental_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."MaterialRental"
    ADD CONSTRAINT "MaterialRental_empresa_id_fkey" FOREIGN KEY (empresa_id) REFERENCES public."Empresa"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


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
-- Name: MovimientoCaja MovimientoCaja_liquidacion_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."MovimientoCaja"
    ADD CONSTRAINT "MovimientoCaja_liquidacion_admin_id_fkey" FOREIGN KEY (liquidacion_admin_id) REFERENCES public."LiquidacionAdmin"(id) ON UPDATE CASCADE ON DELETE SET NULL;


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
-- Name: PagoPrestamoEmpleado PagoPrestamoEmpleado_liquidacion_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."PagoPrestamoEmpleado"
    ADD CONSTRAINT "PagoPrestamoEmpleado_liquidacion_admin_id_fkey" FOREIGN KEY (liquidacion_admin_id) REFERENCES public."LiquidacionAdmin"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: PagoPrestamoEmpleado PagoPrestamoEmpleado_prestamo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."PagoPrestamoEmpleado"
    ADD CONSTRAINT "PagoPrestamoEmpleado_prestamo_id_fkey" FOREIGN KEY (prestamo_id) REFERENCES public."PrestamoEmpleado"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


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
-- Name: ParteEspacio ParteEspacio_cuenta_corriente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."ParteEspacio"
    ADD CONSTRAINT "ParteEspacio_cuenta_corriente_id_fkey" FOREIGN KEY (cuenta_corriente_id) REFERENCES public."CuentaCorriente"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ParteEspacio ParteEspacio_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."ParteEspacio"
    ADD CONSTRAINT "ParteEspacio_empresa_id_fkey" FOREIGN KEY (empresa_id) REFERENCES public."Empresa"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ParteEspacio ParteEspacio_espacio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."ParteEspacio"
    ADD CONSTRAINT "ParteEspacio_espacio_id_fkey" FOREIGN KEY (espacio_id) REFERENCES public."EspacioCompartido"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: PatenteVehiculo PatenteVehiculo_camion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."PatenteVehiculo"
    ADD CONSTRAINT "PatenteVehiculo_camion_id_fkey" FOREIGN KEY (camion_id) REFERENCES public."Camion"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: PatenteVehiculo PatenteVehiculo_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."PatenteVehiculo"
    ADD CONSTRAINT "PatenteVehiculo_empresa_id_fkey" FOREIGN KEY (empresa_id) REFERENCES public."Empresa"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


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
-- Name: PlanAFIP PlanAFIP_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."PlanAFIP"
    ADD CONSTRAINT "PlanAFIP_empresa_id_fkey" FOREIGN KEY (empresa_id) REFERENCES public."Empresa"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


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
-- Name: PrestamoBancario PrestamoBancario_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."PrestamoBancario"
    ADD CONSTRAINT "PrestamoBancario_empresa_id_fkey" FOREIGN KEY (empresa_id) REFERENCES public."Empresa"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: PrestamoEmpleado PrestamoEmpleado_empleado_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."PrestamoEmpleado"
    ADD CONSTRAINT "PrestamoEmpleado_empleado_id_fkey" FOREIGN KEY (empleado_id) REFERENCES public."Empleado"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: PrestamoEmpleado PrestamoEmpleado_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."PrestamoEmpleado"
    ADD CONSTRAINT "PrestamoEmpleado_empresa_id_fkey" FOREIGN KEY (empresa_id) REFERENCES public."Empresa"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: PresupuestoEvento PresupuestoEvento_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."PresupuestoEvento"
    ADD CONSTRAINT "PresupuestoEvento_empresa_id_fkey" FOREIGN KEY (empresa_id) REFERENCES public."Empresa"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: PresupuestoEvento PresupuestoEvento_evento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."PresupuestoEvento"
    ADD CONSTRAINT "PresupuestoEvento_evento_id_fkey" FOREIGN KEY (evento_id) REFERENCES public."Evento"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: PresupuestoEvento PresupuestoEvento_version_de_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."PresupuestoEvento"
    ADD CONSTRAINT "PresupuestoEvento_version_de_id_fkey" FOREIGN KEY (version_de_id) REFERENCES public."PresupuestoEvento"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: PresupuestoLinea PresupuestoLinea_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."PresupuestoLinea"
    ADD CONSTRAINT "PresupuestoLinea_material_id_fkey" FOREIGN KEY (material_id) REFERENCES public."MaterialRental"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: PresupuestoLinea PresupuestoLinea_presupuesto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."PresupuestoLinea"
    ADD CONSTRAINT "PresupuestoLinea_presupuesto_id_fkey" FOREIGN KEY (presupuesto_id) REFERENCES public."PresupuestoEvento"(id) ON UPDATE CASCADE ON DELETE CASCADE;


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
-- Name: RegistroAsistencia RegistroAsistencia_empleado_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."RegistroAsistencia"
    ADD CONSTRAINT "RegistroAsistencia_empleado_id_fkey" FOREIGN KEY (empleado_id) REFERENCES public."Empleado"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: RegistroAsistencia RegistroAsistencia_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."RegistroAsistencia"
    ADD CONSTRAINT "RegistroAsistencia_empresa_id_fkey" FOREIGN KEY (empresa_id) REFERENCES public."Empresa"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: RegistroAsistencia RegistroAsistencia_jornada_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."RegistroAsistencia"
    ADD CONSTRAINT "RegistroAsistencia_jornada_id_fkey" FOREIGN KEY (jornada_id) REFERENCES public."Jornada"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: RemitoEvento RemitoEvento_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."RemitoEvento"
    ADD CONSTRAINT "RemitoEvento_empresa_id_fkey" FOREIGN KEY (empresa_id) REFERENCES public."Empresa"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: RemitoEvento RemitoEvento_evento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."RemitoEvento"
    ADD CONSTRAINT "RemitoEvento_evento_id_fkey" FOREIGN KEY (evento_id) REFERENCES public."Evento"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: RepartoFacturaEmitida RepartoFacturaEmitida_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."RepartoFacturaEmitida"
    ADD CONSTRAINT "RepartoFacturaEmitida_empresa_id_fkey" FOREIGN KEY (empresa_id) REFERENCES public."Empresa"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: RepartoFacturaEmitida RepartoFacturaEmitida_factura_emitida_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."RepartoFacturaEmitida"
    ADD CONSTRAINT "RepartoFacturaEmitida_factura_emitida_id_fkey" FOREIGN KEY (factura_emitida_id) REFERENCES public."FacturaEmitida"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: RepartoLineaGasto RepartoLineaGasto_linea_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."RepartoLineaGasto"
    ADD CONSTRAINT "RepartoLineaGasto_linea_id_fkey" FOREIGN KEY (linea_id) REFERENCES public."LineaGastoEspacio"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: RepartoLineaGasto RepartoLineaGasto_movimiento_ccc_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."RepartoLineaGasto"
    ADD CONSTRAINT "RepartoLineaGasto_movimiento_ccc_id_fkey" FOREIGN KEY (movimiento_ccc_id) REFERENCES public."MovimientoCCC"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: RepartoLineaGasto RepartoLineaGasto_parte_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."RepartoLineaGasto"
    ADD CONSTRAINT "RepartoLineaGasto_parte_id_fkey" FOREIGN KEY (parte_id) REFERENCES public."ParteEspacio"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ResponsableTC ResponsableTC_tarjeta_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."ResponsableTC"
    ADD CONSTRAINT "ResponsableTC_tarjeta_id_fkey" FOREIGN KEY (tarjeta_id) REFERENCES public."TarjetaCorporativa"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ResponsableTC ResponsableTC_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."ResponsableTC"
    ADD CONSTRAINT "ResponsableTC_usuario_id_fkey" FOREIGN KEY (usuario_id) REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ResumenPresentismo ResumenPresentismo_empleado_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."ResumenPresentismo"
    ADD CONSTRAINT "ResumenPresentismo_empleado_id_fkey" FOREIGN KEY (empleado_id) REFERENCES public."Empleado"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ResumenPresentismo ResumenPresentismo_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."ResumenPresentismo"
    ADD CONSTRAINT "ResumenPresentismo_empresa_id_fkey" FOREIGN KEY (empresa_id) REFERENCES public."Empresa"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


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
-- Name: SGR SGR_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."SGR"
    ADD CONSTRAINT "SGR_empresa_id_fkey" FOREIGN KEY (empresa_id) REFERENCES public."Empresa"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: SeguroVehiculo SeguroVehiculo_camion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."SeguroVehiculo"
    ADD CONSTRAINT "SeguroVehiculo_camion_id_fkey" FOREIGN KEY (camion_id) REFERENCES public."Camion"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: SeguroVehiculo SeguroVehiculo_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."SeguroVehiculo"
    ADD CONSTRAINT "SeguroVehiculo_empresa_id_fkey" FOREIGN KEY (empresa_id) REFERENCES public."Empresa"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ServicioTaller ServicioTaller_camion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."ServicioTaller"
    ADD CONSTRAINT "ServicioTaller_camion_id_fkey" FOREIGN KEY (camion_id) REFERENCES public."Camion"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ServicioTaller ServicioTaller_cuenta_corriente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."ServicioTaller"
    ADD CONSTRAINT "ServicioTaller_cuenta_corriente_id_fkey" FOREIGN KEY (cuenta_corriente_id) REFERENCES public."CuentaCorriente"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ServicioTaller ServicioTaller_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."ServicioTaller"
    ADD CONSTRAINT "ServicioTaller_empresa_id_fkey" FOREIGN KEY (empresa_id) REFERENCES public."Empresa"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: SiniestroEmpleado SiniestroEmpleado_empleado_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."SiniestroEmpleado"
    ADD CONSTRAINT "SiniestroEmpleado_empleado_id_fkey" FOREIGN KEY (empleado_id) REFERENCES public."Empleado"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: SiniestroEmpleado SiniestroEmpleado_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."SiniestroEmpleado"
    ADD CONSTRAINT "SiniestroEmpleado_empresa_id_fkey" FOREIGN KEY (empresa_id) REFERENCES public."Empresa"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: SiniestroEmpleado SiniestroEmpleado_evento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."SiniestroEmpleado"
    ADD CONSTRAINT "SiniestroEmpleado_evento_id_fkey" FOREIGN KEY (evento_id) REFERENCES public."Evento"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: SiniestroVehiculo SiniestroVehiculo_camion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."SiniestroVehiculo"
    ADD CONSTRAINT "SiniestroVehiculo_camion_id_fkey" FOREIGN KEY (camion_id) REFERENCES public."Camion"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: SiniestroVehiculo SiniestroVehiculo_empleado_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."SiniestroVehiculo"
    ADD CONSTRAINT "SiniestroVehiculo_empleado_id_fkey" FOREIGN KEY (empleado_id) REFERENCES public."Empleado"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: SiniestroVehiculo SiniestroVehiculo_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."SiniestroVehiculo"
    ADD CONSTRAINT "SiniestroVehiculo_empresa_id_fkey" FOREIGN KEY (empresa_id) REFERENCES public."Empresa"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


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
-- Name: TarjetaCorporativa TarjetaCorporativa_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin_portal
--

ALTER TABLE ONLY public."TarjetaCorporativa"
    ADD CONSTRAINT "TarjetaCorporativa_empresa_id_fkey" FOREIGN KEY (empresa_id) REFERENCES public."Empresa"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


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

\unrestrict zuRF0ikY1SRJ5YxmVugE3vVRVhHtgw3hdwE5yuG1sZSTsI6AvyT4RQIi2ovnz3s

