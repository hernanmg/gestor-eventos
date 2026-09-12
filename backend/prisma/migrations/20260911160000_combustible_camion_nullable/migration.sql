-- DropForeignKey
ALTER TABLE "CargaCombustible" DROP CONSTRAINT "CargaCombustible_camion_id_fkey";

-- AlterTable
ALTER TABLE "CargaCombustible" ALTER COLUMN "camion_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "CargaCombustible" ADD CONSTRAINT "CargaCombustible_camion_id_fkey" FOREIGN KEY ("camion_id") REFERENCES "Camion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
