-- CreateEnum
CREATE TYPE "TipoPanolItem" AS ENUM ('HERRAMIENTA', 'CONSUMIBLE');

-- CreateEnum
CREATE TYPE "EstadoPanolItem" AS ENUM ('DISPONIBLE', 'FUERA_DE_SERVICIO', 'BAJA');

-- CreateEnum
CREATE TYPE "TipoMovPanol" AS ENUM ('SALIDA', 'DEVOLUCION', 'USO_INTERNO', 'BAJA');

-- CreateEnum
CREATE TYPE "EstadoActivo" AS ENUM ('BUENO', 'REGULAR', 'DETERIORADO', 'BAJA');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "UbicacionStock" ADD VALUE 'EXCEDENTE';
ALTER TYPE "UbicacionStock" ADD VALUE 'ALQUILADO';

-- DropIndex
DROP INDEX "Producto_codigo_empresa_id_key";

-- AlterTable
ALTER TABLE "AsignacionStock" ADD COLUMN     "camion_id" INTEGER,
ADD COLUMN     "cantidad_excedente" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "cuna_id" INTEGER,
ADD COLUMN     "firmado_llegada" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "firmado_llegada_at" TIMESTAMP(3),
ADD COLUMN     "firmado_llegada_por" INTEGER,
ADD COLUMN     "firmado_retorno" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "firmado_retorno_at" TIMESTAMP(3),
ADD COLUMN     "firmado_retorno_por" INTEGER,
ADD COLUMN     "firmado_salida" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "firmado_salida_at" TIMESTAMP(3),
ADD COLUMN     "firmado_salida_por" INTEGER;

-- AlterTable
-- Preserve existing "codigo" values by renaming into "codigo_interno" instead of drop+add
ALTER TABLE "Producto" RENAME COLUMN "codigo" TO "codigo_interno";

ALTER TABLE "Producto" ADD COLUMN     "catalogo_origen" TEXT,
ADD COLUMN     "codigo_externo" TEXT,
ADD COLUMN     "es_critico" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "foto_data" BYTEA,
ADD COLUMN     "foto_mime" TEXT,
ADD COLUMN     "foto_nombre" TEXT,
ADD COLUMN     "nombre_interno" TEXT,
ADD COLUMN     "nombre_tecnico" TEXT,
ADD COLUMN     "valor_unitario" DECIMAL(10,2);

-- CreateTable
CREATE TABLE "Camion" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT,
    "patente" TEXT,
    "tipo" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "Camion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cuna" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "Cuna_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CunaProducto" (
    "id" SERIAL NOT NULL,
    "cuna_id" INTEGER NOT NULL,
    "producto_id" INTEGER NOT NULL,
    "cantidad" INTEGER NOT NULL,

    CONSTRAINT "CunaProducto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PanolItem" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "tipo" "TipoPanolItem" NOT NULL,
    "stock_total" INTEGER NOT NULL,
    "stock_disponible" INTEGER NOT NULL,
    "valor" DECIMAL(10,2),
    "estado" "EstadoPanolItem" NOT NULL DEFAULT 'DISPONIBLE',
    "notas" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" INTEGER,

    CONSTRAINT "PanolItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovimientoPanol" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "panol_item_id" INTEGER NOT NULL,
    "tipo" "TipoMovPanol" NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "evento_id" INTEGER,
    "responsable_id" INTEGER,
    "responsable_nombre" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL,
    "descripcion" TEXT,
    "cantidad_devuelta" INTEGER,
    "cantidad_faltante" INTEGER,
    "motivo_faltante" TEXT,
    "devolucion_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" INTEGER,

    CONSTRAINT "MovimientoPanol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activo" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "categoria" TEXT,
    "numero_serie" TEXT,
    "fecha_compra" TIMESTAMP(3),
    "valor_compra" DECIMAL(12,2),
    "estado" "EstadoActivo" NOT NULL DEFAULT 'BUENO',
    "ubicacion" TEXT,
    "observaciones" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" INTEGER,

    CONSTRAINT "Activo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Camion_codigo_empresa_id_key" ON "Camion"("codigo", "empresa_id");

-- CreateIndex
CREATE UNIQUE INDEX "Cuna_codigo_empresa_id_key" ON "Cuna"("codigo", "empresa_id");

-- CreateIndex
CREATE UNIQUE INDEX "CunaProducto_cuna_id_producto_id_key" ON "CunaProducto"("cuna_id", "producto_id");

-- CreateIndex
CREATE UNIQUE INDEX "Producto_codigo_interno_empresa_id_key" ON "Producto"("codigo_interno", "empresa_id");

-- CreateIndex
CREATE UNIQUE INDEX "Producto_codigo_externo_empresa_id_key" ON "Producto"("codigo_externo", "empresa_id");

-- AddForeignKey
ALTER TABLE "AsignacionStock" ADD CONSTRAINT "AsignacionStock_camion_id_fkey" FOREIGN KEY ("camion_id") REFERENCES "Camion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AsignacionStock" ADD CONSTRAINT "AsignacionStock_cuna_id_fkey" FOREIGN KEY ("cuna_id") REFERENCES "Cuna"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Camion" ADD CONSTRAINT "Camion_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cuna" ADD CONSTRAINT "Cuna_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CunaProducto" ADD CONSTRAINT "CunaProducto_cuna_id_fkey" FOREIGN KEY ("cuna_id") REFERENCES "Cuna"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CunaProducto" ADD CONSTRAINT "CunaProducto_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PanolItem" ADD CONSTRAINT "PanolItem_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoPanol" ADD CONSTRAINT "MovimientoPanol_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoPanol" ADD CONSTRAINT "MovimientoPanol_panol_item_id_fkey" FOREIGN KEY ("panol_item_id") REFERENCES "PanolItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoPanol" ADD CONSTRAINT "MovimientoPanol_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "Evento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activo" ADD CONSTRAINT "Activo_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

