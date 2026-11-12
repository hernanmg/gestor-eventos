-- CreateEnum
CREATE TYPE "EstadoSeguro" AS ENUM ('VIGENTE', 'POR_VENCER', 'VENCIDO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "TipoPatente" AS ENUM ('MUNICIPAL', 'PROVINCIAL', 'NACIONAL');

-- CreateEnum
CREATE TYPE "EstadoPatente" AS ENUM ('PAGADA', 'PENDIENTE', 'VENCIDA');

-- CreateEnum
CREATE TYPE "TipoServicioTaller" AS ENUM ('MANTENIMIENTO', 'REPARACION', 'NEUMATICOS', 'CHAPERIA_PINTURA', 'ELECTRICIDAD', 'OTROS');

-- CreateEnum
CREATE TYPE "EstadoServicioTaller" AS ENUM ('PRESUPUESTADO', 'EN_PROCESO', 'FINALIZADO', 'CANCELADO');

-- AlterTable
ALTER TABLE "Camion" ADD COLUMN     "anio" INTEGER,
ADD COLUMN     "color" TEXT,
ADD COLUMN     "en_servicio" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "fecha_baja" TIMESTAMP(3),
ADD COLUMN     "marca" TEXT,
ADD COLUMN     "modelo" TEXT,
ADD COLUMN     "motivo_baja" TEXT,
ADD COLUMN     "numero_telepase" TEXT,
ADD COLUMN     "titular" TEXT;

-- CreateTable
CREATE TABLE "SeguroVehiculo" (
    "id" SERIAL NOT NULL,
    "camion_id" INTEGER NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "aseguradora" TEXT NOT NULL,
    "numero_poliza" TEXT,
    "tipo_cobertura" TEXT,
    "fecha_inicio" TIMESTAMP(3) NOT NULL,
    "fecha_vencimiento" TIMESTAMP(3) NOT NULL,
    "importe_anual" DECIMAL(12,2),
    "moneda" "Moneda" NOT NULL DEFAULT 'ARS',
    "estado" "EstadoSeguro" NOT NULL DEFAULT 'VIGENTE',
    "documento_data" BYTEA,
    "documento_nombre" TEXT,
    "documento_mime" TEXT,
    "notas" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" INTEGER,

    CONSTRAINT "SeguroVehiculo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatenteVehiculo" (
    "id" SERIAL NOT NULL,
    "camion_id" INTEGER NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "tipo" "TipoPatente" NOT NULL,
    "anio" INTEGER NOT NULL,
    "cuota" INTEGER,
    "importe" DECIMAL(12,2) NOT NULL,
    "fecha_vencimiento" TIMESTAMP(3) NOT NULL,
    "fecha_pago" TIMESTAMP(3),
    "estado" "EstadoPatente" NOT NULL DEFAULT 'PENDIENTE',
    "comprobante_data" BYTEA,
    "comprobante_nombre" TEXT,
    "comprobante_mime" TEXT,
    "notas" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" INTEGER,

    CONSTRAINT "PatenteVehiculo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GastoPeaje" (
    "id" SERIAL NOT NULL,
    "camion_id" INTEGER NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "ruta" TEXT,
    "importe" DECIMAL(10,2) NOT NULL,
    "evento_id" INTEGER,
    "es_carga_telepase" BOOLEAN NOT NULL DEFAULT false,
    "saldo_telepase_post" DECIMAL(10,2),
    "notas" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    "created_by" INTEGER,

    CONSTRAINT "GastoPeaje_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServicioTaller" (
    "id" SERIAL NOT NULL,
    "camion_id" INTEGER NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "taller_nombre" TEXT,
    "tipo" "TipoServicioTaller" NOT NULL,
    "descripcion" TEXT NOT NULL,
    "fecha_ingreso" TIMESTAMP(3) NOT NULL,
    "fecha_estimada" TIMESTAMP(3),
    "fecha_retiro" TIMESTAMP(3),
    "estado" "EstadoServicioTaller" NOT NULL DEFAULT 'PRESUPUESTADO',
    "presupuesto" DECIMAL(12,2),
    "importe_final" DECIMAL(12,2),
    "saldo_pendiente" DECIMAL(12,2),
    "cuenta_corriente_id" INTEGER,
    "notas" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" INTEGER,

    CONSTRAINT "ServicioTaller_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "SeguroVehiculo" ADD CONSTRAINT "SeguroVehiculo_camion_id_fkey" FOREIGN KEY ("camion_id") REFERENCES "Camion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeguroVehiculo" ADD CONSTRAINT "SeguroVehiculo_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatenteVehiculo" ADD CONSTRAINT "PatenteVehiculo_camion_id_fkey" FOREIGN KEY ("camion_id") REFERENCES "Camion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatenteVehiculo" ADD CONSTRAINT "PatenteVehiculo_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GastoPeaje" ADD CONSTRAINT "GastoPeaje_camion_id_fkey" FOREIGN KEY ("camion_id") REFERENCES "Camion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GastoPeaje" ADD CONSTRAINT "GastoPeaje_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GastoPeaje" ADD CONSTRAINT "GastoPeaje_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "Evento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServicioTaller" ADD CONSTRAINT "ServicioTaller_camion_id_fkey" FOREIGN KEY ("camion_id") REFERENCES "Camion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServicioTaller" ADD CONSTRAINT "ServicioTaller_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServicioTaller" ADD CONSTRAINT "ServicioTaller_cuenta_corriente_id_fkey" FOREIGN KEY ("cuenta_corriente_id") REFERENCES "CuentaCorriente"("id") ON DELETE SET NULL ON UPDATE CASCADE;
