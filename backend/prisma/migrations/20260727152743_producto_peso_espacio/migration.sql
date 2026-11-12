-- AlterTable
ALTER TABLE "Producto" ADD COLUMN     "peso_unitario" DECIMAL(8,3),
ADD COLUMN     "espacio" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Producto_empresa_id_nombre_espacio_key" ON "Producto"("empresa_id", "nombre", "espacio");
