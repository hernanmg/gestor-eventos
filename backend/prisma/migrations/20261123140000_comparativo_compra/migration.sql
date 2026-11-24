-- Comparativo de presupuestos de proveedores (Proveedores, punto 15)
-- CreateEnum
CREATE TYPE "EstadoComparativo" AS ENUM ('ABIERTO', 'DECIDIDO', 'ANULADO');

-- CreateTable
CREATE TABLE "ComparativoCompra" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "numero" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "titulo" TEXT NOT NULL,
    "evento_id" INTEGER,
    "moneda" "Moneda" NOT NULL DEFAULT 'ARS',
    "notas" TEXT,
    "estado" "EstadoComparativo" NOT NULL DEFAULT 'ABIERTO',
    "cotizacion_elegida_id" INTEGER,
    "motivo_eleccion" TEXT,
    "decidido_por" INTEGER,
    "decidido_at" TIMESTAMP(3),
    "orden_compra_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" INTEGER,

    CONSTRAINT "ComparativoCompra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComparativoItem" (
    "id" SERIAL NOT NULL,
    "comparativo_id" INTEGER NOT NULL,
    "orden_item" INTEGER NOT NULL,
    "codigo" TEXT,
    "descripcion" TEXT NOT NULL,
    "cantidad" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "ComparativoItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CotizacionProveedor" (
    "id" SERIAL NOT NULL,
    "comparativo_id" INTEGER NOT NULL,
    "orden" INTEGER NOT NULL,
    "proveedor_id" INTEGER NOT NULL,
    "referencia" TEXT,
    "fecha" TIMESTAMP(3),
    "validez" TEXT,
    "plazo_entrega" TEXT,
    "plazo_pago" TEXT,
    "forma_pago" TEXT,
    "iva_porcentaje" DECIMAL(5,2) NOT NULL DEFAULT 21,
    "precios" JSONB NOT NULL,
    "subtotal" DECIMAL(15,2) NOT NULL,
    "total" DECIMAL(15,2) NOT NULL,
    "notas" TEXT,

    CONSTRAINT "CotizacionProveedor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ComparativoCompra_orden_compra_id_key" ON "ComparativoCompra"("orden_compra_id");

-- CreateIndex
CREATE UNIQUE INDEX "ComparativoCompra_empresa_id_numero_key" ON "ComparativoCompra"("empresa_id", "numero");

-- CreateIndex
CREATE INDEX "ComparativoItem_comparativo_id_idx" ON "ComparativoItem"("comparativo_id");

-- CreateIndex
CREATE INDEX "CotizacionProveedor_comparativo_id_idx" ON "CotizacionProveedor"("comparativo_id");

-- AddForeignKey
ALTER TABLE "ComparativoCompra" ADD CONSTRAINT "ComparativoCompra_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComparativoCompra" ADD CONSTRAINT "ComparativoCompra_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "Evento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComparativoCompra" ADD CONSTRAINT "ComparativoCompra_orden_compra_id_fkey" FOREIGN KEY ("orden_compra_id") REFERENCES "OrdenCompra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComparativoItem" ADD CONSTRAINT "ComparativoItem_comparativo_id_fkey" FOREIGN KEY ("comparativo_id") REFERENCES "ComparativoCompra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CotizacionProveedor" ADD CONSTRAINT "CotizacionProveedor_comparativo_id_fkey" FOREIGN KEY ("comparativo_id") REFERENCES "ComparativoCompra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CotizacionProveedor" ADD CONSTRAINT "CotizacionProveedor_proveedor_id_fkey" FOREIGN KEY ("proveedor_id") REFERENCES "Proveedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

