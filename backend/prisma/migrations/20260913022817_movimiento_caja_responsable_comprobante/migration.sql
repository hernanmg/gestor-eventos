-- AlterTable
ALTER TABLE "MovimientoCaja" ADD COLUMN     "comprobante_data" BYTEA,
ADD COLUMN     "comprobante_mime" TEXT,
ADD COLUMN     "comprobante_nombre" TEXT,
ADD COLUMN     "responsable_nombre" TEXT;
