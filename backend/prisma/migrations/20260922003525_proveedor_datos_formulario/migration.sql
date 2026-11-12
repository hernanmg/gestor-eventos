-- AlterTable
ALTER TABLE "Proveedor" ADD COLUMN     "alias_bancario" TEXT,
ADD COLUMN     "banco" TEXT,
ADD COLUMN     "cbu" TEXT,
ADD COLUMN     "dni" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "numero_cuenta" TEXT,
ADD COLUMN     "puede_facturar" BOOLEAN,
ADD COLUMN     "servicio" TEXT,
ADD COLUMN     "tipo_factura" TEXT,
ADD COLUMN     "titular_cuenta" TEXT;
