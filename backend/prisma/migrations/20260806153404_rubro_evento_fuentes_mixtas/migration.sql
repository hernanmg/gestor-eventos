-- AlterTable
ALTER TABLE "AsignacionStock" ADD COLUMN     "rubro_evento_id" INTEGER;

-- AlterTable
ALTER TABLE "RubroEvento" ADD COLUMN     "cantidad_proveedor" INTEGER,
ADD COLUMN     "cantidad_stock" INTEGER,
ADD COLUMN     "usa_stock_propio" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE "AsignacionStock" ADD CONSTRAINT "AsignacionStock_rubro_evento_id_fkey" FOREIGN KEY ("rubro_evento_id") REFERENCES "RubroEvento"("id") ON DELETE SET NULL ON UPDATE CASCADE;
