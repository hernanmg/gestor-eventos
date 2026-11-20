-- CreateEnum
CREATE TYPE "TipoSeguroPersonal" AS ENUM ('ART', 'AP');

-- AlterTable
ALTER TABLE "SeguroVehiculo" ADD COLUMN     "cuota_mensual" DECIMAL(12,2),
ADD COLUMN     "forma_pago" TEXT,
ADD COLUMN     "modalidad" TEXT,
ADD COLUMN     "suma_asegurada" DECIMAL(14,2);

-- CreateTable
CREATE TABLE "CuotaSeguroVehiculo" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "camion_id" INTEGER NOT NULL,
    "seguro_id" INTEGER,
    "periodo" TIMESTAMP(3) NOT NULL,
    "aseguradora" TEXT NOT NULL,
    "forma_pago" TEXT,
    "importe" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" INTEGER,

    CONSTRAINT "CuotaSeguroVehiculo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolizaPersonal" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "tipo" "TipoSeguroPersonal" NOT NULL,
    "aseguradora" TEXT NOT NULL,
    "numero_poliza" TEXT,
    "productor" TEXT,
    "productor_contacto" TEXT,
    "fecha_inicio" TIMESTAMP(3),
    "fecha_vencimiento" TIMESTAMP(3),
    "documento_data" BYTEA,
    "documento_nombre" TEXT,
    "documento_mime" TEXT,
    "notas" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" INTEGER,

    CONSTRAINT "PolizaPersonal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoberturaEmpleado" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "empleado_id" INTEGER NOT NULL,
    "poliza_id" INTEGER NOT NULL,
    "fecha_alta" TIMESTAMP(3) NOT NULL,
    "fecha_baja" TIMESTAMP(3),
    "alta_informada_at" TIMESTAMP(3),
    "baja_informada_at" TIMESTAMP(3),
    "notas" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" INTEGER,

    CONSTRAINT "CoberturaEmpleado_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CuotaSeguroVehiculo_empresa_id_idx" ON "CuotaSeguroVehiculo"("empresa_id");

-- CreateIndex
CREATE UNIQUE INDEX "CuotaSeguroVehiculo_camion_id_periodo_aseguradora_key" ON "CuotaSeguroVehiculo"("camion_id", "periodo", "aseguradora");

-- CreateIndex
CREATE INDEX "PolizaPersonal_empresa_id_idx" ON "PolizaPersonal"("empresa_id");

-- CreateIndex
CREATE INDEX "CoberturaEmpleado_empleado_id_idx" ON "CoberturaEmpleado"("empleado_id");

-- CreateIndex
CREATE INDEX "CoberturaEmpleado_poliza_id_idx" ON "CoberturaEmpleado"("poliza_id");

-- AddForeignKey
ALTER TABLE "CuotaSeguroVehiculo" ADD CONSTRAINT "CuotaSeguroVehiculo_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CuotaSeguroVehiculo" ADD CONSTRAINT "CuotaSeguroVehiculo_camion_id_fkey" FOREIGN KEY ("camion_id") REFERENCES "Camion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CuotaSeguroVehiculo" ADD CONSTRAINT "CuotaSeguroVehiculo_seguro_id_fkey" FOREIGN KEY ("seguro_id") REFERENCES "SeguroVehiculo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolizaPersonal" ADD CONSTRAINT "PolizaPersonal_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoberturaEmpleado" ADD CONSTRAINT "CoberturaEmpleado_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoberturaEmpleado" ADD CONSTRAINT "CoberturaEmpleado_empleado_id_fkey" FOREIGN KEY ("empleado_id") REFERENCES "Empleado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoberturaEmpleado" ADD CONSTRAINT "CoberturaEmpleado_poliza_id_fkey" FOREIGN KEY ("poliza_id") REFERENCES "PolizaPersonal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

