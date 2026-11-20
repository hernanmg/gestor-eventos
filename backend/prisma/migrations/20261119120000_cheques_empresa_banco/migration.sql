-- CreateEnum
CREATE TYPE "TipoCheque" AS ENUM ('PAGO', 'FINANCIAMIENTO_PROPIO', 'FINANCIAMIENTO_AVALADO');

-- CreateEnum
CREATE TYPE "FormatoCheque" AS ENUM ('ECHEQ', 'FISICO');

-- AlterTable: empresa_id se agrega nullable, se completa desde el evento y recién ahí pasa a NOT NULL
ALTER TABLE "Echeq" ADD COLUMN "empresa_id" INTEGER,
ADD COLUMN "banco" TEXT,
ADD COLUMN "formato" "FormatoCheque" NOT NULL DEFAULT 'ECHEQ',
ADD COLUMN "tipo" "TipoCheque" NOT NULL DEFAULT 'PAGO',
ADD COLUMN "sgr_id" INTEGER;

UPDATE "Echeq" e SET "empresa_id" = ev."empresa_id" FROM "Evento" ev WHERE ev."id" = e."evento_id";

ALTER TABLE "Echeq" ALTER COLUMN "empresa_id" SET NOT NULL;

ALTER TABLE "Echeq" ALTER COLUMN "evento_id" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Echeq_empresa_id_fecha_cobro_estimada_idx" ON "Echeq"("empresa_id", "fecha_cobro_estimada");

-- AddForeignKey
ALTER TABLE "Echeq" ADD CONSTRAINT "Echeq_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Echeq" ADD CONSTRAINT "Echeq_sgr_id_fkey" FOREIGN KEY ("sgr_id") REFERENCES "SGR"("id") ON DELETE SET NULL ON UPDATE CASCADE;
