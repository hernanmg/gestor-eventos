-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Rol" ADD VALUE 'JORNALERO';
ALTER TYPE "Rol" ADD VALUE 'PAÑOLERO';

-- AlterTable
ALTER TABLE "Empleado" ADD COLUMN     "contacto_emergencia_tel2" TEXT,
ADD COLUMN     "tipo_contratacion" TEXT,
ALTER COLUMN "dni" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "apodo" TEXT,
ADD COLUMN     "telefono" TEXT;
