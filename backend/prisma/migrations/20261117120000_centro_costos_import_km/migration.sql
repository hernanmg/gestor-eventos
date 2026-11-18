-- AlterTable
ALTER TABLE "Movimiento" ADD COLUMN "import_key" TEXT;

-- AlterTable
ALTER TABLE "ExtraEvento" ADD COLUMN "import_key" TEXT;

-- CreateIndex
CREATE INDEX "Movimiento_evento_id_import_key_idx" ON "Movimiento"("evento_id", "import_key");
