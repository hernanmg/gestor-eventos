-- AlterTable
ALTER TABLE "CargaCombustible" ADD COLUMN     "movimiento_caja_id" INTEGER,
ALTER COLUMN "litros" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "CargaCombustible_movimiento_caja_id_key" ON "CargaCombustible"("movimiento_caja_id");

-- AddForeignKey
ALTER TABLE "CargaCombustible" ADD CONSTRAINT "CargaCombustible_movimiento_caja_id_fkey" FOREIGN KEY ("movimiento_caja_id") REFERENCES "MovimientoCaja"("id") ON DELETE SET NULL ON UPDATE CASCADE;

