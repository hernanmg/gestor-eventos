-- CreateEnum
CREATE TYPE "UbicacionStock" AS ENUM ('DEPOSITO', 'EN_EVENTO', 'EN_TRANSITO', 'BAJA');

-- CreateEnum
CREATE TYPE "EstadoAsignacion" AS ENUM ('ACTIVA', 'TRANSFERIDA', 'DEVUELTA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "OrigenTransfer" AS ENUM ('DEPOSITO', 'EVENTO');

-- CreateTable
CREATE TABLE "Producto" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "categoria" TEXT,
    "codigo" TEXT,
    "stock_total" INTEGER NOT NULL,
    "stock_minimo" INTEGER NOT NULL DEFAULT 0,
    "unidad" TEXT NOT NULL DEFAULT 'unidad',
    "notas" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" INTEGER,
    "updated_by" INTEGER,

    CONSTRAINT "Producto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AsignacionStock" (
    "id" SERIAL NOT NULL,
    "producto_id" INTEGER NOT NULL,
    "evento_id" INTEGER NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "fecha_salida" TIMESTAMP(3) NOT NULL,
    "fecha_retorno" TIMESTAMP(3),
    "ubicacion" "UbicacionStock" NOT NULL DEFAULT 'EN_EVENTO',
    "estado" "EstadoAsignacion" NOT NULL DEFAULT 'ACTIVA',
    "origen" "OrigenTransfer" NOT NULL DEFAULT 'DEPOSITO',
    "evento_origen_id" INTEGER,
    "notas" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" INTEGER,
    "updated_by" INTEGER,

    CONSTRAINT "AsignacionStock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovimientoStock" (
    "id" SERIAL NOT NULL,
    "producto_id" INTEGER NOT NULL,
    "asignacion_id" INTEGER,
    "tipo" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "evento_origen_id" INTEGER,
    "evento_destino_id" INTEGER,
    "fecha" TIMESTAMP(3) NOT NULL,
    "descripcion" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER,

    CONSTRAINT "MovimientoStock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Producto_codigo_key" ON "Producto"("codigo");

-- AddForeignKey
ALTER TABLE "AsignacionStock" ADD CONSTRAINT "AsignacionStock_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AsignacionStock" ADD CONSTRAINT "AsignacionStock_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "Evento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AsignacionStock" ADD CONSTRAINT "AsignacionStock_evento_origen_id_fkey" FOREIGN KEY ("evento_origen_id") REFERENCES "Evento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoStock" ADD CONSTRAINT "MovimientoStock_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoStock" ADD CONSTRAINT "MovimientoStock_asignacion_id_fkey" FOREIGN KEY ("asignacion_id") REFERENCES "AsignacionStock"("id") ON DELETE SET NULL ON UPDATE CASCADE;
