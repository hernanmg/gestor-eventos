-- AlterTable
ALTER TABLE "Empresa" ADD COLUMN     "color_secundario" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "logo_data" BYTEA,
ADD COLUMN     "logo_mime" TEXT,
ADD COLUMN     "logo_nombre" TEXT,
ADD COLUMN     "moneda_default" "Moneda" NOT NULL DEFAULT 'ARS',
ADD COLUMN     "razon_social" TEXT,
ADD COLUMN     "telefono" TEXT,
ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
ADD COLUMN     "updated_by" INTEGER,
ADD COLUMN     "web" TEXT;
