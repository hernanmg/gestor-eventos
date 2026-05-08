-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('ADMIN', 'OPERADOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "Tipo" AS ENUM ('EGRESO', 'INGRESO');

-- CreateEnum
CREATE TYPE "EstadoEvento" AS ENUM ('ACTIVO', 'CERRADO', 'IMPORTADO');

-- CreateEnum
CREATE TYPE "TipoCuenta" AS ENUM ('EFECTIVO', 'BANCO');

-- CreateEnum
CREATE TYPE "EstadoEcheq" AS ENUM ('PENDIENTE', 'COBRADO', 'RECHAZADO');

-- CreateEnum
CREATE TYPE "Moneda" AS ENUM ('ARS', 'USD');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "rol" "Rol" NOT NULL DEFAULT 'OPERADOR',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TabConfig" (
    "id" SERIAL NOT NULL,
    "tipo" "Tipo" NOT NULL,
    "numero" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,

    CONSTRAINT "TabConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evento" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "fecha_inicio" TIMESTAMP(3),
    "fecha_fin" TIMESTAMP(3),
    "estado" "EstadoEvento" NOT NULL DEFAULT 'ACTIVO',
    "socios" JSONB NOT NULL DEFAULT '[]',
    "moneda_base" "Moneda" NOT NULL DEFAULT 'ARS',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" INTEGER,
    "updated_by" INTEGER,

    CONSTRAINT "Evento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Movimiento" (
    "id" SERIAL NOT NULL,
    "evento_id" INTEGER NOT NULL,
    "tipo" "Tipo" NOT NULL,
    "tab_numero" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3),
    "concepto" TEXT,
    "descripcion" TEXT,
    "debe" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "haber" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "saldo" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "moneda" "Moneda" NOT NULL DEFAULT 'ARS',
    "orden" INTEGER NOT NULL,
    "impuesto_subcategoria" TEXT,
    "movimiento_caja_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" INTEGER,
    "updated_by" INTEGER,

    CONSTRAINT "Movimiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CuentaBancaria" (
    "id" SERIAL NOT NULL,
    "evento_id" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoCuenta" NOT NULL,
    "moneda" "Moneda" NOT NULL DEFAULT 'ARS',
    "saldo_inicial" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "CuentaBancaria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovimientoCaja" (
    "id" SERIAL NOT NULL,
    "cuenta_id" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3),
    "descripcion" TEXT,
    "debe" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "haber" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "saldo_corriente" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "orden" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" INTEGER,
    "updated_by" INTEGER,

    CONSTRAINT "MovimientoCaja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Echeq" (
    "id" SERIAL NOT NULL,
    "evento_id" INTEGER NOT NULL,
    "movimiento_id" INTEGER,
    "movimiento_caja_id" INTEGER,
    "numero" TEXT NOT NULL,
    "razon_social" TEXT NOT NULL,
    "detalle" TEXT,
    "importe" DECIMAL(15,2) NOT NULL,
    "moneda" "Moneda" NOT NULL DEFAULT 'ARS',
    "estado" "EstadoEcheq" NOT NULL DEFAULT 'PENDIENTE',
    "fecha_emision" TIMESTAMP(3),
    "fecha_cobro_estimada" TIMESTAMP(3),
    "fecha_cobro_real" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" INTEGER,
    "updated_by" INTEGER,

    CONSTRAINT "Echeq_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "TabConfig_codigo_key" ON "TabConfig"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "TabConfig_tipo_numero_key" ON "TabConfig"("tipo", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "Echeq_movimiento_id_key" ON "Echeq"("movimiento_id");

-- AddForeignKey
ALTER TABLE "Movimiento" ADD CONSTRAINT "Movimiento_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "Evento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movimiento" ADD CONSTRAINT "Movimiento_movimiento_caja_id_fkey" FOREIGN KEY ("movimiento_caja_id") REFERENCES "MovimientoCaja"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CuentaBancaria" ADD CONSTRAINT "CuentaBancaria_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "Evento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoCaja" ADD CONSTRAINT "MovimientoCaja_cuenta_id_fkey" FOREIGN KEY ("cuenta_id") REFERENCES "CuentaBancaria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Echeq" ADD CONSTRAINT "Echeq_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "Evento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Echeq" ADD CONSTRAINT "Echeq_movimiento_id_fkey" FOREIGN KEY ("movimiento_id") REFERENCES "Movimiento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Echeq" ADD CONSTRAINT "Echeq_movimiento_caja_id_fkey" FOREIGN KEY ("movimiento_caja_id") REFERENCES "MovimientoCaja"("id") ON DELETE SET NULL ON UPDATE CASCADE;
