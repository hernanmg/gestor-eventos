-- CreateEnum
CREATE TYPE "TipoCambioVehiculo" AS ENUM ('NEUMATICOS', 'ROTACION', 'BATERIA');

-- CreateTable
CREATE TABLE "CambioVehiculo" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "camion_id" INTEGER NOT NULL,
    "tipo" "TipoCambioVehiculo" NOT NULL,
    "fecha" TIMESTAMP(3),
    "km" INTEGER,
    "detalle" TEXT,
    "proximo_km" INTEGER,
    "proxima_fecha" TIMESTAMP(3),
    "importe" DECIMAL(12,2),
    "proveedor" TEXT,
    "notas" TEXT,
    "import_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" INTEGER,

    CONSTRAINT "CambioVehiculo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CambioVehiculo_camion_id_tipo_idx" ON "CambioVehiculo"("camion_id", "tipo");

-- CreateIndex
CREATE UNIQUE INDEX "CambioVehiculo_empresa_id_import_key_key" ON "CambioVehiculo"("empresa_id", "import_key");

-- AddForeignKey
ALTER TABLE "CambioVehiculo" ADD CONSTRAINT "CambioVehiculo_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CambioVehiculo" ADD CONSTRAINT "CambioVehiculo_camion_id_fkey" FOREIGN KEY ("camion_id") REFERENCES "Camion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

