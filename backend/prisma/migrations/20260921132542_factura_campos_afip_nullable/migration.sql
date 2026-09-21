-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TipoComprobanteEmitido" ADD VALUE 'NOTA_DEBITO_C';
ALTER TYPE "TipoComprobanteEmitido" ADD VALUE 'RECIBO_B';
ALTER TYPE "TipoComprobanteEmitido" ADD VALUE 'LIQUIDACION_A';
ALTER TYPE "TipoComprobanteEmitido" ADD VALUE 'TIQUE_FACTURA_A';

-- DropForeignKey
ALTER TABLE "Factura" DROP CONSTRAINT "Factura_evento_id_fkey";

-- DropForeignKey
ALTER TABLE "Factura" DROP CONSTRAINT "Factura_proveedor_id_fkey";

-- AlterTable
ALTER TABLE "Factura" ADD COLUMN     "exento" DECIMAL(15,2),
ADD COLUMN     "iva_importe" DECIMAL(15,2),
ADD COLUMN     "neto_gravado" DECIMAL(15,2),
ADD COLUMN     "no_gravado" DECIMAL(15,2),
ADD COLUMN     "origen_import" TEXT,
ADD COLUMN     "pdf_nombre_afip" TEXT,
ADD COLUMN     "tiene_comprobante_fisico" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tiene_pdf" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tipo_comprobante" "TipoComprobanteEmitido",
ALTER COLUMN "proveedor_id" DROP NOT NULL,
ALTER COLUMN "evento_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Factura" ADD CONSTRAINT "Factura_proveedor_id_fkey" FOREIGN KEY ("proveedor_id") REFERENCES "Proveedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Factura" ADD CONSTRAINT "Factura_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "Evento"("id") ON DELETE SET NULL ON UPDATE CASCADE;
