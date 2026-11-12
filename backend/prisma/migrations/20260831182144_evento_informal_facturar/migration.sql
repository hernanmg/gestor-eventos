-- AlterTable
ALTER TABLE "Evento" ADD COLUMN     "es_informal" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "facturar" BOOLEAN,
ADD COLUMN     "facturar_notas" TEXT;
