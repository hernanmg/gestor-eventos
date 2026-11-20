-- AlterTable
ALTER TABLE "Echeq" ADD COLUMN "import_key" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Echeq_empresa_id_import_key_key" ON "Echeq"("empresa_id", "import_key");
