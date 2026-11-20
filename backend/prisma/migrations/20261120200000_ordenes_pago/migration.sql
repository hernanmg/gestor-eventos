-- CreateEnum
CREATE TYPE "EstadoOrdenPago" AS ENUM ('BORRADOR', 'REVISADA', 'AUTORIZADA', 'PAGADA', 'ANULADA');

-- AlterTable
ALTER TABLE "PagoFactura" ADD COLUMN     "orden_pago_id" INTEGER;

-- CreateTable
CREATE TABLE "OrdenPago" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "numero" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "proveedor_id" INTEGER NOT NULL,
    "concepto" TEXT,
    "moneda" "Moneda" NOT NULL DEFAULT 'ARS',
    "total_facturas" DECIMAL(15,2) NOT NULL,
    "total_pagos" DECIMAL(15,2) NOT NULL,
    "estado" "EstadoOrdenPago" NOT NULL DEFAULT 'BORRADOR',
    "elaborado_por" INTEGER,
    "revisado_por" INTEGER,
    "revisado_at" TIMESTAMP(3),
    "autorizado_por" INTEGER,
    "autorizado_at" TIMESTAMP(3),
    "pagada_at" TIMESTAMP(3),
    "notas" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" INTEGER,
    "updated_by" INTEGER,

    CONSTRAINT "OrdenPago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrdenPagoFactura" (
    "id" SERIAL NOT NULL,
    "orden_pago_id" INTEGER NOT NULL,
    "factura_id" INTEGER NOT NULL,
    "orden_item" INTEGER NOT NULL,
    "importe" DECIMAL(15,2) NOT NULL,

    CONSTRAINT "OrdenPagoFactura_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrdenPagoMedio" (
    "id" SERIAL NOT NULL,
    "orden_pago_id" INTEGER NOT NULL,
    "orden_item" INTEGER NOT NULL,
    "medio_pago" "MedioPago" NOT NULL,
    "numero" TEXT,
    "banco" TEXT,
    "fecha_pago" TIMESTAMP(3) NOT NULL,
    "importe" DECIMAL(15,2) NOT NULL,

    CONSTRAINT "OrdenPagoMedio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrdenPago_proveedor_id_idx" ON "OrdenPago"("proveedor_id");

-- CreateIndex
CREATE UNIQUE INDEX "OrdenPago_empresa_id_numero_key" ON "OrdenPago"("empresa_id", "numero");

-- CreateIndex
CREATE INDEX "OrdenPagoFactura_orden_pago_id_idx" ON "OrdenPagoFactura"("orden_pago_id");

-- CreateIndex
CREATE INDEX "OrdenPagoFactura_factura_id_idx" ON "OrdenPagoFactura"("factura_id");

-- CreateIndex
CREATE INDEX "OrdenPagoMedio_orden_pago_id_idx" ON "OrdenPagoMedio"("orden_pago_id");

-- AddForeignKey
ALTER TABLE "OrdenPago" ADD CONSTRAINT "OrdenPago_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenPago" ADD CONSTRAINT "OrdenPago_proveedor_id_fkey" FOREIGN KEY ("proveedor_id") REFERENCES "Proveedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenPagoFactura" ADD CONSTRAINT "OrdenPagoFactura_orden_pago_id_fkey" FOREIGN KEY ("orden_pago_id") REFERENCES "OrdenPago"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenPagoFactura" ADD CONSTRAINT "OrdenPagoFactura_factura_id_fkey" FOREIGN KEY ("factura_id") REFERENCES "Factura"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenPagoMedio" ADD CONSTRAINT "OrdenPagoMedio_orden_pago_id_fkey" FOREIGN KEY ("orden_pago_id") REFERENCES "OrdenPago"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PagoFactura" ADD CONSTRAINT "PagoFactura_orden_pago_id_fkey" FOREIGN KEY ("orden_pago_id") REFERENCES "OrdenPago"("id") ON DELETE SET NULL ON UPDATE CASCADE;

