-- CreateEnum
CREATE TYPE "EstadoPlanAFIP" AS ENUM ('ACTIVO', 'CANCELADO', 'FINALIZADO', 'CADUCADO');

-- CreateEnum
CREATE TYPE "EstadoPrestamo" AS ENUM ('ACTIVO', 'CANCELADO_ANTICIPADO', 'FINALIZADO');

-- CreateTable
CREATE TABLE "PlanAFIP" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "numero_plan" TEXT,
    "descripcion" TEXT NOT NULL,
    "fecha_inicio" TIMESTAMP(3) NOT NULL,
    "capital_original" DECIMAL(15,2) NOT NULL,
    "cantidad_cuotas" INTEGER NOT NULL,
    "valor_cuota_aprox" DECIMAL(12,2),
    "interes_financiero" DECIMAL(5,2),
    "interes_resarcitorio" DECIMAL(5,2),
    "estado" "EstadoPlanAFIP" NOT NULL DEFAULT 'ACTIVO',
    "notas" TEXT,
    "titular_nombre" TEXT,
    "titular_cuit" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" INTEGER,

    CONSTRAINT "PlanAFIP_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CuotaPlanAFIP" (
    "id" SERIAL NOT NULL,
    "plan_id" INTEGER NOT NULL,
    "numero_cuota" INTEGER NOT NULL,
    "fecha_debito" TIMESTAMP(3) NOT NULL,
    "capital" DECIMAL(12,2),
    "interes" DECIMAL(12,2),
    "total_cuota" DECIMAL(12,2) NOT NULL,
    "fecha_pago_real" TIMESTAMP(3),
    "pagada" BOOLEAN NOT NULL DEFAULT false,
    "notas" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CuotaPlanAFIP_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentoPlanAFIP" (
    "id" SERIAL NOT NULL,
    "plan_id" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "archivo_data" BYTEA NOT NULL,
    "archivo_mime" TEXT NOT NULL,
    "archivo_size" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER,

    CONSTRAINT "DocumentoPlanAFIP_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrestamoBancario" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "entidad" TEXT NOT NULL,
    "numero_operacion" TEXT,
    "tipo" TEXT,
    "fecha_otorgamiento" TIMESTAMP(3) NOT NULL,
    "capital_original" DECIMAL(15,2) NOT NULL,
    "moneda" "Moneda" NOT NULL DEFAULT 'ARS',
    "tasa_nominal_anual" DECIMAL(5,2),
    "tasa_efectiva_anual" DECIMAL(5,2),
    "cantidad_cuotas" INTEGER NOT NULL,
    "dia_debito" INTEGER,
    "estado" "EstadoPrestamo" NOT NULL DEFAULT 'ACTIVO',
    "notas" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" INTEGER,

    CONSTRAINT "PrestamoBancario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CuotaPrestamo" (
    "id" SERIAL NOT NULL,
    "prestamo_id" INTEGER NOT NULL,
    "numero_cuota" INTEGER NOT NULL,
    "fecha_vencimiento" TIMESTAMP(3) NOT NULL,
    "capital" DECIMAL(12,2),
    "interes" DECIMAL(12,2),
    "iva_interes" DECIMAL(12,2),
    "seguro" DECIMAL(12,2),
    "otros_impuestos" DECIMAL(12,2),
    "total_cuota" DECIMAL(12,2) NOT NULL,
    "fecha_pago_real" TIMESTAMP(3),
    "pagada" BOOLEAN NOT NULL DEFAULT false,
    "notas" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CuotaPrestamo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentoPrestamo" (
    "id" SERIAL NOT NULL,
    "prestamo_id" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "archivo_data" BYTEA NOT NULL,
    "archivo_mime" TEXT NOT NULL,
    "archivo_size" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER,

    CONSTRAINT "DocumentoPrestamo_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PlanAFIP" ADD CONSTRAINT "PlanAFIP_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CuotaPlanAFIP" ADD CONSTRAINT "CuotaPlanAFIP_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "PlanAFIP"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentoPlanAFIP" ADD CONSTRAINT "DocumentoPlanAFIP_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "PlanAFIP"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrestamoBancario" ADD CONSTRAINT "PrestamoBancario_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CuotaPrestamo" ADD CONSTRAINT "CuotaPrestamo_prestamo_id_fkey" FOREIGN KEY ("prestamo_id") REFERENCES "PrestamoBancario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentoPrestamo" ADD CONSTRAINT "DocumentoPrestamo_prestamo_id_fkey" FOREIGN KEY ("prestamo_id") REFERENCES "PrestamoBancario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
