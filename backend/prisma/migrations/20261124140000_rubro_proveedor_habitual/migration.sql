-- Proveedor habitual y costo estimado por rubro (Proveedores, punto 6)
-- AlterTable
ALTER TABLE "Rubro" ADD COLUMN     "costo_estimado" DECIMAL(15,2),
ADD COLUMN     "costo_moneda" "Moneda" NOT NULL DEFAULT 'ARS',
ADD COLUMN     "proveedor_habitual_id" INTEGER;

-- AddForeignKey
ALTER TABLE "Rubro" ADD CONSTRAINT "Rubro_proveedor_habitual_id_fkey" FOREIGN KEY ("proveedor_habitual_id") REFERENCES "Proveedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

