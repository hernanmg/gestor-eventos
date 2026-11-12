-- CreateEnum
CREATE TYPE "OrigenBitacoraViaje" AS ENUM ('RRHH', 'FLOTA');

-- DropForeignKey
ALTER TABLE "BitacoraViaje" DROP CONSTRAINT "BitacoraViaje_empleado_id_fkey";

-- AlterTable
ALTER TABLE "BitacoraViaje" ADD COLUMN     "alias_camion" TEXT,
ADD COLUMN     "camion_id" INTEGER,
ADD COLUMN     "chofer_nombre" TEXT,
ADD COLUMN     "horario_llegada" TIMESTAMP(3),
ADD COLUMN     "horario_salida" TIMESTAMP(3),
ADD COLUMN     "km_finales" INTEGER,
ADD COLUMN     "km_iniciales" INTEGER,
ADD COLUMN     "km_recorridos" INTEGER,
ADD COLUMN     "litros_cargados_ruta" DECIMAL(10,2),
ADD COLUMN     "monto_caja_entregada" DECIMAL(14,2),
ADD COLUMN     "monto_combustible" DECIMAL(14,2),
ADD COLUMN     "origen" "OrigenBitacoraViaje" NOT NULL DEFAULT 'RRHH',
ADD COLUMN     "patente_camion" TEXT,
ALTER COLUMN "empleado_id" DROP NOT NULL,
ALTER COLUMN "fecha" DROP NOT NULL,
ALTER COLUMN "tipo_recorrido" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "BitacoraViaje_empresa_id_origen_idx" ON "BitacoraViaje"("empresa_id", "origen");

-- AddForeignKey
ALTER TABLE "BitacoraViaje" ADD CONSTRAINT "BitacoraViaje_empleado_id_fkey" FOREIGN KEY ("empleado_id") REFERENCES "Empleado"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BitacoraViaje" ADD CONSTRAINT "BitacoraViaje_camion_id_fkey" FOREIGN KEY ("camion_id") REFERENCES "Camion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

