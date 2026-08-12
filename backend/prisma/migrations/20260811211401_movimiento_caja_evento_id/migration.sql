-- AlterTable
ALTER TABLE "MovimientoCaja" ADD COLUMN     "evento_id" INTEGER;

-- AddForeignKey
ALTER TABLE "MovimientoCaja" ADD CONSTRAINT "MovimientoCaja_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "Evento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: antes de EventoCuenta, cuenta:evento era 1:1 — los movimientos
-- existentes heredan el evento_id que ya tenía su cuenta, para no aparecer
-- "sin evento" en la tab Caja del evento al que siempre pertenecieron.
UPDATE "MovimientoCaja" mc
SET "evento_id" = cb."evento_id"
FROM "CuentaBancaria" cb
WHERE mc."cuenta_id" = cb."id" AND cb."evento_id" IS NOT NULL;
