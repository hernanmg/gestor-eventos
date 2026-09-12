-- CreateEnum
CREATE TYPE "TipoCombustible" AS ENUM ('NAFTA_SUPER', 'NAFTA_PREMIUM', 'DIESEL', 'GNC');

-- CreateEnum
CREATE TYPE "EstadoCargaCombustible" AS ENUM ('AUTORIZADA', 'PENDIENTE_AUTORIZACION', 'RECHAZADA');

-- AlterTable
ALTER TABLE "Camion" ADD COLUMN     "km_actual" INTEGER;

-- CreateTable
CREATE TABLE "CargaCombustible" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "camion_id" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "tipo_combustible" "TipoCombustible" NOT NULL DEFAULT 'DIESEL',
    "litros" DECIMAL(10,2) NOT NULL,
    "precio_por_litro" DECIMAL(10,2),
    "monto_total" DECIMAL(12,2) NOT NULL,
    "estacion_nombre" TEXT,
    "estacion_ciudad" TEXT,
    "km_actual" INTEGER,
    "km_anterior" INTEGER,
    "km_recorridos" INTEGER,
    "rendimiento_lts_100km" DECIMAL(6,2),
    "estado" "EstadoCargaCombustible" NOT NULL DEFAULT 'AUTORIZADA',
    "autorizado_por" INTEGER,
    "autorizado_at" TIMESTAMP(3),
    "evento_id" INTEGER,
    "cuenta_corriente_id" INTEGER,
    "responsable_nombre" TEXT,
    "comprobante_data" BYTEA,
    "comprobante_nombre" TEXT,
    "comprobante_mime" TEXT,
    "notas" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" INTEGER,

    CONSTRAINT "CargaCombustible_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "CargaCombustible" ADD CONSTRAINT "CargaCombustible_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CargaCombustible" ADD CONSTRAINT "CargaCombustible_camion_id_fkey" FOREIGN KEY ("camion_id") REFERENCES "Camion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CargaCombustible" ADD CONSTRAINT "CargaCombustible_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "Evento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CargaCombustible" ADD CONSTRAINT "CargaCombustible_cuenta_corriente_id_fkey" FOREIGN KEY ("cuenta_corriente_id") REFERENCES "CuentaCorriente"("id") ON DELETE SET NULL ON UPDATE CASCADE;
