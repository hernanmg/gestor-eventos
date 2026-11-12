-- Vínculo de la bitácora de viajes con un Evento real (tab Logística del evento).
-- CargaCombustible.evento_id ya existía desde la migración de combustible.

-- AlterTable
ALTER TABLE "BitacoraViaje" ADD COLUMN     "evento_id" INTEGER;

-- CreateIndex
CREATE INDEX "BitacoraViaje_evento_id_idx" ON "BitacoraViaje"("evento_id");

-- AddForeignKey
ALTER TABLE "BitacoraViaje" ADD CONSTRAINT "BitacoraViaje_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "Evento"("id") ON DELETE SET NULL ON UPDATE CASCADE;
