-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "debe_cambiar_password" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "permisos" TEXT[] DEFAULT ARRAY[]::TEXT[];
