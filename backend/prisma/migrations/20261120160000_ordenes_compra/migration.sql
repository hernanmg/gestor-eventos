-- CreateEnum
CREATE TYPE "EstadoOrdenCompra" AS ENUM ('BORRADOR', 'EMITIDA', 'RECIBIDA', 'CERRADA', 'ANULADA');

-- AlterTable
ALTER TABLE "Factura" ADD COLUMN     "orden_compra_id" INTEGER;

-- CreateTable
CREATE TABLE "OrdenCompra" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "numero" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "proveedor_id" INTEGER NOT NULL,
    "evento_id" INTEGER,
    "contacto" TEXT,
    "telefono" TEXT,
    "domicilio" TEXT,
    "ciudad" TEXT,
    "entrega" TEXT,
    "direccion_entrega" TEXT,
    "plazo_pago" TEXT,
    "forma_pago" TEXT,
    "referencia_proveedor" TEXT,
    "moneda" "Moneda" NOT NULL DEFAULT 'ARS',
    "iva_porcentaje" DECIMAL(5,2) NOT NULL DEFAULT 21,
    "subtotal" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "iva" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "estado" "EstadoOrdenCompra" NOT NULL DEFAULT 'BORRADOR',
    "emitida_at" TIMESTAMP(3),
    "emitida_por" INTEGER,
    "recibida_at" TIMESTAMP(3),
    "notas" TEXT,
    "notas_cotejo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" INTEGER,

    CONSTRAINT "OrdenCompra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrdenCompraItem" (
    "id" SERIAL NOT NULL,
    "orden_id" INTEGER NOT NULL,
    "orden_item" INTEGER NOT NULL,
    "codigo" TEXT,
    "descripcion" TEXT NOT NULL,
    "cantidad" DECIMAL(12,2) NOT NULL,
    "precio_unitario" DECIMAL(15,2) NOT NULL,
    "total" DECIMAL(15,2) NOT NULL,
    "cantidad_recibida" DECIMAL(12,2),

    CONSTRAINT "OrdenCompraItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrdenCompra_proveedor_id_idx" ON "OrdenCompra"("proveedor_id");

-- CreateIndex
CREATE UNIQUE INDEX "OrdenCompra_empresa_id_numero_key" ON "OrdenCompra"("empresa_id", "numero");

-- CreateIndex
CREATE INDEX "OrdenCompraItem_orden_id_idx" ON "OrdenCompraItem"("orden_id");

-- AddForeignKey
ALTER TABLE "OrdenCompra" ADD CONSTRAINT "OrdenCompra_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenCompra" ADD CONSTRAINT "OrdenCompra_proveedor_id_fkey" FOREIGN KEY ("proveedor_id") REFERENCES "Proveedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenCompra" ADD CONSTRAINT "OrdenCompra_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "Evento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenCompraItem" ADD CONSTRAINT "OrdenCompraItem_orden_id_fkey" FOREIGN KEY ("orden_id") REFERENCES "OrdenCompra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Factura" ADD CONSTRAINT "Factura_orden_compra_id_fkey" FOREIGN KEY ("orden_compra_id") REFERENCES "OrdenCompra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

