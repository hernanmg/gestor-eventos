-- CreateEnum
CREATE TYPE "TipoCruceMaterial" AS ENUM ('ALQUILER_DADO', 'PRESTAMO_DADO', 'ALQUILER_TOMADO', 'PRESTAMO_TOMADO', 'VENTA', 'COMPRA');

-- CreateEnum
CREATE TYPE "EstadoCruceMaterial" AS ENUM ('ABIERTO', 'CERRADO', 'ANULADO');

-- AlterTable
ALTER TABLE "CoberturaEmpleado" ADD COLUMN     "evento_id" INTEGER;

-- CreateTable
CREATE TABLE "CruceMaterial" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "tercero" TEXT NOT NULL,
    "tipo" "TipoCruceMaterial" NOT NULL,
    "estado" "EstadoCruceMaterial" NOT NULL DEFAULT 'ABIERTO',
    "fecha_desde" TIMESTAMP(3) NOT NULL,
    "fecha_hasta" TIMESTAMP(3),
    "fecha_cierre" TIMESTAMP(3),
    "evento_id" INTEGER,
    "referencia" TEXT,
    "tasa_euro" DECIMAL(12,2),
    "porcentaje_alquiler" DECIMAL(5,2),
    "notas" TEXT,
    "import_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" INTEGER,
    "updated_by" INTEGER,

    CONSTRAINT "CruceMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CruceMaterialItem" (
    "id" SERIAL NOT NULL,
    "cruce_id" INTEGER NOT NULL,
    "producto_id" INTEGER,
    "descripcion" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "cantidad_devuelta" INTEGER NOT NULL DEFAULT 0,
    "valor_unitario_eur" DECIMAL(12,2),
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CruceMaterialItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CruceMaterial_empresa_id_estado_idx" ON "CruceMaterial"("empresa_id", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "CruceMaterial_empresa_id_import_key_key" ON "CruceMaterial"("empresa_id", "import_key");

-- CreateIndex
CREATE INDEX "CruceMaterialItem_cruce_id_idx" ON "CruceMaterialItem"("cruce_id");

-- CreateIndex
CREATE INDEX "CruceMaterialItem_producto_id_idx" ON "CruceMaterialItem"("producto_id");

-- AddForeignKey
ALTER TABLE "CoberturaEmpleado" ADD CONSTRAINT "CoberturaEmpleado_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "Evento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CruceMaterial" ADD CONSTRAINT "CruceMaterial_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CruceMaterial" ADD CONSTRAINT "CruceMaterial_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "Evento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CruceMaterialItem" ADD CONSTRAINT "CruceMaterialItem_cruce_id_fkey" FOREIGN KEY ("cruce_id") REFERENCES "CruceMaterial"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CruceMaterialItem" ADD CONSTRAINT "CruceMaterialItem_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "Producto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

