-- AlterTable
ALTER TABLE "Factura" ADD COLUMN     "rubro_id" INTEGER;

-- AddForeignKey
ALTER TABLE "Factura" ADD CONSTRAINT "Factura_rubro_id_fkey" FOREIGN KEY ("rubro_id") REFERENCES "Rubro"("id") ON DELETE SET NULL ON UPDATE CASCADE;
