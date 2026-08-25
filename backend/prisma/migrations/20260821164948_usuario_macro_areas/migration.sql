-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "areas_macro" TEXT[],
ADD COLUMN     "puede_ver_macro" BOOLEAN NOT NULL DEFAULT false;

