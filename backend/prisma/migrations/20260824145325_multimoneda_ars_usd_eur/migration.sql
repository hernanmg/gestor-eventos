-- AlterEnum
ALTER TYPE "Moneda" ADD VALUE 'EUR';

-- AlterTable
ALTER TABLE "Echeq" ADD COLUMN     "monto_ars" DECIMAL(15,2),
ADD COLUMN     "tasa_cambio" DECIMAL(10,4);

-- AlterTable
ALTER TABLE "Factura" ADD COLUMN     "monto_ars" DECIMAL(15,2),
ADD COLUMN     "tasa_cambio" DECIMAL(10,4);

-- AlterTable
ALTER TABLE "Movimiento" ADD COLUMN     "monto_ars" DECIMAL(15,2),
ADD COLUMN     "tasa_cambio" DECIMAL(10,4);

-- AlterTable
ALTER TABLE "MovimientoCaja" ADD COLUMN     "moneda" "Moneda",
ADD COLUMN     "monto_ars" DECIMAL(15,2),
ADD COLUMN     "tasa_cambio" DECIMAL(10,4);

