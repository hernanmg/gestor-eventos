-- CreateTable CategoriaStock first
CREATE TABLE "CategoriaStock" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "color" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    "created_by" INTEGER,

    CONSTRAINT "CategoriaStock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CategoriaStock_nombre_key" ON "CategoriaStock"("nombre");

-- Seed: insert base categories for events domain
INSERT INTO "CategoriaStock" ("nombre", "color") VALUES
  ('Audio',       '#3B82F6'),
  ('Iluminación', '#F59E0B'),
  ('Escenario',   '#8B5CF6'),
  ('Mobiliario',  '#10B981'),
  ('Transporte',  '#6366F1'),
  ('Energía',     '#EF4444'),
  ('Seguridad',   '#64748B'),
  ('Utilería',    '#EC4899');

-- Migrate existing string categoria values from Producto to CategoriaStock
INSERT INTO "CategoriaStock" ("nombre", "color")
SELECT DISTINCT "categoria", '#6B7280'
FROM "Producto"
WHERE "categoria" IS NOT NULL
  AND "categoria" != ''
  AND "categoria" NOT IN (SELECT "nombre" FROM "CategoriaStock")
ON CONFLICT ("nombre") DO NOTHING;

-- Add categoria_id column (nullable)
ALTER TABLE "Producto" ADD COLUMN "categoria_id" INTEGER;

-- Link existing products to their CategoriaStock entry
UPDATE "Producto" p
SET "categoria_id" = c."id"
FROM "CategoriaStock" c
WHERE p."categoria" = c."nombre"
  AND p."categoria" IS NOT NULL;

-- AddForeignKey
ALTER TABLE "Producto" ADD CONSTRAINT "Producto_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "CategoriaStock"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Drop the old string column
ALTER TABLE "Producto" DROP COLUMN "categoria";
