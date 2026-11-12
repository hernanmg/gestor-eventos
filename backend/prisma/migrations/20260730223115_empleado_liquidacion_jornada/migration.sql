-- AlterEnum
ALTER TYPE "CategoriaEmpleado" ADD VALUE 'JORNALERO';
ALTER TYPE "CategoriaEmpleado" ADD VALUE 'FOFI';
ALTER TYPE "CategoriaEmpleado" ADD VALUE 'NESTORAS';
ALTER TYPE "CategoriaEmpleado" ADD VALUE 'EXTRANJERO';
ALTER TYPE "CategoriaEmpleado" ADD VALUE 'SERENO';

-- CreateEnum
CREATE TYPE "TipoLiquidacion" AS ENUM ('LINEAL', 'JORNADA');

-- AlterTable
ALTER TABLE "Empleado" ADD COLUMN     "tipo_liquidacion" "TipoLiquidacion" NOT NULL DEFAULT 'LINEAL',
ADD COLUMN     "valor_jornada_completa" DECIMAL(10,2),
ADD COLUMN     "valor_media_jornada" DECIMAL(10,2),
ADD COLUMN     "umbral_horas_jornada" DECIMAL(5,2),
ADD COLUMN     "umbral_horas_media" DECIMAL(5,2),
ADD COLUMN     "valor_hora_extra_jornada" DECIMAL(10,2),
ADD COLUMN     "valor_viaje" DECIMAL(10,2),
ADD COLUMN     "apodo" TEXT,
ADD COLUMN     "fecha_nacimiento" TIMESTAMP(3),
ADD COLUMN     "grupo_sanguineo" TEXT,
ADD COLUMN     "contacto_emergencia_nombre" TEXT,
ADD COLUMN     "contacto_emergencia_tel" TEXT,
ADD COLUMN     "escalafon" INTEGER,
ADD COLUMN     "art" TEXT,
ADD COLUMN     "licencia_conducir" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "equipamiento_asignado" TEXT,
ADD COLUMN     "talle_pantalon" TEXT,
ADD COLUMN     "talle_remera" TEXT,
ADD COLUMN     "talle_buzo" TEXT,
ADD COLUMN     "talle_calzado" TEXT;

-- AlterTable
ALTER TABLE "Jornada" ADD COLUMN     "cantidad_viajes" INTEGER,
ADD COLUMN     "convocatoria" TEXT,
ADD COLUMN     "lugar_trabajo" TEXT,
ADD COLUMN     "camion_id" INTEGER;

-- AlterTable
ALTER TABLE "Liquidacion" ADD COLUMN     "tipo_liquidacion" "TipoLiquidacion" NOT NULL DEFAULT 'LINEAL';

-- AddForeignKey
ALTER TABLE "Jornada" ADD CONSTRAINT "Jornada_camion_id_fkey" FOREIGN KEY ("camion_id") REFERENCES "Camion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
