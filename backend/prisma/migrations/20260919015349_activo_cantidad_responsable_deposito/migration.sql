-- AlterTable
ALTER TABLE "Activo" ADD COLUMN     "cantidad" INTEGER DEFAULT 0,
ADD COLUMN     "responsable_deposito" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Activo_empresa_id_nombre_categoria_ubicacion_key" ON "Activo"("empresa_id", "nombre", "categoria", "ubicacion");
