-- CreateEnum
CREATE TYPE "OrigenMaterialRental" AS ENUM ('NAC', 'IMP');

-- CreateEnum
CREATE TYPE "EstadoPresupuesto" AS ENUM ('BORRADOR', 'ENVIADO', 'APROBADO', 'CERRADO');

-- CreateTable
CREATE TABLE "MaterialRental" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "origen" "OrigenMaterialRental" NOT NULL,
    "nro_item" INTEGER,
    "codigo_oficial" TEXT,
    "detalle" TEXT NOT NULL,
    "medida" TEXT,
    "peso_por_unidad" DECIMAL(10,3),
    "costo_unitario_ars" DECIMAL(14,2),
    "costo_unitario_usd" DECIMAL(12,2),
    "tipo_cambio" DECIMAL(10,2),
    "porc_2" BOOLEAN NOT NULL DEFAULT false,
    "porc_4" BOOLEAN NOT NULL DEFAULT false,
    "porc_6" BOOLEAN NOT NULL DEFAULT false,
    "porc_8" BOOLEAN NOT NULL DEFAULT false,
    "porc_10" BOOLEAN NOT NULL DEFAULT false,
    "porc_full" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" INTEGER,

    CONSTRAINT "MaterialRental_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PresupuestoEvento" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "evento_id" INTEGER,
    "nombre" TEXT NOT NULL,
    "estado" "EstadoPresupuesto" NOT NULL DEFAULT 'BORRADOR',
    "porcentaje_alquiler" TEXT NOT NULL,
    "tipo_cambio_usd" DECIMAL(10,2) NOT NULL DEFAULT 1700,
    "notas" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "version_de_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" INTEGER,

    CONSTRAINT "PresupuestoEvento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PresupuestoLinea" (
    "id" SERIAL NOT NULL,
    "presupuesto_id" INTEGER NOT NULL,
    "material_id" INTEGER NOT NULL,
    "cantidad" DECIMAL(12,2) NOT NULL,
    "costo_unitario_snap" DECIMAL(14,2) NOT NULL,
    "tipo_cambio_snap" DECIMAL(10,2),
    "porcentaje_snap" DECIMAL(5,2) NOT NULL,
    "costo_total_material" DECIMAL(16,2) NOT NULL,
    "valor_rental" DECIMAL(16,2) NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PresupuestoLinea_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MaterialRental_empresa_id_origen_idx" ON "MaterialRental"("empresa_id", "origen");

-- CreateIndex
CREATE INDEX "PresupuestoEvento_empresa_id_estado_idx" ON "PresupuestoEvento"("empresa_id", "estado");

-- CreateIndex
CREATE INDEX "PresupuestoEvento_evento_id_idx" ON "PresupuestoEvento"("evento_id");

-- CreateIndex
CREATE INDEX "PresupuestoLinea_presupuesto_id_idx" ON "PresupuestoLinea"("presupuesto_id");

-- CreateIndex
CREATE INDEX "PresupuestoLinea_material_id_idx" ON "PresupuestoLinea"("material_id");

-- AddForeignKey
ALTER TABLE "MaterialRental" ADD CONSTRAINT "MaterialRental_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresupuestoEvento" ADD CONSTRAINT "PresupuestoEvento_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresupuestoEvento" ADD CONSTRAINT "PresupuestoEvento_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "Evento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresupuestoEvento" ADD CONSTRAINT "PresupuestoEvento_version_de_id_fkey" FOREIGN KEY ("version_de_id") REFERENCES "PresupuestoEvento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresupuestoLinea" ADD CONSTRAINT "PresupuestoLinea_presupuesto_id_fkey" FOREIGN KEY ("presupuesto_id") REFERENCES "PresupuestoEvento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresupuestoLinea" ADD CONSTRAINT "PresupuestoLinea_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "MaterialRental"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

