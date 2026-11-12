-- CreateEnum
CREATE TYPE "FaseEvento" AS ENUM ('VIAJE_IDA', 'MONTAJE', 'EVENTO', 'DESMONTAJE', 'VIAJE_VUELTA');

-- CreateEnum
CREATE TYPE "EstadoTarea" AS ENUM ('PENDIENTE', 'EN_CURSO', 'HECHA');

-- AlterTable
ALTER TABLE "CronogramaEvento" ADD COLUMN     "estado" "EstadoTarea" NOT NULL DEFAULT 'PENDIENTE',
ADD COLUMN     "fase" "FaseEvento",
ADD COLUMN     "rubro_evento_id" INTEGER;

-- CreateTable
CREATE TABLE "PlantillaTarea" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "rubro_id" INTEGER NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "actividad" TEXT NOT NULL,
    "fase" "FaseEvento" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" INTEGER,

    CONSTRAINT "PlantillaTarea_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlantillaTarea_rubro_id_idx" ON "PlantillaTarea"("rubro_id");

-- CreateIndex
CREATE INDEX "CronogramaEvento_rubro_evento_id_idx" ON "CronogramaEvento"("rubro_evento_id");

-- AddForeignKey
ALTER TABLE "CronogramaEvento" ADD CONSTRAINT "CronogramaEvento_rubro_evento_id_fkey" FOREIGN KEY ("rubro_evento_id") REFERENCES "RubroEvento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlantillaTarea" ADD CONSTRAINT "PlantillaTarea_rubro_id_fkey" FOREIGN KEY ("rubro_id") REFERENCES "Rubro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

