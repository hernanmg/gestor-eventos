-- AlterTable: add columns with safe defaults, then backfill
ALTER TABLE "TabConfig"
  ADD COLUMN "activo"     BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "es_sistema" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "orden"      INTEGER NOT NULL DEFAULT 0;

-- Backfill: set orden = numero and es_sistema = true for all existing rows
UPDATE "TabConfig" SET "orden" = "numero", "es_sistema" = true;
