-- CreateEnum
CREATE TYPE "EstadoFactura" AS ENUM ('RECIBIDA', 'APROBADA', 'PAGADA', 'ANULADA');

-- CreateEnum
CREATE TYPE "MedioPago" AS ENUM ('TRANSFERENCIA', 'ECHEQ', 'EFECTIVO', 'CHEQUE');

-- CreateEnum
CREATE TYPE "CondicionPago" AS ENUM ('CONTADO', 'DIAS_30', 'DIAS_60', 'DIAS_90', 'ECHEQ', 'OTRO');

-- CreateTable
CREATE TABLE "Factura" (
    "id" SERIAL NOT NULL,
    "numero_factura" TEXT NOT NULL,
    "tipo_factura" TEXT NOT NULL,
    "fecha_emision" TIMESTAMP(3) NOT NULL,
    "fecha_vencimiento" TIMESTAMP(3),
    "proveedor_id" INTEGER NOT NULL,
    "evento_id" INTEGER NOT NULL,
    "tab_numero" INTEGER,
    "tipo_movimiento" "Tipo",
    "importe_total" DECIMAL(15,2) NOT NULL,
    "importe_pagado" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "importe_pendiente" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "moneda" "Moneda" NOT NULL DEFAULT 'ARS',
    "condicion_pago" "CondicionPago" NOT NULL DEFAULT 'CONTADO',
    "estado" "EstadoFactura" NOT NULL DEFAULT 'RECIBIDA',
    "notas" TEXT,
    "pdf_data" BYTEA,
    "pdf_nombre" TEXT,
    "pdf_mime_type" TEXT,
    "pdf_tamanio" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" INTEGER,
    "updated_by" INTEGER,

    CONSTRAINT "Factura_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PagoFactura" (
    "id" SERIAL NOT NULL,
    "factura_id" INTEGER NOT NULL,
    "fecha_pago" TIMESTAMP(3) NOT NULL,
    "importe" DECIMAL(15,2) NOT NULL,
    "moneda" "Moneda" NOT NULL DEFAULT 'ARS',
    "medio_pago" "MedioPago" NOT NULL,
    "referencia" TEXT,
    "notas" TEXT,
    "movimiento_id" INTEGER,
    "echeq_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" INTEGER,

    CONSTRAINT "PagoFactura_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PagoFactura_movimiento_id_key" ON "PagoFactura"("movimiento_id");

-- CreateIndex
CREATE UNIQUE INDEX "PagoFactura_echeq_id_key" ON "PagoFactura"("echeq_id");

-- AddForeignKey
ALTER TABLE "Factura" ADD CONSTRAINT "Factura_proveedor_id_fkey" FOREIGN KEY ("proveedor_id") REFERENCES "Proveedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Factura" ADD CONSTRAINT "Factura_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "Evento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PagoFactura" ADD CONSTRAINT "PagoFactura_factura_id_fkey" FOREIGN KEY ("factura_id") REFERENCES "Factura"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PagoFactura" ADD CONSTRAINT "PagoFactura_movimiento_id_fkey" FOREIGN KEY ("movimiento_id") REFERENCES "Movimiento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PagoFactura" ADD CONSTRAINT "PagoFactura_echeq_id_fkey" FOREIGN KEY ("echeq_id") REFERENCES "Echeq"("id") ON DELETE SET NULL ON UPDATE CASCADE;
