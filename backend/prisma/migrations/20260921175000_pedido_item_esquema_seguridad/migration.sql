-- AlterTable
ALTER TABLE "Evento" ADD COLUMN     "lugar" TEXT;

-- AlterTable
ALTER TABLE "PedidoItem" ADD COLUMN     "fecha_turno" TIMESTAMP(3),
ADD COLUMN     "hora_fin_turno" TEXT,
ADD COLUMN     "hora_inicio_turno" TEXT,
ADD COLUMN     "horas_por_agente" DECIMAL(5,2),
ADD COLUMN     "tipo_turno" TEXT,
ADD COLUMN     "total_horas_turno" DECIMAL(8,2),
ADD COLUMN     "ubicacion_turno" TEXT;

-- CreateIndex
CREATE INDEX "PedidoItem_rubro_evento_id_fecha_turno_idx" ON "PedidoItem"("rubro_evento_id", "fecha_turno");

-- Backfill: eventos creados desde el wizard Pre-Macro ya tienen el lugar cargado
-- en PreMacro.lugar_nombre / lugar_ciudad — se copia a Evento.lugar para que la
-- Ficha exportada muestre "Ubicación" sin que haya que recargarlo a mano.
UPDATE "Evento" e
SET "lugar" = NULLIF(concat_ws(', ', NULLIF(btrim(pm."lugar_nombre"), ''), NULLIF(btrim(pm."lugar_ciudad"), '')), '')
FROM "PreMacro" pm
WHERE pm."evento_id" = e."id" AND e."lugar" IS NULL;
