-- AlterEnum
ALTER TYPE "TipoAnticipo" ADD VALUE 'MULTA';

-- AlterTable
ALTER TABLE "Anticipo" ADD COLUMN     "liquidacion_admin_id" INTEGER;

-- AlterTable
ALTER TABLE "EscalafonAdmin" ADD COLUMN     "premio_viaje_nacional" DECIMAL(10,2),
ADD COLUMN     "premio_viaje_nacional_1000" DECIMAL(10,2),
ADD COLUMN     "premio_viaje_provincial" DECIMAL(10,2);

-- AddForeignKey
ALTER TABLE "Anticipo" ADD CONSTRAINT "Anticipo_liquidacion_admin_id_fkey" FOREIGN KEY ("liquidacion_admin_id") REFERENCES "LiquidacionAdmin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
