-- CreateEnum
CREATE TYPE "BloqueCostoReal" AS ENUM ('STAFF', 'ALOJAMIENTO', 'COMIDAS', 'COMBUSTIBLE_PERSONAL', 'COMBUSTIBLE_MATERIAL', 'PANOL', 'VARIOS', 'RENTAL_NAC', 'RENTAL_IMP', 'PERDIDAS');

-- CreateEnum
CREATE TYPE "OrigenLineaCostoReal" AS ENUM ('MANUAL', 'PLANILLA', 'SISTEMA');

-- AlterEnum
ALTER TYPE "ModalidadEvento" ADD VALUE 'OPERATIVA';

-- CreateTable
CREATE TABLE "LineaCostoReal" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "evento_id" INTEGER NOT NULL,
    "bloque" "BloqueCostoReal" NOT NULL,
    "origen" "OrigenLineaCostoReal" NOT NULL DEFAULT 'MANUAL',
    "orden" INTEGER NOT NULL DEFAULT 0,
    "concepto" TEXT NOT NULL,
    "detalle" TEXT,
    "codigo" TEXT,
    "cantidad" DECIMAL(14,3) NOT NULL DEFAULT 1,
    "valor_unitario" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "porcentaje" DECIMAL(6,2),
    "total" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "fecha_desde" TIMESTAMP(3),
    "fecha_hasta" TIMESTAMP(3),
    "notas" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" INTEGER,
    "updated_by" INTEGER,

    CONSTRAINT "LineaCostoReal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LineaCostoReal_evento_id_bloque_idx" ON "LineaCostoReal"("evento_id", "bloque");

-- AddForeignKey
ALTER TABLE "LineaCostoReal" ADD CONSTRAINT "LineaCostoReal_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "Evento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

